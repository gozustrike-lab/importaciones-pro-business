import { headers, cookies } from "next/headers";
import { getToken } from "next-auth/jwt";

/**
 * Get the current authenticated user's info from JWT token.
 * Used in API routes for tenant isolation.
 *
 * Strategy (3 layers):
 *   1. Read from middleware-injected headers (x-user-id, x-user-role, x-tenant-id)
 *   2. Fallback: decode JWT via cookies (for Vercel edge compatibility)
 */
export async function getCurrentUser() {
  // ── Layer 1: middleware-injected headers ──
  const reqHeaders = await headers();
  let userId = reqHeaders.get("x-user-id");
  let userRole = reqHeaders.get("x-user-role");
  let tenantId = reqHeaders.get("x-tenant-id");

  // ── Layer 2: direct JWT decode from cookies ──
  if (!userId && !userRole) {
    try {
      // Read cookies and build a fake req object for getToken
      const cookieStore = await cookies();
      const cookieString = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      const token = await getToken({
        secret: process.env.NEXTAUTH_SECRET,
        req: { headers: { cookie: cookieString } } as any,
      });

      if (token) {
        userId = token.sub || "";
        userRole = (token.role as string) || "TENANT_USER";
        tenantId = (token.tenantId as string) || "";
      }
    } catch {
      // Token decode failed — keep empty values (user will get 401/403 downstream)
    }
  }

  return {
    userId: userId || null,
    role: userRole || "TENANT_USER",
    tenantId: tenantId || null,
    isSuperAdmin: userRole === "SUPER_ADMIN",
  };
}

/**
 * Get the tenant filter for Prisma queries.
 * SUPER_ADMIN can optionally override with a specific tenantId.
 * Regular users are scoped to their own tenant.
 */
export function getTenantFilter(currentUser: { isSuperAdmin: boolean; tenantId: string | null }, overrideTenantId?: string) {
  if (currentUser.isSuperAdmin && overrideTenantId) {
    return { tenantId: overrideTenantId };
  }
  if (currentUser.isSuperAdmin && !overrideTenantId) {
    // SUPER_ADMIN without tenant filter sees all data (or specific tenant)
    return {};
  }
  if (!currentUser.tenantId) {
    throw new Error("Usuario sin tenant asignado");
  }
  return { tenantId: currentUser.tenantId };
}
