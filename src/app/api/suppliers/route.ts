import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/suppliers - List all suppliers (tenant-scoped)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const suppliers = await db.supplier.findMany({
      where: tenantFilter,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            products: true,
            supplierLinks: true,
          },
        },
      },
    });

    const mapped = suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      website: s.website,
      url: s.url,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      country: s.country,
      notes: s.notes,
      category: s.category,
      rating: s.rating,
      isActive: s.isActive,
      lastSyncAt: s.lastSyncAt?.toISOString() || null,
      totalProducts: s.totalProducts,
      totalOrders: s.totalOrders,
      totalSpentUsd: s.totalSpentUsd,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      linkCount: s._count.supplierLinks,
      productCount: s._count.products,
    }));

    return NextResponse.json(mapped);
  } catch (error: unknown) {
    console.error("Error fetching suppliers:", error);
    const message = error instanceof Error ? error.message : "Error al obtener los proveedores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/suppliers - Create new supplier
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del proveedor es obligatorio" },
        { status: 400 }
      );
    }

    const supplier = await db.supplier.create({
      data: {
        name,
        website: body.website || "",
        url: body.url || "",
        contactEmail: body.contactEmail || "",
        contactPhone: body.contactPhone || "",
        country: body.country || "",
        notes: body.notes || "",
        category: body.category || "general",
        rating: body.rating || 0,
        isActive: body.isActive !== undefined ? body.isActive : true,
        totalProducts: body.totalProducts || 0,
        totalOrders: body.totalOrders || 0,
        totalSpentUsd: body.totalSpentUsd || 0,
        tenantId: currentUser.tenantId,
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
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating supplier:", error);
    const message = error instanceof Error ? error.message : "Error al crear el proveedor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
