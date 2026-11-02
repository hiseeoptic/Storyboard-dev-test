import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_LESSONS,
  FAMILY_MAX_SHOTS,
  FAMILY_MIN_SHOTS,
  familyActPlan,
  familyDramaCast,
  familyDramaDirective,
  familyDramaRoomSeed,
  familyDramaStoryIdea,
  familyLessonsFor,
  findFamilyLesson,
  normalizeFamilyDrama,
  searchFamilyLessons,
  withLibraryFamilyLesson,
  type FamilyDramaConfig,
} from "./family-drama.ts";
import {
  LONG_FIRST_PART,
  LONG_NEXT_PART,
  isWrittenSegment,
  longVideoFindings,
  longVideoFirstPartDirective,
  longVideoTotal,
  mergeLongVideoPart,
  nextLongVideoRange,
  stubSegments,
} from "../storyboard/long-video.ts";

test("the library: 30 complete lessons — 12 couples, 10 mother/daughter-in-law, 8 sister-in-law", () => {
  assert.equal(FAMILY_LESSONS.length, 30);
  assert.equal(familyLessonsFor("couple").length, 12);
  assert.equal(familyLessonsFor("mil_dil").length, 10);
  assert.equal(familyLessonsFor("sil").length, 8);
  assert.equal(new Set(FAMILY_LESSONS.map((l) => l.id)).size, 30, "unique ids");
  for (const l of FAMILY_LESSONS) {
    for (const field of ["title", "hook", "situation", "conflict", "climax", "turning", "lesson", "awakening", "takeaway", "pattern", "method", "basis", "place"] as const) {
      assert.ok(l[field].trim().length > 10, `${l.id}.${field}`);
    }
    assert.ok(l.takeaway.split(/\s+/).length <= 30, `${l.id} takeaway is one short line`);
    assert.ok(l.roles.includes("wife"), `${l.id} has the wife`);
    if (l.relation === "mil_dil") assert.ok(l.roles.includes("mother_in_law"), l.id);
    if (l.relation === "sil") assert.ok(l.roles.includes("sister_in_law") || l.roles.includes("brother_in_law"), l.id);
    // Character names come from the card, never from the lesson text.
    assert.doesNotMatch(`${l.hook} ${l.situation} ${l.conflict} ${l.climax} ${l.lesson} ${l.awakening}`, /\b(?:Lan|Minh|Tuấn|Thảo)\b(?! bạch)/u, l.id);
    // No hotline numbers or invented figures in the research notes.
    assert.doesNotMatch(l.basis, /\b1[89]00\b|\bhotline\b/i, l.id);
  }
});

test("search and lookup", () => {
  assert.ok(searchFamilyLessons("tiền").length >= 3);
  assert.ok(searchFamilyLessons("chau", "mil_dil").every((l) => l.relation === "mil_dil"));
  assert.equal(findFamilyLesson("couple_gentle_startup_01")?.relation, "couple");
  assert.equal(searchFamilyLessons("   ").length, 0);
});

test("four movements: every clip has one job, the lesson gets the most room", () => {
  for (const shots of [6, 10, 12, 15, 18]) {
    const plan = familyActPlan(shots);
    assert.deepEqual(plan.map((s) => s.act), ["hook", "rising", "climax", "turning", "lesson", "awakening"]);
    assert.equal(plan[0]!.from, 1);
    assert.equal(plan.at(-1)!.to, shots, `${shots} clips are all used`);
    for (let i = 1; i < plan.length; i++) assert.equal(plan[i]!.from, plan[i - 1]!.to + 1, "contiguous");
    const size = (act: string) => plan.filter((s) => s.act === act).reduce((n, s) => n + s.to - s.from + 1, 0);
    assert.ok(size("lesson") >= size("rising"), `${shots}: lesson ≥ rising`);
  }
  const fifteen = familyActPlan(15);
  assert.deepEqual(fifteen.map((s) => [s.act, s.from, s.to]), [["hook", 1, 1], ["rising", 2, 5], ["climax", 6, 7], ["turning", 8, 8], ["lesson", 9, 13], ["awakening", 14, 15]]);
  assert.equal(familyActPlan(99).at(-1)!.to, FAMILY_MAX_SHOTS, "clamped");
  assert.equal(familyActPlan(2).at(-1)!.to, FAMILY_MIN_SHOTS, "clamped");
});

const lesson = findFamilyLesson("mil_childcare_01")!;
const config: FamilyDramaConfig = {
  request: "",
  relation: "mil_dil",
  lessonId: lesson.id,
  lesson,
  names: { wife: "Hà", mother_in_law: "Bà Lụa" },
  dialect: "south",
  filming: "cinematic",
  shots: 15,
  narrator: true,
  tone: "drama",
};

test("cast: the lesson's roles, the card's names, defaults for the rest", () => {
  const cast = familyDramaCast(config);
  assert.deepEqual(cast.map((c) => [c.role, c.name]), [["wife", "Hà"], ["husband", "Minh"], ["mother_in_law", "Bà Lụa"], ["baby", "Bé Su"]]);
  assert.equal(cast.find((c) => c.role === "baby")!.isChild, true);
});

test("the planner contract: clip plan, lesson, no villain, safety, address terms, awakening voice", () => {
  const d = familyDramaDirective(config);
  assert.match(d, /^FAMILY LESSON DRAMA \(HARD\)/);
  assert.match(d, /15 clips × 10 s = 150 s/);
  assert.match(d, /clip 1 = HOOK .*clips 2–5 = LEO THANG .*clips 6–7 = CAO TRÀO .*clip 8 = BƯỚC NGOẶT .*clips 9–13 = BÀI HỌC .*clips 14–15 = TỈNH THỨC/);
  assert.match(d, /Hà = Vợ/);
  assert.match(d, /Bà Lụa = Mẹ chồng/);
  assert.match(d, new RegExp(lesson.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(d, /NO VILLAIN/);
  assert.match(d, /SHOW, DON'T PREACH/);
  assert.match(d, /no physical violence/);
  assert.match(d, /the daughter-in-law calls her mother-in-law "mẹ"/);
  assert.match(d, /AWAKENING VOICE-OVER: only in clips 14–15/);
  assert.match(d, /CHILDREN ON SCREEN/, "a baby in the cast adds the child rule");
  assert.match(familyDramaDirective({ ...config, narrator: false }), /AWAKENING LINE: .*No narrator\./);
  assert.equal(familyDramaDirective(null), "");
});

test("story idea and writers'-room seed carry the brief once and the structure", () => {
  const idea = familyDramaStoryIdea(config);
  assert.equal((idea.match(/📚 Bài học/g) ?? []).length, 1);
  assert.match(idea, /15 shot × 10 giây = 2 phút 30 giây/);
  assert.match(idea, /Hook \(shot 1\) → Leo thang \(shot 2–5\) → Cao trào \(shot 6–7\)/);
  const edited = familyDramaStoryIdea({ ...config, request: "Mẹ chồng muốn cho cháu ăn bột sớm" });
  assert.match(edited, /^Mẹ chồng muốn cho cháu ăn bột sớm/);
  assert.equal((edited.match(/📚 Bài học/g) ?? []).length, 1, "the library brief is added once when the creator wrote their own request");
  assert.match(familyDramaRoomSeed(config), /Không có nhân vật phản diện/);
});

test("normalise: clamps, drops unknown values, keeps only a complete matching lesson", () => {
  const n = normalizeFamilyDrama({ relation: "boss", shots: 99, dialect: "west", filming: "drone", tone: "sad", names: { wife: "  Hoa  ", ghost: "x" }, narrator: false })!;
  assert.equal(n.relation, "couple");
  assert.equal(n.shots, FAMILY_MAX_SHOTS);
  assert.equal(n.dialect, "north");
  assert.equal(n.filming, "cinematic");
  assert.equal(n.tone, "drama");
  assert.deepEqual(n.names, { wife: "Hoa" });
  assert.equal(n.narrator, false);
  const tampered = normalizeFamilyDrama({ lessonId: lesson.id, lesson: { ...lesson, takeaway: "" } })!;
  assert.equal(tampered.lesson, lesson, "an incomplete snapshot falls back to the library lesson");
  assert.equal(tampered.relation, "mil_dil", "the lesson decides the relation");
  const swapped = withLibraryFamilyLesson({ lessonId: lesson.id, lesson: { ...lesson, title: "edited" } }) as { lesson: { title: string } };
  assert.equal(swapped.lesson.title, lesson.title);
  assert.equal(normalizeFamilyDrama(null), undefined);
});

test("long video: more than 10 clips is written in parts — 8 first, then 5 per request", () => {
  assert.equal(longVideoTotal({ segment_count: 10, scene_count: 10 }), 0, "up to 10 clips stays a single request");
  assert.equal(longVideoTotal({ segment_count: 15, scene_count: 15 }), 15);
  const directive = longVideoFirstPartDirective({ family_drama: config }, 15);
  assert.match(directive, /PART 1 OF A 15-CLIP STORY/);
  assert.match(directive, /writes ONLY clips 1–8/);
  assert.match(directive, /clip 9 \(BÀI HỌC/, "the next clip's job comes from the family act plan");

  const seg = (n: number) => ({
    segment_number: n, duration_seconds: 10, title: `c${n}`, marketing_role: n === LONG_FIRST_PART ? "cta" : "body",
    beats: [{ beat: "b", camera: "[MS] x" }], first_frame_prompt: "start", motion_prompt: "move",
    location_id: "home", characters_in_scene: ["Hà"],
    state_ledger: { start: [], changes: [], end: [{ entity_id: "cup", state: "full", position: "on the table" }] },
  });
  const breakdown = { segments: Array.from({ length: LONG_FIRST_PART }, (_, i) => seg(i + 1)), total_duration_seconds: 150 } as never;
  assert.deepEqual(nextLongVideoRange(breakdown, 15), { from: 9, to: 13 });
  const stubs = stubSegments(breakdown, { family_drama: config }, 9, 13, 15);
  assert.equal(stubs.length, LONG_NEXT_PART);
  assert.deepEqual(stubs[0]!.state_ledger?.start, [{ entity_id: "cup", state: "full", position: "on the table" }], "continues from the previous end state");
  assert.equal(isWrittenSegment(stubs[0]), false);
  assert.equal(longVideoFindings({ family_drama: config }, 9, 13, 15).length, 5);
  assert.match(longVideoFindings({ family_drama: config }, 15, 15, 15)[0]!.evidence, /FINAL clip/);
  // Clip 11 came back empty: keep 9–10, stop there, fix totals and the closing role.
  const merged = mergeLongVideoPart(breakdown, [seg(9), seg(10), { segment_number: 11 }, seg(12)] as never, 9, 13, 15);
  assert.equal(merged.segments.length, 10);
  assert.equal(merged.total_duration_seconds, 100);
  assert.equal(merged.segments[7]!.marketing_role, "body", "part 1's last clip is not the video's ending");
  assert.deepEqual(nextLongVideoRange(merged, 15), { from: 11, to: 15 });
  assert.equal(nextLongVideoRange({ segments: Array.from({ length: 15 }, (_, i) => seg(i + 1)) } as never, 15), null);
});
