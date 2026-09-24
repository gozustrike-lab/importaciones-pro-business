import { XMLParser } from 'fast-xml-parser';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function test() {
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
  <OrderIDArray>
    <OrderID>27-15173-66600</OrderID>
  </OrderIDArray>
</GetOrdersRequest>`;

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
  const o = parsed.GetOrdersResponse?.OrderArray?.Order;
  console.log('ALL KEYS IN ORDER:');
  console.log(JSON.stringify(o, null, 2));
}
test();
