"use server";

import { geminiGenerateImage } from "@/lib/gemini/client";
import type { AspectRatio, ImageQuality } from "@/types";

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
        `EDIT THIS PHOTO. The FIRST attached image is a real photograph of a specific person — the subject. ` +
        `Keep this person's FACE, facial features, face shape, skin tone, hairstyle and identity EXACTLY as in that photo. ` +
        `Do NOT beautify, slim, age, stylise or replace the face — it must clearly be the SAME real person, face fully visible ` +
        `and recognizable (do NOT add sunglasses, masks or anything covering the face). ` +
        `Re-dress this same person in the product shown in the product reference image(s)` +
        (input.productName?.trim() ? ` ("${input.productName.trim()}")` : "") +
        `, keeping the product accurate. Then place this person into the following scene/action: ${input.prompt}${productLine} ` +
        `IMPORTANT: the subject is ALWAYS the person from the first photo — ignore any other or generic person described in the scene text. ` +
        `Preserve their real identity above everything else.`;
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
