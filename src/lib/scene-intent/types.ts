export type IntentResolutionState = "inferred" | "confirmed" | "locked";

export type SceneFunction =
  | "hook"
  | "introduce_world"
  | "introduce_character"
  | "introduce_product"
  | "establish_desire"
  | "show_problem"
  | "create_conflict"
  | "escalate"
  | "reveal"
  | "educate"
  | "demonstrate"
  | "prove_benefit"
  | "build_trust"
  | "create_metaphor"
  | "create_suspense"
  | "deliver_punchline"
  | "emotional_hit"
  | "transform"
  | "show_consequence"
  | "resolve"
  | "call_to_action"
  | "close_loop"
  | "atmosphere"
  | "custom";

export interface SceneAudienceEffect {
  attention: string;
  emotion: string;
  belief: string;
  desired_action: string;
}

export interface SceneStoryChange {
  state_before: string;
  trigger: string;
  state_after: string;
  information_revealed: string;
  if_removed_what_breaks: string;
}

export interface ScenePerformanceIntent {
  point_of_view_character: string;
  character_objective: string;
  obstacle: string;
  tactic: string;
  stakes: string;
  subtext: string;
  emotion_start: string;
  emotion_end: string;
  performance_intensity: string;
  physical_behavior: string;
}

export interface SceneProofRequirements {
  must_show: string[];
  must_hear: string[];
  must_not_distract_with: string[];
}

export interface SceneEntryExitIntent {
  entry_state: string;
  exit_state: string;
  continuity_anchors: string[];
  exit_hook: string;
}

export interface SceneIntentValidation {
  success_criteria: string[];
  failure_conditions: string[];
}

export type HookType =
  | "visual_interrupt"
  | "curiosity_gap"
  | "inciting_event"
  | "conflict"
  | "emotional_recognition"
  | "surprising_fact"
  | "question"
  | "sensory_moment"
  | "product_proof"
  | "transformation_preview"
  | "custom";

export interface HookWindowIR {
  enabled: boolean;
  duration_seconds: number;
  hook_type: HookType;
  core_promise: string;
  immediate_visual_event: string;
  immediate_audio_event: string;
  dialogue_hook: string;
  payoff_link: string;
  forbidden_delays: string[];
}

/**
 * Per-clip creative contract. It states WHY the clip exists and WHAT must
 * change; action/camera/audio compilers decide HOW to prove it.
 */
export interface SceneIntentIR {
  intent_id: string;
  state: IntentResolutionState;
  evidence: string[];
  confidence: number;
  primary_function: SceneFunction;
  secondary_functions: SceneFunction[];
  /** Clip 1: mandatory 3-5s. Later clips: enabled=false, duration=0. */
  hook_window: HookWindowIR;
  narrative_objective: string;
  audience_effect: SceneAudienceEffect;
  story_change: SceneStoryChange;
  performance: ScenePerformanceIntent;
  proof: SceneProofRequirements;
  entry_exit: SceneEntryExitIntent;
  validation: SceneIntentValidation;
}
