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
import { generateFullStoryboard, type StoryboardResult } from "@/actions";
import type {
  StoryboardStyle,
  StoryboardGenerationInput,
  CharacterDescription,
} from "@/types";

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

type Phase = "input" | "generating" | "result";

export function GenerateClient() {
  const [phase, setPhase] = useState<Phase>("input");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [result, setResult] = useState<StoryboardResult | null>(null);

  const [storyIdea, setStoryIdea] = useState("");
  const [genre, setGenre] = useState("drama");
  const [style, setStyle] = useState<StoryboardStyle>("cinematic");
  const [sceneCount, setSceneCount] = useState(6);
  const [setting, setSetting] = useState("");
  const [tone, setTone] = useState("");
  const [characters, setCharacters] = useState<CharacterDescription[]>([]);
  const [charName, setCharName] = useState("");
  const [charAppearance, setCharAppearance] = useState("");
  const [charRole, setCharRole] = useState("");

  const addCharacter = () => {
    if (!charName.trim()) return;
    setCharacters((prev) => [
      ...prev,
      { name: charName, appearance: charAppearance, personality: "", role: charRole },
    ]);
    setCharName("");
    setCharAppearance("");
    setCharRole("");
  };

  const handleGenerate = async () => {
    setPhase("generating");
    setError(null);
    setProgressPercent(10);

    const input: StoryboardGenerationInput = {
      story_idea: storyIdea,
      genre: genre as StoryboardGenerationInput["genre"],
      style,
      scene_count: sceneCount,
      character_descriptions: characters.length > 0 ? characters : undefined,
      setting: setting || undefined,
      tone: tone || undefined,
    };

    setProgressPercent(20);
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
        <p className="mb-6 text-sm text-muted-foreground">
          AI is creating scene breakdowns and generating images. This may take 1-2 minutes.
        </p>
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
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" onClick={downloadZip} className="gap-2">
              <FolderArchive className="h-4 w-4" />
              ZIP Images
            </Button>
            <Button
              onClick={() => {
                setPhase("input");
                setResult(null);
                setStep(0);
              }}
              className="gap-2"
            >
              <RotateCw className="h-4 w-4" />
              New Storyboard
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
  const steps = ["Story", "Style", "Characters"];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">Create Storyboard</h1>
        <p className="mt-1 text-muted-foreground">
          Describe your story and AI will generate a complete storyboard with images
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{steps[step]}</CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {steps.map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={i <= step ? "font-bold text-primary" : ""}>{i + 1}</span>
                  {i < steps.length - 1 && <ChevronRight className="h-3 w-3" />}
                </span>
              ))}
            </div>
          </div>
          <Progress value={((step + 1) / steps.length) * 100} />
        </CardHeader>
        <CardContent className="space-y-4">
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

          {step === 1 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Visual Style *</label>
                <Select value={style} onChange={(e) => setStyle(e.target.value as StoryboardStyle)} options={STYLE_OPTIONS} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Scenes</label>
                <Select value={String(sceneCount)} onChange={(e) => setSceneCount(Number(e.target.value))} options={SCENE_OPTIONS} />
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                <strong>{sceneCount} scenes</strong> will be generated with AI images.
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">
                Optional: describe characters for visual consistency across scenes.
              </p>
              {characters.length > 0 && (
                <div className="space-y-2">
                  {characters.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.role} — {c.appearance}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCharacters((p) => p.filter((_, j) => j !== i))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 rounded-lg border border-dashed p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="Name" />
                  <Input value={charRole} onChange={(e) => setCharRole(e.target.value)} placeholder="Role" />
                </div>
                <Input value={charAppearance} onChange={(e) => setCharAppearance(e.target.value)} placeholder="Appearance description" />
                <Button variant="outline" size="sm" onClick={addCharacter} disabled={!charName.trim()}>
                  Add Character
                </Button>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !storyIdea.trim()} className="gap-1">
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
