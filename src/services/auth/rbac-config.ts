export type PermissionKey = string;

export type SidebarModule = {
  label: string;
  href: string;
  icon: string;
  permission: PermissionKey;
};

export const AUTH_PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", "/403", "/access-denied"];

export const ADMIN_ROLE_NAMES = new Set([
  "admin",
  "super admin",
  "superadmin",
  "super_admin",
  "owner",
]);

const ENTITY_ALIASES: Record<string, string> = {
  client: "companies",
  clients: "companies",
  company: "companies",
  user: "users",
  quotation: "deals",
  quotations: "deals",
  contract: "deals",
  contracts: "deals",
};

const ACTION_ALIASES: Record<string, "view" | "manage"> = {
  view: "view",
  read: "view",
  list: "view",
  create: "manage",
  update: "manage",
  delete: "manage",
  edit: "manage",
  write: "manage",
  manage: "manage",
};

function normalizeEntity(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return ENTITY_ALIASES[normalized] ?? normalized;
}

export function toDbPermissionName(permission: string): string {
  const raw = permission.trim().toLowerCase();
  if (!raw) {
    return raw;
  }

  if (raw === "*") {
    return raw;
  }

  if (raw.startsWith("view_") || raw.startsWith("manage_")) {
    const [action, ...rest] = raw.split("_");
    return `${action}_${normalizeEntity(rest.join("_"))}`;
  }

  if (raw.includes(".")) {
    const [entityRaw, actionRaw] = raw.split(".");
    const action = ACTION_ALIASES[actionRaw] ?? "view";
    return `${action}_${normalizeEntity(entityRaw)}`;
  }

  if (raw.includes("_")) {
    const [head, ...rest] = raw.split("_");
    if (head in ACTION_ALIASES) {
      return `${ACTION_ALIASES[head]}_${normalizeEntity(rest.join("_"))}`;
    }
  }

  return `view_${normalizeEntity(raw)}`;
}

export const SIDEBAR_MODULES: SidebarModule[] = [
  { label: "Dashboard", href: "/dashboard", icon: "Home", permission: "view_dashboard" },
  { label: "Projects", href: "/projects", icon: "Briefcase", permission: "view_projects" },
  { label: "Tasks", href: "/tasks", icon: "ClipboardList", permission: "view_tasks" },
];

const ROUTE_PERMISSION_RULES: Array<{ prefix: string; permission: PermissionKey }> = [
  { prefix: "/dashboard", permission: "view_dashboard" },
  { prefix: "/companies", permission: "view_companies" },
  { prefix: "/contacts", permission: "view_contacts" },
  { prefix: "/leads", permission: "view_leads" },
  { prefix: "/quotations", permission: "view_deals" },
  { prefix: "/contracts", permission: "view_deals" },
  { prefix: "/projects", permission: "view_projects" },
  { prefix: "/tasks", permission: "view_tasks" },
  { prefix: "/invoices", permission: "view_invoices" },
  { prefix: "/settings", permission: "manage_users" },
  { prefix: "/users", permission: "view_users" },
  { prefix: "/reports", permission: "view_reports" },
];

export function getRequiredPermissionForPath(pathname: string): PermissionKey | null {
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.permission;
    }
  }
  return null;
}
