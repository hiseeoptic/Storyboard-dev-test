"use client";

// ============================================================
// 💼 CHUYỆN CÔNG SỞ — one card to build a workplace-culture training drama for
// managers and employees: pick a case from the research-based library (12
// shelves, filtered by who it trains) or type your own situation, name the
// cast, pick the workplace and 6–18 clips, then build the video or open the
// writers' room. Every case also copies out as a training handout with two
// discussion questions. Story: HOOK → leo thang → CAO TRÀO → bước ngoặt +
// BÀI HỌC → TỈNH THỨC.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Dices, PenLine, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AUDIENCE_LABEL,
  DEFAULT_OFFICE_DRAMA,
  DEFAULT_OFFICE_NAMES,
  OFFICE_AUDIENCES,
  OFFICE_DEFAULT_SHOTS,
  OFFICE_MAX_SHOTS,
  OFFICE_MIN_SHOTS,
  OFFICE_WORKPLACES,
  WORKPLACE_LABEL,
  normalizeOfficeDrama,
  officeActPlan,
  officeDramaCast,
  officeLessonOf,
  officeLessonsFor,
  officeRequestFromLesson,
  officeThemeLabel,
  officeThemesWithCounts,
  officeTrainingCase,
  pickUnusedOfficeLesson,
  searchOfficeLessons,
  type OfficeAudience,
  type OfficeDramaConfig,
  type OfficeLesson,
} from "@/lib/workplace/office-drama";

type Lang = "vi" | "en";
const STORAGE_KEY = "afOfficeDrama.v1";
/** Cases this creator has already built (kept in this browser only). */
const USED_KEY = "afOfficeDrama.used.v1";

function loadConfig(): OfficeDramaConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return (raw && normalizeOfficeDrama(JSON.parse(raw))) || DEFAULT_OFFICE_DRAMA;
  } catch {
    return DEFAULT_OFFICE_DRAMA;
  }
}

function loadUsed(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(USED_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveUsed(ids: string[]) {
  try { window.localStorage.setItem(USED_KEY, JSON.stringify(ids)); } catch { /* quota / private mode */ }
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
        props.active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60 hover:bg-primary/5"
      )}
    >
      {props.children}
    </button>
  );
}

const duration = (shots: number) => {
  const s = shots * 10;
  return `${Math.floor(s / 60)} phút${s % 60 ? ` ${s % 60} giây` : ""}`;
};

export function OfficeDramaCard(props: {
  lang: Lang;
  onBuild: (config: OfficeDramaConfig) => void;
  onOpenRoom: (config: OfficeDramaConfig) => void;
}) {
  const { lang, onBuild, onOpenRoom } = props;
  const vi = lang === "vi";
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<OfficeDramaConfig>(DEFAULT_OFFICE_DRAMA);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState<OfficeAudience | "">("");
  const [hideUsed, setHideUsed] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  const [shelfDone, setShelfDone] = useState(false);
  const [showBasis, setShowBasis] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setConfig(loadConfig());
    setUsed(loadUsed());
  }, []);
  const update = (patch: Partial<OfficeDramaConfig>) =>
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

  const lesson = officeLessonOf(config);
  const themes = useMemo(() => officeThemesWithCounts(), []);
  const usedSet = useMemo(() => new Set(used), [used]);
  const shelf = useMemo(() => officeLessonsFor({ theme: theme || null, audience: audience || null }), [theme, audience]);
  const lessons = useMemo(() => {
    const found = query.trim() ? searchOfficeLessons(query, shelf) : shelf;
    return hideUsed ? found.filter((l) => !usedSet.has(l.id)) : found;
  }, [query, shelf, hideUsed, usedSet]);
  const usedOnShelf = shelf.filter((l) => usedSet.has(l.id)).length;
  const cast = officeDramaCast(config);
  const plan = officeActPlan(config.shots);
  const ready = config.request.trim().length > 0 || Boolean(lesson);
  const shotOptions = Array.from({ length: OFFICE_MAX_SHOTS - OFFICE_MIN_SHOTS + 1 }, (_, i) => OFFICE_MIN_SHOTS + i).map((n) => ({
    value: String(n),
    label: `${n} shot · ${duration(n)}${n === OFFICE_DEFAULT_SHOTS ? (vi ? " (gợi ý)" : " (recommended)") : ""}`,
  }));

  const pickLesson = (picked: OfficeLesson) => {
    setShelfDone(false);
    setCopied(false);
    update({ lessonId: picked.id, lesson: picked, request: officeRequestFromLesson(picked) });
  };
  const pickNextUnused = () => {
    const next = pickUnusedOfficeLesson(shelf, used);
    if (next) pickLesson(next);
    else setShelfDone(true);
  };
  const markUsed = () => {
    if (!lesson || usedSet.has(lesson.id)) return;
    const next = [...used, lesson.id];
    setUsed(next);
    saveUsed(next);
  };
  const resetShelf = () => {
    const onShelf = new Set(shelf.map((l) => l.id));
    const next = used.filter((id) => !onShelf.has(id));
    setUsed(next);
    saveUsed(next);
    setShelfDone(false);
  };
  const copyCase = async () => {
    if (!lesson) return;
    try {
      await navigator.clipboard.writeText(officeTrainingCase(lesson));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-sky-400/50 bg-sky-500/[0.05] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">💼 {vi ? "Chuyện công sở — phim ngắn đào tạo văn hóa doanh nghiệp (1–3 phút)" : "Workplace culture drama (1–3 min)"}</p>
          <p className="text-xs text-muted-foreground">
            {vi
              ? "Case đào tạo cho sếp và nhân viên: góp ý, lãnh đạo, làm việc nhóm, người mới, họp hành, giờ giấc, công bằng, sai sót, khách hàng, liêm chính, thay đổi. Mỗi tập: hook → leo thang → cao trào → bài học → tỉnh thức. Dựa trên Gallup, Google, Edmondson, Kim Scott, CCL, Lencioni, WHO, ILO, Bộ luật Lao động…"
              : "Training cases for managers and employees. Hook → rising → climax → lesson → awakening, research-based practices."}
          </p>
        </div>
        <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
          {open ? (vi ? "Thu gọn" : "Close") : (vi ? "Mở" : "Open")}
        </Button>
      </div>

      {open && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!audience} onClick={() => { setAudience(""); setShelfDone(false); }}>{vi ? "Mọi đối tượng" : "Everyone"}</Chip>
            {OFFICE_AUDIENCES.map((a) => (
              <Chip key={a} active={audience === a} onClick={() => { setAudience(a); setShelfDone(false); }}>
                {AUDIENCE_LABEL[a].emoji} {vi ? AUDIENCE_LABEL[a].vi : AUDIENCE_LABEL[a].en}
              </Chip>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium">
                {vi ? "Kho case" : "Case library"} ({lessons.length}){" "}
                <span className="font-normal text-muted-foreground">· {vi ? `đã làm ${usedOnShelf}/${shelf.length}` : `made ${usedOnShelf}/${shelf.length}`}</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={pickNextUnused} title={vi ? "Chọn ngẫu nhiên một case bạn chưa làm trong mục đang xem" : "Pick a case you have not made yet"}>
                  <Dices className="h-3.5 w-3.5" />
                  {vi ? "Case chưa làm" : "Next unused"}
                </Button>
                <Chip active={hideUsed} onClick={() => setHideUsed((v) => !v)}>{vi ? "Ẩn case đã làm" : "Hide made"}</Chip>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!theme} onClick={() => { setTheme(""); setShelfDone(false); }}>{vi ? "Tất cả" : "All"} ({themes.reduce((n, t) => n + t.count, 0)})</Chip>
              {themes.map((t) => (
                <Chip key={t.id} active={theme === t.id} onClick={() => { setTheme(t.id); setShelfDone(false); }}>
                  {t.label} ({t.count})
                </Chip>
              ))}
            </div>
            {shelfDone ? (
              <p className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-[11px]">
                🎉 {vi ? "Bạn đã làm hết các case trong mục này." : "You have made every case on this shelf."}
                <button type="button" className="inline-flex items-center gap-1 underline" onClick={resetShelf}>
                  <RotateCcw className="h-3 w-3" />
                  {vi ? "Làm lại từ đầu" : "Start over"}
                </button>
              </p>
            ) : null}
            <Input className="h-8 text-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={vi ? "Tìm: góp ý, deadline, Zalo, thăng chức, Gen Z, khách hàng, quà cáp…" : "Search…"} />
            <div className="grid max-h-64 gap-1.5 overflow-auto sm:grid-cols-2">
              {lessons.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickLesson(item)}
                  className={cn(
                    "rounded-md border bg-background p-2 text-left text-xs transition-colors hover:border-primary/60 hover:bg-primary/5",
                    lesson?.id === item.id && "border-primary bg-primary/5"
                  )}
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="ml-1 text-[10px] text-muted-foreground">{AUDIENCE_LABEL[item.audience].emoji}</span>
                  {usedSet.has(item.id) ? <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">✓ {vi ? "đã làm" : "made"}</span> : null}
                  <span className="mt-0.5 block text-muted-foreground">{item.hook}</span>
                  <span className="mt-0.5 block text-[11px] text-sky-700 dark:text-sky-300">⚠ {item.pattern} → ✓ {item.method}</span>
                </button>
              ))}
            </div>
          </div>

          {lesson ? (
            <div className="space-y-1 rounded-md border bg-background/60 p-2 text-xs">
              <p className="font-semibold">💼 {lesson.title}</p>
              <p className="text-[11px] text-muted-foreground">{officeThemeLabel(lesson)} · {AUDIENCE_LABEL[lesson.audience].emoji} {vi ? AUDIENCE_LABEL[lesson.audience].vi : AUDIENCE_LABEL[lesson.audience].en}</p>
              <p><b>{vi ? "Câu chốt:" : "Takeaway:"}</b> {lesson.takeaway}</p>
              <div>
                <b>{vi ? "Câu hỏi thảo luận sau video:" : "Discussion questions:"}</b>
                <ol className="ml-4 list-decimal">
                  {lesson.questions.map((q) => <li key={q}>{q}</li>)}
                </ol>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="text-[11px] underline opacity-80" onClick={() => setShowBasis((v) => !v)}>
                  {showBasis ? (vi ? "Ẩn căn cứ nghiên cứu" : "Hide research") : (vi ? "Xem căn cứ nghiên cứu" : "Show research")}
                </button>
                <button type="button" className="inline-flex items-center gap-1 text-[11px] underline opacity-80" onClick={copyCase}>
                  <ClipboardCopy className="h-3 w-3" />
                  {copied ? (vi ? "Đã sao chép case đào tạo" : "Copied") : (vi ? "Sao chép case đào tạo" : "Copy training case")}
                </button>
              </div>
              {showBasis ? <p className="text-[11px] text-muted-foreground">🔬 {lesson.basis}</p> : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Tình huống & bài học (sửa thoải mái)" : "Situation & lesson (editable)"}</label>
            <Textarea
              rows={6}
              className="text-xs"
              value={config.request}
              onChange={(e) => update({ request: e.target.value })}
              placeholder={vi ? "Chọn một case ở trên, hoặc tự gõ tình huống công sở: sếp giao việc gấp…, đồng nghiệp nhận vơ công…" : "Pick a case or type a workplace situation…"}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Nơi làm việc" : "Workplace"}</label>
            <div className="flex flex-wrap gap-1.5">
              {OFFICE_WORKPLACES.map((w) => (
                <Chip key={w} active={config.workplace === w} onClick={() => update({ workplace: w })}>{WORKPLACE_LABEL[w].vi}</Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {cast.map((member) => (
              <label key={member.role} className="space-y-1 text-xs">
                <span className="font-medium text-muted-foreground">{member.label}</span>
                <Input
                  className="h-8 text-xs"
                  value={config.names[member.role] ?? ""}
                  placeholder={DEFAULT_OFFICE_NAMES[member.role]}
                  onChange={(e) => update({ names: { ...config.names, [member.role]: e.target.value } })}
                />
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Độ dài (mỗi shot 10 giây)" : "Length (10 s per shot)"}</label>
              <Select value={String(config.shots)} onChange={(e) => update({ shots: Number(e.target.value) })} options={shotOptions} className="h-9 text-xs" />
              <p className="text-[11px] text-muted-foreground">
                {plan.map((s) => `${s.label_vi} ${s.from === s.to ? s.from : `${s.from}–${s.to}`}`).join(" · ")}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Không khí" : "Tone"}</label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.tone === "drama"} onClick={() => update({ tone: "drama" })}>{vi ? "🎭 Chân thực, căng thẳng" : "Drama"}</Chip>
                <Chip active={config.tone === "warm"} onClick={() => update({ tone: "warm" })}>{vi ? "☕ Nhẹ nhàng, hài công sở" : "Warm"}</Chip>
              </div>
              <label className="text-xs font-medium">{vi ? "Kết" : "Ending"}</label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.narrator} onClick={() => update({ narrator: true })}>{vi ? "🎙️ Giọng dẫn nói câu tỉnh thức" : "Narrator"}</Chip>
                <Chip active={!config.narrator} onClick={() => update({ narrator: false })}>{vi ? "💬 Nhân vật tự nói" : "A character says it"}</Chip>
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
              <label className="text-xs font-medium">{vi ? "Kiểu quay" : "Filming"}</label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.filming === "cinematic"} onClick={() => update({ filming: "cinematic" })}>{vi ? "🎬 Điện ảnh, chân thực" : "Cinematic"}</Chip>
                <Chip active={config.filming === "phone"} onClick={() => update({ filming: "phone" })}>{vi ? "📱 Điện thoại cầm tay" : "Phone"}</Chip>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {vi
              ? `Video ${config.shots} shot (${duration(config.shots)})${config.shots > 10 ? " được viết theo từng lượt: 8 cảnh đầu rồi mỗi lượt 5 cảnh" : ""}. Không dùng tên công ty/thương hiệu thật, không bạo lực, không diễn trực tiếp quấy rối; bài đăng được gắn nhãn “tạo bằng AI”.`
              : "No real company names, no violence, harassment never shown explicitly; posts carry an AI label."}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!ready} onClick={() => { markUsed(); onBuild(config); }}>
              <Zap className="h-4 w-4" />
              {vi ? "Tạo video ngay" : "Build video"}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready} onClick={() => { markUsed(); onOpenRoom(config); }}>
              <PenLine className="h-4 w-4" />
              {vi ? "Mở phòng biên kịch" : "Writers' room"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
