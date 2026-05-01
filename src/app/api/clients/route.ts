import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/clients - List clients (tenant-scoped)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = { ...tenantFilter };

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { dniRuc: { contains: search } },
        { celular: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const clients = await db.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clients.map((c) => ({
      id: c.id, fullName: c.fullName, dniRuc: c.dniRuc,
      celular: c.celular, email: c.email, ciudad: c.ciudad,
      direccion: c.direccion, notas: c.notas, isFrequent: c.isFrequent,
      totalPurchases: c.totalPurchases, totalSpent: c.totalSpent,
      createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
    })));
  } catch (error: unknown) {
    console.error("Error fetching clients:", error);
    const message = error instanceof Error ? error.message : "Error al obtener los clientes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/clients - Create client (tenant-scoped)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
    }

    const body = await request.json();
    const { fullName, dniRuc, celular, email, ciudad, direccion, notas } = body;

    if (!fullName) {
      return NextResponse.json({ error: "El nombre completo es obligatorio" }, { status: 400 });
    }

    const client = await db.client.create({
      data: {
        fullName, dniRuc: dniRuc || "", celular: celular || "",
        email: email || "", ciudad: ciudad || "", direccion: direccion || "",
        notas: notas || "", tenantId: currentUser.tenantId,
      },
    });

    return NextResponse.json({
      id: client.id, fullName: client.fullName, dniRuc: client.dniRuc,
      celular: client.celular, email: client.email, ciudad: client.ciudad,
      direccion: client.direccion, notas: client.notas, isFrequent: client.isFrequent,
      totalPurchases: client.totalPurchases, totalSpent: client.totalSpent,
      createdAt: client.createdAt.toISOString(), updatedAt: client.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating client:", error);
    const message = error instanceof Error ? error.message : "Error al crear el cliente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
