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
    Array.isArray(d.segments) &&
    d.segments.length > 0 &&
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

      const targetCount = input.segment_count ?? input.scene_count ?? 5;

      // Trim to requested segment count and renumber
      if (parsed.segments.length > targetCount) {
        parsed.segments = parsed.segments.slice(0, targetCount);
      }
      parsed.segments.forEach((seg, i) => {
        seg.segment_number = i + 1;
        if (!seg.duration_seconds) seg.duration_seconds = 8;
        if (!Array.isArray(seg.beats)) seg.beats = [];
        if (!seg.marketing_role) {
          seg.marketing_role =
            i === 0 ? "hook" : i === parsed.segments.length - 1 ? "cta" : "body";
        }
        if (!seg.first_frame_prompt) seg.first_frame_prompt = seg.title;
        if (!seg.motion_prompt) seg.motion_prompt = seg.title;
        if (seg.dialogue === undefined) seg.dialogue = null;
        // When dialogue is required, never leave it empty — fall back to the
        // segment title so the UI/assembly guide always carries a spoken line.
        if (input.force_dialogue !== false) {
          const line = typeof seg.dialogue === "string" ? seg.dialogue.trim() : "";
          if (!line) seg.dialogue = seg.title;
        }
        if (!seg.continuity_note) {
          seg.continuity_note = i === 0 ? "opening shot" : "continues from previous segment";
        }
        // Backfill camera notes on beats
        seg.beats.forEach((b) => {
          if (!b.camera) b.camera = "[EYE]";
        });
      });

      // Ensure total_duration_seconds
      if (!parsed.total_duration_seconds) {
        parsed.total_duration_seconds = parsed.segments.reduce(
          (sum, s) => sum + (s.duration_seconds || 8),
          0
        );
      }

      // Ensure mood_tags
      if (!parsed.mood_tags || parsed.mood_tags.length === 0) {
        parsed.mood_tags = ["dramatic"];
      }

      // Ensure character_locks have defaults
      if (!Array.isArray(parsed.character_locks)) {
        parsed.character_locks = [];
      }
      // Drop any malformed (non-object) entries the model may have returned so
      // the gender backfill and downstream mapping never crash on them.
      parsed.character_locks = parsed.character_locks.filter(
        (l): l is NonNullable<typeof l> => !!l && typeof l === "object"
      );
      // Backfill the explicit gender lock from gender_age text when the model
      // forgot the dedicated field (so downstream always has a hard male/female).
      for (const lock of parsed.character_locks) {
        if (lock.gender !== "male" && lock.gender !== "female") {
          const hay = `${lock.gender_age ?? ""} ${lock.name ?? ""}`.toLowerCase();
          if (/\b(female|woman|girl|she|nữ|cô|chị|bà)\b/.test(hay)) lock.gender = "female";
          else if (/\b(male|man|boy|he|nam|anh|ông|chú)\b/.test(hay)) lock.gender = "male";
        }
      }

      // Ensure marketing_structure exists
      if (!parsed.marketing_structure) {
        parsed.marketing_structure = {
          hook: parsed.synopsis,
          problem: "",
          solution: "",
          cta: "",
        };
      }

      // Ensure a style_guide exists (the model sometimes omits it, which used
      // to crash downstream when reading style_guide.color_palette).
      if (!parsed.style_guide || typeof parsed.style_guide !== "object") {
        parsed.style_guide = {
          color_palette: [],
          art_direction: "",
          visual_references: "",
          consistency_notes: "",
        };
      } else if (!Array.isArray(parsed.style_guide.color_palette)) {
        parsed.style_guide.color_palette = [];
      }

      // Ensure a Scene Bible exists (style fingerprint reused everywhere).
      if (!parsed.scene_bible || typeof parsed.scene_bible !== "object") {
        parsed.scene_bible = {
          lens: "50mm lens, f/2.8",
          lighting: "soft key 4800K + subtle rim light 5600K",
          backdrop: "consistent single location for the whole segment",
          color_grade: "neutral Rec.709 grade, photoreal premium commercial",
        };
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
