import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";
import { getUserToken, getEbayConfig } from "@/lib/ebay-account";
import { db } from "@/lib/db";
import { XMLParser } from "fast-xml-parser";
import { appendPurchaseToEbayExcel } from "@/lib/excel-compras-writer";
import { inferTechnicalModel } from "@/lib/shipper-classification";
import { fetchEbayItemImage } from "@/lib/ebay";

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

    const { appId, certId, devId, isSandbox } = getEbayConfig();
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
    let newlyImportedCount = 0;

    for (const ord of orderList) {
      const orderId = String(ord.OrderID || "");
      // Skip cancelled/inactive orders or legacy non-standard IDs
      if (
        ord.OrderStatus === "Cancelled" ||
        ord.OrderStatus === "Inactive" ||
        ord.CancelStatus === "CancelComplete" ||
        orderId.length > 20
      ) {
        continue;
      }
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

        if (!existing) {
          const recipientName = ord.ShippingAddress?.Name || "";
          const lowerRecipient = recipientName.toLowerCase();
          const isPeggy =
            lowerRecipient.includes("peggy") ||
            lowerRecipient.includes("liliana") ||
            lowerRecipient.includes("orduna") ||
            lowerRecipient.includes("orduña") ||
            lowerRecipient.includes("10091870911") ||
            lowerRecipient.includes("09187091");

          const assignedProfile = isPeggy ? "peggy" : "fabio";
          const orderTotal = parseFloat(
            typeof ord.Total === "object" ? ord.Total["#text"] || "0" : ord.Total || "0"
          );
          const txPrice = parseFloat(
            typeof tx?.TransactionPrice === "object"
              ? tx.TransactionPrice["#text"] || "0"
              : tx?.TransactionPrice || "0"
          );
          const finalPrice = txPrice > 0 ? txPrice : orderTotal;
          const title = tx?.Item?.Title || `Artículo eBay (${ordIdToMatch})`;
          const itemId = tx?.Item?.ItemID || "";
          const targetStatus = isDelivered ? "USA" : "TRANSITO_USA";
          const exchangeRate = 3.4;
          const imageUrl = await fetchEbayItemImage(itemId, title);

          await db.product.create({
            data: {
              tenantId: currentUser.tenantId,
              purchaseDate: ord.CreatedTime ? new Date(ord.CreatedTime) : new Date(),
              orderNumber: ordIdToMatch,
              supplier: ord.SellerUserID || "eBay",
              courier: courier || "USPS",
              trackingId: trackingNumber || "",
              shippingStatus: targetStatus,
              actualArrival: actualDeliveryTime ? new Date(actualDeliveryTime) : null,
              estimatedArrival: estimatedDeliveryTime ? new Date(estimatedDeliveryTime) : null,
              description: title,
              model: inferTechnicalModel(title),
              condition: "Usado",
              purchasePriceUsd: finalPrice,
              exchangeRate: exchangeRate,
              totalCostPen: Math.round(finalPrice * exchangeRate * 100) / 100,
              importerProfile: assignedProfile,
              recipientName: recipientName,
              ebayAccount: ord.BuyerUserID || "gozustrike@gmail.com",
              notes: [
                itemId ? `ItemID: ${itemId}` : "",
                ord.BuyerCheckoutMessage ? `Nota: ${ord.BuyerCheckoutMessage}` : "",
                imageUrl ? `Img: ${imageUrl}` : "",
              ]
                .filter(Boolean)
                .join(" | "),
            },
          });
          newlyImportedCount++;
          if (isDelivered) {
            newlyDeliveredCount++;
            newlyDeliveredOrders.push(ordIdToMatch);
          }

          appendPurchaseToEbayExcel({
            orderNumber: ordIdToMatch,
            purchaseDate: ord.CreatedTime ? new Date(ord.CreatedTime) : new Date(),
            courier: courier || "USPS",
            trackingId: trackingNumber || "",
            supplier: ord.SellerUserID || "eBay",
            description: title,
            purchasePriceUsd: finalPrice,
            importerProfile: assignedProfile,
            recipientName: recipientName,
            itemId: itemId,
            exchangeRate: exchangeRate,
            notes: ord.BuyerCheckoutMessage,
          }).catch((err) => console.error("Error auto-appending to Excel in sync-live:", err));

          continue;
        }

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

          // Sync tracking update to respective Excel file (Fabio or Liliana)
          if (trackingNumber && trackingNumber !== existing.trackingId) {
            appendPurchaseToEbayExcel({
              orderNumber: existing.orderNumber,
              purchaseDate: existing.purchaseDate,
              courier: courier || existing.courier,
              trackingId: trackingNumber,
              description: existing.description,
              purchasePriceUsd: existing.purchasePriceUsd,
              importerProfile: existing.importerProfile,
              recipientName: existing.recipientName,
            }).catch((err) => console.error('Error updating Excel tracking in sync-live:', err));
          }
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
      newlyImportedCount,
      newlyDeliveredCount,
      newlyDeliveredOrders,
      updatedTrackingCount,
      inMiamiTotal,
      inTransitTotal,
      message:
        newlyImportedCount > 0 || newlyDeliveredCount > 0
          ? `¡Sincronización completada! ${newlyImportedCount > 0 ? `${newlyImportedCount} nueva(s) compra(s) registrada(s) en BD y Excel. ` : ""}${newlyDeliveredCount > 0 ? `${newlyDeliveredCount} nuevo(s) paquete(s) en Miami.` : ""}`
          : `Sincronización completada con eBay. Todos los paquetes están al día (${inMiamiTotal} en Miami, ${inTransitTotal} en tránsito).`,
    });
  } catch (error: unknown) {
    console.error("Error in ebay/sync-live:", error);
    const message = error instanceof Error ? error.message : "Error al sincronizar con eBay";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
