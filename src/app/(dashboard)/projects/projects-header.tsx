"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";

interface ProjectsHeaderProps {
  projectCount: number;
}

export function ProjectsHeader({ projectCount }: ProjectsHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectCount} project{projectCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <CreateProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
