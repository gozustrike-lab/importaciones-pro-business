import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Helper: verify SUPER_ADMIN role from header
function verifySuperAdmin(request: NextRequest): boolean {
  const role = request.headers.get("x-user-role");
  return role === "SUPER_ADMIN";
}

// GET /api/admin/tenants - List all tenants with user count, product count, plan, isActive
export async function GET(request: NextRequest) {
  try {
    if (!verifySuperAdmin(request)) {
      return NextResponse.json(
        { error: "Acceso no autorizado. Se requiere rol SUPER_ADMIN." },
        { status: 403 }
      );
    }

    const tenants = await db.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            products: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      tenants.map((t) => ({
        id: t.id,
        name: t.name,
        ruc: t.ruc,
        ownerName: t.ownerName,
        ownerEmail: t.ownerEmail,
        plan: t.plan,
        isActive: t.isActive,
        maxUsers: t.maxUsers,
        address: t.address,
        city: t.city,
        phone: t.phone,
        userCount: t._count.users,
        productCount: t._count.products,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return NextResponse.json(
      { error: "Error al obtener los tenants" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/tenants - Activate/deactivate tenant, change plan
export async function PATCH(request: NextRequest) {
  try {
    if (!verifySuperAdmin(request)) {
      return NextResponse.json(
        { error: "Acceso no autorizado. Se requiere rol SUPER_ADMIN." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, isActive, plan } = body;

    if (!id) {
      return NextResponse.json(
        { error: "El ID del tenant es obligatorio" },
        { status: 400 }
      );
    }

    // Build update data dynamically
    const data: Record<string, unknown> = {};
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (plan && ["free", "pro", "enterprise"].includes(plan)) data.plan = plan;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos para actualizar. Use isActive (boolean) o plan (free/pro/enterprise)" },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const existingTenant = await db.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenant = await db.tenant.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      ruc: tenant.ruc,
      plan: tenant.plan,
      isActive: tenant.isActive,
      updatedAt: tenant.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating tenant:", error);
    return NextResponse.json(
      { error: "Error al actualizar el tenant" },
      { status: 500 }
    );
  }
}
