import type { StoryboardGenerationOutput } from "../../types/index.ts";

type AudioAuthorityBreakdown = Pick<
  StoryboardGenerationOutput,
  "context_ir" | "segments"
>;

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function key(value: string | null | undefined): string {
  return clean(value).toLocaleLowerCase();
}

function exactMention(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(
      `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
      "iu"
    ).test(text);
  } catch {
    return text.toLocaleLowerCase().includes(name.toLocaleLowerCase());
  }
}

function words(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
  );
}

/**
 * Restore the project-local location authority before ProductionState/audio is
 * compiled. Models occasionally return display labels such as "Đoạn 1" in
 * location_id; those labels have no sound bed or reverb in Context IR.
 *
 * The repair is deterministic and additive: an existing valid id always wins;
 * continuous shots inherit the previous valid location; otherwise the most
 * textually compatible declared location is selected, with the Context IR
 * primary/first location as a stable fallback. Scene prose is never edited.
 */
export function normalizeSegmentAudioAuthority(
  breakdown: AudioAuthorityBreakdown
): number {
  const locations = breakdown.context_ir?.layers.environment.locations ?? [];
  if (locations.length === 0) return 0;

  const byId = new Map(locations.map((location) => [key(location.id), location]));
  const primaryCategory = key(
    breakdown.context_ir?.layers.environment.primary_category
  );
  const primary =
    locations.find(
      (location) =>
        key(location.id) === primaryCategory ||
        key(location.narrative_function) === primaryCategory
    ) ?? locations[0]!;
  let repaired = 0;
  let previousId: string | undefined;

  for (const segment of breakdown.segments) {
    let location = byId.get(key(segment.location_id));
    const transitionMode = segment.transition_in?.mode ?? segment.continuity_mode;

    if (!location && transitionMode === "continuous" && previousId) {
      location = byId.get(key(previousId));
    }

    if (!location && locations.length > 1) {
      const corpus = words(
        [
          segment.title,
          segment.first_frame_prompt,
          segment.motion_prompt,
          segment.environment_ref,
        ]
          .map(clean)
          .join(" ")
      );
      let bestScore = 0;
      let best: (typeof locations)[number] | undefined;
      let tied = false;
      for (const candidate of locations) {
        const authority = words(
          [
            candidate.id,
            candidate.narrative_function,
            candidate.description,
            ...candidate.spatial_anchors,
            ...candidate.fixed_elements,
          ].join(" ")
        );
        const score = [...authority].filter((token) => corpus.has(token)).length;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
          tied = false;
        } else if (score > 0 && score === bestScore) {
          tied = true;
        }
      }
      if (bestScore > 0 && !tied) location = best;
    }

    location ??= primary;
    if (segment.location_id !== location.id) {
      segment.location_id = location.id;
      repaired += 1;
    }

    if (segment.transition_in) {
      segment.transition_in.to_location_id = location.id;
      if (segment.transition_in.mode !== "opening" && previousId) {
        const from = byId.get(key(segment.transition_in.from_location_id));
        if (!from) segment.transition_in.from_location_id = previousId;
      }
    }
    previousId = location.id;
  }

  return repaired;
}

/**
 * Final non-AI speaker/camera binding pass. It deliberately does not inspect
 * dialogue timing, so one overloaded scene can no longer abort binding for all
 * following scenes. Existing valid bindings and camera intent remain intact.
 */
export function bindOnScreenSpeakersToCameraBeats(
  breakdown: Pick<StoryboardGenerationOutput, "segments">
): number {
  let repaired = 0;
  for (const segment of breakdown.segments) {
    const turns = segment.dialogue_lines ?? [];
    for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
      const turn = turns[turnIndex]!;
      if (!clean(turn.speaker) || turn.delivery !== "on_screen") continue;

      const declaredIndex = (turn.camera_beat ?? 0) - 1;
      const declared = segment.beats?.[declaredIndex];
      if (
        declared &&
        exactMention(
          `${clean(declared.beat)} ${clean(declared.camera)}`,
          turn.speaker
        )
      ) {
        continue;
      }

      const inferredIndex = (segment.beats ?? []).findIndex((beat) =>
        exactMention(
          `${clean(beat.beat)} ${clean(beat.camera)}`,
          turn.speaker
        )
      );
      if (inferredIndex >= 0) {
        turn.camera_beat = inferredIndex + 1;
        repaired += 1;
        continue;
      }

      if (!segment.beats?.length) {
        segment.beats = [
          {
            beat: `${turn.speaker} speaks on screen while the listener reacts naturally`,
            camera: `[MEDIUM] ${turn.speaker} clearly visible and identifiable`,
          },
        ];
        turn.camera_beat = 1;
        repaired += 1;
        continue;
      }

      const fallbackIndex = Math.min(turnIndex, segment.beats.length - 1);
      const fallback = segment.beats[fallbackIndex]!;
      fallback.camera = `${clean(fallback.camera)}; ${turn.speaker} clearly visible on screen while speaking`.replace(
        /^;\s*/,
        ""
      );
      turn.camera_beat = fallbackIndex + 1;
      repaired += 1;
    }
  }
  return repaired;
}
