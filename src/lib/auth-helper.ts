import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";

/**
 * Get the current authenticated user's info from JWT token.
 * Used in API routes for tenant isolation.
 */
export async function getCurrentUser() {
  // First try: read from middleware-injected headers
  const reqHeaders = await headers();
  let userId = reqHeaders.get("x-user-id");
  let userRole = reqHeaders.get("x-user-role");
  let tenantId = reqHeaders.get("x-tenant-id");

  // Fallback: decode JWT directly (for Vercel edge compatibility)
  if (!userId && !userRole) {
    try {
      const token = await getToken({
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === "production",
      });
      if (token) {
        userId = token.sub || "";
        userRole = (token.role as string) || "TENANT_USER";
        tenantId = (token.tenantId as string) || "";
      }
    } catch {
      // Token decode failed, continue with empty values
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
