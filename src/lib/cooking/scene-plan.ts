import { z } from "zod";
import type { StoryboardGenerationInput } from "@/types";
import { compileCookingRecipeDigest, cookingStyleDirective } from "./prompt";

const sceneFunctionSchema = z.enum([
  "hook",
  "mise_en_place",
  "prep",
  "cook",
  "transform",
  "plating",
]);

const beatSchema = z.object({
  action: z.string().trim().min(1),
  camera: z.string().trim().min(1),
});

export const compactCookingScenePlanSchema = z.object({
  version: z.literal("1.0").default("1.0"),
  title: z.string().trim().min(1),
  synopsis: z.string().trim().min(1),
  segments: z.array(
    z.object({
      segment_number: z.coerce.number().int().positive(),
      function: sceneFunctionSchema,
      title: z.string().trim().min(1),
      recipe_step_orders: z.array(z.coerce.number().int().positive()).default([]),
      visible_ingredient_ids: z.array(z.string().trim()).default([]),
      start_frame: z.string().trim().min(1),
      action_timeline: z.string().trim().min(1),
      end_state: z.string().trim().min(1),
      beats: z.array(beatSchema).min(1),
      asmr_cues: z.array(z.string().trim()).default([]),
      continuity_note: z.string().trim().min(1),
    })
  ).min(1),
});

const STRING = { type: "STRING" } as const;
const STRING_ARRAY = { type: "ARRAY", items: STRING } as const;
const INTEGER_ARRAY = { type: "ARRAY", items: { type: "INTEGER" } } as const;

export const COMPACT_COOKING_SCENE_PLAN_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    version: STRING,
    title: STRING,
    synopsis: STRING,
    segments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          segment_number: { type: "INTEGER" },
          function: STRING,
          title: STRING,
          recipe_step_orders: INTEGER_ARRAY,
          visible_ingredient_ids: STRING_ARRAY,
          start_frame: STRING,
          action_timeline: STRING,
          end_state: STRING,
          beats: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { action: STRING, camera: STRING },
              required: ["action", "camera"],
            },
          },
          asmr_cues: STRING_ARRAY,
          continuity_note: STRING,
        },
        required: [
          "segment_number",
          "function",
          "title",
          "recipe_step_orders",
          "visible_ingredient_ids",
          "start_frame",
          "action_timeline",
          "end_state",
          "beats",
          "asmr_cues",
          "continuity_note",
        ],
      },
    },
  },
  required: ["version", "title", "synopsis", "segments"],
};

export function buildCompactCookingScenePlanPrompt(
  input: StoryboardGenerationInput
): string {
  if (input.genre !== "cooking" || !input.cooking_recipe) {
    throw new Error("Compact Cooking Scene Plan requires genre=cooking and Recipe IR");
  }
  const segmentCount = input.segment_count ?? input.scene_count ?? 6;
  const beatCount = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  const context = input.resolved_context
    ? {
        project_intent: input.resolved_context.layers.project_intent,
        temporal: input.resolved_context.layers.temporal,
        environment: input.resolved_context.layers.environment,
        motion_continuity: input.resolved_context.layers.motion_continuity,
        visual_language: input.resolved_context.layers.visual_language,
        audio_validation: input.resolved_context.layers.audio_validation,
      }
    : null;

  return `Create a COMPACT scene plan for one cooking short. You own only scene-specific choices. A deterministic compiler adds Scene Intent, world rules, lighting ownership, physics, safety, negative prompts, audio law and Veo wrappers later — do not repeat those libraries here.

HARD ROUTING:
- This request is cooking because canonical genre is exactly "cooking". Do not introduce health, numerology, product-ad, presenter or unrelated lifestyle content.
- Produce EXACTLY ${segmentCount} segments, numbered 1..${segmentCount}. Each segment contains EXACTLY ${beatCount} progressive beats of one continuous primary action.
- Segment 1 function=hook, recipe_step_orders=[] and its FIRST FRAME is the finished dish. Its first 3-5 seconds are an appetising sensory money shot. Never open on a room overview, ingredient list, greeting, logo or title. The rest of this clip may explore only the same finished dish; it does not perform or claim a recipe step.
- The cut from segment 1 to segment 2 is an explicit editorial preview reset: segment 2 returns to the real beginning of the recipe. This is the ONLY allowed non-causal time jump. State it in both segments' continuity_note so the compiler never describes the reset as an in-shot food morph or teleport.
- Final segment function=plating and fulfils the same dish promise with the actual finished state.
- Allocate every middle segment from the actual Recipe IR. Functions mise_en_place/prep/cook/transform may repeat or be omitted when the dish does not need them. Merge only compatible operations; never force a generic six-beat formula onto a recipe whose causal steps differ.
- recipe_step_orders and visible_ingredient_ids must reference only ids/orders in Recipe IR. Never invent or substitute. Cover every Recipe IR step across segments 2..final; the opening preview never counts as step coverage.
- start_frame describes only what physically exists at second 0. action_timeline uses 0-10s and shows a visible cause→contact→effect→end-state chain. No teleporting/morphing.
- Repetitive prep may be time-compressed only when start and end states remain causal. Do not put several unrelated shots/actions into one segment.
- beats are reframings of that SAME action, not hard cuts. Keep camera language varied but selected from the resolved context, dish action and chosen style.
- asmr_cues list only sounds caused by visible contact. The compiler enforces silence/no music for ASMR modes.
- Images supplied by the user as style inspiration are NOT a template: abstract only useful principles (sensory clarity, action readability, pacing, spatial hierarchy). Never copy a creator's location, props, wardrobe, exact composition, branding, UI, watermark or sequence. Location/composition must come from THIS recipe, setting and Context IR.

SELECTED DIRECTION PROFILE:
${cookingStyleDirective(input.cooking_style ?? "kitchen_asmr")}

${compileCookingRecipeDigest(input.cooking_recipe, input.cooking_style ?? "kitchen_asmr")}

RESOLVED CONTEXT (canonical; null means keep missing values open):
${JSON.stringify(context)}

SEMANTIC IMAGE ANALYSIS (appearance facts only; never copy source composition/UI):
${(input.custom_instructions ?? "No finished-dish, ingredient or location image analysis supplied.").slice(0, 6000)}

Return only the compact JSON required by the schema. Do not output world_context, scene_bible, character_locks, scene_intent, social posts, negative prompts or full Veo prompts.`;
}
