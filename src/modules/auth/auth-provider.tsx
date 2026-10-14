"use client";

import { SessionProvider, useSessionProvider } from "@/src/providers/SessionProvider";
import { PermissionProvider, usePermissionProvider } from "@/src/providers/PermissionProvider";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PermissionProvider>{children}</PermissionProvider>
    </SessionProvider>
  );
}

export function useAuth() {
  return useSessionProvider();
}

export function usePermissions() {
  return usePermissionProvider();
}
