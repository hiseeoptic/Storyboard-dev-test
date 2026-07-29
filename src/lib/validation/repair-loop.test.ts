import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationOutput, VideoSegment } from "@/types";
import { runStoryboardRepairLoop } from "./repair-loop.ts";
import { buildReport } from "./semantic-validator.ts";

function cleanFixture(): StoryboardGenerationOutput {
  return {
    title: "A clean plan",
    synopsis: "Two people talk in one stable room.",
    total_duration_seconds: 20,
    mood_tags: ["grounded"],
    world_context: {
      world_type: "cinematic realistic",
      time_period: "contemporary daytime",
      environment_category: "home",
    },
    marketing_structure: { hook: "", problem: "", solution: "", cta: "" },
    character_locks: [
      {
        name: "A",
        gender: "male",
        gender_age: "male, 30",
        costume: "plain cotton shirt and trousers",
        skin_tone: "warm",
        hair: "short black hair",
        eyes: "brown",
        voice: "calm adult voice",
      },
    ],
    segments: [
      {
        segment_number: 1,
        duration_seconds: 10,
        title: "Opening",
        marketing_role: "hook",
        beats: [{ beat: "A looks up", camera: "[MS] A" }],
        first_frame_prompt: "A sits in a sunlit living room.",
        motion_prompt: "A looks up and takes one calm breath.",
        dialogue: "Hello.",
        speaker: "A",
        characters_in_scene: ["A"],
        environment_ref: "living_room_day",
        continuity_note: "A remains seated.",
      },
      {
        segment_number: 2,
        duration_seconds: 10,
        title: "Response",
        marketing_role: "body",
        beats: [{ beat: "A nods", camera: "[CU] A" }],
        first_frame_prompt: "A remains in the same sunlit living room.",
        motion_prompt: "A nods once and relaxes.",
        dialogue: "I understand.",
        speaker: "A",
        characters_in_scene: ["A"],
        environment_ref: "living_room_day",
        continuity_note: "A remains calm.",
      },
    ],
    style_guide: {
      color_palette: [],
      art_direction: "",
      visual_references: "",
      consistency_notes: "",
    },
  } as unknown as StoryboardGenerationOutput;
}

test("clean storyboard spends no repair call", async () => {
  let calls = 0;
  const result = await runStoryboardRepairLoop({
    breakdown: cleanFixture(),
    repair: async () => {
      calls += 1;
      return { segments: [] };
    },
  });

  assert.equal(result.status, "clean");
  assert.equal(result.rounds, 0);
  assert.equal(calls, 0);
});

test("repairs only the failing segment and preserves approved dialogue", async () => {
  const breakdown = cleanFixture();
  const untouched = breakdown.segments[0];
  breakdown.segments[1]!.motion_prompt = "";
  let targets: number[] = [];

  const result = await runStoryboardRepairLoop({
    breakdown,
    repair: async (_current, request) => {
      targets = request.target_segment_numbers;
      return {
        segments: [
          {
            ...breakdown.segments[1],
            motion_prompt: "A nods once after hearing the answer.",
            dialogue: "The critic must not replace this.",
            speaker: "Wrong speaker",
          } as VideoSegment,
        ],
      };
    },
  });

  assert.equal(result.status, "clean");
  assert.deepEqual(targets, [2]);
  assert.equal(result.breakdown.segments[0], untouched);
  assert.equal(result.breakdown.segments[1]!.dialogue, "I understand.");
  assert.equal(result.breakdown.segments[1]!.speaker, "A");
  assert.deepEqual(result.repaired_segment_numbers, [2]);
});

test("stops after one unchanged repair instead of wasting more API calls", async () => {
  const breakdown = cleanFixture();
  breakdown.segments[1]!.motion_prompt = "";
  let calls = 0;

  const result = await runStoryboardRepairLoop({
    breakdown,
    maxRounds: 3,
    repair: async () => {
      calls += 1;
      return { segments: [{ ...breakdown.segments[1] } as VideoSegment] };
    },
  });

  assert.equal(result.status, "no_progress");
  assert.equal(calls, 1);
});

test("repairs a blocking character lock without rewriting any scene", async () => {
  const breakdown = cleanFixture();
  breakdown.character_locks[0]!.costume = "";
  const originalSegments = breakdown.segments;
  let characterTargets: string[] = [];

  const result = await runStoryboardRepairLoop({
    breakdown,
    repair: async (_current, request) => {
      characterTargets = request.target_character_names;
      return {
        segments: [],
        character_locks: [
          {
            ...breakdown.character_locks[0]!,
            costume: "plain cotton shirt and trousers",
          },
        ],
      };
    },
  });

  assert.equal(result.status, "clean");
  assert.deepEqual(characterTargets, ["a"]);
  assert.equal(result.breakdown.segments, originalSegments);
  assert.equal(
    result.breakdown.character_locks[0]!.costume,
    "plain cotton shirt and trousers"
  );
  assert.deepEqual(result.repaired_character_names, ["A"]);
});

test("project-only defect is not sent to a segment repair model", async () => {
  const breakdown = cleanFixture();
  let calls = 0;

  const result = await runStoryboardRepairLoop({
    breakdown,
    validate: () =>
      buildReport(
        [
          {
            code: "PROJECT-LOCK",
            severity: "high",
            scope: "project",
            message: "The project lock is invalid.",
          },
        ],
        "test gate"
      ),
    repair: async () => {
      calls += 1;
      return { segments: [] };
    },
  });

  assert.equal(result.status, "unrepairable");
  assert.equal(calls, 0);
});
