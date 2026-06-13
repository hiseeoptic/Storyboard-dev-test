"use server";

import { generateStoryboardBreakdown } from "@/services/ai-engine";
import {
  generateCharacterRefSheet,
  generateSegmentFrame,
  generateMasterBoard,
  dataUriToBase64,
} from "@/services/image-pipeline";
import { analyzeReferenceImages } from "@/services/image-analyzer";
import {
  buildVideoPromptText,
  buildSegmentVeoPrompt,
  type RefDescriptor,
} from "@/prompts";
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
  // Shot boards & the master board are multi-zone documents → always landscape.
  const boardAspect: AspectRatio = "16:9";
  const quality: ImageQuality = input.image_quality ?? "standard";
  const beatsPerSegment = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  const dialogueLanguage = input.dialogue_language ?? "Vietnamese";

  // Only Gemini supports image-to-image reference chaining (face lock).
  const canChain = provider === "gemini";

  // Labeled anchor references (the user's real uploads), in a FIXED order
  // so the prompt's "Image 1 = face, Image 2 = product, ..." matches the
  // images attached to the request. This is what makes Nano Banana obey.
  const faceImg = input.character_images?.[0]?.images?.[0];
  const productImg = input.product_images?.[0]?.images?.[0];
  const bgImg = input.background_images?.[0]?.images?.[0];

  // Vision-derived descriptions of the real uploads (reinforce the photos).
  const faceName = input.character_images?.[0]?.name;
  const productName = input.product_images?.[0]?.name;
  const faceDesc = faceName ? analyzedCharacters[faceName] : undefined;
  const productDesc = productName ? analyzedProducts[productName] : undefined;
  const bgDesc = analyzedBackground || undefined;

  const preserveRealFace = canChain && !!faceImg;

  // Character description for the scene text. When we have the real face
  // photo, DEFER identity to it (don't feed an invented face that fights
  // the photo) — only keep clothing/role from the script.
  const charDescForPoster = breakdown.character_locks
    .map(
      (c) =>
        `${c.name}: ${c.gender_age}, ${c.build}, skin ${c.skin_tone}, hair ${c.hair}, eyes ${c.eyes}, wearing ${c.costume}. ${c.signature_features}`
    )
    .join(". ");
  const mainCostume = breakdown.character_locks[0]?.costume ?? "casual clothes";
  const charDesc = preserveRealFace
    ? `the exact man shown in the attached portrait photo (keep his real face, eyeglasses and hair), wearing ${mainCostume}`
    : charDescForPoster || "the main character";

  // Forensic DNA + Scene Bible (repeated verbatim in every board/keyframe).
  const sceneBible = breakdown.scene_bible;
  const mainDna = breakdown.character_locks[0]?.dna;
  const productDnaText =
    breakdown.product_dna || productDesc || input.product_name || productName || undefined;

  // ─── Step 4a: Character Reference Sheet (locked to uploaded photos) ─
  if (breakdown.character_locks.length > 0) {
    try {
      const r = await generateCharacterRefSheet({
        characterLock: breakdown.character_locks[0] as CharacterLock,
        colorPalette: breakdown.style_guide.color_palette,
        sceneBible,
        provider,
        aspectRatio,
        quality,
        style: input.style,
        referenceImages: canChain && faceImg ? [{ base64: faceImg, mimeType: "image/jpeg" }] : undefined,
        references: canChain && faceImg ? [{ role: "face", description: faceDesc }] : undefined,
      });
      characterRefSheetUrl = r.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      warnings.push(`Character Reference Sheet: ${msg}`);
      console.error("[Storyboard] Character ref sheet failed:", err);
    }
  }

  // ─── Step 4a.5: Build the per-segment reference set ─────────────────
  // The generated CHARACTER REFERENCE SHEET becomes the primary identity
  // anchor that is fed into EVERY segment + the poster, so the character
  // is repeated across all shots (fixes Veo rendering the wrong person).
  // Veo/Gemini accept up to 3 reference images, so we cap at: character,
  // product, setting. The ref sheet already encodes the uploaded face, so
  // we lead with it; if it failed, we fall back to the raw face photo.
  const charSheetBase64 = characterRefSheetUrl
    ? dataUriToBase64(characterRefSheetUrl)
    : null;

  const segmentRefImages: { base64: string; mimeType?: string }[] = [];
  const segmentRefDescriptors: RefDescriptor[] = [];

  if (charSheetBase64) {
    segmentRefImages.push({
      base64: charSheetBase64.base64,
      mimeType: charSheetBase64.mimeType,
    });
    segmentRefDescriptors.push({ role: "character_sheet", description: charDescForPoster });
  } else if (faceImg) {
    segmentRefImages.push({ base64: faceImg, mimeType: "image/jpeg" });
    segmentRefDescriptors.push({ role: "face", description: faceDesc });
  }
  if (productImg && segmentRefImages.length < 3) {
    segmentRefImages.push({ base64: productImg, mimeType: "image/jpeg" });
    segmentRefDescriptors.push({ role: "product", description: productDesc });
  }
  if (bgImg && segmentRefImages.length < 3) {
    segmentRefImages.push({ base64: bgImg, mimeType: "image/jpeg" });
    segmentRefDescriptors.push({ role: "setting", description: bgDesc });
  }

  // Character ref for the scene/poster text. If we have a generated sheet,
  // defer identity to it; keep the locked appearance wording for the model.
  const charDescForShots =
    charSheetBase64 || preserveRealFace ? charDesc : charDescForPoster || "the main character";
  // Append the forensic DNA (with RGB) so every board/clip restates it verbatim.
  const charDescDna = [charDescForShots, mainDna].filter(Boolean).join(". ");

  // ─── Step 4b: Per-segment frames, anchored to the character sheet ───
  // Every segment references the SAME character sheet (+ product/setting)
  // so identity never drifts. Continuity is carried by the prompt's
  // continuity note, not by chaining a degraded previous frame.
  if (canChain) {
    for (let i = 0; i < breakdown.segments.length; i++) {
      const seg = breakdown.segments[i];
      if (!seg) continue;

      try {
        const r = await generateSegmentFrame({
          segmentNumber: seg.segment_number,
          firstFramePrompt: seg.first_frame_prompt,
          beats: seg.beats,
          beatsPerSegment,
          characterDescription: charDescDna,
          productDna: productDnaText,
          sceneBible,
          style: input.style,
          isFirst: i === 0,
          preserveRealFace: preserveRealFace || !!charSheetBase64,
          referenceImages: segmentRefImages.length > 0 ? segmentRefImages : undefined,
          references: segmentRefDescriptors.length > 0 ? segmentRefDescriptors : undefined,
          provider,
          aspectRatio: boardAspect,
          quality,
        });
        seg.first_frame_url = r.url;
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
          beatsPerSegment,
          characterDescription: charDescDna,
          productDna: productDnaText,
          sceneBible,
          style: input.style,
          isFirst: i === 0,
          provider,
          aspectRatio: boardAspect,
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

  // ─── Step 4c: Master Board (char sheet + captioned storyboard grid) ─
  try {
    const r = await generateMasterBoard({
      title: breakdown.title,
      totalDuration: breakdown.total_duration_seconds,
      segmentCount: breakdown.segments.length,
      moodTags: breakdown.mood_tags,
      segments: breakdown.segments.map((s) => ({
        segment_number: s.segment_number,
        title: s.title,
        action: s.beats?.[0]?.beat || s.title,
        dialogue: s.dialogue,
      })),
      characterDescription: charDescDna,
      characterName: breakdown.character_locks[0]?.name,
      style: input.style,
      colorPalette: breakdown.style_guide.color_palette,
      dialogueLanguage,
      provider,
      aspectRatio: boardAspect,
      quality,
      referenceImages:
        canChain && segmentRefImages.length > 0
          ? [segmentRefImages[0] as { base64: string; mimeType?: string }]
          : undefined,
    });
    storyboardPosterUrl = r.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    warnings.push(`Master Board: ${msg}`);
    console.error("[Storyboard] Master board failed:", err);
  }

  // ─── Step 5: Assembly guide (text for Veo / Seedance) ──────────────
  // Product DNA restated in every clip prompt so Veo keeps it intact.
  const productDescription = productDnaText;

  // Attach a full ready-to-paste Veo prompt to each segment.
  const palette = breakdown.style_guide.color_palette;
  for (const seg of breakdown.segments) {
    seg.full_prompt = buildSegmentVeoPrompt({
      characterDescription: charDescDna,
      productDescription,
      sceneBible,
      colorPalette: palette,
      motionPrompt: seg.motion_prompt,
      dialogue: seg.dialogue,
      dialogueLanguage,
    });
  }

  const videoPrompt = buildVideoPromptText({
    title: breakdown.title,
    characterDescription: charDescDna,
    productDescription,
    sceneBible,
    setting: input.setting || "Unspecified",
    style: input.style,
    aspectRatio,
    colorPalette: palette,
    dialogueLanguage,
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
