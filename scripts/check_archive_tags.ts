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
    <OrderID>23-15161-07326</OrderID>
    <OrderID>15-15216-85530</OrderID>
    <OrderID>22-15154-01688</OrderID>
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
  for (const o of orders) {
    console.log('Order:', o.OrderID, 'Status:', o.OrderStatus);
    const str = JSON.stringify(o);
    console.log('Contains archive?', str.toLowerCase().includes('archiv'));
    console.log('Contains hidden?', str.toLowerCase().includes('hidden'));
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
