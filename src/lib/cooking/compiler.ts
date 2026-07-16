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
  const promise = `See ${recipe.dish_name} reach the finished texture and presentation shown in the opening money shot`;
  const eatingCook = ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(input.cooking_style ?? "")
    ? (input.character_descriptions ?? [])[0]?.name?.trim()
    : undefined;
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
      payoff_link: isHook ? `The final clip resolves on ${recipe.hero_visual || recipe.dish_name} served into the eating vessel` : "Supports the locked cooking order",
      forbidden_delays: isHook
        ? ["wide room overview", "greeting", "logo", "flat ingredient roll-call list", "title card"]
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
        ? `${scene.end_state}; the next clip cuts back to the raw-ingredient display at the recipe's start (explicit editorial reset — the only allowed non-causal jump)`
        : scene.end_state,
      information_revealed: `The viewer sees how this operation changes the dish toward ${recipe.dish_name}`,
      if_removed_what_breaks: isHook
        ? "The video loses its appetite-grabbing finished-dish promise"
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
        ? "hold the finished-dish money shot to the end; the next clip opens on the raw-ingredient display via an explicit editorial cut — never morph finished food into raw ingredients inside a shot"
        : segmentIndex === segmentCount - 1
          ? eatingCook
            ? `settle on ${eatingCook} tasting the first bite of the served dish, face clearly visible toward camera`
            : "settle on the finished dish served into the eating vessel, ready to eat"
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
        "the editorial reset is depicted as an in-shot morph or teleport",
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
  // The uploaded cook appears ONLY in the final clip (eating payoff, face
  // visible); every other hands-only clip stays faceless.
  const mainCook = handsOnly
    ? (input.character_descriptions ?? [])[0]?.name?.trim()
    : undefined;
  const segments = plan.segments.map((scene, index) => {
    const isFinalSegment = index === plan.segments.length - 1;
    const isEatingPayoff = isFinalSegment && !!mainCook;
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
    // Diegetic audio is the hook for cooking: mix the real contact sounds
    // forward, layered and crisp, so each clip is immersive rather than sparse.
    const soundLine = scene.asmr_cues.length
      ? `Audio: layer these real contact sounds up-front, crisp and close-miked for an immersive ASMR mix — ${scene.asmr_cues.join(", ")}.`
      : "Audio: bring the natural cooking contact sound forward, crisp and close-miked, for an immersive ASMR feel.";
    // Middle clips (not the ingredient hook, not the final plating) are the
    // engine of the video — drive them faster and tighter on the transformation.
    const isMiddle = index !== 0 && index !== plan.segments.length - 1;
    const pacingLine = isMiddle
      ? " PACE: fast and energetic — brisk match-on-action, visible time-compression/speed ramp on any repetitive motion (chopping runs, stirring), quick smooth reframes, tight macro push-ins locked on the ingredient transformation (blade contact, sizzle, bubbling, colour/texture/steam change); no dead frames — every second shows material visibly changing."
      : "";
    // Hands-only ASMR formats: Veo's worst failure here is a third hand — lock
    // one pair hard in every clip. POV framing keeps the real setting alive
    // behind the food work instead of context-free macro closeups.
    // The eating-payoff clip shows the cook's face, so the hands-only POV and
    // one-pair rules give way to a clean front framing there.
    const handsLine =
      handsOnly && !isEatingPayoff
        ? " HANDS LOCK: exactly ONE cook — at most ONE PAIR of hands on screen (two hands total, identical skin tone and sleeves for the whole clip); the two hands never do two things in two separate places at once; never a third hand, never a second person's hands, never a disembodied hand entering from an impossible edge."
        : "";
    const povLine =
      (handsOnly || (input.background_images?.length ?? 0) > 0) && !isEatingPayoff
        ? " CAMERA POV: first-person from the cook's viewpoint — hands and food working in the lower foreground while the real setting stays alive and visible in the upper depth of frame (its light, weather and ambient motion present behind the action)."
        : "";
    // HOOK / OPENING / PAYOFF structures are enforced here deterministically —
    // the plan model has repeatedly ignored them, so the compiler pins the
    // timing regardless of its output. Hook = finished dish ONLY (cramming the
    // ingredient pan into the same 10s produced rushed, poor shots); the
    // ingredient display now OPENS segment 2; the uploaded cook appears only in
    // the final clip to taste the dish, face clearly visible.
    const hookLine =
      index === 0
        ? ` HOOK TIMING (mandatory, overrides any conflicting timing above): the whole 10s stays on the finished ${input.cooking_recipe!.dish_name} as one appetising money shot — 0-4s an immediate craveable TRIGGER INTERACTION on its most seductive element (chopsticks lifting glossy strands, a spoon breaking the soft egg yolk so it flows, a cheese pull, sauce drizzling, steam bursting); 4-10s keep exploring ONLY the same dish (slow push, texture, gloss, steam). No raw ingredients, no prep, no cooking action in this clip.`
        : "";
    const openingLine =
      index === 1
        ? ` OPENING (mandatory): this clip is an explicit editorial cut back to the recipe's beginning — 0-3s: the dish's FULL raw-ingredient arrangement, every ingredient fresh in separate bowls and kitchen vessels, held as a styled hero display; 3-10s: the first prep operation begins on those same ingredients. This is a cut between clips, never an in-shot morph of finished food into raw ingredients.`
        : "";
    const eatingLine =
      isFinalSegment && mainCook
        ? ` EATING PAYOFF (mandatory final beats): ${mainCook}, matching the attached character reference, is seated at the table behind the served dish from second 0, FACE fully visible to camera (never cropped, never turned away, never hidden behind the bowl or steam); in the last 3-4 seconds ${mainCook} lifts the first bite with the dish's utensil, tastes it, and reacts with visible genuine delight while facing the camera.`
        : "";
    return {
      segment_number: index + 1,
      duration_seconds: 10,
      title: scene.title,
      marketing_role: marketingRole(scene.function),
      scene_intent: buildSceneIntent(scene, input, index, plan.segments.length),
      beats,
      // Segment 2 opens on the ingredient hero display; the final clip seats
      // the eating character — both must exist in the start frame to render.
      first_frame_prompt:
        index === 1 &&
        !/raw ingredient|nguyên liệu|arranged in (bowls|vessels|kitchen)|mise en place/i.test(scene.start_frame)
          ? `The dish's full set of raw ingredients laid out fresh in separate bowls and kitchen vessels as a styled hero display. ${scene.start_frame}`
          : isFinalSegment && mainCook && !new RegExp(mainCook, "i").test(scene.start_frame)
            ? `${scene.start_frame} ${mainCook}, matching the attached character reference, sits at the table behind the served dish, face clearly visible toward camera.`
            : scene.start_frame,
      motion_prompt: `${scene.action_timeline} End visibly and steadily on: ${scene.end_state}.${hookLine}${openingLine}${eatingLine}${pacingLine}${handsLine}${povLine} ${soundLine}`,
      dialogue: "",
      speaker: "",
      characters_in_scene: handsOnly
        ? isFinalSegment && mainCook
          ? [mainCook]
          : []
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
      hook: `Finished-dish money shot with one craveable trigger interaction: ${recipe.hero_visual || recipe.dish_name}`,
      problem: "Raw ingredients (revealed as a hero display opening clip 2) require the exact ordered transformations in Recipe IR",
      solution: `Causal cooking operations build the dish visibly, then serve it into the eating vessel${mainCook ? ` — and ${mainCook} tastes the first bite, face visible` : ""}: ${recipe.hero_visual || recipe.dish_name}`,
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
