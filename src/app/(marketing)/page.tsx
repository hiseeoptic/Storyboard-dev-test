import Link from "next/link";
import { Film, Sparkles, Zap, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Film className="h-5 w-5" />
            StoryboardAI
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-24 text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl">
            Create Storyboards
            <br />
            <span className="text-primary/70">with AI Power</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Transform your script ideas into professional storyboards in minutes.
            AI-generated scenes with precise camera angles, shot types, and visual
            descriptions for filmmakers, animators, and content creators.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg">
                See Features
              </Button>
            </Link>
          </div>
        </section>

        <section id="features" className="border-t bg-muted/50 py-24">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Everything You Need
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <FeatureCard
                icon={Sparkles}
                title="AI Scene Generation"
                description="Describe your scene and get professional storyboard illustrations with appropriate camera angles and compositions."
              />
              <FeatureCard
                icon={Zap}
                title="Instant Results"
                description="Generate complete storyboard sequences in seconds. Iterate quickly with AI-powered editing and refinement."
              />
              <FeatureCard
                icon={Download}
                title="Production Export"
                description="Export storyboards as PDF, PowerPoint, or video sequences ready for production meetings and pre-visualization."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4">
          StoryboardAI &mdash; AI-powered storyboard generation for filmmakers.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <Icon className="mb-4 h-8 w-8 text-primary" />
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
