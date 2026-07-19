// Ported verbatim (with minor typing) from the Gen-image app
// (services/openaiService.ts) — turns a PhotoConfig into a single rich,
// photoreal generation prompt with face-identity locking and enhancements.

import type { PhotoConfig } from "./types";
import {
  HUMAN_FACE_REALISM_LOCK,
  HUMAN_FACE_REALISM_NEGATIVE,
} from "@/lib/character-realism";

export interface PromptBuildContext {
  hasFaces: boolean;
  hasProducts: boolean;
  hasLogo: boolean;
}

export function buildPrompt(
  config: PhotoConfig,
  ctx: PromptBuildContext = { hasFaces: false, hasProducts: false, hasLogo: false }
): string {
  const isSpecial = config.photographyStyleCategory === "special";

  // Subject description.
  // CRITICAL: when a face reference photo is attached, that PHOTO is the source
  // of truth for the person's gender/age/appearance. Never override it with a
  // generic config default — that is exactly what turned an uploaded WOMAN into
  // "a man" (the default subjectType is MALE). So for a single-person subject
  // with a reference photo, defer to the photo instead of asserting a gender.
  let subject = "";
  if (config.subjectType === "PRODUCT") {
    subject = "a product";
  } else if (ctx.hasFaces && (config.subjectType === "MALE" || config.subjectType === "FEMALE")) {
    subject =
      "the SAME person as in the attached reference photo — match their gender, age, ethnicity, face, hair and body build exactly (do not change their sex or turn them into a different person)";
  } else {
    const map: Record<string, string> = {
      MALE: "a man",
      FEMALE: "a woman",
      COUPLE: "a couple",
      GROUP: "a group of people",
    };
    subject = map[config.subjectType] || "a person";
    if (config.customSubjectCount) subject += ` (${config.customSubjectCount})`;
  }

  // Reference-GUIDED wording (not "replicate this exact real individual"):
  // aggressive identity-replication language trips Google's face-safety filter,
  // which returns a blurred/degraded face. The attached photo carries the
  // likeness; we ask the model to stay consistent with it.
  const hasLockFace = config.faceEnhancements?.includes("lock_face");
  const faceId = ctx.hasFaces
    ? hasLockFace
      ? "FACE REFERENCE: render the character to closely match the attached reference photo — keep the same whole-face topology and natural asymmetry, skin tone and age evidence, eye/eyelid shape, individual eyebrow and eyelash pattern, nose, lips, hairline, density and strand texture so the character stays visually consistent. Sharp, optically focused face; do not beautify or replace visible anatomy."
      : "FACE REFERENCE: render the character to match the attached reference photo — keep the same facial structure, natural asymmetry, skin microtexture, eyebrow/eyelash pattern, hairline and overall look so the character stays visually consistent. Sharp, optically focused face."
    : "";

  const enhMap: Record<string, string> = {
    lock_face: "Keep the character's face consistent with the attached reference photo, sharp and in focus.",
    smooth_skin:
      "gently even temporary redness only; preserve zone-varying pores, vellus hair, follicles, fine lines, under-eye texture, permanent marks and natural tone variation",
    bright_skin:
      "slightly brighter exposure and healthy colour balance only; preserve the original skin tone, undertone, pores and highlight roll-off without whitening",
    younger:
      "subtle rested appearance through lighting only; preserve the person's real age bracket, facial topology, pores and age-appropriate lines",
    remove_wrinkles:
      "soften only harsh lighting contrast on fine lines; retain age-appropriate wrinkle geometry and real skin microtexture",
    makeup:
      "light natural makeup visibly sitting on real textured skin; individual brow hairs and eyelashes remain anatomical, never painted or replaced",
    bright_eyes:
      "clear moist corneal catchlights, detailed iris fibres, off-white sclera, tear line and anatomical eyelid folds; no glowing-white or glass eyes",
    sharp_features:
      "optical focus and directional-light definition only; preserve the original jaw, cheekbones, nose, lips and facial asymmetry without reshaping",
  };

  const enhancementsToShow = (config.faceEnhancements || []).filter((id) => id !== "lock_face");
  const enh = enhancementsToShow.map((id) => enhMap[id]).filter(Boolean);
  const enhLine = enh.length > 0 ? `Facial enhancements applied: ${enh.join("; ")}.` : "";

  const cameraLine = config.camera && config.camera.trim() !== "" ? config.camera.trim() : "";

  // --- SPECIAL STYLE PATH ---
  if (isSpecial) {
    const parts: string[] = [
      config.photographyStyle + ".",
      `The main subject is ${subject}.`,
      config.subjectType !== "PRODUCT" && config.outfitDetail ? `Wearing: ${config.outfitDetail}.` : "",
      config.subjectType !== "PRODUCT" ? `Expression: ${config.expression}.` : "",
      cameraLine ? `${cameraLine}.` : "",
      faceId,
      enhLine,
      config.subjectType !== "PRODUCT" ? HUMAN_FACE_REALISM_LOCK : "",
      config.subjectType !== "PRODUCT" ? `Avoid: ${HUMAN_FACE_REALISM_NEGATIVE}.` : "",
      config.quality,
      ctx.hasProducts
        ? "PRODUCT INSTRUCTION: The uploaded product image shows the exact product that must appear in this photo. Show the product clearly, recognizably, and prominently. Faithfully reproduce the product's design and label."
        : "",
      ctx.hasLogo ? "Integrate the provided logo visibly but tastefully." : "",
      config.additionalPrompt ? `Additional details: ${config.additionalPrompt}.` : "",
      "Photograph must look completely real and photographic.",
    ];
    return parts.filter(Boolean).join(" ");
  }

  // --- STANDARD PROMPT PATH ---
  const qualityIntro = config.quality ? `${config.quality}.` : "A high-quality photorealistic photograph.";

  const outfitPart =
    config.subjectType !== "PRODUCT" && config.outfitDetail
      ? config.outfitDetail + (config.outfitImage ? ", styled to match the provided outfit reference image" : "")
      : "";

  const parts: string[] = [];
  parts.push(qualityIntro);
  parts.push(`The subject is ${subject}, photographed in ${config.photographyStyle} style.`);
  if (outfitPart) parts.push(`Wearing: ${outfitPart}.`);
  if (config.subjectType !== "PRODUCT" && config.pose) parts.push(`Pose: ${config.pose}.`);
  if (config.subjectType !== "PRODUCT") parts.push(`Expression: ${config.expression}.`);
  if (ctx.hasProducts) {
    parts.push(
      "PRODUCT INSTRUCTION: The uploaded product image shows the exact product that must appear in this photo. Show the product clearly, recognizably, and prominently as described in the pose. The product's design, shape, and label must be faithfully reproduced — do not invent a generic product."
    );
  }
  if (ctx.hasLogo) parts.push("Integrate the provided logo visibly but tastefully into the image.");
  if (config.contextDetail) parts.push(`Setting: ${config.contextDetail}.`);
  if (config.lighting) parts.push(`Lighting: ${config.lighting}.`);
  if (config.cameraAngle) parts.push(`Camera angle: ${config.cameraAngle}.`);
  if (cameraLine) parts.push(`${cameraLine}.`);
  if (faceId) parts.push(faceId);
  if (enhLine) parts.push(enhLine);
  if (config.subjectType !== "PRODUCT") {
    parts.push(HUMAN_FACE_REALISM_LOCK);
    parts.push(`Avoid: ${HUMAN_FACE_REALISM_NEGATIVE}.`);
  }
  if (config.additionalPrompt) parts.push(`Additional details: ${config.additionalPrompt}.`);
  parts.push(
    "The final result must look like a real professional photograph — not digital art, not illustration, not CGI. Pure photographic realism."
  );

  return parts.filter(Boolean).join("\n");
}
