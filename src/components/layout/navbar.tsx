"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Film,
  LayoutDashboard,
  FolderOpen,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Film className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden sm:inline">StoryboardAI</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2",
                    pathname.startsWith(item.href) &&
                      "bg-accent text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="hidden gap-2 md:flex"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t p-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3",
                    pathname.startsWith(item.href) &&
                      "bg-accent text-accent-foreground"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start gap-3 text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
