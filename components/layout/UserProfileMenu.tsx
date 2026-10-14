"use client";

import * as React from "react";
import { ChevronDown, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";

export function UserProfileMenu() {
  const router = useRouter();
  const { displayName, email, signOut, updatePassword } = useSessionProvider();

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const [showChangePw, setShowChangePw] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pwSubmitting, setPwSubmitting] = React.useState(false);
  const [pwError, setPwError] = React.useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = React.useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setMenuOpen(false);
    await signOut();
    router.replace("/login");
  };

  const openChangePw = () => {
    setMenuOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPwError(null);
    setPwSuccess(false);
    setShowChangePw(true);
  };

  const submitChangePw = async () => {
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwSubmitting(true);
    setPwError(null);
    const { error } = await updatePassword(newPassword);
    setPwSubmitting(false);
    if (error) {
      setPwError(error);
    } else {
      setPwSuccess(true);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex items-center gap-3 rounded-[20px] border border-border bg-surface px-3 py-2 text-sm shadow-sm shadow-black/5 transition hover:border-border/80"
        >
          <Avatar name={displayName} />
          <div className="hidden min-w-0 flex-col truncate sm:flex">
            <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{email || "Authenticated user"}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-3 w-60 overflow-hidden rounded-[20px] border border-border bg-surface shadow-2xl shadow-black/10">
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{email}</p>
            </div>
            <div className="border-t border-border" />
            <div className="space-y-1 p-3">
              <button
                type="button"
                onClick={openChangePw}
                className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left text-sm text-foreground transition hover:bg-surface-muted"
              >
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Change Password
              </button>
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
        )}
      </div>

      <Modal
        open={showChangePw}
        title="Change Password"
        onClose={() => setShowChangePw(false)}
      >
        {pwSuccess ? (
          <div className="space-y-4">
            <p className="rounded-[12px] bg-green-500/10 px-3 py-3 text-sm text-green-600 dark:text-green-400">
              Password updated successfully.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setShowChangePw(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                New Password <span className="text-danger">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Confirm Password <span className="text-danger">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat the new password"
                className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              />
            </div>

            {pwError && (
              <p className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">
                {pwError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowChangePw(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitChangePw}
                disabled={pwSubmitting || !newPassword || !confirmPassword}
              >
                {pwSubmitting ? "Saving…" : "Update Password"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
