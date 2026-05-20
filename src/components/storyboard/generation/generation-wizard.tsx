"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useStoryboardStore } from "@/store";
import { generateStoryboard } from "@/actions/storyboard";
import type {
  Genre,
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

const SCENE_COUNT_OPTIONS = [
  { value: "4", label: "4 scenes" },
  { value: "6", label: "6 scenes" },
  { value: "8", label: "8 scenes" },
  { value: "12", label: "12 scenes" },
  { value: "16", label: "16 scenes" },
];

interface GenerationWizardProps {
  projectId: string;
  storyboardId: string;
  genre: Genre;
  onComplete: () => void;
}

type Step = "story" | "style" | "characters" | "review";

export function GenerationWizard({
  projectId,
  storyboardId,
  genre,
  onComplete,
}: GenerationWizardProps) {
  const { setIsGenerating, setScenes, setBreakdown, setProgress, setError } =
    useStoryboardStore();

  const [step, setStep] = useState<Step>("story");
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const [storyIdea, setStoryIdea] = useState("");
  const [setting, setSetting] = useState("");
  const [tone, setTone] = useState("");
  const [style, setStyle] = useState<StoryboardStyle>("cinematic");
  const [sceneCount, setSceneCount] = useState(6);
  const [characters, setCharacters] = useState<CharacterDescription[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");

  const [newCharName, setNewCharName] = useState("");
  const [newCharAppearance, setNewCharAppearance] = useState("");
  const [newCharPersonality, setNewCharPersonality] = useState("");
  const [newCharRole, setNewCharRole] = useState("");

  const steps: Step[] = ["story", "style", "characters", "review"];
  const currentIndex = steps.indexOf(step);

  const addCharacter = () => {
    if (!newCharName.trim()) return;
    setCharacters((prev) => [
      ...prev,
      {
        name: newCharName.trim(),
        appearance: newCharAppearance.trim(),
        personality: newCharPersonality.trim(),
        role: newCharRole.trim(),
      },
    ]);
    setNewCharName("");
    setNewCharAppearance("");
    setNewCharPersonality("");
    setNewCharRole("");
  };

  const removeCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(10);

    const input: StoryboardGenerationInput & {
      project_id: string;
      storyboard_id: string;
    } = {
      project_id: projectId,
      storyboard_id: storyboardId,
      story_idea: storyIdea,
      genre,
      style,
      scene_count: sceneCount,
      character_descriptions:
        characters.length > 0 ? characters : undefined,
      tone: tone || undefined,
      setting: setting || undefined,
      custom_instructions: customInstructions || undefined,
    };

    setGenerationProgress(20);

    const result = await generateStoryboard(input);

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      setIsGenerating(false);
      setGenerationProgress(0);
      return;
    }

    setGenerationProgress(100);
    setBreakdown(result.data.breakdown);
    setScenes(result.data.scenes);
    setProgress(result.data.progress);
    setIsGenerating(false);
    setLoading(false);
    onComplete();
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Storyboard
          </CardTitle>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span
                  className={
                    i <= currentIndex ? "font-medium text-primary" : ""
                  }
                >
                  {i + 1}
                </span>
                {i < steps.length - 1 && (
                  <ChevronRight className="h-3 w-3" />
                )}
              </div>
            ))}
          </div>
        </div>
        <Progress value={(currentIndex + 1) * 25} />
      </CardHeader>

      <CardContent className="space-y-6">
        {step === "story" && (
          <div className="space-y-4">
            <h3 className="font-semibold">Tell your story</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Story Idea *</label>
              <Textarea
                value={storyIdea}
                onChange={(e) => setStoryIdea(e.target.value)}
                placeholder="A cyberpunk detective investigates a series of AI-related crimes in Neo Tokyo, uncovering a conspiracy that blurs the line between human and artificial consciousness..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Setting</label>
                <Input
                  value={setting}
                  onChange={(e) => setSetting(e.target.value)}
                  placeholder="Neo Tokyo, 2087"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tone</label>
                <Input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Dark, atmospheric, suspenseful"
                />
              </div>
            </div>
          </div>
        )}

        {step === "style" && (
          <div className="space-y-4">
            <h3 className="font-semibold">Visual style & scope</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Art Style *</label>
              <Select
                value={style}
                onChange={(e) =>
                  setStyle(e.target.value as StoryboardStyle)
                }
                options={STYLE_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Number of Scenes *</label>
              <Select
                value={String(sceneCount)}
                onChange={(e) =>
                  setSceneCount(Number(e.target.value))
                }
                options={SCENE_COUNT_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Custom Instructions (optional)
              </label>
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Any special requirements, visual preferences, or constraints..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        )}

        {step === "characters" && (
          <div className="space-y-4">
            <h3 className="font-semibold">Characters (optional)</h3>
            <p className="text-sm text-muted-foreground">
              Describe characters for visual consistency across scenes.
            </p>

            {characters.length > 0 && (
              <div className="space-y-2">
                {characters.map((char, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{char.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {char.role} &mdash; {char.appearance}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCharacter(i)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="Name"
                />
                <Input
                  value={newCharRole}
                  onChange={(e) => setNewCharRole(e.target.value)}
                  placeholder="Role (protagonist, villain...)"
                />
              </div>
              <Input
                value={newCharAppearance}
                onChange={(e) => setNewCharAppearance(e.target.value)}
                placeholder="Physical appearance (tall, dark hair, wears leather jacket...)"
              />
              <Input
                value={newCharPersonality}
                onChange={(e) => setNewCharPersonality(e.target.value)}
                placeholder="Personality traits"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addCharacter}
                disabled={!newCharName.trim()}
              >
                Add Character
              </Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h3 className="font-semibold">Review & Generate</h3>

            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Story
                </p>
                <p className="mt-1 text-sm">{storyIdea}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Style
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {style.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Scenes
                  </p>
                  <p className="mt-1 text-sm font-medium">{sceneCount}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Characters
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {characters.length || "Auto-detect"}
                  </p>
                </div>
              </div>
              {setting && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Setting
                  </p>
                  <p className="mt-1 text-sm">{setting}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
              This will use <strong>{sceneCount} credits</strong> from your
              account. Each scene generates an AI description and image.
            </div>

            {loading && (
              <div className="space-y-2">
                <Progress value={generationProgress} showLabel />
                <p className="text-center text-sm text-muted-foreground">
                  Generating your storyboard... This may take a minute.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setStep(steps[currentIndex - 1]!)}
            disabled={currentIndex === 0 || loading}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {step !== "review" ? (
            <Button
              onClick={() => setStep(steps[currentIndex + 1]!)}
              disabled={step === "story" && !storyIdea.trim()}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Generating..." : "Generate Storyboard"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
