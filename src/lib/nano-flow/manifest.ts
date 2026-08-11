// buildNanoFlowManifest — maps a finished StoryboardGenerationOutput into the
// shared Nano Flow manifest (docs/nano-flow-pipeline/manifest.schema.json) that
// the AutoFlow Reel extension consumes. Pure + side-effect free so it is easy
// to unit-test and for Codex to reason about. See DESIGN.md §4.1.

import type { CharacterRepresentation, LocationSet, StoryboardGenerationOutput } from "@/types";
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

export interface BuildNanoFlowManifestOptions {
  /** VIDEO aspect ratio (the frame Veo renders). The BOARD is always 16:9. */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  thumbnailAspectRatio?: "16:9" | "9:16";
  dialogueLanguage?: string;
  projectId?: string;
  /** Số cảnh nhỏ mỗi đoạn (beats_per_segment) người dùng chọn. Board vẽ ĐÚNG
   * bấy nhiêu ô — 3 cảnh ⇒ 3 frame, không thừa. Trống ⇒ tối đa 5. */
  beatsPerSegment?: number;
  /** ISO timestamp; defaults to now. Injectable for deterministic tests. */
  generatedAt?: string;
  /** Optional product reference names to declare as shared assets. */
  productNames?: string[];
  /** Explicit character medium selected in the app (one of the ten locked video
   * styles). Copied into the manifest and hard-locked into every board image +
   * Veo video prompt. Photoreal representations (auto/uploaded/human/none) leave
   * the board photoreal and add no style lock. */
  characterRepresentation?: CharacterRepresentation;
  /** Fully rendered character + environment style-lock law for the selected id
   * (CHARACTER_LAWS[representation].join(" ")). */
  characterStylePrompt?: string;
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
      "WIDE establishing view from the primary entrance/camera side, showing the complete floor plan, fixed architecture, furniture and main spatial anchors.",
    panel_2:
      "A genuinely different reverse three-quarter view from the opposite connected corner, rotated roughly 90-135 degrees from panel 1, revealing the previously hidden wall and reverse relationships between the SAME immutable anchors. It must not be a crop, zoom, duplicate or tiny variation of panel 1.",
    continuity:
      "Both panels depict the exact same empty place at the same moment: identical architecture, doors, windows, furniture, materials, colours, prop design, time of day and light direction. Only camera position and viewing direction differ.",
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
  projectLighting: string,
  characterStyleLock = "",
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
  // The previous shot's END-state facts, carried in ONLY when this shot continues
  // the same scene (continuous). The first panel opens FROM this so a dialogue
  // that spans two boards stays visually continuous; empty for a fresh scene cut.
  continueFromPrevious = ""
): string {
  const clip =
    primaryVideoPrompt && typeof primaryVideoPrompt === "object"
      ? primaryVideoPrompt
      : undefined;

  const bg = clipObj(clip?.background_lock);
  const setting = lockedSetting || clipStr(bg.setting) || fallbackSceneText || envName;
  const scenery = lockedScenery || clipStr(bg.scenery);
  const lighting = projectLighting || clipStr(bg.lighting);
  const visualStyle = clipStr(clip?.visual_style);

  const locks = clipObj(clip?.character_lock);
  const cast: Array<Record<string, string>> = [];
  for (const key of Object.keys(locks)) {
    const c = clipObj(locks[key]);
    const name = clipStr(c.name);
    if (!name) continue;
    const appearance = [
      meaningful(clipStr(c.gender)),
      meaningful(clipStr(c.age)),
      meaningful(clipStr(c.body_build)),
      meaningful(clipStr(c.hair)) ? `hair ${clipStr(c.hair)}` : "",
      meaningful(clipStr(c.skin_or_fur_color)),
    ].filter(Boolean).join(", ");
    const wardrobe = [clipStr(c.outfit_top), clipStr(c.outfit_bottom)]
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
  const panels = selected.map((candidate, i) => {
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
    establishing_view_contract:
      "AT LEAST ONE panel — make it PANEL 1 — MUST be a WIDE ESTABLISHING shot that clearly shows the FULL location: walls, windows, main furniture and where the characters stand in the room, reproduced from the attached location reference (a real photo OR the character-free 2-angle location sheet of this set). NEVER let all panels be tight face close-ups — if the room is never visible the downstream video invents a wrong set. The other panels may be medium / OTS / close, but the SAME recognizable set (same furniture geometry, same time-of-day and light) must stay visible behind the cast in every panel.",
    ...(continueFromPrevious
      ? {
          continue_from_previous:
            `SCENE CONTINUES the previous board (same conversation, NO cut): PANEL 1 opens FROM this exact end-state so the two boards are visually continuous — same character positions, same props in the same hands/places, same time-of-day and light: ${continueFromPrevious}. Do not restart, relocate or change the set/time; only advance the action forward.`,
        }
      : {}),
    setting_authority: hasLocationPhoto
      ? "An ATTACHED location photo is the EXACT and MANDATORY setting. Reproduce THAT real place — its layout, furniture, walls, windows, materials, colours and lighting — in EVERY panel. Never invent, relocate or substitute a different location; only the camera framing changes."
      : `If a LOCATION REFERENCE image is attached (a real photo OR the character-free 2-angle location sheet of this set), it is the EXACT and MANDATORY setting: reproduce THAT place — its layout, furniture, walls, windows, materials, colours and lighting — in EVERY panel, and never relocate or substitute a different location; only the camera framing changes. If no location image is attached, build the setting faithfully from this description: ${setting}.`,
    staging:
      "Place the ATTACHED characters INTO this location and have them perform each panel's action. Each character's face, hair AND full outfit must match that character's ATTACHED wardrobe sheet exactly. The SAME people appear in every panel.",
    render: characterStyleLock || (liveAction
      ? KEYFRAME_RENDER_NOTE
      : `Reality E storyboard board in the project's locked ${realityMode} medium. Preserve its exact design language, materials, proportions, lighting logic and internal physics; never convert it to live-action photorealism.`),
    visual_style: visualStyle || undefined,
    setting,
    scenery: scenery && scenery !== setting ? scenery : undefined,
    lighting: lighting || undefined,
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
    reference_authority: KEYFRAME_REFERENCE_AUTHORITY,
    wardrobe_note: wardrobeClause ? wardrobeClause.trim() : undefined,
    negative: characterStyleLock
      ? "Stay strictly in the locked visual medium/style above — do NOT drift to a different style and do NOT convert to live-action photography. The ONLY text on the image is the specified per-panel caption strips. No identity drift; never duplicate a character within a panel; consistent location and consistent style across every panel."
      : liveAction
        ? "Photorealistic only — NOT cartoon, NOT anime, NOT illustration, NOT 3D render, NOT painting, NOT drawing. No watermark or logo. The ONLY text on the image is the specified per-panel caption strips — no other subtitles, UI or lettering. No identity drift; never duplicate a character within a panel; no extra, missing or fused fingers."
        : "No visual-medium drift, no accidental photoreal conversion, no inconsistent character design; the only text is the specified per-panel captions; consistent location across every panel.",
  };
  // JSON.stringify drops the undefined-valued keys, leaving a clean payload.
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
}): string {
  const cast = params.castNames.length ? params.castNames.join(" and ") : "the main character(s)";
  const liveAction = ["documentary", "cinematic", "commercial"].includes(params.realityMode);
  const prompt: Record<string, unknown> = {
    type: liveAction ? "photoreal_viral_thumbnail" : `${slugify(params.realityMode)}_viral_thumbnail`,
    aspect: params.aspect === "9:16" ? "9:16 vertical" : "16:9 horizontal",
    goal: "A high-energy, high-click-through YouTube/TikTok thumbnail — instantly readable at a glance, hyper-saturated and punchy.",
    subjects: `The cast (${cast}) cut out as stickers with a THICK glowing white + neon outline, leaning in with EXAGGERATED excited/shocked reactions — wide eyes, big open-mouth smiles — reacting to the hero item. Each person's face, hair and build come EXACTLY from that character's ATTACHED wardrobe sheet (identity source of truth); do NOT restyle their face.`,
    hero_item: `${params.hero} as the centred hero — glistening, appetising, larger-than-life, with a subtle glow.`,
    headline: `Big bold 3D headline "${params.headline}" across the TOP third — thick multi-colour gradient letters (warm yellow → pink → blue), heavy dark outline + drop shadow + soft glow, plus one playful emoji. The text MUST be spelled EXACTLY as given, crisp and fully legible.`,
    background: "warm, festive setting with blurred bokeh string lights, floating confetti and sparkles, and a bright radial light-burst behind the subjects; deep saturated colours.",
    composition: "subjects fill the lower two-thirds, headline in the top third, hero item centred between/below them; strong depth, punchy vignette.",
    render: liveAction
      ? "Photoreal characters composited with graphic overlays; ultra-saturated, high contrast, tack-sharp — a scroll-stopping thumbnail."
      : `Reality E thumbnail in the project's locked ${params.realityMode} medium; keep the design language, just push saturation and energy.`,
    negative: "no extra, missing or fused fingers; no distorted or duplicated faces; NO gibberish or misspelled text (the headline must read exactly as given); no watermark, no logo.",
  };
  return JSON.stringify(prompt);
}

/**
 * Build the 2-angle LOCATION SHEET (`location_views`) for ONE environment — the
 * user's "tạo sheet bối cảnh" approach. Each view is a CHARACTER-FREE establishing
 * image of the EMPTY set (a WIDE full view + a second/reverse angle of the SAME
 * place). The extension generates BOTH once per location, then attaches them as
 * the background authority for every board AND every Veo clip set here, so Nano
 * Banana and Veo pin the identical set instead of inventing or drifting the
 * location (day→night, wrong room). When the user uploaded a real location photo
 * the extension prefers that photo and skips these; when there is NO photo the
 * app-authored sheet is the location the whole shot is locked to — i.e. the app
 * "tự tạo ảnh bối cảnh ra trước tạo sheet rồi mới ghép vào board". General for
 * every project, not a per-file patch.
 */
function buildLocationSheetViews(params: {
  setting: string;
  scenery: string;
  lighting: string;
  visualStyle: string;
  realityMode: string;
  characterStyleLock: string;
}): Array<{ angle: "wide" | "alt"; prompt: string }> {
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
  const view = (angle: "wide" | "alt", framing: string) => ({
    angle,
    prompt: JSON.stringify({
      type: characterStyleLock
        ? "styled_location_plate"
        : liveAction
          ? "photoreal_location_plate"
          : `${slugify(realityMode)}_location_plate`,
      goal:
        "A CHARACTER-FREE establishing photo of the EMPTY location — the background authority reused to keep every shot on the SAME set. No people or product; only the place.",
      source_authority:
        "If a real LOCATION PHOTO is attached as a reference, it is the EXACT place: faithfully reproduce THAT real location from this view's angle — its layout, walls, windows, doors, furniture, materials, colours and lighting — treating the attached photo as ground truth and changing ONLY the camera vantage to this angle. Remove any people or products that happen to appear in the photo (the plate stays empty). If NO photo is attached, build the location from the setting/scenery description below.",
      framing,
      setting: setting || "the scripted location",
      scenery: scenery && scenery !== setting ? scenery : undefined,
      lighting: lighting || undefined,
      visual_style: visualStyle || undefined,
      consistency:
        "The WIDE and the ALT view show the EXACT SAME place — identical walls, windows, doors, floor, furniture geometry, landmarks, materials, colours, time-of-day and light direction; ONLY the camera vantage changes. This is the immutable set every scene here must reuse.",
      render,
      negative,
    }),
  });
  return [
    view(
      "wide",
      "A WIDE ESTABLISHING shot of the whole location from a natural eye-level vantage: show the full space — walls, windows, doors, main furniture and how the room is laid out, edge to edge. Empty of people."
    ),
    view(
      "alt",
      "A SECOND angle of the SAME place — roughly the reverse / 90° vantage — revealing what the wide shot could not (the opposite wall and adjoining area), keeping the SAME furniture, materials, time-of-day and lighting. Empty of people."
    ),
  ];
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
  rules.reference_priority =
    "AUTHORITY ORDER (do NOT reverse it): the SCRIPT-DERIVED STRUCTURED VIDEO PROMPT is the sole semantic authority for story action, timing, camera, state transition and ending. The generated STORYBOARD / LOCATION BOARD is only a visual continuity reference for the already-declared opening appearance and set geometry; it must never add, remove, replace or reinterpret video events. Each attached character WARDROBE SHEET locks ONLY that character's face, hair and full outfit — copy them exactly and IGNORE the sheet's plain studio backdrop. Use the location board to keep the prompt-declared environment visually consistent (background, spatial layout, furniture, props, doors, windows, lighting and materials), but when any image detail conflicts with this structured prompt, FOLLOW THIS VIDEO PROMPT. Identity and clothing come from the sheets; semantics and motion come from the video prompt.";
  rules.storyboard_reference_role =
    "Visual continuity only. Do not infer new actions from the board and do not let the board override ordered actions, dialogue, camera intent, timing or end state in this video prompt.";
  if (characterStyleLock) rules.character_style_lock = characterStyleLock;
  return { ...clip, output_rules: rules };
}

/** Add the canonical script/state contract to the PRIMARY video payload. */
export function withProductionStateAuthority(
  clip: Record<string, unknown>,
  authority: NanoFlowShotStateAuthority
): Record<string, unknown> {
  const rules = clipObj(clip.output_rules);
  const compact = compactPromptAuthority(authority);
  return {
    ...clip,
    production_state_authority: compact,
    state_transition_contract: {
      authority_fingerprint: authority.authority_fingerprint,
      start_snapshot: compact.start_snapshot,
      ordered_atomic_actions: compact.ordered_atomic_actions,
      end_snapshot: compact.end_snapshot,
    },
    dialogue_audio_contract: {
      authority_fingerprint: authority.authority_fingerprint,
      dialogue_state: compact.dialogue_state,
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
  return [
    primary,
    `PRODUCTION_STATE_AUTHORITY ${authority.authority_fingerprint}:`,
    JSON.stringify(compactPromptAuthority(authority)),
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
    characters.push({ id, name, image: null, required });
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
    const name = humanizeEnvId(ref);
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
  if (opts.productNames?.length) {
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

  // Attach the 2-angle LOCATION SHEET to every declared environment so the
  // extension generates each set ONCE (character-free wide + alt) and locks every
  // board AND Veo clip to it — the user's "tạo sheet bối cảnh" approach (a real
  // reference image), NOT just a wide panel inside the board. Uses the per-
  // location locked setting/scenery so the sheet matches the boards exactly;
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
    const clip = opts.veoClips?.[i];
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

    const image_refs: NanoFlowRefSelector = {
      characters: charIds(inScene),
      environments: envIds,
      products: [], // step A default: leave product to the user/Storyboard to opt in per shot
    };

    // The boundary entering this shot (reused for scene 1 below).
    const shotContinuity =
      seg.transition_in?.mode ??
      seg.continuity_mode ??
      (i === 0 ? "opening" : "continuous");

    // Per-location locked room description (every board of this location = one set).
    const lockedBg = lockedBgByLocation.get((seg.location_id ?? seg.environment_ref ?? "").trim())
      ?? { setting: "", scenery: "" };
    // Carry the PREVIOUS board's end-state into this board ONLY when the scene
    // continues (continuous) — so a dialogue spanning two boards stays continuous.
    // A scene_cut / location_cut / time_jump starts a fresh board (empty carry).
    const prevClip = i > 0 ? opts.veoClips?.[i - 1] : undefined;
    const continueFromPrevious =
      shotContinuity === "continuous" && prevClip
        ? clipStr(clipObj(prevClip.scene_action).end_state)
        : "";

    return {
      shot_id: `SHOT_${String(index).padStart(3, "0")}`,
      index,
      storyboard_name: `${title} ${index}`,
      duration_seconds: seg.duration_seconds || 10,
      marketing_role: seg.marketing_role,

      // LOCATION BOARD prompt for this 10s shot: ONE image, 4 panels of the SAME
      // location from 4 angles, built from the SAME structured clip as the video
      // (đồng bộ bối cảnh) and style-locked to photoreal. The PRIMARY video
      // prompt drives semantics; this board is its downstream static projection.
      storyboard_prompt: buildLocationBoardPrompt(
        primaryVideoPrompt,
        stateAuthority,
        seg.first_frame_prompt || seg.motion_prompt || "",
        humanizeEnvId((seg.location_id ?? seg.environment_ref ?? "").trim()),
        wardrobeClause,
        realityMode,
        seg.beats ?? [],
        !!boardLocationImage,
        projectLighting,
        visualMediumLock,
        opts.beatsPerSegment,
        inScene.map((name) => {
          const key = name.trim().toLowerCase();
          const wardrobe = wardrobeOverride.get(key) ?? baseCostumeByName.get(key) ?? "";
          return { name: name.trim(), ...(wardrobe ? { wardrobe } : {}) };
        }),
        `set_${slugify((seg.location_id ?? seg.environment_ref ?? "project_location").trim()) || "project_location"}`,
        persistentPropIds,
        lockedBg.setting,
        lockedBg.scenery,
        continueFromPrevious
      ),
      continuity_mode: shotContinuity,
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
        // DESIGN.md §6: keyframe = first frame; characters = identity ref;
        // environments/products OFF (already baked into the keyframe).
        use_generated_storyboard: true,
        characters: charIds(inScene),
        environments: [],
        products: [],
      },

      dialogue: seg.dialogue ?? null,
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
      total_duration_seconds: breakdown.total_duration_seconds,
      thumbnail_title: breakdown.thumbnail_title,
      thumbnail_aspect_ratio: thumbnailAspect,
      ...(characterRepresentation && visualMediumLock
        ? { character_style: { id: characterRepresentation, prompt: visualMediumLock } }
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
