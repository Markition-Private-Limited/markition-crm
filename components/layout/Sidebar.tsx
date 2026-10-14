"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Home, ClipboardList,
  Building2, Briefcase, Target, X, Clock, CalendarDays, BarChart2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionProvider, type AppRole } from "@/src/providers/SessionProvider";

type NavItem = { label: string; href: string; icon: React.ElementType; roles: AppRole[] };
type NavSection = { heading: string; items: NavItem[] };

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",      href: "/dashboard",  icon: Home,          roles: ["admin", "project_manager", "sales"] },
  { label: "Clients",        href: "/companies",  icon: Building2,     roles: ["admin", "project_manager"] },
  { label: "Prospects",      href: "/prospects",  icon: Target,        roles: ["admin", "sales"] },
  { label: "Active Clients", href: "/clients",    icon: Briefcase,     roles: ["admin", "project_manager", "sales"] },
  { label: "Tasks",          href: "/tasks",      icon: ClipboardList, roles: ["admin", "project_manager"] },
];

const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Admin",
    items: [
      { label: "Employees", href: "/admin/employees", icon: Users, roles: ["admin"] },
    ],
  },
  {
    heading: "Attendance",
    items: [
      { label: "Shifts",    href: "/admin/attendance/shifts",   icon: Clock,        roles: ["admin"] },
      { label: "Calendar",  href: "/admin/attendance/calendar",  icon: CalendarDays, roles: ["admin"] },
      { label: "Analytics", href: "/admin/attendance/analytics", icon: BarChart2,    roles: ["admin"] },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { appRole } = useSessionProvider();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("markition-crm-sidebar-collapsed");
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  // Close mobile drawer on route change
  React.useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem("markition-crm-sidebar-collapsed", String(next));
      return next;
    });
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !appRole || item.roles.includes(appRole),
  );

  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !appRole || item.roles.includes(appRole)),
    }))
    .filter((section) => section.items.length > 0);

  const renderItem = (item: NavItem, idx: number, opts?: { collapsed?: boolean }) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const col = opts?.collapsed;
    return (
      <Link
        key={idx}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center rounded-[18px] py-3 text-sm font-medium transition ${
          col ? "justify-center px-0" : "gap-3 px-3"
        } ${
          active
            ? "bg-foreground text-background shadow-sm shadow-black/10"
            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? "text-background" : "text-muted-foreground"}`} />
        {!col && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* ── Mobile drawer ───────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-border bg-surface px-3 py-4 transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-foreground text-background shadow-sm shadow-black/10">
            M
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Markition</p>
            <p className="text-sm font-semibold text-foreground">CRM Workspace</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleItems.map((item, i) => renderItem(item, i))}
          {visibleSections.map((section) => (
            <div key={section.heading} className="pt-4">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {section.heading}
              </p>
              {section.items.map((item, i) => renderItem(item, i))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <aside
        className={`sticky top-0 hidden h-screen flex-col border-r border-border bg-surface/90 px-3 py-4 backdrop-blur-xl md:flex ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "gap-3 px-2"}`}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-foreground text-background shadow-sm shadow-black/10">
            M
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Markition</p>
              <p className="text-sm font-semibold text-foreground">CRM Workspace</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleItems.map((item, i) => renderItem(item, i, { collapsed }))}
          {visibleSections.map((section) => (
            <div key={section.heading} className="pt-4">
              {!collapsed && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {section.heading}
                </p>
              )}
              {collapsed && <div className="my-2 border-t border-border/50" />}
              {section.items.map((item, i) => renderItem(item, i, { collapsed }))}
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-3 pt-4">
          <Button
            variant="ghost"
            size="sm"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`w-full rounded-[16px] border border-border bg-surface-muted text-foreground ${collapsed ? "justify-center" : "justify-start"}`}
            onClick={toggleCollapsed}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4 shrink-0" />
              : <><ChevronLeft className="h-4 w-4 shrink-0" /><span className="ml-1 truncate">Collapse</span></>
            }
          </Button>
        </div>
      </aside>
    </>
  );
}
