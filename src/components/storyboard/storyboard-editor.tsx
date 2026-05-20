"use client";

import { useEffect, useCallback } from "react";
import { Image as ImageIcon, Grid3X3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneCard } from "./scene-card";
import { SceneDetailPanel } from "./scene-detail-panel";
import { GenerationWizard } from "./generation/generation-wizard";
import { ProgressTracker } from "./generation/progress-tracker";
import { EmptyState } from "@/components/shared/empty-state";
import { useStoryboardStore, useUIStore } from "@/store";
import { regenerateScene, deleteScene } from "@/actions/storyboard";
import type { Genre, Scene } from "@/types";
import { useState } from "react";

interface StoryboardEditorProps {
  projectId: string;
  storyboardId: string;
  genre: Genre;
  initialScenes: Scene[];
  initialStatus: string;
}

type ViewMode = "grid" | "list";

export function StoryboardEditor({
  projectId,
  storyboardId,
  genre,
  initialScenes,
  initialStatus,
}: StoryboardEditorProps) {
  const {
    scenes,
    setScenes,
    selectedSceneId,
    selectScene,
    updateScene,
    removeScene,
    isGenerating,
    progress,
    error,
  } = useStoryboardStore();

  const { generateDialogOpen, setGenerateDialogOpen } = useUIStore();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    setScenes(initialScenes);
  }, [initialScenes, setScenes]);

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) ?? null;

  const handleRegenerate = useCallback(
    async (sceneId: string) => {
      const result = await regenerateScene(sceneId, storyboardId, projectId);
      if (result.success) {
        updateScene(sceneId, result.data);
      }
    },
    [storyboardId, projectId, updateScene]
  );

  const handleDelete = useCallback(
    async (sceneId: string) => {
      const result = await deleteScene(sceneId, storyboardId, projectId);
      if (result.success) {
        removeScene(sceneId);
      }
    },
    [storyboardId, projectId, removeScene]
  );

  const handleSelect = useCallback(
    (scene: Scene) => {
      selectScene(selectedSceneId === scene.id ? null : scene.id);
    },
    [selectedSceneId, selectScene]
  );

  if (generateDialogOpen || (scenes.length === 0 && initialStatus === "idle")) {
    return (
      <GenerationWizard
        projectId={projectId}
        storyboardId={storyboardId}
        genre={genre}
        onComplete={() => setGenerateDialogOpen(false)}
      />
    );
  }

  if (isGenerating && progress) {
    return <ProgressTracker progress={progress} />;
  }

  return (
    <div className="flex h-[calc(100vh-12rem)]">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
            </span>
            {error && (
              <span className="text-sm text-destructive">{error}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-none rounded-l-md"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-none rounded-r-md"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => setGenerateDialogOpen(true)}
              className="gap-1"
            >
              Generate More
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {scenes.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No scenes yet"
              description="Generate your first storyboard to get started."
              actionLabel="Generate Storyboard"
              onAction={() => setGenerateDialogOpen(true)}
            />
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {scenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  onRegenerate={handleRegenerate}
                  onDelete={handleDelete}
                  onSelect={handleSelect}
                  isSelected={selectedSceneId === scene.id}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {scenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  onRegenerate={handleRegenerate}
                  onDelete={handleDelete}
                  onSelect={handleSelect}
                  isSelected={selectedSceneId === scene.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedScene && (
        <div className="hidden w-[400px] lg:block">
          <SceneDetailPanel
            scene={selectedScene}
            onClose={() => selectScene(null)}
          />
        </div>
      )}
    </div>
  );
}
