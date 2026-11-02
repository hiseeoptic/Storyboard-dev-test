"use client";

// ============================================================
// 🏠 CHUYỆN NHÀ — one card to build an educational family drama for adults
// (vợ chồng · mẹ chồng – nàng dâu · chị dâu – em chồng): pick a lesson from the
// research-based library (or type your own situation), name the family, pick
// 6–18 clips (2–3 minutes), then build the video or open the writers' room.
// Every story runs HOOK → leo thang → CAO TRÀO → bước ngoặt + BÀI HỌC → TỈNH THỨC.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { PenLine, Zap } from "lucide-react";
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
  normalizeFamilyDrama,
  searchFamilyLessons,
  type FamilyDramaConfig,
  type FamilyLesson,
  type FamilyRelation,
} from "@/lib/family/family-drama";

type Lang = "vi" | "en";
const STORAGE_KEY = "afFamilyDrama.v1";

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
}) {
  const { lang, onBuild, onOpenRoom } = props;
  const vi = lang === "vi";
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<FamilyDramaConfig>(DEFAULT_FAMILY_DRAMA);
  const [query, setQuery] = useState("");
  const [showBasis, setShowBasis] = useState(false);
  useEffect(() => setConfig(loadConfig()), []);
  const update = (patch: Partial<FamilyDramaConfig>) =>
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

  const lesson = familyLessonOf(config);
  const lessons = useMemo(
    () => (query.trim() ? searchFamilyLessons(query, config.relation) : familyLessonsFor(config.relation)),
    [query, config.relation]
  );
  const cast = familyDramaCast(config);
  const plan = familyActPlan(config.shots);
  const pickLesson = (picked: FamilyLesson) =>
    update({ lessonId: picked.id, lesson: picked, relation: picked.relation, request: familyRequestFromLesson(picked) });
  const ready = config.request.trim().length > 0 || Boolean(lesson);
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
        <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
          {open ? (vi ? "Thu gọn" : "Close") : (vi ? "Mở" : "Open")}
        </Button>
      </div>

      {open && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FAMILY_RELATIONS.map((relation: FamilyRelation) => (
              <Chip key={relation} active={config.relation === relation} onClick={() => update({ relation, lessonId: undefined, lesson: undefined })}>
                {RELATION_LABEL[relation].emoji} {vi ? RELATION_LABEL[relation].vi : RELATION_LABEL[relation].en}
              </Chip>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Kho bài học" : "Lesson library"} ({lessons.length})</label>
            <Input className="h-8 text-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={vi ? "Tìm: tiền, chăm cháu, Tết, im lặng…" : "Search…"} />
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
                  <span className="mt-0.5 block text-muted-foreground">{item.hook}</span>
                  <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-300">⚠ {item.pattern} → ✓ {item.method}</span>
                </button>
              ))}
            </div>
          </div>

          {lesson ? (
            <div className="space-y-1 rounded-md border bg-background/60 p-2 text-xs">
              <p className="font-semibold">📚 {lesson.title}</p>
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

          <p className="text-[11px] text-muted-foreground">
            {vi
              ? `Video ${config.shots} shot (${duration(config.shots)}) được viết theo từng lượt: 8 cảnh đầu rồi mỗi lượt 5 cảnh, nối tiếp trạng thái của cảnh trước. Không bạo lực, không nhân vật phản diện; bài đăng được gắn nhãn “tạo bằng AI”.`
              : "Long videos are written in parts (8, then 5 clips per request). No violence, no villain; posts carry an AI label."}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!ready} onClick={() => onBuild(config)}>
              <Zap className="h-4 w-4" />
              {vi ? "Tạo video ngay" : "Build video"}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready} onClick={() => onOpenRoom(config)}>
              <PenLine className="h-4 w-4" />
              {vi ? "Mở phòng biên kịch" : "Writers' room"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
