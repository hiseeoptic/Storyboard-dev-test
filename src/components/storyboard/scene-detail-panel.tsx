"use client";

import Image from "next/image";
import {
  X,
  Camera,
  Clock,
  MapPin,
  Users,
  MessageSquare,
  Clapperboard,
  Sun,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Scene } from "@/types";

interface SceneDetailPanelProps {
  scene: Scene;
  onClose: () => void;
}

export function SceneDetailPanel({ scene, onClose }: SceneDetailPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto border-l bg-card">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-4">
        <h3 className="font-semibold">
          Scene #{scene.order_index + 1}: {scene.title}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        {scene.image_url && (
          <div className="relative aspect-video overflow-hidden rounded-lg">
            <Image
              src={scene.image_url}
              alt={scene.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        <div>
          <h4 className="mb-1 text-sm font-medium text-muted-foreground">
            Description
          </h4>
          <p className="text-sm">{scene.description}</p>
        </div>

        {scene.dialogue && (
          <div>
            <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Dialogue
            </h4>
            <p className="text-sm italic">&ldquo;{scene.dialogue}&rdquo;</p>
          </div>
        )}

        {scene.action_notes && (
          <div>
            <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Clapperboard className="h-3.5 w-3.5" />
              Action Notes
            </h4>
            <p className="text-sm">{scene.action_notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <DetailItem
            icon={Camera}
            label="Camera"
            value={scene.camera_angle.replace(/_/g, " ")}
          />
          <DetailItem
            icon={Camera}
            label="Shot"
            value={scene.shot_type.replace(/_/g, " ")}
          />
          <DetailItem
            icon={Clock}
            label="Duration"
            value={`${scene.duration_seconds}s`}
          />
          <DetailItem
            icon={Clapperboard}
            label="Transition"
            value={scene.transition}
          />
          {scene.mood && (
            <DetailItem icon={Heart} label="Mood" value={scene.mood} />
          )}
          {scene.lighting && (
            <DetailItem icon={Sun} label="Lighting" value={scene.lighting} />
          )}
          {scene.location && (
            <DetailItem icon={MapPin} label="Location" value={scene.location} />
          )}
        </div>

        {scene.characters && scene.characters.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Characters
            </h4>
            <div className="flex flex-wrap gap-1">
              {scene.characters.map((char) => (
                <Badge key={char} variant="secondary">
                  {char}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-1 text-sm font-medium text-muted-foreground">
            Visual Prompt
          </h4>
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {scene.visual_prompt}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-2">
      <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xs capitalize">{value}</p>
    </div>
  );
}
