import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QUOTE_STORY,
  FIELD_LABEL,
  QUOTE_AUTHOR_FIELD,
  QUOTE_FIELDS,
  QUOTE_LIBRARY,
  QUOTE_MAX_SHOTS,
  QUOTE_MIN_SHOTS,
  QUOTE_REGIONS,
  QUOTE_THEMES,
  findQuote,
  isSeedOnly,
  normalizeQuoteStory,
  pickUnusedQuote,
  quoteActPlan,
  quoteCaption,
  quoteCounts,
  quoteField,
  quoteRequestFromEntry,
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

const FULL = QUOTE_LIBRARY.filter((q) => !isSeedOnly(q));
const SEEDS = QUOTE_LIBRARY.filter(isSeedOnly);

test("the library: 284 sourced sayings — 136 full stories and 148 reference entries — from Việt Nam, Trung Hoa, Châu Âu, Mỹ, the world and business leaders", () => {
  assert.equal(QUOTE_LIBRARY.length, 284);
  assert.equal(FULL.length, 136);
  assert.equal(SEEDS.length, 148);
  for (const field of ["id", "text"] as const) {
    assert.equal(new Set(QUOTE_LIBRARY.map((q) => q[field].toLowerCase())).size, QUOTE_LIBRARY.length, `unique ${field}s`);
  }
  assert.equal(new Set(FULL.map((q) => q.hook)).size, FULL.length, "unique hooks");
  assert.equal(new Set(SEEDS.map((q) => q.seed)).size, SEEDS.length, "unique story ideas");
  const { regions, themes, formats } = quoteCounts();
  assert.deepEqual(quoteCounts(FULL).regions.map((r) => [r.id, r.count]), [["viet_nam", 40], ["trung_hoa", 24], ["chau_au", 20], ["my", 20], ["the_gioi", 8], ["doanh_nhan", 24]]);
  assert.deepEqual(quoteCounts(SEEDS).regions.map((r) => [r.id, r.count]), [["viet_nam", 24], ["trung_hoa", 27], ["chau_au", 47], ["my", 28], ["the_gioi", 13], ["doanh_nhan", 9]]);
  assert.deepEqual(regions.map((r) => [r.id, r.count]), [["viet_nam", 64], ["trung_hoa", 51], ["chau_au", 67], ["my", 48], ["the_gioi", 21], ["doanh_nhan", 33]]);
  for (const t of themes) assert.ok(t.count >= 5, `${t.id} has sayings`);
  assert.ok(formats.find((f) => f.id === "rethink")!.count >= 40, "enough \"Nghĩ lại cho đúng\" stories");
  const themeIds = new Set(QUOTE_THEMES.map((t) => t.id));
  for (const q of QUOTE_LIBRARY) {
    assert.ok(QUOTE_REGIONS.includes(q.region) && themeIds.has(q.theme), q.id);
    for (const field of ["text", "source", "meaning", "takeaway", "place"] as const) {
      assert.ok(q[field].trim().length > 5, `${q.id}.${field}`);
    }
    if (isSeedOnly(q)) {
      // Reference entries: one line of story idea, its own field, no written beats.
      assert.match(q.id, /^s_/, q.id);
      assert.ok((q.seed ?? "").trim().length > 30, `${q.id}.seed`);
      assert.ok(q.field && QUOTE_FIELDS.includes(q.field), `${q.id}.field`);
      for (const field of ["hook", "situation", "mistake", "turning", "awakening"] as const) assert.equal(q[field], "", `${q.id}.${field}`);
      assert.equal(q.questions.length, 0, q.id);
    } else {
      for (const field of ["hook", "situation", "mistake", "turning", "awakening"] as const) {
        assert.ok(q[field].trim().length > 5, `${q.id}.${field}`);
      }
      assert.equal(q.questions.length, 2, q.id);
    }
    assert.ok(q.takeaway.split(/\s+/).length <= 30, `${q.id} takeaway is one short line`);
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

test("business leaders and speakers: sourced lines, famous fakes corrected, no endorsement", () => {
  const shelf = quotesFor({ region: "doanh_nhan" });
  assert.equal(shelf.length, 33);
  assert.ok(shelf.some((q) => q.author === "Warren Buffett" && /1986/.test(q.source)));
  const horses = findQuote("dn_13")!;
  assert.equal(horses.verification, "misattributed");
  assert.match(horses.misread!, /Không có bằng chứng Henry Ford/);
  assert.match(findQuote("dn_24")!.misread!, /Alan Kay/);
  assert.match(findQuote("dn_03")!.source, /Benjamin Graham/, "Buffett's own credit to Graham is kept");
  assert.equal(findQuote("dn_10")!.verification, "paraphrase", "Jack Ma's line is told in many wordings");
  for (const q of shelf) assert.ok(q.gender && Object.keys(q.gender).length >= 1, `${q.id} states who is who`);
  const d = quoteStoryDirective({ ...DEFAULT_QUOTE_STORY, quoteId: "dn_01", quote: findQuote("dn_01") });
  assert.match(d, /REAL BUSINESS FIGURE: never imply that Warren Buffett endorses/);
  assert.match(d, /no financial advice/);
  assert.doesNotMatch(quoteStoryDirective({ ...DEFAULT_QUOTE_STORY, quoteId: "vn_02", quote: findQuote("vn_02") }), /REAL BUSINESS FIGURE/);
});

test("search, filters and the next unused saying", () => {
  assert.ok(searchQuotes("khong tu").some((q) => q.author === "Khổng Tử"), "accents are optional");
  assert.ok(searchQuotes("Seneca").every((q) => q.author === "Seneca"));
  assert.ok(searchQuotes("ca dao").length >= 5, "the kind label is searchable");
  assert.equal(searchQuotes("  ").length, 0);
  const china = quotesFor({ region: "trung_hoa" });
  assert.equal(china.length, 51);
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

test("fields: who said it — every author has one field; filters and counts by field", () => {
  for (const q of FULL) {
    if (q.author && q.verification !== "folk") assert.ok(QUOTE_AUTHOR_FIELD[q.author], `${q.author} (${q.id}) has a field`);
  }
  const byAuthor = new Map<string, Set<string>>();
  for (const q of QUOTE_LIBRARY) {
    if (!q.author) continue;
    byAuthor.set(q.author, (byAuthor.get(q.author) ?? new Set()).add(quoteField(q)));
  }
  for (const [author, fields] of byAuthor) assert.equal(fields.size, 1, `${author} is in one field: ${[...fields].join(", ")}`);
  assert.ok(byAuthor.size >= 120, "more than 120 named people and works");
  assert.equal(quoteField(findQuote("vn_02")!), "dan_gian");
  assert.equal(quoteField(findQuote("tq_01")!), "triet_gia");
  assert.equal(quoteField(findQuote("dn_01")!), "doanh_nhan");
  assert.equal(quoteField(findQuote("s_eu_36")!), "khoa_hoc");
  const { fields } = quoteCounts();
  assert.deepEqual(fields.map((f) => f.id), [...QUOTE_FIELDS]);
  for (const f of fields) assert.ok(f.count >= 3, `${f.id} has sayings`);
  assert.equal(fields.reduce((n, f) => n + f.count, 0), QUOTE_LIBRARY.length, "every saying is in exactly one field");
  const scientists = quotesFor({ field: "khoa_hoc" });
  assert.ok(scientists.length >= 20 && scientists.every((q) => quoteField(q) === "khoa_hoc"));
  assert.ok(scientists.some((q) => q.author === "Marie Curie") && scientists.some((q) => q.author === "Alan Turing"));
  assert.ok(quotesFor({ region: "my", field: "the_thao" }).some((q) => q.author === "Michael Jordan"));
  assert.ok(searchQuotes("nha khoa hoc curie").some((q) => q.author === "Marie Curie"), "the field label is searchable");
  assert.ok(searchQuotes("tieu nhan").some((q) => q.id === "s_tq_01"), "reference entries are searchable");
  assert.equal(FIELD_LABEL.the_thao, "🏅 Thể thao & khám phá");
});

test("reference entries: well-known corrections carry the true origin", () => {
  assert.match(findQuote("s_eu_26")!.misread!, /Evelyn Beatrice Hall/);
  assert.match(findQuote("s_eu_22")!.misread!, /không có trong tác phẩm/);
  assert.match(findQuote("s_eu_32")!.misread!, /Viện Viktor Frankl/);
  assert.match(findQuote("s_us_26")!.source, /Henry Stanley Haskins/);
  assert.match(findQuote("s_us_27")!.source, /H\. Jackson Brown/);
  assert.match(findQuote("s_us_12")!.source, /Sharon Begley/);
  assert.match(findQuote("s_tg_09")!.source, /Nicholas Klein/);
  assert.match(findQuote("s_tg_13")!.misread!, /chưa rõ/);
  assert.equal(findQuote("s_eu_17")!.format, "rethink", "\"what does not kill us\" is re-read, not glorified");
  assert.equal(findQuote("s_dn_02")!.format, "rethink");
  for (const q of SEEDS.filter((x) => x.verification === "misattributed")) {
    assert.ok((q.misread ?? "").length > 60, `${q.id} explains the true origin`);
    assert.match(quoteCaption(q), /⚠️ Thường bị gán cho /, `${q.id} caption warns`);
  }
});

test("a reference entry becomes a video: the writer builds the beats from the story idea", () => {
  const seed = findQuote("s_tq_01")!;
  assert.equal(isSeedOnly(seed), true);
  assert.equal(isSeedOnly(findQuote("tq_01")!), false);
  const cfg: QuoteStoryConfig = { ...DEFAULT_QUOTE_STORY, quoteId: seed.id, quote: seed, shots: 6 };
  const brief = quoteRequestFromEntry(seed);
  assert.match(brief, /Gợi ý câu chuyện: /);
  assert.doesNotMatch(brief, /Hook: |Tình huống: /, "no empty story lines");
  const d = quoteStoryDirective(cfg);
  assert.match(d, /THE STORY \(write it from this idea\): /);
  assert.ok(d.includes(seed.seed!), "the idea is in the contract");
  assert.doesNotMatch(d, /HOOK: {1,2}SITUATION/, "no empty beats");
  assert.match(d, /SPEAK IT VERBATIM in clip 5: «Người quân tử đòi hỏi ở mình/);
  const card = quoteStudyCard(seed);
  assert.match(card, /Gợi ý câu chuyện: /);
  assert.doesNotMatch(card, /Câu hỏi suy ngẫm/);
  // The server keeps a seed snapshot and the library still wins.
  const n = normalizeQuoteStory({ ...cfg })!;
  assert.equal(n.quote?.seed, seed.seed);
  assert.equal(n.quote?.field, seed.field);
  assert.equal(withLibraryQuote({ ...cfg, quote: { ...seed, text: "Bịa ra" } }).quote?.text, seed.text);
  // Gender comes from the idea when it names the person.
  assert.equal(quoteRoleGenders(findQuote("s_us_13")!).main, "male");
  assert.equal(quoteRoleGenders(findQuote("s_tg_04")!).main, "female");
  // Long videos: no empty beat details.
  const input = { quote_story: { ...cfg, shots: 12 } };
  assert.match(clipPurpose(input, 1, 12), /The story idea: /);
  for (let i = 1; i <= 12; i++) assert.doesNotMatch(clipPurpose(input, i, 12), /: \.$|: $/, `clip ${i}`);
});
