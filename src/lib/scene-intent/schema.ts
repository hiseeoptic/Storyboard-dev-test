import { z } from "zod";

const text = z.string().trim().min(1);
const textArray = z.array(text).default([]);

const SCENE_FUNCTIONS = [
  "hook", "introduce_world", "introduce_character", "introduce_product", "establish_desire",
  "show_problem", "create_conflict", "escalate", "reveal", "educate", "demonstrate",
  "prove_benefit", "build_trust", "create_metaphor", "create_suspense", "deliver_punchline",
  "emotional_hit", "transform", "show_consequence", "resolve", "call_to_action", "close_loop",
  "atmosphere", "custom",
] as const;
type SceneFunctionValue = (typeof SCENE_FUNCTIONS)[number];

// RESILIENCE LAYER: the LLM regularly invents plausible near-miss function
// names ("create_curiosity_gap" killed a whole 3-attempt generation in
// production). Coerce instead of failing: normalise → map known synonyms →
// anything still unknown becomes "custom" (the enum's designed escape hatch).
const FUNCTION_SYNONYMS: Record<string, SceneFunctionValue> = {
  create_curiosity_gap: "create_suspense",
  curiosity_gap: "create_suspense",
  curiosity: "create_suspense",
  open_loop: "create_suspense",
  build_tension: "create_suspense",
  tension: "create_suspense",
  suspense: "create_suspense",
  intrigue: "create_suspense",
  introduce_setting: "introduce_world",
  establish_world: "introduce_world",
  establish_setting: "introduce_world",
  world_building: "introduce_world",
  establish_character: "introduce_character",
  character_introduction: "introduce_character",
  introduce_hero: "introduce_character",
  present_product: "introduce_product",
  show_product: "introduce_product",
  present_problem: "show_problem",
  problem: "show_problem",
  pain_point: "show_problem",
  agitate_problem: "show_problem",
  conflict: "create_conflict",
  raise_stakes: "escalate",
  escalation: "escalate",
  intensify: "escalate",
  twist: "reveal",
  revelation: "reveal",
  reveal_truth: "reveal",
  teach: "educate",
  explain: "educate",
  inform: "educate",
  demonstration: "demonstrate",
  show_how: "demonstrate",
  show_benefit: "prove_benefit",
  benefit: "prove_benefit",
  prove_value: "prove_benefit",
  social_proof: "build_trust",
  trust: "build_trust",
  credibility: "build_trust",
  metaphor: "create_metaphor",
  symbolism: "create_metaphor",
  symbolic: "create_metaphor",
  punchline: "deliver_punchline",
  comedy_payoff: "deliver_punchline",
  humor: "deliver_punchline",
  joke: "deliver_punchline",
  emotional_peak: "emotional_hit",
  emotional_payoff: "emotional_hit",
  emotional_climax: "emotional_hit",
  payoff: "emotional_hit",
  transformation: "transform",
  show_transformation: "transform",
  consequence: "show_consequence",
  aftermath: "show_consequence",
  resolution: "resolve",
  conclude: "resolve",
  cta: "call_to_action",
  loop: "close_loop",
  callback: "close_loop",
  close_emotional_loop: "close_loop",
  mood: "atmosphere",
  ambience: "atmosphere",
  ambiance: "atmosphere",
  desire: "establish_desire",
  aspiration: "establish_desire",
  create_desire: "establish_desire",
  grab_attention: "hook",
  attention: "hook",
  opening_hook: "hook",
};

const coerceSceneFunction = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  const norm = v.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((SCENE_FUNCTIONS as readonly string[]).includes(norm)) return norm;
  return FUNCTION_SYNONYMS[norm] ?? "custom";
};

const sceneFunctionSchema = z.preprocess(coerceSceneFunction, z.enum(SCENE_FUNCTIONS));

export const sceneIntentSchema = z.object({
  intent_id: text,
  // Unknown lifecycle labels degrade to "inferred" instead of failing.
  state: z.preprocess(
    (v) =>
      typeof v === "string" && ["inferred", "confirmed", "locked"].includes(v.trim().toLowerCase())
        ? v.trim().toLowerCase()
        : "inferred",
    z.enum(["inferred", "confirmed", "locked"])
  ),
  evidence: textArray,
  // Models sometimes answer 0-100 or a numeric string — rescale and clamp.
  confidence: z.preprocess((v) => {
    const n = typeof v === "string" ? Number.parseFloat(v) : v;
    if (typeof n !== "number" || Number.isNaN(n)) return 0.5;
    const scaled = n > 1 && n <= 100 ? n / 100 : n;
    return Math.min(1, Math.max(0, scaled));
  }, z.number().min(0).max(1)),
  primary_function: sceneFunctionSchema,
  // Non-arrays become [], overflow is trimmed instead of failing max(3).
  secondary_functions: z.preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, 3) : []),
    z.array(sceneFunctionSchema).max(3)
  ).default([]),
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
})
  // AUTO-REPAIR instead of failing later semantic checks: coercion can map two
  // near-miss names onto the same canonical function, and models repeat the
  // primary in the secondaries — dedupe and drop the primary echo here.
  .transform((intent) => ({
    ...intent,
    secondary_functions: Array.from(new Set(intent.secondary_functions)).filter(
      (f) => f !== intent.primary_function
    ),
  }));

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

