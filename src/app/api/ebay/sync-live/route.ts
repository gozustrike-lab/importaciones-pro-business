import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";
import { getUserToken } from "@/lib/ebay-account";
import { db } from "@/lib/db";
import { XMLParser } from "fast-xml-parser";

if (process.env.NODE_ENV !== "production" || process.platform === "win32") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// POST /api/ebay/sync-live - Real-time sync of orders & delivery statuses directly from eBay API
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId || !currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let token: string | null = null;
    try {
      token = await getUserToken(currentUser.userId);
    } catch (err: any) {
      console.warn("getUserToken failed:", err.message);
    }

    if (!token && process.env.EBAY_USER_TOKEN) {
      token = process.env.EBAY_USER_TOKEN;
    }

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          requiresAuth: true,
          message:
            "No hay una cuenta de eBay vinculada o el token expiró. Vincula tu cuenta de eBay para sincronización automática en tiempo real.",
        },
        { status: 200 }
      );
    }

    const appId = process.env.EBAY_APP_ID || "";
    const certId = process.env.EBAY_CERT_ID || "";
    const devId = process.env.EBAY_DEV_ID || "";
    const isSandbox = process.env.EBAY_SANDBOX === "true";
    const endpoint = isSandbox
      ? "https://api.sandbox.ebay.com/ws/api.dll"
      : "https://api.ebay.com/ws/api.dll";

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <DetailLevel>ReturnAll</DetailLevel>
  <OrderRole>Buyer</OrderRole>
  <OrderStatus>All</OrderStatus>
  <NumberOfDays>30</NumberOfDays>
</GetOrdersRequest>`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-DEV-NAME": devId,
        "X-EBAY-API-APP-NAME": appId,
        "X-EBAY-API-CERT-NAME": certId,
        "X-EBAY-API-CALL-NAME": "GetOrders",
        "X-EBAY-API-SITEID": "0",
        "Content-Type": "text/xml",
      },
      body: xmlPayload,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("eBay Trading API HTTP error:", res.status, errText);
      return NextResponse.json(
        {
          success: false,
          error: `Error HTTP ${res.status} al consultar eBay Trading API`,
        },
        { status: 502 }
      );
    }

    const xmlResponse = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: false, // Ensures tracking numbers are not formatted into scientific notation
    });

    const parsed = parser.parse(xmlResponse);
    const getOrdersResponse = parsed.GetOrdersResponse;

    if (getOrdersResponse?.Ack === "Failure") {
      const errors = getOrdersResponse.Errors;
      const errorList = Array.isArray(errors) ? errors : [errors];
      const isTokenExpired = errorList.some(
        (e: any) =>
          e?.ErrorCode === "931" ||
          e?.ErrorCode === "932" ||
          (e?.ShortMessage && e.ShortMessage.toLowerCase().includes("token"))
      );

      const errorMsg = errorList
        .map((e: any) => e?.LongMessage || e?.ShortMessage)
        .join("; ");

      if (isTokenExpired) {
        return NextResponse.json(
          {
            success: false,
            requiresAuth: true,
            error: "Tu sesión de eBay ha expirado. Por favor reconecta tu cuenta de eBay para renovar la sincronización en vivo.",
          },
          { status: 200 }
        );
      }

      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const rawOrders = getOrdersResponse?.OrderArray?.Order;
    const orderList = Array.isArray(rawOrders) ? rawOrders : rawOrders ? [rawOrders] : [];

    let newlyDeliveredCount = 0;
    let newlyDeliveredOrders: string[] = [];
    let updatedTrackingCount = 0;

    for (const ord of orderList) {
      const orderId = ord.OrderID;
      const rawTx = ord.TransactionArray?.Transaction;
      const transactions = Array.isArray(rawTx) ? rawTx : rawTx ? [rawTx] : [];

      const ordPkgInfo = ord.ShippingServiceSelected?.ShippingPackageInfo;
      const ordDeliveryTime = ordPkgInfo?.ActualDeliveryTime || null;
      const ordEstimatedDelivery =
        ordPkgInfo?.EstimatedDeliveryTimeMax || ordPkgInfo?.EstimatedDeliveryTimeMin || null;

      for (let idx = 0; idx < Math.max(transactions.length, 1); idx++) {
        const tx = transactions[idx];
        const ordIdToMatch = transactions.length > 1 ? `${orderId}-${idx + 1}` : orderId;

        // Extract tracking info
        const trackingDetails = tx?.ShippingDetails?.ShipmentTrackingDetails;
        const trackingList = Array.isArray(trackingDetails)
          ? trackingDetails
          : trackingDetails
          ? [trackingDetails]
          : [];
        const trackingNumber = trackingList[0]?.ShipmentTrackingNumber || "";
        const courier = trackingList[0]?.ShippingCarrierUsed?.toUpperCase() || "";

        // Extract delivery time
        const txPkgInfo = tx?.ShippingServiceSelected?.ShippingPackageInfo;
        const actualDeliveryTime = txPkgInfo?.ActualDeliveryTime || ordDeliveryTime || null;
        const estimatedDeliveryTime =
          txPkgInfo?.EstimatedDeliveryTimeMax ||
          txPkgInfo?.EstimatedDeliveryTimeMin ||
          ordEstimatedDelivery ||
          null;

        const isDelivered = !!actualDeliveryTime;

        // Search for matching product in local DB
        const existing = await db.product.findFirst({
          where: {
            tenantId: currentUser.tenantId,
            OR: [
              ...(trackingNumber ? [{ trackingId: trackingNumber }] : []),
              { orderNumber: ordIdToMatch },
              { orderNumber: orderId },
            ],
          },
        });

        if (!existing) continue;

        // Do not alter products that are already in flight to Peru or sold
        if (["En Tránsito", "Perú", "Entregado", "Vendido"].includes(existing.shippingStatus)) {
          continue;
        }

        const updates: Record<string, unknown> = {};

        // If delivered and status was TRANSITO_USA
        if (isDelivered && existing.shippingStatus !== "USA") {
          updates.shippingStatus = "USA";
          updates.actualArrival = new Date(actualDeliveryTime);
          newlyDeliveredCount++;
          newlyDeliveredOrders.push(existing.orderNumber);
        } else if (actualDeliveryTime && !existing.actualArrival) {
          updates.actualArrival = new Date(actualDeliveryTime);
        }

        if (estimatedDeliveryTime && !existing.estimatedArrival) {
          updates.estimatedArrival = new Date(estimatedDeliveryTime);
        }

        // If missing tracking number, update it
        if (
          trackingNumber &&
          (!existing.trackingId || existing.trackingId === "SIN_TRACKING" || existing.trackingId === "")
        ) {
          updates.trackingId = trackingNumber;
          if (courier) updates.courier = courier;
          updatedTrackingCount++;
        }

        if (Object.keys(updates).length > 0) {
          await db.product.update({
            where: { id: existing.id },
            data: updates,
          });
        }
      }
    }

    // Get current warehouse totals
    const inMiamiTotal = await db.product.count({
      where: {
        tenantId: currentUser.tenantId,
        isArchived: false,
        shippingStatus: "USA",
      },
    });

    const inTransitTotal = await db.product.count({
      where: {
        tenantId: currentUser.tenantId,
        isArchived: false,
        shippingStatus: "TRANSITO_USA",
      },
    });

    return NextResponse.json({
      success: true,
      totalEbayOrdersScanned: orderList.length,
      newlyDeliveredCount,
      newlyDeliveredOrders,
      updatedTrackingCount,
      inMiamiTotal,
      inTransitTotal,
      message:
        newlyDeliveredCount > 0
          ? `¡Sincronización completada! Se identificaron ${newlyDeliveredCount} nuevo(s) paquete(s) entregado(s) en Miami.`
          : `Sincronización completada con eBay. Todos los paquetes están al día (${inMiamiTotal} en Miami, ${inTransitTotal} en tránsito).`,
    });
  } catch (error: unknown) {
    console.error("Error in ebay/sync-live:", error);
    const message = error instanceof Error ? error.message : "Error al sincronizar con eBay";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
