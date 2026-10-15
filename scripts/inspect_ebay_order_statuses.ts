import { PrismaClient } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { getUserToken, getEbayConfig } from '../src/lib/ebay-account';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const prisma = new PrismaClient();

async function run() {
  const account = await prisma.account.findFirst({ where: { provider: 'ebay' } });
  if (!account) return;
  const token = await getUserToken(account.userId);
  const { appId, certId, devId } = getEbayConfig();
  const endpoint = 'https://api.ebay.com/ws/api.dll';

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

  const xmlText = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
  const parsed = parser.parse(xmlText);
  const orders = parsed.GetOrdersResponse?.OrderArray?.Order || [];
  const list = Array.isArray(orders) ? orders : [orders];

  console.log('--- DETALLE DE ESTADOS EBAY (47 ÓRDENES) ---');
  for (const o of list) {
    const rawTx = o.TransactionArray?.Transaction;
    const txList = Array.isArray(rawTx) ? rawTx : rawTx ? [rawTx] : [];
    const tx = txList[0];
    const trk = tx?.ShippingDetails?.ShipmentTrackingDetails?.[0]?.ShipmentTrackingNumber || 
                tx?.ShippingDetails?.ShipmentTrackingDetails?.ShipmentTrackingNumber || '';
    const carrier = tx?.ShippingDetails?.ShipmentTrackingDetails?.[0]?.ShippingCarrierUsed || 
                    tx?.ShippingDetails?.ShipmentTrackingDetails?.ShippingCarrierUsed || '';
    const title = tx?.Item?.Title || o.ItemTitle || '';
    const isShipped = o.ShippedTime;
    const paid = o.PaidTime;
    const status = o.OrderStatus;
    const cancel = o.CancelStatus;
    const ordId = o.OrderID;

    console.log(`${ordId} | ${carrier} ${trk} | Status: ${status} | ShippedTime: ${isShipped || 'NO'} | Title: ${title.slice(0, 30)}`);
  }
}

run().finally(() => prisma.$disconnect());
