"use client";

import { useState } from "react";
import { Loader2, Sparkles, Users, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type UploadedImage } from "@/components/ui/image-uploader";
import { generateStudioImage } from "@/actions";
import { DEFAULT_CONFIG, type PhotoConfig } from "@/lib/studio/types";
import { FACE_ENHANCEMENT_OPTIONS } from "@/lib/studio/options";

interface GenResult {
  id: string;
  uri: string;
  label: string;
  added: boolean;
}

// Clean identity angles only — expressions are described per-scene in the
// prompt (Veo renders them), so they are NOT generated as references.
const ANGLE_VARIANTS: { label: string; override: Partial<PhotoConfig> }[] = [
  { label: "Toàn thân (chính diện)", override: { photographyStyle: "Full body FRONT view, head to toe visible, standing naturally and confidently, clean neutral studio background, sharp high detail", aspectRatio: "9:16" } },
  { label: "Nửa người 3/4", override: { photographyStyle: "Waist-up three-quarter portrait, slight head turn, natural facial depth, sharp face, soft studio lighting, clean background" } },
  { label: "Nửa người nghiêng", override: { photographyStyle: "Waist-up side-profile portrait, clean outline, sharp face, minimal background" } },
  { label: "Cận mặt", override: { photographyStyle: "Close-up beauty headshot, face fills frame, sharp clear eyes, flattering soft light, clean background" } },
];

function rid() {
  return Math.random().toString(36).slice(2, 10);
}
function uriToBase64(uri: string) {
  return uri.includes(",") ? uri.split(",")[1]! : uri;
}

export function CharacterStudio({
  sourceImages,
  onApprove,
}: {
  sourceImages: UploadedImage[];
  onApprove: (img: UploadedImage) => void;
}) {
  const [enhancements, setEnhancements] = useState<string[]>(["lock_face", "smooth_skin"]);
  const [results, setResults] = useState<GenResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const faces = sourceImages.map((i) => i.base64);

  const toggle = (id: string) =>
    setEnhancements((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const genOne = async (label: string, override?: Partial<PhotoConfig>) => {
    const config: PhotoConfig = {
      ...DEFAULT_CONFIG,
      // This is an IDENTITY reference sheet built from the user's uploaded photo,
      // so the photo dictates who the person is (gender/age driven by the photo
      // via buildPrompt). Don't force the default tailored-suit look (which,
      // together with the MALE default, swapped an uploaded woman into a man in
      // a suit): keep the person's own natural clothing from the reference.
      outfitCategory: "",
      outfitDetail: "natural, well-fitted everyday clothing consistent with the reference photo",
      faceEnhancements: enhancements,
      ...override,
    };
    const res = await generateStudioImage({ config, faces });
    if (!res.success) throw new Error(res.error);
    setResults((prev) => [{ id: rid(), uri: res.data.url, label, added: false }, ...prev]);
  };

  const guard = () => {
    if (faces.length === 0) {
      setError("Hãy tải lên ảnh khuôn mặt ở trên trước.");
      return false;
    }
    setError(null);
    return true;
  };

  const genAngles = async () => {
    if (!guard()) return;
    setBusy(true);
    try {
      for (let i = 0; i < ANGLE_VARIANTS.length; i++) {
        const v = ANGLE_VARIANTS[i]!;
        setProgress(`Đang tạo ${i + 1}/${ANGLE_VARIANTS.length}: ${v.label}`);
        try {
          await genOne(v.label, v.override);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Tạo ảnh thất bại");
        }
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const genSingle = async () => {
    if (!guard()) return;
    setBusy(true);
    setProgress("Đang tạo ảnh...");
    try {
      await genOne("Tuỳ chỉnh");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo ảnh thất bại");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const useImage = (r: GenResult) => {
    onApprove({
      id: rid(),
      preview: r.uri,
      base64: uriToBase64(r.uri),
      fileName: `studio-${r.label}.jpg`,
    });
    setResults((prev) => prev.map((x) => (x.id === r.id ? { ...x, added: true } : x)));
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" /> Làm đẹp & tạo ảnh nhân vật (tuỳ chọn)
      </div>
      <p className="text-xs text-muted-foreground">
        Tạo ảnh chân dung đẹp, nhiều góc từ ảnh bạn vừa tải lên. Ảnh “Dùng” sẽ thành ảnh tham chiếu
        khoá danh tính cho toàn bộ storyboard. (Biểu cảm sẽ do prompt từng cảnh điều khiển.)
      </p>

      <div className="flex flex-wrap gap-1.5">
        {FACE_ENHANCEMENT_OPTIONS.map((opt) => {
          const on = enhancements.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary/50"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={genAngles} disabled={busy || faces.length === 0} className="gap-2">
          <Users className="h-4 w-4" /> Tạo bộ góc (4 ảnh)
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={genSingle} disabled={busy || faces.length === 0} className="gap-2">
          <Sparkles className="h-4 w-4" /> Tạo 1 ảnh
        </Button>
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {results.map((r) => (
            <div key={r.id} className={`group relative overflow-hidden rounded-lg border-2 ${r.added ? "border-primary" : "border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.uri} alt={r.label} className="aspect-[3/4] w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">{r.label}</span>
              <button
                type="button"
                onClick={() => setResults((p) => p.filter((x) => x.id !== r.id))}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => useImage(r)}
                disabled={r.added}
                className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1 text-[11px] font-medium ${
                  r.added ? "bg-primary text-primary-foreground" : "bg-black/60 text-white hover:bg-primary/80"
                }`}
              >
                <Check className="h-3 w-3" /> {r.added ? "Đã dùng" : "Dùng"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
