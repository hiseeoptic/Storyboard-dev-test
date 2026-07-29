// ═══════════════════════════════════════════════════════════════════════════
// LỚP B — PROMPT-LEVEL VALIDATION GATE (deterministic)
//
// The breakdown gate (semantic-validator.ts) checks the model's SOURCE data.
// This gate checks the two prompts that are actually EXPORTED to the extension
// for each 10s shot, AFTER compilation:
//
//   • image prompt  = shot.storyboard_prompt  (JSON keyframe → Nano Banana)
//                     built by buildKeyframePromptFromClip (nano-flow/manifest.ts)
//   • video prompt  = shot.video_prompt        (structured Veo clip → Veo/Flow)
//                     built by buildVeoJson, patched by withKeyframeAuthority
//
// Some defects only EXIST after compilation and cannot be seen in the breakdown:
//   • ENV-002 — background_lock is derived from first_frame_prompt, so action can
//               leak into the "static set" only at this stage.
//   • SYNC-001 — the image and video prompts must agree on cast; drift between the
//               two compilers is only visible when both artifacts exist.
//
// 100% deterministic (JSON + regex, no LLM). Report-only for now. It reuses the
// finding/report types and buildReport() from semantic-validator so both gates
// speak one language. No scene/character/video is hardcoded — cast is read from
// the manifest; only unit-test fixtures use example names.
// ═══════════════════════════════════════════════════════════════════════════

import type { NanoFlowManifest, NanoFlowShot } from "@/types/nano-flow";
import {
  buildReport,
  type SemanticFinding,
  type SemanticValidationReport,
} from "./semantic-validator.ts";

type Push = (f: SemanticFinding) => void;

// ── Safe accessors ──────────────────────────────────────────────────────────
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Lazy-paste shorthand (ported from veoflow-web/ruleEngine FORBIDDEN_TERMS) ──
// The one genuinely deterministic guard worth reusing: an LLM "lazy-pasting"
// continuity ("same as before") instead of restating it explicitly is a known
// source of silent drift.
const FORBIDDEN_SHORTHAND: readonly string[] = [
  "same environment as", "same scene as", "same character as", "same outfit as",
  "same camera as", "same lighting as", "same as before", "same as above",
  "like before", "as previously", "as in clip", "copy from clip",
  "refer to previous clip", "use previous clip", "identical to clip",
];

// ── Action-leak detection for ENV-002 ───────────────────────────────────────
// A background_lock field must describe the STATIC set only. Action belongs in
// scene_action. Fire only on a high-precision signal (an actor pronoun lead, or
// a named cast member next to an action verb) so static nouns like "walkway" or
// "standing lamp" never false-trigger.
const LEADING_PRONOUN = /^(he|she|they|his|her|their|anh|cô|chị|em|họ)\b/iu;
const ACTOR_ACTION =
  /\b(stands? up|sits? down|stands?|smiles?|smiling|pauses?|leans? (?:in|forward|back)|turns? (?:to|toward|away)|walks?|reaches? (?:for|out)|picks? up|glances?|nods?|gestures?|raises?|looks? (?:at|up|down|away)|steps? (?:forward|back|toward)|waits?|waiting|grabs?|points? (?:at|to))\b/i;

function actionLeak(text: string, castNames: string[]): string | null {
  const t = text.trim();
  if (!t) return null;
  if (LEADING_PRONOUN.test(t)) return "starts with an actor pronoun (action, not a set)";
  if (ACTOR_ACTION.test(t)) {
    const named = castNames.find((n) =>
      new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(n)}([^\\p{L}\\p{N}]|$)`, "iu").test(t)
    );
    if (named) return `describes "${named}" performing an action`;
  }
  return null;
}

// ── Prompt shape helpers ────────────────────────────────────────────────────
interface ImageCastEntry {
  name: string;
  wardrobe: string;
}
function parseImagePrompt(s: string): Record<string, unknown> | null {
  const t = (s ?? "").trim();
  if (!t.startsWith("{")) return null;
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
}
function imageCast(json: Record<string, unknown> | null): ImageCastEntry[] {
  const cast = Array.isArray(json?.cast) ? (json!.cast as unknown[]) : [];
  return cast
    .map((c) => ({ name: str(obj(c).name), wardrobe: str(obj(c).wardrobe) }))
    .filter((c) => c.name);
}
function videoCastNames(clip: Record<string, unknown>): string[] {
  const locks = obj(clip.character_lock);
  return Object.keys(locks)
    .map((k) => str(obj(locks[k]).name))
    .filter(Boolean);
}
function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// ── Per-shot checks ─────────────────────────────────────────────────────────
function checkShot(shot: NanoFlowShot, push: Push): void {
  const seg = shot.index;
  const imgRaw = str(shot.storyboard_prompt);
  const imgJson = parseImagePrompt(imgRaw);
  const video = shot.video_prompt;
  const isStructured = video != null && typeof video === "object";
  const clip = isStructured ? (video as Record<string, unknown>) : {};

  const shotCast = (shot.characters_in_scene ?? []).map(str).filter(Boolean);
  const imgCast = imageCast(imgJson);
  const vidCast = isStructured ? videoCastNames(clip) : [];
  const allCast = [...new Set([...shotCast, ...imgCast.map((c) => c.name), ...vidCast])];

  // ── LAZY-001 — lazy-paste shorthand in either prompt (verbatim required). ──
  const haystack = `${imgRaw}\n${isStructured ? JSON.stringify(video) : str(video)}`.toLowerCase();
  for (const term of FORBIDDEN_SHORTHAND) {
    if (haystack.includes(term)) {
      push({
        code: "LAZY-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: `Lazy-paste shorthand "${term}" — continuity must be restated explicitly, never referenced.`,
      });
      break; // one is enough to flag the shot
    }
  }

  // ─────────────────────────── IMAGE PROMPT ────────────────────────────────
  if (imgJson) {
    // IMG-001 — the keyframe must be photoreal-locked or it drifts to cartoon.
    const render = str(imgJson.render).toLowerCase();
    const negative = str(imgJson.negative).toLowerCase();
    if (!/photoreal/.test(render) || !/not cartoon/.test(negative)) {
      push({
        code: "IMG-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: "Image prompt is not photoreal-locked (missing photoreal render note or NOT-cartoon negative).",
      });
    }
    // IMG-003 — the image needs a setting to place the scene.
    const setting = str(imgJson.setting);
    if (!setting) {
      push({
        code: "IMG-003",
        severity: "medium",
        scope: "segment",
        segment_number: seg,
        message: "Image prompt has no setting — the keyframe has nowhere to place the scene.",
      });
    }
    // IMG-002 — every cast member needs a wardrobe pinned or clothes drift.
    for (const c of imgCast) {
      if (!c.wardrobe) {
        push({
          code: "IMG-002",
          severity: "medium",
          scope: "segment",
          segment_number: seg,
          message: `Image prompt does not pin "${c.name}"'s wardrobe (clothes may change between shots).`,
        });
      }
    }
    // ENV-002 on the image's own setting/scenery.
    for (const field of ["setting", "scenery"] as const) {
      const reason = actionLeak(str(imgJson[field]), allCast);
      if (reason) {
        push({
          code: "ENV-002",
          severity: "high",
          scope: "segment",
          segment_number: seg,
          message: `Image ${field} contains action, not a static set — ${reason}.`,
          evidence: str(imgJson[field]).slice(0, 80),
        });
      }
    }
  } else if (imgRaw) {
    // Prose fallback (lockStyle): must still be photoreal-locked.
    if (!/photoreal/i.test(imgRaw) || !/not cartoon/i.test(imgRaw)) {
      push({
        code: "IMG-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: "Prose image prompt is not photoreal-locked (missing photoreal anchor or NOT-cartoon negative).",
      });
    }
  } else {
    push({
      code: "IMG-003",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message: "Shot has no image (storyboard) prompt at all.",
    });
  }

  // ─────────────────────────── VIDEO PROMPT ────────────────────────────────
  if (!isStructured) {
    // VID-000 — a flat-string video prompt loses the structured Veo contract.
    push({
      code: "VID-000",
      severity: "medium",
      scope: "segment",
      segment_number: seg,
      message: "Video prompt is a flat string, not a structured Veo clip — Flow parses it less reliably.",
    });
    if (!str(video)) {
      push({
        code: "VID-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: "Shot has no video prompt at all.",
      });
    }
    return;
  }

  const bg = obj(clip.background_lock);
  // VID-001 — a clip needs a background set.
  if (!str(bg.setting)) {
    push({
      code: "VID-001",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message: "Video clip has no background_lock.setting — the environment is unlocked.",
    });
  }
  // ENV-002 — action leaked into the derived static set (name/setting/scenery).
  for (const field of ["name", "setting", "scenery"] as const) {
    const reason = actionLeak(str(bg[field]), allCast);
    if (reason) {
      push({
        code: "ENV-002",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: `background_lock.${field} contains action, not a static set — ${reason}.`,
        evidence: str(bg[field]).slice(0, 80),
      });
    }
  }
  // VID-002 — a multi-character clip must lock placement (chair/side swaps).
  if (shotCast.length >= 2 && !str(obj(clip.spatial_topology).character_placement)) {
    push({
      code: "VID-002",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message: `Multi-character clip (${shotCast.length}) has no spatial_topology.character_placement.`,
    });
  }
  // VID-003 — cast present but no character_lock to hold identity.
  if (allCast.length > 0 && Object.keys(obj(clip.character_lock)).length === 0) {
    push({
      code: "VID-003",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message: "Video clip has cast but an empty character_lock — identity is unlocked.",
    });
  }
  // VID-004 — the keyframe-authority rule (withKeyframeAuthority) must be present
  // so Veo follows the start frame's wardrobe/hair/set, not a stray reference.
  if (!str(obj(clip.output_rules).reference_priority)) {
    push({
      code: "VID-004",
      severity: "medium",
      scope: "segment",
      segment_number: seg,
      message: "Video clip is missing output_rules.reference_priority (keyframe-as-authority not pinned).",
    });
  }
  // VID-005 — a clip needs a duration.
  if (!str(clip.duration_sec) && typeof clip.duration_sec !== "number") {
    push({
      code: "VID-005",
      severity: "medium",
      scope: "segment",
      segment_number: seg,
      message: "Video clip has no duration_sec.",
    });
  }

  // ─────────────────────────── SYNC (image ↔ video ↔ shot) ──────────────────
  if (imgJson && imgCast.length > 0 && vidCast.length > 0) {
    const iSet = new Set(imgCast.map((c) => c.name.toLowerCase()));
    const vSet = new Set(vidCast.map((n) => n.toLowerCase()));
    const sSet = new Set(shotCast.map((n) => n.toLowerCase()));
    if (!setEq(iSet, vSet) || (sSet.size > 0 && !setEq(iSet, sSet))) {
      push({
        code: "SYNC-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: "Image, video and shot cast lists disagree — the image and video may be built for different casts.",
        evidence: `image=[${[...iSet].join(", ")}] video=[${[...vSet].join(", ")}] shot=[${[...sSet].join(", ")}]`,
      });
    }
  }
}

/**
 * Validate every exported prompt (image + video) in a finished manifest. Pure —
 * never throws, never mutates. `ok` is false when any critical/high remains.
 */
export function validatePromptExports(manifest: NanoFlowManifest): SemanticValidationReport {
  const findings: SemanticFinding[] = [];
  const push: Push = (f) => findings.push(f);
  for (const shot of manifest.shots ?? []) checkShot(shot, push);
  return buildReport(findings, "prompt gate");
}
