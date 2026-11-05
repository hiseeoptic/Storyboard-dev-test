import assert from "node:assert/strict";
import test from "node:test";
import { WHINE_LEVELS, WHINY_GROUPS, WHINY_SCENES, findScene, pickFreshScene, sceneCountByGroup, scenesFor, searchScenes, withLibraryScene } from "./whiny-scenes.ts";
import { WHINY_BRIEF_MARK, kidShortName, localizeScene, sceneOf, whinySceneBriefVi, whinyShotPlanVi } from "./whiny-perform.ts";
import { AI_LABEL_VI, DEFAULT_CUTE_KIDS, FAMILY_MEMBERS, VIRAL_FORMATS, cuteKidsDirective, cuteKidsRoomSeed, cuteKidsStoryIdea, labelCuteKidsPosts, normalizeCuteKids, type CuteKidsConfig } from "../cute-kids.ts";
import { childSafeText } from "../child-safe-wording.ts";

const words = (line: string) => line.split(/\s+/).filter(Boolean).length;

/** The config the card builds when a scene is picked. */
function withScene(id: string, patch: Partial<CuteKidsConfig> = {}): CuteKidsConfig {
  const scene = findScene(id)!;
  const config: CuteKidsConfig = {
    ...DEFAULT_CUTE_KIDS,
    goal: "fun",
    kidAge: "young",
    family: [...new Set([...DEFAULT_CUTE_KIDS.family, ...scene.cast])],
    shots: scene.shots,
    format: scene.format,
    traits: ["sweet_whiny", "fake_cry", "clever"],
    sceneId: scene.id,
    scene,
    ...patch,
  };
  return { ...config, request: patch.request ?? whinySceneBriefVi(scene, { kidName: config.kidName, dialect: config.dialect, shots: config.shots }) };
}

test("the library: 255 whiny moments of a 4–5-year-old in 17 trigger groups", () => {
  assert.equal(WHINY_SCENES.length, 255);
  assert.equal(WHINY_GROUPS.length, 17);
  for (const g of sceneCountByGroup()) assert.equal(g.count, 15, `${g.id} has 15 scenes`);
  for (const field of ["id", "title", "hook", "punch"] as const) {
    assert.equal(new Set(WHINY_SCENES.map((s) => s[field].toLowerCase())).size, WHINY_SCENES.length, `unique ${field}s`);
  }
  const formats = new Set(VIRAL_FORMATS.map((f) => f.id));
  for (const s of WHINY_SCENES) {
    for (const field of ["title", "place", "hook", "whine", "punch"] as const) assert.ok(s[field].trim().length > 3, `${s.id}.${field}`);
    assert.ok(s.naLines.length >= 2 && s.naLines.length <= 4, `${s.id} has 2–4 lines for the kid`);
    for (const line of s.naLines) assert.ok(words(line) <= 6, `${s.id}: «${line}» is at most 6 words`);
    assert.ok(s.adultLines.length <= 2, s.id);
    assert.ok(s.cast.length >= 1 && s.cast.every((m) => FAMILY_MEMBERS.includes(m)), `${s.id} cast`);
    assert.ok(s.shots === 2 || s.shots === 3, s.id);
    assert.ok(WHINE_LEVELS.includes(s.level), s.id);
    assert.ok(formats.has(s.format), `${s.id} format ${s.format} exists`);
  }
  for (const level of WHINE_LEVELS) assert.ok(WHINY_SCENES.filter((s) => s.level === level).length >= 20, `${level} scenes`);
  assert.ok(WHINY_SCENES.filter((s) => s.shots === 2).length >= 80 && WHINY_SCENES.filter((s) => s.shots === 3).length >= 80, "both 2- and 3-clip scenes");
  for (const m of ["dad", "mom", "grandpa", "grandma", "baby", "sibling", "friend", "dog", "cat"] as const) {
    assert.ok(WHINY_SCENES.some((s) => s.cast.includes(m)), `${m} appears in some scenes`);
  }
});

test("child safety in every scene: no refused or unsafe words, safe food, the baby always held", () => {
  const banned: Array<[RegExp, string]> = [
    [/(?<!\p{L})(?:hôn|thơm má|tắm|bồn tắm|đồ bơi|môi|đùi|mông|cởi)(?!\p{L})/iu, "words the video model refuses next to a child"],
    [/(?<!\p{L})(?:ma|quái vật|ông kẹ)(?!\p{L})/iu, "nothing scary"],
    [/(?<!\p{L})(?:đánh đòn|đánh con|phạt|dọa|bỏ rơi|mẹ đi đây|bố đi đây)(?!\p{L})/iu, "no punishment, threats or abandonment"],
    [/(?<!\p{L})(?:nho nguyên|kẹo cứng|kẹo dẻo|bỏng ngô|kẹo cao su|rượu|bia|nước tăng lực)(?!\p{L})/iu, "no choking-hazard food or drinks for adults"],
    [/(?<!\p{L})dao(?! nhựa)(?!\p{L})|bếp ga|(?<!\p{L})lửa(?!\p{L})/iu, "no knives or fire near the child"],
  ];
  for (const s of WHINY_SCENES) {
    const text = [s.title, s.place, s.hook, s.whine, s.punch, ...s.naLines, ...s.adultLines].join(" ");
    for (const [re, why] of banned) assert.doesNotMatch(text, re, `${s.id}: ${why}`);
    if (s.cast.includes("baby")) assert.match(`${s.place} ${s.hook}`, /em bé|em\b/iu, `${s.id} shows where the baby is`);
  }
  // The kid's "coffee" is milk.
  assert.match(findScene("dp01")!.punch, /sữa ấm/);
  // Feeding scenes cool the bite and keep it small.
  for (const id of ["bq01", "gt10", "ob06"]) assert.match(findScene(id)!.punch, /thổi nguội/, id);
});

test("every scene's contract is free of wording the video model refuses", () => {
  for (const s of WHINY_SCENES) {
    for (const dialect of ["north", "south"] as const) {
      const d = cuteKidsDirective(withScene(s.id, { dialect }));
      assert.equal(childSafeText(d), d, `${s.id} ${dialect}`);
      assert.match(d, /NHÕNG NHẼO SCENE \(HARD/, s.id);
    }
  }
});

test("the contract: the scene, the four-beat pretend cry, safety for food, affection and big tantrums", () => {
  const d = cuteKidsDirective(withScene("bq01"));
  assert.match(d, /NHÕNG NHẼO SCENE \(HARD — the reel is this scene\): "Bố ăn vụng chả giò"/);
  assert.match(d, /HOOK \(0–2 s\): Bố đang rán chả giò/);
  assert.match(d, /THE BUTTON \(last clip — the payoff the viewer waits for\): Bố cuống, thổi nguội một miếng nhỏ/);
  assert.match(d, /KEY LINES .*«Bố ăn vụng!» · «Mẹ ơiii! Bố ăn vụng!»/);
  for (const beat of ["THE WIND-UP", "THE WAIL", "THE CHECK", "THE SWITCH-OFF"]) assert.ok(d.includes(beat), beat);
  assert.match(d, /PERFORMED LIKE A REAL 4–5-YEAR-OLD/);
  assert.match(d, /PRETEND, NEVER REAL DISTRESS/);
  assert.match(d, /FOOD WITH A 4–5-YEAR-OLD: an adult offers a small, cooled bite/);
  assert.match(d, /Format "Bắt quả tang – đòi méc mẹ"/);
  assert.match(cuteKidsDirective(withScene("gt01")), /AFFECTION ON SCREEN: grown-ups show love only with a side hug/);
  assert.match(cuteKidsDirective(withScene("tc02")), /THE BIG WAIL — Bé Na plops down onto the soft rug, mattress or sofa \(never near furniture corners, stairs, the stove or hot food\)/);
  const light = cuteKidsDirective(withScene("bq04"));
  assert.match(light, /WHINY, NOT CRYING \(level: mè nheo/);
  assert.doesNotMatch(light, /THE WAIL/);
  assert.match(cuteKidsDirective(withScene("bq04", { whine: "big" })), /THE BIG WAIL/, "the card's level wins over the scene's");
  // The pretend cry is directed for every younger kid with the khóc nhè trait, even without a scene.
  assert.match(cuteKidsDirective({ ...DEFAULT_CUTE_KIDS, request: "Bé đòi kẹo", kidAge: "young" }), /THE SWITCH-OFF/);
  assert.doesNotMatch(cuteKidsDirective({ ...DEFAULT_CUTE_KIDS, request: "Bé đòi kẹo", kidAge: "middle" }), /THE SWITCH-OFF/, "8–10 keep the dramatic groan instead");
  assert.doesNotMatch(cuteKidsDirective({ ...DEFAULT_CUTE_KIDS, request: "Bé đòi kẹo", traits: ["clever"] }), /THE SWITCH-OFF/, "no cry without the trait");
});

test("clip plans for 2, 3 and longer reels", () => {
  const s = findScene("gt01")!;
  const two = whinyShotPlanVi(s, 2);
  assert.equal(two.length, 2);
  assert.match(two[0]!, /^Shot 1 — Hook & cò súng: Bố ôm vai mẹ.* Nhõng nhẽo bắt đầu:/);
  assert.match(two[1]!, /^Shot 2 — Đỉnh điểm & cú chốt:.*Bố bế bổng Na lên/);
  const three = whinyShotPlanVi(s, 3);
  assert.deepEqual(three.map((x) => x.split(" — ")[1]!.split(":")[0]), ["Hook & cò súng", "Nhõng nhẽo leo thang (khóc nhè 4 nhịp)", "Cú chốt"]);
  const five = whinyShotPlanVi(s, 5);
  assert.equal(five.length, 5);
  assert.match(five[3]!, /^Shot 4 — Nhõng nhẽo đỉnh điểm/);
  assert.match(five[4]!, /^Shot 5 — Cú chốt/);
  assert.match(cuteKidsDirective(withScene("gt01", { shots: 2 })), /CLIP PLAN \(2 clips\): Shot 1 — Hook/);
});

test("the brief: the kid's own name and the Southern dialect", () => {
  const s = findScene("bq11")!;
  const north = whinySceneBriefVi(s);
  assert.ok(north.startsWith(`${WHINY_BRIEF_MARK} Anh Tin lén xem hoạt hình (🕵️ Bắt quả tang người lớn)`));
  assert.match(north, /Nhân vật: Na \(4–5 tuổi\), Anh Tin, Mẹ\./);
  assert.match(north, /Na nói \(mỗi câu ≤ 6 từ\): “Anh xem hoạt hình!”/);
  const south = whinySceneBriefVi(findScene("bq01")!, { dialect: "south", kidName: "Bé Bin" });
  assert.match(south, /Ba đang rán chả giò/);
  assert.match(south, /Bin nói \(mỗi câu ≤ 6 từ\): “Ba ăn vụng!”/);
  assert.doesNotMatch(south, /(?<!\p{L})(?:Bố|Na)(?!\p{L})/u);
  assert.match(whinySceneBriefVi(s, { dialect: "south" }), /Anh Hai/);
  assert.match(whinySceneBriefVi(s, { level: "big" }), /Mức nhõng nhẽo: 🌪️ Ăn vạ lăn ra · 3 shot × 10 giây\./);
  assert.match(whinySceneBriefVi(s, { shots: 2 }), /Mức nhõng nhẽo: 😭 Khóc nhè · 2 shot × 10 giây\./);
  assert.equal(kidShortName("Bé Na"), "Na");
  assert.equal(kidShortName(""), "Na");
  assert.equal(localizeScene("Nam và Na", { kidName: "Su" }), "Nam và Su", "only the whole word");
  assert.match(cuteKidsStoryIdea(withScene("bq01")), /🥺 Nhõng nhẽo — Bố ăn vụng chả giò/);
});

test("the server keeps a scene snapshot, the library wins, teach mode and older kids ignore it", () => {
  const config = withScene("cb01");
  const n = normalizeCuteKids(JSON.parse(JSON.stringify(config)))!;
  assert.equal(n.sceneId, "cb01");
  assert.equal(n.scene?.title, "Miếng bánh nhỏ hơn anh");
  assert.equal(normalizeCuteKids({ ...config, scene: { ...config.scene!, id: "other" } })!.scene, undefined, "a mismatched snapshot is dropped");
  assert.equal(normalizeCuteKids({ ...config, scene: { ...config.scene!, hook: "" } })!.scene, undefined, "an incomplete snapshot is dropped");
  assert.equal(normalizeCuteKids({ ...config, whine: "huge" })!.whine, undefined);
  assert.equal(normalizeCuteKids({ ...config, whine: "big" })!.whine, "big");
  const tampered = withLibraryScene({ ...config, scene: { ...config.scene!, punch: "Bịa ra" } });
  assert.equal(tampered.scene?.punch, findScene("cb01")!.punch);
  assert.equal(sceneOf({ ...config, goal: "teach" }), undefined);
  assert.doesNotMatch(cuteKidsDirective({ ...config, goal: "teach" }), /NHÕNG NHẼO SCENE/);
  assert.doesNotMatch(cuteKidsDirective({ ...config, kidAge: "middle" }), /NHÕNG NHẼO SCENE/, "8–10-year-olds do not get the toddler-style scene");
});

test("search, groups, the next unused scene, the writers' room and the captions", () => {
  assert.equal(searchScenes("an vung")[0]!.id, "bq01", "accents optional, titles first");
  assert.equal(searchScenes("cun tha dep")[0]!.id, "tp03");
  assert.ok(searchScenes("thu cung").length >= 15, "the group label is searchable");
  assert.equal(searchScenes("  ").length, 0);
  assert.equal(scenesFor("pet").length, 15);
  const caught = scenesFor("caught");
  assert.equal(pickFreshScene(caught.slice(1).map((s) => s.id), "caught", () => 0.9)?.id, caught[0]!.id);
  assert.ok(pickFreshScene(WHINY_SCENES.map((s) => s.id)), "all made: start again");
  const room = cuteKidsRoomSeed(withScene("gn02"));
  assert.match(room, /Tình huống nhõng nhẽo: Đòi thêm một truyện nữa/);
  assert.match(room, /Khóc nhè 4 nhịp như trẻ thật/);
  const posts = { tiktok: { caption: "Na đòi truyện", hashtags: ["#bena"] }, youtube_shorts: { description: "Shorts" }, facebook_reel: { caption: "Reel" } };
  labelCuteKidsPosts(posts, withScene("gn02"));
  assert.match(posts.tiktok.caption, /👇 Nhà bạn có “bé Na” nào nhõng nhẽo y chang không\?/);
  assert.ok(posts.tiktok.caption.endsWith(AI_LABEL_VI));
  assert.deepEqual(posts.tiktok.hashtags, ["#bena", "#bécưng", "#nhõngnhẽo"]);
});
