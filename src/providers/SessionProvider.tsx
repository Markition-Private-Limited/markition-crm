"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

// Decode JWT payload locally — no network call needed for userId/email
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } },
);

// Mirror the session into the httpOnly cookie that proxy.ts verifies.
// Pass a token to set or refresh it, or null to clear it.
async function syncServerSession(accessToken: string | null) {
  try {
    await fetch("/api/auth/session", accessToken
      ? { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
      : { method: "DELETE" });
  } catch {
    // Best-effort. CRM pages still work client-side without the cookie.
  }
}

export type AppRole = "admin" | "project_manager" | "sales";

type SessionContextValue = {
  token: string | null;
  userId: string | null;
  appRole: AppRole | null;
  email: string;
  displayName: string;
  isLoading: boolean;
  isAdmin: boolean;
  roles: string[];
  permissions: string[];
  profile: { fullName?: string; email?: string } | null;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshAuthState: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
};

const SessionContext = React.createContext<SessionContextValue | undefined>(undefined);

const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: ["*"],
  project_manager: ["view_dashboard", "view_companies", "view_contacts", "view_tasks", "manage_companies", "manage_contacts", "manage_tasks"],
  sales: ["view_dashboard", "view_leads", "view_prospects", "manage_leads", "manage_prospects"],
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [appRole, setAppRole] = React.useState<AppRole | null>(null);
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("Workspace User");
  const [isLoading, setIsLoading] = React.useState(true);

  // Cache role per userId to avoid re-fetching on every token refresh
  const roleCache = React.useRef<Map<string, { role: AppRole; displayName: string }>>(new Map());

  const hydrate = React.useCallback(async (accessToken: string, userEmail: string) => {
    setToken(accessToken);
    setEmail(userEmail);
    void syncServerSession(accessToken);

    // Extract userId from JWT locally — no network call
    const payload = decodeJwtPayload(accessToken);
    const uid = payload?.sub as string | undefined;
    if (uid) setUserId(uid);

    // Return immediately if we already know this user's role
    if (uid && roleCache.current.has(uid)) {
      const cached = roleCache.current.get(uid)!;
      setAppRole(cached.role);
      setDisplayName(cached.displayName);
      return;
    }

    // First time for this userId — fetch role from server
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const role = data.role ?? null;
        const displayName = data.displayName ?? userEmail;
        setAppRole(role);
        setDisplayName(displayName);
        if (uid && role) roleCache.current.set(uid, { role, displayName });
      }
    } catch {
      // token set; role will be null but user is still authenticated
    }
  }, []);

  React.useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await hydrate(session.access_token, session.user.email ?? "");
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await hydrate(session.access_token, session.user.email ?? "");
      } else {
        void syncServerSession(null);
        setToken(null);
        setUserId(null);
        setAppRole(null);
        setEmail("");
        setDisplayName("Workspace User");
      }
    });

    return () => subscription.unsubscribe();
  }, [hydrate]);

  const signIn = React.useCallback(
    async (emailInput: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailInput, password });
      // Await here so the cookie exists before the login page navigates.
      if (!error && data.session) await syncServerSession(data.session.access_token);
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    await syncServerSession(null);
    setToken(null);
    setUserId(null);
    setAppRole(null);
    setEmail("");
  }, []);

  const requestPasswordReset = React.useCallback(async (emailInput: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(emailInput);
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = React.useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }, []);

  const refreshAuthState = React.useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await hydrate(session.access_token, session.user.email ?? "");
  }, [hydrate]);

  const hasPermission = React.useCallback(
    (permission: string) => {
      if (!appRole) return false;
      const perms = ROLE_PERMISSIONS[appRole] ?? [];
      return perms.includes("*") || perms.includes(permission);
    },
    [appRole],
  );

  const value = React.useMemo<SessionContextValue>(
    () => ({
      token,
      userId,
      appRole,
      email,
      displayName,
      isLoading,
      isAdmin: appRole === "admin",
      roles: appRole ? [appRole] : [],
      permissions: appRole ? ROLE_PERMISSIONS[appRole] : [],
      profile: { fullName: displayName, email },
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshAuthState,
      hasPermission,
    }),
    [token, userId, appRole, email, displayName, isLoading, signIn, signOut, requestPasswordReset, updatePassword, refreshAuthState, hasPermission],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionProvider() {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSessionProvider must be used within SessionProvider");
  return context;
}
