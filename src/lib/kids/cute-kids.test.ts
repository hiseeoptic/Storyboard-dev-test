import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_LABEL_VI,
  buildEpisodeIdeasPrompt,
  normalizeEpisodeIdeas,
  DEFAULT_CUTE_KIDS,
  cuteKidsDirective,
  cuteKidsPerformanceNote,
  cuteKidsVoice,
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
  const c = normalizeCuteKids({ kidName: "  ", kidAge: "adult", family: ["dad", "dad", "alien"], shots: 9, filming: "drone", format: "nope" })!;
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

test("personality: nũng nịu, khóc nhè, khôn lanh and parents playing along are in the contract", () => {
  const d = cuteKidsDirective(config({ kidName: "Na" }));
  assert.match(d, /NŨNG NỊU \(whiny-sweet, coaxing\): Na sways side to side/);
  assert.match(d, /KHÓC NHÈ \/ ĂN VẠ/);
  assert.match(d, /peeks through her fingers/);
  assert.match(d, /KHÔN LANH/);
  assert.match(d, /PARENTS PLAY ALONG/);
  assert.match(d, /Default arc: nũng nịu ask/);
  assert.match(d, /"Bố ơiii~"/);
  assert.match(cuteKidsDirective(config({ dialect: "south" })), /"Ba ơiii~"/);
  assert.match(cuteKidsDirective(config({ kidGender: "boy", kidName: "Bin" })), /Bin scrunches his whole face/);
  const onlyClever = cuteKidsDirective(config({ traits: ["clever"] }));
  assert.doesNotMatch(onlyClever, /KHÓC NHÈ/);
  assert.doesNotMatch(onlyClever, /Default arc/);
  assert.match(cuteKidsStoryIdea(config()), /Tính cách bé: nũng nịu, khóc nhè \/ ăn vạ, khôn lanh; bố mẹ luôn hưởng ứng/);
  assert.match(cuteKidsRoomSeed(config()), /Bố mẹ luôn hưởng ứng/);
  assert.equal(detectFormat("bé ăn vạ đòi đi công viên")?.id, "whiny_ask");
  assert.deepEqual(normalizeCuteKids({ traits: ["clever", "nope", "clever"] })!.traits, ["clever"]);
  assert.deepEqual(normalizeCuteKids({})!.traits, ["sweet_whiny", "fake_cry", "clever"]);
});

test("voices: the kid gets a lively nũng nịu delivery, parents warm expressive voices", () => {
  const kid = cuteKidsVoice("Vietnamese, Northern dialect; bright child timbre, 290–360 Hz, playful and clear with restrained pitch variation.", { isKid: true, traits: ["sweet_whiny", "fake_cry"] });
  assert.doesNotMatch(kid, /restrained/);
  assert.match(kid, /with lively sing-song pitch rises/);
  assert.match(kid, /nũng nịu sing-song with drawn-out vowels, theatrical "huhu" sniffles/);
  assert.equal(cuteKidsVoice(kid, { isKid: true, traits: ["sweet_whiny", "fake_cry"] }), kid, "applied once");
  const dad = cuteKidsVoice("warm adult male timbre, relaxed with restrained pitch variation.", { isKid: false });
  assert.match(dad, /with warm, expressive natural pitch variation/);
  assert.match(cuteKidsPerformanceNote("Na"), /overrides any "restrained \/ never theatrical" rule for Na only/);
});

test("real child behaviour per age and serve-and-return with the parents are in the contract", () => {
  const toddler = cuteKidsDirective(config({ kidName: "Su", kidAge: "toddler" }));
  assert.match(toddler, /REAL TODDLER BEHAVIOUR \(what makes Su a real 2–3-year-old, not an AI doll\): she looks up at a parent's face before and after everything/);
  assert.match(toddler, /hides behind a parent's leg and peeks out/);
  assert.match(cuteKidsDirective(config({ kidAge: "young" })), /REAL 4–5-YEAR-OLD BEHAVIOUR: Bé Na tugs a parent's hand/);
  assert.match(cuteKidsDirective(config({ kidAge: "school", kidGender: "boy", kidName: "Bin" })), /REAL 6–7-YEAR-OLD BEHAVIOUR: Bin negotiates ticking points off on his fingers/);
  const d = cuteKidsDirective(config({ kidName: "Na" }));
  assert.match(d, /SERVE AND RETURN \(every clip is a back-and-forth, never a monologue\)/);
  assert.match(d, /gets an IMMEDIATE, visible "return" from a parent within a second/);
  assert.match(d, /at least two full exchanges per clip/);
  assert.match(cuteKidsDirective(config({ dialect: "south" })), /"Con muốn cái này hả\?"/);
  assert.match(cuteKidsRoomSeed(config({ kidAge: "toddler" })), /Tương tác qua lại như thật: .*đáp lại ngay.*nấp sau chân bố mẹ rồi ló ra cười/);
  const note = cuteKidsPerformanceNote("Su", ["sweet_whiny"], "toddler");
  assert.match(note, /Real child behaviour: looks up at the parent's face to check every reaction/);
  assert.match(note, /SERVE AND RETURN: every look, point, whine, word or hug from Su gets an instant warm return/);
  assert.doesNotMatch(cuteKidsPerformanceNote("Su"), /Real child behaviour/);
  assert.doesNotMatch(`${toddler} ${note}`, /\b(kiss|lips?|pout|undress|swimwear|bath|limbs|suggestive)\b/i);
});

test("8–10 and 11–12: age-true speech, behaviour, personality, voice and back-and-forth — never toddler-like", () => {
  const middle = cuteKidsDirective(config({ kidName: "Minh", kidGender: "boy", kidAge: "middle" }));
  assert.match(middle, /about 8–10 years old/);
  assert.match(middle, /at most 14 words/);
  assert.match(middle, /REAL 8–10-YEAR-OLD BEHAVIOUR: Minh argues with real logic/);
  assert.match(middle, /NĂN NỈ NGỌT \(sweet coaxing, age-true for 8–12\)/);
  assert.match(middle, /GIẢ VỜ "BI KỊCH"/);
  assert.doesNotMatch(middle, /NŨNG NỊU \(whiny-sweet|huhuhuuu|REAL TODDLER|SERVE AND RETURN \(every clip/);
  assert.match(middle, /BACK-AND-FORTH \(every clip is a real exchange, never a lecture\)/);
  assert.match(middle, /a playful eye-roll, a dramatic sigh/);
  assert.match(middle, /a real 8–10-year-old's voice — clear and lively/);
  assert.match(middle, /Default arc: sweet coaxing → a parent's playful "no" → a dramatic groan on the sofa/);
  const preteen = cuteKidsDirective(config({ kidName: "Linh", kidAge: "preteen" }));
  assert.match(preteen, /at most 16 words/);
  assert.match(preteen, /"Con lớn rồi mà!"/);
  assert.match(preteen, /REAL 11–12-YEAR-OLD BEHAVIOUR: Linh rolls her eyes/);
  assert.doesNotMatch(`${middle} ${preteen}`, /\b(kiss|lips?|pout|undress|swimwear|bath|limbs|suggestive)\b/i);
  assert.match(cuteKidsRoomSeed(config({ kidAge: "preteen" })), /Tương tác qua lại như thật: mỗi câu lý lẽ, cái thở dài/);
  // The big brother is older than the star; ages survive normalisation.
  assert.match(familyCast(config({ kidAge: "preteen", family: ["sibling"] }))[1]!.appearance, /older brother about 14–15 years old/);
  assert.match(familyCast(config({ kidAge: "school", family: ["sibling"] }))[1]!.appearance, /older brother about 9–10 years old/);
  assert.equal(normalizeCuteKids({ kidAge: "middle" })!.kidAge, "middle");
  assert.equal(normalizeCuteKids({ kidAge: "preteen" })!.kidAge, "preteen");
  // Voice and the video note follow the age.
  const voice = cuteKidsVoice("bright child timbre with restrained pitch variation.", { isKid: true, traits: ["sweet_whiny", "fake_cry"], kidAge: "middle" });
  assert.match(voice, /lively, natural pitch variation/);
  assert.match(voice, /sweet coaxing tones when asking, dramatic groans that melt into laughter/);
  assert.doesNotMatch(voice, /nũng nịu|huhu/);
  const note = cuteKidsPerformanceNote("Minh", ["sweet_whiny", "fake_cry", "clever"], "middle");
  assert.match(note, /a charming, age-true 8–10-year-old/);
  assert.match(note, /never toddler babble/);
  assert.match(note, /BACK-AND-FORTH: every look, sigh, argument or joke from Minh/);
  assert.doesNotMatch(note, /SERVE AND RETURN|huhu/);
  // 13–15: a teenager, still with the parents' warm back-and-forth.
  const teen = cuteKidsDirective(config({ kidName: "Khoa", kidGender: "boy", kidAge: "teen" }));
  assert.match(teen, /about 13–15 years old/);
  assert.match(teen, /at most 18 words/);
  assert.match(teen, /REAL 13–15-YEAR-OLD BEHAVIOUR: Khoa answers with a shrug/);
  assert.match(teen, /NĂN NỈ NGỌT \(sweet coaxing, age-true for 13–15\)/);
  assert.match(teen, /BACK-AND-FORTH/);
  assert.doesNotMatch(teen, /huhuhuuu|REAL TODDLER|\b(kiss|lips?|pout)\b/i);
  assert.match(familyCast(config({ kidAge: "teen", family: ["sibling"] }))[1]!.appearance, /older brother about 17–18 years old/);
  assert.equal(normalizeCuteKids({ kidAge: "teen" })!.kidAge, "teen");
  assert.match(cuteKidsPerformanceNote("Khoa", ["clever"], "teen"), /a charming, age-true 13–15-year-old/);
  // The card and the Vietnamese brief name the personality the way an 8–12-year-old shows it.
  assert.match(cuteKidsStoryIdea(config({ kidAge: "preteen" })), /Tính cách bé: năn nỉ ngọt, than thở "bi kịch", khôn lanh/);
  assert.match(cuteKidsRoomSeed(config({ kidAge: "middle" })), /than thở "bi kịch" cho vui \(nằm vật ra sofa/);
  assert.doesNotMatch(cuteKidsRoomSeed(config({ kidAge: "middle" })), /huhuhu|mếu máo/);
});
