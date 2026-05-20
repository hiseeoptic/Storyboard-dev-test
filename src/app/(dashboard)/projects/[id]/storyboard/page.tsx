import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { StoryboardEditor } from "@/components/storyboard/storyboard-editor";
import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface StoryboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function StoryboardPage({ params }: StoryboardPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) notFound();

  let { data: storyboard } = await supabase
    .from("storyboards")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!storyboard) {
    const { data: created } = await supabase
      .from("storyboards")
      .insert({
        project_id: id,
        title: `${project.title} - Storyboard`,
        style: "cinematic",
        scene_count: 0,
        status: "idle",
      })
      .select()
      .single();

    storyboard = created;
  }

  if (!storyboard) notFound();

  const { data: scenes } = await supabase
    .from("scenes")
    .select("*")
    .eq("storyboard_id", storyboard.id)
    .order("order_index", { ascending: true });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{project.title}</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {storyboard.title}
              </p>
              <Badge variant="outline" className="text-[10px]">
                {storyboard.style}
              </Badge>
              <Badge
                variant={
                  storyboard.status === "completed" ? "default" : "secondary"
                }
                className="text-[10px]"
              >
                {storyboard.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/settings`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <StoryboardEditor
        projectId={id}
        storyboardId={storyboard.id}
        genre={project.genre}
        initialScenes={scenes ?? []}
        initialStatus={storyboard.status}
      />
    </div>
  );
}
