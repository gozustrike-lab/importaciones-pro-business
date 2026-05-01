import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// POST /api/auth/register - Register new tenant + admin user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyName,
      ruc,
      ownerName,
      email,
      password,
    } = body;

    // Validation
    if (!companyName || !ruc || !ownerName || !email || !password) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios: Empresa, RUC, Nombre, Email, Contraseña" },
        { status: 400 }
      );
    }

    // Check if email exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este email" },
        { status: 409 }
      );
    }

    // Check if RUC exists
    const existingTenant = await db.tenant.findUnique({ where: { ruc } });
    if (existingTenant) {
      return NextResponse.json(
        { error: "Ya existe una empresa registrada con este RUC" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create Tenant + User in transaction
    const tenant = await db.tenant.create({
      data: {
        name: companyName,
        ruc,
        ownerName,
        ownerEmail: email,
        users: {
          create: {
            email,
            name: ownerName,
            password: hashedPassword,
            role: "TENANT_ADMIN",
            isActive: true,
          },
        },
      },
      include: {
        users: true,
      },
    });

    // Create default NRUS config for the tenant
    await db.nRUSConfig.create({
      data: {
        ruc,
        businessName: companyName,
        cat1Threshold: 5000,
        cat2Threshold: 8000,
        igvRate: 0.18,
        adValoremRate: 0.04,
        perceptionRate: 0.10,
        fobExemption: 200,
        tenantId: tenant.id,
      },
    });

    return NextResponse.json({
      message: "Cuenta creada exitosamente",
      tenant: {
        id: tenant.id,
        name: tenant.name,
        ruc: tenant.ruc,
      },
      user: {
        id: tenant.users[0].id,
        email: tenant.users[0].email,
        name: tenant.users[0].name,
        role: tenant.users[0].role,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error registering:", error);
    return NextResponse.json(
      { error: "Error al crear la cuenta" },
      { status: 500 }
    );
  }
}
