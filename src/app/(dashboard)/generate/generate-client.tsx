"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  FileText,
  FolderArchive,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  RotateCw,
  Users,
  Package,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { generateFullStoryboard, type StoryboardResult } from "@/actions";
import type {
  StoryboardStyle,
  StoryboardGenerationInput,
  ImageReference,
} from "@/types";

// ─── Options ─────────────────────────────────────────────────────────────────

const STYLE_OPTIONS: { value: StoryboardStyle; label: string }[] = [
  { value: "cinematic", label: "Cinematic" },
  { value: "realistic", label: "Realistic" },
  { value: "anime", label: "Anime" },
  { value: "comic", label: "Comic Book" },
  { value: "watercolor", label: "Watercolor" },
  { value: "pencil_sketch", label: "Pencil Sketch" },
  { value: "noir", label: "Film Noir" },
  { value: "3d_render", label: "3D Render" },
  { value: "pixel_art", label: "Pixel Art" },
];

const GENRE_OPTIONS = [
  { value: "action", label: "Action" },
  { value: "comedy", label: "Comedy" },
  { value: "drama", label: "Drama" },
  { value: "horror", label: "Horror" },
  { value: "romance", label: "Romance" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "thriller", label: "Thriller" },
  { value: "animation", label: "Animation" },
  { value: "documentary", label: "Documentary" },
];

const SCENE_OPTIONS = [
  { value: "4", label: "4 scenes" },
  { value: "6", label: "6 scenes" },
  { value: "8", label: "8 scenes" },
  { value: "12", label: "12 scenes" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface CharacterEntry {
  name: string;
  role: string;
  appearance: string;
  images: UploadedImage[];
}

interface ProductEntry {
  name: string;
  description: string;
  images: UploadedImage[];
}

interface BackgroundEntry {
  name: string;
  description: string;
  images: UploadedImage[];
}

type Phase = "input" | "generating" | "result";

const STEPS = ["Story", "Characters", "Products", "Background", "Style"];

// ─── Component ───────────────────────────────────────────────────────────────

export function GenerateClient() {
  const [phase, setPhase] = useState<Phase>("input");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [result, setResult] = useState<StoryboardResult | null>(null);

  // Step 1: Story
  const [storyIdea, setStoryIdea] = useState("");
  const [genre, setGenre] = useState("drama");
  const [setting, setSetting] = useState("");
  const [tone, setTone] = useState("");

  // Step 2: Characters
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charAppearance, setCharAppearance] = useState("");
  const [charImages, setCharImages] = useState<UploadedImage[]>([]);

  // Step 3: Products
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodImages, setProdImages] = useState<UploadedImage[]>([]);

  // Step 4: Backgrounds
  const [backgrounds, setBackgrounds] = useState<BackgroundEntry[]>([]);
  const [bgName, setBgName] = useState("");
  const [bgDesc, setBgDesc] = useState("");
  const [bgImages, setBgImages] = useState<UploadedImage[]>([]);

  // Step 5: Style
  const [style, setStyle] = useState<StoryboardStyle>("cinematic");
  const [sceneCount, setSceneCount] = useState(6);

  // ─── Helpers ─────────────────────────────────────────────────────

  const addCharacter = () => {
    if (!charName.trim()) return;
    setCharacters((prev) => [
      ...prev,
      { name: charName, role: charRole, appearance: charAppearance, images: charImages },
    ]);
    setCharName("");
    setCharRole("");
    setCharAppearance("");
    setCharImages([]);
  };

  const addProduct = () => {
    if (!prodName.trim()) return;
    setProducts((prev) => [
      ...prev,
      { name: prodName, description: prodDesc, images: prodImages },
    ]);
    setProdName("");
    setProdDesc("");
    setProdImages([]);
  };

  const addBackground = () => {
    if (!bgName.trim()) return;
    setBackgrounds((prev) => [
      ...prev,
      { name: bgName, description: bgDesc, images: bgImages },
    ]);
    setBgName("");
    setBgDesc("");
    setBgImages([]);
  };

  // ─── Generate ────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setPhase("generating");
    setError(null);
    setProgressPercent(5);
    setProgressMessage("Preparing...");

    // Build image references
    const characterImages: ImageReference[] = characters
      .filter((c) => c.images.length > 0)
      .map((c) => ({ name: c.name, images: c.images.map((i) => i.base64) }));

    const productImages: ImageReference[] = products
      .filter((p) => p.images.length > 0)
      .map((p) => ({ name: p.name, description: p.description, images: p.images.map((i) => i.base64) }));

    const backgroundImages: ImageReference[] = backgrounds
      .filter((b) => b.images.length > 0)
      .map((b) => ({ name: b.name, description: b.description, images: b.images.map((i) => i.base64) }));

    const hasUploads = characterImages.length > 0 || productImages.length > 0 || backgroundImages.length > 0;

    if (hasUploads) {
      setProgressPercent(10);
      setProgressMessage("Analyzing uploaded images...");
    }

    const input: StoryboardGenerationInput = {
      story_idea: storyIdea,
      genre: genre as StoryboardGenerationInput["genre"],
      style,
      scene_count: sceneCount,
      character_descriptions: characters.length > 0
        ? characters.map((c) => ({ name: c.name, appearance: c.appearance, personality: "", role: c.role }))
        : undefined,
      character_images: characterImages.length > 0 ? characterImages : undefined,
      product_images: productImages.length > 0 ? productImages : undefined,
      background_images: backgroundImages.length > 0 ? backgroundImages : undefined,
      setting: setting || undefined,
      tone: tone || undefined,
    };

    setProgressPercent(20);
    setProgressMessage("AI is creating scene breakdowns and generating images...");

    const res = await generateFullStoryboard(input);
    setProgressPercent(100);

    if (!res.success) {
      setError(res.error);
      setPhase("input");
      return;
    }

    setResult(res.data);
    setPhase("result");
  };

  // ─── Downloads ───────────────────────────────────────────────────

  const downloadPdf = async () => {
    if (!result) return;
    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: result.breakdown.title,
        synopsis: result.breakdown.synopsis,
        scenes: result.scenes,
      }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.breakdown.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadZip = async () => {
    if (!result) return;
    const res = await fetch("/api/export/zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: result.breakdown.title,
        scenes: result.scenes,
      }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.breakdown.title.replace(/[^a-zA-Z0-9]/g, "_")}_images.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Generating Phase ──────────────────────────────────────────────

  if (phase === "generating") {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <Loader2 className="mx-auto mb-6 h-12 w-12 animate-spin text-primary" />
        <h2 className="mb-2 text-xl font-bold">Generating your storyboard...</h2>
        <p className="mb-6 text-sm text-muted-foreground">{progressMessage}</p>
        <Progress value={progressPercent} showLabel className="mx-auto max-w-xs" />
      </div>
    );
  }

  // ─── Result Phase ──────────────────────────────────────────────────

  if (phase === "result" && result) {
    const successCount = result.scenes.filter((s) => s.image_url).length;
    const failCount = result.scenes.filter((s) => s.generation_error).length;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{result.breakdown.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{result.breakdown.synopsis}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {successCount} generated
              </Badge>
              {failCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3 w-3" />
                  {failCount} failed
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadPdf} className="gap-2">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" onClick={downloadZip} className="gap-2">
              <FolderArchive className="h-4 w-4" /> ZIP
            </Button>
            <Button onClick={() => { setPhase("input"); setResult(null); setStep(0); }} className="gap-2">
              <RotateCw className="h-4 w-4" /> New
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.scenes.map((scene) => (
            <SceneResultCard key={scene.scene_number} scene={scene} />
          ))}
        </div>
      </div>
    );
  }

  // ─── Input Phase (Wizard) ──────────────────────────────────────────

  const canNext =
    step === 0 ? storyIdea.trim().length > 0 : true;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">Create Storyboard</h1>
        <p className="mt-1 text-muted-foreground">
          Describe your story, upload references, and AI generates a complete storyboard
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {STEPS.map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={i <= step ? "font-bold text-primary" : ""}>{i + 1}</span>
                  {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3" />}
                </span>
              ))}
            </div>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Step 1: Story ─────────────────────────────────────── */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Story Idea *</label>
                <Textarea
                  value={storyIdea}
                  onChange={(e) => setStoryIdea(e.target.value)}
                  placeholder="A detective investigates mysterious disappearances in a small coastal town..."
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Genre</label>
                  <Select value={genre} onChange={(e) => setGenre(e.target.value)} options={GENRE_OPTIONS} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Setting</label>
                  <Input value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="Coastal town, 1990s" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tone</label>
                <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Dark, atmospheric, suspenseful" />
              </div>
            </>
          )}

          {/* ── Step 2: Characters ────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Upload character photos from different angles for visual consistency.</span>
              </div>

              {characters.length > 0 && (
                <div className="space-y-2">
                  {characters.map((c, i) => (
                    <div key={i} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex gap-3">
                        {c.images.length > 0 && (
                          <div className="flex gap-1">
                            {c.images.map((img) => (
                              <img key={img.id} src={img.preview} alt="" className="h-12 w-12 rounded object-cover" />
                            ))}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.role}{c.appearance ? ` — ${c.appearance}` : ""}</p>
                          <p className="text-xs text-muted-foreground">{c.images.length} photo(s)</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCharacters((p) => p.filter((_, j) => j !== i))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="Character name" />
                  <Input value={charRole} onChange={(e) => setCharRole(e.target.value)} placeholder="Role (e.g. Main hero)" />
                </div>
                <Input value={charAppearance} onChange={(e) => setCharAppearance(e.target.value)} placeholder="Appearance description (optional if uploading photos)" />
                <ImageUploader
                  images={charImages}
                  onChange={setCharImages}
                  maxImages={3}
                  label="Character Photos"
                  hint="Upload 2-3 photos from different angles"
                />
                <Button variant="outline" size="sm" onClick={addCharacter} disabled={!charName.trim()}>
                  Add Character
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3: Products ──────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Upload product photos to include in your storyboard scenes.</span>
              </div>

              {products.length > 0 && (
                <div className="space-y-2">
                  {products.map((p, i) => (
                    <div key={i} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex gap-3">
                        {p.images.length > 0 && (
                          <div className="flex gap-1">
                            {p.images.map((img) => (
                              <img key={img.id} src={img.preview} alt="" className="h-12 w-12 rounded object-cover" />
                            ))}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.description || "No description"}</p>
                          <p className="text-xs text-muted-foreground">{p.images.length} photo(s)</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setProducts((prev) => prev.filter((_, j) => j !== i))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <Input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Product name" />
                <Input value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} placeholder="Product description (optional)" />
                <ImageUploader
                  images={prodImages}
                  onChange={setProdImages}
                  maxImages={3}
                  label="Product Photos"
                  hint="Upload 2-3 product photos from different angles"
                />
                <Button variant="outline" size="sm" onClick={addProduct} disabled={!prodName.trim()}>
                  Add Product
                </Button>
              </div>
            </>
          )}

          {/* ── Step 4: Background ───────────────────────────────── */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Upload reference photos of locations where the story takes place.</span>
              </div>

              {backgrounds.length > 0 && (
                <div className="space-y-2">
                  {backgrounds.map((b, i) => (
                    <div key={i} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex gap-3">
                        {b.images.length > 0 && (
                          <div className="flex gap-1">
                            {b.images.map((img) => (
                              <img key={img.id} src={img.preview} alt="" className="h-12 w-12 rounded object-cover" />
                            ))}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.description || "No description"}</p>
                          <p className="text-xs text-muted-foreground">{b.images.length} photo(s)</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setBackgrounds((prev) => prev.filter((_, j) => j !== i))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <Input value={bgName} onChange={(e) => setBgName(e.target.value)} placeholder="Location name (e.g. Coffee shop, City street)" />
                <Input value={bgDesc} onChange={(e) => setBgDesc(e.target.value)} placeholder="Description (optional)" />
                <ImageUploader
                  images={bgImages}
                  onChange={setBgImages}
                  maxImages={3}
                  label="Background Photos"
                  hint="Upload 2-3 reference photos of the location"
                />
                <Button variant="outline" size="sm" onClick={addBackground} disabled={!bgName.trim()}>
                  Add Background
                </Button>
              </div>
            </>
          )}

          {/* ── Step 5: Style & Generate ─────────────────────────── */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Visual Style *</label>
                <Select value={style} onChange={(e) => setStyle(e.target.value as StoryboardStyle)} options={STYLE_OPTIONS} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Scenes</label>
                <Select value={String(sceneCount)} onChange={(e) => setSceneCount(Number(e.target.value))} options={SCENE_OPTIONS} />
              </div>

              {/* Summary */}
              <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-1">
                <p className="font-medium">Summary</p>
                <p className="text-muted-foreground">
                  <strong>{sceneCount}</strong> scenes · <strong>{style}</strong> style
                  {characters.length > 0 && <> · {characters.length} character(s)</>}
                  {products.length > 0 && <> · {products.length} product(s)</>}
                  {backgrounds.length > 0 && <> · {backgrounds.length} location(s)</>}
                </p>
                {(characters.some((c) => c.images.length > 0) ||
                  products.some((p) => p.images.length > 0) ||
                  backgrounds.some((b) => b.images.length > 0)) && (
                  <p className="text-xs text-muted-foreground">
                    📷 Reference images will be analyzed by AI for visual consistency
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── Error ────────────────────────────────────────────── */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {/* ── Navigation ───────────────────────────────────────── */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleGenerate} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Storyboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Scene Result Card ───────────────────────────────────────────────────────

function SceneResultCard({ scene }: { scene: StoryboardResult["scenes"][number] }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-muted">
        {scene.image_url ? (
          <img src={scene.image_url} alt={scene.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <XCircle className="h-6 w-6 text-destructive" />
            <span className="text-xs text-destructive">Failed</span>
          </div>
        )}
        <Badge variant="secondary" className="absolute left-2 top-2 text-xs">
          #{scene.scene_number}
        </Badge>
      </div>
      <CardContent className="p-3">
        <p className="text-sm font-medium">{scene.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{scene.description}</p>
        {scene.dialogue && (
          <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">
            &ldquo;{scene.dialogue}&rdquo;
          </p>
        )}
      </CardContent>
    </Card>
  );
}
