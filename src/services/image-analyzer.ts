import { getOpenAIClient } from "@/lib/openai/client";
import { geminiGenerateText } from "@/lib/gemini/client";
import type { AIProvider, ImageReference } from "@/types";

/** Analyzes non-character visual references into prompt text. Character photos
 * remain image-only authorities and are deliberately never translated back
 * into prose. */
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

  // CHARACTER REFERENCES: do not run vision-to-text analysis. The uploaded
  // pixels and their menu name binding are the complete appearance contract.
  // Turning the photo into prose caused face-shape, skin, brow, lash and hair
  // descriptions to be repeated and sometimes to contradict the actual photo.

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
          maxTokens: 380,
          prompt: `These are LOCATION reference photos (${bgNames}). Each location may be an INDOOR room or an OUTDOOR scene (street, park, garden, beach, field, mountain, courtyard…). They may show ONE place from multiple angles, or SEVERAL distinct places — use the names above to tell them apart, and describe EACH distinct location separately under its name. For each, reconstruct the space precisely so an image model can rebuild it identically from any camera angle, including the reverse view: (1) place type and overall geometry (indoor: shape/size/ceiling; outdoor: openness, depth, ground plane, sky); (2) FIXED layout — the relative positions of the major landmarks (indoor: furniture/fixtures; outdoor: buildings, trees, paths, water, terrain features) to each other and to the boundaries; (3) boundaries and surfaces with precise colours (indoor: walls/floor/materials; outdoor: ground, foliage, structures, backdrop); (4) light — its direction, warmth and source (windows/lamps indoors; sun/sky/time-of-day outdoors); (5) small persistent details that must reappear. Keep it under ~200 words total; state only what is visibly confirmed. This is the authoritative setting reference — be concrete about spatial relationships, not just mood.`,
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
