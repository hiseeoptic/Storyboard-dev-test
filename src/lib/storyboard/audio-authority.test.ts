import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationOutput } from "../../types/index.ts";
import {
  bindOnScreenSpeakersToCameraBeats,
  normalizeSegmentAudioAuthority,
} from "./audio-authority.ts";

function fixture(): StoryboardGenerationOutput {
  return {
    title: "Family scene",
    synopsis: "A conversation at home",
    total_duration_seconds: 20,
    mood_tags: [],
    marketing_structure: { hook: "", problem: "", solution: "", cta: "" },
    character_locks: [],
    style_guide: {
      color_palette: [],
      art_direction: "",
      visual_references: "",
      consistency_notes: "",
    },
    context_ir: {
      version: "2.0",
      state: "locked",
      analysis_summary: "",
      confidence: 1,
      assumptions: [],
      evidence: [],
      reality_profile: {} as never,
      layers: {
        environment: {
          strategy: "single_location",
          primary_category: "home",
          selection_rule: "script",
          locations: [
            {
              id: "home",
              narrative_function: "family conversation",
              description: "warm family living room",
              culture_geography_fit: "fit",
              spatial_anchors: ["sofa"],
              fixed_elements: ["window"],
              lighting_motivation: "window",
              sound_bed: "quiet home room tone",
              reverb_profile: "short furnished-room decay",
            },
          ],
        },
      } as never,
    },
    segments: [
      {
        segment_number: 1,
        duration_seconds: 10,
        title: "Opening",
        marketing_role: "hook",
        beats: [{ beat: "Lan listens", camera: "[MEDIUM] Lan" }],
        first_frame_prompt: "Family living room",
        motion_prompt: "Minh speaks to Lan",
        dialogue: "Anh hiểu rồi.",
        speaker: "Minh",
        dialogue_lines: [
          {
            speaker: "Minh",
            delivery: "on_screen",
            text: "Anh hiểu rồi.",
            start_s: 1,
            end_s: 3,
          },
        ],
        location_id: "Đoạn 1",
        continuity_note: "",
      },
      {
        segment_number: 2,
        duration_seconds: 10,
        title: "Reply",
        marketing_role: "body",
        beats: [{ beat: "Lan replies", camera: "[CLOSE] Lan" }],
        first_frame_prompt: "Same room",
        motion_prompt: "Lan replies",
        dialogue: "Em biết.",
        speaker: "Lan",
        dialogue_lines: [
          {
            speaker: "Lan",
            delivery: "on_screen",
            text: "Em biết.",
            start_s: 1,
            end_s: 2.5,
          },
        ],
        location_id: "Đoạn 2",
        continuity_mode: "continuous",
        transition_in: {
          mode: "continuous",
          from_location_id: "Đoạn 1",
          to_location_id: "Đoạn 2",
          time_relation: "same moment",
          preserve: [],
          reset: [],
          reason: "conversation continues",
        },
        continuity_note: "",
      },
    ],
  };
}

test("display segment labels are repaired to Context IR audio authority", () => {
  const breakdown = fixture();
  assert.equal(normalizeSegmentAudioAuthority(breakdown), 2);
  assert.equal(breakdown.segments[0]!.location_id, "home");
  assert.equal(breakdown.segments[1]!.location_id, "home");
  assert.equal(breakdown.segments[1]!.transition_in?.from_location_id, "home");
  assert.equal(breakdown.segments[1]!.transition_in?.to_location_id, "home");
});

test("every on-screen speaker receives a beat that explicitly shows them", () => {
  const breakdown = fixture();
  assert.equal(bindOnScreenSpeakersToCameraBeats(breakdown), 2);
  assert.equal(breakdown.segments[0]!.dialogue_lines?.[0]?.camera_beat, 1);
  assert.match(breakdown.segments[0]!.beats[0]!.camera, /Minh clearly visible/);
  assert.equal(breakdown.segments[1]!.dialogue_lines?.[0]?.camera_beat, 1);
});
