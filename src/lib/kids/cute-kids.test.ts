import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_LABEL_VI,
  buildEpisodeIdeasPrompt,
  normalizeEpisodeIdeas,
  DEFAULT_CUTE_KIDS,
  cuteKidsDirective,
  cuteKidsRoomSeed,
  cuteKidsStoryIdea,
  detectFormat,
  familyCast,
  labelAiSocialPosts,
  normalizeCuteKids,
  type CuteKidsConfig,
} from "./cute-kids.ts";

const config = (patch: Partial<CuteKidsConfig> = {}): CuteKidsConfig => ({ ...DEFAULT_CUTE_KIDS, ...patch });

test("the request picks the viral format", () => {
  assert.equal(detectFormat("Bé ghen tị khi bố ôm mẹ")?.id, "jealous");
  assert.equal(detectFormat("bé mặc cả đòi kẹo với mẹ")?.id, "bargain");
  assert.equal(detectFormat("bé giả vờ ngủ để chơi điện thoại")?.id, "fake_sleep");
  assert.equal(detectFormat("bé ngủ gật khi ăn cơm")?.id, "dozing");
  assert.equal(detectFormat("hôm nay một ngày bình thường"), undefined);
  assert.equal(detectFormat("Bé ghen khi bố ôm mẹ".normalize("NFD"))?.id, "jealous");
});

test("the family cast puts the kid first, keeps pets out of the cast and follows the dialect", () => {
  const north = familyCast(config({ kidName: "Bơ", family: ["dad", "mom", "dog"] }));
  assert.deepEqual(north.map((c) => c.name), ["Bơ", "Bố", "Mẹ"]);
  assert.equal(north[0]!.isChild, true);
  assert.match(north[0]!.appearance, /6–7 years old/);
  const south = familyCast(config({ dialect: "south", family: ["dad", "baby"] }));
  assert.deepEqual(south.map((c) => c.name), ["Bé Na", "Ba", "Em bé"]);
  assert.equal(south[2]!.isChild, true);
  assert.match(cuteKidsStoryIdea(config({ family: ["mom", "cat"] })), /thú cưng: Mèo/);
});

test("a toddler speaks in three words at most; a 6-year-old gets a punchline", () => {
  const toddler = cuteKidsDirective(config({ kidAge: "toddler", request: "bé ghen khi bố hôn mẹ" }));
  assert.match(toddler, /at most 3 words/);
  assert.match(toddler, /toddles/);
  assert.match(toddler, /Ghen tị khi bố mẹ tình cảm/);
  const school = cuteKidsDirective(config({ kidAge: "school" }));
  assert.match(school, /at most 10 words/);
  assert.match(school, /punchline/);
});

test("child safety and the capture look are always in the directive", () => {
  const phone = cuteKidsDirective(config());
  assert.match(phone, /CHILD SAFETY/);
  assert.match(phone, /CHILD-SAFE WORDING/);
  assert.doesNotMatch(phone, /\b(kiss|lips?|pout|undress|swimwear|bath|limbs|suggestive)\b/i, "no words that get a child prompt refused");
  assert.doesNotMatch(cuteKidsDirective(config()), /BABY ON SCREEN/);
  assert.match(cuteKidsDirective(config({ family: ["mom", "baby"] })), /BABY ON SCREEN: the baby is always in an adult's arms/);
  assert.match(cuteKidsRoomSeed(config({ family: ["mom", "baby"] })), /Em bé luôn được bế/);
  assert.match(phone, /full everyday sentences/);
  assert.match(phone, /parent's smartphone/);
  assert.match(cuteKidsDirective(config({ filming: "cinematic" })), /cinematic family look/);
  assert.match(cuteKidsDirective(config({ dialect: "south" })), /"hông"/);
  assert.equal(cuteKidsDirective(undefined), "");
  assert.match(cuteKidsRoomSeed(config({ shots: 4 })), /4 shot × 10 giây/);
});

test("social captions get the AI label once", () => {
  const posts = { tiktok: { caption: "Bé ghen kìa 😂" }, youtube_shorts: { description: "" }, facebook_reel: { caption: "x" } };
  labelAiSocialPosts(posts);
  labelAiSocialPosts(posts);
  assert.equal(posts.tiktok.caption.split(AI_LABEL_VI).length, 2);
  assert.equal(posts.youtube_shorts.description, AI_LABEL_VI);
});

test("client configs are clamped and cleaned", () => {
  const c = normalizeCuteKids({ kidName: "  ", kidAge: "teen", family: ["dad", "dad", "alien"], shots: 9, filming: "drone", format: "nope" })!;
  assert.equal(c.kidName, DEFAULT_CUTE_KIDS.kidName);
  assert.equal(c.kidAge, "school");
  assert.deepEqual(c.family, ["dad"]);
  assert.equal(c.shots, 4);
  assert.equal(c.filming, "phone");
  assert.equal(c.format, "auto");
  assert.equal(normalizeCuteKids(null), undefined);
});

test("episode ideas: the prompt carries the kid, the family and safety; replies are cleaned", () => {
  const prompt = buildEpisodeIdeasPrompt(config({ kidName: "Su", kidAge: "toddler", family: ["mom", "dog"] }), ["Bé ghen"]);
  assert.match(prompt, /Su, bé gái 2–3 tuổi/);
  assert.match(prompt, /pets: Cún/);
  assert.match(prompt, /Do not repeat these: Bé ghen/);
  assert.match(prompt, /CHILD SAFETY/);
  const ideas = normalizeEpisodeIdeas({ ideas: [{ title: "A", request: "x" }, { title: "a", request: "y" }, { title: "", request: "z" }, { title: "B", request: "w" }] });
  assert.deepEqual(ideas.map((i) => i.title), ["A", "B"]);
  assert.deepEqual(normalizeEpisodeIdeas("nope"), []);
});
