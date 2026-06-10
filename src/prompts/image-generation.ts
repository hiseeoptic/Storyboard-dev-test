import type { StoryboardStyle, CameraAngle, ShotType } from "@/types";

const STYLE_MODIFIERS: Record<StoryboardStyle, string> = {
  realistic:
    "photorealistic, cinematic photography, detailed textures, natural lighting, film grain",
  anime:
    "anime art style, cel shading, vibrant colors, clean lines, Studio Ghibli quality",
  comic:
    "comic book illustration, bold outlines, halftone dots, dynamic composition, Marvel/DC quality",
  watercolor:
    "watercolor painting, soft washes, bleeding edges, artistic, delicate brushstrokes",
  pencil_sketch:
    "detailed pencil sketch, cross-hatching, graphite on paper, professional storyboard sketch",
  noir:
    "film noir style, high contrast black and white, dramatic shadows, venetian blind lighting",
  cinematic:
    "cinematic frame, anamorphic lens, movie-quality composition, color graded, widescreen aspect",
  "3d_render":
    "3D rendered, Pixar quality, subsurface scattering, ambient occlusion, ray traced lighting",
  pixel_art:
    "pixel art style, retro game aesthetic, limited color palette, crisp pixels, 16-bit era",
  commercial:
    "high-end TV commercial look, glossy advertising photography, studio softbox lighting, vivid saturated colors, polished and aspirational, brand-ready",
  ugc:
    "authentic UGC selfie-style footage, handheld phone camera, natural daylight, slightly imperfect framing, relatable everyday realism, TikTok/Reels native look",
  product_showcase:
    "clean product showcase, minimal seamless background, crisp studio lighting, sharp focus on the product, soft reflections, e-commerce hero shot quality",
  corporate_clean:
    "clean corporate brand style, bright modern office or minimal set, soft even lighting, professional and trustworthy, muted brand palette, polished business look",
  custom: "",
};

const CAMERA_MODIFIERS: Record<CameraAngle, string> = {
  eye_level: "eye-level camera angle, neutral perspective, straight-on view",
  low_angle:
    "low-angle shot looking upward, heroic perspective, imposing feeling",
  high_angle:
    "high-angle shot looking down, diminishing perspective, vulnerability",
  birds_eye: "birds-eye view, directly overhead, top-down composition",
  dutch_angle: "dutch angle, tilted frame, creating tension and unease",
  over_the_shoulder:
    "over-the-shoulder shot, foreground character framing, depth",
  pov: "first-person POV perspective, immersive, through character eyes",
  worms_eye: "worm's eye view, extreme low angle from ground level",
};

const SHOT_MODIFIERS: Record<ShotType, string> = {
  extreme_wide: "extreme wide shot, vast landscape, tiny figures, epic scale",
  wide: "wide shot, full environment visible, characters in context",
  medium_wide: "medium-wide shot, characters from knees up, balanced framing",
  medium: "medium shot, waist-up framing, conversational distance",
  medium_close_up: "medium close-up, chest and above, emotional detail visible",
  close_up: "close-up shot, face fills frame, intimate emotional detail",
  extreme_close_up:
    "extreme close-up, single detail fills frame, eyes or object",
  establishing:
    "establishing shot, location reveal, setting the scene, wide angle",
  two_shot: "two-shot, both characters in frame, relationship dynamic",
  insert: "insert shot, specific object or detail, narrative emphasis",
  aerial: "aerial shot, drone perspective, sweeping vista",
};

export function buildImagePrompt(params: {
  visual_prompt: string;
  style: StoryboardStyle;
  camera_angle: CameraAngle;
  shot_type: ShotType;
  mood?: string | null;
  lighting?: string | null;
  custom_style_prompt?: string;
}): string {
  const style =
    params.style === "custom" && params.custom_style_prompt
      ? params.custom_style_prompt
      : STYLE_MODIFIERS[params.style];

  const segments = [
    "Professional storyboard frame",
    style,
    params.visual_prompt,
    CAMERA_MODIFIERS[params.camera_angle],
    SHOT_MODIFIERS[params.shot_type],
    params.mood ? `Mood: ${params.mood}` : null,
    params.lighting ? `Lighting: ${params.lighting}` : null,
    "No text, no watermarks, no UI elements, single frame composition",
  ].filter(Boolean);

  return segments.join(". ") + ".";
}

export function buildCharacterConsistencyPrefix(
  characters: string[],
  characterDescriptions: Record<string, string>
): string {
  if (characters.length === 0) return "";

  const descriptions = characters
    .map((name) => {
      const desc = characterDescriptions[name];
      return desc ? `${name}: ${desc}` : null;
    })
    .filter(Boolean);

  if (descriptions.length === 0) return "";

  return `Characters in scene — ${descriptions.join("; ")}. `;
}
