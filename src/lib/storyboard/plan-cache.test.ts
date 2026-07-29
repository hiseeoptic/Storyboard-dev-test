import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationInput } from "../../types/index.ts";
import {
  fingerprintStoryboardPlan,
  StoryboardPlanCache,
} from "./plan-cache.ts";

function input(overrides: Partial<StoryboardGenerationInput> = {}): StoryboardGenerationInput {
  return {
    story_idea: "A quiet reunion",
    genre: "drama",
    style: "cinematic",
    scene_count: 2,
    segment_count: 2,
    beats_per_segment: 3,
    ...overrides,
  };
}

test("fingerprint is stable across object key order", () => {
  const a = input({ setting: "Kitchen", tone: "Warm" });
  const b = {
    tone: "Warm",
    setting: "Kitchen",
    beats_per_segment: 3,
    segment_count: 2,
    scene_count: 2,
    style: "cinematic",
    genre: "drama",
    story_idea: "A quiet reunion",
  } as StoryboardGenerationInput;
  assert.equal(
    fingerprintStoryboardPlan(a, "openai"),
    fingerprintStoryboardPlan(b, "openai")
  );
});

test("fingerprint changes when content or provider changes", () => {
  const base = input();
  assert.notEqual(
    fingerprintStoryboardPlan(base, "openai"),
    fingerprintStoryboardPlan(input({ beats_per_segment: 4 }), "openai")
  );
  assert.notEqual(
    fingerprintStoryboardPlan(base, "openai"),
    fingerprintStoryboardPlan(base, "gemini")
  );
});

test("cache refreshes hits and evicts only the oldest entry", () => {
  const cache = new StoryboardPlanCache<number>(2);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.get("a"), 1);
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.size, 2);
});

test("fingerprint proxies large image payloads instead of hashing the whole body", () => {
  const bigA = "data:image/png;base64," + "A".repeat(500_000);
  const bigB = "data:image/png;base64," + "B".repeat(500_000);
  const withImg = (imgs: string[]) => input({ reference_images: imgs });
  // Deterministic: the same image hashes identically.
  assert.equal(
    fingerprintStoryboardPlan(withImg([bigA]), "openai"),
    fingerprintStoryboardPlan(withImg([bigA]), "openai")
  );
  // Distinct: a different image still changes the fingerprint (length/edges).
  assert.notEqual(
    fingerprintStoryboardPlan(withImg([bigA]), "openai"),
    fingerprintStoryboardPlan(withImg([bigB]), "openai")
  );
  // Proxied: the fed-char count (3rd hash segment) stays tiny, not ~500K — so
  // the main thread never iterates the whole base64 body.
  const fedChars = parseInt(fingerprintStoryboardPlan(withImg([bigA]), "openai").split("-")[2] ?? "0", 16);
  assert.ok(fedChars < 5000, `fed ${fedChars} chars — large payloads must be proxied`);
});
