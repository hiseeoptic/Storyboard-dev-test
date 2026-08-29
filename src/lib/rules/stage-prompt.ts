import type { ActiveStoryboardRulePacket, StoryboardRuleStage } from "./active-packet.ts";

export type StoryboardStageResponsibility =
  | "input_authority"
  | "bounded_edit_scope"
  | "dialogue_lock"
  | "scene_intent_lock"
  | "json_output"
  | "visible_text_policy"
  | "clip_continuity"
  | "camera_grammar"
  | "action_budget"
  | "physical_interaction";

export interface StoryboardStagePromptContract {
  stage: Exclude<StoryboardRuleStage, "generation">;
  responsibilities: readonly StoryboardStageResponsibility[];
  forbidden_responsibilities: readonly string[];
}

const TECHNICAL_EDIT_RESPONSIBILITIES = [
  "input_authority",
  "bounded_edit_scope",
  "dialogue_lock",
  "scene_intent_lock",
  "json_output",
  "visible_text_policy",
  "clip_continuity",
  "camera_grammar",
  "action_budget",
  "physical_interaction",
] as const satisfies readonly StoryboardStageResponsibility[];

export const STORYBOARD_STAGE_PROMPT_CONTRACTS: Readonly<
  Record<Exclude<StoryboardRuleStage, "generation">, StoryboardStagePromptContract>
> = {
  segment_rewrite: {
    stage: "segment_rewrite",
    responsibilities: TECHNICAL_EDIT_RESPONSIBILITIES,
    forbidden_responsibilities: [
      "global story authorship",
      "dialogue or speaker mutation",
      "hook invention or removal",
      "project-wide cast, world, style, or schema redesign",
      "changes outside the requested segment",
    ],
  },
  repair: {
    stage: "repair",
    responsibilities: TECHNICAL_EDIT_RESPONSIBILITIES,
    forbidden_responsibilities: [
      "global story authorship",
      "dialogue or speaker mutation",
      "hook invention or removal",
      "unrequested creative enhancement",
      "changes outside validator findings and requested targets",
    ],
  },
} as const;

function visibleTextInstruction(packet: ActiveStoryboardRulePacket): string {
  const policy = packet.visible_text.locked_policy || "no additional readable text";
  switch (packet.visible_text.mode) {
    case "verified_brand_only":
      return "Preserve only branding verified by an uploaded reference or approved Product IR; invent no lettering, logo, label, caption, title, HUD, or overlay.";
    case "contextual_diegetic_with_verified_brand":
      return `Obey the locked diegetic policy (${JSON.stringify(policy)}) and preserve only verified product branding; invent no other wording.`;
    case "contextual_diegetic":
      return `Obey the locked diegetic policy exactly (${JSON.stringify(policy)}); invent no wording outside it and add no overlay unless explicitly permitted.`;
    case "overlay_allowed":
      return `Obey the explicit text/overlay policy exactly (${JSON.stringify(policy)}); add no wording or graphics beyond that authority.`;
    default:
      return "Generate zero readable text, logos, labels, captions, titles, HUD, or overlays in video frames.";
  }
}

function stageScopeInstruction(stage: StoryboardStagePromptContract["stage"]): string {
  if (stage === "segment_rewrite") {
    return "Rewrite exactly the requested segment. Treat every other segment as read-only chaining context. Improve only staging, timing, camera coverage, action clarity, and physical continuity needed by that segment.";
  }
  return "Repair exactly the requested segments/character locks and only the supplied validator findings. Treat clean targets and all neighbours as read-only. Do not add unrelated improvements or regenerate the project.";
}

/**
 * Returns a small, stage-owned system prompt for bounded edit operations.
 * Full generation deliberately returns null and continues to use the complete
 * director/storyboard prompt until that prompt is modularized separately.
 */
export function buildStoryboardStageSystemPrompt(
  packet: ActiveStoryboardRulePacket
): string | null {
  if (packet.stage === "generation") return null;

  const contract = STORYBOARD_STAGE_PROMPT_CONTRACTS[packet.stage];
  const camera = packet.camera.mode === "derive_without_forced_recipe"
    ? "Derive camera only from the locked Scene Intent and supplied scene facts; impose no default movement, smoothness, or variety recipe."
    : `Use selected camera palette=${JSON.stringify(packet.camera.selected_profile_ids)}, grammar=${JSON.stringify(packet.camera.locked_grammar)}, edit rhythm=${JSON.stringify(packet.camera.edit_rhythm)}. ${packet.camera.selection_policy}`;
  const action = packet.action.mode === "locked_context_budget"
    ? `Use the locked action budget exactly: ${JSON.stringify(packet.action.locked_budget)}. Every gesture must cause a required state change or serve Scene Intent.`
    : "Use only causally necessary, physically feasible movement. Intentional stillness is valid; add no decorative hand business.";

  return [
    `ACTIVE STAGE PROMPT V6 — ${packet.stage.toUpperCase()}`,
    "ROLE: You are a deterministic technical storyboard state editor for one bounded operation, not the author of a new project.",
    "AUTHORITY: Obey the current user request, menu selections, uploaded references, approved/current scene content, locked Context IR, Production State, Scene Intent, and target data in the user prompt. Never replace those facts with a preferred template.",
    `SCOPE: ${stageScopeInstruction(packet.stage)}`,
    "DIALOGUE LOCK: Preserve every current dialogue/narration line, order, language, delivery ownership, and speaker exactly. This stage may not perform creative polish, paraphrase, translation, deletion, addition, or speaker reassignment.",
    "INTENT LOCK: Preserve the current Scene Intent, narrative function, hook state, hook promise, causal meaning, and ending. Do not create, remove, or intensify a hook in this technical edit.",
    "OUTPUT: Return valid JSON only, with exactly the wrapper/object and fields requested by the user prompt and API schema. No markdown, commentary, omitted required fields, or extra targets.",
    `VISIBLE TEXT: ${visibleTextInstruction(packet)}`,
    `CLIP CONTINUITY: One generated clip is one physically continuous take. Continuity mode=${JSON.stringify(packet.clip_execution.continuity_mode)}; allowed boundary transitions=${JSON.stringify(packet.clip_execution.allowed_transition_modes)}. Put cuts, montage, time jumps, and parallel edits only at declared clip boundaries; inherit state only when continuity requires it.`,
    `CAMERA: ${camera}`,
    `ACTION: ${action}`,
    `PHYSICAL INTERACTION: physics mode=${JSON.stringify(packet.physical_interaction.physics_mode)}; intentional exceptions=${JSON.stringify(packet.physical_interaction.intentional_exceptions)}. ${packet.physical_interaction.obstacle_clearance} ${packet.physical_interaction.manipulation_chain} ${packet.physical_interaction.support_continuity} Pans, pots, bowls, tools, furniture, ingredients, and receiving surfaces never float, teleport, interpenetrate, or lose support unless an explicitly named exception authorizes that exact entity and event.`,
    `FORBIDDEN RESPONSIBILITIES: ${contract.forbidden_responsibilities.join("; ")}.`,
    `ACTIVE RULE IDS: ${packet.active_rule_ids.join(", ") || "none"}.`,
    `SUPPRESSED CONFLICTING RULE IDS: ${packet.suppressed_rule_ids.join(", ") || "none"}.`,
  ].join("\n");
}
