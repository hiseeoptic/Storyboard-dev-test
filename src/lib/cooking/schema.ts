import { z } from "zod";

const compactString = z.string().trim().default("");

export const cookingIngredientSchema = z.object({
  id: compactString,
  name: compactString,
  amount: compactString,
  unit: compactString,
  preparation: compactString,
  group: compactString,
  source_text: compactString,
});

export const cookingMiseEnPlaceSchema = z.object({
  order: z.coerce.number().int().positive(),
  vessel: compactString,
  ingredient_ids: z.array(compactString).default([]),
  staging_note: compactString,
});

export const cookingStepSchema = z.object({
  order: z.coerce.number().int().positive(),
  title: compactString,
  action: compactString,
  ingredient_ids: z.array(compactString).default([]),
  tools: z.array(compactString).default([]),
  heat: compactString,
  duration: compactString,
  visible_end_state: compactString,
  asmr_cues: z.array(compactString).default([]),
});

export const cookingRecipeSchema = z.object({
  version: z.literal("1.0").default("1.0"),
  dish_name: compactString,
  servings: compactString,
  source_language: compactString,
  ingredients: z.array(cookingIngredientSchema).min(1),
  equipment: z.array(compactString).default([]),
  mise_en_place: z.array(cookingMiseEnPlaceSchema).default([]),
  steps: z.array(cookingStepSchema).min(1),
  plating: compactString,
  serving_temperature: compactString,
  hero_visual: compactString,
  uncertainties: z.array(compactString).default([]),
  confidence: z.coerce.number().min(0).max(1),
});

const STRING = { type: "STRING" } as const;
const STRING_ARRAY = { type: "ARRAY", items: STRING } as const;

/** Gemini structured-output schema. Keep it deliberately compact and flat. */
export const COOKING_RECIPE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    version: STRING,
    dish_name: STRING,
    servings: STRING,
    source_language: STRING,
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: STRING,
          name: STRING,
          amount: STRING,
          unit: STRING,
          preparation: STRING,
          group: STRING,
          source_text: STRING,
        },
        required: ["id", "name", "amount", "unit", "preparation", "group", "source_text"],
      },
    },
    equipment: STRING_ARRAY,
    mise_en_place: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          order: { type: "INTEGER" },
          vessel: STRING,
          ingredient_ids: STRING_ARRAY,
          staging_note: STRING,
        },
        required: ["order", "vessel", "ingredient_ids", "staging_note"],
      },
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          order: { type: "INTEGER" },
          title: STRING,
          action: STRING,
          ingredient_ids: STRING_ARRAY,
          tools: STRING_ARRAY,
          heat: STRING,
          duration: STRING,
          visible_end_state: STRING,
          asmr_cues: STRING_ARRAY,
        },
        required: [
          "order",
          "title",
          "action",
          "ingredient_ids",
          "tools",
          "heat",
          "duration",
          "visible_end_state",
          "asmr_cues",
        ],
      },
    },
    plating: STRING,
    serving_temperature: STRING,
    hero_visual: STRING,
    uncertainties: STRING_ARRAY,
    confidence: { type: "NUMBER" },
  },
  required: [
    "version",
    "dish_name",
    "servings",
    "source_language",
    "ingredients",
    "equipment",
    "mise_en_place",
    "steps",
    "plating",
    "serving_temperature",
    "hero_visual",
    "uncertainties",
    "confidence",
  ],
};
