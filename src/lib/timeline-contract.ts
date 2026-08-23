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
  const naturalSeconds = (turn: DialogueTurn): number => {
    const words = turn.text.trim().split(/\s+/).filter(Boolean).length;
    // The locked narrator is directed at about 128 WPM. Character dialogue can
    // breathe a little faster, but both clocks must close when the utterance
    // actually ends; leaving a short line active until 9.5s invites a video
    // model to loop it to fill the still-open speech window.
    const secondsPerWord = turn.delivery === "voiceover" ? 60 / 128 : 0.4;
    return Math.max(1.2, words * secondsPerWord);
  };
  const hasLoopRiskWindow = turns.some((turn) => {
    if (typeof turn.start_s !== "number" || typeof turn.end_s !== "number") {
      return false;
    }
    const declared = turn.end_s - turn.start_s;
    const natural = naturalSeconds(turn);
    return declared - natural > 1.25;
  });
  if (
    turns.length === 0 ||
    (dialogueClockErrors(turns, durationSeconds).length === 0 && !hasLoopRiskWindow)
  ) {
    return turns;
  }
  const requestedGap = 0.5;
  const tailRoom = Math.min(0.5, Math.max(0, durationSeconds * 0.05));
  const usable = Math.max(0.1, durationSeconds - tailRoom);
  const natural = turns.map(naturalSeconds);
  const naturalTotal = natural.reduce((sum, value) => sum + value, 0);
  const maxGap = turns.length > 1
    ? Math.max(0, (usable - turns.length * 0.4) / (turns.length - 1))
    : 0;
  const gap = Math.min(requestedGap, maxGap);
  const speechBudget = Math.max(0.1, usable - gap * (turns.length - 1));
  const scale = naturalTotal > speechBudget ? speechBudget / naturalTotal : 1;
  // The production clock is a structural boundary contract, so it must always
  // stay inside the clip. If approved dialogue is too dense, preserve every
  // word and its relative speaking share, fit the windows deterministically,
  // and let the WPM advisory report the capacity issue. Emitting end_s=13 for a
  // 10-second shot used to create two blocking errors and an unrepairable JSON.
  let cursor = 0;
  return turns.map((turn, index) => {
    const start = Math.round(cursor * 10) / 10;
    cursor += natural[index]! * scale;
    const end = Math.round(Math.min(cursor, usable) * 10) / 10;
    cursor += gap;
    return { ...turn, start_s: start, end_s: end };
  });
}
