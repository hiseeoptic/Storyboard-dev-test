import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationOutput } from "../../types/index.ts";
import {
  fingerprintStoryboardValidation,
  hasCurrentValidationCache,
  stampValidationCache,
} from "./validation-fingerprint.ts";

function breakdown(): StoryboardGenerationOutput {
  return {
    title: "Demo",
    synopsis: "A scene",
    total_duration_seconds: 10,
    mood_tags: [],
    marketing_structure: { hook: "h", problem: "p", solution: "s", cta: "c" },
    character_locks: [],
    segments: [],
    style_guide: {
      color_palette: [],
      art_direction: "cinematic",
      visual_references: "",
      consistency_notes: "",
    },
  };
}

test("critic cache stays current only while storyboard data is unchanged", () => {
  const fixture = breakdown();
  stampValidationCache(fixture);
  assert.equal(hasCurrentValidationCache(fixture), true);
  fixture.synopsis = "Edited";
  assert.equal(hasCurrentValidationCache(fixture), false);
});

test("render URLs do not invalidate semantic critic cache", () => {
  const fixture = breakdown();
  stampValidationCache(fixture);
  fixture.segments.push({ first_frame_url: "https://example.test/image.png" } as never);
  assert.notEqual(
    fingerprintStoryboardValidation(fixture),
    fixture.validation_cache!.fingerprint,
    "adding a semantic segment must invalidate even if its only populated field is a URL"
  );
  stampValidationCache(fixture);
  fixture.segments[0]!.first_frame_url = "https://example.test/changed.png";
  assert.equal(hasCurrentValidationCache(fixture), true);
});
