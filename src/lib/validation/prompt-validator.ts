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
// 100% deterministic (JSON + regex, no LLM). The server-side Lớp-C loop consumes
// this report before approval; the browser runs it again as an export-time
// fail-closed backup. It reuses the finding/report types and buildReport() from
// semantic-validator so both gates speak one language. No scene/character/video
// is hardcoded — cast is read from the manifest; only tests use example names.
// ═══════════════════════════════════════════════════════════════════════════

import type { NanoFlowManifest, NanoFlowShot } from "@/types/nano-flow";
import {
  buildReport,
  type SemanticFinding,
  type SemanticValidationReport,
} from "./semantic-validator.ts";
import { validateProductionPromptAuthority } from "./production-authority-validator.ts";

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

function containsExact(authority: unknown, token: unknown): boolean {
  const needle = str(token).toLocaleLowerCase().replace(/\s+/g, " ");
  const haystack = str(authority).toLocaleLowerCase().replace(/\s+/g, " ");
  return !!needle && haystack.includes(needle);
}
function mentionsExact(value: unknown, name: string): boolean {
  const escaped = escapeRegExp(name);
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
    "iu"
  ).test(str(value));
}

function unsafeDisembodiedPanel(panel: unknown): boolean {
  const value = obj(panel);
  const text = `${str(value.action)} ${str(value.camera)}`;
  const bodyPart = /\b(hand|hands|finger|fingers|wrist|arm|palm|bàn tay|ngón tay|cổ tay|cánh tay)\b/iu.test(text);
  const connected = /\b(face|head|shoulder|torso|upper body|waist|chest|mặt|đầu|vai|thân trên|nửa người)\b/iu.test(text);
  return bodyPart && !connected;
}

function canonicalPlacementSignature(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((entry) => {
      const placement = obj(entry);
      return [
        str(placement.entity_id),
        str(placement.zone_id),
        str(placement.anchor_id),
        str(placement.position_label).toLocaleLowerCase(),
        str(placement.facing_entity_id),
        str(placement.world_side),
        str(placement.screen_side),
      ].join("|");
    })
    .filter(Boolean)
    .sort()
    .join("||");
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
    // IMG-001 — the keyframe must name its render medium. Photoreal is required
    // only for live-action projects; stylized/animation projects keep Reality E
    // inside their own declared visual language.
    const render = str(imgJson.render).toLowerCase();
    const negative = str(imgJson.negative).toLowerCase();
    const hasDeclaredMedium =
      /\b(photoreal|live[- ]action|documentary|cinematic film|animation|anime|illustrat|stylized|3d|stop[- ]motion|cartoon)\b/.test(
        render
      );
    const liveAction = /\b(photoreal|live[- ]action|documentary|cinematic film)\b/.test(
      render
    );
    if (!hasDeclaredMedium || (liveAction && !/not cartoon/.test(negative))) {
      push({
        code: "IMG-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: "Image prompt has no coherent render-medium lock, or its live-action lock lacks the NOT-cartoon guard.",
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
    // IMG-004 — each identity must have an explicit per-panel 0-or-1 budget.
    const cardinality = obj(imgJson.character_cardinality_contract);
    const identities = Array.isArray(cardinality.identities)
      ? cardinality.identities.map(obj)
      : [];
    const cardinalityRule = str(cardinality.rule);
    const cardinalityNames = new Set(identities.map((entry) => str(entry.name)).filter(Boolean));
    const invalidCardinality =
      imgCast.some((entry) => !cardinalityNames.has(entry.name)) ||
      identities.some((entry) => Number(entry.maximum_instances_per_panel) !== 1) ||
      !/0-or-1|exactly.*(?:one|1)|never duplicate/iu.test(cardinalityRule);
    if (imgCast.length > 0 && invalidCardinality) {
      push({
        code: "IMG-004",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message:
          "Image board lacks an exact per-character 0-or-1 cardinality contract, so one reference identity can be rendered twice.",
        evidence: `cast=${imgCast.map((entry) => entry.name).join(", ")}`,
      });
    }

    // IMG-005 — an isolated hand/arm is not a safe Veo input frame.
    const panels = Array.isArray(imgJson.panels) ? imgJson.panels : [];
    const unsafePanels = panels
      .map((panel, index) => unsafeDisembodiedPanel(panel) ? index + 1 : 0)
      .filter(Boolean);
    if (!str(imgJson.body_visibility_contract) || unsafePanels.length > 0) {
      push({
        code: "IMG-005",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message:
          "Image board permits a hand-only, arm-only, headless or disembodied character crop instead of a connected visible person.",
        evidence: unsafePanels.length > 0
          ? `unsafe_panels=${unsafePanels.join(",")}`
          : "body_visibility_contract=missing",
      });
    }

    // IMG-006 — board blocking must be explicit even when nobody relocates.
    const placementContract = obj(imgJson.placement_continuity_contract);
    if (
      !str(placementContract.mode) ||
      !Array.isArray(placementContract.canonical_placements)
    ) {
      push({
        code: "IMG-006",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message:
          "Image board has no canonical placement-continuity contract for chair, table side, screen side and adjacent/opposite relationships.",
      });
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
    // Prose fallback must still declare one render medium; only live-action
    // prose needs the NOT-cartoon guard.
    const hasDeclaredMedium =
      /\b(photoreal|live[- ]action|documentary|cinematic film|animation|anime|illustrat|stylized|3d|stop[- ]motion|cartoon)\b/i.test(
        imgRaw
      );
    const liveAction = /\b(photoreal|live[- ]action|documentary|cinematic film)\b/i.test(
      imgRaw
    );
    if (!hasDeclaredMedium || (liveAction && !/not cartoon/i.test(imgRaw))) {
      push({
        code: "IMG-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: "Prose image prompt has no coherent render-medium lock.",
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
  if (
    typeof clip.duration_sec !== "number" ||
    !Number.isFinite(clip.duration_sec) ||
    clip.duration_sec <= 0
  ) {
    push({
      code: "DATA-001",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message: "Video clip duration_sec must be a positive JSON number, never a string.",
      evidence: JSON.stringify(clip.duration_sec),
    });
  }

  // STYLE-004 — a stylized medium must not inherit a live-action negative.
  const visualStyle = str(clip.visual_style);
  const negative = str(clip.negative_prompt);
  const stylized = /\b(?:animation|anime|illustrat|stylized|cartoon|3d|stop[- ]motion)\b/i.test(
    `${visualStyle} ${str(imgJson?.render)}`
  );
  if (
    stylized &&
    /\b(?:not cartoon|photoreal|live[- ]action|documentary realism)\b/i.test(
      negative
    )
  ) {
    push({
      code: "STYLE-004",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message: "Stylized render authority conflicts with a photoreal/live-action negative.",
    });
  }

  // SCENE-BIBLE — tokens are not trusted merely because an AI was asked to
  // repeat them. Each exact token must occur in its final compiled authority.
  const bible = obj(clip.scene_bible_tokens);
  const foley = obj(clip.foley_and_ambience);
  const locks = Object.values(obj(clip.character_lock)).map(obj);
  const requiredTokens: Array<[string, unknown, unknown]> = [
    ["lens", bible.lens, clip.visual_style],
    ["color_grade", bible.color_grade, clip.visual_style],
    ["lighting", bible.lighting, bg.lighting],
    ["backdrop", bible.backdrop, bg.scenery],
    ["audio_bed", bible.audio_bed, foley.environment_sound_bed],
    ["reverb", bible.reverb, foley.environment_reverb],
  ];
  for (const [label, token, target] of requiredTokens) {
    if (!str(token)) {
      push({
        code: "BIBLE-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: `Compiled prompt is missing required scene-bible token "${label}".`,
      });
    } else if (!containsExact(target, token)) {
      push({
        code: "BIBLE-002",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: `Scene-bible token "${label}" is not repeated verbatim in its final authority field.`,
        evidence: str(token),
      });
    }
  }

  // AUDIO AUTHORITY — the transition directive and the rendered ambience block
  // must resolve to one exact per-location sound/reverb authority. This check
  // lives in Storyboard's final prompt gate; extension intake remains separate.
  const audioTransition = obj(clip.audio_transition);
  if (
    !str(audioTransition.policy) ||
    str(audioTransition.to_location_id) !== str(clip.location_id) ||
    !str(foley.environment_sound_bed) ||
    str(audioTransition.sound_bed) !== str(foley.environment_sound_bed) ||
    !str(foley.environment_reverb) ||
    str(audioTransition.reverb_profile) !== str(foley.environment_reverb)
  ) {
    push({
      code: "AUDIO-004",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message:
        "Final prompt audio_transition must resolve exactly to this clip's location sound bed and reverb authority.",
      evidence: `location=${str(clip.location_id) || "missing"}, policy=${str(audioTransition.policy) || "missing"}`,
    });
  }

  // ORDER-001 — identity, style and environment authority must be parsed before
  // action. Presence alone is insufficient when those keys trail scene_action.
  const serialized = JSON.stringify(clip);
  const actionAt = serialized.indexOf('"scene_action"');
  const authorityPositions = [
    serialized.indexOf('"character_lock"'),
    serialized.indexOf('"scene_bible_tokens"'),
    serialized.indexOf('"background_lock"'),
  ];
  if (
    actionAt < 0 ||
    authorityPositions.some((position) => position < 0 || position > actionAt)
  ) {
    push({
      code: "ORDER-001",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message:
        "Identity, scene style and environment authority must be front-loaded before scene_action.",
    });
  }
  const authorityValues = [
    ...locks.flatMap((lock) => [lock.name, lock.voice_personality]),
    bible.lens,
    bible.color_grade,
    bible.lighting,
    bible.backdrop,
    bible.film_grain,
    bible.audio_bed,
    bible.reverb,
    bg.id,
    bg.setting,
    bg.scenery,
    bg.lighting,
  ]
    .map(str)
    .filter(Boolean);
  const lateValues = authorityValues
    .map((value) => ({
      value,
      position: serialized.indexOf(JSON.stringify(value)),
    }))
    .filter(({ position }) => position < 0 || position > actionAt);
  if (lateValues.length > 0) {
    push({
      code: "ORDER-002",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message:
        "One or more identity/style/environment authority values are absent or occur after scene_action.",
      evidence: lateValues
        .slice(0, 3)
        .map(
          ({ value, position }) =>
            `"${value.slice(0, 32)}"@${position} (action@${actionAt})`
        )
        .join(", "),
    });
  }

  const cameraMovement = str(obj(clip.camera).movement);
  if (/\bbegins?\s+on\s+(?:captures?|shows?|frames?|follows?|reveals?)\b/i.test(cameraMovement)) {
    push({
      code: "CAM-002",
      severity: "medium",
      scope: "segment",
      segment_number: seg,
      message: "Camera movement contains malformed compiled grammar.",
      evidence: cameraMovement.slice(0, 100),
    });
  }

  // VOICE BINDING — compiled dialogue must resolve to the exact named lock,
  // exact voice fingerprint and declared camera relationship.
  const lockByName = new Map(
    locks.map((lock) => [str(lock.name).toLocaleLowerCase(), lock])
  );
  const speakingProfiles = new Map<string, string>();
  const dialogue = Array.isArray(clip.dialogue) ? clip.dialogue.map(obj) : [];
  for (const row of dialogue) {
    const speakerName = str(row.speaker_name);
    const delivery = str(row.delivery) || (speakerName === "VOICEOVER" ? "voiceover" : "on_screen");
    if (speakerName === "VOICEOVER") {
      if (delivery !== "voiceover") {
        push({
          code: "VOICE-001",
          severity: "high",
          scope: "segment",
          segment_number: seg,
          message: "Narrator row must be explicitly marked voiceover.",
        });
      }
      continue;
    }
    const lock = lockByName.get(speakerName.toLocaleLowerCase());
    if (!lock) {
      push({
        code: "VOICE-001",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: `Dialogue row names "${speakerName}" but no matching character lock exists.`,
      });
      continue;
    }
    if (str(row.voice_personality) !== str(lock.voice_personality)) {
      push({
        code: "VOICE-002",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: `Voice fingerprint for "${speakerName}" does not match their character lock verbatim.`,
      });
    }
    if (delivery === "on_screen" && !shotCast.some((name) => name.toLocaleLowerCase() === speakerName.toLocaleLowerCase())) {
      push({
        code: "VOICE-003",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: `On-screen speaker "${speakerName}" is absent from the camera beat.`,
      });
    }
    if (delivery === "on_screen") {
      const beatNumber = row.camera_beat;
      const beat =
        typeof beatNumber === "number" && Number.isInteger(beatNumber)
          ? shot.beats?.[beatNumber - 1]
          : undefined;
      if (
        !beat ||
        !mentionsExact(`${beat.beat ?? ""} ${beat.camera ?? ""}`, speakerName)
      ) {
        push({
          code: "VOICE-005",
          severity: "high",
          scope: "segment",
          segment_number: seg,
          message: `On-screen speaker "${speakerName}" is not bound to the declared camera beat.`,
          evidence: `camera_beat=${String(beatNumber ?? "missing")}`,
        });
      }
    }
    const profile = str(row.voice_personality);
    const priorName = speakingProfiles.get(profile);
    if (profile && priorName && priorName !== speakerName) {
      push({
        code: "VOICE-004",
        severity: "high",
        scope: "segment",
        segment_number: seg,
        message: `Two different speakers share the same voice fingerprint ("${priorName}" and "${speakerName}").`,
      });
    }
    if (profile) speakingProfiles.set(profile, speakerName);
  }

  if (serialized.length > 40_000) {
    push({
      code: "BUDGET-001",
      severity: "high",
      scope: "segment",
      segment_number: seg,
      message: "Compiled clip exceeds the safe prompt budget.",
      evidence: `${serialized.length} characters`,
    });
  } else if (serialized.length > 30_000) {
    push({
      code: "BUDGET-001",
      severity: "medium",
      scope: "segment",
      segment_number: seg,
      message: "Compiled clip is approaching the prompt budget.",
      evidence: `${serialized.length} characters`,
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
  findings.push(...validateProductionPromptAuthority(manifest).findings);
  const shots = manifest.shots ?? [];
  const firstBible =
    shots.length > 0 ? obj(obj(shots[0]!.video_prompt).scene_bible_tokens) : {};
  if (shots.length > 0) {
    const first = shots[0]!;
    const firstClip = obj(first.video_prompt);
    const firstTransition = obj(firstClip.audio_transition);
    const firstMode =
      first.continuity_mode ?? (str(firstClip.continuity_mode) || "opening");
    if (
      firstMode !== "opening" ||
      str(firstTransition.policy) !== "open" ||
      str(firstTransition.from_location_id)
    ) {
      push({
        code: "AUDIO-005",
        severity: "high",
        scope: "segment",
        segment_number: first.index,
        message:
          'The first clip must open its own audio authority with policy "open" and no inherited location.',
        evidence: `mode=${firstMode}, policy=${str(firstTransition.policy) || "missing"}`,
      });
    }
  }
  for (let index = 1; index < shots.length; index++) {
    const current = shots[index]!;
    const previous = shots[index - 1]!;
    const currentClip = obj(current.video_prompt);
    const previousClip = obj(previous.video_prompt);
    const currentAudio = obj(currentClip.foley_and_ambience);
    const previousAudio = obj(previousClip.foley_and_ambience);
    const currentBed = str(currentAudio.environment_sound_bed);
    const previousBed = str(previousAudio.environment_sound_bed);
    const currentReverb = str(currentAudio.environment_reverb);
    const previousReverb = str(previousAudio.environment_reverb);
    const mode = current.continuity_mode ?? str(currentClip.continuity_mode);
    const currentLocation = current.location_id ?? str(currentClip.location_id);
    const previousLocation = previous.location_id ?? str(previousClip.location_id);
    const transition = obj(currentClip.audio_transition);
    const locationChanged =
      !!currentLocation &&
      !!previousLocation &&
      currentLocation !== previousLocation;
    const currentBoard = parseImagePrompt(str(current.storyboard_prompt));
    const previousBoard = parseImagePrompt(str(previous.storyboard_prompt));
    const currentPlacement = obj(currentBoard?.placement_continuity_contract);
    const previousPlacement = obj(previousBoard?.placement_continuity_contract);
    const currentPlacementSignature = canonicalPlacementSignature(
      currentPlacement.canonical_placements
    );
    const previousPlacementSignature = canonicalPlacementSignature(
      previousPlacement.canonical_placements
    );
    if (
      !locationChanged &&
      currentPlacementSignature &&
      previousPlacementSignature &&
      currentPlacementSignature !== previousPlacementSignature &&
      str(currentPlacement.mode) !== "scripted_relocation"
    ) {
      push({
        code: "IMG-007",
        severity: "high",
        scope: "segment",
        segment_number: current.index,
        message:
          "Character placement changes between boards in the same location without a declared visible relocation.",
        evidence: `${previousPlacementSignature} -> ${currentPlacementSignature}`,
      });
    }
    const expectedPolicy =
      mode === "continuous"
        ? "preserve"
        : locationChanged
          ? "reset_to_location"
          : mode === "time_jump"
            ? "reset_for_time"
            : "reset_for_cut";
    if (
      str(transition.policy) !== expectedPolicy ||
      str(transition.from_location_id) !== previousLocation ||
      str(transition.to_location_id) !== currentLocation
    ) {
      push({
        code: "AUDIO-005",
        severity: "high",
        scope: "segment",
        segment_number: current.index,
        message: `Audio boundary must use policy "${expectedPolicy}" for ${mode || "an undeclared cut"}.`,
        evidence: `actual=${str(transition.policy) || "missing"}, ${previousLocation || "missing"} -> ${currentLocation || "missing"}`,
      });
    }
    if (mode === "continuous") {
      if (
        !currentLocation ||
        !previousLocation ||
        currentLocation !== previousLocation ||
        !currentBed ||
        currentBed !== previousBed ||
        !currentReverb ||
        currentReverb !== previousReverb
      ) {
        push({
          code: "AUDIO-001",
          severity: "high",
          scope: "segment",
          segment_number: current.index,
          message:
            "Continuous transition must preserve the exact location ambience/reverb bed.",
          evidence: `${previousLocation}:${previousBed}/${previousReverb} -> ${currentLocation}:${currentBed}/${currentReverb}`,
        });
      }
    } else if (locationChanged) {
      if (!currentBed) {
        push({
          code: "AUDIO-002",
          severity: "high",
          scope: "segment",
          segment_number: current.index,
          message: `${mode} enters a new location without resetting to its audio bed.`,
        });
      } else if (currentBed === previousBed) {
        push({
          code: "AUDIO-003",
          severity: "medium",
          scope: "segment",
          segment_number: current.index,
          message:
            "Location changed but its declared audio bed is identical; verify this is intentional.",
        });
      }
    }

    const currentBible = obj(currentClip.scene_bible_tokens);
    // GLOBAL film-look tokens: the camera/grade fingerprint never changes,
    // whatever the location.
    for (const field of ["lens", "color_grade", "film_grain"]) {
      if (str(currentBible[field]) !== str(firstBible[field])) {
        push({
          code: "BIBLE-003",
          severity: "high",
          scope: "segment",
          segment_number: current.index,
          message: `Global scene-bible token "${field}" drifted between clips.`,
          evidence: `clip1=${str(firstBible[field])} -> clip${current.index}=${str(currentBible[field])}`,
        });
      }
    }
    // LOCATION-SCOPED tokens: lighting and backdrop belong to a place. They must
    // match earlier clips at the SAME location_id, but are EXPECTED to differ
    // across a scene_cut / location_cut / parallel_intercut. Comparing them to
    // clip 1 globally would false-flag every legitimate location change (the
    // office↔home cross-cut), so scope them to the last clip at this location.
    if (currentLocation) {
      let sameLocationBible: Record<string, unknown> | null = null;
      for (let j = index - 1; j >= 0; j--) {
        const priorClip = obj(shots[j]!.video_prompt);
        const priorLocation = shots[j]!.location_id ?? str(priorClip.location_id);
        if (priorLocation === currentLocation) {
          sameLocationBible = obj(priorClip.scene_bible_tokens);
          break;
        }
      }
      if (sameLocationBible) {
        for (const field of ["lighting", "backdrop"]) {
          if (str(currentBible[field]) !== str(sameLocationBible[field])) {
            push({
              code: "BIBLE-003",
              severity: "high",
              scope: "segment",
              segment_number: current.index,
              message: `Location-scoped scene-bible token "${field}" drifted within the same location.`,
              evidence: `location=${currentLocation}: ${str(sameLocationBible[field])} -> clip${current.index}=${str(currentBible[field])}`,
            });
          }
        }
      }
    }
  }
  return buildReport(findings, "prompt gate");
}
