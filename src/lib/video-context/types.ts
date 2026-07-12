/**
 * Canonical 10-layer context IR.
 *
 * These types describe WHAT must be resolved for a video project. They never
 * prescribe a country, room, visual style, story formula, or environment
 * archetype. Concrete values only appear after the script/brief is analysed.
 */

import type { RealityProfile } from "@/lib/reality/types";

export type ContextResolutionState = "open" | "resolved" | "locked";

export interface ContextProjectIntentLayer {
  purpose: string;
  audience: string;
  platform: string;
  duration_seconds: number;
  aspect_ratio: string;
  success_criteria: string[];
}

export interface ContextWorldLayer {
  world_type: string;
  reality_level: string;
  genre: string;
  geography: string;
  culture: string;
  time_period: string;
  technology_level: string;
  social_class: string;
  physics_mode: string;
  intentional_exceptions: string[];
}

export interface ContextOntologyLayer {
  allowed_entities: string[];
  forbidden_entities: string[];
  visible_text_policy: string;
  symbolism_policy: string;
  exception_rules: string[];
}

export interface ContextTemporalLayer {
  timeline_mode: string;
  story_time_span: string;
  time_of_day: string;
  season_weather: string;
  transition_rules: string[];
}

export interface ContextLocationDefinition {
  /** Project-local semantic id, never a library/archetype id. */
  id: string;
  narrative_function: string;
  description: string;
  culture_geography_fit: string;
  spatial_anchors: string[];
  fixed_elements: string[];
  lighting_motivation: string;
  sound_bed: string;
}

export interface ContextEnvironmentLayer {
  /** single_location | multi_location | adaptive_by_scene | another script-led strategy */
  strategy: string;
  primary_category: string;
  locations: ContextLocationDefinition[];
  selection_rule: string;
}

export interface ContextCharacterLayer {
  cast_ids: string[];
  identity_rules: string[];
  behavior_rules: string[];
  relationship_rules: string[];
}

export interface ContextObjectPropLayer {
  hero_prop_ids: string[];
  state_tracking_rules: string[];
  material_rules: string[];
}

export interface ContextMotionContinuityLayer {
  physics_mode: string;
  /** strict | soft | montage | match_cut | symbolic | scene_cut | project-specific */
  continuity_mode: string;
  action_budget: string;
  allowed_transition_modes: string[];
  rules: string[];
}

export interface ContextVisualLanguageLayer {
  style_mode: string;
  camera_grammar: string[];
  lighting_grammar: string[];
  color_grammar: string[];
  vfx_rules: string[];
  text_overlay_policy: string;
}

export interface ContextAudioValidationLayer {
  dialogue_mode: string;
  language: string;
  voice_strategy: string;
  ambience_strategy: string;
  music_strategy: string;
  validation_priorities: string[];
}

export interface VideoContextLayers {
  project_intent: ContextProjectIntentLayer;
  world_context: ContextWorldLayer;
  ontology: ContextOntologyLayer;
  temporal: ContextTemporalLayer;
  environment: ContextEnvironmentLayer;
  character: ContextCharacterLayer;
  object_prop: ContextObjectPropLayer;
  motion_continuity: ContextMotionContinuityLayer;
  visual_language: ContextVisualLanguageLayer;
  audio_validation: ContextAudioValidationLayer;
}

export interface ResolvedVideoContext {
  version: "2.0";
  state: Exclude<ContextResolutionState, "open">;
  analysis_summary: string;
  confidence: number;
  assumptions: string[];
  evidence: string[];
  /** Cross-cutting simulation depth; it tunes all 10 layers without becoming layer 11. */
  reality_profile: RealityProfile;
  layers: VideoContextLayers;
}
