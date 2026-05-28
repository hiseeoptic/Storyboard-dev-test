import { getOpenAIClient } from "@/lib/openai/client";
import { buildImagePrompt, buildCharacterConsistencyPrefix } from "@/prompts";
import type { SceneBreakdown, StoryboardStyle, Plan } from "@/types";
import { PLAN_LIMITS } from "@/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateSceneImage(params: {
  scene: SceneBreakdown;
  style: StoryboardStyle;
  plan: Plan;
  characterDescriptions?: Record<string, string>;
  productDescriptions?: Record<string, string>;
  backgroundDescription?: string;
  customStylePrompt?: string;
}): Promise<{ url: string }> {
  const openai = getOpenAIClient();
  const resolution = PLAN_LIMITS[params.plan].image_resolution;

  const characterPrefix = buildCharacterConsistencyPrefix(
    params.scene.characters,
    params.characterDescriptions ?? {}
  );

  // Build product context for the prompt
  let productPrefix = "";
  if (params.productDescriptions && Object.keys(params.productDescriptions).length > 0) {
    const productEntries = Object.entries(params.productDescriptions)
      .map(([name, desc]) => `${name}: ${desc}`)
      .join("; ");
    productPrefix = `Products in scene — ${productEntries}. `;
  }

  // Build background context for the prompt
  let backgroundPrefix = "";
  if (params.backgroundDescription) {
    backgroundPrefix = `Setting reference — ${params.backgroundDescription}. `;
  }

  const enhancedVisualPrompt =
    characterPrefix + productPrefix + backgroundPrefix + params.scene.visual_prompt;

  const prompt = buildImagePrompt({
    visual_prompt: enhancedVisualPrompt,
    style: params.style,
    camera_angle: params.scene.camera_angle,
    shot_type: params.scene.shot_type,
    mood: params.scene.mood,
    lighting: params.scene.lighting,
    custom_style_prompt: params.customStylePrompt,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: resolution,
        quality: params.plan === "free" ? "standard" : "hd",
        style: "natural",
      });

      const url = response.data?.[0]?.url;
      if (!url) throw new Error("No image URL in response");

      return { url };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[Image Pipeline] Scene ${params.scene.scene_number} attempt ${attempt + 1}/${MAX_RETRIES}:`,
        lastError.message
      );
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("Image generation failed");
}
