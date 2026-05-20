"use client";

import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { GenerationProgress } from "@/types";

interface ProgressTrackerProps {
  progress: GenerationProgress;
}

export function ProgressTracker({ progress }: ProgressTrackerProps) {
  const sceneStatuses = Array.from(
    { length: progress.total_scenes },
    (_, i) => {
      const sceneNum = i + 1;
      if (sceneNum <= progress.completed) return "completed";
      if (sceneNum === progress.current_scene) return "generating";
      if (sceneNum <= progress.completed + progress.failed) return "failed";
      return "pending";
    }
  );

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Generation Progress</h3>
        <span className="text-sm text-muted-foreground">
          {progress.completed} / {progress.total_scenes} scenes
        </span>
      </div>

      <Progress value={progress.percent} showLabel />

      <div className="flex flex-wrap gap-2">
        {sceneStatuses.map((status, i) => (
          <div
            key={i}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium",
              status === "completed" &&
                "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
              status === "generating" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
              status === "failed" &&
                "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
              status === "pending" && "bg-muted text-muted-foreground"
            )}
          >
            {status === "completed" && <CheckCircle2 className="h-4 w-4" />}
            {status === "generating" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {status === "failed" && <XCircle className="h-4 w-4" />}
            {status === "pending" && <Clock className="h-4 w-4" />}
          </div>
        ))}
      </div>

      {progress.failed > 0 && (
        <p className="text-sm text-destructive">
          {progress.failed} scene{progress.failed > 1 ? "s" : ""} failed to
          generate. You can retry them individually.
        </p>
      )}
    </div>
  );
}
