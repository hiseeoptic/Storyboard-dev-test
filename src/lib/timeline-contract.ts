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

/** Preserve a valid user/model clock; otherwise create one compact clock once.
 *
 * The old normalizer scaled every turn UNIFORMLY down to fill the clip window,
 * which pushed dense turns far past the 190-wpm limit (e.g. 20 words squeezed
 * into 3s = 400 wpm) — exactly the DLG-006 / DIALOGUE_SPEECH_RATE_EXCEEDED
 * findings. It now allocates time so no turn drops below its own 190-wpm floor
 * whenever the words physically fit inside the clip; only a genuinely
 * over-written clip (more words than any ≤190-wpm delivery could voice in the
 * window) falls back to an equal-rate split, and even then no single turn
 * spikes above the segment's unavoidable average. Dialogue TEXT is never
 * trimmed — content is preserved. */
export function ensureDialogueClock(
  turns: DialogueTurn[],
  durationSeconds = 10
): DialogueTurn[] {
  if (turns.length === 0 || dialogueClockErrors(turns, durationSeconds).length === 0) {
    return turns;
  }
  const gap = 0.4;
  const usable = Math.max(1, durationSeconds - 0.5);
  const wordCounts = turns.map(
    (turn) => turn.text.trim().split(/\s+/).filter(Boolean).length
  );
  // Per-turn minimum seconds to stay AT/UNDER the limit. Target 180 wpm (not the
  // hard 190) so the 0.1s rounding below can never nudge a turn back over 190.
  // A short human floor keeps 1-2 word turns from reading as a blip.
  const floor = wordCounts.map((w) => Math.max(0.8, (w / 180) * 60));
  // Relaxed, natural pace (~142 wpm) used when the clip has room to breathe.
  const natural = wordCounts.map((w) => Math.max(1.2, w * 0.42));

  const gaps = gap * (turns.length - 1);
  const floorTotal = floor.reduce((sum, value) => sum + value, 0) + gaps;
  const naturalTotal = natural.reduce((sum, value) => sum + value, 0) + gaps;

  let seconds: number[];
  if (naturalTotal <= usable) {
    // Room for a natural delivery — well under the limit.
    seconds = natural.slice();
  } else if (floorTotal <= usable) {
    // Tight, but every turn can still stay ≤190 wpm: seat each turn on its floor,
    // then hand the leftover time out toward the natural pace, proportionally.
    const leftover = usable - floorTotal;
    const want = natural.map((n, i) => Math.max(0, n - floor[i]!));
    const wantTotal = want.reduce((sum, value) => sum + value, 0) || 1;
    seconds = floor.map((f, i) => f + leftover * (want[i]! / wantTotal));
  } else {
    // Genuinely over-written for this clip length: no clock can keep it ≤190 wpm.
    // Split the window in proportion to word count so every turn carries the same
    // (minimum possible) rate instead of a few turns spiking to 400-500 wpm.
    const speaking = Math.max(0.5, usable - gaps);
    const totalWords = wordCounts.reduce((sum, value) => sum + value, 0) || 1;
    seconds = wordCounts.map((w) => Math.max(0.4, (w / totalWords) * speaking));
  }

  let cursor = 0;
  return turns.map((turn, index) => {
    const start = Math.round(cursor * 10) / 10;
    cursor += seconds[index]!;
    const end = Math.round(Math.min(cursor, usable) * 10) / 10;
    cursor += gap;
    return { ...turn, start_s: start, end_s: end };
  });
}
