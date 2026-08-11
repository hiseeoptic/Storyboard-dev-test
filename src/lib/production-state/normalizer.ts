import type {
  SegmentEntityState,
  SegmentStateChange,
  StoryboardGenerationOutput,
  VideoSegment,
} from "@/types";
import { ProductionIdRegistry } from "./id-registry.ts";
import { compileLegacyPhysicalShot } from "./physical-compiler.ts";
import { validatePhysicalState } from "./physical-validator.ts";
import { compileLegacySpatialGraph } from "./spatial-compiler.ts";
import { validateSpatialState } from "./spatial-validator.ts";
import { compileAtomicActions } from "./action-compiler.ts";
import { validateAtomicActions } from "./action-validator.ts";
import { compileCinematographyState } from "./cinematography-compiler.ts";
import { compileVisibilityState } from "./visibility-compiler.ts";
import { validateCinematographyState } from "./cinematography-validator.ts";
import { compileDialogueAudioState } from "./dialogue-audio-compiler.ts";
import { validateDialogueAudioState } from "./dialogue-audio-validator.ts";
import {
  PRODUCTION_STATE_VERSION,
  type BoundaryState,
  type ProductionEntityKind,
  type ProductionEntitySnapshot,
  type ProductionFinding,
  type ProductionRegistryEntry,
  type ProductionState,
  type ProductionStateChange,
  type ShotState,
} from "./types.ts";

type LegacyBreakdown = Pick<
  StoryboardGenerationOutput,
  "character_locks" | "segments" | "total_duration_seconds" | "scene_bible" | "context_ir"
>;

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function key(value: string): string {
  return clean(value).toLocaleLowerCase();
}

/** Legacy/model sentinels describe the absence of a holder; they are not
 * entities and must never be registered as `entity_none`. Keep the legacy
 * source text untouched and normalize only the additive Production State. */
function isNoEntitySentinel(value: unknown): boolean {
  const normalized = key(clean(value)).replace(/[._-]+/g, " ");
  return /^(?:none|null|nil|n\/a|na|no holder|nobody|no one|unknown holder|không|không ai|không có|không người giữ)$/iu.test(
    normalized
  );
}

function pad(value: number): string {
  return String(value).padStart(3, "0");
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function preferredLegacyId(kind: ProductionEntityKind, value: string): string | undefined {
  const prefix =
    kind === "character" ? "char_" : kind === "location" ? "loc_" : kind === "object" ? "obj_" : "";
  return prefix && value.startsWith(prefix) ? value : undefined;
}

function snapshotDifference(
  before: ProductionEntitySnapshot,
  after: ProductionEntitySnapshot
): Record<string, { previous_end: unknown; current_start: unknown }> {
  const differences: Record<string, { previous_end: unknown; current_start: unknown }> = {};
  const fields = ["state", "position", "holder_entity_id", "orientation", "traces"] as const;
  for (const field of fields) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      differences[field] = {
        previous_end: before[field] ?? null,
        current_start: after[field] ?? null,
      };
    }
  }
  return differences;
}

function transitionFor(segment: VideoSegment, index: number): BoundaryState["transition_mode"] {
  return segment.transition_in?.mode ?? segment.continuity_mode ?? (index === 0 ? "opening" : "scene_cut");
}

/**
 * Convert legacy storyboard fields into one additive canonical state. This
 * function never removes or rewrites state_ledger, spatial_layout, names or
 * prompts. Missing facts stay unknown/empty and are reported as findings.
 */
export function buildProductionState(breakdown: LegacyBreakdown): ProductionState {
  const registry = new ProductionIdRegistry();
  const sourceToEntry = new Map<string, ProductionRegistryEntry>();
  const findings: ProductionFinding[] = [];

  for (const lock of breakdown.character_locks ?? []) {
    const displayName = clean(lock.display_name) || clean(lock.name) || "Unnamed character";
    const entry = registry.register({
      kind: "character",
      displayName,
      preferredId: lock.character_id,
      sourceRef: clean(lock.name) || undefined,
    });
    const legacyName = clean(lock.name);
    if (legacyName && key(legacyName) !== key(displayName)) entry.aliases.push(legacyName);
    sourceToEntry.set(key(displayName), entry);
    if (legacyName) sourceToEntry.set(key(legacyName), entry);
    if (lock.character_id) sourceToEntry.set(key(lock.character_id), entry);
  }

  for (const segment of breakdown.segments ?? []) {
    for (const rawName of segment.characters_in_scene ?? []) {
      const name = clean(rawName);
      if (!name || sourceToEntry.has(key(name))) continue;
      const character = registry.register({
        kind: "character",
        displayName: name,
        sourceRef: name,
      });
      sourceToEntry.set(key(name), character);
    }
    const rawLocation = clean(segment.location_id) || clean(segment.environment_ref);
    if (rawLocation && rawLocation !== "custom") {
      const location = registry.register({
        kind: "location",
        displayName: rawLocation,
        preferredId: preferredLegacyId("location", rawLocation),
        sourceRef: rawLocation,
      });
      sourceToEntry.set(key(rawLocation), location);
    }
    const visualText = clean(
      `${segment.first_frame_prompt} ${segment.motion_prompt} ${segment.continuity_note}`
    );
    if (
      /\b(?:mirror image|reflections?|reflected|in the mirror|mirror|reflective surface)\b|\b(?:ảnh gương|phản chiếu|trong gương|gương|bề mặt phản chiếu)\b/iu.test(visualText) &&
      /\b(?:mirror|reflective surface)\b|\b(?:gương|bề mặt phản chiếu)\b/iu.test(visualText) &&
      !sourceToEntry.has("mirror")
    ) {
      const mirror = registry.register({
        kind: "object",
        displayName: "mirror reflective surface",
        preferredId: "obj_mirror_surface",
        sourceRef: "mirror",
      });
      sourceToEntry.set("mirror", mirror);
      sourceToEntry.set("mirror reflective surface", mirror);
    }
    const ledgerValues = [
      ...(segment.state_ledger?.start ?? []).map((entry) => entry.entity_id),
      ...(segment.state_ledger?.changes ?? []).map((entry) => entry.entity_id),
      ...(segment.state_ledger?.end ?? []).map((entry) => entry.entity_id),
    ];
    for (const rawEntity of ledgerValues) {
      const raw = clean(rawEntity);
      if (!raw || isNoEntitySentinel(raw) || sourceToEntry.has(key(raw))) continue;
      const entry = registry.register({
        kind: "object",
        displayName: raw,
        preferredId: preferredLegacyId("object", raw),
        sourceRef: raw,
      });
      sourceToEntry.set(key(raw), entry);
    }
  }

  const resolveEntity = (raw: string, fallbackKind: ProductionEntityKind = "object") => {
    const value = clean(raw);
    const existing = sourceToEntry.get(key(value));
    if (existing) return existing;
    const created = registry.register({
      kind: fallbackKind,
      displayName: value || "Unknown entity",
      sourceRef: value || undefined,
    });
    if (value) sourceToEntry.set(key(value), created);
    return created;
  };

  const holderId = (holder: string | null | undefined): string | null | undefined => {
    const value = clean(holder);
    if (isNoEntitySentinel(value)) return null;
    return value ? resolveEntity(value, "unknown").entity_id : holder === null ? null : undefined;
  };

  const normalizeSnapshotEntry = (entry: SegmentEntityState): ProductionEntitySnapshot => {
    const entity = resolveEntity(entry.entity_id);
    return {
      entity_id: entity.entity_id,
      kind: entity.kind,
      state: clean(entry.state),
      position: clean(entry.position),
      holder_entity_id: holderId(entry.holder),
      orientation: entry.orientation ?? null,
      ...(entry.traces ? { traces: [...entry.traces] } : {}),
    };
  };

  const normalizeChange = (change: SegmentStateChange): ProductionStateChange => ({
    entity_id: resolveEntity(change.entity_id).entity_id,
    from: clean(change.from),
    action: clean(change.action),
    to: clean(change.to),
    caused_by: clean(change.caused_by),
    ...(change.from_position !== undefined ? { from_position: clean(change.from_position) } : {}),
    ...(change.to_position !== undefined ? { to_position: clean(change.to_position) } : {}),
    ...(change.from_holder !== undefined
      ? { from_holder_entity_id: holderId(change.from_holder) }
      : {}),
    ...(change.to_holder !== undefined ? { to_holder_entity_id: holderId(change.to_holder) } : {}),
    ...(change.from_orientation !== undefined
      ? { from_orientation: change.from_orientation }
      : {}),
    ...(change.to_orientation !== undefined ? { to_orientation: change.to_orientation } : {}),
    ...(change.trace !== undefined ? { trace: clean(change.trace) } : {}),
  });

  const shots: ShotState[] = [];
  const boundaries: BoundaryState[] = [];
  let cursor = 0;

  (breakdown.segments ?? []).forEach((segment, index) => {
    const shotId = `shot_${pad(index + 1)}`;
    const duration = numberOrZero(segment.duration_seconds);
    if (duration === 0) {
      findings.push({
        code: "TIMELINE_INVALID_DURATION",
        severity: "high",
        message: "Shot duration must be a positive finite number.",
        shot_id: shotId,
        entity_ids: [],
        evidence: { duration_seconds: segment.duration_seconds },
        suggested_patch: { op: "set", path: `/shots/${index}/duration_seconds`, value: 10 },
      });
    }

    const rawLocation = clean(segment.location_id) || clean(segment.environment_ref);
    const location = rawLocation && rawLocation !== "custom" ? sourceToEntry.get(key(rawLocation)) : undefined;
    const ledger = segment.state_ledger;
    if (!ledger) {
      findings.push({
        code: "LEGACY_STATE_LEDGER_MISSING",
        severity: "medium",
        message: "Legacy shot has no state ledger; canonical snapshots remain empty.",
        shot_id: shotId,
        entity_ids: [],
        evidence: { segment_number: segment.segment_number },
        suggested_patch: null,
      });
    }

    const startTime = cursor;
    const endTime = cursor + duration;
    const spatial = segment.spatial_layout
      ? { spatial_layout: { ...segment.spatial_layout } }
      : {};
    shots.push({
      shot_id: shotId,
      scene_id: `scene_${pad(index + 1)}`,
      segment_number: segment.segment_number,
      location_id: location?.entity_id ?? null,
      start_time_s: startTime,
      end_time_s: endTime,
      story_time: clean(segment.transition_in?.time_relation) || null,
      spatial_graph: null,
      camera_state: {
        camera_id: `camera_${shotId}`,
        source: "legacy_compiled",
        zone_id: null,
        position_label: "",
        shot_size: "unknown",
        lens_mm: null,
        yaw_deg: null,
        pitch_deg: null,
        roll_deg: null,
        look_target_entity_id: null,
        axis_id: null,
        axis_side: "unknown",
        movement: null,
      },
      lighting_state: {
        source: "legacy_compiled",
        time_of_day: null,
        key_source: null,
        key_direction: "unknown",
        color_temperature_k: null,
        intensity_lux: null,
        shadow_direction: "unknown",
        continuity_group: null,
      },
      dialogue_state: {
        language: null,
        source: "none",
        camera_beat_count: 0,
        turns: [],
      },
      audio_state: {
        environment_sound_bed: null,
        environment_reverb: null,
        ambience_strategy: null,
        music_strategy: null,
        transition_policy: index === 0 ? "open" : "reset_for_cut",
        from_location_id: null,
        to_location_id: null,
        foley_cues: [],
      },
      start_snapshot: {
        entities: (ledger?.start ?? []).map(normalizeSnapshotEntry),
        contacts: [],
        supports: [],
        placements: [],
        visual_instances: [],
        occlusions: [],
        ...spatial,
      },
      changes: (ledger?.changes ?? []).map(normalizeChange),
      actions: [],
      end_snapshot: {
        entities: (ledger?.end ?? []).map(normalizeSnapshotEntry),
        contacts: [],
        supports: [],
        placements: [],
        visual_instances: [],
        occlusions: [],
        ...spatial,
      },
    });

    const mode = transitionFor(segment, index);
    boundaries.push({
      boundary_id: `boundary_${pad(index + 1)}`,
      from_shot_id: index === 0 ? null : `shot_${pad(index)}`,
      to_shot_id: shotId,
      transition_mode: mode,
      time_relation: clean(segment.transition_in?.time_relation) || null,
      preserve: [...(segment.transition_in?.preserve ?? [])],
      reset: [...(segment.transition_in?.reset ?? [])],
      intentional: mode !== "continuous" && mode !== "opening",
      reason: clean(segment.transition_in?.reason) || null,
    });
    cursor = endTime;
  });

  const registryEntries = registry.list();
  shots.forEach((shot, index) => {
    const segment = breakdown.segments[index];
    if (segment) {
      compileLegacyPhysicalShot(shot, segment, registryEntries);
      compileLegacySpatialGraph(shot, segment, registryEntries);
      compileAtomicActions(shot, registryEntries);
      compileCinematographyState({
        shot,
        segment,
        registry: registryEntries,
        sceneBible: breakdown.scene_bible,
      });
      compileVisibilityState(shot, segment, registryEntries);
      compileDialogueAudioState({
        shot,
        segment,
        previousSegment: breakdown.segments[index - 1],
        registry: registryEntries,
        characterLocks: breakdown.character_locks ?? [],
        context: breakdown.context_ir,
      });
    }
  });

  for (let index = 1; index < shots.length; index++) {
    const current = shots[index]!;
    const previous = shots[index - 1]!;
    const boundary = boundaries[index]!;
    if (boundary.transition_mode !== "continuous") continue;
    const previousById = new Map(previous.end_snapshot.entities.map((entry) => [entry.entity_id, entry]));
    for (const currentEntry of current.start_snapshot.entities) {
      const previousEntry = previousById.get(currentEntry.entity_id);
      if (!previousEntry) continue;
      const differences = snapshotDifference(previousEntry, currentEntry);
      if (Object.keys(differences).length === 0) continue;
      findings.push({
        code: "BOUNDARY_CONTINUITY_MISMATCH",
        severity: "high",
        message: "Continuous boundary start snapshot does not match the previous end snapshot.",
        shot_id: current.shot_id,
        entity_ids: [currentEntry.entity_id],
        evidence: { from_shot_id: previous.shot_id, differences },
        suggested_patch: {
          op: "review_boundary",
          from_shot_id: previous.shot_id,
          to_shot_id: current.shot_id,
          choices: ["inherit_previous_end", "add_visible_action", "declare_intentional_transition"],
        },
      });
    }
  }

  if (Math.abs(cursor - breakdown.total_duration_seconds) > 0.001) {
    findings.push({
      code: "TIMELINE_TOTAL_MISMATCH",
      severity: "high",
      message: "The sum of shot durations does not match total_duration_seconds.",
      shot_id: null,
      entity_ids: [],
      evidence: { shot_duration_sum: cursor, total_duration_seconds: breakdown.total_duration_seconds },
      suggested_patch: {
        op: "review_timeline_total",
        choices: ["update_total_duration_seconds", "correct_shot_durations"],
      },
    });
  }

  const state: ProductionState = {
    version: PRODUCTION_STATE_VERSION,
    registry: registryEntries,
    shots,
    boundaries,
    findings,
  };
  state.findings.push(...validatePhysicalState(state));
  state.findings.push(...validateSpatialState(state));
  state.findings.push(...validateAtomicActions(state));
  state.findings.push(...validateCinematographyState(state));
  state.findings.push(...validateDialogueAudioState(state));
  return state;
}
