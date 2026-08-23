import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationOutput } from "../../types/index.ts";
import {
  buildStoryboardPromptPackage,
  legacyDialogueSupplement,
  validateStoryboardPromptPackage,
} from "./prompt-package.ts";

function breakdown(): StoryboardGenerationOutput {
  return {
    title: "Hai chiếc ghế",
    synopsis: "A continuity test",
    total_duration_seconds: 20,
    mood_tags: [],
    marketing_structure: {
      hook: "",
      problem: "",
      solution: "",
      cta: "",
    },
    character_locks: [],
    style_guide: {
      color_palette: [],
      art_direction: "",
      visual_references: "",
      consistency_notes: "",
    },
    segments: [
      {
        segment_number: 1,
        duration_seconds: 10,
        title: "Clip one",
        marketing_role: "hook",
        beats: [
          { beat: "Lan sits beside the red chair.", camera: "Wide" },
          { beat: "Lan reaches toward the chair.", camera: "Medium" },
          { beat: "Lan holds the chair.", camera: "Close" },
        ],
        first_frame_prompt: "Lan sits beside the red chair in the living room.",
        motion_prompt: "Lan reaches and grips the chair.",
        dialogue: null,
        continuity_note: "Lan holds the red chair beside the east window.",
        environment_ref: "living_room",
      },
      {
        segment_number: 2,
        duration_seconds: 10,
        title: "Clip two",
        marketing_role: "body",
        beats: [
          { beat: "Lan still holds the chair.", camera: "Close" },
          { beat: "Lan turns the chair.", camera: "Medium" },
          { beat: "Lan sets it down.", camera: "Wide" },
        ],
        first_frame_prompt: "Lan holds the red chair beside the east window.",
        motion_prompt: "Lan turns and sets the chair down.",
        dialogue: null,
        continuity_note: "Lan stands behind the red chair near the east window.",
        environment_ref: "living_room",
      },
    ],
  };
}

test("legacy master prompt never serializes the same spoken line twice", () => {
  const line = "Đừng vội bỏ cuộc chỉ vì hôm nay bạn đi chậm.";
  const fullPrompt = `MOTION: người que đứng dậy. DIALOGUE: VOICEOVER: "${line}"`;
  assert.equal(legacyDialogueSupplement(fullPrompt, line, ""), null);
  assert.equal(
    legacyDialogueSupplement("MOTION: người que đứng dậy.", line, "VOICEOVER"),
    `DIALOGUE (VOICEOVER): "${line}"`
  );
});

test("compiler emits two environment views without changing the old manifest", () => {
  const pkg = buildStoryboardPromptPackage(breakdown(), {
    generatedAt: "2026-07-29T00:00:00.000Z",
    aspectRatio: "9:16",
    veoClips: [
      {
        background_lock: {
          name: "Living room",
          setting: "A fixed living room with an east window",
          scenery: "red chair, wooden floor",
          lighting: "soft morning window light",
        },
      },
      {
        background_lock: {
          name: "Living room",
          setting: "A fixed living room with an east window",
          scenery: "red chair, wooden floor",
          lighting: "soft morning window light",
        },
      },
    ],
  });
  assert.equal(pkg.environment_references.length, 1);
  assert.equal(pkg.environment_references[0]!.required_image_count, 2);
  assert.equal(pkg.environment_references[0]!.images.length, 2);
  assert.equal(pkg.environment_references[0]!.preferred_output_count, 1);
  const preferredSheet = JSON.parse(pkg.environment_references[0]!.location_sheet_prompt);
  assert.equal(preferredSheet.aspect_ratio, "16:9");
  assert.match(preferredSheet.panel_2, /90-135|opposite/i);
  assert.equal(pkg.project.storyboard_schema_version, "4.0");
  assert.equal(pkg.project.post_render_policy, "report_only_no_auto_regeneration");
  assert.deepEqual(pkg.environment_references[0]!.source_clip_ids, [
    "CLIP_001",
    "CLIP_002",
  ]);
  assert.deepEqual(validateStoryboardPromptPackage(pkg), []);
});

test("an explicit scene cut opens from its own state and does not chain panels", () => {
  const bd = breakdown();
  bd.segments[0]!.location_id = "office";
  bd.segments[0]!.transition_in = {
    mode: "opening",
    to_location_id: "office",
    time_relation: "project opening",
    preserve: [],
    reset: [],
    reason: "Opening at work.",
  };
  bd.segments[1]!.location_id = "home";
  bd.segments[1]!.transition_in = {
    mode: "location_cut",
    from_location_id: "office",
    to_location_id: "home",
    time_relation: "later that evening",
    preserve: ["character identity", "emotional thread"],
    reset: ["location", "pose", "lighting"],
    reason: "The approved story moves from work to home.",
  };
  bd.segments[1]!.first_frame_prompt =
    "Lan sits at home beside the west window in warm evening light.";

  const pkg = buildStoryboardPromptPackage(bd, {
    generatedAt: "2026-07-29T00:00:00.000Z",
  });
  const second = pkg.clips[1]!;
  assert.equal(second.continuity_mode, "location_cut");
  assert.equal(second.transition_mode, "location_cut");
  assert.equal(second.starts_from_clip_id, undefined);
  assert.equal(second.panels[0]!.source, "clip_opening");
  assert.equal(second.required_opening_state, bd.segments[1]!.first_frame_prompt);
  assert.deepEqual(validateStoryboardPromptPackage(pkg), []);
});

test("next clip reuses the previous final panel as its opening panel", () => {
  const pkg = buildStoryboardPromptPackage(breakdown(), {
    generatedAt: "2026-07-29T00:00:00.000Z",
  });
  const first = pkg.clips[0]!;
  const second = pkg.clips[1]!;
  assert.equal(second.continuity_mode, "continuous");
  assert.equal(second.continuity_mode, second.transition_mode);
  assert.equal(second.starts_from_clip_id, first.clip_id);
  assert.equal(second.required_opening_state, first.required_end_state);
  assert.equal(second.panels[0]!.source, "previous_clip_end");
  assert.equal(second.panels[0]!.description, first.panels.at(-1)!.description);
});

test("storyboard prompt is multi-panel and explicitly rejects standalone keyframes", () => {
  const pkg = buildStoryboardPromptPackage(breakdown(), {
    generatedAt: "2026-07-29T00:00:00.000Z",
  });
  const prompt = JSON.parse(
    pkg.clips[0]!.nano_banana_storyboard_prompt
  ) as Record<string, unknown>;
  assert.equal(prompt.type, "storyboard_board");
  assert.equal(prompt.panel_count, 3);
  assert.match(
    pkg.clips[0]!.nano_banana_storyboard_prompt,
    /Do not create, chain or interpolate standalone keyframes/
  );
});
