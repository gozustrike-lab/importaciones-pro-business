import { PrismaClient } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { getUserToken, getEbayConfig } from '../src/lib/ebay-account';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const prisma = new PrismaClient();

async function run() {
  const account = await prisma.account.findFirst({ where: { provider: 'ebay' } });
  const token = await getUserToken(account!.userId);
  const { appId, certId, devId } = getEbayConfig();
  
  const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <DetailLevel>ReturnAll</DetailLevel>
  <OrderRole>Buyer</OrderRole>
  <OrderStatus>All</OrderStatus>
  <NumberOfDays>30</NumberOfDays>
</GetOrdersRequest>`;

  const res = await fetch('https://api.ebay.com/ws/api.dll', {
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

  console.log('Total orders in eBay (last 30 days):', list.length);
  for (const o of list) {
    const rawTx = o.TransactionArray?.Transaction;
    const tx = Array.isArray(rawTx) ? rawTx[0] : rawTx;
    const tracking = tx?.ShippingDetails?.ShipmentTrackingDetails;
    const trkNum = Array.isArray(tracking) ? tracking[0]?.ShipmentTrackingNumber : tracking?.ShipmentTrackingNumber;
    const carrier = Array.isArray(tracking) ? tracking[0]?.ShippingCarrierUsed : tracking?.ShippingCarrierUsed;
    const title = tx?.Item?.Title || o.ItemTitle || '';
    const recipient = o.ShippingAddress?.Name || '';
    const paidTime = o.PaidTime || '';
    const createdTime = o.CreatedTime || '';

    // Check if in DB
    const dbProd = await prisma.product.findFirst({
      where: { orderNumber: o.OrderID }
    });

    console.log(`Order: ${o.OrderID} | Date: ${createdTime.slice(0, 10)} | ${carrier || 'NO_CARRIER'} ${trkNum || 'NO_TRK'} | Recipient: ${recipient} | DB: ${dbProd ? (dbProd.isArchived ? 'ARCHIVED' : dbProd.shippingStatus) : 'NOT_IN_DB'} | Title: ${title.slice(0, 30)}`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
