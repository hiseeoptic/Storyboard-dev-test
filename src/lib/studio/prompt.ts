// Ported verbatim (with minor typing) from the Gen-image app
// (services/openaiService.ts) — turns a PhotoConfig into a single rich,
// photoreal generation prompt with face-identity locking and enhancements.

import type { PhotoConfig } from "./types";

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

  // Subject description
  let subject = "";
  if (config.subjectType === "PRODUCT") {
    subject = "a product";
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

  const hasLockFace = config.faceEnhancements?.includes("lock_face");
  const faceId = ctx.hasFaces
    ? hasLockFace
      ? "CRITICAL FACE IDENTITY: Exactly preserve and precisely recreate every single facial feature from the uploaded reference photo — same face shape, bone structure, skin tone, eye shape, nose, lips, and complete identity. The person in the output must be unmistakably and identically the same individual as in the reference. Do not alter the face under any circumstance."
      : "CRITICAL FACE IDENTITY: You must precisely match the uploaded reference face photo — preserve every facial feature, bone structure, skin tone, eye shape, nose, and complete identity. The person in the output must be unmistakably the same individual as in the reference."
    : "";

  const enhMap: Record<string, string> = {
    lock_face: "CRITICAL — Exactly preserve ALL facial features from reference photo. Same face, same identity.",
    smooth_skin: "flawlessly smooth natural skin texture, professional beauty retouching",
    bright_skin: "naturally brightened luminous skin, healthy inner glow",
    younger: "naturally de-aged 5-10 years younger, realistic and convincing",
    remove_wrinkles: "wrinkles and fine lines subtly smoothed, fresh youthful skin",
    makeup: "light natural makeup, soft definition",
    bright_eyes: "bright sparkling eyes, expressive and clear gaze",
    sharp_features: "sharper defined facial features, refined jawline and cheekbones",
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
  if (config.additionalPrompt) parts.push(`Additional details: ${config.additionalPrompt}.`);
  parts.push(
    "The final result must look like a real professional photograph — not digital art, not illustration, not CGI. Pure photographic realism."
  );

  return parts.filter(Boolean).join("\n");
}
