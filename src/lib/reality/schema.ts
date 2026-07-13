import { z } from "zod";

const text = z.string().trim().min(1);
const textArray = z.array(text).default([]);

// RESILIENCE: the Gemini response schema sends these as free STRING, so the
// model regularly near-misses the exact token ("C material" for "C_material",
// which hard-failed the whole Context IR lock). Coerce instead of failing:
// normalise separators/case -> exact match -> letter-prefix match (fidelity
// uses A/B/C/D/E) -> keyword contains -> fallback. Values still validated by
// z.enum, so any accepted value is guaranteed canonical.
function coerceEnum<T extends readonly string[]>(
  values: T,
  fallback: T[number],
  opts?: { letterPrefix?: boolean }
) {
  const canon = new Map(values.map((v) => [v.toLowerCase().replace(/[\s-]+/g, "_"), v]));
  return (v: unknown): T[number] => {
    if (typeof v !== "string") return fallback;
    const norm = v.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/_+/g, "_");
    if (canon.has(norm)) return canon.get(norm)!;
    if (opts?.letterPrefix) {
      const letter = norm.match(/^([a-e])(?:_|$)/)?.[1];
      if (letter) {
        const hit = values.find((val) => val.toLowerCase().startsWith(`${letter}_`));
        if (hit) return hit;
      }
    }
    const hit = values.find(
      (val) =>
        norm.includes(val.toLowerCase().replace(/[\s-]+/g, "_")) ||
        val.toLowerCase().includes(norm)
    );
    return hit ?? fallback;
  };
}

const MODES = ["documentary", "cinematic", "commercial", "stylized", "symbolic_surreal", "fantasy_scifi_internal"] as const;
const FIDELITIES = ["A_basic_visual", "B_physical", "C_material", "D_micro_behavior", "E_cinematic_simulation"] as const;
const SUB_FIDELITIES = ["macro_only", "meso", "material", "micro"] as const;

const modeCoerce = coerceEnum(MODES, "cinematic");
const fidelityCoerce = coerceEnum(FIDELITIES, "C_material", { letterPrefix: true });
const fgCoerce = coerceEnum(SUB_FIDELITIES, "material");
const bgCoerce = coerceEnum(SUB_FIDELITIES, "meso");

export const realityProfileSchema = z.object({
  mode: z.preprocess(modeCoerce, z.enum(MODES)),
  fidelity: z.preprocess(fidelityCoerce, z.enum(FIDELITIES)),
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
    foreground_fidelity: z.preprocess(fgCoerce, z.enum(SUB_FIDELITIES)),
    background_fidelity: z.preprocess(bgCoerce, z.enum(SUB_FIDELITIES)),
    max_high_fidelity_entities_per_clip: z.preprocess((v) => {
      const n = typeof v === "string" ? Number.parseInt(v, 10) : v;
      if (typeof n !== "number" || Number.isNaN(n)) return 3;
      return Math.min(6, Math.max(1, Math.round(n)));
    }, z.number().int().min(1).max(6)),
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

