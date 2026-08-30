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
  SCRIPT_DERIVED_STYLE_WORLD_LAW,
  isStylizedCharacterRepresentation,
  REAL_WORLD_MATERIAL_LAWS,
  TOPIC_LAWS,
} from "./profiles.ts";
import { genreProductionProfile } from "../genre-production-profiles.ts";

export interface CreativeRoute {
  topic: Genre;
  audience_goal: AudienceGoal;
  story_format: StoryFormat;
  visual_interpretation: VisualInterpretation;
  requested_character_representation: CharacterRepresentation;
  effective_character_representation: CharacterRepresentation;
  directing_profile: DirectingProfileId;
  directing_profiles?: DirectingProfileId[];
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
  "immersive_action",
  "reaction_comedy",
  "subjective_horror",
  "soft_romance",
  "interview_expert",
  "product_commercial",
  "luxury_commercial",
  "technical_demo",
  "broadcast_sports",
  "cinematic_sports",
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
  const scriptStyleSignal = [
    input.story_idea,
    input.source_script,
    input.main_character,
    input.key_message,
    input.setting,
  ].filter(Boolean).join(" ");
  const namedStyleSignals: Array<[RegExp, CharacterRepresentation]> = [
    [/\b(?:whiteboard[- ]?(?:line )?stick figure|stick figure)\b|người que/iu, "whiteboard_stick_figure"],
    [/\b(?:hand[- ]drawn doodle|doodle)\b|phác tay|vẽ tay/iu, "hand_drawn_doodle"],
    [/\bflat[- ]?2d(?: cartoon)?\b|hoạt hình 2d phẳng/iu, "flat_2d_cartoon"],
    [/\bchibi\b/iu, "chibi_illustration"],
    [/\b(?:cinematic cartoon|2\.5d cartoon)\b|hoạt hình điện ảnh/iu, "cinematic_cartoon"],
    [/\b(?:comic book|pop[- ]?art)\b|truyện tranh/iu, "comic_book"],
    [/\b(?:layered paper cut|paper[- ]cut)\b|cắt giấy/iu, "layered_paper_cut"],
    [/\b(?:claymation|clay stop[- ]motion)\b|đất nặn/iu, "claymation"],
    [/\blow[- ]?poly(?: 3d)?\b/iu, "low_poly_3d"],
    [/\bsemi[- ]realistic 3d\b|3d bán hiện thực/iu, "semi_realistic_3d"],
  ];
  for (const [pattern, representation] of namedStyleSignals) {
    if (pattern.test(scriptStyleSignal)) return representation;
  }
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
  if (["commercial", "product_showcase", "corporate_clean"].includes(input.style)) return "premium_commercial";
  return genreProductionProfile(input.genre).default_camera_profile;
}

function selectedDirectingProfiles(
  input: StoryboardGenerationInput,
  fallback: DirectingProfileId,
): DirectingProfileId[] {
  const requested = (input.directing_profiles ?? []).filter((id) => id !== "auto");
  if (requested.length > 0) return [...new Set(requested)];
  if (input.directing_profile && input.directing_profile !== "auto") return [input.directing_profile];
  return [fallback];
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
  const hasExplicitStylizedChoice = isStylizedCharacterRepresentation(requestedCharacter);
  const effectiveCharacter = hasExplicitStylizedChoice
    ? requestedCharacter
    : hasCharacterReferences
      ? "uploaded_photoreal"
      : inferCharacterRepresentation(input);
  const strictPhotorealReferences = hasCharacterReferences && !hasExplicitStylizedChoice;
  const notes: string[] = [];

  if (hasCharacterReferences && hasExplicitStylizedChoice) {
    notes.push("The explicit stylized medium remains authoritative; uploaded real-person references are incompatible and must be removed before generation.");
  }
  if (strictPhotorealReferences && interpretation === "parable_fable") {
    interpretation = "symbolic_metaphor";
    notes.push("A live-action symbolic metaphor replaces personified-fable treatment because real character references are present.");
  }
  const inferredProfile = inferDirectingProfile(input, interpretation, effectiveCharacter);
  let directingProfiles = selectedDirectingProfiles(input, inferredProfile);
  if (strictPhotorealReferences && directingProfiles.some((profile) => ["anthropomorphic_fable", "psychological_metaphor"].includes(profile))) {
    const replacement = input.genre === "psychology" ? "cinematic_drama" : "everyday_naturalism";
    directingProfiles = [...new Set(directingProfiles.map((profile) =>
      ["anthropomorphic_fable", "psychological_metaphor"].includes(profile) ? replacement : profile
    ))];
    notes.push("A live-action directing profile replaces an incompatible stylized profile because real character references are present.");
  }
  const directingProfile = directingProfiles[0] ?? inferredProfile;

  return {
    topic: input.genre,
    audience_goal: audienceGoal,
    story_format: storyFormat,
    visual_interpretation: interpretation,
    requested_character_representation: requestedCharacter,
    effective_character_representation: effectiveCharacter,
    directing_profile: directingProfile,
    directing_profiles: directingProfiles,
    character_reference_lock: strictPhotorealReferences ? "strict_photoreal" : "none",
    specialist_dna: [...new Set(directingProfiles.flatMap((profile) => specialistDnaFor(input, profile)))],
    resolution_notes: notes,
  };
}

function bulletLines(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

export function renderCreativeRouteDirective(inputOrRoute: StoryboardGenerationInput | CreativeRoute): string {
  const route = "story_idea" in inputOrRoute ? resolveCreativeRoute(inputOrRoute) : inputOrRoute;
  const topicLaws = TOPIC_LAWS[route.topic] ?? [];
  const profiles = route.directing_profiles?.length ? route.directing_profiles : [route.directing_profile];
  const directingLaws = profiles.flatMap((profile) => profile === "auto" ? [] : DIRECTING_LAWS[profile]);
  const materialLaws = profiles.some((profile) => REAL_WORLD_PROFILES.has(profile)) ? REAL_WORLD_MATERIAL_LAWS : [];
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
6. Directing profile palette: ${profiles.join(", ")}
7. Active specialist DNA only: ${route.specialist_dna.join(", ") || "none"}
Reference policy: ${route.character_reference_lock}

ROUTING LAWS
- The order above is binding. Topic decides specialist knowledge; audience goal decides the intended change; format decides structure; interpretation decides literal/metaphorical treatment; character medium decides representation; the directing-profile palette limits the camera/light/sound grammars available to Scene Intent.
- The directing-profile palette is not a checklist or rotation schedule. For each scene, choose the minimum compatible grammar justified by scale, geography, subjectivity, action and emotional consequence. Change profile only at a declared clip boundary; never combine incompatible physical rigs inside one continuous take.
- Never import props, ambience, actions, terminology or visual clichés from an inactive topic/profile. Existing legacy style/video_goal fields are secondary compatibility hints and cannot override this route.
${bulletLines(allLaws)}${route.resolution_notes.length ? `\nRESOLUTION NOTES\n${bulletLines(route.resolution_notes)}` : ""}`;
}

/** Script authorship deliberately stops before camera/directing selection.
 * Camera is a Stage-2 production concern and must never change dialogue density,
 * wording, turn ownership or the dramatic exchange selected by Stage 1. */
export function renderCreativeScriptRouteDirective(
  inputOrRoute: StoryboardGenerationInput | CreativeRoute
): string {
  const route = "story_idea" in inputOrRoute ? resolveCreativeRoute(inputOrRoute) : inputOrRoute;
  const laws = [
    ...GOAL_LAWS[route.audience_goal],
    ...FORMAT_LAWS[route.story_format],
    ...INTERPRETATION_LAWS[route.visual_interpretation],
    ...(TOPIC_LAWS[route.topic] ?? []),
  ];
  return `CREATIVE SCRIPT ROUTE — CAMERA-ISOLATED
1. Topic: ${route.topic}
2. Audience outcome: ${route.audience_goal}
3. Story format: ${route.story_format}
4. Interpretation: ${route.visual_interpretation}
5. Character medium: ${route.effective_character_representation}

SCRIPT ROUTING LAWS
- These authorities govern premise, structure, causal meaning and character performance only.
- Camera/directing profiles are intentionally absent at this stage. They must not change dialogue wording, number of turns, speaker ownership, subtext, reply structure or ending. Stage 2 will translate the approved script into camera coverage.
${bulletLines(laws)}`;
}

export function renderCreativeVisualDirective(inputOrRoute: StoryboardGenerationInput | CreativeRoute): string {
  const route = "story_idea" in inputOrRoute ? resolveCreativeRoute(inputOrRoute) : inputOrRoute;
  const profiles = route.directing_profiles?.length ? route.directing_profiles : [route.directing_profile];
  const directing = profiles.flatMap((profile) => profile === "auto" ? [] : DIRECTING_LAWS[profile]);
  const materialProfile = profiles.find((profile) => REAL_WORLD_PROFILES.has(profile));
  const materials = materialProfile
    ? materialProfile === "natural_history" || materialProfile === "poetic_nature"
      ? [REAL_WORLD_MATERIAL_LAWS[0]!, REAL_WORLD_MATERIAL_LAWS[3]!]
      : materialProfile === "premium_commercial"
        ? [REAL_WORLD_MATERIAL_LAWS[0]!, REAL_WORLD_MATERIAL_LAWS[1]!, REAL_WORLD_MATERIAL_LAWS[3]!]
        : [REAL_WORLD_MATERIAL_LAWS[0]!, REAL_WORLD_MATERIAL_LAWS[2]!, REAL_WORLD_MATERIAL_LAWS[3]!]
    : [];
  return `VISUAL ROUTE LOCK: topic=${route.topic}; character=${route.effective_character_representation}; directing_palette=${profiles.join(",")}; interpretation=${route.visual_interpretation}; reference=${route.character_reference_lock}.
${bulletLines([
    ...(isStylizedCharacterRepresentation(route.effective_character_representation)
      ? [SCRIPT_DERIVED_STYLE_WORLD_LAW]
      : []),
    ...CHARACTER_LAWS[route.effective_character_representation],
    ...INTERPRETATION_LAWS[route.visual_interpretation],
    ...directing,
    ...materials,
  ])}`;
}
