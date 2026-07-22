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

/** A reference image declared once per project; shots reference it by `id`.
 * `image === null` means the slot is declared but the real image is attached
 * later on the extension side (e.g. a real person's / product's photo). */
export interface NanoFlowAsset {
  id: string;
  name: string;
  image: string | null;
  required?: boolean;
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

export interface NanoFlowShot {
  shot_id: string;
  index: number;
  /** Name given to the Nano Banana image, ordered (e.g. "Making Tra Bac 1"). */
  storyboard_name: string;
  duration_seconds?: number;
  marketing_role?: NanoFlowMarketingRole;

  // ─── STEP A: generate the storyboard/keyframe image with Nano Banana ───
  /** Prompt written 100% by Storyboard to create the image. */
  storyboard_prompt: string;
  image_refs?: NanoFlowRefSelector;

  // ─── STEP B: generate the video with Veo, using the STEP A image ───
  /** Full Veo prompt written 100% by Storyboard. */
  video_prompt: string;
  characters_in_scene?: string[];
  video_refs?: NanoFlowVideoRefSelector;

  dialogue?: string | null;
  voice?: string | null;
  beats?: NanoFlowBeat[];
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
