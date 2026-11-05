"use client";

// ============================================================
// 🏠 CHUYỆN NHÀ — one card to build an educational family drama for adults
// (vợ chồng · mẹ chồng – nàng dâu · chị dâu – em chồng): pick a lesson from the
// research-based library (or type your own situation), name the family, pick
// 6–18 clips (2–3 minutes), then build the video or open the writers' room.
// Every story runs HOOK → leo thang → CAO TRÀO → bước ngoặt + BÀI HỌC → TỈNH THỨC.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { Dices, PenLine, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FAMILY_DRAMA,
  DEFAULT_FAMILY_NAMES,
  FAMILY_MAX_SHOTS,
  FAMILY_MIN_SHOTS,
  FAMILY_RELATIONS,
  RELATION_LABEL,
  familyActPlan,
  familyDramaCast,
  familyLessonOf,
  familyLessonsFor,
  familyRequestFromLesson,
  familyThemeLabel,
  familyThemesFor,
  normalizeFamilyDrama,
  pickUnusedFamilyLesson,
  searchFamilyLessons,
  type FamilyDramaConfig,
  type FamilyLesson,
  type FamilyRelation,
} from "@/lib/family/family-drama";

import { AdvancedOptions, StickyActions } from "./simple-launcher";

type Lang = "vi" | "en";
const STORAGE_KEY = "afFamilyDrama.v1";
/** Lessons this creator has already built (kept in this browser only). */
const USED_KEY = "afFamilyDrama.used.v1";

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

function loadConfig(): FamilyDramaConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return (raw && normalizeFamilyDrama(JSON.parse(raw))) || DEFAULT_FAMILY_DRAMA;
  } catch {
    return DEFAULT_FAMILY_DRAMA;
  }
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

export function FamilyDramaCard(props: {
  lang: Lang;
  onBuild: (config: FamilyDramaConfig) => void;
  onOpenRoom: (config: FamilyDramaConfig) => void;
  /** Simple layout: the card is the whole step — open, settings folded, build button pinned. */
  compact?: boolean;
}) {
  const { lang, onBuild, onOpenRoom } = props;
  const compact = props.compact === true;
  const vi = lang === "vi";
  const [open, setOpen] = useState(compact);
  const [config, setConfig] = useState<FamilyDramaConfig>(DEFAULT_FAMILY_DRAMA);
  const [query, setQuery] = useState("");
  const [showBasis, setShowBasis] = useState(false);
  const [theme, setTheme] = useState("");
  const [hideUsed, setHideUsed] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  const [shelfDone, setShelfDone] = useState(false);
  useEffect(() => {
    setConfig(loadConfig());
    setUsed(loadUsed());
  }, []);
  const update = (patch: Partial<FamilyDramaConfig>) =>
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

  const lesson = familyLessonOf(config);
  const themes = useMemo(() => familyThemesFor(config.relation), [config.relation]);
  const usedSet = useMemo(() => new Set(used), [used]);
  const shelf = useMemo(() => familyLessonsFor(config.relation, theme || null), [config.relation, theme]);
  const lessons = useMemo(() => {
    const found = query.trim() ? searchFamilyLessons(query, config.relation).filter((l) => !theme || l.theme === theme) : shelf;
    return hideUsed ? found.filter((l) => !usedSet.has(l.id)) : found;
  }, [query, config.relation, theme, shelf, hideUsed, usedSet]);
  const usedOnShelf = shelf.filter((l) => usedSet.has(l.id)).length;
  const cast = familyDramaCast(config);
  const plan = familyActPlan(config.shots);
  const pickLesson = (picked: FamilyLesson) => {
    setShelfDone(false);
    update({ lessonId: picked.id, lesson: picked, relation: picked.relation, request: familyRequestFromLesson(picked) });
  };
  const pickNextUnused = () => {
    const next = pickUnusedFamilyLesson(shelf, used);
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
  const ready = config.request.trim().length > 0 || Boolean(lesson);
  // One line for the folded settings and the pinned build bar.
  const settingsSummary = [
    `${config.shots} shot · ${config.shots * 10}s`,
    config.tone === "warm" ? (vi ? "ấm áp" : "warm") : (vi ? "nhiều cảm xúc" : "emotional"),
    config.dialect === "north" ? (vi ? "giọng Bắc" : "Northern") : (vi ? "giọng Nam" : "Southern"),
    config.filming === "phone" ? (vi ? "quay điện thoại" : "phone") : (vi ? "điện ảnh" : "cinematic"),
  ].join(" · ");
  const shotOptions = Array.from({ length: FAMILY_MAX_SHOTS - FAMILY_MIN_SHOTS + 1 }, (_, i) => FAMILY_MIN_SHOTS + i).map((n) => ({
    value: String(n),
    label: `${n} shot · ${duration(n)}${n === 15 ? (vi ? " (gợi ý)" : " (recommended)") : ""}`,
  }));

  return (
    <div className="space-y-3 rounded-lg border border-amber-400/50 bg-amber-500/[0.05] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">🏠 {vi ? "Chuyện nhà — phim ngắn giáo dục gia đình (2–3 phút)" : "Family lessons drama (2–3 min)"}</p>
          <p className="text-xs text-muted-foreground">
            {vi
              ? "Vợ chồng · mẹ chồng – nàng dâu · chị dâu – em chồng. Mỗi tập: hook → leo thang → cao trào → bài học → tỉnh thức. Bài học dựa trên nghiên cứu (Gottman, EFT, NVC, Terri Apter, Harvard…)."
              : "Couples · in-laws. Hook → rising → climax → lesson → awakening, research-based lessons."}
          </p>
        </div>
        {!compact && (
          <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
            {open ? (vi ? "Thu gọn" : "Close") : (vi ? "Mở" : "Open")}
          </Button>
        )}
      </div>

      {(open || compact) && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FAMILY_RELATIONS.map((relation: FamilyRelation) => (
              <Chip
                key={relation}
                active={config.relation === relation}
                onClick={() => {
                  setTheme("");
                  setShelfDone(false);
                  update({ relation, lessonId: undefined, lesson: undefined });
                }}
              >
                {RELATION_LABEL[relation].emoji} {vi ? RELATION_LABEL[relation].vi : RELATION_LABEL[relation].en}
              </Chip>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium">
                {vi ? "Kho bài học" : "Lesson library"} ({lessons.length}){" "}
                <span className="font-normal text-muted-foreground">
                  · {vi ? `đã làm ${usedOnShelf}/${shelf.length}` : `made ${usedOnShelf}/${shelf.length}`}
                </span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={pickNextUnused} title={vi ? "Chọn ngẫu nhiên một bài bạn chưa làm trong mục đang xem" : "Pick a lesson you have not made yet"}>
                  <Dices className="h-3.5 w-3.5" />
                  {vi ? "Bài chưa làm" : "Next unused"}
                </Button>
                <Chip active={hideUsed} onClick={() => setHideUsed((v) => !v)}>{vi ? "Ẩn bài đã làm" : "Hide made"}</Chip>
              </div>
            </div>
            {themes.length ? (
              <div className="flex flex-wrap gap-1.5">
                <Chip active={!theme} onClick={() => { setTheme(""); setShelfDone(false); }}>
                  {vi ? "Tất cả" : "All"} ({familyLessonsFor(config.relation).length})
                </Chip>
                {themes.map((t) => (
                  <Chip key={t.id} active={theme === t.id} onClick={() => { setTheme(t.id); setShelfDone(false); }}>
                    {t.label} ({t.count})
                  </Chip>
                ))}
              </div>
            ) : null}
            {shelfDone ? (
              <p className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-[11px]">
                🎉 {vi ? "Bạn đã làm hết các bài trong mục này." : "You have made every lesson on this shelf."}
                <button type="button" className="inline-flex items-center gap-1 underline" onClick={resetShelf}>
                  <RotateCcw className="h-3 w-3" />
                  {vi ? "Làm lại từ đầu" : "Start over"}
                </button>
              </p>
            ) : null}
            <Input className="h-8 text-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={vi ? "Tìm: tiền, chăm cháu, ở cữ, Tết, điện thoại, im lặng…" : "Search…"} />
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
                  {usedSet.has(item.id) ? <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">✓ {vi ? "đã làm" : "made"}</span> : null}
                  <span className="mt-0.5 block text-muted-foreground">{item.hook}</span>
                  <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-300">⚠ {item.pattern} → ✓ {item.method}</span>
                </button>
              ))}
            </div>
          </div>

          {lesson ? (
            <div className="space-y-1 rounded-md border bg-background/60 p-2 text-xs">
              <p className="font-semibold">📚 {lesson.title}</p>
              {familyThemeLabel(lesson) ? <p className="text-[11px] text-muted-foreground">{familyThemeLabel(lesson)}</p> : null}
              <p><b>{vi ? "Câu chốt:" : "Takeaway:"}</b> {lesson.takeaway}</p>
              <button type="button" className="text-[11px] underline opacity-80" onClick={() => setShowBasis((v) => !v)}>
                {showBasis ? (vi ? "Ẩn căn cứ nghiên cứu" : "Hide research") : (vi ? "Xem căn cứ nghiên cứu" : "Show research")}
              </button>
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
              placeholder={vi ? "Chọn một bài ở trên, hoặc tự gõ tình huống: vợ chồng cãi nhau vì…, mẹ chồng và con dâu…" : "Pick a lesson or type a situation…"}
            />
          </div>

          <AdvancedOptions simple={compact} lang={lang} summary={settingsSummary}>
          <div className="grid gap-2 sm:grid-cols-2">
            {cast.map((member) => (
              <label key={member.role} className="space-y-1 text-xs">
                <span className="font-medium text-muted-foreground">{member.label}</span>
                <Input
                  className="h-8 text-xs"
                  value={config.names[member.role] ?? ""}
                  placeholder={DEFAULT_FAMILY_NAMES[member.role]}
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
                <Chip active={config.tone === "drama"} onClick={() => update({ tone: "drama" })}>{vi ? "🎭 Chân thực, nhiều cảm xúc" : "Drama"}</Chip>
                <Chip active={config.tone === "warm"} onClick={() => update({ tone: "warm" })}>{vi ? "☕ Ấm áp, nhẹ nhàng" : "Warm"}</Chip>
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
                <Chip active={config.filming === "cinematic"} onClick={() => update({ filming: "cinematic" })}>{vi ? "🎬 Điện ảnh, gần gũi" : "Cinematic"}</Chip>
                <Chip active={config.filming === "phone"} onClick={() => update({ filming: "phone" })}>{vi ? "📱 Điện thoại gia đình" : "Phone"}</Chip>
              </div>
            </div>
          </div>
          </AdvancedOptions>

          <p className="text-[11px] text-muted-foreground">
            {vi
              ? `Video ${config.shots} shot (${duration(config.shots)}) được viết theo từng lượt: 8 cảnh đầu rồi mỗi lượt 5 cảnh, nối tiếp trạng thái của cảnh trước. Không bạo lực, không nhân vật phản diện; bài đăng được gắn nhãn “tạo bằng AI”.`
              : "Long videos are written in parts (8, then 5 clips per request). No violence, no villain; posts carry an AI label."}
          </p>

          <StickyActions simple={compact} summary={ready ? settingsSummary : vi ? "Chọn một mục trong kho ở trên hoặc tự gõ để bắt đầu." : "Pick from the library above or type to start."}>
            <Button size="sm" disabled={!ready} onClick={() => { markUsed(); onBuild(config); }}>
              <Zap className="h-4 w-4" />
              {vi ? "Tạo video ngay" : "Build video"}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready} onClick={() => { markUsed(); onOpenRoom(config); }}>
              <PenLine className="h-4 w-4" />
              {vi ? "Mở phòng biên kịch" : "Writers' room"}
            </Button>
          </StickyActions>
        </div>
      )}
    </div>
  );
}
