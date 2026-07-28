import assert from "node:assert/strict";
import test from "node:test";
import { validateStoryboardSemantics, formatSemanticReport } from "./semantic-validator.ts";

type Breakdown = Parameters<typeof validateStoryboardSemantics>[0];

// A clean two-character kitchen scene that should pass every step-1 check.
function cleanFixture(): Breakdown {
  return {
    title: "Bữa cơm",
    world_context: { time_period: "contemporary daytime" },
    character_locks: [
      { name: "Minh", gender: "male", costume: "blue polo shirt, grey trousers", skin_tone: "warm", hair: "short black", eyes: "brown" },
      { name: "Lan", gender: "female", costume: "white tee, patterned apron", skin_tone: "light", hair: "long black", eyes: "brown" },
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
        spatial_layout: { character_placement: "Minh left seat facing Lan; Lan right seat facing Minh" },
      },
    ],
  } as unknown as Breakdown;
}

test("clean breakdown passes the gate with no findings", () => {
  const r = validateStoryboardSemantics(cleanFixture());
  assert.equal(r.ok, true);
  assert.equal(r.counts.total, 0);
  assert.match(formatSemanticReport(r), /no issues/);
});

test("ENV-003: day + night in the same scene is critical", () => {
  const bd = cleanFixture();
  bd.segments[0]!.first_frame_prompt = "A moonlit kitchen at midnight bathed in broad daylight.";
  const r = validateStoryboardSemantics(bd);
  const f = r.findings.find((x) => x.code === "ENV-003");
  assert.ok(f, "expected an ENV-003 finding");
  assert.equal(f!.severity, "critical");
  assert.equal(r.ok, false);
});

test("ENV-003: a daylight scene under a locked night world is critical", () => {
  const bd = cleanFixture();
  bd.world_context = { time_period: "night" } as Breakdown["world_context"];
  bd.segments[0]!.first_frame_prompt = "Bright sunny kitchen at noon.";
  const r = validateStoryboardSemantics(bd);
  assert.ok(r.findings.some((x) => x.code === "ENV-003" && x.severity === "critical"));
});

test("ENV-003: 'tonight' must not false-trigger the night token", () => {
  const bd = cleanFixture();
  // 'tonight' contains 'night' but is not a standalone night token; the only
  // time word here is the daytime world — so no conflict.
  bd.segments[0]!.first_frame_prompt = "Minh says they will cook dinner tonight, in a bright sunlit kitchen.";
  const r = validateStoryboardSemantics(bd);
  assert.ok(!r.findings.some((x) => x.code === "ENV-003"), "should not flag 'tonight'");
});

test("ENV-001: a street env used for a restaurant scene is flagged", () => {
  const bd = cleanFixture();
  bd.segments[0]!.environment_ref = "urban_street_day";
  bd.segments[0]!.first_frame_prompt = "Minh and Lan sit inside a busy restaurant.";
  const r = validateStoryboardSemantics(bd);
  const f = r.findings.find((x) => x.code === "ENV-001");
  assert.ok(f, "expected ENV-001");
  assert.match(f!.evidence ?? "", /urban_street_day/);
});

test("ENV-001: a matching archetype does not false-trigger (street-food stall on a street set)", () => {
  const bd = cleanFixture();
  bd.segments[0]!.environment_ref = "urban_street_day";
  bd.segments[0]!.first_frame_prompt = "A street-food stall on a busy sidewalk; Minh waits by the vendor.";
  const r = validateStoryboardSemantics(bd);
  assert.ok(!r.findings.some((x) => x.code === "ENV-001"), "street set + street stall should agree");
});

test("SPAT-001: two visible characters without a spatial map is high", () => {
  const bd = cleanFixture();
  delete (bd.segments[0] as unknown as Record<string, unknown>).spatial_layout;
  const r = validateStoryboardSemantics(bd);
  const f = r.findings.find((x) => x.code === "SPAT-001");
  assert.ok(f);
  assert.equal(f!.severity, "high");
});

test("SPAT-001: a single-character scene needs no topology", () => {
  const bd = cleanFixture();
  bd.segments[0]!.characters_in_scene = ["Minh"];
  delete (bd.segments[0] as unknown as Record<string, unknown>).spatial_layout;
  const r = validateStoryboardSemantics(bd);
  assert.ok(!r.findings.some((x) => x.code === "SPAT-001"));
});

test("CHAR-001: missing gender, empty costume and wardrobe garbage all flag", () => {
  const bd = cleanFixture();
  bd.character_locks = [
    // gender unspecified on a human lock
    { name: "Lan", costume: "white tee, patterned apron", skin_tone: "light", hair: "long black", eyes: "brown" },
    // wardrobe garbage: stray trailing number
    { name: "Minh", gender: "male", costume: "blue polo shirt, crystal drop earrings. 2", skin_tone: "warm", hair: "short", eyes: "brown" },
    // empty costume
    { name: "Huy", gender: "male", costume: "", skin_tone: "warm", hair: "short", eyes: "brown" },
  ] as Breakdown["character_locks"];
  bd.segments[0]!.characters_in_scene = ["Minh", "Lan"];
  const r = validateStoryboardSemantics(bd);
  const char = r.findings.filter((x) => x.code === "CHAR-001");
  assert.ok(char.some((f) => f.character === "Lan" && /gender/i.test(f.message)));
  assert.ok(char.some((f) => f.character === "Minh" && /stray number/i.test(f.message)));
  assert.ok(char.some((f) => f.character === "Huy" && /empty/i.test(f.message)));
});

test("CAST-001: phantom character and off-screen speaker are flagged", () => {
  const bd = cleanFixture();
  // "Huy" appears on screen but has no lock → phantom third person.
  bd.segments[0]!.characters_in_scene = ["Minh", "Lan", "Huy"];
  // speaker "Nam" is on nobody's screen → off-screen speaker.
  bd.segments[0]!.speaker = "Nam";
  const r = validateStoryboardSemantics(bd);
  const cast = r.findings.filter((x) => x.code === "CAST-001");
  assert.ok(cast.some((f) => /Huy/.test(f.message)), "phantom Huy");
  assert.ok(cast.some((f) => /Nam/.test(f.message)), "off-screen speaker Nam");
});

test("report is sorted critical-first and counts are correct", () => {
  const bd = cleanFixture();
  bd.segments[0]!.first_frame_prompt = "Moonlit midnight kitchen in broad daylight."; // ENV-003 critical
  delete (bd.segments[0] as unknown as Record<string, unknown>).spatial_layout; // SPAT-001 high
  const r = validateStoryboardSemantics(bd);
  assert.equal(r.findings[0]!.severity, "critical");
  assert.ok(r.counts.critical >= 1 && r.counts.high >= 1);
  assert.equal(r.ok, false);
});
