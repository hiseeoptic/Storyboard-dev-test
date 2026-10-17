// ============================================================
// CUTE KIDS (Bé cưng viral) — short family reels built around a toddler or a
// young child: jealous when the parents hug, bargaining for candy, faking
// sleep… The user types one request; this module turns it into a locked
// family cast, an age-true script contract (how a 2-year-old vs a 6-year-old
// talks and moves), a viral structure, an expression bank, a parent's-phone
// capture look and child-safety rules that are always on.
// Pure data + functions (node-testable).
// ============================================================

export type KidAge = "toddler" | "young" | "school";
export type KidGender = "girl" | "boy";
export type FamilyMember = "dad" | "mom" | "grandpa" | "grandma" | "baby" | "dog" | "cat";
export type Filming = "phone" | "cinematic";
export type Dialect = "north" | "south";

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
      "a toddler: 1–3 word lines only, said with a tiny voice and cute mispronunciation (\"Của con!\", \"Không chịu!\", \"Bế con!\", \"Mẹ ơiii!\"), plus babble, giggles, squeals and a dramatic \"hừ!\". The parents carry the dialogue; the toddler carries the moment with faces and body.",
    motor:
      "toddles with a wobbly wide-legged walk, hugs a parent's leg, plops down to sit, lifts both arms to be picked up, stamps a tiny foot; never runs fast, climbs high or handles anything heavy or sharp",
    body:
      "toddler proportions — big head (about a quarter of the height), round chubby cheeks, short soft limbs, small baby teeth, fine short hair or two tiny ponytails",
  },
  young: {
    years: "about 4–5 years old",
    maxWords: 6,
    speech:
      "a preschooler: short simple sentences of up to 6 words, cute literal logic, big sighs and \"nhưng mà…\" protests; parents answer warmly.",
    motor: "runs and hops at home, climbs onto the sofa, drags a parent by the hand, flops on the bed for drama",
    body: "preschool proportions — head about one fifth of the height, round cheeks, small baby teeth",
  },
  school: {
    years: "about 6–7 years old",
    maxWords: 10,
    speech:
      "a 6-year-old \"bà cụ non\": clear sentences of up to 10 words, sassy grown-up logic, negotiation and one punchline that lands the video; still a child's vocabulary and voice.",
    motor: "walks briskly, crosses arms, puts hands on hips, squeezes in between people, mimics adult gestures",
    body: "6-year-old proportions — head about one sixth of the height, slim child limbs, baby teeth with a gap where a front tooth is missing",
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
  { id: "jealous", label_vi: "Ghen tị khi bố mẹ tình cảm", keywords: kw("ghen|ôm|hôn|tình cảm|âu yếm|nắm tay"),
    beats: "the parents share a small sweet moment (a hug, a kiss on the cheek) → the kid notices and freezes with a priceless face → escalating attempts to break in (clears throat, squeezes between them, drags one parent away) → punchline line or the family pulls the kid into a group hug" },
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
  "pout with trembling lower lip, puffed-up cheeks, arms crossed and turning away with a \"hmph\", slow side-eye, gasp with both hands over the mouth, shy smile hiding behind little hands, proud chin-up grin, sleepy slow blinks, tiny stamp of the foot, eyes going wide in disbelief";

export const CHILD_SAFETY_RULES =
  "CHILD SAFETY (always): wholesome family content only. Parents show affection only with hugs, holding hands or a kiss on the cheek. The child is always fully and modestly dressed (no bath, swimwear or undressing scenes) and is never in danger (no stove, knives, hot liquids, open water, heights or traffic without an adult right there). No scaring, humiliating, real crying for laughs or pranks on the child; a short cute sulk is fine and always resolves warmly. The child behaves and poses like a child of that age — never adult, flirtatious or suggestive poses, never make-up.";

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
  ].filter(Boolean).join("\n");
}

/** Hard contract for the script writer and the storyboard. */
export function cuteKidsDirective(raw: CuteKidsConfig | null | undefined): string {
  const config = normalizeCuteKids(raw);
  if (!config) return "";
  const age = AGE_PROFILES[config.kidAge];
  const kid = familyCast(config)[0]!;
  const format = config.format && config.format !== "auto" ? VIRAL_FORMATS.find((f) => f.id === config.format) : detectFormat(config.request);
  return [
    `CUTE KIDS VIRAL REEL (HARD): a short family reel whose star is ${kid.name}, a ${config.kidGender} ${age.years}.`,
    `- STRUCTURE (${config.shots} clips of 10 s): 0–2 s hook on ${kid.name}'s face or the trigger moment, then escalation, then a punchline or warm twist; end on a moment that loops well. ${format ? `Format "${format.label_vi}": ${format.beats}.` : "Pick the most relatable everyday family situation in the request."}`,
    `- ${kid.name} SPEAKS LIKE ${age.speech} Every line of ${kid.name} has at most ${age.maxWords} words.`,
    `- ${kid.name} MOVES LIKE THE AGE: ${age.motor}. Body: ${age.body}.`,
    `- EXPRESSIONS carry the reel: ${EXPRESSION_BANK}. Every clip has at least one clear close reaction on ${kid.name}.`,
    `- Parents and family talk naturally and warmly, short everyday lines; the comedy comes from ${kid.name}.`,
    `- ${config.filming === "phone" ? PHONE_CAPTURE : CINEMATIC_CAPTURE} Real lived-in Vietnamese home or everyday place that fits the request.`,
    `- ${DIALECT_NOTE[config.dialect]}`,
    `- ${CHILD_SAFETY_RULES}`,
  ].join("\n");
}

/** Short Vietnamese brief for the writers' room idea box. */
export function cuteKidsRoomSeed(config: CuteKidsConfig): string {
  const age = AGE_PROFILES[config.kidAge];
  return [
    cuteKidsStoryIdea(config),
    `Yêu cầu: video ngắn ${config.shots} shot × 10 giây, 2 giây đầu là gương mặt/biểu cảm của bé hoặc khoảnh khắc gây chuyện; kết bằng câu chốt hoặc cú quay xe ấm áp.`,
    `Bé nói đúng tuổi: mỗi câu tối đa ${age.maxWords} từ; bố mẹ nói tự nhiên. Quay kiểu ${config.filming === "phone" ? "điện thoại gia đình" : "điện ảnh"}, giọng ${config.dialect === "north" ? "miền Bắc" : "miền Nam"}.`,
    "Nội dung gia đình lành mạnh, an toàn cho trẻ: không nguy hiểm, không dọa hay làm bé khóc thật, bé luôn mặc đồ kín đáo, không trang điểm.",
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
    request: String(r.request ?? "").slice(0, 1200),
    kidName: String(r.kidName ?? "").trim().slice(0, 40) || DEFAULT_CUTE_KIDS.kidName,
    kidGender: pick(r.kidGender, ["girl", "boy"] as const, "girl"),
    kidAge: pick(r.kidAge, ["toddler", "young", "school"] as const, "school"),
    family: [...new Set(family)],
    filming: pick(r.filming, ["phone", "cinematic"] as const, "phone"),
    dialect: pick(r.dialect, ["north", "south"] as const, "north"),
    shots: Math.min(4, Math.max(2, Number(r.shots) || DEFAULT_CUTE_KIDS.shots)),
    format: typeof r.format === "string" && (r.format === "auto" || VIRAL_FORMATS.some((f) => f.id === r.format)) ? r.format : "auto",
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
