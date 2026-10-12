// ============================================================
// 10-SECOND SHOT RULES — instant, free checks of a writers'-room script against
// what ONE Omni Flash / Veo clip can carry, using the same speech clocks the
// storyboard pipeline enforces (timeline-contract.ts):
//   · narrator voice-over ≈ 128 wpm (0.47 s/word), character dialogue ≈ 0.4 s/word,
//     hard ceiling 190 wpm;
//   · one continuous primary action per clip (a clip cannot cut);
//   · speakers must be in the cast and on screen (or the narrator);
//   · lines keep a non-overlapping clock inside the clip.
// Vietnamese "words" are counted as space-separated syllables.
// ============================================================
import type { EvaluationIssue, RoomScript, ScriptShot, ShotLine } from "./types.ts";

export const SHOT_SECONDS = 10;
const VO_SECONDS_PER_WORD = 60 / 128;
const DIALOGUE_SECONDS_PER_WORD = 0.4;
const HARD_WPM = 190;
/** Speech should leave ~1.5 s of the clip for the action to read. */
const SPEECH_SHARE = 0.85;

export const wordCount = (text: string | undefined | null) =>
  String(text ?? "").trim().split(/\s+/).filter(Boolean).length;

const isNarrator = (speaker: string | undefined) =>
  !speaker || /^(lời dẫn|người dẫn|narrator|voice[- ]?over|vo|thuyết minh)$/iu.test(speaker.trim());

export interface ShotCapacity {
  dialogueWords: number;
  voWords: number;
  /** Seconds of speech at natural pace. */
  speechSeconds: number;
  /** Comfortable spoken-word budget for this shot length. */
  comfortableWords: number;
  /** Absolute maximum (190 wpm over the whole clip). */
  maxWords: number;
  load: "ok" | "tight" | "over";
}

export function shotCapacity(shot: ScriptShot): ShotCapacity {
  const seconds = Math.max(1, Number(shot.duration_s) || SHOT_SECONDS);
  const lines = shot.dialogue ?? [];
  const dialogueWords = lines.filter((l) => !isNarrator(l.speaker)).reduce((n, l) => n + wordCount(l.text), 0);
  const voWords = wordCount(shot.voice_over?.text) + lines.filter((l) => isNarrator(l.speaker)).reduce((n, l) => n + wordCount(l.text), 0);
  const speechSeconds = dialogueWords * DIALOGUE_SECONDS_PER_WORD + voWords * VO_SECONDS_PER_WORD;
  const comfortableWords = Math.floor((seconds * SPEECH_SHARE) / DIALOGUE_SECONDS_PER_WORD);
  const maxWords = Math.floor((seconds * HARD_WPM) / 60);
  const total = dialogueWords + voWords;
  const load: ShotCapacity["load"] = total > maxWords || speechSeconds > seconds
    ? "over"
    : speechSeconds > seconds * SPEECH_SHARE
      ? "tight"
      : "ok";
  return { dialogueWords, voWords, speechSeconds: Math.round(speechSeconds * 10) / 10, comfortableWords, maxWords, load };
}

/** Rough count of separate physical actions in one action line. */
export function actionCount(action: string | undefined): number {
  const text = String(action ?? "").trim();
  if (!text) return 0;
  const parts = text
    .split(/(?:;|\.\s|,?\s+(?:rồi|sau đó|tiếp theo|xong|then|after that|and then)\s+)/iu)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);
  return Math.max(1, parts.length);
}

/** Give every line a clock that fits the clip (keeps valid model clocks). */
export function fillLineClock(shot: ScriptShot): ScriptShot {
  const seconds = Math.max(1, Number(shot.duration_s) || SHOT_SECONDS);
  const lines: Array<{ line: ShotLine; vo: boolean; key: "dialogue" | "voice_over"; i: number }> = [];
  (shot.dialogue ?? []).forEach((line, i) => lines.push({ line, vo: isNarrator(line.speaker), key: "dialogue", i }));
  if (shot.voice_over?.text) lines.push({ line: shot.voice_over, vo: true, key: "voice_over", i: 0 });
  const valid = lines.every(({ line }, idx) =>
    typeof line.start_s === "number" && typeof line.end_s === "number" && line.start_s >= 0 && line.end_s > line.start_s && line.end_s <= seconds &&
    (idx === 0 || (line.start_s ?? 0) >= (lines[idx - 1]!.line.end_s ?? 0)));
  if (valid) return shot;
  let t = 0.5;
  const dialogue = [...(shot.dialogue ?? [])];
  let voiceOver = shot.voice_over ? { ...shot.voice_over } : shot.voice_over;
  for (const item of lines) {
    const need = Math.max(1.2, wordCount(item.line.text) * (item.vo ? VO_SECONDS_PER_WORD : DIALOGUE_SECONDS_PER_WORD));
    const start = Math.min(t, Math.max(0, seconds - need));
    const end = Math.min(seconds, start + need);
    const timed = { ...item.line, start_s: Math.round(start * 10) / 10, end_s: Math.round(end * 10) / 10 };
    if (item.key === "dialogue") dialogue[item.i] = timed;
    else voiceOver = timed;
    t = end + 0.3;
  }
  return { ...shot, dialogue, voice_over: voiceOver };
}

/** Deterministic findings for the whole script. */
export function checkScriptRules(script: RoomScript): EvaluationIssue[] {
  const issues: EvaluationIssue[] = [];
  const cast = new Set((script.characters ?? []).map((c) => c.name.trim().toLowerCase()));
  if (!script.shots?.length) {
    issues.push({ severity: "error", message: "Kịch bản chưa có shot nào.", source: "rules" });
    return issues;
  }
  for (const shot of script.shots) {
    const cap = shotCapacity(shot);
    const total = cap.dialogueWords + cap.voWords;
    if (cap.load === "over") {
      issues.push({
        shot: shot.n, severity: "error", source: "rules",
        message: `Shot ${shot.n}: ${total} chữ lời nói (~${cap.speechSeconds}s) — quá sức chứa clip ${shot.duration_s || SHOT_SECONDS}s (thoải mái ≤ ${cap.comfortableWords} chữ).`,
        fix: `Shot ${shot.n}: cut the spoken words to at most ${cap.comfortableWords} Vietnamese words in total (keep the meaning), or move the rest into the next shot.`,
      });
    } else if (cap.load === "tight") {
      issues.push({
        shot: shot.n, severity: "warning", source: "rules",
        message: `Shot ${shot.n}: lời nói hơi dày (${total} chữ ~${cap.speechSeconds}s), ít chỗ cho hành động.`,
        fix: `Shot ${shot.n}: tighten the spoken words to about ${Math.max(6, cap.comfortableWords - 4)} Vietnamese words so the action can breathe.`,
      });
    }
    const actions = actionCount(shot.action);
    if (actions === 0) {
      issues.push({ shot: shot.n, severity: "error", source: "rules", message: `Shot ${shot.n}: chưa có hành động.`, fix: `Shot ${shot.n}: write ONE concrete continuous physical action for the 10-second clip.` });
    } else if (actions > 2) {
      issues.push({
        shot: shot.n, severity: "warning", source: "rules",
        message: `Shot ${shot.n}: ${actions} hành động nối nhau — một clip 10s không cắt cảnh, nên chỉ nên có 1 hành động chính.`,
        fix: `Shot ${shot.n}: keep ONE continuous primary action; move the other actions into neighbouring shots.`,
      });
    }
    const onScreen = new Set((shot.characters ?? []).map((n) => n.trim().toLowerCase()));
    for (const line of shot.dialogue ?? []) {
      if (isNarrator(line.speaker)) continue;
      const who = line.speaker.trim().toLowerCase();
      if (cast.size && !cast.has(who)) {
        issues.push({ shot: shot.n, severity: "warning", source: "rules", message: `Shot ${shot.n}: "${line.speaker}" nói nhưng không có trong danh sách nhân vật.`, fix: `Shot ${shot.n}: give the line to an existing character or add "${line.speaker}" to the cast.` });
      } else if (onScreen.size && !onScreen.has(who)) {
        issues.push({ shot: shot.n, severity: "info", source: "rules", message: `Shot ${shot.n}: "${line.speaker}" nói nhưng không có mặt trong cảnh (sẽ thành giọng ngoài khung hình).` });
      }
    }
    if (!String(shot.location ?? "").trim()) {
      issues.push({ shot: shot.n, severity: "warning", source: "rules", message: `Shot ${shot.n}: chưa ghi bối cảnh.`, fix: `Shot ${shot.n}: state the exact location.` });
    }
  }
  const first = script.shots[0]!;
  if (wordCount(first.action) < 4) {
    issues.push({ shot: first.n, severity: "warning", source: "rules", message: "Shot 1 chưa có hook hình ảnh rõ trong 3 giây đầu.", fix: "Shot 1: open on a striking visual hook within the first 3 seconds." });
  }
  return issues;
}

/** 0–10 score for how well the script fits 10-second clips. */
export function rulesScore(issues: EvaluationIssue[], shotCount: number): number {
  const penalty = issues.reduce((p, i) => p + (i.severity === "error" ? 1.5 : i.severity === "warning" ? 0.6 : 0.1), 0);
  return Math.max(0, Math.round((10 - (penalty / Math.max(1, shotCount)) * 4) * 10) / 10);
}
