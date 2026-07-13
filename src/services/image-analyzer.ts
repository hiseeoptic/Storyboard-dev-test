import { getOpenAIClient } from "@/lib/openai/client";
import { geminiGenerateText } from "@/lib/gemini/client";
import type { AIProvider, ImageReference } from "@/types";

/**
 * Analyzes uploaded reference images via vision model (OpenAI GPT-4o
 * or Gemini) and produces detailed text descriptions for image prompts.
 */
async function analyzeWithVision(params: {
  provider: AIProvider;
  prompt: string;
  images: string[];
  maxTokens: number;
}): Promise<string | null> {
  if (params.provider === "gemini") {
    try {
      return await geminiGenerateText({
        userPrompt: params.prompt,
        images: params.images.map((base64) => ({ base64, mimeType: "image/jpeg" })),
        temperature: 0.4,
        maxOutputTokens: params.maxTokens,
        timeoutMs: 45_000,
      });
    } catch (err) {
      console.error("[Image Analyzer] Gemini vision failed:", err);
      return null;
    }
  }

  const openai = getOpenAIClient();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: params.prompt },
            ...params.images.map((base64) => ({
              type: "image_url" as const,
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: "high" as const,
              },
            })),
          ],
        },
      ],
      max_tokens: params.maxTokens,
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("[Image Analyzer] OpenAI vision failed:", err);
    return null;
  }
}

export async function analyzeReferenceImages(params: {
  characters?: ImageReference[];
  products?: ImageReference[];
  ingredients?: ImageReference[];
  backgrounds?: ImageReference[];
  provider?: AIProvider;
  /** Cooking treats product uploads as finished-dish references, not packaging. */
  contentMode?: "general" | "cooking";
}): Promise<{
  characterDescriptions: Record<string, string>;
  productDescriptions: Record<string, string>;
  ingredientDescriptions: Record<string, string>;
  backgroundDescription: string;
}> {
  const provider: AIProvider = params.provider ?? "openai";
  const characterDescriptions: Record<string, string> = {};
  const productDescriptions: Record<string, string> = {};
  const ingredientDescriptions: Record<string, string> = {};
  let backgroundDescription = "";
  const tasks: Promise<void>[] = [];

  // Independent semantic roles run concurrently. This removes the previous
  // Character → Product → Ingredient → Background waterfall from the critical
  // path while preserving separate prompts and name bindings.
  for (const character of params.characters ?? []) {
    if (character.images.length === 0) continue;
    tasks.push((async () => {
      const desc = await analyzeWithVision({
          provider,
          images: character.images,
          maxTokens: 500,
          prompt: `You are a character design specialist. Analyze these reference photos of "${character.name}" and provide a DETAILED visual description for AI image generation consistency.

Describe in this exact order (be extremely specific about colors, shapes, proportions):
1. GENDER & AGE: exact gender and estimated age range
2. BUILD: body type (slim/medium/athletic/stocky/heavyset), estimated height
3. FACE SHAPE: round/oval/square/heart/angular
4. SKIN TONE: exact skin color description (e.g. "warm olive", "fair porcelain", "deep brown")
5. HAIR: exact color, length, texture, style (e.g. "jet black wavy hair, shoulder length, side-parted")
6. EYES: color, shape, size (e.g. "large dark brown almond-shaped eyes")
7. NOSE & LIPS: shape descriptions
8. COSTUME/CLOTHING: complete outfit description with colors and patterns
9. ACCESSORIES: glasses, jewelry, hat, watch, etc.
10. SIGNATURE FEATURES: any distinctive marks, tattoos, scars, dimples, freckles

Write as a continuous paragraph, NOT bullet points. Use precise color names. This description will be restated word-for-word in every image generation prompt to ensure the character looks identical across all scenes.`,
        });
      if (desc) {
        characterDescriptions[character.name] = desc.trim();
      }
    })());
  }

  for (const product of params.products ?? []) {
    if (product.images.length === 0) continue;
    tasks.push((async () => {
      const desc = await analyzeWithVision({
        provider,
        images: product.images,
        maxTokens: 300,
        prompt:
          params.contentMode === "cooking"
            ? `Analyze these FINISHED-DISH reference photos of "${product.name}"${product.description ? ` (${product.description})` : ""}. This is food, NOT retail packaging. In max 140 words describe only visible culinary facts: bowl/plate and camera angle, noodle or food shape, sauce colour/viscosity/gloss, meat and vegetable cut/state, topping placement, steam/temperature cues, moisture, texture, portion geometry and lighting. Distinguish what is visibly confirmed from what is unclear. Do not invent ingredients, brand elements, labels or recipe steps.`
            : `Analyze these product photos of "${product.name}"${product.description ? ` (${product.description})` : ""}. Provide a detailed visual description (150 words max) focusing on: exact shape, dimensions, colors (use precise color names), material/texture, brand elements, logo placement, packaging details, label text if visible. This will be used to include this product accurately and consistently in AI-generated storyboard scenes. Be very specific about visual details.`,
      });

      if (desc) {
        productDescriptions[product.name] = desc.trim();
      }
    })());
  }

  for (const ing of params.ingredients ?? []) {
    if (ing.images.length === 0) continue;
    tasks.push((async () => {
      const desc = await analyzeWithVision({
        provider,
        images: ing.images,
        maxTokens: 150,
        prompt:
          params.contentMode === "cooking"
            ? `Analyze these food-ingredient reference images for "${ing.name}"${ing.description ? ` (${ing.description})` : ""}. In max 90 words, describe only visible ingredients and their real colour, cut size, surface moisture, raw/cooked state, texture and vessel arrangement. Do not infer quantities or add ingredients that are not visibly confirmed; quantities come from the canonical Recipe IR.`
            : `Analyze this image of "${ing.name}"${ing.description ? ` (${ing.description})` : ""}. In max 60 words, describe its exact visual form and colours (use precise colour names and RGB hex when obvious), texture and shape, so it can be illustrated accurately and recognised by the name "${ing.name}". Be concise and specific.`,
      });
      if (desc) ingredientDescriptions[ing.name] = desc.trim();
    })());
  }

  if (params.backgrounds && params.backgrounds.length > 0) {
    const allBgImages = params.backgrounds.flatMap((bg) => bg.images);
    if (allBgImages.length > 0) {
      const bgNames = params.backgrounds.map((b) => b.name).join(", ");
      tasks.push((async () => {
        const desc = await analyzeWithVision({
          provider,
          images: allBgImages,
          maxTokens: 200,
          prompt: `Analyze these reference photos of locations/settings (${bgNames}). Provide a concise visual description (max 120 words) covering: environment type, architecture, colors, atmosphere, lighting conditions, notable details. This will be used as a setting reference for AI-generated storyboard scenes. Be specific about visual elements.`,
        });
        if (desc) backgroundDescription = desc.trim();
      })());
    }
  }

  await Promise.all(tasks);

  return {
    characterDescriptions,
    productDescriptions,
    ingredientDescriptions,
    backgroundDescription,
  };
}
