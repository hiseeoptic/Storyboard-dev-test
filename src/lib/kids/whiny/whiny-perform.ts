// ============================================================
// NA NHÕNG NHẼO — how a picked scene and the whiny cry reach the writer and
// the storyboard: the Vietnamese brief for the request box, the clip plan for
// 2–3 (or more) clips, the hard contract (the scene, the four-beat pretend
// cry of a real 4–5-year-old, the safe-tantrum / food / affection rules) and
// the writers'-room lines. No scene data here (the library loads separately).
// ============================================================

import type { CuteKidsConfig, Dialect, FamilyMember, KidAge, KidTrait } from "../cute-kids.ts";
import { WHINE_LEVELS, WHINE_LEVEL_LABEL, WHINY_GROUPS, type WhineLevel, type WhinyGroup, type WhinyScene } from "./whiny-types.ts";

export { WHINE_LEVELS, WHINE_LEVEL_LABEL, WHINY_GROUPS, type WhineLevel, type WhinyGroup, type WhinyScene } from "./whiny-types.ts";

/** Kept here (not imported) so the cute-kids module and this one never load each other at start-up. */
const MEMBERS: readonly FamilyMember[] = ["dad", "mom", "grandpa", "grandma", "baby", "sibling", "friend", "dog", "cat"];

const MEMBER_VI: Record<FamilyMember, { north: string; south: string }> = {
  dad: { north: "Bố", south: "Ba" },
  mom: { north: "Mẹ", south: "Mẹ" },
  grandpa: { north: "Ông", south: "Ông" },
  grandma: { north: "Bà", south: "Bà" },
  baby: { north: "Em bé", south: "Em bé" },
  sibling: { north: "Anh Tin", south: "Anh Hai" },
  friend: { north: "Bạn Bống", south: "Bạn Bống" },
  dog: { north: "Cún", south: "Cún" },
  cat: { north: "Mèo", south: "Mèo" },
};

type SceneConfig = Pick<CuteKidsConfig, "goal" | "sceneId" | "scene">;

/** Fun mode: the picked scene (the snapshot carried by the config). */
export function sceneOf(config: SceneConfig): WhinyScene | undefined {
  return config.goal !== "teach" && config.scene && config.scene.id === config.sceneId ? config.scene : undefined;
}

export function groupLabel(group: WhinyGroup): string {
  return WHINY_GROUPS.find((g) => g.id === group)?.label ?? "";
}

/** "Bé Na" → "Na": the name the kid calls herself. */
export function kidShortName(kidName: string | undefined): string {
  return (kidName ?? "").trim().replace(/^(?:bé|Bé|BÉ)\s+/u, "").trim() || "Na";
}

/** The scene text with the kid's own name and the chosen dialect's kin words. */
export function localizeScene(text: string, opts: { kidName?: string; dialect?: Dialect } = {}): string {
  let out = text;
  const name = kidShortName(opts.kidName);
  if (name !== "Na") out = out.replace(/(?<!\p{L})Na(?!\p{L})/gu, name);
  if (opts.dialect === "south") {
    out = out
      .replace(/(?<!\p{L})anh Tin(?!\p{L})/gu, "anh Hai")
      .replace(/(?<!\p{L})Anh Tin(?!\p{L})/gu, "Anh Hai")
      .replace(/(?<!\p{L})Bố(?!\p{L})/gu, "Ba")
      .replace(/(?<!\p{L})bố(?!\p{L})/gu, "ba");
  }
  return out;
}

function castVi(scene: WhinyScene, dialect: Dialect): string {
  return scene.cast.map((m) => MEMBER_VI[m][dialect]).join(", ");
}

/** The scene as clips: 2 = hook + start of the whine / peak + button; 3 = hook / whine / button; more = a longer climb. */
export function whinyShotPlanVi(scene: WhinyScene, shots: number, opts: { kidName?: string; dialect?: Dialect } = {}): string[] {
  const L = (s: string) => localizeScene(s, opts);
  const n = Math.max(2, Math.round(shots) || scene.shots);
  if (n === 2) {
    return [
      `Shot 1 — Hook & cò súng: ${L(scene.hook)} Nhõng nhẽo bắt đầu: ${L(scene.whine)}`,
      `Shot 2 — Đỉnh điểm & cú chốt: khóc nhè lên cao nhất, hé mắt kiểm tra người lớn, rồi "công tắc tắt": ${L(scene.punch)}`,
    ];
  }
  const middle = n - 2;
  const plan = [`Shot 1 — Hook & cò súng: ${L(scene.hook)}`];
  for (let i = 1; i <= middle; i++) {
    const at = i + 1;
    if (middle === 1) plan.push(`Shot ${at} — Nhõng nhẽo leo thang (khóc nhè 4 nhịp): ${L(scene.whine)}`);
    else if (i === 1) plan.push(`Shot ${at} — Nhõng nhẽo nấc 1 (mè nheo, mặt méo dần): ${L(scene.whine)}`);
    else if (i === middle) plan.push(`Shot ${at} — Nhõng nhẽo đỉnh điểm: khóc nhè to, ngừng nửa giây hé mắt xem người lớn có phản ứng không, rồi khóc to hơn`);
    else plan.push(`Shot ${at} — Nhõng nhẽo nấc ${i}: người lớn thử dỗ một cách chưa ăn thua, bé càng lấn tới (vẫn đáng yêu, không ai mắng)`);
  }
  plan.push(`Shot ${n} — Cú chốt: ${L(scene.punch)}`);
  return plan;
}

export const WHINY_BRIEF_MARK = "🥺 Nhõng nhẽo —";

/** The Vietnamese brief that fills the request box when a scene is picked (editable). */
export function whinySceneBriefVi(scene: WhinyScene, opts: { kidName?: string; dialect?: Dialect; shots?: number; level?: WhineLevel } = {}): string {
  const dialect = opts.dialect ?? "north";
  const L = (s: string) => localizeScene(s, { kidName: opts.kidName, dialect });
  const name = kidShortName(opts.kidName);
  const shots = opts.shots && opts.shots >= 2 ? opts.shots : scene.shots;
  return [
    `${WHINY_BRIEF_MARK} ${L(scene.title)} (${groupLabel(scene.group)})`,
    `Bối cảnh: ${L(scene.place)}. Nhân vật: ${name} (4–5 tuổi)${scene.cast.length ? `, ${castVi(scene, dialect)}` : ""}.`,
    `Hook (0–2 giây): ${L(scene.hook)}`,
    `Nhõng nhẽo: ${L(scene.whine)}`,
    `Cú chốt: ${L(scene.punch)}`,
    `${name} nói (mỗi câu ≤ 6 từ): ${scene.naLines.map((x) => `“${L(x)}”`).join(" · ")}`,
    scene.adultLines.length ? `Người lớn: ${scene.adultLines.map((x) => `“${L(x)}”`).join(" · ")}` : "",
    `Mức nhõng nhẽo: ${WHINE_LEVEL_LABEL[opts.level ?? scene.level].vi} · ${shots} shot × 10 giây.`,
  ].filter(Boolean).join("\n");
}

export const hasWhinyBrief = (request: string) => request.includes(WHINY_BRIEF_MARK);

const FOOD_WORDS = /(?<!\p{L})(?:ăn vụng|ăn kem|ăn cơm|đút|bánh|kem|cơm|cháo|mì|sữa|chè|dưa|táo|quýt|ổi|cá|gà|thịt|trứng|chả|kẹo|sô-cô-la|nước dừa|trà sữa|rau|cà rốt|bánh mì|nếm|nhai|miếng)(?!\p{L})/iu;
const AFFECTION_WORDS = /(?<!\p{L})(?:ôm|nắm tay|khiêu vũ|nhảy|cõng|tình cảm|âu yếm|bế)(?!\p{L})/iu;

/** The four-beat pretend cry of a real preschooler (the beat viewers come for). */
export function whinyCryDirective(level: WhineLevel, name: string, she: string, her: string, dialect: Dialect, age?: KidAge): string {
  const south = dialect === "south";
  const mom = south ? "Mẹ ơiii" : "Mẹ ơiii";
  const toddler = age === "toddler";
  const words = toddler
    ? `one- or two-word sobbed protests ("${south ? "Hông chịuuu" : "Không chịuuu"}!", "${mom}!")`
    : `broken little sentences between sobs ("${name}… muốn… cơ… huhu", "${south ? "Ba hư!" : "Bố hư!"}", "${south ? `${name} hông chịu đâuuu` : `${name} không chịu đâuuu`}")`;
  if (level === "light") {
    return `WHINY, NOT CRYING (level: mè nheo — performed like a real ${toddler ? "2–3" : "4–5"}-year-old): ${name} whines in a drawn-out, nasal sing-song ("${mom}~", "${south ? "Đi mà ba~" : "Đi mà bố~"}"), a sulky frown with puffed cheeks, sways and tugs a sleeve, drops ${her} whole weight against a parent's arm, a tiny double-foot stamp, eyes go glossy for a second — and melts into a shy grin the moment ${she} is answered. No wailing.`;
  }
  const wail = level === "big"
    ? `THE BIG WAIL — ${name} plops down onto the soft rug, mattress or sofa (never near furniture corners, stairs, the stove or hot food), kicks ${her} legs on the rug, flings ${her} arms wide and wails a long, wobbly, nasal "Oaaa… ${mom}!" with breath catches between sobs and ${words}`
    : `THE WAIL — a loud, long, wobbly, nasal "Oaaa… ${mom}!" with little breath catches between sobs, fists rubbing ${her} eyes, both feet stamping, the whole body sagging; ${words}`;
  return `WHINY PRETEND CRY, PERFORMED LIKE A REAL ${toddler ? "2–3" : "4–5"}-YEAR-OLD (the comedy peak; it must look and sound like a real child, never a doll; the cry itself lasts only a few seconds inside the clip, in four beats): 1) THE WIND-UP — ${her} face crumples slowly, chin wobbling, eyes going glossy and shiny, a held breath and a tiny shaky "${south ? "Ba ơi…" : "Bố ơi…"}"; 2) ${wail}; 3) THE CHECK — mid-cry the sound stops for half a second: one eye opens or ${she} peeks between ${her} fingers to see whether the adult is reacting, then cries louder if not; 4) THE SWITCH-OFF — the moment ${she} gets ${her} way the crying stops instantly, one or two leftover hiccup-sniffles, a wipe of ${her} cheek with the back of ${her} hand, then a sunny grin or a busy, happy chewing face. Crocodile tears at most; it is obviously pretend crying for attention. VOICE: a real preschooler's crying voice — high, nasal, vowels stretched, words broken by sobs; never a scream into the camera and never adult-sounding.`;
}

const NO_REAL_DISTRESS =
  "PRETEND, NEVER REAL DISTRESS: the cry is always about a cute wish (a bite of food, a hug, a toy, a turn, fairness, attention) and it resolves warmly inside the reel. It is never caused by scolding, threats, fear, pain, being left alone or being embarrassed; nobody laughs AT the child — the family laughs WITH her; teasing is a game she is in on.";
const FOOD_RULE =
  "FOOD WITH A 4–5-YEAR-OLD: an adult offers a small, cooled bite (blowing on warm food first) with a spoon, chopsticks or fingers while the child sits or stands still; no whole grapes, nuts, hard or gummy candy, popcorn, chunks of sausage or chewing gum; no coffee, alcohol, energy drinks or very spicy food for the child (a \"coffee\" for the child is warm milk in her own cup).";
const AFFECTION_RULE =
  "AFFECTION ON SCREEN: grown-ups show love only with a side hug, a hug from behind with arms around the shoulders, holding hands, leaning heads together or a dance holding hands (video models refuse any other show of affection next to a child). When the child wants the same, she gets a hug, a lift, a piggyback or a group hug.";

/** The contract lines added to the cute-kids directive (only for younger kids: 2–7). */
export function whinyDirectiveLines(
  config: Pick<CuteKidsConfig, "goal" | "sceneId" | "scene" | "whine" | "traits" | "dialect" | "kidAge" | "kidName" | "shots" | "request">,
  kidName: string,
  girl: boolean,
  older: boolean
): string[] {
  if (older) return [];
  const scene = sceneOf(config);
  const traits: KidTrait[] = config.traits ?? [];
  if (!scene && !traits.includes("fake_cry")) return [];
  const she = girl ? "she" : "he";
  const her = girl ? "her" : "his";
  const level: WhineLevel = config.whine ?? scene?.level ?? "medium";
  const lines: string[] = [];
  if (scene) {
    const opts = { kidName, dialect: config.dialect };
    const L = (s: string) => localizeScene(s, opts);
    const cast = scene.cast.map((m) => MEMBER_VI[m][config.dialect]).join(", ");
    lines.push(
      `- NHÕNG NHẼO SCENE (HARD — the reel is this scene): "${L(scene.title)}" (${groupLabel(scene.group)}) at ${L(scene.place)}. On screen: ${kidName}${cast ? `, ${cast}` : ""}; keep the one place identical in every clip.`,
      `- HOOK (0–2 s): ${L(scene.hook)}`,
      `- THE WHINE IN THIS SCENE: ${L(scene.whine)}`,
      `- THE BUTTON (last clip — the payoff the viewer waits for): ${L(scene.punch)} Hold the final reaction for 1–2 s so the reel loops.`,
      `- ${kidName}'S KEY LINES (keep them, at most 6 words each, natural ${config.dialect === "south" ? "Southern" : "Northern"} child speech): ${scene.naLines.map((x) => `«${L(x)}»`).join(" · ")}${scene.adultLines.length ? `; the adults: ${scene.adultLines.map((x) => `«${L(x)}»`).join(" · ")}` : ""}.`,
      `- CLIP PLAN (${config.shots} clips): ${whinyShotPlanVi(scene, config.shots, opts).join(" · ")}`,
    );
  }
  lines.push(`- ${whinyCryDirective(level, kidName, she, her, config.dialect, config.kidAge)}`);
  lines.push(`- ${NO_REAL_DISTRESS}`);
  const text = [config.request, scene ? [scene.hook, scene.whine, scene.punch, ...scene.naLines, ...scene.adultLines].join(" ") : ""].join(" ");
  if (FOOD_WORDS.test(text)) lines.push(`- ${FOOD_RULE}`);
  if (scene?.group === "jealous" || AFFECTION_WORDS.test(text)) lines.push(`- ${AFFECTION_RULE}`);
  return lines;
}

/** Vietnamese lines for the writers' room seed. */
export function whinyRoomLinesVi(config: Pick<CuteKidsConfig, "goal" | "sceneId" | "scene" | "whine" | "traits" | "kidName" | "dialect">, older: boolean): string[] {
  if (older) return [];
  const scene = sceneOf(config);
  if (!scene && !(config.traits ?? []).includes("fake_cry")) return [];
  const name = kidShortName(config.kidName);
  const level: WhineLevel = config.whine ?? scene?.level ?? "medium";
  return [
    scene ? `Tình huống nhõng nhẽo: ${localizeScene(scene.title, config)} — giữ đúng hook, cách nhõng nhẽo và cú chốt; mỗi câu của ${name} tối đa 6 từ.` : "",
    level === "light"
      ? `Mức mè nheo: giọng kéo dài "Mẹ ơiii~", phụng phịu phồng má, lắc lư níu tay áo, dậm chân — chưa khóc; được đáp lại là cười ngay.`
      : `Khóc nhè 4 nhịp như trẻ thật: mặt méo dần, mắt long lanh → khóc to kéo dài, gọi "Mẹ ơiii", dậm chân${level === "big" ? ", ngồi bệt xuống thảm/sofa đạp chân (chỗ mềm, xa góc bàn, cầu thang, bếp)" : ""} → ngừng nửa giây hé mắt xem người lớn → được dỗ là nín ngay, còn nấc một hai tiếng rồi cười tươi.`,
    "Chỉ là ăn vạ cho vui vì một mong muốn dễ thương; không bao giờ khóc vì bị mắng, dọa, sợ, đau hay bị bỏ lại. Đồ ăn đút cho bé là miếng nhỏ, thổi nguội; người lớn thể hiện tình cảm chỉ bằng ôm vai, nắm tay.",
  ].filter(Boolean);
}

/** The comment question added to the captions of a scene reel. */
export function whinyPostLine(kidName: string): string {
  return `👇 Nhà bạn có “bé ${kidShortName(kidName)}” nào nhõng nhẽo y chang không?`;
}

// ---------- normalisation ----------

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A scene snapshot from the client, kept only when it is complete and matches the picked id. */
export function sceneFields(raw: unknown, sceneId: unknown): { sceneId?: string; scene?: WhinyScene } {
  if (!raw || typeof raw !== "object" || typeof sceneId !== "string") return {};
  const r = raw as Record<string, unknown>;
  const group = WHINY_GROUPS.find((g) => g.id === r.group)?.id;
  const cast = Array.isArray(r.cast) ? r.cast.filter((m): m is FamilyMember => MEMBERS.includes(m as FamilyMember)) : [];
  const lines = (v: unknown) => (Array.isArray(v) ? v.map((x) => clip(x, 80)).filter(Boolean).slice(0, 4) : []);
  const scene: WhinyScene = {
    id: clip(r.id, 40),
    group: group ?? "no",
    title: clip(r.title, 120),
    cast: [...new Set(cast)],
    place: clip(r.place, 160),
    hook: clip(r.hook, 400),
    whine: clip(r.whine, 400),
    punch: clip(r.punch, 400),
    naLines: lines(r.naLines),
    adultLines: lines(r.adultLines),
    shots: r.shots === 2 ? 2 : 3,
    level: WHINE_LEVELS.includes(r.level as WhineLevel) ? (r.level as WhineLevel) : "medium",
    format: clip(r.format, 30) || (group ? WHINY_GROUPS.find((g) => g.id === group)!.format : "whiny_ask"),
  };
  const complete = group && scene.id === sceneId && [scene.title, scene.place, scene.hook, scene.whine, scene.punch].every(Boolean) && scene.naLines.length > 0;
  return complete ? { sceneId, scene } : {};
}
