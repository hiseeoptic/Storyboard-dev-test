import assert from "node:assert/strict";
import test from "node:test";
import { buildNanoFlowManifest, lockStyle, slugify } from "./manifest.ts";

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
  // storyboard_prompt is style-locked (photoreal) but preserves the scene text.
  assert.ok(shot1.storyboard_prompt.includes("keyframe prompt 1"));
  assert.equal(shot1.video_prompt, "veo prompt 1");
});

test("style lock forces photoreal and bans cartoon, keeps the scene", () => {
  const locked = lockStyle("A woman pours tea in a sunlit kitchen");
  assert.ok(locked.includes("A woman pours tea in a sunlit kitchen"));
  assert.match(locked, /photorealistic/i);
  assert.match(locked, /cinematic/i);
  assert.match(locked, /NOT cartoon/);
  assert.match(locked, /NOT anime/);
});

test("style lock is idempotent — no duplicate anchors when already present", () => {
  const once = lockStyle("close-up shot");
  const twice = lockStyle(once);
  assert.equal(once, twice);
  // exactly one negative-lock clause
  assert.equal((twice.match(/NOT cartoon/g) ?? []).length, 1);
});

test("style lock respects an existing photoreal prompt", () => {
  const src = "Photorealistic close-up of hands, NOT cartoon.";
  assert.equal(lockStyle(src), src);
});

test("every shot's storyboard_prompt is style-locked", () => {
  const m = buildNanoFlowManifest(fixture());
  for (const shot of m.shots) {
    assert.match(shot.storyboard_prompt, /photorealistic/i);
    assert.match(shot.storyboard_prompt, /NOT cartoon/);
  }
});

test("embeds the structured Veo clip as video_prompt and composes a rich keyframe from it", () => {
  const bd = {
    title: "Demo",
    character_locks: [{ name: "Minh" }, { name: "Lan" }],
    segments: [
      {
        segment_number: 1,
        marketing_role: "hook",
        first_frame_prompt: "A kitchen at dawn.",
        full_prompt: "flat veo prose 1",
        motion_prompt: "m1",
        characters_in_scene: ["Minh", "Lan"],
        environment_ref: "custom",
      },
    ],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];

  // One structured Veo clip (the shape buildVeoJson emits).
  const veoClips = [
    {
      scene_id: "1",
      visual_style: "warm cinematic, 50mm lens",
      character_lock: {
        CHAR_1: {
          name: "Minh",
          gender: "Male",
          age: "male, ~32",
          hair: "short black hair",
          outfit_top: "grey cotton shirt",
          outfit_bottom: "dark jeans",
        },
        CHAR_2: { name: "Lan", gender: "Female", hair: "long black hair", outfit_top: "cream blouse" },
      },
      background_lock: { setting: "A cozy kitchen at dawn", lighting: "soft window light" },
      spatial_topology: { character_placement: "Minh at the counter, Lan by the table" },
      scene_action: { start_state: "Minh pours tea while Lan watches." },
    },
  ] as Array<Record<string, unknown>>;

  const m = buildNanoFlowManifest(bd, { veoClips });
  const [s1] = m.shots;
  assert.ok(s1);

  // video_prompt is now the STRUCTURED clip object, not a flat string.
  assert.equal(typeof s1.video_prompt, "object");
  assert.equal((s1.video_prompt as Record<string, unknown>).scene_id, "1");
  assert.ok((s1.video_prompt as Record<string, unknown>).character_lock);

  // storyboard_prompt is now a STRUCTURED (JSON) keyframe prompt composed from
  // the clip: cast (appearance + wardrobe), placement, composition, a photoreal
  // render note, the identity+wardrobe reference authority and a negative list.
  const kf = JSON.parse(s1.storyboard_prompt) as Record<string, unknown>;
  assert.equal(kf.type, "photoreal_keyframe");
  const cast = kf.cast as Array<Record<string, string>>;
  const minh = cast.find((c) => c.name === "Minh");
  const lan = cast.find((c) => c.name === "Lan");
  assert.ok(minh && lan);
  assert.match(String(minh!.appearance), /Male/);
  assert.match(String(minh!.wardrobe), /grey cotton shirt/);
  assert.equal(kf.placement, "Minh at the counter, Lan by the table");
  assert.equal(kf.composition, "Minh pours tea while Lan watches.");
  assert.match(String(kf.render), /photorealistic/i);
  assert.match(String(kf.negative), /NOT cartoon/);
  assert.match(String(kf.reference_authority), /wardrobe sheet/i);
});

test("keyframe carries the story-locked outfit (direction B) with wardrobe_state override", () => {
  // Direction B: an uploaded character's clothing is the generated context
  // outfit (never the reference photo), and text-only characters need it too —
  // so the keyframe prompt must state each in-scene character's outfit or the
  // image model invents new clothes every shot (wardrobe drift).
  const bd = {
    title: "Outfit",
    character_locks: [
      { name: "Lan", costume: "cream linen blouse, navy trousers" },
      { name: "Minh", costume: "grey tee, dark jeans" },
    ],
    segments: [
      {
        segment_number: 1,
        characters_in_scene: ["Lan", "Minh"],
        environment_ref: "custom",
        first_frame_prompt: "A cafe.",
        motion_prompt: "m",
        full_prompt: "v1",
      },
      {
        segment_number: 2,
        characters_in_scene: ["Lan"],
        environment_ref: "custom",
        first_frame_prompt: "Rain outside.",
        motion_prompt: "m",
        full_prompt: "v2",
        wardrobe_state: [{ character: "Lan", outfit: "beige raincoat over the blouse" }],
      },
    ],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const m = buildNanoFlowManifest(bd);
  const [s1, s2] = m.shots;
  assert.ok(s1 && s2);
  // Shot 1: both characters' locked outfits appear in the keyframe.
  assert.match(s1.storyboard_prompt, /Lan in cream linen blouse, navy trousers/);
  assert.match(s1.storyboard_prompt, /Minh in grey tee, dark jeans/);
  assert.match(s1.storyboard_prompt, /never copied from a reference photo/i);
  // Shot 2: a motivated wardrobe_state change overrides the base outfit.
  assert.match(s2.storyboard_prompt, /Lan in beige raincoat over the blouse/);
  assert.doesNotMatch(s2.storyboard_prompt, /cream linen blouse/);
});

test("character assets carry the story-locked wardrobe; a change emits wardrobe_change", () => {
  const bd = {
    title: "Wardrobe sheet",
    character_locks: [
      { name: "Lan", costume: "cream linen blouse, navy trousers" },
      { name: "Minh", costume: "grey tee, dark jeans" },
    ],
    segments: [
      {
        segment_number: 1,
        characters_in_scene: ["Lan", "Minh"],
        environment_ref: "custom",
        first_frame_prompt: "A cafe.",
        motion_prompt: "m",
        full_prompt: "v1",
      },
      {
        segment_number: 2,
        characters_in_scene: ["Lan"],
        environment_ref: "custom",
        first_frame_prompt: "Rain outside.",
        motion_prompt: "m",
        full_prompt: "v2",
        wardrobe_state: [{ character: "Lan", outfit: "beige raincoat over the blouse" }],
      },
    ],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const m = buildNanoFlowManifest(bd);
  // Each character asset is stamped with its base outfit → the extension builds
  // one full-body wardrobe sheet per character and reuses it for every keyframe.
  const lan = (m.assets.characters ?? []).find((c) => c.name === "Lan");
  const minh = (m.assets.characters ?? []).find((c) => c.name === "Minh");
  assert.equal(lan?.wardrobe, "cream linen blouse, navy trousers");
  assert.equal(minh?.wardrobe, "grey tee, dark jeans");
  const [s1, s2] = m.shots;
  assert.ok(s1 && s2);
  // No change on shot 1 → wardrobe_change is null.
  assert.equal(s1.wardrobe_change, null);
  // A motivated change on shot 2 → the extension regenerates Lan's sheet.
  assert.deepEqual(s2.wardrobe_change, { Lan: "beige raincoat over the blouse" });
});
