import assert from "node:assert/strict";
import test from "node:test";
import { AI_LOOK_NEGATIVE, HUMAN_PERFORMANCE_DOCTRINE, HUMAN_PERFORMANCE_LAW, KEYFRAME_CANDID_NOTE, performanceDirection } from "./human-performance.ts";
import { childSafeText } from "../kids/child-safe-wording.ts";

test("the doctrine covers reactions, eyes, changing faces, hands, listeners, turn direction, timing and spoken lines", () => {
  for (const rule of ["REACT, THEN ACT", "EYES LEAD", "EXPRESSIONS CHANGE INSIDE THE CLIP", "REAL BODIES", "HANDS HAVE BUSINESS", "LISTENERS ARE ALIVE", "DIRECT EVERY TURN", "REAL TIMING", "SPOKEN, NOT WRITTEN"]) {
    assert.ok(HUMAN_PERFORMANCE_DOCTRINE.includes(rule), rule);
  }
  assert.match(HUMAN_PERFORMANCE_DOCTRINE, /"Hả\?", "Thật á\?"/);
  assert.match(HUMAN_PERFORMANCE_DOCTRINE, /number of dialogue turns is never fixed[\s\S]*Nobody freezes/);
});

test("each clip gets the writer's acting plus the real-people law", () => {
  assert.deepEqual(performanceDirection("  Lan glances at the chair,  then  back at Minh. "), {
    acting: "Lan glances at the chair, then back at Minh.",
    realism: HUMAN_PERFORMANCE_LAW,
  });
  assert.deepEqual(performanceDirection(undefined), { realism: HUMAN_PERFORMANCE_LAW });
});

test("the AI-look blacklist and candid note stay compatible with kids' big expressions and child-safe wording", () => {
  assert.match(AI_LOOK_NEGATIVE, /mannequin-still body/);
  assert.match(AI_LOOK_NEGATIVE, /one fixed smile/);
  assert.doesNotMatch(AI_LOOK_NEGATIVE, /over-acted|exaggerated expressions/, "cute-kids reels ask for big expressions");
  for (const text of [HUMAN_PERFORMANCE_LAW, AI_LOOK_NEGATIVE, KEYFRAME_CANDID_NOTE]) assert.equal(childSafeText(text), text);
});
