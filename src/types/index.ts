// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  credits_remaining: number;
  created_at: string;
  updated_at: string;
}

export type Plan = "free" | "pro" | "enterprise";

// ─── Project ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  genre: Genre;
  status: ProjectStatus;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

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

export type ProjectStatus = "draft" | "in_progress" | "completed" | "archived";

// ─── Storyboard ──────────────────────────────────────────────────────────────

export interface Storyboard {
  id: string;
  project_id: string;
  title: string;
  style: StoryboardStyle;
  scene_count: number;
  status: StoryboardStatus;
  created_at: string;
  updated_at: string;
}

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

export type StoryboardStatus =
  | "idle"
  | "generating"
  | "completed"
  | "failed"
  | "partial";

// ─── Scene ───────────────────────────────────────────────────────────────────

export interface Scene {
  id: string;
  storyboard_id: string;
  order_index: number;
  title: string;
  prompt: string;
  visual_prompt: string;
  description: string;
  dialogue: string | null;
  action_notes: string | null;
  camera_angle: CameraAngle;
  shot_type: ShotType;
  mood: string | null;
  lighting: string | null;
  location: string | null;
  characters: string[];
  image_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  transition: SceneTransition;
  generation_status: GenerationStatus;
  retry_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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

export type GenerationStatus =
  | "pending"
  | "generating"
  | "completed"
  | "failed"
  | "retrying";

// ─── AI Engine ───────────────────────────────────────────────────────────────

export interface StoryboardGenerationInput {
  story_idea: string;
  genre: Genre;
  style: StoryboardStyle;
  scene_count: number;
  reference_images?: string[];
  character_descriptions?: CharacterDescription[];
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

// ─── Image Pipeline ──────────────────────────────────────────────────────────

export interface ImageGenerationJob {
  id: string;
  scene_id: string;
  storyboard_id: string;
  prompt: string;
  style: StoryboardStyle;
  status: GenerationStatus;
  progress: number;
  image_url: string | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
}

export interface GenerationProgress {
  storyboard_id: string;
  total_scenes: number;
  completed: number;
  failed: number;
  in_progress: number;
  pending: number;
  percent: number;
  current_scene: number | null;
  status: StoryboardStatus;
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface UsageRecord {
  id: string;
  user_id: string;
  action: UsageAction;
  credits_used: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type UsageAction =
  | "scene_generation"
  | "scene_regeneration"
  | "scene_edit"
  | "storyboard_export"
  | "batch_generation";

export interface PlanLimits {
  max_projects: number;
  max_scenes_per_storyboard: number;
  credits_per_month: number;
  image_resolution: "1024x1024" | "1792x1024";
  max_concurrent_generations: number;
  export_formats: string[];
  features: string[];
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    max_projects: 3,
    max_scenes_per_storyboard: 8,
    credits_per_month: 20,
    image_resolution: "1024x1024",
    max_concurrent_generations: 1,
    export_formats: ["pdf"],
    features: ["Basic AI generation", "PDF export"],
  },
  pro: {
    max_projects: 50,
    max_scenes_per_storyboard: 50,
    credits_per_month: 500,
    image_resolution: "1792x1024",
    max_concurrent_generations: 3,
    export_formats: ["pdf", "pptx", "mp4"],
    features: [
      "Advanced AI generation",
      "All export formats",
      "Character consistency",
      "Priority generation",
      "Custom styles",
    ],
  },
  enterprise: {
    max_projects: -1,
    max_scenes_per_storyboard: -1,
    credits_per_month: -1,
    image_resolution: "1792x1024",
    max_concurrent_generations: 10,
    export_formats: ["pdf", "pptx", "mp4", "fcpxml", "edl"],
    features: [
      "Unlimited everything",
      "Team collaboration",
      "API access",
      "Custom models",
      "White-label",
      "Dedicated support",
    ],
  },
};

// ─── Server Action Results ───────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
