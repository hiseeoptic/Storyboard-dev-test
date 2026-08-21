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
