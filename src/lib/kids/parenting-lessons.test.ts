import assert from "node:assert/strict";
import test from "node:test";
import { LESSON_PILLARS, PARENTING_LESSONS, findLesson, lessonsFor } from "./parenting-lessons.ts";
import { DEFAULT_CUTE_KIDS, FAMILY_MEMBERS, cuteKidsDirective, cuteKidsRoomSeed, cuteKidsStoryIdea, buildEpisodeIdeasPrompt, familyCast, labelCuteKidsPosts, normalizeCuteKids, AI_LABEL_VI, type CuteKidsConfig } from "./cute-kids.ts";
import { childSafeText } from "./child-safe-wording.ts";

const teach = (patch: Partial<CuteKidsConfig> = {}): CuteKidsConfig => ({ ...DEFAULT_CUTE_KIDS, kidName: "Na", goal: "teach", lessonId: "toy_aisle", request: findLesson("toy_aisle")!.situation, ...patch });

test("the library covers 12 parenting areas, every lesson complete, sourced and respectful", () => {
  assert.deepEqual(LESSON_PILLARS.map((p) => p.id), ["money", "emotions", "routines", "screens", "manners", "independence", "social", "honesty", "confidence", "empathy", "safety", "learning"]);
  for (const pillar of ["money", "emotions"] as const) assert.ok(PARENTING_LESSONS.filter((l) => l.pillar === pillar).length >= 10, pillar);
  for (const p of LESSON_PILLARS) assert.ok(PARENTING_LESSONS.filter((l) => l.pillar === p.id).length >= 5, p.id);
  assert.ok(PARENTING_LESSONS.length >= 80);
  const ids = new Set<string>();
  for (const l of PARENTING_LESSONS) {
    assert.ok(!ids.has(l.id), `unique ${l.id}`);
    ids.add(l.id);
    assert.ok(LESSON_PILLARS.some((p) => p.id === l.pillar), `${l.id} pillar`);
    for (const field of [l.title, l.situation, l.behavior, l.technique, l.takeaway, l.wrongWay, l.method]) assert.ok(field.trim().length > 5, `${l.id} complete`);
    for (const m of l.needs ?? []) assert.ok(FAMILY_MEMBERS.includes(m), `${l.id} needs ${m}`);
    // Topics that get child prompts refused, or put a child in danger on screen, stay out.
    assert.doesNotMatch(`${l.situation} ${l.technique}`, /(?<!\p{L})(?:tắm|bồn cầu|bô|đi vệ sinh|bơi|dao|bếp ga|bật bếp)(?!\p{L})/iu, `${l.id} safe topic`);
    // The good way never hits, threatens or shames; only the mild "Cách 1" may be clumsy.
    assert.doesNotMatch(l.technique, /đánh (?:con|bé|đòn|vào)|roi|phạt quỳ|dọa|xấu hổ/i, l.id);
    assert.doesNotMatch(`${l.wrongWay} ${l.situation}`, /đánh (?:con|bé|đòn|vào)|roi|tát|quát|gắt|to tiếng|xấu hổ|không thì|góc nhà|giật|so sánh/i, `${l.id} wrong way stays mild`);
  }
  assert.ok(lessonsFor("money", "toddler").every((l) => l.ages.includes("toddler")));
  assert.ok(lessonsFor("money", "toddler").length >= 2);
  for (const p of LESSON_PILLARS) for (const age of ["toddler", "young", "school"] as const) assert.ok(lessonsFor(p.id, age).length >= 1, `${p.id} ${age}`);
  // The named approaches come from known programmes.
  const methods = PARENTING_LESSONS.map((l) => l.method).join(" ");
  for (const source of ["Kỷ luật tích cực", "Gottman", "Faber & Mazlish", "Montessori", "Harvard", "CASEL", "Dweck"]) assert.ok(methods.includes(source), source);
});

test("every lesson's directive is free of wording the video model refuses", () => {
  for (const l of PARENTING_LESSONS) {
    for (const kidAge of l.ages) {
      const d = cuteKidsDirective(teach({ lessonId: l.id, request: l.situation, kidAge, abFormat: true, shots: 4 }));
      assert.equal(childSafeText(d), d, l.id);
      assert.match(d, new RegExp(`approach: ${l.method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), l.id);
    }
  }
});

test("a lesson brings the family it needs: a big brother, a friend, the baby or grandma join the cast", () => {
  const brother = familyCast(teach({ lessonId: "sibling_seat", family: ["mom"] }));
  assert.deepEqual(brother.map((c) => c.name), ["Na", "Mẹ", "Anh Tin"]);
  assert.equal(brother[2]!.isChild, true);
  assert.equal(brother[2]!.role, "anh trai");
  assert.match(cuteKidsDirective(teach({ lessonId: "sibling_seat", family: ["mom"] })), /OTHER CHILDREN ON SCREEN \(Anh Tin\)/);
  const friend = familyCast(teach({ lessonId: "ask_to_borrow", kidAge: "young", dialect: "south" }));
  assert.equal(friend.at(-1)!.name, "Bạn Bống");
  assert.match(friend.at(-1)!.appearance, /child friend from next door, about 4–5 years old/);
  assert.match(cuteKidsDirective(teach({ lessonId: "gentle_with_baby" })), /BABY ON SCREEN/);
  assert.match(cuteKidsStoryIdea(teach({ lessonId: "card_for_grandma" })), /Nhân vật: Na \(bé gái 6–7 tuổi\), Bố, Mẹ, Bà/);
  assert.match(cuteKidsStoryIdea(teach({ lessonId: "spilled_lie" })), /thú cưng: Mèo/);
  assert.doesNotMatch(cuteKidsDirective({ ...teach({ lessonId: "sibling_seat" }), goal: "fun" }), /Anh Tin/, "fun mode keeps the chosen family");
  assert.deepEqual(normalizeCuteKids({ family: ["sibling", "friend", "nope"] })!.family, ["sibling", "friend"]);
});

test("teach mode: lesson, structure, narrator takeaway and respectful parents are in the contract", () => {
  const d = cuteKidsDirective(teach());
  assert.match(d, /PARENTING LESSON \(the reel teaches parents through the story — show it, never preach\): "Đòi mua đồ chơi ở siêu thị"/);
  assert.match(d, /the parent's technique: bố mẹ ngồi xuống ngang tầm mắt/);
  assert.match(d, /\(approach: Thừa nhận mong muốn, giữ giới hạn \(Kỷ luật tích cực\)\)/);
  assert.match(d, /LESSON STRUCTURE \(3 clips\): clip 1 = the relatable moment/);
  assert.match(d, /TAKEAWAY BY NARRATOR: the last clip ends with a short, warm narrator voice-over/);
  assert.match(d, /never hitting, yelling, threats, shaming/);
  assert.doesNotMatch(cuteKidsDirective({ ...teach(), goal: "fun" }), /PARENTING LESSON/);
  assert.match(cuteKidsDirective(teach({ takeaway: "parent" })), /TAKEAWAY BY THE PARENT: in the last clip the parent says the lesson to Na/);
  assert.equal(childSafeText(d), d, "no wording the video model refuses");
});

test("A/B format: Cách 1 the mild way, a rewind, then Cách 2", () => {
  const four = cuteKidsDirective(teach({ abFormat: true, shots: 4 }));
  assert.match(four, /"2 CÁCH XỬ LÝ" \(A\/B\): Cách 1 fills clip 1–2 — the same relatable moment handled the ineffective way \(bố mẹ nói cụt/);
  assert.match(four, /the narrator says "Cách 1…" at the start and "Còn cách 2…" at the rewind/);
  assert.match(cuteKidsDirective(teach({ abFormat: true, shots: 3, takeaway: "parent" })), /Cách 1 fills clip 1 —.*the scene visibly restarts from the same moment/);
  assert.match(cuteKidsStoryIdea(teach({ abFormat: true })), /Kiểu "2 cách xử lý": cách 1 — bố mẹ nói cụt/);
});

test("Vietnamese idea, room seed and episode ideas carry the lesson", () => {
  const idea = cuteKidsStoryIdea(teach());
  assert.match(idea, /🎓 Bài học dạy con \(💰 Tiền bạc\): Đòi mua đồ chơi ở siêu thị\./);
  assert.match(idea, /Câu chốt \(giọng dẫn ngắn ở cuối video\): Thừa nhận mong muốn/);
  assert.match(idea, /Cách bố mẹ xử lý \(Thừa nhận mong muốn, giữ giới hạn \(Kỷ luật tích cực\)\): bố mẹ ngồi xuống/);
  assert.match(cuteKidsRoomSeed(teach()), /không đánh, không quát, không dọa, không so sánh/);
  assert.match(buildEpisodeIdeasPrompt(teach({ pillar: "emotions" })), /PARENTING CHANNEL: every idea teaches parents one everyday lesson in the area "Cảm xúc"/);
});

test("captions: parent tip, comment question and disclaimer before the AI label; normalised once", () => {
  const posts = { tiktok: { caption: "Na đòi đồ chơi 😂", hashtags: ["#fyp"] }, facebook_reel: { caption: "x", hashtags: [] as string[] } };
  labelCuteKidsPosts(posts, teach());
  labelCuteKidsPosts(posts, teach());
  const caption = posts.tiktok.caption;
  assert.match(caption, /💡 Mẹo cho bố mẹ: Thừa nhận mong muốn của con/);
  assert.match(caption, /📚 Cách làm: Thừa nhận mong muốn, giữ giới hạn \(Kỷ luật tích cực\)/);
  assert.equal(caption.split("Nhà mình xử lý tình huống này").length, 2);
  assert.ok(caption.indexOf("Mẹo cho bố mẹ") < caption.indexOf(AI_LABEL_VI), "AI label stays last");
  assert.deepEqual(posts.tiktok.hashtags, ["#fyp", "#dạycon", "#nuôidạycon"]);
  const fun = { tiktok: { caption: "vui" } };
  labelCuteKidsPosts(fun, { ...teach(), goal: "fun" });
  assert.doesNotMatch(fun.tiktok.caption, /Mẹo cho bố mẹ/);
  const c = normalizeCuteKids({ goal: "teach", lessonId: "nope", takeaway: "x", abFormat: "yes", pillar: "x" })!;
  assert.equal(c.lessonId, undefined);
  assert.equal(c.takeaway, "narrator");
  assert.equal(c.abFormat, false);
  assert.equal(c.pillar, "money");
});
