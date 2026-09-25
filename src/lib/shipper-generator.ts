import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import {
  EmbarqueRow,
  TraduccionRow,
  autoClassifyProduct,
  sanitizeSunatModel,
} from './shipper-classification';

export type { EmbarqueRow, TraduccionRow };
export { autoClassifyProduct, sanitizeSunatModel };

function getTemplatesDir(): string {
  const p1 = path.join(process.cwd(), 'plantillas');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(process.cwd(), 'PLANTILLAS');
  if (fs.existsSync(p2)) return p2;
  return p1;
}

const TEMPLATES_DIR = getTemplatesDir();

/**
 * Generates the Hoja de Embarque Excel for Shipper Miami
 */
export async function generateEmbarqueWorkbook(
  items: EmbarqueRow[],
  defaultConfig: { ruc?: string; name?: string } = {}
): Promise<Buffer> {
  const templatePath = path.join(TEMPLATES_DIR, 'SHIPER FORMATO ORDEN DE EMBARQUE ACTUALIZADO.xlsx');
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Plantilla de embarque no encontrada en: ${templatePath}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  // Remove demo sheet
  const ejemploSheet = wb.getWorksheet('EJEMPLO');
  if (ejemploSheet) {
    wb.removeWorksheet(ejemploSheet.id);
  }

  const ws = wb.getWorksheet('ORDEN DE EMBARQUE');
  if (!ws) {
    throw new Error("No se encontró la hoja 'ORDEN DE EMBARQUE' en la plantilla");
  }

  const defaultRuc = defaultConfig.ruc || '10762026835';
  const defaultName = defaultConfig.name || 'FABIO CESAR HERRERA BONILLA';

  // Clear existing template sample rows (rows 8 to 22)
  for (let r = 8; r <= 22; r++) {
    const row = ws.getRow(r);
    for (let c = 2; c <= 11; c++) {
      row.getCell(c).value = null;
    }
  }

  // Populate actual items starting at row 8
  const startRow = 8;
  items.forEach((item, index) => {
    const row = ws.getRow(startRow + index);
    row.getCell(2).value = index + 1; // N°
    row.getCell(3).value = (item.proveedor || 'EBAY').toUpperCase();
    row.getCell(4).value = item.dniRuc || defaultRuc;
    row.getCell(5).value = (item.consignatario || defaultName).toUpperCase();
    row.getCell(6).value = (item.courier || 'UPS').toUpperCase();
    row.getCell(7).value = (item.trackingUsa || '').trim();

    // Contenido general: título exacto del producto tal como se compró en eBay
    const cleanContent = (item.contenidoGeneral || '').trim();
    if (item.itemUrl) {
      row.getCell(8).value = { text: cleanContent, hyperlink: item.itemUrl };
      row.getCell(8).font = { name: 'Calibri', size: 11, color: { theme: 10 }, underline: true };
    } else {
      row.getCell(8).value = cleanContent;
      row.getCell(8).font = { name: 'Calibri', size: 9 };
    }

    row.getCell(9).value = (item.paisFabricacion || 'CHINA').toUpperCase();
    row.getCell(10).value = Number(item.valorUsd) || 0;
    row.getCell(10).numFmt = '#,##0.00';
    
    // Indicaciones: strictly blank / null for administrative courier use
    row.getCell(11).value = null;

    // Style the populated cells cleanly
    for (let c = 2; c <= 11; c++) {
      const cell = row.getCell(c);
      if (c !== 8) {
        cell.font = { name: 'Calibri', size: 9 };
      }
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: c === 8 ? 'left' : 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  });

  // Calculate total row position
  const totalRowIndex = Math.max(23, startRow + items.length + 1);
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.getCell(8).value = 'TOTAL';
  totalRow.getCell(8).font = { name: 'Calibri', size: 9, bold: true };
  totalRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

  const lastDataRow = startRow + items.length - 1;
  totalRow.getCell(10).value = {
    formula: `SUM(J8:J${lastDataRow >= 8 ? lastDataRow : 8})`,
  };
  totalRow.getCell(10).numFmt = '#,##0.00';
  totalRow.getCell(10).font = { name: 'Calibri', size: 9, bold: true };
  totalRow.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generates the Hoja de Traducción (Declaración Jurada SUNAT) for Aduanas
 */
export async function generateTraduccionWorkbook(
  items: TraduccionRow[],
  awbNumber: string = ''
): Promise<Buffer> {
  const templatePath = path.join(TEMPLATES_DIR, 'FABIO Copia de FORMATO_TRADUCCION_DE_FACTURA.xlsx');
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Plantilla de traducción no encontrada en: ${templatePath}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  const ws = wb.getWorksheet('Hoja1') || wb.worksheets[0];
  if (!ws) {
    throw new Error("No se encontró la hoja en la plantilla de traducción");
  }

  // Set AWB if given (cell D2)
  if (awbNumber) {
    const awbCell = ws.getCell('D2');
    awbCell.value = awbNumber;
    awbCell.font = { name: 'Arial', size: 12, bold: true };
    awbCell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Clear rows 6 to 12
  for (let r = 6; r <= 12; r++) {
    const row = ws.getRow(r);
    for (let c = 2; c <= 10; c++) {
      row.getCell(c).value = null;
    }
  }

  // Populate rows starting at row 6
  const startRow = 6;
  items.forEach((item, index) => {
    const row = ws.getRow(startRow + index);
    row.height = 56.25; // Matching user's template row height

    row.getCell(2).value = index + 1; // N° ITEM
    row.getCell(3).value = item.productoNombre || 'Tableta Electrónica';
    row.getCell(4).value = item.marca || 'Apple';
    row.getCell(5).value = sanitizeSunatModel(item.modelo); // STRICTLY A#### code (e.g. A1701)
    row.getCell(6).value = (item.paisFabricacion || 'CHINA').toUpperCase();
    row.getCell(7).value = Number(item.cantidad) || 1;
    row.getCell(8).value = item.estado || 'Usado';
    row.getCell(9).value = item.numeroFactura || '';
    row.getCell(10).value = null; // NUMERO DE OPERACIÓN: strictly blank

    // Style borders and fonts: Arial 14 Bold, centered, matching user reference images
    for (let c = 2; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Arial', size: 14, bold: true, family: 2 };
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
