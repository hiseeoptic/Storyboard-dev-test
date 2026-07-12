/** Visual/world mode: WHAT kind of reality the project inhabits. */
export type RealityMode =
  | "documentary"
  | "cinematic"
  | "commercial"
  | "stylized"
  | "symbolic_surreal"
  | "fantasy_scifi_internal";

/** Fidelity budget: HOW DEEPLY the selected reality must be simulated. */
export type RealityFidelity =
  | "A_basic_visual"
  | "B_physical"
  | "C_material"
  | "D_micro_behavior"
  | "E_cinematic_simulation";

/** Independent validation axes. These are dimensions, not sequential levels. */
export interface RealityDimensions {
  macro: boolean;
  meso: boolean;
  micro: boolean;
  material_reaction: boolean;
  temporal_continuity: boolean;
  causal_integrity: boolean;
}

export type RealityDetailBand = "macro_only" | "meso" | "material" | "micro";

export interface RealitySaliencePolicy {
  /** IDs whose identity/detail is essential to the clip/project. */
  hero_entities: string[];
  /** IDs touched, moved, transformed, spoken through, or otherwise causally active. */
  interaction_entities: string[];
  foreground_fidelity: RealityDetailBand;
  background_fidelity: RealityDetailBand;
  /** Prevents "describe every pore and grass blade" prompt explosions. */
  max_high_fidelity_entities_per_clip: number;
}

export interface RealityProfile {
  mode: RealityMode;
  fidelity: RealityFidelity;
  dimensions: RealityDimensions;
  target_authenticity: string;
  /** Real-world, stylized, fantasy, dream, or another script-defined physics constitution. */
  physics_model: string;
  allowed_deviations: string[];
  salience_policy: RealitySaliencePolicy;
}

