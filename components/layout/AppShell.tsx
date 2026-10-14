"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string; current?: boolean }>;
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* On mobile the sidebar is fixed/overlay so flex-1 fills the full width */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
          <Topbar onMenuClick={() => setMobileOpen((o) => !o)} />
          <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 sm:gap-6">
              {breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
              <div className="min-w-0">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
