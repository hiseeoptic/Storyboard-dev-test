"use client";

// ============================================================
// 📜 LỜI XƯA – CHUYỆN NAY — one card to turn a timeless saying (Vietnamese
// proverbs and folk verse, Chinese classics, European and American great
// minds, world wisdom) into a short modern story: pick a saying (by region,
// theme, format) or type your own, choose who speaks it, 4–12 clips, then
// build the video or open the writers' room. Each entry shows where it comes
// from and how sure we are, and copies out as a caption (for the editor — the
// video never renders text) and as a study card.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Dices, PenLine, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_QUOTE_STORY,
  FORMAT_LABEL,
  KIND_LABEL,
  QUOTE_DEFAULT_SHOTS,
  QUOTE_FORMATS,
  QUOTE_MAX_SHOTS,
  QUOTE_MIN_SHOTS,
  QUOTE_REGIONS,
  REGION_LABEL,
  VERIFICATION_LABEL,
  normalizeQuoteStory,
  pickUnusedQuote,
  quoteActPlan,
  quoteCaption,
  quoteCounts,
  quoteOf,
  quoteOriginLine,
  quoteRequestFromEntry,
  quoteStoryCast,
  quoteStudyCard,
  quoteThemeLabel,
  quotesFor,
  searchQuotes,
  type QuoteEntry,
  type QuoteStoryConfig,
  type QuoteVoice,
} from "@/lib/quotes/quote-story";

type Lang = "vi" | "en";
const STORAGE_KEY = "afQuoteStory.v1";
/** Sayings this creator has already built (kept in this browser only). */
const USED_KEY = "afQuoteStory.used.v1";

function loadConfig(): QuoteStoryConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return (raw && normalizeQuoteStory(JSON.parse(raw))) || DEFAULT_QUOTE_STORY;
  } catch {
    return DEFAULT_QUOTE_STORY;
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
  return `${Math.floor(s / 60) ? `${Math.floor(s / 60)} phút` : ""}${s % 60 ? `${Math.floor(s / 60) ? " " : ""}${s % 60} giây` : ""}`;
};

const VOICES: Array<{ id: QuoteVoice; vi: string; en: string }> = [
  { id: "narrator", vi: "🎙️ Giọng dẫn đọc câu nói", en: "Narrator" },
  { id: "elder", vi: "👴 Người lớn tuổi nói trong truyện", en: "An elder says it" },
  { id: "main", vi: "💭 Nhân vật chính nhớ lại", en: "Inner voice" },
];

export function QuoteStoryCard(props: {
  lang: Lang;
  onBuild: (config: QuoteStoryConfig) => void;
  onOpenRoom: (config: QuoteStoryConfig) => void;
}) {
  const { lang, onBuild, onOpenRoom } = props;
  const vi = lang === "vi";
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<QuoteStoryConfig>(DEFAULT_QUOTE_STORY);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState("");
  const [hideUsed, setHideUsed] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  const [shelfDone, setShelfDone] = useState(false);
  const [copied, setCopied] = useState<"" | "caption" | "card">("");
  useEffect(() => {
    setConfig(loadConfig());
    setUsed(loadUsed());
  }, []);
  const update = (patch: Partial<QuoteStoryConfig>) =>
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

  const entry = quoteOf(config);
  const counts = useMemo(() => quoteCounts(), []);
  const usedSet = useMemo(() => new Set(used), [used]);
  const shelf = useMemo(() => quotesFor({ region: region || null, theme: theme || null, format: format || null }), [region, theme, format]);
  const entries = useMemo(() => {
    const found = query.trim() ? searchQuotes(query, shelf) : shelf;
    return hideUsed ? found.filter((q) => !usedSet.has(q.id)) : found;
  }, [query, shelf, hideUsed, usedSet]);
  const usedOnShelf = shelf.filter((q) => usedSet.has(q.id)).length;
  const cast = quoteStoryCast(config);
  const plan = quoteActPlan(config.shots, entry);
  const ready = config.request.trim().length > 0 || Boolean(entry);
  const shotOptions = Array.from({ length: QUOTE_MAX_SHOTS - QUOTE_MIN_SHOTS + 1 }, (_, i) => QUOTE_MIN_SHOTS + i).map((n) => ({
    value: String(n),
    label: `${n} shot · ${duration(n)}${n === QUOTE_DEFAULT_SHOTS ? (vi ? " (gợi ý)" : " (recommended)") : ""}`,
  }));

  const resetFilter = () => setShelfDone(false);
  const pick = (picked: QuoteEntry) => {
    setShelfDone(false);
    setCopied("");
    update({ quoteId: picked.id, quote: picked, request: quoteRequestFromEntry(picked) });
  };
  const pickNextUnused = () => {
    const next = pickUnusedQuote(shelf, used);
    if (next) pick(next);
    else setShelfDone(true);
  };
  const markUsed = () => {
    if (!entry || usedSet.has(entry.id)) return;
    const next = [...used, entry.id];
    setUsed(next);
    saveUsed(next);
  };
  const resetShelf = () => {
    const onShelf = new Set(shelf.map((q) => q.id));
    const next = used.filter((id) => !onShelf.has(id));
    setUsed(next);
    saveUsed(next);
    setShelfDone(false);
  };
  const copy = async (kind: "caption" | "card") => {
    if (!entry) return;
    try {
      await navigator.clipboard.writeText(kind === "caption" ? quoteCaption(entry) : quoteStudyCard(entry));
      setCopied(kind);
    } catch {
      setCopied("");
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-violet-400/50 bg-violet-500/[0.05] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">📜 {vi ? "Lời xưa – Chuyện nay — câu nói bất hủ thành phim ngắn (40 giây – 2 phút)" : "Timeless sayings as short stories"}</p>
          <p className="text-xs text-muted-foreground">
            {vi
              ? "Tục ngữ, ca dao Việt Nam · kinh điển Trung Hoa · danh nhân Châu Âu, Mỹ · trí tuệ thế giới · tỉ phú, doanh nhân, diễn giả. Mỗi câu có xuất xứ và nhãn độ tin cậy; câu hay bị gán sai được làm thành video \"Nghĩ lại cho đúng\". Không dựng hình danh nhân, không viết chữ lên hình."
              : "Proverbs, classics and great minds — sourced, with a correction format for misattributed lines."}
          </p>
        </div>
        <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
          {open ? (vi ? "Thu gọn" : "Close") : (vi ? "Mở" : "Open")}
        </Button>
      </div>

      {open && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!region} onClick={() => { setRegion(""); resetFilter(); }}>{vi ? "Mọi nơi" : "Everywhere"} ({counts.regions.reduce((n, r) => n + r.count, 0)})</Chip>
            {QUOTE_REGIONS.map((r) => (
              <Chip key={r} active={region === r} onClick={() => { setRegion(r); resetFilter(); }}>
                {vi ? REGION_LABEL[r].vi : REGION_LABEL[r].en} ({counts.regions.find((x) => x.id === r)?.count ?? 0})
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!format} onClick={() => { setFormat(""); resetFilter(); }}>{vi ? "Mọi định dạng" : "All formats"}</Chip>
            {QUOTE_FORMATS.map((f) => (
              <Chip key={f} active={format === f} onClick={() => { setFormat(f); resetFilter(); }}>
                {vi ? FORMAT_LABEL[f].vi : FORMAT_LABEL[f].en} ({counts.formats.find((x) => x.id === f)?.count ?? 0})
              </Chip>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium">
                {vi ? "Kho câu nói" : "Sayings"} ({entries.length}){" "}
                <span className="font-normal text-muted-foreground">· {vi ? `đã làm ${usedOnShelf}/${shelf.length}` : `made ${usedOnShelf}/${shelf.length}`}</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={pickNextUnused} title={vi ? "Chọn ngẫu nhiên một câu bạn chưa làm trong mục đang xem" : "Pick a saying you have not made yet"}>
                  <Dices className="h-3.5 w-3.5" />
                  {vi ? "Câu chưa làm" : "Next unused"}
                </Button>
                <Chip active={hideUsed} onClick={() => setHideUsed((v) => !v)}>{vi ? "Ẩn câu đã làm" : "Hide made"}</Chip>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!theme} onClick={() => { setTheme(""); resetFilter(); }}>{vi ? "Mọi chủ đề" : "All themes"}</Chip>
              {counts.themes.map((t) => (
                <Chip key={t.id} active={theme === t.id} onClick={() => { setTheme(t.id); resetFilter(); }}>
                  {t.label} ({t.count})
                </Chip>
              ))}
            </div>
            {shelfDone ? (
              <p className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-[11px]">
                🎉 {vi ? "Bạn đã làm hết các câu trong mục này." : "You have made every saying here."}
                <button type="button" className="inline-flex items-center gap-1 underline" onClick={resetShelf}>
                  <RotateCcw className="h-3 w-3" />
                  {vi ? "Làm lại từ đầu" : "Start over"}
                </button>
              </p>
            ) : null}
            <Input className="h-8 text-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={vi ? "Tìm: Khổng Tử, kiên trì, lời nói, Seneca, ca dao, biết ơn…" : "Search…"} />
            <div className="grid max-h-64 gap-1.5 overflow-auto sm:grid-cols-2">
              {entries.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pick(item)}
                  className={cn(
                    "rounded-md border bg-background p-2 text-left text-xs transition-colors hover:border-primary/60 hover:bg-primary/5",
                    entry?.id === item.id && "border-primary bg-primary/5"
                  )}
                >
                  <span className="font-medium">“{item.text}”</span>
                  {usedSet.has(item.id) ? <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">✓ {vi ? "đã làm" : "made"}</span> : null}
                  <span className="mt-0.5 block text-muted-foreground">— {item.verification === "misattributed" ? (vi ? `thường bị gán cho ${item.author}` : `often credited to ${item.author}`) : item.author || item.source} · {VERIFICATION_LABEL[item.verification].vi}</span>
                  <span className="mt-0.5 block text-[11px] text-violet-700 dark:text-violet-300">{FORMAT_LABEL[item.format].vi} · {item.hook}</span>
                </button>
              ))}
            </div>
          </div>

          {entry ? (
            <div className="space-y-1 rounded-md border bg-background/60 p-2 text-xs">
              <p className="font-semibold">📜 “{entry.text}”</p>
              {entry.original ? <p className="text-[11px] text-muted-foreground">{vi ? "Nguyên văn:" : "Original:"} {entry.original}</p> : null}
              <p className="text-[11px]">
                <b>{vi ? "Xuất xứ:" : "Source:"}</b> {quoteOriginLine(entry)} · {REGION_LABEL[entry.region].vi} · {KIND_LABEL[entry.kind]} · {VERIFICATION_LABEL[entry.verification].vi} · {quoteThemeLabel(entry)}
              </p>
              <p><b>{vi ? "Ý nghĩa:" : "Meaning:"}</b> {entry.meaning}</p>
              {entry.misread ? <p className="text-amber-700 dark:text-amber-300"><b>{entry.verification === "misattributed" ? (vi ? "Sự thật về nguồn gốc:" : "True origin:") : (vi ? "Hiểu cho đúng:" : "Read it right:")}</b> {entry.misread}</p> : null}
              <div>
                <b>{vi ? "Câu hỏi suy ngẫm:" : "Questions:"}</b>
                <ol className="ml-4 list-decimal">
                  {entry.questions.map((q) => <li key={q}>{q}</li>)}
                </ol>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="inline-flex items-center gap-1 text-[11px] underline opacity-80" onClick={() => copy("caption")}>
                  <ClipboardCopy className="h-3 w-3" />
                  {copied === "caption" ? (vi ? "Đã sao chép phụ đề" : "Caption copied") : (vi ? "Sao chép phụ đề câu nói" : "Copy caption")}
                </button>
                <button type="button" className="inline-flex items-center gap-1 text-[11px] underline opacity-80" onClick={() => copy("card")}>
                  <ClipboardCopy className="h-3 w-3" />
                  {copied === "card" ? (vi ? "Đã sao chép phiếu học tập" : "Study card copied") : (vi ? "Sao chép phiếu học tập" : "Copy study card")}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">{vi ? "Video không tự viết chữ lên hình — dán phụ đề này vào đoạn \"Lời xưa\" khi dựng." : "The video renders no text — paste this caption on the saying clip when editing."}</p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Câu nói & câu chuyện (sửa thoải mái)" : "Saying & story (editable)"}</label>
            <Textarea
              rows={6}
              className="text-xs"
              value={config.request}
              onChange={(e) => update({ request: e.target.value })}
              placeholder={vi ? "Chọn một câu ở trên, hoặc tự gõ: câu nói (kèm xuất xứ nếu biết chắc) và câu chuyện bạn muốn kể…" : "Pick a saying or type one (with its source) and the story…"}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Ai nói câu ấy" : "Who speaks the saying"}</label>
            <div className="flex flex-wrap gap-1.5">
              {VOICES.map((v) => (
                <Chip key={v.id} active={config.voice === v.id} onClick={() => update({ voice: v.id })}>{vi ? v.vi : v.en}</Chip>
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
                  placeholder={member.name}
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
                <Chip active={config.tone === "warm"} onClick={() => update({ tone: "warm" })}>{vi ? "☕ Ấm áp, đời thường" : "Warm"}</Chip>
                <Chip active={config.tone === "drama"} onClick={() => update({ tone: "drama" })}>{vi ? "🎭 Nhiều cảm xúc" : "Emotional"}</Chip>
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
                <Chip active={config.filming === "cinematic"} onClick={() => update({ filming: "cinematic" })}>{vi ? "🎬 Điện ảnh" : "Cinematic"}</Chip>
                <Chip active={config.filming === "phone"} onClick={() => update({ filming: "phone" })}>{vi ? "📱 Điện thoại cầm tay" : "Phone"}</Chip>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {vi
              ? `Video ${config.shots} shot (${duration(config.shots)})${config.shots > 10 ? " được viết theo từng lượt" : ""}. Câu nói được nói nguyên văn kèm xuất xứ; không dựng hình hay giọng danh nhân; tôn trọng tôn giáo, văn hóa; bài đăng gắn nhãn “tạo bằng AI”.`
              : "The saying is spoken verbatim with its source; no likeness of real people; posts carry an AI label."}
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
