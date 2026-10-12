import test from "node:test";
import assert from "node:assert/strict";
import { actionCount, checkScriptRules, fillLineClock, rulesScore, shotCapacity, wordCount } from "./shot-rules.ts";
import { roomToFormPatch, scriptToScreenplay } from "./export.ts";
import { analyzePrompt, normalizeScript, writeScriptPrompt } from "./prompts.ts";
import { approvedScriptFromStoryIdea } from "../storyboard/source-script.ts";
import { emptyRoom, type RoomScript } from "./types.ts";

const words = (n: number) => Array.from({ length: n }, (_, i) => `chữ${i}`).join(" ");

function script(): RoomScript {
  return {
    title: "Chiếc ô của bà",
    logline: "Một cô bé học cách chia sẻ.",
    characters: [
      { name: "Na", age: "8", gender: "nữ", appearance: "tóc ngắn", role: "cô bé", wardrobe: "áo vàng" },
      { name: "Bà", age: "70", gender: "nữ", role: "bà ngoại" },
    ],
    shots: [
      { n: 1, duration_s: 10, location: "hiên nhà ngày mưa", characters: ["Na"], action: "Na áp mặt vào ô cửa kính nhìn mưa rơi nặng hạt", dialogue: [{ speaker: "Na", text: "Mưa to quá bà ơi" }], voice_over: { speaker: "Lời dẫn", text: "Chiều hôm ấy trời đổ mưa" }, camera: "[CLOSE] slow push-in" },
      { n: 2, duration_s: 10, location: "hiên nhà", characters: ["Na", "Bà"], action: "Bà mở chiếc ô cũ rồi đưa cho Na; Na chạy ra sân; Na nhặt con mèo", dialogue: [{ speaker: "Bà", text: words(26) }], camera: "[MEDIUM] hold" },
      { n: 3, duration_s: 10, location: "", characters: ["Na"], action: "Na che ô cho chú mèo ướt", dialogue: [{ speaker: "Minh", text: "Ai đó?" }] },
    ],
  };
}

test("speech capacity follows the pipeline clocks (dialogue 0.4 s/word, VO 128 wpm)", () => {
  const s = script();
  const c1 = shotCapacity(s.shots[0]!);
  assert.equal(c1.dialogueWords, 5);
  assert.equal(c1.voWords, 6);
  assert.equal(c1.load, "ok");
  assert.equal(c1.comfortableWords, 21);
  assert.equal(c1.maxWords, 31);
  assert.equal(shotCapacity(s.shots[1]!).load, "over");
  assert.equal(wordCount("  một  hai ba "), 3);
});

test("action counting flags chained actions", () => {
  assert.equal(actionCount("Na áp mặt vào cửa kính nhìn mưa"), 1);
  assert.equal(actionCount("Bà mở ô rồi đưa cho Na; Na chạy ra sân; Na nhặt con mèo"), 4);
  assert.equal(actionCount(""), 0);
});

test("rules report over-long speech, chained actions, unknown speakers and missing location", () => {
  const issues = checkScriptRules(script());
  const text = issues.map((i) => `${i.shot}:${i.severity}:${i.message}`).join("\n");
  assert.match(text, /2:error:Shot 2: 26 chữ/);
  assert.match(text, /2:warning:Shot 2: \d hành động/);
  assert.match(text, /3:warning:Shot 3: "Minh" nói nhưng không có trong danh sách/);
  assert.match(text, /3:warning:Shot 3: chưa ghi bối cảnh/);
  assert.ok(issues.filter((i) => i.fix).length >= 3, "issues carry one-click fixes");
  assert.ok(rulesScore(issues, 3) < 10);
  assert.equal(rulesScore([], 3), 10);
});

test("line clock is filled inside the clip without overlap", () => {
  const shot = fillLineClock(script().shots[0]!);
  const lines = [...shot.dialogue, shot.voice_over!];
  let prev = 0;
  for (const l of lines) {
    assert.ok(typeof l.start_s === "number" && typeof l.end_s === "number");
    assert.ok(l.start_s! >= prev && l.end_s! <= 10 && l.end_s! > l.start_s!);
    prev = l.end_s!;
  }
});

test("screenplay export is recognised as a finished script, one CẢNH per 10 s clip", () => {
  const text = scriptToScreenplay(script());
  assert.match(text, /^KỊCH BẢN: Chiếc ô của bà/);
  assert.equal((text.match(/^CẢNH \d+ \(10 giây\)/gm) ?? []).length, 3);
  assert.match(text, /Lời dẫn: "Chiều hôm ấy trời đổ mưa"/);
  assert.match(text, /Na: "Mưa to quá bà ơi"/);
  assert.equal(approvedScriptFromStoryIdea(text), text, "pipeline keeps it verbatim");
});

test("form patch carries segment count, cast, speech channels and the chosen plan", () => {
  const state = {
    ...emptyRoom(),
    script: script(),
    options: [{ id: "B", title: "Hoạt hình", format: "kids", logline: "", shot_count: 3, episodes: 1, structure: [], genre: "kids", visual_style: "3d_render", character_representation: "stylized_3d", voice_over: true, dialogue: true, why: "" }],
    chosenOptionId: "B",
  };
  const patch = roomToFormPatch(state)!;
  assert.equal(patch.segmentCount, 3);
  assert.equal(patch.genre, "kids");
  assert.equal(patch.style, "3d_render");
  assert.equal(patch.characterRepresentation, "stylized_3d");
  assert.equal(patch.voiceOver, true);
  assert.equal(patch.dialogue, true);
  assert.equal(patch.characters[0]!.name, "Na");
  assert.equal(patch.characters[0]!.isChild, true);
  assert.match(patch.characters[0]!.appearance, /áo vàng/);
  assert.equal(roomToFormPatch(emptyRoom()), null);
});

test("prompts carry the faithfulness level, the source and the 10-second contract", () => {
  const state = { ...emptyRoom("faithful"), pages: [{ index: 1, text: "Ngày xưa có một cô bé tên Na." }] };
  const a = analyzePrompt(state);
  assert.match(a, /FAITHFUL ADAPTATION/);
  assert.match(a, /--- TRANG 1 ---/);
  const w = writeScriptPrompt(state, { id: "A", title: "x", format: "adaptation", logline: "", shot_count: 6, episodes: 1, structure: [], voice_over: true, dialogue: true, why: "" });
  assert.match(w, /SHOT CONTRACT/);
  assert.match(w, /Write exactly 6 shots/);
  assert.match(w, /≤ 20 Vietnamese words/);
});

test("model output is normalised into numbered 10 s shots", () => {
  const s = normalizeScript({ title: "T", characters: [{ name: "A" }, { name: "" }], shots: [{ action: "a", dialogue: [{ speaker: "A", text: "x", start_s: 1, end_s: 2 }, { text: "" }], voice_over: { text: "" } }, { n: 9, action: "b" }] })!;
  assert.deepEqual(s.shots.map((x) => [x.n, x.duration_s]), [[1, 10], [2, 10]]);
  assert.equal(s.characters.length, 1);
  assert.equal(s.shots[0]!.dialogue.length, 1);
  assert.equal(s.shots[0]!.voice_over, null);
  assert.equal(normalizeScript({ shots: [] }), null);
});
