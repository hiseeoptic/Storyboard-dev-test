import type { StoryboardGenerationOutput } from "../../types/index.ts";
import { completeVoiceProfile } from "../laws/audioLaws.ts";
import { normalizeStateLedgerDimensions } from "./state-ledger.ts";
import { buildProductionState } from "../production-state/normalizer.ts";

export interface ProductionNormalizationResult {
  voice_profiles_completed: number;
  continuous_start_entries_inherited: number;
  state_ledger_dimensions_normalized: number;
  multi_character_placements_synthesized: number;
}

function key(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * Give every multi-character scene a minimal screen-left→right placement when the
 * breakdown omitted one. The generation prompt intentionally omits spatial_layout
 * for simple single-zone scenes, but the placement gate (SPAT-001) and the
 * anti-swap goal both need a declared left/right order. We assign it
 * deterministically — NO AI, NO tokens — from a project-wide first-appearance
 * order so the same person keeps the same screen side across every shot (which is
 * exactly what prevents seat/side swaps). Scenes that already declare a placement
 * are left untouched; single-character scenes need nothing.
 */
function ensureMultiCharacterPlacement(
  breakdown: Pick<StoryboardGenerationOutput, "segments">
): number {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const segment of breakdown.segments ?? []) {
    for (const name of segment.characters_in_scene ?? []) {
      const id = key(name);
      if (id && !seen.has(id)) {
        seen.add(id);
        order.push(name.trim());
      }
    }
  }
  const rank = new Map(order.map((name, index) => [key(name), index]));

  let synthesized = 0;
  for (const segment of breakdown.segments ?? []) {
    const cast = (segment.characters_in_scene ?? []).map((name) => (name ?? "").trim()).filter(Boolean);
    if (cast.length < 2) continue;
    if ((segment.spatial_layout?.character_placement ?? "").trim()) continue;

    const sorted = [...cast].sort((a, b) => (rank.get(key(a)) ?? 0) - (rank.get(key(b)) ?? 0));
    const slotFor = (index: number): string => {
      if (sorted.length === 2) return index === 0 ? "screen-left" : "screen-right";
      if (index === 0) return "screen-left";
      if (index === sorted.length - 1) return "screen-right";
      return "center";
    };
    const placement =
      sorted.map((name, index) => `${name} ${slotFor(index)}`).join("; ") +
      "; they face one another. Keep this exact left-to-right screen order in EVERY shot — no side or seat swap.";

    const prior = segment.spatial_layout;
    segment.spatial_layout = {
      zone_order: prior?.zone_order ?? "",
      fixed_architecture: prior?.fixed_architecture ?? "",
      character_placement: placement,
      walkable_path: prior?.walkable_path ?? "",
      camera_zone: prior?.camera_zone ?? "",
      ...(prior?.mechanism_motion ? { mechanism_motion: prior.mechanism_motion } : {}),
    };
    synthesized += 1;
  }
  return synthesized;
}

/**
 * Repair mechanical production contracts locally before Layer A+B/C:
 * - every character voice gets one complete, gender/age-safe render profile;
 * - a continuous clip starts from the exact physical end snapshot of the
 *   preceding clip.
 *
 * This never edits dialogue text, scene action, locations or creative intent.
 */
export function normalizeProductionContracts(
  breakdown: Pick<
    StoryboardGenerationOutput,
    | "character_locks"
    | "segments"
    | "total_duration_seconds"
    | "production_state"
    | "scene_bible"
    | "context_ir"
  >
): ProductionNormalizationResult {
  let voiceProfilesCompleted = 0;
  let continuousStartsInherited = 0;
  const stateLedgerDimensionsNormalized =
    normalizeStateLedgerDimensions(breakdown);

  for (const lock of breakdown.character_locks ?? []) {
    const before = (lock.voice ?? "").trim();
    const completed = completeVoiceProfile(
      before,
      lock.gender,
      lock.is_child
    );
    if (completed !== before) {
      lock.voice = completed;
      voiceProfilesCompleted += 1;
    }
  }

  for (let index = 1; index < breakdown.segments.length; index++) {
    const previous = breakdown.segments[index - 1];
    const current = breakdown.segments[index];
    if (
      !previous?.state_ledger ||
      !current?.state_ledger ||
      current.transition_in?.mode !== "continuous"
    ) {
      continue;
    }

    const previousEnd = new Map(
      previous.state_ledger.end.map((entry) => [key(entry.entity_id), entry])
    );
    current.state_ledger.start = current.state_ledger.start.map((entry) => {
      const inherited = previousEnd.get(key(entry.entity_id));
      if (!inherited) return entry;
      const changed =
        inherited.state.trim() !== entry.state.trim() ||
        inherited.position.trim() !== entry.position.trim() ||
        (inherited.holder ?? "").trim() !== (entry.holder ?? "").trim() ||
        (inherited.orientation ?? "").trim() !==
          (entry.orientation ?? "").trim() ||
        JSON.stringify(inherited.traces ?? []) !==
          JSON.stringify(entry.traces ?? []);
      if (!changed) return entry;
      continuousStartsInherited += 1;
      return {
        ...entry,
        state: inherited.state,
        position: inherited.position,
        holder: inherited.holder,
        orientation: inherited.orientation,
        traces: inherited.traces ? [...inherited.traces] : undefined,
      };
    });

    const startState = new Map(
      current.state_ledger.start.map((entry) => [
        key(entry.entity_id),
        {
          state: entry.state,
          position: entry.position,
          holder: (entry.holder ?? "").trim(),
          orientation: (entry.orientation ?? "").trim(),
        },
      ])
    );
    for (const change of current.state_ledger.changes) {
      const entityKey = key(change.entity_id);
      const expected = startState.get(entityKey);
      if (expected) {
        if (change.from.trim() !== expected.state.trim()) {
          change.from = expected.state;
        }
        change.from_position = expected.position;
        change.from_holder = expected.holder;
        change.from_orientation = expected.orientation;
      }
      startState.set(entityKey, {
        state: change.to,
        position: change.to_position || expected?.position || "",
        holder: (change.to_holder ?? expected?.holder ?? "").trim(),
        orientation: (
          change.to_orientation ??
          expected?.orientation ??
          ""
        ).trim(),
      });
    }
  }

  // Lock a deterministic left/right for any multi-character scene that shipped
  // without one, BEFORE compiling production_state so both the source placement
  // gate and the spatial compiler see it (free, no AI).
  const multiCharacterPlacementsSynthesized = ensureMultiCharacterPlacement(breakdown);

  // Additive compatibility output. Legacy fields above remain intact and are
  // still the source consumed by existing UI/prompt code during Phase 1.
  breakdown.production_state = buildProductionState(breakdown);

  return {
    voice_profiles_completed: voiceProfilesCompleted,
    continuous_start_entries_inherited: continuousStartsInherited,
    state_ledger_dimensions_normalized: stateLedgerDimensionsNormalized,
    multi_character_placements_synthesized: multiCharacterPlacementsSynthesized,
  };
}
