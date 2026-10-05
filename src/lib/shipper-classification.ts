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
  itemUrl?: string;
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

/**
 * Strict sanitizer for SUNAT customs model.
 * SUNAT requires ONLY the manufacturer technical model code (e.g. "A1701", "A2200", "A2141").
 * Strips out words like "iPad", "Pro", "Mod:", "Modelo:", parentheses, etc.
 */
export function sanitizeSunatModel(rawModel?: string): string {
  if (!rawModel) return '';
  const trimmed = rawModel.trim();

  // 1. Look for Apple A-code first: A followed by 4 digits
  const aMatch = trimmed.match(/\b(A\d{4})\b/i);
  if (aMatch) return aMatch[1].toUpperCase();

  // 2. If no A#### pattern, strip non-technical words, labels, and parentheses
  return trimmed
    .replace(/iPad(\s*Pro|\s*Air|\s*Mini)?/gi, '')
    .replace(/MacBook(\s*Pro|\s*Air)?/gi, '')
    .replace(/iPhone(\s*SE|\s*Pro|\s*Max)?/gi, '')
    .replace(/Mod(elo)?[:.]?/gi, '')
    .replace(/[()[\]]/g, '')
    .trim();
}

/**
 * Infer technical model code (strictly A#### format) from title or raw model.
 * Never returns descriptive words like "iPad" or "Pro" - strictly for customs compliance.
 */
export function inferTechnicalModel(title: string = '', rawModel?: string): string {
  if (rawModel) {
    const clean = sanitizeSunatModel(rawModel);
    if (clean) return clean;
  }
  const match = (title || '').match(/\b(A\d{4})\b/i);
  if (match) return match[1].toUpperCase();

  const titleLower = (title || '').toLowerCase();
  
  // iPads
  if (titleLower.includes('10.5') || titleLower.includes('a1701')) return 'A1701';
  if (titleLower.includes('12.9') && (titleLower.includes('3') || titleLower.includes('3rd') || titleLower.includes('3.ª'))) return 'A1876';
  if (titleLower.includes('12.9')) return 'A1670';
  if (titleLower.includes('11') && titleLower.includes('pro')) return 'A1980';
  if (titleLower.includes('ipad 9') || titleLower.includes('9th') || titleLower.includes('9na')) return 'A2602';
  if (titleLower.includes('ipad 8') || titleLower.includes('8th') || titleLower.includes('8va')) return 'A2270';
  if (titleLower.includes('ipad 7') || titleLower.includes('7th') || titleLower.includes('7ma')) return 'A2197';
  if (titleLower.includes('ipad 6') || titleLower.includes('6th') || titleLower.includes('6ta')) return 'A1893';
  if (titleLower.includes('ipad 5') || titleLower.includes('5th') || titleLower.includes('5ta')) return 'A1822';
  if (titleLower.includes('mini 4')) return 'A1538';
  if (titleLower.includes('mini 5')) return 'A2133';
  if (titleLower.includes('air 3') || titleLower.includes('air (3rd') || titleLower.includes('air 3rd')) return 'A2152';
  if (titleLower.includes('air 4') || titleLower.includes('air (4th')) return 'A2316';
  if (titleLower.includes('air 5') || titleLower.includes('air (5th')) return 'A2588';

  // MacBooks
  if (titleLower.includes('16') && (titleLower.includes('2019') || titleLower.includes('macbook'))) return 'A2141';
  if (titleLower.includes('13') && titleLower.includes('2019')) return 'A1989';
  if (titleLower.includes('13') && titleLower.includes('2020') && titleLower.includes('m1')) return 'A2338';
  if (titleLower.includes('13') && titleLower.includes('2020')) return 'A2289';
  if (titleLower.includes('macbook pro 13') || titleLower.includes('macbook 13')) return 'A1989';
  if (titleLower.includes('macbook air 13') && titleLower.includes('m1')) return 'A2337';
  if (titleLower.includes('macbook air 13') || titleLower.includes('air 13')) return 'A1466';
  if (titleLower.includes('15') && (titleLower.includes('2018') || titleLower.includes('2019'))) return 'A1990';

  // Accessories & iPhones
  if (titleLower.includes('96w')) return 'A2166';
  if (titleLower.includes('87w')) return 'A1719';
  if (titleLower.includes('61w')) return 'A1947';
  if (titleLower.includes('se 3rd') || titleLower.includes('se 2022') || titleLower.includes('iphone se')) return 'A2783';
  if (titleLower.includes('12 pro max')) return 'A2411';
  if (titleLower.includes('13 pro max')) return 'A2643';
  if (titleLower.includes('14 pro max')) return 'A2894';

  // Dell Laptops
  if (titleLower.includes('latitude 3330') || titleLower.includes('dell 3330')) return 'Latitude 3330';
  const dellMatch = titleLower.match(/latitude\s+([0-9]{4})/);
  if (dellMatch) return `Latitude ${dellMatch[1]}`;

  return '';
}

/**
 * Client-safe helper to auto-detect translation, brand, technical model, and condition
 */
export function autoClassifyProduct(product: {
  description: string;
  category?: string;
  model?: string;
  condition?: string;
  quantity?: number;
  supplier?: string;
  orderNumber?: string;
}): TraduccionRow {
  const desc = product.description.toLowerCase();

  // Detect Spanish technical merchandise description for SUNAT
  let productoNombre = 'Tableta Electrónica';
  let marca = 'Apple';

  if (desc.includes('ipad') || desc.includes('tablet') || desc.includes('tableta')) {
    productoNombre = 'Tableta Electrónica';
    marca = 'Apple';
  } else if (desc.includes('iphone') || desc.includes('celular') || desc.includes('smartphone') || desc.includes('galaxy') || desc.includes('pixel')) {
    productoNombre = 'Teléfono Celular Inteligente';
    marca = desc.includes('galaxy') || desc.includes('samsung') ? 'Samsung' : desc.includes('pixel') ? 'Google' : 'Apple';
  } else if (desc.includes('macbook') || desc.includes('laptop') || desc.includes('notebook') || desc.includes('thinkpad') || desc.includes('latitude') || desc.includes('dell')) {
    productoNombre = 'Computadora Portátil (Laptop)';
    marca = desc.includes('dell') ? 'Dell' : desc.includes('thinkpad') || desc.includes('lenovo') ? 'Lenovo' : desc.includes('macbook') ? 'Apple' : 'HP';
  } else if (desc.includes('watch') || desc.includes('reloj')) {
    productoNombre = 'Reloj Inteligente (Smartwatch)';
    marca = desc.includes('apple') ? 'Apple' : 'Samsung';
  } else if (desc.includes('airpods') || desc.includes('audifonos') || desc.includes('earbuds') || desc.includes('headphones')) {
    productoNombre = 'Auriculares Inalámbricos';
    marca = desc.includes('apple') ? 'Apple' : 'Sony';
  } else {
    productoNombre = 'Dispositivo Electrónico';
  }

  // Model extraction - STRICTLY explicit code or technical inference
  // Never includes "iPad" or descriptive words - strictly manufacturer model code A####
  let modelo = sanitizeSunatModel(product.model);
  if (!modelo) {
    modelo = inferTechnicalModel(product.description);
  }

  // Estado: Strictly 'Usado' by default
  const estado = 'Usado';
  const cantidad = product.quantity && product.quantity > 0 ? product.quantity : 1;

  return {
    productoNombre,
    marca,
    modelo,
    paisFabricacion: 'CHINA',
    cantidad,
    estado,
    numeroFactura: product.orderNumber || '',
    numeroOperacion: '',
  };
}
