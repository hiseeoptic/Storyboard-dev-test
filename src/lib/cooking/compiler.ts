import { contextIrToWorldContext } from "@/lib/video-context";
import type { SceneFunction, SceneIntentIR } from "@/lib/scene-intent";
import type {
  MarketingRole,
  SceneBible,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
} from "@/types";
import type {
  CompactCookingScene,
  CompactCookingScenePlan,
  CookingSceneFunction,
} from "./types";

const FUNCTION_TO_INTENT: Record<CookingSceneFunction, SceneFunction> = {
  hook: "hook",
  mise_en_place: "demonstrate",
  prep: "demonstrate",
  cook: "demonstrate",
  transform: "transform",
  plating: "resolve",
};

function marketingRole(sceneFunction: CookingSceneFunction): MarketingRole {
  if (sceneFunction === "hook") return "hook";
  if (sceneFunction === "plating") return "solution";
  return "body";
}

function buildSceneIntent(
  scene: CompactCookingScene,
  input: StoryboardGenerationInput,
  segmentIndex: number,
  segmentCount: number
): SceneIntentIR {
  const isHook = segmentIndex === 0;
  const recipe = input.cooking_recipe!;
  const sound = scene.asmr_cues.join(", ") || "natural sound caused by the visible cooking contact";
  const promise = `See ${recipe.dish_name} reach the finished texture and presentation shown in the opening preview`;
  return {
    intent_id: `cooking_${scene.function}_${String(segmentIndex + 1).padStart(2, "0")}`,
    state: "locked",
    evidence: [
      `Recipe IR: ${scene.recipe_step_orders.length ? `steps ${scene.recipe_step_orders.join(", ")}` : scene.function}`,
      `Cooking style: ${input.cooking_style ?? "kitchen_asmr"}`,
    ],
    confidence: Math.min(1, Math.max(0.6, recipe.confidence)),
    primary_function: FUNCTION_TO_INTENT[scene.function],
    secondary_functions:
      scene.function === "plating" ? ["close_loop"] : scene.function === "transform" ? ["prove_benefit"] : [],
    hook_window: {
      enabled: isHook,
      duration_seconds: isHook ? 4 : 0,
      hook_type: isHook ? "transformation_preview" : "sensory_moment",
      core_promise: isHook ? promise : "Continue the same recipe transformation without opening a new hook",
      immediate_visual_event: isHook ? scene.start_frame : "No secondary hook; continue from the entry state",
      immediate_audio_event: isHook ? sound : "No separate hook audio event",
      dialogue_hook: "none — cooking action and diegetic sound carry the scene",
      payoff_link: isHook ? `The final clip resolves on ${recipe.hero_visual || recipe.dish_name}` : "Supports the locked cooking order",
      forbidden_delays: isHook
        ? ["wide room overview", "greeting", "logo", "ingredient roll-call", "title card"]
        : ["new opening hook", "unrelated exposition"],
    },
    narrative_objective: `Perform ${scene.title} as one readable causal cooking operation.`,
    audience_effect: {
      attention: isHook ? "Immediate appetite and sensory curiosity" : "Sustain attention through a clear state change",
      emotion: isHook ? "craving and curiosity" : "tactile satisfaction and anticipation",
      belief: "Every shown state follows the supplied recipe and real food physics",
      desired_action: "Keep watching until the finished-dish payoff",
    },
    story_change: {
      state_before: scene.start_frame,
      trigger: scene.action_timeline,
      state_after: isHook
        ? `${scene.end_state}; the next clip uses an explicit editorial cut back to the recipe beginning`
        : scene.end_state,
      information_revealed: `The viewer sees how this operation changes the dish toward ${recipe.dish_name}`,
      if_removed_what_breaks: isHook
        ? "The video loses its finished-dish promise"
        : "The recipe loses a necessary visual or causal transition",
    },
    performance: {
      point_of_view_character: "the viewer aligned with the cook's working position",
      character_objective: `Complete ${scene.title} cleanly and visibly`,
      obstacle: "Preserve exact ingredients, tool contact and continuity inside one short clip",
      tactic: "Economical, confident hand movement with one primary action",
      stakes: "A skipped or ambiguous state makes the recipe visually false",
      subtext: "The food is the hero; technique is communicated through action, not explanation",
      emotion_start: isHook ? "sensory anticipation" : "focused calm",
      emotion_end: scene.function === "plating" ? "earned satisfaction" : "rising anticipation",
      performance_intensity: scene.function === "transform" ? "controlled high" : "controlled medium",
      physical_behavior: scene.action_timeline,
    },
    proof: {
      must_show: [scene.start_frame, scene.end_state],
      must_hear: scene.asmr_cues.length ? scene.asmr_cues : [sound],
      must_not_distract_with: ["unrelated props", "presenter performance", "on-screen UI", "invented ingredients"],
    },
    entry_exit: {
      entry_state: scene.start_frame,
      exit_state: scene.end_state,
      continuity_anchors: [scene.continuity_note, ...scene.visible_ingredient_ids],
      exit_hook: isHook
        ? "hold the finished-dish promise, then make an explicit editorial cut back to the recipe start; never morph finished food into raw ingredients inside a shot"
        : segmentIndex === segmentCount - 1
          ? "settle on the finished dish"
          : "leave the next recipe state visibly ready",
    },
    validation: {
      success_criteria: [
        "one primary operation is readable",
        "visible cause precedes effect",
        "ingredient and vessel states match Recipe IR",
        "diegetic sound matches visible contact",
      ],
      failure_conditions: [
        "ingredient appears before its recipe step",
        "food or tool teleports/morphs",
        "multiple unrelated actions are crammed into the clip",
        "the opening preview reset is depicted as an in-shot morph or teleport",
        "style inspiration is copied as a fixed set or creator identity",
      ],
    },
  };
}

function sceneBibleFromInput(input: StoryboardGenerationInput): SceneBible {
  const context = input.resolved_context;
  const location = context?.layers.environment.locations[0];
  const visual = context?.layers.visual_language;
  return {
    lens:
      visual?.camera_grammar.filter(Boolean).slice(0, 3).join("; ") ||
      "food-led macro and near-POV camera grammar; lens selected per action",
    lighting:
      [location?.lighting_motivation, ...(visual?.lighting_grammar ?? []).slice(0, 2)]
        .filter(Boolean)
        .join("; ") || "physically motivated light from the resolved cooking location",
    backdrop:
      location?.description || input.setting || "one cooking workspace resolved from the supplied script and references",
    color_grade:
      [visual?.style_mode, ...(visual?.color_grammar ?? []).slice(0, 2)]
        .filter(Boolean)
        .join("; ") || "natural food colour with restrained cinematic contrast",
    film_grain: "clean acquisition with fine organic texture; no synthetic CGI smoothing",
  };
}

export function compileCookingStoryboard(
  input: StoryboardGenerationInput,
  plan: CompactCookingScenePlan
): StoryboardGenerationOutput {
  if (input.genre !== "cooking" || !input.cooking_recipe) {
    throw new Error("Cooking compiler requires canonical genre=cooking and Recipe IR");
  }
  const beatCount = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  const validIngredientIds = new Set(input.cooking_recipe.ingredients.map((item) => item.id));
  const handsOnly = ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(
    input.cooking_style ?? ""
  );
  const segments = plan.segments.map((scene, index) => {
    const beats = scene.beats.slice(0, beatCount).map((item) => ({
      beat: item.action,
      camera: item.camera,
    }));
    const defaults = [
      { beat: `Begin from the locked start state: ${scene.start_frame}`, camera: "[CLOSE] settle on the active ingredient and tool" },
      { beat: scene.action_timeline, camera: "[POV] controlled reframe following the same hand action" },
      { beat: `Resolve visibly into: ${scene.end_state}`, camera: "[CLOSE] gentle push toward the changed food texture" },
      { beat: `Hold the same end state without adding a new operation`, camera: "[SIDE] small parallax reveal of surface texture" },
      { beat: `Settle on the continuity anchor`, camera: "[EYE] stable finish for chaining" },
    ];
    while (beats.length < beatCount) beats.push(defaults[beats.length]!);
    const visibleIds = scene.visible_ingredient_ids.filter((id) => validIngredientIds.has(id));
    const soundLine = scene.asmr_cues.length
      ? `Audible physical contacts: ${scene.asmr_cues.join(", ")}.`
      : "Use only the natural sound caused by the visible contact.";
    return {
      segment_number: index + 1,
      duration_seconds: 10,
      title: scene.title,
      marketing_role: marketingRole(scene.function),
      scene_intent: buildSceneIntent(scene, input, index, plan.segments.length),
      beats,
      first_frame_prompt: scene.start_frame,
      motion_prompt: `${scene.action_timeline} End visibly and steadily on: ${scene.end_state}. ${soundLine}`,
      dialogue: "",
      speaker: "",
      characters_in_scene: handsOnly
        ? []
        : (input.character_descriptions ?? []).slice(0, 1).map((character) => character.name),
      environment_ref: "custom",
      continuity_note: `${scene.continuity_note}${visibleIds.length ? ` Ingredient state ids: ${visibleIds.join(", ")}.` : ""}`,
    };
  });

  const context = input.resolved_context;
  const recipe = input.cooking_recipe;
  return {
    title: plan.title,
    synopsis: plan.synopsis,
    total_duration_seconds: segments.length * 10,
    mood_tags: ["sensory", "tactile", "appetising", input.cooking_style ?? "cooking"],
    world_context: context ? contextIrToWorldContext(context) : undefined,
    context_ir: context,
    marketing_structure: {
      hook: `Finished-dish sensory preview: ${recipe.hero_visual || recipe.dish_name}`,
      problem: "Raw ingredients require the exact ordered transformations in Recipe IR",
      solution: "Mise en place and causal cooking operations build the dish visibly",
      cta: ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(input.cooking_style ?? "")
        ? "Caption-only save prompt; no spoken CTA"
        : "Optional concise save-the-recipe prompt after the visual payoff",
    },
    character_locks: [],
    scene_bible: sceneBibleFromInput(input),
    product_dna: recipe.hero_visual || `Finished ${recipe.dish_name}, plated according to Recipe IR`,
    segments,
    style_guide: {
      color_palette: context?.layers.visual_language.color_grammar ?? [],
      art_direction: `Food-first ${input.cooking_style ?? "cooking"}; derive each scene from Recipe IR and resolved context, never from a copied creator template`,
      visual_references: "Abstract sensory principles only: readable hand contact, food texture, causal transformation and diegetic sound",
      consistency_notes: "Recipe IR owns quantities/order; Context IR owns location/light/audio; scene plan owns only per-clip action and framing",
    },
  };
}
