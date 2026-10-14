export type AuthRole = string;

export type AuthContextValue = {
  user: null;
  session: null;
  profile: { fullName?: string; email?: string } | null;
  roles: AuthRole[];
  permissions: string[];
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: null }>;
  updatePassword: (password: string) => Promise<{ error: null }>;
  refreshAuthState: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
};
