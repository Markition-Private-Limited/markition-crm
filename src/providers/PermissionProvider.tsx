"use client";

import * as React from "react";
import type { SidebarModule } from "@/src/services/auth/rbac-config";
import { SIDEBAR_MODULES } from "@/src/services/auth/rbac-config";

type PermissionContextValue = {
  hasPermission: (permission: string) => boolean;
  canAccessPath: (pathname: string) => boolean;
  sidebarModules: SidebarModule[];
};

const PermissionContext = React.createContext<PermissionContextValue | undefined>(undefined);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const value = React.useMemo<PermissionContextValue>(
    () => ({
      hasPermission: () => true,
      canAccessPath: () => true,
      sidebarModules: SIDEBAR_MODULES,
    }),
    [],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissionProvider() {
  const context = React.useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissionProvider must be used within PermissionProvider");
  }
  return context;
}
