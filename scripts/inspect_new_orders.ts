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
  <OrderIDArray>
    <OrderID>06-15262-15918</OrderID>
    <OrderID>02-15-27101205</OrderID>
    <OrderID>02-15-27101592</OrderID>
  </OrderIDArray>
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

  for (const o of list) {
    const rawTx = o.TransactionArray?.Transaction;
    const tx = Array.isArray(rawTx) ? rawTx[0] : rawTx;
    console.log('--- Order ---', o.OrderID);
    console.log('CreatedTime:', o.CreatedTime);
    console.log('Total:', o.Total);
    console.log('Seller:', o.SellerUserID);
    console.log('Recipient:', o.ShippingAddress?.Name);
    console.log('Title:', tx?.Item?.Title);
    console.log('ItemID:', tx?.Item?.ItemID);
    console.log('TxPrice:', tx?.TransactionPrice);
    const tracking = tx?.ShippingDetails?.ShipmentTrackingDetails;
    console.log('TrackingDetails:', JSON.stringify(tracking));
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
