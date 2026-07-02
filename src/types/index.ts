// ─── Plans ──────────────────────────────────────────────────────────────────

export type Plan = "free" | "pro" | "enterprise";

// ─── AI Provider ──────────────────────────────────────────────────────────────

export type AIProvider = "openai" | "gemini" | "claude";

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
  // ─── Knowledge/topic content (from the topic library) ────────────────
  | "numerology"
  | "health"
  | "other";

// ─── AI Engine ──────────────────────────────────────────────────────────────

export interface StoryboardGenerationInput {
  story_idea: string;
  genre: Genre;
  style: StoryboardStyle;
  scene_count: number;
  /** Number of 10-second segments (Omni Flash clip = 10s) to chain into the final video. */
  segment_count?: number;
  /** Number of quick shots (beats) inside each 10s segment (3-5). */
  beats_per_segment?: number;
  /** Marketing goal/template for the script structure. */
  video_goal?: VideoGoal;
  /** Which model writes the SCRIPT (text). Images always stay on Gemini.
   * Defaults to the main provider. Switchable from the hidden admin panel. */
  script_provider?: AIProvider;
  /** Spoken-line language for every segment (ISO-ish name, e.g. "Vietnamese"). */
  dialogue_language?: string;
  /** When true, every segment MUST carry a spoken line in dialogue_language. */
  force_dialogue?: boolean;
  reference_images?: string[];
  character_descriptions?: CharacterDescription[];
  character_images?: ImageReference[];
  product_images?: ImageReference[];
  /** Named auxiliary/ingredient images (herbs, components) — referenced by name. */
  ingredient_images?: ImageReference[];
  background_images?: ImageReference[];
  /** Skip generating a character reference sheet (e.g. references already approved in the Image Studio). */
  skip_character_sheet?: boolean;
  tone?: string;
  setting?: string;
  custom_instructions?: string;
  /** Stage-1 script (written by script_provider, e.g. Claude). When present,
   * the storyboard model must expand THIS script into the JSON verbatim. */
  source_script?: string;
  // ─── Product / TVC brief (drives a product-advertising script) ───────
  product_name?: string;
  /** Key selling points / USP, free text. */
  selling_points?: string;
  target_audience?: string;
  key_message?: string;
  call_to_action?: string;
  // ─── Story / film brief (drives a narrative script) ──────────────────
  main_character?: string;
  central_conflict?: string;
  image_quality?: ImageQuality;
  aspect_ratio?: AspectRatio;
  /**
   * How many expression heads to add to each board's CHARACTER REFERENCE strip
   * (on top of the 3 identity angles). 0 = neutral identity only, let Veo act
   * the emotion from the prompt (recommended); 2-3 = include a small fixed set.
   */
  reference_expressions?: number;
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
  | "promo_sale"
  // ─── Knowledge/topic content (numerology, health, self-development) ──
  | "numerology"
  | "health";

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
  /** Hard gender lock (veoflow-aligned). Must match the uploaded photo. */
  gender?: "male" | "female";
  gender_age: string;
  build: string;
  skin_tone: string;
  hair: string;
  eyes: string;
  costume: string;
  signature_features: string;
  default_expression: string;
  render_style: string;
  /** One verbatim forensic-DNA line (with RGB hex) repeated in every keyframe. */
  dna?: string;
}

/** Scene Bible style tokens — repeated VERBATIM in every keyframe/board. */
export interface SceneBible {
  /** e.g. "100mm macro lens, f/5.6" */
  lens: string;
  /** e.g. "softbox key 4500K + strip rim light 5500K" */
  lighting: string;
  /** e.g. "seamless gradient backdrop teal #40E0D0 to #008080" */
  backdrop: string;
  /** e.g. "neutral Rec.709 grade, photoreal premium commercial" */
  color_grade: string;
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

// ─── Video Segment (10s clip unit for Omni Flash / Veo) ─────────────────────

/** Marketing role of a segment in the Hook→Problem→Solution→CTA arc. */
export type MarketingRole = "hook" | "problem" | "solution" | "body" | "cta";

/** A single action beat inside a 10s segment (3-5 per segment). */
export interface ShotBeat {
  beat: string; // short action description
  camera: string; // camera note, e.g. [CLOSE] slow push-in
}

/**
 * One ~10s segment = exactly one Omni Flash / Veo image-to-video generation.
 * Segments are chained: the start frame of N+1 continues from N's end.
 */
export interface VideoSegment {
  segment_number: number;
  duration_seconds: number; // ~10
  title: string;
  marketing_role: MarketingRole;
  beats: ShotBeat[]; // 3-5 beats within the 10s
  /** Prompt used to generate this segment's start (first) frame image. */
  first_frame_prompt: string;
  /** Image-to-video motion prompt (30-80 words) for Veo/Seedance. */
  motion_prompt: string;
  dialogue: string | null;
  /** Exact character_locks name of who speaks this segment's line (one speaker
   * per clip). Empty/undefined = voiceover or no on-screen speaker. */
  speaker?: string | null;
  /** How this segment visually connects to the previous one (seamless join). */
  continuity_note: string;
  /** Filled by the image pipeline — the generated start frame. */
  first_frame_url?: string | null;
  /** Clean single keyframe (veoflow-format first-frame) to feed Veo image-to-video. */
  keyframe_url?: string | null;
  /** Full ready-to-paste Veo prompt (ref-lock + motion + dialogue + negative). */
  full_prompt?: string;
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
  /** Style fingerprint (lens/lighting/backdrop/grade) reused VERBATIM everywhere. */
  scene_bible?: SceneBible;
  /** Verbatim forensic DNA of the hero product (with RGB hex), if any. */
  product_dna?: string;
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

// ─── Video → Storyboard (reverse-engineer a reference video) ────────────────

export interface VideoAnalysisScene {
  index: number;
  durationSec: number;
  shot: string;
  cameraMotion: string;
  action: string;
  productNote: string;
  /** English prompt to recreate a similar scene with Veo / Omni Flash. */
  generationPrompt: string;
  /** "cut" = a new shot, "continuous" = seamless continuation of the previous shot. */
  continuity: "cut" | "continuous";
  /** Spoken line during this scene, transcribed verbatim ("" if none). */
  dialogue: string;
  /** Speaking tone / emotion ("" if no speech). */
  dialogueTone: string;
  /** For continuous scenes: short English prompt to type into Veo "Extend". */
  extendPrompt: string;
}

export interface VideoAnalysisOutput {
  title: string;
  summary: string;
  product: string;
  totalScenes: number;
  scenes: VideoAnalysisScene[];
}
