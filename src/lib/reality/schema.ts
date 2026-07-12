import { z } from "zod";

const text = z.string().trim().min(1);
const textArray = z.array(text).default([]);

export const realityProfileSchema = z.object({
  mode: z.enum([
    "documentary",
    "cinematic",
    "commercial",
    "stylized",
    "symbolic_surreal",
    "fantasy_scifi_internal",
  ]),
  fidelity: z.enum([
    "A_basic_visual",
    "B_physical",
    "C_material",
    "D_micro_behavior",
    "E_cinematic_simulation",
  ]),
  dimensions: z.object({
    macro: z.boolean(),
    meso: z.boolean(),
    micro: z.boolean(),
    material_reaction: z.boolean(),
    temporal_continuity: z.boolean(),
    causal_integrity: z.boolean(),
  }),
  target_authenticity: text,
  physics_model: text,
  allowed_deviations: textArray,
  salience_policy: z.object({
    hero_entities: textArray,
    interaction_entities: textArray,
    foreground_fidelity: z.enum(["macro_only", "meso", "material", "micro"]),
    background_fidelity: z.enum(["macro_only", "meso", "material", "micro"]),
    max_high_fidelity_entities_per_clip: z.number().int().min(1).max(6),
  }),
});

export const REALITY_PROFILE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    mode: { type: "STRING" },
    fidelity: { type: "STRING" },
    dimensions: {
      type: "OBJECT",
      properties: {
        macro: { type: "BOOLEAN" },
        meso: { type: "BOOLEAN" },
        micro: { type: "BOOLEAN" },
        material_reaction: { type: "BOOLEAN" },
        temporal_continuity: { type: "BOOLEAN" },
        causal_integrity: { type: "BOOLEAN" },
      },
      required: [
        "macro", "meso", "micro", "material_reaction", "temporal_continuity", "causal_integrity",
      ],
    },
    target_authenticity: { type: "STRING" },
    physics_model: { type: "STRING" },
    allowed_deviations: { type: "ARRAY", items: { type: "STRING" } },
    salience_policy: {
      type: "OBJECT",
      properties: {
        hero_entities: { type: "ARRAY", items: { type: "STRING" } },
        interaction_entities: { type: "ARRAY", items: { type: "STRING" } },
        foreground_fidelity: { type: "STRING" },
        background_fidelity: { type: "STRING" },
        max_high_fidelity_entities_per_clip: { type: "INTEGER" },
      },
      required: [
        "hero_entities", "interaction_entities", "foreground_fidelity", "background_fidelity",
        "max_high_fidelity_entities_per_clip",
      ],
    },
  },
  required: [
    "mode", "fidelity", "dimensions", "target_authenticity", "physics_model",
    "allowed_deviations", "salience_policy",
  ],
};

