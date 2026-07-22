import type { ResolvedVideoContext } from "@/lib/video-context/types";
import type { SceneIntentIR } from "@/lib/scene-intent/types";
import type { CookingRecipeIR, CookingStyle } from "@/lib/cooking/types";

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
  // ─── Film / story genres (Context-Locked DNA expansion) ──────────────
  | "fantasy"
  | "historical" // cổ trang / period piece
  | "mythology" // thần thoại
  | "sitcom"
  | "mockumentary"
  | "music_video"
  | "kids"
  // ─── Advertising / marketing genres (for TVC & product ads) ─────────
  | "advertising"
  | "product_demo"
  | "brand_film"
  | "promo"
  | "unboxing"
  | "luxury" // luxury brand film
  // ─── Knowledge/topic content (from the topic library) ────────────────
  | "numerology"
  | "health"
  | "psychology" // tâm lý
  | "life_wisdom" // ngụ ngôn / đạo lý / đạo làm người
  | "education" // giáo dục
  | "finance"
  | "tech"
  // ─── Lifestyle / demonstration content ───────────────────────────────
  | "cooking"
  | "fitness"
  | "lifestyle"
  | "travel"
  | "nature" // thiên nhiên / natural history
  | "sports"
  | "other";

// ─── AI Engine ──────────────────────────────────────────────────────────────

/** How characters render on every board/keyframe.
 * - "auto": photoreal when the style is photographic (default behaviour);
 * - "photo": HARD photoreal lock — the real face from the reference photo,
 *   never a cartoon/illustration, even if the visual style says otherwise;
 * - "stylized": cartoon/art render by the chosen style — the reference photo
 *   guides the look only, the real-face lock is off. */
export type CharacterRenderMode = "auto" | "photo" | "stylized";

/** The audience outcome is independent from the topic and visual treatment. */
export type AudienceGoal =
  | "attention"
  | "retention"
  | "empathy"
  | "explain"
  | "reflection"
  | "trust"
  | "engagement"
  | "action";

/** Narrative container. This never decides the subject matter by itself. */
export type StoryFormat =
  | "auto"
  | "short_insight"
  | "micro_story"
  | "explainer"
  | "parable"
  | "observational"
  | "visual_poem"
  | "episodic";

/** How an idea is translated into visible events. */
export type VisualInterpretation =
  | "auto"
  | "literal"
  | "symbolic_metaphor"
  | "nature_analogy"
  | "parable_fable";

/** Character medium, kept separate from camera/style and the content topic. */
export type CharacterRepresentation =
  | "auto"
  | "uploaded_photoreal"
  | "generated_human"
  | "stick_figure"
  | "illustrated_2d"
  | "stylized_3d"
  | "anthropomorphic_animal"
  | "anthropomorphic_object"
  | "none";

/** Directing grammar. It describes how the camera observes the world. */
export type DirectingProfileId =
  | "auto"
  | "everyday_naturalism"
  | "observational_documentary"
  | "natural_history"
  | "poetic_nature"
  | "psychological_metaphor"
  | "anthropomorphic_fable"
  | "creator_ugc"
  | "cinematic_drama"
  | "premium_commercial"
  | "explainer_clarity";

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
  /** Ordered creative-routing axes. Optional so every legacy payload remains valid. */
  audience_goal?: AudienceGoal;
  story_format?: StoryFormat;
  visual_interpretation?: VisualInterpretation;
  character_representation?: CharacterRepresentation;
  directing_profile?: DirectingProfileId;
  /** Which model writes the SCRIPT (text). Images always stay on Gemini.
   * Defaults to the main provider. Switchable from the hidden admin panel. */
  script_provider?: AIProvider;
  /** Numerology (and topic) script tone: emotional/inspiring, sharp behavioral
   * analysis, or both blended. Defaults to "balanced". */
  numerology_style?: "inspirational" | "analytical" | "balanced";
  /** Numerology hook mode. "situation" (default): the hook is a real-life
   * situation with NO numbers — the number is revealed at beat 3 as the
   * explanation (reaches cold viewers). "number_callout": legacy hook that
   * names the number in line 1 (retargeting followers). */
  numerology_hook_mode?: "situation" | "number_callout";
  /** Cooking-only canonical data. It MUST be ignored unless genre === cooking. */
  cooking_recipe?: CookingRecipeIR;
  /** Cooking-only directing profile. It MUST be ignored unless genre === cooking. */
  cooking_style?: CookingStyle;
  /** Spoken-line language for every segment (ISO-ish name, e.g. "Vietnamese"). */
  dialogue_language?: string;
  /** When true, every segment MUST carry a spoken line in dialogue_language. */
  force_dialogue?: boolean;
  reference_images?: string[];
  character_descriptions?: CharacterDescription[];
  character_images?: ImageReference[];
  product_images?: ImageReference[];
  /** Legacy shared upload field, routed strictly by genre: cooking => food
   * ingredients; every other genre => named auxiliary objects/components.
   * Non-cooking references must never be interpreted as food ingredients. */
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
  /**
   * Internal Stage-1.5 output: the neutral 10-layer context resolved from the
   * brief + approved script. Storyboard generation consumes this canonical IR
   * instead of independently re-inventing its own world for every field.
   */
  resolved_context?: ResolvedVideoContext;
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
  /** Character render mode for all generated images (see CharacterRenderMode). */
  character_render?: CharacterRenderMode;
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
  | "health"
  | "psychology"
  // ─── Documentary / factual ────────────────────────────────────────────
  | "documentary_story"
  // ─── Demonstration content (recipe / workout) ────────────────────────
  | "cooking"
  | "fitness";

/**
 * TẦNG 0 — LOCKED WORLD CONTEXT (Context-Locked Video DNA System).
 * "Open during design. Locked during generation." — before the video is
 * finalised the rules stay abstract; once the LLM locks this context from the
 * brief, EVERY entity in every scene (objects, architecture, clothing,
 * technology, language, food, behavior, sound, motifs) must belong to it.
 * Anything outside is an ontology violation unless listed as an intentional
 * exception (contrast / memory / dream / parody / product metaphor).
 */
export interface WorldContext {
  /** realistic / cinematic realistic / stylized / fantasy / sci-fi / historical / mythological / surreal / commercial / documentary / animation / hybrid */
  world_type: string;
  /** One of the 6 reality levels: documentary / cinematic / commercial / stylized / symbolic-surreal / fantasy-scifi-internal */
  reality_level: string;
  genre: string;
  /** Where this world lives (country/region/imaginary place). */
  geography: string;
  /** The culture that governs objects, food, behavior, text, rituals. */
  culture: string;
  /** Locked era: ancient / medieval / a specific decade / contemporary / near-future / far-future / timeless-mythic. */
  time_period: string;
  /** none / hand-craft / industrial / modern / near-future / far-future / magical. */
  technology_level: string;
  /** Social class / economic layer that props, home and wardrobe must match. */
  social_class: string;
  /** Locked environment category (home / office / street / forest / spaceship / temple ...). */
  environment_category: string;
  visual_style: string;
  audio_style: string;
  /** What text/scripts may appear on signs/labels ("Vietnamese only", "none/blurred"...). */
  allowed_language_text?: string;
  /** Entities FORBIDDEN in this world unless explicitly justified (wrong-era tech, foreign signage, off-culture props...). */
  forbidden_entities?: string[];
  /** Declared exceptions: intentional contrast, memory, dream, parody, product metaphor, narrative disruption. */
  intentional_exceptions?: string[];
}

export interface CharacterDescription {
  name: string;
  appearance: string;
  personality: string;
  role: string;
  /** True when this character is a child (đứa trẻ) — locked age bracket. */
  is_child?: boolean;
  /** User-entered real height. Kept structured so relative scale is stable. */
  height_cm?: number;
  /** User-selected silhouette; independent from face-image analysis. */
  body_type?: "slim" | "standard" | "stocky";
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
  /** True when this character is a child — age bracket locked, never adult. */
  is_child?: boolean;
  gender_age: string;
  build: string;
  skin_tone: string;
  /** Stable facial topology: forehead/temples/cheekbones/jaw/chin + asymmetry. */
  face_structure?: string;
  /** Forensic skin realism (pores, subsurface, no plastic/CGI) — anti-fake-face. */
  skin_texture?: string;
  /** Exact eye shape + iris colour + real catchlights. */
  eye_details?: string;
  /** Individual brow hairs, growth direction, density gradient and asymmetry. */
  eyebrow_details?: string;
  /** Individual upper/lower lashes, spacing, curvature and natural clumping. */
  eyelash_details?: string;
  /** Nose/cartilage/nostrils plus lip texture, hydration and visible teeth. */
  nose_lips_details?: string;
  hair: string;
  /** Hairline, parting, roots, density, strand texture, baby hairs/flyaways. */
  hair_details?: string;
  eyes: string;
  costume: string;
  /** Real materials of the outfit/props (leather grain, denim weave, worn metal). */
  wardrobe_materials?: string;
  signature_features: string;
  default_expression: string;
  render_style: string;
  /** One verbatim forensic-DNA line (with RGB hex) repeated in every keyframe. */
  dna?: string;
  /** TẦNG 9 (audio law): FULL locked voice profile, identical in every clip —
   * defaults to native Standard Northern Vietnamese (Hanoi), then locks timbre,
   * natural F0 range, rate, prosody and emotion, e.g. "native Standard Northern
   * Vietnamese (Hanoi), warm grounded male timbre, natural F0 95-130 Hz with
   * small human variation, ~110 wpm, calm-sincere". */
  voice?: string;
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
  /** Filmic realism fingerprint kept constant every clip, e.g. "clean digital
   * acquisition, minimal chromatic aberration, fine organic film grain". */
  film_grain?: string;
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
 * One spoken turn inside a 10s clip (TẦNG 9 turn-taking). Multiple lines let a
 * short back-and-forth (Chồng → Vợ → Con) fit in ONE clip instead of wasting a
 * whole clip per short line — as long as they DON'T overlap and fit the seconds.
 */
export interface DialogueTurn {
  /** Exact character_locks name of who speaks this turn. "" = voiceover. */
  speaker: string;
  /** The spoken line (verbatim, in the dialogue language). */
  text: string;
  /** When this turn starts within the clip (seconds, 0-10). */
  start_s?: number;
  /** When this turn ends within the clip (seconds, 0-10). */
  end_s?: number;
}

/**
 * Compact physical map for a clip. It separates static scene geometry from
 * action so doors, thresholds, railings, paths, people, and the camera cannot
 * be placed in mutually impossible positions.
 */
export interface SpatialLayout {
  /** Ordered connected zones, from one side of the scene to the other. */
  zone_order: string;
  /** Walls/openings/perimeter barriers and the locations they may not leave. */
  fixed_architecture: string;
  /** Exact zone + anchor distance + facing for every visible character. */
  character_placement: string;
  /** The connected floor route that must remain physically unobstructed. */
  walkable_path: string;
  /** A real supported camera position and valid line of sight. */
  camera_zone: string;
  /** Optional kinematic law for moving architecture such as a revolving door. */
  mechanism_motion?: string;
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
  /** Detailed per-clip creative contract: why it exists and what must change. */
  scene_intent?: SceneIntentIR;
  beats: ShotBeat[]; // 3-5 beats within the 10s
  /** Prompt used to generate this segment's start (first) frame image. */
  first_frame_prompt: string;
  /** Untimed ordered image-to-video action; dialogue_lines owns all timecodes. */
  motion_prompt: string;
  dialogue: string | null;
  /** Exact character_locks name of who speaks this segment's line (used for the
   * single-line case, and as the first turn of a multi-turn clip). Empty/
   * undefined = voiceover or no on-screen speaker. */
  speaker?: string | null;
  /**
   * TẦNG 9 turn-taking: up to 3 SEQUENTIAL (non-overlapping) spoken turns that
   * fit inside this 10s clip, so a short exchange isn't wasted across clips.
   * When present with 2+ entries, this is the source of truth for dialogue;
   * `dialogue`/`speaker` mirror the first turn for backward compatibility.
   */
  dialogue_lines?: DialogueTurn[];
  /** Environment archetype id from src/lib/environment (or "custom"). Locks
   * this segment's world to a physically-grounded spec (materials, Kelvin+Lux
   * light, atmosphere) so the setting renders real, not CGI. */
  environment_ref?: string | null;
  /** Spatial topology contract. Required by the prompt for multi-zone,
   * doorway, balcony, stair, edge, barrier, or counter-divider scenes; older
   * projects are repaired deterministically by the prompt compiler. */
  spatial_layout?: SpatialLayout;
  /** EXACT character_locks names of everyone VISIBLE in this segment. Drives
   * which reference photos are attached and who may appear on screen — the
   * cast-sync mechanism for multi-character scenes. */
  characters_in_scene?: string[];
  /** MOTIVATED WARDROBE CHANGE: when a story action physically changes a
   * character's look (shower → home clothes, getting dressed, soaked by rain),
   * this lists the character's CURRENT outfit/hair for THIS segment — it
   * overrides the base character_lock costume in every prompt built for the
   * segment. Declared on the first changed segment and every one after. */
  wardrobe_state?: {
    character: string;
    outfit: string;
    outfit_materials?: string;
    hair?: string;
  }[];
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

/** Ready-to-post platform captions generated WITH the video (same story, same
 * hook), each tuned to its platform's culture + SEO hashtag conventions. */
export interface SocialPosts {
  /** TikTok: 1-2 punchy lines + emoji, comment-bait, 4-6 SEO hashtags. */
  tiktok: { caption: string; hashtags: string[] };
  /** YouTube Shorts: clickable title + 1-2 line description, #Shorts included. */
  youtube_shorts: { title: string; description: string; hashtags: string[] };
  /** Facebook Reels: warm, shareable caption (can be slightly longer), 3-5 hashtags. */
  facebook_reel: { caption: string; hashtags: string[] };
}

export interface StoryboardGenerationOutput {
  title: string;
  synopsis: string;
  total_duration_seconds: number;
  mood_tags: string[];
  /** TẦNG 0 — the LOCKED world context every scene must obey (Context-Locked DNA). */
  world_context?: WorldContext;
  /** Canonical 10-layer project context. Derived once, never regenerated per clip. */
  context_ir?: ResolvedVideoContext;
  /** Platform-native captions + SEO hashtags for TikTok / YT Shorts / FB Reels. */
  social_posts?: SocialPosts;
  /** 2-6 word UPPERCASE smash-hook printed HUGE on the 9:16 thumbnail
   * (e.g. "MẤT WIFI = MẤT VỢ?!"). Written with the script, in dialogue language. */
  thumbnail_title?: string;
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
