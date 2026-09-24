import { XMLParser } from 'fast-xml-parser';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function checkOrder() {
  const token = process.env.EBAY_USER_TOKEN;
  const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <DetailLevel>ReturnAll</DetailLevel>
  <OrderIDArray>
    <OrderID>27-15173-66600</OrderID>
  </OrderIDArray>
  <OrderRole>Buyer</OrderRole>
</GetOrdersRequest>`;

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
  const ord = json?.GetOrdersResponse?.OrderArray?.Order;
  console.log('Order keys:', Object.keys(ord || {}));
  console.log('Transaction:', JSON.stringify(ord?.TransactionArray?.Transaction, null, 2));
}

checkOrder().catch(console.error);
