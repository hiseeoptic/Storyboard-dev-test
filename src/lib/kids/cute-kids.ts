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
import { TEEN_SAFETY_RULE, teenSafeRequest, teenSafetyViolations } from "./teen-safety.ts";
import { LESSON_PILLARS, pillarLabel, type LessonPillar, type ParentingLesson } from "./lesson-pillars.ts";

export type KidAge = "toddler" | "young" | "school" | "middle" | "preteen" | "teen";
export const KID_AGES: readonly KidAge[] = ["toddler", "young", "school", "middle", "preteen", "teen"];
/** 8–15-year-olds: older-kid acting, voices and parenting (no toddler babble or tantrums). */
export const isOlderKid = (age: KidAge | undefined) => age === "middle" || age === "preteen" || age === "teen";
export type KidGender = "girl" | "boy";
export type FamilyMember = "dad" | "mom" | "grandpa" | "grandma" | "baby" | "sibling" | "friend" | "dog" | "cat";
export const FAMILY_MEMBERS: readonly FamilyMember[] = ["dad", "mom", "grandpa", "grandma", "baby", "sibling", "friend", "dog", "cat"];
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
  /** "fun" = pure entertainment; "teach" = a parenting lesson told through the story. */
  goal?: "fun" | "teach";
  /** Teach mode: lesson pillar and the chosen lesson from the parenting library. */
  pillar?: LessonPillar;
  lessonId?: string;
  /** Teach mode: a snapshot of the chosen lesson (the server swaps in the library's current version). */
  lesson?: ParentingLesson;
  /** Teach mode: who says the takeaway — a short narrator voice-over at the end, or the parent. */
  takeaway?: "narrator" | "parent";
  /** Teach mode: show an ineffective way first, then the good way (A/B). */
  abFormat?: boolean;
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
  goal: "fun",
  pillar: "money",
  takeaway: "narrator",
  abFormat: false,
};

/** The creator picks the reel's length on the card: 2–8 clips of 10 seconds. */
export const CUTE_KIDS_MIN_SHOTS = 2;
export const CUTE_KIDS_MAX_SHOTS = 8;

export const AGE_LABEL: Record<KidAge, { vi: string; en: string }> = {
  toddler: { vi: "2–3 tuổi", en: "2–3 years" },
  young: { vi: "4–5 tuổi", en: "4–5 years" },
  school: { vi: "6–7 tuổi", en: "6–7 years" },
  middle: { vi: "8–10 tuổi", en: "8–10 years" },
  preteen: { vi: "11–12 tuổi", en: "11–12 years" },
  teen: { vi: "13–15 tuổi", en: "13–15 years" },
};

/** Where a child of that age is in the Vietnamese school system (for the age picker). */
export const AGE_STAGE: Record<KidAge, { vi: string; en: string }> = {
  toddler: { vi: "nhà trẻ", en: "nursery" },
  young: { vi: "mẫu giáo", en: "preschool" },
  school: { vi: "lớp 1–2", en: "grade 1–2" },
  middle: { vi: "lớp 3–5", en: "grade 3–5" },
  preteen: { vi: "lớp 6–7", en: "grade 6–7" },
  teen: { vi: "lớp 8–10", en: "grade 8–10" },
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
  middle: {
    years: "about 8–10 years old",
    maxWords: 14,
    speech:
      "an 8–10-year-old: full natural sentences of up to 14 words — quick logic and negotiation (\"Nhưng mẹ hứa rồi mà…\"), jokes and wordplay, a dramatic \"Trời ơiii\"; still a child's voice and vocabulary, never adult slang.",
    motor: "moves quickly and confidently — flops onto the sofa with a groan, paces while explaining, leans in the doorway, does a little victory dance, swings a school backpack",
    body: "a real 8–10-year-old — a slim child's face, new grown-up front teeth that look a little big in the smile, a school-age haircut",
  },
  preteen: {
    years: "about 11–12 years old",
    maxWords: 16,
    speech:
      "an 11–12-year-old: natural sentences of up to 16 words — wants to be treated as older (\"Con lớn rồi mà!\"), a sigh or \"Mẹ không hiểu đâu\", dry humour and a half-smile, a short mumble when embarrassed; a young voice, never adult.",
    motor: "slouches on the sofa, shrugs, half-closes the bedroom door, leans on the kitchen counter to talk, walks a step ahead of the parents in public, tries to look cool and then laughs",
    body: "a real 11–12-year-old — a still-childlike face on the way to looking older, a neat school-age haircut",
  },
  teen: {
    years: "about 13–15 years old",
    maxWords: 18,
    speech:
      "a 13–15-year-old teenager: natural sentences of up to 18 words — a light touch of everyday teen talk (\"Ủa?\", \"Ok mẹ\", \"Cạn lời\"), dry humour, sometimes a one-word answer, wants to be heard and treated as nearly grown-up; a teenager's voice, never an adult's.",
    motor: "lounges on the sofa with headphones around the neck, leans on the doorframe, glances at the phone between sentences, shrugs, then joins in when it is interesting",
    body: "a real 13–15-year-old teenager — a youthful face, neat everyday teen style",
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

/** Expressions of 8–12-year-olds (no toddler pouts or tiny stamps). */
export const OLDER_EXPRESSION_BANK =
  "a playful eye-roll, a dramatic sigh with the head tipped back, a half-smile fighting not to laugh, raised eyebrows, a \"seriously?\" look, a proud grin, an embarrassed hand over the eyes, wide eyes in disbelief, a shy shrug";

export const EXPRESSION_BANK =
  "a sulky frown with puffed-up cheeks, arms crossed and turning away with a \"hmph\", slow side-eye, gasp with both hands over the mouth, shy smile hiding behind little hands, proud chin-up grin, sleepy slow blinks, tiny stamp of the foot, eyes going wide in disbelief";

export const KID_TRAITS: Array<{ id: KidTrait; label_vi: string; label_en: string; room_vi: string; older_vi?: string; older_room_vi?: string }> = [
  { id: "sweet_whiny", label_vi: "🥺 Nũng nịu", label_en: "🥺 Sweet & whiny", room_vi: "nũng nịu (giọng kéo dài, lắc lư, níu tay áo bố mẹ, chắp tay nài nỉ, mắt tròn long lanh)", older_vi: "🥺 Năn nỉ ngọt", older_room_vi: "năn nỉ ngọt (tựa vai bố mẹ, mắt cún con, chắp tay \"Đi mà mẹ…\", kéo dài \"Mẹ ơiii\" nửa đùa nửa thật)" },
  { id: "fake_cry", label_vi: "😭 Khóc nhè / ăn vạ", label_en: "😭 Pretend crying", room_vi: "khóc nhè ăn vạ cho vui (mếu máo \"huhuhu\", dụi mắt, hé ngón tay xem bố mẹ có dỗ không, được chiều là cười ngay)", older_vi: "😩 Than thở \"bi kịch\"", older_room_vi: "than thở \"bi kịch\" cho vui (nằm vật ra sofa \"Trời ơiii…\", úp gối lên mặt rồi hé ra xem, không khóc thật, rồi tự bật cười)" },
  { id: "clever", label_vi: "😏 Khôn lanh", label_en: "😏 Clever", room_vi: "khôn lanh (lý lẽ trẻ con mà làm bố mẹ cứng họng, ra \"điều kiện\", liếc mắt tinh nghịch, chốt câu thắng cuộc)", older_room_vi: "khôn lanh (lý lẽ đâu ra đấy, trích lại chính lời bố mẹ, đề xuất \"thỏa thuận công bằng\", liếc mắt tinh nghịch, chốt câu thắng cuộc)" },
  { id: "cheerful", label_vi: "😄 Hồn nhiên", label_en: "😄 Sunny", room_vi: "hồn nhiên (cười khanh khách, vỗ tay, xoay vòng, chạy ào tới ôm)" },
];

/** The trait's Vietnamese label for this age (8–12-year-olds get age-true names). */
export function traitLabelVi(trait: KidTrait, age?: KidAge): string {
  const k = KID_TRAITS.find((x) => x.id === trait)!;
  return isOlderKid(age) ? k.older_vi ?? k.label_vi : k.label_vi;
}

/** What each trait looks and sounds like on screen (pronouns follow the kid). */
function traitPerformance(trait: KidTrait, name: string, she: string, her: string, dialect: Dialect, age?: KidAge): string {
  const south = dialect === "south";
  if (isOlderKid(age)) return olderTraitPerformance(trait, name, she, her, south, age);
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

/** The same personality at 8–12: charming and age-true, never toddler-like. */
function olderTraitPerformance(trait: KidTrait, name: string, she: string, her: string, south: boolean, age?: KidAge): string {
  switch (trait) {
    case "sweet_whiny":
      return `NĂN NỈ NGỌT (sweet coaxing, age-true for ${age === "teen" ? "13–15" : "8–12"}): ${name} leans on a parent's shoulder, puts on puppy eyes, clasps ${her} hands — "${south ? "Đi mà má…" : "Đi mà mẹ…"}" — drags out "${south ? "Ba ơiii" : "Bố ơiii"}" half-jokingly, and grins when it works. Charming, never babyish.`;
    case "fake_cry":
      return `GIẢ VỜ "BI KỊCH" (theatrical protest for laughs): when told no, ${name} flops onto the sofa with a long groan "Trời ơiii…", pulls a cushion over ${her} face, peeks out to check whether it is working, then laughs it off. No real tears; it lasts 2–4 seconds and a parent answers with warm humour.`;
    case "clever":
      return `KHÔN LANH (quick-witted): ${name} out-argues the parents with real logic — quotes their own rules back, proposes a fair "deal", counts reasons on ${her} fingers — with a knowing side-glance, and lands the punchline in ${her} own words.`;
    case "cheerful":
      return `HỒN NHIÊN (sunny): ${she} laughs out loud, does a little victory dance, high-fives a parent, sparkling eyes.`;
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

/** What makes a child of each age read as a real child on camera (observed toddler/preschool behaviour). */
function realChildBehaviour(age: KidAge, name: string, she: string, her: string): string {
  switch (age) {
    case "toddler":
      return `REAL TODDLER BEHAVIOUR (what makes ${name} a real 2–3-year-old, not an AI doll): ${she} looks up at a parent's face before and after everything ${she} does, to check the reaction; points with one chubby finger at what ${she} wants and says one word; holds a parent's finger or the hem of a parent's shirt; hides behind a parent's leg and peeks out, then giggles; buries ${her} face in a parent's shoulder when shy; claps and bounces on bent knees when happy; pats a parent's face with both little hands; "talks" seriously in babble with a furrowed brow; holds a toy up high to show it; walks with slightly wobbly steps and plops down to sit; ${her} attention darts to something else for a second and comes back. Movements are small, a little clumsy, never perfectly coordinated.`;
    case "young":
      return `REAL 4–5-YEAR-OLD BEHAVIOUR: ${name} tugs a parent's hand to pull them toward something; whispers a "secret" into a parent's ear with a cupped hand; counts on ${her} fingers while explaining; acts with the whole body (arms wide for "this big", miming the story); eyes go wide and sparkle at a surprise; sneaks sideways glances to check whether a parent is watching; twists the hem of ${her} shirt or a toy while thinking; cannot keep still — shifts, hops, swings ${her} arms; a real belly laugh that makes ${her} fold over.`;
    case "school":
      return `REAL 6–7-YEAR-OLD BEHAVIOUR: ${name} negotiates ticking points off on ${her} fingers; a playful eye-roll and a dramatic sigh; leans ${her} whole weight on a parent's arm; tries to wink and blinks both eyes; copies a parent's tone and gesture exactly; giggles behind ${her} hand; looks up with pleading puppy eyes, then breaks into a grin; fiddles with a pencil or toy while thinking; checks a parent's face to see whether the joke landed.`;
    case "middle":
      return `REAL 8–10-YEAR-OLD BEHAVIOUR: ${name} argues with real logic and counts reasons on ${her} fingers; flops onto the sofa with a theatrical groan; explains something seriously with big hand gestures; fiddles with a pencil, a Rubik's cube or a backpack strap while talking; does a quick victory dance on a win; whispers a joke to a sibling and both snicker; glances at a parent to check whether ${she} is in trouble; beams at specific praise.`;
    case "teen":
      return `REAL 13–15-YEAR-OLD BEHAVIOUR: ${name} answers with a shrug or "Ừ", then talks a lot when the topic is ${her} own idea; wears headphones around ${her} neck; glances at the phone between sentences; leans on the doorframe of ${her} room; rolls ${her} eyes at a parent's joke but smiles; cares how ${she} looks in front of friends; opens up late in the evening when the house is quiet; says thanks in a low voice.`;
    case "preteen":
      return `REAL 11–12-YEAR-OLD BEHAVIOUR: ${name} rolls ${her} eyes and then smiles despite ${her}self; shrugs and answers "Bình thường"; keeps the bedroom door half-closed; types quickly on a homework tablet; walks a step ahead of the parents in public; tries to look cool, then cracks up at a parent's silly joke; looks away and mumbles when embarrassed; leans on the counter to talk when it is ${her} own idea.`;
  }
}

/** Every cute beat of the kid gets an instant warm answer, and the kid answers back (serve and return). */
function serveAndReturn(name: string, she: string, her: string, dialect: Dialect, age?: KidAge): string {
  if (isOlderKid(age)) {
    return `BACK-AND-FORTH (every clip is a real exchange, never a lecture): each move from ${name} — a look, a sigh, an argument, a joke, a shrug — gets an immediate, visible answer from a parent: they sit down beside ${her} or lean in at ${her} eye level, match ${her} humour, name what ${she} feels (${dialect === "south" ? `"Con thấy không công bằng hả?"` : `"Con thấy không công bằng à?"`}), ask ${her} view, a hand on ${her} shoulder or a fist bump. Then ${name} reacts (a half-smile, a counter-argument, a nod) — at least two full exchanges per clip. Frame the exchanges as an eye-level two-shot so both faces read.`;
  }
  return `SERVE AND RETURN (every clip is a back-and-forth, never a monologue): each "serve" from ${name} — a look, a point, a whine, a word, a held-up toy, a hug, a pretend cry — gets an IMMEDIATE, visible "return" from a parent within a second: they crouch to ${her} eye level, look where ${she} looks, mirror ${her} expression (a playful sulky face back, wide eyes back), name it warmly (${dialect === "south" ? `"Con muốn cái này hả?", "Ôi, bé cưng buồn rồi hả"` : `"Con muốn cái này à?", "Ôi, bé con buồn rồi à"`}), touch gently (a hand on ${her} back or head, fixing ${her} hair, a little squeeze), answer a nũng nịu voice with a soft sing-song voice of their own, or laugh with ${her}. Then ${name} reacts to that return (a shy smile, a giggle, a new serve) — at least two full exchanges per clip. A serve is never left hanging. Frame the exchanges as an eye-level two-shot so both faces read, and cut to the parent's face for the return.`;
}

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
  sibling: { north: "Anh Tin", south: "Anh Hai", en: "older brother" },
  friend: { north: "Bạn Bống", south: "Bạn Bống", en: "child friend from next door" },
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

const CHILD_MEMBERS = new Set<FamilyMember>(["baby", "sibling", "friend"]);
/** The big brother is a few years older than the star. */
const SIBLING_YEARS: Record<KidAge, string> = {
  toddler: "about 8–9 years old",
  young: "about 8–9 years old",
  school: "about 9–10 years old",
  middle: "about 12–13 years old",
  preteen: "about 14–15 years old",
  teen: "about 17–18 years old",
};
const MEMBER_ROLE: Partial<Record<FamilyMember, string>> = { baby: "em bé", sibling: "anh trai", friend: "bạn của bé" };

/** Teach mode: the picked lesson (the snapshot carried by the config). */
export function lessonOf(config: Pick<CuteKidsConfig, "goal" | "lessonId" | "lesson">): ParentingLesson | undefined {
  return config.goal === "teach" && config.lesson && config.lesson.id === config.lessonId ? config.lesson : undefined;
}

export interface LessonTeachingGuide {
  positiveModel: string;
  steps: string[];
  observableProof: string;
  whyRight: string;
  avoid: string;
}

const SOCIAL_PILLARS = new Set<LessonPillar>(["behavior", "words", "manners", "honesty", "respect", "family", "social", "empathy"]);
const PRACTICE_PILLARS = new Set<LessonPillar>(["routines", "eating", "independence", "school", "learning", "play", "nature", "pets"]);
const SAFETY_PILLARS = new Set<LessonPillar>(["safety", "public", "travel"]);
const FEELING_PILLARS = new Set<LessonPillar>(["emotions", "calm", "confidence", "connection"]);

/** A lesson written for 2–5-year-olds: its guide has to work for a child who answers with a nod, a point or a few words. */
const isLittleLesson = (lesson: ParentingLesson) => lesson.ages.some((age) => age === "toddler" || age === "young");

function positiveModelFor(lesson: ParentingLesson, child: string, little: boolean): string {
  if (FEELING_PILLARS.has(lesson.pillar)) {
    return little
      ? `Bố mẹ giữ giọng nhỏ và chậm, ngồi ngang tầm mắt ${child} và gọi tên cảm xúc thay ${child} (“Con đang sợ/giận, bố mẹ ở đây”) để ${child} học cách bình tĩnh từ chính bố mẹ.`
      : `Bố mẹ tự nói cảm xúc và nhu cầu của mình bằng giọng bình tĩnh, nghe hết câu rồi mới giải quyết để ${child} thấy bình tĩnh không có nghĩa là giấu cảm xúc.`;
  }
  if (lesson.pillar === "screens") {
    return `Bố mẹ đặt thiết bị của mình xuống trước, làm đúng quy tắc đang yêu cầu và nói rõ khi nào người lớn thật sự phải dùng thiết bị cho công việc gấp.`;
  }
  if (SOCIAL_PILLARS.has(lesson.pillar)) {
    return `Bố mẹ dùng chính cách nói và hành vi tôn trọng mà mình muốn ${child} học: không gắn nhãn, không mỉa mai, nhận phần sai của mình và sửa bằng hành động.`;
  }
  if (PRACTICE_PILLARS.has(lesson.pillar)) {
    return `Bố mẹ làm mẫu một lượt thật chậm, nói thành lời điều mình đang làm, rồi lùi lại để ${child} tự thử thay vì làm hộ hoặc chỉ ra lệnh.`;
  }
  if (lesson.pillar === "money") {
    return `Bố mẹ cũng dùng danh sách, ngân sách và so sánh lựa chọn của chính mình để ${child} thấy quy tắc tiền bạc áp dụng cho cả nhà.`;
  }
  if (lesson.pillar === "thinking") {
    return `Bố mẹ sẵn sàng nói “Bố mẹ chưa biết, mình cùng kiểm tra”, xem bằng chứng trước khi kết luận và đổi ý khi dữ kiện mới rõ hơn.`;
  }
  if (SAFETY_PILLARS.has(lesson.pillar)) {
    return `Người lớn làm đúng quy tắc an toàn trước, giải thích ngắn gọn và tập cùng ${child}; không dùng lời dọa để buộc con nghe.`;
  }
  return `Bố mẹ làm trước điều mình đang yêu cầu, giữ lời đã thống nhất và cho ${child} thấy người lớn cũng sửa sai khi làm chưa đúng.`;
}

function proofFor(lesson: ParentingLesson, child: string, little: boolean): string {
  if (lesson.pillar === "screens") return `Dùng đồng hồ hẹn giờ, giỏ cất thiết bị hoặc bảng giờ chung; để ${child} tận mắt thấy thiết bị của người lớn cũng được cất và cả nhà cùng thực hiện.`;
  if (FEELING_PILLARS.has(lesson.pillar)) {
    return little
      ? `Bố mẹ nói thành lời điều vừa thay đổi để ${child} nhận ra (“Lúc nãy con còn sợ, giờ con thở chậm rồi đấy”); kết quả nhìn thấy được là ${child} dịu lại, nhìn bố mẹ và cùng làm tiếp.`
      : `Sau khi cùng dừng lại, hỏi ${child} tự nhận xét giọng nói, nét mặt hoặc mức bình tĩnh trước và sau; kết quả quan sát được là hai bên nói tiếp được và tìm ra một bước giải quyết.`;
  }
  if (SOCIAL_PILLARS.has(lesson.pillar)) {
    return little
      ? `Bố mẹ diễn nhanh hai cách bằng thú bông hoặc chính mình — một cách giành giật, nói cộc và một cách nhẹ nhàng — rồi hỏi “Bạn gấu thích cách nào?”; ${child} chỉ tay hoặc gật đầu chọn cách phù hợp.`
      : `Đóng vai nhanh hai cách nói — cách thiếu tôn trọng và cách phù hợp — rồi hỏi ${child} người nghe cảm thấy gì và cách nào giúp vấn đề được giải quyết.`;
  }
  if (PRACTICE_PILLARS.has(lesson.pillar)) {
    return little
      ? `Dùng một dấu hiệu nhìn thấy ngay như đồ đã vào giỏ, đĩa đã sạch hay hình dán trên bảng; để ${child} tự nhìn trước–sau và được khen đúng việc vừa làm.`
      : `Dùng một dấu hiệu nhìn thấy được như danh sách, đồng hồ, đồ vật đã hoàn thành hoặc lần thử thật; để ${child} tự đối chiếu trước–sau thay vì chỉ nghe người lớn khẳng định.`;
  }
  if (lesson.pillar === "money") {
    return little
      ? `Đặt món đồ và số xu ${child} đang có cạnh nhau rồi cùng đếm; để ${child} tự thấy đủ hay chưa đủ thay vì chỉ nghe “không được”.`
      : `Đặt các lựa chọn, giá tiền và số tiền đang có cạnh nhau; để ${child} tự tính và nhìn thấy lựa chọn nào nằm trong kế hoạch.`;
  }
  if (lesson.pillar === "thinking") {
    return little
      ? `Cùng thử tận tay (đổ nước, thả đồ, đặt hai thứ cạnh nhau) để kết quả trả lời; ${child} chỉ vào điều mình nhìn thấy thay vì nghe bố mẹ nói đáp án.`
      : `Cùng thử, đo hoặc kiểm tra ít nhất hai nguồn/cách làm; để kết quả thực tế trả lời thay cho câu “bố mẹ luôn đúng”.`;
  }
  if (SAFETY_PILLARS.has(lesson.pillar)) {
    return little
      ? `Tập lại lúc đang an toàn, có người lớn nắm tay hoặc đứng sát bên; để ${child} làm đúng động tác hoặc chỉ vào chỗ phải dừng, rồi khen ngay khi ${child} làm đúng.`
      : `Tập thử trong tình huống an toàn và có người lớn giám sát, sau đó để ${child} chỉ lại dấu hiệu nguy hiểm, điểm dừng hoặc người cần tìm khi cần giúp.`;
  }
  return little
    ? `Cho ${child} thử cách phù hợp trong một việc nhỏ, rồi bố mẹ nói thành lời kết quả ${child} nhìn thấy (“Con chờ đến lượt, bạn cười với con rồi kìa”).`
    : `Cho ${child} thử lựa chọn phù hợp ngay trong một việc nhỏ, rồi cùng nhìn kết quả và hỏi “Cách nào giúp mọi người an toàn, được tôn trọng và giữ đúng thỏa thuận hơn?”.`;
}

/** The first step: safety comes before any talk; a little one gets a crouch and one short sentence. */
function openingStepFor(lesson: ParentingLesson, child: string, little: boolean): string {
  if (SAFETY_PILLARS.has(lesson.pillar)) {
    return `An toàn trước: nếu có nguy hiểm, người lớn nắm tay hoặc đưa ${child} ra chỗ an toàn ngay; khi đã an toàn mới nói ngắn gọn bằng giọng bình tĩnh.`;
  }
  return little
    ? `Dừng phản ứng vội, ngồi xuống ngang tầm mắt ${child} và gọi tên điều ${child} đang muốn hoặc cảm thấy bằng một câu thật ngắn.`
    : `Dừng phản ứng vội, đến gần ${child}, mô tả điều đang xảy ra và nghe ${child} nói hết câu.`;
}

// A clause whose subject is the child (not "con mèo", "con cá"…) is the child's response, not a parent's step.
const CHILD_SUBJECT = /^(?:bé|con)\s+(?!(?:mèo|chó|cún|cá|chim|gà|thỏ|gấu|vật|thú|búp bê)(?!\p{L}))/iu;

const capitalise = (text: string) => `${text.charAt(0).toLocaleUpperCase("vi")}${text.slice(1)}`;

/** One technique clause as a step a parent can follow: capitalised, and the child's part framed as the response to wait for. */
function stepFromClause(clause: string, child: string): string {
  const text = clause.trim().replace(/[.;,]+$/, "");
  const step = capitalise(CHILD_SUBJECT.test(text) ? `Chờ ${child} phản hồi: ${text}` : text);
  return /[.!?…"”»)]$/.test(step) ? step : `${step}.`;
}

/** Turn every compact library row into a detailed, filmable teaching plan that fits the youngest age it is written for. */
export function lessonTeachingGuideVi(lesson: ParentingLesson): LessonTeachingGuide {
  const older = lesson.ages.some((age) => isOlderKid(age));
  const little = isLittleLesson(lesson);
  const child = older ? "con" : "bé";
  const clauses = lesson.technique.split(/;\s*/).map((part) => part.trim()).filter(Boolean);
  const coreSteps = (clauses.length > 1 ? clauses : [lesson.technique]).map((part) =>
    part.length > 15 ? stepFromClause(part, child) : `Thực hiện rõ bước “${part}”, rồi dừng lại để ${child} quan sát và phản hồi.`
  );
  const steps = [
    openingStepFor(lesson, child, little),
    ...coreSteps,
    little
      ? `Để ${child} tự làm một bước nhỏ (đưa tay, gật đầu, tự cất đồ…); bố mẹ khen đúng hành động cụ thể và giữ giới hạn đã nói.`
      : `Mời ${child} nhắc lại hoặc tự làm một bước nhỏ; bố mẹ ghi nhận đúng hành động cụ thể và giữ giới hạn đã thống nhất.`,
  ];
  const base: LessonTeachingGuide = {
    positiveModel: positiveModelFor(lesson, child, little),
    steps,
    observableProof: proofFor(lesson, child, little),
    whyRight: lesson.takeaway,
    avoid: capitalise(lesson.wrongWay),
  };
  if (lesson.id !== "parent_phone_model") return base;
  return {
    positiveModel: `Mẹ nói: “Con nói đúng, mẹ cũng đang xem.” Mẹ cất điện thoại của mình trước để bé thấy quy tắc không chỉ dành cho trẻ con.`,
    steps: [
      `Mẹ cảm ơn bé đã chỉ ra điều chưa nhất quán, không dùng câu “Mẹ là người lớn nên khác”.`,
      `Mẹ cất điện thoại, chờ bé hoàn thành đoạn đang xem rồi cùng bé tắt máy tính bảng.`,
      `Hai mẹ con đặt cả hai thiết bị vào một giỏ và thống nhất giờ không màn hình trong bữa tối.`,
      `Nếu có việc gấp, mẹ nói rõ “Mẹ trả lời công việc hai phút rồi cất máy”, làm đúng thời gian đã nói.`,
      `Sau bữa ăn, mẹ hỏi bé thấy cả nhà trò chuyện khác thế nào khi không ai cầm thiết bị.`,
    ],
    observableProof: `Đặt điện thoại và máy tính bảng cạnh nhau trong cùng một giỏ, bật đồng hồ nếu cần dùng gấp và cùng kiểm tra khi chuông reo. Bé nhìn thấy người lớn cũng giữ lời, nên hiểu đây là quy tắc gia đình chứ không phải hình phạt riêng cho bé.`,
    whyRight: `Trẻ học mạnh nhất từ điều bố mẹ làm. Khi người lớn nhận phần chưa đúng và làm mẫu trước, bé dễ hợp tác mà vẫn học được sự công bằng và tự kiểm soát.`,
    avoid: `Mẹ nói “Mẹ là người lớn, khác!” rồi tiếp tục lướt điện thoại; cách này khiến bé thấy quy tắc thiếu công bằng và học rằng quyền lực quan trọng hơn việc giữ lời.`,
  };
}

/** The teaching brief the card puts in the request box; the shot count stays out of it because the creator may pick another one. */
export function lessonTeachingBriefVi(lesson: ParentingLesson): string {
  const guide = lessonTeachingGuideVi(lesson);
  return [
    `Tình huống: ${lesson.situation}`,
    `Hình mẫu tích cực của bố mẹ: ${guide.positiveModel}`,
    `Xử lý từng bước:\n${guide.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`,
    `Cho con tự thấy đúng–sai: ${guide.observableProof}`,
    `Vì sao cách này phù hợp: ${guide.whyRight}`,
    `Tránh làm: ${guide.avoid}`,
  ].join("\n");
}

/** True when the request already carries a lesson's teaching brief (picked from the library, maybe edited). */
function hasTeachingBrief(request: string): boolean {
  return /Xử lý từng bước:/.test(request);
}

export interface LessonShotAdvice {
  recommendedShots: 3 | 4;
  totalSeconds: 30 | 40;
  reason: string;
  shotPlan: string[];
  dialogueDirection: string;
}

/** Recommend a compact 10-second-shot structure with director-led acting and naturally timed dialogue. */
export function lessonShotAdviceVi(lesson: ParentingLesson, abFormat = false): LessonShotAdvice {
  // A long chain of beats or extra people on screen needs the fourth clip; most lessons fit 30 seconds.
  const beats = lesson.technique.split(/;\s*/).filter((part) => part.trim()).length;
  const extraCast = (lesson.needs ?? []).length;
  const recommendedShots: 3 | 4 = abFormat || beats >= 6 || extraCast >= 2 ? 4 : 3;
  const dialogueDirection = "Mỗi shot tối đa 3 lượt thoại và 2 người nói chính; trong giới hạn đó, nhịp tình huống quyết định số lượt — có thể chỉ một câu, 2–3 lượt ngắn hoặc một khoảnh khắc im lặng có phản ứng, miễn là nói tự nhiên và còn khoảng thở. Câu nào không vừa thì chuyển sang shot sau. Trước, trong và sau từng câu phải chỉ rõ ánh mắt, nét mặt, tư thế, hành động của người nói và phản ứng đang diễn ra của người nghe. Giọng nói bám đúng thái độ: bực nhưng không quát, ngập ngừng khi nhận sai, chậm và ấm khi kết nối, sáng lên khi đã hiểu; không ai đứng đơ chờ đến lượt.";
  const shotPlan = abFormat
    ? [
        `Shot 1 — Cách chưa khéo: mở thẳng vào tình huống; cận biểu cảm và thái độ của con khi bố mẹ phản ứng theo cách cần tránh. Trao đổi ngắn vừa đủ, từng lượt có phản ứng nối tiếp.`,
        `Shot 2 — Hậu quả và chuyển nhịp: con phản ứng rõ hơn bằng gương mặt/cử chỉ; bố mẹ nhận ra, dừng lại, thở và tua lại tình huống.`,
        `Shot 3 — Cách phù hợp: bố mẹ làm mẫu tích cực, lời nói có nhấn nhá đúng cảm xúc và đi cùng các bước chính; quay hai người trong cùng khung để thấy phản ứng qua lại.`,
        `Shot 4 — Con tự thấy kết quả: con thử một bước, quan sát minh chứng đúng–sai, thái độ dịu hoặc tự tin hơn; kết bằng khoảnh khắc ấm và câu chốt ngắn.`,
      ]
    : recommendedShots === 4
      ? [
          `Shot 1 — Móc câu: vào thẳng tình huống và cận biểu cảm, thái độ đặc trưng của con; lời thoại ngắn có cảm xúc, không giải thích dài.`,
          `Shot 2 — Bố mẹ làm mẫu: người lớn dừng phản ứng vội, thể hiện nét mặt bình tĩnh, nhận cảm xúc hoặc phần chưa đúng của mình; lời nói chậm, có khoảng dừng và từ khóa được nhấn.`,
          `Shot 3 — Cùng thực hành: bố mẹ thực hiện các bước chính, biểu cảm của con phản hồi bằng ánh mắt, tư thế và một hành động cụ thể; lời thoại chỉ hỗ trợ điều đang diễn ra.`,
          `Shot 4 — Con tự thấy đúng–sai: cho thấy kết quả hoặc so sánh quan sát được, biểu cảm con chuyển biến tự nhiên; kết bằng tương tác ấm và lời chốt gọn.`,
        ]
      : [
          `Shot 1 — Móc câu: tình huống xuất hiện ngay, cận biểu cảm và thái độ của con; dùng trao đổi cảm xúc thật gọn.`,
          `Shot 2 — Làm mẫu và xử lý: bố mẹ bình tĩnh làm mẫu, thực hiện kỹ thuật chính; đạo diễn phân bổ các lượt thoại theo phản ứng qua lại, có nhịp nghỉ và nhấn đúng cảm xúc.`,
          `Shot 3 — Con thử và thấy kết quả: con làm một bước, nhìn thấy điều thay đổi, biểu cảm dịu/tự tin hơn; kết bằng hành động ấm áp và câu chốt ngắn.`,
        ];
  return {
    recommendedShots,
    totalSeconds: (recommendedShots * 10) as 30 | 40,
    reason: abFormat
      ? "Kiểu “2 cách xử lý” cần đủ bốn nhịp: cách chưa khéo → tua lại → cách phù hợp → con thấy kết quả."
      : recommendedShots === 4
        ? "Bài có nhiều nhịp xử lý hoặc nhiều nhân vật, cần thêm một shot để thấy rõ tình huống → bố mẹ làm mẫu → con thực hành → kết quả."
        : "Bài có một chuỗi xử lý gọn, vừa nhịp 30 giây: tình huống → bố mẹ xử lý → con thấy kết quả.",
    shotPlan,
    dialogueDirection,
  };
}

/** Spread items over k groups in order, as evenly as possible; with fewer items than groups the items come first and the last groups stay empty. */
function spreadOver<T>(items: T[], k: number): T[][] {
  if (items.length <= k) return Array.from({ length: k }, (_, i) => (i < items.length ? [items[i]!] : []));
  return Array.from({ length: k }, (_, i) => items.slice(Math.floor((i * items.length) / k), Math.floor(((i + 1) * items.length) / k)));
}

/** Beats for clips left over once the technique's own steps are placed: practice, a small setback, then doing it alone. */
const PRACTICE_BEATS_VI = [
  "con tự làm lại bước vừa học một lần nữa, bố mẹ lùi lại quan sát; để khoảng lặng cho nét mặt và phản ứng thay đổi, lời thoại thật ít.",
  "một trở ngại nhỏ xuất hiện (con lúng túng hoặc muốn bỏ dở), bố mẹ vẫn bình tĩnh và chỉ nhắc đúng một câu then chốt; biểu cảm hai bên đổi dần.",
  "con thử tự làm trọn vẹn không cần nhắc, bố mẹ chỉ gật đầu khích lệ; cận nét mặt tự tin dần của con, lời thoại rất ít.",
];

/** The lesson spread over the creator's clip count (2–8): one dramatic beat per 10-second clip, so a longer reel gets more room, never more lines per clip. */
export function lessonShotPlanForCountVi(lesson: ParentingLesson, shots: number, abFormat: boolean): string[] {
  const advice = lessonShotAdviceVi(lesson, abFormat);
  if (shots === advice.recommendedShots) return advice.shotPlan;
  if (shots <= 2) return [
    `Shot 1 — Tình huống và biểu cảm: mở bằng hành vi “${lesson.behavior}”; trao đổi cảm xúc ngắn theo phản ứng qua lại, bố mẹ dừng lại và làm mẫu ngay trong cùng shot.`,
    `Shot 2 — Xử lý và kết quả: bố mẹ thực hiện kỹ thuật chính, con tự thử một bước và nhìn thấy kết quả; ưu tiên thay đổi nét mặt/cử chỉ, kết bằng câu chốt rất ngắn.`,
  ];
  if (abFormat && shots === 3) return [
    `Shot 1 — Cách chưa khéo: vào thẳng tình huống, bố mẹ phản ứng theo cách cần tránh; cận biểu cảm và thái độ của con khi mọi chuyện căng hơn.`,
    `Shot 2 — Tua lại và cách phù hợp: bố mẹ dừng lại, thở, làm lại từ đầu bằng cách tôn trọng; phản ứng của con dịu dần theo từng câu.`,
    `Shot 3 — Con tự thấy kết quả: con thử một bước, nét mặt chuyển biến rõ; kết bằng khoảnh khắc ấm và câu chốt ngắn.`,
  ];
  if (!abFormat && shots === 3) return [
    `Shot 1 — Tình huống: vào thẳng mâu thuẫn, cận biểu cảm và thái độ “${lesson.behavior}”; lời thoại cảm xúc ngắn, mỗi lượt sinh ra từ phản ứng trước đó.`,
    `Shot 2 — Bố mẹ làm mẫu và xử lý: nét mặt bình tĩnh, giọng có khoảng dừng và nhấn từ khóa; thực hiện kỹ thuật bằng hành động, không giảng dài.`,
    `Shot 3 — Con thực hành và tự thấy kết quả: quay phản ứng thay đổi, hành động đúng và khoảnh khắc kết nối; lời chốt gọn theo nhịp diễn.`,
  ];
  if (!abFormat && shots === 4) return [
    `Shot 1 — Tình huống và biểu cảm của con: “${lesson.behavior}”; dùng cận cảnh và trao đổi ngắn làm móc câu.`,
    `Shot 2 — Bố mẹ dừng lại và làm mẫu: thể hiện thái độ bình tĩnh bằng gương mặt, tư thế, khoảng dừng rồi mới nói.`,
    `Shot 3 — Cùng xử lý: bố mẹ hướng dẫn, con tự làm một bước; lời thoại ngắn đi cùng hành động và phản ứng qua lại.`,
    `Shot 4 — Minh chứng và kết quả: con nhìn thấy điều thay đổi, biểu cảm chuyển biến tự nhiên; kết ấm áp và câu chốt ngắn.`,
  ];
  // 5–8 clips (A/B included): the technique's own beats are handed out one stretch per clip.
  const beats = lesson.technique.split(/;\s*/).map((part) => part.trim()).filter(Boolean);
  let extra = 0;
  const practice = (chunk: string[], label: string) => chunk.length
    ? `${label}: ${capitalise(chunk.join("; ")).replace(/[.;,]+$/, "")}. Biểu cảm và phản ứng của hai bên nối tiếp nhau; lời thoại chỉ đi cùng hành động.`
    : `${label}: ${PRACTICE_BEATS_VI[extra++ % PRACTICE_BEATS_VI.length]}`;
  if (abFormat) {
    const wrong = shots >= 6 ? 2 : 1;
    const right = shots - wrong - 2;
    return [
      ...Array.from({ length: wrong }, (_, i) => wrong === 1
        ? `Shot 1 — Cách chưa khéo: mở thẳng vào tình huống, bố mẹ phản ứng theo cách cần tránh (${lesson.wrongWay}); cận biểu cảm và thái độ của con.`
        : i === 0
          ? `Shot 1 — Cách chưa khéo (mở đầu): vào thẳng tình huống, bố mẹ phản ứng theo cách cần tránh; cận biểu cảm và thái độ của con.`
          : `Shot ${i + 1} — Cách chưa khéo (căng dần): ${lesson.wrongWay}; con phản ứng rõ hơn bằng nét mặt, cử chỉ, không ai tàn nhẫn.`),
      `Shot ${wrong + 1} — Hậu quả và tua lại: bố mẹ nhận ra, dừng lại, thở; cảnh quay lại đúng khoảnh khắc ban đầu, nét mặt bố mẹ dịu xuống.`,
      ...spreadOver(beats, right).map((chunk, i) => practice(chunk, `Shot ${wrong + 2 + i} — Cách phù hợp (${i + 1}/${right})`)),
      `Shot ${shots} — Con tự thấy kết quả: con thử một bước, quan sát minh chứng đúng–sai, biểu cảm dịu hoặc tự tin hơn; kết bằng khoảnh khắc ấm và câu chốt ngắn.`,
    ];
  }
  const middle = shots - 4;
  return [
    `Shot 1 — Móc câu: vào thẳng tình huống, cận biểu cảm và thái độ “${lesson.behavior}”; lời thoại ngắn có cảm xúc, không giải thích dài.`,
    `Shot 2 — Bố mẹ dừng lại và làm mẫu: nét mặt bình tĩnh, nhận cảm xúc hoặc phần chưa đúng của mình; lời nói chậm, có khoảng dừng và từ khóa được nhấn.`,
    ...spreadOver(beats, middle).map((chunk, i) => practice(chunk, `Shot ${3 + i} — Cùng xử lý (${i + 1}/${middle})`)),
    `Shot ${shots - 1} — Con tự thấy đúng–sai: cho thấy kết quả hoặc so sánh quan sát được, biểu cảm của con chuyển biến tự nhiên; không giảng giải.`,
    `Shot ${shots} — Kết ấm áp: khoảnh khắc kết nối, phản ứng vui của cả nhà và câu chốt gọn.`,
  ];
}

/** The chosen family plus whoever the picked lesson needs on screen. */
export function familyWithLesson(config: Pick<CuteKidsConfig, "family" | "goal" | "lessonId" | "lesson">): FamilyMember[] {
  return [...new Set([...config.family, ...(lessonOf(config)?.needs ?? [])])];
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
  const others = familyWithLesson(config)
    .filter((m) => !PETS.has(m))
    .map((m) => {
      const label = FAMILY_LABEL[m];
      return {
        name: label[config.dialect],
        role: MEMBER_ROLE[m] ?? "người nhà",
        appearance: `Vietnamese ${m === "friend" ? `${label.en}, ${age.years}` : m === "sibling" ? `${label.en} ${SIBLING_YEARS[config.kidAge]}` : label.en}, warm friendly face, comfortable everyday home clothes`,
        isChild: CHILD_MEMBERS.has(m),
      };
    });
  return [kid, ...others];
}

/** The creator's request as it may reach a model: a 13–15 request on a blocked topic is swapped for a safe
 * everyday one (the card warns while it is typed). The stored request itself is never rewritten. */
function requestForModel(config: CuteKidsConfig): string {
  const request = config.request.trim();
  return config.kidAge === "teen" ? teenSafeRequest(request) : request;
}

/** The idea text that goes into the story box (and the writers' room). */
export function cuteKidsStoryIdea(config: CuteKidsConfig): string {
  const cast = familyCast(config);
  const pickedLesson = lessonOf(config);
  const pets = familyWithLesson(config).filter((m) => PETS.has(m)).map((m) => FAMILY_LABEL[m][config.dialect]);
  const format = config.format && config.format !== "auto" ? VIRAL_FORMATS.find((f) => f.id === config.format) : detectFormat(config.request);
  return [
    requestForModel(config) || pickedLesson?.situation,
    `Nhân vật: ${cast[0]!.name} (${config.kidGender === "girl" ? "bé gái" : "bé trai"} ${AGE_LABEL[config.kidAge].vi})${cast.length > 1 ? `, ${cast.slice(1).map((c) => c.name).join(", ")}` : ""}${pets.length ? `; thú cưng: ${pets.join(", ")}` : ""}.`,
    format ? `Kiểu video: ${format.label_vi}.` : "",
    (config.traits ?? []).length ? `Tính cách bé: ${(config.traits ?? []).map((t) => traitLabelVi(t, config.kidAge).replace(/^\S+\s/, "").toLowerCase()).join(", ")}; bố mẹ luôn hưởng ứng.` : "",
    ...lessonLinesVi(config),
  ].filter(Boolean).join("\n");
}

/** Teach mode, Vietnamese: the lesson, the parent's way, the takeaway and the A/B format. */
function lessonLinesVi(config: CuteKidsConfig): string[] {
  if (config.goal !== "teach") return [];
  const lesson = lessonOf(config);
  const guide = lesson ? lessonTeachingGuideVi(lesson) : undefined;
  const shotAdvice = lesson ? lessonShotAdviceVi(lesson, config.abFormat === true) : undefined;
  const who = config.takeaway === "parent" ? "bố mẹ nói với bé ở cuối video" : "giọng dẫn ngắn ở cuối video";
  // The brief picked from the library (and maybe edited by the creator) already sits in the request: don't repeat it.
  const detailed = guide && !hasTeachingBrief(requestForModel(config)) ? guide : undefined;
  return [
    lesson ? `🎓 Bài học dạy con (${pillarLabel(lesson.pillar)}): ${lesson.title}.` : "🎓 Video dạy con: bố mẹ xử lý tình huống bằng một cách cụ thể, tôn trọng bé.",
    detailed ? `Hình mẫu tích cực của bố mẹ: ${detailed.positiveModel}` : "",
    detailed ? `Xử lý từng bước: ${detailed.steps.map((step, index) => `${index + 1}) ${step}`).join(" ")}` : "",
    detailed ? `Cho con tự thấy đúng–sai: ${detailed.observableProof}` : "",
    lesson ? `Cách làm: ${lesson.method}.` : "",
    lesson ? `Câu chốt (${who}): ${lesson.takeaway}` : `Câu chốt: ${who}.`,
    detailed ? `Cách chưa khéo cần tránh: ${detailed.avoid}` : "",
    shotAdvice ? `Số shot: ${config.shots} shot × 10 giây = ${config.shots * 10} giây (gợi ý ${shotAdvice.recommendedShots} shot — ${shotAdvice.reason})` : "",
    shotAdvice ? `Biểu cảm và lời thoại: ${shotAdvice.dialogueDirection}` : "",
    config.abFormat ? `Kiểu "2 cách xử lý": cách 1 — phản ứng chưa khéo ở trên; cách 2 — bố mẹ làm mẫu, hướng dẫn từng bước và để con tự quan sát kết quả.` : "",
  ].filter(Boolean);
}

/** Teach mode: the parenting lesson, its structure, the takeaway and the A/B format. */
function parentingDirective(config: CuteKidsConfig, kidName: string): string[] {
  if (config.goal !== "teach") return [];
  const lesson = lessonOf(config);
  const guide = lesson ? lessonTeachingGuideVi(lesson) : undefined;
  const shotAdvice = lesson ? lessonShotAdviceVi(lesson, config.abFormat === true) : undefined;
  const actualShotPlan = lesson ? lessonShotPlanForCountVi(lesson, config.shots, config.abFormat === true) : [];
  const n = config.shots;
  const narrator = config.takeaway !== "parent";
  const cach1End = n >= 6 ? 3 : n >= 4 ? 2 : 1;
  const structure = config.abFormat
    ? `"2 CÁCH XỬ LÝ" (A/B): Cách 1 fills clip 1${cach1End > 1 ? `–${cach1End}` : ""} — the same relatable moment handled the ineffective way (${lesson ? lesson.wrongWay : "a flat no, or giving in at once"}), and ${kidName} escalates (comic and brief, never cruel). Then a clear rewind beat — ${narrator ? "the narrator says \"Cách 1…\" at the start and \"Còn cách 2…\" at the rewind" : "the scene visibly restarts from the same moment: the parent pauses, takes a breath and begins again"} — and Cách 2 fills the remaining clips: the parent uses the technique, ${kidName} calms step by step, and the ending is warm.`
    : `clip 1 = the relatable moment every parent knows (hook in 0–2 s); the middle clip${n > 3 ? "s" : ""} = ${kidName} escalates with the personality beats while the parent stays calm and applies the technique step by step; the last clip = the warm result and the takeaway.`;
  const takeaway = narrator
    ? `TAKEAWAY BY NARRATOR: the last clip ends with a short, warm narrator voice-over (≤ 18 words, same regional accent) that speaks to parents — "Mẹo nhỏ: …" or "Bố mẹ ơi, …"${lesson ? ` — carrying the idea: "${lesson.takeaway}"` : ""}. ${config.abFormat ? "Besides the two labels, it is the only voice-over." : "It is the only voice-over in the video."}`
    : `TAKEAWAY BY THE PARENT: in the last clip the parent says the lesson to ${kidName} in one warm, natural line — never a lecture${lesson ? ` — carrying the idea: "${lesson.takeaway}"` : ""}. No narrator.`;
  return [
    `- PARENTING LESSON (the reel teaches parents through the story — show it, never preach)${lesson
      ? `: "${lesson.title}" — ${kidName} ${lesson.behavior}; the parent's technique: ${lesson.technique} (approach: ${lesson.method}).`
      : ": take the lesson from the request; the parent answers the kid's behaviour with one concrete, respectful technique (name the feeling, keep the limit, offer a choice or a plan, a natural consequence)."}`,
    ...(guide ? [
      `- POSITIVE ROLE MODEL: ${guide.positiveModel}`,
      `- STEP-BY-STEP PARENT RESPONSE: ${guide.steps.map((step, index) => `${index + 1}) ${step}`).join(" ")}`,
      `- LET THE CHILD SEE WHY: ${guide.observableProof} Show the observable comparison or result on screen; do not turn it into a lecture or an unsupported claim.`,
      `- RIGHT VS WRONG: the respectful way works because ${guide.whyRight}; avoid this response: ${guide.avoid}`,
      `- 10-SECOND SHOT ADVICE: recommended ${shotAdvice!.recommendedShots} shots (${shotAdvice!.totalSeconds} seconds) because ${shotAdvice!.reason} The creator selected ${n} shots; follow this exact plan: ${actualShotPlan.join(" ")}`,
      `- PERFORMANCE DIRECTOR — TURN BY TURN: ${shotAdvice!.dialogueDirection} Use at most three dialogue turns and two main speakers per 10-second clip; move any further line to the next clip. Fit only what can be performed naturally inside 10 seconds. For every turn, choreograph in order: the trigger/reaction before speech → the speaker's eyes, face, posture and motivated gesture during the line → the listener's simultaneous silent response → the physical/emotional after-beat that motivates the next turn. Pace, pause, emphasis and volume must match the visible acting.`,
    ] : []),
    `- LESSON STRUCTURE (${n} clips): ${structure}`,
    `- ${takeaway}`,
    "- PARENTS MODEL RESPECTFUL PARENTING: calm, warm and firm when needed; never hitting, yelling, threats, shaming or comparing the kid with others. The advice is general and gentle (positive-discipline principles), with no medical or psychological claims.",
  ];
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
  const older = isOlderKid(config.kidAge);
  const arc = traits.includes("sweet_whiny") && traits.includes("fake_cry") && traits.includes("clever")
    ? older
      ? ` Default arc: sweet coaxing → a parent's playful "no" → a dramatic groan on the sofa → a smart, fair deal that wins → everyone laughs.`
      : ` Default arc: nũng nịu ask → a parent's playful "no" → khóc nhè theatre with peeking → a khôn lanh twist that wins → the family laughs and cuddles.`
    : "";
  return [
    `CUTE KIDS VIRAL REEL (HARD): a short family reel whose star is ${kid.name}, a ${config.kidGender} ${age.years}.`,
    `- STRUCTURE (${config.shots} clips of 10 s): 0–2 s hook on ${kid.name}'s face or the trigger moment, then escalation, then a punchline or warm twist; end on a moment that loops well. ${format ? `Format "${format.label_vi}": ${format.beats}.` : "Pick the most relatable everyday family situation in the request."}`,
    `- PACING FOR ${config.shots} CLIPS (${config.shots * 10} s, chosen by the creator): the writer and the director spread the story over exactly ${config.shots} clips — one clear dramatic beat per clip, each with its own action, reactions and at most three short dialogue turns. More clips mean more room to breathe and react, never more lines per clip; never stretch one beat over two clips or squeeze two beats into one. Every clip ends on a physical and emotional state that leads into the next.`,
    `- ${kid.name} SPEAKS LIKE ${age.speech} Every line of ${kid.name} has at most ${age.maxWords} words.`,
    `- ${kid.name} MOVES LIKE THE AGE: ${age.motor}. Body: ${age.body}.`,
    `- EXPRESSIONS carry the reel: ${older ? OLDER_EXPRESSION_BANK : EXPRESSION_BANK}. Every clip has at least one clear close reaction on ${kid.name}.`,
    `- PERFORMANCE BEFORE WORDS: treat every 10-second clip as if an acting director is on set. Dialogue turn count is story-led within a cap of three turns per clip: one line, two or three turns, or silence — whatever that exact beat needs, as long as all speech fits at a natural pace with breathing/reaction room. Before, during and after EACH turn, direct the speaker's eyes, changing expression, posture and motivated action plus every listener's live silent reaction. No explanatory monologues; nobody freezes while waiting to speak. Pauses, emphasis, volume and tone must match the face and body.`,
    ...(traits.length
      ? [`- ${kid.name}'S PERSONALITY — adorable in gestures, body language and voice in EVERY clip (each clip holds at least one of these beats, performed big and clear):${arc}`,
        ...traits.map((t) => `  · ${traitPerformance(t, kid.name, girl ? "she" : "he", girl ? "her" : "his", config.dialect, config.kidAge)}`)]
      : []),
    `- ${realChildBehaviour(config.kidAge, kid.name, girl ? "she" : "he", girl ? "her" : "his")} Use two or three of these per clip, motivated by the moment.`,
    `- ${serveAndReturn(kid.name, girl ? "she" : "he", girl ? "her" : "his", config.dialect, config.kidAge)}`,
    older
      ? `- VOICE of ${kid.name} (character_locks.voice): a real ${AGE_LABEL[config.kidAge].en.replace(" years", "")}-year-old's voice — clear and lively, a child's timbre that is not yet deep${traits.includes("sweet_whiny") ? ", sweet coaxing tones when asking" : ""}${traits.includes("fake_cry") ? ", dramatic groans that melt into laughter" : ""}; never adult-sounding.`
      : `- VOICE of ${kid.name} (character_locks.voice): a high, sweet, real child's voice${traits.includes("sweet_whiny") ? " with a sing-song nũng nịu delivery — drawn-out vowels, playful pitch rises" : ""}${traits.includes("fake_cry") ? ", theatrical \"huhu\" sniffles that snap into giggles" : ""}; never adult-sounding.`,
    `- ${parentsPlayAlong(config.dialect)}`,
    ...parentingDirective(config, kid.name),
    `- Parents and family talk naturally and warmly in full everyday sentences that carry the scene; the comedy comes from ${kid.name}.`,
    ...(familyWithLesson(config).includes("baby") ? [`- ${BABY_CARE_RULE}`] : []),
    ...(familyWithLesson(config).some((m) => m === "sibling" || m === "friend")
      ? [`- OTHER CHILDREN ON SCREEN (${familyCast(config).filter((c, i) => i > 0 && c.isChild && c.role !== "em bé").map((c) => c.name).join(", ")}): real kids of their age with their own small reactions and lines; the same child-safety and wording rules apply to them; ${kid.name} stays the star.`]
      : []),
    `- ${config.filming === "phone" ? PHONE_CAPTURE : CINEMATIC_CAPTURE} Real lived-in Vietnamese home or everyday place that fits the request.`,
    `- ${DIALECT_NOTE[config.dialect]}`,
    `- ${CHILD_SAFETY_RULES}`,
    ...(config.kidAge === "teen" ? [`- ${TEEN_SAFETY_RULE}`] : []),
    `- ${CHILD_SAFE_WORDING_RULE}`,
  ].join("\n");
}

/** Short Vietnamese brief for the writers' room idea box. */
export function cuteKidsRoomSeed(config: CuteKidsConfig): string {
  const age = AGE_PROFILES[config.kidAge];
  return [
    cuteKidsStoryIdea(config),
    `Yêu cầu: video ngắn đúng ${config.shots} shot × 10 giây, 2 giây đầu là gương mặt/biểu cảm của bé hoặc khoảnh khắc gây chuyện; kết bằng câu chốt hoặc cú quay xe ấm áp. Chia câu chuyện thành ${config.shots} nhịp, mỗi shot một nhịp rõ ràng với hành động riêng và tối đa 3 lượt thoại ngắn — đủ chỗ cho phản ứng, không dồn ép.`,
    ...((config.traits ?? []).length ? [`Bé phải thật dễ thương từ cử chỉ, điệu bộ đến lời nói, mỗi shot có ít nhất một khoảnh khắc: ${(config.traits ?? []).map((t) => { const k = KID_TRAITS.find((x) => x.id === t)!; return isOlderKid(config.kidAge) ? k.older_room_vi ?? k.room_vi : k.room_vi; }).join("; ")}.`] : []),
    "Bố mẹ luôn hưởng ứng: tan chảy, bật cười, trêu lại nhẹ nhàng, giả vờ nghiêm rồi chiều, gọi bé bằng tên âu yếm; không bao giờ phớt lờ hay mắng gắt.",
    isOlderKid(config.kidAge)
      ? `Tương tác qua lại như thật: mỗi câu lý lẽ, cái thở dài, câu đùa hay cái nhún vai của con đều được bố mẹ đáp lại ngay (ngồi xuống cạnh con, đùa lại, gọi tên cảm xúc, hỏi ý kiến con, đặt tay lên vai, đập tay), rồi con phản ứng lại — mỗi shot ít nhất hai lượt qua lại, không giảng giải dài. Con có cử chỉ thật của trẻ ${AGE_LABEL[config.kidAge].vi}: ${REAL_CHILD_VI[config.kidAge]}.`
      : `Tương tác qua lại như thật: mỗi ánh mắt, cái chỉ tay, tiếng nũng nịu, câu nói hay cái ôm của bé đều được bố mẹ đáp lại ngay (ngồi xuống ngang tầm mắt, nhìn theo hướng bé nhìn, bắt chước biểu cảm của bé, gọi tên điều bé muốn, xoa đầu, ôm nhẹ), rồi bé phản ứng lại — mỗi shot ít nhất hai lượt qua lại. Bé có cử chỉ thật của trẻ ${AGE_LABEL[config.kidAge].vi}: ${REAL_CHILD_VI[config.kidAge]}.`,
    ...(config.goal === "teach" ? ["Video dạy con: thể hiện bài học qua câu chuyện, không giảng; bố mẹ làm mẫu cách xử lý bình tĩnh, tôn trọng — không đánh, không quát, không dọa, không so sánh."] : []),
    ...(config.kidAge === "teen" ? [TEEN_SAFETY_RULE] : []),
    `Bé nói đúng tuổi: mỗi câu tối đa ${age.maxWords} từ; bố mẹ nói tự nhiên. Quay kiểu ${config.filming === "phone" ? "điện thoại gia đình" : "điện ảnh"}, giọng ${config.dialect === "north" ? "miền Bắc" : "miền Nam"}.`,
    "Nội dung gia đình lành mạnh, an toàn cho trẻ: không nguy hiểm, không dọa hay làm bé khóc thật, bé mặc đồ ở nhà bình thường. Bố mẹ thể hiện tình cảm bằng ôm vai, nắm tay.",
    familyWithLesson(config).includes("baby") ? "Em bé luôn được bế hoặc ở ngay cạnh người lớn đang chăm (nắm tay, ru, cười nói với em), em có phản ứng trong cảnh và có mặt ở kết — không để em ngồi một mình hay bị bỏ quên." : "",
  ].join("\n");
}

const REAL_CHILD_VI: Record<KidAge, string> = {
  toddler: "ngước nhìn mặt bố mẹ trước và sau mỗi việc, chỉ bằng một ngón tay mũm mĩm, nắm ngón tay hoặc vạt áo bố mẹ, nấp sau chân bố mẹ rồi ló ra cười, úp mặt vào vai khi ngại, vỗ tay nhún nhảy, hai tay vỗ vỗ má bố mẹ, bi bô nghiêm túc, bước đi chập chững",
  young: "kéo tay bố mẹ đi, thì thầm \"bí mật\" vào tai, đếm trên ngón tay, diễn bằng cả người, mắt tròn xoe lấp lánh, liếc trộm xem bố mẹ có nhìn không, không chịu đứng yên, cười gập cả người",
  school: "mặc cả đếm từng điều kiện trên ngón tay, đảo mắt tinh nghịch, thở dài kiểu người lớn, dựa cả người vào tay bố mẹ, nháy mắt mà nhắm cả hai mắt, nhại giọng bố mẹ, che miệng cười khúc khích",
  middle: "lý lẽ đâu ra đấy, đếm lý do trên ngón tay, nằm vật ra sofa than \"Trời ơi\", vừa nói vừa xoay bút hay khối rubik, nhảy điệu ăn mừng khi thắng, thì thầm trêu anh chị rồi cùng cười khúc khích, liếc bố mẹ xem mình có bị mắng không",
  teen: "nhún vai \"Ừ\" rồi nói say sưa khi đúng chủ đề mình thích, đeo tai nghe trên cổ, liếc điện thoại giữa câu, tựa khung cửa phòng nói chuyện, đảo mắt trước câu đùa của bố mà vẫn cười, ngại trước mặt bạn bè, tối muộn mới mở lòng, cảm ơn nho nhỏ",
  preteen: "đảo mắt rồi vẫn bật cười, nhún vai trả lời \"Bình thường\", khép hờ cửa phòng, đi trước bố mẹ một bước ở chỗ đông người, cố tỏ ra \"ngầu\" rồi phì cười vì câu đùa của bố, ngại thì nhìn đi chỗ khác và nói lí nhí, tự ra bếp tựa bàn kể chuyện khi muốn",
};

export const AI_LABEL_VI = "🤖 Video tạo bằng AI · #AIGenerated";

type SocialPostsLike = {
  tiktok?: { caption?: string; hashtags?: string[] };
  youtube_shorts?: { description?: string; hashtags?: string[] };
  facebook_reel?: { caption?: string; hashtags?: string[] };
};

/** Teach mode: the parent tip, a comment question and a gentle disclaimer, then the AI label. */
export function labelCuteKidsPosts(posts: SocialPostsLike | undefined | null, raw: CuteKidsConfig | null | undefined): void {
  if (!posts) return;
  const config = normalizeCuteKids(raw);
  if (config?.goal === "teach") {
    const lesson = lessonOf(config);
    const tip = [
      lesson ? `💡 Mẹo cho bố mẹ: ${lesson.takeaway}` : "",
      lesson ? `📚 Cách làm: ${lesson.method}` : "",
      "👇 Nhà mình xử lý tình huống này thế nào?",
      "(Mỗi bé mỗi khác — bố mẹ linh hoạt nhé.)",
    ].filter(Boolean).join("\n");
    const add = (s: string | undefined) => (s && s.includes("Nhà mình xử lý tình huống này") ? s : [s?.trim(), tip].filter(Boolean).join("\n\n"));
    const tags = (list: string[] | undefined) => [...new Set([...(list ?? []), "#dạycon", "#nuôidạycon"])];
    if (posts.tiktok) posts.tiktok = { ...posts.tiktok, caption: add(posts.tiktok.caption), hashtags: tags(posts.tiktok.hashtags) };
    if (posts.youtube_shorts) posts.youtube_shorts = { ...posts.youtube_shorts, description: add(posts.youtube_shorts.description), hashtags: tags(posts.youtube_shorts.hashtags) };
    if (posts.facebook_reel) posts.facebook_reel = { ...posts.facebook_reel, caption: add(posts.facebook_reel.caption), hashtags: tags(posts.facebook_reel.hashtags) };
  }
  labelAiSocialPosts(posts);
}

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

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A lesson snapshot from the client, kept only when it is complete and matches the picked id. */
function lessonFields(raw: unknown, lessonId: unknown): { lessonId?: string; lesson?: ParentingLesson } {
  if (!raw || typeof raw !== "object" || typeof lessonId !== "string") return {};
  const r = raw as Record<string, unknown>;
  const pillar = LESSON_PILLARS.find((p) => p.id === r.pillar)?.id;
  const ages = Array.isArray(r.ages) ? r.ages.filter((a): a is KidAge => KID_AGES.includes(a as KidAge)) : [];
  const needs = Array.isArray(r.needs) ? r.needs.filter((m): m is FamilyMember => FAMILY_MEMBERS.includes(m as FamilyMember)) : [];
  const lesson: ParentingLesson = {
    id: clip(r.id, 60),
    pillar: pillar ?? "money",
    ages,
    title: clip(r.title, 120),
    situation: clip(r.situation, 600),
    behavior: clip(r.behavior, 400),
    technique: clip(r.technique, 900),
    takeaway: clip(r.takeaway, 300),
    wrongWay: clip(r.wrongWay, 400),
    method: clip(r.method, 120),
    ...(needs.length ? { needs: [...new Set(needs)] } : {}),
  };
  const lessonText = [lesson.title, lesson.situation, lesson.behavior, lesson.technique, lesson.takeaway, lesson.wrongWay, lesson.method];
  const teenValid = !ages.includes("teen") || teenSafetyViolations(lessonText.join(" ")).length === 0;
  const complete = pillar && ages.length && teenValid && lesson.id === lessonId && lessonText.every(Boolean);
  return complete ? { lessonId, lesson } : {};
}

/** Normalise a config coming from the client. */
export function normalizeCuteKids(raw: unknown): CuteKidsConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const family = Array.isArray(r.family)
    ? (r.family.filter((m) => FAMILY_MEMBERS.includes(m as FamilyMember)) as FamilyMember[])
    : DEFAULT_CUTE_KIDS.family;
  return {
    request: String(r.request ?? "").slice(0, 4000),
    kidName: String(r.kidName ?? "").trim().slice(0, 40) || DEFAULT_CUTE_KIDS.kidName,
    kidGender: pick(r.kidGender, ["girl", "boy"] as const, "girl"),
    kidAge: pick(r.kidAge, KID_AGES, "school"),
    family: [...new Set(family)],
    filming: pick(r.filming, ["phone", "cinematic"] as const, "phone"),
    dialect: pick(r.dialect, ["north", "south"] as const, "north"),
    shots: Math.min(CUTE_KIDS_MAX_SHOTS, Math.max(CUTE_KIDS_MIN_SHOTS, Math.round(Number(r.shots)) || DEFAULT_CUTE_KIDS.shots)),
    format: typeof r.format === "string" && (r.format === "auto" || VIRAL_FORMATS.some((f) => f.id === r.format)) ? r.format : "auto",
    traits: Array.isArray(r.traits)
      ? [...new Set(r.traits.filter((t): t is KidTrait => KID_TRAITS.some((k) => k.id === t)))]
      : DEFAULT_CUTE_KIDS.traits,
    goal: pick(r.goal, ["fun", "teach"] as const, "fun"),
    pillar: pick(r.pillar, LESSON_PILLARS.map((p) => p.id), "money"),
    ...lessonFields(r.lesson, r.lessonId),
    takeaway: pick(r.takeaway, ["narrator", "parent"] as const, "narrator"),
    abFormat: r.abFormat === true,
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
export function buildEpisodeIdeasPrompt(raw: CuteKidsConfig, avoid: string[] = [], libraryTitles: string[] = []): string {
  const config = normalizeCuteKids(raw) ?? DEFAULT_CUTE_KIDS;
  const cast = familyCast(config);
  const pets = familyWithLesson(config).filter((m) => PETS.has(m)).map((m) => FAMILY_LABEL[m][config.dialect]);
  return [
    `Kid: ${cast[0]!.name}, ${config.kidGender === "girl" ? "bé gái" : "bé trai"} ${AGE_LABEL[config.kidAge].vi} (${AGE_PROFILES[config.kidAge].speech})`,
    `Family on screen: ${cast.slice(1).map((c) => c.name).join(", ") || "none"}${pets.length ? `; pets: ${pets.join(", ")}` : ""}.`,
    requestForModel(config) ? `The creator's current direction: ${requestForModel(config)}` : "",
    `Viral formats that work (mix them, do not copy): ${VIRAL_FORMATS.map((f) => f.label_vi).join("; ")}.`,
    avoid.length ? `Do not repeat these: ${avoid.join("; ")}.` : "",
    (config.traits ?? []).length ? `The kid's personality, shown in every idea: ${(config.traits ?? []).map((t) => KID_TRAITS.find((k) => k.id === t)!.label_en.replace(/^\S+\s/, "")).join(", ")}; the parents always play along warmly.` : "",
    config.goal === "teach"
      ? `PARENTING CHANNEL: every idea teaches parents one everyday lesson in the area "${pillarLabel(config.pillar ?? "money").replace(/^\S+\s/, "")}". Each request must include: the situation; the positive behaviour the parent models first; three concrete response steps; one visible comparison, rehearsal or result that lets the child understand right versus wrong; the warm ending; and one short "Bài học: …" line. Show the teaching through action, never a lecture.`
      : "",
    config.goal === "teach" && libraryTitles.length
      ? `The channel's lesson library already covers these situations in this area — give fresh, different ones: ${libraryTitles.join("; ")}.`
      : "",
    ...(config.kidAge === "teen" ? [TEEN_SAFETY_RULE] : []),
    `Give 10 different episode ideas for ${config.shots} clips of 10 seconds, all at home or everyday places, each with a clear hook, escalation and a punchline that fits the kid's age. ${CHILD_SAFETY_RULES}`,
    config.goal === "teach"
      ? 'Return {"ideas":[{"title":"short Vietnamese title (max 8 words)","request":"six to eight concise Vietnamese sentences covering the situation, parent role model, three steps, visible right/wrong demonstration, warm ending and Bài học"}]}'
      : 'Return {"ideas":[{"title":"short Vietnamese title (max 8 words)","request":"one or two Vietnamese sentences: the situation, what the kid does and the ending"}]}',
  ].filter(Boolean).join("\n");
}

export function normalizeEpisodeIdeas(raw: unknown): EpisodeIdea[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { ideas?: unknown })?.ideas) ? (raw as { ideas: unknown[] }).ideas : [];
  const seen = new Set<string>();
  return list
    .map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      return { title: String(r.title ?? "").trim().slice(0, 80), request: String(r.request ?? "").trim().slice(0, 1400) };
    })
    .filter((i) => i.title && i.request && !seen.has(i.title.toLowerCase()) && seen.add(i.title.toLowerCase()))
    .slice(0, 10);
}

export const PHONE_PLATE_NOTE =
  "Photoreal smartphone photo of the real place, as a parent would snap it at home: natural daylight from windows and practical lamps, true-to-life colours, phone-camera deep focus, fine natural noise, real lived-in materials and clutter — a real home, not a staged studio set.";

// ─── Voices and on-screen performance (applied after the storyboard) ─────────

// A parent or grandparent role name. "Cô bé" / "Cậu bé" / "Chú bé" mean a
// little girl or boy, so a following "bé" keeps the name a child's.
const ADULT_KIN_WORD = /^(?:bố|ba|cha|mẹ|má|ông|bà|cô|chú|dì|bác|cậu|mợ|thím|dượng|dad|daddy|father|mom|mommy|mum|mother|grandpa|grandma|grandfather|grandmother|uncle|aunt|auntie)$/iu;

export function isAdultKinName(name: string): boolean {
  const words = String(name ?? "").normalize("NFC").trim().toLocaleLowerCase("vi").split(/\s+/u).filter(Boolean);
  return words.length > 0 && ADULT_KIN_WORD.test(words[0]!) && words[1] !== "bé";
}

const KID_NAME_PREFIX = /^(?:bé|con|em|cu|bạn|cô bé|cậu bé|chú bé)\s+/iu;

/**
 * The cast lock the card's kid name refers to. The card often says "Bé Na"
 * while the writer names the character "Na"; an exact-only match fell back to
 * the first lock marked is_child — which could be a parent the writer
 * mislabelled — and gave that parent the kid's sing-song voice.
 */
export function resolveKidLock<T extends { name: string; is_child?: boolean }>(locks: readonly T[], kidName: string): T | undefined {
  const key = (name: string) => String(name ?? "").normalize("NFC").trim().toLocaleLowerCase("vi");
  const wanted = key(kidName);
  const bare = wanted.replace(KID_NAME_PREFIX, "");
  const candidates = locks.filter((lock) => !isAdultKinName(lock.name));
  return (
    (wanted ? candidates.find((lock) => key(lock.name) === wanted) : undefined) ??
    (bare ? candidates.find((lock) => key(lock.name).replace(KID_NAME_PREFIX, "") === bare) : undefined) ??
    candidates.find((lock) => lock.is_child === true)
  );
}

const RESTRAINED_PROSODY = /\b(?:with\s+)?restrained\s+(?:context-appropriate\s+)?(?:pitch variation|prosody|emotion)\b/giu;

/**
 * The storyboard writer locks every voice with "restrained prosody" (the
 * general audio law). In a cute-kids reel that flattens the kid: the kid gets
 * a lively sing-song delivery, the family warm expressive voices.
 */
export function cuteKidsVoice(voice: string, opts: { isKid: boolean; traits?: KidTrait[]; kidAge?: KidAge }): string {
  const text = String(voice ?? "").trim();
  if (!text) return text;
  const older = opts.isKid && isOlderKid(opts.kidAge);
  const lively = !opts.isKid ? "warm, expressive natural pitch variation" : older ? "lively, natural pitch variation" : "lively sing-song pitch rises";
  let out = text.replace(RESTRAINED_PROSODY, `with ${lively}`);
  if (opts.isKid) {
    const traits = opts.traits ?? [];
    const extra = [
      traits.includes("sweet_whiny") ? (older ? "sweet coaxing tones when asking" : "a sweet nũng nịu sing-song with drawn-out vowels") : "",
      traits.includes("fake_cry") ? (older ? "dramatic groans that melt into laughter" : "theatrical \"huhu\" sniffles that snap into giggles") : "",
      traits.includes("clever") ? "a cheeky, quick-witted tone on the punchline" : "",
    ].filter((e) => e && !out.includes(e));
    if (extra.length) out = `${out.replace(/[.;\s]+$/, "")}; ${extra.join(", ")}.`;
  }
  return out;
}

const REAL_CHILD_SHORT: Record<KidAge, string> = {
  toddler: "looks up at the parent's face to check every reaction, points with one finger, holds a parent's finger or shirt hem, hides behind a leg and peeks out, buries the face in a shoulder, claps and bounces, slightly wobbly steps",
  young: "tugs a parent's hand, whispers into an ear, counts on fingers, acts with the whole body, sparkling wide eyes, sideways glances to check the parent, cannot keep still",
  school: "counts conditions on fingers, a playful eye-roll and sigh, leans on a parent's arm, a two-eyed wink attempt, copies the parent's tone, giggles behind a hand",
  middle: "argues with real logic counting reasons on fingers, flops on the sofa with a groan, fiddles with a pencil or cube while talking, a quick victory dance, checks the parent's face",
  teen: "a shrug and \"Ừ\" that turns into real talk on a favourite topic, headphones around the neck, a glance at the phone, leaning on the doorframe, an eye-roll that ends in a smile",
  preteen: "an eye-roll that turns into a smile, a shrug and \"Bình thường\", a half-closed bedroom door, trying to look cool then laughing, mumbling and looking away when embarrassed",
};

/** Video-prompt note: this project explicitly wants the kid's big, cute performance. */
export function cuteKidsPerformanceNote(kidName: string, traits: KidTrait[] = DEFAULT_CUTE_KIDS.traits ?? [], kidAge?: KidAge): string {
  const beats = [
    traits.includes("sweet_whiny") ? "nũng nịu coaxing (swaying, tugging a sleeve, hands clasped, big shining eyes, sing-song drawn-out voice)" : "",
    traits.includes("fake_cry") ? "playful pretend crying (scrunched face, \"huhu\", peeking through fingers) that snaps into a sunny grin" : "",
    traits.includes("clever") ? "cheeky clever looks and a knowing little grin on the punchline" : "",
    traits.includes("cheerful") ? "bright giggles, claps and little spins" : "",
  ].filter(Boolean);
  const real = kidAge ? ` Real child behaviour: ${REAL_CHILD_SHORT[kidAge]}.` : "";
  if (isOlderKid(kidAge)) {
    const olderBeats = [
      traits.includes("sweet_whiny") ? "sweet coaxing (puppy eyes, leaning on a parent's shoulder, a half-joking drawn-out \"Mẹ ơiii\")" : "",
      traits.includes("fake_cry") ? "a dramatic groan on the sofa with a cushion over the face, peeking out, then laughing it off (no real tears)" : "",
      traits.includes("clever") ? "real logic, a fair \"deal\" and a knowing side-glance on the punchline" : "",
      traits.includes("cheerful") ? "laughing out loud, a little victory dance, a high-five" : "",
    ].filter(Boolean);
    return `CHILD PERFORMANCE (explicitly required by this project — overrides any "restrained / never theatrical" rule for ${kidName} only): ${kidName} is a charming, age-true ${AGE_LABEL[kidAge!].en.replace(" years", "")}-year-old with big, clear, natural expressions${olderBeats.length ? `: ${olderBeats.join("; ")}` : ""} — never toddler babble or a little child's tantrum.${real} The parents answer every beat warmly and with humour. BACK-AND-FORTH: every look, sigh, argument or joke from ${kidName} gets an immediate answer from a parent (sitting beside ${kidName}, matching the humour, naming the feeling, asking ${kidName}'s view, a hand on the shoulder or a fist bump), and ${kidName} reacts back — a real exchange with both faces visible.`;
  }
  return `CHILD PERFORMANCE (explicitly required by this project — overrides any "restrained / never theatrical" rule for ${kidName} only): ${kidName} performs big, clear, adorable child expressions${beats.length ? `: ${beats.join("; ")}` : ""}.${real} The parents react warmly and visibly to every cute beat (melting smiles, laughs, gentle teasing, giving in with a cuddle). SERVE AND RETURN: every look, point, whine, word or hug from ${kidName} gets an instant warm return from a parent within a second (crouching to eye level, mirroring the expression, a gentle touch, a warm word or a soft sing-song answer), and ${kidName} reacts back — a real back-and-forth with both faces visible, never a serve left hanging.`;
}
