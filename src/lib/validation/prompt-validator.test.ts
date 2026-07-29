import assert from "node:assert/strict";
import test from "node:test";
import { validatePromptExports } from "./prompt-validator.ts";

type Manifest = Parameters<typeof validatePromptExports>[0];

// A clean image (keyframe) prompt — the shape buildKeyframePromptFromClip emits.
function imagePrompt(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "photoreal_keyframe",
    render: "Photorealistic cinematic film still, shot on a professional cinema camera.",
    setting: "A sunlit kitchen with a wooden table",
    cast: [
      { name: "Minh", appearance: "male, ~32", wardrobe: "blue polo shirt, grey trousers" },
      { name: "Lan", appearance: "female, ~30", wardrobe: "white tee, patterned apron" },
    ],
    placement: "Minh left, Lan right",
    negative: "NOT cartoon, NOT anime, NOT illustration.",
    ...over,
  });
}

// A clean video (Veo) clip — the shape buildVeoJson + withKeyframeAuthority emit.
function videoClip(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    scene_id: "1",
    duration_sec: 10,
    location_id: "home_kitchen",
    continuity_mode: "opening",
    visual_style: "warm cinematic; 50mm lens; neutral Rec.709",
    scene_bible_tokens: {
      lens: "50mm lens",
      color_grade: "neutral Rec.709",
      lighting: "soft window light",
      backdrop: "tiled walls, open shelving",
      audio_bed: "quiet kitchen room tone",
    },
    character_lock: {
      CHAR_1: { name: "Minh", voice_personality: "warm timbre, 90-130 Hz, 110 wpm" },
      CHAR_2: { name: "Lan", voice_personality: "clear timbre, 180-240 Hz, 120 wpm" },
    },
    background_lock: {
      name: "Home kitchen",
      setting: "A sunlit kitchen with a wooden table",
      scenery: "tiled walls, open shelving",
      lighting: "soft window light",
    },
    spatial_topology: { character_placement: "Minh left facing Lan; Lan right facing Minh" },
    scene_action: { start_state: "Minh sits across from Lan", motion: "they talk", end_state: "silence holds" },
    camera: { framing: "MS", angle: "eye" },
    foley_and_ambience: {
      environment_sound_bed: "quiet kitchen room tone",
      ambience: ["quiet kitchen room tone"],
    },
    output_rules: { reference_priority: "START-FRAME AUTHORITY: continue wardrobe and set from the start frame." },
    ...over,
  };
}

function cleanManifest(): Manifest {
  return {
    manifest_version: "1.0",
    generator: "storyboard-ai",
    project: { title: "Demo" },
    assets: { characters: [], environments: [], products: [] },
    shots: [
      {
        shot_id: "SHOT_001",
        index: 1,
        storyboard_name: "Demo 1",
        storyboard_prompt: imagePrompt(),
        video_prompt: videoClip(),
        characters_in_scene: ["Minh", "Lan"],
        location_id: "home_kitchen",
        continuity_mode: "opening",
      },
    ],
  } as unknown as Manifest;
}

test("a clean manifest passes the prompt gate with zero findings", () => {
  const r = validatePromptExports(cleanManifest());
  assert.equal(r.counts.total, 0, JSON.stringify(r.findings, null, 2));
  assert.equal(r.ok, true);
});

// ── Lazy-paste (ported from veoflow-web) ────────────────────────────────────
test("LAZY-001: a 'same as before' shorthand in the image prompt flags", () => {
  const m = cleanManifest();
  m.shots[0]!.storyboard_prompt = imagePrompt({ setting: "same as before" });
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "LAZY-001"));
});

// ── Image prompt ────────────────────────────────────────────────────────────
test("IMG-001: an image prompt without a photoreal lock flags", () => {
  const m = cleanManifest();
  m.shots[0]!.storyboard_prompt = imagePrompt({ render: "a nice picture", negative: "no text" });
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "IMG-001" && f.severity === "high"));
});

test("IMG-001: a declared stylized medium does not get forced into photoreal", () => {
  const m = cleanManifest();
  m.shots[0]!.storyboard_prompt = imagePrompt({
    type: "stylized_keyframe",
    render: "Stylized 3D animation with one locked graphic medium",
    negative: "no text, no medium drift",
  });
  const r = validatePromptExports(m);
  assert.equal(
    r.findings.some((f) => f.code === "IMG-001"),
    false,
    JSON.stringify(r.findings, null, 2)
  );
});

test("IMG-002: a cast member with no pinned wardrobe flags (advisory)", () => {
  const m = cleanManifest();
  m.shots[0]!.storyboard_prompt = imagePrompt({
    cast: [{ name: "Minh", wardrobe: "blue polo" }, { name: "Lan" }],
  });
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "IMG-002" && /Lan/.test(f.message)));
});

test("IMG-003: an empty image setting flags", () => {
  const m = cleanManifest();
  m.shots[0]!.storyboard_prompt = imagePrompt({ setting: "" });
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "IMG-003"));
});

// ── ENV-002 action-leak (only visible on the derived prompt) ─────────────────
test("ENV-002: action leaked into the video background_lock.setting flags", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({
    background_lock: { name: "Kitchen", setting: "Lan smiles at Minh across the table", scenery: "tiles" },
  });
  const r = validatePromptExports(m);
  const f = r.findings.find((x) => x.code === "ENV-002");
  assert.ok(f, "expected ENV-002");
  assert.match(f!.message, /action/);
});

test("ENV-002: a pronoun-led background is caught; a static set is not", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({
    background_lock: { name: "Kitchen", setting: "He leans forward over the counter", scenery: "tiles" },
  });
  assert.ok(validatePromptExports(m).findings.some((f) => f.code === "ENV-002"));

  // A static set with words like "walkway" / "standing lamp" must NOT trigger.
  const clean = cleanManifest();
  clean.shots[0]!.video_prompt = videoClip({
    background_lock: { name: "Lobby", setting: "A marble walkway with a tall standing lamp", scenery: "glass" },
  });
  assert.ok(!validatePromptExports(clean).findings.some((f) => f.code === "ENV-002"));
});

// ── Video prompt structure ──────────────────────────────────────────────────
test("VID-001: a clip with no background setting flags", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({ background_lock: { name: "x", setting: "" } });
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "VID-001"));
});

test("VID-002: a 2-character clip with no placement flags", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({ spatial_topology: {} });
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "VID-002"));
});

test("VID-003: cast present but empty character_lock flags", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({ character_lock: {} });
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "VID-003"));
});

test("VID-004: missing keyframe-authority rule is advisory", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({ output_rules: {} });
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "VID-004" && f.severity === "medium"));
});

test("VID-000: a flat-string video prompt is flagged", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = "just a flat prose paragraph";
  const r = validatePromptExports(m);
  assert.ok(r.findings.some((f) => f.code === "VID-000"));
});

// ── Cross image ↔ video ↔ shot ──────────────────────────────────────────────
test("SYNC-001: image and video casts disagreeing flags", () => {
  const m = cleanManifest();
  // video clip only knows Minh; image knows Minh + Lan → drift.
  m.shots[0]!.video_prompt = videoClip({ character_lock: { CHAR_1: { name: "Minh" } } });
  const r = validatePromptExports(m);
  const f = r.findings.find((x) => x.code === "SYNC-001");
  assert.ok(f);
  assert.match(f!.evidence ?? "", /minh/);
});

test("report label reads 'prompt gate'", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({ background_lock: { name: "x", setting: "" } });
  const r = validatePromptExports(m);
  assert.match(r.summary, /prompt gate/);
});

test("DATA-001: duration_sec encoded as a string fails closed", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({ duration_sec: "10" });
  assert.ok(validatePromptExports(m).findings.some((f) => f.code === "DATA-001"));
});

test("BIBLE-002: scene-bible token must appear verbatim in final authority", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({
    scene_bible_tokens: {
      lens: "85mm lens",
      color_grade: "neutral Rec.709",
      lighting: "soft window light",
      backdrop: "tiled walls, open shelving",
      audio_bed: "quiet kitchen room tone",
    },
  });
  assert.ok(validatePromptExports(m).findings.some((f) => f.code === "BIBLE-002"));
});

test("ORDER-001: action placed before identity/style/environment authority fails", () => {
  const m = cleanManifest();
  const clip = videoClip();
  const action = clip.scene_action;
  delete clip.scene_action;
  m.shots[0]!.video_prompt = { scene_action: action, ...clip };
  assert.ok(validatePromptExports(m).findings.some((f) => f.code === "ORDER-001"));
});

test("VOICE-002: compiled dialogue cannot swap a character's voice", () => {
  const m = cleanManifest();
  m.shots[0]!.video_prompt = videoClip({
    dialogue: [
      {
        speaker_id: "CHAR_1",
        speaker_name: "Minh",
        delivery: "on_screen",
        voice_personality: "clear timbre, 180-240 Hz, 120 wpm",
        text: "Xin chào",
      },
    ],
  });
  assert.ok(validatePromptExports(m).findings.some((f) => f.code === "VOICE-002"));
});

test("AUDIO-001: continuous boundary preserves exact location audio bed", () => {
  const m = cleanManifest();
  m.shots.push({
    ...m.shots[0]!,
    shot_id: "SHOT_002",
    index: 2,
    continuity_mode: "continuous",
    video_prompt: videoClip({
      scene_id: "2",
      continuity_mode: "continuous",
      foley_and_ambience: {
        environment_sound_bed: "different room tone",
        ambience: ["different room tone"],
      },
      scene_bible_tokens: {
        lens: "50mm lens",
        color_grade: "neutral Rec.709",
        lighting: "soft window light",
        backdrop: "tiled walls, open shelving",
        audio_bed: "different room tone",
      },
    }),
  });
  assert.ok(validatePromptExports(m).findings.some((f) => f.code === "AUDIO-001"));
});
