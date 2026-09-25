import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/db';

function formatSpanishDate(d: Date): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} de ${month} de ${year} a las ${hours}:${mins}`;
}

async function populate() {
  const filePath = path.join(process.cwd(), 'PLANTILLAS', 'COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.xlsx');
  const backupPath = path.join(process.cwd(), 'PLANTILLAS', 'COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.backup.xlsx');

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log('✓ Respaldo creado en:', backupPath);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const products = await db.product.findMany({
    orderBy: { purchaseDate: 'asc' },
  });
  console.log(`Total productos en DB: ${products.length}`);

  const wsSep = wb.getWorksheet('SEPTIEMBRE');
  const wsAgo = wb.getWorksheet('AGOSTO');
  const wsTodo = wb.getWorksheet('TODO');

  const thinBorder: Partial<ExcelJS.Borders> = {
    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  };

  const fontStandard: Partial<ExcelJS.Font> = {
    name: 'Arial',
    size: 10,
    color: { argb: 'FF111820' },
  };

  const fontLink: Partial<ExcelJS.Font> = {
    name: 'Arial',
    size: 10,
    color: { argb: 'FF1A0DAB' },
    underline: true,
  };

  // 1. Poblado en SEPTIEMBRE
  if (wsSep) {
    // Collect existing orderNumbers in SEPTIEMBRE
    const existingOrders = new Set<string>();
    for (let r = 4; r <= wsSep.rowCount; r++) {
      const ord = wsSep.getRow(r).getCell(5).value;
      if (ord) existingOrders.add(String(ord).trim());
    }

    // Set TC
    wsSep.getCell('U4').value = 3.40;

    // Find next empty row
    let nextRow = 4;
    while (wsSep.getRow(nextRow).getCell(2).value || wsSep.getRow(nextRow).getCell(5).value) {
      nextRow++;
    }

    const sepProds = products.filter(p => {
      const d = p.purchaseDate || p.createdAt;
      return d.getMonth() === 8; // September
    });

    let addedSep = 0;
    for (const p of sepProds) {
      const ordNum = p.orderNumber.trim();
      if (existingOrders.has(ordNum)) {
        continue;
      }

      const row = wsSep.getRow(nextRow);
      const pDate = p.purchaseDate || p.createdAt;
      const orderTotalUsd = (p.purchasePriceUsd || 0) + (p.shippingCostUsd || 0);

      // Col 2: FECHA COMPRA
      row.getCell(2).value = formatSpanishDate(pDate);
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      // Col 3: SISTEMA
      row.getCell(3).value = 'SI';
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

      // Col 4: ENVIADO EMBARCACIÓN
      row.getCell(4).value = p.isArchived || p.shippingStatus === 'Peru' || p.shippingStatus === 'Perú' ? 'SI' : (p.shipperConfirmed ? 'LISTO' : 'NO');
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

      // Col 5: NUMERO DE ORDEN
      row.getCell(5).value = p.orderNumber;
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      // Col 6: COURIER
      row.getCell(6).value = p.courier || 'USPS';
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

      // Col 7: TRACKING
      row.getCell(7).value = (p.shipperTracking || p.trackingId || '').trim();
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

      // Col 8: PROVEEDOR
      const supplierName = p.supplier || 'eBay';
      row.getCell(8).value = {
        text: supplierName,
        hyperlink: `https://www.ebay.com/usr/${supplierName}`,
      };
      row.getCell(8).font = fontLink;
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

      // Col 9: DESCRIPCIÓN
      const itemMatch = p.notes?.match(/ItemID:\s*(\d+)/i) || p.description?.match(/#?(\d{12})/);
      const itemId = itemMatch ? itemMatch[1] : undefined;
      const descUrl = itemId
        ? `https://www.ebay.com/itm/${itemId}`
        : (p.orderNumber ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}` : undefined);

      if (descUrl) {
        row.getCell(9).value = { text: p.description, hyperlink: descUrl };
        row.getCell(9).font = fontLink;
      } else {
        row.getCell(9).value = p.description;
      }
      row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

      // Col 10: PRECIO COMPRA $
      row.getCell(10).value = orderTotalUsd;
      row.getCell(10).numFmt = '$#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };

      // Col 11: PRECIO COMPRA S/
      row.getCell(11).value = {
        formula: `J${nextRow}*$U$4`,
        result: orderTotalUsd * 3.40,
      };
      row.getCell(11).numFmt = '#,##0.00';
      row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };

      // Col 12: PRECIO DE VENTA
      if (p.salePricePen && p.salePricePen > 0) {
        row.getCell(12).value = p.salePricePen;
        row.getCell(12).numFmt = '#,##0.00';
      }
      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };

      // Col 13: PUBLICIDAD
      if (p.advertisingCostUsd && p.advertisingCostUsd > 0) {
        row.getCell(13).value = p.advertisingCostUsd;
        row.getCell(13).numFmt = '$#,##0.00';
      }
      row.getCell(13).alignment = { horizontal: 'right', vertical: 'middle' };

      // Col 14: COSTOS EXTRA
      if (p.extraCostsUsd && p.extraCostsUsd > 0) {
        row.getCell(14).value = p.extraCostsUsd;
        row.getCell(14).numFmt = '$#,##0.00';
      }
      row.getCell(14).alignment = { horizontal: 'right', vertical: 'middle' };

      // Col 15: GANANCIA
      if (p.profitPen) {
        row.getCell(15).value = p.profitPen;
        row.getCell(15).numFmt = '#,##0.00';
      }
      row.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };

      // Col 16: STOCK
      row.getCell(16).value = p.quantity || 1;
      row.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };

      // Col 17: PRECIO SUGERIDO
      if (p.suggestedPricePen && p.suggestedPricePen > 0) {
        row.getCell(17).value = p.suggestedPricePen;
        row.getCell(17).numFmt = '#,##0.00';
      }
      row.getCell(17).alignment = { horizontal: 'right', vertical: 'middle' };

      // Apply borders & font to all columns 2..19
      for (let c = 2; c <= 19; c++) {
        const cell = row.getCell(c);
        cell.border = thinBorder;
        if (!cell.font) cell.font = fontStandard;
      }

      existingOrders.add(ordNum);
      nextRow++;
      addedSep++;
    }
    console.log(`✓ Agregadas ${addedSep} compras a la hoja SEPTIEMBRE.`);
  }

  // Save workbook
  await wb.xlsx.writeFile(filePath);
  console.log('✓ Archivo Excel actualizado exitosamente:', filePath);
}

populate().catch(console.error).finally(() => process.exit(0));
