// Ported from the Gen-image app — the rich "PERSONAL" photo config that
// powers face beautification, expression, outfit, lighting and camera control.

export type SubjectType = "MALE" | "FEMALE" | "COUPLE" | "GROUP" | "PRODUCT";
export type GenerationSource = "UPLOAD" | "TEXT_ONLY";

export interface PhotoConfig {
  source: GenerationSource;
  subjectType: SubjectType;
  customSubjectCount: string;

  // Outfit
  outfitCategory: string;
  outfitDetail: string;
  outfitImage: string | null;

  // Context
  contextCategory: string;
  contextDetail: string;

  // Pose
  pose: string;

  // Photography Style
  photographyStyle: string;
  photographyStyleCategory: "special" | "standard";

  // Technical & Vibe
  lighting: string;
  cameraAngle: string;
  aspectRatio: string;
  camera: string;

  // Face & Quality
  quality: string;
  expression: string;
  faceEnhancements: string[];

  additionalPrompt: string;
}

export const DEFAULT_CONFIG: PhotoConfig = {
  source: "UPLOAD",
  subjectType: "MALE",
  customSubjectCount: "",

  outfitCategory: "suit",
  outfitDetail: "Sharp tailored suit, elegant and professional",
  outfitImage: null,

  contextCategory: "studio_bg",
  contextDetail:
    "High-key studio photography, pure white infinity background, clean and commercial look",

  pose: "Standing naturally, confident posture",
  photographyStyle:
    "Front-facing studio portrait, symmetrical face, clean neutral background",
  photographyStyleCategory: "standard",

  lighting:
    "Professional softbox studio lighting, beautifully even and flattering illumination, clean controlled shadows",
  cameraAngle: "Eye level",
  aspectRatio: "9:16",
  camera: "Shot on 85mm f/1.4 portrait lens, beautiful background blur, sharp subject",

  quality:
    "Hyper-realistic photography, 8K ultra-high resolution, raw unprocessed photo quality, extreme skin and fabric detail",
  expression: "Friendly, slight smile, approachable, warm eyes",
  faceEnhancements: ["lock_face"],

  additionalPrompt: "",
};
