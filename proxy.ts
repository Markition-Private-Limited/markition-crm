import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContextFromToken, type AppRole } from "@/lib/auth/require-role";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

const PUBLIC_FILE = /^\/_next\/.+|\/.+\.(.*)$/;

// Server-side guard for the attendance and admin areas. Any route not listed
// here passes through unchanged, so existing CRM pages behave as before.
// Roles come from the same mapping as lib/auth/require-role.ts.
const PROTECTED_ROUTES: Array<{ prefix: string; roles?: AppRole[] }> = [
  { prefix: "/attendance" },
  { prefix: "/admin", roles: ["admin"] },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check protected routes before the static-file bypass. PUBLIC_FILE matches
  // any path containing a dot, so /admin/report.pdf would otherwise skip the guard.
  const rule = PROTECTED_ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );

  if (rule) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const ctx = token ? await getAuthContextFromToken(token) : null;

    if (!ctx) {
      const res = NextResponse.redirect(new URL("/login", request.url));
      if (token) res.cookies.delete(SESSION_COOKIE);
      return res;
    }

    if (rule.roles && !rule.roles.includes(ctx.role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (PUBLIC_FILE.test(pathname) || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|favicon.ico).*)"]
};
