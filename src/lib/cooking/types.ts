export type CookingStyle =
  | "nature_asmr"
  | "kitchen_asmr"
  | "fast_cut"
  | "cinematic_food"
  | "pov_hands";

export interface CookingIngredientIR {
  /** Stable id used by steps and mise-en-place groups. */
  id: string;
  /** Ingredient name in the user's working language. */
  name: string;
  /** Exact quantity as read from the source. Empty means genuinely unspecified. */
  amount: string;
  /** Exact unit as read from the source. Empty means genuinely unspecified. */
  unit: string;
  /** Preparation/state before cooking, e.g. diced, frozen, divided. */
  preparation: string;
  /** main | sauce | seasoning | garnish | other */
  group: string;
  /** Original source fragment retained for audit/review. */
  source_text: string;
}

export interface CookingMiseEnPlaceIR {
  order: number;
  vessel: string;
  ingredient_ids: string[];
  staging_note: string;
}

export interface CookingStepIR {
  order: number;
  title: string;
  action: string;
  ingredient_ids: string[];
  tools: string[];
  heat: string;
  duration: string;
  visible_end_state: string;
  asmr_cues: string[];
}

/**
 * Canonical cooking data. This is extracted once from pasted text/book images,
 * reviewed by the user, then compiled into prompts. It is not a storyboard.
 */
export interface CookingRecipeIR {
  version: "1.0";
  dish_name: string;
  servings: string;
  source_language: string;
  ingredients: CookingIngredientIR[];
  equipment: string[];
  mise_en_place: CookingMiseEnPlaceIR[];
  steps: CookingStepIR[];
  plating: string;
  serving_temperature: string;
  hero_visual: string;
  uncertainties: string[];
  confidence: number;
}

export interface CookingRecipeAnalysisInput {
  text: string;
  /** JPEG base64 only; the browser strips the data-URI prefix. */
  images?: string[];
}

export type CookingSceneFunction =
  | "hook"
  | "mise_en_place"
  | "prep"
  | "cook"
  | "transform"
  | "plating";

export interface CompactCookingBeat {
  action: string;
  camera: string;
}

export interface CompactCookingScene {
  segment_number: number;
  function: CookingSceneFunction;
  title: string;
  recipe_step_orders: number[];
  visible_ingredient_ids: string[];
  start_frame: string;
  action_timeline: string;
  end_state: string;
  beats: CompactCookingBeat[];
  asmr_cues: string[];
  continuity_note: string;
}

/** Small model-owned plan. Libraries/compiler own all repeated production law. */
export interface CompactCookingScenePlan {
  version: "1.0";
  title: string;
  synopsis: string;
  segments: CompactCookingScene[];
}
