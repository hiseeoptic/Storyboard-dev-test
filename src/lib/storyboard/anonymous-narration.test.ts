import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationInput, StoryboardGenerationOutput } from "../../types/index.ts";
import {
  enforceAnonymousNarrationContract,
  stripUnrequestedNarrationCta,
} from "./anonymous-narration.ts";

test("removes an engagement question absent from the user's source", () => {
  assert.equal(
    stripUnrequestedNarrationCta(
      "Đừng xấu hổ vì mình đi chậm. Bạn sẽ tiếp tục bước đi hôm nay như thế nào?",
      "Đừng xấu hổ vì mình đi chậm."
    ),
    "Đừng xấu hổ vì mình đi chậm."
  );
});

test("preserves a reflective question when the user explicitly wrote it", () => {
  const line = "Bạn sẽ tiếp tục bước đi hôm nay như thế nào?";
  assert.equal(stripUnrequestedNarrationCta(line, line), line);
});

test("anonymous narration converts every retained turn to narrator VO", () => {
  const input = {
    anonymous_narration: true,
    story_idea: "Chỉ cần đừng đứng yên.",
  } as StoryboardGenerationInput;
  const breakdown = {
    segments: [{
      segment_number: 1,
      dialogue: "Chỉ cần đừng đứng yên. Bạn sẽ làm gì tiếp theo?",
      speaker: "Người đi chậm",
      dialogue_lines: [{
        speaker: "Người đi chậm",
        delivery: "on_screen",
        camera_beat: 1,
        text: "Chỉ cần đừng đứng yên. Bạn sẽ làm gì tiếp theo?",
      }],
    }],
  } as StoryboardGenerationOutput;

  enforceAnonymousNarrationContract(input, breakdown);
  assert.equal(breakdown.segments[0]!.speaker, "");
  assert.equal(breakdown.segments[0]!.dialogue, "Chỉ cần đừng đứng yên.");
  assert.deepEqual(breakdown.segments[0]!.dialogue_lines, [{
    speaker: "",
    delivery: "voiceover",
    camera_beat: undefined,
    text: "Chỉ cần đừng đứng yên.",
  }]);
});

test("an explicitly edited narrator line is preserved while ownership stays VO", () => {
  const input = {
    anonymous_narration: true,
    story_idea: "Bản gốc.",
  } as StoryboardGenerationInput;
  const breakdown = {
    segments: [{
      segment_number: 1,
      dialogue_lines: [{
        speaker: "Nhân vật",
        delivery: "on_screen",
        text: "Còn bạn sẽ chọn bước nào?",
      }],
    }],
  } as StoryboardGenerationOutput;

  enforceAnonymousNarrationContract(input, breakdown, { preserveCurrentText: true });
  assert.equal(breakdown.segments[0]!.dialogue, "Còn bạn sẽ chọn bước nào?");
  assert.equal(breakdown.segments[0]!.dialogue_lines?.[0]?.speaker, "");
  assert.equal(breakdown.segments[0]!.dialogue_lines?.[0]?.delivery, "voiceover");
});
