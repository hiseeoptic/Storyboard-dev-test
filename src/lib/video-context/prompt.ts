import type { StoryboardGenerationInput } from "@/types";
import { resolveCreativeRoute } from "@/lib/creative-routing";

/**
 * Compact framework digest for downstream planners. The expensive reasoning is
 * performed once by Context Analysis; storyboard generation consumes the
 * resolved IR instead of re-inventing the world for every field and clip.
 */
export function contextFrameworkSystemDigest(): string {
  return `CONTEXT FRAMEWORK — 10 ABSTRACT LAYERS:
1. Project intent  2. World context  3. Ontology  4. Temporal system  5. Environment
6. Character  7. Object/prop  8. Motion & continuity  9. Visual language  10. Audio & validation.
These layers are a neutral analysis framework, NOT a preset world. Never assume a kitchen, living room, country, culture, era, genre, camera style, lighting setup, marketing arc, or continuity mode merely because it exists in a library. Concrete values come only from the supplied RESOLVED CONTEXT IR and approved script. When the IR says "unspecified", keep the decision open or choose the smallest defensible value and declare it; never import an unrelated archetype. Each fact has ONE canonical owner: environment owns location/material/light motivation/sound bed; timeline owns timing; dialogue_turns own speech timing; visual language owns camera and grade.`;
}

export function buildContextAnalysisSystemPrompt(): string {
  return `You are the Context Analysis stage of a video production compiler. Analyse the supplied brief and approved script, then resolve a neutral 10-layer Context IR.

This stage does NOT write a storyboard, shot prompt, image prompt, or Veo prompt. It only decides what world the supplied story actually requires.

CORE RULES:
- Evidence first. Resolve values from the brief, script, dialogue, reference descriptions, genre and requested output.
- Apply the supplied creative_route in order: topic → audience outcome → story format → visual interpretation → character medium → directing profile. Topic decides which specialist DNA may exist. Never import an inactive topic/profile.
- The creative route is a production instruction, not permission to invent content. The approved script and explicit references remain factual evidence.
- Uploaded character references force strict photographic identity. Uploaded environment/product references force their respective geometry, material and layout facts regardless of a conflicting legacy style label.
- Never choose a kitchen, living room, mountain, country, culture, era, social class, visual style or marketing formula just because a preset/library contains it.
- If evidence is absent, write "unspecified" and record an assumption instead of silently defaulting.
- Environment location ids are PROJECT-LOCAL semantic ids such as "location_01". Never output an environment library/archetype id.
- A multi-location script must use a multi-location strategy. Do not force exact spatial continuity between scenes that intentionally change location; choose strict, soft, montage, match-cut, symbolic or scene-cut continuity from the story evidence.
- One fact, one owner: location/light motivation/sound bed belong to Environment; event timing belongs to Motion/Timeline; spoken timing belongs to Audio; camera/grade belong to Visual Language.
- Resolve TWO independent reality choices: reality mode (documentary/cinematic/commercial/stylized/symbolic-surreal/fantasy-scifi-internal) and fidelity depth (A basic visual / B physical / C material / D micro-behavior / E cinematic simulation). Macro/meso/micro/material/temporal/causal are validation dimensions, not extra world modes.
- Fidelity is SELECTIVE: high detail belongs only to hero and causally interacted entities. Backgrounds stay macro/meso unless the script makes them important. Never spend prompt budget describing invisible pores, fibres or grass blades.
- Output compact JSON only. Do not repeat the script and do not generate prose prompts.
- Set version to "2.0", state to "resolved", and confidence to a number from 0 to 1.`;
}

export function buildContextAnalysisUserPrompt(input: StoryboardGenerationInput): string {
  const creativeRoute = resolveCreativeRoute(input);
  const evidence = {
    story_idea: input.story_idea,
    approved_script: input.source_script ?? null,
    genre: input.genre,
    video_goal: input.video_goal ?? null,
    creative_route: creativeRoute,
    visual_style_request: input.style,
    setting_request: input.setting ?? null,
    tone: input.tone ?? null,
    dialogue_language: input.dialogue_language ?? "Vietnamese",
    segment_count: input.segment_count ?? input.scene_count ?? 5,
    beats_per_segment: input.beats_per_segment ?? 3,
    aspect_ratio: input.aspect_ratio ?? "9:16",
    target_audience: input.target_audience ?? null,
    key_message: input.key_message ?? null,
    main_character: input.main_character ?? null,
    central_conflict: input.central_conflict ?? null,
    product_name: input.product_name ?? null,
    selling_points: input.selling_points ?? null,
    call_to_action: input.call_to_action ?? null,
    characters: input.character_descriptions ?? [],
    has_character_references: (input.character_images?.length ?? 0) > 0,
    has_product_references: (input.product_images?.length ?? 0) > 0,
    has_location_references: (input.background_images?.length ?? 0) > 0,
    cooking_recipe:
      input.genre === "cooking" && input.cooking_recipe
        ? {
            dish_name: input.cooking_recipe.dish_name,
            servings: input.cooking_recipe.servings,
            ingredients: input.cooking_recipe.ingredients.map((item) => ({
              id: item.id,
              name: item.name,
              amount: item.amount,
              unit: item.unit,
              group: item.group,
            })),
            steps: input.cooking_recipe.steps.map((step) => ({
              order: step.order,
              action: step.action,
              visible_end_state: step.visible_end_state,
            })),
            cooking_style: input.cooking_style ?? "kitchen_asmr",
          }
        : null,
    custom_instructions: input.custom_instructions ?? null,
  };
  return `Resolve the 10-layer Context IR from this project evidence:\n${JSON.stringify(evidence, null, 2)}`;
}
