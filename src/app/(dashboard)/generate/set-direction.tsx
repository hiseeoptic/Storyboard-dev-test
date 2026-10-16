"use client";

import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SET_STYLE_GROUPS, findSetStyle, suggestedSetStyles, type SetStyle } from "@/lib/environment/set-styles";

type Lang = "vi" | "en";

const REQUEST_EXAMPLES: Record<Lang, string[]> = {
  vi: [
    "Một con phố Hàng Bông, Hà Nội, chiều muộn — hàng quán ven đường, ban công hoa giấy",
    "Quán cà phê nhỏ tầng 2 nhìn xuống Hồ Gươm, sáng sớm có sương",
    "Phòng khách nhà cổ ở Hội An, đồ gỗ chạm, đèn lồng",
  ],
  en: [
    "Hang Bong street in Hanoi's Old Quarter, late afternoon — street stalls, balconies with bougainvillea",
    "A small second-floor café overlooking Hoan Kiem Lake, misty early morning",
    "A living room in an old Hoi An house, carved wood, silk lanterns",
  ],
};

/**
 * The "where and how should the set look" controls: a free-text set request
 * and a set-style picker (suggested for the genre first, all styles on demand).
 */
export function SetDirectionPanel(props: {
  lang: Lang;
  genre: string;
  request: string;
  onRequest: (value: string) => void;
  styleId: string;
  onStyle: (id: string) => void;
  uploadMode: boolean;
}) {
  const { lang, genre, request, onRequest, styleId, onStyle, uploadMode } = props;
  const vi = lang === "vi";
  const [showAll, setShowAll] = useState(false);
  const suggested = useMemo(() => suggestedSetStyles(genre), [genre]);
  const selected = findSetStyle(styleId);
  const label = (style: SetStyle) => (vi ? style.label_vi : style.label_en);

  const chip = (style: SetStyle) => (
    <button
      key={style.id}
      type="button"
      onClick={() => onStyle(styleId === style.id ? "" : style.id)}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        styleId === style.id
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:border-primary/60 hover:bg-primary/5"
      )}
      aria-pressed={styleId === style.id}
    >
      {label(style)}
    </button>
  );

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="set-request">
          {vi ? "✍️ Yêu cầu bối cảnh" : "✍️ Set request"}
        </label>
        <Textarea
          id="set-request"
          rows={2}
          value={request}
          onChange={(e) => onRequest(e.target.value)}
          placeholder={vi ? `VD: ${REQUEST_EXAMPLES.vi[0]}` : `e.g. ${REQUEST_EXAMPLES.en[0]}`}
        />
        <div className="flex flex-wrap gap-1.5">
          {REQUEST_EXAMPLES[lang].slice(1).map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onRequest(example)}
              className="rounded border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/60 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {vi
            ? "Gõ nơi câu chuyện diễn ra — càng cụ thể càng tốt (tên phố, thành phố, thời điểm, chi tiết đặc trưng). App dựng bối cảnh như ảnh chụp thật; địa danh có thật giữ đúng kiến trúc của nơi đó."
            : "Type where the story happens — the more specific the better (street, city, time, signature details). The set is built like a real photograph; a real place keeps its real architecture."}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium">{vi ? "🏛️ Phong cách bối cảnh" : "🏛️ Set style"}</label>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? (vi ? "Thu gọn" : "Show less") : vi ? "Xem tất cả phong cách" : "All styles"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onStyle("")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              !styleId ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60"
            )}
            aria-pressed={!styleId}
          >
            {vi ? "✨ Tự động theo câu chuyện" : "✨ Auto from the story"}
          </button>
          {!showAll && suggested.map(chip)}
          {!showAll && selected && !suggested.some((s) => s.id === selected.id) && chip(selected)}
        </div>
        {!showAll && suggested.length > 0 && (
          <p className="text-[11px] text-muted-foreground">{vi ? "Gợi ý theo thể loại đã chọn." : "Suggested for the chosen genre."}</p>
        )}
        {showAll && (
          <div className="space-y-2">
            {SET_STYLE_GROUPS.map((group) => (
              <div key={group.id} className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {vi ? group.label_vi : group.label_en}
                </p>
                <div className="flex flex-wrap gap-1.5">{group.styles.map(chip)}</div>
              </div>
            ))}
          </div>
        )}
        {selected && (
          <p className="rounded bg-muted/50 p-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{label(selected)}:</span> {selected.prompt_en}
          </p>
        )}
        {uploadMode && (
          <p className="text-xs text-muted-foreground">
            {vi
              ? "Đoạn nào có ảnh bối cảnh nạp sẽ theo đúng ảnh; yêu cầu và phong cách áp cho các đoạn còn lại."
              : "Segments with uploaded location photos follow the photos; the request and style apply to the rest."}
          </p>
        )}
      </div>
    </div>
  );
}
