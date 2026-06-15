"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Sparkles, Trash2, ArrowRight, Wand2, Users, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { generateStudioImage } from "@/actions";
import { saveHandoff } from "@/lib/handoff";
import { DEFAULT_CONFIG, type PhotoConfig, type SubjectType } from "@/lib/studio/types";
import {
  SPECIAL_STYLES,
  STANDARD_STYLES,
  FACE_ENHANCEMENT_OPTIONS,
  RATIO_OPTIONS,
  QUALITY_OPTIONS,
  EXPRESSION_OPTIONS,
} from "@/lib/studio/options";

export const STUDIO_HANDOFF_KEY = "sb_studio_handoff";

interface StudioResult {
  id: string;
  url: string;
  label: string;
  approved: boolean;
}

const SUBJECTS: { value: SubjectType; label: string }[] = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "COUPLE", label: "Cặp đôi" },
  { value: "GROUP", label: "Nhóm" },
  { value: "PRODUCT", label: "Sản phẩm" },
];

const FRONT_HEADSHOT =
  "Front-facing studio headshot, symmetrical face, head and shoulders, clean neutral background";

// Angle set to generate for review.
const ANGLE_VARIANTS: { label: string; override: Partial<PhotoConfig> }[] = [
  { label: "Chính diện", override: { photographyStyle: "Front-facing studio portrait, symmetrical face, clean neutral background" } },
  { label: "Góc 3/4", override: { photographyStyle: "Three-quarter face portrait, slight head turn, natural facial depth, studio lighting" } },
  { label: "Nghiêng", override: { photographyStyle: "Side profile studio portrait, clean outline, minimal background, elegant composition" } },
  { label: "Sau lưng", override: { photographyStyle: "Back view of the same person from behind, head and shoulders, showing hairstyle and outfit from the back, clean neutral background" } },
  { label: "Toàn thân", override: { photographyStyle: "Full body shot, head to toe visible, standing naturally and confidently, clean neutral background", aspectRatio: "9:16" } },
];

function rid() {
  return Math.random().toString(36).slice(2, 10);
}
function dataUriToBase64(uri: string): string {
  return uri.includes(",") ? uri.split(",")[1]! : uri;
}

// Generated images come back at up to 2K — downscale to a reference-friendly
// size (JPEG) before handing off, so the storyboard request stays well under
// the server-action body limit and analysis is fast.
function downscaleToBase64(uri: string, max = 1024, quality = 0.88): Promise<string> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const img = new Image();
    img.crossOrigin = "anonymous";
    // Never hang the handoff: if the image can't decode in time, keep the original.
    const timer = setTimeout(() => done(dataUriToBase64(uri)), 12000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return done(dataUriToBase64(uri));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/jpeg", quality);
        done(out.split(",")[1] ?? out);
      } catch {
        // Tainted canvas / iOS memory failure → fall back to the original.
        done(dataUriToBase64(uri));
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(dataUriToBase64(uri));
    };
    img.src = uri;
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function StudioClient() {
  const router = useRouter();

  const [faceImages, setFaceImages] = useState<UploadedImage[]>([]);
  const [productImages, setProductImages] = useState<UploadedImage[]>([]);
  const [logoImage, setLogoImage] = useState<UploadedImage[]>([]);
  const [outfitImage, setOutfitImage] = useState<UploadedImage[]>([]);

  const [config, setConfig] = useState<PhotoConfig>(DEFAULT_CONFIG);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof PhotoConfig>(key: K, value: PhotoConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const toggleEnh = (id: string) => {
    const cur = config.faceEnhancements || [];
    set("faceEnhancements", cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const styleList = config.photographyStyleCategory === "special" ? SPECIAL_STYLES : STANDARD_STYLES;
  const approved = useMemo(() => results.filter((r) => r.approved), [results]);

  const hasInput = faceImages.length > 0 || productImages.length > 0;

  // Generate one image with an optional config override.
  const genOne = async (label: string, override?: Partial<PhotoConfig>) => {
    const cfg = { ...config, ...override, outfitImage: outfitImage[0]?.base64 ?? null };
    const res = await generateStudioImage({
      config: cfg,
      faces: faceImages.map((i) => i.base64),
      products: productImages.map((i) => i.base64),
      logo: logoImage[0]?.base64 ?? null,
      outfitImage: outfitImage[0]?.base64 ?? null,
    });
    if (!res.success) throw new Error(res.error);
    setResults((prev) => [{ id: rid(), url: res.data.url, label, approved: false }, ...prev]);
  };

  const guard = () => {
    if (!hasInput) {
      setError("Hãy tải lên ảnh khuôn mặt (hoặc sản phẩm) trước.");
      return false;
    }
    setError(null);
    return true;
  };

  const generateSingle = async () => {
    if (!guard()) return;
    setBusy(true);
    try {
      await genOne("Tuỳ chỉnh");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo ảnh thất bại");
    } finally {
      setBusy(false);
    }
  };

  const runBatch = async (name: string, items: { label: string; override?: Partial<PhotoConfig> }[]) => {
    if (!guard()) return;
    setBusy(true);
    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        setProgress(`Đang tạo ${name} ${i + 1}/${items.length}: ${it.label}`);
        try {
          await genOne(it.label, it.override);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Tạo ảnh thất bại");
        }
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const genAngles = () => runBatch("góc", ANGLE_VARIANTS);
  const genExpressions = () =>
    runBatch(
      "biểu cảm",
      EXPRESSION_OPTIONS.map((o) => ({
        label: o.label,
        override: { expression: o.value, photographyStyleCategory: "standard", photographyStyle: FRONT_HEADSHOT },
      }))
    );

  const pushToStoryboard = async () => {
    if (approved.length === 0) return;
    setBusy(true);
    setProgress("Đang chuẩn bị ảnh cho Storyboard...");
    try {
      // Downscale SEQUENTIALLY — decoding several 2K images at once exhausts
      // mobile-Safari memory and makes the downscale silently fall back to the
      // full-size original.
      const characterImages: string[] = [];
      for (let i = 0; i < approved.length; i++) {
        setProgress(`Đang chuẩn bị ảnh ${i + 1}/${approved.length}...`);
        characterImages.push(await downscaleToBase64(approved[i]!.url));
      }
      const handoff = {
        studio: true,
        characterImages,
        productImages: [...productImages, ...outfitImage].map((i) => i.base64),
      };
      // IndexedDB-backed store (reliable on mobile, unlike sessionStorage).
      await saveHandoff(handoff);
      router.push("/generate");
    } catch {
      setError("Không chuyển được ảnh sang Storyboard. Hãy thử lại hoặc duyệt ít ảnh hơn.");
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wand2 className="h-6 w-6 text-primary" /> Image Studio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo ảnh người thật đẹp & giống từ ảnh bạn tải lên — làm đẹp mặt, nét mặt, nhiều góc &
          biểu cảm. Duyệt ảnh ưng ý rồi đẩy sang Storyboard (Storyboard chỉ lo kịch bản & prompt).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ─── Left: controls ─── */}
        <div className="space-y-6">
          {/* 1. Uploads */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Ảnh đầu vào</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Khuôn mặt của bạn (1-3 ảnh, nhiều góc)">
                <ImageUploader images={faceImages} onChange={setFaceImages} maxImages={3} />
              </Field>
              <Field label="Sản phẩm / túi / phụ kiện (tuỳ chọn)">
                <ImageUploader images={productImages} onChange={setProductImages} maxImages={2} />
              </Field>
              <Field label="Trang phục cần mặc — ảnh thật (tuỳ chọn)">
                <ImageUploader images={outfitImage} onChange={setOutfitImage} maxImages={1} />
              </Field>
              <Field label="Logo (tuỳ chọn)">
                <ImageUploader images={logoImage} onChange={setLogoImage} maxImages={1} />
              </Field>
            </CardContent>
          </Card>

          {/* 2. Face beautify + expression + quality */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Làm đẹp khuôn mặt & nét mặt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {FACE_ENHANCEMENT_OPTIONS.map((opt) => {
                  const on = config.faceEnhancements?.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleEnh(opt.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        on ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Biểu cảm mặc định (nét mặt)">
                  <select className={selectCls} value={config.expression} onChange={(e) => set("expression", e.target.value)}>
                    {EXPRESSION_OPTIONS.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Chất lượng / phong cách ảnh">
                  <select className={selectCls} value={config.quality} onChange={(e) => set("quality", e.target.value)}>
                    {QUALITY_OPTIONS.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* 3. Subject + style */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Chủ thể & phong cách chụp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Chủ thể">
                  <select className={selectCls} value={config.subjectType} onChange={(e) => set("subjectType", e.target.value as SubjectType)}>
                    {SUBJECTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Khung hình">
                  <select className={selectCls} value={config.aspectRatio} onChange={(e) => set("aspectRatio", e.target.value)}>
                    {RATIO_OPTIONS.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Tabs
                value={config.photographyStyleCategory}
                onValueChange={(v) => {
                  const cat = v as "special" | "standard";
                  const first = (cat === "special" ? SPECIAL_STYLES : STANDARD_STYLES)[0];
                  setConfig((c) => ({ ...c, photographyStyleCategory: cat, photographyStyle: first?.value ?? c.photographyStyle }));
                }}
              >
                <TabsList>
                  <TabsTrigger value="standard">Chuẩn (Studio/Đời thường)</TabsTrigger>
                  <TabsTrigger value="special">Nghệ thuật (Concept)</TabsTrigger>
                </TabsList>
                <TabsContent value={config.photographyStyleCategory} className="pt-3">
                  <select className={selectCls} value={config.photographyStyle} onChange={(e) => set("photographyStyle", e.target.value)}>
                    {styleList.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </TabsContent>
              </Tabs>
              <Field label="Ghi chú thêm (tuỳ chọn)">
                <Textarea
                  value={config.additionalPrompt}
                  onChange={(e) => set("additionalPrompt", e.target.value)}
                  placeholder="VD: cầm ly cà phê, ánh nắng nhẹ qua cửa sổ..."
                  rows={2}
                />
              </Field>
            </CardContent>
          </Card>

          {/* Generate */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Tạo ảnh để duyệt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={genAngles} disabled={busy || !hasInput} className="gap-2">
                  <Users className="h-4 w-4" /> Tạo bộ góc (5 ảnh)
                </Button>
                <Button onClick={genExpressions} disabled={busy || !hasInput} variant="outline" className="gap-2">
                  <Smile className="h-4 w-4" /> Tạo bộ biểu cảm
                </Button>
                <Button onClick={generateSingle} disabled={busy || !hasInput} variant="outline" className="gap-2">
                  <Sparkles className="h-4 w-4" /> Tạo 1 ảnh (tuỳ chỉnh)
                </Button>
              </div>
              {busy && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {progress ?? "Đang tạo ảnh..."}
                </p>
              )}
              {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            </CardContent>
          </Card>
        </div>

        {/* ─── Right: results ─── */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Kết quả ({approved.length} đã duyệt)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có ảnh. Cấu hình bên trái rồi bấm tạo.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {results.map((r) => (
                  <div
                    key={r.id}
                    className={`group relative overflow-hidden rounded-lg border-2 ${r.approved ? "border-primary" : "border-transparent"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt={r.label} className="w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{r.label}</span>
                    <button
                      onClick={() => setResults((p) => p.filter((x) => x.id !== r.id))}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setResults((p) => p.map((x) => (x.id === r.id ? { ...x, approved: !x.approved } : x)))}
                      className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1.5 text-xs font-medium ${r.approved ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"}`}
                    >
                      <Check className="h-3.5 w-3.5" /> {r.approved ? "Đã duyệt" : "Duyệt"}
                    </button>
                  </div>
                ))}
              </div>
              {results.length > 0 && (
                <Button onClick={pushToStoryboard} disabled={approved.length === 0} className="w-full gap-2">
                  Đẩy {approved.length} ảnh sang Storyboard <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
