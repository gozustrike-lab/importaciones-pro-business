import { PrismaClient } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { getUserToken, getEbayConfig } from '../src/lib/ebay-account';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const prisma = new PrismaClient();

async function run() {
  const account = await prisma.account.findFirst({ where: { provider: 'ebay' } });
  if (!account) {
    console.log('No ebay account found in DB');
    return;
  }

  const token = await getUserToken(account.userId);
  console.log('Token obtained successfully:', !!token);

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
  const orders = parsed.GetOrdersResponse?.OrderArray?.Order;
  const orderList = Array.isArray(orders) ? orders : orders ? [orders] : [];
  console.log('Total live eBay orders returned from eBay API:', orderList.length);

  for (const o of orderList) {
    const rawTx = o.TransactionArray?.Transaction;
    const txList = Array.isArray(rawTx) ? rawTx : rawTx ? [rawTx] : [];
    const tx = txList[0];
    const trackingDetails = tx?.ShippingDetails?.ShipmentTrackingDetails;
    const trackingList = Array.isArray(trackingDetails) ? trackingDetails : trackingDetails ? [trackingDetails] : [];
    const trk = trackingList[0]?.ShipmentTrackingNumber || '';
    const carrier = trackingList[0]?.ShippingCarrierUsed || '';
    const title = tx?.Item?.Title || o.ItemTitle || '';
    const recipient = o.ShippingAddress?.Name || '';
    const deliv = tx?.ShippingServiceSelected?.ShippingPackageInfo?.ActualDeliveryTime || '';
    console.log(`${o.OrderID} | ${carrier} ${trk} | Deliv: ${deliv ? 'YES' : 'NO'} | Recipient: ${recipient} | Title: ${title.slice(0, 35)}`);
  }
}

run().finally(() => prisma.$disconnect());
