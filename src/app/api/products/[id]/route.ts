import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateProductFinancials } from "@/lib/business-logic";

// GET /api/products/[id] - Get single product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id },
      include: {
        qualityChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    // Map to frontend format
    return NextResponse.json({
      id: product.id,
      orderNumber: product.orderNumber,
      description: product.description,
      category: product.category,
      grade: product.grade,
      condition: product.condition,
      status: product.shippingStatus,
      supplier: product.supplier,
      courier: product.courier,
      trackingNumber: product.trackingId,
      estimatedArrival: product.estimatedArrival?.toISOString() || "",
      screenOk: product.qualityChecks[0]?.screenOk ?? false,
      touchOk: product.qualityChecks[0]?.touchscreenOk ?? false,
      speakersOk: product.qualityChecks[0]?.speakersOk ?? false,
      microphoneOk: product.qualityChecks[0]?.microphoneOk ?? false,
      wifiOk: product.qualityChecks[0]?.wifiOk ?? false,
      bluetoothOk: product.qualityChecks[0]?.bluetoothOk ?? false,
      camerasOk: product.qualityChecks[0]?.cameraOk ?? false,
      portsOk: product.qualityChecks[0]?.portsOk ?? false,
      buttonsOk: product.qualityChecks[0]?.buttonsOk ?? false,
      keyboardOk: product.qualityChecks[0]?.keyboardOk ?? false,
      trackpadOk: product.qualityChecks[0]?.trackpadOk ?? false,
      chassisOk: product.qualityChecks[0]?.housingOk ?? false,
      batteryOk: product.qualityChecks[0]?.batteryOk ?? false,
      chargerIncluded: product.qualityChecks[0]?.chargerIncluded ?? false,
      originalBox: product.qualityChecks[0]?.originalBox ?? false,
      batteryCycles: product.batteryCycles,
      purchasePriceUSD: product.purchasePriceUsd,
      shippingCostUSD: product.shippingCostUsd,
      advertisingCostUSD: product.advertisingCostUsd,
      extraCostsUSD: product.extraCostsUsd,
      exchangeRate: product.exchangeRate,
      totalCostPEN: product.totalCostPen,
      taxesPEN: product.taxAmountPen,
      salePricePEN: product.salePricePen,
      profitPEN: product.profitPen,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Error al obtener el producto" },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.product.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    // Map frontend field names to DB field names
    const purchasePriceUsd = body.purchasePriceUSD ?? body.purchasePriceUsd;
    const shippingCostUsd = body.shippingCostUSD ?? body.shippingCostUsd;
    const advertisingCostUsd = body.advertisingCostUSD ?? body.advertisingCostUsd;
    const extraCostsUsd = body.extraCostsUSD ?? body.extraCostsUsd;
    const exchangeRate = body.exchangeRate;
    const salePricePen = body.salePricePEN ?? body.salePricePen;

    // Check if financial fields changed
    const financialFieldsChanged =
      (purchasePriceUsd !== undefined && purchasePriceUsd !== existing.purchasePriceUsd) ||
      (shippingCostUsd !== undefined && shippingCostUsd !== existing.shippingCostUsd) ||
      (advertisingCostUsd !== undefined && advertisingCostUsd !== existing.advertisingCostUsd) ||
      (extraCostsUsd !== undefined && extraCostsUsd !== existing.extraCostsUsd) ||
      (exchangeRate !== undefined && exchangeRate !== existing.exchangeRate) ||
      (salePricePen !== undefined && salePricePen !== existing.salePricePen);

    let financials = null;

    if (financialFieldsChanged) {
      const nrusConfig = await db.nRUSConfig.findFirst();
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

      financials = calculateProductFinancials(
        purchasePriceUsd !== undefined ? purchasePriceUsd : existing.purchasePriceUsd,
        shippingCostUsd !== undefined ? shippingCostUsd : existing.shippingCostUsd,
        advertisingCostUsd !== undefined ? advertisingCostUsd : existing.advertisingCostUsd,
        extraCostsUsd !== undefined ? extraCostsUsd : existing.extraCostsUsd,
        exchangeRate !== undefined ? exchangeRate : existing.exchangeRate,
        salePricePen !== undefined ? salePricePen : existing.salePricePen,
        configData
      );
    }

    // Build update data - map frontend names to DB names
    const updateData: Record<string, unknown> = {};

    if (body.orderNumber !== undefined) updateData.orderNumber = body.orderNumber;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.grade !== undefined) updateData.grade = body.grade;
    if (body.condition !== undefined) updateData.condition = body.condition;
    if (body.status !== undefined) updateData.shippingStatus = body.status;
    if (body.supplier !== undefined) updateData.supplier = body.supplier;
    if (body.courier !== undefined) updateData.courier = body.courier;
    if (body.trackingNumber !== undefined) updateData.trackingId = body.trackingNumber;
    if (body.estimatedArrival !== undefined) updateData.estimatedArrival = body.estimatedArrival ? new Date(body.estimatedArrival) : null;
    if (body.batteryCycles !== undefined) updateData.batteryCycles = body.batteryCycles;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (purchasePriceUsd !== undefined) updateData.purchasePriceUsd = purchasePriceUsd;
    if (shippingCostUsd !== undefined) updateData.shippingCostUsd = shippingCostUsd;
    if (advertisingCostUsd !== undefined) updateData.advertisingCostUsd = advertisingCostUsd;
    if (extraCostsUsd !== undefined) updateData.extraCostsUsd = extraCostsUsd;
    if (exchangeRate !== undefined) updateData.exchangeRate = exchangeRate;
    if (salePricePen !== undefined) updateData.salePricePen = salePricePen;

    // Add recalculated financials
    if (financials) {
      updateData.totalCostPen = financials.totalCostPen;
      updateData.taxAmountPen = financials.taxAmountPen;
      updateData.adValoremPen = financials.adValoremPen;
      updateData.igvPen = financials.igvPen;
      updateData.perceptionPen = financials.perceptionPen;
      updateData.profitPen = financials.profitPen;
      updateData.profitMargin = financials.profitMargin;
    }

    const product = await db.product.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: product.id,
      orderNumber: product.orderNumber,
      description: product.description,
      category: product.category,
      grade: product.grade,
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
      profitPEN: product.profitPen,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Error al actualizar el producto" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.product.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    await db.product.delete({ where: { id } });

    return NextResponse.json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Error al eliminar el producto" },
      { status: 500 }
    );
  }
}
