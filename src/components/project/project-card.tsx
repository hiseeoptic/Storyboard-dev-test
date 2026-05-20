import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/types";

interface ProjectCardProps {
  project: Project;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  in_progress: "default",
  completed: "secondary",
  archived: "destructive",
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <CardTitle className="text-lg">{project.title}</CardTitle>
          <Badge variant={statusColors[project.status] ?? "outline"}>
            {project.status.replace("_", " ")}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {project.description ?? "No description"}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="capitalize">{project.genre}</span>
            <span>{new Date(project.created_at).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
