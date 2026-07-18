import type {
  AudienceGoal,
  CharacterRepresentation,
  DirectingProfileId,
  Genre,
  StoryboardGenerationInput,
  StoryFormat,
  VisualInterpretation,
} from "@/types";
import {
  CHARACTER_LAWS,
  DIRECTING_LAWS,
  FORMAT_LAWS,
  GOAL_LAWS,
  INTERPRETATION_LAWS,
  REAL_WORLD_MATERIAL_LAWS,
  TOPIC_LAWS,
} from "./profiles";

export interface CreativeRoute {
  topic: Genre;
  audience_goal: AudienceGoal;
  story_format: StoryFormat;
  visual_interpretation: VisualInterpretation;
  requested_character_representation: CharacterRepresentation;
  effective_character_representation: CharacterRepresentation;
  directing_profile: DirectingProfileId;
  character_reference_lock: "strict_photoreal" | "none";
  specialist_dna: string[];
  resolution_notes: string[];
}

const AD_GENRES = new Set<Genre>(["advertising", "product_demo", "brand_film", "promo", "unboxing", "luxury"]);
const REAL_WORLD_PROFILES = new Set<DirectingProfileId>([
  "everyday_naturalism",
  "observational_documentary",
  "natural_history",
  "poetic_nature",
  "creator_ugc",
  "cinematic_drama",
  "premium_commercial",
]);

function inferAudienceGoal(input: StoryboardGenerationInput): AudienceGoal {
  if (input.audience_goal) return input.audience_goal;
  if (["product_ad", "promo_sale", "marketing_general"].includes(input.video_goal ?? "")) return "action";
  if (["review", "testimonial", "brand_story"].includes(input.video_goal ?? "")) return "trust";
  if (["educational", "cooking", "fitness"].includes(input.video_goal ?? "")) return "explain";
  if (["psychology", "health", "numerology"].includes(input.video_goal ?? "")) return "reflection";
  if (input.genre === "life_wisdom" || input.genre === "psychology") return "reflection";
  if (input.genre === "nature") return "retention";
  if (["education", "finance", "tech", "health"].includes(input.genre)) return "explain";
  if (AD_GENRES.has(input.genre)) return "action";
  if (["comedy", "action", "horror", "thriller", "music_video"].includes(input.genre)) return "retention";
  return "empathy";
}

function inferStoryFormat(input: StoryboardGenerationInput, goal: AudienceGoal): StoryFormat {
  if (input.story_format && input.story_format !== "auto") return input.story_format;
  if (input.genre === "life_wisdom") return "parable";
  if (["education", "finance", "tech", "health", "numerology", "psychology"].includes(input.genre) || goal === "explain") return "explainer";
  if (["documentary", "mockumentary", "travel", "nature"].includes(input.genre)) return "observational";
  if (input.genre === "music_video") return "visual_poem";
  if (input.video_goal === "social_short") return "short_insight";
  return "micro_story";
}

function inferInterpretation(input: StoryboardGenerationInput, format: StoryFormat): VisualInterpretation {
  if (input.visual_interpretation && input.visual_interpretation !== "auto") return input.visual_interpretation;
  if (format === "parable" || input.genre === "life_wisdom") return "parable_fable";
  if (input.genre === "psychology") return "symbolic_metaphor";
  return "literal";
}

function inferCharacterRepresentation(input: StoryboardGenerationInput): CharacterRepresentation {
  if ((input.character_images?.length ?? 0) > 0) return "uploaded_photoreal";
  if (input.character_representation && input.character_representation !== "auto") return input.character_representation;
  if (input.character_render === "photo") return "generated_human";
  if (input.character_render === "stylized") return "illustrated_2d";
  if (input.genre === "nature") return "none";
  if (["documentary", "mockumentary", "advertising", "product_demo", "brand_film", "promo", "unboxing", "luxury", "lifestyle", "cooking", "fitness", "travel"].includes(input.genre)) return "generated_human";
  if (input.genre === "life_wisdom" || input.genre === "psychology") return "illustrated_2d";
  return "generated_human";
}

function inferDirectingProfile(
  input: StoryboardGenerationInput,
  interpretation: VisualInterpretation,
  character: CharacterRepresentation,
): DirectingProfileId {
  if (input.directing_profile && input.directing_profile !== "auto") return input.directing_profile;
  if (interpretation === "nature_analogy" || input.genre === "travel" || input.genre === "nature") return "natural_history";
  if (input.genre === "documentary" || input.genre === "mockumentary") return "observational_documentary";
  if (input.genre === "psychology") return "psychological_metaphor";
  if (interpretation === "parable_fable" || character === "anthropomorphic_animal" || character === "anthropomorphic_object") return "anthropomorphic_fable";
  if (input.style === "ugc") return "creator_ugc";
  if (AD_GENRES.has(input.genre) || ["commercial", "product_showcase", "corporate_clean"].includes(input.style)) return "premium_commercial";
  if (["education", "finance", "tech", "health", "numerology"].includes(input.genre)) return "explainer_clarity";
  if (["lifestyle", "cooking", "fitness"].includes(input.genre) || input.style === "realistic") return "everyday_naturalism";
  return "cinematic_drama";
}

function specialistDnaFor(input: StoryboardGenerationInput, profile: DirectingProfileId): string[] {
  const dna: string[] = [];
  if (input.genre === "cooking") dna.push("cooking");
  if (input.genre === "psychology") dna.push("psychology_safety", "metaphor_bible");
  if (input.genre === "life_wisdom") dna.push("life_wisdom", "parable_logic");
  if (input.genre === "numerology") dna.push("numerology");
  if (input.genre === "health") dna.push("health_safety");
  if (profile === "natural_history" || profile === "poetic_nature") dna.push("nature_dna");
  if (profile === "everyday_naturalism" || profile === "observational_documentary") dna.push("everyday_reality");
  if (profile === "premium_commercial") dna.push("product_material_dna");
  return [...new Set(dna)];
}

export function resolveCreativeRoute(input: StoryboardGenerationInput): CreativeRoute {
  const audienceGoal = inferAudienceGoal(input);
  const storyFormat = inferStoryFormat(input, audienceGoal);
  let interpretation = inferInterpretation(input, storyFormat);
  const requestedCharacter = input.character_representation ?? "auto";
  const hasCharacterReferences = (input.character_images?.length ?? 0) > 0;
  const effectiveCharacter = hasCharacterReferences ? "uploaded_photoreal" : inferCharacterRepresentation(input);
  const notes: string[] = [];

  if (hasCharacterReferences && requestedCharacter !== "auto" && requestedCharacter !== "uploaded_photoreal") {
    notes.push("Character upload overrides the requested stylized medium and forces strict photoreal identity lock.");
  }
  if (hasCharacterReferences && interpretation === "parable_fable") {
    interpretation = "symbolic_metaphor";
    notes.push("A live-action symbolic metaphor replaces personified-fable treatment because real character references are present.");
  }
  let directingProfile = inferDirectingProfile(input, interpretation, effectiveCharacter);
  if (hasCharacterReferences && ["anthropomorphic_fable", "psychological_metaphor"].includes(directingProfile)) {
    directingProfile = input.genre === "psychology" ? "cinematic_drama" : "everyday_naturalism";
    notes.push("A live-action directing profile replaces an incompatible stylized profile because real character references are present.");
  }

  return {
    topic: input.genre,
    audience_goal: audienceGoal,
    story_format: storyFormat,
    visual_interpretation: interpretation,
    requested_character_representation: requestedCharacter,
    effective_character_representation: effectiveCharacter,
    directing_profile: directingProfile,
    character_reference_lock: hasCharacterReferences ? "strict_photoreal" : "none",
    specialist_dna: specialistDnaFor(input, directingProfile),
    resolution_notes: notes,
  };
}

function bulletLines(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

export function renderCreativeRouteDirective(inputOrRoute: StoryboardGenerationInput | CreativeRoute): string {
  const route = "story_idea" in inputOrRoute ? resolveCreativeRoute(inputOrRoute) : inputOrRoute;
  const topicLaws = TOPIC_LAWS[route.topic] ?? [];
  const directingLaws = route.directing_profile === "auto" ? [] : DIRECTING_LAWS[route.directing_profile];
  const materialLaws = REAL_WORLD_PROFILES.has(route.directing_profile) ? REAL_WORLD_MATERIAL_LAWS : [];
  const allLaws = [
    ...GOAL_LAWS[route.audience_goal],
    ...FORMAT_LAWS[route.story_format],
    ...INTERPRETATION_LAWS[route.visual_interpretation],
    ...CHARACTER_LAWS[route.effective_character_representation],
    ...directingLaws,
    ...materialLaws,
    ...topicLaws,
  ];

  return `CREATIVE ROUTE — ORDERED, AUTHORITATIVE, TOPIC-ISOLATED
1. Topic: ${route.topic}
2. Audience outcome: ${route.audience_goal}
3. Story format: ${route.story_format}
4. Visual interpretation: ${route.visual_interpretation}
5. Character medium: ${route.effective_character_representation}
6. Directing profile: ${route.directing_profile}
7. Active specialist DNA only: ${route.specialist_dna.join(", ") || "none"}
Reference policy: ${route.character_reference_lock}

ROUTING LAWS
- The order above is binding. Topic decides specialist knowledge; audience goal decides the intended change; format decides structure; interpretation decides literal/metaphorical treatment; character medium decides representation; directing profile decides camera/light/sound grammar.
- Never import props, ambience, actions, terminology or visual clichés from an inactive topic/profile. Existing legacy style/video_goal fields are secondary compatibility hints and cannot override this route.
${bulletLines(allLaws)}${route.resolution_notes.length ? `\nRESOLUTION NOTES\n${bulletLines(route.resolution_notes)}` : ""}`;
}

export function renderCreativeVisualDirective(inputOrRoute: StoryboardGenerationInput | CreativeRoute): string {
  const route = "story_idea" in inputOrRoute ? resolveCreativeRoute(inputOrRoute) : inputOrRoute;
  const directing = route.directing_profile === "auto" ? [] : DIRECTING_LAWS[route.directing_profile];
  const materials = REAL_WORLD_PROFILES.has(route.directing_profile)
    ? route.directing_profile === "natural_history" || route.directing_profile === "poetic_nature"
      ? [REAL_WORLD_MATERIAL_LAWS[0]!, REAL_WORLD_MATERIAL_LAWS[3]!]
      : route.directing_profile === "premium_commercial"
        ? [REAL_WORLD_MATERIAL_LAWS[0]!, REAL_WORLD_MATERIAL_LAWS[1]!, REAL_WORLD_MATERIAL_LAWS[3]!]
        : [REAL_WORLD_MATERIAL_LAWS[0]!, REAL_WORLD_MATERIAL_LAWS[2]!, REAL_WORLD_MATERIAL_LAWS[3]!]
    : [];
  return `VISUAL ROUTE LOCK: topic=${route.topic}; character=${route.effective_character_representation}; directing=${route.directing_profile}; interpretation=${route.visual_interpretation}; reference=${route.character_reference_lock}.
${bulletLines([
    ...CHARACTER_LAWS[route.effective_character_representation],
    ...INTERPRETATION_LAWS[route.visual_interpretation],
    ...directing,
    ...materials,
  ])}`;
}
