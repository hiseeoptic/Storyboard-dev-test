import type { WorldContext } from "@/types";
import type { ResolvedVideoContext } from "./types";

/** Compatibility adapter for the existing prompt/export pipeline. */
export function contextIrToWorldContext(context: ResolvedVideoContext): WorldContext {
  const world = context.layers.world_context;
  const environment = context.layers.environment;
  const visual = context.layers.visual_language;
  const audio = context.layers.audio_validation;
  const ontology = context.layers.ontology;

  return {
    world_type: world.world_type,
    reality_level: world.reality_level,
    genre: world.genre,
    geography: world.geography,
    culture: world.culture,
    time_period: world.time_period,
    technology_level: world.technology_level,
    social_class: world.social_class,
    environment_category: environment.primary_category,
    visual_style: visual.style_mode,
    audio_style: [audio.dialogue_mode, audio.ambience_strategy, audio.music_strategy]
      .filter(Boolean)
      .join("; "),
    allowed_language_text: ontology.visible_text_policy,
    forbidden_entities: ontology.forbidden_entities,
    intentional_exceptions: world.intentional_exceptions,
  };
}

