import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationInput } from "../../types/index.ts";
import { validateStoryboardInput } from "./input-validator.ts";

function input(
  overrides: Partial<StoryboardGenerationInput> = {}
): StoryboardGenerationInput {
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

test("clean storyboard input passes before API work", () => {
  assert.equal(validateStoryboardInput(input()).ok, true);
});

test("empty undeclared reference and missing dialogue language fail", () => {
  const report = validateStoryboardInput(
    input({
      force_dialogue: true,
      dialogue_language: "",
      character_images: [{ name: "Minh", images: [] }],
    })
  );
  assert.ok(report.findings.some((finding) => finding.code === "INPUT-004"));
  assert.ok(report.findings.some((finding) => finding.code === "INPUT-007"));
});

test("extension-side declared reference may omit embedded image", () => {
  const report = validateStoryboardInput(
    input({
      character_images: [{ name: "Minh", images: [], isReference: true }],
    })
  );
  assert.equal(report.ok, true);
});

test("stylized representation conflicts with real identity photos", () => {
  const report = validateStoryboardInput(
    input({
      character_representation: "stylized_3d",
      character_images: [{ name: "Minh", images: ["data:image/png;base64,abc"] }],
    })
  );
  assert.ok(report.findings.some((finding) => finding.code === "INPUT-008"));
});
