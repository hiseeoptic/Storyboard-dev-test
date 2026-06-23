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
      // The first attached image(s) are the user's portrait. Force identity and
      // explicitly OVERRIDE any generic/other-person description in the scene text.
      finalPrompt =
        `IDENTITY LOCK: The on-camera person MUST be the exact same individual shown in the FIRST attached portrait reference image(s). ` +
        `Replicate their face, facial features, face shape, skin tone, hairstyle and approximate age PRECISELY. ` +
        `Do NOT generate a different, generic or younger face. The person's face must be clearly visible and recognizable ` +
        `(do not cover it with sunglasses or masks). If the scene description mentions any other or generic person, ` +
        `it refers to THIS person.\n\n` +
        `SCENE: ${input.prompt}${productLine}\n\n` +
        `Keep the person's identity from the portrait above all else.`;
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
