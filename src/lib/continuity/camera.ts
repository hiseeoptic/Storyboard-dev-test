// ============================================================
// CAMERA CONTINUITY — one camera move per clip, never widen back.
//
// 02/11/2026: in "na-kiem-tra-gio-dien-thoai" every clip went medium → close →
// medium (or wide) inside one 10 s take. Each time the camera widened again the
// video model re-drew the room it had just cropped away and re-placed the
// furniture: the table shifted (clip 2) and the open box slid out of frame
// (clip 3). Practitioner guides say the same: one camera move per prompt, the
// camera move is when objects drift most, lock the camera when props drift.
//
// The rule: a clip's beats may push in OR pull back, never both. A plan that
// changes direction keeps its first beat (the keyframe composition) and holds
// that framing for the rest of the take; every subject, reaction and focus note
// of the later beats stays — only the framing words go.
// ============================================================

export type ShotSize = "ECU" | "CU" | "MS" | "WS";

export interface CameraBeat {
  beat?: string;
  camera?: string;
}

const RANK: Record<ShotSize, number> = { ECU: 0, CU: 1, MS: 2, WS: 3 };
const SIZE_LABEL: Record<ShotSize, string> = {
  ECU: "extreme close-up",
  CU: "close-up",
  MS: "medium",
  WS: "wide",
};

/** Shot size of one beat camera line (same reading as clip-authority's framingFromCamera, plus full/long shot). */
export function shotSizeOf(camera: string): ShotSize {
  const c = (camera || "").toLowerCase();
  if (/\[(?:extreme_close|ecu|macro|insert)\]|extreme close|macro|probe/.test(c)) return "ECU";
  if (/\[(?:close|cu|mcu|medium_close|ots|pov)\]|close-up|close up|\bclose\b|\bpov\b/.test(c)) return "CU";
  if (/\[(?:wide|ws|aerial|est|ovh)\]|wide|establish|aerial|drone|bird'?s[- ]eye|full[- ]shot|full[- ]body|long shot/.test(c)) return "WS";
  return "MS";
}

export interface CameraPathAnalysis {
  sizes: ShotSize[];
  /** Direction changes (in→out or out→in). 0 = one move or a hold. */
  turns: number;
  /** Moved closer, then wider again inside the same take. */
  rewidens: boolean;
  /** Already rewritten by {@link enforceCameraContinuity}. */
  locked: boolean;
}

export const CAMERA_HOLD_MARK = "HOLD the opening";

export function analyzeCameraPath(beats: CameraBeat[] | undefined): CameraPathAnalysis {
  const list = (beats ?? []).filter((b) => (b?.camera || "").trim());
  const sizes = list.map((b) => shotSizeOf(String(b.camera)));
  let turns = 0;
  let direction = 0;
  let rewidens = false;
  let tightest = Infinity;
  for (let i = 0; i < sizes.length; i++) {
    const rank = RANK[sizes[i]!];
    if (rank > tightest) rewidens = true;
    tightest = Math.min(tightest, rank);
    if (i === 0) continue;
    const step = Math.sign(rank - RANK[sizes[i - 1]!]);
    if (step === 0) continue;
    if (direction !== 0 && step !== direction) turns++;
    direction = step;
  }
  const locked = list.slice(1).some((b) => String(b.camera).includes(CAMERA_HOLD_MARK));
  return { sizes, turns, rewidens, locked };
}

const SIZE_WORDS =
  /\b(?:slightly\s+)?(?:downward|upward|tighter|wider|closer)?\s*(?:extreme\s+close[- ]?ups?|medium[- ]close(?:[- ]?ups?)?|close[- ]?ups?|close|medium[- ]wide|medium|wide|full[- ]shot|two[- ]shot|insert|macro)\b/gi;
const SIZE_TEST = new RegExp(SIZE_WORDS.source, "i");
const MOVE_WORDS =
  /\b(?:(?:gentle|slow|small|motivated|subtle)\s+)*(?:push(?:es|ing)?[- ]in|push(?:es|ing)?\s+(?:toward|towards|closer)|pull(?:s|ing)?[- ](?:back|out)|dolly(?:ing)?(?:\s+(?:in|out|back))?|zoom(?:s|ing)?\s+(?:in|out)|punch(?:es|ing)?[- ]in|re-?frames?|re-?framing|widen(?:s|ing)?(?:\s+out)?|tighten(?:s|ing)?)\b/gi;

/** A beat's subject/focus notes without its own framing words. */
function framingFree(text: string): string {
  return text
    .replace(SIZE_WORDS, " ")
    .replace(MOVE_WORDS, " ")
    .replace(/\b(?:the|a|an)\s+(?=[,;.]|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;.])/g, "$1")
    .replace(/^[\s,;.]+|[\s,;]+$/g, "")
    .trim();
}

const CODE = /^\s*(\[[A-Z_ -]+\]\s*)/;
const GRAMMAR = /^\s*([a-z][a-z_]+:\s*)/;

/**
 * Hold the opening framing for a plan that changes direction. Returns the input
 * unchanged (same array) when the plan is already one move or a hold.
 */
export function enforceCameraContinuity(beats: CameraBeat[] | undefined): { beats: CameraBeat[]; changed: boolean; before: ShotSize[]; after: ShotSize[] } {
  const list = beats ?? [];
  const analysis = analyzeCameraPath(list);
  if (analysis.turns === 0 || analysis.locked || list.length < 2) {
    return { beats: list, changed: false, before: analysis.sizes, after: analysis.sizes };
  }
  const first = String(list[0]?.camera || "");
  const openingSize = shotSizeOf(first);
  const openingCode = CODE.exec(first)?.[1] ?? "";
  const next = list.map((beat, index) => {
    if (index === 0 || !(beat?.camera || "").trim()) return beat;
    const raw = String(beat.camera);
    const code = CODE.exec(raw)?.[1];
    const grammar = (code ? "" : GRAMMAR.exec(raw)?.[1]) ?? "";
    const body = raw.slice((code ?? grammar).length);
    const clauses = body.split(/\s*;\s*/).filter(Boolean);
    // Drop the clause that only states the framing ("slightly downward medium
    // close from the same camera zone"); keep subjects, reactions and focus.
    const kept = clauses
      .map((clause, i) => {
        const named = /\s\p{Lu}/u.test(` ${clause.slice(1)}`);
        if (i === 0 && clauses.length > 1 && !named && SIZE_TEST.test(clause)) return "";
        return framingFree(clause);
      })
      .filter(Boolean)
      .join("; ");
    const prefix = code ? openingCode || code : grammar;
    const hold = `${CAMERA_HOLD_MARK} ${SIZE_LABEL[openingSize]} framing from the same camera position and height (no push-in, no pull-back, no reframing; a gentle handheld breath at most)`;
    return { ...beat, camera: `${prefix}${hold}${kept ? `; ${kept}` : ""}`.replace(/\.\.$/, ".") };
  });
  return { beats: next, changed: true, before: analysis.sizes, after: analyzeCameraPath(next).sizes };
}

interface SegmentLike {
  beats?: CameraBeat[];
}

/**
 * Apply {@link enforceCameraContinuity} to every segment. Returns the same
 * breakdown object when no segment needed it, so callers can compare by
 * identity.
 */
export function withCameraContinuity<T extends { segments?: SegmentLike[] }>(breakdown: T): T {
  const segments = breakdown?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return breakdown;
  let changed = false;
  const next = segments.map((segment) => {
    if (!segment || !Array.isArray(segment.beats)) return segment;
    const result = enforceCameraContinuity(segment.beats);
    if (!result.changed) return segment;
    changed = true;
    return { ...segment, beats: result.beats };
  });
  return changed ? { ...breakdown, segments: next } : breakdown;
}

/** The camera part of the continuity contract written into every video prompt. */
export function cameraContinuityRule(params: { fixedSet: string[]; anchor?: string }): string {
  const anchor = params.anchor?.replace(/^the\s+/i, "") || params.fixedSet[0] || "";
  return [
    "One camera move per take at most: never widen back out after moving closer, never push in again after pulling back.",
    "A framing change only crops the set and the props in place — it never moves, resizes or re-draws them.",
    anchor ? `The ${anchor} never slides toward or out of the frame edge.` : "",
  ].filter(Boolean).join(" ");
}

/** Plain labels for the continuity log ("MS → CU → MS"). */
export function sizePath(sizes: ShotSize[]): string {
  return sizes.join(" → ");
}
