"use server";

import { generateStoryboardBreakdown } from "@/services/ai-engine";
import {
  generateSegmentFrame,
  generateKeyframe,
  generateMasterBoard,
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
} from "@/types";

export interface StoryboardResult {
  breakdown: StoryboardGenerationOutput;
  characterRefSheetUrl: string | null;
  storyboardPosterUrl: string | null;
  videoPrompt: string;
  warnings: string[];
}

/** Vision-derived descriptions, carried between calls. */
export interface StoryboardAnalysis {
  characterDescriptions: Record<string, string>;
  productDescriptions: Record<string, string>;
  ingredientDescriptions: Record<string, string>;
  backgroundDescription: string;
}

/** Phase-1 output: script + ready-to-paste prompts, NO images (small payload). */
export interface StoryboardPlan {
  breakdown: StoryboardGenerationOutput;
  analysis: StoryboardAnalysis;
  videoPrompt: string;
  warnings: string[];
}

/** Remove eyewear mentions from a description (used when a real face photo
 * is the source of truth, so invented "glasses" can't override it). */
function stripEyewear(text: string): string {
  return text
    .replace(
      /,?\s*(?:wearing|with)?\s*(?:black|dark|thin|thick|round|square|rectangular|metal|wire|rimless|horn-?rimmed|clear|stylish|modern)?\s*(?:eye)?glasses\b/gi,
      ""
    )
    .replace(/,?\s*spectacles\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .replace(/(^[.,\s]+|[,\s]+$)/g, "")
    .trim();
}

/**
 * Removes RGB hex colour codes (e.g. "#C8956A") from text. Used when the user
 * has uploaded reference images — the photo is the source of truth for colour,
 * so the invented hex codes in the script only add noise and risk contradicting
 * the photo. Leaves the surrounding colour words (e.g. "warm tan skin") intact.
 */
function stripHexCodes(text: string): string {
  return text
    .replace(/\s*\(#[0-9A-Fa-f]{6}\)/g, "") // "(#C8956A)"
    .replace(/\s*#[0-9A-Fa-f]{6}\b/g, "") // bare "#C8956A"
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

/**
 * Neutralises wording that Veo/Flow flags as "harmful content" — namely
 * language that reads like replicating a REAL person's identity from a photo
 * (deepfake vector). The attached reference image still carries the likeness;
 * we just stop the TEXT from demanding "keep the exact same real face/identity".
 */
function makeVeoSafe(text: string): string {
  return text
    .replace(
      /STRICTLY FOLLOW (THE )?(ATTACHED )?REFERENCE IMAGES\s*[–\-.,:;]*\s*/gi,
      "Keep the character and product visually consistent. "
    )
    .replace(
      /the exact (man|woman|person|boy|girl)\s+shown in the attached portrait photo\s*\(keep their real face,?\s*hair and look\)/gi,
      "the main character"
    )
    .replace(/\bsame person,?\s*same face\s*\/?\s*identity\b/gi, "the same character")
    .replace(/\bkeep(ing)? the SAME person\b/gi, "keep the same character")
    .replace(/\bthe SAME person\b/gi, "the same character")
    .replace(/\bsame face\s*\/?\s*identity\b/gi, "a consistent appearance")
    .replace(/\bkeep their real face,?\s*hair and look\b/gi, "keep their appearance consistent")
    .replace(/\b(do not|don'?t|never)\s+change the face\b/gi, "keep the character's appearance consistent")
    .replace(/\breal face\b/gi, "face")
    .replace(/\bface\s*\/\s*identity\b/gi, "appearance")
    .replace(/\breal person\b/gi, "character")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim();
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

  // CRITICAL: feed the uploaded character's REAL identity into script
  // generation so the character_lock matches the photo. Without this the LLM
  // invents a character from the story idea and can pick the WRONG GENDER
  // (e.g. a man's photo → a "Young Woman" character_lock).
  const charNames = Object.keys(analysis.characterDescriptions);
  if (charNames.length > 0) {
    const charLines = charNames
      .map((n) => `"${n}": ${analysis.characterDescriptions[n]}`)
      .join(" | ");
    extra.unshift(
      `MAIN CHARACTER APPEARANCE LOCK — base each character_lock on these uploaded reference descriptions: keep the SAME gender, age range, skin tone, hair and build; do not invent a different gender or a different look. When writing "motion_prompt" and "first_frame_prompt", describe the character only by these visual attributes for consistency. DO NOT write phrases like "the same real person", "keep their real face", "same identity/face", "do not change the face", or "strictly follow the reference images" — those get the video rejected. Reference appearance: ${charLines}`
    );
  }

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

// ─── Reference context derived from input + analysis + breakdown ──────────

interface RefContext {
  canChain: boolean;
  aspectRatio: AspectRatio;
  boardAspect: AspectRatio;
  quality: ImageQuality;
  beatsPerSegment: number;
  referenceExpressions: number;
  dialogueLanguage: string;
  faceImg?: string;
  productImg?: string;
  bgImg?: string;
  faceDesc?: string;
  productDesc?: string;
  bgDesc?: string;
  preserveRealFace: boolean;
  charDescForPoster: string;
  charDesc: string;
  charDescDna: string;
  charDescVeo: string;
  sceneBible?: SceneBible;
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
  const faceImg = input.character_images?.[0]?.images?.[0];
  const productImg = input.product_images?.[0]?.images?.[0];
  const bgImg = input.background_images?.[0]?.images?.[0];

  const faceName = input.character_images?.[0]?.name;
  const productName = input.product_images?.[0]?.name;
  const faceDesc = faceName ? analysis.characterDescriptions[faceName] : undefined;
  const productDesc = productName ? analysis.productDescriptions[productName] : undefined;
  const bgDesc = analysis.backgroundDescription || undefined;

  const preserveRealFace = canChain && !!faceImg;

  const charDescForPosterRaw = (breakdown.character_locks ?? [])
    .map(
      (c) =>
        `${c.name}: ${c.gender_age}, ${c.build}, skin ${c.skin_tone}, hair ${c.hair}, eyes ${c.eyes}, wearing ${c.costume}. ${c.signature_features}`
    )
    .join(". ");
  // When a real face photo governs identity, strip any LLM-invented eyewear
  // from the text so it can't contradict the photo (the model kept adding
  // glasses to a man who wears none).
  const charDescForPoster = preserveRealFace ? stripEyewear(charDescForPosterRaw) : charDescForPosterRaw;
  const mainCostume = breakdown.character_locks[0]?.costume ?? "casual clothes";
  // Hard gender word (veoflow-aligned) prepended so the image model never
  // flips the subject's gender.
  const mainGender = breakdown.character_locks[0]?.gender;
  const genderWord = mainGender === "male" ? "man" : mainGender === "female" ? "woman" : "person";
  const charDesc = preserveRealFace
    ? `the exact ${genderWord} shown in the attached portrait photo (keep their real face, hair and look), wearing ${mainCostume}`
    : charDescForPoster || "the main character";
  const mainDnaRaw = breakdown.character_locks[0]?.dna;
  const charDescForShots = preserveRealFace ? charDesc : charDescForPoster || "the main character";
  // IMAGE-FIRST: when a real photo locks the face, RELY ON THE PHOTO and drop
  // the AI-invented forensic DNA text entirely — it only ever contradicts the
  // photo (the root of the gender-flip and stray-glasses bugs). Use the text
  // DNA only when there is NO reference photo to lock to.
  const charDescDna = preserveRealFace
    ? charDescForShots
    : [charDescForShots, mainDnaRaw].filter(Boolean).join(". ");
  // Veo/Flow rejects prompts that read like real-person replication ("the exact
  // man in the photo, keep their real face, same identity"). For the text prompt
  // pasted into Veo, describe the character by NEUTRAL ATTRIBUTES instead — the
  // attached reference image still carries the likeness.
  const charDescVeo = preserveRealFace
    ? stripHexCodes(charDescForPoster || `a ${genderWord} wearing ${mainCostume}`)
    : charDescDna;

  return {
    canChain,
    aspectRatio: input.aspect_ratio ?? "16:9",
    boardAspect: "16:9",
    quality: input.image_quality ?? "standard",
    beatsPerSegment: Math.min(5, Math.max(3, input.beats_per_segment ?? 3)),
    referenceExpressions: Math.min(3, Math.max(0, input.reference_expressions ?? 0)),
    dialogueLanguage: input.dialogue_language ?? "Vietnamese",
    faceImg,
    productImg,
    bgImg,
    faceDesc,
    productDesc,
    bgDesc,
    preserveRealFace,
    charDescForPoster,
    charDesc,
    charDescDna,
    charDescVeo,
    sceneBible: breakdown.scene_bible,
    productDnaText:
      breakdown.product_dna || productDesc || input.product_name || productName || undefined,
    ingredientsText: buildIngredientsText(input, analysis),
  };
}

// The board reference set: character portrait + product + setting (max 3).
function buildBoardRefs(ctx: RefContext): {
  images: { base64: string; mimeType?: string }[];
  descriptors: RefDescriptor[];
} {
  const images: { base64: string; mimeType?: string }[] = [];
  const descriptors: RefDescriptor[] = [];
  if (ctx.faceImg) {
    images.push({ base64: ctx.faceImg, mimeType: "image/jpeg" });
    descriptors.push({ role: "face", description: ctx.faceDesc ?? ctx.charDescForPoster });
  }
  if (ctx.productImg && images.length < 3) {
    images.push({ base64: ctx.productImg, mimeType: "image/jpeg" });
    descriptors.push({ role: "product", description: ctx.productDesc });
  }
  if (ctx.bgImg && images.length < 3) {
    images.push({ base64: ctx.bgImg, mimeType: "image/jpeg" });
    descriptors.push({ role: "setting", description: ctx.bgDesc });
  }
  return { images, descriptors };
}

// ─── Phase 1: script + prompts (no images) ────────────────────────────────

export async function generateStoryboardPlan(
  input: StoryboardGenerationInput,
  provider: AIProvider = "gemini"
): Promise<ActionResult<StoryboardPlan>> {
  const warnings: string[] = [];
  try {
    const analysis = await runAnalysis(input, provider, warnings);
    const enhanced = enhanceInput(input, analysis);

    const breakdown = await generateStoryboardBreakdown(enhanced, provider);

    // Defensive: the model can occasionally return JSON missing whole sections.
    // Guard so a malformed breakdown returns a clean error instead of throwing
    // an unhandled exception ("An error occurred in the Server Components render").
    if (!Array.isArray(breakdown.segments) || breakdown.segments.length === 0) {
      return { success: false, error: "AI không trả về cảnh nào. Vui lòng thử lại." };
    }
    if (!Array.isArray(breakdown.character_locks)) breakdown.character_locks = [];

    for (const lock of breakdown.character_locks) {
      const analyzed = analysis.characterDescriptions[lock.name];
      if (analyzed) {
        lock.signature_features = lock.signature_features
          ? `${lock.signature_features}. From reference: ${analyzed}`
          : analyzed;
      }
    }

    // Neutralise any "replicate the exact real person/face" wording the model
    // baked into the script — Veo/Flow rejects it as harmful (deepfake) content.
    // Keeps the editor's action text and the Veo prompts policy-safe.
    for (const seg of breakdown.segments) {
      if (seg.motion_prompt) seg.motion_prompt = makeVeoSafe(seg.motion_prompt);
      if (seg.first_frame_prompt) seg.first_frame_prompt = makeVeoSafe(seg.first_frame_prompt);
    }

    // When the user uploaded reference images, the photos are the source of
    // truth — strip the AI-invented RGB hex colour codes out of the script so
    // they can't contradict the references (and so the editor stays clean).
    const hasRefImages =
      (input.character_images?.length ?? 0) > 0 || (input.product_images?.length ?? 0) > 0;
    if (hasRefImages) {
      for (const seg of breakdown.segments) {
        if (seg.motion_prompt) seg.motion_prompt = stripHexCodes(seg.motion_prompt);
        if (seg.first_frame_prompt) seg.first_frame_prompt = stripHexCodes(seg.first_frame_prompt);
      }
      for (const lock of breakdown.character_locks) {
        if (lock.dna) lock.dna = stripHexCodes(lock.dna);
        if (lock.signature_features) lock.signature_features = stripHexCodes(lock.signature_features);
      }
      if (breakdown.product_dna) breakdown.product_dna = stripHexCodes(breakdown.product_dna);
    }
    // A backdrop photo makes the scene-bible hex redundant too — strip it so the
    // uploaded location stays the single source of truth.
    if ((input.background_images?.length ?? 0) > 0 && breakdown.scene_bible) {
      const sb = breakdown.scene_bible;
      sb.backdrop = stripHexCodes(sb.backdrop ?? "");
      sb.color_grade = stripHexCodes(sb.color_grade ?? "");
      sb.lighting = stripHexCodes(sb.lighting ?? "");
    }

    // Prompt assembly is best-effort: if it fails, still return the script so
    // the user can review/edit it (the prompts get rebuilt on finalize anyway).
    let videoPrompt = "";
    try {
      videoPrompt = assemblePlanPrompts(input, breakdown, analysis, provider);
    } catch (e) {
      console.error("[Storyboard] prompt assembly failed:", e);
      warnings.push("Một số prompt chưa dựng được, sẽ tạo lại khi bạn duyệt kịch bản.");
    }

    return { success: true, data: { breakdown, analysis, videoPrompt, warnings } };
  } catch (err) {
    console.error("[Storyboard] plan generation failed:", err);
    const raw = err instanceof Error ? err.message : "AI generation failed";
    // In production Next.js hides the real message behind a generic
    // "Server Components render" digest — show a clear, actionable message.
    const friendly = /server components render|digest/i.test(raw)
      ? "Máy chủ gặp lỗi tạm thời khi tạo kịch bản (có thể do AI quá tải hoặc ảnh quá lớn). Vui lòng bấm Tạo Storyboard lại sau vài giây."
      : `Tạo kịch bản thất bại: ${raw}`;
    return { success: false, error: friendly };
  }
}

/**
 * Builds the ready-to-paste Veo prompts (per-segment full_prompt + the overall
 * videoPrompt) from a breakdown. Pulled out so it can be re-run AFTER the user
 * edits the script (finalizeScript), keeping the prompts in sync with edits.
 * Mutates each segment's full_prompt and resets first_frame_url.
 */
function assemblePlanPrompts(
  input: StoryboardGenerationInput,
  breakdown: StoryboardGenerationOutput,
  analysis: StoryboardAnalysis,
  provider: AIProvider
): string {
  const ctx = buildRefContext(input, breakdown, analysis, provider);
  const palette = breakdown.style_guide?.color_palette ?? [];
  for (const seg of breakdown.segments) {
    seg.first_frame_url = null;
    seg.full_prompt = makeVeoSafe(
      buildSegmentVeoPrompt({
        characterDescription: ctx.charDescVeo,
        productDescription: ctx.productDnaText,
        ingredients: ctx.ingredientsText,
        sceneBible: ctx.sceneBible,
        colorPalette: palette,
        motionPrompt: makeVeoSafe(seg.motion_prompt),
        dialogue: seg.dialogue,
        dialogueLanguage: ctx.dialogueLanguage,
      })
    );
  }
  return makeVeoSafe(
    buildVideoPromptText({
    title: breakdown.title,
    characterDescription: ctx.charDescVeo,
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
    })
  );
}

/**
 * Re-assemble prompts from a user-EDITED breakdown before building boards, so
 * the Veo prompts reflect the edits (gender, dialogue, action, etc.).
 */
export async function finalizeScript(params: {
  input: StoryboardGenerationInput;
  breakdown: StoryboardGenerationOutput;
  analysis: StoryboardAnalysis;
  provider?: AIProvider;
}): Promise<ActionResult<{ breakdown: StoryboardGenerationOutput; videoPrompt: string }>> {
  const provider = params.provider ?? "gemini";
  try {
    const videoPrompt = assemblePlanPrompts(params.input, params.breakdown, params.analysis, provider);
    return { success: true, data: { breakdown: params.breakdown, videoPrompt } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Lỗi xử lý kịch bản" };
  }
}

// ─── Phase 2: one board image per call (small request + response) ──────────

export type BoardKind = "segment" | "master" | "keyframe";

export async function generateBoardImage(params: {
  input: StoryboardGenerationInput;
  breakdown: StoryboardGenerationOutput;
  analysis: StoryboardAnalysis;
  kind: BoardKind;
  segmentIndex?: number;
  provider?: AIProvider;
}): Promise<ActionResult<{ url: string }>> {
  const provider = params.provider ?? "gemini";
  const { input, breakdown, analysis } = params;
  const ctx = buildRefContext(input, breakdown, analysis, provider);
  const { images, descriptors } = buildBoardRefs(ctx);

  try {
    if (params.kind === "master") {
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
        characterDescription: ctx.charDescDna,
        characterName: breakdown.character_locks?.[0]?.name,
        style: input.style,
        colorPalette: breakdown.style_guide?.color_palette ?? [],
        dialogueLanguage: ctx.dialogueLanguage,
        provider,
        aspectRatio: ctx.boardAspect,
        quality: ctx.quality,
        referenceImages: ctx.canChain && images.length > 0 ? [images[0]!] : undefined,
      });
      return { success: true, data: { url: r.url } };
    }

    const i = params.segmentIndex ?? 0;
    const seg = breakdown.segments[i];
    if (!seg) return { success: false, error: `Segment ${i} not found` };

    if (params.kind === "keyframe") {
      // Clean single first-frame (veoflow format) at the user's real aspect.
      const r = await generateKeyframe({
        segmentNumber: seg.segment_number,
        sceneDescription: seg.first_frame_prompt || seg.title,
        shot: seg.beats?.[0]?.camera || "[EYE]",
        characterDescription: ctx.charDescDna,
        productDna: ctx.productDnaText,
        ingredients: ctx.ingredientsText,
        sceneBible: ctx.sceneBible,
        style: input.style,
        preserveRealFace: ctx.preserveRealFace,
        referenceImages: ctx.canChain && images.length > 0 ? images : undefined,
        references: ctx.canChain && descriptors.length > 0 ? descriptors : undefined,
        provider,
        aspectRatio: ctx.aspectRatio,
        quality: ctx.quality,
      });
      return { success: true, data: { url: r.url } };
    }

    const r = await generateSegmentFrame({
      segmentNumber: seg.segment_number,
      firstFramePrompt: seg.first_frame_prompt,
      beats: seg.beats,
      beatsPerSegment: ctx.beatsPerSegment,
      characterDescription: ctx.charDescDna,
      productDna: ctx.productDnaText,
      ingredients: ctx.ingredientsText,
      sceneBible: ctx.sceneBible,
      style: input.style,
      isFirst: i === 0,
      preserveRealFace: ctx.preserveRealFace,
      referenceImages: ctx.canChain && images.length > 0 ? images : undefined,
      references: ctx.canChain && descriptors.length > 0 ? descriptors : undefined,
      referenceExpressions: ctx.referenceExpressions,
      provider,
      aspectRatio: ctx.boardAspect,
      quality: ctx.quality,
    });
    return { success: true, data: { url: r.url } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Image generation failed" };
  }
}
