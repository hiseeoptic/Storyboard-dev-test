"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  Sparkles,
  Shirt,
  User,
  Trash2,
  ArrowRight,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { generateStudioImage, type StudioAngle, type StudioMode } from "@/actions";

export const STUDIO_HANDOFF_KEY = "sb_studio_handoff";

interface StudioResult {
  id: string;
  url: string; // data URI
  label: string;
  mode: StudioMode;
  approved: boolean;
}

const ANGLES: { key: StudioAngle; label: string }[] = [
  { key: "front", label: "Chính diện" },
  { key: "three_quarter", label: "Góc 3/4" },
  { key: "side", label: "Nghiêng" },
  { key: "full_body", label: "Toàn thân" },
];

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

function dataUriToBase64(uri: string): string {
  return uri.includes(",") ? uri.split(",")[1]! : uri;
}

export function StudioClient() {
  const router = useRouter();

  const [faceImages, setFaceImages] = useState<UploadedImage[]>([]);
  const [mode, setMode] = useState<StudioMode>("portrait");

  // Portrait controls
  const [portraitScene, setPortraitScene] = useState("");

  // Fashion controls
  const [outfitImages, setOutfitImages] = useState<UploadedImage[]>([]);
  const [productImages, setProductImages] = useState<UploadedImage[]>([]);
  const [fashionScene, setFashionScene] = useState("");

  const [results, setResults] = useState<StudioResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const faceBase64 = faceImages.map((i) => i.base64);

  const run = async (label: string, build: () => Parameters<typeof generateStudioImage>[0]) => {
    if (faceImages.length === 0) {
      setError("Hãy tải lên ít nhất 1 ảnh khuôn mặt trước.");
      return;
    }
    setError(null);
    setBusy(label);
    try {
      const res = await generateStudioImage(build());
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResults((prev) => [
        { id: rid(), url: res.data.url, label, mode, approved: false },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo ảnh thất bại");
    } finally {
      setBusy(null);
    }
  };

  const genPortrait = (angle: StudioAngle, label: string) =>
    run(label, () => ({
      mode: "portrait",
      angle,
      faceImages: faceBase64,
      scene: portraitScene || undefined,
      aspectRatio: angle === "full_body" ? "9:16" : "9:16",
      quality: "standard",
    }));

  const genFashion = () =>
    run("Ảnh quảng cáo", () => ({
      mode: "fashion",
      faceImages: faceBase64,
      outfitImages: outfitImages.map((i) => i.base64),
      productImages: productImages.map((i) => i.base64),
      scene: fashionScene || undefined,
      aspectRatio: "9:16",
      quality: "standard",
    }));

  const toggleApprove = (id: string) =>
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, approved: !r.approved } : r)));

  const removeResult = (id: string) =>
    setResults((prev) => prev.filter((r) => r.id !== id));

  const approved = results.filter((r) => r.approved);

  const pushToStoryboard = () => {
    if (approved.length === 0) return;
    const handoff = {
      // Approved generated images become the locked character reference set.
      characterImages: approved.map((r) => dataUriToBase64(r.url)),
      // The uploaded outfit / accessory carries through as products to feature.
      productImages: [...outfitImages, ...productImages].map((i) => i.base64),
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" /> Image Studio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo ảnh chân dung đẹp & giống từ ảnh bạn tải lên (nhiều góc), hoặc ghép trang phục/phụ
          kiện thành ảnh quảng cáo. Duyệt ảnh ưng ý rồi đẩy sang Storyboard.
        </p>
      </div>

      {/* Upload face */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> 1. Ảnh khuôn mặt của bạn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUploader
            images={faceImages}
            onChange={setFaceImages}
            maxImages={3}
            hint="Tải 1-3 ảnh rõ nét, đủ sáng, nhiều góc khác nhau (chính diện + nghiêng) để giống nhất."
          />
        </CardContent>
      </Card>

      {/* Mode */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as StudioMode)}>
            <TabsList className="mb-4">
              <TabsTrigger value="portrait" className="gap-2">
                <User className="h-4 w-4" /> Chân dung nhân vật
              </TabsTrigger>
              <TabsTrigger value="fashion" className="gap-2">
                <Shirt className="h-4 w-4" /> Quảng cáo thời trang / phụ kiện
              </TabsTrigger>
            </TabsList>

            {/* Portrait */}
            <TabsContent value="portrait" className="space-y-4">
              <Input
                value={portraitScene}
                onChange={(e) => setPortraitScene(e.target.value)}
                placeholder="Bối cảnh / trang phục mong muốn (VD: vest xám, văn phòng cao cấp) — không bắt buộc"
              />
              <div className="flex flex-wrap gap-2">
                {ANGLES.map((a) => (
                  <Button
                    key={a.key}
                    variant="outline"
                    disabled={busy !== null || faceImages.length === 0}
                    onClick={() => genPortrait(a.key, a.label)}
                    className="gap-2"
                  >
                    {busy === a.label ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {a.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Mỗi nút tạo 1 ảnh chân dung đơn, sạch & photoreal. Bấm lại để tạo phương án khác.
              </p>
            </TabsContent>

            {/* Fashion */}
            <TabsContent value="fashion" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Trang phục / quần áo</p>
                  <ImageUploader
                    images={outfitImages}
                    onChange={setOutfitImages}
                    maxImages={2}
                    hint="Ảnh bộ đồ cần mặc lên người mẫu"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Túi xách / phụ kiện / trang sức</p>
                  <ImageUploader
                    images={productImages}
                    onChange={setProductImages}
                    maxImages={2}
                    hint="Ảnh phụ kiện cần xuất hiện trong ảnh"
                  />
                </div>
              </div>
              <Input
                value={fashionScene}
                onChange={(e) => setFashionScene(e.target.value)}
                placeholder="Bối cảnh chụp (VD: studio nền tối, phố thời trang) — không bắt buộc"
              />
              <Button
                disabled={busy !== null || faceImages.length === 0 || (outfitImages.length === 0 && productImages.length === 0)}
                onClick={genFashion}
                className="gap-2"
              >
                {busy === "Ảnh quảng cáo" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shirt className="h-4 w-4" />
                )}
                Tạo ảnh quảng cáo
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. Kết quả — chọn ảnh ưng ý ({approved.length} đã duyệt)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {results.map((r) => (
                <div
                  key={r.id}
                  className={`group relative overflow-hidden rounded-lg border-2 transition-colors ${
                    r.approved ? "border-primary" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.label} className="aspect-[9/16] w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {r.label}
                  </span>
                  <button
                    onClick={() => removeResult(r.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleApprove(r.id)}
                    className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1.5 text-xs font-medium ${
                      r.approved ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
                    }`}
                  >
                    {r.approved ? <Check className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
                    {r.approved ? "Đã duyệt" : "Duyệt"}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={pushToStoryboard} disabled={approved.length === 0} className="gap-2">
                Dùng cho Storyboard <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
