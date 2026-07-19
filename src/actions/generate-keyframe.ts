"use server";

import { geminiGenerateImage } from "@/lib/gemini/client";
import type { AspectRatio, ImageQuality } from "@/types";
import {
  HUMAN_FACE_REALISM_LOCK,
  HUMAN_FACE_REALISM_NEGATIVE,
} from "@/lib/character-realism";

export interface KeyframeResult {
  success: boolean;
  image?: string; // data:image/png;base64,...
  error?: string;
}

/**
 * Generate ONE scene keyframe with Nano Banana, baking the user's product
 * (from reference images) into the scene described by `prompt`. Called once
 * per scene from the client so each keyframe streams in with its own progress.
 */
export async function generateSceneKeyframe(input: {
  prompt: string;
  /** Portrait references of the person to feature as the model (the user's own face). */
  faceImages?: string[];
  productImages?: string[]; // base64 (with or without data: prefix)
  productName?: string;
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
}): Promise<KeyframeResult> {
  try {
    if (!input.prompt?.trim()) {
      return { success: false, error: "Thiếu prompt cảnh." };
    }

    const toRef = (b: string) => ({ base64: b.replace(/^data:[^,]+,/, ""), mimeType: "image/jpeg" });
    const faceRefs = (input.faceImages || []).filter(Boolean).map(toRef);
    const productRefs = (input.productImages || []).filter(Boolean).map(toRef);
    // Face references FIRST so identity is anchored, then the product.
    const refs = [...faceRefs, ...productRefs];

    const productLine = input.productName?.trim()
      ? ` Render the product ("${input.productName.trim()}") EXACTLY as in the attached product reference image(s): same shape, colour, material, logo and label placement. Do NOT redesign or distort the product.`
      : productRefs.length
      ? " Render the product EXACTLY as in the attached product reference image(s) — same shape, colour, logo and label. Do NOT redesign or distort it."
      : "";

    let finalPrompt: string;
    if (faceRefs.length) {
      // IMAGE-EDIT MODE: the FIRST attached image(s) are a REAL photo of the
      // user. We edit THAT person (keep their face exactly), re-dress them in
      // the product, and place them in the analyzed scene — instead of
      // generating a brand-new generic person from the text.
      finalPrompt =
        `EDIT THIS PHOTO. The FIRST attached image is the authoritative appearance reference for the subject. ` +
        `Keep the character visually consistent with its whole-face topology and natural asymmetry, age evidence, skin tone and microtexture, eyes/eyelids, individual eyebrows and upper/lower eyelashes, nose, lips, hairline, density and strand texture. ` +
        `Do NOT beautify, slim, de-age, stylise, fill brows, lengthen lashes, thicken hair or replace visible anatomy; keep the face fully visible ` +
        `and optically sharp (do not add sunglasses, masks or anything covering the face). ${HUMAN_FACE_REALISM_LOCK} ` +
        `Re-dress this character in the product shown in the product reference image(s)` +
        (input.productName?.trim() ? ` ("${input.productName.trim()}")` : "") +
        `, keeping the product accurate. Then place this person into the following scene/action: ${input.prompt}${productLine} ` +
        `IMPORTANT: the subject appearance is ALWAYS governed by the first photo — ignore any other or generic appearance described in the scene text. ` +
        `Avoid: ${HUMAN_FACE_REALISM_NEGATIVE}.`;
    } else {
      finalPrompt = input.prompt + productLine;
    }

    // Identity fidelity needs Nano Banana Pro; force it when a face is provided.
    const quality: ImageQuality = input.quality ?? (faceRefs.length ? "pro" : "standard");

    const image = await geminiGenerateImage({
      prompt: finalPrompt,
      referenceImages: refs.length ? refs : undefined,
      aspectRatio: input.aspectRatio ?? "9:16",
      quality,
    });

    return { success: true, image };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Lỗi khi tạo keyframe.",
    };
  }
}
