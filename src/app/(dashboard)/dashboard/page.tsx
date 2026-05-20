import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FolderOpen,
  Image,
  CreditCard,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSession, getUserProfile } from "@/actions/auth";
import { getProjects } from "@/actions/projects";

export const metadata = { title: "Dashboard - StoryboardAI" };

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [profile, projects] = await Promise.all([
    getUserProfile(),
    getProjects(),
  ]);

  const recentProjects = projects.slice(0, 4);
  const plan = profile?.plan ?? "free";
  const credits = profile?.credits_remaining ?? 0;

  const stats = [
    {
      title: "Total Projects",
      value: projects.length,
      icon: FolderOpen,
      href: "/projects",
    },
    {
      title: "Credits Remaining",
      value: plan === "enterprise" ? "Unlimited" : credits,
      icon: CreditCard,
      href: "/billing",
    },
    {
      title: "Current Plan",
      value: plan.charAt(0).toUpperCase() + plan.slice(1),
      icon: TrendingUp,
      href: "/billing",
    },
    {
      title: "Scenes Generated",
      value: "—",
      icon: Image,
      href: "/projects",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s an overview of your storyboard workspace
          </p>
        </div>
        <Link href="/projects">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Projects</h2>
          {projects.length > 4 && (
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="gap-1">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {recentProjects.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first project to start generating storyboards
            </p>
            <Link href="/projects">
              <Button>Create Project</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="line-clamp-1 text-base">
                        {project.title}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        {project.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {project.description ?? "No description"}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px]">
                        {project.genre}
                      </Badge>
                      <span>
                        {new Date(project.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
