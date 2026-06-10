// ─── Plans ──────────────────────────────────────────────────────────────────

export type Plan = "free" | "pro" | "enterprise";

// ─── AI Provider ──────────────────────────────────────────────────────────────

export type AIProvider = "openai" | "gemini";

/** Image quality tier — maps to different image models / cost. */
export type ImageQuality = "standard" | "pro";

/** Output aspect ratio for generated storyboard images. */
export type AspectRatio = "16:9" | "9:16";

// ─── Storyboard ─────────────────────────────────────────────────────────────

export type StoryboardStyle =
  | "realistic"
  | "anime"
  | "comic"
  | "watercolor"
  | "pencil_sketch"
  | "noir"
  | "cinematic"
  | "3d_render"
  | "pixel_art"
  // ─── Marketing-oriented looks ──────────────────────────────────────
  | "commercial"
  | "ugc"
  | "product_showcase"
  | "corporate_clean"
  | "custom";

// ─── Scene ──────────────────────────────────────────────────────────────────

export type CameraAngle =
  | "eye_level"
  | "low_angle"
  | "high_angle"
  | "birds_eye"
  | "dutch_angle"
  | "over_the_shoulder"
  | "pov"
  | "worms_eye";

export type ShotType =
  | "extreme_wide"
  | "wide"
  | "medium_wide"
  | "medium"
  | "medium_close_up"
  | "close_up"
  | "extreme_close_up"
  | "establishing"
  | "two_shot"
  | "insert"
  | "aerial";

export type SceneTransition =
  | "cut"
  | "fade"
  | "dissolve"
  | "wipe"
  | "zoom"
  | "match_cut"
  | "smash_cut";

export type Genre =
  | "action"
  | "comedy"
  | "drama"
  | "horror"
  | "romance"
  | "sci-fi"
  | "thriller"
  | "animation"
  | "documentary"
  // ─── Advertising / marketing genres (for TVC & product ads) ─────────
  | "advertising"
  | "product_demo"
  | "brand_film"
  | "promo"
  | "unboxing"
  | "other";

// ─── AI Engine ──────────────────────────────────────────────────────────────

export interface StoryboardGenerationInput {
  story_idea: string;
  genre: Genre;
  style: StoryboardStyle;
  scene_count: number;
  /** Number of 8-second segments to chain into the final video. */
  segment_count?: number;
  /** Number of quick shots (beats) inside each 8s segment (3-5). */
  beats_per_segment?: number;
  /** Marketing goal/template for the script structure. */
  video_goal?: VideoGoal;
  /** Spoken-line language for every segment (ISO-ish name, e.g. "Vietnamese"). */
  dialogue_language?: string;
  /** When true, every segment MUST carry a spoken line in dialogue_language. */
  force_dialogue?: boolean;
  reference_images?: string[];
  character_descriptions?: CharacterDescription[];
  character_images?: ImageReference[];
  product_images?: ImageReference[];
  background_images?: ImageReference[];
  tone?: string;
  setting?: string;
  custom_instructions?: string;
  // ─── Product / TVC brief (drives a product-advertising script) ───────
  product_name?: string;
  /** Key selling points / USP, free text. */
  selling_points?: string;
  target_audience?: string;
  key_message?: string;
  call_to_action?: string;
  image_quality?: ImageQuality;
  aspect_ratio?: AspectRatio;
}

/** Marketing video template that drives the script structure. */
export type VideoGoal =
  | "marketing_general"
  | "product_ad"
  | "storytelling"
  | "review"
  | "educational"
  // ─── Extra marketing templates ─────────────────────────────────────
  | "brand_story"
  | "social_short"
  | "testimonial"
  | "promo_sale";

export interface CharacterDescription {
  name: string;
  appearance: string;
  personality: string;
  role: string;
}

export interface ImageReference {
  name: string;
  description?: string;
  images: string[]; // base64 encoded images
}

// ─── Character Lock ─────────────────────────────────────────────────────────

export interface CharacterLock {
  name: string;
  gender_age: string;
  build: string;
  skin_tone: string;
  hair: string;
  eyes: string;
  costume: string;
  signature_features: string;
  default_expression: string;
  render_style: string;
}

// ─── Scene Breakdown (legacy single-frame type) ─────────────────────────────

export interface SceneBreakdown {
  scene_number: number;
  title: string;
  description: string;
  visual_prompt: string;
  dialogue: string | null;
  action_notes: string | null;
  camera_code: string;
  camera_movement: string;
  camera_angle: CameraAngle;
  shot_type: ShotType;
  mood: string;
  lighting: string;
  location: string;
  characters: string[];
  duration_seconds: number;
  transition: SceneTransition;
  continuity_notes: string;
}

// ─── Video Segment (8s clip unit for Veo/Seedance) ──────────────────────────

/** Marketing role of a segment in the Hook→Problem→Solution→CTA arc. */
export type MarketingRole = "hook" | "problem" | "solution" | "body" | "cta";

/** A single action beat inside an 8s segment (3-5 per segment). */
export interface ShotBeat {
  beat: string; // short action description
  camera: string; // camera note, e.g. [CLOSE] slow push-in
}

/**
 * One ~8s segment = exactly one Veo/Seedance image-to-video generation.
 * Segments are chained: the start frame of N+1 continues from N's end.
 */
export interface VideoSegment {
  segment_number: number;
  duration_seconds: number; // ~8
  title: string;
  marketing_role: MarketingRole;
  beats: ShotBeat[]; // 3-5 beats within the 8s
  /** Prompt used to generate this segment's start (first) frame image. */
  first_frame_prompt: string;
  /** Image-to-video motion prompt (30-80 words) for Veo/Seedance. */
  motion_prompt: string;
  dialogue: string | null;
  /** How this segment visually connects to the previous one (seamless join). */
  continuity_note: string;
  /** Filled by the image pipeline — the generated start frame. */
  first_frame_url?: string | null;
}

export interface MarketingStructure {
  hook: string;
  problem: string;
  solution: string;
  cta: string;
}

export interface StoryboardGenerationOutput {
  title: string;
  synopsis: string;
  total_duration_seconds: number;
  mood_tags: string[];
  marketing_structure: MarketingStructure;
  character_locks: CharacterLock[];
  segments: VideoSegment[];
  style_guide: StyleGuide;
}

export interface StyleGuide {
  color_palette: string[];
  art_direction: string;
  visual_references: string;
  consistency_notes: string;
}

// ─── Image Pipeline ─────────────────────────────────────────────────────────

export interface PlanLimits {
  max_scenes_per_storyboard: number;
  image_resolution: "1024x1024" | "1792x1024";
  export_formats: string[];
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    max_scenes_per_storyboard: 8,
    image_resolution: "1024x1024",
    export_formats: ["pdf"],
  },
  pro: {
    max_scenes_per_storyboard: 50,
    image_resolution: "1792x1024",
    export_formats: ["pdf", "zip"],
  },
  enterprise: {
    max_scenes_per_storyboard: 100,
    image_resolution: "1792x1024",
    export_formats: ["pdf", "zip"],
  },
};

// ─── Server Action Results ──────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
