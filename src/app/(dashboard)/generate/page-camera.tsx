"use client";

// ============================================================
// PAGE CAMERA — photograph book pages straight into the writers' room.
// Live preview from the webcam or the phone's rear camera with a page guide;
// each shot (shutter button, Space or Enter) is handed to the room at once and
// read in the background, so the user just turns pages and presses capture.
// When the browser cannot open the camera (no permission, embedded page,
// old browser) the phone's own camera app / a file picker is offered instead.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Loader2, RefreshCw, RotateCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface PageShot {
  id: string;
  /** JPEG base64 (no data: prefix) sent to OCR; emptied once read. */
  base64: string;
  /** Small data URL for the strip. */
  thumb: string;
  status: "queued" | "reading" | "done" | "error";
  error?: string;
}

/** Longest side sent to OCR — enough for dense book text, small enough to batch. */
const PAGE_MAX_DIM = 2000;

function encode(source: CanvasImageSource, width: number, height: number, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Downscaled page + thumbnail from any image base64 (upload or camera). */
export async function makePageShot(base64: string): Promise<Pick<PageShot, "base64" | "thumb">> {
  try {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64}`;
    await img.decode();
    const page = encode(img, img.naturalWidth, img.naturalHeight, PAGE_MAX_DIM, 0.85);
    const thumb = encode(img, img.naturalWidth, img.naturalHeight, 220, 0.7);
    return { base64: page.split(",")[1] ?? base64, thumb };
  } catch {
    return { base64, thumb: `data:image/jpeg;base64,${base64}` };
  }
}

function cameraErrorText(err: unknown, vi: boolean): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return vi
      ? "Trình duyệt chưa cho phép dùng camera. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → cho phép Camera, rồi mở lại. Hoặc dùng nút \"Mở camera điện thoại / chọn ảnh\" bên dưới."
      : "Camera permission was denied. Allow the camera for this site and reopen, or use the button below.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return vi ? "Không tìm thấy camera trên thiết bị này." : "No camera found on this device.";
  }
  if (name === "NotReadableError") {
    return vi ? "Camera đang được ứng dụng khác dùng (Zoom, Meet…). Tắt ứng dụng đó rồi thử lại." : "The camera is in use by another app.";
  }
  return vi ? "Không mở được camera trên trình duyệt này." : "Could not open the camera in this browser.";
}

export function PageCamera({
  lang,
  shots,
  remaining,
  onCapture,
  onRetry,
  onRemove,
  onClose,
  onFinish,
}: {
  lang: "vi" | "en";
  shots: PageShot[];
  /** How many more pages the room accepts. */
  remaining: number;
  onCapture: (base64: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  /** Close the camera and analyse as soon as every page is read. */
  onFinish: () => void;
}) {
  const vi = lang === "vi";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(false);
  // The page guide is drawn over the visible video, not the whole stage.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setStage({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = videoSize.w && videoSize.h && stage.w && stage.h
    ? (() => {
        const scale = Math.min(stage.w / videoSize.w, stage.h / videoSize.h);
        return { w: videoSize.w * scale, h: videoSize.h * scale };
      })()
    : null;
  const onVideoSize = () => {
    const v = videoRef.current;
    if (v?.videoWidth) setVideoSize({ w: v.videoWidth, h: v.videoHeight });
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      setError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(vi ? "Trình duyệt này không hỗ trợ mở camera trực tiếp (cần trang https và trình duyệt mới)." : "This browser cannot open the camera directly.");
        return;
      }
      try {
        // Ask for a high resolution: book text needs the pixels. The rear
        // camera is preferred on phones; webcams ignore facingMode.
        const size = { width: { ideal: 2560 }, height: { ideal: 1920 } };
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: "environment" }, ...size },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (!cancelled) {
          setDevices(list);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(cameraErrorText(err, vi));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceId, vi]);

  useEffect(() => stopStream, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready || !video.videoWidth || remaining <= 0) return;
    const page = encode(video, video.videoWidth, video.videoHeight, PAGE_MAX_DIM, 0.85);
    onCapture(page.split(",")[1] ?? "");
    setFlash(true);
    window.setTimeout(() => setFlash(false), 140);
  }, [ready, remaining, onCapture]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        capture();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture, onClose]);

  useEffect(() => {
    stripRef.current?.scrollTo({ left: stripRef.current.scrollWidth, behavior: "smooth" });
  }, [shots.length]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    const current = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId;
    const at = devices.findIndex((d) => d.deviceId === current);
    setDeviceId(devices[(at + 1) % devices.length]!.deviceId);
  };

  const fromFiles = async (files: FileList | null) => {
    for (const file of Array.from(files ?? []).slice(0, Math.max(0, remaining))) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }).catch(() => "");
      const base64 = dataUrl.split(",")[1];
      if (base64) onCapture(base64);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const read = shots.filter((s) => s.status === "done").length;
  const pending = shots.filter((s) => s.status === "queued" || s.status === "reading").length;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <Camera className="h-5 w-5" />
        <p className="text-sm font-medium">{vi ? "Chụp trang sách" : "Photograph pages"}</p>
        <span className="text-xs text-white/70">
          {vi ? `đã chụp ${shots.length} · đã đọc ${read}` : `${shots.length} shot · ${read} read`}
          {pending > 0 && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {devices.length > 1 && (
            <button type="button" onClick={switchCamera} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-white/10">
              <RotateCw className="h-4 w-4" />{vi ? "Đổi camera" : "Switch"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-white/10" aria-label={vi ? "Đóng camera" : "Close camera"}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay onLoadedMetadata={onVideoSize} onResize={onVideoSize} className="h-full w-full object-contain" />
        {ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center" style={fit ? { width: fit.w, height: fit.h } : { width: "100%", height: "100%" }}>
              <div className="aspect-[3/4] h-[88%] max-w-[88%] rounded-lg border-2 border-dashed border-white/70" />
            </div>
            <p className="absolute inset-x-2 top-2 mx-auto w-fit rounded bg-black/60 px-2 py-1 text-center text-xs">
              {vi ? "Đặt trọn một trang trong khung, giữ thẳng, đủ sáng — rồi bấm chụp (hoặc phím Space)" : "Fit one page in the frame, hold it flat and well lit, then capture (or press Space)"}
            </p>
          </div>
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
            <Loader2 className="h-5 w-5 animate-spin" />{vi ? "Đang mở camera…" : "Opening camera…"}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-md text-sm text-white/90">{error}</p>
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">
              <ImagePlus className="h-4 w-4" />{vi ? "Mở camera điện thoại / chọn ảnh" : "Use phone camera / pick photos"}
            </button>
          </div>
        )}
        <div className={cn("pointer-events-none absolute inset-0 bg-white transition-opacity duration-150", flash ? "opacity-70" : "opacity-0")} />
      </div>

      {shots.length > 0 && (
        <div ref={stripRef} className="flex gap-2 overflow-x-auto px-3 pt-2">
          {shots.map((s, i) => (
            <div key={s.id} className="relative h-20 w-14 shrink-0 overflow-hidden rounded border border-white/30" title={s.error}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.thumb} alt={`${vi ? "Trang" : "Page"} ${i + 1}`} className="h-full w-full object-cover" />
              <span className={cn(
                "absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 py-0.5 text-[10px]",
                s.status === "done" ? "bg-emerald-600/90" : s.status === "error" ? "bg-red-600/90" : "bg-black/70"
              )}>
                {s.status === "done" && <Check className="h-3 w-3" />}
                {s.status === "reading" && <Loader2 className="h-3 w-3 animate-spin" />}
                {s.status === "queued" && (vi ? "chờ" : "wait")}
                {s.status === "error" && (
                  <button type="button" onClick={() => onRetry(s.id)} className="flex items-center gap-0.5">
                    <RefreshCw className="h-3 w-3" />{vi ? "đọc lại" : "retry"}
                  </button>
                )}
              </span>
              {(s.status === "queued" || s.status === "error") && (
                <button type="button" onClick={() => onRemove(s.id)} className="absolute right-0 top-0 rounded-bl bg-black/70 p-0.5" aria-label={vi ? "Bỏ ảnh" : "Remove"}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-28 items-center gap-1.5 text-xs text-white/80 hover:text-white">
          <ImagePlus className="h-5 w-5" />{vi ? "Ảnh / app camera" : "Photos / camera app"}
        </button>
        <button
          type="button"
          onClick={capture}
          disabled={!ready || remaining <= 0}
          aria-label={vi ? "Chụp trang" : "Capture page"}
          className="h-16 w-16 shrink-0 rounded-full border-4 border-white bg-white/90 transition active:scale-95 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={onFinish}
          disabled={!shots.length}
          className="flex w-28 items-center justify-end gap-1.5 text-right text-xs font-medium disabled:opacity-40"
        >
          <Sparkles className="h-5 w-5 shrink-0" />{vi ? "Xong · phân tích" : "Done · analyse"}
        </button>
      </div>
      {remaining <= 0 && (
        <p className="pb-2 text-center text-xs text-amber-300">{vi ? "Đã đủ số trang tối đa cho một lần phân tích." : "Page limit reached."}</p>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void fromFiles(e.target.files)} />
    </div>
  );
}
