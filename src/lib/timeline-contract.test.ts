import assert from "node:assert/strict";
import test from "node:test";
import {
  dialogueClockErrors,
  ensureDialogueClock,
  normalizeUntimedContinuousAction,
} from "./timeline-contract.ts";
import {
  dedupeRepeatedWardrobeStates,
  wardrobeStateThrough,
} from "./wardrobe-continuity.ts";

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

test("one wardrobe transition persists into later clips without repetition", () => {
  const segments: {
    wardrobe_state?: { character: string; outfit: string; outfit_materials?: string; hair?: string }[];
  }[] = [
    {},
    { wardrobe_state: [{ character: "Character One", outfit: "rain-soaked established outfit" }] },
    { wardrobe_state: [{ character: "Character One", outfit: "rain-soaked established outfit" }] },
  ];

  dedupeRepeatedWardrobeStates(segments);

  assert.equal(segments[2]!.wardrobe_state, undefined);
  assert.equal(
    wardrobeStateThrough(segments, 2).get("character one")?.outfit,
    "rain-soaked established outfit"
  );
});
