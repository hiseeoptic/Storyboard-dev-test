// ─── Plans ──────────────────────────────────────────────────────────────────

export type Plan = "free" | "pro" | "enterprise";

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
  | "other";

// ─── AI Engine ──────────────────────────────────────────────────────────────

export interface StoryboardGenerationInput {
  story_idea: string;
  genre: Genre;
  style: StoryboardStyle;
  scene_count: number;
  reference_images?: string[];
  character_descriptions?: CharacterDescription[];
  character_images?: ImageReference[];
  product_images?: ImageReference[];
  background_images?: ImageReference[];
  tone?: string;
  setting?: string;
  custom_instructions?: string;
}

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

export interface SceneBreakdown {
  scene_number: number;
  title: string;
  description: string;
  visual_prompt: string;
  dialogue: string | null;
  action_notes: string | null;
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

export interface StoryboardGenerationOutput {
  title: string;
  synopsis: string;
  scenes: SceneBreakdown[];
  timeline: TimelineEntry[];
  style_guide: StyleGuide;
}

export interface TimelineEntry {
  scene_number: number;
  start_time: number;
  end_time: number;
  description: string;
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
