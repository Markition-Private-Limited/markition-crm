"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Briefcase, FileText, DollarSign, ClipboardList, Settings, Sparkles, UserRound } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Leads", href: "/leads", icon: Sparkles },
  { label: "Companies", href: "/companies", icon: Users },
  { label: "Contacts", href: "/contacts", icon: UserRound },
  { label: "Quotations", href: "/quotations", icon: FileText },
  { label: "Contracts", href: "/contracts", icon: DollarSign },
  { label: "Projects", href: "/projects", icon: Briefcase },
  { label: "Tasks", href: "/tasks", icon: ClipboardList },
  { label: "Invoices", href: "/invoices", icon: DollarSign },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 flex-col border-r border-slate-200 bg-slate-100/90 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-lg shadow-slate-900/20 dark:bg-slate-100 dark:text-slate-950">
          M
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Markition</p>
          <p className="text-base font-semibold text-slate-950 dark:text-slate-50">CRM Workspace</p>
        </div>
      </div>

      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-medium transition duration-200 ${
                active
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 dark:bg-slate-100 dark:text-slate-950"
                  : "text-slate-700 hover:-translate-y-0.5 hover:bg-slate-200 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition ${
                  active
                    ? "text-white dark:text-slate-950"
                    : "text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quick actions</p>
        <div className="mt-3 space-y-2">
          <Link
            href="/settings"
            className="block rounded-2xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-slate-100"
          >
            Manage team roles
          </Link>
          <Link
            href="/projects"
            className="block rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-200 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Review active projects
          </Link>
        </div>
      </div>
    </aside>
  );
}
