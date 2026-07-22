import assert from "node:assert/strict";
import test from "node:test";
import { buildNanoFlowManifest, slugify } from "./manifest.ts";

// Minimal breakdown fixture — only the fields buildNanoFlowManifest reads.
function fixture() {
  return {
    title: "Making Trà Bắc",
    total_duration_seconds: 20,
    thumbnail_title: "TRÀ BẮC CHÍNH GỐC",
    social_posts: { tiktok: { caption: "x", hashtags: [] } },
    character_locks: [{ name: "Lan" }, { name: "Minh" }],
    segments: [
      {
        segment_number: 1,
        duration_seconds: 10,
        marketing_role: "hook",
        first_frame_prompt: "keyframe prompt 1",
        full_prompt: "veo prompt 1",
        motion_prompt: "motion 1",
        dialogue: "Trà này pha đúng kiểu Bắc mới ngon.",
        characters_in_scene: ["Lan"],
        environment_ref: "living_room_1",
        beats: [{ beat: "pours tea", camera: "[CU] push-in" }],
      },
      {
        segment_number: 2,
        duration_seconds: 10,
        marketing_role: "body",
        first_frame_prompt: "keyframe prompt 2",
        full_prompt: "veo prompt 2",
        characters_in_scene: ["Minh"],
        environment_ref: "custom",
      },
    ],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
}

test("slugify handles Vietnamese diacritics and đ", () => {
  assert.equal(slugify("Trà Bắc"), "tra_bac");
  assert.equal(slugify("Đặng Minh"), "dang_minh");
});

test("manifest has the fixed contract shape", () => {
  const m = buildNanoFlowManifest(fixture(), { generatedAt: "2026-07-21T00:00:00Z" });
  assert.equal(m.manifest_version, "1.0");
  assert.equal(m.generator, "storyboard-ai");
  assert.equal(m.shots.length, 2);
  assert.equal(m.project.title, "Making Trà Bắc");
  assert.equal(m.project.aspect_ratio, "9:16");
  assert.equal(m.project.thumbnail_title, "TRÀ BẮC CHÍNH GỐC");
});

test("characters become declared assets, referenced by id in shots", () => {
  const m = buildNanoFlowManifest(fixture());
  const [shot1] = m.shots;
  assert.ok(shot1);
  const ids = (m.assets.characters ?? []).map((c) => c.id);
  assert.deepEqual(ids, ["char_lan", "char_minh"]);
  // shot 1 references Lan by id in both steps
  assert.deepEqual(shot1.image_refs?.characters, ["char_lan"]);
  assert.deepEqual(shot1.video_refs?.characters, ["char_lan"]);
});

test("environment_ref becomes an asset except when custom", () => {
  const m = buildNanoFlowManifest(fixture());
  const [shot1, shot2] = m.shots;
  assert.ok(shot1 && shot2);
  assert.deepEqual((m.assets.environments ?? []).map((e) => e.id), ["living_room_1"]);
  assert.deepEqual(shot1.image_refs?.environments, ["living_room_1"]);
  // shot 2 is "custom" → no environment ref
  assert.deepEqual(shot2.image_refs?.environments, []);
});

test("video_refs default policy: keyframe on, environments/products off", () => {
  const m = buildNanoFlowManifest(fixture());
  for (const shot of m.shots) {
    assert.equal(shot.video_refs?.use_generated_storyboard, true);
    assert.deepEqual(shot.video_refs?.environments, []);
    assert.deepEqual(shot.video_refs?.products, []);
  }
});

test("shot ids and storyboard names are ordered", () => {
  const m = buildNanoFlowManifest(fixture());
  const [shot1, shot2] = m.shots;
  assert.ok(shot1 && shot2);
  assert.equal(shot1.shot_id, "SHOT_001");
  assert.equal(shot2.shot_id, "SHOT_002");
  assert.equal(shot1.storyboard_name, "Making Trà Bắc 1");
  assert.equal(shot1.storyboard_prompt, "keyframe prompt 1");
  assert.equal(shot1.video_prompt, "veo prompt 1");
});
