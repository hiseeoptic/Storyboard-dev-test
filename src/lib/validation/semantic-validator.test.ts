import assert from "node:assert/strict";
import test from "node:test";
import { validateStoryboardSemantics, formatSemanticReport } from "./semantic-validator.ts";

type Breakdown = Parameters<typeof validateStoryboardSemantics>[0];

// A FULLY valid single-segment breakdown — passes every deterministic check
// (structure, world, temporal, environment, character, cast, continuity,
// dialogue). Individual tests dirty one field at a time.
function cleanFixture(): Breakdown {
  return {
    title: "Bữa cơm",
    total_duration_seconds: 10,
    world_context: {
      world_type: "cinematic realistic",
      time_period: "contemporary daytime",
      environment_category: "home",
    },
    character_locks: [
      { name: "Minh", gender: "male", gender_age: "male, ~32", costume: "blue polo shirt, grey trousers", skin_tone: "warm", hair: "short black", eyes: "brown", voice: "warm grounded male, ~110 wpm" },
      { name: "Lan", gender: "female", gender_age: "female, ~30", costume: "white tee, patterned apron", skin_tone: "light", hair: "long black", eyes: "brown", voice: "gentle female, ~120 wpm" },
    ],
    segments: [
      {
        segment_number: 1,
        duration_seconds: 10,
        marketing_role: "hook",
        first_frame_prompt: "A sunlit kitchen. Minh sits across from Lan at the table.",
        motion_prompt: "Minh looks at Lan with worry.",
        title: "Kitchen tension",
        environment_ref: "kitchen_day",
        characters_in_scene: ["Minh", "Lan"],
        speaker: "Minh",
        continuity_note: "Both seated at the table.",
        beats: [
          { beat: "Minh glances up", camera: "[CU] Minh" },
          { beat: "Lan pauses eating", camera: "[MS] Lan" },
          { beat: "silence holds", camera: "[2S] both" },
        ],
        spatial_layout: { character_placement: "Minh left seat facing Lan; Lan right seat facing Minh" },
      },
    ],
  } as unknown as Breakdown;
}

// A 2-segment fixture for cross-segment (temporal / location / continuity) tests.
function twoSegFixture(): Breakdown {
  const bd = cleanFixture();
  bd.segments.push({
    segment_number: 2,
    duration_seconds: 10,
    marketing_role: "body",
    first_frame_prompt: "The same sunlit kitchen. Minh stands by the counter.",
    motion_prompt: "Minh pours water.",
    title: "By the counter",
    environment_ref: "kitchen_day",
    characters_in_scene: ["Minh"],
    speaker: "Minh",
    continuity_note: "Continues from the table.",
    beats: [{ beat: "Minh rises", camera: "[MS] Minh" }],
  } as unknown as Breakdown["segments"][number]);
  bd.total_duration_seconds = 20; // two 10s clips
  return bd;
}

test("a fully valid breakdown passes with zero findings", () => {
  const r = validateStoryboardSemantics(cleanFixture());
  assert.equal(r.ok, true);
  assert.equal(r.counts.total, 0, formatSemanticReport(r));
  assert.match(formatSemanticReport(r), /no issues/);
});

test("a valid 2-segment breakdown is clean too", () => {
  const r = validateStoryboardSemantics(twoSegFixture());
  assert.equal(r.counts.total, 0, formatSemanticReport(r));
});

// ── Structure & data ────────────────────────────────────────────────────────
test("STRUCT-001: an empty motion_prompt is a critical stub", () => {
  const bd = cleanFixture();
  bd.segments[0]!.motion_prompt = "";
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "STRUCT-001" && x.severity === "critical"));
});

test("STRUCT-003: total_duration mismatch and odd clip length flag", () => {
  const bd = cleanFixture();
  bd.segments[0]!.duration_seconds = 25;
  bd.total_duration_seconds = 10;
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "STRUCT-003"));
});

test("STRUCT-004: an overloaded shot (>6 beats) flags", () => {
  const bd = cleanFixture();
  bd.segments[0]!.beats = Array.from({ length: 8 }, (_, i) => ({ beat: `b${i}`, camera: "[CU]" })) as Breakdown["segments"][number]["beats"];
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "STRUCT-004"));
});

// ── World ───────────────────────────────────────────────────────────────────
test("WORLD-001: a bare world_context flags missing fields", () => {
  const bd = cleanFixture();
  bd.world_context = { time_period: "contemporary daytime" } as Breakdown["world_context"];
  const r = validateStoryboardSemantics(bd);
  const f = r.findings.find((x) => x.code === "WORLD-001");
  assert.ok(f);
  assert.match(f!.evidence ?? "", /world_type/);
});

// ── Temporal (Tầng 4) ───────────────────────────────────────────────────────
test("ENV-003: day + night in the same scene is critical", () => {
  const bd = cleanFixture();
  bd.segments[0]!.first_frame_prompt = "A moonlit kitchen at midnight bathed in broad daylight.";
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "ENV-003" && x.severity === "critical"));
  assert.equal(r.ok, false);
});

test("ENV-003: 'tonight' must not false-trigger the night token", () => {
  const bd = cleanFixture();
  bd.segments[0]!.first_frame_prompt = "Minh says they will cook dinner tonight, in a bright sunlit kitchen.";
  const r = validateStoryboardSemantics(bd);
  assert.ok(!r.findings.some((x) => x.code === "ENV-003"));
});

test("TEMP-001: a day→night flip between adjacent clips is high", () => {
  const bd = twoSegFixture();
  bd.segments[1]!.first_frame_prompt = "The kitchen, now under moonlight at midnight.";
  const r = validateStoryboardSemantics(bd);
  const f = r.findings.find((x) => x.code === "TEMP-001");
  assert.ok(f);
  assert.equal(f!.severity, "high");
});

// ── Environment (Tầng 5) ────────────────────────────────────────────────────
test("ENV-001: a street env used for a restaurant scene is flagged", () => {
  const bd = cleanFixture();
  bd.segments[0]!.environment_ref = "urban_street_day";
  bd.segments[0]!.first_frame_prompt = "Minh and Lan sit inside a busy restaurant.";
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "ENV-001" && /urban_street_day/.test(x.evidence ?? "")));
});

test("ENV-001: a matching archetype does not false-trigger (street-food stall on a street set)", () => {
  const bd = cleanFixture();
  bd.segments[0]!.environment_ref = "urban_street_day";
  bd.segments[0]!.first_frame_prompt = "A street-food stall on a busy sidewalk; Minh waits by the vendor.";
  const r = validateStoryboardSemantics(bd);
  assert.ok(!r.findings.some((x) => x.code === "ENV-001"));
});

test("LOC-001: a location change between clips is an advisory (medium)", () => {
  const bd = twoSegFixture();
  bd.segments[1]!.environment_ref = "urban_street_day";
  bd.segments[1]!.first_frame_prompt = "Suddenly a busy street outside.";
  const r = validateStoryboardSemantics(bd);
  const f = r.findings.find((x) => x.code === "LOC-001");
  assert.ok(f);
  assert.equal(f!.severity, "medium");
});

// ── Character & cast (Tầng 6) ───────────────────────────────────────────────
test("CHAR-001: missing gender, empty costume and wardrobe garbage all flag", () => {
  const bd = cleanFixture();
  bd.character_locks = [
    { name: "Lan", costume: "white tee, patterned apron", skin_tone: "light", hair: "long black", eyes: "brown", voice: "v" },
    { name: "Minh", gender: "male", costume: "blue polo shirt, crystal drop earrings. 2", skin_tone: "warm", hair: "short", eyes: "brown", voice: "v" },
    { name: "Huy", gender: "male", costume: "", skin_tone: "warm", hair: "short", eyes: "brown", voice: "v" },
  ] as Breakdown["character_locks"];
  bd.segments[0]!.characters_in_scene = ["Minh", "Lan", "Huy"];
  bd.segments[0]!.spatial_layout = { character_placement: "all three seated" } as Breakdown["segments"][number]["spatial_layout"];
  const r = validateStoryboardSemantics(bd);
  const char = r.findings.filter((x) => x.code === "CHAR-001");
  assert.ok(char.some((f) => f.character === "Lan" && /gender/i.test(f.message)));
  assert.ok(char.some((f) => f.character === "Minh" && /stray number/i.test(f.message)));
  assert.ok(char.some((f) => f.character === "Huy" && /empty/i.test(f.message)));
});

test("CHAR-002: two locks with the same name flag", () => {
  const bd = cleanFixture();
  bd.character_locks!.push({ name: "Minh", gender: "male", costume: "different", skin_tone: "warm", hair: "short", eyes: "brown", voice: "v" } as Breakdown["character_locks"][number]);
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "CHAR-002"));
});

test("CHAR-003: a human lock with no voice is an advisory", () => {
  const bd = cleanFixture();
  delete (bd.character_locks![0] as unknown as Record<string, unknown>).voice;
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "CHAR-003" && x.severity === "medium"));
});

test("CAST-001: phantom character and off-screen speaker are flagged", () => {
  const bd = cleanFixture();
  bd.segments[0]!.characters_in_scene = ["Minh", "Lan", "Huy"];
  bd.segments[0]!.speaker = "Nam";
  const r = validateStoryboardSemantics(bd);
  const cast = r.findings.filter((x) => x.code === "CAST-001");
  assert.ok(cast.some((f) => /Huy/.test(f.message)));
  assert.ok(cast.some((f) => /Nam/.test(f.message)));
});

test("CAST-002: a locked-but-unused character is an advisory", () => {
  const bd = cleanFixture();
  bd.character_locks!.push({ name: "Bao", gender: "male", gender_age: "m", costume: "suit", skin_tone: "warm", hair: "short", eyes: "brown", voice: "v" } as Breakdown["character_locks"][number]);
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "CAST-002" && x.character === "Bao"));
});

test("WARD-001: a wardrobe change for a character not in the scene flags", () => {
  const bd = cleanFixture();
  bd.segments[0]!.characters_in_scene = ["Minh"];
  bd.segments[0]!.spatial_layout = undefined;
  bd.segments[0]!.wardrobe_state = [{ character: "Lan", outfit: "raincoat" }] as Breakdown["segments"][number]["wardrobe_state"];
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "WARD-001" && /Lan/.test(x.message)));
});

// ── Continuity (Tầng 8) ─────────────────────────────────────────────────────
test("SPAT-001: two visible characters without a spatial map is high", () => {
  const bd = cleanFixture();
  bd.segments[0]!.spatial_layout = undefined;
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "SPAT-001" && x.severity === "high"));
});

test("SPAT-001: a single-character scene needs no topology", () => {
  const bd = cleanFixture();
  bd.segments[0]!.characters_in_scene = ["Minh"];
  bd.segments[0]!.spatial_layout = undefined;
  const r = validateStoryboardSemantics(bd);
  assert.ok(!r.findings.some((x) => x.code === "SPAT-001"));
});

test("CONT-001: a chained clip with no continuity_note is an advisory", () => {
  const bd = twoSegFixture();
  bd.segments[1]!.continuity_note = "";
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "CONT-001" && x.segment_number === 2));
});

function addContextContracts(bd: Breakdown): Breakdown {
  bd.schema_version = "4.0";
  bd.context_ir = {
    version: "2.0",
    segment_contract_version: "1.0",
    state: "locked",
    analysis_summary: "test",
    confidence: 1,
    assumptions: [],
    evidence: [],
    reality_profile: {
      mode: "cinematic",
      fidelity: "E_cinematic_simulation",
      dimensions: {
        macro: true,
        meso: true,
        micro: true,
        material_reaction: true,
        temporal_continuity: true,
        causal_integrity: true,
      },
      target_authenticity: "filmed reality",
      physics_model: "real world",
      allowed_deviations: [],
      salience_policy: {
        hero_entities: [],
        interaction_entities: [],
        foreground_fidelity: "micro",
        background_fidelity: "meso",
        max_high_fidelity_entities_per_clip: 3,
      },
    },
    layers: {
      environment: {
        strategy: "multi_location",
        primary_category: "interior",
        locations: [
          { id: "office", narrative_function: "work", description: "office", culture_geography_fit: "fit", spatial_anchors: [], fixed_elements: [], lighting_motivation: "day", sound_bed: "office" },
          { id: "home", narrative_function: "home", description: "home", culture_geography_fit: "fit", spatial_anchors: [], fixed_elements: [], lighting_motivation: "evening", sound_bed: "home" },
        ],
        selection_rule: "script",
      },
      audio_validation: {
        post_render_policy: "report_only_no_auto_regeneration",
      },
    },
  } as unknown as Breakdown["context_ir"];
  bd.segments.forEach((segment, index) => {
    segment.location_id = index === 0 ? "office" : "home";
    segment.transition_in = {
      mode: index === 0 ? "opening" : "location_cut",
      ...(index > 0 ? { from_location_id: "office" } : {}),
      to_location_id: index === 0 ? "office" : "home",
      time_relation: index === 0 ? "opening" : "later",
      preserve: index === 0 ? [] : ["identity", "emotion"],
      reset: index === 0 ? [] : ["location", "pose", "lighting"],
      reason: index === 0 ? "opening" : "story moves home",
    };
    segment.continuity_mode = segment.transition_in.mode;
    segment.state_ledger = { start: [], changes: [], end: [] };
  });
  return bd;
}

test("explicit location cut is valid and does not require physical chaining", () => {
  const bd = addContextContracts(twoSegFixture());
  const r = validateStoryboardSemantics(bd);
  assert.equal(
    r.findings.some((finding) => finding.code.startsWith("TRANS-") || finding.code.startsWith("STATE-")),
    false,
    formatSemanticReport(r)
  );
});

test("Context IR fails closed when location, transition and state ledger are absent", () => {
  const bd = addContextContracts(cleanFixture());
  delete bd.segments[0]!.location_id;
  delete bd.segments[0]!.transition_in;
  delete bd.segments[0]!.state_ledger;
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((finding) => finding.code === "LOC-002"));
  assert.ok(r.findings.some((finding) => finding.code === "TRANS-001"));
  assert.ok(r.findings.some((finding) => finding.code === "STATE-001"));
});

test("continuous transition rejects an entity state jump before visible action", () => {
  const bd = addContextContracts(twoSegFixture());
  bd.segments[1]!.location_id = "office";
  bd.segments[1]!.transition_in = {
    mode: "continuous",
    from_location_id: "office",
    to_location_id: "office",
    time_relation: "immediately",
    preserve: ["all physical state"],
    reset: [],
    reason: "same action",
  };
  bd.segments[1]!.continuity_mode = "continuous";
  bd.segments[0]!.state_ledger = {
    start: [{ entity_id: "cup", state: "on table", position: "table left" }],
    changes: [],
    end: [{ entity_id: "cup", state: "on table", position: "table left" }],
  };
  bd.segments[1]!.state_ledger = {
    start: [{ entity_id: "cup", state: "in hand", position: "counter" }],
    changes: [],
    end: [{ entity_id: "cup", state: "in hand", position: "counter" }],
  };
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((finding) => finding.code === "STATE-005"));
});

test("Schema 4.0 rejects a continuity_mode that disagrees with transition_in", () => {
  const bd = addContextContracts(twoSegFixture());
  bd.segments[1]!.continuity_mode = "continuous";
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((finding) => finding.code === "TRANS-005"));
});

// ── Dialogue (Tầng 10) ──────────────────────────────────────────────────────
test("DLG-001: out-of-range and overlapping dialogue timings flag", () => {
  const bd = cleanFixture();
  bd.segments[0]!.dialogue_lines = [
    { speaker: "Minh", text: "a", start_s: 0, end_s: 4 },
    { speaker: "Lan", text: "b", start_s: 3, end_s: 12 }, // overlaps + past 10s
  ] as Breakdown["segments"][number]["dialogue_lines"];
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "DLG-001"));
});

// ── Report shape ────────────────────────────────────────────────────────────
test("report is sorted critical-first and counts are correct", () => {
  const bd = cleanFixture();
  bd.segments[0]!.first_frame_prompt = "Moonlit midnight kitchen in broad daylight."; // ENV-003 critical
  bd.segments[0]!.spatial_layout = undefined; // SPAT-001 high
  const r = validateStoryboardSemantics(bd);
  assert.equal(r.findings[0]!.severity, "critical");
  assert.ok(r.counts.critical >= 1 && r.counts.high >= 1);
  assert.equal(r.ok, false);
});
