import assert from "node:assert/strict";
import test from "node:test";
import { buildNanoFlowManifest, lockStyle, slugify, withKeyframeAuthority } from "./manifest.ts";

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
  assert.equal(m.shots[0]?.continuity_mode, "opening");
  assert.equal(m.shots[1]?.continuity_mode, "continuous");
});

test("selected video style is locked into the manifest board + video prompts", () => {
  const m = buildNanoFlowManifest(fixture(), {
    characterRepresentation: "claymation",
    characterStylePrompt: "CLAYMATION STYLE LOCK: tactile clay character and a matching miniature clay environment.",
    generatedAt: "2026-08-06T00:00:00Z",
  });
  // project records the chosen style id + its lock prompt
  assert.equal(m.project.character_style?.id, "claymation");
  assert.match(m.project.character_style?.prompt ?? "", /CLAYMATION STYLE LOCK/);
  // every board image prompt renders in that medium (not photoreal)
  assert.match(m.shots[0]?.storyboard_prompt ?? "", /CLAYMATION STYLE LOCK/);
  assert.doesNotMatch(m.shots[0]?.storyboard_prompt ?? "", /photoreal film frame/);
  // and the Veo video prompt carries the same style lock
  assert.match(String(m.shots[0]?.video_prompt ?? ""), /CLAYMATION STYLE LOCK/);
});

test("photoreal representation adds NO style lock (board stays photoreal)", () => {
  const m = buildNanoFlowManifest(fixture(), {
    characterRepresentation: "uploaded_photoreal",
    characterStylePrompt: "should be ignored for photoreal media",
  });
  assert.equal(m.project.character_style, undefined);
  assert.doesNotMatch(m.shots[0]?.storyboard_prompt ?? "", /should be ignored/);
});

test("project carries a viral thumbnail prompt (clickbait, headline + cast + wardrobe sheets)", () => {
  const m = buildNanoFlowManifest(fixture(), { productNames: ["Trà Bắc"] });
  const raw = m.project.thumbnail_prompt;
  assert.ok(typeof raw === "string" && raw.length > 0);
  const t = JSON.parse(raw as string);
  // viral thumbnail contract
  assert.equal(t.type, "photoreal_viral_thumbnail");
  assert.equal(t.aspect, "9:16 vertical");
  // exact headline text must be carried through for the big 3D title
  assert.match(t.headline, /TRÀ BẮC CHÍNH GỐC/);
  // cast comes from the wardrobe sheets (identity-locked), reacting to the hero
  assert.match(t.subjects, /Lan and Minh/);
  assert.match(t.subjects, /wardrobe sheet/i);
  assert.match(t.hero_item, /Trà Bắc/);
});

test("board model — one image per 10s shot; beats never explode into scenes[]", () => {
  const m = buildNanoFlowManifest(fixture());
  const [shot1, shot2] = m.shots;
  assert.ok(shot1 && shot2);
  // The 10s shot no longer fans out into per-beat frames — the video prompt owns
  // how many scenes happen. Exactly ONE location-board image per shot.
  assert.equal(shot1.scenes, undefined);
  assert.equal(shot2.scenes, undefined);
  assert.ok(shot1.storyboard_prompt.length > 0);
  assert.ok(shot2.storyboard_prompt.length > 0);
  // beats[] is still carried through for downstream/audio consumers.
  assert.equal(shot1.beats?.[0]?.beat, "pours tea");
});

test("Cách 1 — locationSets embed the uploaded photo into each assigned shot", () => {
  const m = buildNanoFlowManifest(fixture(), {
    locationSets: [
      { name: "Bếp", images: ["data:image/png;base64,AAAA"], scene_indices: [1] },
      { name: "Dự phòng", images: ["data:image/png;base64,BBBB"], scene_indices: [] },
    ],
  });
  const [s1, s2] = m.shots;
  assert.ok(s1 && s2);
  // shot 1 is explicitly assigned → gets that set's photo…
  assert.equal(s1.board_location_image, "data:image/png;base64,AAAA");
  // …shot 2 is unassigned → falls back to the no-scene set's photo.
  assert.equal(s2.board_location_image, "data:image/png;base64,BBBB");
});

test("Cách 1 — no locationSets ⇒ no embedded photo (app-auto board)", () => {
  const m = buildNanoFlowManifest(fixture());
  assert.equal(m.shots[0]?.board_location_image, undefined);
});

test("board panels come from beats with captions; uploaded photo ⇒ strict setting_authority", () => {
  const bd = {
    title: "Board",
    character_locks: [{ name: "Minh" }],
    segments: [{
      segment_number: 1,
      characters_in_scene: ["Minh"],
      environment_ref: "bep",
      first_frame_prompt: "kitchen",
      motion_prompt: "m",
      full_prompt: "v",
      beats: [
        { beat: "Minh looks worried", camera: "[EYE]" },
        { beat: "close on Minh's face", camera: "[CLOSE]" },
      ],
    }],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const veoClips = [{ background_lock: { setting: "family kitchen" }, character_lock: { A: { name: "Minh" } } }];
  const m = buildNanoFlowManifest(bd, {
    veoClips,
    locationSets: [{ name: "Đoạn 1", images: ["data:image/png;base64,AAAA"], scene_indices: [1] }],
  });
  const kf = JSON.parse(m.shots[0]!.storyboard_prompt) as Record<string, unknown>;
  const panels = kf.panels as Array<Record<string, unknown>>;
  assert.equal(panels.length, 2, "one panel per beat");
  assert.match(String(panels[0]!.caption), /1\. \[EYE\] Minh looks worried/);
  assert.match(String(panels[1]!.caption), /2\. \[CLOSE\]/);
  // an uploaded photo was embedded for this shot → board treats it as mandatory
  assert.match(String(kf.setting_authority), /ATTACHED location photo/);
  assert.match(String(kf.captions), /REQUIRED/);
});

test("no end→start chaining: a later board never says 'continue from previous / do not re-establish'", () => {
  // Two same-location shots — the old continue_from made shot 2 ignore the
  // uploaded location and drift. Boards must now each build independently.
  const bd = {
    title: "NoChain",
    character_locks: [{ name: "Minh" }, { name: "Lan" }],
    segments: [
      { segment_number: 1, characters_in_scene: ["Minh"], environment_ref: "bep",
        first_frame_prompt: "kitchen", motion_prompt: "m1", full_prompt: "v1",
        beats: [{ beat: "Minh sits", camera: "[WIDE]" }] },
      { segment_number: 2, characters_in_scene: ["Lan"], environment_ref: "bep",
        first_frame_prompt: "kitchen", motion_prompt: "m2", full_prompt: "v2",
        beats: [{ beat: "Lan replies", camera: "[CLOSE]" }] },
    ],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const m = buildNanoFlowManifest(bd, {
    veoClips: [
      { background_lock: { setting: "kitchen" }, character_lock: { A: { name: "Minh" } } },
      { background_lock: { setting: "kitchen" }, character_lock: { A: { name: "Lan" } } },
    ],
    locationSets: [{ name: "Đoạn", images: ["data:image/png;base64,AAAA"], scene_indices: [1, 2] }],
  });
  for (const s of m.shots) {
    const kf = JSON.parse(s.storyboard_prompt) as Record<string, unknown>;
    assert.equal(kf.continue_from, undefined, "board must not carry a continue_from chaining clause");
    assert.doesNotMatch(s.storyboard_prompt, /re-establish|continuation of the previous shot/i);
    // and the uploaded location stays the strict authority on every board
    assert.match(String(kf.setting_authority), /ATTACHED location photo/);
  }
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

test("environments are plain assets — no auto A2 plates (board + per-board upload replace them)", () => {
  const m = buildNanoFlowManifest(fixture(), {
    veoClips: [
      {
        background_lock: { setting: "cozy northern living room", lighting: "warm afternoon" },
        visual_style: "documentary realism",
      },
    ],
  });
  const env = (m.assets.environments ?? []).find((e) => e.id === "living_room_1");
  assert.ok(env, "living_room_1 must be declared");
  // The per-shot location board (storyboard_prompt) now locks the setting, so we
  // no longer emit character-free plates that only multiplied the image count.
  assert.equal(env.location_views, undefined);
  assert.equal(env.image, null);
  // The setting the plates used to carry now lives in the shot's location board.
  const board = JSON.parse(m.shots[0]!.storyboard_prompt) as Record<string, unknown>;
  assert.match(String(board.setting), /cozy northern living room/);
  // "custom" locations declare no environment asset.
  assert.equal((m.assets.environments ?? []).some((e) => e.id === "custom"), false);
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

test("style lock keeps a stylized Reality E project out of photoreal", () => {
  const locked = lockStyle("A fox crosses a moonlit bridge", "stylized");
  assert.match(locked, /Reality E stylized/i);
  assert.doesNotMatch(locked, /Strictly photorealistic/i);
  assert.match(locked, /no accidental live-action photoreal conversion/i);
});

test("structured keyframe respects a stylized Reality E context", () => {
  const bd = fixture();
  bd.context_ir = {
    reality_profile: { mode: "stylized" },
  } as unknown as NonNullable<typeof bd.context_ir>;
  const m = buildNanoFlowManifest(bd, {
    veoClips: [
      {
        visual_style: "stylized graphic world",
        background_lock: { setting: "Moonlit bridge" },
        character_lock: {},
        scene_action: { start_state: "A fox waits at the bridge" },
        camera: { framing: "MS", angle: "eye" },
      },
    ],
  });
  const prompt = JSON.parse(m.shots[0]!.storyboard_prompt) as Record<string, unknown>;
  assert.equal(prompt.type, "stylized_storyboard_board");
  assert.match(String(prompt.render), /Reality E.*stylized/i);
  assert.doesNotMatch(String(prompt.render), /real photograph/i);
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

  // storyboard_prompt is now a STRUCTURED (JSON) LOCATION BOARD composed from the
  // clip: a 4-panel layout of one setting, the cast (appearance + wardrobe), the
  // setting pulled from background_lock, a photoreal render note, the reference
  // authority and a negative list.
  const kf = JSON.parse(s1.storyboard_prompt) as Record<string, unknown>;
  assert.equal(kf.type, "photoreal_storyboard_board");
  assert.match(String(kf.layout), /STORYBOARD BOARD/);
  assert.ok(Array.isArray(kf.panels) && (kf.panels as unknown[]).length >= 1);
  assert.match(String(kf.setting), /cozy kitchen at dawn/);
  const cast = kf.cast as Array<Record<string, string>>;
  const minh = cast.find((c) => c.name === "Minh");
  const lan = cast.find((c) => c.name === "Lan");
  assert.ok(minh && lan);
  assert.match(String(minh!.appearance), /Male/);
  assert.match(String(minh!.wardrobe), /grey cotton shirt/);
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

test("withKeyframeAuthority separates wardrobe-sheet (identity) from keyframe (set)", () => {
  const patched = withKeyframeAuthority({ scene_id: "1", output_rules: { audio: "keep" } });
  const rules = patched.output_rules as Record<string, string>;
  // Existing rules survive; the reference-role clause is (re)written.
  assert.equal(rules.audio, "keep");
  const rp = rules.reference_priority;
  // Sheets own face/outfit and must NOT bring their studio backdrop…
  assert.match(rp, /wardrobe sheet/i);
  assert.match(rp, /ignore the sheet's plain studio backdrop|never import a studio/i);
  // …and the location board is the single authority for the environment/set.
  assert.match(rp, /location board/i);
  assert.match(rp, /environment|set and its geometry/i);
});
