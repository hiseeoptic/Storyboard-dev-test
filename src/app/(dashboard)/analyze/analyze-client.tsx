"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { saveHandoff } from "@/lib/handoff";
import {
  Video,
  Loader2,
  Upload,
  Copy,
  Check,
  Download,
  Film,
  AlertTriangle,
  Link2,
  Scissors,
  MessageSquare,
  ImagePlus,
  Sparkles,
  Package,
  FileArchive,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analyzeVideoFrames, generateSceneKeyframe } from "@/actions";
import type { VideoAnalysisOutput, AspectRatio } from "@/types";

// Read a file and downscale to a JPEG data URL (keeps product refs small).
function fileToScaledDataUrl(file: File, maxW = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = img.width ? Math.min(1, maxW / img.width) : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio) || maxW;
      canvas.height = Math.round(img.height * ratio) || maxW;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh."));
    };
    img.src = url;
  });
}

type KfState = { status: "idle" | "loading" | "done" | "error"; image?: string; error?: string };

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

// ─── Client-side audio extraction → mono 16kHz WAV (small, for transcription) ─

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return buffer;
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Returns base64 WAV of the video's audio (mono 16kHz, capped at 120s), or null. */
async function extractAudioWav(file: File, targetRate = 16000, maxSec = 120): Promise<string | null> {
  try {
    const arrayBuf = await file.arrayBuffer();
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    await ctx.close();

    const srcLen = Math.min(decoded.length, decoded.sampleRate * maxSec);
    const chans = decoded.numberOfChannels;
    const mono = new Float32Array(srcLen);
    for (let c = 0; c < chans; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < srcLen; i++) mono[i] = (mono[i] ?? 0) + (data[i] ?? 0) / chans;
    }
    const ratio = decoded.sampleRate / targetRate;
    const outLen = Math.floor(srcLen / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) out[i] = mono[Math.floor(i * ratio)] || 0;

    return bufToBase64(encodeWav(out, targetRate));
  } catch {
    return null; // no audio track / unsupported codec → analysis continues without dialogue
  }
}

// ─── Full storyboard export (everything in one file) ────────────────────────

function buildFullText(r: VideoAnalysisOutput): string {
  const lines: string[] = [];
  lines.push(`STORYBOARD: ${r.title}`);
  if (r.summary) lines.push(`Tóm tắt: ${r.summary}`);
  if (r.product) lines.push(`Sản phẩm: ${r.product}`);
  lines.push(`Tổng số cảnh: ${r.scenes.length}`);
  lines.push("");
  for (const s of r.scenes) {
    lines.push(`========== CẢNH ${s.index} ==========`);
    lines.push(`Loại: ${s.continuity === "continuous" ? "🔗 Tiếp nối (Veo Extend)" : "✂️ Cảnh mới (Cut)"}`);
    if (s.durationSec) lines.push(`Thời lượng: ~${s.durationSec}s`);
    if (s.shot) lines.push(`Khung hình: ${s.shot}`);
    if (s.cameraMotion) lines.push(`Camera: ${s.cameraMotion}`);
    if (s.action) lines.push(`Hành động: ${s.action}`);
    if (s.productNote) lines.push(`Sản phẩm: ${s.productNote}`);
    if (s.dialogue) lines.push(`Thoại: "${s.dialogue}"${s.dialogueTone ? ` (${s.dialogueTone})` : ""}`);
    if (s.generationPrompt) lines.push(`Prompt tạo cảnh (EN): ${s.generationPrompt}`);
    if (s.extendPrompt) lines.push(`Prompt tiếp nối / Veo Extend (EN): ${s.extendPrompt}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function AnalyzeClient() {
  const [fileName, setFileName] = useState("");
  const [frames, setFrames] = useState<string[]>([]);
  const [audioB64, setAudioB64] = useState<string | null>(null);
  const [sampling, setSampling] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [productName, setProductName] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<VideoAnalysisOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ── Keyframe generation (Nano Banana + product/face photos) ──
  const [productImages, setProductImages] = useState<string[]>([]);
  const [faceImages, setFaceImages] = useState<string[]>([]);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [keyframes, setKeyframes] = useState<Record<number, KfState>>({});
  const [kfRunning, setKfRunning] = useState(false);
  const productRef = useRef<HTMLInputElement>(null);
  const faceRef = useRef<HTMLInputElement>(null);

  const onPickImages =
    (setter: React.Dispatch<React.SetStateAction<string[]>>, max: number) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      try {
        const imgs = await Promise.all(files.map((f) => fileToScaledDataUrl(f)));
        setter((prev) => [...prev, ...imgs].slice(0, max));
      } catch {
        setError("Không đọc được ảnh.");
      }
    };
  const onPickProducts = onPickImages(setProductImages, 6);
  const onPickFaces = onPickImages(setFaceImages, 3);

  const generateAllKeyframes = async () => {
    if (!result) return;
    setKfRunning(true);
    for (const s of result.scenes) {
      setKeyframes((k) => ({ ...k, [s.index]: { status: "loading" } }));
      const res = await generateSceneKeyframe({
        prompt: s.generationPrompt || s.extendPrompt,
        faceImages,
        productImages,
        productName: productName || result.product,
        aspectRatio: aspect,
      });
      setKeyframes((k) => ({
        ...k,
        [s.index]: res.success
          ? { status: "done", image: res.image }
          : { status: "error", error: res.error },
      }));
    }
    setKfRunning(false);
  };

  const regenOne = async (index: number, prompt: string) => {
    setKeyframes((k) => ({ ...k, [index]: { status: "loading" } }));
    const res = await generateSceneKeyframe({
      prompt,
      faceImages,
      productImages,
      productName: productName || result?.product,
      aspectRatio: aspect,
    });
    setKeyframes((k) => ({
      ...k,
      [index]: res.success ? { status: "done", image: res.image } : { status: "error", error: res.error },
    }));
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFrames([]);
    setAudioB64(null);
    setFileName(file.name);
    setSampling(true);
    try {
      const [f, a] = await Promise.all([sampleFrames(file), extractAudioWav(file)]);
      if (f.length < 2) throw new Error("Video quá ngắn hoặc không trích được khung hình.");
      setFrames(f);
      setAudioB64(a);
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
      audioBase64: audioB64 ?? undefined,
      audioMimeType: "audio/wav",
      productName: productName || undefined,
      notes: notes || undefined,
      lang: "vi",
    });
    if (res.success && res.data) setResult(res.data);
    else setError(res.error || "Phân tích thất bại.");
    setAnalyzing(false);
  };

  // One usable prompt per scene (Extend scenes fall back to extendPrompt so no blank lines).
  const allPrompts = result
    ? result.scenes
        .map((s) => s.generationPrompt || s.extendPrompt)
        .filter(Boolean)
        .join("\n")
    : "";
  const scriptText = result
    ? result.scenes
        .filter((s) => s.dialogue)
        .map((s) => `Cảnh ${s.index}: ${s.dialogue}`)
        .join("\n")
    : "";
  const fullText = result ? buildFullText(result) : "";

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(allPrompts);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const download = (text: string, name: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kfDoneCount = Object.values(keyframes).filter((k) => k.status === "done").length;

  // Bundle keyframes + prompts.txt + full storyboard into one ZIP for the extension.
  const downloadBundle = async () => {
    if (!result) return;
    const zip = new JSZip();
    zip.file("prompts.txt", allPrompts);
    zip.file("storyboard-day-du.txt", fullText);
    if (scriptText) zip.file("loi-thoai.txt", scriptText);
    for (const s of result.scenes) {
      const img = keyframes[s.index]?.image;
      if (img) {
        const b64 = img.split(",")[1] ?? "";
        zip.file(`keyframe-${String(s.index).padStart(2, "0")}.png`, b64, { base64: true });
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storyboard-bundle.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Hand the analysis (brief + per-scene structure + product/face images) over
  // to /generate to build a full cinematic storyboard.
  const pushToStoryboard = async () => {
    if (!result) return;
    setPushing(true);
    try {
      const sceneLines = result.scenes
        .map(
          (s) =>
            `Cảnh ${s.index} (${s.continuity === "continuous" ? "tiếp nối" : "cắt mới"}): ${s.action}` +
            (s.dialogue ? ` Thoại: "${s.dialogue}".` : "")
        )
        .join("\n");
      const storyIdea =
        `${result.summary}${result.product ? `\nSản phẩm: ${result.product}.` : ""}\n\n` +
        `Dựng lại theo cấu trúc video tham khảo (mỗi cảnh = 1 đoạn 10s):\n${sceneLines}`;

      const strip = (arr: string[]) => arr.map((b) => b.split(",")[1] ?? "").filter(Boolean);

      await saveHandoff({
        storyIdea,
        productName: productName || result.product || "",
        segmentCount: Math.min(10, Math.max(3, result.scenes.length)),
        forceDialogue: result.scenes.some((s) => s.dialogue),
        productImages: strip(productImages),
        characterImages: strip(faceImages),
      });
      router.push("/generate");
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Video className="h-6 w-6 text-primary" />
          Phân tích Video → Storyboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tải video mẫu lên — AI tách thành cảnh, mô tả chuyển động + sản phẩm,
          <b> phiên âm lời thoại</b>, và đánh dấu cảnh nào <b>liền mạch (Extend)</b> vs
          <b> cắt mới</b>. Xuất prompt để nạp vào extension.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Tải video mẫu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={onPickFile} />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={sampling || analyzing} className="gap-2">
            {sampling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {sampling ? "Đang trích khung hình + âm thanh..." : "Chọn video"}
          </Button>
          {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}

          {frames.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                Đã trích {frames.length} khung hình
                {audioB64 ? (
                  <Badge variant="secondary" className="gap-1"><MessageSquare className="h-3 w-3" /> có âm thanh</Badge>
                ) : (
                  <Badge variant="outline">không có âm thanh</Badge>
                )}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {frames.map((f, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={f} alt={`frame ${i + 1}`} className="h-16 w-auto shrink-0 rounded border" />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Sản phẩm của bạn (tuỳ chọn)</label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="VD: áo chống nắng X" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Ghi chú (tuỳ chọn)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VD: tông trẻ trung, quay dọc 9:16" />
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

      {result && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{result.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
                {result.product && <Badge variant="secondary" className="mt-2">Sản phẩm: {result.product}</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={pushToStoryboard} disabled={pushing} className="gap-2 bg-indigo-600 hover:bg-indigo-500">
                  {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Đẩy sang Storyboard
                </Button>
                <Button size="sm" variant="outline" onClick={() => download(fullText, "storyboard-day-du.txt")} className="gap-2">
                  <Download className="h-4 w-4" /> Tải storyboard đầy đủ
                </Button>
                <Button size="sm" variant="outline" onClick={() => download(allPrompts, "prompts.txt")} className="gap-2">
                  <Download className="h-4 w-4" /> prompts.txt
                </Button>
                {scriptText && (
                  <Button size="sm" variant="outline" onClick={() => download(scriptText, "script.txt")} className="gap-2">
                    <MessageSquare className="h-4 w-4" /> Lời thoại
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={copyAll} className="gap-2">
                  {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedAll ? "Đã copy" : "Copy prompt"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {result.scenes.length} cảnh. <Link2 className="inline h-3 w-3" /> = liền mạch (dùng nút{" "}
              <b>Extend</b> trong Flow, không tạo clip mới); <Scissors className="inline h-3 w-3" /> = cảnh cắt mới.
            </p>

            {/* ── Keyframe generator (Nano Banana + product photos) ── */}
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/[0.04] p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-indigo-400" />
                Tạo keyframe cho từng cảnh (có sản phẩm của bạn)
              </div>
              <p className="text-xs text-muted-foreground">
                Tải ảnh sản phẩm (bắt buộc) và <b>ảnh mặt của bạn</b> (tuỳ chọn — để bạn làm người mẫu) → bấm tạo →
                mỗi cảnh ra 1 keyframe có sản phẩm + mặt bạn. Tải ZIP rồi thả vào extension (Storyboard) chạy Omni Flash.
              </p>

              <input ref={productRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickProducts} />
              <input ref={faceRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFaces} />

              {/* Product images */}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => productRef.current?.click()} className="gap-2">
                  <Package className="h-4 w-4" /> Ảnh sản phẩm
                </Button>
                {productImages.map((p, i) => (
                  <span key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`sp ${i + 1}`} className="h-12 w-12 rounded border object-cover" />
                    <button
                      onClick={() => setProductImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive px-1 text-[10px] text-white"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              {/* Face images (optional — appear as the model) */}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => faceRef.current?.click()} className="gap-2">
                  <ImagePlus className="h-4 w-4" /> Ảnh mặt của tôi
                </Button>
                {faceImages.map((p, i) => (
                  <span key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`mặt ${i + 1}`} className="h-12 w-12 rounded-full border object-cover" />
                    <button
                      onClick={() => setFaceImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive px-1 text-[10px] text-white"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  {(["9:16", "16:9"] as AspectRatio[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setAspect(r)}
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        aspect === r ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" : "text-muted-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {faceImages.length > 0 && (
                <p className="text-[11px] text-amber-400/90">
                  ⚠️ Chỉ dùng khuôn mặt của <b>chính bạn</b> hoặc người đã <b>đồng ý</b>. Không dùng mặt người khác /
                  người nổi tiếng. Bạn nên dùng <b>keyframe do app tạo</b> (nhân vật của bạn), không dùng frame gốc của đối thủ.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={generateAllKeyframes} disabled={kfRunning} className="gap-2">
                  {kfRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {kfRunning
                    ? `Đang tạo ${kfDoneCount}/${result.scenes.length}...`
                    : kfDoneCount > 0
                    ? "Tạo lại tất cả keyframe"
                    : "Tạo keyframe cho từng cảnh"}
                </Button>
                {kfDoneCount > 0 && (
                  <Button size="sm" variant="outline" onClick={downloadBundle} className="gap-2">
                    <FileArchive className="h-4 w-4" /> Tải ZIP ({kfDoneCount} keyframe + prompt)
                  </Button>
                )}
                {productImages.length === 0 && (
                  <span className="text-[11px] text-amber-400">Mẹo: thêm ảnh sản phẩm trước để keyframe đúng sản phẩm.</span>
                )}
              </div>
            </div>

            {result.scenes.map((s) => {
              const continuous = s.continuity === "continuous";
              return (
                <div
                  key={s.index}
                  className={`rounded-lg border p-4 ${continuous ? "border-emerald-500/30 bg-emerald-500/[0.03]" : ""}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge>Cảnh {s.index}</Badge>
                    {continuous ? (
                      <Badge className="gap-1 bg-emerald-600"><Link2 className="h-3 w-3" /> Tiếp nối (Extend)</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1"><Scissors className="h-3 w-3" /> Cảnh mới</Badge>
                    )}
                    {s.durationSec > 0 && <Badge variant="outline">~{s.durationSec}s</Badge>}
                    {s.shot && <Badge variant="outline">{s.shot}</Badge>}
                    {s.cameraMotion && <Badge variant="outline">📷 {s.cameraMotion}</Badge>}
                  </div>

                  {s.action && <p className="text-sm"><b>Hành động:</b> {s.action}</p>}
                  {s.productNote && <p className="text-sm"><b>Sản phẩm:</b> {s.productNote}</p>}
                  {s.dialogue && (
                    <p className="mt-1 text-sm">
                      <b>💬 Thoại:</b> &ldquo;{s.dialogue}&rdquo;
                      {s.dialogueTone && <span className="text-muted-foreground"> ({s.dialogueTone})</span>}
                    </p>
                  )}

                  {/* Generation prompt */}
                  <PromptBox
                    label="Prompt tạo cảnh (EN)"
                    text={s.generationPrompt}
                    copied={copiedKey === `g${s.index}`}
                    onCopy={() => copyText(s.generationPrompt, `g${s.index}`)}
                  />

                  {/* Extend prompt for continuous scenes */}
                  {continuous && s.extendPrompt && (
                    <PromptBox
                      label="↳ Prompt tiếp nối — dán vào Veo Extend (EN)"
                      text={s.extendPrompt}
                      accent
                      copied={copiedKey === `e${s.index}`}
                      onCopy={() => copyText(s.extendPrompt, `e${s.index}`)}
                    />
                  )}

                  {/* Keyframe preview */}
                  {(() => {
                    const kf = keyframes[s.index];
                    if (!kf) return null;
                    if (kf.status === "loading")
                      return (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo keyframe...
                        </div>
                      );
                    if (kf.status === "error")
                      return (
                        <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                          <AlertTriangle className="h-4 w-4" /> {kf.error}
                          <button
                            onClick={() => regenOne(s.index, s.generationPrompt || s.extendPrompt)}
                            className="text-primary hover:underline"
                          >
                            Thử lại
                          </button>
                        </div>
                      );
                    if (kf.status === "done" && kf.image)
                      return (
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase text-muted-foreground">Keyframe</span>
                            <button
                              onClick={() => regenOne(s.index, s.generationPrompt || s.extendPrompt)}
                              className="text-[11px] text-primary hover:underline"
                            >
                              Tạo lại
                            </button>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={kf.image} alt={`keyframe ${s.index}`} className="max-h-64 rounded-lg border" />
                        </div>
                      );
                    return null;
                  })()}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PromptBox({
  label,
  text,
  accent,
  copied,
  onCopy,
}: {
  label: string;
  text: string;
  accent?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className={`mt-2 rounded-md p-3 ${accent ? "bg-emerald-500/10" : "bg-muted/50"}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</span>
        <button onClick={onCopy} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Đã copy" : "Copy"}
        </button>
      </div>
      <p className="font-mono text-xs leading-relaxed">{text}</p>
    </div>
  );
}
