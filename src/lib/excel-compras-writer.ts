import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';

const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const MONTH_NAMES_LOWER = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// Simple mutex queue to prevent race conditions when writing to Excel files concurrently
class FileLock {
  private queue = Promise.resolve();
  acquire<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(() => task());
    this.queue = result.then(() => {}, () => {});
    return result;
  }
}

const fabioLock = new FileLock();
const lilianaLock = new FileLock();

export interface PurchaseRecordInput {
  orderNumber: string;
  purchaseDate: Date | string;
  courier?: string | null;
  trackingId?: string | null;
  shipperTracking?: string | null;
  shipperConfirmed?: boolean;
  supplier?: string | null;
  description: string;
  purchasePriceUsd: number;
  importerProfile?: string | null;
  recipientName?: string | null;
  itemId?: string | null;
  orderTotalUsd?: number | null;
  exchangeRate?: number | null;
  notes?: string | null;
  isArchived?: boolean | null;
  shippingStatus?: string | null;
}

export interface SyncExcelResult {
  totalScanned: number;
  addedToFabio: number;
  addedToLiliana: number;
  updatedFabio: number;
  updatedLiliana: number;
  alreadyExists: number;
  errors: string[];
}

/**
 * Identify if a record belongs to Peggy / Liliana or Fabio
 */
export function isLilianaRecord(importerProfile?: string | null, recipientName?: string | null): boolean {
  const imp = (importerProfile || '').toLowerCase();
  const rec = (recipientName || '').toLowerCase();
  return (
    imp === 'peggy' ||
    imp === 'liliana' ||
    rec.includes('peggy') ||
    rec.includes('liliana') ||
    rec.includes('orduna') ||
    rec.includes('orduña') ||
    rec.includes('10091870911') ||
    rec.includes('09187091')
  );
}

/**
 * Return absolute path to the target master Excel workbook for a specific year (2026 or 2025)
 */
export function getExcelWorkbookPath(isLiliana: boolean, year: number | string = 2026): string {
  const baseDir = process.env.COMPRAS_EBAY_DIR || path.join(process.cwd(), 'COMPRAS EBAY');
  const ownerFolder = isLiliana ? 'COMPRAS EBAY LILIANA' : 'COMPRAS EBAY FABIO';
  const person = isLiliana ? 'LILIANA' : 'FABIO';
  const yStr = String(year);
  if (yStr === '2025') {
    const subPath = path.join(baseDir, ownerFolder, '2025', `Compras Ebay ${person} 2025.xlsx`);
    if (fs.existsSync(subPath)) return subPath;
    return path.join(baseDir, ownerFolder, `Compras Ebay ${person} 2025.xlsx`);
  }
  return path.join(baseDir, ownerFolder, `Compras Ebay ${person}.xlsx`);
}

/**
 * Format a Date into natural Spanish format matching user's existing Excel sheets:
 * e.g. "27 de septiembre de 2026 a las 16:30"
 */
export function formatPurchaseDateSpanish(date: Date): string {
  const day = date.getDate();
  const month = MONTH_NAMES_LOWER[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${day} de ${month} de ${year} a las ${hours}:${mins}`;
}

/**
 * Clean and normalize tracking numbers
 */
function cleanTracking(str?: string | null): string {
  if (!str) return '';
  const s = String(str).trim();
  if (s === 'SIN_TRACKING' || s === '0' || s === '-') return '';
  return s;
}

/**
 * Normalize order number for matching
 */
function normalizeOrderNum(str?: string | null): string {
  if (!str) return '';
  return String(str).trim().toLowerCase().replace(/^#/, '');
}

/**
 * Find dynamic column mapping in a sheet given its header row
 */
function getHeaderColumnMap(ws: ExcelJS.Worksheet): { headerRowIdx: number; colMap: Record<string, number> } {
  let headerRowIdx = 3;
  let found = false;

  for (let r = 1; r <= 10; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 25; c++) {
      const val = String(row.getCell(c).value || '').toUpperCase();
      if (val.includes('NUMERO DE ORDEN') || val.includes('FECHA COMPRA')) {
        headerRowIdx = r;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  const headerRow = ws.getRow(headerRowIdx);
  const colMap: Record<string, number> = {};

  for (let c = 1; c <= 26; c++) {
    const text = String(headerRow.getCell(c).value || '').trim().toUpperCase();
    if (!text) continue;

    if (text.includes('FECHA COMPRA') || text === 'FECHA') colMap['fechaCompra'] = c;
    else if (text.includes('SISTEMA')) colMap['sistema'] = c;
    else if (text.includes('EMBARCA') || text.includes('ENVIADO')) colMap['enviadoEmbarcacion'] = c;
    else if (text.includes('NUMERO DE ORDEN') || text.includes('ORDEN') || text === 'ORDER') colMap['numeroOrden'] = c;
    else if (text.includes('COURIER')) colMap['courier'] = c;
    else if (text.includes('SHIPER') || text.includes('VERIFICADO') || (text.includes('TRACKING') && text.includes('EMBARQUE'))) colMap['trackingShiper'] = c;
    else if (text.includes('TRACKING') || text.includes('GUIA')) colMap['tracking'] = c;
    else if (text.includes('PROVEEDOR') || text.includes('VENDEDOR') || text.includes('SELLER')) colMap['proveedor'] = c;
    else if (text.includes('DESCRIP') || text.includes('PRODUCTO') || text.includes('ITEM')) colMap['descripcion'] = c;
    else if (text.includes('PRECIO COMPRA $') || text === 'PRECIO $' || text === 'COSTO $') colMap['precioUsd'] = c;
    else if (text.includes('PRECIO COMPRA S/') || text.includes('PRECIO SOLES') || text === 'TOTAL S/') colMap['precioPen'] = c;
    else if (text.includes('STOCK')) colMap['stock'] = c;
    else if (text.includes('PRECIO SUGERIDO')) colMap['precioSugerido'] = c;
    else if (text.includes('T/C') || text === 'TC') colMap['tc'] = c;
  }

  // Sensible default fallbacks if not explicitly found in header
  if (!colMap['fechaCompra']) colMap['fechaCompra'] = 2; // Col B
  if (!colMap['sistema']) colMap['sistema'] = 3;         // Col C
  if (!colMap['enviadoEmbarcacion']) colMap['enviadoEmbarcacion'] = 4; // Col D
  if (!colMap['numeroOrden']) colMap['numeroOrden'] = 5; // Col E
  if (!colMap['courier']) colMap['courier'] = 6;         // Col F
  if (!colMap['tracking']) colMap['tracking'] = 7;       // Col G
  if (!colMap['proveedor']) colMap['proveedor'] = 8;     // Col H
  if (!colMap['descripcion']) colMap['descripcion'] = 9; // Col I
  if (!colMap['precioUsd']) colMap['precioUsd'] = 10;    // Col J
  if (!colMap['precioPen']) colMap['precioPen'] = 11;    // Col K
  if (!colMap['stock']) colMap['stock'] = 16;            // Col P

  return { headerRowIdx, colMap };
}

/**
 * Ensure a month worksheet exists in workbook; clones template if missing
 */
function ensureMonthWorksheet(wb: ExcelJS.Workbook, monthName: string): ExcelJS.Worksheet {
  let ws = wb.getWorksheet(monthName);
  if (ws) return ws;

  // Find a template month sheet to copy headers & column styles
  const templateSheet =
    wb.getWorksheet('FEBRERO') ||
    wb.getWorksheet('SEPTIEMBRE') ||
    wb.getWorksheet('NOVIEMBRE') ||
    wb.worksheets.find((w) => w.name !== 'TODO');

  ws = wb.addWorksheet(monthName);

  if (templateSheet) {
    // Copy column widths
    templateSheet.columns.forEach((col, idx) => {
      if (col && col.width) {
        ws.getColumn(idx + 1).width = col.width;
      }
    });

    // Copy rows 1 to 3 (headers and title rows)
    for (let r = 1; r <= 3; r++) {
      const srcRow = templateSheet.getRow(r);
      const destRow = ws.getRow(r);
      destRow.height = srcRow.height;
      srcRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const destCell = destRow.getCell(colNumber);
        destCell.value = cell.value;
        destCell.style = { ...cell.style };
      });
    }
  }

  return ws;
}

/**
 * Inserts or updates a single purchase inside an open Excel workbook
 */
function processPurchaseInWorkbook(
  wb: ExcelJS.Workbook,
  purchase: PurchaseRecordInput
): { action: 'created' | 'updated' | 'skipped'; sheetName: string; row: number } {
  const pDate = purchase.purchaseDate instanceof Date ? purchase.purchaseDate : new Date(purchase.purchaseDate);
  const validDate = isNaN(pDate.getTime()) ? new Date() : pDate;
  const monthName = MONTH_NAMES[validDate.getMonth()];

  const ws = ensureMonthWorksheet(wb, monthName);
  const { headerRowIdx, colMap } = getHeaderColumnMap(ws);

  const targetOrder = normalizeOrderNum(purchase.orderNumber);
  const targetTrack = cleanTracking(purchase.trackingId);

  let existingRowIdx = -1;
  let firstEmptyRowIdx = -1;
  let sectionBreakRowIdx = -1;

  // Scan rows from headerRowIdx + 1 down to section break or row 90
  const maxRow = Math.max(ws.rowCount, headerRowIdx + 30);
  for (let r = headerRowIdx + 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const cellOrderVal = normalizeOrderNum(String(row.getCell(colMap['numeroOrden']).value || ''));
    const cellTrackVal = cleanTracking(String(row.getCell(colMap['tracking']).value || ''));
    const cellDateVal = String(row.getCell(colMap['fechaCompra']).value || '').trim().toUpperCase();

    // Detect section break (e.g. "COMPRAS LOCALES" or "TOTAL")
    if (cellDateVal.includes('COMPRAS LOCALES') || cellDateVal.includes('TOTAL')) {
      sectionBreakRowIdx = r;
      break;
    }

    // Check match by Order Number or Tracking Number
    const matchByOrder = targetOrder && cellOrderVal && (targetOrder === cellOrderVal || cellOrderVal.startsWith(targetOrder) || targetOrder.startsWith(cellOrderVal));
    const matchByTrack = targetTrack && cellTrackVal && (targetTrack === cellTrackVal);

    if (matchByOrder || matchByTrack) {
      existingRowIdx = r;
      break;
    }

    // Check if this row is completely empty for orders
    if (!cellOrderVal && !cellTrackVal && !cellDateVal && firstEmptyRowIdx === -1) {
      firstEmptyRowIdx = r;
    }
  }

  // Case A: Order already exists in sheet
  if (existingRowIdx !== -1) {
    const row = ws.getRow(existingRowIdx);
    let changed = false;

    // If tracking was missing or placeholder, update it
    const currentTrack = cleanTracking(String(row.getCell(colMap['tracking']).value || ''));
    if (!currentTrack && targetTrack) {
      const cellTrack = row.getCell(colMap['tracking']);
      if (cellTrack.model) {
        delete cellTrack.model.sharedFormula;
        delete cellTrack.model.formula;
      }
      cellTrack.value = targetTrack;

      if (purchase.courier) {
        const cellCourier = row.getCell(colMap['courier']);
        if (cellCourier.model) {
          delete cellCourier.model.sharedFormula;
          delete cellCourier.model.formula;
        }
        cellCourier.value = purchase.courier.toUpperCase();
      }
      changed = true;
    }

    if (colMap['trackingShiper'] && purchase.shipperTracking) {
      const cellShiper = row.getCell(colMap['trackingShiper']);
      const curShiper = cleanTracking(String(cellShiper.value || ''));
      if (curShiper !== purchase.shipperTracking) {
        if (cellShiper.model) {
          delete cellShiper.model.sharedFormula;
          delete cellShiper.model.formula;
        }
        cellShiper.value = purchase.shipperTracking;
        changed = true;
      }
    }

    if (colMap['enviadoEmbarcacion']) {
      const cellEmb = row.getCell(colMap['enviadoEmbarcacion']);
      const isEmb = purchase.isArchived || purchase.shippingStatus === 'ENTREGADO_LIMA';
      const desired = isEmb ? 'SI' : 'NO';
      if (String(cellEmb.value || '') !== desired) {
        cellEmb.value = desired;
        changed = true;
      }
    }

    if (changed) {
      return { action: 'updated', sheetName: monthName, row: existingRowIdx };
    }
    return { action: 'skipped', sheetName: monthName, row: existingRowIdx };
  }

  // Case B: Insert new purchase
  let insertRowIdx = firstEmptyRowIdx;
  if (insertRowIdx === -1 || (sectionBreakRowIdx !== -1 && insertRowIdx >= sectionBreakRowIdx)) {
    insertRowIdx = sectionBreakRowIdx !== -1 ? sectionBreakRowIdx - 1 : ws.rowCount + 1;
    if (insertRowIdx <= headerRowIdx) {
      insertRowIdx = headerRowIdx + 1;
    }
  }

  const row = ws.getRow(insertRowIdx);
  const prevRow = ws.getRow(insertRowIdx > headerRowIdx + 1 ? insertRowIdx - 1 : headerRowIdx + 1);

  // Clear any formula models on target cells to avoid sharedFormula collisions
  for (let c = 1; c <= 25; c++) {
    const cell = row.getCell(c);
    if (cell.model) {
      delete cell.model.sharedFormula;
      delete cell.model.formula;
    }
  }

  // Values
  row.getCell(colMap['fechaCompra']).value = formatPurchaseDateSpanish(validDate);
  row.getCell(colMap['sistema']).value = 'SI';
  const isNewEmb = purchase.isArchived || purchase.shippingStatus === 'ENTREGADO_LIMA';
  row.getCell(colMap['enviadoEmbarcacion']).value = isNewEmb ? 'SI' : 'NO';
  row.getCell(colMap['numeroOrden']).value = purchase.orderNumber || '';
  row.getCell(colMap['courier']).value = (purchase.courier || 'USPS').toUpperCase();
  row.getCell(colMap['tracking']).value = targetTrack;
  if (colMap['trackingShiper']) {
    row.getCell(colMap['trackingShiper']).value = purchase.shipperTracking || targetTrack;
  }

  // Supplier with hyperlink
  const supplierName = (purchase.supplier || 'eBay').trim();
  const isGeneric = ['ebay', 'usps', 'ups', 'fedex', 'dhl', 'desconocido'].includes(supplierName.toLowerCase());
  if (!isGeneric) {
    row.getCell(colMap['proveedor']).value = {
      text: supplierName,
      hyperlink: `https://www.ebay.com/usr/${encodeURIComponent(supplierName)}`,
    };
  } else {
    row.getCell(colMap['proveedor']).value = {
      text: 'eBay',
      hyperlink: 'https://www.ebay.com',
    };
  }

  // Description with item hyperlink if itemId is available
  const itemId = purchase.itemId || purchase.notes?.match(/ItemID:\s*(\d+)/i)?.[1];
  if (itemId) {
    row.getCell(colMap['descripcion']).value = {
      text: purchase.description,
      hyperlink: `https://www.ebay.com/itm/${itemId}`,
    };
  } else {
    row.getCell(colMap['descripcion']).value = purchase.description;
  }

  // Prices
  const priceUsd = Number(purchase.purchasePriceUsd) || 0;
  const tc = purchase.exchangeRate || 3.40;
  row.getCell(colMap['precioUsd']).value = priceUsd;
  row.getCell(colMap['precioPen']).value = Math.round(priceUsd * tc * 100) / 100;
  row.getCell(colMap['stock']).value = 1;

  // Copy cell styles from previous row to maintain immaculate formatting
  if (prevRow) {
    for (let c = 1; c <= 22; c++) {
      const srcCell = prevRow.getCell(c);
      const destCell = row.getCell(c);
      if (srcCell && srcCell.style) {
        destCell.style = {
          font: srcCell.font ? { ...srcCell.font } : undefined,
          alignment: srcCell.alignment ? { ...srcCell.alignment } : undefined,
          border: srcCell.border ? { ...srcCell.border } : undefined,
          numFmt: srcCell.numFmt,
        };
      }
    }
  }

  return { action: 'created', sheetName: monthName, row: insertRowIdx };
}

/**
 * Sanitizes any dangling or broken shared formula references across all worksheets
 * by converting shared formula clones into their evaluated clean result.
 */
function sanitizeSharedFormulas(wb: ExcelJS.Workbook): void {
  wb.worksheets.forEach((ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const m = cell.model as any;
        if (m && m.sharedFormula) {
          const res = m.result;
          delete m.sharedFormula;
          delete m.formula;
          delete m.shareType;
          delete m.ref;
          delete m.si;
          cell.value = (res !== undefined && res !== null) ? res : 0;
        }
      });
    });
  });
}

/**
 * Append or update a single purchase in the respective Excel file on disk.
 * Uses mutex queue per file to prevent write contention.
 */
export async function appendPurchaseToEbayExcel(
  purchase: PurchaseRecordInput
): Promise<{ success: boolean; action: 'created' | 'updated' | 'skipped'; file: string; sheet: string; message: string }> {
  const isLiliana = isLilianaRecord(purchase.importerProfile, purchase.recipientName);
  const filePath = getExcelWorkbookPath(isLiliana);
  const lock = isLiliana ? lilianaLock : fabioLock;
  const profileName = isLiliana ? 'Liliana / Peggy' : 'Fabio';

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      action: 'skipped',
      file: filePath,
      sheet: '',
      message: `El archivo Excel maestro para ${profileName} no fue encontrado en: ${filePath}`,
    };
  }

  return lock.acquire(async () => {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);

      const res = processPurchaseInWorkbook(wb, purchase);

      if (res.action !== 'skipped') {
        // Safe backup before write
        const backupPath = `${filePath}.bak`;
        try {
          fs.copyFileSync(filePath, backupPath);
        } catch {
          // Ignore backup failure if non-critical
        }

        sanitizeSharedFormulas(wb);
        await wb.xlsx.writeFile(filePath);
      }

      const actionMsg =
        res.action === 'created'
          ? `Agregada nueva compra en fila ${res.row} de la pestaña ${res.sheetName}`
          : res.action === 'updated'
          ? `Actualizado tracking en fila ${res.row} de la pestaña ${res.sheetName}`
          : `Compra ya registrada en fila ${res.row} de ${res.sheetName}`;

      return {
        success: true,
        action: res.action,
        file: path.basename(filePath),
        sheet: res.sheetName,
        message: `${actionMsg} (${profileName}).`,
      };
    } catch (err: any) {
      console.error(`Error writing purchase to Excel (${profileName}):`, err);
      if (err?.code === 'EBUSY') {
        return {
          success: false,
          action: 'skipped',
          file: path.basename(filePath),
          sheet: '',
          message: `El archivo ${path.basename(filePath)} está abierto en Excel u otro programa. Ciérralo para completar el autoguardado.`,
        };
      }
      return {
        success: false,
        action: 'skipped',
        file: path.basename(filePath),
        sheet: '',
        message: err.message || 'Error al escribir en Excel',
      };
    }
  });
}

/**
 * Batch synchronize purchases to both Fabio and Liliana Excel workbooks.
 */
export async function syncBatchPurchasesToExcel(purchases: PurchaseRecordInput[]): Promise<SyncExcelResult> {
  const result: SyncExcelResult = {
    totalScanned: purchases.length,
    addedToFabio: 0,
    addedToLiliana: 0,
    updatedFabio: 0,
    updatedLiliana: 0,
    alreadyExists: 0,
    errors: [],
  };

  const fabioPurchases = purchases.filter((p) => !isLilianaRecord(p.importerProfile, p.recipientName));
  const lilianaPurchases = purchases.filter((p) => isLilianaRecord(p.importerProfile, p.recipientName));

  // Process Fabio purchases
  if (fabioPurchases.length > 0) {
    const fabioPath = getExcelWorkbookPath(false);
    if (fs.existsSync(fabioPath)) {
      await fabioLock.acquire(async () => {
        try {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.readFile(fabioPath);
          let modified = false;

          for (const p of fabioPurchases) {
            const r = processPurchaseInWorkbook(wb, p);
            if (r.action === 'created') {
              result.addedToFabio++;
              modified = true;
            } else if (r.action === 'updated') {
              result.updatedFabio++;
              modified = true;
            } else {
              result.alreadyExists++;
            }
          }

          if (modified) {
            fs.copyFileSync(fabioPath, `${fabioPath}.bak`);
            sanitizeSharedFormulas(wb);
            await wb.xlsx.writeFile(fabioPath);
          }
        } catch (err: any) {
          result.errors.push(`Error en Excel Fabio: ${err.message}`);
        }
      });
    } else {
      result.errors.push(`No se encontró el archivo Excel de Fabio: ${fabioPath}`);
    }
  }

  // Process Liliana purchases
  if (lilianaPurchases.length > 0) {
    const lilianaPath = getExcelWorkbookPath(true);
    if (fs.existsSync(lilianaPath)) {
      await lilianaLock.acquire(async () => {
        try {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.readFile(lilianaPath);
          let modified = false;

          for (const p of lilianaPurchases) {
            const r = processPurchaseInWorkbook(wb, p);
            if (r.action === 'created') {
              result.addedToLiliana++;
              modified = true;
            } else if (r.action === 'updated') {
              result.updatedLiliana++;
              modified = true;
            } else {
              result.alreadyExists++;
            }
          }

          if (modified) {
            fs.copyFileSync(lilianaPath, `${lilianaPath}.bak`);
            sanitizeSharedFormulas(wb);
            await wb.xlsx.writeFile(lilianaPath);
          }
        } catch (err: any) {
          result.errors.push(`Error en Excel Liliana: ${err.message}`);
        }
      });
    } else {
      result.errors.push(`No se encontró el archivo Excel de Liliana: ${lilianaPath}`);
    }
  }

  return result;
}

/**
 * Scan all products in database and guarantee both Excel master files are populated
 */
export async function syncAllDbProductsToExcel(tenantId?: string | null): Promise<SyncExcelResult> {
  const where = tenantId ? { tenantId } : {};
  const products = await db.product.findMany({
    where,
    orderBy: { purchaseDate: 'asc' },
  });

  const inputs: PurchaseRecordInput[] = products.map((p) => ({
    orderNumber: p.orderNumber,
    purchaseDate: p.purchaseDate || p.createdAt,
    courier: p.courier,
    trackingId: p.trackingId,
    supplier: p.supplier,
    description: p.description,
    purchasePriceUsd: p.purchasePriceUsd,
    importerProfile: p.importerProfile,
    recipientName: p.recipientName,
    notes: p.notes,
    exchangeRate: p.exchangeRate,
  }));

  return syncBatchPurchasesToExcel(inputs);
}
