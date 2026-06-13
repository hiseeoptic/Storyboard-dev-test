"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Sparkles, Trash2, ArrowRight, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { generateStudioImage } from "@/actions";
import { DEFAULT_CONFIG, type PhotoConfig, type SubjectType } from "@/lib/studio/types";
import {
  SPECIAL_STYLES,
  STANDARD_STYLES,
  POSE_CATEGORIES,
  FACE_ENHANCEMENT_OPTIONS,
  RATIO_OPTIONS,
  CONTEXT_CATEGORIES,
  OUTFIT_DATABASE,
  QUALITY_OPTIONS,
  EXPRESSION_OPTIONS,
  LIGHTING_OPTIONS,
  CAMERA_OPTIONS,
  ANGLE_OPTIONS,
} from "@/lib/studio/options";

export const STUDIO_HANDOFF_KEY = "sb_studio_handoff";

interface StudioResult {
  id: string;
  url: string;
  approved: boolean;
}

const SUBJECTS: { value: SubjectType; label: string }[] = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "COUPLE", label: "Cặp đôi" },
  { value: "GROUP", label: "Nhóm" },
  { value: "PRODUCT", label: "Sản phẩm" },
];

function rid() {
  return Math.random().toString(36).slice(2, 10);
}
function dataUriToBase64(uri: string): string {
  return uri.includes(",") ? uri.split(",")[1]! : uri;
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
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof PhotoConfig>(key: K, value: PhotoConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const toggleEnh = (id: string) => {
    const cur = config.faceEnhancements || [];
    set("faceEnhancements", cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  // Outfit DB is keyed by gender; default to MALE/FEMALE based on subject.
  const outfitGender = config.subjectType === "FEMALE" || config.subjectType === "COUPLE" ? "FEMALE" : "MALE";
  const outfitCats = OUTFIT_DATABASE[outfitGender] ?? OUTFIT_DATABASE.MALE ?? [];
  const currentContextCat = CONTEXT_CATEGORIES.find((c) => c.id === config.contextCategory);
  const styleList = config.photographyStyleCategory === "special" ? SPECIAL_STYLES : STANDARD_STYLES;

  const [poseTab, setPoseTab] = useState(POSE_CATEGORIES[0]?.id ?? "");
  const currentPoseCat = POSE_CATEGORIES.find((p) => p.id === poseTab);
  const [outfitCatId, setOutfitCatId] = useState(outfitCats[0]?.id ?? "");
  const currentOutfitCat = outfitCats.find((o) => o.id === outfitCatId) ?? outfitCats[0];

  const approved = useMemo(() => results.filter((r) => r.approved), [results]);

  const generate = async () => {
    if (config.source === "UPLOAD" && faceImages.length === 0 && productImages.length === 0) {
      setError("Hãy tải lên ảnh khuôn mặt (hoặc sản phẩm) trước.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await generateStudioImage({
        config: { ...config, outfitImage: outfitImage[0]?.base64 ?? null },
        faces: faceImages.map((i) => i.base64),
        products: productImages.map((i) => i.base64),
        logo: logoImage[0]?.base64 ?? null,
        outfitImage: outfitImage[0]?.base64 ?? null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResults((prev) => [{ id: rid(), url: res.data.url, approved: false }, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo ảnh thất bại");
    } finally {
      setBusy(false);
    }
  };

  const pushToStoryboard = () => {
    if (approved.length === 0) return;
    const handoff = {
      characterImages: approved.map((r) => dataUriToBase64(r.url)),
      productImages: [...productImages, ...outfitImage].map((i) => i.base64),
    };
    try {
      window.sessionStorage.setItem(STUDIO_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      setError("Ảnh quá lớn để chuyển sang Storyboard. Hãy duyệt ít ảnh hơn.");
      return;
    }
    router.push("/generate");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wand2 className="h-6 w-6 text-primary" /> Image Studio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo ảnh người thật đẹp & giống từ ảnh bạn tải lên — đầy đủ làm đẹp mặt, biểu cảm, trang
          phục, ánh sáng, ống kính. Duyệt ảnh ưng ý rồi đẩy sang Storyboard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ─── Left: controls ─── */}
        <div className="space-y-6">
          {/* Uploads */}
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
              <Field label="Trang phục cần mặc (tuỳ chọn)">
                <ImageUploader images={outfitImage} onChange={setOutfitImage} maxImages={1} />
              </Field>
              <Field label="Logo (tuỳ chọn)">
                <ImageUploader images={logoImage} onChange={setLogoImage} maxImages={1} />
              </Field>
            </CardContent>
          </Card>

          {/* Face beautify + expression + quality */}
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
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Biểu cảm (nét mặt)">
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

          {/* Subject + style */}
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
            </CardContent>
          </Card>

          {/* Outfit + pose + context */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Trang phục, dáng & bối cảnh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nhóm trang phục">
                  <select
                    className={selectCls}
                    value={outfitCatId}
                    onChange={(e) => {
                      setOutfitCatId(e.target.value);
                      const cat = outfitCats.find((o) => o.id === e.target.value);
                      const first = cat?.options[0];
                      if (first) set("outfitDetail", first.value);
                    }}
                  >
                    {outfitCats.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Trang phục cụ thể">
                  <select className={selectCls} value={config.outfitDetail} onChange={(e) => set("outfitDetail", e.target.value)}>
                    {(currentOutfitCat?.options ?? []).map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Dáng / tư thế">
                <div className="mb-2 flex flex-wrap gap-1">
                  {POSE_CATEGORIES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPoseTab(p.id)}
                      className={`rounded px-2 py-1 text-xs ${poseTab === p.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <select className={selectCls} value={config.pose} onChange={(e) => set("pose", e.target.value)}>
                  {(currentPoseCat?.options ?? []).map((o) => (
                    <option key={o.id} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nhóm bối cảnh">
                  <select
                    className={selectCls}
                    value={config.contextCategory}
                    onChange={(e) => {
                      set("contextCategory", e.target.value);
                      const cat = CONTEXT_CATEGORIES.find((c) => c.id === e.target.value);
                      const first = cat?.options[0];
                      if (first) set("contextDetail", first.value);
                    }}
                  >
                    {CONTEXT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Bối cảnh cụ thể">
                  <select className={selectCls} value={config.contextDetail} onChange={(e) => set("contextDetail", e.target.value)}>
                    {(currentContextCat?.options ?? []).map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Lighting + camera */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">5. Ánh sáng & máy ảnh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Ánh sáng">
                  <select className={selectCls} value={config.lighting} onChange={(e) => set("lighting", e.target.value)}>
                    {LIGHTING_OPTIONS.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Ống kính">
                  <select className={selectCls} value={config.camera} onChange={(e) => set("camera", e.target.value)}>
                    {CAMERA_OPTIONS.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Góc máy">
                  <select className={selectCls} value={config.cameraAngle} onChange={(e) => set("cameraAngle", e.target.value)}>
                    {ANGLE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
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

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          <Button onClick={generate} disabled={busy} size="lg" className="w-full gap-2">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            Tạo ảnh
          </Button>
        </div>

        {/* ─── Right: results ─── */}
        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Kết quả ({approved.length} đã duyệt)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có ảnh. Cấu hình bên trái rồi bấm “Tạo ảnh”.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {results.map((r) => (
                  <div
                    key={r.id}
                    className={`group relative overflow-hidden rounded-lg border-2 ${r.approved ? "border-primary" : "border-transparent"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt="result" className="w-full object-cover" />
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
                  Dùng cho Storyboard <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
