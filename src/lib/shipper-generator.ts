import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export interface EmbarqueRow {
  proveedor?: string;
  dniRuc?: string;
  consignatario?: string;
  courier?: string;
  trackingUsa: string;
  contenidoGeneral: string;
  paisFabricacion?: string;
  valorUsd: number;
  indicaciones?: string;
}

export interface TraduccionRow {
  productoNombre: string;
  marca: string;
  modelo: string;
  paisFabricacion: string;
  cantidad: number;
  estado: string;
  numeroFactura: string;
  numeroOperacion?: string;
}

function getTemplatesDir(): string {
  const p1 = path.join(process.cwd(), 'plantillas');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(process.cwd(), 'PLANTILLAS');
  if (fs.existsSync(p2)) return p2;
  return p1;
}

const TEMPLATES_DIR = getTemplatesDir();

/**
 * Generates the Hoja de Embarque Excel for Shipper
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

  // Populate actual items
  const startRow = 8;
  items.forEach((item, index) => {
    const row = ws.getRow(startRow + index);
    row.getCell(2).value = index + 1; // N°
    row.getCell(3).value = (item.proveedor || 'EBAY').toUpperCase();
    row.getCell(4).value = item.dniRuc || defaultRuc;
    row.getCell(5).value = (item.consignatario || defaultName).toUpperCase();
    row.getCell(6).value = (item.courier || 'UPS').toUpperCase();
    row.getCell(7).value = item.trackingUsa.trim();
    row.getCell(8).value = item.contenidoGeneral.trim();
    row.getCell(9).value = (item.paisFabricacion || 'CHINA').toUpperCase();
    row.getCell(10).value = Number(item.valorUsd) || 0;
    row.getCell(10).numFmt = '#,##0.00';
    row.getCell(11).value = item.indicaciones || '';

    // Style the populated cells cleanly
    for (let c = 2; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 9 };
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
 * Generates the Hoja de Traducción (Declaración Jurada SUNAT) for Shipper
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

  // Set AWB if given (cell D2 / C2)
  if (awbNumber) {
    ws.getCell('D2').value = awbNumber;
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
    row.getCell(2).value = index + 1; // N° ITEM
    row.getCell(3).value = item.productoNombre;
    row.getCell(4).value = item.marca;
    row.getCell(5).value = item.modelo;
    row.getCell(6).value = (item.paisFabricacion || 'CHINA').toUpperCase();
    row.getCell(7).value = item.cantidad || 1;
    row.getCell(8).value = item.estado || 'Usado';
    row.getCell(9).value = item.numeroFactura;
    row.getCell(10).value = item.numeroOperacion || '';

    // Style borders and fonts
    for (let c = 2; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: c === 3 || c === 5 ? 'left' : 'center' };
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

/**
 * Intelligent helper to auto-detect translation, brand, technical model, and condition
 */
export function autoClassifyProduct(product: {
  description: string;
  category?: string;
  model?: string;
  condition?: string;
  supplier?: string;
  orderNumber?: string;
}): TraduccionRow {
  const desc = product.description.toLowerCase();

  // Detect Spanish technical merchandise description
  let productoNombre = 'Dispositivo Electrónico';
  let marca = 'Genérica';

  if (desc.includes('ipad') || desc.includes('tablet') || desc.includes('tableta')) {
    productoNombre = 'Tableta Electrónica';
    marca = 'Apple';
  } else if (desc.includes('iphone') || desc.includes('celular') || desc.includes('smartphone') || desc.includes('galaxy') || desc.includes('pixel')) {
    productoNombre = 'Teléfono Celular Inteligente';
    marca = desc.includes('galaxy') || desc.includes('samsung') ? 'Samsung' : desc.includes('pixel') ? 'Google' : 'Apple';
  } else if (desc.includes('macbook') || desc.includes('laptop') || desc.includes('notebook') || desc.includes('thinkpad')) {
    productoNombre = 'Computadora Portátil (Laptop)';
    marca = desc.includes('thinkpad') || desc.includes('lenovo') ? 'Lenovo' : desc.includes('macbook') ? 'Apple' : 'HP';
  } else if (desc.includes('watch') || desc.includes('reloj')) {
    productoNombre = 'Reloj Inteligente (Smartwatch)';
    marca = desc.includes('apple') ? 'Apple' : 'Samsung';
  } else if (desc.includes('airpods') || desc.includes('audifonos') || desc.includes('earbuds') || desc.includes('headphones')) {
    productoNombre = 'Auriculares Inalámbricos';
    marca = desc.includes('apple') ? 'Apple' : 'Sony';
  }

  // Model extraction
  let modelo = product.model || '';
  const aNumberMatch = product.description.match(/\b(A\d{4})\b/i);
  if (aNumberMatch) {
    modelo = aNumberMatch[1].toUpperCase();
  } else if (!modelo) {
    if (desc.includes('ipad pro 10.5') || desc.includes('10,5 pulgadas')) {
      modelo = 'A1701 (iPad Pro 10.5)';
    } else if (desc.includes('ipad 7') || desc.includes('10.2')) {
      modelo = 'A2197 (iPad 7th Gen)';
    } else if (desc.includes('ipad air 3')) {
      modelo = 'A2152 (iPad Air 3)';
    } else {
      modelo = product.description.substring(0, 40);
    }
  }

  // Condition
  let estado = 'Usado';
  const cond = (product.condition || '').toLowerCase();
  if (cond.includes('new') || cond.includes('nuevo') || desc.includes('brand new') || desc.includes('sellado')) {
    estado = 'Nuevo';
  } else if (cond.includes('refurb') || desc.includes('refurbished') || desc.includes('reacondicionado')) {
    estado = 'Reacondicionado';
  }

  return {
    productoNombre,
    marca,
    modelo,
    paisFabricacion: 'CHINA',
    cantidad: 1,
    estado,
    numeroFactura: product.orderNumber || '',
    numeroOperacion: '',
  };
}
