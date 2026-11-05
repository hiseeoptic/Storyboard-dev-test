"use client";

// ============================================================
// GIAO DIỆN GỌN — the simplified first step of "Tạo Storyboard":
//   1. "Bạn muốn làm video gì?" — six big tiles; picking one shows only that
//      mode (the other cards and the long ad form are hidden).
//   2. Inside a mode, the advanced settings fold into "⚙️ Tùy chỉnh thêm"
//      (smart defaults are already set) and the build button stays in reach.
//   3. One switch brings back the full classic layout at any time
//      ("Giao diện đầy đủ (như cũ)"), so nothing is lost if a creator prefers it.
// Only presentation lives here; the cards and the generator are unchanged.
// ============================================================
import { useEffect, useState } from "react";
import { ArrowLeft, LayoutGrid, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Lang = "vi" | "en";

export type VideoKind = "kids" | "family" | "office" | "quote" | "ad" | "free";

export const VIDEO_KINDS: Array<{
  id: VideoKind;
  emoji: string;
  vi: string;
  en: string;
  desc_vi: string;
  desc_en: string;
  example_vi: string;
  tone: string;
}> = [
  { id: "kids", emoji: "🧒", vi: "Bé cưng viral", en: "Cute kids reel",
    desc_vi: "Bé nhõng nhẽo, ghen tị, mặc cả, dạy con — 255 tình huống nhõng nhẽo + gần 1.900 bài dạy con.",
    desc_en: "Whiny, jealous, bargaining kids — scene and parenting libraries.",
    example_vi: "VD: Bố ăn vụng, bé đòi méc mẹ", tone: "border-pink-400/60 bg-pink-500/[0.06] hover:border-pink-500" },
  { id: "family", emoji: "🏠", vi: "Chuyện nhà", en: "Family drama",
    desc_vi: "Vợ chồng, mẹ chồng – nàng dâu, chị dâu – em chồng: 220 bài học thành phim ngắn.",
    desc_en: "Couples and in-laws: short dramas with a lesson.",
    example_vi: "VD: Mẹ chồng chê con dâu nấu mặn", tone: "border-amber-400/60 bg-amber-500/[0.06] hover:border-amber-500" },
  { id: "office", emoji: "💼", vi: "Chuyện công sở", en: "Workplace stories",
    desc_vi: "120 case đào tạo văn hóa doanh nghiệp cho sếp và nhân viên.",
    desc_en: "Workplace culture training cases.",
    example_vi: "VD: Sếp giao việc phút chót", tone: "border-sky-400/60 bg-sky-500/[0.06] hover:border-sky-500" },
  { id: "quote", emoji: "📜", vi: "Lời xưa – Chuyện nay", en: "Timeless sayings",
    desc_vi: "Câu nói bất hủ, tục ngữ, danh nhân, tỉ phú — 421 câu có xuất xứ.",
    desc_en: "Proverbs and great minds turned into short stories.",
    example_vi: "VD: \"Có công mài sắt, có ngày nên kim\"", tone: "border-violet-400/60 bg-violet-500/[0.06] hover:border-violet-500" },
  { id: "ad", emoji: "🛍️", vi: "Quảng cáo sản phẩm", en: "Product ad",
    desc_vi: "TVC, affiliate, demo sản phẩm: chỉ sản phẩm, chỉ tay, hoặc có người diễn.",
    desc_en: "TVC, affiliate and demo ads.",
    example_vi: "VD: Nồi chiên không dầu cho mẹ bỉm", tone: "border-emerald-400/60 bg-emerald-500/[0.06] hover:border-emerald-500" },
  { id: "free", emoji: "✍️", vi: "Tự viết ý tưởng", en: "Your own idea",
    desc_vi: "Gõ ý tưởng hoặc chụp trang sách → phòng biên kịch AI viết kịch bản cùng bạn.",
    desc_en: "Type an idea or photograph book pages → the AI writers' room.",
    example_vi: "VD: Truyện ngụ ngôn \"Rùa và Thỏ\"", tone: "border-slate-400/60 bg-slate-500/[0.06] hover:border-slate-500" },
];

const PREFS_KEY = "storyboard.ui.v1";

/** The creator's layout choice (this browser only): simple by default, the last mode remembered. */
export function useSimpleUi() {
  const [simple, setSimpleState] = useState(true);
  const [kind, setKindState] = useState<VideoKind | "">("");
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as { simple?: unknown; kind?: unknown };
      if (raw.simple === false) setSimpleState(false);
      if (VIDEO_KINDS.some((k) => k.id === raw.kind)) setKindState(raw.kind as VideoKind);
    } catch {
      /* private mode — defaults */
    }
  }, []);
  const save = (next: { simple: boolean; kind: VideoKind | "" }) => {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* quota */ }
  };
  const setSimple = (value: boolean) => { setSimpleState(value); save({ simple: value, kind }); };
  const setKind = (value: VideoKind | "") => { setKindState(value); save({ simple, kind: value }); };
  return { simple, setSimple, kind, setKind };
}

/** Step 1 in the simple layout: what kind of video? */
export function VideoKindLauncher(props: { lang: Lang; onPick: (kind: VideoKind) => void; onClassic: () => void }) {
  const vi = props.lang === "vi";
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-base font-semibold">{vi ? "Bạn muốn làm video gì?" : "What do you want to make?"}</p>
        <p className="text-xs text-muted-foreground">
          {vi ? "Chọn một loại — app chỉ hiện đúng những gì cần cho loại đó, các tùy chọn khác đã được đặt sẵn." : "Pick one — only what that kind needs is shown; everything else has smart defaults."}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {VIDEO_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => props.onPick(k.id)}
            className={cn("flex min-h-[112px] flex-col gap-1 rounded-xl border-2 p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary", k.tone)}
          >
            <span className="text-2xl leading-none">{k.emoji}</span>
            <span className="text-sm font-semibold">{vi ? k.vi : k.en}</span>
            <span className="text-xs text-muted-foreground">{vi ? k.desc_vi : k.desc_en}</span>
            {vi && <span className="mt-auto text-[11px] italic text-muted-foreground/80">{k.example_vi}</span>}
          </button>
        ))}
      </div>
      <button type="button" onClick={props.onClassic} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground underline-offset-2 hover:underline">
        <LayoutGrid className="h-3 w-3" />
        {vi ? "Dùng giao diện đầy đủ (như cũ)" : "Use the full classic layout"}
      </button>
    </div>
  );
}

/** The bar above a chosen mode: back to the tiles, or the classic layout. */
export function VideoKindBar(props: { lang: Lang; kind: VideoKind; onBack: () => void; onClassic: () => void }) {
  const vi = props.lang === "vi";
  const k = VIDEO_KINDS.find((x) => x.id === props.kind)!;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={props.onBack}>
        <ArrowLeft className="h-4 w-4" />
        {vi ? "Chọn loại video khác" : "Other video kinds"}
      </Button>
      <span className="text-sm font-semibold">{k.emoji} {vi ? k.vi : k.en}</span>
      <button type="button" onClick={props.onClassic} className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
        {vi ? "Giao diện đầy đủ" : "Classic layout"}
      </button>
    </div>
  );
}

/** Shown on top of the classic layout: one click back to the simple one. */
export function ClassicUiBanner(props: { lang: Lang; onSimple: () => void }) {
  const vi = props.lang === "vi";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <span>{vi ? "Bạn đang dùng giao diện đầy đủ (như cũ)." : "You are using the full classic layout."}</span>
      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={props.onSimple}>
        <Sparkles className="h-3.5 w-3.5" />
        {vi ? "Dùng giao diện gọn" : "Use the simple layout"}
      </Button>
    </div>
  );
}

/** Advanced settings: folded in the simple layout (with a one-line summary), shown as before in the classic one. */
export function AdvancedOptions(props: { simple: boolean; lang?: Lang; title?: string; summary?: string; children: React.ReactNode }) {
  if (!props.simple) return <>{props.children}</>;
  const vi = (props.lang ?? "vi") === "vi";
  return (
    <details className="group rounded-lg border bg-background/60 open:bg-background">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <Settings2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 whitespace-nowrap">{props.title ?? (vi ? "Tùy chỉnh thêm" : "More settings")}</span>
        {props.summary && <span className="min-w-0 flex-1 truncate font-normal text-muted-foreground">· {props.summary}</span>}
        <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] font-normal text-muted-foreground group-open:hidden">{vi ? "Mở ▾" : "Open ▾"}</span>
        <span className="ml-auto hidden shrink-0 whitespace-nowrap text-[11px] font-normal text-muted-foreground group-open:inline">{vi ? "Thu gọn ▴" : "Close ▴"}</span>
      </summary>
      <div className="space-y-3 border-t px-3 pb-3 pt-3">{props.children}</div>
    </details>
  );
}

/** The build buttons: in the simple layout they stay pinned at the bottom of the screen with a short summary. */
export function StickyActions(props: { simple: boolean; summary?: string; children: React.ReactNode }) {
  if (!props.simple) return <div className="flex flex-wrap gap-2">{props.children}</div>;
  return (
    <div className="sticky bottom-0 z-20 -mx-3 -mb-3 space-y-1 rounded-b-lg border-t bg-background/95 px-3 py-2 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.25)] backdrop-blur">
      {props.summary && <p className="truncate text-[11px] text-muted-foreground">{props.summary}</p>}
      <div className="flex flex-wrap gap-2">{props.children}</div>
    </div>
  );
}
