import type { SceneIntentIR } from "./types";

export interface SceneIntentIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface SceneIntentValidationContext {
  segmentIndex: number;
  segmentCount: number;
  charactersInScene?: string[];
  projectPurpose?: string;
}

const emptyMeaning = /^(none|nothing|n\/a|not applicable|không|không có)$/i;

/** Semantic checks that a JSON schema cannot express. */
export function validateSceneIntent(
  intent: SceneIntentIR,
  context: SceneIntentValidationContext
): SceneIntentIssue[] {
  const issues: SceneIntentIssue[] = [];
  const add = (code: string, severity: SceneIntentIssue["severity"], message: string) =>
    issues.push({ code, severity, message });

  if (intent.evidence.length === 0) {
    add("INTENT_NO_EVIDENCE", "error", "Scene intent must cite evidence from the script/project intent.");
  }
  if (intent.secondary_functions.includes(intent.primary_function)) {
    add("INTENT_DUPLICATE_FUNCTION", "error", "Primary function must not be repeated as a secondary function.");
  }
  if (intent.proof.must_show.length === 0 && intent.proof.must_hear.length === 0) {
    add("INTENT_NO_PROOF", "error", "Scene intent requires at least one visible or audible proof.");
  }
  if (intent.validation.success_criteria.length === 0) {
    add("INTENT_NO_SUCCESS_CRITERIA", "error", "Scene intent has no testable success criteria.");
  }
  if (intent.validation.failure_conditions.length === 0) {
    add("INTENT_NO_FAILURE_CONDITIONS", "error", "Scene intent has no declared failure conditions.");
  }
  if (emptyMeaning.test(intent.story_change.if_removed_what_breaks.trim())) {
    add(
      "INTENT_DEAD_SCENE",
      "error",
      "Removing this clip reportedly breaks nothing; merge, rewrite, or justify atmosphere as its purpose."
    );
  }
  if (
    intent.story_change.state_before.trim().toLowerCase() ===
      intent.story_change.state_after.trim().toLowerCase() &&
    emptyMeaning.test(intent.story_change.information_revealed.trim()) &&
    intent.primary_function !== "atmosphere"
  ) {
    add("INTENT_NO_STATE_CHANGE", "error", "Non-atmospheric clip changes no state and reveals no information.");
  }
  if (context.segmentIndex > 0 && intent.entry_exit.continuity_anchors.length === 0) {
    add("INTENT_NO_CONTINUITY_ANCHOR", "error", "Every non-opening clip needs a declared continuity anchor.");
  }
  const pov = intent.performance.point_of_view_character.trim();
  const cast = context.charactersInScene ?? [];
  if (cast.length > 0 && !/^(audience|observer|voiceover|narrator)$/i.test(pov) && !cast.includes(pov)) {
    add("INTENT_POV_NOT_IN_SCENE", "error", `POV character "${pov}" is not listed in characters_in_scene.`);
  }
  if (
    intent.primary_function === "call_to_action" &&
    context.projectPurpose &&
    !/(sell|market|promo|conversion|follow|subscribe|engage|brand|lead)/i.test(context.projectPurpose)
  ) {
    add(
      "INTENT_UNJUSTIFIED_CTA",
      "warning",
      "CTA intent is not clearly supported by the locked project purpose."
    );
  }
  if (context.segmentIndex === context.segmentCount - 1 && intent.entry_exit.exit_hook !== "none") {
    add(
      "INTENT_OPEN_ENDING",
      "warning",
      "Final clip has an exit hook; confirm that the project intentionally loops or remains open-ended."
    );
  }

  return issues;
}

