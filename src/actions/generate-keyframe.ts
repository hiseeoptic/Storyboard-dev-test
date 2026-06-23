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
    // Face references first so identity is anchored, then the product.
    const refs = [...faceRefs, ...productRefs];

    const faceLine = faceRefs.length
      ? " Feature the SAME person shown in the attached portrait reference(s) as the on-camera presenter — keep their facial identity, hairstyle and build consistent across the scene. Render them as a friendly, natural commercial presenter."
      : "";

    const productLine = input.productName?.trim()
      ? ` The product is "${input.productName.trim()}" — render it EXACTLY as in the attached product reference images: same shape, colour, material, logo and label placement. Do NOT redesign or distort the product.`
      : productRefs.length
      ? " Render the product EXACTLY as in the attached product reference images — same shape, colour, logo and label. Do NOT redesign or distort it."
      : "";

    const image = await geminiGenerateImage({
      prompt: input.prompt + faceLine + productLine,
      referenceImages: refs.length ? refs : undefined,
      aspectRatio: input.aspectRatio ?? "9:16",
      quality: input.quality ?? "standard",
    });

    return { success: true, image };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Lỗi khi tạo keyframe.",
    };
  }
}
