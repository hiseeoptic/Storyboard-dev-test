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
  const style = input.cooking_style ?? "kitchen_asmr";
  const handsOnly = ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(style);
  const hasLocationRef = (input.background_images?.length ?? 0) > 0;
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
- Segment 1 function=hook, recipe_step_orders=[]. The WHOLE clip stays on the FINISHED DISH as one appetising money shot — nothing else: 0-4s an immediate craveable TRIGGER INTERACTION on this dish's most seductive element (chopsticks lifting glossy noodles, a spoon breaking a soft egg yolk so it flows, a cheese pull, sauce drizzling, steam bursting); 4-10s keep exploring ONLY the same dish (slow push, texture, gloss, steam) and hold the promise. Do NOT show raw ingredients, prep, cooking action, a room overview, greeting, logo or title in this clip; it claims no recipe step.
- The cut from segment 1 to segment 2 is an explicit EDITORIAL RESET: segment 2 jumps back to the recipe's real beginning and MUST OPEN (its start_frame and first beat) on the dish's FULL raw-ingredient arrangement — every ingredient laid out fresh in separate bowls/kitchen vessels per Recipe IR mise_en_place (set segment 2's visible_ingredient_ids to the FULL ingredient set) — held for the first 2-3 seconds as a styled hero display, THEN flowing into the first real prep operation on those same ingredients inside the same clip. This editorial cut is the ONLY allowed non-causal time jump; state it in both segments' continuity_note, and never depict it as an in-shot morph/teleport of finished food into raw ingredients.
- Final segment function=plating: reach the actual finished dish and visibly transfer/serve it into the eating vessel (serving bowl/plate with the chopsticks, spoon or utensil the dish needs), steaming and ready to eat.${(input.character_descriptions?.length ?? 0) > 0 ? ` EATING PAYOFF (mandatory — the uploaded person appears ONLY in this final segment, never earlier): after the dish is served, ${input.character_descriptions![0]!.name} is seated at the table behind the served dish from this clip's start state, FACE fully visible to camera (never cropped, turned away or hidden behind the bowl); in the last 3-4 seconds they lift the first bite and taste it with visible genuine delight, face toward camera. List them in no other segment.` : ""}
- Allocate every middle segment from the actual Recipe IR. Functions mise_en_place/prep/cook/transform may repeat or be omitted when the dish does not need them. Merge only compatible operations; never force a generic six-beat formula onto a recipe whose causal steps differ.
- recipe_step_orders and visible_ingredient_ids must reference only ids/orders in Recipe IR. Never invent or substitute. Cover every Recipe IR step across segments 2..final; the opening ingredient-hook never counts as step coverage.
- SEGMENT BUDGET PRIORITY (critical — screen time is the scarcest resource): whole 10s segments belong ONLY to the three core operations — (a) preparing/cutting the MAIN ingredients, (b) mixing seasonings/sauce, (c) the actual cooking transformations. SUPPORT steps (washing, rinsing, soaking, boiling water, waiting for noodles/pasta to boil, draining, peeling a single clove) must NEVER own a whole segment: either compress them to a 1-2s beat INSIDE a related core segment, run them as simultaneous background action ("while the noodles boil at the back, the knife works through the pork"), or declare them already done in a start_frame ("the boiled noodles sit drained and glistening in the strainer"). Recipe IR coverage still counts when a support step is absorbed this way — list its order in that segment's recipe_step_orders.
- MIDDLE segments (prep/cook/transform) are the heart of the video: make them the most energetic and FAST. Brisk match-on-action pacing, visible time-compression/speed ramps on any repetitive motion (chopping runs, stirring), hard-cut-free but quick reframes, and tight macro push-ins locked on the actual transformation (blade through ingredient, sizzle, bubbling, colour/texture/steam change). No dead frames: every second shows material visibly changing. The hook and plating are calmer bookends.
- start_frame describes only what physically exists at second 0. action_timeline uses 0-10s and shows a visible cause→contact→effect→end-state chain. No teleporting/morphing.
- Repetitive prep may be time-compressed only when start and end states remain causal. Do not put several unrelated shots/actions into one segment.
- beats are reframings of that SAME action, not hard cuts. Keep camera language varied but selected from the resolved context, dish action and chosen style.${handsOnly || hasLocationRef ? `
- POV-INTO-THE-SCENE CAMERA (mandatory for this project): shoot from the cook's first-person viewpoint, hands and food working in the LOWER foreground while the ${hasLocationRef ? "user's real uploaded location" : "resolved setting"} stays alive and visible in the frame's upper depth (landscape, waterfall, fire, kitchen window — with real atmospheric motion). Compose most beats so the viewer simultaneously sees the tactile hand action AND the scenery behind it; at least one beat per segment lets the setting read clearly beyond the food. Never flatten every beat into context-free macro closeups.` : ""}${handsOnly ? `
- HANDS LOCK (critical — this is a hands-only format and the #1 render bug is extra hands): exactly ONE cook exists. Every segment shows at most ONE PAIR of hands — two hands total, same skin tone, same sleeves/wrists throughout the whole video. Write actions so both hands are never asked to do two things in two places at once; a third hand, a second person's hand, or a hand entering from an impossible edge must never appear.` : ""}
- asmr_cues list only sounds caused by visible contact, but make them RICH and specific per beat (layered, close-miked contacts — knife-on-board, dry drop into bowl, pour, sizzle, bubbling, scrape, plating clink) so the diegetic audio is punchy and immersive, not sparse. The compiler still enforces no music for ASMR modes.
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
