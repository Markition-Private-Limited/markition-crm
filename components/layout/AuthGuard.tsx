"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSessionProvider } from "@/src/providers/SessionProvider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useSessionProvider();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [isLoading, token, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  return <>{children}</>;
}
