"use server";

import { generateStoryboardBreakdown } from "@/services/ai-engine";
import { generateSceneImage } from "@/services/image-pipeline";
import type {
  ActionResult,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
} from "@/types";

interface GeneratedScene {
  scene_number: number;
  title: string;
  description: string;
  visual_prompt: string;
  dialogue: string | null;
  camera_angle: string;
  shot_type: string;
  mood: string;
  lighting: string;
  location: string;
  characters: string[];
  duration_seconds: number;
  transition: string;
  image_url: string | null;
  generation_error: string | null;
}

export interface StoryboardResult {
  breakdown: StoryboardGenerationOutput;
  scenes: GeneratedScene[];
}

export async function generateFullStoryboard(
  input: StoryboardGenerationInput
): Promise<ActionResult<StoryboardResult>> {
  // ─── Step 1: AI scene breakdown ────────────────────────────────────
  let breakdown: StoryboardGenerationOutput;
  try {
    breakdown = await generateStoryboardBreakdown(input);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "AI generation failed",
    };
  }

  // ─── Step 2: Generate images for each scene ────────────────────────
  const characterDescriptions: Record<string, string> = {};
  if (input.character_descriptions) {
    for (const char of input.character_descriptions) {
      characterDescriptions[char.name] = char.appearance;
    }
  }

  const scenes: GeneratedScene[] = [];

  for (const sceneBreakdown of breakdown.scenes) {
    let imageUrl: string | null = null;
    let generationError: string | null = null;

    try {
      const result = await generateSceneImage({
        scene: sceneBreakdown,
        style: input.style,
        plan: "pro",
        characterDescriptions,
      });
      imageUrl = result.url;
    } catch (err) {
      generationError =
        err instanceof Error ? err.message : "Image generation failed";
    }

    scenes.push({
      scene_number: sceneBreakdown.scene_number,
      title: sceneBreakdown.title,
      description: sceneBreakdown.description,
      visual_prompt: sceneBreakdown.visual_prompt,
      dialogue: sceneBreakdown.dialogue,
      camera_angle: sceneBreakdown.camera_angle,
      shot_type: sceneBreakdown.shot_type,
      mood: sceneBreakdown.mood,
      lighting: sceneBreakdown.lighting,
      location: sceneBreakdown.location,
      characters: sceneBreakdown.characters,
      duration_seconds: sceneBreakdown.duration_seconds,
      transition: sceneBreakdown.transition,
      image_url: imageUrl,
      generation_error: generationError,
    });
  }

  return {
    success: true,
    data: {
      breakdown,
      scenes,
    },
  };
}
