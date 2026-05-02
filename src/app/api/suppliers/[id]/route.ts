import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/suppliers/[id] - Get single supplier with links
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
      include: {
        supplierLinks: {
          orderBy: { createdAt: "desc" },
        },
        products: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      id: supplier.id,
      name: supplier.name,
      website: supplier.website,
      url: supplier.url,
      contactEmail: supplier.contactEmail,
      contactPhone: supplier.contactPhone,
      country: supplier.country,
      notes: supplier.notes,
      category: supplier.category,
      rating: supplier.rating,
      isActive: supplier.isActive,
      lastSyncAt: supplier.lastSyncAt?.toISOString() || null,
      totalProducts: supplier.totalProducts,
      totalOrders: supplier.totalOrders,
      totalSpentUsd: supplier.totalSpentUsd,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
      links: supplier.supplierLinks.map((l) => ({
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
      })),
      products: supplier.products.map((p) => ({
        id: p.id,
        description: p.description,
        category: p.category,
        grade: p.grade,
        shippingStatus: p.shippingStatus,
        purchasePriceUsd: p.purchasePriceUsd,
        salePricePen: p.salePricePen,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    console.error("Error fetching supplier:", error);
    const message = error instanceof Error ? error.message : "Error al obtener el proveedor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/suppliers/[id] - Update supplier
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);
    const { id } = await params;

    const existing = await db.supplier.findFirst({
      where: { id, ...tenantFilter },
    });

    if (!existing) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    }

    const body = await request.json();

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        website: body.website ?? existing.website,
        url: body.url ?? existing.url,
        contactEmail: body.contactEmail ?? existing.contactEmail,
        contactPhone: body.contactPhone ?? existing.contactPhone,
        country: body.country ?? existing.country,
        notes: body.notes ?? existing.notes,
        category: body.category ?? existing.category,
        rating: body.rating ?? existing.rating,
        isActive: body.isActive ?? existing.isActive,
        totalProducts: body.totalProducts ?? existing.totalProducts,
        totalOrders: body.totalOrders ?? existing.totalOrders,
        totalSpentUsd: body.totalSpentUsd ?? existing.totalSpentUsd,
      },
    });

    return NextResponse.json({
      id: supplier.id,
      name: supplier.name,
      website: supplier.website,
      url: supplier.url,
      contactEmail: supplier.contactEmail,
      contactPhone: supplier.contactPhone,
      country: supplier.country,
      notes: supplier.notes,
      category: supplier.category,
      rating: supplier.rating,
      isActive: supplier.isActive,
      lastSyncAt: supplier.lastSyncAt?.toISOString() || null,
      totalProducts: supplier.totalProducts,
      totalOrders: supplier.totalOrders,
      totalSpentUsd: supplier.totalSpentUsd,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    console.error("Error updating supplier:", error);
    const message = error instanceof Error ? error.message : "Error al actualizar el proveedor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/suppliers/[id] - Delete supplier
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);
    const { id } = await params;

    const existing = await db.supplier.findFirst({
      where: { id, ...tenantFilter },
    });

    if (!existing) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    }

    await db.supplier.delete({ where: { id } });

    return NextResponse.json({ message: "Proveedor eliminado correctamente" });
  } catch (error: unknown) {
    console.error("Error deleting supplier:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar el proveedor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
