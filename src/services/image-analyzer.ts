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
  backgrounds?: ImageReference[];
  provider?: AIProvider;
}): Promise<{
  characterDescriptions: Record<string, string>;
  productDescriptions: Record<string, string>;
  backgroundDescription: string;
}> {
  const provider: AIProvider = params.provider ?? "openai";
  const characterDescriptions: Record<string, string> = {};
  const productDescriptions: Record<string, string> = {};
  let backgroundDescription = "";

  // ─── Analyze character images (HIGH detail for accuracy) ──────────
  if (params.characters && params.characters.length > 0) {
    for (const character of params.characters) {
      if (character.images.length === 0) continue;

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
    }
  }

  // ─── Analyze product images ────────────────────────────────────────
  if (params.products && params.products.length > 0) {
    for (const product of params.products) {
      if (product.images.length === 0) continue;

      const desc = await analyzeWithVision({
        provider,
        images: product.images,
        maxTokens: 300,
        prompt: `Analyze these product photos of "${product.name}"${product.description ? ` (${product.description})` : ""}. Provide a detailed visual description (150 words max) focusing on: exact shape, dimensions, colors (use precise color names), material/texture, brand elements, logo placement, packaging details, label text if visible. This will be used to include this product accurately and consistently in AI-generated storyboard scenes. Be very specific about visual details.`,
      });

      if (desc) {
        productDescriptions[product.name] = desc.trim();
      }
    }
  }

  // ─── Analyze background/setting images ─────────────────────────────
  if (params.backgrounds && params.backgrounds.length > 0) {
    const allBgImages = params.backgrounds.flatMap((bg) => bg.images);

    if (allBgImages.length > 0) {
      const bgNames = params.backgrounds.map((b) => b.name).join(", ");

      const desc = await analyzeWithVision({
        provider,
        images: allBgImages,
        maxTokens: 200,
        prompt: `Analyze these reference photos of locations/settings (${bgNames}). Provide a concise visual description (max 120 words) covering: environment type, architecture, colors, atmosphere, lighting conditions, notable details. This will be used as a setting reference for AI-generated storyboard scenes. Be specific about visual elements.`,
      });

      if (desc) {
        backgroundDescription = desc.trim();
      }
    }
  }

  return { characterDescriptions, productDescriptions, backgroundDescription };
}
