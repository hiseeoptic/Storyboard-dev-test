import type { DialogueTurn, StoryboardGenerationOutput } from "@/types";

/**
 * Veo becomes unstable when motion, dialogue and camera each carry their own
 * second-by-second plan. Dialogue windows are therefore the only production
 * clock. Motion and camera keep their ordered intent, but never timecodes.
 */
export function stripProductionTimecodes(value?: string | null): string {
  return (value ?? "")
    .replace(
      /\b(?:from\s+|during\s+|at\s+)?\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:s|sec(?:ond)?s?)\b\s*[:,-]?\s*/gi,
      ""
    )
    .replace(/\b(?:at|by|during)\s+(?:second\s*)?\d+(?:\.\d+)?\s*(?:s|sec(?:ond)?s?)?\b\s*[:, -]?\s*/gi, "")
    .replace(/\b(?:second|seconds)\s+\d+(?:\.\d+)?\b\s*[:, -]?\s*/gi, "")
    .replace(/(^|[.;])\s*[:,-]\s*/g, "$1 ")
    .replace(/\s*;\s*;/g, "; ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim();
}

export function normalizeUntimedContinuousAction(value?: string | null): string {
  return stripProductionTimecodes(value)
    .replace(/\b(?:then\s+)?hard\s+cuts?\s+to\b/gi, "then smoothly reframes to")
    .replace(/\b(?:then\s+)?cuts?\s+to\b/gi, "then smoothly reframes to")
    .replace(/\bjump\s+cuts?\b/gi, "smooth continuous reframe");
}

/** Remove secondary clocks before preview, assembly and JSON export. */
export function enforceSingleDialogueClock(
  breakdown: Pick<StoryboardGenerationOutput, "segments">
): void {
  for (const segment of breakdown.segments) {
    segment.motion_prompt = normalizeUntimedContinuousAction(segment.motion_prompt);
    if (Array.isArray(segment.beats)) {
      segment.beats = segment.beats.map((beat) => ({
        ...beat,
        beat: normalizeUntimedContinuousAction(beat.beat),
        camera: normalizeUntimedContinuousAction(beat.camera),
      }));
    }
  }
}

/** Deterministic guard for the one remaining clock. */
export function dialogueClockErrors(
  turns: DialogueTurn[] | undefined,
  durationSeconds = 10
): string[] {
  if (!turns?.length) return [];
  const errors: string[] = [];
  let previousEnd = 0;
  turns.forEach((turn, index) => {
    const start = turn.start_s;
    const end = turn.end_s;
    if (typeof start !== "number" || typeof end !== "number") {
      errors.push(`turn ${index + 1} is missing start_s/end_s`);
      return;
    }
    if (start < 0 || end <= start || end > durationSeconds) {
      errors.push(`turn ${index + 1} is outside 0-${durationSeconds}s`);
    }
    if (index > 0 && start < previousEnd) {
      errors.push(`turn ${index + 1} overlaps the previous turn`);
    }
    const seconds = end - start;
    const words = turn.text.trim().split(/\s+/).filter(Boolean).length;
    if (seconds > 0 && (words / seconds) * 60 > 190) {
      errors.push(`turn ${index + 1} exceeds 190 wpm`);
    }
    previousEnd = Math.max(previousEnd, end);
  });
  return errors;
}

/** Preserve a valid user/model clock; otherwise create one compact clock once. */
export function ensureDialogueClock(
  turns: DialogueTurn[],
  durationSeconds = 10
): DialogueTurn[] {
  if (turns.length === 0 || dialogueClockErrors(turns, durationSeconds).length === 0) {
    return turns;
  }
  const gap = 0.5;
  const usable = Math.max(1, durationSeconds - 0.5);
  const natural = turns.map((turn) =>
    Math.max(1.2, turn.text.trim().split(/\s+/).filter(Boolean).length * 0.4)
  );
  const rawTotal = natural.reduce((sum, value) => sum + value, 0) + gap * (turns.length - 1);
  // Never "repair" an overloaded clip by accelerating the voice. The old
  // scale-to-fit branch could squeeze 35-45 words into 10 seconds and create
  // 300-600 WPM dialogue. When the approved text is physically too long we
  // keep a natural clock (which deliberately extends past the clip boundary),
  // allowing the existing validator/editor to report the real capacity defect
  // without corrupting the spoken performance. Fresh generated scripts are
  // prevented from reaching this branch by the hard prompt budget.
  let cursor = 0;
  return turns.map((turn, index) => {
    const start = Math.round(cursor * 10) / 10;
    cursor += natural[index]!;
    const end = Math.round((rawTotal <= usable ? Math.min(cursor, usable) : cursor) * 10) / 10;
    cursor += gap;
    return { ...turn, start_s: start, end_s: end };
  });
}
