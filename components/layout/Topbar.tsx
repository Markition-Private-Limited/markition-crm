"use client";

import { Bell, Search, Moon, Sun, ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useSessionProvider } from "@/src/providers/SessionProvider";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  sales: "Sales",
};

const profileOptions: { label: string; href: string }[] = [];

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { mode, toggleMode } = useTheme();
  const { displayName, email, appRole, signOut } = useSessionProvider();

  const displayEmail = email;
  const roleLabel = appRole ? ROLE_LABELS[appRole] : "";

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setMenuOpen(false);
    await signOut();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-border bg-surface text-foreground md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="hidden min-w-0 flex-1 md:block">
            <label className="flex h-10 items-center gap-3 rounded-[18px] border border-border bg-surface px-4 text-sm shadow-sm shadow-black/5">
              <Search className="h-4.5 w-4.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search clients, leads, tasks..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleMode}>
            {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className="relative">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-border bg-surface text-foreground shadow-sm shadow-black/5 transition hover:bg-surface-muted"
              onClick={() => setNotifOpen((open) => !open)}
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <span className="pointer-events-none absolute right-1 top-1 inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />

            {notifOpen ? (
              <div className="absolute right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-[20px] border border-border bg-surface p-4 shadow-2xl shadow-black/10 sm:w-96">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  <Button variant="ghost" size="sm" onClick={() => setNotifOpen(false)}>
                    Dismiss
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="rounded-[18px] bg-surface-muted p-4">
                    <p className="text-sm font-semibold text-foreground">New lead assigned</p>
                    <p className="mt-1 text-sm text-muted-foreground">A sales rep was assigned to follow up with Acme Corp.</p>
                  </div>
                  <div className="rounded-[18px] bg-surface-muted p-4">
                    <p className="text-sm font-semibold text-foreground">Invoice overdue</p>
                    <p className="mt-1 text-sm text-muted-foreground">Invoice #INV-042 is 3 days past due.</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex items-center gap-3 rounded-[18px] border border-border bg-surface px-3 py-2 text-sm shadow-sm shadow-black/5 transition hover:bg-surface-muted"
            >
              <Avatar name={displayName} />
              <div className="hidden min-w-0 flex-col truncate sm:flex">
                <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{roleLabel || displayEmail || "Authenticated user"}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 z-50 mt-3 w-60 overflow-hidden rounded-[20px] border border-border bg-surface shadow-2xl shadow-black/10">
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{displayEmail}</p>
                  {roleLabel ? <p className="mt-0.5 text-xs text-accent">{roleLabel}</p> : null}
                </div>
                <div className="border-t border-border" />
                <div className="space-y-1 p-3">
                  {profileOptions.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="block rounded-[14px] px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="block w-full rounded-[14px] px-3 py-2 text-left text-sm text-foreground transition hover:bg-surface-muted disabled:opacity-60"
                  >
                    {isSigningOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
