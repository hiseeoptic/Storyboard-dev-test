import { getOpenAIClient } from "./client";
import type { CameraAngle, ShotType, Plan } from "@/types";
import { PLAN_LIMITS } from "@/types";

interface GenerateSceneImageParams {
  prompt: string;
  cameraAngle: CameraAngle;
  shotType: ShotType;
  style?: string;
  plan: Plan;
}

interface GenerateSceneDescriptionParams {
  prompt: string;
  cameraAngle: CameraAngle;
  shotType: ShotType;
  genre: string;
}

const CAMERA_ANGLE_DESCRIPTIONS: Record<CameraAngle, string> = {
  eye_level: "shot at eye level, neutral perspective",
  low_angle: "shot from a low angle looking up, conveying power or dominance",
  high_angle: "shot from a high angle looking down, conveying vulnerability",
  birds_eye: "overhead bird's eye view shot",
  dutch_angle: "tilted dutch angle shot creating unease",
  over_the_shoulder: "over-the-shoulder shot showing another character's perspective",
  pov: "first-person POV shot through the character's eyes",
  worms_eye: "worm's eye view, extreme low angle from ground level",
};

const SHOT_TYPE_DESCRIPTIONS: Record<ShotType, string> = {
  extreme_wide: "extreme wide shot, vast landscape, tiny figures",
  wide: "wide establishing shot showing the full scene",
  medium_wide: "medium-wide shot, characters from knees up",
  medium: "medium shot from waist up",
  medium_close_up: "medium close-up, chest and above",
  close_up: "close-up shot focusing on face or detail",
  extreme_close_up: "extreme close-up on a specific detail",
  establishing: "establishing shot showing location and setting",
  two_shot: "two-shot framing two characters",
  insert: "insert shot of a specific object or detail",
  aerial: "aerial drone shot, sweeping vista",
};

export async function generateSceneDescription(
  params: GenerateSceneDescriptionParams
): Promise<string> {
  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a professional storyboard artist and screenwriter. Generate a detailed visual description for a storyboard scene. The description should be vivid, specific, and suitable for image generation. Include details about composition, lighting, mood, and character positioning. Keep it under 150 words. Genre: ${params.genre}.`,
      },
      {
        role: "user",
        content: `Scene concept: ${params.prompt}\nCamera: ${CAMERA_ANGLE_DESCRIPTIONS[params.cameraAngle]}\nShot: ${SHOT_TYPE_DESCRIPTIONS[params.shotType]}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content ?? params.prompt;
}

export async function generateSceneImage(
  params: GenerateSceneImageParams
): Promise<string> {
  const openai = getOpenAIClient();
  const resolution = PLAN_LIMITS[params.plan].image_resolution;

  const enhancedPrompt = [
    "Professional storyboard illustration, cinematic composition",
    params.style ?? "pencil sketch with dramatic shading",
    params.prompt,
    CAMERA_ANGLE_DESCRIPTIONS[params.cameraAngle],
    SHOT_TYPE_DESCRIPTIONS[params.shotType],
    "film storyboard style, clean lines, professional quality",
  ].join(". ");

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: enhancedPrompt,
    n: 1,
    size: resolution,
    quality: params.plan === "enterprise" ? "hd" : "standard",
    style: "natural",
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("Failed to generate image");
  }

  return imageUrl;
}
