import { getRequiredPermissionForPath, SIDEBAR_MODULES, type SidebarModule } from "./rbac-config";

type PermissionContext = {
  permissions: string[];
  isAdmin?: boolean;
};

function normalize(permission: string) {
  return permission.trim().toLowerCase();
}

export class PermissionService {
  static hasPermission(context: PermissionContext, permission: string) {
    if (context.isAdmin) {
      return true;
    }

    const normalizedRequired = normalize(permission);
    const normalizedUserPermissions = new Set(context.permissions.map((item) => normalize(item)));

    return normalizedUserPermissions.has("*")
      || normalizedUserPermissions.has(normalizedRequired);
  }

  static canAccessPath(context: PermissionContext, pathname: string) {
    const required = getRequiredPermissionForPath(pathname);
    if (!required) {
      return true;
    }

    return this.hasPermission(context, required);
  }

  static filterSidebarModules(context: PermissionContext, modules: SidebarModule[] = SIDEBAR_MODULES) {
    return modules.filter((module) => this.hasPermission(context, module.permission));
  }
}
