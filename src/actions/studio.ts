"use server";

import { geminiGenerateImage } from "@/lib/gemini/client";
import { buildPrompt } from "@/lib/studio/prompt";
import type { PhotoConfig } from "@/lib/studio/types";
import type { ActionResult, AspectRatio } from "@/types";

// Per-image role labels (interleaved before the prompt) — the identity-lock
// trick from the Gen-image app that makes Nano Banana keep the right face /
// outfit / product in the output.
const ROLE_LABELS = {
  face: "FACE REFERENCE IMAGE — This is the person who must appear in the generated photo. You MUST preserve this exact face identity, facial features, bone structure, skin tone, and overall appearance. Do not alter or replace this person's face:",
  product:
    "PRODUCT REFERENCE IMAGE — This is the exact product that must be included in the generated photo. The person should be holding, showcasing, or interacting with this specific product. Make the product clearly visible and recognizable:",
  logo: "LOGO REFERENCE IMAGE — Integrate this logo tastefully and visibly in the generated image:",
  outfit: "OUTFIT REFERENCE IMAGE — Match this clothing style in the generated image:",
} as const;

export interface StudioGenerateInput {
  config: PhotoConfig;
  faces?: string[];
  products?: string[];
  logo?: string | null;
  outfitImage?: string | null;
}

/**
 * Generates ONE rich, photoreal image from the uploaded reference photo(s)
 * using the full PhotoConfig (face enhancements, expression, outfit,
 * lighting, camera, quality, …). Returns a data URI. Gemini only (face lock).
 */
export async function generateStudioImage(
  input: StudioGenerateInput
): Promise<ActionResult<{ url: string; prompt: string }>> {
  const { config } = input;
  const faces = (input.faces ?? []).filter(Boolean);
  const products = (input.products ?? []).filter(Boolean);
  const logo = input.logo || null;
  const outfitImage = input.outfitImage || null;

  if (config.source === "UPLOAD" && faces.length === 0 && products.length === 0) {
    return { success: false, error: "Hãy tải lên ảnh khuôn mặt (hoặc sản phẩm) trước." };
  }

  const prompt = buildPrompt(config, {
    hasFaces: faces.length > 0,
    hasProducts: products.length > 0,
    hasLogo: !!logo,
  });

  // Build labelled references in a fixed order: faces, products, logo, outfit.
  const refs: { base64: string; mimeType?: string; label?: string }[] = [];
  if (config.source === "UPLOAD") {
    faces.slice(0, 3).forEach((b64, i) =>
      refs.push({ base64: b64, mimeType: "image/jpeg", label: i === 0 ? ROLE_LABELS.face : undefined })
    );
    products.slice(0, 2).forEach((b64, i) =>
      refs.push({ base64: b64, mimeType: "image/jpeg", label: i === 0 ? ROLE_LABELS.product : undefined })
    );
    if (logo) refs.push({ base64: logo, mimeType: "image/png", label: ROLE_LABELS.logo });
  }
  if (outfitImage) refs.push({ base64: outfitImage, mimeType: "image/jpeg", label: ROLE_LABELS.outfit });

  const aspect = (["9:16", "16:9", "1:1"].includes(config.aspectRatio)
    ? config.aspectRatio
    : "9:16") as AspectRatio | "1:1";

  try {
    const url = await geminiGenerateImage({
      prompt,
      referenceImages: refs.length > 0 ? refs : undefined,
      aspectRatio: aspect,
      quality: "standard",
    });
    return { success: true, data: { url, prompt } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Tạo ảnh thất bại" };
  }
}
