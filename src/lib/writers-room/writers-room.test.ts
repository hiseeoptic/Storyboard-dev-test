import test from "node:test";
import assert from "node:assert/strict";
import { actionCount, checkScriptRules, fillLineClock, rulesScore, shotCapacity, wordCount } from "./shot-rules.ts";
import { roomToFormPatch, scriptToScreenplay } from "./export.ts";
import { analyzePrompt, normalizeScript, speechModeLine, writeScriptPrompt } from "./prompts.ts";
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
  assert.match(w, /10–20 spoken Vietnamese words per shot/);
  assert.match(w, /first spoken line starts at 0–0\.5 s/);
  assert.match(w, /characters talk on screen in every shot/);
});

test("model output is normalised into numbered 10 s shots", () => {
  const s = normalizeScript({ title: "T", characters: [{ name: "A" }, { name: "" }], shots: [{ action: "a", dialogue: [{ speaker: "A", text: "x", start_s: 1, end_s: 2 }, { text: "" }], voice_over: { text: "" } }, { n: 9, action: "b" }] })!;
  assert.deepEqual(s.shots.map((x) => [x.n, x.duration_s]), [[1, 10], [2, 10]]);
  assert.equal(s.characters.length, 1);
  assert.equal(s.shots[0]!.dialogue.length, 1);
  assert.equal(s.shots[0]!.voice_over, null);
  assert.equal(normalizeScript({ shots: [] }), null);
});

test("a speaking plan never leaves the opening silent", () => {
  const s = script();
  s.shots[0] = { ...s.shots[0]!, dialogue: [], voice_over: null };
  s.shots[1] = { ...s.shots[1]!, dialogue: [] };
  s.shots[2] = { ...s.shots[2]!, dialogue: [{ speaker: "Na", text: "Lại đây" }] };
  const issues = checkScriptRules(s);
  const byCode = (code: string) => issues.filter((i) => i.code === code).map((i) => `${i.shot}:${i.severity}`);
  assert.deepEqual(byCode("no_hook_line"), ["1:error"]);
  assert.deepEqual(byCode("no_speech"), ["2:error"]);
  assert.deepEqual(byCode("thin_speech"), ["3:warning"]);
  assert.ok(issues.filter((i) => i.code).every((i) => i.fix), "speech findings carry a fix for the writer");
});

test("the hook line must start in the first second", () => {
  const s = script();
  s.shots[0] = { ...s.shots[0]!, dialogue: [{ speaker: "Na", text: "Mưa to quá bà ơi", start_s: 4, end_s: 6 }], voice_over: null };
  assert.ok(checkScriptRules(s).some((i) => i.code === "no_hook_line"));
  s.shots[0] = { ...s.shots[0]!, dialogue: [{ speaker: "Na", text: "Bà ơi, con mèo đâu rồi?", start_s: 0.3, end_s: 2.3 }] };
  assert.ok(!checkScriptRules(s).some((i) => i.code === "no_hook_line"));
});

test("a wordless plan is not asked for speech", () => {
  const s = script();
  for (const shot of s.shots) { shot.dialogue = []; shot.voice_over = null; }
  assert.equal(checkScriptRules(s, { speech: false }).filter((i) => ["no_speech", "thin_speech", "no_hook_line"].includes(i.code ?? "")).length, 0);
  assert.match(speechModeLine({ dialogue: false, voice_over: false }), /WORDLESS/);
  assert.match(speechModeLine({ dialogue: false, voice_over: true }), /narrator voice-over only/);
  assert.match(speechModeLine({ dialogue: true, voice_over: false }), /on-screen dialogue only/);
});

test("spoken lines survive the shapes models return", () => {
  const s = normalizeScript({
    title: "T",
    shots: [
      { action: "a", dialogue: [{ character: "Lan", line: "Anh đi đâu đấy?", start: "0.4", end: 2 }, "Minh: Đi làm", { text: "  " }], voice_over: "Sáng hôm ấy trời mưa" },
      { action: "b", voice_over: [{ text: "Câu một", start_s: 1 }, { text: "câu hai", end_s: 6 }] },
    ],
  })!;
  assert.deepEqual(s.shots[0]!.dialogue, [
    { speaker: "Lan", text: "Anh đi đâu đấy?", start_s: 0.4, end_s: 2 },
    { speaker: "Minh", text: "Đi làm" },
  ]);
  assert.deepEqual(s.shots[0]!.voice_over, { speaker: "Lời dẫn", text: "Sáng hôm ấy trời mưa" });
  assert.deepEqual(s.shots[1]!.voice_over, { speaker: "Lời dẫn", text: "Câu một câu hai", start_s: 1, end_s: 6 });
});

test("shots name their opening state and give moved furniture a real path", () => {
  const s = script();
  s.shots[0] = { ...s.shots[0]!, start: "Na ngồi trên ghế cạnh cửa sổ" };
  s.shots[1] = { ...s.shots[1]!, start: "Bà đứng cạnh Na", action: "Bà kéo chiếc ghế sang phía bên kia bàn" };
  const issues = checkScriptRules(s);
  const codes = (code: string) => issues.filter((i) => i.code === code).map((i) => i.shot);
  assert.deepEqual(codes("no_start"), [3]);
  assert.deepEqual(codes("unclear_path"), [2]);
  s.shots[1] = { ...s.shots[1]!, action: "Bà kéo chiếc ghế ra, nhấc lên, bê vòng qua đầu bàn rồi đặt xuống phía bên kia" };
  assert.deepEqual(checkScriptRules(s).filter((i) => i.code === "unclear_path").map((i) => i.shot), []);
});

test("the opening state reaches the storyboard screenplay", () => {
  const s = script();
  s.shots[0] = { ...s.shots[0]!, start: "Na ngồi trên ghế cạnh cửa sổ" };
  const text = scriptToScreenplay(s);
  assert.match(text, /Mở cảnh: Na ngồi trên ghế cạnh cửa sổ/);
  assert.match(text, /nối tiếp liền mạch/);
  assert.equal(normalizeScript({ shots: [{ action: "a", start: " Na ngồi " }] })!.shots[0]!.start, "Na ngồi");
});
