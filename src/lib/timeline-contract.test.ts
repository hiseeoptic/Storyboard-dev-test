import assert from "node:assert/strict";
import test from "node:test";
import {
  dialogueClockErrors,
  ensureDialogueClock,
  normalizeUntimedContinuousAction,
} from "./timeline-contract.ts";

test("motion keeps action order but loses timecodes and hard cuts", () => {
  const result = normalizeUntimedContinuousAction(
    "0-2s: Character One reaches for the cup; 2-5s: camera cuts to Character Two; 5-10s: Character Two answers."
  );
  assert.equal(
    result,
    "Character One reaches for the cup; camera then smoothly reframes to Character Two; Character Two answers."
  );
});

test("missing dialogue windows are repaired into one sequential clock", () => {
  const turns = ensureDialogueClock([
    { speaker: "Character One", text: "Một câu ngắn" },
    { speaker: "Character Two", text: "Một câu trả lời" },
  ]);
  assert.deepEqual(dialogueClockErrors(turns), []);
  assert.ok(turns[0]!.end_s! <= turns[1]!.start_s!);
});

test("valid user dialogue windows are preserved exactly", () => {
  const turns = [
    { speaker: "Character One", text: "Câu thứ nhất", start_s: 0.4, end_s: 2.1 },
    { speaker: "Character Two", text: "Câu thứ hai", start_s: 2.6, end_s: 4.2 },
  ];
  assert.deepEqual(ensureDialogueClock(turns), turns);
});

test("valid but unnaturally fast dialogue windows are retimed locally", () => {
  const turns = ensureDialogueClock([
    {
      speaker: "Lan",
      text: "Một hai ba bốn năm sáu bảy tám chín mười",
      start_s: 0,
      end_s: 3,
    },
  ]);
  assert.deepEqual(dialogueClockErrors(turns), []);
  assert.ok(turns[0]!.end_s! > 3);
});

test("overloaded dialogue remains inside the shot and preserves all approved text", () => {
  const text = Array.from({ length: 40 }, (_, index) => `từ${index + 1}`).join(" ");
  const turns = ensureDialogueClock([
    { speaker: "Lan", text, start_s: 0, end_s: 4 },
  ]);
  assert.equal(turns[0]!.text, text);
  assert.ok(turns[0]!.start_s! >= 0);
  assert.ok(turns[0]!.end_s! <= 10);
  assert.equal(
    dialogueClockErrors(turns).some((error) => /outside|overlap|missing/iu.test(error)),
    false
  );
});

test("multiple overloaded turns get ordered non-overlapping in-bounds windows", () => {
  const long = Array.from({ length: 24 }, (_, index) => `từ${index + 1}`).join(" ");
  const turns = ensureDialogueClock([
    { speaker: "Lan", text: long, start_s: 0, end_s: 12 },
    { speaker: "Minh", text: long, start_s: 12.5, end_s: 24 },
  ]);
  assert.ok(turns[0]!.end_s! <= turns[1]!.start_s!);
  assert.ok(turns[1]!.end_s! <= 10);
  assert.equal(
    dialogueClockErrors(turns).some((error) => /outside|overlap|missing/iu.test(error)),
    false
  );
});
