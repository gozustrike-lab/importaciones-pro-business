import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";

/**
 * Get the current authenticated user's info from JWT token.
 * Used in API routes for tenant isolation.
 */
export async function getCurrentUser() {
  const reqHeaders = await headers();
  const userId = reqHeaders.get("x-user-id");
  const userRole = reqHeaders.get("x-user-role");
  const tenantId = reqHeaders.get("x-tenant-id");

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
