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
    .replace(/iPhone/gi, '')
    .replace(/Mod(elo)?[:.]?/gi, '')
    .replace(/[()[\]]/g, '')
    .trim();
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
  } else if (desc.includes('macbook') || desc.includes('laptop') || desc.includes('notebook') || desc.includes('thinkpad')) {
    productoNombre = 'Computadora Portátil (Laptop)';
    marca = desc.includes('thinkpad') || desc.includes('lenovo') ? 'Lenovo' : desc.includes('macbook') ? 'Apple' : 'HP';
  } else if (desc.includes('watch') || desc.includes('reloj')) {
    productoNombre = 'Reloj Inteligente (Smartwatch)';
    marca = desc.includes('apple') ? 'Apple' : 'Samsung';
  } else if (desc.includes('airpods') || desc.includes('audifonos') || desc.includes('earbuds') || desc.includes('headphones')) {
    productoNombre = 'Auriculares Inalámbricos';
    marca = desc.includes('apple') ? 'Apple' : 'Sony';
  } else {
    productoNombre = 'Dispositivo Electrónico';
  }

  // Model extraction - STRICTLY explicit code in description or manual user input
  // Never guess or infer to avoid customs discrepancies with SUNAT
  let modelo = '';
  const aNumberMatch = product.description.match(/\b(A\d{4})\b/i);
  if (aNumberMatch) {
    // Explicit A#### code found in product description
    modelo = aNumberMatch[1].toUpperCase();
  } else if (product.model) {
    // Use user's manually entered model if available
    modelo = sanitizeSunatModel(product.model);
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
