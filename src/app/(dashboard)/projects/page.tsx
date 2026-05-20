import { FolderOpen } from "lucide-react";
import { getProjects } from "@/actions/projects";
import { ProjectCard } from "@/components/project/project-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectsHeader } from "./projects-header";

export const metadata = { title: "Projects - StoryboardAI" };

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div>
      <ProjectsHeader projectCount={projects.length} />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to start generating AI-powered storyboards."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
