import { z } from "zod";

const text = z.string().trim().min(1);
const textArray = z.array(text).default([]);

const sceneFunctionSchema = z.enum([
  "hook", "introduce_world", "introduce_character", "introduce_product", "establish_desire",
  "show_problem", "create_conflict", "escalate", "reveal", "educate", "demonstrate",
  "prove_benefit", "build_trust", "create_metaphor", "create_suspense", "deliver_punchline",
  "emotional_hit", "transform", "show_consequence", "resolve", "call_to_action", "close_loop",
  "atmosphere", "custom",
]);

const hookTypeSchema = z.enum([
  "visual_interrupt",
  "curiosity_gap",
  "inciting_event",
  "conflict",
  "emotional_recognition",
  "surprising_fact",
  "question",
  "sensory_moment",
  "product_proof",
  "transformation_preview",
  "custom",
]);

export const sceneIntentSchema = z.object({
  intent_id: text,
  state: z.enum(["inferred", "confirmed", "locked"]),
  evidence: textArray,
  confidence: z.number().min(0).max(1),
  primary_function: sceneFunctionSchema,
  secondary_functions: z.array(sceneFunctionSchema).max(3).default([]),
  hook_window: z.object({
    enabled: z.boolean(),
    duration_seconds: z.number().min(0).max(5),
    hook_type: hookTypeSchema,
    core_promise: text,
    immediate_visual_event: text,
    immediate_audio_event: text,
    dialogue_hook: text,
    payoff_link: text,
    forbidden_delays: textArray,
  }),
  narrative_objective: text,
  audience_effect: z.object({
    attention: text,
    emotion: text,
    belief: text,
    desired_action: text,
  }),
  story_change: z.object({
    state_before: text,
    trigger: text,
    state_after: text,
    information_revealed: text,
    if_removed_what_breaks: text,
  }),
  performance: z.object({
    point_of_view_character: text,
    character_objective: text,
    obstacle: text,
    tactic: text,
    stakes: text,
    subtext: text,
    emotion_start: text,
    emotion_end: text,
    performance_intensity: text,
    physical_behavior: text,
  }),
  proof: z.object({
    must_show: textArray,
    must_hear: textArray,
    must_not_distract_with: textArray,
  }),
  entry_exit: z.object({
    entry_state: text,
    exit_state: text,
    continuity_anchors: textArray,
    exit_hook: text,
  }),
  validation: z.object({
    success_criteria: textArray,
    failure_conditions: textArray,
  }),
});

const stringField = (): Record<string, string> => ({ type: "STRING" });
const stringArray = (): Record<string, unknown> => ({ type: "ARRAY", items: stringField() });
const objectOf = (properties: Record<string, unknown>): Record<string, unknown> => ({
  type: "OBJECT",
  properties,
  required: Object.keys(properties),
});

export const SCENE_INTENT_RESPONSE_SCHEMA: Record<string, unknown> = objectOf({
  intent_id: stringField(),
  state: stringField(),
  evidence: stringArray(),
  confidence: { type: "NUMBER" },
  primary_function: stringField(),
  secondary_functions: stringArray(),
  hook_window: objectOf({
    enabled: { type: "BOOLEAN" },
    duration_seconds: { type: "NUMBER" },
    hook_type: stringField(),
    core_promise: stringField(),
    immediate_visual_event: stringField(),
    immediate_audio_event: stringField(),
    dialogue_hook: stringField(),
    payoff_link: stringField(),
    forbidden_delays: stringArray(),
  }),
  narrative_objective: stringField(),
  audience_effect: objectOf({
    attention: stringField(), emotion: stringField(), belief: stringField(), desired_action: stringField(),
  }),
  story_change: objectOf({
    state_before: stringField(), trigger: stringField(), state_after: stringField(),
    information_revealed: stringField(), if_removed_what_breaks: stringField(),
  }),
  performance: objectOf({
    point_of_view_character: stringField(), character_objective: stringField(), obstacle: stringField(),
    tactic: stringField(), stakes: stringField(), subtext: stringField(), emotion_start: stringField(),
    emotion_end: stringField(), performance_intensity: stringField(), physical_behavior: stringField(),
  }),
  proof: objectOf({
    must_show: stringArray(), must_hear: stringArray(), must_not_distract_with: stringArray(),
  }),
  entry_exit: objectOf({
    entry_state: stringField(), exit_state: stringField(), continuity_anchors: stringArray(), exit_hook: stringField(),
  }),
  validation: objectOf({
    success_criteria: stringArray(), failure_conditions: stringArray(),
  }),
});
