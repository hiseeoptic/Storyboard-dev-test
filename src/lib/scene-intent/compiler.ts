import type { SceneIntentIR } from "./types";

/** Only the evidence needed by the video target; the full contract stays in IR. */
export function renderSceneIntentDirective(intent?: SceneIntentIR | null): string {
  if (!intent) return "";
  const show = intent.proof.must_show.slice(0, 3).join("; ");
  const hear = intent.proof.must_hear.slice(0, 2).join("; ");
  const avoid = intent.proof.must_not_distract_with.slice(0, 2).join("; ");
  return `SCENE INTENT (${intent.primary_function}): ${intent.narrative_objective}. REQUIRED PROOF — show: ${show || "the declared state change"}${hear ? `; hear: ${hear}` : ""}. PERFORMANCE: ${intent.performance.physical_behavior}; subtext: ${intent.performance.subtext}. END STATE: ${intent.entry_exit.exit_state}.${avoid ? ` Do not distract with: ${avoid}.` : ""}`;
}

