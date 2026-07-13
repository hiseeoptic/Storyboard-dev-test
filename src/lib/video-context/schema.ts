import { z } from "zod";
import { REALITY_PROFILE_RESPONSE_SCHEMA, realityProfileSchema } from "@/lib/reality";

const text = z.string().trim().min(1);
const textArray = z.array(text).default([]);

const locationSchema = z.object({
  id: text,
  narrative_function: text,
  description: text,
  culture_geography_fit: text,
  spatial_anchors: textArray,
  fixed_elements: textArray,
  lighting_motivation: text,
  sound_bed: text,
});

// RESILIENCE helpers (see reality/schema.ts) — near-miss values coerce
// instead of hard-failing the whole 10-layer Context IR lock.
const versionField = z.preprocess(() => "2.0", z.literal("2.0"));
const stateField = z.preprocess(
  (v) => (typeof v === "string" && v.trim().toLowerCase() === "locked" ? "locked" : "resolved"),
  z.enum(["resolved", "locked"])
);
const confidenceField = z.preprocess((v) => {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  if (typeof n !== "number" || Number.isNaN(n)) return 0.5;
  const scaled = n > 1 && n <= 100 ? n / 100 : n;
  return Math.min(1, Math.max(0, scaled));
}, z.number().min(0).max(1));
const positiveNumberField = (fallback: number) =>
  z.preprocess((v) => {
    const n = typeof v === "string" ? Number.parseFloat(v) : v;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;
  }, z.number().positive());

export const resolvedVideoContextSchema = z.object({
  version: versionField,
  state: stateField,
  analysis_summary: text,
  confidence: confidenceField,
  assumptions: textArray,
  evidence: textArray,
  reality_profile: realityProfileSchema,
  layers: z.object({
    project_intent: z.object({
      purpose: text,
      audience: text,
      platform: text,
      duration_seconds: positiveNumberField(50),
      aspect_ratio: text,
      success_criteria: textArray,
    }),
    world_context: z.object({
      world_type: text,
      reality_level: text,
      genre: text,
      geography: text,
      culture: text,
      time_period: text,
      technology_level: text,
      social_class: text,
      physics_mode: text,
      intentional_exceptions: textArray,
    }),
    ontology: z.object({
      allowed_entities: textArray,
      forbidden_entities: textArray,
      visible_text_policy: text,
      symbolism_policy: text,
      exception_rules: textArray,
    }),
    temporal: z.object({
      timeline_mode: text,
      story_time_span: text,
      time_of_day: text,
      season_weather: text,
      transition_rules: textArray,
    }),
    environment: z.object({
      strategy: text,
      primary_category: text,
      locations: z.array(locationSchema).min(1),
      selection_rule: text,
    }),
    character: z.object({
      cast_ids: textArray,
      identity_rules: textArray,
      behavior_rules: textArray,
      relationship_rules: textArray,
    }),
    object_prop: z.object({
      hero_prop_ids: textArray,
      state_tracking_rules: textArray,
      material_rules: textArray,
    }),
    motion_continuity: z.object({
      physics_mode: text,
      continuity_mode: text,
      action_budget: text,
      allowed_transition_modes: textArray,
      rules: textArray,
    }),
    visual_language: z.object({
      style_mode: text,
      camera_grammar: textArray,
      lighting_grammar: textArray,
      color_grammar: textArray,
      vfx_rules: textArray,
      text_overlay_policy: text,
    }),
    audio_validation: z.object({
      dialogue_mode: text,
      language: text,
      voice_strategy: text,
      ambience_strategy: text,
      music_strategy: text,
      validation_priorities: textArray,
    }),
  }),
});

/** Gemini response schema. Kept next to the runtime validator so both evolve together. */
export const VIDEO_CONTEXT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    version: { type: "STRING" },
    state: { type: "STRING" },
    analysis_summary: { type: "STRING" },
    confidence: { type: "NUMBER" },
    assumptions: { type: "ARRAY", items: { type: "STRING" } },
    evidence: { type: "ARRAY", items: { type: "STRING" } },
    reality_profile: REALITY_PROFILE_RESPONSE_SCHEMA,
    layers: {
      type: "OBJECT",
      properties: {
        project_intent: objectOf({
          purpose: stringField(), audience: stringField(), platform: stringField(),
          duration_seconds: { type: "NUMBER" }, aspect_ratio: stringField(), success_criteria: stringArray(),
        }),
        world_context: objectOf({
          world_type: stringField(), reality_level: stringField(), genre: stringField(), geography: stringField(),
          culture: stringField(), time_period: stringField(), technology_level: stringField(), social_class: stringField(),
          physics_mode: stringField(), intentional_exceptions: stringArray(),
        }),
        ontology: objectOf({
          allowed_entities: stringArray(), forbidden_entities: stringArray(), visible_text_policy: stringField(),
          symbolism_policy: stringField(), exception_rules: stringArray(),
        }),
        temporal: objectOf({
          timeline_mode: stringField(), story_time_span: stringField(), time_of_day: stringField(),
          season_weather: stringField(), transition_rules: stringArray(),
        }),
        environment: objectOf({
          strategy: stringField(), primary_category: stringField(),
          locations: {
            type: "ARRAY",
            items: objectOf({
              id: stringField(), narrative_function: stringField(), description: stringField(),
              culture_geography_fit: stringField(), spatial_anchors: stringArray(), fixed_elements: stringArray(),
              lighting_motivation: stringField(), sound_bed: stringField(),
            }),
          },
          selection_rule: stringField(),
        }),
        character: objectOf({
          cast_ids: stringArray(), identity_rules: stringArray(), behavior_rules: stringArray(), relationship_rules: stringArray(),
        }),
        object_prop: objectOf({
          hero_prop_ids: stringArray(), state_tracking_rules: stringArray(), material_rules: stringArray(),
        }),
        motion_continuity: objectOf({
          physics_mode: stringField(), continuity_mode: stringField(), action_budget: stringField(),
          allowed_transition_modes: stringArray(), rules: stringArray(),
        }),
        visual_language: objectOf({
          style_mode: stringField(), camera_grammar: stringArray(), lighting_grammar: stringArray(),
          color_grammar: stringArray(), vfx_rules: stringArray(), text_overlay_policy: stringField(),
        }),
        audio_validation: objectOf({
          dialogue_mode: stringField(), language: stringField(), voice_strategy: stringField(),
          ambience_strategy: stringField(), music_strategy: stringField(), validation_priorities: stringArray(),
        }),
      },
      required: [
        "project_intent", "world_context", "ontology", "temporal", "environment",
        "character", "object_prop", "motion_continuity", "visual_language", "audio_validation",
      ],
    },
  },
  required: [
    "version", "state", "analysis_summary", "confidence", "assumptions", "evidence",
    "reality_profile", "layers",
  ],
};

function stringField(): Record<string, string> {
  return { type: "STRING" };
}

function stringArray(): Record<string, unknown> {
  return { type: "ARRAY", items: stringField() };
}

function objectOf(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: "OBJECT", properties, required: Object.keys(properties) };
}
