"use server";

import { generateStoryboardBreakdown } from "@/services/ai-engine";
import { generateSceneImage } from "@/services/image-pipeline";
import { analyzeReferenceImages } from "@/services/image-analyzer";
import type {
  ActionResult,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
} from "@/types";

interface GeneratedScene {
  scene_number: number;
  title: string;
  description: string;
  visual_prompt: string;
  dialogue: string | null;
  camera_angle: string;
  shot_type: string;
  mood: string;
  lighting: string;
  location: string;
  characters: string[];
  duration_seconds: number;
  transition: string;
  image_url: string | null;
  generation_error: string | null;
}

export interface StoryboardResult {
  breakdown: StoryboardGenerationOutput;
  scenes: GeneratedScene[];
}

export async function generateFullStoryboard(
  input: StoryboardGenerationInput
): Promise<ActionResult<StoryboardResult>> {
  // ─── Step 1: Analyze uploaded reference images ─────────────────────
  let analyzedCharacters: Record<string, string> = {};
  let analyzedProducts: Record<string, string> = {};
  let analyzedBackground = "";

  const hasImages =
    (input.character_images && input.character_images.length > 0) ||
    (input.product_images && input.product_images.length > 0) ||
    (input.background_images && input.background_images.length > 0);

  if (hasImages) {
    try {
      const analysis = await analyzeReferenceImages({
        characters: input.character_images,
        products: input.product_images,
        backgrounds: input.background_images,
      });
      analyzedCharacters = analysis.characterDescriptions;
      analyzedProducts = analysis.productDescriptions;
      analyzedBackground = analysis.backgroundDescription;
    } catch (err) {
      console.error("[Storyboard] Image analysis failed, continuing without:", err);
    }
  }

  // Merge text-based character descriptions with analyzed ones
  const mergedCharacterDescriptions: Record<string, string> = { ...analyzedCharacters };
  if (input.character_descriptions) {
    for (const char of input.character_descriptions) {
      const existing = mergedCharacterDescriptions[char.name];
      mergedCharacterDescriptions[char.name] = existing
        ? `${existing}. Additional: ${char.appearance}`
        : char.appearance;
    }
  }

  // Enhance the input with analyzed descriptions for scene breakdown
  const enhancedInput = { ...input };
  if (analyzedBackground && !enhancedInput.setting) {
    enhancedInput.setting = analyzedBackground;
  } else if (analyzedBackground && enhancedInput.setting) {
    enhancedInput.setting = `${enhancedInput.setting}. Visual reference: ${analyzedBackground}`;
  }

  // Add product context to custom instructions
  const productNames = Object.keys(analyzedProducts);
  if (productNames.length > 0) {
    const productContext = productNames
      .map((name) => `Product "${name}": ${analyzedProducts[name]}`)
      .join(". ");
    enhancedInput.custom_instructions = enhancedInput.custom_instructions
      ? `${enhancedInput.custom_instructions}. Products to feature: ${productContext}`
      : `Products to feature in scenes: ${productContext}`;
  }

  // ─── Step 2: AI scene breakdown ────────────────────────────────────
  let breakdown: StoryboardGenerationOutput;
  try {
    breakdown = await generateStoryboardBreakdown(enhancedInput);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "AI generation failed",
    };
  }

  // ─── Step 3: Generate images for each scene ────────────────────────
  const scenes: GeneratedScene[] = [];

  for (const sceneBreakdown of breakdown.scenes) {
    let imageUrl: string | null = null;
    let generationError: string | null = null;

    try {
      const result = await generateSceneImage({
        scene: sceneBreakdown,
        style: input.style,
        plan: "pro",
        characterDescriptions: mergedCharacterDescriptions,
        productDescriptions: analyzedProducts,
        backgroundDescription: analyzedBackground,
      });
      imageUrl = result.url;
    } catch (err) {
      generationError =
        err instanceof Error ? err.message : "Image generation failed";
    }

    scenes.push({
      scene_number: sceneBreakdown.scene_number,
      title: sceneBreakdown.title,
      description: sceneBreakdown.description,
      visual_prompt: sceneBreakdown.visual_prompt,
      dialogue: sceneBreakdown.dialogue,
      camera_angle: sceneBreakdown.camera_angle,
      shot_type: sceneBreakdown.shot_type,
      mood: sceneBreakdown.mood,
      lighting: sceneBreakdown.lighting,
      location: sceneBreakdown.location,
      characters: sceneBreakdown.characters,
      duration_seconds: sceneBreakdown.duration_seconds,
      transition: sceneBreakdown.transition,
      image_url: imageUrl,
      generation_error: generationError,
    });
  }

  return {
    success: true,
    data: { breakdown, scenes },
  };
}
