import { claudeGenerateText } from "@/lib/anthropic/client";
import {
  buildCompactCookingScenePlanPrompt,
  compactCookingScenePlanSchema,
  COMPACT_COOKING_SCENE_PLAN_RESPONSE_SCHEMA,
  type CompactCookingBeat,
  type CompactCookingScene,
  type CompactCookingScenePlan,
  type CookingSceneFunction,
} from "@/lib/cooking";
import { geminiGenerateText } from "@/lib/gemini/client";
import { getOpenAIClient } from "@/lib/openai/client";
import type { AIProvider, StoryboardGenerationInput } from "@/types";

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function deterministicBeats(
  startFrame: string,
  action: string,
  endState: string,
  beatCount: number,
  isHook: boolean
): CompactCookingBeat[] {
  const candidates: CompactCookingBeat[] = isHook
    ? [
        { action: `Open immediately on ${startFrame}`, camera: "[MACRO] tight food-first texture reveal" },
        { action: "Hold the same finished dish while steam, gloss and topping depth remain physically stable", camera: "[CLOSE] slow controlled push across the hero surface" },
        { action: "Reveal one appetising texture interaction without changing the dish state", camera: "[POV] precise utensil or hand interaction at the serving edge" },
        { action: `Settle back on ${endState}`, camera: "[CLOSE] restrained parallax finish on the same plate or bowl" },
        { action: "Hold the fulfilled visual promise for the editorial reset", camera: "[EYE] stable end frame with no title or logo" },
      ]
    : [
        { action: `Establish only the locked working state: ${startFrame}`, camera: "[CLOSE] readable tool, vessel and active ingredients" },
        { action, camera: "[POV] follow the same hand-to-tool contact without a hard cut" },
        { action: "Continue the same operation until its visible material change is clear", camera: "[MACRO] reframe onto texture, moisture, colour or viscosity change" },
        { action: `Resolve the operation into ${endState}`, camera: "[SIDE] small parallax reveal of the completed state" },
        { action: "Hold the continuity anchor without starting another operation", camera: "[EYE] stable chaining frame" },
      ];
  return candidates.slice(0, beatCount);
}

function stepFunction(
  text: string,
  index: number,
  hasMiseEnPlace: boolean
): CookingSceneFunction {
  const normalized = text.toLowerCase();
  if (
    index === 0 &&
    hasMiseEnPlace &&
    /mise|chuẩn bị|sắp|chia|đong|cân|prepare|arrange|portion|measure/.test(normalized)
  ) {
    return "mise_en_place";
  }
  if (/cắt|thái|băm|gọt|rửa|xé|slice|dice|chop|mince|peel|wash|shred/.test(normalized)) {
    return index === 0 && hasMiseEnPlace ? "mise_en_place" : "prep";
  }
  if (/sánh|đặc|đổi màu|vàng|caramel|tan chảy|nở|thicken|reduce|brown|melt|set|crisp/.test(normalized)) {
    return "transform";
  }
  if (/xào|nấu|luộc|chiên|rán|nướng|hấp|đun|sôi|sauté|saute|cook|boil|fry|grill|bake|steam|simmer/.test(normalized)) {
    return "cook";
  }
  return index === 0 && hasMiseEnPlace ? "mise_en_place" : "prep";
}

function allocateStepGroups<T>(steps: T[], slotCount: number): T[][] {
  if (slotCount <= 0) return [];
  if (steps.length >= slotCount) {
    return Array.from({ length: slotCount }, (_, slot) => {
      const start = Math.floor((slot * steps.length) / slotCount);
      const end = Math.floor(((slot + 1) * steps.length) / slotCount);
      return steps.slice(start, Math.max(start + 1, end));
    });
  }
  return Array.from({ length: slotCount }, (_, slot) => [
    steps[Math.min(slot, steps.length - 1)]!,
  ]);
}

/**
 * Last-resort, zero-LLM planner. It keeps the server action useful when a text
 * model times out or returns malformed JSON, while Recipe IR still owns every
 * ingredient and operation. The normal path remains the compact model plan.
 */
function buildDeterministicFallbackPlan(
  input: StoryboardGenerationInput
): CompactCookingScenePlan {
  const recipe = input.cooking_recipe!;
  const segmentCount = input.segment_count ?? input.scene_count ?? 6;
  const beatCount = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  const causalSlotCount = Math.max(1, segmentCount - 1);
  const stepGroups = allocateStepGroups(recipe.steps, causalSlotCount);
  const heroState = recipe.hero_visual || `finished ${recipe.dish_name}`;
  const hook: CompactCookingScene = {
    segment_number: 1,
    function: "hook",
    title: `${recipe.dish_name} — finished-dish preview`,
    recipe_step_orders: [],
    visible_ingredient_ids: unique(recipe.steps.at(-1)?.ingredient_ids ?? []),
    start_frame: heroState,
    action_timeline: `0-4s: reveal the finished ${recipe.dish_name} immediately through steam, sauce, texture and topping depth; 4-10s: remain on the same dish for one restrained serving interaction and a steady hold`,
    end_state: heroState,
    beats: deterministicBeats(heroState, "Explore only the same finished dish", heroState, beatCount, true),
    asmr_cues: unique(recipe.steps.at(-1)?.asmr_cues ?? []).slice(0, 4),
    continuity_note: "Editorial preview only. Hold the finished dish, then make an explicit cut back to the recipe start in segment 2; never morph the finished food into raw ingredients inside a shot.",
  };

  let previousEnd = "the exact mise-en-place state required by the first recipe operation";
  const causalSegments = stepGroups.map((group, index): CompactCookingScene => {
    const isFinal = index === stepGroups.length - 1;
    const stepText = group.map((step) => `${step.title}: ${step.action}`).join(" Then ");
    const endFromRecipe = group.at(-1)?.visible_end_state || `the visibly completed state of ${group.at(-1)?.title ?? recipe.dish_name}`;
    const endState = isFinal
      ? [endFromRecipe, recipe.plating, heroState].filter(Boolean).join("; finally ")
      : endFromRecipe;
    const startFrame = index === 0
      ? `After an explicit editorial cut back from the finished-dish preview: ${previousEnd}`
      : `Continue from the preceding locked state: ${previousEnd}`;
    const action = isFinal
      ? `${stepText}. Complete only the supplied plating instruction: ${recipe.plating || "place the finished food in its serving vessel"}`
      : stepText;
    const functionName: CookingSceneFunction = isFinal
      ? "plating"
      : stepFunction(stepText, index, recipe.mise_en_place.length > 0);
    const segment: CompactCookingScene = {
      segment_number: index + 2,
      function: functionName,
      title: isFinal ? `${recipe.dish_name} — plating and payoff` : group.map((step) => step.title).join(" + "),
      recipe_step_orders: unique(group.map((step) => String(step.order))).map(Number),
      visible_ingredient_ids: unique(group.flatMap((step) => step.ingredient_ids)),
      start_frame: startFrame,
      action_timeline: `0-1.5s: establish the exact entry state; 1.5-8s: ${action}; 8-10s: show the causal material result without starting another operation`,
      end_state: endState,
      beats: deterministicBeats(startFrame, action, endState, beatCount, false),
      asmr_cues: unique(group.flatMap((step) => step.asmr_cues)).slice(0, 6),
      continuity_note: index === 0
        ? `This is the explicit editorial reset after the opening preview. From here onward continuity is strictly causal. Carry ${endState} into the next segment.`
        : isFinal
          ? `Resolve the opening promise on the actual finished ${recipe.dish_name}; no new ingredient or operation appears.`
          : `Carry this exact end state into the next segment: ${endState}.`,
    };
    previousEnd = endState;
    return segment;
  });

  return {
    version: "1.0",
    title: recipe.dish_name,
    synopsis: `A recipe-faithful ${input.cooking_style ?? "kitchen_asmr"} short compiled from the reviewed Recipe IR.`,
    segments: [hook, ...causalSegments],
  };
}

function parseCompactJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }
}

async function generateOnce(
  input: StoryboardGenerationInput,
  provider: AIProvider,
  attempt: number
): Promise<string> {
  const userPrompt = buildCompactCookingScenePlanPrompt(input);
  const segmentCount = input.segment_count ?? input.scene_count ?? 6;
  const beatCount = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  const compactTokenCap = Math.min(
    6_000,
    900 + segmentCount * (450 + beatCount * 90)
  );
  const systemPrompt =
    "You are the compact scene-planning stage of a cooking-video compiler. Return only small scene-specific JSON. Never repeat global production libraries and never copy a reference creator's identifiable set or sequence.";

  if (provider === "gemini") {
    return geminiGenerateText({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      responseSchema: COMPACT_COOKING_SCENE_PLAN_RESPONSE_SCHEMA,
      temperature: attempt === 0 ? 0.2 : 0.05,
      maxOutputTokens: compactTokenCap,
      timeoutMs: 45_000,
    });
  }
  if (provider === "claude") {
    return claudeGenerateText({
      systemPrompt,
      userPrompt: `${userPrompt}\nReturn JSON only.`,
      maxTokens: compactTokenCap,
      timeoutMs: 45_000,
    });
  }

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: attempt === 0 ? 0.2 : 0.05,
    max_tokens: compactTokenCap,
  }, { timeout: 45_000 });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Cooking-specific replacement for the giant general storyboard response.
 * Two small attempts maximum; the deterministic compiler owns all repeated
 * production laws and output compatibility fields.
 */
export async function generateCompactCookingScenePlan(
  input: StoryboardGenerationInput,
  provider: AIProvider = "gemini"
): Promise<CompactCookingScenePlan> {
  const requiredSegments = input.segment_count ?? input.scene_count ?? 6;
  const requiredBeats = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateOnce(input, provider, attempt);
      if (!raw) throw new Error(`Empty compact cooking plan from ${provider}`);
      const plan = compactCookingScenePlanSchema.parse(parseCompactJson(raw));
      if (plan.segments.length !== requiredSegments) {
        throw new Error(
          `Compact plan returned ${plan.segments.length} segments; expected ${requiredSegments}`
        );
      }
      if (plan.segments[0]?.function !== "hook") {
        throw new Error("Compact plan must start with function=hook");
      }
      if ((plan.segments[0]?.recipe_step_orders.length ?? 0) > 0) {
        throw new Error("Opening preview must not claim Recipe IR step coverage");
      }
      if (plan.segments.at(-1)?.function !== "plating") {
        throw new Error("Compact plan must end with function=plating");
      }
      const recipe = input.cooking_recipe!;
      const validStepOrders = new Set(recipe.steps.map((step) => step.order));
      const validIngredientIds = new Set(recipe.ingredients.map((ingredient) => ingredient.id));
      for (const [index, segment] of plan.segments.entries()) {
        if (segment.beats.length !== requiredBeats) {
          throw new Error(
            `Compact plan segment ${index + 1} returned ${segment.beats.length} beats; expected ${requiredBeats}`
          );
        }
        const badStep = segment.recipe_step_orders.find((order) => !validStepOrders.has(order));
        if (badStep != null) {
          throw new Error(`Compact plan segment ${index + 1} references unknown recipe step ${badStep}`);
        }
        const badIngredient = segment.visible_ingredient_ids.find(
          (id) => !validIngredientIds.has(id)
        );
        if (badIngredient) {
          throw new Error(`Compact plan segment ${index + 1} references unknown ingredient ${badIngredient}`);
        }
      }
      const coveredStepOrders = new Set(
        plan.segments.slice(1).flatMap((segment) => segment.recipe_step_orders)
      );
      const uncoveredStep = recipe.steps.find((step) => !coveredStepOrders.has(step.order));
      if (uncoveredStep) {
        throw new Error(
          `Compact plan omitted Recipe IR step ${uncoveredStep.order}: ${uncoveredStep.title}`
        );
      }
      let priorFirstSegment = 0;
      for (const step of recipe.steps) {
        const firstSegment = plan.segments
          .slice(1)
          .findIndex((segment) => segment.recipe_step_orders.includes(step.order));
        if (firstSegment < priorFirstSegment) {
          throw new Error(
            `Compact plan moved Recipe IR step ${step.order} before an earlier causal step`
          );
        }
        priorFirstSegment = firstSegment;
      }
      for (const [index, segment] of plan.segments.slice(1).entries()) {
        if (
          segment.recipe_step_orders.some(
            (order, orderIndex, orders) => orderIndex > 0 && order < orders[orderIndex - 1]!
          )
        ) {
          throw new Error(
            `Compact plan segment ${index + 2} contains out-of-order Recipe IR steps`
          );
        }
      }
      if (
        recipe.mise_en_place.length > 0 &&
        requiredSegments >= 4 &&
        !plan.segments.some((segment) => segment.function === "mise_en_place")
      ) {
        throw new Error("Compact plan omitted required mise_en_place staging");
      }
      return {
        ...plan,
        version: "1.0",
        segments: plan.segments.map((segment, index) => ({
          ...segment,
          segment_number: index + 1,
        })),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Cooking Planner] Attempt ${attempt + 1}/2 failed:`,
        lastError.message
      );
    }
  }
  console.error(
    `[Cooking Planner] Falling back to deterministic Recipe IR allocation after two compact-plan failures: ${lastError?.message}`
  );
  return buildDeterministicFallbackPlan(input);
}
