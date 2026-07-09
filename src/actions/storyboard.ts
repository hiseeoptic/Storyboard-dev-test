"use server";

import {
  generateScript,
  generateStoryboardBreakdown,
  rewriteStoryboardSegment,
} from "@/services/ai-engine";
import {
  generateSegmentFrame,
  generateKeyframe,
  generateMasterBoard,
} from "@/services/image-pipeline";
import { analyzeReferenceImages } from "@/services/image-analyzer";
import {
  buildVideoPromptText,
  buildSegmentVeoPrompt,
  genreAmbientAudio,
  isPhotoStyle,
  type RefDescriptor,
} from "@/prompts";
import type {
  ActionResult,
  AIProvider,
  AspectRatio,
  CharacterLock,
  ImageQuality,
  SceneBible,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  VideoSegment,
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
      "Keep the character's appearance consistent. "
    )
    .replace(
      /the exact (man|woman|person|boy|girl)\s+shown in the attached portrait photo\s*\(keep their real face,?\s*hair and look\)/gi,
      "the main character"
    )
    .replace(/\bsame person,?\s*same face\s*\/?\s*identity\b/gi, "the same character")
    .replace(/\bkeep(ing)? the SAME person\b/gi, "keep the same character")
    // "the SAME young woman / same older man / the same individual" → character
    .replace(/\bthe SAME\s+(young\s+|older\s+|old\s+|middle-aged\s+)?(woman|man|girl|boy|lady|guy|individual|person|female|male)\b/gi, "the same character")
    .replace(/\bthe SAME person\b/gi, "the same character")
    // "with her/his exact face", "her exact face", "exact face" → consistent face
    .replace(/\bwith (her|his|their)\s+exact\s+face\b/gi, "with a consistent face")
    .replace(/\b(her|his|their)\s+exact\s+face\b/gi, "a consistent face")
    .replace(/\bexact\s+face\b/gi, "face")
    // real-person / recognisability / reference-copy triggers
    .replace(/\bmatching the attached reference images?(?:\(s\))?/gi, "consistent with the reference")
    .replace(/\bthese real subjects\b/gi, "these characters")
    .replace(/\breal subjects\b/gi, "characters")
    .replace(/\b(clearly\s+)?recognizable\b/gi, "consistent")
    .replace(/\b(clearly\s+)?recognisable\b/gi, "consistent")
    .replace(/\b(do not|don'?t|never)\s+invent a different (face|person|individual)\b/gi, "keep the character consistent")
    .replace(/\bkeep (his|her|their) real face\b/gi, "keep their appearance consistent")
    .replace(/\bsame face\s*\/?\s*identity\b/gi, "a consistent appearance")
    .replace(/\bkeep their real face,?\s*hair and look\b/gi, "keep their appearance consistent")
    .replace(/\b(do not|don'?t|never)\s+change the face\b/gi, "keep the character's appearance consistent")
    .replace(/\breal face\b/gi, "face")
    .replace(/\bface\s*\/\s*identity\b/gi, "appearance")
    .replace(/\breal person\b/gi, "character")
    // Scrub celebrity / public-figure references — these make Veo/Flow reject
    // the clip as a real-person likeness.
    .replace(
      /\b(resembl\w+|looks?\s+like|similar\s+to|reminiscent\s+of|in the style of)\s+[^.,;]*\b(celebrit\w+|famous|public figure|star|idol|actor|actress|singer|influencer)\b[^.,;]*/gi,
      "an ordinary everyday appearance"
    )
    .replace(/\b(a\s+)?(celebrity|public figure|famous person|movie star|pop star|k-?pop idol|superstar)\b/gi, "an ordinary person")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim();
}

/**
 * Builds ONE clean, concise character line for the Veo prompt from the
 * structured lock fields. Avoids the bloat that confused the model: duplicated
 * field nouns ("skin warm tan skin"), the truncated vision "From reference: …"
 * fragment, and the verbose "Additional: ABSOLUTE source of truth …" text.
 */
function buildCleanCharLine(lock?: CharacterLock): string {
  if (!lock) return "";
  // Keep only the human-written signature, not the appended vision/force text.
  const sig = ((lock.signature_features || "").split(/\.\s*(?:from reference|additional)\b/i)[0] ?? "").trim();
  const attrs = [lock.gender_age, lock.build, lock.skin_tone, lock.hair, lock.eyes]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const head = [lock.name, attrs, lock.costume ? `wearing ${lock.costume}` : ""]
    .filter(Boolean)
    .join(", ");
  // Forensic realism locks (ported from veoflow-web): fold real skin texture,
  // eye detail and true wardrobe materials into the description so faces read
  // human (not CGI) and objects (leather, denim, metal) read real in every clip.
  const realism = [lock.skin_texture, lock.eye_details, lock.wardrobe_materials]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(". ");
  const base = sig ? `${head}. ${sig}` : head;
  return realism ? `${base}. ${realism}` : base;
}

import { defaultVoiceFor, findLawViolations } from "@/lib/laws";

// CAST-SYNC: resolve a segment's characters_in_scene to their locks (in the
// listed order). Empty/missing list or unmatched names → empty array, and the
// callers fall back to the legacy single-main-character behaviour.
function presentLocksFor(
  seg: { characters_in_scene?: string[] },
  breakdown: StoryboardGenerationOutput
): CharacterLock[] {
  const locks = breakdown.character_locks ?? [];
  const byName = new Map(locks.map((l) => [l.name.trim().toLowerCase(), l]));
  return (seg.characters_in_scene ?? [])
    .map((n) => byName.get((n ?? "").trim().toLowerCase()))
    .filter((l): l is CharacterLock => !!l);
}

/**
 * TẦNG 9 turn-taking normalisation + SAFETY CLAMP. Runs once on a fresh
 * breakdown so both dialogue forms stay consistent and the multi-speaker
 * feature can never over-constrain a Veo clip (the user's explicit caution):
 *  - mirror single dialogue/speaker ↔ dialogue_lines[0]
 *  - drop empty turns; CAP at 3 turns / 2 distinct main speakers per clip
 *  - enforce strictly sequential, non-overlapping time windows (0-10s)
 *  - ensure every on-screen speaker is listed in characters_in_scene
 *  - if only ONE real turn remains, collapse back to the simple single-line form
 */
function normalizeDialogue(breakdown: StoryboardGenerationOutput): void {
  const MAX_TURNS = 3;
  for (const seg of breakdown.segments) {
    let turns = Array.isArray(seg.dialogue_lines) ? seg.dialogue_lines : [];
    // Seed from the single-line form when the model only filled that.
    if (turns.length === 0 && seg.dialogue && seg.dialogue.trim()) {
      turns = [{ speaker: (seg.speaker ?? "").trim(), text: seg.dialogue.trim() }];
    }
    // Keep only real spoken text, cap the count.
    turns = turns
      .filter((t) => t && typeof t.text === "string" && t.text.trim())
      .slice(0, MAX_TURNS)
      .map((t) => ({
        speaker: (t.speaker ?? "").trim(),
        text: t.text.trim(),
        start_s: typeof t.start_s === "number" ? t.start_s : undefined,
        end_s: typeof t.end_s === "number" ? t.end_s : undefined,
      }));

    // Rebuild plausible sequential, non-overlapping windows within 10s whenever
    // timing is missing or inconsistent (never trust raw model timings blindly).
    const needsRetime =
      turns.length > 1 &&
      turns.some((t, i) => {
        const prev = turns[i - 1];
        return (
          t.start_s == null ||
          t.end_s == null ||
          t.end_s <= t.start_s ||
          (prev && prev.end_s != null && t.start_s! < prev.end_s)
        );
      });
    if (needsRetime) {
      // Budget each turn by its length (~0.42s/word) + a 0.4s beat, scaled to ≤9s.
      const raw = turns.map((t) => Math.max(1.2, t.text.split(/\s+/).length * 0.42));
      const gap = 0.4;
      const total = raw.reduce((a, b) => a + b, 0) + gap * (turns.length - 1);
      const scale = total > 9 ? 9 / total : 1;
      let cursor = 0;
      turns = turns.map((t, i) => {
        const dur = raw[i]! * scale;
        const start = Math.round(cursor * 10) / 10;
        cursor += dur;
        const end = Math.round(Math.min(cursor, 10) * 10) / 10;
        cursor += gap * scale;
        return { ...t, start_s: start, end_s: end };
      });
    }

    // Ensure every speaker is on screen (turn-taking requires their face).
    if (turns.length > 0) {
      const onScreen = new Set((seg.characters_in_scene ?? []).map((n) => n.trim()).filter(Boolean));
      for (const t of turns) if (t.speaker) onScreen.add(t.speaker);
      if (onScreen.size > 0) seg.characters_in_scene = Array.from(onScreen);
    }

    // Write both forms back. Collapse to single-line when only one turn remains.
    if (turns.length > 1) {
      seg.dialogue_lines = turns;
      seg.dialogue = turns[0]!.text;
      seg.speaker = turns[0]!.speaker;
    } else if (turns.length === 1) {
      seg.dialogue_lines = undefined;
      seg.dialogue = turns[0]!.text;
      seg.speaker = turns[0]!.speaker;
    } else {
      seg.dialogue_lines = undefined;
    }
  }
}

/** Cast list for the board/keyframe builders (name + locked look + child flag). */
function presentCastFor(
  seg: { characters_in_scene?: string[] },
  breakdown: StoryboardGenerationOutput
): { name: string; description: string; isChild?: boolean }[] {
  return presentLocksFor(seg, breakdown).map((l) => ({
    name: l.name,
    description: buildCleanCharLine(l),
    isChild: !!l.is_child,
  }));
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
  /** Effective style for the IMAGE calls after the character_render override
   * ("photo" forces a photographic style even if the visual style is art). */
  boardStyle: string;
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
  /** One reference per named character (multi-character binding). */
  characterRefs: { img: string; name: string; desc?: string }[];
  /** All character names in the project (to silence non-speakers). */
  characterNames: string[];
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

  // CHARACTER RENDER MODE (the user's explicit choice beats every heuristic):
  //  - "stylized": the ref photo only guides the look — real-face lock OFF.
  //  - "photo": HARD photoreal — force a photographic style for every image
  //    call even if the visual style is an art style, so boards can never
  //    drift into cartoon/illustration.
  //  - "auto" (default): previous behaviour.
  const renderMode = input.character_render ?? "auto";
  const preserveRealFace = canChain && !!faceImg && renderMode !== "stylized";
  const boardStyle =
    renderMode === "photo" && !isPhotoStyle(input.style) ? "cinematic" : input.style;

  const charDescForPosterRaw = (breakdown.character_locks ?? [])
    .map(
      (c) =>
        // NOTE: skin_tone/hair/eyes values already include the noun (e.g. "warm
        // tan skin", "dark brown eyes"), so we do NOT prefix "skin/hair/eyes"
        // again — that produced "skin warm tan skin", "eyes dark brown eyes".
        `${c.name}: ${[c.gender_age, c.build, c.skin_tone, c.hair, c.eyes]
          .map((s) => (s ?? "").trim())
          .filter(Boolean)
          .join(", ")}, wearing ${c.costume}. ${c.signature_features}`
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
    ? stripHexCodes(stripEyewear(buildCleanCharLine(breakdown.character_locks[0])) || `a ${genderWord} wearing ${mainCostume}`)
    : charDescDna;

  // Multi-character binding: pair each uploaded character photo with its named
  // lock (match by name, else by index) so each face is bound to the right
  // person in a 2-3 character scene. The vision description reinforces the photo.
  const characterRefs = (input.character_images ?? [])
    .map((grp) => {
      const img = grp.images?.[0];
      if (!img) return null;
      const lock =
        breakdown.character_locks?.find((l) => l.name === grp.name) ??
        breakdown.character_locks?.[(input.character_images ?? []).indexOf(grp)];
      const desc =
        analysis.characterDescriptions[grp.name] ??
        (lock ? buildCleanCharLine(lock) : undefined);
      return { img, name: lock?.name ?? grp.name, desc };
    })
    .filter((x) => x !== null) as { img: string; name: string; desc?: string }[];
  const characterNames = (breakdown.character_locks ?? [])
    .map((l) => l.name)
    .filter(Boolean);

  return {
    canChain,
    aspectRatio: input.aspect_ratio ?? "16:9",
    boardAspect: "16:9",
    quality: input.image_quality ?? "standard",
    boardStyle,
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
    characterRefs,
    characterNames,
    sceneBible: breakdown.scene_bible,
    productDnaText:
      breakdown.product_dna || productDesc || input.product_name || productName || undefined,
    ingredientsText: buildIngredientsText(input, analysis),
  };
}

// The board reference set: character portrait + product + setting (max 3).
// `presentNames` (CAST-SYNC): when a segment declares characters_in_scene,
// attach ONLY those characters' photos so absent people never leak into the
// render. Unmatched names fall back to the full set.
function buildBoardRefs(ctx: RefContext, presentNames?: string[]): {
  images: { base64: string; mimeType?: string }[];
  descriptors: RefDescriptor[];
} {
  const images: { base64: string; mimeType?: string }[] = [];
  const descriptors: RefDescriptor[] = [];
  // Cap total references so the image request stays small (Nano Banana handles
  // a handful of subjects; more than this hurts both payload and consistency).
  const MAX_REFS = 5;
  if (ctx.characterRefs.length > 1) {
    // MULTI-CHARACTER: bind each uploaded photo to its named character so Veo
    // never swaps faces between the 2-3 people in the scene. When the segment
    // declares its cast, only the PRESENT characters' photos are attached.
    const wanted = (presentNames ?? [])
      .map((n) => (n ?? "").trim().toLowerCase())
      .filter(Boolean);
    const filtered =
      wanted.length > 0
        ? ctx.characterRefs.filter((c) => wanted.includes(c.name.trim().toLowerCase()))
        : ctx.characterRefs;
    const pool = filtered.length > 0 ? filtered : ctx.characterRefs;
    for (const c of pool) {
      if (images.length >= MAX_REFS) break;
      images.push({ base64: c.img, mimeType: "image/jpeg" });
      descriptors.push({ role: "character", name: c.name, description: c.desc });
    }
  } else if (ctx.faceImg) {
    // SINGLE CHARACTER (unchanged behaviour).
    images.push({ base64: ctx.faceImg, mimeType: "image/jpeg" });
    descriptors.push({ role: "face", description: ctx.faceDesc ?? ctx.charDescForPoster });
  }
  if (ctx.productImg && images.length < MAX_REFS) {
    images.push({ base64: ctx.productImg, mimeType: "image/jpeg" });
    descriptors.push({ role: "product", description: ctx.productDesc });
  }
  if (ctx.bgImg && images.length < MAX_REFS) {
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

    // TWO-STAGE PIPELINE:
    //   Stage 1 — the SCRIPT (creative text) is written by input.script_provider
    //     (default Claude Opus 4.8), which is the strongest at Vietnamese
    //     numerology/health scripts.
    //   Stage 2 — the STORYBOARD (segments + JSON) is built by the main provider
    //     (Gemini 2.5 Flash — cheap), which expands the approved script verbatim.
    //   Images always stay on Nano Banana.
    // If Stage 1's model is unavailable (e.g. ANTHROPIC_API_KEY not set), we skip
    // the script and let Stage 2 write directly. If Stage 2 fails but we have a
    // script, we fall back to building the storyboard with the script model.
    const scriptProvider = input.script_provider ?? provider;

    let sourceScript: string | null = null;
    if (scriptProvider !== provider) {
      try {
        sourceScript = await generateScript(enhanced, scriptProvider);
      } catch (e) {
        warnings.push(
          `Không viết được kịch bản bằng ${scriptProvider} — ${provider} sẽ tự viết kịch bản luôn. (${e instanceof Error ? e.message : String(e)})`
        );
      }
    }

    const stage2Input = sourceScript
      ? { ...enhanced, source_script: sourceScript }
      : enhanced;

    let breakdown;
    try {
      // Stage 2: Gemini flash expands the approved script into the storyboard.
      breakdown = await generateStoryboardBreakdown(stage2Input, provider);
    } catch (e) {
      if (sourceScript && scriptProvider !== provider) {
        // Storyboard model failed — build the storyboard with the script model
        // itself so an approved script is never wasted.
        warnings.push(
          `${provider} không dựng được storyboard — đã dùng ${scriptProvider} để dựng. (${e instanceof Error ? e.message : String(e)})`
        );
        breakdown = await generateStoryboardBreakdown(stage2Input, scriptProvider);
      } else {
        throw e;
      }
    }

    // Defensive: the model can occasionally return JSON missing whole sections.
    // Guard so a malformed breakdown returns a clean error instead of throwing
    // an unhandled exception ("An error occurred in the Server Components render").
    if (!Array.isArray(breakdown.segments) || breakdown.segments.length === 0) {
      return { success: false, error: "AI không trả về cảnh nào. Vui lòng thử lại." };
    }
    if (!Array.isArray(breakdown.character_locks)) breakdown.character_locks = [];

    // TẦNG 9 turn-taking normalisation + safety clamp. Reconcile the two dialogue
    // forms so downstream code (and the editor) is always consistent, and hard-
    // cap the multi-speaker feature so it can never over-constrain a Veo clip.
    normalizeDialogue(breakdown);

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

    // PRODUCTION LAWS validation (ported from the GỐC promptValidator): lazy
    // continuity shorthand ("same as before"…) makes Veo drift — surface it.
    for (const seg of breakdown.segments) {
      const violations = findLawViolations(
        `${seg.motion_prompt ?? ""} ${seg.first_frame_prompt ?? ""}`
      );
      if (violations.length > 0) {
        warnings.push(
          `Cảnh ${seg.segment_number}: phát hiện cách viết tắt bị cấm (${violations.join(", ")}) — mô tả phải tự chứa đầy đủ, không tham chiếu cảnh trước. Hãy sửa lại cảnh này trong trình chỉnh sửa.`
        );
      }
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
  // Genre-appropriate ambient sound (kitchen sizzle for cooking, gym energy for
  // fitness, …) added to every clip's Veo prompt automatically.
  const ambientAudio = genreAmbientAudio(input.genre, input.video_goal);
  // IMPORTANT: makeVeoSafe scrubs LLM-generated text (which may contain "real
  // person / exact face / celebrity" wording). Apply it ONLY to the model's own
  // fields — NEVER wrap the fully-assembled prompt, or it corrupts the clean,
  // intentional template wording (e.g. "…or recognisable public figure" would
  // get mangled into gibberish).
  const charDesc = makeVeoSafe(ctx.charDescVeo);
  const productDesc = ctx.productDnaText ? makeVeoSafe(ctx.productDnaText) : ctx.productDnaText;
  // TẦNG 9 (audio law): every character carries a FULL locked voice profile —
  // model-filled when present, gender/child-appropriate default otherwise.
  const characterVoices: Record<string, string> = {};
  for (const l of breakdown.character_locks ?? []) {
    if (l.name?.trim()) {
      characterVoices[l.name.trim()] = (l.voice ?? "").trim() || defaultVoiceFor(l.gender, l.is_child);
    }
  }
  for (const seg of breakdown.segments) {
    seg.first_frame_url = null;
    // CAST-SYNC: in a multi-character scene, describe EVERY present character
    // (each with their locked look + child flag) instead of only the main one.
    const presentLocks = presentLocksFor(seg, breakdown);
    const castDesc =
      presentLocks.length > 1
        ? presentLocks
            .map((l) =>
              makeVeoSafe(
                `${buildCleanCharLine(l)}${l.is_child ? " — a CHILD with true child age, size and proportions" : ""}`
              )
            )
            .join(" | ")
        : charDesc;
    seg.full_prompt = buildSegmentVeoPrompt({
      characterDescription: castDesc,
      setting: makeVeoSafe(seg.first_frame_prompt ?? ""),
      productDescription: productDesc,
      ingredients: ctx.ingredientsText,
      sceneBible: ctx.sceneBible,
      colorPalette: palette,
      motionPrompt: makeVeoSafe(seg.motion_prompt),
      dialogue: seg.dialogue,
      dialogueLanguage: ctx.dialogueLanguage,
      speaker: seg.speaker,
      dialogueTurns: seg.dialogue_lines,
      characterVoices,
      characterNames: ctx.characterNames,
      charactersInScene: seg.characters_in_scene,
      speakerVoice: seg.speaker ? characterVoices[seg.speaker.trim()] : undefined,
      ambientAudio,
      environmentRef: seg.environment_ref,
    });
  }
  return buildVideoPromptText({
    title: breakdown.title,
    characterDescription: charDesc,
    productDescription: productDesc,
    ingredients: ctx.ingredientsText,
    sceneBible: ctx.sceneBible,
    setting: input.setting || "Unspecified",
    style: ctx.boardStyle,
    aspectRatio: ctx.aspectRatio,
    colorPalette: palette,
    dialogueLanguage: ctx.dialogueLanguage,
    characterNames: ctx.characterNames,
    characterVoices,
    ambientAudio,
    marketing: breakdown.marketing_structure,
    segments: breakdown.segments.map((s) => ({
      segment_number: s.segment_number,
      title: s.title,
      role: s.marketing_role,
      duration_seconds: s.duration_seconds,
      motion_prompt: makeVeoSafe(s.motion_prompt),
      dialogue: s.dialogue,
      speaker: s.speaker,
      dialogue_lines: s.dialogue_lines,
      setting: makeVeoSafe(s.first_frame_prompt ?? ""),
      environment_ref: s.environment_ref,
      characters_in_scene: s.characters_in_scene,
      continuity_note: s.continuity_note,
      beats: s.beats,
    })),
  });
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

/**
 * Per-scene "Tạo lại" in the script editor: after the user edits/adds dialogue
 * turns for ONE segment, the AI re-choreographs that segment's action, beats
 * and turn timing around the new lines — keeping the chain with the untouched
 * neighbouring segments. The user's edited lines are LOCKED: whatever the model
 * returns, the turns' text/speaker are forced back to the user's exact edit.
 */
export async function rewriteSegment(params: {
  input: StoryboardGenerationInput;
  breakdown: StoryboardGenerationOutput;
  segmentIndex: number;
  provider?: AIProvider;
}): Promise<ActionResult<{ segment: VideoSegment; warnings: string[] }>> {
  const provider = params.provider ?? "gemini";
  const warnings: string[] = [];
  try {
    const original = params.breakdown.segments[params.segmentIndex];
    if (!original) return { success: false, error: "Không tìm thấy cảnh cần viết lại." };

    const segment = await rewriteStoryboardSegment({
      input: params.input,
      breakdown: params.breakdown,
      segmentIndex: params.segmentIndex,
      provider,
    });

    // LOCK the user's edited lines: keep the model's timing/choreography but
    // force each turn's text + speaker back to exactly what the user typed.
    const userTurns =
      original.dialogue_lines && original.dialogue_lines.length > 0
        ? original.dialogue_lines
        : original.dialogue && original.dialogue.trim()
          ? [{ speaker: (original.speaker ?? "").trim(), text: original.dialogue.trim() }]
          : [];
    if (userTurns.length > 0) {
      const modelTurns = segment.dialogue_lines ?? [];
      segment.dialogue_lines = userTurns.map((t, i) => ({
        speaker: (t.speaker ?? "").trim(),
        text: t.text.trim(),
        start_s: modelTurns[i]?.start_s,
        end_s: modelTurns[i]?.end_s,
      }));
      segment.dialogue = userTurns[0]!.text;
      segment.speaker = userTurns[0]!.speaker;
    } else {
      segment.dialogue_lines = undefined;
      segment.dialogue = "";
      segment.speaker = "";
    }

    // Same post-processing pipeline as a fresh breakdown, scoped to this segment.
    if (segment.motion_prompt) segment.motion_prompt = makeVeoSafe(segment.motion_prompt);
    if (segment.first_frame_prompt)
      segment.first_frame_prompt = makeVeoSafe(segment.first_frame_prompt);
    const hasRefImages =
      (params.input.character_images?.length ?? 0) > 0 ||
      (params.input.product_images?.length ?? 0) > 0;
    if (hasRefImages) {
      if (segment.motion_prompt) segment.motion_prompt = stripHexCodes(segment.motion_prompt);
      if (segment.first_frame_prompt)
        segment.first_frame_prompt = stripHexCodes(segment.first_frame_prompt);
    }
    // TẦNG 9 turn-taking clamp on the single rewritten segment (retimes turns,
    // syncs characters_in_scene with the speakers, mirrors the single form).
    normalizeDialogue({ ...params.breakdown, segments: [segment] });

    const violations = findLawViolations(
      `${segment.motion_prompt ?? ""} ${segment.first_frame_prompt ?? ""}`
    );
    if (violations.length > 0) {
      warnings.push(
        `Cảnh ${segment.segment_number}: phát hiện cách viết tắt bị cấm (${violations.join(", ")}) — hãy kiểm tra lại mô tả hành động.`
      );
    }

    return { success: true, data: { segment, warnings } };
  } catch (err) {
    console.error("[Storyboard] segment rewrite failed:", err);
    return {
      success: false,
      error: `Viết lại cảnh thất bại: ${err instanceof Error ? err.message : String(err)}`,
    };
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
  /** Base64 of a previously-rendered board, used to pin wardrobe/look across boards. */
  anchorImage?: string;
}): Promise<ActionResult<{ url: string }>> {
  const provider = params.provider ?? "gemini";
  const { input, breakdown, analysis } = params;
  const ctx = buildRefContext(input, breakdown, analysis, provider);
  // Master board uses only the primary image; keyframe/segment build their own
  // cast-scoped refs below (buildBoardRefs(ctx, seg.characters_in_scene)).
  const { images } = buildBoardRefs(ctx);

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
        style: ctx.boardStyle,
        colorPalette: breakdown.style_guide?.color_palette ?? [],
        dialogueLanguage: ctx.dialogueLanguage,
        preserveRealFace: ctx.preserveRealFace,
        provider,
        aspectRatio: ctx.boardAspect,
        quality: ctx.quality,
        referenceImages:
          params.anchorImage && ctx.canChain
            ? [{ base64: params.anchorImage, mimeType: "image/jpeg" }]
            : ctx.canChain && images.length > 0
              ? [images[0]!]
              : undefined,
      });
      return { success: true, data: { url: r.url } };
    }

    const i = params.segmentIndex ?? 0;
    const seg = breakdown.segments[i];
    if (!seg) return { success: false, error: `Segment ${i} not found` };

    if (params.kind === "keyframe") {
      // Clean single first-frame (veoflow format) at the user's real aspect.
      // CAST-SYNC: attach ONLY the present characters' photos + cast block.
      const kfRefs = buildBoardRefs(ctx, seg.characters_in_scene);
      const r = await generateKeyframe({
        segmentNumber: seg.segment_number,
        sceneDescription: seg.first_frame_prompt || seg.title,
        shot: seg.beats?.[0]?.camera || "[EYE]",
        // Multi-character scene → describe ALL named characters; single → the
        // identity-locked main description.
        characterDescription: ctx.characterRefs.length > 1 ? ctx.charDescForPoster : ctx.charDescDna,
        presentCharacters: presentCastFor(seg, breakdown),
        productDna: ctx.productDnaText,
        ingredients: ctx.ingredientsText,
        sceneBible: ctx.sceneBible,
        style: ctx.boardStyle,
        preserveRealFace: ctx.preserveRealFace,
        hasDialogue: !!(seg.dialogue && seg.dialogue.trim()),
        speakerName: seg.speaker,
        environmentRef: seg.environment_ref,
        referenceImages: ctx.canChain && kfRefs.images.length > 0 ? kfRefs.images : undefined,
        references: ctx.canChain && kfRefs.descriptors.length > 0 ? kfRefs.descriptors : undefined,
        provider,
        aspectRatio: ctx.aspectRatio,
        quality: ctx.quality,
      });
      return { success: true, data: { url: r.url } };
    }

    // WARDROBE/LOOK PIN: feed the first approved board back in as an anchor so
    // every later board copies the EXACT same outfit + accessories (stops the
    // wardrobe drifting into a suit on one board, etc.). The anchor goes FIRST
    // so it's the dominant reference.
    // CAST-SYNC: attach only the PRESENT characters' reference photos.
    const boardRefs = buildBoardRefs(ctx, seg.characters_in_scene);
    let segImages = ctx.canChain && boardRefs.images.length > 0 ? boardRefs.images : [];
    let segDescriptors = ctx.canChain && boardRefs.descriptors.length > 0 ? boardRefs.descriptors : [];
    if (params.anchorImage && ctx.canChain) {
      segImages = [{ base64: params.anchorImage, mimeType: "image/jpeg" }, ...segImages];
      segDescriptors = [{ role: "anchor" as const }, ...segDescriptors];
    }

    const r = await generateSegmentFrame({
      segmentNumber: seg.segment_number,
      firstFramePrompt: seg.first_frame_prompt,
      beats: seg.beats,
      beatsPerSegment: ctx.beatsPerSegment,
      characterDescription: ctx.charDescDna,
      presentCharacters: presentCastFor(seg, breakdown),
      productDna: ctx.productDnaText,
      ingredients: ctx.ingredientsText,
      sceneBible: ctx.sceneBible,
      style: ctx.boardStyle,
      isFirst: i === 0,
      preserveRealFace: ctx.preserveRealFace,
      referenceImages: segImages.length > 0 ? segImages : undefined,
      references: segDescriptors.length > 0 ? segDescriptors : undefined,
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
