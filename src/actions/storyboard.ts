"use server";

import { generateStoryboardBreakdown } from "@/services/ai-engine";
import {
  generateCharacterRefSheet,
  generateSegmentFrame,
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
  provider: AIProvider = "gemini"
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

  // ─── Step 3: Setup ─────────────────────────────────────────────────
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

  // Uploaded product photos (to feature the real product in scenes).
  const uploadedProductRefs = (input.product_images ?? [])
    .flatMap((p) => p.images.slice(0, 1))
    .slice(0, 2)
    .map((base64) => ({ base64, mimeType: "image/jpeg" }));

  const preserveRealFace = canChain && uploadedCharRefs.length > 0;

  const charDescForPoster = breakdown.character_locks
    .map(
      (c) =>
        `${c.name}: ${c.gender_age}, ${c.build}, skin ${c.skin_tone}, hair ${c.hair}, eyes ${c.eyes}, wearing ${c.costume}. ${c.signature_features}`
    )
    .join(". ");
  const charDesc = charDescForPoster || "the main character";

  // ─── Step 4a: Character Reference Sheet (locked to uploaded photos) ─
  if (breakdown.character_locks.length > 0) {
    try {
      const r = await generateCharacterRefSheet({
        characterLock: breakdown.character_locks[0] as CharacterLock,
        colorPalette: breakdown.style_guide.color_palette,
        provider,
        aspectRatio,
        quality,
        style: input.style,
        referenceImages:
          canChain && uploadedCharRefs.length > 0 ? uploadedCharRefs : undefined,
      });
      characterRefSheetUrl = r.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      warnings.push(`Character Reference Sheet: ${msg}`);
      console.error("[Storyboard] Character ref sheet failed:", err);
    }
  }

  // Base reference for the very first frame: the ref sheet (face) + product.
  let baseRef: { base64: string; mimeType?: string }[] = [...uploadedCharRefs];
  if (characterRefSheetUrl) {
    const sheetB64 = dataUriToBase64(characterRefSheetUrl);
    if (sheetB64) baseRef = [sheetB64];
  }
  // Always include product photos so the real product appears in scenes.
  baseRef = [...baseRef, ...uploadedProductRefs];

  // ─── Step 4b: Per-segment first frames (seamless chaining) ─────────
  if (canChain) {
    // Sequential: each frame references the previous one for continuity.
    let prevFrameRef: { base64: string; mimeType?: string } | null = null;

    for (let i = 0; i < breakdown.segments.length; i++) {
      const seg = breakdown.segments[i];
      if (!seg) continue;

      // Reference: previous frame (continuity) + face + product refs.
      const refs: { base64: string; mimeType?: string }[] = [];
      if (prevFrameRef) refs.push(prevFrameRef);
      refs.push(...baseRef);

      try {
        const r = await generateSegmentFrame({
          segmentNumber: seg.segment_number,
          firstFramePrompt: seg.first_frame_prompt,
          beats: seg.beats,
          characterDescription: charDesc,
          style: input.style,
          isFirst: i === 0,
          preserveRealFace,
          referenceImages: refs.length > 0 ? refs.slice(0, 4) : undefined,
          provider,
          aspectRatio,
          quality,
        });
        seg.first_frame_url = r.url;

        const b64 = dataUriToBase64(r.url);
        if (b64) prevFrameRef = b64;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        warnings.push(`Segment ${seg.segment_number} frame: ${msg}`);
        console.error(`[Storyboard] Segment ${seg.segment_number} frame failed:`, err);
        seg.first_frame_url = null;
      }
    }
  } else {
    // OpenAI / DALL-E — no chaining; generate frames in parallel.
    const results = await Promise.allSettled(
      breakdown.segments.map((seg, i) =>
        generateSegmentFrame({
          segmentNumber: seg.segment_number,
          firstFramePrompt: seg.first_frame_prompt,
          beats: seg.beats,
          characterDescription: charDesc,
          style: input.style,
          isFirst: i === 0,
          provider,
          aspectRatio,
          quality,
        })
      )
    );
    results.forEach((res, i) => {
      const seg = breakdown.segments[i];
      if (!seg) return;
      if (res.status === "fulfilled") {
        seg.first_frame_url = res.value.url;
      } else {
        const msg = res.reason instanceof Error ? res.reason.message : "Unknown error";
        warnings.push(`Segment ${seg.segment_number} frame: ${msg}`);
        console.error(`[Storyboard] Segment ${seg.segment_number} frame failed:`, res.reason);
        seg.first_frame_url = null;
      }
    });
  }

  // ─── Step 4c: Overview poster (presentation) ───────────────────────
  try {
    const r = await generateStoryboardPoster({
      title: breakdown.title,
      totalDuration: breakdown.total_duration_seconds,
      segmentCount: breakdown.segments.length,
      moodTags: breakdown.mood_tags,
      segments: breakdown.segments.map((s) => ({
        segment_number: s.segment_number,
        title: s.title,
        summary: s.beats?.[0]?.beat || s.motion_prompt || s.title,
        role: s.marketing_role,
      })),
      characterDescription: charDesc,
      style: input.style,
      colorPalette: breakdown.style_guide.color_palette,
      provider,
      aspectRatio,
      quality,
      referenceImages: canChain && baseRef[0] ? [baseRef[0]] : undefined,
    });
    storyboardPosterUrl = r.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    warnings.push(`Storyboard Poster: ${msg}`);
    console.error("[Storyboard] Storyboard poster failed:", err);
  }

  // ─── Step 5: Assembly guide (text for Veo / Seedance) ──────────────
  const videoPrompt = buildVideoPromptText({
    title: breakdown.title,
    characterDescription: charDesc,
    setting: input.setting || "Unspecified",
    style: input.style,
    aspectRatio,
    colorPalette: breakdown.style_guide.color_palette,
    marketing: breakdown.marketing_structure,
    segments: breakdown.segments.map((s) => ({
      segment_number: s.segment_number,
      title: s.title,
      role: s.marketing_role,
      duration_seconds: s.duration_seconds,
      motion_prompt: s.motion_prompt,
      dialogue: s.dialogue,
      continuity_note: s.continuity_note,
      beats: s.beats,
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
