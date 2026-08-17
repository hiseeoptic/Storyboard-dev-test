import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationInput, StoryboardGenerationOutput } from "../../types/index.ts";
import {
  enforceAnonymousNarrationContract,
  resolveSpeechMode,
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

test("new menu resolves all four independent speech modes", () => {
  assert.equal(resolveSpeechMode({ voice_over_enabled: true, character_dialogue_enabled: true }).mode, "mixed");
  assert.equal(resolveSpeechMode({ voice_over_enabled: true, character_dialogue_enabled: false }).mode, "voice_over_only");
  assert.equal(resolveSpeechMode({ voice_over_enabled: false, character_dialogue_enabled: true }).mode, "character_dialogue_only");
  assert.equal(resolveSpeechMode({ voice_over_enabled: false, character_dialogue_enabled: false }).mode, "wordless");
});

test("mixed mode keeps narrator and character ownership separate", () => {
  const input = {
    voice_over_enabled: true,
    character_dialogue_enabled: true,
    story_idea: "A family conversation",
  } as StoryboardGenerationInput;
  const breakdown = {
    segments: [{
      segment_number: 1,
      dialogue_lines: [
        { speaker: "", text: "Buổi sáng ấy bắt đầu rất sớm." },
        { speaker: "Lan", text: "Anh đã dậy rồi à?" },
      ],
    }],
  } as StoryboardGenerationOutput;
  enforceAnonymousNarrationContract(input, breakdown);
  assert.equal(breakdown.segments[0]!.dialogue_lines?.[0]?.delivery, "voiceover");
  assert.equal(breakdown.segments[0]!.dialogue_lines?.[1]?.delivery, "on_screen");
});

test("dialogue-only removes model-invented narrator rows", () => {
  const input = {
    voice_over_enabled: false,
    character_dialogue_enabled: true,
    story_idea: "A family conversation",
  } as StoryboardGenerationInput;
  const breakdown = {
    segments: [{
      segment_number: 1,
      dialogue_lines: [
        { speaker: "", delivery: "voiceover", text: "Narrator line" },
        { speaker: "Lan", delivery: "on_screen", text: "Character line" },
      ],
    }],
  } as StoryboardGenerationOutput;
  enforceAnonymousNarrationContract(input, breakdown);
  assert.equal(breakdown.segments[0]!.dialogue, "Character line");
  assert.equal(breakdown.segments[0]!.dialogue_lines?.length, 1);
});

test("wordless mode clears speech but leaves scene action untouched", () => {
  const input = {
    voice_over_enabled: false,
    character_dialogue_enabled: false,
    story_idea: "Wordless visual",
  } as StoryboardGenerationInput;
  const breakdown = {
    segments: [{
      segment_number: 1,
      motion_prompt: "Lan closes the window.",
      dialogue: "Unexpected line",
      speaker: "Lan",
      dialogue_lines: [{ speaker: "Lan", text: "Unexpected line" }],
    }],
  } as StoryboardGenerationOutput;
  enforceAnonymousNarrationContract(input, breakdown);
  assert.equal(breakdown.segments[0]!.dialogue, "");
  assert.equal(breakdown.segments[0]!.speaker, "");
  assert.equal(breakdown.segments[0]!.dialogue_lines, undefined);
  assert.equal(breakdown.segments[0]!.motion_prompt, "Lan closes the window.");
});
