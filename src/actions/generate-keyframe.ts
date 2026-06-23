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
  productImages?: string[]; // base64 (with or without data: prefix)
  productName?: string;
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
}): Promise<KeyframeResult> {
  try {
    if (!input.prompt?.trim()) {
      return { success: false, error: "Thiếu prompt cảnh." };
    }

    const refs = (input.productImages || [])
      .filter(Boolean)
      .map((b) => ({ base64: b.replace(/^data:[^,]+,/, ""), mimeType: "image/jpeg" }));

    const productLine = input.productName?.trim()
      ? ` The product is "${input.productName.trim()}" — render it EXACTLY as in the attached reference images: same shape, colour, material, logo and label placement. Do NOT redesign or distort the product.`
      : refs.length
      ? " Render the product EXACTLY as in the attached reference images — same shape, colour, logo and label. Do NOT redesign or distort it."
      : "";

    const image = await geminiGenerateImage({
      prompt: input.prompt + productLine,
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
