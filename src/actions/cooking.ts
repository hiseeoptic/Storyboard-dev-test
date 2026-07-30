"use server";

import { geminiGenerateText } from "@/lib/gemini/client";
import { getOpenAIClient } from "@/lib/openai/client";
import { logOpenAiUsage } from "@/lib/ai/usage";
import {
  buildCookingAnalysisPrompt,
  cookingRecipeSchema,
  COOKING_RECIPE_RESPONSE_SCHEMA,
  type CookingRecipeAnalysisInput,
  type CookingRecipeIR,
} from "@/lib/cooking";
import type { ActionResult } from "@/types";

const MAX_SOURCE_CHARS = 30_000;
const MAX_RECIPE_IMAGES = 4;

function parseJsonObject(text: string): unknown {
  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
  }
}
function normalizeRecipe(recipe: CookingRecipeIR): CookingRecipeIR {
  const idMap = new Map<string, string>();
  const ingredients = recipe.ingredients.map((ingredient, index) => {
    const id = `ing_${String(index + 1).padStart(2, "0")}`;
    if (ingredient.id) idMap.set(ingredient.id, id);
    return { ...ingredient, id };
  });
  const validIds = new Set(ingredients.map((ingredient) => ingredient.id));
  const remapIds = (ids: string[]) =>
    Array.from(
      new Set(
        ids
          .map((id) => idMap.get(id) ?? id)
          .filter((id) => validIds.has(id))
      )
    );

  return {
    ...recipe,
    version: "1.0",
    ingredients,
    mise_en_place: recipe.mise_en_place
      .map((item, index) => ({
        ...item,
        order: index + 1,
        ingredient_ids: remapIds(item.ingredient_ids),
      }))
      .filter((item) => item.ingredient_ids.length > 0),
    steps: recipe.steps.map((step, index) => ({
      ...step,
      order: index + 1,
      ingredient_ids: remapIds(step.ingredient_ids),
    })),
  };
}

async function analyzeWithGemini(input: CookingRecipeAnalysisInput): Promise<string> {
  return geminiGenerateText({
    systemPrompt:
      "You extract exact recipe facts from text and cookbook images. You never invent missing culinary data.",
    userPrompt: buildCookingAnalysisPrompt(input),
    images: (input.images ?? []).map((base64) => ({ base64, mimeType: "image/jpeg" })),
    jsonMode: true,
    responseSchema: COOKING_RECIPE_RESPONSE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 8192,
    timeoutMs: 90_000,
  });
}

async function analyzeWithOpenAIFallback(input: CookingRecipeAnalysisInput): Promise<string> {
  const systemPrompt =
    "You extract exact recipe facts from text and cookbook images. Never invent missing culinary data. Return JSON only.";
  const userPrompt = buildCookingAnalysisPrompt(input);
  const model =
    process.env.OPENAI_COOKING_ANALYSIS_MODEL || "gpt-4.1-mini";
  const response = await getOpenAIClient().chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...(input.images ?? []).map((base64) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" as const },
          })),
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 8192,
  });
  logOpenAiUsage({
    stage: "cooking_recipe_analysis",
    model,
    usage: response.usage,
    promptParts: [systemPrompt, userPrompt],
    imageCount: input.images?.length ?? 0,
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * OCR + normalize a recipe before storyboard generation. It intentionally runs
 * as a separate action so book images are never resent through every planning
 * stage and the user can review quantities before spending storyboard tokens.
 */
export async function analyzeCookingRecipe(
  rawInput: CookingRecipeAnalysisInput
): Promise<ActionResult<CookingRecipeIR>> {
  const input: CookingRecipeAnalysisInput = {
    text: (rawInput.text ?? "").slice(0, MAX_SOURCE_CHARS),
    images: (rawInput.images ?? []).filter(Boolean).slice(0, MAX_RECIPE_IMAGES),
  };

  if (!input.text.trim() && (input.images?.length ?? 0) === 0) {
    return {
      success: false,
      error: "Hãy dán công thức hoặc tải ít nhất một ảnh trang sách/công thức.",
      code: "COOKING_SOURCE_REQUIRED",
    };
  }

  let raw = "";
  try {
    raw = await analyzeWithGemini(input);
  } catch (geminiError) {
    console.error("[Cooking OCR] Gemini failed; trying OpenAI fallback:", geminiError);
    try {
      raw = await analyzeWithOpenAIFallback(input);
    } catch (openAIError) {
      console.error("[Cooking OCR] OpenAI fallback failed:", openAIError);
      return {
        success: false,
        error: `Không đọc được công thức từ ảnh/văn bản. Gemini: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`,
        code: "COOKING_OCR_FAILED",
      };
    }
  }

  try {
    const parsed = cookingRecipeSchema.parse(parseJsonObject(raw));
    return { success: true, data: normalizeRecipe(parsed) };
  } catch (error) {
    console.error("[Cooking OCR] Invalid Recipe IR:", error);
    return {
      success: false,
      error: "AI đã đọc ảnh nhưng dữ liệu công thức chưa hợp lệ. Hãy thử ảnh rõ hơn hoặc dán thêm phần chữ.",
      code: "COOKING_IR_INVALID",
    };
  }
}
