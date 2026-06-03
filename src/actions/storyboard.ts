"use server";

import { generateStoryboardBreakdown } from "@/services/ai-engine";
import {
  generateCharacterRefSheet,
  generateStoryboardPoster,
  dataUriToBase64,
} from "@/services/image-pipeline";
import { analyzeReferenceImages } from "@/services/image-analyzer";
import { buildVideoPromptText } from "@/prompts";
import type {
  ActionResult,
  AIProvider,
  AspectRatio,
  ImageQuality,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  CharacterLock,
} from "@/types";

export interface StoryboardResult {
  breakdown: StoryboardGenerationOutput;
  characterRefSheetUrl: string | null;
  storyboardPosterUrl: string | null;
  videoPrompt: string;
  /** Non-fatal errors/warnings encountered during generation */
  warnings: string[];
}

export async function generateFullStoryboard(
  input: StoryboardGenerationInput,
  provider: AIProvider = "openai"
): Promise<ActionResult<StoryboardResult>> {
  const warnings: string[] = [];

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
        provider,
      });
      analyzedCharacters = analysis.characterDescriptions;
      analyzedProducts = analysis.productDescriptions;
      analyzedBackground = analysis.backgroundDescription;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      warnings.push(`Image analysis failed: ${msg}`);
      console.error("[Storyboard] Image analysis failed:", err);
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
    breakdown = await generateStoryboardBreakdown(enhancedInput, provider);
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

  // ─── Step 3 & 4: Generate images ──────────────────────────────────
  let characterRefSheetUrl: string | null = null;
  let storyboardPosterUrl: string | null = null;

  const aspectRatio: AspectRatio = input.aspect_ratio ?? "16:9";
  const quality: ImageQuality = input.image_quality ?? "standard";

  // Only Gemini supports image-to-image reference chaining (face lock).
  const canChain = provider === "gemini";

  // Uploaded photos of the main character (real face to preserve).
  const uploadedCharRefs = (input.character_images?.[0]?.images ?? [])
    .slice(0, 4)
    .map((base64) => ({ base64, mimeType: "image/jpeg" }));

  // Build character description string for poster consistency
  const charDescForPoster = breakdown.character_locks
    .map(
      (c) =>
        `${c.name}: ${c.gender_age}, ${c.build}, skin ${c.skin_tone}, hair ${c.hair}, eyes ${c.eyes}, wearing ${c.costume}. ${c.signature_features}`
    )
    .join(". ");

  const buildPosterArgs = (
    referenceImages?: { base64: string; mimeType?: string }[]
  ) => ({
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
    provider,
    aspectRatio,
    quality,
    referenceImages,
  });

  if (canChain) {
    // Sequential reference chain → maximum face consistency.
    // 1) Character sheet locked to the uploaded photos.
    if (breakdown.character_locks.length > 0) {
      try {
        const r = await generateCharacterRefSheet({
          characterLock: breakdown.character_locks[0] as CharacterLock,
          colorPalette: breakdown.style_guide.color_palette,
          provider,
          aspectRatio,
          quality,
          referenceImages: uploadedCharRefs.length > 0 ? uploadedCharRefs : undefined,
        });
        characterRefSheetUrl = r.url;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        warnings.push(`Character Reference Sheet: ${msg}`);
        console.error("[Storyboard] Character ref sheet failed:", err);
      }
    }

    // 2) Poster locked to the generated sheet (fallback: uploaded photos).
    let posterRefs = uploadedCharRefs;
    if (characterRefSheetUrl) {
      const sheetB64 = dataUriToBase64(characterRefSheetUrl);
      if (sheetB64) posterRefs = [sheetB64];
    }

    try {
      const r = await generateStoryboardPoster(
        buildPosterArgs(posterRefs.length > 0 ? posterRefs : undefined)
      );
      storyboardPosterUrl = r.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      warnings.push(`Storyboard Poster: ${msg}`);
      console.error("[Storyboard] Storyboard poster failed:", err);
    }
  } else {
    // OpenAI / DALL-E — no reference images; run in parallel for speed.
    const [charRefResult, posterResult] = await Promise.allSettled([
      breakdown.character_locks.length > 0
        ? generateCharacterRefSheet({
            characterLock: breakdown.character_locks[0] as CharacterLock,
            colorPalette: breakdown.style_guide.color_palette,
            provider,
            aspectRatio,
            quality,
          })
        : Promise.resolve(null),
      generateStoryboardPoster(buildPosterArgs()),
    ]);

    if (charRefResult.status === "fulfilled" && charRefResult.value) {
      characterRefSheetUrl = charRefResult.value.url;
    } else if (charRefResult.status === "rejected") {
      const msg = charRefResult.reason instanceof Error ? charRefResult.reason.message : "Unknown error";
      warnings.push(`Character Reference Sheet: ${msg}`);
      console.error("[Storyboard] Character ref sheet failed:", charRefResult.reason);
    }

    if (posterResult.status === "fulfilled" && posterResult.value) {
      storyboardPosterUrl = posterResult.value.url;
    } else if (posterResult.status === "rejected") {
      const msg = posterResult.reason instanceof Error ? posterResult.reason.message : "Unknown error";
      warnings.push(`Storyboard Poster: ${msg}`);
      console.error("[Storyboard] Storyboard poster failed:", posterResult.reason);
    }
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
      warnings,
    },
  };
}
