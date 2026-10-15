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
  <OrderIDArray>
    <OrderID>22-15154-01688</OrderID>
  </OrderIDArray>
  <OrderRole>Buyer</OrderRole>
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
  console.log('--- XML FOR 22-15154-01688 ---');
  console.log(xmlText);
}

run().finally(() => prisma.$disconnect());
