import { XMLParser } from 'fast-xml-parser';
import * as dotenv from 'dotenv';
import { db } from '../src/lib/db';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function syncDeliveryStatus() {
  const token = process.env.EBAY_USER_TOKEN;
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  const devId = process.env.EBAY_DEV_ID;

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

  console.log('Consultando órdenes con DetailLevel ReturnAll de eBay...');
  const res = await fetch('https://api.ebay.com/ws/api.dll', {
    method: 'POST',
    headers: {
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-DEV-NAME': devId || '',
      'X-EBAY-API-APP-NAME': appId || '',
      'X-EBAY-API-CERT-NAME': certId || '',
      'X-EBAY-API-CALL-NAME': 'GetOrders',
      'X-EBAY-API-SITEID': '0',
      'Content-Type': 'text/xml',
    },
    body: xmlPayload,
  });

  const text = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
  const parsed = parser.parse(text);
  const rawOrders = parsed.GetOrdersResponse?.OrderArray?.Order;
  const orderList = Array.isArray(rawOrders) ? rawOrders : rawOrders ? [rawOrders] : [];

  console.log(`Recibidas ${orderList.length} órdenes de eBay.`);

  let inMiamiCount = 0;
  let inTransitCount = 0;
  let keptFlightCount = 0;

  for (const ord of orderList) {
    const orderId = ord.OrderID;
    const rawTx = ord.TransactionArray?.Transaction;
    const transactions = Array.isArray(rawTx) ? rawTx : rawTx ? [rawTx] : [];

    for (let idx = 0; idx < Math.max(transactions.length, 1); idx++) {
      const tx = transactions[idx];
      const ordIdToMatch = transactions.length > 1 ? `${orderId}-${idx + 1}` : orderId;

      const trackingDetails = tx?.ShippingDetails?.ShipmentTrackingDetails;
      const trackingList = Array.isArray(trackingDetails) ? trackingDetails : trackingDetails ? [trackingDetails] : [];
      const trackingNumber = trackingList[0]?.ShipmentTrackingNumber || '';

      const ordPkgInfo = ord.ShippingServiceSelected?.ShippingPackageInfo;
      const txPkgInfo = tx?.ShippingServiceSelected?.ShippingPackageInfo;
      const actualDeliveryTime = txPkgInfo?.ActualDeliveryTime || ordPkgInfo?.ActualDeliveryTime || null;
      const estimatedDeliveryTime =
        txPkgInfo?.EstimatedDeliveryTimeMax ||
        txPkgInfo?.EstimatedDeliveryTimeMin ||
        ordPkgInfo?.EstimatedDeliveryTimeMax ||
        null;

      const isDelivered = !!actualDeliveryTime;
      const computedStatus = isDelivered ? 'USA' : 'TRANSITO_USA';

      // Find in DB by orderNumber or trackingId
      const existing = await db.product.findFirst({
        where: {
          OR: [
            ...(trackingNumber ? [{ trackingId: trackingNumber }] : []),
            { orderNumber: ordIdToMatch },
            { orderNumber: orderId },
          ],
        },
      });

      if (existing) {
        if (['En Tránsito', 'Perú', 'Entregado', 'Vendido'].includes(existing.shippingStatus)) {
          keptFlightCount++;
          continue;
        }

        await db.product.update({
          where: { id: existing.id },
          data: {
            shippingStatus: computedStatus,
            actualArrival: actualDeliveryTime ? new Date(actualDeliveryTime) : existing.actualArrival,
            estimatedArrival: estimatedDeliveryTime ? new Date(estimatedDeliveryTime) : existing.estimatedArrival,
          },
        });

        if (computedStatus === 'USA') {
          inMiamiCount++;
        } else {
          inTransitCount++;
        }
      }
    }
  }

  console.log(`\nSincronización completada:`);
  console.log(`- En Almacén Miami (Delivered): ${inMiamiCount}`);
  console.log(`- En Tránsito a Miami: ${inTransitCount}`);
  console.log(`- En Vuelo a Lima / Perú (preservados): ${keptFlightCount}`);
}

syncDeliveryStatus().catch(console.error).finally(() => db.$disconnect());
