"use client";

import { useRef, useState } from "react";
import {
  Video,
  Loader2,
  Upload,
  Copy,
  Check,
  Download,
  Film,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analyzeVideoFrames } from "@/actions";
import type { VideoAnalysisOutput } from "@/types";

// ─── Client-side frame sampling (keeps big video off the server) ────────────

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = t;
  });
}

async function sampleFrames(file: File, maxFrames = 12, maxW = 512): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Không đọc được video này."));
  });

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const count = Math.min(maxFrames, Math.max(4, Math.round(duration / 2) || 4));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const frames: string[] = [];

  for (let i = 0; i < count; i++) {
    const t = duration > 0 ? (duration * (i + 0.5)) / count : 0;
    await seek(video, t);
    const ratio = video.videoWidth ? Math.min(1, maxW / video.videoWidth) : 1;
    canvas.width = Math.round((video.videoWidth || maxW) * ratio);
    canvas.height = Math.round((video.videoHeight || (maxW * 9) / 16) * ratio);
    if (!ctx) break;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.6));
  }

  URL.revokeObjectURL(url);
  return frames;
}

export function AnalyzeClient() {
  const [fileName, setFileName] = useState("");
  const [frames, setFrames] = useState<string[]>([]);
  const [sampling, setSampling] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [productName, setProductName] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<VideoAnalysisOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFrames([]);
    setFileName(file.name);
    setSampling(true);
    try {
      const f = await sampleFrames(file);
      if (f.length < 2) throw new Error("Video quá ngắn hoặc không trích được khung hình.");
      setFrames(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi đọc video.");
    } finally {
      setSampling(false);
    }
  };

  const runAnalysis = async () => {
    if (frames.length < 2) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    const res = await analyzeVideoFrames({
      frames,
      productName: productName || undefined,
      notes: notes || undefined,
      lang: "vi",
    });
    if (res.success && res.data) setResult(res.data);
    else setError(res.error || "Phân tích thất bại.");
    setAnalyzing(false);
  };

  const allPrompts = result ? result.scenes.map((s) => s.generationPrompt).join("\n") : "";

  const copyAll = async () => {
    await navigator.clipboard.writeText(allPrompts);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const copyOne = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const downloadTxt = () => {
    const blob = new Blob([allPrompts], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompts.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Video className="h-6 w-6 text-primary" />
          Phân tích Video → Storyboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tải video mẫu lên, AI sẽ tách thành các cảnh + mô tả chuyển động, sản phẩm,
          và tạo prompt để bạn dựng lại video tương tự (nạp thẳng vào extension).
        </p>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Tải video mẫu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onPickFile}
          />
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={sampling || analyzing}
            className="gap-2"
          >
            {sampling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {sampling ? "Đang trích khung hình..." : "Chọn video"}
          </Button>
          {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}

          {frames.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Đã trích {frames.length} khung hình:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {frames.map((f, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={f}
                    alt={`frame ${i + 1}`}
                    className="h-16 w-auto shrink-0 rounded border"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Sản phẩm của bạn (tuỳ chọn)</label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="VD: chai serum dưỡng da X"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Ghi chú (tuỳ chọn)</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: tông trẻ trung, quay dọc 9:16"
              />
            </div>
          </div>

          <Button onClick={runAnalysis} disabled={frames.length < 2 || analyzing || sampling} className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {analyzing ? "Đang phân tích..." : "Phân tích storyboard"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{result.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
                {result.product && (
                  <Badge variant="secondary" className="mt-2">Sản phẩm: {result.product}</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyAll} className="gap-2">
                  {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedAll ? "Đã copy" : "Copy tất cả prompt"}
                </Button>
                <Button size="sm" onClick={downloadTxt} className="gap-2">
                  <Download className="h-4 w-4" />
                  Tải prompts.txt
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {result.scenes.length} cảnh. Tải <b>prompts.txt</b> rồi dùng chức năng{" "}
              <b>&ldquo;Ghép TXT&rdquo;</b> trong tab Storyboard của extension để chạy hàng loạt.
            </p>
            {result.scenes.map((s) => (
              <div key={s.index} className="rounded-lg border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge>Cảnh {s.index}</Badge>
                  {s.durationSec > 0 && <Badge variant="outline">~{s.durationSec}s</Badge>}
                  {s.shot && <Badge variant="outline">{s.shot}</Badge>}
                  {s.cameraMotion && <Badge variant="outline">📷 {s.cameraMotion}</Badge>}
                </div>
                {s.action && <p className="text-sm"><b>Hành động:</b> {s.action}</p>}
                {s.productNote && <p className="text-sm"><b>Sản phẩm:</b> {s.productNote}</p>}
                <div className="mt-2 rounded-md bg-muted/50 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Prompt tạo lại (EN)
                    </span>
                    <button
                      onClick={() => copyOne(s.generationPrompt, s.index)}
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      {copiedIdx === s.index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedIdx === s.index ? "Đã copy" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-xs leading-relaxed">{s.generationPrompt}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
