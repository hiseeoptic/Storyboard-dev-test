"use server";

import { geminiGenerateImage } from "@/lib/gemini/client";
import type { ActionResult, AspectRatio, ImageQuality } from "@/types";

export type StudioAngle = "front" | "three_quarter" | "side" | "full_body";
export type StudioMode = "portrait" | "fashion";

// Role labels (interleaved with each image) — mirrors the approach that makes
// Nano Banana keep the exact face / outfit / product in the output.
const FACE_LABEL =
  "FACE REFERENCE IMAGE — This is the exact person who must appear in the generated photo. Preserve this identical face identity: facial features, bone structure, eye shape and colour, nose, lips, skin tone, hairline and hair. Do NOT replace or restyle this person into someone else:";
const OUTFIT_LABEL =
  "OUTFIT / CLOTHING REFERENCE IMAGE — The person must wear THIS exact garment. Reproduce its cut, colour, fabric, pattern, logo and details faithfully:";
const PRODUCT_LABEL =
  "PRODUCT REFERENCE IMAGE — Include THIS exact product (bag / accessory / item). The person holds, wears or showcases it; keep its shape, colour, material and branding unchanged:";

const ANGLE_FRAMING: Record<StudioAngle, string> = {
  front: "Head-and-shoulders portrait, facing the camera straight on (frontal view), eye-level.",
  three_quarter: "Head-and-shoulders portrait at a 3/4 angle (face turned ~45° from camera), eye-level.",
  side: "Head-and-shoulders portrait, clean side profile (90° profile view), eye-level.",
  full_body: "Full-body standing shot, head to toe, neutral confident pose, facing the camera.",
};

const SINGLE_IMAGE_RULES =
  "Output ONE single photograph only — no collage, no split frames, no grid, no multiple panels, no text, no watermark, no labels.";

const PHOTOREAL_RULES =
  "Ultra-realistic, sharp high-resolution professional photography, 85mm lens, soft natural light, natural skin texture and pores, true-to-life colours.";

const GLOWUP_RULES =
  "Apply only a tasteful editorial retouch (even healthy skin tone, clear complexion, softened under-eye shadows, bright eyes, neat well-groomed hair) so he/she looks a few years younger and camera-ready — but keep the SAME identity, same ethnicity and age bracket, never a plastic / CGI / wax / airbrushed look and never a different face.";

function buildPortraitPrompt(angle: StudioAngle, scene?: string, custom?: string): string {
  return [
    `A single, professional studio portrait of the SAME person shown in the FACE REFERENCE IMAGE.`,
    ANGLE_FRAMING[angle],
    scene ? `Setting / wardrobe: ${scene}.` : "Clean, uncluttered neutral studio background.",
    PHOTOREAL_RULES,
    GLOWUP_RULES,
    custom ? custom : "",
    SINGLE_IMAGE_RULES,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildFashionPrompt(params: {
  hasOutfit: boolean;
  hasProduct: boolean;
  scene?: string;
  custom?: string;
}): string {
  const wearing = params.hasOutfit
    ? "wearing the exact garment shown in the OUTFIT / CLOTHING REFERENCE IMAGE"
    : "in a stylish outfit";
  const withProduct = params.hasProduct
    ? " and showcasing the exact item from the PRODUCT REFERENCE IMAGE (holding / wearing it so it is clearly visible)"
    : "";
  return [
    `A single, high-end advertising fashion photograph: the SAME person from the FACE REFERENCE IMAGE, ${wearing}${withProduct}.`,
    "Full-body or three-quarter framing so the outfit / product is clearly shown, professional model posing.",
    params.scene ? `Scene: ${params.scene}.` : "Editorial studio or lifestyle setting with flattering commercial lighting.",
    PHOTOREAL_RULES,
    "Preserve the exact face identity, the exact garment and the exact product.",
    params.custom ? params.custom : "",
    SINGLE_IMAGE_RULES,
  ]
    .filter(Boolean)
    .join(" ");
}

export interface StudioImageInput {
  mode: StudioMode;
  /** Portrait angle (portrait mode only). */
  angle?: StudioAngle;
  faceImages: string[];
  outfitImages?: string[];
  productImages?: string[];
  scene?: string;
  customPrompt?: string;
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
}

/**
 * Generates ONE clean, photoreal image from the uploaded reference photo(s)
 * — a single portrait (portrait mode) or a fashion / product ad shot of the
 * same person wearing / holding the uploaded outfit / accessory.
 *
 * Returns a data URI (data:image/png;base64,...). Gemini only (face lock).
 */
export async function generateStudioImage(
  input: StudioImageInput
): Promise<ActionResult<{ url: string }>> {
  if (!input.faceImages || input.faceImages.length === 0) {
    return { success: false, error: "Upload at least one face photo first." };
  }

  const refs: { base64: string; mimeType?: string; label?: string }[] = [];
  // Lead with the labelled face(s) — up to 3 angles improve identity lock.
  input.faceImages.slice(0, 3).forEach((b64, i) => {
    refs.push({ base64: b64, mimeType: "image/jpeg", label: i === 0 ? FACE_LABEL : undefined });
  });
  if (input.mode === "fashion") {
    (input.outfitImages ?? []).slice(0, 2).forEach((b64, i) => {
      refs.push({ base64: b64, mimeType: "image/jpeg", label: i === 0 ? OUTFIT_LABEL : undefined });
    });
    (input.productImages ?? []).slice(0, 2).forEach((b64, i) => {
      refs.push({ base64: b64, mimeType: "image/jpeg", label: i === 0 ? PRODUCT_LABEL : undefined });
    });
  }

  const prompt =
    input.mode === "fashion"
      ? buildFashionPrompt({
          hasOutfit: (input.outfitImages?.length ?? 0) > 0,
          hasProduct: (input.productImages?.length ?? 0) > 0,
          scene: input.scene,
          custom: input.customPrompt,
        })
      : buildPortraitPrompt(input.angle ?? "front", input.scene, input.customPrompt);

  try {
    const url = await geminiGenerateImage({
      prompt,
      referenceImages: refs,
      aspectRatio: input.aspectRatio ?? (input.mode === "fashion" ? "9:16" : "9:16"),
      quality: input.quality ?? "standard",
    });
    return { success: true, data: { url } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Image generation failed" };
  }
}
