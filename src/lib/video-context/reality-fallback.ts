import type {
  StoryboardGenerationInput,
} from "../../types";
import type {
  RealityMode,
  RealityProfile,
} from "../reality/types";
import { isStylizedCharacterRepresentation } from "../creative-routing/profiles.ts";

type UnknownRecord = Record<string, unknown>;

export interface CompletedContextReality {
  payload: unknown;
  used_fallback: boolean;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map(text).filter(Boolean);
}

function realityModeFor(input: StoryboardGenerationInput): RealityMode {
  const hasPhotorealReference = (input.character_images?.length ?? 0) > 0;
  const fantasyGenre = new Set(["fantasy", "sci-fi", "mythology"]);
  const documentaryGenre = new Set(["documentary", "mockumentary"]);
  const commercialGenre = new Set([
    "advertising",
    "product_demo",
    "brand_film",
    "promo",
    "unboxing",
    "luxury",
  ]);
  const stylizedStyle = new Set([
    "anime",
    "comic",
    "watercolor",
    "pencil_sketch",
    "3d_render",
    "pixel_art",
  ]);
  const requestedCharacter = input.character_representation;
  const explicitlyPhotoreal =
    requestedCharacter === "uploaded_photoreal" ||
    requestedCharacter === "generated_human" ||
    input.character_render === "photo";
  const explicitlyStylized =
    (requestedCharacter != null &&
      requestedCharacter !== "auto" &&
      isStylizedCharacterRepresentation(requestedCharacter)) ||
    input.character_render === "stylized";

  if (fantasyGenre.has(input.genre)) return "fantasy_scifi_internal";
  if (documentaryGenre.has(input.genre)) return "documentary";
  if (
    commercialGenre.has(input.genre) ||
    ["commercial", "product_showcase", "corporate_clean"].includes(input.style)
  ) {
    return "commercial";
  }
  if (hasPhotorealReference) return "cinematic";
  if (
    input.genre === "animation" ||
    stylizedStyle.has(input.style) ||
    explicitlyStylized ||
    (!explicitlyPhotoreal &&
      ["psychology", "life_wisdom"].includes(input.genre))
  ) {
    return "stylized";
  }
  if (input.visual_interpretation === "symbolic_metaphor") {
    return "symbolic_surreal";
  }
  return "cinematic";
}

function realityDefaults(
  input: StoryboardGenerationInput,
  rawContext: UnknownRecord
): RealityProfile {
  const mode = realityModeFor(input);
  const layers = record(rawContext.layers);
  const character = record(layers.character);
  const objectProp = record(layers.object_prop);
  const contextCast = textArray(character.cast_ids, []);
  const inputCast = [
    ...(input.character_descriptions ?? []).map((entry) => entry.name),
    ...(input.character_images ?? []).map((entry) => entry.name),
  ]
    .map(text)
    .filter(Boolean);
  const heroEntities = [
    ...textArray(objectProp.hero_prop_ids, []),
    ...(input.product_name ? [input.product_name] : []),
  ];
  const unique = (values: string[]) => [...new Set(values)].slice(0, 6);
  const castIds = unique([...contextCast, ...inputCast]);
  const heroes = unique(heroEntities);
  const maxEntities = Math.min(
    6,
    Math.max(3, new Set([...heroes, ...castIds]).size || 3)
  );
  const realWorld = ["documentary", "cinematic", "commercial"].includes(mode);

  return {
    mode,
    fidelity: "E_cinematic_simulation",
    dimensions: {
      macro: true,
      meso: true,
      micro: true,
      material_reaction: true,
      temporal_continuity: true,
      causal_integrity: true,
    },
    target_authenticity: realWorld
      ? "Physically filmed real-world detail in the project-defined visual language."
      : `Deeply simulated ${mode} detail without changing the declared medium.`,
    physics_model: realWorld
      ? "Real-world anatomy, gravity, contact, material response and cause-before-effect."
      : `Consistent project-defined ${mode} internal physics with cause-before-effect.`,
    allowed_deviations: [],
    salience_policy: {
      hero_entities: heroes,
      interaction_entities: castIds,
      foreground_fidelity: "micro",
      background_fidelity: "meso",
      max_high_fidelity_entities_per_clip: maxEntities,
    },
  };
}

/**
 * Gemini structured output can occasionally omit the entire top-level
 * `reality_profile` even though it is marked required. Complete that bounded
 * cross-cutting profile deterministically from the already-approved creative
 * route, then let the full Zod schema and Context validator fail closed on
 * every other field. This performs no remote retry and never invents a world,
 * location or storyboard.
 */
export function completeContextRealityProfile(
  raw: unknown,
  input: StoryboardGenerationInput
): CompletedContextReality {
  const context = record(raw);
  if (Object.keys(context).length === 0) {
    return { payload: raw, used_fallback: false };
  }

  const fallback = realityDefaults(input, context);
  const candidate = record(context.reality_profile);
  const dimensions = record(candidate.dimensions);
  const salience = record(candidate.salience_policy);
  const completed: RealityProfile = {
    mode: (text(candidate.mode) || fallback.mode) as RealityProfile["mode"],
    fidelity: (text(candidate.fidelity) ||
      fallback.fidelity) as RealityProfile["fidelity"],
    dimensions: {
      macro:
        typeof dimensions.macro === "boolean"
          ? dimensions.macro
          : fallback.dimensions.macro,
      meso:
        typeof dimensions.meso === "boolean"
          ? dimensions.meso
          : fallback.dimensions.meso,
      micro:
        typeof dimensions.micro === "boolean"
          ? dimensions.micro
          : fallback.dimensions.micro,
      material_reaction:
        typeof dimensions.material_reaction === "boolean"
          ? dimensions.material_reaction
          : fallback.dimensions.material_reaction,
      temporal_continuity:
        typeof dimensions.temporal_continuity === "boolean"
          ? dimensions.temporal_continuity
          : fallback.dimensions.temporal_continuity,
      causal_integrity:
        typeof dimensions.causal_integrity === "boolean"
          ? dimensions.causal_integrity
          : fallback.dimensions.causal_integrity,
    },
    target_authenticity:
      text(candidate.target_authenticity) || fallback.target_authenticity,
    physics_model: text(candidate.physics_model) || fallback.physics_model,
    allowed_deviations: textArray(
      candidate.allowed_deviations,
      fallback.allowed_deviations
    ),
    salience_policy: {
      hero_entities: textArray(
        salience.hero_entities,
        fallback.salience_policy.hero_entities
      ),
      interaction_entities: textArray(
        salience.interaction_entities,
        fallback.salience_policy.interaction_entities
      ),
      foreground_fidelity: (text(salience.foreground_fidelity) ||
        fallback.salience_policy
          .foreground_fidelity) as RealityProfile["salience_policy"]["foreground_fidelity"],
      background_fidelity: (text(salience.background_fidelity) ||
        fallback.salience_policy
          .background_fidelity) as RealityProfile["salience_policy"]["background_fidelity"],
      max_high_fidelity_entities_per_clip:
        typeof salience.max_high_fidelity_entities_per_clip === "number"
          ? salience.max_high_fidelity_entities_per_clip
          : fallback.salience_policy.max_high_fidelity_entities_per_clip,
    },
  };

  const usedFallback =
    Object.keys(candidate).length === 0 ||
    !text(candidate.mode) ||
    !text(candidate.fidelity) ||
    Object.keys(dimensions).length < 6 ||
    !text(candidate.target_authenticity) ||
    !text(candidate.physics_model) ||
    Object.keys(salience).length < 5;

  return {
    payload: { ...context, reality_profile: completed },
    used_fallback: usedFallback,
  };
}
