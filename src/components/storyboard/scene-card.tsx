"use client";

import { useState } from "react";
import Image from "next/image";
import {
  GripVertical,
  Trash2,
  RefreshCw,
  Maximize2,
  Loader2,
  AlertCircle,
  Camera,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Scene } from "@/types";

interface SceneCardProps {
  scene: Scene;
  onRegenerate: (sceneId: string) => Promise<void>;
  onDelete: (sceneId: string) => void;
  onSelect: (scene: Scene) => void;
  isSelected?: boolean;
}

export function SceneCard({
  scene,
  onRegenerate,
  onDelete,
  onSelect,
  isSelected,
}: SceneCardProps) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRegenerating(true);
    await onRegenerate(scene.id);
    setRegenerating(false);
  };

  const isGenerating =
    scene.generation_status === "generating" ||
    scene.generation_status === "retrying";
  const isFailed = scene.generation_status === "failed";

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all",
        isSelected && "ring-2 ring-primary",
        "hover:shadow-md"
      )}
      onClick={() => onSelect(scene)}
    >
      <div className="relative aspect-video bg-muted">
        {scene.image_url && !isGenerating ? (
          <Image
            src={scene.image_url}
            alt={scene.description}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : isGenerating || regenerating ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Generating...</span>
          </div>
        ) : isFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <span className="text-xs text-destructive">Generation failed</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerate}
              className="mt-1 gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1">
          <Badge
            variant="secondary"
            className="bg-background/80 text-xs backdrop-blur"
          >
            #{scene.order_index + 1}
          </Badge>
        </div>

        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isGenerating && (
            <>
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 bg-background/80 backdrop-blur"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 bg-background/80 backdrop-blur"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(scene);
                }}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(scene.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        <div className="absolute bottom-0 left-0 cursor-grab p-1 opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical className="h-4 w-4 text-white drop-shadow" />
        </div>
      </div>

      <CardContent className="p-3">
        <p className="mb-1 text-sm font-medium">{scene.title}</p>
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
          {scene.description}
        </p>

        {scene.dialogue && (
          <p className="mb-2 line-clamp-1 text-xs italic text-muted-foreground">
            &ldquo;{scene.dialogue}&rdquo;
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Camera className="h-2.5 w-2.5" />
            {scene.camera_angle.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {scene.shot_type.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Clock className="h-2.5 w-2.5" />
            {scene.duration_seconds}s
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
