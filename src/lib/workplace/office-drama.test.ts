import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIENCE_LABEL,
  DEFAULT_OFFICE_DRAMA,
  OFFICE_LESSONS,
  OFFICE_MAX_SHOTS,
  OFFICE_MIN_SHOTS,
  OFFICE_TECHNIQUES,
  OFFICE_THEMES,
  findOfficeLesson,
  normalizeOfficeDrama,
  officeActPlan,
  officeDramaCast,
  officeDramaDirective,
  officeDramaRoomSeed,
  officeDramaStoryIdea,
  officeLessonsFor,
  officeThemeLabel,
  officeThemesWithCounts,
  officeTrainingCase,
  pickUnusedOfficeLesson,
  searchOfficeLessons,
  withLibraryOfficeLesson,
  type OfficeDramaConfig,
} from "./office-drama.ts";
import { clipPurpose, longVideoFindings } from "../storyboard/long-video.ts";
import { familyActPlan } from "../family/family-drama.ts";

test("the library: 120 complete cases on 12 shelves, for managers, employees and whole teams", () => {
  assert.equal(OFFICE_LESSONS.length, 120);
  for (const field of ["id", "title", "hook"] as const) {
    assert.equal(new Set(OFFICE_LESSONS.map((l) => l[field])).size, 120, `unique ${field}s`);
  }
  const shelves = officeThemesWithCounts();
  assert.deepEqual(shelves.map((t) => t.id), OFFICE_THEMES.map((t) => t.id));
  for (const t of shelves) assert.equal(t.count, 10, `${t.id} holds 10 cases`);
  const order = OFFICE_LESSONS.map((l) => OFFICE_THEMES.findIndex((t) => t.id === l.theme));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "grouped by shelf");
  for (const audience of ["manager", "staff", "all"] as const) {
    assert.ok(officeLessonsFor({ audience }).length >= 15, `${audience} has at least 15 cases`);
  }
  const methods = new Set(Object.values(OFFICE_TECHNIQUES).map((t) => t.method));
  for (const l of OFFICE_LESSONS) {
    for (const field of ["title", "hook", "situation", "conflict", "climax", "turning", "lesson", "awakening", "takeaway", "pattern", "method", "basis"] as const) {
      assert.ok(l[field].trim().length > 10, `${l.id}.${field}`);
    }
    assert.ok(l.place.trim().length > 3, `${l.id}.place`);
    assert.ok(methods.has(l.method), `${l.id} uses a library practice`);
    assert.ok(l.takeaway.split(/\s+/).length <= 30, `${l.id} takeaway is one short line`);
    assert.equal(l.questions.length, 2, `${l.id} has two discussion questions`);
    for (const q of l.questions) assert.match(q, /\?$/, `${l.id} question ends with "?"`);
    assert.ok(l.roles.length >= 2, `${l.id} has at least two people`);
    assert.ok(officeThemeLabel(l), `${l.id} sits on a shelf`);
    // Names come from the card, never from the case text.
    assert.doesNotMatch(`${l.hook} ${l.situation} ${l.conflict} ${l.climax} ${l.lesson} ${l.awakening}`, /\b(?:Thư|Khải|Phượng|Duy|Ngọc|Trang|Hùng|Bích|Lan|Minh|Tuấn|Thảo|Hằng)\b/u, l.id);
    // No hotline numbers in the research notes; the only figure is Gallup's own (≈70% of team engagement variance).
    assert.doesNotMatch(l.basis, /\b1[89]00\b|hotline/i, l.id);
    if (/\d+ ?%/.test(l.basis)) assert.match(l.basis, /Gallup/, `${l.id}: a percentage must be the sourced Gallup figure`);
  }
});

test("search, shelves, audience filter and the next unused case", () => {
  assert.ok(searchOfficeLessons("zalo").some((l) => l.id === "off_gg_01"), "words in the hook are searched");
  assert.ok(searchOfficeLessons("gop y").length >= 10, "accents are optional and the shelf label counts");
  const managerIds = new Set(searchOfficeLessons("cho sep").map((l) => l.id));
  assert.ok(officeLessonsFor({ audience: "manager" }).every((l) => managerIds.has(l.id)), "the audience label is searchable");
  assert.equal(searchOfficeLessons("  ").length, 0);
  const shelf = officeLessonsFor({ theme: "gio_giac" });
  assert.equal(shelf.length, 10);
  assert.ok(officeLessonsFor({ theme: "gio_giac", audience: "manager" }).every((l) => l.theme === "gio_giac" && l.audience === "manager"));
  const used = shelf.slice(0, 9).map((l) => l.id);
  for (const r of [0, 0.5, 0.99]) assert.equal(pickUnusedOfficeLesson(shelf, used, () => r)?.id, shelf[9]!.id);
  assert.equal(pickUnusedOfficeLesson(shelf, shelf.map((l) => l.id)), undefined);
  assert.equal(findOfficeLesson("off_gy_01")?.theme, "gop_y");
  assert.equal(findOfficeLesson("nope"), undefined);
});

const lesson = findOfficeLesson("off_ld_02")!;
const config: OfficeDramaConfig = { ...DEFAULT_OFFICE_DRAMA, lessonId: lesson.id, lesson, names: { manager: "Sơn" }, workplace: "bank", shots: 12 };

test("the clip plan is the same four movements as Chuyện nhà, with workplace purposes", () => {
  for (const shots of [6, 12, 15, 18]) {
    const plan = officeActPlan(shots);
    assert.deepEqual(plan.map((s) => [s.act, s.from, s.to]), familyActPlan(shots).map((s) => [s.act, s.from, s.to]));
    assert.match(plan.find((s) => s.act === "rising")!.purpose_en, /deadline|losing face/);
  }
  assert.equal(officeActPlan(99).at(-1)!.to, OFFICE_MAX_SHOTS);
  assert.equal(officeActPlan(1).at(-1)!.to, OFFICE_MIN_SHOTS);
});

test("cast: the case's roles, the card's names, defaults and the workplace's clothes", () => {
  const cast = officeDramaCast(config);
  assert.deepEqual(cast.map((c) => [c.role, c.name]), [["staff", "Thư"], ["manager", "Sơn"], ["director", "Phượng"]]);
  assert.match(cast[0]!.appearance, /bank uniform/);
  assert.match(cast[2]!.appearance, /elegant business attire/, "the director keeps her own clothes");
  assert.deepEqual(officeDramaCast({ ...DEFAULT_OFFICE_DRAMA }).map((c) => c.role), ["staff", "manager"], "no case = a staff member and a manager");
});

test("the planner contract: plan, case, no villain, safety, address terms, awakening voice", () => {
  const d = officeDramaDirective(config);
  assert.match(d, /^WORKPLACE CULTURE DRAMA \(HARD\)/);
  assert.match(d, /12 clips × 10 s = 120 s/);
  assert.match(d, /clip 1 = HOOK .*clips 2–3 = LEO THANG .*clips 4–5 = CAO TRÀO .*clip 6 = BƯỚC NGOẶT .*clips 7–10 = BÀI HỌC .*clips 11–12 = TỈNH THỨC/);
  assert.match(d, /Sơn = Trưởng phòng/);
  assert.match(d, /bank branch/);
  assert.match(d, new RegExp(lesson.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(d, /trains: for managers/);
  assert.match(d, /NO VILLAIN/);
  assert.match(d, /SHOW, DON'T PREACH/);
  assert.match(d, /harassment or bullying is NEVER shown explicitly/);
  assert.match(d, /no real company, brand, logo/);
  assert.match(d, /a junior says "em" and calls an older colleague or the manager "anh"\/"chị"/);
  assert.match(d, /AWAKENING VOICE-OVER: only in clips 11–12/);
  assert.match(officeDramaDirective({ ...config, narrator: false }), /AWAKENING LINE: .*No narrator\./);
  assert.match(officeDramaDirective({ ...config, dialect: "south" }), /Southern warmth/);
  assert.equal(officeDramaDirective(null), "");
});

test("story idea, writers'-room seed and training handout", () => {
  const idea = officeDramaStoryIdea(config);
  assert.equal((idea.match(/💼 Case công sở/g) ?? []).length, 1);
  assert.match(idea, /12 shot × 10 giây = 2 phút/);
  assert.match(idea, /Nơi làm việc: Ngân hàng \/ tài chính\./);
  const edited = officeDramaStoryIdea({ ...config, request: "Sếp quát khi nghe tin xấu" });
  assert.match(edited, /^Sếp quát khi nghe tin xấu/);
  assert.equal((edited.match(/💼 Case công sở/g) ?? []).length, 1, "the brief is added once when the creator wrote their own request");
  assert.match(officeDramaRoomSeed(config), /Không có nhân vật phản diện/);
  const handout = officeTrainingCase(lesson);
  assert.match(handout, /^CASE ĐÀO TẠO VĂN HÓA DOANH NGHIỆP — /);
  assert.match(handout, new RegExp(`Đối tượng: ${AUDIENCE_LABEL[lesson.audience].vi}`));
  assert.match(handout, /Câu hỏi thảo luận:\n1\. .+\?\n2\. .+\?$/);
  assert.match(handout, /\n1\. .+\n2\. /, "the practice is numbered step by step");
});

test("normalise: clamps, drops unknown values, keeps only a complete matching case; the server uses the library", () => {
  const n = normalizeOfficeDrama({ shots: 99, workplace: "moon", dialect: "x", names: { manager: "  Sơn  ", ghost: "x" }, lessonId: lesson.id, lesson: { ...lesson, title: "" } })!;
  assert.equal(n.shots, OFFICE_MAX_SHOTS);
  assert.equal(n.workplace, "office");
  assert.equal(n.dialect, "north");
  assert.deepEqual(n.names, { manager: "Sơn" });
  assert.equal(n.lesson?.title, lesson.title, "an incomplete snapshot falls back to the library");
  assert.equal(normalizeOfficeDrama({ lessonId: "nope" })?.lesson, undefined);
  assert.equal(normalizeOfficeDrama(null), undefined);
  const tampered = withLibraryOfficeLesson({ ...config, lesson: { ...lesson, lesson: "tampered" } });
  assert.equal(tampered.lesson?.lesson, lesson.lesson);
});

test("long videos follow the workplace plan clip by clip", () => {
  const input = { office_drama: { ...config, shots: 15 } };
  assert.match(clipPurpose(input, 1, 15), /^HOOK \(clips 1–1\)/);
  assert.match(clipPurpose(input, 10, 15), /^BÀI HỌC .*The practice to act out:/);
  assert.match(clipPurpose(input, 15, 15), /^TỈNH THỨC .*The awakening:/);
  const findings = longVideoFindings(input, 9, 13, 15);
  assert.equal(findings.length, 5);
  assert.match(findings[0]!.message, /Clip 9 of 15 is NOT WRITTEN YET/);
  assert.match(clipPurpose({}, 3, 15), /continue the approved script/, "no drama = unchanged");
});
