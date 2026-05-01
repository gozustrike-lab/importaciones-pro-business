import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateProductFinancials } from "@/lib/business-logic";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/products - List products (tenant-scoped)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const grade = searchParams.get("grade") || "";
    const available = searchParams.get("available") === "true";

    const where: Record<string, unknown> = { ...tenantFilter };

    if (available) {
      where.shippingStatus = { in: ["Entregado", "Perú"] };
    }

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { orderNumber: { contains: search } },
        { trackingId: { contains: search } },
      ];
    }

    if (status) {
      where.shippingStatus = status;
    }

    if (grade) {
      where.grade = grade;
    }

    const products = await db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        qualityChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
        trackingUpdates: { orderBy: { timestamp: "desc" }, take: 1 },
      },
    });

    const mapped = products.map((p) => ({
      id: p.id,
      orderNumber: p.orderNumber,
      description: p.description,
      category: p.category,
      model: p.model,
      color: p.color,
      capacity: p.capacity,
      grade: p.grade,
      serialNumber: p.serialNumber,
      quantity: p.quantity,
      condition: p.condition,
      status: p.shippingStatus,
      supplier: p.supplier,
      courier: p.courier,
      trackingNumber: p.trackingId,
      estimatedArrival: p.estimatedArrival?.toISOString() || "",
      screenOk: p.qualityChecks[0]?.screenOk ?? false,
      touchOk: p.qualityChecks[0]?.touchscreenOk ?? false,
      speakersOk: p.qualityChecks[0]?.speakersOk ?? false,
      microphoneOk: p.qualityChecks[0]?.microphoneOk ?? false,
      wifiOk: p.qualityChecks[0]?.wifiOk ?? false,
      bluetoothOk: p.qualityChecks[0]?.bluetoothOk ?? false,
      camerasOk: p.qualityChecks[0]?.cameraOk ?? false,
      portsOk: p.qualityChecks[0]?.portsOk ?? false,
      buttonsOk: p.qualityChecks[0]?.buttonsOk ?? false,
      keyboardOk: p.qualityChecks[0]?.keyboardOk ?? false,
      trackpadOk: p.qualityChecks[0]?.trackpadOk ?? false,
      chassisOk: p.qualityChecks[0]?.housingOk ?? false,
      batteryOk: p.qualityChecks[0]?.batteryOk ?? false,
      chargerIncluded: p.qualityChecks[0]?.chargerIncluded ?? false,
      originalBox: p.qualityChecks[0]?.originalBox ?? false,
      batteryCycles: p.batteryCycles,
      purchasePriceUSD: p.purchasePriceUsd,
      shippingCostUSD: p.shippingCostUsd,
      advertisingCostUSD: p.advertisingCostUsd,
      extraCostsUSD: p.extraCostsUsd,
      exchangeRate: p.exchangeRate,
      totalCostPEN: p.totalCostPen,
      taxesPEN: p.taxAmountPen,
      salePricePEN: p.salePricePen,
      suggestedPricePEN: p.suggestedPricePen,
      profitPEN: p.profitPen,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return NextResponse.json(mapped);
  } catch (error: unknown) {
    console.error("Error fetching products:", error);
    const message = error instanceof Error ? error.message : "Error al obtener los productos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/products - Create product (tenant-scoped)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
    }

    const body = await request.json();

    const {
      orderNumber, description, category, grade, condition, status,
      supplier, courier, trackingNumber, estimatedArrival,
      purchasePriceUSD, shippingCostUSD, advertisingCostUSD, extraCostsUSD,
      exchangeRate, salePricePEN,
    } = body;

    if (!description || purchasePriceUSD === undefined) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: description, purchasePriceUSD" },
        { status: 400 }
      );
    }

    // Get NRUS config for tenant
    const nrusConfig = await db.nRUSConfig.findFirst({
      where: { tenantId: currentUser.tenantId },
    });
    const configData = nrusConfig
      ? {
          adValoremRate: nrusConfig.adValoremRate,
          igvRate: nrusConfig.igvRate,
          perceptionRate: nrusConfig.perceptionRate,
          fobExemption: nrusConfig.fobExemption,
          cat1Threshold: nrusConfig.cat1Threshold,
          cat2Threshold: nrusConfig.cat2Threshold,
        }
      : undefined;

    const financials = calculateProductFinancials(
      purchasePriceUSD, shippingCostUSD || 0, advertisingCostUSD || 0,
      extraCostsUSD || 0, exchangeRate || 3.7, salePricePEN || 0, configData
    );

    const product = await db.product.create({
      data: {
        purchaseDate: new Date(),
        orderNumber: orderNumber || "",
        supplier: supplier || "eBay",
        courier: courier || "",
        trackingId: trackingNumber || "",
        shippingStatus: status || "USA",
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
        description, category: category || "",
        model: body.model || "", color: body.color || "",
        capacity: body.capacity || "", grade: grade || "A",
        condition: condition || "", serialNumber: body.serialNumber || "",
        quantity: body.quantity || 1, batteryCycles: body.batteryCycles || 0,
        purchasePriceUsd: purchasePriceUSD,
        shippingCostUsd: shippingCostUSD || 0,
        advertisingCostUsd: advertisingCostUSD || 0,
        extraCostsUsd: extraCostsUSD || 0,
        exchangeRate: exchangeRate || 3.7,
        totalCostPen: financials.totalCostPen,
        taxAmountPen: financials.taxAmountPen,
        adValoremPen: financials.adValoremPen,
        igvPen: financials.igvPen,
        perceptionPen: financials.perceptionPen,
        salePricePen: salePricePEN || 0,
        profitPen: financials.profitPen,
        profitMargin: financials.profitMargin,
        tenantId: currentUser.tenantId,
      },
    });

    return NextResponse.json({
      id: product.id,
      orderNumber: product.orderNumber,
      description: product.description,
      category: product.category,
      model: product.model,
      color: product.color,
      capacity: product.capacity,
      grade: product.grade,
      serialNumber: product.serialNumber,
      quantity: product.quantity,
      condition: product.condition,
      status: product.shippingStatus,
      supplier: product.supplier,
      courier: product.courier,
      trackingNumber: product.trackingId,
      estimatedArrival: product.estimatedArrival?.toISOString() || "",
      batteryCycles: product.batteryCycles,
      purchasePriceUSD: product.purchasePriceUsd,
      shippingCostUSD: product.shippingCostUsd,
      advertisingCostUSD: product.advertisingCostUsd,
      extraCostsUSD: product.extraCostsUsd,
      exchangeRate: product.exchangeRate,
      totalCostPEN: product.totalCostPen,
      taxesPEN: product.taxAmountPen,
      salePricePEN: product.salePricePen,
      suggestedPricePEN: product.suggestedPricePen,
      profitPEN: product.profitPen,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating product:", error);
    const message = error instanceof Error ? error.message : "Error al crear el producto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
