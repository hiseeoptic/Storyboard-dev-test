import { getOpenAIClient } from "@/lib/openai/client";
import {
  buildStoryboardSystemPrompt,
  buildStoryboardUserPrompt,
} from "@/prompts";
import type {
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  SceneBreakdown,
} from "@/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateSceneBreakdown(scene: unknown): scene is SceneBreakdown {
  if (typeof scene !== "object" || scene === null) return false;
  const s = scene as Record<string, unknown>;
  return (
    typeof s.scene_number === "number" &&
    typeof s.title === "string" &&
    typeof s.description === "string" &&
    typeof s.visual_prompt === "string" &&
    typeof s.camera_angle === "string" &&
    typeof s.shot_type === "string"
  );
}

function validateOutput(data: unknown): data is StoryboardGenerationOutput {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.title === "string" &&
    typeof d.synopsis === "string" &&
    Array.isArray(d.scenes) &&
    d.scenes.length > 0 &&
    d.scenes.every(validateSceneBreakdown) &&
    Array.isArray(d.timeline) &&
    typeof d.style_guide === "object" &&
    d.style_guide !== null
  );
}

function sanitizeJsonResponse(text: string): string {
  let cleaned = text.trim();

  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch?.[1]) {
    cleaned = jsonBlockMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

export async function generateStoryboardBreakdown(
  input: StoryboardGenerationInput
): Promise<StoryboardGenerationOutput> {
  const openai = getOpenAIClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: buildStoryboardSystemPrompt() },
          { role: "user", content: buildStoryboardUserPrompt(input) },
        ],
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error("Empty response from OpenAI");
      }

      const sanitized = sanitizeJsonResponse(rawContent);
      const parsed: unknown = JSON.parse(sanitized);

      if (!validateOutput(parsed)) {
        throw new Error("Response does not match expected schema");
      }

      if (parsed.scenes.length !== input.scene_count) {
        parsed.scenes = parsed.scenes.slice(0, input.scene_count);
        parsed.scenes.forEach((scene, i) => {
          scene.scene_number = i + 1;
        });
      }

      let runningTime = 0;
      parsed.timeline = parsed.scenes.map((scene) => {
        const entry = {
          scene_number: scene.scene_number,
          start_time: runningTime,
          end_time: runningTime + scene.duration_seconds,
          description: scene.title,
        };
        runningTime += scene.duration_seconds;
        return entry;
      });

      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[AI Engine] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
        lastError.message
      );
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw new Error(
    `Storyboard generation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}
