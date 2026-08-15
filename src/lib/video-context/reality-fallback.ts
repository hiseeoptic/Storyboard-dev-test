import type {
  StoryboardGenerationInput,
} from "../../types";
import type {
  RealityMode,
  RealityProfile,
} from "../reality/types";
import { isStylizedCharacterRepresentation } from "../creative-routing/profiles.ts";
import { resolveCreativeRoute } from "../creative-routing/compiler.ts";

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

const MISSING_AUTHORITY =
  /^(?:n\/?a|none|unknown|unspecified|tbd|todo|missing|not set|chưa rõ|không rõ)$/i;

function hasAuthority(value: unknown): boolean {
  const normalized = text(value);
  return !!normalized && !MISSING_AUTHORITY.test(normalized);
}

function normalizedEvidence(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

/**
 * Context analysis is intentionally allowed to admit that the source does not
 * specify a clock time. The locked Context IR, however, still needs one stable
 * lighting/continuity authority before storyboard compilation. Resolve that
 * authority from existing evidence, then use a documented neutral default as
 * the last resort. This is local and never triggers another model call.
 */
function temporalAuthority(
  input: StoryboardGenerationInput,
  layers: UnknownRecord
): string {
  const temporal = record(layers.temporal);
  const environment = record(layers.environment);
  const locations = Array.isArray(environment.locations)
    ? environment.locations.map(record)
    : [];
  const evidence = normalizedEvidence(
    [
      text(input.source_script),
      text(input.story_idea),
      text(input.setting),
      text(input.tone),
      text(temporal.story_time_span),
      text(temporal.season_weather),
      ...locations.map((location) => text(location.lighting_motivation)),
    ].join("\n")
  );

  const authorities: Array<[RegExp, string]> = [
    [/\b(midnight|night(?:time)?)\b|\b(nua dem|ban dem|buoi toi|troi toi|dem)\b/, "night"],
    [/\b(dawn|sunrise)\b|\b(binh minh|rang sang)\b/, "dawn"],
    [/\b(sunset|dusk|twilight)\b|\b(hoang hon|chang vang)\b/, "sunset"],
    [/\bafternoon\b|\b(buoi chieu|chieu nay|chieu muon|xe chieu)\b/, "afternoon"],
    [/\b(noon|midday)\b|\b(buoi trua|trua)\b/, "noon"],
    [/\bmorning\b|\b(buoi sang|sang som)\b/, "morning"],
    [/\b(daytime|daylight|sunlight|sunlit|sun)\b|\b(ban ngay|anh nang|mat troi)\b/, "daytime"],
  ];
  for (const [pattern, authority] of authorities) {
    if (pattern.test(evidence)) return authority;
  }
  return "continuity-neutral daytime (deterministic default; source does not specify clock time)";
}

function timePeriodAuthority(input: StoryboardGenerationInput): string {
  const evidence = normalizedEvidence(
    [input.source_script, input.story_idea, input.setting, input.custom_instructions]
      .map(text)
      .join("\n")
  );
  const periods: Array<[RegExp, string]> = [
    [/\b(future|futuristic)\b|\b(tuong lai)\b/, "future"],
    [/\b(ancient|antiquity)\b|\b(co dai)\b/, "ancient"],
    [/\b(medieval|middle ages)\b|\b(trung co)\b/, "medieval"],
    [/\b(?:18|19|20)\d{2}s?\b|\b(thap nien|the ky)\b/, "script-declared historical period"],
    [/\b(contemporary|modern|present day)\b|\b(duong dai|hien dai|ngay nay)\b/, "contemporary"],
  ];
  for (const [pattern, period] of periods) {
    if (pattern.test(evidence)) return period;
  }
  return "contemporary era-neutral setting (deterministic default; source does not specify an era)";
}

function completeRequiredAuthorities(
  input: StoryboardGenerationInput,
  layers: UnknownRecord
): { layers: UnknownRecord; assumptions: string[]; used_fallback: boolean } {
  const route = resolveCreativeRoute(input);
  const mode = realityModeFor(input);
  const projectIntent = { ...record(layers.project_intent) };
  const worldContext = { ...record(layers.world_context) };
  const temporal = { ...record(layers.temporal) };
  const environment = { ...record(layers.environment) };
  const motionContinuity = { ...record(layers.motion_continuity) };
  const visualLanguage = { ...record(layers.visual_language) };
  const audioValidation = { ...record(layers.audio_validation) };
  const locations = Array.isArray(environment.locations) ? environment.locations : [];
  const completed: string[] = [];
  const fill = (owner: UnknownRecord, key: string, value: string, label: string) => {
    if (hasAuthority(owner[key])) return;
    owner[key] = value;
    completed.push(label);
  };

  if (Object.keys(projectIntent).length > 0) {
    fill(projectIntent, "purpose", input.video_goal || `${input.genre} storytelling`, "project purpose");
    fill(projectIntent, "platform", "digital short-form video", "target platform");
    fill(projectIntent, "aspect_ratio", input.aspect_ratio || "9:16", "aspect ratio");
  }
  if (Object.keys(worldContext).length > 0) {
    fill(
      worldContext,
      "world_type",
      mode === "stylized" ? "script-derived stylized world" : "script-derived physical world",
      "world type"
    );
    fill(worldContext, "genre", input.genre, "world genre");
    fill(worldContext, "time_period", timePeriodAuthority(input), "time period");
    fill(
      worldContext,
      "physics_mode",
      mode === "stylized"
        ? "coherent stylized cause-and-effect physics"
        : "real-world cause-and-effect physics",
      "world physics"
    );
  }
  if (Object.keys(temporal).length > 0) {
    fill(temporal, "timeline_mode", "linear script order", "timeline mode");
    fill(temporal, "time_of_day", temporalAuthority(input, layers), "time of day");
  }
  if (Object.keys(environment).length > 0) {
    fill(
      environment,
      "strategy",
      locations.length > 1 ? "multi_location_script_led" : "single_location_script_led",
      "environment strategy"
    );
  }
  if (Object.keys(motionContinuity).length > 0) {
    fill(motionContinuity, "continuity_mode", "script-led scene continuity", "continuity mode");
  }
  if (Object.keys(visualLanguage).length > 0) {
    fill(
      visualLanguage,
      "style_mode",
      `${route.effective_character_representation} script-derived visual medium`,
      "visual style"
    );
  }
  if (Object.keys(audioValidation).length > 0) {
    fill(audioValidation, "language", input.dialogue_language || "Vietnamese", "audio language");
    fill(audioValidation, "voice_strategy", "stable per-speaker voice lock", "voice strategy");
    fill(audioValidation, "ambience_strategy", "per-location ambience lock", "ambience strategy");
  }

  return {
    layers: {
      ...layers,
      project_intent: projectIntent,
      world_context: worldContext,
      temporal,
      environment,
      motion_continuity: motionContinuity,
      visual_language: visualLanguage,
      audio_validation: audioValidation,
    },
    assumptions: completed,
    used_fallback: completed.length > 0,
  };
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
 * Structured model output can occasionally omit the top-level reality profile
 * or return a bare placeholder for an authority that is already derivable from
 * approved project input. Complete only those bounded fields locally, then let
 * the full Zod schema and Context validator fail closed on structural/world
 * omissions. This performs no remote retry and never invents a location or
 * storyboard.
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
  const layers = record(context.layers);
  const authorityCompletion = completeRequiredAuthorities(input, layers);
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
    authorityCompletion.used_fallback ||
    Object.keys(candidate).length === 0 ||
    !text(candidate.mode) ||
    !text(candidate.fidelity) ||
    Object.keys(dimensions).length < 6 ||
    !text(candidate.target_authenticity) ||
    !text(candidate.physics_model) ||
    Object.keys(salience).length < 5;

  return {
    payload: {
      ...context,
      ...(authorityCompletion.used_fallback
        ? {
            assumptions: [
              ...textArray(context.assumptions, []),
              `Required Context authorities completed locally from approved input: ${authorityCompletion.assumptions.join(", ")}.`,
            ],
            layers: authorityCompletion.layers,
          }
        : {}),
      reality_profile: completed,
    },
    used_fallback: usedFallback,
  };
}
