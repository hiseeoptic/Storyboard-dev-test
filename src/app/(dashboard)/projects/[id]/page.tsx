import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/actions/auth";
import { getProject } from "@/actions/projects";
import { createClient } from "@/lib/supabase/server";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");

  const project = await getProject(id);
  if (!project) notFound();

  const supabase = await createClient();
  const { data: storyboards } = await supabase
    .from("storyboards")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <Link href={`/projects/${id}/storyboard`}>
          <Button className="gap-2">
            <Pencil className="h-4 w-4" />
            Open Editor
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {project.genre}
        </Badge>
        <Badge
          variant={project.status === "completed" ? "default" : "secondary"}
        >
          {project.status.replace("_", " ")}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Created {new Date(project.created_at).toLocaleDateString()}
        </span>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Storyboards</h2>
        {storyboards && storyboards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storyboards.map((sb) => (
              <Link
                key={sb.id}
                href={`/projects/${id}/storyboard`}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{sb.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {sb.style}
                      </Badge>
                      <Badge
                        variant={
                          sb.status === "completed" ? "default" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {sb.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {sb.scene_count} scenes &middot; Updated{" "}
                      {new Date(sb.updated_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center p-8 text-center">
            <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-3 text-sm text-muted-foreground">
              No storyboards yet. Open the editor to create one.
            </p>
            <Link href={`/projects/${id}/storyboard`}>
              <Button size="sm">Open Editor</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
