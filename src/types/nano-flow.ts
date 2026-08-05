// TypeScript types for the Nano Flow manifest — the shared Storyboard ⇄ Extension
// contract that moves storyboard image generation off the paid Gemini API onto
// Google Flow's free Nano Banana (driven by the AutoFlow Reel extension).
//
// MUST stay in sync with docs/nano-flow-pipeline/manifest.schema.json — an
// identical copy of that schema lives in BOTH repos. See
// docs/nano-flow-pipeline/DESIGN.md for the full design.

export const NANO_FLOW_MANIFEST_VERSION = "1.0" as const;

export type NanoFlowMarketingRole =
  | "hook"
  | "problem"
  | "solution"
  | "body"
  | "cta";

/** Schema 4.0/4.1 continuity decision for a boundary — used both for the boundary
 * ENTERING a shot and (4.1) for the boundary between two SCENES inside a shot. The
 * app picks this per boundary from the script; the extension uses it to decide
 * whether to nối liền (continuous) or cắt (scene_cut/location_cut/…). */
export type NanoFlowContinuityMode =
  | "opening"
  | "continuous"
  | "scene_cut"
  | "location_cut"
  | "time_jump"
  | "parallel_intercut"
  | "match_cut"
  | "montage"
  | "flashback"
  | "dream"
  | "symbolic";

/** Schema 4.2 (A2) — one character-free establishing view of a location. Two per
 * location (a WIDE full establishing shot + a SECOND angle) are generated ONCE by
 * the extension from these Storyboard-written prompts, then reused as the
 * background reference for every scene set in this location — so the background is
 * locked and neither Nano Banana nor Veo fabricates or drifts the set. */
export interface NanoFlowLocationView {
  /** Which of the two views this is: "wide" (full establishing) | "alt" (second
   * angle of the SAME place). Labels the pair for logs/ordering. */
  angle: "wide" | "alt" | string;
  /** Storyboard-written prompt to generate this EMPTY location image (no people,
   * no product) — same set, materials, furniture and lighting as the scenes. */
  prompt: string;
}

/** A reference image declared once per project; shots reference it by `id`.
 * `image === null` means the slot is declared but the real image is attached
 * later on the extension side (e.g. a real person's / product's photo). */
export interface NanoFlowAsset {
  id: string;
  name: string;
  image: string | null;
  required?: boolean;
  /** Characters only: the story-locked outfit for this character. The extension
   * generates a full-body "wardrobe sheet" (identity photo + this outfit) once,
   * then reuses it as the reference for every keyframe so face AND clothes stay
   * identical across shots. Empty ⇒ extension derives an outfit from the scene. */
  wardrobe?: string;
  /** Environments only (A2): the two establishing views (wide + alt angle) of
   * this location. When present (and no real `image` is attached), the extension
   * GENERATES both once — character-free — and attaches them as the background
   * authority for every scene here, so Veo never invents the set. */
  location_views?: NanoFlowLocationView[];
}

/** Which declared assets to attach at a given step (STEP A — image gen). */
export interface NanoFlowRefSelector {
  characters?: string[];
  environments?: string[];
  products?: string[];
}

/** STEP B (video) ref selection. See DESIGN.md §6 for the default policy:
 * keyframe = first frame; characters = identity ref; environments/products
 * default OFF because they are already baked into the keyframe. */
export interface NanoFlowVideoRefSelector extends NanoFlowRefSelector {
  use_generated_storyboard?: boolean;
}

export interface NanoFlowBeat {
  beat?: string;
  camera?: string;
}

/** Schema 4.1 — a single SCENE inside a shot. Each scene is generated as its OWN
 * Nano Banana image from `image_prompt` (written 100% by Storyboard, script-
 * accurate), REPLACING the old "one keyframe per 10s shot" model that lost the
 * per-beat action. A 10s shot carries 1..N scenes (menu-selected via
 * beats_per_segment). Scenes may sit in DIFFERENT locations (cross-cut office/
 * home) via `location_id`, and the extension renders one image per scene — no
 * single-keyframe collapse and no risky frame-chaining. */
export interface NanoFlowScene {
  /** 1-based order within the shot. */
  scene_no: number;
  /** Camera framing for this scene (e.g. "[CLOSE]", "over_the_shoulder"). */
  camera?: string;
  /** The scripted action/moment this scene depicts (the beat). */
  action: string;
  /** Prompt written 100% by Storyboard to generate THIS scene's image. Carries
   * the shot's locked context (cast/wardrobe/setting/look) with this scene's
   * specific moment — so every scene stays on-script and consistent. */
  image_prompt: string;
  /** Which declared assets to attach for this scene's image gen. */
  image_refs?: NanoFlowRefSelector;
  /** Location this scene happens in (an environment asset id). A shot may span
   * locations; the extension attaches that location's background overview ref. */
  location_id?: string;
  /** How this scene continues from the PREVIOUS scene (or from the prior shot for
   * scene 1). Lets the extension nối liền vs cắt per boundary. */
  transition_from_prev?: NanoFlowContinuityMode;
  dialogue?: string | null;
}

export interface NanoFlowShot {
  shot_id: string;
  index: number;
  /** Name given to the Nano Banana image, ordered (e.g. "Making Tra Bac 1"). */
  storyboard_name: string;
  duration_seconds?: number;
  marketing_role?: NanoFlowMarketingRole;
  /** Schema 4.0 continuity decision for the boundary entering this shot. */
  continuity_mode?: NanoFlowContinuityMode;
  /** Project-local Context-IR location id used for per-location memory/audio. */
  location_id?: string;

  // ─── STEP A: generate the storyboard/keyframe image with Nano Banana ───
  /** Prompt written 100% by Storyboard to create the image. */
  storyboard_prompt: string;
  image_refs?: NanoFlowRefSelector;
  /** Cách 1 (upload mode) — a REAL location photo the user uploaded for this
   * shot, embedded straight into the manifest as a data URL. When present the
   * extension attaches it as the strict setting reference for this shot's board
   * (no re-upload needed in the extension). Empty ⇒ the board is generated from
   * storyboard_prompt alone. */
  board_location_image?: string;

  // ─── STEP B: generate the video with Veo, using the STEP A image ───
  /** STEP B video payload, written 100% by Storyboard. Normally the STRUCTURED
   * Veo scene JSON (one clip object — the same shape as veo_prompts.json), which
   * Veo/Flow parses far more reliably than a flat paragraph. A plain string is
   * kept only as a legacy fallback when no structured clip is available. */
  video_prompt: Record<string, unknown> | string;
  characters_in_scene?: string[];
  video_refs?: NanoFlowVideoRefSelector;

  dialogue?: string | null;
  voice?: string | null;
  beats?: NanoFlowBeat[];

  /** Schema 4.1 — the ordered SCENES that make up this shot, one generated image
   * each (built from `beats`). When present the extension renders one image PER
   * scene instead of collapsing the shot to a single keyframe. `storyboard_prompt`
   * remains the backward-compatible single-image fallback when `scenes` is empty. */
  scenes?: NanoFlowScene[];

  /** A visibly motivated wardrobe change starting at this shot (rain, shower,
   * change of clothes): { "CharacterName": "new outfit" }. The extension
   * regenerates that character's full-body wardrobe sheet with the new outfit
   * and uses it from this shot onward. Omit when the outfit is unchanged. */
  wardrobe_change?: Record<string, string> | null;
}

export interface NanoFlowProject {
  project_id?: string;
  title: string;
  aspect_ratio?: "16:9" | "9:16";
  dialogue_language?: string;
  total_duration_seconds?: number;
  thumbnail_title?: string;
  /** Reuses the existing Storyboard SocialPosts shape verbatim. */
  social_posts?: unknown;
}

export interface NanoFlowAssets {
  characters?: NanoFlowAsset[];
  environments?: NanoFlowAsset[];
  products?: NanoFlowAsset[];
}

export interface NanoFlowManifest {
  manifest_version: typeof NANO_FLOW_MANIFEST_VERSION;
  generator: string;
  generated_at?: string;
  project: NanoFlowProject;
  assets: NanoFlowAssets;
  shots: NanoFlowShot[];
}

/** postMessage envelope used for the direct Storyboard(iframe) → Extension push.
 * See DESIGN.md §7. */
export const NANO_FLOW_MESSAGE_SOURCE = "STORYBOARD_AI" as const;
export const NANO_FLOW_MESSAGE_TYPE = "PUSH_NANO_MANIFEST" as const;

export interface NanoFlowPushMessage {
  source: typeof NANO_FLOW_MESSAGE_SOURCE;
  type: typeof NANO_FLOW_MESSAGE_TYPE;
  payload: NanoFlowManifest;
}
