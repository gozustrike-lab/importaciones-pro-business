import { XMLParser } from 'fast-xml-parser';
import * as dotenv from 'dotenv';
import { db } from '../src/lib/db';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function syncItemIds() {
  const token = process.env.EBAY_USER_TOKEN;
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

  console.log('Fetching orders from eBay to extract ItemIDs...');
  const res = await fetch('https://api.ebay.com/ws/api.dll', {
    method: 'POST',
    headers: {
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-CALL-NAME': 'GetOrders',
      'X-EBAY-API-APP-NAME': process.env.EBAY_APP_ID || '',
      'X-EBAY-API-DEV-NAME': process.env.EBAY_DEV_ID || '',
      'X-EBAY-API-CERT-NAME': process.env.EBAY_CERT_ID || '',
      'Content-Type': 'text/xml',
    },
    body: xmlPayload,
  });

  const text = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const json = parser.parse(text);
  const rawOrders = json?.GetOrdersResponse?.OrderArray?.Order;
  const orderList = Array.isArray(rawOrders) ? rawOrders : rawOrders ? [rawOrders] : [];

  console.log(`Found ${orderList.length} orders in eBay API.`);

  let updatedCount = 0;

  for (const ord of orderList) {
    const orderId = String(ord.OrderID || '');
    const rawTx = ord.TransactionArray?.Transaction;
    const transactions = Array.isArray(rawTx) ? rawTx : rawTx ? [rawTx] : [];

    for (const tx of transactions) {
      const itemId = String(tx.Item?.ItemID || '');
      const trackingNumber = String(
        tx.ShippingDetails?.ShipmentTrackingDetails?.ShipmentTrackingNumber ||
        ord.ShippingDetails?.ShipmentTrackingDetails?.ShipmentTrackingNumber ||
        ''
      );

      if (!itemId) continue;

      // Find matching product in DB
      const product = await db.product.findFirst({
        where: {
          OR: [
            { orderNumber: orderId },
            ...(trackingNumber ? [{ trackingId: trackingNumber }] : []),
          ],
        },
      });

      if (product) {
        let currentNotes = product.notes || '';
        if (!currentNotes.includes('ItemID:')) {
          currentNotes = `ItemID: ${itemId} | ${currentNotes}`.trim();
        } else {
          // ensure correct item ID
          currentNotes = currentNotes.replace(/ItemID:\s*\d+/i, `ItemID: ${itemId}`);
        }

        await db.product.update({
          where: { id: product.id },
          data: {
            notes: currentNotes,
          },
        });
        updatedCount++;
        console.log(`Updated product ${product.id} (Order: ${orderId}) -> ItemID: ${itemId}`);
      }
    }
  }

  console.log(`Total products updated with exact ItemID: ${updatedCount}`);
}

syncItemIds().catch(console.error).finally(() => process.exit(0));
