"use server";

import { generateStoryboardBreakdown } from "@/services/ai-engine";
import {
  generateCharacterRefSheet,
  generateStoryboardPoster,
} from "@/services/image-pipeline";
import { analyzeReferenceImages } from "@/services/image-analyzer";
import { buildVideoPromptText } from "@/prompts";
import type {
  ActionResult,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  CharacterLock,
} from "@/types";

export interface StoryboardResult {
  breakdown: StoryboardGenerationOutput;
  characterRefSheetUrl: string | null;
  storyboardPosterUrl: string | null;
  videoPrompt: string;
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
  if (input.character_descriptions) {
    for (const char of input.character_descriptions) {
      const existing = analyzedCharacters[char.name];
      if (existing) {
        analyzedCharacters[char.name] = `${existing}. Additional: ${char.appearance}`;
      } else if (char.appearance) {
        analyzedCharacters[char.name] = char.appearance;
      }
    }
  }

  // Enhance input with analyzed descriptions
  const enhancedInput = { ...input };
  if (analyzedBackground) {
    enhancedInput.setting = enhancedInput.setting
      ? `${enhancedInput.setting}. Visual reference: ${analyzedBackground}`
      : analyzedBackground;
  }

  const productNames = Object.keys(analyzedProducts);
  if (productNames.length > 0) {
    const productContext = productNames
      .map((name) => `Product "${name}": ${analyzedProducts[name]}`)
      .join(". ");
    enhancedInput.custom_instructions = enhancedInput.custom_instructions
      ? `${enhancedInput.custom_instructions}. Products to feature: ${productContext}`
      : `Products to feature in scenes: ${productContext}`;
  }

  // ─── Step 2: AI scene breakdown + character locks ──────────────────
  let breakdown: StoryboardGenerationOutput;
  try {
    breakdown = await generateStoryboardBreakdown(enhancedInput);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "AI generation failed",
    };
  }

  // Merge analyzed character descriptions into character_locks
  for (const lock of breakdown.character_locks) {
    const analyzed = analyzedCharacters[lock.name];
    if (analyzed) {
      lock.signature_features = lock.signature_features
        ? `${lock.signature_features}. From reference: ${analyzed}`
        : analyzed;
    }
  }

  // ─── Step 3: Generate Character Reference Sheet ────────────────────
  let characterRefSheetUrl: string | null = null;

  if (breakdown.character_locks.length > 0) {
    const mainCharacter = breakdown.character_locks[0] as CharacterLock;
    try {
      const result = await generateCharacterRefSheet({
        characterLock: mainCharacter,
        colorPalette: breakdown.style_guide.color_palette,
      });
      characterRefSheetUrl = result.url;
    } catch (err) {
      console.error("[Storyboard] Character ref sheet generation failed:", err);
    }
  }

  // ─── Step 4: Generate Storyboard Poster ────────────────────────────
  let storyboardPosterUrl: string | null = null;

  // Build character description string for poster consistency
  const charDescForPoster = breakdown.character_locks
    .map(
      (c) =>
        `${c.name}: ${c.gender_age}, ${c.build}, skin ${c.skin_tone}, hair ${c.hair}, eyes ${c.eyes}, wearing ${c.costume}. ${c.signature_features}`
    )
    .join(". ");

  try {
    const result = await generateStoryboardPoster({
      title: breakdown.title,
      totalDuration: breakdown.total_duration_seconds,
      sceneCount: breakdown.scenes.length,
      moodTags: breakdown.mood_tags,
      scenes: breakdown.scenes.map((s) => ({
        scene_number: s.scene_number,
        title: s.title,
        description: s.description,
        camera_code: s.camera_code || "[EYE]",
        dialogue: s.dialogue,
        characters: s.characters,
      })),
      characterDescription: charDescForPoster || "No specific character",
      style: input.style,
      colorPalette: breakdown.style_guide.color_palette,
    });
    storyboardPosterUrl = result.url;
  } catch (err) {
    console.error("[Storyboard] Storyboard poster generation failed:", err);
  }

  // ─── Step 5: Generate Video Prompt Text ────────────────────────────
  const videoPrompt = buildVideoPromptText({
    title: breakdown.title,
    characterDescription: charDescForPoster || "No specific character",
    setting: input.setting || breakdown.scenes[0]?.location || "Unspecified",
    style: input.style,
    colorPalette: breakdown.style_guide.color_palette,
    scenes: breakdown.scenes.map((s) => ({
      scene_number: s.scene_number,
      title: s.title,
      camera_code: s.camera_code || "[EYE]",
      camera_movement: s.camera_movement || "static",
      action_notes: s.action_notes || s.description,
      dialogue: s.dialogue,
      mood: s.mood,
      duration_seconds: s.duration_seconds,
    })),
  });

  return {
    success: true,
    data: {
      breakdown,
      characterRefSheetUrl,
      storyboardPosterUrl,
      videoPrompt,
    },
  };
}
