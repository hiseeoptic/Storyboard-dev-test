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
  SceneBible,
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

/** Vision-derived descriptions, carried between the two generation phases. */
export interface StoryboardAnalysis {
  characterDescriptions: Record<string, string>;
  productDescriptions: Record<string, string>;
  ingredientDescriptions: Record<string, string>;
  backgroundDescription: string;
}

/** Phase-1 output: the script + a character sheet to review before building. */
export interface StoryboardDraft {
  breakdown: StoryboardGenerationOutput;
  analysis: StoryboardAnalysis;
  characterRefSheetUrl: string | null;
  warnings: string[];
}

// ─── Shared: vision analysis of all uploads ───────────────────────────────

async function runAnalysis(
  input: StoryboardGenerationInput,
  provider: AIProvider,
  warnings: string[]
): Promise<StoryboardAnalysis> {
  const analysis: StoryboardAnalysis = {
    characterDescriptions: {},
    productDescriptions: {},
    ingredientDescriptions: {},
    backgroundDescription: "",
  };

  const hasImages =
    (input.character_images?.length ?? 0) > 0 ||
    (input.product_images?.length ?? 0) > 0 ||
    (input.ingredient_images?.length ?? 0) > 0 ||
    (input.background_images?.length ?? 0) > 0;

  if (hasImages) {
    try {
      const a = await analyzeReferenceImages({
        characters: input.character_images,
        products: input.product_images,
        ingredients: input.ingredient_images,
        backgrounds: input.background_images,
        provider,
      });
      analysis.characterDescriptions = a.characterDescriptions;
      analysis.productDescriptions = a.productDescriptions;
      analysis.ingredientDescriptions = a.ingredientDescriptions;
      analysis.backgroundDescription = a.backgroundDescription;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      warnings.push(`Image analysis failed: ${msg}`);
      console.error("[Storyboard] Image analysis failed:", err);
    }
  }

  // Merge text-based character descriptions with analyzed ones.
  if (input.character_descriptions) {
    for (const char of input.character_descriptions) {
      const existing = analysis.characterDescriptions[char.name];
      if (existing) {
        analysis.characterDescriptions[char.name] = `${existing}. Additional: ${char.appearance}`;
      } else if (char.appearance) {
        analysis.characterDescriptions[char.name] = char.appearance;
      }
    }
  }

  return analysis;
}

/** Named-ingredient text "name (desc); name2 (desc2)" for prompts. */
function buildIngredientsText(
  input: StoryboardGenerationInput,
  analysis: StoryboardAnalysis
): string | undefined {
  const parts: string[] = [];
  for (const ing of input.ingredient_images ?? []) {
    const desc = analysis.ingredientDescriptions[ing.name] || ing.description;
    parts.push(desc ? `${ing.name} (${desc})` : ing.name);
  }
  return parts.length > 0 ? parts.join("; ") : undefined;
}

// ─── Shared: enhance the script input with analyzed context ───────────────

function enhanceInput(
  input: StoryboardGenerationInput,
  analysis: StoryboardAnalysis
): StoryboardGenerationInput {
  const enhanced = { ...input };

  if (analysis.backgroundDescription) {
    enhanced.setting = enhanced.setting
      ? `${enhanced.setting}. Visual reference: ${analysis.backgroundDescription}`
      : analysis.backgroundDescription;
  }

  const extra: string[] = [];
  const productNames = Object.keys(analysis.productDescriptions);
  if (productNames.length > 0) {
    extra.push(
      `Products to feature: ${productNames
        .map((n) => `"${n}": ${analysis.productDescriptions[n]}`)
        .join(". ")}`
    );
  }
  const ingredientsText = buildIngredientsText(input, analysis);
  if (ingredientsText) {
    extra.push(`Named ingredients/components to show by name: ${ingredientsText}`);
  }
  if (extra.length > 0) {
    enhanced.custom_instructions = [enhanced.custom_instructions, ...extra]
      .filter(Boolean)
      .join(". ");
  }

  return enhanced;
}

// ─── Shared: reference context derived from input + analysis + breakdown ──

interface RefContext {
  canChain: boolean;
  aspectRatio: AspectRatio;
  boardAspect: AspectRatio;
  quality: ImageQuality;
  beatsPerSegment: number;
  dialogueLanguage: string;
  faceImgs: string[];
  faceImg?: string;
  productImg?: string;
  bgImg?: string;
  faceDesc?: string;
  productDesc?: string;
  bgDesc?: string;
  preserveRealFace: boolean;
  charDescForPoster: string;
  charDesc: string;
  sceneBible?: SceneBible;
  mainDna?: string;
  productDnaText?: string;
  ingredientsText?: string;
}

function buildRefContext(
  input: StoryboardGenerationInput,
  breakdown: StoryboardGenerationOutput,
  analysis: StoryboardAnalysis,
  provider: AIProvider
): RefContext {
  const canChain = provider === "gemini";
  const faceImgs = (input.character_images?.[0]?.images ?? []).slice(0, 3);
  const faceImg = faceImgs[0];
  const productImg = input.product_images?.[0]?.images?.[0];
  const bgImg = input.background_images?.[0]?.images?.[0];

  const faceName = input.character_images?.[0]?.name;
  const productName = input.product_images?.[0]?.name;
  const faceDesc = faceName ? analysis.characterDescriptions[faceName] : undefined;
  const productDesc = productName ? analysis.productDescriptions[productName] : undefined;
  const bgDesc = analysis.backgroundDescription || undefined;

  const preserveRealFace = canChain && !!faceImg;

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

  return {
    canChain,
    aspectRatio: input.aspect_ratio ?? "16:9",
    boardAspect: "16:9",
    quality: input.image_quality ?? "standard",
    beatsPerSegment: Math.min(5, Math.max(3, input.beats_per_segment ?? 3)),
    dialogueLanguage: input.dialogue_language ?? "Vietnamese",
    faceImgs,
    faceImg,
    productImg,
    bgImg,
    faceDesc,
    productDesc,
    bgDesc,
    preserveRealFace,
    charDescForPoster,
    charDesc,
    sceneBible: breakdown.scene_bible,
    mainDna: breakdown.character_locks[0]?.dna,
    productDnaText:
      breakdown.product_dna || productDesc || input.product_name || productName || undefined,
    ingredientsText: buildIngredientsText(input, analysis),
  };
}

// ─── Shared: generate the character reference sheet ───────────────────────

async function genCharSheet(
  input: StoryboardGenerationInput,
  breakdown: StoryboardGenerationOutput,
  ctx: RefContext,
  provider: AIProvider,
  warnings: string[]
): Promise<string | null> {
  if (breakdown.character_locks.length === 0) return null;
  try {
    const refImgs =
      ctx.canChain && ctx.faceImgs.length > 0
        ? ctx.faceImgs.map((base64) => ({ base64, mimeType: "image/jpeg" }))
        : undefined;
    const r = await generateCharacterRefSheet({
      characterLock: breakdown.character_locks[0] as CharacterLock,
      colorPalette: breakdown.style_guide.color_palette,
      sceneBible: ctx.sceneBible,
      provider,
      aspectRatio: ctx.aspectRatio,
      quality: ctx.quality,
      style: input.style,
      referenceImages: refImgs,
      references:
        ctx.canChain && ctx.faceImg ? [{ role: "face", description: ctx.faceDesc }] : undefined,
    });
    return r.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    warnings.push(`Character Reference Sheet: ${msg}`);
    console.error("[Storyboard] Character ref sheet failed:", err);
    return null;
  }
}

// ─── Phase 1: analyse + script + character sheet (for review) ─────────────

export async function generateStoryboardDraft(
  input: StoryboardGenerationInput,
  provider: AIProvider = "gemini"
): Promise<ActionResult<StoryboardDraft>> {
  const warnings: string[] = [];

  const analysis = await runAnalysis(input, provider, warnings);
  const enhanced = enhanceInput(input, analysis);

  let breakdown: StoryboardGenerationOutput;
  try {
    breakdown = await generateStoryboardBreakdown(enhanced, provider);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "AI generation failed" };
  }

  // Merge analyzed character descriptions into character_locks.
  for (const lock of breakdown.character_locks) {
    const analyzed = analysis.characterDescriptions[lock.name];
    if (analyzed) {
      lock.signature_features = lock.signature_features
        ? `${lock.signature_features}. From reference: ${analyzed}`
        : analyzed;
    }
  }

  const ctx = buildRefContext(input, breakdown, analysis, provider);
  const characterRefSheetUrl = await genCharSheet(input, breakdown, ctx, provider, warnings);

  return { success: true, data: { breakdown, analysis, characterRefSheetUrl, warnings } };
}

// ─── Regenerate just the character sheet (review loop) ────────────────────

export async function regenerateCharacterReference(
  input: StoryboardGenerationInput,
  breakdown: StoryboardGenerationOutput,
  analysis: StoryboardAnalysis,
  provider: AIProvider = "gemini"
): Promise<ActionResult<{ characterRefSheetUrl: string | null; warnings: string[] }>> {
  const warnings: string[] = [];
  const ctx = buildRefContext(input, breakdown, analysis, provider);
  const characterRefSheetUrl = await genCharSheet(input, breakdown, ctx, provider, warnings);
  if (!characterRefSheetUrl) {
    return { success: false, error: warnings[0] || "Character sheet generation failed" };
  }
  return { success: true, data: { characterRefSheetUrl, warnings } };
}

// ─── Phase 2: boards + master board + assembly guide ──────────────────────

export async function finalizeStoryboard(
  input: StoryboardGenerationInput,
  breakdown: StoryboardGenerationOutput,
  analysis: StoryboardAnalysis,
  characterRefSheetUrl: string | null,
  provider: AIProvider = "gemini"
): Promise<ActionResult<StoryboardResult>> {
  const warnings: string[] = [];
  const ctx = buildRefContext(input, breakdown, analysis, provider);
  let storyboardPosterUrl: string | null = null;

  // Reference set fed into every board: character sheet (or face) + product + setting.
  const charSheetBase64 = characterRefSheetUrl ? dataUriToBase64(characterRefSheetUrl) : null;
  const segmentRefImages: { base64: string; mimeType?: string }[] = [];
  const segmentRefDescriptors: RefDescriptor[] = [];

  if (charSheetBase64) {
    segmentRefImages.push({ base64: charSheetBase64.base64, mimeType: charSheetBase64.mimeType });
    segmentRefDescriptors.push({ role: "character_sheet", description: ctx.charDescForPoster });
  } else if (ctx.faceImg) {
    segmentRefImages.push({ base64: ctx.faceImg, mimeType: "image/jpeg" });
    segmentRefDescriptors.push({ role: "face", description: ctx.faceDesc });
  }
  if (ctx.productImg && segmentRefImages.length < 3) {
    segmentRefImages.push({ base64: ctx.productImg, mimeType: "image/jpeg" });
    segmentRefDescriptors.push({ role: "product", description: ctx.productDesc });
  }
  if (ctx.bgImg && segmentRefImages.length < 3) {
    segmentRefImages.push({ base64: ctx.bgImg, mimeType: "image/jpeg" });
    segmentRefDescriptors.push({ role: "setting", description: ctx.bgDesc });
  }

  const charDescForShots =
    charSheetBase64 || ctx.preserveRealFace
      ? ctx.charDesc
      : ctx.charDescForPoster || "the main character";
  const charDescDna = [charDescForShots, ctx.mainDna].filter(Boolean).join(". ");

  // ─── Per-segment boards ───────────────────────────────────────────
  if (ctx.canChain) {
    for (let i = 0; i < breakdown.segments.length; i++) {
      const seg = breakdown.segments[i];
      if (!seg) continue;
      try {
        const r = await generateSegmentFrame({
          segmentNumber: seg.segment_number,
          firstFramePrompt: seg.first_frame_prompt,
          beats: seg.beats,
          beatsPerSegment: ctx.beatsPerSegment,
          characterDescription: charDescDna,
          productDna: ctx.productDnaText,
          ingredients: ctx.ingredientsText,
          sceneBible: ctx.sceneBible,
          style: input.style,
          isFirst: i === 0,
          preserveRealFace: ctx.preserveRealFace || !!charSheetBase64,
          referenceImages: segmentRefImages.length > 0 ? segmentRefImages : undefined,
          references: segmentRefDescriptors.length > 0 ? segmentRefDescriptors : undefined,
          provider,
          aspectRatio: ctx.boardAspect,
          quality: ctx.quality,
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
    const results = await Promise.allSettled(
      breakdown.segments.map((seg, i) =>
        generateSegmentFrame({
          segmentNumber: seg.segment_number,
          firstFramePrompt: seg.first_frame_prompt,
          beats: seg.beats,
          beatsPerSegment: ctx.beatsPerSegment,
          characterDescription: charDescDna,
          productDna: ctx.productDnaText,
          ingredients: ctx.ingredientsText,
          sceneBible: ctx.sceneBible,
          style: input.style,
          isFirst: i === 0,
          provider,
          aspectRatio: ctx.boardAspect,
          quality: ctx.quality,
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

  // ─── Master board (presentation) ──────────────────────────────────
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
      dialogueLanguage: ctx.dialogueLanguage,
      provider,
      aspectRatio: ctx.boardAspect,
      quality: ctx.quality,
      referenceImages:
        ctx.canChain && segmentRefImages.length > 0
          ? [segmentRefImages[0] as { base64: string; mimeType?: string }]
          : undefined,
    });
    storyboardPosterUrl = r.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    warnings.push(`Master Board: ${msg}`);
    console.error("[Storyboard] Master board failed:", err);
  }

  // ─── Assembly guide + per-segment ready-to-paste Veo prompts ──────
  const palette = breakdown.style_guide.color_palette;
  for (const seg of breakdown.segments) {
    seg.full_prompt = buildSegmentVeoPrompt({
      characterDescription: charDescDna,
      productDescription: ctx.productDnaText,
      ingredients: ctx.ingredientsText,
      sceneBible: ctx.sceneBible,
      colorPalette: palette,
      motionPrompt: seg.motion_prompt,
      dialogue: seg.dialogue,
      dialogueLanguage: ctx.dialogueLanguage,
    });
  }

  const videoPrompt = buildVideoPromptText({
    title: breakdown.title,
    characterDescription: charDescDna,
    productDescription: ctx.productDnaText,
    ingredients: ctx.ingredientsText,
    sceneBible: ctx.sceneBible,
    setting: input.setting || "Unspecified",
    style: input.style,
    aspectRatio: ctx.aspectRatio,
    colorPalette: palette,
    dialogueLanguage: ctx.dialogueLanguage,
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
    data: { breakdown, characterRefSheetUrl, storyboardPosterUrl, videoPrompt, warnings },
  };
}

// ─── One-shot (draft + finalize) for callers that don't review ────────────

export async function generateFullStoryboard(
  input: StoryboardGenerationInput,
  provider: AIProvider = "gemini"
): Promise<ActionResult<StoryboardResult>> {
  const draft = await generateStoryboardDraft(input, provider);
  if (!draft.success) return draft;
  const fin = await finalizeStoryboard(
    input,
    draft.data.breakdown,
    draft.data.analysis,
    draft.data.characterRefSheetUrl,
    provider
  );
  if (!fin.success) return fin;
  fin.data.warnings = [...draft.data.warnings, ...fin.data.warnings];
  return fin;
}
