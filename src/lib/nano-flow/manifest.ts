// buildNanoFlowManifest — maps a finished StoryboardGenerationOutput into the
// shared Nano Flow manifest (docs/nano-flow-pipeline/manifest.schema.json) that
// the AutoFlow Reel extension consumes. Pure + side-effect free so it is easy
// to unit-test and for Codex to reason about. See DESIGN.md §4.1.

import type { CharacterRepresentation, ImageReference, LocationSet, StoryboardGenerationOutput } from "@/types";
import type { ProductIR } from "@/lib/product-ir";
import type {
  NanoFlowAsset,
  NanoFlowManifest,
  NanoFlowRefSelector,
  NanoFlowShot,
  NanoFlowShotStateAuthority,
} from "@/types/nano-flow";
import { buildProductionState } from "../production-state/normalizer.ts";
import {
  buildNanoFlowShotStateAuthority,
  compactBoardAuthority,
  compactPromptAuthority,
  slimStateAuthorityForManifest,
} from "./state-authority.ts";
import {
  buildBoardPlacementContract,
  normalizeBoardImagePanels,
  type BoardPlacementContract,
} from "./board-image-validator.ts";
import {
  decideFrameMode,
  type FrameMode,
  type FrameModeOverride,
} from "./frame-mode-policy.ts";

export interface BuildNanoFlowManifestOptions {
  /** VIDEO aspect ratio (the frame Veo renders). The BOARD is always 16:9. */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  thumbnailAspectRatio?: "16:9" | "9:16";
  dialogueLanguage?: string;
  productionPromptLanguage?: string;
  /** Independent speech and sound channels selected in the app. Additive only:
   * legacy manifests remain valid and older extensions may ignore this field. */
  speechContract?: {
    mode: "mixed" | "voice_over_only" | "character_dialogue_only" | "wordless";
    voice_over_enabled: boolean;
    character_dialogue_enabled: boolean;
    anonymous_characters: boolean;
    narrator_voice_style?: string;
    character_dialogue_style?: string;
    music_enabled: boolean;
    ambience_enabled: boolean;
    foley_enabled: boolean;
  };
  projectId?: string;
  /** Số cảnh nhỏ mỗi đoạn (beats_per_segment) người dùng chọn. Board vẽ ĐÚNG
   * bấy nhiêu ô — 3 cảnh ⇒ 3 frame, không thừa. Trống ⇒ tối đa 5. */
  beatsPerSegment?: number;
  /** ISO timestamp; defaults to now. Injectable for deterministic tests. */
  generatedAt?: string;
  /** Optional product reference names to declare as shared assets. */
  productNames?: string[];
  /** Uploaded character reference photos (each name → its frontal photo bytes).
   * When present, the character asset embeds the photo (image/images) so the
   * extension auto-loads it and builds the wardrobe sheet without a manual
   * attach — the same as product/environment reference images. */
  characterReferences?: ImageReference[];
  /** Embedded affiliate product refs. This is opt-in; legacy Nano Flow projects
   * continue to declare extension-side empty slots exactly as before. */
  productReferences?: ImageReference[];
  affiliateProductIR?: ProductIR;
  affiliateDisclosure?: string;
  /** Explicit character medium selected in the app (one of the ten locked video
   * styles). Copied into the manifest and hard-locked into every board image +
   * Veo video prompt. Photoreal representations (auto/uploaded/human/none) leave
   * the board photoreal and add no style lock. */
  characterRepresentation?: CharacterRepresentation;
  /** Fully rendered character + environment style-lock law for the selected id
   * (CHARACTER_LAWS[representation].join(" ")). */
  characterStylePrompt?: string;
  /** Role-label cast with narrator-only speech. Keeps demographic/live-action
   * reference prose out of stylized boards. */
  anonymousNarration?: boolean;
  /** The STRUCTURED Veo scene clips from buildVeoJson (one per segment, in
   * order). When present, each shot's video_prompt carries the full structured
   * clip (high-quality Veo input) instead of a flat prose paragraph, and the
   * keyframe prompt is composed from that same structured scene so the image
   * stays in sync with the video. */
  veoClips?: Array<Record<string, unknown>>;
  /** Cách 1 — per-shot uploaded location sets (upload mode). Each set's first
   * image is embedded into every assigned shot's board_location_image so the
   * extension board uses the REAL photo without a second upload. A set with no
   * scene_indices acts as the fallback place for any otherwise-unassigned shot. */
  locationSets?: LocationSet[];
  /**
   * Keyframe rendering mode for what feeds Veo:
   * - "clean" (default): each shot's `storyboard_prompt` is ONE clean cinematic
   *   film still (a real Veo first frame), and a `end_storyboard_prompt` is
   *   emitted for shots the frame-mode policy marks as a transform (Veo then
   *   interpolates start→end). §6.2.
   * - "board": the legacy multi-panel storyboard board (contact sheet). Kept
   *   for backward-compat / A-B testing; never emits an end keyframe.
   */
  keyframeMode?: "clean" | "board";
  /** Project genre — feeds the start/start_end frame-mode policy. */
  genre?: string;
  /** Resolved directing profile id — the strongest frame-mode policy signal. */
  directingProfile?: string;
  /**
   * Per-shot manual frame-mode override from the UI, keyed by segment_number
   * (1-based). "start" forces a single keyframe; "start_end" forces two;
   * "auto"/absent defers to the genre + transform-score policy.
   */
  frameModeOverrides?: Record<number, FrameModeOverride>;
  /**
   * Per-shot manual cross-shot-chain override, keyed by segment_number (1-based).
   * "on" forces this shot to chain from the previous shot's last frame; "off"
   * forces a fresh independent keyframe; "auto"/absent uses the continuity policy
   * (chain only when the shot continues the previous one in the same location).
   */
  chainModeOverrides?: Record<number, "auto" | "on" | "off">;
}

/** Extract a trimmed string field from an unknown clip sub-object. */
function clipStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function clipObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function buildLocationContinuitySheetPrompt(params: {
  name: string;
  setting: string;
  scenery: string;
  lighting: string;
  visualMediumLock: string;
}): string {
  return JSON.stringify({
    type: "location_continuity_sheet",
    aspect_ratio: "16:9",
    output_count: 1,
    location_name: params.name,
    source_authority: params.setting,
    scenery: params.scenery || undefined,
    lighting: params.lighting || undefined,
    layout:
      "ONE single 16:9 image split into EXACTLY TWO equal side-by-side panels with one thin divider; no third panel, no collage, no captions, labels, people or products.",
    panel_1:
      "WIDE establishing view showing the complete script-defined place: terrain and route for an exterior, or architecture and circulation for an interior, plus every fixed landmark, prop-support surface and main spatial anchor required by the story.",
    panel_2:
      "A genuinely different reverse three-quarter view from another connected camera position, rotated roughly 90-135 degrees from panel 1, revealing the reverse relationships between the SAME immutable terrain, architecture, landmarks and anchors. It must not be a crop, zoom, duplicate or tiny variation of panel 1.",
    continuity:
      "Both panels depict the exact same empty script-derived place at the same moment: identical terrain/architecture, boundaries, landmarks, support surfaces, materials, colours, prop design, time of day and light direction. Only camera position and viewing direction differ.",
    render: params.visualMediumLock || KEYFRAME_RENDER_NOTE,
    negative:
      "No people, characters, hands, products, readable text, watermark, duplicated room, mirrored layout, moved furniture, changed weather/time, two separate image files or near-identical camera angles.",
  });
}

// Generic scaffolding phrases buildVeoJson writes into empty lock fields — they
// are instructions to Veo, not real appearance, so they must NOT leak into the
// image prompt.
const GENERIC_LOCK_VALUE =
  /^(use |begin |perform |finish |match the attached|reference_image|context-appropriate everyday|only props|physically grounded|natural hands|cons=|see wardrobe_state|real individual hair strands|real skin with visible pores|none unless|unspecified$)/i;
function meaningful(v: string): string {
  return v && !GENERIC_LOCK_VALUE.test(v) ? v : "";
}

// ── Time-of-day continuity (day↔night) ──────────────────────────────────────
// A script may legitimately move across the day (e.g. daytime early → evening
// late), but boards must NEVER oscillate (day, then night, then day again). We
// read a coarse time-of-day per shot from its text and force the whole sequence
// to be NON-DECREASING (monotonic): once the story reaches evening it can never
// jump back to morning. Shots with no time word inherit the running time; leading
// unknowns adopt the first known time. General for every project — not a per-file
// patch.
const TIME_OF_DAY_STEPS: Array<{ label: string; ord: number; re: RegExp }> = [
  { label: "dawn", ord: 0, re: /(dawn|sunrise|daybreak|first light|bình minh|rạng đông|sáng sớm)/i },
  { label: "morning", ord: 1, re: /(morning|forenoon|buổi sáng|ban sáng)/i },
  { label: "daytime", ord: 2, re: /(midday|noon|daytime|daylight|broad day|afternoon|ban ngày|giữa trưa|trưa|buổi chiều|ban chiều|\bday\b)/i },
  { label: "evening", ord: 3, re: /(golden hour|sunset|dusk|twilight|evening|hoàng hôn|chạng vạng|chiều tà|buổi tối|tối)/i },
  { label: "night", ord: 4, re: /(night|midnight|nighttime|after dark|ban đêm|đêm|khuya)/i },
];
function timeOfDayOrdinal(text: string): number {
  const t = text || "";
  let best = -1;
  for (const step of TIME_OF_DAY_STEPS) if (step.re.test(t)) best = Math.max(best, step.ord);
  return best;
}
function timeOfDayLabel(ord: number): string {
  const s = TIME_OF_DAY_STEPS.find((x) => x.ord === ord);
  return s ? s.label : "";
}
/** Resolve one monotonic (non-decreasing) time-of-day ORDINAL per shot from raw
 *  per-shot text. -1 where nothing could be inferred anywhere; leading unknowns
 *  adopt the first known time. */
function resolveMonotonicOrdinals(perShotText: string[]): number[] {
  const ords = perShotText.map((t) => timeOfDayOrdinal(t));
  const mono: number[] = [];
  let run = -1;
  for (const o of ords) {
    if (o >= 0) run = run < 0 ? o : Math.max(run, o);
    mono.push(run);
  }
  const firstKnown = mono.find((o) => o >= 0);
  return mono.map((o) => (o >= 0 ? o : firstKnown ?? -1));
}

/**
 * Compose a RICH keyframe (image) prompt from the STRUCTURED Veo clip so Nano
 * Banana renders a keyframe faithful to the whole scene — cast appearance,
 * wardrobe, placement, setting, composition and film look — instead of a
 * one-line summary of the setting. Falls back to the raw scene text when no
 * structured clip is available (e.g. unit tests).
 */
// The photoreal render note baked into every structured keyframe prompt (the
// JSON analogue of lockStyle's anchors) so Nano Banana never drifts to cartoon.
const KEYFRAME_RENDER_NOTE =
  "Photorealistic cinematic film still, shot on a professional cinema camera: " +
  "natural realistic lighting, true-to-life skin and material textures, shallow " +
  "depth of field, sharp focus, high dynamic range, professional colour grading, " +
  "ultra-detailed — a real photograph.";
// (KEYFRAME_NEGATIVE removed — the storyboard board writes its own negative that
//  ALLOWS the required per-panel caption text.)
// IDENTITY + WARDROBE authority: the keyframe MUST follow the attached full-body
// character reference (the wardrobe sheet) for BOTH face and outfit — this is the
// clause the user asked for so the image obeys the reference, not a random outfit.
const KEYFRAME_REFERENCE_AUTHORITY =
  "For every character in cast: their face, hair and body build AND their FULL outfit " +
  "must EXACTLY match that character's ATTACHED full-body character reference image " +
  "(the wardrobe sheet) — copy the exact garments, colours and footwear; do NOT invent, " +
  "restyle or swap clothing, and do NOT copy the reference's plain studio background. " +
  "If a LOCATION photo is attached, it is the STRICT setting authority: stage the scene " +
  "INSIDE that exact real place and faithfully reproduce its layout, furniture, landmarks, " +
  "materials, colours and lighting — never invent a different room, relocate the scene or " +
  "restyle the set; only pick the camera angle that best fits the described framing. If a previous " +
  "shot's keyframe is attached, use it ONLY for LOCATION continuity — the same background, " +
  "furniture, props and lighting — while FACE and OUTFIT still come from each character's " +
  "wardrobe sheet, NOT from the previous keyframe (if the keyframe shows a slightly " +
  "different outfit, follow the wardrobe sheet and never drift the clothing). Only the " +
  "action, pose and camera angle change.";

/**
 * Compose the per-shot STORYBOARD BOARD image prompt from the structured Veo
 * clip + the shot's script beats. Each 10s shot → ONE board image with N panels
 * (N = number of beats / "số cảnh nhỏ"), each panel showing the ATTACHED
 * characters performing that beat INSIDE the shot's location (the ATTACHED
 * location photo when the user uploaded one, else the scripted setting). A
 * caption strip under every panel carries "N. [camera] action" so the order +
 * action are legible and the extension/Veo follow the same beats when the board
 * drives the video. Returns a JSON string for both structured and legacy video
 * inputs so the same authority metadata is always present.
 */
function buildLocationBoardPrompt(
  primaryVideoPrompt: Record<string, unknown> | string,
  stateAuthority: NanoFlowShotStateAuthority,
  fallbackSceneText: string,
  envName: string,
  wardrobeClause: string,
  realityMode: string,
  beats: Array<{ beat?: string; camera?: string }>,
  hasLocationPhoto: boolean,
  // The resolved per-shot lighting descriptor (already time-of-day aware). Empty
  // ⇒ rely on the locked time-of-day alone (the shot's own stale lighting was
  // dropped because its time was clamped forward).
  resolvedLighting: string,
  characterStyleLock = "",
  anonymousNarration = false,
  requestedPanels?: number,
  fallbackCast: Array<Record<string, string>> = [],
  continuityId = "project_set_01",
  persistentPropIds: string[] = [],
  // Setting/scenery LOCKED per location (the first clip of this location). Applies
  // to EVERY project/board generally: every board of the same location describes
  // the IDENTICAL room — same furniture, same time-of-day — so no later board can
  // drift to a different set or flip day↔night.
  lockedSetting = "",
  lockedScenery = "",
  // The previous board's LAST-panel / END-state facts, carried in when this shot
  // continues the same scene/set. PANEL 1 of this board opens FROM this so frame N
  // of the previous board hands off to frame 1 of this one; empty for a real
  // location change.
  continueFromPrevious = "",
  // Monotonic time-of-day LABEL locked for this shot (day↔night never oscillates).
  lockedTimeOfDay = "",
  placementContract?: BoardPlacementContract
): string {
  const clip =
    primaryVideoPrompt && typeof primaryVideoPrompt === "object"
      ? primaryVideoPrompt
      : undefined;

  const bg = clipObj(clip?.background_lock);
  const setting = lockedSetting || clipStr(bg.setting) || fallbackSceneText || envName;
  const scenery = lockedScenery || clipStr(bg.scenery);
  // Use the caller's resolved lighting directly (no bg fallback): when it is empty
  // the shot's own lighting was intentionally dropped as stale, so the locked
  // time-of-day drives the look instead of a contradictory raw lighting string.
  const lighting = resolvedLighting;
  const visualStyle = clipStr(clip?.visual_style);

  const locks = clipObj(clip?.character_lock);
  const cast: Array<Record<string, string>> = [];
  for (const key of Object.keys(locks)) {
    const c = clipObj(locks[key]);
    const name = clipStr(c.name);
    if (!name) continue;
    const appearance = anonymousNarration
      ? [clipStr(c.design_markers), clipStr(c.signature_marker)].filter(Boolean).join("; ")
      : [
          meaningful(clipStr(c.gender)),
          meaningful(clipStr(c.age)),
          meaningful(clipStr(c.body_build)),
          meaningful(clipStr(c.hair)) ? `hair ${clipStr(c.hair)}` : "",
          meaningful(clipStr(c.skin_or_fur_color)),
        ].filter(Boolean).join(", ");
    const wardrobe = anonymousNarration
      ? meaningful(clipStr(c.wardrobe_or_role_marker))
      : [clipStr(c.outfit_top), clipStr(c.outfit_bottom)]
          .map(meaningful).filter(Boolean).join(", ");
    const entry: Record<string, string> = { name };
    if (appearance) entry.appearance = appearance;
    if (wardrobe) entry.wardrobe = wardrobe;
    cast.push(entry);
  }
  if (cast.length === 0) cast.push(...fallbackCast);

  // The board is a static projection of the PRIMARY video contract. Prefer exact
  // script beats, then use only start/action/end facts already present in the
  // video/state authority. Never invent a new story event to fill the sheet.
  const beatList = (Array.isArray(beats) ? beats : []).filter((b) => clipStr(b?.beat));
  const candidates: Array<Record<string, unknown>> = beatList.map((beat) => ({
    source: "script_beat",
    action: clipStr(beat.beat),
    ...(clipStr(beat.camera) ? { camera: clipStr(beat.camera) } : {}),
  }));
  const sceneAction = clipObj(clip?.scene_action);
  const addCandidate = (source: string, action: string, role?: string) => {
    const value = clipStr(action);
    if (!value || candidates.some((candidate) => clipStr(candidate.action) === value)) return;
    candidates.push({ source, action: value, ...(role ? { panel_role: role } : {}) });
  };
  addCandidate("video_prompt", clipStr(sceneAction.start_state), "start");
  addCandidate(
    "video_prompt",
    clipStr(sceneAction.ordered_action) || clipStr(sceneAction.action) || clipStr(clip?.motion_prompt),
    "transition"
  );
  for (const action of stateAuthority.actions) {
    addCandidate("production_state_action", action.evidence || action.verb, "transition");
  }
  addCandidate("video_prompt", clipStr(sceneAction.end_state), "end");
  addCandidate("script", stateAuthority.script_contract.first_frame_prompt, "start");
  addCandidate("script", stateAuthority.script_contract.motion_prompt, "transition");
  addCandidate("script", stateAuthority.script_contract.full_prompt, "end");
  if (candidates.length === 0) {
    candidates.push({
      source: "script",
      panel_role: "start",
      action: fallbackSceneText || setting,
    });
  }
  const target = requestedPanels === undefined
    ? Math.max(1, Math.min(5, beatList.length || candidates.length))
    : Math.max(1, Math.min(5, Math.round(requestedPanels) || 1));
  const selected = candidates.slice(0, target);
  while (selected.length < target) {
    const source = candidates[selected.length % candidates.length]!;
    selected.push({
      ...source,
      source: `${String(source.source)}_coverage`,
      coverage_note: "Alternate static coverage of the same declared moment; no new action or event.",
    });
  }
  const rawPanels = selected.map((candidate, i) => {
    const rawCamera = clipStr(candidate.camera);
    const cam = rawCamera
      ? /^\[[A-Z_ -]+\]/.test(rawCamera)
        ? rawCamera
        : `[MEDIUM] ${rawCamera}`
      : "[EYE] eye-level locked composition";
    const act = clipStr(candidate.action);
    const captionAction = act.replace(/^framing\s*\d+\s*:\s*/iu, "").slice(0, 96).trim();
    return {
      ...candidate,
      panel: i + 1,
      order_label: String(i + 1),
      camera: cam,
      caption: `${i + 1}. ${cam.match(/^\[[^\]]+\]/)?.[0] ?? "[EYE]"} ${captionAction}`,
    };
  });
  const normalizedBoard = normalizeBoardImagePanels({
    panels: rawPanels,
    castNames: cast
      .map((entry) => entry.name)
      .filter((name): name is string => Boolean(name)),
    sceneAction: [
      clipStr(sceneAction.start_state),
      clipStr(sceneAction.motion),
      clipStr(sceneAction.end_state),
    ].filter((value): value is string => Boolean(value)).join(" "),
  });
  const panels = normalizedBoard.panels.map((panel, i) => {
    const cam = clipStr(panel.camera);
    const act = clipStr(panel.action);
    const captionAction = act.replace(/^framing\s*\d+\s*:\s*/iu, "").slice(0, 96).trim();
    return {
      ...panel,
      panel: i + 1,
      order_label: String(i + 1),
      caption: `${i + 1}. ${cam.match(/^\[[^\]]+\]/)?.[0] ?? "[EYE]"} ${captionAction}`,
    };
  });
  const n = panels.length;

  // A selected video style forces that locked medium (never photoreal).
  const liveAction = !characterStyleLock && ["documentary", "cinematic", "commercial"].includes(
    realityMode
  );
  const prompt: Record<string, unknown> = {
    authority_fingerprint: stateAuthority.authority_fingerprint,
    authority_order: stateAuthority.authority_order,
    semantic_authority:
      "This storyboard board is a STATIC VISUAL PROJECTION of the script-derived primary video prompt. It may not add, remove, reinterpret or override any video action, camera intent, state transition or ending.",
    production_state_authority: compactBoardAuthority(stateAuthority),
    video_prompt_projection: clip
      ? {
          scene_action: clip.scene_action,
          camera: clip.camera,
          background_lock: clip.background_lock,
          spatial_topology: clip.spatial_topology,
          continuity_mode: clip.continuity_mode,
        }
      : { exact_primary_video_prompt: primaryVideoPrompt },
    type: characterStyleLock
      ? "styled_storyboard_board"
      : liveAction ? "photoreal_storyboard_board" : `${slugify(realityMode)}_storyboard_board`,
    layout:
      `A SINGLE 16:9 STORYBOARD BOARD sheet holding EXACTLY ${n} panel${n > 1 ? "s" : ""} — no more, no fewer, and NO empty, blank or filler cells. ${n === 1 ? "One frame filling the sheet." : n <= 3 ? `Arrange the ${n} panels side by side in ONE horizontal row of equal size, filling the whole sheet.` : `Arrange the ${n} panels in a tidy grid in reading order (left to right, then top to bottom), every cell filled, none left blank.`} Every panel is ${characterStyleLock ? "a frame in the locked visual style" : "a photoreal film frame"} of the SAME scene at a different beat; only the action, pose and camera change. Use ONE identical board template across the entire project: pure white outer canvas, equal gutters, uniform thin solid black dividers around every image cell, and one identical white caption strip directly below every panel. Never mix borderless, white-bordered and black-bordered panels.`,
    frame_order_contract:
      `MANDATORY READING ORDER: left-to-right, then top-to-bottom. Put a large solid BLACK square badge with a crisp WHITE numeral in the TOP-LEFT CORNER INSIDE EVERY panel: ${panels.map((panel) => panel.order_label).join(", ")}. Every panel must have exactly one badge; never omit, duplicate or move a number into the caption only.`,
    camera_contract:
      "Every panel must execute its full camera field: bracketed shot size, camera height/angle, subject, look direction and focus target. Do not shorten an OTS, MEDIUM or CLOSE instruction into an unspecified portrait.",
    character_cardinality_contract: {
      identities: cast.map((entry) => ({
        name: entry.name,
        reference_binding: characterStyleLock
          ? `Use ONLY the attached character/design sheet labelled ${entry.name} for ${entry.name}; keep the exact proportions, line/shape/material language, palette and identity markers.`
          : `Use ONLY the attached wardrobe sheet labelled ${entry.name} for ${entry.name}.`,
        maximum_instances_per_panel: 1,
      })),
      rule:
        "For each panel, render exactly the 0-or-1 count declared in panel.expected_character_instances. Never duplicate an identity, never use one character twice, never merge two characters and never substitute one design for another. Multiple views inside a character/design sheet are reference views of ONE identity, not extra characters to copy into the scene.",
    },
    body_visibility_contract: characterStyleLock
      ? "Every visible hand, limb or character part remains visibly connected to its named owner's head/body according to the locked character-design grammar. Never render an isolated hand, arm, limb or headless fragment as a storyboard panel or Veo input frame unless the script explicitly requires an object-only insert."
      : "A visible hand, wrist, arm or finger must remain anatomically connected to its named owner's visible face, shoulders and upper torso in the same panel. Never render a hand-only, arm-only, headless or disembodied human crop as a storyboard panel or Veo input frame.",
    ...(placementContract
      ? {
          placement_continuity_contract: {
            mode: placementContract.mode,
            canonical_placements: placementContract.canonical_placements,
            rule: placementContract.rule,
            repaired_from_previous: placementContract.repaired_from_previous,
          },
        }
      : {}),
    establishing_view_contract:
      "AT LEAST ONE panel—make it PANEL 1—MUST be a WIDE ESTABLISHING shot of the FULL script-defined location. For an exterior show terrain, route, boundaries and landmarks; for an interior show architecture, circulation and anchors. Reproduce the attached location reference/sheet when present. Never replace the place with a blank canvas or generic studio, and never let every panel become a tight portrait. The same recognizable location, time-of-day and light remain behind the cast in every panel.",
    ...(continueFromPrevious
      ? {
          continue_from_previous:
            `BOARD-TO-BOARD HANDOFF: PANEL 1 (frame 1) of THIS board is the SAME MOMENT as the LAST panel (frame N) of the PREVIOUS board — the two boards touch there. Open panel 1 FROM this exact end-state and match it: same set, same character positions and screen sides, same props in the same hands/places, same time-of-day and light — THEN advance the action forward across the remaining panels. Do NOT restart the scene, relocate, re-establish or change the set/time at panel 1. Previous board's end-state: ${continueFromPrevious}.`,
        }
      : {}),
    setting_authority: hasLocationPhoto
      ? "The SCRIPT defines what happens here and the ATTACHED location photo defines the exact geometry and landmarks. Reproduce that complete place in the project's locked visual medium in EVERY panel; never relocate it or substitute a generic location."
      : `The SCRIPT defines the location content. If a LOCATION REFERENCE image/sheet is attached, reproduce its exact terrain/architecture, boundaries, landmarks, anchors, materials, colours and lighting in the project's locked medium. If none is attached, build the complete setting faithfully from this description: ${setting}. Never replace it with a blank board, empty studio or generic template.`,
    staging:
      characterStyleLock
        ? "Place only the characters named by each panel.visible_characters into the script-derived location and render each exactly once. An absent character stays out of frame; never clone another identity. Each visible character must match only its same-named ATTACHED character/design sheet and the entire environment/prop set must remain in the same locked medium."
        : "Place only the characters named by each panel.visible_characters into the location and render each exactly once. A character not named for that panel remains out of frame but still exists in the scene; do not clone another person to fill the space. Each visible character's face, hair and full outfit must match only that same-named ATTACHED wardrobe sheet.",
    render: characterStyleLock || (liveAction
      ? KEYFRAME_RENDER_NOTE
      : `Reality E storyboard board in the project's locked ${realityMode} medium. Preserve its exact design language, materials, proportions, lighting logic and internal physics; never convert it to live-action photorealism.`),
    visual_style: characterStyleLock || visualStyle || undefined,
    setting,
    scenery: scenery && scenery !== setting ? scenery : undefined,
    time_of_day: lockedTimeOfDay || undefined,
    time_of_day_lock: lockedTimeOfDay
      ? `TIME OF DAY = ${lockedTimeOfDay} (locked for this board). Every panel shows ${lockedTimeOfDay} light, sky and shadows. Across the whole project the time only moves FORWARD with the script — never flip a board back to a different time than the story's flow (no day→night→day).`
      : undefined,
    lighting: ((lockedTimeOfDay ? `${lockedTimeOfDay}: ` : "") + (lighting || "")) || undefined,
    cast,
    panels,
    captions:
      "REQUIRED on EVERY panel: print that panel's short `caption` verbatim in the identical white strip directly under its own image. The top-left number badge plus this short caption are the ONLY text allowed. Do not render the longer action/camera prose as extra text.",
    consistency:
      `PROJECT CONTINUITY LOCK ${continuityId}: every board assigned to this location is the SAME physical set. Keep the SAME time-of-day, light direction, windows, doors, walls, floor, furniture geometry, landmarks and camera-side orientation. Persistent props (${persistentPropIds.join(", ") || "every named story prop"}) keep one exact shape, dimensions, material, colour, hardware and wear across all shots; a gift box, bag, phone or other object never changes design between boards. Only script-caused position, holder, open/closed state, pose and camera may change.`,
    persistent_prop_authority: persistentPropIds.length
      ? persistentPropIds.map((id) => ({
          entity_id: id,
          rule: "The first generated/attached appearance is the immutable visual design authority for every later board.",
        }))
      : undefined,
    reference_authority: characterStyleLock
      ? "Each attached character/design sheet controls only that same-named stylized identity's proportions, line/shape/material language, palette and role markers. The attached location sheet controls the script-derived terrain/architecture, landmarks, layout and light in the SAME locked visual medium. Treat every sheet only as design data for this medium; never translate it into another rendering medium."
      : KEYFRAME_REFERENCE_AUTHORITY,
    image_prompt_validation: {
      status: "clean_after_deterministic_repair",
      repairs: [...(placementContract?.findings ?? []), ...normalizedBoard.findings],
      rule:
        "These repairs were applied locally before export; downstream image generation must follow the repaired panels and contracts, not the rejected evidence text.",
    },
    wardrobe_note: wardrobeClause ? wardrobeClause.trim() : undefined,
    negative: characterStyleLock
      ? "Stay strictly in the locked visual medium/style above — do NOT drift to a different style and do NOT convert to live-action photography. The ONLY text on the image is the specified per-panel caption strips. No identity drift; never duplicate a character within a panel; consistent location and consistent style across every panel."
      : liveAction
        ? "Photorealistic only — NOT cartoon, NOT anime, NOT illustration, NOT 3D render, NOT painting, NOT drawing. No watermark or logo. The ONLY text on the image is the specified per-panel caption strips — no other subtitles, UI or lettering. No identity drift; never duplicate a character within a panel; never render disembodied hands, arm-only crops or headless people; no extra, missing or fused fingers."
        : "No visual-medium drift, no accidental photoreal conversion, no inconsistent character design; the only text is the specified per-panel captions; consistent location across every panel.",
  };
  // JSON.stringify drops the undefined-valued keys, leaving a clean payload.
  return JSON.stringify(prompt);
}

// Verbs / phrases signalling a real physical change across the 10s (locomotion,
// entering/leaving, standing/sitting, big object interaction, reveals) — the cue
// that a start→end keyframe PAIR is worth generating instead of a single frame.
const LOCOMOTION_RE =
  /\b(walks?|walking|runs?|running|stands? up|standing up|sits? down|sitting down|enters?|entering|exits?|leaves?|leaving|approach(?:es)?|crosses?|crossing|steps?|turns? around|rises?|falls?|falling|jumps?|climbs?|moves? to|walk(?:s)? to|reach(?:es)? for|picks? up|puts? down|hands? over|opens?|closes?|pours?|lifts?|drops?|throws?|catches?|transforms?|reveals?)\b/i;
const STRONG_TRANSFORM_RE =
  /\b(walks? to|walk(?:s)? toward|crosses? the|enters?|exits?|leaves?|stands? up and|transforms? into|reveals?|reaches? the|arrives?)\b/i;

function transformTokens(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}
function transformJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

/**
 * Estimate how much a shot physically changes from second 0 → second 10 (0..1),
 * from data already present on the segment: locomotion/big-change verbs, the
 * start↔end state divergence, and the state_ledger change count. Drives the
 * frame-mode policy — static shots stay ONE keyframe, transform shots get a
 * start+end pair. Heuristic and conservative (text divergence alone is capped so
 * it never flips a shot to two-frame without real movement or a state change).
 */
function computeTransformScore(
  seg: {
    motion_prompt?: string;
    beats?: Array<{ beat?: string }>;
    state_ledger?: { changes?: unknown[] } | null;
  },
  clip: Record<string, unknown> | string | undefined
): number {
  const clipObjLocal = clip && typeof clip === "object" ? clip : undefined;
  const sceneAction = clipObj(clipObjLocal?.scene_action);
  const start = clipStr(sceneAction.start_state);
  const end = clipStr(sceneAction.end_state);
  const motion = [
    seg.motion_prompt ?? "",
    ...(seg.beats ?? []).map((b) => b?.beat ?? ""),
  ]
    .filter(Boolean)
    .join(" ");

  let score = 0;
  if (STRONG_TRANSFORM_RE.test(motion) || STRONG_TRANSFORM_RE.test(end)) score = Math.max(score, 0.85);
  else if (LOCOMOTION_RE.test(motion) || LOCOMOTION_RE.test(end)) score = Math.max(score, 0.6);

  if (start && end) {
    const divergence = 1 - transformJaccard(transformTokens(start), transformTokens(end));
    score = Math.max(score, Math.min(0.35, divergence)); // mild signal, capped
  }

  const changes = Array.isArray(seg.state_ledger?.changes) ? seg.state_ledger!.changes!.length : 0;
  if (changes >= 2) score = Math.max(score, 0.6);
  else if (changes === 1) score = Math.max(score, 0.35);

  return score < 0 ? 0 : score > 1 ? 1 : score;
}

/**
 * Compose a CLEAN SINGLE-FRAME keyframe image prompt — the actual image fed to
 * Veo as the first (or, for a transform shot, the last) frame. Unlike
 * buildLocationBoardPrompt this is ONE photographic film still of ONE moment,
 * never a multi-panel contact sheet, so Veo receives a real cinematic frame.
 *
 * `moment: "start"` renders the shot's opening composition; `moment: "end"`
 * renders its final composition for start_end_frame interpolation — and bakes in
 * a "same scene, only the pose advances" contract so the end frame stays
 * consistent with the start (Veo can then interpolate cleanly). All scene locks
 * (setting, cast, wardrobe, lighting, style, negative) mirror the board builder
 * so the image stays faithful to the same primary video contract.
 */
function buildKeyframePrompt(params: {
  moment: "start" | "end";
  primaryVideoPrompt: Record<string, unknown> | string;
  stateAuthority: NanoFlowShotStateAuthority;
  fallbackSceneText: string;
  aspectRatio: string;
  envName: string;
  wardrobeClause: string;
  realityMode: string;
  beats: Array<{ beat?: string; camera?: string }>;
  hasLocationPhoto: boolean;
  resolvedLighting: string;
  characterStyleLock?: string;
  anonymousNarration?: boolean;
  fallbackCast?: Array<Record<string, string>>;
  continuityId?: string;
  persistentPropIds?: string[];
  lockedSetting?: string;
  lockedScenery?: string;
  continueFromPrevious?: string;
  lockedTimeOfDay?: string;
  placementContract?: BoardPlacementContract;
}): string {
  const {
    moment,
    primaryVideoPrompt,
    stateAuthority,
    fallbackSceneText,
    aspectRatio,
    envName,
    wardrobeClause,
    realityMode,
    beats,
    hasLocationPhoto,
    resolvedLighting,
    characterStyleLock = "",
    anonymousNarration = false,
    fallbackCast = [],
    continuityId = "project_set_01",
    persistentPropIds = [],
    lockedSetting = "",
    lockedScenery = "",
    continueFromPrevious = "",
    lockedTimeOfDay = "",
    placementContract,
  } = params;

  const clip =
    primaryVideoPrompt && typeof primaryVideoPrompt === "object"
      ? primaryVideoPrompt
      : undefined;
  const bg = clipObj(clip?.background_lock);
  const setting = lockedSetting || clipStr(bg.setting) || fallbackSceneText || envName;
  const scenery = lockedScenery || clipStr(bg.scenery);
  const lighting = resolvedLighting;
  const visualStyle = clipStr(clip?.visual_style);

  const locks = clipObj(clip?.character_lock);
  const cast: Array<Record<string, string>> = [];
  for (const key of Object.keys(locks)) {
    const c = clipObj(locks[key]);
    const name = clipStr(c.name);
    if (!name) continue;
    const appearance = anonymousNarration
      ? [clipStr(c.design_markers), clipStr(c.signature_marker)].filter(Boolean).join("; ")
      : [
          meaningful(clipStr(c.gender)),
          meaningful(clipStr(c.age)),
          meaningful(clipStr(c.body_build)),
          meaningful(clipStr(c.hair)) ? `hair ${clipStr(c.hair)}` : "",
          meaningful(clipStr(c.skin_or_fur_color)),
        ].filter(Boolean).join(", ");
    const wardrobe = anonymousNarration
      ? meaningful(clipStr(c.wardrobe_or_role_marker))
      : [clipStr(c.outfit_top), clipStr(c.outfit_bottom)].map(meaningful).filter(Boolean).join(", ");
    const entry: Record<string, string> = { name };
    if (appearance) entry.appearance = appearance;
    if (wardrobe) entry.wardrobe = wardrobe;
    cast.push(entry);
  }
  if (cast.length === 0) cast.push(...fallbackCast);

  const sceneAction = clipObj(clip?.scene_action);
  const startText =
    clipStr(sceneAction.start_state) ||
    stateAuthority.script_contract.first_frame_prompt ||
    fallbackSceneText ||
    setting;
  const endText =
    clipStr(sceneAction.end_state) ||
    clipStr(sceneAction.ordered_action) ||
    stateAuthority.script_contract.motion_prompt ||
    startText;
  const beatList = (Array.isArray(beats) ? beats : []).filter((b) => clipStr(b?.beat));
  const firstCam = clipStr(beatList[0]?.camera);
  const lastCam = clipStr(beatList[beatList.length - 1]?.camera);
  const normalizeCam = (raw: string, fallback: string): string =>
    raw ? (/^\[[A-Z_ -]+\]/.test(raw) ? raw : `[MEDIUM] ${raw}`) : fallback;

  const isEnd = moment === "end";
  const momentAction = (isEnd ? endText : startText).trim();
  const momentCamera = isEnd
    ? normalizeCam(lastCam || firstCam, "[EYE] settle on the shot's final composition")
    : normalizeCam(firstCam, "[EYE] eye-level opening composition");

  const liveAction =
    !characterStyleLock &&
    ["documentary", "cinematic", "commercial"].includes(realityMode);

  const prompt: Record<string, unknown> = {
    authority_fingerprint: stateAuthority.authority_fingerprint,
    authority_order: stateAuthority.authority_order,
    semantic_authority:
      "This keyframe is a SINGLE film still — a STATIC VISUAL PROJECTION of the script-derived primary video prompt. It MAY NOT add, remove, reinterpret or override any action, camera intent, state transition or ending it declares.",
    production_state_authority: compactBoardAuthority(stateAuthority),
    video_prompt_projection: clip
      ? {
          scene_action: clip.scene_action,
          camera: clip.camera,
          background_lock: clip.background_lock,
          spatial_topology: clip.spatial_topology,
          continuity_mode: clip.continuity_mode,
        }
      : { exact_primary_video_prompt: primaryVideoPrompt },
    type: characterStyleLock
      ? "styled_keyframe"
      : liveAction ? "photoreal_keyframe" : `${slugify(realityMode)}_keyframe`,
    aspect_ratio: aspectRatio,
    output_count: 1,
    interpolation_role: isEnd ? "end" : "start",
    layout:
      `ONE single ${aspectRatio} cinematic film still — a single continuous photographic frame that FILLS the whole image. This is NOT a storyboard, NOT a grid, NOT a contact sheet: no panels, no dividers, no split frames, no collage, no caption strips, no numbers and NO text of any kind anywhere on the image.`,
    moment: isEnd
      ? `THE LAST FRAME of this ~10s shot: ${momentAction}`
      : `THE FIRST FRAME of this ~10s shot: ${momentAction}`,
    camera: momentCamera,
    ...(isEnd
      ? {
          interpolation_pair_contract:
            `This END frame is paired with THIS shot's START keyframe for Veo start→end interpolation. It MUST depict the EXACT SAME scene: same characters, same faces, same wardrobe, same location, same furniture and props, same time-of-day, same lighting and the same visual style as the start frame. ONLY the pose, action, expression and framing advance to the shot's end state: ${momentAction}. Do not change identity, outfit, set, weather/time or medium, and do not introduce a new character, place or object that was not in the start frame.`,
        }
      : {}),
    character_cardinality_contract: {
      identities: cast.map((entry) => ({
        name: entry.name,
        reference_binding: characterStyleLock
          ? `Use ONLY the attached character/design sheet labelled ${entry.name} for ${entry.name}; keep the exact proportions, line/shape/material language, palette and identity markers.`
          : `Use ONLY the attached wardrobe sheet labelled ${entry.name} for ${entry.name}.`,
        maximum_instances_per_panel: 1,
      })),
      rule:
        "Render each named identity at most once in this frame (0-or-1 instances). Never duplicate an identity, merge two characters or substitute one design for another. Multiple views inside a reference sheet are the SAME identity, not extra people.",
    },
    body_visibility_contract: characterStyleLock
      ? "Every visible hand, limb or character part stays visibly connected to its named owner's head/body per the locked character-design grammar. Never render an isolated hand, arm, limb or headless fragment unless the script explicitly requires an object-only insert."
      : "A visible hand, wrist, arm or finger stays anatomically connected to its named owner's visible face, shoulders and upper torso. Never render a hand-only, arm-only, headless or disembodied human crop as the Veo input frame.",
    ...(placementContract
      ? {
          placement_continuity_contract: {
            mode: placementContract.mode,
            canonical_placements: placementContract.canonical_placements,
            rule: placementContract.rule,
            repaired_from_previous: placementContract.repaired_from_previous,
          },
        }
      : {}),
    setting_authority: hasLocationPhoto
      ? "The SCRIPT defines what happens here and the ATTACHED location photo defines the exact geometry and landmarks. Reproduce that complete place in the project's locked visual medium; never relocate it or substitute a generic location."
      : `The SCRIPT defines the location content. If a LOCATION REFERENCE image/sheet is attached, reproduce its exact terrain/architecture, boundaries, landmarks, anchors, materials, colours and lighting in the project's locked medium. If none is attached, build the complete setting faithfully from this description: ${setting}. Never replace it with a blank frame, empty studio or generic template.`,
    staging: characterStyleLock
      ? "Place only the characters the script names in this moment into the script-derived location, each rendered exactly once. Each visible character matches only its same-named ATTACHED character/design sheet and the whole environment/prop set stays in the locked medium."
      : "Place only the characters the script names in this moment into the location, each rendered exactly once. Each visible character's face, hair and full outfit match only that same-named ATTACHED wardrobe sheet.",
    render:
      characterStyleLock ||
      (liveAction
        ? KEYFRAME_RENDER_NOTE
        : `Reality-E still in the project's locked ${realityMode} medium. Preserve its exact design language, materials, proportions, lighting logic and internal physics; never convert it to live-action photorealism.`),
    visual_style: characterStyleLock || visualStyle || undefined,
    setting,
    scenery: scenery && scenery !== setting ? scenery : undefined,
    time_of_day: lockedTimeOfDay || undefined,
    lighting: ((lockedTimeOfDay ? `${lockedTimeOfDay}: ` : "") + (lighting || "")) || undefined,
    cast,
    ...(continueFromPrevious
      ? {
          location_continuity_from_previous:
            `LOCATION CONTINUITY: this shot continues the SAME set as the previous shot — same room, furniture, props, time-of-day and light. Previous shot's end-state: ${continueFromPrevious}. Face and outfit still come from each character's wardrobe sheet, never from the previous frame.`,
        }
      : {}),
    consistency:
      `PROJECT CONTINUITY LOCK ${continuityId}: every frame assigned to this location is the SAME physical set — same time-of-day, light direction, windows, doors, walls, floor, furniture geometry and camera-side orientation. Persistent props (${persistentPropIds.join(", ") || "every named story prop"}) keep one exact shape, material, colour and wear across shots. Only script-caused position, holder, open/closed state, pose and camera change.`,
    persistent_prop_authority: persistentPropIds.length
      ? persistentPropIds.map((id) => ({
          entity_id: id,
          rule: "The first generated/attached appearance is the immutable visual design authority for every later frame.",
        }))
      : undefined,
    reference_authority: characterStyleLock
      ? "Each attached character/design sheet controls only that same-named stylized identity's proportions, line/shape/material language, palette and role markers. The attached location sheet controls the script-derived terrain/architecture, landmarks, layout and light in the SAME locked medium. Never translate a sheet into another rendering medium."
      : KEYFRAME_REFERENCE_AUTHORITY,
    wardrobe_note: wardrobeClause ? wardrobeClause.trim() : undefined,
    negative: characterStyleLock
      ? "Stay strictly in the locked visual medium/style — do NOT drift to a different style and do NOT convert to live-action photography. This is ONE single frame: no storyboard grid, no panels, no split frames, no collage, no captions, no numbers, NO text of any kind. No identity drift; never duplicate a character; consistent location and style."
      : liveAction
        ? "Photorealistic only — NOT cartoon, NOT anime, NOT illustration, NOT 3D render, NOT painting, NOT drawing. This is ONE single film frame: no storyboard grid, no panels, no split frames, no collage, no captions, no numbers, no watermark, no logo, NO text of any kind. No identity drift; never duplicate a character; never render disembodied hands, arm-only crops or headless people; no extra, missing or fused fingers."
        : "No visual-medium drift, no accidental photoreal conversion, no inconsistent character design. This is ONE single frame: no storyboard grid, no panels, no split frames, no collage, no captions, no numbers, NO text of any kind. Consistent location and style.",
  };
  // JSON.stringify drops undefined-valued keys, leaving a clean single-frame payload.
  return JSON.stringify(prompt);
}

/**
 * Viral 9:16 thumbnail image prompt in the high-CTR "clickbait" style: the cast
 * cut out as glowing-outline stickers with EXAGGERATED reactions, a hero item, a
 * punchy bokeh/confetti background, and the big stylized headline. Character
 * identity is locked by the attached wardrobe sheets. Returns a JSON string.
 */
function buildThumbnailPrompt(params: {
  headline: string;
  castNames: string[];
  hero: string;
  aspect: "16:9" | "9:16";
  realityMode: string;
  characterStyleLock?: string;
  characterStyleId?: string;
}): string {
  const cast = params.castNames.length ? params.castNames.join(" and ") : "the main character(s)";
  const styled = Boolean(params.characterStyleLock);
  const liveAction = !styled && ["documentary", "cinematic", "commercial"].includes(params.realityMode);
  const prompt: Record<string, unknown> = {
    type: styled
      ? `${slugify(params.characterStyleId || "styled")}_thumbnail`
      : liveAction
        ? "photoreal_viral_thumbnail"
        : `${slugify(params.realityMode)}_viral_thumbnail`,
    aspect: params.aspect === "9:16" ? "9:16 vertical" : "16:9 horizontal",
    goal: "A high-energy, high-click-through YouTube/TikTok thumbnail — instantly readable at a glance, hyper-saturated and punchy.",
    subjects: styled
      ? `The cast (${cast}) use the exact same character designs and identity markers as their ATTACHED character sheets, rendered once each in the locked project medium; expressions and pose communicate the script's hook without changing proportions, material or style.`
      : `The cast (${cast}) cut out as stickers with a THICK glowing white + neon outline, leaning in with EXAGGERATED excited/shocked reactions — wide eyes, big open-mouth smiles — reacting to the hero item. Each person's face, hair and build come EXACTLY from that character's ATTACHED wardrobe sheet (identity source of truth); do NOT restyle their face.`,
    hero_item: styled
      ? `Use ${params.hero} only when it is actually established by the script; render it at truthful story scale in the locked medium and never invent a product or unrelated decorative object.`
      : `${params.hero} as the centred hero — glistening, appetising, larger-than-life, with a subtle glow.`,
    headline: styled
      ? `Clear headline "${params.headline}" across the TOP third, using legible lettering that belongs to the locked project medium rather than unrelated photoreal/3D typography. Spell it EXACTLY as given.`
      : `Big bold 3D headline "${params.headline}" across the TOP third — thick multi-colour gradient letters (warm yellow → pink → blue), heavy dark outline + drop shadow + soft glow, plus one playful emoji. The text MUST be spelled EXACTLY as given, crisp and fully legible.`,
    background: styled
      ? "Use the hook scene's actual script-derived location and hero spatial anchors, translated into the same locked visual medium; simplify only for thumbnail readability and never substitute a generic studio, blank board or unrelated festive template."
      : "warm, festive setting with blurred bokeh string lights, floating confetti and sparkles, and a bright radial light-burst behind the subjects; deep saturated colours.",
    composition: styled
      ? "The script's hook action and emotional contrast fill the lower two-thirds; headline in the top third; preserve the real character spacing and story location while simplifying clutter."
      : "subjects fill the lower two-thirds, headline in the top third, hero item centred between/below them; strong depth, punchy vignette.",
    render: styled
      ? params.characterStyleLock
      : liveAction
      ? "Photoreal characters composited with graphic overlays; ultra-saturated, high contrast, tack-sharp — a scroll-stopping thumbnail."
      : `Reality E thumbnail in the project's locked ${params.realityMode} medium; keep the design language, just push saturation and energy.`,
    negative: styled
      ? "No live-action or photoreal conversion, no medium drift, no duplicate identity, no generic blank/studio backdrop, no unrelated setting; NO gibberish or misspelled text; no watermark or logo."
      : "no extra, missing or fused fingers; no distorted or duplicated faces; NO gibberish or misspelled text (the headline must read exactly as given); no watermark, no logo.",
  };
  return JSON.stringify(prompt);
}

/**
 * Build the LOCATION SHEET (`location_views`) for ONE environment — the user's
 * "tạo sheet bối cảnh" approach. It is now a SINGLE character-free image holding
 * THREE framings of the SAME empty set (a large OVERVIEW + a smaller right→left
 * pan + a smaller left→right pan), mirroring the character sheet's one-image form
 * (user asked for one image, not two). The extension generates it once per
 * location and attaches it as the background authority for every board AND every
 * Veo clip set here, so Nano Banana and Veo pin the identical set instead of
 * inventing or drifting the location. When the user uploaded a real location
 * photo the extension uses THAT photo as the source to scan the sheet from; with
 * no photo the app-authored sheet is the location the shot is locked to — the app
 * "tự tạo ảnh bối cảnh ra trước tạo sheet rồi mới ghép vào board". Returned as a
 * one-element array so the shared NanoFlowLocationView contract is unchanged.
 * General for every project, not a per-file patch.
 */
function buildLocationSheetViews(params: {
  setting: string;
  scenery: string;
  lighting: string;
  visualStyle: string;
  realityMode: string;
  characterStyleLock: string;
}): Array<{ angle: string; prompt: string }> {
  const { setting, scenery, lighting, visualStyle, realityMode, characterStyleLock } = params;
  const liveAction =
    !characterStyleLock && ["documentary", "cinematic", "commercial"].includes(realityMode);
  const render =
    characterStyleLock ||
    (liveAction
      ? KEYFRAME_RENDER_NOTE
      : `Reality E establishing plate in the project's locked ${realityMode} medium — keep its exact design language, materials, proportions and lighting logic; never convert to live-action photorealism.`);
  const negative = characterStyleLock
    ? "Stay strictly in the locked visual medium. NO people, NO characters, NO animals, NO product, NO text/caption/watermark. Do NOT convert to live-action photography."
    : liveAction
      ? "Empty location only — absolutely NO people, NO characters, NO animals, NO product in frame. NOT cartoon, NOT anime, NOT illustration, NOT 3D render, NOT painting. No text, UI, watermark or logo."
      : "Empty location in the locked medium — NO people, NO characters, NO product, NO text. No accidental photoreal conversion, no medium drift.";
  // ONE image (user request): a single location sheet holding THREE framings of
  // the SAME empty set — a large OVERVIEW + a smaller right→left pan + a smaller
  // left→right pan — mirroring the character sheet's one-image, three-framing form.
  const prompt = JSON.stringify({
    type: characterStyleLock
      ? "styled_location_sheet"
      : liveAction
        ? "photoreal_location_sheet"
        : `${slugify(realityMode)}_location_sheet`,
    goal:
      "ONE character-free LOCATION REFERENCE SHEET of the EMPTY place — a SINGLE image holding THREE framings of the SAME set — the background authority reused to keep every shot on the SAME location. No people or product anywhere.",
    source_authority:
      "The SCRIPT is the semantic authority for what this place contains. If a LOCATION PHOTO is attached, preserve its actual geometry and landmarks while rendering it in the locked project medium. If NO photo is attached, build the complete location from the setting/scenery description below. Never replace an exterior with a room, an interior with a blank canvas, or a specific scripted place with a generic template.",
    layout:
      "A SINGLE 16:9 image divided into THREE framings of the SAME empty location: (1) a LARGE WIDE OVERVIEW establishing the complete terrain/architecture, boundaries, route, landmarks and anchors; (2) a SMALLER right-to-left view from a connected camera position; (3) a SMALLER left-to-right reverse view. No labels or captions—just three views of the one script-defined place.",
    setting: setting || "the scripted location",
    scenery: scenery && scenery !== setting ? scenery : undefined,
    lighting: lighting || undefined,
    visual_style: characterStyleLock || visualStyle || undefined,
    consistency:
      "All three framings are the EXACT SAME script-derived place—identical terrain/architecture, boundaries, route, landmarks, anchor geometry, materials, colours, time-of-day and light direction; ONLY the camera vantage differs. This is the immutable story world every scene here must reuse.",
    render,
    negative,
  });
  return [{ angle: "sheet", prompt }];
}

/** Turn a display name into a stable ascii slug id (Vietnamese-aware). */
export function slugify(name: string): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

/**
 * Nano Flow may run image-to-video, so the generated keyframe is the first
 * visual frame. It may lock opening appearance/set geometry, but it never owns
 * semantic action, timing, camera intent or the ending; those remain controlled
 * by the script-derived structured video prompt.
 */
export function withKeyframeAuthority(
  clip: Record<string, unknown>,
  characterStyleLock = ""
): Record<string, unknown> {
  const rules =
    clip.output_rules && typeof clip.output_rules === "object"
      ? { ...(clip.output_rules as Record<string, unknown>) }
      : {};
  rules.reference_priority = characterStyleLock
    ? "AUTHORITY ORDER (do NOT reverse it): the SCRIPT-DERIVED STRUCTURED VIDEO PROMPT owns story action, timing, camera, state transition and ending. The selected STYLE LOCK owns the render medium for characters, the complete script-derived environment and props. Character sheets lock each design/identity; the location board locks the scripted terrain/architecture, landmarks, layout and light. Never replace the scripted location with a blank canvas, generic studio or unrelated template."
    : "AUTHORITY ORDER (do NOT reverse it): the SCRIPT-DERIVED STRUCTURED VIDEO PROMPT is the sole semantic authority for story action, timing, camera, state transition and ending. The generated STORYBOARD / LOCATION BOARD is only a visual continuity reference for the already-declared opening appearance and set geometry; it must never add, remove, replace or reinterpret video events. Each attached character WARDROBE SHEET locks ONLY that character's face, hair and full outfit — copy them exactly and IGNORE the sheet's plain studio backdrop. Use the location board to keep the prompt-declared environment visually consistent (background, spatial layout, furniture, props, doors, windows, lighting and materials), but when any image detail conflicts with this structured prompt, FOLLOW THIS VIDEO PROMPT. Identity and clothing come from the sheets; semantics and motion come from the video prompt.";
  rules.storyboard_reference_role =
    "Visual continuity only. Do not infer new actions from the board and do not let the board override ordered actions, dialogue, camera intent, timing or end state in this video prompt.";
  // HARD LOCK (user): the multi-panel board must NEVER be rendered into the video.
  rules.board_is_reference_not_a_frame =
    "The attached STORYBOARD BOARD is a MULTI-PANEL planning sheet that only DESCRIBES this scene (cast, character design, location, staging and beats). It is NOT the video's frame and NOT a layout to copy. NEVER reproduce, show or animate the board itself: no split panels, no grid, no side-by-side sub-frames, no numbered badges, no caption strips, no white gutters or borders, no picture-in-picture. Render ONE single, full-bleed, continuous shot of the actual scripted scene in the locked medium—one camera, one framing at a time, filling the entire frame.";
  if (characterStyleLock) rules.character_style_lock = characterStyleLock;
  return {
    ...clip,
    ...(characterStyleLock
      ? {
          visual_style: characterStyleLock,
          negative_prompt:
            "No live-action or photoreal conversion; no live-action or photoreal human hands, realistic skin hands, palms, fingernails, knuckles, realistic wrists or detached hands entering the frame; no mixed-media anatomy; no conflicting animation medium; no character/environment style mismatch; no generic blank board or studio replacing the scripted setting; no duplicated identities; no text, watermark or board layout inside the video.",
        }
      : {}),
    board_usage:
      "REFERENCE ONLY: the attached storyboard board is a multi-panel sheet that DESCRIBES this scene (who/what/where). Do NOT put the board—its split panels, grid, numbers, captions or borders—into the video. Produce ONE full-frame, single continuous shot of the ACTUAL scripted scene in the project's locked medium, never a montage of panels and never a picture of the board sheet.",
    output_rules: rules,
  };
}

/** Add the canonical script/state contract to the PRIMARY video payload. */
export function withProductionStateAuthority(
  clip: Record<string, unknown>,
  authority: NanoFlowShotStateAuthority
): Record<string, unknown> {
  // state_ledger is a legacy compatibility copy. The canonical state lives once
  // in manifest.production_state and the compact transition contract below is
  // the only physical projection Veo needs. Do not repeat the full ledger in
  // every clip.
  const { state_ledger: _legacyStateLedger, ...clipWithoutLegacyLedger } = clip;
  const rules = clipObj(clip.output_rules);
  const compact = compactPromptAuthority(authority);
  // The canonical manifest keeps contacts, supports and placements in full.
  // Veo's per-clip transition projection only needs the ordered entity boundary
  // facts. Avoid repeating the heavy physical graph in every video prompt.
  const transitionSnapshot = (snapshot: typeof compact.start_snapshot) => ({
    entities: snapshot.entities,
  });
  return {
    ...clipWithoutLegacyLedger,
    // Lightweight pointer only. The transition and audio projections below
    // contain the exact fields Veo needs, while the full canonical copy lives
    // once at manifest.production_state.shots[]. Previously all three copies
    // were embedded together and pushed ordinary clips past 40k characters.
    production_state_authority: {
      production_shot_id: authority.production_shot_id,
      authority_fingerprint: authority.authority_fingerprint,
      authority_order: authority.authority_order,
      canonical_manifest_path: `production_state.shots[${Math.max(0, Number.parseInt(authority.production_shot_id.replace(/\D+/g, ""), 10) - 1 || 0)}]`,
    },
    state_transition_contract: {
      authority_fingerprint: authority.authority_fingerprint,
      start_snapshot: transitionSnapshot(compact.start_snapshot),
      ordered_atomic_actions: compact.ordered_atomic_actions.map((action) => {
        const { evidence: _evidence, ...essential } = action;
        return essential;
      }),
      end_snapshot: transitionSnapshot(compact.end_snapshot),
    },
    dialogue_audio_contract: {
      authority_fingerprint: authority.authority_fingerprint,
      canonical_dialogue_path: `production_state.shots[${Math.max(0, Number.parseInt(authority.production_shot_id.replace(/\D+/g, ""), 10) - 1 || 0)}].dialogue_state`,
      dialogue_turn_ids: compact.dialogue_state.turns.map((turn) => turn.turn_id),
      audio_state: compact.audio_state,
    },
    output_rules: {
      ...rules,
      semantic_priority:
        "Follow script_contract + ordered_atomic_actions + end_snapshot. The storyboard image is downstream visual reference only and cannot change the video narrative, motion, camera or ending.",
    },
  };
}

function buildLegacyVideoPrompt(
  rawPrompt: string,
  authority: NanoFlowShotStateAuthority,
  characterStyleLock: string
): string {
  const primary = [characterStyleLock, rawPrompt.trim()].filter(Boolean).join(" ");
  const compact = compactPromptAuthority(authority);
  const { dialogue_state: dialogueState, ...physicalAndAudioAuthority } = compact;
  return [
    primary,
    `PRODUCTION_STATE_AUTHORITY ${authority.authority_fingerprint}:`,
    JSON.stringify({
      ...physicalAndAudioAuthority,
      dialogue_audio_contract: {
        canonical_dialogue_path: `production_state.shots[${Math.max(0, Number.parseInt(authority.production_shot_id.replace(/\D+/g, ""), 10) - 1 || 0)}].dialogue_state`,
        dialogue_turn_ids: dialogueState.turns.map((turn) => turn.turn_id),
      },
    }),
    "AUTHORITY RULE: this video prompt controls semantics and motion; the generated storyboard is visual continuity only and must never override it.",
  ].filter(Boolean).join("\n");
}

/** Prettify an environment archetype id ("misty_mountain_ridge_dawn") into a
 * human label ("Misty mountain ridge dawn"). */
function humanizeEnvId(id: string): string {
  const words = id.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ── Style lock (DESIGN.md §6) ───────────────────────────────────────────────
// The extension feeds `storyboard_prompt` straight into Flow's nano banana as
// the image prompt. Without an explicit photoreal anchor, nano banana tends to
// drift to cartoon/anime/illustration. We wrap every prompt so each shot yields
// ONE photorealistic, cinematic keyframe that stays faithful to the scene the
// script describes — never re-describing or altering the scene, only pinning
// the render style. Idempotent: it won't double-apply anchors already present.
const STYLE_PREFIX = "Photorealistic cinematic film still. ";
const STYLE_SUFFIX =
  " Rendered as a real photograph: shot on a professional cinema camera, " +
  "natural realistic lighting, true-to-life skin and material textures, " +
  "shallow depth of field, sharp focus, high dynamic range, professional " +
  "color grading, ultra-detailed. Strictly photorealistic — NOT cartoon, " +
  "NOT anime, NOT illustration, NOT 3D render, NOT CGI, NOT painting, " +
  "NOT drawing, NOT sketch.";

/**
 * Wrap a raw first-frame prompt with a hard photoreal/cinematic style lock so
 * generated keyframes never come back as cartoon. The scene text is preserved
 * verbatim in the middle; only style anchors are added, and only when missing.
 */
export function lockStyle(rawPrompt: string, realityMode = "cinematic", characterStyleLock = ""): string {
  const base = (rawPrompt || "").trim();
  // A selected video style wins over the reality-mode default: render in that
  // exact locked medium instead of forcing photoreal.
  if (characterStyleLock) {
    return `${characterStyleLock} ${base}${base && !/[.!?]$/.test(base) ? "." : ""} No visual-medium drift, no accidental live-action conversion, no text or watermark.`.trim();
  }
  const liveAction = ["documentary", "cinematic", "commercial"].includes(
    realityMode
  );
  if (!liveAction) {
    const prefix = `Reality E ${realityMode} keyframe in one locked visual medium. `;
    const suffix =
      ` Preserve the project's exact ${realityMode} design language and internal physics; no medium drift, no accidental live-action photoreal conversion, no text or watermark.`;
    if (!base) return `${prefix}${suffix.trim()}`.trim();
    if (base.toLowerCase().includes(`reality e ${realityMode}`)) return base;
    return `${prefix}${base}${/[.!?]$/.test(base) ? "" : "."}${suffix}`.trim();
  }
  if (!base) return (STYLE_PREFIX + STYLE_SUFFIX.trim()).trim();
  const lower = base.toLowerCase();
  const hasPhotoAnchor = /\bphoto ?realistic|photo-realistic|photoreal\b/.test(lower);
  const hasNegativeLock = lower.includes("not cartoon");
  let out = base;
  if (!hasPhotoAnchor) out = STYLE_PREFIX + out;
  if (!hasNegativeLock) {
    // Ensure a clean sentence boundary before appending technical/negative cues.
    if (!/[.!?]$/.test(out.trim())) out = out.trim() + ".";
    out = out + STYLE_SUFFIX;
  }
  return out.trim();
}

/** Build the shared manifest from a finished breakdown. */
export function buildNanoFlowManifest(
  breakdown: StoryboardGenerationOutput,
  opts: BuildNanoFlowManifestOptions = {}
): NanoFlowManifest {
  const segments = breakdown.segments ?? [];
  // Additive compatibility path: normalized server output already carries this;
  // saved/legacy breakdowns are compiled locally without rewriting old fields.
  const productionState = breakdown.production_state ?? buildProductionState(breakdown);
  const title = breakdown.title || "Untitled";
  const persistentPropEntries = productionState.registry.filter(
    (entry) => entry.kind === "object" || entry.kind === "product"
  );
  const persistentPropIds = persistentPropEntries.map(
    (entry) => `${entry.entity_id} (${entry.display_name})`
  );
  const realityMode = breakdown.context_ir?.reality_profile.mode ?? "cinematic";
  // Selected video style (one of the ten locked media). Photoreal representations
  // (auto/uploaded/human/none) add NO lock and keep the board photoreal; any
  // stylized medium hard-locks every board + video prompt to that style.
  const characterRepresentation = opts.characterRepresentation;
  const characterStyleLock = (opts.characterStylePrompt ?? "").trim();
  const visualMediumLock =
    characterRepresentation &&
    !["auto", "uploaded_photoreal", "generated_human", "none"].includes(characterRepresentation)
      ? characterStyleLock
      : "";

  // ── Character assets: union of character_locks + every characters_in_scene
  //    name, so no shot can reference a character that isn't declared. ──
  const charIdByName = new Map<string, string>(); // lowercased name -> asset id
  const usedCharacterAssetIds = new Set<string>();
  const characters: NanoFlowAsset[] = [];
  const referenceNames = new Set(
    (breakdown.character_locks ?? []).map((l) => l.name?.trim()).filter(Boolean) as string[]
  );
  // Embedded character reference photos (the user's uploaded frontal photo),
  // keyed by character name. When present the extension auto-loads them and
  // builds the wardrobe sheet without a manual attach — the same way product and
  // environment reference images are already embedded. Empty ⇒ the asset keeps a
  // null slot (declared, attached later in the extension) exactly as before.
  const characterImageByName = new Map<string, string[]>();
  for (const ref of opts.characterReferences ?? []) {
    const nm = (ref?.name ?? "").trim().toLowerCase();
    const imgs = (ref?.images ?? [])
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .slice(0, 1);
    if (nm && imgs.length) characterImageByName.set(nm, imgs);
  }
  const addCharacter = (rawName: string, required: boolean) => {
    const name = (rawName || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (charIdByName.has(key)) return;
    const registryEntry = productionState.registry.find(
      (entry) =>
        entry.kind === "character" &&
        [entry.display_name, entry.source_ref, ...entry.aliases]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.trim().toLowerCase() === key)
    );
    const baseId = registryEntry?.entity_id ?? `char_${slugify(name) || characters.length + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedCharacterAssetIds.has(id)) id = `${baseId}_${suffix++}`;
    usedCharacterAssetIds.add(id);
    charIdByName.set(key, id);
    const embedded = characterImageByName.get(key) ?? [];
    characters.push({
      id,
      name,
      image: embedded[0] ?? null,
      ...(embedded.length ? { images: embedded } : {}),
      required,
    });
  };
  for (const lock of breakdown.character_locks ?? []) addCharacter(lock.name, true);
  for (const seg of segments) {
    for (const name of seg.characters_in_scene ?? []) {
      addCharacter(name, referenceNames.has(name.trim()));
    }
  }

  // ── Environment assets: unique non-custom environment_ref ids. Each declared
  //    environment also gets a 2-angle LOCATION SHEET (location_views, attached
  //    below once the per-location setting is locked) — a character-free wide +
  //    alt plate the extension generates ONCE and reuses as the background
  //    authority for every board and Veo clip here, so the set never drifts. A
  //    user-uploaded location photo (Cách 1) still takes priority when present.
  const envIdSeen = new Set<string>();
  const environments: NanoFlowAsset[] = [];
  segments.forEach((seg, segmentIndex) => {
    const ref = (seg.location_id ?? seg.environment_ref ?? "").trim();
    if (!ref || ref === "custom" || envIdSeen.has(ref)) return;
    envIdSeen.add(ref);
    const clip = opts.veoClips?.[segmentIndex];
    const background = clipObj(clip?.background_lock);
    const name = clipStr(background.name) || humanizeEnvId(ref);
    environments.push({
      id: ref,
      name,
      image: null,
      location_sheet_prompt: buildLocationContinuitySheetPrompt({
        name,
        setting: clipStr(background.setting) || seg.first_frame_prompt || name,
        scenery: clipStr(background.scenery),
        lighting: clipStr(background.lighting),
        visualMediumLock,
      }),
    });
  });

  // ── Product assets: from explicit names, else one slot if a product DNA
  //    was locked. Images are attached on the extension side. ──
  const products: NanoFlowAsset[] = [];
  if (opts.productReferences?.length) {
    for (const reference of opts.productReferences) {
      const images = (reference.images ?? []).filter(Boolean).slice(0, 4);
      products.push({
        id: `prod_${slugify(reference.name) || products.length + 1}`,
        name: reference.name,
        image: images[0] ?? null,
        ...(images.length ? { images } : {}),
        required: true,
      });
    }
  } else if (opts.productNames?.length) {
    for (const name of opts.productNames) {
      products.push({ id: `prod_${slugify(name) || products.length + 1}`, name, image: null });
    }
  } else if (breakdown.product_dna) {
    products.push({ id: "prod_main", name: "Product", image: null });
  }

  const charIds = (names?: string[]): string[] =>
    (names ?? [])
      .map((n) => charIdByName.get(n.trim().toLowerCase()))
      .filter((v): v is string => Boolean(v));

  // ── Wardrobe map: the story-locked outfit per character. Direction B — an
  //    uploaded character's clothing is this generated CONTEXT outfit, never the
  //    reference photo's clothing — and text-only characters need it too because
  //    first_frame_prompt no longer restates appearance. The keyframe prompt
  //    must therefore state the outfit explicitly (the image only fixes the
  //    face/identity), or every shot would invent new clothes (wardrobe drift).
  const baseCostumeByName = new Map<string, string>();
  for (const lock of breakdown.character_locks ?? []) {
    const name = (lock.name ?? "").trim();
    if (name && (lock.costume ?? "").trim()) {
      baseCostumeByName.set(name.toLowerCase(), (lock.costume ?? "").trim());
    }
  }
  // Stamp each character asset with its story-locked base outfit so the extension
  // can build one full-body wardrobe sheet per character and reuse it for every
  // keyframe (face + clothes identical across shots).
  for (const c of characters) {
    const outfit = baseCostumeByName.get(c.name.trim().toLowerCase());
    if (outfit) c.wardrobe = outfit;
  }

  // ── Shots ──
  // Cách 1 — resolve which uploaded location photo (if any) each 1-based shot
  // gets embedded. First image of the set wins; a set with no scene_indices is
  // the fallback for any shot not explicitly claimed.
  const boardImageByIndex = new Map<number, string>();
  let fallbackBoardImage: string | undefined;
  for (const set of opts.locationSets ?? []) {
    const img = (set.images ?? []).find((s) => typeof s === "string" && s.length > 0);
    if (!img) continue;
    const idxs = (set.scene_indices ?? []).filter(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 1
    );
    if (idxs.length === 0) {
      if (!fallbackBoardImage) fallbackBoardImage = img;
      continue;
    }
    for (const n of idxs) if (!boardImageByIndex.has(n)) boardImageByIndex.set(n, img);
  }

  // Consistency lock — pin the whole video to ONE lighting/time-of-day (the first
  // clip's) so boards never flip day↔night between shots.
  const projectLighting = opts.veoClips?.[0]
    ? clipStr(clipObj(opts.veoClips[0].background_lock).lighting)
    : "";
  // The project's locked visual look (first clip) — stamped into the location
  // sheet so the empty-set plates match the boards' style.
  const projectVisualStyle = opts.veoClips?.[0]
    ? clipStr(opts.veoClips[0].visual_style)
    : "";
  // Monotonic day↔night per shot: read a coarse time-of-day from each shot's text
  // and force the sequence to only move FORWARD (the script may go day→evening,
  // but boards must never oscillate day→night→day). Empty where nothing inferable.
  const perShotTimeText = segments.map((seg, i) => {
    const bg = opts.veoClips?.[i] ? clipObj(opts.veoClips[i].background_lock) : {};
    return [
      clipStr(bg.lighting),
      clipStr(bg.setting),
      clipStr(bg.scenery),
      seg?.first_frame_prompt ?? "",
      seg?.motion_prompt ?? "",
    ].filter(Boolean).join(" ");
  });
  const detectedTimeOrds = perShotTimeText.map((t) => timeOfDayOrdinal(t));
  const monotonicTimeOrds = resolveMonotonicOrdinals(perShotTimeText);

  // Lock ONE setting + scenery per LOCATION (the first clip seen for that place) so
  // every board of the same location describes the IDENTICAL room — same furniture,
  // same landmarks — instead of a per-shot description that drifts to a different
  // set on later boards. General rule for every project, not a per-file patch.
  const lockedBgByLocation = new Map<string, { setting: string; scenery: string }>();
  (opts.veoClips ?? []).forEach((clip, i) => {
    const seg = segments[i];
    const loc = (seg?.location_id ?? seg?.environment_ref ?? "").trim();
    if (!loc || loc === "custom" || lockedBgByLocation.has(loc)) return;
    const bg = clipObj(clip.background_lock);
    lockedBgByLocation.set(loc, { setting: clipStr(bg.setting), scenery: clipStr(bg.scenery) });
  });

  // Attach the LOCATION SHEET to every declared environment so the extension
  // generates each set ONCE as a SINGLE character-free image (overview + right→left
  // + left→right) and locks every board AND Veo clip to it — the user's "tạo sheet
  // bối cảnh" approach (a real reference image, one image), NOT a wide panel inside
  // the board. Uses the per-location locked setting/scenery so the sheet matches
  // the boards exactly;
  // falls back to the humanized location name when no clip described the set. The
  // extension prefers a user-uploaded location photo over these when one exists;
  // with no photo the app generates the sheet first, then feeds it into the board
  // together with the character sheets. General rule for every project.
  for (const env of environments) {
    const locked = lockedBgByLocation.get(env.id);
    const setting = (locked?.setting || "").trim() || env.name;
    const scenery = (locked?.scenery || "").trim();
    env.location_views = buildLocationSheetViews({
      setting,
      scenery,
      lighting: projectLighting,
      visualStyle: projectVisualStyle,
      realityMode,
      characterStyleLock: visualMediumLock,
    });
  }

  // Compute thumbnail delivery independently from the always-landscape board.
  const thumbnailAspect = opts.thumbnailAspectRatio ??
    (opts.aspectRatio === "16:9" ? "16:9" : "9:16");

  const shots: NanoFlowShot[] = segments.map((seg, i) => {
    const index = seg.segment_number || i + 1;
    const boardLocationImage = boardImageByIndex.get(index) ?? fallbackBoardImage;
    const inScene = seg.characters_in_scene ?? [];
    // A visibly motivated change (shower, rain, change of clothes) overrides the
    // base outfit for this one shot; otherwise inherit the locked outfit.
    const wardrobeOverride = new Map(
      (seg.wardrobe_state ?? [])
        .filter((w) => w && (w.character ?? "").trim() && (w.outfit ?? "").trim())
        .map((w) => [w.character.trim().toLowerCase(), w.outfit.trim()])
    );
    const wardrobeParts = inScene
      .map((n) => {
        const key = (n ?? "").trim().toLowerCase();
        const outfit = wardrobeOverride.get(key) ?? baseCostumeByName.get(key) ?? "";
        return outfit ? `${(n ?? "").trim()} in ${outfit}` : "";
      })
      .filter(Boolean);
    const wardrobeClause =
      wardrobeParts.length > 0
        ? ` Wardrobe (story-locked, identical across shots, never copied from a reference photo): ${wardrobeParts.join("; ")}.`
        : "";
    // A wardrobe_state override that differs from the character's base outfit is
    // a real change of clothes → tell the extension to regenerate that
    // character's full-body sheet with the new outfit from this shot onward.
    const wardrobeChange: Record<string, string> = {};
    for (const n of inScene) {
      const key = (n ?? "").trim().toLowerCase();
      const override = wardrobeOverride.get(key);
      if (override && override !== baseCostumeByName.get(key)) {
        wardrobeChange[(n ?? "").trim()] = override;
      }
    }
    // The matching STRUCTURED Veo clip (same order as segments). Drives both the
    // high-quality PRIMARY video payload and the downstream board prompt below.
    // Stamp the monotonic time-of-day onto the clip so Veo's day/night matches the
    // board and follows the script's forward-only flow.
    const monOrd = monotonicTimeOrds[i] ?? -1;
    const detOrd = detectedTimeOrds[i] ?? -1;
    const lockedTimeOfDay = timeOfDayLabel(monOrd);
    const rawClip = opts.veoClips?.[i];
    // If this shot's own time was clamped FORWARD (its text implied an earlier time
    // than the running story time), its raw lighting is stale — drop it so the
    // locked time-of-day drives the board's look; otherwise keep the shot's own
    // lighting. This kills day→night→day oscillation while allowing day→evening.
    const ownLighting = clipStr(clipObj(rawClip?.background_lock).lighting);
    const boardLighting = detOrd >= 0 && monOrd > detOrd ? "" : ownLighting;
    const clip = rawClip && lockedTimeOfDay
      ? {
          ...rawClip,
          time_of_day_lock: `TIME OF DAY = ${lockedTimeOfDay} for THIS shot (locked). Match lighting, sky and shadows to ${lockedTimeOfDay}. The project's day/night only moves FORWARD with the script — never day→night→day.`,
        }
      : rawClip;
    const productionShot = productionState.shots[i]!;
    const stateAuthority = buildNanoFlowShotStateAuthority({
      productionState,
      shot: productionShot,
      segment: seg,
    });
    const primaryVideoPrompt = clip
      ? withProductionStateAuthority(
          withKeyframeAuthority(clip, visualMediumLock),
          stateAuthority
        )
      : buildLegacyVideoPrompt(
          (seg.full_prompt || seg.motion_prompt || "").trim(),
          stateAuthority,
          visualMediumLock
        );
    const envRef = (seg.location_id ?? seg.environment_ref ?? "").trim();
    const envIds = envRef && envRef !== "custom" ? [envRef] : [];

    const affiliateProductIds = opts.affiliateProductIR?.review_status === "approved"
      ? products.map((product) => product.id)
      : [];
    const image_refs: NanoFlowRefSelector = {
      characters: charIds(inScene),
      environments: envIds,
      products: affiliateProductIds,
    };

    // The boundary entering this shot (reused for scene 1 below).
    const shotContinuity =
      seg.transition_in?.mode ??
      seg.continuity_mode ??
      (i === 0 ? "opening" : "continuous");

    // Per-location locked room description (every board of this location = one set).
    const lockedBg = lockedBgByLocation.get((seg.location_id ?? seg.environment_ref ?? "").trim())
      ?? { setting: "", scenery: "" };
    // Board-to-board handoff (user): PANEL 1 of this board = the LAST panel of the
    // previous board whenever the two boards share the SAME location (same set) and
    // this shot is not a hard break (real location change / time jump / flashback /
    // dream). This makes consecutive same-scene boards touch (their example boards
    // 2→3). Carries the previous shot's end-state + last beat.
    const prevSeg = i > 0 ? segments[i - 1] : undefined;
    const prevClip = i > 0 ? opts.veoClips?.[i - 1] : undefined;
    const thisLoc = (seg.location_id ?? seg.environment_ref ?? "").trim();
    const prevLoc = (prevSeg?.location_id ?? prevSeg?.environment_ref ?? "").trim();
    const hardBreak = ["location_cut", "time_jump", "flashback", "dream"].includes(String(shotContinuity));
    const sameSetAsPrev =
      !!prevClip && !!thisLoc && thisLoc !== "custom" && thisLoc === prevLoc && !hardBreak;
    const prevBeats = Array.isArray(prevSeg?.beats) ? prevSeg!.beats : [];
    const prevLastBeat = prevBeats.length
      ? clipStr((prevBeats[prevBeats.length - 1] as { beat?: string })?.beat)
      : "";
    const continueFromPrevious = sameSetAsPrev
      ? [
          clipStr(clipObj(prevClip!.scene_action).end_state),
          prevLastBeat ? `(previous board's last panel: ${prevLastBeat})` : "",
        ].filter(Boolean).join(" ")
      : "";
    const previousProductionShot = i > 0 ? productionState.shots[i - 1] : undefined;
    const placementContract = buildBoardPlacementContract({
      previousEndPlacements: previousProductionShot?.end_snapshot.placements,
      currentStartPlacements: productionShot.start_snapshot.placements,
      sameLocation:
        i > 0 &&
        !!thisLoc &&
        thisLoc !== "custom" &&
        thisLoc === prevLoc &&
        !["location_cut", "time_jump", "flashback", "dream"].includes(String(shotContinuity)),
      actions: productionShot.actions,
      motionText: seg.motion_prompt,
    });

    // ── Frame-mode: ONE clean keyframe (start_frame) or TWO (start + end,
    //    start_end_frame interpolation). Genre/directing-profile policy refined
    //    by this shot's transform score; a per-shot manual override wins. §6.2.
    const useCleanKeyframe = (opts.keyframeMode ?? "clean") !== "board";
    const transformScore = computeTransformScore(seg, clip);
    const frameMode: FrameMode = decideFrameMode({
      genre: opts.genre,
      directingProfile: opts.directingProfile,
      transformScore,
      override: opts.frameModeOverrides?.[index],
    });
    // ── Cross-shot continuity chain: when THIS shot continues the previous one
    //    (same location AND continuity_mode "continuous"), tell the extension to
    //    build this shot's keyframe FROM the previous shot's last frame (its END
    //    keyframe when the previous shot was 2-frame) so the footage flows
    //    seamlessly. A hard cut, a different place, or a wardrobe change never
    //    chains (the extension also self-guards wardrobe changes). A per-shot
    //    manual override wins. §6.2.
    const chainOverride = opts.chainModeOverrides?.[index];
    const chainFromPrev =
      chainOverride === "on"
        ? true
        : chainOverride === "off"
          ? false
          : String(shotContinuity) === "continuous" && sameSetAsPrev;
    // Shared inputs for the clean START + END keyframes. Same scene locks the
    // legacy board builder uses, so the image stays faithful to the same clip.
    const keyframeArgs = {
      primaryVideoPrompt,
      stateAuthority,
      fallbackSceneText: seg.first_frame_prompt || seg.motion_prompt || "",
      aspectRatio: opts.aspectRatio ?? "9:16",
      envName: humanizeEnvId((seg.location_id ?? seg.environment_ref ?? "").trim()),
      wardrobeClause,
      realityMode,
      beats: seg.beats ?? [],
      hasLocationPhoto: !!boardLocationImage,
      resolvedLighting: boardLighting,
      characterStyleLock: visualMediumLock,
      anonymousNarration: opts.anonymousNarration === true,
      fallbackCast: inScene.map((name) => {
        const key = name.trim().toLowerCase();
        const wardrobe = wardrobeOverride.get(key) ?? baseCostumeByName.get(key) ?? "";
        return {
          name: name.trim(),
          ...(!opts.anonymousNarration && wardrobe ? { wardrobe } : {}),
        };
      }),
      continuityId: `set_${slugify((seg.location_id ?? seg.environment_ref ?? "project_location").trim()) || "project_location"}`,
      persistentPropIds,
      lockedSetting: lockedBg.setting,
      lockedScenery: lockedBg.scenery,
      continueFromPrevious,
      lockedTimeOfDay,
      placementContract,
    };

    return {
      shot_id: `SHOT_${String(index).padStart(3, "0")}`,
      index,
      storyboard_name: `${title} ${index}`,
      duration_seconds: seg.duration_seconds || 10,
      marketing_role: seg.marketing_role,

      // STEP A image prompt — the image the extension feeds Veo as the FIRST
      // FRAME. Default "clean" keyframe mode = ONE clean cinematic still (a real
      // Veo first frame, no multi-panel contact sheet). Legacy "board" mode keeps
      // the multi-panel storyboard board (unchanged) for backward-compat / A-B.
      storyboard_prompt: useCleanKeyframe
        ? buildKeyframePrompt({ moment: "start", ...keyframeArgs })
        : buildLocationBoardPrompt(
        primaryVideoPrompt,
        stateAuthority,
        seg.first_frame_prompt || seg.motion_prompt || "",
        humanizeEnvId((seg.location_id ?? seg.environment_ref ?? "").trim()),
        wardrobeClause,
        realityMode,
        seg.beats ?? [],
        !!boardLocationImage,
        boardLighting,
        visualMediumLock,
        opts.anonymousNarration === true,
        opts.beatsPerSegment,
        inScene.map((name) => {
          const key = name.trim().toLowerCase();
          const wardrobe = wardrobeOverride.get(key) ?? baseCostumeByName.get(key) ?? "";
          return {
            name: name.trim(),
            ...(!opts.anonymousNarration && wardrobe ? { wardrobe } : {}),
          };
        }),
        `set_${slugify((seg.location_id ?? seg.environment_ref ?? "project_location").trim()) || "project_location"}`,
        persistentPropIds,
        lockedBg.setting,
        lockedBg.scenery,
        continueFromPrevious,
        lockedTimeOfDay,
        placementContract
      ),
      // STEP A2 (clean keyframe mode only): the END keyframe for a transform
      // shot. Its presence makes the extension run Veo start_end_frame
      // interpolation (start→end); omitted ⇒ a normal single-keyframe shot. §6.2.
      ...(useCleanKeyframe && frameMode === "start_end"
        ? { end_storyboard_prompt: buildKeyframePrompt({ moment: "end", ...keyframeArgs }) }
        : {}),
      continuity_mode: shotContinuity,
      // Seamless story flow: chain this shot's keyframe from the previous shot's
      // last frame. Present only for a truly continuous same-location shot;
      // absent ⇒ a fresh independent keyframe (opening, cut or different place).
      ...(chainFromPrev ? { chain_from_prev: true } : {}),
      ...(seg.location_id ? { location_id: seg.location_id } : {}),
      image_refs,
      // Cách 1 — embed the uploaded real location photo for this shot (if any).
      ...(boardLocationImage ? { board_location_image: boardLocationImage } : {}),

      // STEP B video payload = the STRUCTURED Veo scene JSON (high quality);
      // falls back to the flat prose prompt only when no structured clip exists.
      // The generated keyframe is a visual opening reference only. The primary
      // video prompt remains the semantic authority for action/camera/end state.
      video_prompt: primaryVideoPrompt,
      characters_in_scene: inScene,
      video_refs: {
        // Legacy projects keep products OFF. Affiliate shots opt in explicitly
        // so the extension can preserve exact geometry/logo in board and Veo.
        use_generated_storyboard: true,
        characters: charIds(inScene),
        environments: [],
        products: affiliateProductIds,
      },

      // Structured video_prompt.dialogue is the one Veo-facing spoken payload.
      // Do not expose a second legacy copy for an extension to append again.
      dialogue: null,
      voice: null,
      beats: (seg.beats ?? []).map((b) => ({ beat: b.beat, camera: b.camera })),
      wardrobe_change: Object.keys(wardrobeChange).length ? wardrobeChange : null,
      // Store the SLIM authority; the full canonical shot state is available once
      // at manifest.production_state.shots[index] (no per-shot duplication).
      state_authority: slimStateAuthorityForManifest(stateAuthority),
    };
  });

  return {
    manifest_version: "1.0",
    generator: "storyboard-ai",
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    project: {
      project_id: opts.projectId ?? `prj_${slugify(title)}`,
      title,
      // VIDEO aspect (16:9 / 9:16 / 1:1) — the frame Veo must render. The BOARD
      // image is ALWAYS 16:9 (board_aspect_ratio) because a wide sheet describes
      // the cast and layout most faithfully, which yields the best video.
      aspect_ratio: opts.aspectRatio ?? "9:16",
      board_aspect_ratio: "16:9",
      dialogue_language: opts.dialogueLanguage ?? "Vietnamese",
      production_prompt_language: opts.productionPromptLanguage?.trim() || "English",
      ...(breakdown.context_ir?.production_profile
        ? { production_profile: breakdown.context_ir.production_profile }
        : {}),
      ...(opts.speechContract ? { speech_contract: opts.speechContract } : {}),
      total_duration_seconds: breakdown.total_duration_seconds,
      thumbnail_title: breakdown.thumbnail_title,
      thumbnail_aspect_ratio: thumbnailAspect,
      ...(characterRepresentation && visualMediumLock
        ? { character_style: { id: characterRepresentation, prompt: visualMediumLock } }
        : {}),
      ...(opts.affiliateProductIR?.review_status === "approved"
        ? {
            commercial_content: {
              affiliate: true,
              disclosure_required: true,
              suggested_disclosure: opts.affiliateDisclosure || "Nội dung có liên kết tiếp thị / affiliate.",
              product_ir: opts.affiliateProductIR,
            },
          }
        : {}),
      thumbnail_prompt: buildThumbnailPrompt({
        headline: breakdown.thumbnail_title || title,
        castNames: characters.map((c) => c.name).slice(0, 3),
        hero:
          opts.productNames?.[0] ||
          (breakdown.product_dna
            ? "the hero product featured in the video (match the attached product reference exactly)"
            : persistentPropEntries[0]
              ? `the story's hero object "${persistentPropEntries[0].display_name}" (keep its exact established shape, material and colour)`
              : "the single key story object established by the script"),
        aspect: thumbnailAspect,
        realityMode,
        characterStyleLock: visualMediumLock,
        characterStyleId: characterRepresentation,
      }),
      social_posts: breakdown.social_posts,
    },
    assets: {
      characters,
      environments,
      products,
    },
    shots,
    production_state: productionState,
  };
}
