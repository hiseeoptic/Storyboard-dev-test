import { getOpenAIClient } from "@/lib/openai/client";
import { geminiGenerateText } from "@/lib/gemini/client";
import {
  buildStoryboardSystemPrompt,
  buildStoryboardUserPrompt,
} from "@/prompts";
import type {
  AIProvider,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
} from "@/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateOutput(data: unknown): data is StoryboardGenerationOutput {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.title === "string" &&
    typeof d.synopsis === "string" &&
    Array.isArray(d.scenes) &&
    d.scenes.length > 0 &&
    Array.isArray(d.character_locks) &&
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
  input: StoryboardGenerationInput,
  provider: AIProvider = "openai"
): Promise<StoryboardGenerationOutput> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let rawContent: string | null = null;

      if (provider === "gemini") {
        rawContent = await geminiGenerateText({
          systemPrompt: buildStoryboardSystemPrompt(),
          userPrompt: buildStoryboardUserPrompt(input),
          jsonMode: true,
          temperature: 0.7,
          maxOutputTokens: 8192,
        });
      } else {
        const openai = getOpenAIClient();
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
        rawContent = completion.choices[0]?.message?.content ?? null;
      }

      if (!rawContent) {
        throw new Error(`Empty response from ${provider}`);
      }

      const sanitized = sanitizeJsonResponse(rawContent);
      const parsed: unknown = JSON.parse(sanitized);

      if (!validateOutput(parsed)) {
        throw new Error("Response does not match expected schema");
      }

      // Ensure scene count matches
      if (parsed.scenes.length !== input.scene_count) {
        parsed.scenes = parsed.scenes.slice(0, input.scene_count);
        parsed.scenes.forEach((scene, i) => {
          scene.scene_number = i + 1;
        });
      }

      // Rebuild timeline
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

      // Ensure total_duration_seconds
      if (!parsed.total_duration_seconds) {
        parsed.total_duration_seconds = runningTime;
      }

      // Ensure mood_tags
      if (!parsed.mood_tags || parsed.mood_tags.length === 0) {
        parsed.mood_tags = ["dramatic"];
      }

      // Ensure character_locks have defaults
      if (!parsed.character_locks) {
        parsed.character_locks = [];
      }

      // Backfill camera_code if missing
      for (const scene of parsed.scenes) {
        if (!scene.camera_code) {
          scene.camera_code = "[EYE]";
        }
        if (!scene.camera_movement) {
          scene.camera_movement = "static";
        }
      }

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
