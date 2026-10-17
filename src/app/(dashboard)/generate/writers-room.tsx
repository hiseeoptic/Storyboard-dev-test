"use client";

// ============================================================
// PHÒNG BIÊN KỊCH — interactive writers' room.
// Left: source (book page photos → OCR, or a typed idea) and the chat, where
// the AI answers with cards (analysis, plan options, evaluation) and one-click
// replies. Right: the live shot table — one row per 10-second Omni Flash clip,
// each with its speech-load badge — plus versions, re-evaluation and
// "Đưa vào tạo storyboard".
// The room is kept in this browser (localStorage) so a refresh loses nothing.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Camera, Check, Loader2, RefreshCw, RotateCcw, Send, Sparkles, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { cn } from "@/lib/utils/cn";
import type { AIProvider } from "@/types";
import { writersRoomOcr, writersRoomTurn } from "@/actions/writers-room";
import { emptyRoom, type Faithfulness, type RoomAction, type RoomState, type ScriptShot } from "@/lib/writers-room/types";
import { shotCapacity } from "@/lib/writers-room/shot-rules";
import { roomToFormPatch, type RoomFormPatch } from "@/lib/writers-room/export";
import { PageCamera, makePageShot, type PageShot } from "./page-camera";

type Lang = "vi" | "en";
const STORAGE_KEY = "afWritersRoom.v1";
const OCR_BATCH = 4;
const OCR_BATCH_CHARS = 3_200_000;
const MAX_PAGES = 20;

const FAITHFULNESS: Array<{ value: Faithfulness; vi: string; en: string }> = [
  { value: "faithful", vi: "Trung thành với sách", en: "Faithful" },
  { value: "condensed", vi: "Tóm lược cho video ngắn", en: "Condensed" },
  { value: "reimagined", vi: "Sáng tạo lại", en: "Reimagined" },
];

const QUICK_REPLIES: Array<{ vi: string; instruction: string }> = [
  { vi: "Ngắn gọn hơn", instruction: "Make every shot tighter: fewer spoken words, sharper actions, same story." },
  { vi: "Thêm thoại", instruction: "Give the characters more natural dialogue where the shot budget allows, keep ≤ 20 words per shot." },
  { vi: "Kịch tính hơn", instruction: "Raise the dramatic tension and stakes; stronger hook in shot 1 and a clearer turning point." },
  { vi: "Bám sách hơn", instruction: "Stay closer to the book: original events, order and key lines." },
  { vi: "Đổi kết", instruction: "Write a more surprising but satisfying ending in the last two shots." },
  { vi: "Chia thành nhiều tập", instruction: "Split the material into episodes and rewrite this script as episode 1 with a cliffhanger." },
];

const SCORE_LABEL: Record<string, string> = {
  hook: "Hook 3 giây",
  story: "Mạch truyện",
  dialogue: "Lời thoại",
  natural_speech: "Thoại tự nhiên",
  continuity: "Liền mạch & vật lý",
  action_fit: "Hành động/10s",
  character: "Nhân vật",
  faithfulness: "Bám nguồn",
  shot_fit_10s: "Khớp clip 10s",
};

function loadRoom(): RoomState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RoomState;
      if (parsed && parsed.version === 1) return parsed;
    }
  } catch {
    /* private mode / quota — start fresh */
  }
  return emptyRoom();
}

function LoadBadge({ shot }: { shot: ScriptShot }) {
  const cap = shotCapacity(shot);
  const total = cap.dialogueWords + cap.voWords;
  return (
    <span
      title={`~${cap.speechSeconds}s lời nói / clip ${shot.duration_s}s · thoải mái ≤ ${cap.comfortableWords} chữ`}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        cap.load === "ok" && "bg-emerald-500/15 text-emerald-700",
        cap.load === "tight" && "bg-amber-500/15 text-amber-700",
        cap.load === "over" && "bg-red-500/15 text-red-700"
      )}
    >
      {total} chữ · {cap.speechSeconds}s
    </span>
  );
}

export function WritersRoom({
  lang,
  provider,
  onApply,
  onClose,
  seedIdea,
}: {
  lang: Lang;
  provider: AIProvider;
  onApply: (patch: RoomFormPatch) => void;
  onClose: () => void;
  /** Start a fresh room with this idea (e.g. from the "Bé cưng viral" card). */
  seedIdea?: string;
}) {
  const vi = lang === "vi";
  const [room, setRoom] = useState<RoomState>(() =>
    seedIdea?.trim() ? { ...emptyRoom(), idea: seedIdea.trim() } : typeof window === "undefined" ? emptyRoom() : loadRoom()
  );
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [pageImages, setPageImages] = useState<UploadedImage[]>([]);
  const [showPages, setShowPages] = useState(false);
  // The source panel folds away once there is an analysis so the chat gets the room.
  const [showSource, setShowSource] = useState(() => !room.analysis);
  // Page photos (camera or upload) waiting to be read, in page order.
  const [shots, setShots] = useState<PageShot[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [analyzeWhenRead, setAnalyzeWhenRead] = useState(false);
  const roomRef = useRef(room);
  const reading = useRef(false);
  const chatEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    roomRef.current = room;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(room)); } catch { /* quota */ }
  }, [room]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [room.messages.length, busy]);

  const issuesByShot = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const issue of room.evaluation?.issues ?? []) {
      if (!issue.shot) continue;
      map.set(issue.shot, [...(map.get(issue.shot) ?? []), issue.message]);
    }
    return map;
  }, [room.evaluation]);

  const run = async (action: RoomAction, label: string) => {
    setBusy(label);
    setError("");
    try {
      const res = await writersRoomTurn({ state: room, action, provider });
      if (res.success) {
        setRoom(res.data.state);
        if (action.type === "analyze" && res.data.state.analysis) setShowSource(false);
      } else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  const pendingShots = shots.filter((x) => x.status === "queued" || x.status === "reading").length;
  const pagesLeft = Math.max(0, MAX_PAGES - room.pages.length - pendingShots);

  /** Camera shots and uploads join one queue that is read in the background. */
  const addShots = async (images: string[]) => {
    for (const base64 of images.slice(0, pagesLeft)) {
      const shot = await makePageShot(base64);
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      setShots((list) => [...list, { id, ...shot, status: "queued" }]);
    }
  };

  // Read queued pages one batch at a time (≤ OCR_BATCH photos and under the
  // ~4.5 MB hosting request limit), in capture order.
  useEffect(() => {
    if (reading.current) return;
    const batch: PageShot[] = [];
    let size = 0;
    for (const shot of shots) {
      if (shot.status !== "queued") continue;
      if (batch.length >= OCR_BATCH || (batch.length && size + shot.base64.length > OCR_BATCH_CHARS)) break;
      batch.push(shot);
      size += shot.base64.length;
    }
    if (!batch.length) return;
    reading.current = true;
    const ids = new Set(batch.map((x) => x.id));
    const mark = (patch: Partial<PageShot>) => setShots((list) => list.map((x) => (ids.has(x.id) ? { ...x, ...patch } : x)));
    mark({ status: "reading", error: undefined });
    void (async () => {
      let outcome: Partial<PageShot>;
      try {
        const firstPage = roomRef.current.pages.reduce((m, pg) => Math.max(m, pg.index), 0) + 1;
        const res = await writersRoomOcr({ images: batch.map((x) => x.base64), firstPage });
        if (res.success) {
          // Number pages here so they always follow the ones already read.
          setRoom((r) => {
            const base = r.pages.reduce((m, pg) => Math.max(m, pg.index), 0) + 1;
            return { ...r, pages: [...r.pages, ...res.data.pages.map((pg, i) => ({ ...pg, index: base + i }))] };
          });
          outcome = { status: "done", base64: "" };
        } else {
          outcome = { status: "error", error: res.error };
        }
      } catch (err) {
        outcome = { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
      reading.current = false;
      mark(outcome);
    })();
  }, [shots]);

  const readUploads = async () => {
    if (!pageImages.length) return;
    setError("");
    const images = pageImages.map((img) => img.base64);
    setPageImages([]);
    await addShots(images);
  };

  useEffect(() => {
    if (!analyzeWhenRead || pendingShots > 0 || busy) return;
    setAnalyzeWhenRead(false);
    if (room.pages.length) void run({ type: "analyze" }, vi ? "Đang phân tích và lập kế hoạch…" : "Analysing…");
    // run() reads the latest room; this fires once when the queue drains.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzeWhenRead, pendingShots, busy]);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (!room.analysis && !room.script) {
      // Before the first analysis a message is a brief for the writer, not a turn.
      setRoom((r) => ({
        ...r,
        idea: [r.idea, text].filter(Boolean).join("\n"),
        messages: [...r.messages, { role: "user", text, kind: "text", at: Date.now() }],
      }));
      return;
    }
    void run({ type: "chat", message: text }, vi ? "Biên kịch đang trả lời…" : "Writing…");
  };

  const undo = () => {
    setRoom((r) => {
      const prev = r.history[r.history.length - 1];
      if (!prev) return r;
      return { ...r, script: prev, history: r.history.slice(0, -1), evaluation: undefined, messages: [...r.messages, { role: "assistant", text: "Đã quay về phiên bản kịch bản trước.", kind: "text", at: Date.now() }] };
    });
  };

  const apply = () => {
    const patch = roomToFormPatch(room);
    if (patch) onApply(patch);
  };

  const reset = () => {
    if (!window.confirm(vi ? "Xoá toàn bộ phòng biên kịch hiện tại?" : "Clear this writers' room?")) return;
    setRoom(emptyRoom(room.faithfulness));
    setPageImages([]);
    setShots([]);
  };

  const evaluation = room.evaluation;
  const script = room.script;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-2 sm:p-4">
      {cameraOpen && (
        <PageCamera
          lang={lang}
          shots={shots}
          remaining={pagesLeft}
          onCapture={(base64) => void addShots([base64])}
          onRetry={(id) => setShots((l) => l.map((x) => (x.id === id ? { ...x, status: "queued" } : x)))}
          onRemove={(id) => setShots((l) => l.filter((x) => x.id !== id))}
          onClose={() => setCameraOpen(false)}
          onFinish={() => {
            setCameraOpen(false);
            setShowSource(true);
            setAnalyzeWhenRead(true);
          }}
        />
      )}
      <div className="flex w-full max-w-7xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <p className="font-semibold">{vi ? "Phòng biên kịch" : "Writers' room"}</p>
          <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">AI: {provider}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="w-56">
              <Select
                value={room.faithfulness}
                onChange={(e) => setRoom((r) => ({ ...r, faithfulness: e.target.value as Faithfulness }))}
                options={FAITHFULNESS.map((f) => ({ value: f.value, label: vi ? f.vi : f.en }))}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={reset} disabled={!!busy}><RotateCcw className="h-4 w-4" />{vi ? "Làm mới" : "Reset"}</Button>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:overflow-hidden">
          {/* LEFT — source + chat */}
          <div className="flex flex-col border-b lg:min-h-0 lg:border-b-0 lg:border-r">
            {!showSource ? (
              <button type="button" onClick={() => setShowSource(true)}
                className="flex items-center gap-2 border-b px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50">
                <BookOpen className="h-4 w-4" />
                {room.pages.length
                  ? (vi ? `Nguồn: ${room.pages.length} trang sách` : `Source: ${room.pages.length} pages`)
                  : (vi ? "Nguồn: ý tưởng đã nhập" : "Source: typed idea")}
                <span className="ml-auto underline">{vi ? "Thêm trang / sửa nguồn" : "Edit source"}</span>
              </button>
            ) : (
            <div className="space-y-2 border-b p-3">
              <ImageUploader
                images={pageImages}
                onChange={setPageImages}
                maxImages={Math.max(1, pagesLeft)}
                label={vi ? `Ảnh trang sách (đã đọc ${room.pages.length}/${MAX_PAGES} trang)` : `Book page photos (${room.pages.length}/${MAX_PAGES} read)`}
                hint={vi ? "Tải ảnh lên, hoặc bấm \"Chụp bằng camera\" để chụp trực tiếp bằng webcam / camera điện thoại. Mỗi ảnh một trang, đúng thứ tự." : "Upload photos, or use the camera. One page per photo, in order."}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setCameraOpen(true)} disabled={pagesLeft <= 0}>
                  <Camera className="h-4 w-4" />{vi ? "Chụp bằng camera" : "Use camera"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void readUploads()} disabled={!pageImages.length}>
                  <BookOpen className="h-4 w-4" />{vi ? "Đọc trang sách" : "Read pages"}
                </Button>
                {room.pages.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setShowPages((v) => !v)}>
                    {showPages ? (vi ? "Ẩn chữ đã đọc" : "Hide text") : (vi ? `Xem/sửa chữ ${room.pages.length} trang` : "Review text")}
                  </Button>
                )}
                <Button size="sm" onClick={() => run({ type: "analyze" }, vi ? "Đang phân tích và lập kế hoạch…" : "Analysing…")} disabled={!!busy || pendingShots > 0 || (!room.pages.length && !room.idea?.trim())}>
                  {pendingShots > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {pendingShots > 0
                    ? (vi ? `Đang đọc ${pendingShots} trang…` : `Reading ${pendingShots}…`)
                    : room.analysis ? (vi ? "Phân tích lại" : "Re-analyse") : (vi ? "Phân tích & đề xuất" : "Analyse & plan")}
                </Button>
              </div>
              {shots.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {shots.map((x, i) => (
                      <div key={x.id} className="relative h-16 w-12 shrink-0 overflow-hidden rounded border" title={x.error}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={x.thumb} alt={`${vi ? "Ảnh" : "Photo"} ${i + 1}`} className="h-full w-full object-cover" />
                        <span className={cn(
                          "absolute inset-x-0 bottom-0 flex justify-center py-0.5 text-[9px] text-white",
                          x.status === "done" ? "bg-emerald-600/90" : x.status === "error" ? "bg-red-600/90" : "bg-black/60"
                        )}>
                          {x.status === "done" && <Check className="h-3 w-3" />}
                          {x.status === "reading" && <Loader2 className="h-3 w-3 animate-spin" />}
                          {x.status === "queued" && (vi ? "chờ" : "wait")}
                          {x.status === "error" && (
                            <button type="button" onClick={() => setShots((l) => l.map((y) => (y.id === x.id ? { ...y, status: "queued" } : y)))}>
                              <RefreshCw className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {shots.some((x) => x.status === "error") && (
                    <p className="text-xs text-red-600">{vi ? "Có ảnh chưa đọc được — bấm ↻ trên ảnh để đọc lại, hoặc chụp lại rõ hơn." : "Some photos failed — tap ↻ to retry."}</p>
                  )}
                  {shots.every((x) => x.status === "done") && (
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShots([])}>
                      {vi ? "Ẩn ảnh đã đọc" : "Hide read photos"}
                    </button>
                  )}
                </div>
              )}
              {showPages && (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {room.pages.map((p) => (
                    <div key={p.index} className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">{vi ? "Trang" : "Page"} {p.index}</span>
                      <Textarea
                        rows={4}
                        value={p.text}
                        onChange={(e) => setRoom((r) => ({ ...r, pages: r.pages.map((x) => (x.index === p.index ? { ...x, text: e.target.value } : x)) }))}
                      />
                    </div>
                  ))}
                </div>
              )}
              {!room.pages.length && (
                <Textarea
                  rows={2}
                  value={room.idea ?? ""}
                  onChange={(e) => setRoom((r) => ({ ...r, idea: e.target.value }))}
                  placeholder={vi ? "…hoặc dán đoạn truyện / ý tưởng / tóm tắt chương sách" : "…or paste a passage / idea"}
                />
              )}
              {room.analysis && (
                <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowSource(false)}>
                  {vi ? "Thu gọn nguồn" : "Collapse source"}
                </button>
              )}
            </div>
            )}

            <div className="space-y-3 p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {room.messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {vi
                    ? "Bắt đầu: bấm Chụp bằng camera (webcam / camera điện thoại) — mỗi trang chụp xong được tự đọc và đưa vào phòng; hoặc tải ảnh lên rồi bấm Đọc trang sách, hoặc dán ý tưởng → Phân tích & đề xuất. Biên kịch sẽ đưa phương án, viết kịch bản theo từng shot 10 giây, tự chấm điểm và gợi ý sửa. Bạn trò chuyện để chỉnh bất cứ điều gì."
                    : "Start: photograph pages (or paste an idea) → Read pages → Analyse & plan."}
                </p>
              )}
              {room.messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[92%] rounded-lg px-3 py-2 text-sm",
                    m.role === "user" ? "bg-primary text-primary-foreground" : m.kind === "error" ? "bg-red-500/10 text-red-700" : "bg-muted"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}

              {room.analysis && (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p className="font-medium">{vi ? "Phân tích" : "Analysis"}{room.analysis.title_guess ? ` — ${room.analysis.title_guess}` : ""}</p>
                  <p className="text-muted-foreground">{room.analysis.summary}</p>
                  {room.analysis.message && <p><span className="font-medium">{vi ? "Thông điệp: " : "Message: "}</span>{room.analysis.message}</p>}
                  {room.analysis.characters.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {room.analysis.characters.map((c) => (
                        <span key={c.name} title={[c.appearance, c.personality, c.wardrobe].filter(Boolean).join(" · ")} className="rounded bg-muted px-2 py-0.5 text-xs">
                          {c.name}{c.role ? ` · ${c.role}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {room.options && room.options.length > 0 && (
                <div className="grid gap-2">
                  {room.options.map((o) => (
                    <div key={o.id} className={cn("space-y-1 rounded-lg border p-3 text-sm", room.chosenOptionId === o.id && "border-primary bg-primary/5")}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{o.id}. {o.title}</p>
                        <Button size="sm" variant={room.chosenOptionId === o.id ? "default" : "outline"} disabled={!!busy}
                          onClick={() => run({ type: "choose", optionId: o.id }, vi ? "Đang viết kịch bản theo shot 10s…" : "Writing the script…")}>
                          {room.chosenOptionId === o.id ? <Check className="h-4 w-4" /> : null}{vi ? (room.chosenOptionId === o.id ? "Viết lại" : "Chọn") : "Choose"}
                        </Button>
                      </div>
                      <p className="text-muted-foreground">{o.logline}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.shot_count} shot × 10s ≈ {o.shot_count * 10}s{o.episodes > 1 ? ` · ${o.episodes} ${vi ? "tập" : "episodes"}` : ""} · {o.format}
                        {o.visual_style ? ` · ${o.visual_style}` : ""}{o.voice_over ? (vi ? " · lời dẫn" : " · VO") : ""}{o.dialogue ? (vi ? " · thoại" : " · dialogue") : ""}
                      </p>
                      {o.why && <p className="text-xs italic text-muted-foreground">{o.why}</p>}
                    </div>
                  ))}
                </div>
              )}

              {evaluation && (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p className="font-medium">{vi ? "Đánh giá kịch bản" : "Evaluation"} — {evaluation.overall}/10</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {Object.entries(evaluation.scores).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="w-28 shrink-0 text-muted-foreground">{SCORE_LABEL[k] ?? k}</span>
                        <div className="h-1.5 flex-1 rounded bg-muted"><div className={cn("h-1.5 rounded", v >= 8 ? "bg-emerald-500" : v >= 6 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${v * 10}%` }} /></div>
                        <span className="w-6 text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                  {evaluation.issues.length > 0 && (
                    <ul className="space-y-1">
                      {evaluation.issues.slice(0, 12).map((issue, i) => (
                        <li key={i} className="flex items-start justify-between gap-2 text-xs">
                          <span className={cn(issue.severity === "error" ? "text-red-600" : issue.severity === "warning" ? "text-amber-700" : "text-muted-foreground")}>
                            {issue.severity === "error" ? "⛔" : issue.severity === "warning" ? "⚠️" : "ℹ️"} {issue.message}
                          </span>
                          {issue.fix && (
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={!!busy}
                              onClick={() => run({ type: "revise", instruction: issue.fix! }, vi ? "Đang sửa…" : "Fixing…")}>
                              {vi ? "Sửa" : "Fix"}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {evaluation.issues.some((i) => i.fix) && (
                    <Button size="sm" variant="outline" disabled={!!busy}
                      onClick={() => run({ type: "revise", instruction: `Fix all of these problems at once:\n${evaluation.issues.filter((i) => i.fix).map((i) => `- ${i.fix}`).join("\n")}` }, vi ? "Đang sửa tất cả…" : "Fixing all…")}>
                      {vi ? "Sửa tất cả lỗi" : "Fix all"}
                    </Button>
                  )}
                </div>
              )}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{busy}</div>
              )}
              <div ref={chatEnd} />
            </div>

            {script && (
              <div className="flex flex-wrap gap-1 border-t px-3 pt-2">
                {[...(evaluation?.options ?? []).map((o) => ({ vi: o.label, instruction: o.instruction })), ...QUICK_REPLIES].slice(0, 9).map((q) => (
                  <button key={q.vi} type="button" disabled={!!busy}
                    onClick={() => run({ type: "revise", instruction: q.instruction }, vi ? `Đang sửa: ${q.vi}…` : "Revising…")}
                    className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50">
                    {q.vi}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="px-3 pt-2 text-xs text-red-600">{error}</p>}
            <div className="flex items-end gap-2 p-3">
              <Textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={room.script
                  ? (vi ? "Yêu cầu chỉnh sửa hoặc hỏi biên kịch… (vd: cho Lan nói nhiều hơn ở shot 3)" : "Ask for a change…")
                  : (vi ? "Ghi chú thêm cho biên kịch (đối tượng khán giả, giọng kể…)" : "Notes for the writer…")}
              />
              <Button onClick={send} disabled={!input.trim() || !!busy}><Send className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* RIGHT — live shot table */}
          <div className="flex flex-col lg:min-h-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <p className="text-sm font-medium">
                {script ? `${script.title} — ${script.shots.length} shot × 10s ≈ ${script.shots.length * 10}s` : (vi ? "Kịch bản theo shot 10 giây" : "10-second shot script")}
              </p>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={undo} disabled={!room.history.length || !!busy}><Undo2 className="h-4 w-4" />{vi ? `Hoàn tác (${room.history.length})` : "Undo"}</Button>
                <Button size="sm" variant="outline" disabled={!script || !!busy} onClick={() => run({ type: "evaluate" }, vi ? "Đang chấm điểm…" : "Evaluating…")}>{vi ? "Chấm điểm lại" : "Re-evaluate"}</Button>
                <Button size="sm" disabled={!script || !!busy} onClick={apply}>{vi ? "Đưa vào tạo storyboard" : "Use for storyboard"}</Button>
              </div>
            </div>
            <div className="p-3 lg:min-h-0 lg:flex-1 lg:overflow-auto">
              {!script ? (
                <p className="text-sm text-muted-foreground">
                  {vi
                    ? "Kịch bản sẽ hiện ở đây: mỗi dòng là một clip 10 giây với 1 hành động liên tục, lời thoại có mốc giây và nhãn mức tải lời nói (xanh = vừa, vàng = dày, đỏ = quá clip)."
                    : "The script appears here, one row per 10-second clip."}
                </p>
              ) : (
                <div className="space-y-2">
                  {script.characters.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-xs">
                      {script.characters.map((c) => (
                        <span key={c.name} className="rounded bg-muted px-2 py-0.5" title={[c.appearance, c.wardrobe, c.personality].filter(Boolean).join(" · ")}>{c.name}</span>
                      ))}
                    </div>
                  )}
                  {script.shots.map((s) => (
                    <div key={s.n} className={cn("space-y-1 rounded-lg border p-2.5 text-sm", issuesByShot.has(s.n) && "border-amber-500/50")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">Shot {s.n}</span>
                        <span className="text-xs text-muted-foreground">{s.location}{s.characters.length ? ` · ${s.characters.join(", ")}` : ""}</span>
                        <span className="ml-auto"><LoadBadge shot={s} /></span>
                      </div>
                      {s.start && <p className="text-xs text-muted-foreground">{vi ? "Mở cảnh: " : "Opens: "}{s.start}</p>}
                      <p><span className="text-xs text-muted-foreground">{vi ? "Hành động: " : "Action: "}</span>{s.action}</p>
                      {s.camera && <p className="text-xs text-muted-foreground">🎥 {s.camera}</p>}
                      {[...s.dialogue, ...(s.voice_over ? [s.voice_over] : [])].map((l, j) => (
                        <p key={j} className="text-sm">
                          <span className="font-medium">{l.speaker || "Lời dẫn"}:</span> “{l.text}”
                          {typeof l.start_s === "number" && typeof l.end_s === "number" && <span className="text-xs text-muted-foreground"> ({l.start_s}–{l.end_s}s)</span>}
                        </p>
                      ))}
                      {issuesByShot.get(s.n)?.map((msg, j) => <p key={j} className="text-xs text-amber-700">⚠️ {msg}</p>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
