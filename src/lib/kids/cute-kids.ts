// ============================================================
// CUTE KIDS (Bé cưng viral) — short family reels built around a toddler or a
// young child: jealous when the parents hug, bargaining for candy, faking
// sleep… The user types one request; this module turns it into a locked
// family cast, an age-true script contract (how a 2-year-old vs a 6-year-old
// talks and moves), a viral structure, an expression bank, a parent's-phone
// capture look and child-safety rules that are always on.
// Pure data + functions (node-testable).
// ============================================================

import { CHILD_SAFE_WORDING_RULE } from "./child-safe-wording.ts";

export type KidAge = "toddler" | "young" | "school";
export type KidGender = "girl" | "boy";
export type FamilyMember = "dad" | "mom" | "grandpa" | "grandma" | "baby" | "dog" | "cat";
export type Filming = "phone" | "cinematic";
export type Dialect = "north" | "south";
/** How the kid performs: whiny-sweet, pretend crying, clever, sunny. */
export type KidTrait = "sweet_whiny" | "fake_cry" | "clever" | "cheerful";

export interface CuteKidsConfig {
  request: string;
  kidName: string;
  kidGender: KidGender;
  kidAge: KidAge;
  family: FamilyMember[];
  filming: Filming;
  dialect: Dialect;
  shots: number;
  /** Viral format id; "auto" picks one from the request. */
  format?: string;
  /** The kid's performance traits (default: nũng nịu + khóc nhè + khôn lanh). */
  traits?: KidTrait[];
}

export const DEFAULT_CUTE_KIDS: CuteKidsConfig = {
  request: "",
  kidName: "Bé Na",
  kidGender: "girl",
  kidAge: "school",
  family: ["dad", "mom"],
  filming: "phone",
  dialect: "north",
  shots: 3,
  format: "auto",
  traits: ["sweet_whiny", "fake_cry", "clever"],
};

export const AGE_LABEL: Record<KidAge, { vi: string; en: string }> = {
  toddler: { vi: "2–3 tuổi", en: "2–3 years" },
  young: { vi: "4–5 tuổi", en: "4–5 years" },
  school: { vi: "6–7 tuổi", en: "6–7 years" },
};

interface AgeProfile {
  years: string;
  maxWords: number;
  speech: string;
  motor: string;
  body: string;
}

export const AGE_PROFILES: Record<KidAge, AgeProfile> = {
  toddler: {
    years: "about 2–3 years old",
    maxWords: 3,
    speech:
      "a toddler: 1–3 word lines only, said with a tiny voice and cute mispronunciation (\"Của con!\", \"Không chịu!\", \"Bế con!\", \"Mẹ ơiii!\"), plus babble, giggles, squeals and a dramatic \"hừ!\". The parents carry the dialogue; the toddler carries the moment with faces and gestures.",
    motor:
      "toddles with a wobbly wide-legged walk, hugs a parent's leg, plops down to sit, lifts both arms to be picked up, stamps a tiny foot; never runs fast, climbs high or handles anything heavy or sharp",
    body:
      "a real 2–3-year-old toddler — round face, chubby cheeks, small baby teeth, fine short hair or two tiny ponytails",
  },
  young: {
    years: "about 4–5 years old",
    maxWords: 6,
    speech:
      "a preschooler: short simple sentences of up to 6 words, cute literal logic, big sighs and \"nhưng mà…\" protests; parents answer warmly.",
    motor: "runs and hops at home, climbs onto the sofa, drags a parent by the hand, flops on the bed for drama",
    body: "a real 4–5-year-old — round cheeks, small baby teeth",
  },
  school: {
    years: "about 6–7 years old",
    maxWords: 10,
    speech:
      "a 6-year-old: clear sentences of up to 10 words — sweet and cheeky, child logic that sometimes sounds like a little grown-up (\"bà cụ non\"), and one punchline that lands the video; always a child's vocabulary and voice.",
    motor: "walks briskly, crosses arms, stands like a little boss with fists at the sides, squeezes in between people, mimics adult gestures",
    body: "a real 6–7-year-old — baby teeth with a gap where a front tooth is missing",
  },
};

export interface ViralFormat {
  id: string;
  label_vi: string;
  keywords: RegExp;
  beats: string;
}

/** Whole-word keywords (Vietnamese letters count as word characters: "ôm" ≠ "hôm"). */
const kw = (alternatives: string) => new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, "iu");

export const VIRAL_FORMATS: ViralFormat[] = [
  { id: "whiny_ask", label_vi: "Làm nũng / ăn vạ đòi bằng được", keywords: kw("làm nũng|nũng nịu|ăn vạ|khóc nhè|mè nheo|nhõng nhẽo|vòi"),
    beats: "the kid wants something and asks in the sweetest nũng nịu voice → a parent teases with a playful no → a big theatrical khóc nhè, peeking through fingers to see if it works → a parent bargains back, the kid answers with a khôn lanh condition → the kid wins, the tears switch off into a sunny grin and the family laughs" },
  { id: "jealous", label_vi: "Ghen tị khi bố mẹ tình cảm", keywords: kw("ghen|ôm|hôn|tình cảm|âu yếm|nắm tay"),
    beats: "the parents share a small sweet moment (a side hug or holding hands) → the kid notices and freezes with a priceless face → escalating attempts to break in (clears throat, squeezes between them, drags one parent away) → punchline line or the family pulls the kid into a group hug" },
  { id: "bargain", label_vi: "Mặc cả đòi kẹo / đồ chơi", keywords: kw("kẹo|bánh|đồ chơi|kem|mặc cả|đòi|xin"),
    beats: "the kid spots the treat → asks sweetly, gets a no → negotiates with surprising logic (promises, deals, flattery) → wins a tiny compromise or a hilarious counter-offer" },
  { id: "dozing", label_vi: "Ngủ gật khi ăn", keywords: kw("ngủ gật|buồn ngủ|ăn cơm|bữa ăn"),
    beats: "dinner, the kid gets sleepier with each bite → slow-motion head nods toward the bowl → jolts awake insisting they are not sleepy → nods off again" },
  { id: "fake_sleep", label_vi: "Giả vờ ngủ bị bắt quả tang", keywords: kw("giả vờ ngủ|ngủ|nhắm mắt|giường"),
    beats: "bedtime, the kid 'sleeps' → a parent leaves, one eye opens and the kid sneaks to the phone/toy → the parent returns, the kid freezes mid-move → instant fake snore" },
  { id: "imitate", label_vi: "Bắt chước bố mẹ", keywords: kw("bắt chước|giả làm|làm giống|điện thoại|họp|nấu"),
    beats: "the kid watches a parent do an adult thing → copies it with total seriousness (phone call, meeting, cooking) → the copy is exaggerated and spot-on → the parent catches them" },
  { id: "helping_mess", label_vi: "\"Giúp\" mẹ thành phá", keywords: kw("giúp|dọn|lau|phụ|rửa"),
    beats: "the kid proudly offers to help → does it their own way, creating a cute mess → presents the 'finished' job beaming → the parent's face says it all" },
  { id: "new_sibling", label_vi: "Lần đầu có em bé", keywords: kw("em bé|có em|em trai|em gái"),
    beats: "everyone fusses over the baby → the older kid feels forgotten → small acts of protest → a tender moment when the baby grabs their finger" },
  { id: "why", label_vi: "Hỏi \"tại sao\" liên tục", keywords: kw("tại sao|vì sao|hỏi"),
    beats: "a simple statement from a parent → the kid asks why, again and again → the parent runs out of answers → the kid's final question is unexpectedly deep or funny" },
  { id: "outfit_pick", label_vi: "Tự chọn đồ đi học / đi chơi", keywords: kw("chọn đồ|mặc đồ|quần áo|đi học|váy"),
    beats: "the kid insists on dressing alone → walks out in a wild but adorable combination → defends every choice with total confidence → the parent gives in" },
  { id: "misunderstanding", label_vi: "Hiểu lầm lời người lớn", keywords: kw("hiểu lầm|hiểu nhầm|nghe nhầm"),
    beats: "a parent says an idiom or adult phrase → the kid takes it literally and acts on it → the result is absurd and cute → the parent explains, the kid has a cheeky answer" },
];

export function detectFormat(request: string): ViralFormat | undefined {
  const text = request.normalize("NFC");
  return VIRAL_FORMATS.find((f) => f.keywords.test(text));
}

export const EXPRESSION_BANK =
  "a sulky frown with puffed-up cheeks, arms crossed and turning away with a \"hmph\", slow side-eye, gasp with both hands over the mouth, shy smile hiding behind little hands, proud chin-up grin, sleepy slow blinks, tiny stamp of the foot, eyes going wide in disbelief";

export const KID_TRAITS: Array<{ id: KidTrait; label_vi: string; label_en: string; room_vi: string }> = [
  { id: "sweet_whiny", label_vi: "🥺 Nũng nịu", label_en: "🥺 Sweet & whiny", room_vi: "nũng nịu (giọng kéo dài, lắc lư, níu tay áo bố mẹ, chắp tay nài nỉ, mắt tròn long lanh)" },
  { id: "fake_cry", label_vi: "😭 Khóc nhè / ăn vạ", label_en: "😭 Pretend crying", room_vi: "khóc nhè ăn vạ cho vui (mếu máo \"huhuhu\", dụi mắt, hé ngón tay xem bố mẹ có dỗ không, được chiều là cười ngay)" },
  { id: "clever", label_vi: "😏 Khôn lanh", label_en: "😏 Clever", room_vi: "khôn lanh (lý lẽ trẻ con mà làm bố mẹ cứng họng, ra \"điều kiện\", liếc mắt tinh nghịch, chốt câu thắng cuộc)" },
  { id: "cheerful", label_vi: "😄 Hồn nhiên", label_en: "😄 Sunny", room_vi: "hồn nhiên (cười khanh khách, vỗ tay, xoay vòng, chạy ào tới ôm)" },
];

/** What each trait looks and sounds like on screen (pronouns follow the kid). */
function traitPerformance(trait: KidTrait, name: string, she: string, her: string, dialect: Dialect): string {
  const south = dialect === "south";
  switch (trait) {
    case "sweet_whiny":
      return `NŨNG NỊU (whiny-sweet, coaxing): ${name} sways side to side, tugs a parent's sleeve or hand, leans ${her} head against a parent's arm, clasps both hands under ${her} chin and begs with big round shining eyes, tilts ${her} head, bounces on ${her} toes, does a tiny twist-and-stomp, hides ${her} face against a parent's arm and peeks back up. ${she[0]!.toUpperCase() + she.slice(1)} speaks in a high, sweet sing-song with drawn-out vowels and endearing particles, often calling ${her}self by name — e.g. ${south ? `"Ba ơiii~", "Má ơi, cho con đi mà, nhaaa", "Con hông chịu đâu~", "${name} muốn mà~"` : `"Bố ơiii~", "Mẹ ơi, cho con đi màaa", "Thôi mà bố~", "${name} muốn cơơ!"`}.`;
    case "fake_cry":
      return `KHÓC NHÈ / ĂN VẠ (theatrical pretend crying for attention, the comedy beat): when told no, ${name} scrunches ${her} whole face, squeezes ${her} eyes shut, lets out a long wobbly "huhuhuuu~" or "oaaa~", rubs ${her} eyes with little fists, flops onto the sofa or stamps in place — and peeks through ${her} fingers to check whether it is working. The moment ${she} gets ${her} way the crying switches off into a sunny grin. It lasts 2–4 seconds, is obviously playful, and a parent always answers with warmth (picks ${her} up, wipes the "tears", tickles, gives in or bargains back).`;
    case "clever":
      return `KHÔN LANH (quick-witted): ${name} out-thinks the parents with cheeky child logic — uses their own words against them, offers a "deal", turns a no into a yes — with a knowing side-glance or a sly little grin to the camera, and lands the video's punchline in a child's own words.`;
    case "cheerful":
      return `HỒN NHIÊN (sunny): bright giggles, clapping, a little spin, running to hug a parent, sparkling eyes.`;
  }
}

/** The family always reacts to the kid's cute moments. */
function parentsPlayAlong(dialect: Dialect): string {
  return `PARENTS PLAY ALONG (every clip): each cute beat of the kid gets a visible, warm reaction from a parent in the same clip — they melt (soft smile, hand on heart), laugh, tease back gently (${dialect === "south" ? `"Lại làm nũng rồi nha!", "Con gái cưng của ba ơi"` : `"Lại ăn vạ rồi!", "Con gái rượu của bố ơi"`}), act strict for a second and crack, bargain back, or give in with a cuddle. They use affectionate names (${dialect === "south" ? `"cưng", "bé cưng của má"` : `"cục cưng", "bé con của mẹ"`}). They never ignore, scold harshly or mock the kid. The camera catches both: a close on the kid's face for the beat and the parent's reaction.`;
}

export const CHILD_SAFETY_RULES =
  "CHILD SAFETY (always): wholesome everyday family moments only (meals, play, chores, bedtime stories, hugs). Parents show affection only with a side hug or holding hands. The child wears ordinary everyday clothes that cover like normal home clothes and is never in danger (no stove, knives, hot liquids, open water, heights or traffic without an adult right there). No scaring, humiliating, punishing or pranks on the child, and never real pain, fear or distress; playful pretend crying (ăn vạ) and a cute sulk are fine, brief, and always answered with warmth. The child behaves like a child of that age — playful and natural, never posed like an adult.";

/** A baby in the family is cared for on screen, never left alone or ignored. */
export const BABY_CARE_RULE =
  "BABY ON SCREEN: the baby is always in an adult's arms or lap (or a grandparent's), or right beside an adult who visibly attends to it — holding its hand, rocking it, smiling and talking to it. The baby reacts to the moment (watches the star, giggles, reaches out, claps) and is part of the ending. Never leave the baby alone in a seat or on the floor, and never let the family forget it.";

const PHONE_CAPTURE =
  "FILMING: like a parent's smartphone video — handheld with a gentle natural sway, often lowered to the child's eye level, natural home light from windows and lamps, casual framing that follows the child, real room sound; no cinematic rigs, dramatic lighting or slow dolly moves.";
const CINEMATIC_CAPTURE =
  "FILMING: warm, bright cinematic family look — stable camera at the child's eye level, soft flattering light, clean framing of faces and reactions.";

const DIALECT_NOTE: Record<Dialect, string> = {
  north: "Northern Vietnamese (Hà Nội) speech and voices: the child calls the parents \"bố\" and \"mẹ\", says \"không\", \"ạ\".",
  south: "Southern Vietnamese (Sài Gòn) speech and voices: the child calls the parents \"ba\" and \"mẹ\" (or \"má\"), says \"hông\", \"dạ\", \"nha\".",
};

const FAMILY_LABEL: Record<FamilyMember, { north: string; south: string; en: string }> = {
  dad: { north: "Bố", south: "Ba", en: "father in his early 30s" },
  mom: { north: "Mẹ", south: "Mẹ", en: "mother around 30" },
  grandpa: { north: "Ông", south: "Ông", en: "grandfather in his 60s" },
  grandma: { north: "Bà", south: "Bà", en: "grandmother in her 60s" },
  baby: { north: "Em bé", south: "Em bé", en: "baby sibling about 1 year old" },
  dog: { north: "Cún", south: "Cún", en: "small fluffy family dog" },
  cat: { north: "Mèo", south: "Mèo", en: "family cat" },
};

const PETS = new Set<FamilyMember>(["dog", "cat"]);

export interface FamilyCastMember {
  name: string;
  role: string;
  appearance: string;
  isChild: boolean;
}

/** The locked cast: the kid first, then the chosen family (pets stay in the story text). */
export function familyCast(config: CuteKidsConfig): FamilyCastMember[] {
  const age = AGE_PROFILES[config.kidAge];
  const kid: FamilyCastMember = {
    name: config.kidName.trim() || DEFAULT_CUTE_KIDS.kidName,
    role: "nhân vật chính — bé",
    appearance: `Vietnamese ${config.kidGender === "girl" ? "girl" : "boy"} ${age.years}, ${age.body}, bright expressive eyes, everyday home clothes in soft colours`,
    isChild: true,
  };
  const others = config.family
    .filter((m) => !PETS.has(m))
    .map((m) => {
      const label = FAMILY_LABEL[m];
      return {
        name: label[config.dialect],
        role: m === "baby" ? "em bé" : "người nhà",
        appearance: `Vietnamese ${label.en}, warm friendly face, comfortable everyday home clothes`,
        isChild: m === "baby",
      };
    });
  return [kid, ...others];
}

/** The idea text that goes into the story box (and the writers' room). */
export function cuteKidsStoryIdea(config: CuteKidsConfig): string {
  const cast = familyCast(config);
  const pets = config.family.filter((m) => PETS.has(m)).map((m) => FAMILY_LABEL[m][config.dialect]);
  const format = config.format && config.format !== "auto" ? VIRAL_FORMATS.find((f) => f.id === config.format) : detectFormat(config.request);
  return [
    config.request.trim(),
    `Nhân vật: ${cast[0]!.name} (${config.kidGender === "girl" ? "bé gái" : "bé trai"} ${AGE_LABEL[config.kidAge].vi})${cast.length > 1 ? `, ${cast.slice(1).map((c) => c.name).join(", ")}` : ""}${pets.length ? `; thú cưng: ${pets.join(", ")}` : ""}.`,
    format ? `Kiểu video: ${format.label_vi}.` : "",
    (config.traits ?? []).length ? `Tính cách bé: ${(config.traits ?? []).map((t) => KID_TRAITS.find((k) => k.id === t)!.label_vi.replace(/^\S+\s/, "").toLowerCase()).join(", ")}; bố mẹ luôn hưởng ứng.` : "",
  ].filter(Boolean).join("\n");
}

/** Hard contract for the script writer and the storyboard. */
export function cuteKidsDirective(raw: CuteKidsConfig | null | undefined): string {
  const config = normalizeCuteKids(raw);
  if (!config) return "";
  const age = AGE_PROFILES[config.kidAge];
  const kid = familyCast(config)[0]!;
  const format = config.format && config.format !== "auto" ? VIRAL_FORMATS.find((f) => f.id === config.format) : detectFormat(config.request);
  const girl = config.kidGender === "girl";
  const traits = config.traits ?? [];
  const arc = traits.includes("sweet_whiny") && traits.includes("fake_cry") && traits.includes("clever")
    ? ` Default arc: nũng nịu ask → a parent's playful "no" → khóc nhè theatre with peeking → a khôn lanh twist that wins → the family laughs and cuddles.`
    : "";
  return [
    `CUTE KIDS VIRAL REEL (HARD): a short family reel whose star is ${kid.name}, a ${config.kidGender} ${age.years}.`,
    `- STRUCTURE (${config.shots} clips of 10 s): 0–2 s hook on ${kid.name}'s face or the trigger moment, then escalation, then a punchline or warm twist; end on a moment that loops well. ${format ? `Format "${format.label_vi}": ${format.beats}.` : "Pick the most relatable everyday family situation in the request."}`,
    `- ${kid.name} SPEAKS LIKE ${age.speech} Every line of ${kid.name} has at most ${age.maxWords} words.`,
    `- ${kid.name} MOVES LIKE THE AGE: ${age.motor}. Body: ${age.body}.`,
    `- EXPRESSIONS carry the reel: ${EXPRESSION_BANK}. Every clip has at least one clear close reaction on ${kid.name}.`,
    ...(traits.length
      ? [`- ${kid.name}'S PERSONALITY — adorable in gestures, body language and voice in EVERY clip (each clip holds at least one of these beats, performed big and clear):${arc}`,
        ...traits.map((t) => `  · ${traitPerformance(t, kid.name, girl ? "she" : "he", girl ? "her" : "his", config.dialect)}`)]
      : []),
    `- VOICE of ${kid.name} (character_locks.voice): a high, sweet, real child's voice${traits.includes("sweet_whiny") ? " with a sing-song nũng nịu delivery — drawn-out vowels, playful pitch rises" : ""}${traits.includes("fake_cry") ? ", theatrical \"huhu\" sniffles that snap into giggles" : ""}; never adult-sounding.`,
    `- ${parentsPlayAlong(config.dialect)}`,
    `- Parents and family talk naturally and warmly in full everyday sentences that carry the scene; the comedy comes from ${kid.name}.`,
    ...(config.family.includes("baby") ? [`- ${BABY_CARE_RULE}`] : []),
    `- ${config.filming === "phone" ? PHONE_CAPTURE : CINEMATIC_CAPTURE} Real lived-in Vietnamese home or everyday place that fits the request.`,
    `- ${DIALECT_NOTE[config.dialect]}`,
    `- ${CHILD_SAFETY_RULES}`,
    `- ${CHILD_SAFE_WORDING_RULE}`,
  ].join("\n");
}

/** Short Vietnamese brief for the writers' room idea box. */
export function cuteKidsRoomSeed(config: CuteKidsConfig): string {
  const age = AGE_PROFILES[config.kidAge];
  return [
    cuteKidsStoryIdea(config),
    `Yêu cầu: video ngắn ${config.shots} shot × 10 giây, 2 giây đầu là gương mặt/biểu cảm của bé hoặc khoảnh khắc gây chuyện; kết bằng câu chốt hoặc cú quay xe ấm áp.`,
    ...((config.traits ?? []).length ? [`Bé phải thật dễ thương từ cử chỉ, điệu bộ đến lời nói, mỗi shot có ít nhất một khoảnh khắc: ${(config.traits ?? []).map((t) => KID_TRAITS.find((k) => k.id === t)!.room_vi).join("; ")}.`] : []),
    "Bố mẹ luôn hưởng ứng: tan chảy, bật cười, trêu lại nhẹ nhàng, giả vờ nghiêm rồi chiều, gọi bé bằng tên âu yếm; không bao giờ phớt lờ hay mắng gắt.",
    `Bé nói đúng tuổi: mỗi câu tối đa ${age.maxWords} từ; bố mẹ nói tự nhiên. Quay kiểu ${config.filming === "phone" ? "điện thoại gia đình" : "điện ảnh"}, giọng ${config.dialect === "north" ? "miền Bắc" : "miền Nam"}.`,
    "Nội dung gia đình lành mạnh, an toàn cho trẻ: không nguy hiểm, không dọa hay làm bé khóc thật, bé mặc đồ ở nhà bình thường. Bố mẹ thể hiện tình cảm bằng ôm vai, nắm tay.",
    config.family.includes("baby") ? "Em bé luôn được bế hoặc ở ngay cạnh người lớn đang chăm (nắm tay, ru, cười nói với em), em có phản ứng trong cảnh và có mặt ở kết — không để em ngồi một mình hay bị bỏ quên." : "",
  ].join("\n");
}

export const AI_LABEL_VI = "🤖 Video tạo bằng AI · #AIGenerated";

/** Append the AI-content label to every social caption (platform rules for realistic AI video). */
export function labelAiSocialPosts(posts: {
  tiktok?: { caption?: string };
  youtube_shorts?: { description?: string };
  facebook_reel?: { caption?: string };
} | undefined | null): void {
  if (!posts) return;
  const add = (s: string | undefined) => (s && s.includes(AI_LABEL_VI) ? s : [s?.trim(), AI_LABEL_VI].filter(Boolean).join("\n\n"));
  if (posts.tiktok) posts.tiktok.caption = add(posts.tiktok.caption);
  if (posts.youtube_shorts) posts.youtube_shorts.description = add(posts.youtube_shorts.description);
  if (posts.facebook_reel) posts.facebook_reel.caption = add(posts.facebook_reel.caption);
}

/** Normalise a config coming from the client. */
export function normalizeCuteKids(raw: unknown): CuteKidsConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const family = Array.isArray(r.family)
    ? (r.family.filter((m) => ["dad", "mom", "grandpa", "grandma", "baby", "dog", "cat"].includes(String(m))) as FamilyMember[])
    : DEFAULT_CUTE_KIDS.family;
  return {
    request: String(r.request ?? "").slice(0, 4000),
    kidName: String(r.kidName ?? "").trim().slice(0, 40) || DEFAULT_CUTE_KIDS.kidName,
    kidGender: pick(r.kidGender, ["girl", "boy"] as const, "girl"),
    kidAge: pick(r.kidAge, ["toddler", "young", "school"] as const, "school"),
    family: [...new Set(family)],
    filming: pick(r.filming, ["phone", "cinematic"] as const, "phone"),
    dialect: pick(r.dialect, ["north", "south"] as const, "north"),
    shots: Math.min(4, Math.max(2, Number(r.shots) || DEFAULT_CUTE_KIDS.shots)),
    format: typeof r.format === "string" && (r.format === "auto" || VIRAL_FORMATS.some((f) => f.id === r.format)) ? r.format : "auto",
    traits: Array.isArray(r.traits)
      ? [...new Set(r.traits.filter((t): t is KidTrait => KID_TRAITS.some((k) => k.id === t)))]
      : DEFAULT_CUTE_KIDS.traits,
  };
}

export const PHONE_RENDER_NOTE =
  "Photoreal smartphone home-video frame, as if a parent filmed it on a modern phone: natural indoor home light from windows and lamps, true-to-life colours, phone-camera deep focus with only gentle background softness, fine natural noise, casual but well-composed framing at the child's eye level; real skin and fabric textures — a real family moment, not a studio production.";

export const PHONE_VIDEO_NOTE =
  "CAPTURE STYLE: a parent's handheld smartphone video — gentle natural handheld sway (never shaky), framing that follows the child, camera often lowered to the child's eye level, natural home light and real room sound; no cinematic rigs, dolly moves or dramatic lighting.";

// ─── 10 episode ideas ────────────────────────────────────────────────────────

export interface EpisodeIdea {
  title: string;
  request: string;
}

export const EPISODE_IDEAS_SYSTEM =
  "You are a Vietnamese short-video creator who makes wholesome viral family reels starring young children. You know what makes these reels loved and shared: a relatable everyday family moment, an instant hook on the child's face, the child's honest logic and big expressions, and a sweet or funny ending. Child safety always comes first. Answer with JSON only.";

/** Prompt for 10 fresh episode ideas for the same kid and family. */
export function buildEpisodeIdeasPrompt(raw: CuteKidsConfig, avoid: string[] = []): string {
  const config = normalizeCuteKids(raw) ?? DEFAULT_CUTE_KIDS;
  const cast = familyCast(config);
  const pets = config.family.filter((m) => PETS.has(m)).map((m) => FAMILY_LABEL[m][config.dialect]);
  return [
    `Kid: ${cast[0]!.name}, ${config.kidGender === "girl" ? "bé gái" : "bé trai"} ${AGE_LABEL[config.kidAge].vi} (${AGE_PROFILES[config.kidAge].speech})`,
    `Family on screen: ${cast.slice(1).map((c) => c.name).join(", ") || "none"}${pets.length ? `; pets: ${pets.join(", ")}` : ""}.`,
    config.request.trim() ? `The creator's current direction: ${config.request.trim()}` : "",
    `Viral formats that work (mix them, do not copy): ${VIRAL_FORMATS.map((f) => f.label_vi).join("; ")}.`,
    avoid.length ? `Do not repeat these: ${avoid.join("; ")}.` : "",
    (config.traits ?? []).length ? `The kid's personality, shown in every idea: ${(config.traits ?? []).map((t) => KID_TRAITS.find((k) => k.id === t)!.label_en.replace(/^\S+\s/, "")).join(", ")}; the parents always play along warmly.` : "",
    `Give 10 different episode ideas for ${config.shots} clips of 10 seconds, all at home or everyday places, each with a clear hook, escalation and a punchline that fits the kid's age. ${CHILD_SAFETY_RULES}`,
    'Return {"ideas":[{"title":"short Vietnamese title (max 8 words)","request":"one or two Vietnamese sentences: the situation, what the kid does and the ending"}]}',
  ].filter(Boolean).join("\n");
}

export function normalizeEpisodeIdeas(raw: unknown): EpisodeIdea[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { ideas?: unknown })?.ideas) ? (raw as { ideas: unknown[] }).ideas : [];
  const seen = new Set<string>();
  return list
    .map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      return { title: String(r.title ?? "").trim().slice(0, 80), request: String(r.request ?? "").trim().slice(0, 400) };
    })
    .filter((i) => i.title && i.request && !seen.has(i.title.toLowerCase()) && seen.add(i.title.toLowerCase()))
    .slice(0, 10);
}

export const PHONE_PLATE_NOTE =
  "Photoreal smartphone photo of the real place, as a parent would snap it at home: natural daylight from windows and practical lamps, true-to-life colours, phone-camera deep focus, fine natural noise, real lived-in materials and clutter — a real home, not a staged studio set.";

// ─── Voices and on-screen performance (applied after the storyboard) ─────────

const RESTRAINED_PROSODY = /\b(?:with\s+)?restrained\s+(?:context-appropriate\s+)?(?:pitch variation|prosody|emotion)\b/giu;

/**
 * The storyboard writer locks every voice with "restrained prosody" (the
 * general audio law). In a cute-kids reel that flattens the kid: the kid gets
 * a lively sing-song delivery, the family warm expressive voices.
 */
export function cuteKidsVoice(voice: string, opts: { isKid: boolean; traits?: KidTrait[] }): string {
  const text = String(voice ?? "").trim();
  if (!text) return text;
  const lively = opts.isKid ? "lively sing-song pitch rises" : "warm, expressive natural pitch variation";
  let out = text.replace(RESTRAINED_PROSODY, `with ${lively}`);
  if (opts.isKid) {
    const traits = opts.traits ?? [];
    const extra = [
      traits.includes("sweet_whiny") ? "a sweet nũng nịu sing-song with drawn-out vowels" : "",
      traits.includes("fake_cry") ? "theatrical \"huhu\" sniffles that snap into giggles" : "",
      traits.includes("clever") ? "a cheeky, quick-witted tone on the punchline" : "",
    ].filter((e) => e && !out.includes(e));
    if (extra.length) out = `${out.replace(/[.;\s]+$/, "")}; ${extra.join(", ")}.`;
  }
  return out;
}

/** Video-prompt note: this project explicitly wants the kid's big, cute performance. */
export function cuteKidsPerformanceNote(kidName: string, traits: KidTrait[] = DEFAULT_CUTE_KIDS.traits ?? []): string {
  const beats = [
    traits.includes("sweet_whiny") ? "nũng nịu coaxing (swaying, tugging a sleeve, hands clasped, big shining eyes, sing-song drawn-out voice)" : "",
    traits.includes("fake_cry") ? "playful pretend crying (scrunched face, \"huhu\", peeking through fingers) that snaps into a sunny grin" : "",
    traits.includes("clever") ? "cheeky clever looks and a knowing little grin on the punchline" : "",
    traits.includes("cheerful") ? "bright giggles, claps and little spins" : "",
  ].filter(Boolean);
  return `CHILD PERFORMANCE (explicitly required by this project — overrides any "restrained / never theatrical" rule for ${kidName} only): ${kidName} performs big, clear, adorable child expressions${beats.length ? `: ${beats.join("; ")}` : ""}. The parents react warmly and visibly to every cute beat (melting smiles, laughs, gentle teasing, giving in with a cuddle).`;
}
