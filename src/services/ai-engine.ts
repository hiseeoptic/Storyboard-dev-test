import { getOpenAIClient } from "@/lib/openai/client";
import { geminiGenerateText, STORYBOARD_TEXT_MODEL } from "@/lib/gemini/client";
import { claudeGenerateText } from "@/lib/anthropic/client";
import { jsonrepair } from "jsonrepair";
import {
  buildScriptWriterSystemPrompt,
  buildScriptWriterUserPrompt,
  buildStoryboardSystemPrompt,
  buildStoryboardUserPrompt,
  buildSegmentRewriteUserPrompt,
} from "@/prompts";
import {
  buildContextAnalysisSystemPrompt,
  buildContextAnalysisUserPrompt,
  contextIrToWorldContext,
  resolvedVideoContextSchema,
  VIDEO_CONTEXT_RESPONSE_SCHEMA,
  type ResolvedVideoContext,
} from "@/lib/video-context";
import { sceneIntentSchema } from "@/lib/scene-intent";
import type {
  AIProvider,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  VideoSegment,
} from "@/types";

const MAX_RETRIES = 3;
// Full storyboard JSON is the expensive call. Re-running it three times can
// consume Vercel's entire 300s window after a harmless JSON syntax miss. Local
// repair runs first; at most one fresh retry is allowed.
const STORYBOARD_MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const MIN_REMOTE_CALL_BUDGET_MS = 8_000;
const STRING_SCHEMA = { type: "STRING" };
const INTEGER_SCHEMA = { type: "INTEGER" };
const NUMBER_SCHEMA = { type: "NUMBER" };
const BOOLEAN_SCHEMA = { type: "BOOLEAN" };
const STRING_ARRAY_SCHEMA = { type: "ARRAY", items: STRING_SCHEMA };

function hasUploadedCharacterReferences(input: StoryboardGenerationInput): boolean {
  return (input.character_images ?? []).some((entry) => (entry.images?.length ?? 0) > 0);
}

interface GenerationTimingOptions {
  /** Absolute wall-clock deadline shared by every AI stage in one request. */
  deadlineMs?: number;
  /** Optional narrower retry count for a fallback provider. */
  maxAttempts?: number;
}

function boundedTimeoutMs(
  options: GenerationTimingOptions | undefined,
  preferredTimeoutMs: number,
  phase: string
): number {
  if (!options?.deadlineMs) return preferredTimeoutMs;
  const remainingMs = options.deadlineMs - Date.now();
  if (remainingMs < MIN_REMOTE_CALL_BUDGET_MS) {
    throw new Error(
      `Generation time budget exhausted before ${phase}; stopped safely instead of waiting for the server timeout`
    );
  }
  return Math.min(preferredTimeoutMs, remainingMs);
}

function attemptLimit(defaultLimit: number, options?: GenerationTimingOptions): number {
  return Math.max(1, Math.min(defaultLimit, options?.maxAttempts ?? defaultLimit));
}

// One storyboard segment — shared by the full-storyboard schema and the
// single-segment rewrite endpoint so the two can never drift apart.
const SEGMENT_ITEM_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    segment_number: INTEGER_SCHEMA,
    duration_seconds: INTEGER_SCHEMA,
    title: STRING_SCHEMA,
    marketing_role: STRING_SCHEMA,
    // scene_intent (the codex 10-layer ~15-field object) is NO LONGER requested
    // here: it ballooned the JSON so the tail segment truncated (stub scenes)
    // and the whole call timed out. The video prompts render fine without it.
    beats: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          beat: STRING_SCHEMA,
          camera: STRING_SCHEMA,
        },
        required: ["beat", "camera"],
      },
    },
    first_frame_prompt: STRING_SCHEMA,
    motion_prompt: STRING_SCHEMA,
    dialogue: STRING_SCHEMA,
    speaker: STRING_SCHEMA,
    // TẦNG 9 turn-taking: up to 3 sequential timed turns per clip.
    dialogue_lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          speaker: STRING_SCHEMA,
          text: STRING_SCHEMA,
          start_s: NUMBER_SCHEMA,
          end_s: NUMBER_SCHEMA,
        },
        required: ["speaker", "text"],
      },
    },
    // CAST-SYNC + ENVIRONMENT ENGINE per-segment locks.
    characters_in_scene: STRING_ARRAY_SCHEMA,
    environment_ref: STRING_SCHEMA,
    // PHYSICAL TOPOLOGY: compact and separate from prose so scene geometry,
    // blocking, motion and camera all consume one authoritative map. Optional
    // in the transport schema for backward compatibility; the system prompt
    // requires it for multi-zone / doorway / boundary scenes and the compiler
    // deterministically repairs older segments that omit it.
    spatial_layout: {
      type: "OBJECT",
      properties: {
        zone_order: STRING_SCHEMA,
        fixed_architecture: STRING_SCHEMA,
        character_placement: STRING_SCHEMA,
        walkable_path: STRING_SCHEMA,
        camera_zone: STRING_SCHEMA,
      },
      required: [
        "zone_order",
        "fixed_architecture",
        "character_placement",
        "walkable_path",
        "camera_zone",
      ],
    },
    continuity_note: STRING_SCHEMA,
    // MOTIVATED WARDROBE CHANGE: when the story physically changes a
    // character's look (shower → home clothes, getting dressed, rain), the
    // model declares the CURRENT look here for this and every later segment,
    // overriding the base character_lock costume/hair.
    wardrobe_state: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          character: STRING_SCHEMA,
          outfit: STRING_SCHEMA,
          outfit_materials: STRING_SCHEMA,
          hair: STRING_SCHEMA,
        },
        required: ["character", "outfit"],
      },
    },
  },
  required: [
    "segment_number",
    "duration_seconds",
    "title",
    "marketing_role",
    "beats",
    "first_frame_prompt",
    "motion_prompt",
    "dialogue",
    "continuity_note",
  ],
};

// Gemini's JSON mode is much more reliable when it gets a concrete schema.
// Keep this local to the storyboard text step so the rest of the pipeline stays unchanged.
const STORYBOARD_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    title: STRING_SCHEMA,
    synopsis: STRING_SCHEMA,
    total_duration_seconds: INTEGER_SCHEMA,
    mood_tags: STRING_ARRAY_SCHEMA,
    // TẦNG 0 — Context-Locked Video DNA: the world the model resolved from the
    // brief and LOCKED. Every other field must obey it.
    world_context: {
      type: "OBJECT",
      properties: {
        world_type: STRING_SCHEMA,
        reality_level: STRING_SCHEMA,
        genre: STRING_SCHEMA,
        geography: STRING_SCHEMA,
        culture: STRING_SCHEMA,
        time_period: STRING_SCHEMA,
        technology_level: STRING_SCHEMA,
        social_class: STRING_SCHEMA,
        environment_category: STRING_SCHEMA,
        visual_style: STRING_SCHEMA,
        audio_style: STRING_SCHEMA,
        allowed_language_text: STRING_SCHEMA,
        forbidden_entities: STRING_ARRAY_SCHEMA,
        intentional_exceptions: STRING_ARRAY_SCHEMA,
      },
      required: [
        "world_type",
        "reality_level",
        "genre",
        "geography",
        "culture",
        "time_period",
        "technology_level",
        "social_class",
        "environment_category",
        "visual_style",
        "audio_style",
        "forbidden_entities",
      ],
    },
    marketing_structure: {
      type: "OBJECT",
      properties: {
        hook: STRING_SCHEMA,
        problem: STRING_SCHEMA,
        solution: STRING_SCHEMA,
        cta: STRING_SCHEMA,
      },
      required: ["hook", "problem", "solution", "cta"],
    },
    // 2-6 word UPPERCASE smash-hook printed HUGE on the 9:16 thumbnail.
    thumbnail_title: STRING_SCHEMA,
    // Platform-native ready-to-post captions (TikTok / YT Shorts / FB Reels).
    social_posts: {
      type: "OBJECT",
      properties: {
        tiktok: {
          type: "OBJECT",
          properties: {
            caption: STRING_SCHEMA,
            hashtags: STRING_ARRAY_SCHEMA,
          },
          required: ["caption", "hashtags"],
        },
        youtube_shorts: {
          type: "OBJECT",
          properties: {
            title: STRING_SCHEMA,
            description: STRING_SCHEMA,
            hashtags: STRING_ARRAY_SCHEMA,
          },
          required: ["title", "description", "hashtags"],
        },
        facebook_reel: {
          type: "OBJECT",
          properties: {
            caption: STRING_SCHEMA,
            hashtags: STRING_ARRAY_SCHEMA,
          },
          required: ["caption", "hashtags"],
        },
      },
      required: ["tiktok", "youtube_shorts", "facebook_reel"],
    },
    character_locks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: STRING_SCHEMA,
          gender: STRING_SCHEMA,
          is_child: BOOLEAN_SCHEMA,
          gender_age: STRING_SCHEMA,
          build: STRING_SCHEMA,
          skin_tone: STRING_SCHEMA,
          face_structure: STRING_SCHEMA,
          skin_texture: STRING_SCHEMA,
          eye_details: STRING_SCHEMA,
          eyebrow_details: STRING_SCHEMA,
          eyelash_details: STRING_SCHEMA,
          nose_lips_details: STRING_SCHEMA,
          hair: STRING_SCHEMA,
          hair_details: STRING_SCHEMA,
          eyes: STRING_SCHEMA,
          costume: STRING_SCHEMA,
          wardrobe_materials: STRING_SCHEMA,
          signature_features: STRING_SCHEMA,
          default_expression: STRING_SCHEMA,
          render_style: STRING_SCHEMA,
          dna: STRING_SCHEMA,
          voice: STRING_SCHEMA,
        },
        required: [
          "name",
          "gender",
          "gender_age",
          "build",
          "skin_tone",
          "face_structure",
          "skin_texture",
          "eye_details",
          "eyebrow_details",
          "eyelash_details",
          "nose_lips_details",
          "hair",
          "hair_details",
          "eyes",
          "costume",
          "signature_features",
          "default_expression",
          "render_style",
        ],
      },
    },
    scene_bible: {
      type: "OBJECT",
      properties: {
        lens: STRING_SCHEMA,
        lighting: STRING_SCHEMA,
        backdrop: STRING_SCHEMA,
        color_grade: STRING_SCHEMA,
        film_grain: STRING_SCHEMA,
      },
      required: ["lens", "lighting", "backdrop", "color_grade"],
    },
    product_dna: STRING_SCHEMA,
    segments: {
      type: "ARRAY",
      items: SEGMENT_ITEM_SCHEMA,
    },
    style_guide: {
      type: "OBJECT",
      properties: {
        color_palette: STRING_ARRAY_SCHEMA,
        art_direction: STRING_SCHEMA,
        visual_references: STRING_SCHEMA,
        consistency_notes: STRING_SCHEMA,
      },
      required: ["color_palette", "art_direction", "visual_references", "consistency_notes"],
    },
  },
  required: ["title", "synopsis", "world_context", "social_posts", "thumbnail_title", "character_locks", "segments", "style_guide"],
};

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

/**
 * Restore only envelope fields that already have deterministic defaults later
 * in this pipeline. A locally repaired/truncated Gemini object often preserves
 * the expensive segments but loses the small tail field `style_guide`; it must
 * not be rejected before the existing defaulting code gets a chance to run.
 * No segment, dialogue, prompt or user-authored value is rewritten here.
 */
function prepareOutputForValidation(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;
  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.character_locks)) {
    d.character_locks = [];
  }

  if (typeof d.style_guide !== "object" || d.style_guide === null) {
    d.style_guide = {
      color_palette: [],
      art_direction: "",
      visual_references: "",
      consistency_notes: "",
    };
  } else {
    const style = d.style_guide as Record<string, unknown>;
    if (!Array.isArray(style.color_palette)) style.color_palette = [];
    if (typeof style.art_direction !== "string") style.art_direction = "";
    if (typeof style.visual_references !== "string") style.visual_references = "";
    if (typeof style.consistency_notes !== "string") style.consistency_notes = "";
  }

  return d;
}

/** Safe schema diagnostic: field names/types only, never user prompt values. */
function describeOutputMismatch(data: unknown): string {
  if (typeof data !== "object" || data === null) return "root is not an object";
  const d = data as Record<string, unknown>;
  const invalid: string[] = [];
  if (typeof d.title !== "string") invalid.push("title");
  if (typeof d.synopsis !== "string") invalid.push("synopsis");
  if (!Array.isArray(d.segments) || d.segments.length === 0) invalid.push("segments");
  if (!Array.isArray(d.character_locks)) invalid.push("character_locks");
  if (typeof d.style_guide !== "object" || d.style_guide === null) invalid.push("style_guide");
  return invalid.length > 0 ? `invalid fields: ${invalid.join(", ")}` : "unknown envelope mismatch";
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

function stripTrailingCommasOutsideStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json.charAt(i);

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < json.length && /\s/.test(json.charAt(j))) j++;
      const next = json.charAt(j);
      if (next === "}" || next === "]") continue;
    }

    out += ch;
  }

  return out;
}

/**
 * Repair MISSING commas between JSON values (the model's most common syntax
 * slip in nested arrays, e.g. `} {` between dialogue_lines entries or
 * `"end_s": 3 "speaker"`). Walks outside strings only: when a value-ending
 * char is followed (across whitespace) by the start of a new value, a comma
 * is inserted between them.
 */
function insertMissingCommasOutsideStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  const endsValue = (c: string) => /["\d}\]]|[el]/.test(c); // ", digit, }, ], true/false/null endings
  const startsValue = (c: string) => /["{\[\-\d]|[tfn]/.test(c);

  for (let i = 0; i < json.length; i++) {
    const ch = json.charAt(i);

    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        // Closing quote: look ahead for a missing comma before the next value.
        let j = i + 1;
        while (j < json.length && /\s/.test(json.charAt(j))) j++;
        const next = json.charAt(j);
        // After a closing string, `:` means it was a key; `,}]` are fine.
        if (next && next !== ":" && next !== "," && next !== "}" && next !== "]" && startsValue(next)) {
          out += ",";
        }
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    out += ch;
    if (endsValue(ch) && ch !== '"') {
      let j = i + 1;
      while (j < json.length && /\s/.test(json.charAt(j))) j++;
      const next = json.charAt(j);
      if (next && next !== "," && next !== "}" && next !== "]" && next !== ":" && startsValue(next)) {
        // Guard: only fire after a COMPLETE literal (e.g. `e` of true/false/null
        // or a digit not followed by more digits/dot/exponent).
        if (/[el}\]]/.test(ch) || (/\d/.test(ch) && !/[\d.eE+\-]/.test(json.charAt(i + 1) || ""))) {
          out += ",";
        }
      }
    }
  }

  return out;
}

function parseJsonResponse(text: string): unknown {
  const sanitized = sanitizeJsonResponse(text);

  try {
    return JSON.parse(sanitized);
  } catch (err) {
    // Repair pass 1: trailing commas. Pass 2: missing commas. Pass 3: both.
    const candidates = [
      stripTrailingCommasOutsideStrings(sanitized),
      insertMissingCommasOutsideStrings(sanitized),
      insertMissingCommasOutsideStrings(stripTrailingCommasOutsideStrings(sanitized)),
    ];
    for (const candidate of candidates) {
      if (candidate !== sanitized) {
        try {
          return JSON.parse(candidate);
        } catch {
          // try the next repair
        }
      }
    }

    // Final deterministic repair for malformed/truncated LLM JSON. This runs
    // locally in milliseconds and preserves the JSON data; it never sends the
    // 40k+ payload back to Gemini for a second, token-expensive repair call.
    try {
      const repaired = jsonrepair(sanitized);
      const parsed = JSON.parse(repaired);
      console.warn(
        "[AI Engine] Repaired malformed storyboard JSON locally; no repair-model call was used."
      );
      return parsed;
    } catch {
      // Keep the original JSON.parse error because its byte/line position is
      // the most useful diagnostic if every local repair strategy failed.
    }
    throw err;
  }
}

/**
 * Stage 1.5 — resolve the project's neutral 10-layer context once.
 * Storyboard expansion then consumes this canonical IR instead of inventing a
 * different environment, light, continuity mode, or audio world per field.
 */
export async function analyzeVideoContext(
  input: StoryboardGenerationInput,
  provider: AIProvider = "gemini",
  timing?: GenerationTimingOptions
): Promise<ResolvedVideoContext> {
  const systemPrompt = buildContextAnalysisSystemPrompt();
  const userPrompt = buildContextAnalysisUserPrompt(input);
  let lastError: Error | null = null;

  const maxAttempts = attemptLimit(2, timing);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      let rawContent: string | null = null;

      if (provider === "claude") {
        rawContent = await claudeGenerateText({
          systemPrompt,
          userPrompt: `${userPrompt}\n\nReturn ONLY the JSON object — no markdown or commentary.`,
          maxTokens: 7000,
          timeoutMs: boundedTimeoutMs(timing, 45_000, "Claude context analysis"),
        });
      } else if (provider === "gemini") {
        rawContent = await geminiGenerateText({
          systemPrompt,
          userPrompt,
          jsonMode: true,
          responseSchema: VIDEO_CONTEXT_RESPONSE_SCHEMA,
          temperature: 0.15,
          maxOutputTokens: 8192,
          timeoutMs: boundedTimeoutMs(timing, 45_000, "Gemini context analysis"),
        });
      } else {
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create(
          {
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.15,
            max_tokens: 7000,
            response_format: { type: "json_object" },
          },
          { timeout: boundedTimeoutMs(timing, 45_000, "OpenAI context analysis") }
        );
        rawContent = completion.choices[0]?.message?.content ?? null;
      }

      if (!rawContent) throw new Error(`Empty context response from ${provider}`);
      const parsed = resolvedVideoContextSchema.safeParse(parseJsonResponse(rawContent));
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        throw new Error(
          `Context IR schema mismatch${firstIssue ? ` at ${firstIssue.path.join(".")}: ${firstIssue.message}` : ""}`
        );
      }
      return parsed.data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[AI Engine] Context analysis attempt ${attempt + 1}/${maxAttempts} failed:`,
        lastError.message
      );
      if (attempt < maxAttempts - 1) await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(`Context analysis failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

/**
 * Stage 1 — write ONLY the creative script (plain text) with the chosen model
 * (e.g. Claude Opus). A separate model then expands this into the storyboard
 * JSON (Stage 2). Returns the raw script text, or throws on failure.
 */
export async function generateScript(
  input: StoryboardGenerationInput,
  provider: AIProvider = "claude",
  timing?: GenerationTimingOptions
): Promise<string> {
  const systemPrompt = buildScriptWriterSystemPrompt();
  const userPrompt = buildScriptWriterUserPrompt(input);
  let lastError: Error | null = null;

  const maxAttempts = attemptLimit(MAX_RETRIES, timing);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      let text: string | null = null;

      if (provider === "claude") {
        text = await claudeGenerateText({
          systemPrompt,
          userPrompt,
          maxTokens: 8000,
          timeoutMs: boundedTimeoutMs(timing, 60_000, "Claude script generation"),
        });
      } else if (provider === "gemini") {
        text = await geminiGenerateText({
          systemPrompt,
          userPrompt,
          temperature: 0.85,
          maxOutputTokens: 4096,
          timeoutMs: boundedTimeoutMs(timing, 45_000, "Gemini script generation"),
        });
      } else {
        // GPT-5-mini: strong creative writing at ~1/5 the price of gpt-4o.
        // GPT-5-series models take `max_completion_tokens` (NOT `max_tokens`)
        // and only support the default temperature — sending either legacy
        // param 400s the request. Overridable via OPENAI_SCRIPT_MODEL.
        const openai = getOpenAIClient();
        const scriptModel = process.env.OPENAI_SCRIPT_MODEL || "gpt-5-mini";
        const isGpt5 = scriptModel.startsWith("gpt-5") || scriptModel.startsWith("o");
        const completion = await openai.chat.completions.create(
          {
            model: scriptModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            ...(isGpt5
              ? { max_completion_tokens: 8000 }
              : { temperature: 0.85, max_tokens: 4000 }),
          },
          { timeout: boundedTimeoutMs(timing, 60_000, "OpenAI script generation") }
        );
        text = completion.choices[0]?.message?.content ?? null;
      }

      const script = (text ?? "").trim();
      if (script.length < 40) {
        throw new Error(`Empty/short script from ${provider}`);
      }
      return script;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[AI Engine] Script attempt ${attempt + 1}/${maxAttempts} failed:`,
        lastError.message
      );
      if (attempt < maxAttempts - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw new Error(
    `Script generation failed after ${maxAttempts} attempts: ${lastError?.message}`
  );
}

export async function generateStoryboardBreakdown(
  input: StoryboardGenerationInput,
  provider: AIProvider = "openai",
  timing?: GenerationTimingOptions
): Promise<StoryboardGenerationOutput> {
  let lastError: Error | null = null;
  const maxAttempts = attemptLimit(STORYBOARD_MAX_RETRIES, timing);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      let rawContent: string | null = null;

      if (provider === "claude") {
        // Claude Opus 4.8 writes the best scripts. It returns text; the JSON is
        // extracted by sanitizeJsonResponse below (no responseMimeType on Claude).
        rawContent = await claudeGenerateText({
          systemPrompt: buildStoryboardSystemPrompt(hasUploadedCharacterReferences(input)),
          userPrompt:
            buildStoryboardUserPrompt(input) +
            "\n\nReturn ONLY the JSON object described above — no markdown, no code fences, no prose before or after.",
          maxTokens: 16000,
          timeoutMs: boundedTimeoutMs(timing, 60_000, "Claude storyboard generation"),
        });
      } else if (provider === "gemini") {
        rawContent = await geminiGenerateText({
          systemPrompt: buildStoryboardSystemPrompt(hasUploadedCharacterReferences(input)),
          userPrompt: buildStoryboardUserPrompt(input),
          jsonMode: true,
          responseSchema: STORYBOARD_RESPONSE_SCHEMA,
          temperature: attempt === 0 ? 0.25 : 0.1,
          // Segments grew richer (freeze-frame continuity notes, blocking,
          // wardrobe_state, four-element dialogue timing) — the old 12k floor
          // started truncating tails into stub scenes for EVERY genre. Budget
          // ~3200/segment with a 16k floor; Gemini 2.5 Flash handles it fine.
          // Scale the output budget by BOTH segment count AND character count:
          // every extra character adds a full character_locks entry (~15 fields)
          // + bigger spatial_layout.character_placement, so 3-5 characters is
          // what pushes the JSON tail past the old cap into a 1-scene stub.
          // Cap 49152 stays under gemini-2.5-flash's 65536 output ceiling while
          // leaving headroom before the generation time gets too long.
          maxOutputTokens: Math.min(
            49152,
            Math.max(
              28672,
              (input.segment_count ?? input.scene_count ?? 5) * 4200 +
                Math.max(
                  input.character_descriptions?.length ?? 0,
                  input.character_images?.length ?? 0,
                  1
                ) * 2500
            )
          ),
          // Storyboard model (gemini-2.5-flash by default; Gemini 3 via env).
          model: STORYBOARD_TEXT_MODEL,
          // CRITICAL for avoiding stub scenes: keep the model's THINKING from
          // eating the output-token budget. The added spatial-topology +
          // creative-route requirements make 2.5-flash think a lot by default;
          // that thinking was consuming maxOutputTokens and truncating the JSON
          // tail into 1-scene stubs. thinkingBudget 0 (2.5) / thinkingLevel low
          // (Gemini 3) hands the whole budget to the JSON — the schema already
          // guides the structure, so deep thinking isn't needed here.
          thinkingBudget: 0,
          thinkingLevel: "low",
          // A larger JSON (more characters/segments) takes longer to stream;
          // give it more wall-clock, clamped to whatever the shared deadline
          // leaves so it still stops safely before Vercel's 300s cut-off.
          timeoutMs: boundedTimeoutMs(timing, 150_000, "Gemini storyboard generation"),
        });
      } else {
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create(
          {
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: buildStoryboardSystemPrompt(hasUploadedCharacterReferences(input)),
              },
              { role: "user", content: buildStoryboardUserPrompt(input) },
            ],
            temperature: 0.7,
            // Richer segments need more room — 8k truncated tails into stubs
            // when this path runs as the rescue provider. gpt-4o caps at 16384.
            max_tokens: 14000,
            response_format: { type: "json_object" },
          },
          { timeout: boundedTimeoutMs(timing, 75_000, "OpenAI storyboard generation") }
        );
        rawContent = completion.choices[0]?.message?.content ?? null;
      }

      if (!rawContent) {
        throw new Error(`Empty response from ${provider}`);
      }

      const parsed = prepareOutputForValidation(parseJsonResponse(rawContent));

      if (!validateOutput(parsed)) {
        throw new Error(
          `Response does not match expected schema (${describeOutputMismatch(parsed)})`
        );
      }

      // TRUNCATION GUARD (fixes the "Lời thương yêu" stub-segment bug):
      // jsonrepair can salvage a token-truncated response into "valid" JSON
      // whose TAIL segments are stubs (only a title, no real motion/scene).
      // Those then get title-backfilled into garbage where action == dialogue
      // == the title. Detect incomplete segments from the model's REAL output
      // (or a short segment count) and RETRY for a complete script; accept a
      // stub only on the final attempt as a last resort.
      const requestedCount = input.segment_count ?? input.scene_count ?? 5;
      const stubs = parsed.segments.filter(
        (s) =>
          !(typeof s.motion_prompt === "string" && s.motion_prompt.trim()) ||
          !(typeof s.first_frame_prompt === "string" && s.first_frame_prompt.trim())
      );
      const tooFew = parsed.segments.length < requestedCount;
      if ((stubs.length > 0 || tooFew) && attempt < maxAttempts - 1) {
        throw new Error(
          `Storyboard JSON incomplete — ${stubs.length} stub segment(s), ${parsed.segments.length}/${requestedCount} returned (likely output-token truncation); retrying`
        );
      }

      // Gemini's STRING response schema used to turn a JSON null into the
      // literal text "null", which the compiler then rendered as PRODUCT: null.
      if (
        typeof parsed.product_dna === "string" &&
        /^(null|none|n\/a|not applicable|không có)$/i.test(parsed.product_dna.trim())
      ) {
        parsed.product_dna = undefined;
      }

      // SCENE INTENT is no longer requested from the model (it bloated the JSON
      // into truncation + timeouts). If a model still echoes one, keep it when
      // it parses; otherwise just drop it — the prompts render fine without it.
      for (const segment of parsed.segments) {
        if (segment.scene_intent == null) continue;
        const intent = sceneIntentSchema.safeParse(segment.scene_intent);
        segment.scene_intent = intent.success ? intent.data : undefined;
      }

      // Stage 1.5 is canonical. The storyboard model may echo a different
      // legacy world_context, so replace that echo deterministically and keep
      // the full 10-layer IR on the project output.
      if (input.resolved_context) {
        parsed.context_ir = input.resolved_context;
        parsed.world_context = contextIrToWorldContext(input.resolved_context);
      }

      const targetCount = input.segment_count ?? input.scene_count ?? 5;

      // Trim to requested segment count and renumber
      if (parsed.segments.length > targetCount) {
        parsed.segments = parsed.segments.slice(0, targetCount);
      }
      parsed.segments.forEach((seg, i) => {
        seg.segment_number = i + 1;
        if (!seg.duration_seconds) seg.duration_seconds = 10;
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
        // Do not invent a speaker when the model omits one. An empty speaker is
        // an explicit voiceover/unspecified owner and is resolved only from
        // exact dialogue data later; never default to the first character lock.
        if (seg.speaker === undefined || seg.speaker === null) seg.speaker = "";
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

      // TẦNG 0 — ensure a locked world_context exists (Context-Locked DNA).
      // Claude/OpenAI paths have no response schema, so backfill a sensible
      // default resolved from the input rather than leaving the lock empty.
      if (!parsed.world_context || typeof parsed.world_context !== "object") {
        parsed.world_context = {
          world_type: "cinematic realistic",
          reality_level: "Level 2 — Cinematic Reality",
          genre: input.genre ?? "other",
          geography: (input.dialogue_language ?? "Vietnamese") === "Vietnamese" ? "Vietnam" : "unspecified",
          culture: (input.dialogue_language ?? "Vietnamese") === "Vietnamese" ? "contemporary Vietnamese" : "contemporary",
          time_period: "contemporary",
          technology_level: "modern everyday",
          social_class: "middle class",
          environment_category: input.setting || "everyday interior",
          visual_style: input.style,
          audio_style: "natural diegetic ambience",
          forbidden_entities: [
            "out-of-era technology",
            "foreign signage with no story reason",
            "off-culture architecture and props",
          ],
        };
      }

      // Ensure a short smash-hook title for the thumbnail exists (fallback:
      // first ~5 words of the title, uppercased).
      if (!parsed.thumbnail_title || !String(parsed.thumbnail_title).trim()) {
        parsed.thumbnail_title = (parsed.title ?? "")
          .split(/\s+/)
          .slice(0, 5)
          .join(" ")
          .toUpperCase();
      }

      // Ensure ready-to-post social captions exist (derive a simple set from
      // the title/synopsis when the model omitted them).
      if (!parsed.social_posts || typeof parsed.social_posts !== "object") {
        const firstLine = (parsed.synopsis ?? "").split(/(?<=[.!?])\s+/)[0] ?? parsed.title;
        parsed.social_posts = {
          tiktok: {
            caption: `${parsed.title} 😮 Xem hết rồi nói cảm nhận của bạn ở comment nhé 👇`,
            hashtags: ["#viral", "#xuhuong", "#fyp", "#learnontiktok"],
          },
          youtube_shorts: {
            title: parsed.title,
            description: `${firstLine} Đăng ký kênh để xem tập tiếp theo!`,
            hashtags: ["#Shorts", "#viral", "#xuhuong"],
          },
          facebook_reel: {
            caption: `${firstLine} ❤️ Chia sẻ cho người cần xem điều này nhé!`,
            hashtags: ["#reels", "#viral", "#xuhuong"],
          },
        };
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
        `[AI Engine] Attempt ${attempt + 1}/${maxAttempts} failed:`,
        lastError.message
      );
      if (attempt < maxAttempts - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw new Error(
    `Storyboard generation failed after ${maxAttempts} attempts: ${lastError?.message}`
  );
}

function validateSegment(data: unknown): data is VideoSegment {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.motion_prompt === "string" && typeof d.first_frame_prompt === "string";
}

/**
 * Rewrites ONE segment of an existing breakdown around its (user-edited)
 * dialogue turns — the per-scene "Tạo lại" in the script editor. The rest of
 * the storyboard is passed only as chaining context and is never modified.
 */
export async function rewriteStoryboardSegment(params: {
  input: StoryboardGenerationInput;
  breakdown: StoryboardGenerationOutput;
  segmentIndex: number;
  provider?: AIProvider;
}): Promise<VideoSegment> {
  const provider = params.provider ?? "gemini";
  const original = params.breakdown.segments[params.segmentIndex];
  if (!original) {
    throw new Error(`Segment index ${params.segmentIndex} not found`);
  }
  const systemPrompt = buildStoryboardSystemPrompt(hasUploadedCharacterReferences(params.input));
  const userPrompt = buildSegmentRewriteUserPrompt({
    input: params.input,
    breakdown: params.breakdown,
    segmentIndex: params.segmentIndex,
  });
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let rawContent: string | null = null;

      if (provider === "claude") {
        rawContent = await claudeGenerateText({
          systemPrompt,
          userPrompt:
            userPrompt +
            "\n\nReturn ONLY the JSON object — no markdown, no code fences, no prose.",
          maxTokens: 4000,
        });
      } else if (provider === "gemini") {
        rawContent = await geminiGenerateText({
          systemPrompt,
          userPrompt,
          jsonMode: true,
          responseSchema: SEGMENT_ITEM_SCHEMA,
          temperature: 0.35,
          maxOutputTokens: 8192,
          // Same as the full breakdown: keep thinking from eating the output
          // budget (one rich segment with spatial_layout can truncate at 4k).
          model: STORYBOARD_TEXT_MODEL,
          thinkingBudget: 0,
          thinkingLevel: "low",
        });
      } else {
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2500,
          response_format: { type: "json_object" },
        });
        rawContent = completion.choices[0]?.message?.content ?? null;
      }

      if (!rawContent) {
        throw new Error(`Empty response from ${provider}`);
      }

      const parsed = parseJsonResponse(rawContent);
      if (!validateSegment(parsed)) {
        throw new Error("Response does not match the segment schema");
      }
      // scene_intent is optional now (removed from the schema to keep the JSON
      // light) — keep it only when the model still supplies a valid one.
      if (parsed.scene_intent != null) {
        const rewrittenIntent = sceneIntentSchema.safeParse(parsed.scene_intent);
        parsed.scene_intent = rewrittenIntent.success ? rewrittenIntent.data : undefined;
      }

      // HARD CONSTRAINTS enforced in code (never trust the model for these):
      // identity/position fields stay exactly as the original segment's.
      parsed.segment_number = original.segment_number;
      parsed.duration_seconds = original.duration_seconds || 10;
      parsed.marketing_role = original.marketing_role;
      parsed.environment_ref = original.environment_ref;
      if (!parsed.title) parsed.title = original.title;
      if (!Array.isArray(parsed.beats) || parsed.beats.length === 0) {
        parsed.beats = original.beats;
      }
      parsed.beats.forEach((b) => {
        if (!b.camera) b.camera = "[EYE]";
      });
      if (!parsed.continuity_note) parsed.continuity_note = original.continuity_note;
      // The rewrite invalidates any previously rendered assets for this segment.
      parsed.first_frame_url = null;
      parsed.keyframe_url = null;
      parsed.full_prompt = undefined;

      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[AI Engine] Segment rewrite attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
        lastError.message
      );
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw new Error(
    `Segment rewrite failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}
