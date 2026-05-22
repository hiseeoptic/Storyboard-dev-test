import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  CreditCard,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import type { Plan } from "@/types";
import { PLAN_LIMITS } from "@/types";

export const metadata = { title: "Dashboard - StoryboardAI" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, plan: true, creditsRemaining: true },
  });

  const plan = (user?.plan ?? "free") as Plan;
  const credits = user?.creditsRemaining ?? 0;
  const limits = PLAN_LIMITS[plan];

  const stats = [
    {
      title: "Credits Remaining",
      value: limits.credits_per_month === -1 ? "Unlimited" : credits,
      icon: CreditCard,
      href: "/billing",
    },
    {
      title: "Current Plan",
      value: plan.charAt(0).toUpperCase() + plan.slice(1),
      icon: TrendingUp,
      href: "/billing",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Generate AI storyboards from your story ideas
          </p>
        </div>
        <Link href="/generate">
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            New Storyboard
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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

      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <Sparkles className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">Create a Storyboard</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Describe your story and AI will generate a complete storyboard with images.
          Download as PDF or ZIP when done.
        </p>
        <Link href="/generate">
          <Button className="gap-2">
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </Card>
    </div>
  );
}
