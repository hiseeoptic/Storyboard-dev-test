import type { StoryboardGenerationOutput } from "../../types/index.ts";
import { completeVoiceProfile } from "../laws/audioLaws.ts";

export interface ProductionNormalizationResult {
  voice_profiles_completed: number;
  continuous_start_entries_inherited: number;
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
  breakdown: Pick<StoryboardGenerationOutput, "character_locks" | "segments">
): ProductionNormalizationResult {
  let voiceProfilesCompleted = 0;
  let continuousStartsInherited = 0;

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
        JSON.stringify(inherited.traces ?? []) !==
          JSON.stringify(entry.traces ?? []);
      if (!changed) return entry;
      continuousStartsInherited += 1;
      return {
        ...entry,
        state: inherited.state,
        position: inherited.position,
        holder: inherited.holder,
        traces: inherited.traces ? [...inherited.traces] : undefined,
      };
    });

    const startState = new Map(
      current.state_ledger.start.map((entry) => [
        key(entry.entity_id),
        entry.state,
      ])
    );
    for (const change of current.state_ledger.changes) {
      const entityKey = key(change.entity_id);
      const expectedFrom = startState.get(entityKey);
      if (expectedFrom && change.from.trim() !== expectedFrom.trim()) {
        change.from = expectedFrom;
      }
      startState.set(entityKey, change.to);
    }
  }

  return {
    voice_profiles_completed: voiceProfilesCompleted,
    continuous_start_entries_inherited: continuousStartsInherited,
  };
}
