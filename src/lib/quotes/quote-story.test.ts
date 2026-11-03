import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QUOTE_STORY,
  QUOTE_LIBRARY,
  QUOTE_MAX_SHOTS,
  QUOTE_MIN_SHOTS,
  QUOTE_REGIONS,
  QUOTE_THEMES,
  findQuote,
  normalizeQuoteStory,
  pickUnusedQuote,
  quoteActPlan,
  quoteCaption,
  quoteCounts,
  quoteRoleGenders,
  quoteRoomSeed,
  quoteSpokenAttribution,
  quoteStoryCast,
  quoteStoryDirective,
  quoteStoryIdea,
  quoteStudyCard,
  quotesFor,
  searchQuotes,
  withLibraryQuote,
  type QuoteStoryConfig,
} from "./quote-story.ts";
import { clipPurpose } from "../storyboard/long-video.ts";

test("the library: 112 sourced sayings from Việt Nam, Trung Hoa, Châu Âu, Mỹ and the world", () => {
  assert.equal(QUOTE_LIBRARY.length, 112);
  for (const field of ["id", "text", "hook"] as const) {
    assert.equal(new Set(QUOTE_LIBRARY.map((q) => q[field])).size, QUOTE_LIBRARY.length, `unique ${field}s`);
  }
  const { regions, themes, formats } = quoteCounts();
  assert.deepEqual(regions.map((r) => [r.id, r.count]), [["viet_nam", 40], ["trung_hoa", 24], ["chau_au", 20], ["my", 20], ["the_gioi", 8]]);
  for (const t of themes) assert.ok(t.count >= 3, `${t.id} has sayings`);
  assert.ok(formats.find((f) => f.id === "rethink")!.count >= 12, "enough \"Nghĩ lại cho đúng\" stories");
  const themeIds = new Set(QUOTE_THEMES.map((t) => t.id));
  for (const q of QUOTE_LIBRARY) {
    assert.ok(QUOTE_REGIONS.includes(q.region) && themeIds.has(q.theme), q.id);
    for (const field of ["text", "source", "meaning", "hook", "situation", "mistake", "turning", "awakening", "takeaway", "place"] as const) {
      assert.ok(q[field].trim().length > 5, `${q.id}.${field}`);
    }
    assert.ok(q.takeaway.split(/\s+/).length <= 30, `${q.id} takeaway is one short line`);
    assert.equal(q.questions.length, 2, q.id);
    for (const x of q.questions) assert.match(x, /\?$/, q.id);
    assert.ok(q.roles.length >= 2, `${q.id} has at least two people`);
    // Every named saying has an author and a source; folk sayings have no author.
    if (q.verification === "folk") assert.equal(q.author, "", q.id);
    else assert.ok(q.author.length > 1 && q.source.length > 5, `${q.id} names who and where`);
    // A correction story always carries the correction.
    if (q.format === "rethink" || q.verification === "misattributed") assert.ok((q.misread ?? "").length > 20, `${q.id} explains the right reading / true origin`);
    if (q.verification === "misattributed") assert.equal(q.format, "rethink", `${q.id} misattributed lines are only used to correct them`);
    // Political leaders are not in the automatic library.
    assert.doesNotMatch(`${q.author} ${q.text}`, /Hồ Chí Minh|Bác Hồ|Mao Trạch Đông|Lenin|Stalin|Tập Cận Bình/u, q.id);
  }
});

test("well-known corrections are stated, not repeated", () => {
  const einstein = findQuote("eu_17")!;
  assert.equal(einstein.verification, "misattributed");
  assert.match(einstein.misread!, /Không có bằng chứng Einstein/);
  const sunTzu = findQuote("tq_14")!;
  assert.match(sunTzu.text, /trăm trận không nguy/);
  assert.match(sunTzu.misread!, /bách chiến bất đãi/);
  const franklin = findQuote("us_03")!;
  assert.match(franklin.misread!, /Tuân Tử/);
  assert.equal(findQuote("vn_38")!.verification, "paraphrase", "the diary line's exact wording is unverified");
});

test("search, filters and the next unused saying", () => {
  assert.ok(searchQuotes("khong tu").some((q) => q.author === "Khổng Tử"), "accents are optional");
  assert.ok(searchQuotes("Seneca").every((q) => q.author === "Seneca"));
  assert.ok(searchQuotes("ca dao").length >= 5, "the kind label is searchable");
  assert.equal(searchQuotes("  ").length, 0);
  const china = quotesFor({ region: "trung_hoa" });
  assert.equal(china.length, 24);
  assert.ok(quotesFor({ region: "chau_au", format: "rethink" }).every((q) => q.region === "chau_au" && q.format === "rethink"));
  const used = china.slice(1).map((q) => q.id);
  assert.equal(pickUnusedQuote(china, used, () => 0.7)?.id, china[0]!.id);
  assert.equal(pickUnusedQuote(china, china.map((q) => q.id)), undefined);
});

test("the clip plan: hook → mistake → turning → the saying → application → awakening", () => {
  for (const shots of [4, 5, 6, 7, 8, 10, 12]) {
    for (const q of [findQuote("vn_02")!, findQuote("eu_17")!]) {
      const plan = quoteActPlan(shots, q);
      assert.equal(plan[0]!.act, "hook");
      assert.equal(plan.at(-1)!.act, "awakening");
      assert.equal(plan.at(-1)!.to, shots, `${shots} clips are all used`);
      for (let i = 1; i < plan.length; i++) assert.equal(plan[i]!.from, plan[i - 1]!.to + 1, "contiguous");
      assert.equal(plan.filter((s) => s.act === "saying").length, 1, "one saying slot");
    }
  }
  assert.deepEqual(quoteActPlan(6, findQuote("vn_02")).map((s) => [s.act, s.from, s.to]), [["hook", 1, 1], ["rising", 2, 3], ["turning", 4, 4], ["saying", 5, 5], ["awakening", 6, 6]]);
  const rethink = quoteActPlan(6, findQuote("eu_17"));
  assert.deepEqual(rethink.find((s) => s.act === "saying"), { act: "saying", from: 4, to: 5, label_vi: "Lời xưa", purpose_en: rethink.find((s) => s.act === "saying")!.purpose_en }, "a correction gets two clips to be said");
  assert.equal(quoteActPlan(99).at(-1)!.to, QUOTE_MAX_SHOTS);
  assert.equal(quoteActPlan(1).at(-1)!.to, QUOTE_MIN_SHOTS);
});

test("cast: each role's gender follows the story; names from the card; an elder joins to speak it", () => {
  const girl = findQuote("vn_02")!;
  assert.deepEqual(quoteRoleGenders(girl), { main: "female", elder: "male", parent: "female" });
  const cast = quoteStoryCast({ quoteId: girl.id, quote: girl, names: { main: "Thảo" }, voice: "narrator" });
  assert.deepEqual(cast.map((c) => [c.role, c.name]), [["main", "Thảo"], ["elder", "Ông Bảy"], ["parent", "Hiền"]]);
  assert.match(cast[0]!.appearance, /young woman/);
  const office = findQuote("vn_29")!;
  assert.ok(!office.roles.includes("elder"));
  assert.ok(quoteStoryCast({ quoteId: office.id, quote: office, names: {}, voice: "elder" }).some((c) => c.role === "elder"), "the elder who speaks the saying joins the cast");
  assert.equal(quoteStoryCast({ quoteId: "vn_14", quote: findQuote("vn_14"), names: {}, voice: "narrator" }).find((c) => c.role === "child")!.isChild, true);
});

test("attribution, caption and study card", () => {
  assert.equal(quoteSpokenAttribution(findQuote("vn_02")!), "Tục ngữ Việt Nam");
  assert.equal(quoteSpokenAttribution(findQuote("tq_01")!), "Khổng Tử, Luận ngữ");
  assert.match(quoteSpokenAttribution(findQuote("eu_17")!), /thường được cho là của Albert Einstein/);
  assert.equal(quoteCaption(findQuote("vn_02")!), "“Có công mài sắt, có ngày nên kim”\n— Tục ngữ Việt Nam");
  assert.match(quoteCaption(findQuote("eu_17")!), /⚠️ Thường bị gán cho Albert Einstein/);
  const card = quoteStudyCard(findQuote("tq_14")!);
  assert.match(card, /^LỜI XƯA – CHUYỆN NAY — Biết người biết ta, trăm trận không nguy\./);
  assert.match(card, /Hiểu cho đúng: .*bách chiến bất đãi/);
  assert.match(card, /Câu hỏi suy ngẫm:\n1\. .+\?\n2\. .+\?$/);
});

const entry = findQuote("tq_01")!;
const config: QuoteStoryConfig = { ...DEFAULT_QUOTE_STORY, quoteId: entry.id, quote: entry, shots: 6 };

test("the planner contract: verbatim saying, attribution, never the author, no text on screen, safety", () => {
  const d = quoteStoryDirective(config);
  assert.match(d, /^TIMELESS SAYING STORY \(HARD\)/);
  assert.match(d, /6 clips × 10 s = 60 s/);
  assert.match(d, /SPEAK IT VERBATIM in clip 5: «Điều mình không muốn, chớ làm cho người khác\.» — then the attribution «Khổng Tử, Luận ngữ»/);
  assert.match(d, /NEVER SHOW THE AUTHOR: no actor, portrait, statue, AI likeness or imitated voice of Khổng Tử/);
  assert.match(d, /NO TEXT ON SCREEN/);
  assert.match(d, /WHO SPEAKS IT: a warm narrator voice-over/);
  assert.match(quoteStoryDirective({ ...config, voice: "elder" }), /WHO SPEAKS IT: Ông Bảy says it in natural dialogue/);
  assert.match(quoteStoryDirective({ ...config, voice: "main" }), /inner voice/);
  assert.match(d, /treat religious sources with reverence/);
  assert.match(d, /no political leaders/);
  const wrong = quoteStoryDirective({ ...config, quoteId: "eu_17", quote: findQuote("eu_17") });
  assert.match(wrong, /THINK-AGAIN FORMAT \(misattributed\)/);
  assert.match(wrong, /say plainly that Albert Einstein did not say it/);
  assert.match(wrong, /often wrongly credited to Albert Einstein/);
  assert.match(wrong, /Commonly credited to Albert Einstein, wrongly; true origin:/);
  assert.doesNotMatch(wrong, /Source: Albert Einstein/, "the famous name is never given as the source");
  assert.match(quoteStudyCard(findQuote("eu_17")!), /Xuất xứ: thường bị gán cho Albert Einstein — /);
  assert.match(quoteStoryDirective({ ...config, quoteId: undefined, quote: undefined, request: "Tự gõ" }), /attribute it to no one/);
  assert.equal(quoteStoryDirective(null), "");
});

test("story idea, writers' room seed, normalisation, the library wins on the server", () => {
  const idea = quoteStoryIdea(config);
  assert.equal((idea.match(/📜 Lời xưa/g) ?? []).length, 1);
  assert.match(idea, /6 shot × 10 giây = 1 phút/);
  assert.match(idea, /không viết chữ lên hình/);
  assert.match(quoteRoomSeed(config), /NGUYÊN VĂN/);
  const n = normalizeQuoteStory({ shots: 99, voice: "x", tone: "y", names: { main: " Ngân ", nope: "z" }, quoteId: entry.id, quote: { ...entry, text: "" } })!;
  assert.equal(n.shots, QUOTE_MAX_SHOTS);
  assert.equal(n.voice, "narrator");
  assert.equal(n.tone, "warm");
  assert.deepEqual(n.names, { main: "Ngân" });
  assert.equal(n.quote?.text, entry.text, "an incomplete snapshot falls back to the library");
  const tampered = withLibraryQuote({ ...config, quote: { ...entry, text: "Bịa ra" } });
  assert.equal(tampered.quote?.text, entry.text, "the client cannot change the wording or the source");
});

test("long videos follow the saying plan", () => {
  const input = { quote_story: { ...config, shots: 12 } };
  assert.match(clipPurpose(input, 1, 12), /^HOOK/);
  assert.match(clipPurpose(input, 7, 12), /^LỜI XƯA .*Speak the saying VERBATIM: «Điều mình không muốn/);
  assert.match(clipPurpose(input, 12, 12), /^TỈNH THỨC/);
});
