"use client";

// ============================================================
// 🧒 BÉ CƯNG VIRAL — one card to build a viral cute-kid family reel: type the
// situation, pick the kid (age, gender, optional photo) and the family, then
// build the video in one click, open the writers' room with it, or ask for 10
// episode ideas for the same kid.
// ============================================================
import { useEffect, useState } from "react";
import { Lightbulb, Loader2, PenLine, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { cn } from "@/lib/utils";
import { suggestCuteKidsEpisodes } from "@/actions";
import type { AIProvider } from "@/types";
import {
  AGE_LABEL,
  AGE_STAGE,
  DEFAULT_CUTE_KIDS,
  KID_AGES,
  isOlderKid,
  lessonTeachingBriefVi,
  lessonTeachingGuideVi,
  lessonShotAdviceVi,
  traitLabelVi,
  KID_TRAITS,
  VIRAL_FORMATS,
  normalizeCuteKids,
  type CuteKidsConfig,
  type EpisodeIdea,
  type FamilyMember,
  type KidAge,
  type KidTrait,
} from "@/lib/kids/cute-kids";
import { LESSON_PILLARS, PILLAR_GROUPS, type LessonPillar, type ParentingLesson } from "@/lib/kids/lesson-pillars";
import { TEEN_TOPIC_LABEL_VI, teenSafetyViolations } from "@/lib/kids/teen-safety";

/** The lesson library is big: it loads only when the "Dạy con" panel opens. */
type LessonLibrary = typeof import("@/lib/kids/parenting-lessons");

type Lang = "vi" | "en";

const STORAGE_KEY = "storyboard.cuteKids.v1";
/** Lessons already turned into videos (series memory, this browser only). */
const USED_LESSONS_KEY = "storyboard.cuteKids.usedLessons";

function loadUsedLessons(): string[] {
  try {
    const raw = window.localStorage.getItem(USED_LESSONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const FAMILY_CHIPS: Array<{ id: FamilyMember; vi: (south: boolean) => string; en: string }> = [
  { id: "dad", vi: (south) => (south ? "👨 Ba" : "👨 Bố"), en: "👨 Dad" },
  { id: "mom", vi: () => "👩 Mẹ", en: "👩 Mom" },
  { id: "grandpa", vi: () => "👴 Ông", en: "👴 Grandpa" },
  { id: "grandma", vi: () => "👵 Bà", en: "👵 Grandma" },
  { id: "baby", vi: () => "👶 Em bé", en: "👶 Baby" },
  { id: "sibling", vi: () => "👦 Anh trai", en: "👦 Big brother" },
  { id: "friend", vi: () => "🧒 Bạn hàng xóm", en: "🧒 Friend" },
  { id: "dog", vi: () => "🐶 Cún", en: "🐶 Dog" },
  { id: "cat", vi: () => "🐱 Mèo", en: "🐱 Cat" },
];

const FORMAT_EXAMPLE: Record<string, string> = {
  jealous: "Bố ôm mẹ trong bếp, bé thấy liền chen vào giữa, đòi bố bế mình trước",
  bargain: "Bé xin mẹ thêm một cái kẹo trước khi ngủ, mặc cả như người lớn",
  dozing: "Bé vừa ăn cơm vừa ngủ gật, đầu gục dần xuống bát rồi giật mình bảo con không buồn ngủ",
  fake_sleep: "Bé giả vờ ngủ, mẹ vừa ra khỏi phòng là ngồi dậy lấy điện thoại, mẹ quay lại bắt quả tang",
  imitate: "Bé bắt chước bố nghe điện thoại họp online, nói y hệt giọng bố",
  helping_mess: "Bé đòi giúp mẹ lau nhà, kết quả cả phòng khách toàn bọt xà phòng",
  new_sibling: "Cả nhà chỉ lo cho em bé mới sinh, bé lớn giận dỗi rồi được em nắm tay",
  why: "Bé hỏi bố 'tại sao' liên tục cho đến khi bố hết câu trả lời",
  outfit_pick: "Bé tự chọn đồ đi học: váy công chúa, ủng mưa và mũ bảo hiểm",
  misunderstanding: "Mẹ bảo 'mẹ đang dở tay', bé chạy đi tìm xem tay mẹ dở chỗ nào",
};

function loadConfig(): CuteKidsConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const config = normalizeCuteKids(parsed) ?? DEFAULT_CUTE_KIDS;
      // A lesson picked before snapshots existed is looked up once the library loads.
      return !config.lessonId && typeof parsed?.lessonId === "string" ? { ...config, lessonId: parsed.lessonId } : config;
    }
  } catch {
    /* private mode — defaults */
  }
  return DEFAULT_CUTE_KIDS;
}

function Chip(props: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      aria-pressed={props.active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        props.active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:border-primary/60 hover:bg-primary/5"
      )}
    >
      {props.children}
    </button>
  );
}

export function CuteKidsCard(props: {
  lang: Lang;
  provider: AIProvider;
  onBuild: (config: CuteKidsConfig, kidPhoto: UploadedImage[]) => void;
  onOpenRoom: (config: CuteKidsConfig, kidPhoto: UploadedImage[]) => void;
}) {
  const { lang, provider, onBuild, onOpenRoom } = props;
  const vi = lang === "vi";
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<CuteKidsConfig>(DEFAULT_CUTE_KIDS);
  const [kidPhoto, setKidPhoto] = useState<UploadedImage[]>([]);
  const [ideas, setIdeas] = useState<EpisodeIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [error, setError] = useState("");

  const [usedLessons, setUsedLessons] = useState<string[]>([]);
  useEffect(() => { setConfig(loadConfig()); setUsedLessons(loadUsedLessons()); }, []);
  const update = (patch: Partial<CuteKidsConfig>) =>
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  const toggleFamily = (id: FamilyMember) =>
    update({ family: config.family.includes(id) ? config.family.filter((m) => m !== id) : [...config.family, id] });
  const traits = config.traits ?? [];
  const toggleTrait = (id: KidTrait) => update({ traits: traits.includes(id) ? traits.filter((t) => t !== id) : [...traits, id] });

  const teach = config.goal === "teach";
  const pillar: LessonPillar = config.pillar ?? "money";
  const [library, setLibrary] = useState<LessonLibrary | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!teach || library) return;
    let alive = true;
    import("@/lib/kids/parenting-lessons").then((mod) => { if (alive) setLibrary(mod); }).catch(() => { /* offline — retried on the next open */ });
    return () => { alive = false; };
  }, [teach, library]);
  // A saved pick without its snapshot gets it from the library (or is dropped when the lesson is gone).
  useEffect(() => {
    if (!library || !config.lessonId || config.lesson?.id === config.lessonId) return;
    const found = library.findLesson(config.lessonId);
    setConfig((prev) => (prev.lessonId === config.lessonId ? { ...prev, lessonId: found?.id, lesson: found } : prev));
  }, [library, config.lessonId, config.lesson?.id]);
  const searching = query.trim().length > 1;
  const lessons = library ? (searching ? library.searchLessons(query, config.kidAge).slice(0, 40) : library.lessonsFor(pillar, config.kidAge)) : [];
  const picked = config.lesson?.id === config.lessonId ? config.lesson : undefined;
  const pickedGuide = picked ? lessonTeachingGuideVi(picked) : undefined;
  const pickedShotAdvice = picked ? lessonShotAdviceVi(picked, config.abFormat) : undefined;
  // Picking a lesson also brings the family members its story needs (a sibling, a friend, grandma…).
  // The creator's shot count stays as chosen; the suggested one is marked on the shot chips.
  const pickLesson = (lesson: ParentingLesson) =>
    update(config.lessonId === lesson.id
      ? { lessonId: undefined, lesson: undefined }
      : { lessonId: lesson.id, lesson, pillar: lesson.pillar, request: lessonTeachingBriefVi(lesson), format: "auto", family: [...new Set([...config.family, ...(lesson.needs ?? [])])] });
  // A 13–15 request on a blocked topic is replaced by a safe everyday situation when it is sent: say so while it is typed.
  const teenBlocked = config.kidAge === "teen" ? teenSafetyViolations(config.request) : [];
  // Changing the age keeps only a picked lesson that was written for the new age.
  const setAge = (age: KidAge) =>
    update(picked && !picked.ages.includes(age) ? { kidAge: age, lessonId: undefined, lesson: undefined } : { kidAge: age });
  const pillarsForAge = library ? LESSON_PILLARS.filter((p) => library.lessonsFor(p.id, config.kidAge).length > 0) : LESSON_PILLARS;
  const pickFresh = (anyPillar: boolean) => {
    const lesson = library?.pickFreshLesson(config.kidAge, usedLessons, anyPillar ? undefined : pillar);
    if (lesson) { setQuery(""); pickLesson(lesson); }
  };
  // Remember which lessons became videos, so the library shows what is still new.
  const markUsed = () => {
    const id = teach ? config.lessonId : undefined;
    if (!id || usedLessons.includes(id)) return;
    const next = [...usedLessons, id];
    setUsedLessons(next);
    try { window.localStorage.setItem(USED_LESSONS_KEY, JSON.stringify(next)); } catch { /* quota */ }
  };
  const ready = config.request.trim().length > 0;
  const askIdeas = async () => {
    setLoadingIdeas(true);
    setError("");
    const res = await suggestCuteKidsEpisodes({ config, avoid: ideas.map((i) => i.title), provider });
    setLoadingIdeas(false);
    if (res.success) setIdeas(res.data);
    else setError(res.error);
  };

  return (
    <div className="space-y-3 rounded-lg border border-pink-400/50 bg-pink-500/[0.05] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">🧒 {vi ? "Bé cưng viral (video bé dễ thương kiểu Reels)" : "Cute kids viral reel"}</p>
          <p className="text-xs text-muted-foreground">
            {vi
              ? "Gõ tình huống (bé ghen khi bố mẹ ôm nhau, mặc cả đòi kẹo, giả vờ ngủ…) → app dựng cả nhà, lời thoại đúng tuổi bé, quay kiểu điện thoại gia đình, khung 9:16."
              : "Type the situation → the app builds the family, age-true lines, a parent's-phone look, 9:16."}
          </p>
        </div>
        <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
          {open ? (vi ? "Thu gọn" : "Close") : (vi ? "Mở" : "Open")}
        </Button>
      </div>

      {open && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!teach} onClick={() => update({ goal: "fun" })}>😂 {vi ? "Giải trí" : "Fun"}</Chip>
            <Chip active={teach} onClick={() => update({ goal: "teach" })}>🎓 {vi ? "Dạy con" : "Parenting lesson"}</Chip>
          </div>

          {teach && (
            <div className="space-y-2 rounded-md border border-amber-400/50 bg-amber-500/[0.06] p-2.5">
              <p className="text-xs text-muted-foreground">
                {vi
                  ? `Kho ${library ? library.PARENTING_LESSONS.length : "…"} bài · ${LESSON_PILLARS.length} chủ đề, từ tình huống thật của các gia đình Việt; cách xử lý theo Kỷ luật tích cực, Gottman, Faber & Mazlish, Montessori, No-Drama Discipline, Good Inside, RIE, serve & return (Harvard), CASEL… Bài học thể hiện qua câu chuyện (không giảng): bé gặp tình huống → bố mẹ xử lý khéo, tôn trọng bé → kết ấm áp + câu chốt. Caption tự có "💡 Mẹo cho bố mẹ" và câu hỏi gợi bình luận.`
                  : `${library ? library.PARENTING_LESSONS.length : "…"} lessons in ${LESSON_PILLARS.length} areas from real Vietnamese family situations (Positive Discipline, Gottman, Faber & Mazlish, Montessori, No-Drama Discipline, Good Inside, RIE, serve and return, CASEL…). The lesson is shown through the story: the kid's moment → the parent's respectful technique → a warm ending + takeaway.`}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium">{vi ? "Độ tuổi của con:" : "Child's age:"}</span>
                {KID_AGES.map((age) => (
                  <Chip key={age} active={config.kidAge === age} onClick={() => setAge(age)} title={AGE_STAGE[age][lang]}>
                    {AGE_LABEL[age][lang]} <span className="opacity-60">· {AGE_STAGE[age][lang]}{library ? ` · ${library.lessonCountByAge(age)}` : ""}</span>
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={vi ? "🔎 Tìm bài: ăn vạ, lì xì, đi nhà trẻ, nói bậy…" : "🔎 Search lessons…"}
                  className="h-8 max-w-xs text-xs"
                />
                <Chip active={false} onClick={() => pickFresh(false)} title={vi ? "Một bài chưa làm trong chủ đề đang chọn" : "An unused lesson in this area"}>🎲 {vi ? "Bài chưa làm" : "Unused lesson"}</Chip>
                <Chip active={false} onClick={() => pickFresh(true)} title={vi ? "Một bài chưa làm bất kỳ, hợp tuổi bé" : "Any unused lesson for this age"}>🎲 {vi ? "Bất kỳ chủ đề" : "Any area"}</Chip>
                {library && (
                  <span className="text-[11px] text-muted-foreground">
                    {vi ? "Đã làm" : "Done"} {usedLessons.filter((id) => library.findLesson(id)).length}/{library.PARENTING_LESSONS.length}
                  </span>
                )}
              </div>
              {!searching && (
                <div className="space-y-1">
                  {PILLAR_GROUPS.filter((g) => pillarsForAge.some((p) => p.group === g.id)).map((g) => (
                    <div key={g.id} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-full text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:w-40">{g.label}</span>
                      {pillarsForAge.filter((p) => p.group === g.id).map((p) => (
                        <Chip key={p.id} active={pillar === p.id} onClick={() => update({ pillar: p.id })}>
                          {p.label} {library && <span className="opacity-60">{library.lessonsFor(p.id, config.kidAge).length}</span>}
                        </Chip>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {!library ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {vi ? "Đang tải kho bài học…" : "Loading lessons…"}</p>
              ) : searching && !lessons.length ? (
                <p className="text-xs text-muted-foreground">{vi ? "Không có bài nào khớp — thử từ khác." : "No lesson matches."}</p>
              ) : !lessons.length ? (
                <p className="text-xs text-muted-foreground">
                  {vi ? `Chủ đề này chưa có bài cho tuổi ${AGE_LABEL[config.kidAge].vi} — chọn chủ đề khác ở trên.` : "No lesson in this area for this age yet — pick another area."}
                </p>
              ) : (
                <div className="grid max-h-[420px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => pickLesson(lesson)}
                      aria-pressed={config.lessonId === lesson.id}
                      className={cn(
                        "rounded-md border bg-background p-2 text-left text-xs transition-colors hover:border-amber-500/60",
                        config.lessonId === lesson.id && "border-amber-600 bg-amber-500/10"
                      )}
                    >
                      <span className="font-medium">{lesson.title}</span>
                      {usedLessons.includes(lesson.id) && <span className="ml-1.5 text-[10px] text-emerald-700">✓ {vi ? "đã làm" : "done"}</span>}
                      {searching && <span className="ml-1.5 text-[10px] text-muted-foreground">{LESSON_PILLARS.find((p) => p.id === lesson.pillar)?.label}</span>}
                      <span className="mt-0.5 block text-muted-foreground">💡 {lesson.takeaway}</span>
                      <span className="mt-0.5 block text-[10px] text-amber-700">📚 {lesson.method}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">🎂 {lesson.ages.map((a) => AGE_LABEL[a][lang]).join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium">{vi ? "Câu chốt:" : "Takeaway:"}</span>
                <Chip active={config.takeaway !== "parent"} onClick={() => update({ takeaway: "narrator" })}>🎙️ {vi ? "Giọng dẫn cuối video" : "Narrator at the end"}</Chip>
                <Chip active={config.takeaway === "parent"} onClick={() => update({ takeaway: "parent" })}>👨‍👩‍👧 {vi ? "Bố mẹ nói trong phim" : "Parent says it"}</Chip>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip
                  active={config.abFormat === true}
                  onClick={() => update(config.abFormat ? { abFormat: false } : { abFormat: true, shots: 4 })}
                  title={vi ? "Cách 1 chưa khéo (bé càng ăn vạ) → Cách 2 khéo (bé dịu lại). Không đánh, không quát." : "Way 1 backfires gently, way 2 works."}
                >
                  🔀 {vi ? "2 cách xử lý (A/B)" : "Two ways (A/B)"}
                </Chip>
                {config.abFormat && <span className="text-[11px] text-muted-foreground">{vi ? "Nên dùng 4 shot (40s)." : "Best with 4 shots."}</span>}
              </div>
              {picked && pickedGuide && (
                <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-2.5 text-[11px]">
                  <p><span className="font-semibold text-foreground">{picked.title}</span> · <span className="text-amber-700">{picked.method}</span></p>
                  <p><span className="font-medium text-foreground">🌱 {vi ? "Bố mẹ làm mẫu:" : "Parent models:"}</span> <span className="text-muted-foreground">{pickedGuide.positiveModel}</span></p>
                  <div>
                    <span className="font-medium text-foreground">🪜 {vi ? "Xử lý từng bước:" : "Steps:"}</span>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted-foreground">{pickedGuide.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                  </div>
                  <p><span className="font-medium text-foreground">👀 {vi ? "Cho con tự thấy đúng–sai:" : "Observable proof:"}</span> <span className="text-muted-foreground">{pickedGuide.observableProof}</span></p>
                  <p><span className="font-medium text-foreground">✅ {vi ? "Vì sao phù hợp:" : "Why it works:"}</span> <span className="text-muted-foreground">{pickedGuide.whyRight}</span></p>
                  <p><span className="font-medium text-foreground">⚠️ {vi ? "Tránh làm:" : "Avoid:"}</span> <span className="text-muted-foreground">{pickedGuide.avoid}</span></p>
                  {pickedShotAdvice && <div className="border-t border-amber-500/20 pt-2">
                    <p><span className="font-medium text-foreground">🎬 {vi ? "Số shot đề xuất:" : "Recommended length:"}</span> <span className="text-amber-700">{pickedShotAdvice.recommendedShots} shot × 10s = {pickedShotAdvice.totalSeconds}s</span> — <span className="text-muted-foreground">{pickedShotAdvice.reason}</span></p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted-foreground">{pickedShotAdvice.shotPlan.map((beat, index) => <li key={index}>{beat.replace(/^Shot \d+ — /, "")}</li>)}</ol>
                    <p className="mt-1"><span className="font-medium text-foreground">🎭 {vi ? "Biểu cảm & lời thoại:" : "Performance & dialogue:"}</span> <span className="text-muted-foreground">{pickedShotAdvice.dialogueDirection}</span></p>
                  </div>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Yêu cầu của bạn" : "Your request"}</label>
            <Textarea
              value={config.request}
              onChange={(e) => update({ request: e.target.value })}
              rows={teach && picked ? 10 : 3}
              className="resize-none"
              placeholder={vi ? "VD: Bố ôm mẹ trong bếp, bé thấy liền chen vào giữa, phụng phịu đòi bố bế mình trước" : "e.g. Dad hugs Mom in the kitchen, the kid squeezes in between"}
            />
            {teenBlocked.length > 0 && (
              <p className="text-[11px] text-amber-700">
                ⚠️ {vi
                  ? `Video tuổi 13–15 không dùng chủ đề: ${teenBlocked.map((id) => TEEN_TOPIC_LABEL_VI[id] ?? id).join("; ")}. Nếu giữ nguyên, khi tạo video yêu cầu này sẽ được thay bằng một tình huống đời thường an toàn — hãy sửa lại yêu cầu.`
                  : `Teen (13–15) reels skip these topics: ${teenBlocked.join(", ")}. Left as is, the request is replaced by a safe everyday situation when sent.`}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {VIRAL_FORMATS.map((f) => (
                <Chip key={f.id} active={config.format === f.id} title={FORMAT_EXAMPLE[f.id]} onClick={() => update({ format: config.format === f.id ? "auto" : f.id, ...(config.request.trim() ? {} : { request: FORMAT_EXAMPLE[f.id] ?? "" }) })}>
                  {f.label_vi}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Tên bé" : "Kid's name"}</label>
              <Input value={config.kidName} onChange={(e) => update({ kidName: e.target.value })} placeholder="Bé Na" />
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.kidGender === "girl"} onClick={() => update({ kidGender: "girl" })}>👧 {vi ? "Bé gái" : "Girl"}</Chip>
                <Chip active={config.kidGender === "boy"} onClick={() => update({ kidGender: "boy" })}>👦 {vi ? "Bé trai" : "Boy"}</Chip>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Tuổi bé" : "Age"}</label>
              <div className="flex flex-wrap gap-1.5">
                {KID_AGES.map((age) => (
                  <Chip key={age} active={config.kidAge === age} onClick={() => setAge(age)} title={AGE_STAGE[age][lang]}>
                    {AGE_LABEL[age][lang]}
                  </Chip>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {config.kidAge === "toddler"
                  ? vi ? "Bé nói 1–3 từ, bập bẹ; bố mẹ dẫn lời, bé “diễn” bằng biểu cảm." : "1–3 word lines; parents carry the dialogue."
                  : config.kidAge === "young"
                    ? vi ? "Câu ngắn ≤ 6 từ, logic ngây ngô." : "Short lines up to 6 words."
                    : config.kidAge === "school"
                      ? vi ? "Câu ≤ 10 từ, ngọt ngào lém lỉnh, có câu chốt." : "Up to 10 words, a sassy punchline."
                      : config.kidAge === "middle"
                        ? vi ? "Lớp 3–5: câu ≤ 14 từ, lý lẽ, mặc cả, hài hước; bố mẹ cùng con giải quyết." : "Grade 3–5: up to 14 words, logic and humour."
                        : config.kidAge === "preteen"
                          ? vi ? "Lớp 6–7: câu ≤ 16 từ, muốn được coi là người lớn, đảo mắt rồi bật cười; bố mẹ tôn trọng, hỏi ý kiến con." : "Grade 6–7: up to 16 words, wants to be treated as older."
                          : vi ? "Lớp 8–10: câu ≤ 18 từ, kiệm lời rồi bỗng nói nhiều khi đúng chủ đề, cần riêng tư; bố mẹ lắng nghe, cùng thỏa thuận." : "Grade 8–10: up to 18 words, needs privacy; parents listen and agree together."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Tính cách bé (diễn trong mọi shot)" : "Kid's personality (in every shot)"}</label>
            <div className="flex flex-wrap gap-1.5">
              {KID_TRAITS.map((t) => (
                <Chip key={t.id} active={traits.includes(t.id)} onClick={() => toggleTrait(t.id)} title={isOlderKid(config.kidAge) ? t.older_room_vi ?? t.room_vi : t.room_vi}>
                  {vi ? traitLabelVi(t.id, config.kidAge) : t.label_en}
                </Chip>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {vi
                ? "Bé dễ thương từ cử chỉ, điệu bộ đến giọng nói; bố mẹ luôn hưởng ứng (tan chảy, bật cười, trêu lại, chiều bé)."
                : "Cute in gestures, body language and voice; the parents always play along."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Gia đình xuất hiện" : "Family on screen"}</label>
            <div className="flex flex-wrap gap-1.5">
              {FAMILY_CHIPS.map((m) => (
                <Chip key={m.id} active={config.family.includes(m.id)} onClick={() => toggleFamily(m.id)}>
                  {vi ? m.vi(config.dialect === "south") : m.en}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Kiểu quay" : "Filming"}</label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.filming === "phone"} onClick={() => update({ filming: "phone" })}>📱 {vi ? "Điện thoại gia đình" : "Family phone"}</Chip>
                <Chip active={config.filming === "cinematic"} onClick={() => update({ filming: "cinematic" })}>🎬 {vi ? "Điện ảnh" : "Cinematic"}</Chip>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Giọng" : "Dialect"}</label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.dialect === "north"} onClick={() => update({ dialect: "north" })}>{vi ? "Miền Bắc" : "Northern"}</Chip>
                <Chip active={config.dialect === "south"} onClick={() => update({ dialect: "south" })}>{vi ? "Miền Nam" : "Southern"}</Chip>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Độ dài" : "Length"}</label>
              <div className="flex flex-wrap gap-1.5">
                {[2, 3, 4].map((n) => (
                  <Chip key={n} active={config.shots === n} onClick={() => update({ shots: n })}>
                    {n} shot · {n * 10}s {pickedShotAdvice?.recommendedShots === n ? (vi ? "· gợi ý" : "· suggested") : ""}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <ImageUploader
              images={kidPhoto}
              onChange={(images) => setKidPhoto(images.slice(0, 1))}
              maxImages={1}
              label={vi ? `Ảnh chính diện của bé (tuỳ chọn)` : "Kid's frontal photo (optional)"}
            />
            <p className="text-[11px] text-muted-foreground">
              {vi
                ? "Không có ảnh → app tạo một bé AI cố định (mặt giống nhau ở mọi shot). Chỉ dùng ảnh con của bạn hoặc ảnh đã được bố mẹ bé đồng ý. Video sẽ được gắn nhãn “tạo bằng AI” khi đăng."
                : "No photo → the app creates one fixed AI kid. Only use a photo of your own child or with the parents' consent. Captions get an AI-generated label."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!ready} onClick={() => { markUsed(); onBuild(config, kidPhoto); }}>
              <Zap className="h-4 w-4" />
              {vi ? "Tạo video ngay" : "Build video"}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready} onClick={() => { markUsed(); onOpenRoom(config, kidPhoto); }} title={vi ? "Mở phòng biên kịch mới với yêu cầu này (thay phiên đang mở)" : "Open a fresh writers' room with this request"}>
              <PenLine className="h-4 w-4" />
              {vi ? "Mở phòng biên kịch" : "Writers' room"}
            </Button>
            <Button size="sm" variant="outline" disabled={loadingIdeas} onClick={askIdeas}>
              {loadingIdeas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              {ideas.length ? (vi ? "10 ý tưởng khác" : "10 more ideas") : (vi ? "Gợi ý 10 tập" : "10 episode ideas")}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">⚠️ {error}</p>}
          {ideas.length > 0 && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {ideas.map((idea) => (
                <button
                  key={idea.title}
                  type="button"
                  onClick={() => update({ request: idea.request, format: "auto" })}
                  className={cn(
                    "rounded-md border bg-background p-2 text-left text-xs transition-colors hover:border-primary/60 hover:bg-primary/5",
                    config.request === idea.request && "border-primary bg-primary/5"
                  )}
                >
                  <span className="font-medium">{idea.title}</span>
                  <span className="mt-0.5 block text-muted-foreground">{idea.request}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
