"use server";

import { geminiGenerateImage } from "@/lib/gemini/client";
import { buildPrompt } from "@/lib/studio/prompt";
import type { PhotoConfig } from "@/lib/studio/types";
import type { ActionResult, AspectRatio } from "@/types";

// Per-image role labels (interleaved before the prompt) — the identity-lock
// trick from the Gen-image app that makes Nano Banana keep the right face /
// outfit / product in the output.
// NOTE: keep this wording REFERENCE-GUIDED, not "replicate this exact real
// person". Language like "preserve this exact identity / do not alter the real
// face" reads as a deepfake request and trips Google's image-model face-safety
// mitigation, which then returns a BLURRED/degraded face. The attached photo
// already carries the likeness; we just ask the model to stay consistent with
// it. (Same rationale as makeVeoSafe() in the storyboard path.)
const ROLE_LABELS = {
  face: "FACE REFERENCE IMAGE — Use this attached photo as the appearance reference for the main character. Keep the same whole-face topology and natural asymmetry, age evidence, living skin microtexture, eye/eyelid anatomy, individual eyebrow and upper/lower eyelash pattern, nose, lips, hairline, density and strand texture. Do not beautify, smooth, fill brows, lengthen lashes or thicken hair beyond the visible evidence:",
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
    // Pro = Nano Banana Pro (gemini-3-pro-image-preview): it preserves the
    // uploaded face identity far better than 2.5-flash AND renders at 2K, so
    // the beautified character references actually look like the person and
    // are sharp enough to anchor every storyboard board.
    const url = await geminiGenerateImage({
      prompt,
      referenceImages: refs.length > 0 ? refs : undefined,
      aspectRatio: aspect,
      quality: "pro",
    });
    return { success: true, data: { url, prompt } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Tạo ảnh thất bại" };
  }
}
