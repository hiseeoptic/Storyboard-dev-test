import type { StoryboardGenerationOutput } from "../../types/index.ts";
import { completeVoiceProfile } from "../laws/audioLaws.ts";
import { normalizeStateLedgerDimensions } from "./state-ledger.ts";
import { buildProductionState } from "../production-state/normalizer.ts";

export interface ProductionNormalizationResult {
  voice_profiles_completed: number;
  continuous_start_entries_inherited: number;
  state_ledger_dimensions_normalized: number;
  multi_character_placements_synthesized: number;
  timeline_totals_synchronized: number;
  missing_state_snapshots_synthesized: number;
  end_snapshots_synchronized_from_changes: number;
  invalid_character_holders_cleared: number;
  composite_object_holders_normalized: number;
}

function key(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function exactCharacterName(value: string, names: string[]): string | undefined {
  return [...names]
    .sort((a, b) => b.length - a.length)
    .find((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(value);
    });
}

/** Holder is the PERSON holding this entity, never a hand-pose label. Legacy
 * model output sometimes wrote `right hand: cloth` into a character's holder
 * field or used `Minh right hand` as a pseudo entity. Repair only that relation;
 * the original action/state prose remains available as evidence. */
function normalizeLegacyHolders(
  breakdown: Pick<StoryboardGenerationOutput, "character_locks" | "segments">
): { characterHoldersCleared: number; objectHoldersNormalized: number } {
  const names = (breakdown.character_locks ?? []).map((lock) => clean(lock.name)).filter(Boolean);
  const characterKeys = new Set(
    (breakdown.character_locks ?? []).flatMap((lock) =>
      [lock.name, lock.display_name, lock.character_id]
        .map((value) => clean(value))
        .filter(Boolean)
        .map(key)
    )
  );
  let characterHoldersCleared = 0;
  let objectHoldersNormalized = 0;

  for (const segment of breakdown.segments ?? []) {
    const ledger = segment.state_ledger;
    if (!ledger) continue;
    for (const entry of [...ledger.start, ...ledger.end]) {
      const holder = clean(entry.holder);
      if (!holder) continue;
      if (characterKeys.has(key(entry.entity_id))) {
        // Characters may touch/support each other, but a hand-state string must
        // never turn the whole person into an object held by a pseudo entity.
        entry.holder = "";
        characterHoldersCleared += 1;
        continue;
      }
      const character = exactCharacterName(holder.replace(/[_-]+/g, " "), names);
      if (character && key(holder) !== key(character)) {
        entry.holder = character;
        if (/\b(?:right hand|tay phải)\b/iu.test(holder) && !/\b(?:right hand|tay phải)\b/iu.test(entry.position)) {
          entry.position = `in ${character}'s right hand`;
        } else if (/\b(?:left hand|tay trái)\b/iu.test(holder) && !/\b(?:left hand|tay trái)\b/iu.test(entry.position)) {
          entry.position = `in ${character}'s left hand`;
        }
        objectHoldersNormalized += 1;
      }
    }
  }
  return { characterHoldersCleared, objectHoldersNormalized };
}

/** Complete the state chain without inventing story action. A change that names
 * an entity absent from start/end receives the minimum snapshots already proven
 * by change.from/change.to. Existing end snapshots remain untouched so a true
 * narrative mismatch can still be reported and optionally repaired by AI. */
function completeMissingStateSnapshots(
  breakdown: Pick<StoryboardGenerationOutput, "segments">
): number {
  let synthesized = 0;
  for (const segment of breakdown.segments ?? []) {
    const ledger = segment.state_ledger;
    if (!ledger) continue;
    const start = new Map(ledger.start.map((entry) => [key(entry.entity_id), entry]));
    const end = new Map(ledger.end.map((entry) => [key(entry.entity_id), entry]));
    const current = new Map(ledger.start.map((entry) => [key(entry.entity_id), {
      state: clean(entry.state),
      position: clean(entry.position),
      holder: clean(entry.holder),
      orientation: clean(entry.orientation),
    }]));

    for (const change of ledger.changes) {
      const entityKey = key(change.entity_id);
      let before = current.get(entityKey);
      if (!before) {
        const entry = {
          entity_id: change.entity_id,
          state: clean(change.from) || "physical condition unchanged",
          position: clean(change.from_position),
          holder: clean(change.from_holder),
          orientation: clean(change.from_orientation),
        };
        ledger.start.push(entry);
        start.set(entityKey, entry);
        before = {
          state: entry.state,
          position: entry.position,
          holder: clean(entry.holder),
          orientation: clean(entry.orientation),
        };
        synthesized += 1;
      }
      change.from = before.state;
      change.from_position = before.position;
      change.from_holder = before.holder;
      change.from_orientation = before.orientation;
      current.set(entityKey, {
        state: clean(change.to) || before.state,
        position: clean(change.to_position) || before.position,
        holder: change.to_holder === undefined ? before.holder : clean(change.to_holder),
        orientation: change.to_orientation === undefined ? before.orientation : clean(change.to_orientation),
      });
    }

    for (const [entityKey, after] of current) {
      if (end.has(entityKey) || !start.has(entityKey)) continue;
      const source = start.get(entityKey)!;
      ledger.end.push({
        entity_id: source.entity_id,
        state: after.state,
        position: after.position,
        holder: after.holder,
        orientation: after.orientation,
      });
      synthesized += 1;
    }
  }
  return synthesized;
}

/** A declared state change is the causal authority for the shot boundary. Keep
 * the legacy end entry but align its four physical dimensions to the final
 * declared change, eliminating repair loops where prose and ledger describe the
 * same event with slightly different wording. No action is invented. */
function synchronizeEndSnapshotsFromChanges(
  breakdown: Pick<StoryboardGenerationOutput, "segments">
): number {
  let synchronized = 0;
  for (const segment of breakdown.segments ?? []) {
    const ledger = segment.state_ledger;
    if (!ledger) continue;
    const current = new Map(ledger.start.map((entry) => [key(entry.entity_id), {
      state: clean(entry.state),
      position: clean(entry.position),
      holder: clean(entry.holder),
      orientation: clean(entry.orientation),
    }]));
    for (const change of ledger.changes) {
      const entityKey = key(change.entity_id);
      const before = current.get(entityKey) ?? {
        state: clean(change.from) || "physical condition unchanged",
        position: clean(change.from_position),
        holder: clean(change.from_holder),
        orientation: clean(change.from_orientation),
      };
      current.set(entityKey, {
        state: clean(change.to) || before.state,
        position: clean(change.to_position) || before.position,
        holder: change.to_holder === undefined ? before.holder : clean(change.to_holder),
        orientation: change.to_orientation === undefined ? before.orientation : clean(change.to_orientation),
      });
    }
    for (const entry of ledger.end) {
      const expected = current.get(key(entry.entity_id));
      if (!expected) continue;
      const differs =
        clean(entry.state) !== expected.state ||
        clean(entry.position) !== expected.position ||
        clean(entry.holder) !== expected.holder ||
        clean(entry.orientation) !== expected.orientation;
      if (!differs) continue;
      entry.state = expected.state;
      entry.position = expected.position;
      entry.holder = expected.holder;
      entry.orientation = expected.orientation;
      synchronized += 1;
    }
  }
  return synchronized;
}

function synchronizeTimelineTotal(
  breakdown: Pick<StoryboardGenerationOutput, "segments" | "total_duration_seconds">
): number {
  const sum = breakdown.segments.reduce(
    (total, segment) => total + (Number.isFinite(segment.duration_seconds) ? segment.duration_seconds : 0),
    0
  );
  if (Math.abs(sum - breakdown.total_duration_seconds) <= 0.001) return 0;
  // The exported production clock must state its real duration. We do not alter
  // any clip, dialogue or user-approved action to hide a metadata mismatch.
  breakdown.total_duration_seconds = sum;
  return 1;
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
  const holderRepairs = normalizeLegacyHolders(breakdown);
  const endSnapshotsSynchronizedFromChanges = synchronizeEndSnapshotsFromChanges(breakdown);
  const stateLedgerDimensionsNormalized =
    normalizeStateLedgerDimensions(breakdown);
  const missingStateSnapshotsSynthesized = completeMissingStateSnapshots(breakdown);
  const timelineTotalsSynchronized = synchronizeTimelineTotal(breakdown);

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
    const currentStartIds = new Set(
      current.state_ledger.start.map((entry) => key(entry.entity_id))
    );
    for (const inherited of previous.state_ledger.end) {
      if (currentStartIds.has(key(inherited.entity_id))) continue;
      current.state_ledger.start.push({
        ...inherited,
        traces: inherited.traces ? [...inherited.traces] : undefined,
      });
      currentStartIds.add(key(inherited.entity_id));
      continuousStartsInherited += 1;
    }

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
    timeline_totals_synchronized: timelineTotalsSynchronized,
    missing_state_snapshots_synthesized: missingStateSnapshotsSynthesized,
    end_snapshots_synchronized_from_changes: endSnapshotsSynchronizedFromChanges,
    invalid_character_holders_cleared: holderRepairs.characterHoldersCleared,
    composite_object_holders_normalized: holderRepairs.objectHoldersNormalized,
  };
}
