"use client";

// ============================================================
// 🧒 BÉ CƯNG VIRAL — one card to build a viral cute-kid family reel: type the
// situation, pick the kid (age, gender, optional photo) and the family, then
// build the video in one click, open the writers' room with it, or ask for 10
// episode ideas for the same kid.
// ============================================================
import { useEffect, useState } from "react";
import { Lightbulb, Loader2, PenLine, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { cn } from "@/lib/utils";
import { suggestCuteKidsEpisodes } from "@/actions";
import type { AIProvider } from "@/types";
import {
  AGE_LABEL,
  DEFAULT_CUTE_KIDS,
  KID_TRAITS,
  VIRAL_FORMATS,
  normalizeCuteKids,
  type CuteKidsConfig,
  type EpisodeIdea,
  type FamilyMember,
  type KidAge,
  type KidTrait,
} from "@/lib/kids/cute-kids";

type Lang = "vi" | "en";

const STORAGE_KEY = "storyboard.cuteKids.v1";

const FAMILY_CHIPS: Array<{ id: FamilyMember; vi: (south: boolean) => string; en: string }> = [
  { id: "dad", vi: (south) => (south ? "👨 Ba" : "👨 Bố"), en: "👨 Dad" },
  { id: "mom", vi: () => "👩 Mẹ", en: "👩 Mom" },
  { id: "grandpa", vi: () => "👴 Ông", en: "👴 Grandpa" },
  { id: "grandma", vi: () => "👵 Bà", en: "👵 Grandma" },
  { id: "baby", vi: () => "👶 Em bé", en: "👶 Baby" },
  { id: "dog", vi: () => "🐶 Cún", en: "🐶 Dog" },
  { id: "cat", vi: () => "🐱 Mèo", en: "🐱 Cat" },
];

const FORMAT_EXAMPLE: Record<string, string> = {
  jealous: "Bố ôm mẹ trong bếp, bé thấy liền chen vào giữa, đòi bố bế mình trước",
  bargain: "Bé xin mẹ thêm một cái kẹo trước khi ngủ, mặc cả như người lớn",
  dozing: "Bé vừa ăn cơm vừa ngủ gật, đầu gục dần xuống bát rồi giật mình bảo con không buồn ngủ",
  fake_sleep: "Bé giả vờ ngủ, mẹ vừa ra khỏi phòng là ngồi dậy lấy điện thoại, mẹ quay lại bắt quả tang",
  imitate: "Bé bắt chước bố nghe điện thoại họp online, nói y hệt giọng bố",
  helping_mess: "Bé đòi giúp mẹ lau nhà, kết quả cả phòng khách toàn bọt xà phòng",
  new_sibling: "Cả nhà chỉ lo cho em bé mới sinh, bé lớn giận dỗi rồi được em nắm tay",
  why: "Bé hỏi bố 'tại sao' liên tục cho đến khi bố hết câu trả lời",
  outfit_pick: "Bé tự chọn đồ đi học: váy công chúa, ủng mưa và mũ bảo hiểm",
  misunderstanding: "Mẹ bảo 'mẹ đang dở tay', bé chạy đi tìm xem tay mẹ dở chỗ nào",
};

function loadConfig(): CuteKidsConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeCuteKids(JSON.parse(raw)) ?? DEFAULT_CUTE_KIDS;
  } catch {
    /* private mode — defaults */
  }
  return DEFAULT_CUTE_KIDS;
}

function Chip(props: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      aria-pressed={props.active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        props.active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:border-primary/60 hover:bg-primary/5"
      )}
    >
      {props.children}
    </button>
  );
}

export function CuteKidsCard(props: {
  lang: Lang;
  provider: AIProvider;
  onBuild: (config: CuteKidsConfig, kidPhoto: UploadedImage[]) => void;
  onOpenRoom: (config: CuteKidsConfig, kidPhoto: UploadedImage[]) => void;
}) {
  const { lang, provider, onBuild, onOpenRoom } = props;
  const vi = lang === "vi";
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<CuteKidsConfig>(DEFAULT_CUTE_KIDS);
  const [kidPhoto, setKidPhoto] = useState<UploadedImage[]>([]);
  const [ideas, setIdeas] = useState<EpisodeIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setConfig(loadConfig()); }, []);
  const update = (patch: Partial<CuteKidsConfig>) =>
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  const toggleFamily = (id: FamilyMember) =>
    update({ family: config.family.includes(id) ? config.family.filter((m) => m !== id) : [...config.family, id] });
  const traits = config.traits ?? [];
  const toggleTrait = (id: KidTrait) => update({ traits: traits.includes(id) ? traits.filter((t) => t !== id) : [...traits, id] });

  const ready = config.request.trim().length > 0;
  const askIdeas = async () => {
    setLoadingIdeas(true);
    setError("");
    const res = await suggestCuteKidsEpisodes({ config, avoid: ideas.map((i) => i.title), provider });
    setLoadingIdeas(false);
    if (res.success) setIdeas(res.data);
    else setError(res.error);
  };

  return (
    <div className="space-y-3 rounded-lg border border-pink-400/50 bg-pink-500/[0.05] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">🧒 {vi ? "Bé cưng viral (video bé dễ thương kiểu Reels)" : "Cute kids viral reel"}</p>
          <p className="text-xs text-muted-foreground">
            {vi
              ? "Gõ tình huống (bé ghen khi bố mẹ ôm nhau, mặc cả đòi kẹo, giả vờ ngủ…) → app dựng cả nhà, lời thoại đúng tuổi bé, quay kiểu điện thoại gia đình, khung 9:16."
              : "Type the situation → the app builds the family, age-true lines, a parent's-phone look, 9:16."}
          </p>
        </div>
        <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
          {open ? (vi ? "Thu gọn" : "Close") : (vi ? "Mở" : "Open")}
        </Button>
      </div>

      {open && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Yêu cầu của bạn" : "Your request"}</label>
            <Textarea
              value={config.request}
              onChange={(e) => update({ request: e.target.value })}
              rows={3}
              className="resize-none"
              placeholder={vi ? "VD: Bố ôm mẹ trong bếp, bé thấy liền chen vào giữa, phụng phịu đòi bố bế mình trước" : "e.g. Dad hugs Mom in the kitchen, the kid squeezes in between"}
            />
            <div className="flex flex-wrap gap-1.5">
              {VIRAL_FORMATS.map((f) => (
                <Chip key={f.id} active={config.format === f.id} title={FORMAT_EXAMPLE[f.id]} onClick={() => update({ format: config.format === f.id ? "auto" : f.id, ...(config.request.trim() ? {} : { request: FORMAT_EXAMPLE[f.id] ?? "" }) })}>
                  {f.label_vi}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Tên bé" : "Kid's name"}</label>
              <Input value={config.kidName} onChange={(e) => update({ kidName: e.target.value })} placeholder="Bé Na" />
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.kidGender === "girl"} onClick={() => update({ kidGender: "girl" })}>👧 {vi ? "Bé gái" : "Girl"}</Chip>
                <Chip active={config.kidGender === "boy"} onClick={() => update({ kidGender: "boy" })}>👦 {vi ? "Bé trai" : "Boy"}</Chip>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Tuổi bé" : "Age"}</label>
              <div className="flex flex-wrap gap-1.5">
                {(["toddler", "young", "school"] as KidAge[]).map((age) => (
                  <Chip key={age} active={config.kidAge === age} onClick={() => update({ kidAge: age })}>
                    {AGE_LABEL[age][lang]}
                  </Chip>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {config.kidAge === "toddler"
                  ? vi ? "Bé nói 1–3 từ, bập bẹ; bố mẹ dẫn lời, bé “diễn” bằng biểu cảm." : "1–3 word lines; parents carry the dialogue."
                  : config.kidAge === "young"
                    ? vi ? "Câu ngắn ≤ 6 từ, logic ngây ngô." : "Short lines up to 6 words."
                    : vi ? "Câu ≤ 10 từ, ngọt ngào lém lỉnh, có câu chốt." : "Up to 10 words, a sassy punchline."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Tính cách bé (diễn trong mọi shot)" : "Kid's personality (in every shot)"}</label>
            <div className="flex flex-wrap gap-1.5">
              {KID_TRAITS.map((t) => (
                <Chip key={t.id} active={traits.includes(t.id)} onClick={() => toggleTrait(t.id)} title={t.room_vi}>
                  {vi ? t.label_vi : t.label_en}
                </Chip>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {vi
                ? "Bé dễ thương từ cử chỉ, điệu bộ đến giọng nói; bố mẹ luôn hưởng ứng (tan chảy, bật cười, trêu lại, chiều bé)."
                : "Cute in gestures, body language and voice; the parents always play along."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{vi ? "Gia đình xuất hiện" : "Family on screen"}</label>
            <div className="flex flex-wrap gap-1.5">
              {FAMILY_CHIPS.map((m) => (
                <Chip key={m.id} active={config.family.includes(m.id)} onClick={() => toggleFamily(m.id)}>
                  {vi ? m.vi(config.dialect === "south") : m.en}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Kiểu quay" : "Filming"}</label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.filming === "phone"} onClick={() => update({ filming: "phone" })}>📱 {vi ? "Điện thoại gia đình" : "Family phone"}</Chip>
                <Chip active={config.filming === "cinematic"} onClick={() => update({ filming: "cinematic" })}>🎬 {vi ? "Điện ảnh" : "Cinematic"}</Chip>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Giọng" : "Dialect"}</label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={config.dialect === "north"} onClick={() => update({ dialect: "north" })}>{vi ? "Miền Bắc" : "Northern"}</Chip>
                <Chip active={config.dialect === "south"} onClick={() => update({ dialect: "south" })}>{vi ? "Miền Nam" : "Southern"}</Chip>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{vi ? "Độ dài" : "Length"}</label>
              <div className="flex flex-wrap gap-1.5">
                {[2, 3, 4].map((n) => (
                  <Chip key={n} active={config.shots === n} onClick={() => update({ shots: n })}>
                    {n} shot · {n * 10}s
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <ImageUploader
              images={kidPhoto}
              onChange={(images) => setKidPhoto(images.slice(0, 1))}
              maxImages={1}
              label={vi ? `Ảnh chính diện của bé (tuỳ chọn)` : "Kid's frontal photo (optional)"}
            />
            <p className="text-[11px] text-muted-foreground">
              {vi
                ? "Không có ảnh → app tạo một bé AI cố định (mặt giống nhau ở mọi shot). Chỉ dùng ảnh con của bạn hoặc ảnh đã được bố mẹ bé đồng ý. Video sẽ được gắn nhãn “tạo bằng AI” khi đăng."
                : "No photo → the app creates one fixed AI kid. Only use a photo of your own child or with the parents' consent. Captions get an AI-generated label."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!ready} onClick={() => onBuild(config, kidPhoto)}>
              <Zap className="h-4 w-4" />
              {vi ? "Tạo video ngay" : "Build video"}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready} onClick={() => onOpenRoom(config, kidPhoto)} title={vi ? "Mở phòng biên kịch mới với yêu cầu này (thay phiên đang mở)" : "Open a fresh writers' room with this request"}>
              <PenLine className="h-4 w-4" />
              {vi ? "Mở phòng biên kịch" : "Writers' room"}
            </Button>
            <Button size="sm" variant="outline" disabled={loadingIdeas} onClick={askIdeas}>
              {loadingIdeas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              {ideas.length ? (vi ? "10 ý tưởng khác" : "10 more ideas") : (vi ? "Gợi ý 10 tập" : "10 episode ideas")}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">⚠️ {error}</p>}
          {ideas.length > 0 && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {ideas.map((idea) => (
                <button
                  key={idea.title}
                  type="button"
                  onClick={() => update({ request: idea.request, format: "auto" })}
                  className={cn(
                    "rounded-md border bg-background p-2 text-left text-xs transition-colors hover:border-primary/60 hover:bg-primary/5",
                    config.request === idea.request && "border-primary bg-primary/5"
                  )}
                >
                  <span className="font-medium">{idea.title}</span>
                  <span className="mt-0.5 block text-muted-foreground">{idea.request}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
