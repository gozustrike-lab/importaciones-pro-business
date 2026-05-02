import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/suppliers/[id]/links - List links for supplier
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);
    const { id } = await params;

    const supplier = await db.supplier.findFirst({
      where: { id, ...tenantFilter },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    }

    const links = await db.supplierLink.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      links.map((l) => ({
        id: l.id,
        title: l.title,
        url: l.url,
        type: l.type,
        priceUsd: l.priceUsd,
        pricePen: l.pricePen,
        status: l.status,
        notes: l.notes,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      }))
    );
  } catch (error: unknown) {
    console.error("Error fetching supplier links:", error);
    const message = error instanceof Error ? error.message : "Error al obtener los enlaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/suppliers/[id]/links - Add new link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);
    const { id } = await params;

    const supplier = await db.supplier.findFirst({
      where: { id, ...tenantFilter },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { title } = body;

    if (!title) {
      return NextResponse.json(
        { error: "El título del enlace es obligatorio" },
        { status: 400 }
      );
    }

    const link = await db.supplierLink.create({
      data: {
        title,
        url: body.url || "",
        type: body.type || "url",
        priceUsd: body.priceUsd || 0,
        pricePen: body.pricePen || 0,
        status: body.status || "active",
        notes: body.notes || "",
        supplierId: id,
      },
    });

    return NextResponse.json({
      id: link.id,
      title: link.title,
      url: link.url,
      type: link.type,
      priceUsd: link.priceUsd,
      pricePen: link.pricePen,
      status: link.status,
      notes: link.notes,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating supplier link:", error);
    const message = error instanceof Error ? error.message : "Error al crear el enlace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
