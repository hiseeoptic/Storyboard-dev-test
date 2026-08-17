import assert from "node:assert/strict";
import test from "node:test";
import { buildNanoFlowManifest, lockStyle, slugify, withKeyframeAuthority } from "./manifest.ts";
import { validateProductionPromptAuthority } from "../validation/production-authority-validator.ts";
import {
  STYLIZED_CHARACTER_REPRESENTATIONS,
  characterWorldStylePrompt,
} from "../creative-routing/profiles.ts";
import { validatePromptExports } from "../validation/prompt-validator.ts";

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
  assert.equal(m.project.production_prompt_language, "English");
  assert.equal(m.project.dialogue_language, "Vietnamese");
  assert.equal(m.project.thumbnail_title, "TRÀ BẮC CHÍNH GỐC");
  assert.equal(m.shots[0]?.continuity_mode, "opening");
  assert.equal(m.shots[1]?.continuity_mode, "continuous");
});

test("square video delivery remains 1:1 while every storyboard board remains 16:9", () => {
  const m = buildNanoFlowManifest(fixture(), { aspectRatio: "1:1" });
  assert.equal(m.project.aspect_ratio, "1:1");
  assert.equal(m.project.board_aspect_ratio, "16:9");
  for (const shot of m.shots) {
    const board = JSON.parse(shot.storyboard_prompt) as { layout?: string };
    assert.match(board.layout ?? "", /16:9 STORYBOARD BOARD/);
  }
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

test("anonymous stylized boards omit real-person reference authority and demographics", () => {
  const m = buildNanoFlowManifest(fixture(), {
    characterRepresentation: "whiteboard_stick_figure",
    characterStylePrompt: characterWorldStylePrompt("whiteboard_stick_figure"),
    anonymousNarration: true,
    veoClips: [{
      scene_id: "1",
      character_lock: {
        CHAR_1: {
          name: "Người đi chậm",
          design_markers: "thin black line figure; blue shoe accent",
          signature_marker: "blue shoes",
          wardrobe_or_role_marker: "blue shoe accent",
        },
      },
      background_lock: { name: "Đường chạy", setting: "illustrated running route" },
      scene_action: { start_state: "at the line", motion: "ties a lace", end_state: "knot secured" },
      output_rules: {},
    }],
  });
  const board = JSON.parse(m.shots[0]!.storyboard_prompt) as Record<string, unknown>;
  assert.doesNotMatch(String(board.reference_authority), /real person's face|skin|real place/i);
  assert.match(String(board.reference_authority), /stylized identity/i);
  assert.doesNotMatch(JSON.stringify(board.cast), /Male|Female|early thirties|skin texture/i);
  assert.match(JSON.stringify(board.cast), /blue shoe accent/i);
});

test("all ten named video styles lock characters and script-derived worlds across every export surface", () => {
  const tenNamedStyles = STYLIZED_CHARACTER_REPRESENTATIONS.filter((style) =>
    /^(whiteboard|hand_drawn|flat_2d|chibi|cinematic_cartoon|comic_book|layered_paper|claymation|low_poly|semi_realistic)/.test(style)
  );
  assert.equal(tenNamedStyles.length, 10);
  for (const representation of tenNamedStyles) {
    const stylePrompt = characterWorldStylePrompt(representation);
    assert.match(stylePrompt, /MOTION GRAMMAR/);
    const m = buildNanoFlowManifest(fixture(), {
      characterRepresentation: representation,
      characterStylePrompt: stylePrompt,
      generatedAt: "2026-08-15T00:00:00Z",
      veoClips: [{
        scene_id: "1",
        duration_sec: 10,
        location_id: "living_room_1",
        continuity_mode: "opening",
        visual_style: "Photoreal premium commercial",
        negative_prompt: "NOT cartoon, real photograph",
        character_lock: { CHAR_1: { name: "Lan" } },
        background_lock: {
          setting: "An outdoor running track from the script",
          scenery: "start line, rough road and distant sunrise",
          lighting: "daylight",
        },
        scene_bible_tokens: {},
        scene_action: { start_state: "Lan at the line", motion: "Lan runs", end_state: "Lan continues" },
        camera: { framing: "wide" },
        foley_and_ambience: {},
        audio_transition: {},
        output_rules: {},
      }],
    });
    const board = JSON.parse(m.shots[0]!.storyboard_prompt) as Record<string, unknown>;
    const video = m.shots[0]!.video_prompt as Record<string, unknown>;
    const location = JSON.parse(m.assets.environments?.[0]?.location_sheet_prompt ?? "{}") as Record<string, unknown>;
    const thumbnail = JSON.parse(m.project.thumbnail_prompt ?? "{}") as Record<string, unknown>;
    assert.match(String(board.render), /SCRIPT-DERIVED WORLD AUTHORITY/);
    assert.equal(board.visual_style, stylePrompt);
    assert.equal(video.visual_style, stylePrompt);
    assert.match(String((video.output_rules as Record<string, unknown>).character_style_lock), /SCRIPT-DERIVED WORLD AUTHORITY/);
    assert.equal(location.render, stylePrompt);
    assert.equal(thumbnail.render, stylePrompt);
    assert.doesNotMatch(String(video.negative_prompt), /NOT cartoon|real photograph/i);
    const styleFindings = validatePromptExports(m).findings.filter((finding) =>
        ["STYLE-005", "STYLE-006"].includes(finding.code)
      );
    assert.equal(styleFindings.length, 0, `${representation}: ${JSON.stringify(styleFindings)}`);
  }
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

test("board-to-board handoff: a same-location later board continues from the previous board's last frame, uploaded location still strict", () => {
  // Two same-location shots. The user wants frame 1 of board 2 to be the handoff
  // from board 1's last frame — WHILE the uploaded location stays the authority.
  const bd = {
    title: "Chain",
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
      { background_lock: { setting: "kitchen" }, scene_action: { end_state: "Minh seated at the table" }, character_lock: { A: { name: "Minh" } } },
      { background_lock: { setting: "kitchen" }, character_lock: { A: { name: "Lan" } } },
    ],
    locationSets: [{ name: "Đoạn", images: ["data:image/png;base64,AAAA"], scene_indices: [1, 2] }],
  });
  const b1 = JSON.parse(m.shots[0]!.storyboard_prompt) as Record<string, unknown>;
  const b2 = JSON.parse(m.shots[1]!.storyboard_prompt) as Record<string, unknown>;
  // Board 1 is the opening — no handoff.
  assert.equal(b1.continue_from_previous, undefined);
  // Board 2 (same location) DOES hand off from board 1's last frame.
  assert.ok(typeof b2.continue_from_previous === "string");
  assert.match(String(b2.continue_from_previous), /BOARD-TO-BOARD HANDOFF/);
  assert.match(String(b2.continue_from_previous), /Minh seated at the table/);
  // The uploaded location photo stays the strict setting authority on BOTH boards.
  for (const s of m.shots) {
    const kf = JSON.parse(s.storyboard_prompt) as Record<string, unknown>;
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

test("manifest character assets reuse stable registry IDs when display names share one slug", () => {
  const bd = {
    title: "Stable IDs",
    total_duration_seconds: 10,
    character_locks: [
      { name: "Đặng", display_name: "Đặng" },
      { name: "Dang", display_name: "Dang" },
    ],
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      characters_in_scene: ["Đặng", "Dang"],
      environment_ref: "studio",
      first_frame_prompt: "Đặng and Dang stand apart in the studio.",
      motion_prompt: "They exchange a greeting.",
      full_prompt: "Đặng and Dang exchange a greeting.",
    }],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const m = buildNanoFlowManifest(bd);
  const ids = (m.assets.characters ?? []).map((character) => character.id);
  assert.equal(new Set(ids).size, 2);
  assert.deepEqual(ids, ["char_dang", "char_dang_2"]);
  assert.deepEqual(m.shots[0]!.image_refs?.characters, ids);
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

test("environments carry a 2-angle character-free LOCATION SHEET (location_views)", () => {
  const m = buildNanoFlowManifest(fixture(), {
    veoClips: [
      {
        background_lock: {
          setting: "cozy northern living room",
          scenery: "carved wooden furniture",
          lighting: "warm afternoon",
        },
        visual_style: "documentary realism",
      },
    ],
  });
  const env = (m.assets.environments ?? []).find((e) => e.id === "living_room_1");
  assert.ok(env, "living_room_1 must be declared");
  // New extensions prefer one 16:9 two-panel sheet. Keep the legacy two-view
  // pair as a compatibility fallback for already-installed extension versions.
  const locationSheet = JSON.parse(env.location_sheet_prompt ?? "{}") as Record<string, unknown>;
  assert.equal(locationSheet.output_count, 1);
  assert.equal(locationSheet.aspect_ratio, "16:9");
  assert.match(String(locationSheet.panel_2), /90-135|opposite/i);
  assert.equal(env.image, null);
  // The app now emits a SINGLE character-free location sheet image (overview +
  // right→left + left→right), so the extension generates each set ONCE and locks
  // every board/video to it — the user's "tạo sheet bối cảnh" approach (one image).
  assert.ok(Array.isArray(env.location_views) && env.location_views.length === 1);
  assert.deepEqual((env.location_views ?? []).map((v) => v.angle), ["sheet"]);
  const sheet = JSON.parse((env.location_views ?? [])[0]!.prompt) as Record<string, unknown>;
  // The sheet uses the per-location LOCKED setting so it matches the boards.
  assert.match(String(sheet.setting), /cozy northern living room/);
  // Character-free: the negative must forbid people in the sheet.
  assert.match(String(sheet.negative), /no people/i);
  // Three framings in ONE image (overview + right→left + left→right).
  assert.match(String(sheet.layout), /overview/i);
  assert.match(String(sheet.layout), /right-to-left/i);
  assert.match(String(sheet.layout), /left-to-right/i);
  // The setting also still lives in the shot's location board (unchanged).
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
  assert.match(String(shot1.video_prompt), /^veo prompt 1/);
  assert.match(String(shot1.video_prompt), /PRODUCTION_STATE_AUTHORITY/);
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
  assert.ok(rp);
  // Sheets own face/outfit and must NOT bring their studio backdrop…
  assert.match(rp, /wardrobe sheet/i);
  assert.match(rp, /ignore the sheet's plain studio backdrop|never import a studio/i);
  // …and the location board is the single authority for the environment/set.
  assert.match(rp, /location board/i);
  assert.match(rp, /environment|set and its geometry/i);
});

test("Production State authority flows script -> video prompt -> storyboard board", () => {
  const bd = {
    title: "Authority",
    total_duration_seconds: 10,
    character_locks: [{ name: "Lan", costume: "cream blouse" }],
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      characters_in_scene: ["Lan"],
      environment_ref: "kitchen",
      first_frame_prompt: "Lan stands beside the tea table at dawn.",
      motion_prompt: "Lan lifts the teapot and pours one cup.",
      full_prompt: "Lan pours tea, then returns the teapot to the table.",
      beats: [{ beat: "Lan lifts the teapot", camera: "[MEDIUM]" }],
    }],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const m = buildNanoFlowManifest(bd, {
    beatsPerSegment: 3,
    veoClips: [{
      scene_id: "1",
      character_lock: { LAN: { name: "Lan", outfit_top: "cream blouse" } },
      background_lock: { setting: "tea kitchen at dawn", lighting: "soft dawn light" },
      scene_action: {
        start_state: "Lan stands beside the tea table with the teapot resting on it.",
        ordered_action: "Lan lifts the teapot and pours one cup.",
        end_state: "Lan returns the teapot to its original place on the table.",
      },
      camera: { framing: "medium", movement: "slow push-in" },
    }],
  });
  const shot = m.shots[0]!;
  const authority = shot.state_authority!;
  const video = shot.video_prompt as Record<string, unknown>;
  const board = JSON.parse(shot.storyboard_prompt) as Record<string, unknown>;
  const videoAuthority = video.production_state_authority as Record<string, unknown>;
  const dialogueAudio = video.dialogue_audio_contract as Record<string, unknown>;

  assert.ok(m.production_state);
  assert.deepEqual(authority.authority_order, [
    "script",
    "production_state",
    "video_prompt",
    "storyboard_board",
  ]);
  assert.equal(video.scene_id, "1", "original structured video fields survive");
  assert.equal(videoAuthority.authority_fingerprint, authority.authority_fingerprint);
  assert.equal(dialogueAudio.authority_fingerprint, authority.authority_fingerprint);
  // Dialogue text lives only in the structured video's canonical dialogue rows
  // and once in manifest.production_state. The compact contract points to that
  // canonical state without embedding a second spoken copy.
  const canonicalShot = m.production_state!.shots[0]!;
  assert.equal(dialogueAudio.dialogue_state, undefined);
  assert.deepEqual(dialogueAudio.dialogue_turn_ids, canonicalShot.dialogue_state.turns.map((turn) => turn.turn_id));
  assert.match(String(dialogueAudio.canonical_dialogue_path), /production_state\.shots\[0\]\.dialogue_state/);
  assert.deepEqual(dialogueAudio.audio_state, canonicalShot.audio_state);
  assert.equal(board.authority_fingerprint, authority.authority_fingerprint);
  assert.match(String(board.semantic_authority), /STATIC VISUAL PROJECTION/);
  assert.match(String((video.output_rules as Record<string, unknown>).semantic_priority), /storyboard image is downstream/i);
  assert.equal((board.panels as unknown[]).length, 3, "selected panel count is exact");
  assert.deepEqual(
    (board.video_prompt_projection as Record<string, unknown>).scene_action,
    video.scene_action,
    "board projects the primary video action contract verbatim"
  );
});

test("authority validator detects a storyboard/video fingerprint mismatch", () => {
  const bd = {
    title: "Mismatch",
    total_duration_seconds: 10,
    character_locks: [{ name: "Minh" }],
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      characters_in_scene: ["Minh"],
      environment_ref: "office",
      first_frame_prompt: "Minh sits at a desk.",
      motion_prompt: "Minh opens the notebook.",
      full_prompt: "Minh opens the notebook and reads the first page.",
    }],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const m = buildNanoFlowManifest(bd, {
    veoClips: [{
      character_lock: { MINH: { name: "Minh" } },
      background_lock: { setting: "quiet office" },
      scene_action: { start_state: "Minh sits at a desk", end_state: "the notebook is open" },
      dialogue: [{
        turn_id: "1_turn_001",
        speaker_id: "char_minh",
        speaker_name: "Minh",
        voice_personality: "Minh stable voice",
        text: "Bắt đầu thôi.",
        utterance_count: 1,
        repeat_policy: "exactly_once",
      }],
    }],
  });
  assert.equal(
    validateProductionPromptAuthority(m).findings.length,
    0,
    "freshly compiled manifest has one consistent authority"
  );

  const board = JSON.parse(m.shots[0]!.storyboard_prompt) as Record<string, unknown>;
  board.authority_fingerprint = "psa_tampered";
  m.shots[0]!.storyboard_prompt = JSON.stringify(board);
  const report = validateProductionPromptAuthority(m);
  assert.ok(report.findings.some((finding) => finding.code === "AUTH-004"));

  board.authority_fingerprint = m.shots[0]!.state_authority!.authority_fingerprint;
  (board.panels as Array<Record<string, unknown>>)[0]!.action = "Minh suddenly flies away";
  m.shots[0]!.storyboard_prompt = JSON.stringify(board);
  const actionReport = validateProductionPromptAuthority(m);
  assert.ok(actionReport.findings.some((finding) => finding.code === "AUTH-010"));
});

// Regression: manifest payload is deduplicated (see state-authority.ts).
// B2 — the per-shot state_authority is SLIM: it keeps the authority essentials
// but drops the heavy canonical snapshots (they live once at production_state).
// B1 — the IMAGE board drops dialogue/audio (a still frame never uses them),
// while the VIDEO prompt keeps them for lip-sync/timing.
test("manifest deduplicates per-shot authority and strips audio from the image board", () => {
  const bd = {
    title: "Payload",
    total_duration_seconds: 10,
    character_locks: [{ name: "Minh" }],
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      characters_in_scene: ["Minh"],
      environment_ref: "office",
      first_frame_prompt: "Minh sits at a desk.",
      motion_prompt: "Minh opens the notebook.",
      full_prompt: "Minh opens the notebook and reads.",
      dialogue_lines: [{ speaker: "Minh", text: "Bắt đầu thôi.", start_s: 0, end_s: 2 }],
    }],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const m = buildNanoFlowManifest(bd, {
    veoClips: [{
      character_lock: { MINH: { name: "Minh" } },
      background_lock: { setting: "quiet office" },
      scene_action: { start_state: "Minh sits at a desk", end_state: "the notebook is open" },
      dialogue: [{
        turn_id: "1_turn_001",
        speaker_id: "char_minh",
        speaker_name: "Minh",
        voice_personality: "Minh stable voice",
        text: "Bắt đầu thôi.",
        utterance_count: 1,
        repeat_policy: "exactly_once",
      }],
    }],
  });
  const shot = m.shots[0]!;
  const authority = shot.state_authority as Record<string, unknown>;

  // B2: slim per-shot authority keeps the essentials…
  assert.ok(authority.authority_fingerprint);
  assert.ok(authority.script_contract);
  assert.ok(Array.isArray(authority.actions));
  // …and drops the heavy canonical fields (no per-shot duplication).
  assert.equal(authority.start_snapshot, undefined);
  assert.equal(authority.end_snapshot, undefined);
  assert.equal(authority.dialogue_state, undefined);
  // The full canonical shot state still lives once at production_state.shots[i].
  assert.ok(m.production_state!.shots[0]!.start_snapshot);
  assert.ok(m.production_state!.shots[0]!.dialogue_state);

  // B1: the image board carries the state projection but WITHOUT dialogue/audio…
  const board = JSON.parse(shot.storyboard_prompt) as Record<string, unknown>;
  const boardAuthority = board.production_state_authority as Record<string, unknown>;
  assert.ok(boardAuthority.start_snapshot, "board keeps the physical projection");
  assert.equal(boardAuthority.dialogue_state, undefined);
  assert.equal(boardAuthority.audio_state, undefined);
  // …while the video prompt keeps exactly one Veo-facing dialogue row.
  const video = shot.video_prompt as Record<string, unknown>;
  const videoAuthority = video.production_state_authority as Record<string, unknown>;
  assert.equal(videoAuthority.dialogue_state, undefined, "video pointer does not duplicate dialogue_state");
  assert.ok(videoAuthority.canonical_manifest_path);
  const dialogueContract = video.dialogue_audio_contract as Record<string, unknown>;
  assert.equal(dialogueContract.dialogue_state, undefined);
  assert.deepEqual(dialogueContract.dialogue_turn_ids, ["shot_001_turn_001"]);
  assert.equal(shot.dialogue, null, "legacy shot field cannot cause an extension to append the line again");
  const occurrences = JSON.stringify(video).split("Bắt đầu thôi.").length - 1;
  assert.equal(occurrences, 1, "the exact spoken line occurs once in the serialized Veo prompt");
});

test("board prompt enforces numbered panels, one border system and a separate thumbnail aspect", () => {
  const bd = {
    title: "Gift",
    thumbnail_title: "MÓN QUÀ NÀY?!",
    total_duration_seconds: 10,
    character_locks: [{ name: "Lan" }, { name: "Minh" }],
    segments: [{
      segment_number: 1,
      duration_seconds: 10,
      characters_in_scene: ["Lan", "Minh"],
      location_id: "living_room",
      environment_ref: "living_room",
      first_frame_prompt: "A gift box rests on the coffee table.",
      motion_prompt: "Lan opens the box and lifts the red bag.",
      full_prompt: "Lan opens the box and lifts the red bag while Minh watches.",
      beats: [
        { beat: "Lan reaches for the box", camera: "slow push-in" },
        { beat: "Lan lifts the red bag", camera: "[OTS] behind Minh, focus Lan and bag" },
      ],
      state_ledger: {
        start: [{ entity_id: "gift", state: "closed", position: "on coffee table" }],
        changes: [],
        end: [{ entity_id: "gift", state: "open", position: "on coffee table" }],
      },
    }],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const m = buildNanoFlowManifest(bd, { beatsPerSegment: 2, aspectRatio: "16:9", thumbnailAspectRatio: "9:16" });
  const board = JSON.parse(m.shots[0]!.storyboard_prompt) as Record<string, unknown>;
  const panels = board.panels as Array<Record<string, unknown>>;

  assert.equal(m.project.thumbnail_aspect_ratio, "9:16");
  assert.equal(m.project.board_aspect_ratio, "16:9");
  assert.match(String(board.frame_order_contract), /TOP-LEFT CORNER INSIDE EVERY panel/);
  assert.match(String(board.layout), /uniform thin solid black dividers/);
  assert.deepEqual(panels.map((panel) => panel.order_label), ["1", "2"]);
  assert.match(String(panels[0]!.camera), /^\[MEDIUM\]/);
  assert.match(String(board.consistency), /gift/i);
  const cardinality = board.character_cardinality_contract as Record<string, unknown>;
  assert.deepEqual(
    (cardinality.identities as Array<Record<string, unknown>>).map((identity) => [
      identity.name,
      identity.maximum_instances_per_panel,
    ]),
    [["Lan", 1], ["Minh", 1]]
  );
  assert.match(String(board.body_visibility_contract), /Never render a hand-only/);
  assert.ok(board.placement_continuity_contract);
  assert.deepEqual(panels[0]!.expected_character_instances, { Lan: 1, Minh: 0 });
});

// Regression: the BOARD image is always 16:9 (a wide sheet describes the cast
// best → best video), while the VIDEO aspect follows the app's selection —
// including 1:1. The two are independent so the board never comes out portrait.
test("manifest fixes the board to 16:9 while the video aspect follows the selection", () => {
  for (const aspect of ["16:9", "9:16", "1:1"] as const) {
    const m = buildNanoFlowManifest(fixture(), { aspectRatio: aspect, generatedAt: "2026-01-01T00:00:00Z" });
    assert.equal(m.project.board_aspect_ratio, "16:9", `board stays 16:9 for video ${aspect}`);
    assert.equal(m.project.aspect_ratio, aspect, `video aspect is ${aspect}`);
  }
});

test("manifest preserves the independent speech contract without duplicating prompt prose", () => {
  const speechContract = {
    mode: "mixed" as const,
    voice_over_enabled: true,
    character_dialogue_enabled: true,
    anonymous_characters: false,
    narrator_voice_style: "warm, measured, reflective",
    character_dialogue_style: "natural everyday turn-taking",
    music_enabled: true,
    ambience_enabled: true,
    foley_enabled: true,
  };
  const m = buildNanoFlowManifest(fixture(), { speechContract });
  assert.deepEqual(m.project.speech_contract, speechContract);
});

// Regression: boards of the SAME location must not drift set or day↔night on later
// boards. Setting/scenery lock to the first clip of the location; time-of-day is
// MONOTONIC (day→night, never oscillating); every board carries an establishing-view
// contract (≥1 wide panel); a same-location later board hands off from the previous.
test("boards lock one set per location; time-of-day is monotonic; same-location boards hand off", () => {
  const seg = (n: number, mode: string) => ({
    segment_number: n, duration_seconds: 10, title: `S${n}`, marketing_role: "body",
    beats: [{ beat: "talk", camera: "[CLOSE] face" }],
    first_frame_prompt: "scene", motion_prompt: "talk", dialogue: null,
    characters_in_scene: ["Lan", "Minh"], location_id: "loc1", continuity_note: "",
    transition_in: { mode },
  });
  const bd = {
    title: "T", total_duration_seconds: 30,
    character_locks: [{ name: "Lan", costume: "sweater" }, { name: "Minh", costume: "shirt" }],
    segments: [seg(1, "opening"), seg(2, "continuous"), seg(3, "scene_cut")],
  } as unknown as Parameters<typeof buildNanoFlowManifest>[0];
  const clip = (setting: string, lighting: string, endState: string) => ({
    location_id: "loc1",
    background_lock: { setting, scenery: setting, lighting },
    scene_action: { end_state: endState },
  });
  const m = buildNanoFlowManifest(bd, {
    veoClips: [
      clip("living room with beige sofa", "warm daylight, bright", "Lan holds the red bag"),
      clip("kitchen at night", "dim night lamp", "Minh looks at the bag"),
      clip("dining room morning", "cool morning", "end3"),
    ] as unknown as Array<Record<string, unknown>>,
    generatedAt: "2026-01-01T00:00:00Z",
  });
  const boards = m.shots.map((s) => JSON.parse(s.storyboard_prompt) as Record<string, unknown>);
  // All boards of loc1 lock to the FIRST clip's SETTING (same room, no drift).
  assert.equal(boards[0]!.setting, "living room with beige sofa");
  assert.equal(boards[1]!.setting, "living room with beige sofa");
  assert.equal(boards[2]!.setting, "living room with beige sofa");
  // Day↔night is MONOTONIC: day → night, and the 3rd shot's "morning" is clamped
  // FORWARD to night (never day→night→day). The clamped shot drops its stale
  // "cool morning" lighting and shows the locked night look.
  assert.equal(boards[0]!.time_of_day, "daytime");
  assert.equal(boards[1]!.time_of_day, "night");
  assert.equal(boards[2]!.time_of_day, "night");
  assert.match(String(boards[1]!.lighting), /^night: /);
  assert.match(String(boards[1]!.lighting), /dim night lamp/);
  assert.doesNotMatch(String(boards[2]!.lighting), /morning/i);
  // Establishing view contract on every board.
  assert.ok(boards.every((b) => typeof b.establishing_view_contract === "string" && (b.establishing_view_contract as string).includes("WIDE")));
  // Board-to-board handoff on every same-location later board (index 1 AND 2), not
  // on the opening (index 0). Even a scene_cut within the same set chains now.
  assert.equal(boards[0]!.continue_from_previous, undefined);
  assert.ok(typeof boards[1]!.continue_from_previous === "string" && (boards[1]!.continue_from_previous as string).includes("red bag"));
  assert.ok(typeof boards[2]!.continue_from_previous === "string" && (boards[2]!.continue_from_previous as string).includes("Minh looks at the bag"));
});
