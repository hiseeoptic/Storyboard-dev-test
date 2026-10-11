import assert from "node:assert/strict";
import test from "node:test";
import type { Genre, StoryboardGenerationInput } from "../types/index.ts";
import {
  GENRE_PRODUCTION_PROFILES,
  compactGenreScriptDirective,
  compactGenreStoryboardDirective,
  lockGenreProductionProfile,
} from "./genre-production-profiles.ts";

const ALL_GENRES: Genre[] = [
  "action", "comedy", "drama", "horror", "romance", "sci-fi", "thriller",
  "animation", "documentary", "fantasy", "historical", "mythology", "sitcom",
  "mockumentary", "music_video", "kids", "advertising", "product_demo",
  "brand_film", "promo", "unboxing", "luxury", "numerology", "health",
  "psychology", "life_wisdom", "education", "finance", "tech", "cooking",
  "fitness", "lifestyle", "travel", "nature", "sports", "other",
];

function input(overrides: Partial<StoryboardGenerationInput>): StoryboardGenerationInput {
  return {
    story_idea: "A concise test story",
    genre: "drama",
    style: "cinematic",
    scene_count: 3,
    ...overrides,
  };
}

test("registry covers every current app genre with valid defaults", () => {
  assert.deepEqual(Object.keys(GENRE_PRODUCTION_PROFILES).sort(), [...ALL_GENRES].sort());
  for (const genre of ALL_GENRES) {
    const profile = GENRE_PRODUCTION_PROFILES[genre];
    assert.ok(profile.allowed_dialogue_styles.includes("auto"), genre);
    assert.ok(profile.allowed_narrator_styles.includes("auto"), genre);
    assert.ok(profile.allowed_camera_profiles.includes("auto"), genre);
    assert.ok(profile.script_profile.length > 20, genre);
    assert.ok(profile.camera_profile.length > 20, genre);
  }
});

test("action and sports use distinct dialogue, camera and sound directions", () => {
  const action = lockGenreProductionProfile(input({ genre: "action" }));
  const sports = lockGenreProductionProfile(input({ genre: "sports" }));
  assert.equal(action.camera_profile_id, "immersive_action");
  assert.match(action.script_direction, /short|tactical|direct/i);
  assert.equal(sports.camera_profile_id, "broadcast_sports");
  assert.match(sports.voice_direction, /name|score|action|sport/i);
  assert.notEqual(action.camera_direction, sports.camera_direction);
});

test("auto selections resolve to concrete genre defaults before prompt compilation", () => {
  const lock = lockGenreProductionProfile(input({
    genre: "sports",
    dialogue_style_id: "auto",
    narrator_voice_style_id: "auto",
    directing_profile: "auto",
  }));
  assert.equal(lock.dialogue_style_id, "live_commentary");
  assert.equal(lock.narrator_voice_style_id, "sports");
  assert.equal(lock.camera_profile_id, "broadcast_sports");
});

test("a dialogue or camera override supplements instead of erasing genre grammar", () => {
  const lock = lockGenreProductionProfile(input({
    genre: "action",
    dialogue_style_id: "intense",
    directing_profile: "cinematic_drama",
    camera_profile_custom: "One low tracking move during the escape.",
  }));
  assert.match(lock.script_direction, /objective|threat|counteraction/i);
  assert.match(lock.script_direction, /pressure|decisive/i);
  assert.match(lock.camera_direction, /threat distance|screen direction/i);
  assert.match(lock.camera_direction, /low tracking move/i);
});

test("multi-camera selection compiles every selected grammar while keeping a legacy primary id", () => {
  const lock = lockGenreProductionProfile(input({
    genre: "action",
    directing_profile: "aerial_drone",
    directing_profiles: ["aerial_drone", "pov_first_person", "immersive_action"],
  }));
  assert.equal(lock.camera_profile_id, "aerial_drone");
  assert.match(lock.camera_direction, /aerial establishing scale/i);
  assert.match(lock.camera_direction, /first-person eye-line/i);
  assert.match(lock.camera_direction, /threat distance|attack-defence-consequence/i);
  // The user's selection is the camera authority, not an optional palette.
  assert.match(lock.camera_direction, /ONLY these user-selected camera grammars/i);
  assert.doesNotMatch(lock.camera_direction, /allowed palette, not a checklist/i);
});

test("an explicit camera pick leads the direction and the custom note is never truncated", () => {
  const custom = "Always first-person POV from the buyer eye-line, hands only, phone-style handheld, never a tripod, never a face, short punchy reframes on every product touch";
  const lock = lockGenreProductionProfile(input({
    genre: "advertising",
    content_subtype: "affiliate_short",
    directing_profiles: ["pov_first_person", "handheld_vlog"],
    camera_profile_custom: custom,
  }));
  assert.ok(lock.camera_direction.startsWith(custom.slice(0, 40)), lock.camera_direction.slice(0, 80));
  assert.ok(lock.camera_direction.includes(custom));
  const pov = lock.camera_direction.indexOf("first-person eye-line");
  const genre = lock.camera_direction.indexOf("genre context");
  assert.ok(pov >= 0 && genre > pov, "selected grammar precedes genre context");
});

test("product-only shoot replaces the people-centric affiliate arc and camera", () => {
  const lock = lockGenreProductionProfile(input({
    genre: "advertising",
    content_subtype: "affiliate_short",
    story_idea: "Quảng cáo đồng hồ nam Orient",
    product_shoot: { presence: "product_only", style: "dark_reveal", category: "auto" },
  }));
  assert.match(lock.script_direction, /product-only film/i);
  assert.doesNotMatch(lock.script_direction, /user problem/i);
  assert.match(lock.camera_direction, /Reveal from darkness/i);
  assert.doesNotMatch(lock.camera_direction, /hand-to-product/i);
  assert.match(lock.sound_direction, /ticking/i);
  const people = lockGenreProductionProfile(input({
    genre: "advertising",
    content_subtype: "affiliate_short",
    product_shoot: { presence: "with_characters", style: "light_sweep", category: "watch" },
  }));
  assert.match(people.script_direction, /problem to solution/i);
  assert.match(people.camera_direction, /product inserts use the Light sweep style/i);
});

test("advertising subtypes compile different production grammar", () => {
  const emotional = lockGenreProductionProfile(input({
    genre: "advertising",
    content_subtype: "emotional_brand_film",
  }));
  const direct = lockGenreProductionProfile(input({
    genre: "advertising",
    content_subtype: "direct_response",
  }));
  assert.match(emotional.script_direction, /human value|emotional/i);
  assert.match(direct.script_direction, /pain|proof|action/i);
  assert.notEqual(emotional.edit_rhythm, direct.edit_rhythm);
});

test("advanced voice settings stay compact and preserve relative controls", () => {
  const lock = lockGenreProductionProfile(input({
    genre: "health",
    voice_performance: {
      role: "expert",
      relative_pitch: "low",
      pace: "medium",
      target_wpm: 118,
      energy: "restrained",
      variation: "natural",
      articulation: "clear",
      pause_style: "natural",
      emphasis: "keywords",
      pronunciation_guide: "HbA1c = H-B-A-one-C",
    },
  }));
  assert.match(lock.voice_direction, /relative_pitch=low/);
  assert.match(lock.voice_direction, /target_wpm=118/);
  assert.match(lock.voice_direction, /HbA1c/);
  assert.ok(lock.voice_direction.length < 1000);
});

test("compiled prompt directives remain concise", () => {
  const project = input({ genre: "advertising", content_subtype: "product_demonstration" });
  const scriptDirective = compactGenreScriptDirective(project);
  assert.ok(scriptDirective.length < 700);
  assert.match(scriptDirective, /SOFT GENRE LENS/);
  assert.match(scriptDirective, /Story truth.*outrank genre convention/);
  assert.ok(compactGenreStoryboardDirective(project).length < 1400);
});
