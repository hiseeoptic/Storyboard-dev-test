import assert from "node:assert/strict";
import test from "node:test";
import { castHasChild, childSafeDeep, childSafeText } from "./child-safe-wording.ts";

test("the shot 1 wording that Veo refused is rewritten", () => {
  const start =
    "Na stands in the foreground facing the camera, eyes wide and lips pouting. Bố stands securely in the open floor area with both arms around Mẹ's waist; Mẹ stands close at his right.";
  const safe = childSafeText(start);
  assert.doesNotMatch(safe, /lips|pout|waist/i);
  assert.match(safe, /eyes wide and a sulky frown/);
  assert.match(safe, /both arms around Mẹ's shoulders/);
  assert.equal(childSafeText("Na holds her surprised pout, then raises both hands toward Bố."), "Na holds her surprised sulky frown, then raises both hands toward Bố.");
  assert.equal(childSafeText("Bố releases his arms from Mẹ's waist"), "Bố releases his arms from Mẹ's shoulders", "start and motion stay consistent");
  assert.equal(childSafeText("camera at waist height"), "camera at waist height");
});

test("carrying a child names no thighs or hips; makeup never says nude", () => {
  const carry = "Bố returns to a stable standing posture with his left forearm supporting under Na's thighs and his right hand supporting her back. End with Bố holding Na safely at his left hip.";
  const safe = childSafeText(carry);
  assert.doesNotMatch(safe, /thigh|hip/i);
  assert.match(safe, /under Na's legs/);
  assert.match(safe, /at his left side/);
  assert.equal(childSafeText("a natural rosy or nude lip"), "a natural rosy or natural lip");
  assert.equal(childSafeText("Na puts her hands on her hips"), "Na puts her fists at her sides");
  assert.equal(childSafeText("standing, held at waist by Bố"), "standing, held in a side hug by Bố");
  assert.equal(childSafeText("securely supporting Na at left hip"), "securely supporting Na at the left side");
  assert.equal(childSafeText("phone held at hip height"), "phone held at hip height");
});

test("kisses become hugs, unsafe words go, ordinary text is untouched", () => {
  assert.equal(childSafeText("Bố gives Mẹ a quick kiss on the cheek."), "Bố gives Mẹ a gentle side hug.");
  assert.equal(childSafeText("Bố kisses Mẹ on the cheek"), "Bố hugs Mẹ");
  assert.equal(childSafeText("Kissing sounds"), "Hugging sounds");
  assert.equal(childSafeText("no captions, nudity, watermark"), "no captions, watermark");
  assert.equal(childSafeText("no captions, no kissing, no nudity, watermark"), "no captions, watermark");
  assert.equal(childSafeText("The bathroom door; the camera at adult chest height"), "The bathroom door; the camera at adult chest height");
  const clip = { scene_action: { start_state: "lips pouting" }, dialogue: [{ text: "Bố ơi!" }] };
  const safe = childSafeDeep(clip);
  assert.equal(safe.scene_action.start_state, "a sulky frown");
  assert.equal(safe.dialogue, clip.dialogue, "unchanged parts keep their identity");
});

test("a child in the cast turns the pass on", () => {
  assert.equal(castHasChild([{ is_child: false }, { is_child: true }]), true);
  assert.equal(castHasChild([{}], undefined), false);
  assert.equal(castHasChild([], { kidAge: "toddler" }), true);
});
