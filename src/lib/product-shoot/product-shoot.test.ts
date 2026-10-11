import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SHOT_STYLES,
  STYLE_BY_ID,
  detectProductCategory,
  recommendedStyles,
  resolveShotStyle,
} from "./catalog.ts";
import { planProductBeats, productShootScriptDirective, resolveProductShoot } from "./contract.ts";
import { enforceProductShootContract, productShootSubject } from "./storyboard.ts";

test("every category recommends only existing styles and at least four of them", () => {
  for (const c of PRODUCT_CATEGORIES) {
    assert.ok(c.recommended_styles.length >= 4, c.value);
    for (const s of c.recommended_styles) assert.ok(STYLE_BY_ID[s], `${c.value} → ${s}`);
  }
  for (const s of PRODUCT_SHOT_STYLES) {
    assert.deepEqual(s.beats.map((b) => b.role), ["hook", "reveal", "detail", "proof", "hero"], s.value);
    assert.ok(s.camera_moves.length >= 3, s.value);
  }
});

test("product category is detected from Vietnamese and English names", () => {
  const cases: Array<[string, string]> = [
    ["Đồng hồ Casio nam dây kim loại", "watch"],
    ["Serum vitamin C dưỡng sáng da", "skincare"],
    ["Son kem lì", "makeup"],
    ["Giày thể thao nam", "footwear"],
    ["Nồi chiên không dầu 5L", "home_appliance"],
    ["Tai nghe bluetooth chống ồn", "audio"],
    ["Cà phê sữa đá hòa tan", "beverage"],
    ["Túi xách da nữ", "bags_leather"],
    ["Nước hoa nam", "fragrance"],
    ["Person holding something", "general"],
  ];
  for (const [text, want] of cases) assert.equal(detectProductCategory(text), want, text);
});

test("styles respect presence: hands-only offers the hands-on demo, product-only never does", () => {
  assert.ok(!recommendedStyles("watch", "product_only").includes("hand_demo"));
  assert.equal(recommendedStyles("watch", "hands_only")[1], "hand_demo");
  assert.equal(resolveShotStyle("hand_demo", "watch", "product_only"), "dark_reveal");
  assert.equal(resolveShotStyle("stop_motion", "food", "product_only"), "stop_motion");
});

test("beat plan follows the hook → reveal → detail → proof → hero arc across clips", () => {
  const shoot = resolveProductShoot({ presence: "product_only", style: "dark_reveal" }, ["Đồng hồ Orient"])!;
  const plan = planProductBeats(shoot, [10, 10, 10]);
  assert.equal(plan.length, 3);
  const roles = plan.flat().map((b) => b.role);
  assert.equal(roles[0], "hook");
  assert.equal(roles[roles.length - 1], "hero");
  assert.ok(roles.includes("proof"));
  for (const clip of plan) {
    assert.equal(clip[0]!.start, 0);
    assert.equal(clip[clip.length - 1]!.end, 10);
    for (const b of clip) assert.match(b.camera, /^\[(EXTREME_CLOSE|CLOSE|MEDIUM|WIDE)\]/);
  }
  assert.match(plan[1]!.map((b) => b.action).join(" "), /Featured:/);
});

test("people-free guard empties the cast, turns speech into voice-over and rewrites person beats", () => {
  const shoot = resolveProductShoot({ presence: "product_only", style: "light_sweep", category: "watch" })!;
  const breakdown = {
    character_locks: [{ name: "Minh" }],
    segments: [
      {
        duration_seconds: 10,
        beats: [{ beat: "Minh glances at his old watch", camera: "[WIDE] eye-level" }, { beat: "the bezel gleams under the strip light", camera: "[MEDIUM] push-in" }],
        characters_in_scene: ["Minh"],
        dialogue_lines: [{ speaker: "Minh", text: "Đúng giờ thôi chưa đủ.", delivery: "on_screen" as const, camera_beat: 1 }],
        first_frame_prompt: "Minh stands at the reception desk",
        motion_prompt: "The strip light glides along the case",
      },
    ],
  };
  const notes = enforceProductShootContract(shoot, breakdown as never);
  assert.deepEqual(breakdown.character_locks, []);
  const seg = breakdown.segments[0]!;
  assert.deepEqual(seg.characters_in_scene, []);
  assert.equal(seg.dialogue_lines[0]!.speaker, "");
  assert.equal(seg.dialogue_lines[0]!.delivery, "voiceover");
  assert.doesNotMatch(seg.beats[0]!.beat!, /Minh/);
  assert.equal(seg.beats[1]!.beat, "the bezel gleams under the strip light");
  for (const b of seg.beats) assert.ok(STYLE_BY_ID.light_sweep.beats.some((t) => b.camera!.includes(t.camera)), b.camera);
  assert.doesNotMatch(seg.first_frame_prompt, /Minh|reception/);
  assert.match(seg.first_frame_prompt, /ONLY subject/);
  assert.equal(seg.motion_prompt, "The strip light glides along the case");
  assert.ok(notes.length >= 1);
  assert.match(productShootSubject(shoot), /ONLY subject/);
});

test("with-characters mode keeps the model's story untouched", () => {
  const shoot = resolveProductShoot({ presence: "with_characters", style: "light_sweep", category: "watch" })!;
  const breakdown = { character_locks: [{ name: "Minh" }], segments: [{ duration_seconds: 10, beats: [{ beat: "Minh is late", camera: "[WIDE] handheld" }], characters_in_scene: ["Minh"] }] };
  assert.deepEqual(enforceProductShootContract(shoot, breakdown as never), []);
  assert.equal(breakdown.character_locks.length, 1);
  assert.match(productShootScriptDirective(shoot), /AFFILIATE PROBLEM → SOLUTION/);
  assert.equal(productShootSubject(shoot), "");
});
