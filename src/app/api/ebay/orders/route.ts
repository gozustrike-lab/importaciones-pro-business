import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { getUserToken } from '@/lib/ebay-account';
import { db } from '@/lib/db';
import { XMLParser } from 'fast-xml-parser';
import { inferTechnicalModel } from '@/lib/shipper-classification';
import { notifyMiamiArrival } from '@/lib/notifications';
import { appendPurchaseToEbayExcel } from '@/lib/excel-compras-writer';

if (process.env.NODE_ENV !== 'production' || process.platform === 'win32') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const syncDb = searchParams.get('syncDb') === 'true';

    const currentUser = await getCurrentUser();
    let token: string | null = null;

    if (currentUser.userId) {
      try {
        token = await getUserToken(currentUser.userId);
      } catch {
        // Fallback to env token
      }
    }

    if (!token && process.env.EBAY_USER_TOKEN) {
      token = process.env.EBAY_USER_TOKEN;
    }

    if (!token) {
      return NextResponse.json({
        connected: false,
        message: 'No hay token de eBay configurado. Conecta tu cuenta o revisa las credenciales en .env',
        orders: [],
      });
    }

    // Call eBay Trading API GetOrders
    const appId = process.env.EBAY_APP_ID || '';
    const certId = process.env.EBAY_CERT_ID || '';
    const devId = process.env.EBAY_DEV_ID || '';
    const isSandbox = process.env.EBAY_SANDBOX === 'true';
    const endpoint = isSandbox
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <DetailLevel>ReturnAll</DetailLevel>
  <OrderRole>Buyer</OrderRole>
  <OrderStatus>All</OrderStatus>
  <NumberOfDays>${Math.min(Math.max(days, 1), 30)}</NumberOfDays>
</GetOrdersRequest>`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-DEV-NAME': devId,
        'X-EBAY-API-APP-NAME': appId,
        'X-EBAY-API-CERT-NAME': certId,
        'X-EBAY-API-CALL-NAME': 'GetOrders',
        'X-EBAY-API-SITEID': '0',
        'Content-Type': 'text/xml',
      },
      body: xmlPayload,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('eBay Trading API HTTP error:', res.status, errText);
      return NextResponse.json(
        { error: `Error HTTP ${res.status} al consultar eBay Trading API` },
        { status: 502 }
      );
    }

    const xmlResponse = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false, // Ensures tracking numbers are not formatted into scientific notation
    });

    const parsed = parser.parse(xmlResponse);
    const getOrdersResponse = parsed.GetOrdersResponse;

    if (getOrdersResponse?.Ack === 'Failure') {
      const errors = getOrdersResponse.Errors;
      const errorList = Array.isArray(errors) ? errors : errors ? [errors] : [];
      const errorMsg = errorList
        .map((e: any) => e?.LongMessage || e?.ShortMessage)
        .join('; ') || 'Error de autenticación de eBay';
      console.warn('eBay API Ack Failure:', errorMsg);

      const isTokenExpired = errorList.some(
        (e: any) =>
          e?.ErrorCode === '931' ||
          e?.ErrorCode === '932' ||
          (e?.ShortMessage && String(e.ShortMessage).toLowerCase().includes('token'))
      );

      return NextResponse.json({
        connected: false,
        requiresAuth: isTokenExpired,
        error: isTokenExpired
          ? 'Tu sesión de eBay ha expirado. Por favor reconecta tu cuenta de eBay para sincronizar compras en vivo.'
          : errorMsg,
        orders: [],
      }, { status: 200 });
    }

    const rawOrders = getOrdersResponse?.OrderArray?.Order;
    const orderList = Array.isArray(rawOrders) ? rawOrders : rawOrders ? [rawOrders] : [];

    const formattedOrders: any[] = [];

    for (const ord of orderList) {
      const orderId = ord.OrderID;
      const orderStatus = ord.OrderStatus;
      const createdTime = ord.CreatedTime;
      const recipientName = ord.ShippingAddress?.Name || '';
      const buyerCheckoutMessage = ord.BuyerCheckoutMessage || '';
      const seller = ord.SellerUserID || 'eBay';
      const orderTotal = parseFloat(
        typeof ord.Total === 'object' ? ord.Total['#text'] || '0' : ord.Total || '0'
      );

      // Bi-RUC SUNAT detection
      const lowerRecipient = recipientName.toLowerCase();
      const isPeggy =
        lowerRecipient.includes('peggy') ||
        lowerRecipient.includes('liliana') ||
        lowerRecipient.includes('orduna') ||
        lowerRecipient.includes('orduña') ||
        lowerRecipient.includes('10091870911') ||
        lowerRecipient.includes('09187091');

      const assignedProfile = isPeggy ? 'peggy' : 'fabio';
      const consigneeRuc = isPeggy ? '10091870911' : '10762026835';
      const consigneeName = isPeggy
        ? 'BONILLA ORDUÑA PEGGY LILIANA'
        : 'FABIO CESAR HERRERA BONILLA';

      const rawTx = ord.TransactionArray?.Transaction;
      const transactions = Array.isArray(rawTx) ? rawTx : rawTx ? [rawTx] : [];

      const ordPkgInfo = ord.ShippingServiceSelected?.ShippingPackageInfo;
      const ordDeliveryTime = ordPkgInfo?.ActualDeliveryTime || null;
      const ordEstimatedDelivery = ordPkgInfo?.EstimatedDeliveryTimeMax || ordPkgInfo?.EstimatedDeliveryTimeMin || null;

      if (transactions.length === 0) {
        const isDeliveredMiami = !!ordDeliveryTime;
        const initialShippingStatus = isDeliveredMiami ? 'USA' : 'TRANSITO_USA';

        formattedOrders.push({
          orderId,
          itemId: '',
          title: `Orden #${orderId}`,
          priceUsd: orderTotal,
          courier: 'USPS',
          trackingNumber: '',
          orderDate: createdTime,
          actualDeliveryTime: ordDeliveryTime,
          estimatedDeliveryTime: ordEstimatedDelivery,
          isDeliveredMiami,
          shippingStatus: initialShippingStatus,
          seller,
          recipientName,
          assignedProfile,
          consigneeRuc,
          consigneeName,
          ebayAccount: ord.BuyerUserID || 'gozustrike@gmail.com',
          condition: 'Usado',
          status: isDeliveredMiami ? 'En Almacén Miami' : 'En Tránsito a Miami',
          buyerMessage: buyerCheckoutMessage,
        });
      } else {
        transactions.forEach((tx: any, idx: number) => {
          const item = tx.Item || {};
          const itemId = item.ItemID || '';
          const title = item.Title || `Artículo eBay (${orderId})`;
          const sku = item.SKU || '';

          // Price calculation
          const txPrice = parseFloat(
            typeof tx.TransactionPrice === 'object'
              ? tx.TransactionPrice['#text'] || '0'
              : tx.TransactionPrice || '0'
          );
          const finalPrice = txPrice > 0 ? txPrice : orderTotal;

          // Tracking details
          const trackingDetails = tx.ShippingDetails?.ShipmentTrackingDetails;
          const trackingList = Array.isArray(trackingDetails)
            ? trackingDetails
            : trackingDetails
            ? [trackingDetails]
            : [];

          const firstTracking = trackingList[0];
          const courier = firstTracking?.ShippingCarrierUsed?.toUpperCase() || 'USPS';
          const trackingNumber = firstTracking?.ShipmentTrackingNumber || '';

          const txPkgInfo = tx.ShippingServiceSelected?.ShippingPackageInfo;
          const actualDeliveryTime = txPkgInfo?.ActualDeliveryTime || ordDeliveryTime || null;
          const estimatedDeliveryTime =
            txPkgInfo?.EstimatedDeliveryTimeMax ||
            txPkgInfo?.EstimatedDeliveryTimeMin ||
            ordEstimatedDelivery ||
            null;

          const isDeliveredMiami = !!actualDeliveryTime;
          const initialShippingStatus = isDeliveredMiami ? 'USA' : 'TRANSITO_USA';

          formattedOrders.push({
            orderId: transactions.length > 1 ? `${orderId}-${idx + 1}` : orderId,
            rawOrderId: orderId,
            itemId,
            sku,
            title,
            priceUsd: finalPrice,
            courier,
            trackingNumber,
            orderDate: createdTime,
            shippedDate: tx.ShippedTime || ord.ShippedTime || null,
            actualDeliveryTime,
            estimatedDeliveryTime,
            isDeliveredMiami,
            shippingStatus: initialShippingStatus,
            seller,
            recipientName,
            assignedProfile,
            consigneeRuc,
            consigneeName,
            ebayAccount: ord.BuyerUserID || 'gozustrike@gmail.com',
            condition: 'Usado',
            status: isDeliveredMiami ? 'En Almacén Miami' : (ord.ShippedTime || tx.ShippedTime ? 'En Tránsito a Miami' : 'Comprado en eBay'),
            buyerMessage: buyerCheckoutMessage,
          });
        });
      }
    }

    // If syncDb is true and user is authenticated with a tenant, auto-create products in DB
    if (syncDb && currentUser.tenantId) {
      let createdCount = 0;
      for (const ord of formattedOrders) {
        if (!ord.trackingNumber && !ord.orderId) continue;

        const existing = await db.product.findFirst({
          where: {
            tenantId: currentUser.tenantId,
            OR: [
              ...(ord.trackingNumber ? [{ trackingId: ord.trackingNumber }] : []),
              { orderNumber: ord.orderId },
            ],
          },
        });

        const isDelivered = !!ord.actualDeliveryTime || ord.isDeliveredMiami;
        const targetStatus = existing && ['En Tránsito', 'Perú', 'Entregado', 'Vendido'].includes(existing.shippingStatus)
          ? existing.shippingStatus
          : (isDelivered ? 'USA' : 'TRANSITO_USA');

        if (!existing) {
          const exchangeRate = 3.40;
          await db.product.create({
            data: {
              tenantId: currentUser.tenantId,
              purchaseDate: ord.orderDate ? new Date(ord.orderDate) : new Date(),
              orderNumber: ord.orderId,
              supplier: 'eBay',
              courier: ord.courier,
              trackingId: ord.trackingNumber || '',
              shippingStatus: targetStatus,
              actualArrival: ord.actualDeliveryTime ? new Date(ord.actualDeliveryTime) : null,
              estimatedArrival: ord.estimatedDeliveryTime ? new Date(ord.estimatedDeliveryTime) : null,
              description: ord.title,
              model: inferTechnicalModel(ord.title),
              condition: 'Usado',
              purchasePriceUsd: ord.priceUsd,
              exchangeRate: exchangeRate,
              totalCostPen: Math.round(ord.priceUsd * exchangeRate * 100) / 100,
              importerProfile: ord.assignedProfile,
              recipientName: ord.recipientName,
              ebayAccount: ord.ebayAccount,
              notes: [
                ord.itemId ? `ItemID: ${ord.itemId}` : '',
                ord.buyerMessage ? `Nota del comprador: ${ord.buyerMessage}` : '',
              ].filter(Boolean).join(' | '),
            },
          });
          createdCount++;

          // Auto-append to Fabio or Liliana Excel workbook in Google Drive
          appendPurchaseToEbayExcel({
            orderNumber: ord.orderId,
            purchaseDate: ord.orderDate ? new Date(ord.orderDate) : new Date(),
            courier: ord.courier,
            trackingId: ord.trackingNumber || '',
            supplier: ord.seller || 'eBay',
            description: ord.title,
            purchasePriceUsd: ord.priceUsd,
            importerProfile: ord.assignedProfile,
            recipientName: ord.recipientName,
            itemId: ord.itemId,
            exchangeRate: 3.40,
            notes: ord.buyerMessage,
          }).catch((err) => console.error('Error auto-appending to Excel:', err));
        } else {
          const updates: Record<string, unknown> = {};
          if (!['En Tránsito', 'Perú', 'Entregado', 'Vendido'].includes(existing.shippingStatus)) {
            updates.shippingStatus = targetStatus;
            updates.actualArrival = ord.actualDeliveryTime ? new Date(ord.actualDeliveryTime) : existing.actualArrival;
            updates.estimatedArrival = ord.estimatedDeliveryTime ? new Date(ord.estimatedDeliveryTime) : existing.estimatedArrival;

            // Trigger notification if newly delivered in Miami
            if (targetStatus === 'USA' && existing.shippingStatus !== 'USA') {
              notifyMiamiArrival({
                orderNumber: ord.orderId,
                trackingNumber: ord.trackingNumber || existing.trackingId || '',
                courier: ord.courier || existing.courier,
                description: ord.title || existing.description,
                model: inferTechnicalModel(ord.title, existing.model),
                recipientName: ord.recipientName || existing.recipientName,
                actualArrival: ord.actualDeliveryTime,
              }).catch((err) => console.error('Error enviando notificación Miami arrival:', err));
            }
          }
          if (ord.itemId && (!existing.notes || !existing.notes.includes(ord.itemId))) {
            updates.notes = [existing.notes, `ItemID: ${ord.itemId}`].filter(Boolean).join(' | ');
          }
          if (Object.keys(updates).length > 0) {
            await db.product.update({
              where: { id: existing.id },
              data: updates,
            });

            if (ord.trackingNumber && ord.trackingNumber !== existing.trackingId) {
              appendPurchaseToEbayExcel({
                orderNumber: existing.orderNumber,
                purchaseDate: existing.purchaseDate,
                courier: ord.courier || existing.courier,
                trackingId: ord.trackingNumber,
                description: ord.title || existing.description,
                purchasePriceUsd: ord.priceUsd || existing.purchasePriceUsd,
                importerProfile: ord.assignedProfile || existing.importerProfile,
                recipientName: ord.recipientName || existing.recipientName,
              }).catch((err) => console.error('Error auto-updating Excel tracking:', err));
            }
          }
        }
      }
      console.log(`Auto-sincronizados ${createdCount} productos nuevos en la BD`);
    }

    return NextResponse.json({
      connected: true,
      totalOrders: formattedOrders.length,
      orders: formattedOrders,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error obteniendo órdenes de eBay:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener compras de eBay' },
      { status: 500 }
    );
  }
}

// POST endpoint: Bulk import specific eBay orders into DB products
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId || !currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const ordersToSync: any[] = body.orders || [];

    if (!Array.isArray(ordersToSync) || ordersToSync.length === 0) {
      return NextResponse.json({ error: 'No se recibieron compras para importar' }, { status: 400 });
    }

    const exchangeRate = 3.40;
    let imported = 0;
    let updated = 0;

    for (const ord of ordersToSync) {
      const trackingId = ord.trackingNumber || '';
      const orderNumber = ord.orderId || ord.rawOrderId || '';

      const existing = await db.product.findFirst({
        where: {
          tenantId: currentUser.tenantId,
          OR: [
            ...(trackingId ? [{ trackingId }] : []),
            ...(orderNumber ? [{ orderNumber }] : []),
          ],
        },
      });

      const isDelivered = !!ord.actualDeliveryTime || ord.isDeliveredMiami;
      const targetStatus = existing && ['En Tránsito', 'Perú', 'Entregado', 'Vendido'].includes(existing.shippingStatus)
        ? existing.shippingStatus
        : (isDelivered ? 'USA' : 'TRANSITO_USA');

      const dataPayload = {
        purchaseDate: ord.orderDate ? new Date(ord.orderDate) : new Date(),
        orderNumber,
        supplier: 'eBay',
        courier: ord.courier || 'USPS',
        trackingId,
        shippingStatus: targetStatus,
        actualArrival: ord.actualDeliveryTime ? new Date(ord.actualDeliveryTime) : existing?.actualArrival || null,
        estimatedArrival: ord.estimatedDeliveryTime ? new Date(ord.estimatedDeliveryTime) : existing?.estimatedArrival || null,
        description: ord.title || 'Producto eBay',
        model: inferTechnicalModel(ord.title, ord.model),
        condition: ord.condition || 'Usado',
        purchasePriceUsd: parseFloat(ord.priceUsd || '0'),
        exchangeRate,
        totalCostPen: Math.round(parseFloat(ord.priceUsd || '0') * exchangeRate * 100) / 100,
        importerProfile: ord.assignedProfile || 'fabio',
        recipientName: ord.recipientName || '',
        ebayAccount: ord.ebayAccount || 'gozustrike@gmail.com',
        notes: [
          ord.itemId ? `ItemID: ${ord.itemId}` : '',
          ord.buyerMessage ? `Nota: ${ord.buyerMessage}` : '',
        ].filter(Boolean).join(' | '),
      };

      if (existing) {
        await db.product.update({
          where: { id: existing.id },
          data: dataPayload,
        });
        updated++;
      } else {
        await db.product.create({
          data: {
            ...dataPayload,
            tenantId: currentUser.tenantId,
          },
        });
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      total: ordersToSync.length,
    });
  } catch (error) {
    console.error('Error importando compras a productos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al guardar compras' },
      { status: 500 }
    );
  }
}
