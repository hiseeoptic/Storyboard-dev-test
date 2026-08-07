import type { StoryboardGenerationOutput } from "../../types/index.ts";
import { completeVoiceProfile } from "../laws/audioLaws.ts";
import { normalizeStateLedgerDimensions } from "./state-ledger.ts";
import { buildProductionState } from "../production-state/normalizer.ts";

export interface ProductionNormalizationResult {
  voice_profiles_completed: number;
  continuous_start_entries_inherited: number;
  state_ledger_dimensions_normalized: number;
}

function key(value: string): string {
  return value.trim().toLocaleLowerCase();
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

  // Additive compatibility output. Legacy fields above remain intact and are
  // still the source consumed by existing UI/prompt code during Phase 1.
  breakdown.production_state = buildProductionState(breakdown);

  return {
    voice_profiles_completed: voiceProfilesCompleted,
    continuous_start_entries_inherited: continuousStartsInherited,
    state_ledger_dimensions_normalized: stateLedgerDimensionsNormalized,
  };
}
