import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// Helper: verify SUPER_ADMIN role from header
function verifySuperAdmin(request: NextRequest): boolean {
  const role = request.headers.get("x-user-role");
  return role === "SUPER_ADMIN";
}

// GET /api/admin/users - List all users across all tenants (with tenant name)
export async function GET(request: NextRequest) {
  try {
    if (!verifySuperAdmin(request)) {
      return NextResponse.json(
        { error: "Acceso no autorizado. Se requiere rol SUPER_ADMIN." },
        { status: 403 }
      );
    }

    const users = await db.user.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        tenantId: u.tenantId,
        tenantName: u.tenant?.name ?? null,
        isActive: u.isActive,
        lastLogin: u.lastLogin?.toISOString() ?? null,
        image: u.image,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Error al obtener los usuarios" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users - Toggle user isActive, change role
export async function PATCH(request: NextRequest) {
  try {
    if (!verifySuperAdmin(request)) {
      return NextResponse.json(
        { error: "Acceso no autorizado. Se requiere rol SUPER_ADMIN." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, isActive, role } = body;

    if (!id) {
      return NextResponse.json(
        { error: "El ID del usuario es obligatorio" },
        { status: 400 }
      );
    }

    // Build update data dynamically
    const data: Record<string, unknown> = {};
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (role && ["SUPER_ADMIN", "TENANT_ADMIN", "TENANT_USER"].includes(role)) {
      data.role = role;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos para actualizar. Use isActive (boolean) o role (SUPER_ADMIN/TENANT_ADMIN/TENANT_USER)" },
        { status: 400 }
      );
    }

    // Verify user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = await db.user.update({
      where: { id },
      data,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name ?? null,
      isActive: user.isActive,
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Error al actualizar el usuario" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create a new user in a tenant
export async function POST(request: NextRequest) {
  try {
    if (!verifySuperAdmin(request)) {
      return NextResponse.json(
        { error: "Acceso no autorizado. Se requiere rol SUPER_ADMIN." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, password, role, tenantId } = body;

    // Validation
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Los campos email, nombre y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // Validate role if provided
    const userRole = role || "TENANT_USER";
    if (!["SUPER_ADMIN", "TENANT_ADMIN", "TENANT_USER"].includes(userRole)) {
      return NextResponse.json(
        { error: "Rol inválido. Use SUPER_ADMIN, TENANT_ADMIN o TENANT_USER" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con este email" },
        { status: 409 }
      );
    }

    // If tenantId is provided and role is not SUPER_ADMIN, verify tenant exists
    if (tenantId && userRole !== "SUPER_ADMIN") {
      const existingTenant = await db.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!existingTenant) {
        return NextResponse.json(
          { error: "Tenant no encontrado" },
          { status: 404 }
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: userRole,
        tenantId: tenantId || null,
        isActive: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name ?? null,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Error al crear el usuario" },
      { status: 500 }
    );
  }
}
