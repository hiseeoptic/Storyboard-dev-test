import { getOpenAIClient } from "@/lib/openai/client";
import { geminiGenerateText } from "@/lib/gemini/client";
import { claudeGenerateText } from "@/lib/anthropic/client";
import {
  buildScriptWriterSystemPrompt,
  buildScriptWriterUserPrompt,
  buildStoryboardSystemPrompt,
  buildStoryboardUserPrompt,
  buildSegmentRewriteUserPrompt,
} from "@/prompts";
import type {
  AIProvider,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  VideoSegment,
} from "@/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const STRING_SCHEMA = { type: "STRING" };
const INTEGER_SCHEMA = { type: "INTEGER" };
const NUMBER_SCHEMA = { type: "NUMBER" };
const BOOLEAN_SCHEMA = { type: "BOOLEAN" };
const STRING_ARRAY_SCHEMA = { type: "ARRAY", items: STRING_SCHEMA };

// One storyboard segment — shared by the full-storyboard schema and the
// single-segment rewrite endpoint so the two can never drift apart.
const SEGMENT_ITEM_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    segment_number: INTEGER_SCHEMA,
    duration_seconds: INTEGER_SCHEMA,
    title: STRING_SCHEMA,
    marketing_role: STRING_SCHEMA,
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
    continuity_note: STRING_SCHEMA,
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
          skin_texture: STRING_SCHEMA,
          eye_details: STRING_SCHEMA,
          hair: STRING_SCHEMA,
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
          "hair",
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
  required: ["title", "synopsis", "world_context", "character_locks", "segments", "style_guide"],
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
    throw err;
  }
}

/**
 * Stage 1 — write ONLY the creative script (plain text) with the chosen model
 * (e.g. Claude Opus). A separate model then expands this into the storyboard
 * JSON (Stage 2). Returns the raw script text, or throws on failure.
 */
export async function generateScript(
  input: StoryboardGenerationInput,
  provider: AIProvider = "claude"
): Promise<string> {
  const systemPrompt = buildScriptWriterSystemPrompt();
  const userPrompt = buildScriptWriterUserPrompt(input);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let text: string | null = null;

      if (provider === "claude") {
        text = await claudeGenerateText({
          systemPrompt,
          userPrompt,
          maxTokens: 8000,
        });
      } else if (provider === "gemini") {
        text = await geminiGenerateText({
          systemPrompt,
          userPrompt,
          temperature: 0.85,
          maxOutputTokens: 4096,
        });
      } else {
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.85,
          max_tokens: 4000,
        });
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
        `[AI Engine] Script attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
        lastError.message
      );
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw new Error(
    `Script generation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

export async function generateStoryboardBreakdown(
  input: StoryboardGenerationInput,
  provider: AIProvider = "openai"
): Promise<StoryboardGenerationOutput> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let rawContent: string | null = null;

      if (provider === "claude") {
        // Claude Opus 4.8 writes the best scripts. It returns text; the JSON is
        // extracted by sanitizeJsonResponse below (no responseMimeType on Claude).
        rawContent = await claudeGenerateText({
          systemPrompt: buildStoryboardSystemPrompt(),
          userPrompt:
            buildStoryboardUserPrompt(input) +
            "\n\nReturn ONLY the JSON object described above — no markdown, no code fences, no prose before or after.",
          maxTokens: 16000,
        });
      } else if (provider === "gemini") {
        rawContent = await geminiGenerateText({
          systemPrompt: buildStoryboardSystemPrompt(),
          userPrompt: buildStoryboardUserPrompt(input),
          jsonMode: true,
          responseSchema: STORYBOARD_RESPONSE_SCHEMA,
          temperature: 0.35,
          // The storyboard JSON grew (dialogue_lines, cast/environment locks,
          // voice, forensic fields) — 8192 could truncate mid-array, which
          // surfaces as "Expected ',' or ']'" parse errors.
          maxOutputTokens: 24576,
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

      const parsed = parseJsonResponse(rawContent);

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
        // Speaker (one per clip). Default to the main character when the model
        // omits it but there is a spoken line, so multi-character prompts still
        // name a speaker.
        if (seg.speaker === undefined || seg.speaker === null) {
          seg.speaker = parsed.character_locks?.[0]?.name ?? "";
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
  const systemPrompt = buildStoryboardSystemPrompt();
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
          maxOutputTokens: 4096,
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
