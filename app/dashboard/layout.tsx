import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";

export const metadata: Metadata = {
  title: "Dashboard | Markition CRM",
  description: "Operations dashboard for Markition CRM.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
