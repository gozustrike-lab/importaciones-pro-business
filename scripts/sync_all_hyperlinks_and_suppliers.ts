import { db } from '../src/lib/db';
import * as ExcelJS from 'exceljs';
import { XMLParser } from 'fast-xml-parser';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function syncAll() {
  console.log('=== SYNCING ALL HYPERLINKS, SUPPLIERS & ITEM IDS ===\n');

  // 1. Fetch live orders from eBay API to get real sellers and ItemIDs
  const account = await db.account.findFirst({ where: { provider: 'ebay' } });
  const ebayData: Record<string, { itemId: string; title: string; seller: string; tracking: string }> = {};

  if (account && account.access_token) {
    console.log('Fetching live orders from eBay API...');
    try {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${account.access_token}</eBayAuthToken>
  </RequesterCredentials>
  <DetailLevel>ReturnAll</DetailLevel>
  <OrderRole>Buyer</OrderRole>
  <OrderStatus>All</OrderStatus>
  <NumberOfDays>30</NumberOfDays>
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
        body: xml,
      });

      const txt = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false });
      const json = parser.parse(txt);
      const rawOrders = json?.GetOrdersResponse?.OrderArray?.Order;
      const orderList = Array.isArray(rawOrders) ? rawOrders : rawOrders ? [rawOrders] : [];

      for (const ord of orderList) {
        const orderId = String(ord.OrderID || '');
        const seller = String(ord.SellerUserID || '');
        const rawTx = ord.TransactionArray?.Transaction;
        const txList = Array.isArray(rawTx) ? rawTx : rawTx ? [rawTx] : [];
        for (const tx of txList) {
          const itemId = String(tx.Item?.ItemID || '');
          const title = String(tx.Item?.Title || '');
          const tracking = String(
            tx.ShippingDetails?.ShipmentTrackingDetails?.ShipmentTrackingNumber ||
            ord.ShippingDetails?.ShipmentTrackingDetails?.ShipmentTrackingNumber ||
            ''
          );
          if (orderId && itemId) {
            ebayData[orderId] = { itemId, title, seller, tracking };
          }
        }
      }
      console.log(`Retrieved ${Object.keys(ebayData).length} orders from eBay API.`);
    } catch (err) {
      console.error('Error querying eBay API:', err);
    }
  }

  // 2. Read all Excel sheets and map all ItemIDs and Suppliers
  console.log('\nReading Excel files (FABIO & LILIANA)...');
  const excelLinks: Record<string, { itemId?: string; itemUrl?: string; supplier?: string; supplierUrl?: string }> = {};

  const files = [
    'COMPRAS EBAY/COMPRAS EBAY FABIO/Compras Ebay FABIO.xlsx',
    'COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx'
  ];

  for (const f of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(f);
    wb.worksheets.forEach(ws => {
      if (ws.name === 'TODO') return;
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const ord = String(row.getCell(5).value || '').trim();
        if (!ord || !ord.includes('-')) continue;

        let itemUrl = '';
        let supplierUrl = '';
        let supplierText = '';

        // Check Col 9 (Proveedor)
        const cell9 = row.getCell(9).value;
        if (cell9) {
          if (typeof cell9 === 'object' && 'hyperlink' in cell9) {
            supplierUrl = (cell9 as any).hyperlink || '';
            supplierText = (cell9 as any).text || '';
          } else {
            supplierText = String(cell9);
          }
        }

        // Check Col 10 (Descripción)
        const cell10 = row.getCell(10).value;
        if (cell10 && typeof cell10 === 'object' && 'hyperlink' in cell10) {
          const h = (cell10 as any).hyperlink;
          if (h.includes('ebay.com/itm/')) itemUrl = h;
        }

        // Also check any cell in the row for ebay.com/itm/
        if (!itemUrl) {
          for (let c = 1; c <= 20; c++) {
            const val = row.getCell(c).value;
            if (val && typeof val === 'object' && 'hyperlink' in val) {
              const h = (val as any).hyperlink;
              if (h.includes('ebay.com/itm/')) {
                itemUrl = h;
                break;
              }
            }
          }
        }

        const mItem = itemUrl.match(/\/itm\/(\d+)/);
        const itemId = mItem ? mItem[1] : undefined;

        if (itemId || supplierText) {
          if (!excelLinks[ord]) excelLinks[ord] = {};
          if (itemId) {
            excelLinks[ord].itemId = itemId;
            excelLinks[ord].itemUrl = itemUrl;
          }
          if (supplierText && supplierText.toLowerCase() !== 'ebay') {
            excelLinks[ord].supplier = supplierText;
          }
        }
      }
    });
  }

  console.log(`Mapped ${Object.keys(excelLinks).length} orders from Excel files.`);

  // 3. Update DB products with exact ItemID and Supplier
  const dbProducts = await db.product.findMany();
  console.log(`\nReviewing ${dbProducts.length} DB products...`);

  let dbUpdatedCount = 0;

  for (const p of dbProducts) {
    const currentNotes = p.notes || '';
    const currentItemIdMatch = currentNotes.match(/ItemID:\s*(\d+)/i);
    const currentItemId = currentItemIdMatch ? currentItemIdMatch[1] : null;

    const eb = ebayData[p.orderNumber];
    const ex = excelLinks[p.orderNumber];

    const targetItemId = eb?.itemId || ex?.itemId;
    const targetSupplier = eb?.seller || ex?.supplier;

    let needsUpdate = false;
    let newNotes = currentNotes;
    let newSupplier = p.supplier;

    // ItemID update
    if (targetItemId && (!currentItemId || currentItemId !== targetItemId)) {
      if (currentItemId) {
        newNotes = newNotes.replace(/ItemID:\s*\d+/i, `ItemID: ${targetItemId}`);
      } else {
        newNotes = `ItemID: ${targetItemId} | ${newNotes}`.trim();
      }
      needsUpdate = true;
    }

    // Supplier update (if DB has generic 'eBay'/'EBAY' but we have the real seller username)
    if (targetSupplier && targetSupplier.toLowerCase() !== 'ebay') {
      if (!p.supplier || p.supplier.toLowerCase() === 'ebay') {
        newSupplier = targetSupplier;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await db.product.update({
        where: { id: p.id },
        data: {
          notes: newNotes,
          supplier: newSupplier,
        },
      });
      dbUpdatedCount++;
      console.log(`✓ Updated DB [${p.orderNumber}]: Supplier -> ${newSupplier} | ItemID -> ${targetItemId}`);
    }
  }

  console.log(`\nTotal DB products updated: ${dbUpdatedCount}`);

  // 4. Update Excel files to sanitize any invalid hyperlinks
  console.log('\nSanitizing Excel files (cleaning /usr/EBAY and adding missing item links)...');

  for (const f of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(f);
    let wbModified = false;

    wb.worksheets.forEach(ws => {
      if (ws.name === 'TODO') return;
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const ord = String(row.getCell(5).value || '').trim();
        if (!ord || !ord.includes('-')) continue;

        const cell9 = row.getCell(9);
        const cell10 = row.getCell(10);

        // Sanitize supplier
        if (cell9.value && typeof cell9.value === 'object' && 'hyperlink' in cell9.value) {
          const h = (cell9.value as any).hyperlink;
          const text = (cell9.value as any).text || '';
          if (h.includes('/usr/EBAY') || h.includes('/usr/ebay') || text.toLowerCase() === 'ebay') {
            cell9.value = {
              text: 'eBay',
              hyperlink: 'https://www.ebay.com',
            };
            wbModified = true;
          }
        }

        // If supplier in DB or eBay API is known, update it in Excel
        const eb = ebayData[ord];
        if (eb?.seller && eb.seller.toLowerCase() !== 'ebay') {
          cell9.value = {
            text: eb.seller,
            hyperlink: `https://www.ebay.com/usr/${eb.seller}`,
          };
          wbModified = true;
        }

        // If ItemID is known and Col 10 lacks hyperlink, add it
        const targetItemId = eb?.itemId || excelLinks[ord]?.itemId;
        if (targetItemId) {
          const descText = typeof cell10.value === 'object' && 'text' in (cell10.value as any)
            ? (cell10.value as any).text
            : String(cell10.value || '');
          const currentLink = typeof cell10.value === 'object' && 'hyperlink' in (cell10.value as any)
            ? (cell10.value as any).hyperlink
            : '';

          if (descText && (!currentLink || !currentLink.includes(targetItemId))) {
            cell10.value = {
              text: descText,
              hyperlink: `https://www.ebay.com/itm/${targetItemId}`,
            };
            wbModified = true;
          }
        }
      }
    });

    if (wbModified) {
      await wb.xlsx.writeFile(f);
      console.log(`Saved changes to ${f}`);
    } else {
      console.log(`No changes needed in ${f}`);
    }
  }

  console.log('\n=== SYNC COMPLETED SUCCESSFULLY ===');
}

syncAll().catch(console.error).finally(() => process.exit(0));
