// frame-mode-policy.ts — decide whether a shot is rendered as ONE keyframe
// (Veo image-to-video "start_frame") or TWO keyframes (start + end, Veo
// "start_end_frame" interpolation). §6.2 of the Nano Flow design doc.
//
// Two-level decision (as agreed with the user):
//   1. GENRE / directing_profile → a default "policy tier".
//   2. Per-shot TRANSFORM SCORE (how much the shot physically changes from
//      second 0 → second 10, derived from state_ledger / scene_action) → the
//      final call inside that tier.
//   3. A manual per-shot OVERRIDE always wins.
//
// This module is intentionally pure and dependency-free so it can be unit
// tested in isolation and reused by both the manifest builder and the UI.

/** The two video generation modes the extension already supports. */
export type FrameMode = "start" | "start_end";

/** Per-shot manual override from the UI. "auto" defers to the policy. */
export type FrameModeOverride = "auto" | "start" | "start_end";

/**
 * Policy tiers, chosen by genre / directing profile:
 * - `locked_start`   — talking-head / to-camera / dialogue-driven. NEVER a
 *   second frame: it protects Veo 3 lip-sync + native audio and avoids the
 *   uncanny face "morph" a start→end interpolation causes on near-identical
 *   frames.
 * - `prefer_start_end` — motion-forward content (action, sports, music video,
 *   technical before/after). Two frames as soon as there is any real change.
 * - `prefer_start`   — controlled hero shots (product / luxury commercials).
 *   One frame unless the shot is a strong reveal / transform.
 * - `adaptive`       — everything else (drama, everyday, cooking…). Decide
 *   purely from the per-shot transform score.
 */
export type FrameModePolicyTier =
  | "locked_start"
  | "prefer_start_end"
  | "prefer_start"
  | "adaptive";

// ── Directing-profile → tier (the strongest signal when the user picked one) ──
const PROFILE_LOCKED_START = new Set<string>([
  "interview_expert",
  "creator_ugc",
  "explainer_clarity",
  "reaction_comedy",
  // A locked tripod frame is a single deliberate composition — keep it one frame.
  "static_locked",
]);
const PROFILE_PREFER_START_END = new Set<string>([
  "immersive_action",
  "cinematic_sports",
  "broadcast_sports",
  "rhythmic_music_video",
  "technical_demo",
  "natural_history",
  "poetic_nature",
  // Aerial/drone shots carry real flight motion → interpolate start→end.
  "aerial_drone",
]);
const PROFILE_PREFER_START = new Set<string>([
  "product_commercial",
  "luxury_commercial",
  "premium_commercial",
]);

// ── Genre → tier (fallback when directing_profile is "auto"/unset) ──
const GENRE_LOCKED_START = new Set<string>([
  // Genres that are almost always a person talking to camera.
  "psychology",
  "life_wisdom",
]);
const GENRE_PREFER_START_END = new Set<string>([
  "action",
  "thriller",
  "sports",
  "music_video",
  "nature",
]);
const GENRE_PREFER_START = new Set<string>([
  "advertising",
  "product_demo",
  "brand_film",
  "luxury",
  "promo",
  "unboxing",
]);

// ── Transform-score thresholds per tier (0..1) ──
// A shot goes two-frame when its transform score reaches the tier threshold.
const TIER_THRESHOLD: Record<FrameModePolicyTier, number> = {
  locked_start: Number.POSITIVE_INFINITY, // never (override still wins)
  prefer_start_end: 0.15,
  adaptive: 0.4,
  prefer_start: 0.65,
};

const norm = (v?: string | null): string => (v ?? "").trim().toLowerCase();

/**
 * Resolve the policy tier for a project. `directing_profile` (when concrete,
 * i.e. not "auto") takes precedence over `genre`; otherwise the genre decides.
 * Unknown / unmapped inputs fall back to `adaptive`.
 */
export function frameModePolicyTier(
  genre?: string | null,
  directingProfile?: string | null
): FrameModePolicyTier {
  const p = norm(directingProfile);
  if (p && p !== "auto") {
    if (PROFILE_LOCKED_START.has(p)) return "locked_start";
    if (PROFILE_PREFER_START_END.has(p)) return "prefer_start_end";
    if (PROFILE_PREFER_START.has(p)) return "prefer_start";
    // A concrete profile we don't special-case (e.g. cinematic_drama,
    // everyday_naturalism, soft_romance…) → adaptive.
    return "adaptive";
  }
  const g = norm(genre);
  if (GENRE_LOCKED_START.has(g)) return "locked_start";
  if (GENRE_PREFER_START_END.has(g)) return "prefer_start_end";
  if (GENRE_PREFER_START.has(g)) return "prefer_start";
  return "adaptive";
}

// A shot that carries spoken dialogue only earns a SECOND frame when it also
// has a STRONG physical transform (real relocation / reveal ≈ 0.85). A talking
// shot with mere micro-gestures (lean in, turn the head, hand on a phone) stays
// SINGLE-frame: Veo 3 does native lip-sync + audio on the first frame, and a
// near-identical start→end interpolation morphs the talking face and fights the
// lip-sync. This is why almost every line-driven shot should be one keyframe.
const DIALOGUE_TWO_FRAME_MIN = 0.8;

export interface FrameModeDecisionInput {
  genre?: string | null;
  directingProfile?: string | null;
  /**
   * 0..1 — how much the shot physically changes from start → end. 0 = static
   * (same composition throughout); 1 = a full location/pose transform. Computed
   * upstream from state_ledger / scene_action. Missing ⇒ treated as 0.
   */
  transformScore?: number;
  /**
   * True when the shot has spoken dialogue. A talking shot holds on a SINGLE
   * frame unless it also has a strong physical transform — protecting Veo 3
   * lip-sync/native audio and avoiding the face "morph" a near-identical
   * start→end interpolation causes. See DIALOGUE_TWO_FRAME_MIN.
   */
  hasDialogue?: boolean;
  /** Manual per-shot override from the UI. "auto"/undefined ⇒ use the policy. */
  override?: FrameModeOverride;
}

/**
 * Decide the frame mode for ONE shot. Manual override wins; otherwise the tier
 * threshold is compared against the shot's transform score — and a talking shot
 * demands a STRONG transform before it splits into two frames.
 */
export function decideFrameMode(input: FrameModeDecisionInput): FrameMode {
  // 3. Manual override always wins.
  if (input.override === "start") return "start";
  if (input.override === "start_end") return "start_end";

  // 1. + 2. Tier default refined by the per-shot transform score.
  const tier = frameModePolicyTier(input.genre, input.directingProfile);
  const score = clamp01(input.transformScore);
  // A dialogue shot raises the bar to "strong transform only" so line-driven
  // scenes stay single-frame (lip-sync safe); a manual override still wins above.
  const threshold = input.hasDialogue
    ? Math.max(TIER_THRESHOLD[tier], DIALOGUE_TWO_FRAME_MIN)
    : TIER_THRESHOLD[tier];
  return score >= threshold ? "start_end" : "start";
}

function clamp01(v?: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
