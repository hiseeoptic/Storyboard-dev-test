import type { RealityProfile } from "./types";

export function realityUsesRealWorldPhysics(profile?: RealityProfile | null): boolean {
  if (!profile) return true; // legacy projects keep their former photoreal behaviour
  return ["documentary", "cinematic", "commercial"].includes(profile.mode);
}

/**
 * A compact target directive selected by fidelity. The full canonical reality
 * document stays in the registry; only the relevant depth reaches a clip.
 */
export function buildRealityDirective(profile?: RealityProfile | null): string {
  if (!profile) return "";

  const internal = realityUsesRealWorldPhysics(profile)
    ? "Obey real-world anatomy, gravity, contact, material behaviour and cause-before-effect."
    : `Obey the locked ${profile.physics_model} internal physics consistently; deviations are allowed only when declared by this project's reality profile.`;

  const byFidelity: Record<RealityProfile["fidelity"], string> = {
    A_basic_visual:
      "Keep macro identity, spatial layout, scale, lighting direction and entity forms coherent.",
    B_physical:
      "Keep macro/meso structure coherent; actions travel through real paths, contact precedes influence, force has a source and state changes persist.",
    C_material:
      "In addition to physical causality, render only the interacted foreground materials with their real surface, weight, deformation, light and sound response.",
    D_micro_behavior:
      "Use selective micro-behaviour on hero and interacted entities only: breath, gaze, muscle tension, fabric/hair lag, pressure response and short-lived physical traces; background stays macro-level.",
    E_cinematic_simulation:
      "Simulate macro space, meso anatomy/mechanics, selected micro detail, material reaction, temporal persistence and causal integrity like a physically filmed scene; spend high detail only on hero/interacted entities.",
  };

  return `REALITY PROFILE (${profile.mode}; ${profile.fidelity}): ${internal} ${byFidelity[profile.fidelity]} Maximum ${profile.salience_policy.max_high_fidelity_entities_per_clip} high-fidelity entities in this clip; background fidelity is ${profile.salience_policy.background_fidelity}.`;
}

