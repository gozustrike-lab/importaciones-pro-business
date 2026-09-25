import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";
import { db } from "@/lib/db";

// POST /api/products/shipper-verify
// Body: { text: string }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Debe ingresar el texto de respuesta de Shiper" }, { status: 400 });
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const results: Array<{
      rawLine: string;
      baseTracking: string;
      shipperTracking: string;
      confirmed: boolean;
      productFound: boolean;
      orderNumber?: string;
      description?: string;
    }> = [];

    let confirmedCount = 0;
    let notInSystemCount = 0;
    let modifiedTrackingsCount = 0;

    for (const line of lines) {
      // Ignore header lines like "VERIFICAR PORFAVOR" or "Ok un momento"
      if (/verificar|momento|gracias|porfavor|hola/i.test(line) && !/figura/i.test(line)) {
        continue;
      }

      const isNo = /no\s+figura/i.test(line);
      const isSi = /si\s+figura|s[ií]\s+figura/i.test(line);
      const confirmed = isSi && !isNo;

      let baseTracking = "";
      let shipperTracking = "";

      // Match GS1-128 prefix format like (420)331722139(94)36208106245579767610 or (420)33172(94)...
      const gs1Match = line.match(/\(420\)[0-9]+\(94\)([0-9]+)/i);
      const fullGs1Match = line.match(/(\(420\)[0-9]+\(94\)[0-9]+)/i);

      if (gs1Match && fullGs1Match) {
        baseTracking = gs1Match[1];
        shipperTracking = fullGs1Match[1];
      } else {
        // Standard tracking formats:
        // UPS: 1Z... (18 chars)
        // FedEx: 12 digits
        // USPS: 20-22 digits
        const m = line.match(/\b(1Z[A-Z0-9]{16}|\d{20,24}|\d{12})\b/i);
        if (m) {
          baseTracking = m[1];
        }
      }

      if (!baseTracking) continue;

      // Find matching product in DB
      const product = await db.product.findFirst({
        where: {
          tenantId: currentUser.tenantId,
          OR: [
            { trackingId: { contains: baseTracking } },
            { shipperTracking: { contains: baseTracking } },
          ],
        },
      });

      if (product) {
        const updates: Record<string, unknown> = {
          shipperConfirmed: confirmed,
        };

        if (confirmed) {
          // If confirmed and currently in transit, mark as USA (warehouse)
          if (product.shippingStatus === "TRANSITO_USA") {
            updates.shippingStatus = "USA";
            if (!product.actualArrival) {
              updates.actualArrival = new Date();
            }
          }
          confirmedCount++;
        } else {
          notInSystemCount++;
        }

        if (shipperTracking && shipperTracking !== product.trackingId) {
          updates.shipperTracking = shipperTracking;
          modifiedTrackingsCount++;
        }

        await db.product.update({
          where: { id: product.id },
          data: updates,
        });

        results.push({
          rawLine: line,
          baseTracking,
          shipperTracking,
          confirmed,
          productFound: true,
          orderNumber: product.orderNumber,
          description: product.description,
        });
      } else {
        results.push({
          rawLine: line,
          baseTracking,
          shipperTracking,
          confirmed,
          productFound: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalLinesProcessed: results.length,
      confirmedCount,
      notInSystemCount,
      modifiedTrackingsCount,
      results,
    });
  } catch (error: unknown) {
    console.error("Error in shipper-verify route:", error);
    const message = error instanceof Error ? error.message : "Error al procesar la respuesta de Shiper";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
