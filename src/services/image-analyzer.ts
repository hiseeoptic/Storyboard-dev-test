import { getOpenAIClient } from "@/lib/openai/client";
import type { ImageReference } from "@/types";

/**
 * Uses GPT-4o Vision to analyze uploaded reference images
 * and produce detailed text descriptions for use in DALL-E prompts.
 */
export async function analyzeReferenceImages(params: {
  characters?: ImageReference[];
  products?: ImageReference[];
  backgrounds?: ImageReference[];
}): Promise<{
  characterDescriptions: Record<string, string>;
  productDescriptions: Record<string, string>;
  backgroundDescription: string;
}> {
  const openai = getOpenAIClient();
  const characterDescriptions: Record<string, string> = {};
  const productDescriptions: Record<string, string> = {};
  let backgroundDescription = "";

  // ─── Analyze character images ──────────────────────────────────────
  if (params.characters && params.characters.length > 0) {
    for (const character of params.characters) {
      if (character.images.length === 0) continue;

      const imageContent = character.images.map((base64) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/jpeg;base64,${base64}`,
          detail: "low" as const,
        },
      }));

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze these reference photos of a character named "${character.name}". Provide a concise visual description (max 100 words) focusing on: physical appearance (age, build, skin tone, hair color/style, facial features), clothing style, and any distinctive features. This will be used to generate consistent AI images of this character. Be specific about colors and details.`,
                },
                ...imageContent,
              ],
            },
          ],
          max_tokens: 200,
        });

        const desc = response.choices[0]?.message?.content?.trim();
        if (desc) {
          characterDescriptions[character.name] = desc;
        }
      } catch (err) {
        console.error(`[Image Analyzer] Failed to analyze character ${character.name}:`, err);
      }
    }
  }

  // ─── Analyze product images ────────────────────────────────────────
  if (params.products && params.products.length > 0) {
    for (const product of params.products) {
      if (product.images.length === 0) continue;

      const imageContent = product.images.map((base64) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/jpeg;base64,${base64}`,
          detail: "low" as const,
        },
      }));

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze these product photos of "${product.name}"${product.description ? ` (${product.description})` : ""}. Provide a concise visual description (max 80 words) focusing on: shape, size, color, material, brand elements, packaging. This will be used to include this product accurately in AI-generated storyboard scenes. Be specific.`,
                },
                ...imageContent,
              ],
            },
          ],
          max_tokens: 150,
        });

        const desc = response.choices[0]?.message?.content?.trim();
        if (desc) {
          productDescriptions[product.name] = desc;
        }
      } catch (err) {
        console.error(`[Image Analyzer] Failed to analyze product ${product.name}:`, err);
      }
    }
  }

  // ─── Analyze background/setting images ─────────────────────────────
  if (params.backgrounds && params.backgrounds.length > 0) {
    const allBgImages = params.backgrounds.flatMap((bg) =>
      bg.images.map((base64) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/jpeg;base64,${base64}`,
          detail: "low" as const,
        },
      }))
    );

    if (allBgImages.length > 0) {
      const bgNames = params.backgrounds.map((b) => b.name).join(", ");

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze these reference photos of locations/settings (${bgNames}). Provide a concise visual description (max 120 words) covering: environment type, architecture, colors, atmosphere, lighting conditions, notable details. This will be used as a setting reference for AI-generated storyboard scenes. Be specific about visual elements.`,
                },
                ...allBgImages,
              ],
            },
          ],
          max_tokens: 200,
        });

        const desc = response.choices[0]?.message?.content?.trim();
        if (desc) {
          backgroundDescription = desc;
        }
      } catch (err) {
        console.error("[Image Analyzer] Failed to analyze backgrounds:", err);
      }
    }
  }

  return { characterDescriptions, productDescriptions, backgroundDescription };
}
