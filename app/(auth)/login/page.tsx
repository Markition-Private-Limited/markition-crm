"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/src/modules/auth/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { signIn } = useAuth();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: authError } = await signIn(email, password, rememberMe);
    if (authError) {
      setError(authError);
      setIsSubmitting(false);
    } else {
      router.replace("/dashboard");
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.2fr_1fr]">
        <section className="relative hidden overflow-hidden border-r border-border bg-[#0B1A78] px-10 py-12 text-white lg:block xl:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_88%_70%,rgba(56,189,248,0.16),transparent_42%)]" />
          <div className="relative mx-auto flex h-full w-full max-w-xl flex-col">
            <div className="inline-flex items-center gap-3">
              <Image
                src="/brand/markition-logo-white.svg"
                alt="Markition"
                width={246}
                height={50}
                priority
                className="h-10 w-auto"
              />
            </div>

            <div className="mt-16 space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/65">Welcome</p>
              <h1 className="max-w-lg text-5xl font-semibold leading-tight text-white">Welcome to Markition CRM</h1>
              <p className="text-xl font-semibold text-white/90">From Code to Conversion</p>
              <p className="max-w-lg text-base text-white/80">Markition is your one-stop digital solutions provider.</p>
            </div>

            <div className="mt-10 rounded-3xl border border-white/20 bg-white/10 p-6 shadow-lg shadow-black/20 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Workspace Overview</p>
                <span className="rounded-full border border-white/30 bg-white/20 px-2 py-1 text-xs font-semibold text-white">Live</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/70">Active Projects</p>
                  <p className="mt-2 text-2xl font-semibold text-white">3</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/70">Open Tasks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">12</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/70">Tasks Due</p>
                  <p className="mt-2 text-2xl font-semibold text-white">4</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/70">Team Members</p>
                  <p className="mt-2 text-2xl font-semibold text-white">4</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-start justify-center px-5 py-10 sm:px-10 lg:items-center">
          <div className="w-full max-w-md space-y-7">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Markition CRM</p>
              <h2 className="text-3xl font-semibold text-foreground">Welcome Back</h2>
              <p className="text-sm text-muted-foreground">Sign in to continue to your workspace.</p>
            </div>

            <Form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 inline-block text-sm font-medium text-foreground">Email</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@markition.com"
                    className="pl-9"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 inline-block text-sm font-medium text-foreground">Password</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="pl-9 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Remember me
                </label>
              </div>

              {error ? (
                <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign In"} <ArrowRight className="h-4 w-4" />
              </Button>

              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Access requires valid account, active profile, and assigned role.
              </p>
            </Form>
          </div>
        </section>
      </div>
    </main>
  );
}
