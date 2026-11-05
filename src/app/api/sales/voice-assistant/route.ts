import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { recordSaleInEbayExcel } from "@/lib/excel-compras-writer";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    let tenantId = currentUser.tenantId;

    if (!tenantId) {
      const defaultTenant = await db.tenant.findFirst();
      if (!defaultTenant) {
        return NextResponse.json({ error: "No se encontró ningún Tenant en el sistema" }, { status: 400 });
      }
      tenantId = defaultTenant.id;
    }

    const body = await request.json();
    const rawText: string = (body.text || "").trim();
    let productId: string = body.productId || "";
    let salePricePen: number = Number(body.salePricePen) || 0;
    let paymentMethod: string = body.paymentMethod || "";
    let clientName: string = (body.clientName || "").trim();
    let saleChannel: string = body.saleChannel || "WhatsApp / TikTok Live";

    // ── 1. NATURAL LANGUAGE / VOICE EXTRACTION ─────────────────────────
    if (rawText) {
      const lower = rawText.toLowerCase();

      // A. Extract Price if not provided
      if (!salePricePen) {
        // Match expressions like "a 1200", "s/ 1200", "1200 soles", "por 1150"
        const priceMatch = rawText.match(/(?:s\/?\.?|soles|a|por|precio|en)?\s*(\d{2,5}(?:\.\d{1,2})?)\s*(?:soles|pen)?/i);
        if (priceMatch && priceMatch[1]) {
          const parsed = parseFloat(priceMatch[1]);
          if (parsed >= 50 && parsed <= 25000) {
            salePricePen = parsed;
          }
        }
      }

      // B. Extract Payment Method
      if (!paymentMethod) {
        if (lower.includes("yape")) paymentMethod = "Yape";
        else if (lower.includes("plin")) paymentMethod = "Plin";
        else if (lower.includes("bcp")) paymentMethod = "BCP";
        else if (lower.includes("bbva")) paymentMethod = "BBVA";
        else if (lower.includes("interbank")) paymentMethod = "Interbank";
        else if (lower.includes("efectivo")) paymentMethod = "Efectivo";
        else if (lower.includes("transferencia")) paymentMethod = "Transferencia";
        else if (lower.includes("tarjeta")) paymentMethod = "Tarjeta";
        else paymentMethod = "Yape / Transferencia";
      }

      // C. Extract Client Name (e.g. "a Carlos Gómez", "cliente Juan", "para María")
      if (!clientName) {
        const clientMatch = rawText.match(/(?:a|para|cliente)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,})?)/i);
        if (clientMatch && clientMatch[1]) {
          const ignoreWords = ['soles', 'yape', 'plin', 'efectivo', 'bcp', 'bbva', 'precio', 'cuenta'];
          if (!ignoreWords.includes(clientMatch[1].toLowerCase().trim())) {
            clientName = clientMatch[1].trim();
          }
        }
      }

      // D. Match Product by Model Keywords if not provided
      if (!productId) {
        const activeProducts = await db.product.findMany({
          where: {
            tenantId,
            shippingStatus: { not: "Vendido" },
          },
          orderBy: { purchaseDate: "desc" },
        });

        let candidate = activeProducts.find((p) => {
          const desc = p.description.toLowerCase();
          if (lower.includes("16") && (desc.includes("16") || desc.includes("a2141"))) return true;
          if (lower.includes("15") && (desc.includes("15") || desc.includes("a1990"))) return true;
          if (lower.includes("12.9") && desc.includes("12.9")) return true;
          if (lower.includes("air 3") && (desc.includes("air 3") || desc.includes("a2153") || desc.includes("air (3rd"))) return true;
          if (lower.includes("ipad 9") && (desc.includes("ipad 9") || desc.includes("9th") || desc.includes("a2602") || desc.includes("a2603"))) return true;
          if ((lower.includes("pro 10.5") || lower.includes("10.5")) && desc.includes("10.5") && !desc.includes("air")) return true;
          if (lower.includes("dell") && (desc.includes("dell") || desc.includes("latitude"))) return true;
          if (lower.includes("mini") && desc.includes("mini")) return true;
          if (lower.includes("cargador") && (desc.includes("cargador") || desc.includes("96w"))) return true;
          return false;
        });

        // Fallback: match by description sub-string
        if (!candidate) {
          const words = lower.split(/\s+/).filter((w) => w.length >= 4);
          candidate = activeProducts.find((p) => {
            const desc = p.description.toLowerCase();
            return words.some((w) => desc.includes(w));
          });
        }

        if (candidate) {
          productId = candidate.id;
        }
      }
    }

    // ── 2. VALIDATION ──────────────────────────────────────────────────
    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "No se identificó el producto del inventario. Por favor indica el modelo (ej. 'iPad Pro 10.5' o 'MacBook Pro 16').",
        },
        { status: 400 }
      );
    }

    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Producto no encontrado en la base de datos." },
        { status: 404 }
      );
    }

    // Default sale price if not given: use product's suggested sale price
    if (!salePricePen || salePricePen <= 0) {
      salePricePen = product.salePricePen || product.suggestedPricePen || 1000;
    }

    // ── 3. CLIENT MANAGEMENT ───────────────────────────────────────────
    const effectiveClientName = clientName || "Cliente Mostrador (Venta Rápida)";
    let client = await db.client.findFirst({
      where: {
        tenantId,
        fullName: { equals: effectiveClientName, mode: "insensitive" },
      },
    });

    if (!client) {
      // Find default fallback or create quick client
      client = await db.client.findFirst({
        where: { tenantId, dniRuc: "00000000" },
      });

      if (!client) {
        client = await db.client.create({
          data: {
            tenantId,
            fullName: effectiveClientName,
            dniRuc: "00000000",
            celular: "999999999",
            notas: saleChannel,
            totalPurchases: 0,
            totalSpent: 0,
            isFrequent: false,
          },
        });
      }
    }

    // ── 4. FINANCIAL CALCULATIONS ───────────────────────────────────────
    // Acquisition cost: purchase USD * exchange rate + estimated logistics
    let costAcquisitionPen = product.totalCostPen;
    if (!costAcquisitionPen || costAcquisitionPen <= 0) {
      const tc = product.exchangeRate || 3.45;
      const fleteUsd = product.shippingCostUsd || 15;
      costAcquisitionPen = Math.round((product.purchasePriceUsd + fleteUsd) * tc * 100) / 100;
    }

    const netProfitPen = Math.round((salePricePen - costAcquisitionPen) * 100) / 100;
    const profitMargin = salePricePen > 0 ? Math.round((netProfitPen / salePricePen) * 1000) / 10 : 0;
    const saleDate = new Date();

    // ── 5. RECORD SALE IN DATABASE ─────────────────────────────────────
    const sale = await db.sale.create({
      data: {
        tenantId,
        productId: product.id,
        clientId: client.id,
        saleDate,
        salePricePen,
        costAcquisitionPen,
        costMarketingPen: 0,
        costOperativePen: 0,
        netProfitPen,
        profitMargin,
        status: "Completada",
        paymentMethod: paymentMethod || "Yape / Transferencia",
        saleChannel: saleChannel || "WhatsApp / TikTok Live",
        deliveryStatus: "Entregado",
        deliveryDate: saleDate,
        warrantyMonths: 0,
        warrantyNotes: "Emitimos Boleta de Venta • Testeado en 30 puntos",
      },
    });

    // Update Product status
    await db.product.update({
      where: { id: product.id },
      data: {
        shippingStatus: "Vendido",
        salePricePen,
        saleDate,
        saleChannel,
        profitPen: netProfitPen,
        profitMargin,
      },
    });

    // Update Client metrics
    await db.client.update({
      where: { id: client.id },
      data: {
        totalPurchases: client.totalPurchases + 1,
        totalSpent: client.totalSpent + salePricePen,
      },
    });

    // Update MonthlySales
    const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, "0")}`;
    const monthlyRecord = await db.monthlySales.findFirst({
      where: { tenantId, month: monthKey },
    });

    if (monthlyRecord) {
      await db.monthlySales.update({
        where: { id: monthlyRecord.id },
        data: {
          totalSalesPen: monthlyRecord.totalSalesPen + salePricePen,
          totalCostPen: monthlyRecord.totalCostPen + costAcquisitionPen,
        },
      });
    } else {
      await db.monthlySales.create({
        data: {
          tenantId,
          month: monthKey,
          totalSalesPen: salePricePen,
          totalCostPen: costAcquisitionPen,
          category: "Cat 1",
          alertLevel: "none",
        },
      });
    }

    // ── 6. BACKGROUND EXCEL SYNC ───────────────────────────────────────
    let excelSyncResult: any = null;
    try {
      excelSyncResult = await recordSaleInEbayExcel({
        orderNumber: product.orderNumber,
        salePricePen,
        saleDate,
        paymentMethod: paymentMethod || "Yape",
        importerProfile: product.importerProfile,
        recipientName: product.recipientName,
        netProfitPen,
      });
    } catch (excelErr: any) {
      console.warn("Excel background update non-blocking error:", excelErr.message);
    }

    // ── 7. RETURN ENRICHED RESPONSE ────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: `¡Venta registrada con éxito! Ganancia limpia: S/ ${netProfitPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })} (${profitMargin}% de margen).`,
      matchedProduct: {
        id: product.id,
        description: product.description,
        orderNumber: product.orderNumber,
        purchasePriceUSD: product.purchasePriceUsd,
        costAcquisitionPen,
      },
      sale: {
        id: sale.id,
        salePricePen,
        netProfitPen,
        profitMargin,
        paymentMethod,
        clientName: client.fullName,
        saleDate: saleDate.toISOString(),
      },
      excelSync: excelSyncResult,
    });
  } catch (error: any) {
    console.error("Error in voice-assistant sale:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar la venta" },
      { status: 500 }
    );
  }
}
