process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { XMLParser } from 'fast-xml-parser';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testEbayToken() {
  const token = process.env.EBAY_USER_TOKEN;
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  const devId = process.env.EBAY_DEV_ID;

  console.log('AppID:', appId ? appId.slice(0, 15) + '...' : 'NONE');
  console.log('Token exists:', !!token, 'length:', token?.length);

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
  const parser = new XMLParser();
  const json = parser.parse(text);
  console.log('Ack:', json?.GetOrdersResponse?.Ack);
  if (json?.GetOrdersResponse?.Ack === 'Failure') {
    console.log('Error:', JSON.stringify(json.GetOrdersResponse.Errors));
  } else {
    const orders = json?.GetOrdersResponse?.OrderArray?.Order;
    const count = Array.isArray(orders) ? orders.length : (orders ? 1 : 0);
    console.log(`Success! Orders count returned: ${count}`);
  }
}

testEbayToken().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
