import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/nrus/config - Get NRUS configuration (tenant-scoped)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    let config = await db.nRUSConfig.findFirst({ where: tenantFilter });

    if (!config && currentUser.tenantId) {
      config = await db.nRUSConfig.create({
        data: {
          ruc: "10762026835",
          businessName: "Importaciones Perú",
          cat1Threshold: 5000, cat2Threshold: 8000,
          igvRate: 0.18, adValoremRate: 0.04,
          perceptionRate: 0.10, fobExemption: 200,
          tenantId: currentUser.tenantId,
        },
      });
    }

    if (!config) {
      return NextResponse.json({ category1Limit: 5000, category2Limit: 8000, igvRate: 18, adValoremRate: 4, percepcionRate: 10 });
    }

    return NextResponse.json({
      category1Limit: config.cat1Threshold,
      category2Limit: config.cat2Threshold,
      igvRate: config.igvRate * 100,
      adValoremRate: config.adValoremRate * 100,
      percepcionRate: config.perceptionRate * 100,
    });
  } catch (error: unknown) {
    console.error("Error fetching NRUS config:", error);
    return NextResponse.json({ error: "Error al obtener la configuración NRUS" }, { status: 500 });
  }
}

// PUT /api/nrus/config - Update NRUS configuration (tenant-scoped)
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
    }

    const body = await request.json();
    let config = await db.nRUSConfig.findFirst({ where: { tenantId: currentUser.tenantId } });

    const data = {
      cat1Threshold: body.category1Limit ?? 5000,
      cat2Threshold: body.category2Limit ?? 8000,
      igvRate: (body.igvRate ?? 18) / 100,
      adValoremRate: (body.adValoremRate ?? 4) / 100,
      perceptionRate: (body.percepcionRate ?? 10) / 100,
    };

    if (!config) {
      config = await db.nRUSConfig.create({
        data: { ruc: "10762026835", businessName: "Importaciones Perú", ...data, fobExemption: 200, tenantId: currentUser.tenantId },
      });
    } else {
      config = await db.nRUSConfig.update({ where: { id: config.id }, data });
    }

    return NextResponse.json({
      category1Limit: config.cat1Threshold, category2Limit: config.cat2Threshold,
      igvRate: config.igvRate * 100, adValoremRate: config.adValoremRate * 100,
      percepcionRate: config.perceptionRate * 100,
    });
  } catch (error: unknown) {
    console.error("Error updating NRUS config:", error);
    return NextResponse.json({ error: "Error al actualizar la configuración NRUS" }, { status: 500 });
  }
}
