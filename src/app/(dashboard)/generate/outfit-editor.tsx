"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types";
import type { PlacementMode } from "@/lib/product-placement";
import {
  GROUP_LABEL,
  SLOT_LABEL,
  WEARER_GROUPS,
  isChildGroup,
  resolveFills,
  type GarmentAnalysis,
  type GarmentSlot,
  type WearerGroup,
} from "@/lib/fashion/outfit";

type Lang = "vi" | "en";

/** The clothes one character wears to sell them (editable in the cast). */
export interface OutfitDraft {
  images: UploadedImage[];
  name: string;
  link: string;
  group: WearerGroup;
  placement: PlacementMode;
  analysis: GarmentAnalysis | null;
  /** User edits of the app-styled pieces, by slot. */
  edits: Partial<Record<GarmentSlot, string>>;
}

export function emptyOutfit(isChild = false): OutfitDraft {
  return { images: [], name: "", link: "", group: isChild ? "girl" : "woman", placement: "featured", analysis: null, edits: {} };
}

export const outfitHasContent = (o: OutfitDraft | undefined): o is OutfitDraft => !!o && o.images.length > 0;

export function OutfitEditor(props: {
  lang: Lang;
  wearerName: string;
  value: OutfitDraft | undefined;
  defaultChild?: boolean;
  onChange: (value: OutfitDraft | undefined) => void;
  analyze: (draft: OutfitDraft) => Promise<ActionResult<GarmentAnalysis>>;
}) {
  const { lang, wearerName, value, defaultChild, onChange, analyze } = props;
  const vi = lang === "vi";
  const [open, setOpen] = useState(!!value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = value ?? emptyOutfit(defaultChild);
  const set = (patch: Partial<OutfitDraft>) => onChange({ ...draft, ...patch });
  const fills = draft.analysis ? resolveFills(draft.analysis, draft.group, draft.edits) : {};
  const who = wearerName.trim() || (vi ? "nhân vật này" : "this character");

  const runAnalyze = async () => {
    if (!draft.images.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await analyze(draft);
      // The user's wearer choice stands; a different audience is only flagged.
      if (res.success) set({ analysis: res.data, edits: {} });
      else setError(res.error);
    } catch {
      setError(vi ? "Không kết nối được để phân tích. Thử lại nhé." : "Could not reach the analyser. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"
      >
        👗 {vi ? `Gắn đồ đang bán cho ${who} (thời trang affiliate)` : `Attach clothes ${who} is selling (fashion affiliate)`}
      </button>
    );
  }

  const audienceMismatch =
    !!draft.analysis && WEARER_GROUPS.includes(draft.analysis.audience as WearerGroup) && draft.analysis.audience !== draft.group;

  return (
    <div className="space-y-3 rounded-lg border border-pink-500/30 bg-pink-500/[0.03] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">👗 {vi ? `Đồ đang bán — ${who} mặc` : `Clothes for sale — worn by ${who}`}</p>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-destructive"
          onClick={() => { onChange(undefined); setOpen(false); setError(null); }}
        >
          {vi ? "Bỏ" : "Remove"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={vi ? "Đối tượng mặc" : "Wearer"}>
        {WEARER_GROUPS.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => set({ group })}
            aria-pressed={draft.group === group}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              draft.group === group ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60"
            )}
          >
            {GROUP_LABEL[group][lang]}
          </button>
        ))}
      </div>

      <ImageUploader
        images={draft.images}
        onChange={(images) => set({ images: images.slice(0, 4), analysis: null, edits: {} })}
        maxImages={4}
        label={vi ? "Ảnh sản phẩm (1–4 ảnh: áo, quần, đầm, giày…)" : "Product photos (1–4: top, bottom, dress, shoes…)"}
        hint={vi ? "Ảnh có người mẫu cũng được — app chỉ lấy quần áo, không lấy mặt người mẫu." : "Photos with a model are fine — only the clothes are used, never the model's face."}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder={vi ? "Tên sản phẩm (vd: Đầm hoa nhí cổ vuông)" : "Product name"} />
        <Input value={draft.link} onChange={(e) => set({ link: e.target.value })} placeholder={vi ? "Link Shopee / TikTok Shop (tuỳ chọn)" : "Shop link (optional)"} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["featured", "natural"] as PlacementMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => set({ placement: mode })}
            aria-pressed={draft.placement === mode}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              draft.placement === mode ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60"
            )}
          >
            {mode === "featured"
              ? vi ? "Làm nổi bật + kêu gọi mua" : "Featured + CTA"
              : vi ? "Mặc tự nhiên trong truyện" : "Worn naturally in the story"}
          </button>
        ))}
      </div>

      {draft.images.length > 0 && (
        <button
          type="button"
          onClick={runAnalyze}
          disabled={busy}
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy
            ? vi ? "AI đang nhận từng món…" : "Reading the garments…"
            : draft.analysis
              ? vi ? "🔍 Nhận lại món đồ" : "🔍 Read again"
              : vi ? "🔍 AI nhận món đồ trong ảnh" : "🔍 Read the garments"}
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {draft.images.length > 0 && !draft.analysis && !busy && (
        <p className="text-xs text-muted-foreground">
          {vi
            ? "Nên bấm nhận món: app biết món nào có trong ảnh và tự phối món còn thiếu. Bỏ qua thì app coi ảnh là cả bộ đồ."
            : "Recommended: the app learns which pieces the photos show and styles the missing ones. If skipped, the photos count as the whole outfit."}
        </p>
      )}

      {draft.analysis && (
        <div className="space-y-2 rounded-md border bg-background p-2">
          {draft.analysis.garments.map((g, i) => (
            <div key={`${g.slot}-${i}`} className="text-xs">
              <span className="font-medium">✅ {SLOT_LABEL[g.slot][lang]}</span>
              <span className="text-muted-foreground"> — {vi ? "theo ảnh" : "from the photo"}: {g.description}</span>
            </div>
          ))}
          {(Object.keys(fills) as GarmentSlot[]).map((slot) => (
            <div key={slot} className="space-y-1">
              <label className="text-xs font-medium">⚙️ {SLOT_LABEL[slot][lang]} — {vi ? "app phối (sửa được)" : "styled by the app (editable)"}</label>
              <Input
                value={draft.edits[slot] ?? fills[slot] ?? ""}
                onChange={(e) => set({ edits: { ...draft.edits, [slot]: e.target.value } })}
              />
            </div>
          ))}
          {draft.analysis.has_model_in_photo && (
            <p className="text-[11px] text-muted-foreground">
              {vi ? "Ảnh có người mẫu: app chỉ lấy quần áo, nhân vật của bạn mặc bộ đồ." : "A model wears the clothes: only the garments are used."}
            </p>
          )}
          {!draft.analysis.has_back_view && (
            <p className="text-[11px] text-muted-foreground">
              {vi ? "Chỉ có mặt trước: app tránh cảnh quay lưng. Thêm ảnh mặt sau nếu muốn quay lưng." : "Front only: back views are avoided. Add a back photo to allow them."}
            </p>
          )}
          {audienceMismatch && (
            <p className="text-[11px] text-amber-700">
              {vi
                ? `AI thấy đồ này dành cho ${GROUP_LABEL[draft.analysis.audience as WearerGroup].vi.toLowerCase()} — kiểm tra lại đối tượng mặc.`
                : `The clothes look made for a ${GROUP_LABEL[draft.analysis.audience as WearerGroup].en.toLowerCase()} — check the wearer.`}
            </p>
          )}
          {isChildGroup(draft.group) && (
            <p className="text-[11px] text-muted-foreground">
              {vi
                ? "Đồ trẻ em: bé vui chơi hồn nhiên đúng tuổi, có bố mẹ bên cạnh khi hợp cảnh; không trang điểm, không tạo dáng người lớn."
                : "Children's clothing: natural, age-appropriate play with a parent nearby where it fits; no make-up or adult poses."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
