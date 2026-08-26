import assert from "node:assert/strict";
import test from "node:test";
import {
  decideFrameMode,
  frameModePolicyTier,
} from "./frame-mode-policy.ts";

test("talking-head directing profiles are locked to a single START frame", () => {
  for (const profile of [
    "interview_expert",
    "creator_ugc",
    "explainer_clarity",
    "reaction_comedy",
  ]) {
    assert.equal(frameModePolicyTier(undefined, profile), "locked_start");
    // Even a maximal transform score cannot force a second frame here — the
    // whole point is to protect lip-sync + audio.
    assert.equal(
      decideFrameMode({ directingProfile: profile, transformScore: 1 }),
      "start",
      `${profile} must stay single-frame`
    );
  }
});

test("manual override always wins over the policy", () => {
  // Override to two frames even on a locked talking-head shot.
  assert.equal(
    decideFrameMode({
      directingProfile: "interview_expert",
      transformScore: 0,
      override: "start_end",
    }),
    "start_end"
  );
  // Override to one frame even on a high-motion action shot.
  assert.equal(
    decideFrameMode({
      directingProfile: "immersive_action",
      transformScore: 1,
      override: "start",
    }),
    "start"
  );
});

test("action / motion profiles prefer start_end once there is any real change", () => {
  assert.equal(frameModePolicyTier(undefined, "immersive_action"), "prefer_start_end");
  assert.equal(
    decideFrameMode({ directingProfile: "immersive_action", transformScore: 0.2 }),
    "start_end"
  );
  // Nearly static → still one frame.
  assert.equal(
    decideFrameMode({ directingProfile: "immersive_action", transformScore: 0.05 }),
    "start"
  );
});

test("product / luxury commercials stay single-frame unless a strong reveal", () => {
  assert.equal(frameModePolicyTier(undefined, "product_commercial"), "prefer_start");
  // Moderate change → hero shot stays one frame (controlled).
  assert.equal(
    decideFrameMode({ directingProfile: "product_commercial", transformScore: 0.4 }),
    "start"
  );
  // Strong transform (a reveal) → two frames.
  assert.equal(
    decideFrameMode({ directingProfile: "product_commercial", transformScore: 0.7 }),
    "start_end"
  );
});

test("adaptive default decides purely from the transform score", () => {
  assert.equal(frameModePolicyTier("drama", "auto"), "adaptive");
  assert.equal(frameModePolicyTier("cinematic_drama"), "adaptive"); // concrete but not special-cased
  assert.equal(
    decideFrameMode({ genre: "drama", transformScore: 0.5 }),
    "start_end"
  );
  assert.equal(
    decideFrameMode({ genre: "drama", transformScore: 0.3 }),
    "start"
  );
});

test("genre is the fallback when directing_profile is auto/unset", () => {
  assert.equal(frameModePolicyTier("action", "auto"), "prefer_start_end");
  assert.equal(frameModePolicyTier("advertising", undefined), "prefer_start");
  assert.equal(frameModePolicyTier("other", "auto"), "adaptive");
});

test("a concrete directing profile overrides the genre mapping", () => {
  // Action genre would prefer_start_end, but a to-camera interview locks it.
  assert.equal(frameModePolicyTier("action", "interview_expert"), "locked_start");
});

test("missing / out-of-range transform score is treated as static", () => {
  assert.equal(decideFrameMode({ genre: "drama" }), "start");
  assert.equal(decideFrameMode({ genre: "drama", transformScore: -5 }), "start");
  assert.equal(decideFrameMode({ genre: "action", transformScore: 999 }), "start_end");
});

test("a talking shot holds on ONE frame unless it also has a STRONG transform", () => {
  // Same moderate transform (locomotion-ish 0.6): SILENT → two frames; TALKING →
  // one frame (lip-sync/face-morph safety). This is the dominant micro-drama case.
  assert.equal(decideFrameMode({ genre: "romance", transformScore: 0.6 }), "start_end");
  assert.equal(
    decideFrameMode({ genre: "romance", transformScore: 0.6, hasDialogue: true }),
    "start",
    "a talking shot with only micro-motion stays single-frame",
  );
  // A genuine STRONG relocation/reveal (0.85) still earns a second frame even
  // while talking.
  assert.equal(
    decideFrameMode({ genre: "romance", transformScore: 0.85, hasDialogue: true }),
    "start_end",
  );
});

test("the dialogue lock applies across tiers and still yields to a manual override", () => {
  // Even a motion-forward tier (action, threshold 0.15) keeps a talking shot with
  // mild motion single-framed.
  assert.equal(
    decideFrameMode({ genre: "action", transformScore: 0.6, hasDialogue: true }),
    "start",
  );
  // Manual override beats the dialogue lock in both directions.
  assert.equal(
    decideFrameMode({ genre: "romance", transformScore: 0.1, hasDialogue: true, override: "start_end" }),
    "start_end",
  );
  assert.equal(
    decideFrameMode({ genre: "action", transformScore: 0.95, hasDialogue: true, override: "start" }),
    "start",
  );
});
