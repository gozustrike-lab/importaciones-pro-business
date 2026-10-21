export interface CatalogItemInfo {
  commercialTitle: string;
  category: 'Laptops & MacBooks' | 'iPads & Tablets' | 'Accesorios';
  brand: string;
  referenceImage: string;
  images: string[];
  displaySpecs: string;
  cpuSpecs: string;
  ramSpecs: string;
  storageSpecs: string;
  conditionLabel: string;
  salePricePen: number;
  regularPricePen: number;
}

export function getProductCatalogInfo(product: {
  id: string;
  orderNumber: string;
  description: string;
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  salePricePen?: number | null;
  suggestedPricePen?: number | null;
  totalCostPen?: number | null;
  purchasePriceUsd?: number | null;
}): CatalogItemInfo {
  const desc = (product.description || '').toLowerCase();
  const model = (product.model || '').toUpperCase();
  const rawPrice = product.suggestedPricePen || product.salePricePen || Math.round((product.totalCostPen || 400) * 1.5);

  // 0. Screen Assembly A2141
  if (desc.includes('screen assembly') || desc.includes('assembly space')) {
    return {
      commercialTitle: 'Pantalla Completa Display Original Apple MacBook Pro 16" (A2141)',
      category: 'Accesorios',
      brand: 'Apple',
      referenceImage: '/catalog/macbook-pro-16-1.png',
      images: ['/catalog/macbook-pro-16-1.png'],
      displaySpecs: 'Retina 16" IPS (3072 x 1920) 500 nits Space Gray',
      cpuSpecs: 'Repuesto Original Apple A2141',
      ramSpecs: 'Ensamble de pantalla completo',
      storageSpecs: 'Listo para instalar',
      conditionLabel: 'Seminuevo Grado A Original',
      salePricePen: rawPrice || 650,
      regularPricePen: 850,
    };
  }

  // 1. MacBook Pro 16" Touch Bar (2019 - A2141)
  if (desc.includes('macbook pro 16') || desc.includes('16,1') || model.includes('A2141')) {
    const is32Gb = desc.includes('32gb') || desc.includes('32 gb') || desc.includes('1tb') || desc.includes('1 tera') || desc.includes('1000gb');
    return {
      commercialTitle: `Apple MacBook Pro 16" Retina Touch Bar (2019) Intel Core i7 (${is32Gb ? '32GB RAM / 1TB SSD' : '16GB RAM / 512GB SSD'})`,
      category: 'Laptops & MacBooks',
      brand: 'Apple',
      referenceImage: '/catalog/macbook-pro-16-1.png',
      images: [
        '/catalog/macbook-pro-16-1.png',
        '/catalog/macbook-pro-16-2.png',
        '/catalog/macbook-pro-16-3.png',
      ],
      displaySpecs: 'Retina 16" IPS (3072 x 1920) True Tone 500 nits | Gráfica Dedicada 4GB Radeon Pro + Intel UHD Integrada',
      cpuSpecs: 'Intel Core i7 (6 núcleos hasta 4.5 GHz) • macOS actualizado',
      ramSpecs: is32Gb ? '32 GB DDR4 2666 MHz' : '16 GB DDR4 2666 MHz',
      storageSpecs: is32Gb ? '1 TB (1000 GB) SSD NVMe' : '512 GB SSD NVMe Ultrarrápido',
      conditionLabel: 'Seminuevo Grado A • 🎁 REGALO: Funda portalaptop nueva acolchada',
      salePricePen: is32Gb ? (product.salePricePen || 2550) : (product.salePricePen || 2300),
      regularPricePen: is32Gb ? 3200 : 2700,
    };
  }

  // 2. MacBook Pro 15.4" Retina Touch Bar (2019 - A1990)
  if (desc.includes('15.4') || desc.includes('a1990') || model.includes('A1990')) {
    return {
      commercialTitle: 'Apple MacBook Pro 15.4" Retina Touch Bar (2019) Intel Core i7',
      category: 'Laptops & MacBooks',
      brand: 'Apple',
      referenceImage: '/catalog/macbook-pro-15-1.png',
      images: [
        '/catalog/macbook-pro-15-1.png',
        '/catalog/macbook-pro-15-2.png',
        '/catalog/macbook-pro-15-3.png',
      ],
      displaySpecs: 'Retina 15.4" IPS (2880 x 1800) True Tone P3 • Gráfica Dedicada 4GB Radeon Pro + Intel UHD',
      cpuSpecs: 'Intel Core i7-9750H (6 núcleos hasta 4.5 GHz) • macOS actualizado',
      ramSpecs: '16 GB DDR4',
      storageSpecs: '512 GB SSD NVMe Ultrarrápido',
      conditionLabel: 'Seminuevo Grado A (Touch Bar + Touch ID) • 🎁 REGALO: Funda portalaptop nueva acolchada',
      salePricePen: product.salePricePen || 2200,
      regularPricePen: 2600,
    };
  }

  // 3. MacBook Pro 13" i7 10ma Gen (2020 - A2251)
  if (desc.includes('1068ng7') || model.includes('A2251') || (desc.includes('macbook pro 13') && desc.includes('i7'))) {
    return {
      commercialTitle: 'Apple MacBook Pro 13.3" Retina Touch Bar (2020) Intel Core i7 16GB / 512GB SSD',
      category: 'Laptops & MacBooks',
      brand: 'Apple',
      referenceImage: '/catalog/macbook-pro-13-1.png',
      images: [
        '/catalog/macbook-pro-13-1.png',
        '/catalog/macbook-pro-13-2.png',
        '/catalog/macbook-pro-13-3.png',
      ],
      displaySpecs: 'Retina 13.3" True Tone P3 (2560 x 1600) 500 nits',
      cpuSpecs: 'Intel Core i7-1068NG7 10ma Gen Quad-Core (hasta 4.1 GHz) • macOS actualizado',
      ramSpecs: '16 GB LPDDR4X 3733 MHz de alta velocidad',
      storageSpecs: '512 GB SSD NVMe Ultrarrápido',
      conditionLabel: 'Seminuevo Grado A (4 puertos Thunderbolt 3) • 🎁 REGALO: Funda portalaptop nueva acolchada',
      salePricePen: product.salePricePen || 2500,
      regularPricePen: 2800,
    };
  }

  // 4. MacBook Pro 13" i5 (A2159 / A1989 / A1706)
  if (desc.includes('macbook pro 13') || desc.includes('a2159') || model.includes('A2159') || model.includes('A1989') || model.includes('A1706')) {
    const is16Gb = desc.includes('16gb');
    const is512Gb = desc.includes('512gb');
    return {
      commercialTitle: `Apple MacBook Pro 13.3" Retina Touch Bar Core i5 (${is16Gb ? '16GB RAM / 512GB SSD' : '8GB RAM / 256GB SSD'})`,
      category: 'Laptops & MacBooks',
      brand: 'Apple',
      referenceImage: '/catalog/macbook-pro-13-1.png',
      images: [
        '/catalog/macbook-pro-13-1.png',
        '/catalog/macbook-pro-13-2.png',
        '/catalog/macbook-pro-13-3.png',
      ],
      displaySpecs: 'Retina 13.3" True Tone P3 (2560 x 1600)',
      cpuSpecs: 'Intel Core i5 Quad-Core Turbo Boost • macOS actualizado',
      ramSpecs: is16Gb ? '16 GB LPDDR3' : '8 GB LPDDR3',
      storageSpecs: is512Gb ? '512 GB SSD NVMe' : '256 GB SSD NVMe',
      conditionLabel: 'Seminuevo Grado A (Touch Bar + Touch ID) • 🎁 REGALO: Funda portalaptop nueva acolchada',
      salePricePen: is16Gb ? (product.salePricePen || 1800) : (product.salePricePen || 1299),
      regularPricePen: is16Gb ? 2400 : 1549,
    };
  }

  // 5. Dell Latitude 3330 (Core i5 11va Gen)
  if (desc.includes('dell') || desc.includes('latitude') || model.includes('LATITUDE')) {
    return {
      commercialTitle: 'Laptop Dell Latitude 3330 13.3" FHD Intel Core i5 11va Gen',
      category: 'Laptops & MacBooks',
      brand: 'Dell',
      referenceImage: '/catalog/dell-latitude-3330-1.png',
      images: [
        '/catalog/dell-latitude-3330-1.png',
        '/catalog/dell-latitude-3330-2.png',
        '/catalog/dell-latitude-3330-3.png',
      ],
      displaySpecs: '13.3" Full HD Antirreflejo (1920 x 1080) • Gráficos Intel Iris Xe',
      cpuSpecs: 'Intel Core i5-1155G7 (4 núcleos / 8 hilos hasta 4.5 GHz) • Windows 11 Pro',
      ramSpecs: '8 GB DDR4',
      storageSpecs: '256 GB SSD M.2 NVMe Ultrarrápido',
      conditionLabel: 'Seminuevo Grado A (Trabajo & Universidad) • 🎁 REGALO: Funda portalaptop nueva acolchada',
      salePricePen: product.salePricePen || 1250,
      regularPricePen: 1500,
    };
  }

  // 6. iPad Pro 12.9" 2da Gen (A1670)
  if (desc.includes('12.9') || model.includes('A1670')) {
    return {
      commercialTitle: 'Apple iPad Pro 12.9" 2da Gen Retina 120Hz ProMotion 256GB (WiFi)',
      category: 'iPads & Tablets',
      brand: 'Apple',
      referenceImage: '/catalog/ipad-pro-129-1.png',
      images: [
        '/catalog/ipad-pro-129-1.png',
        '/catalog/ipad-pro-129-2.png',
        '/catalog/ipad-pro-129-3.png',
      ],
      displaySpecs: 'Retina 12.9" 120Hz ProMotion (2732 x 2048) True Tone',
      cpuSpecs: 'Chip Apple A10X Fusion 64-bit con coprocesador M10 integrado',
      ramSpecs: '4 GB RAM',
      storageSpecs: '256 GB Almacenamiento',
      conditionLabel: 'Seminuevo Grado A • 🎁 PACK REGALO: Lápiz Óptico + Soporte Vertical/Horizontal + Cable Nuevos',
      salePricePen: product.salePricePen || 1200,
      regularPricePen: 1400,
    };
  }

  // 7. iPad Air 3ra Gen 10.5" (A2152 / A2153)
  if (desc.includes('ipad air 3') || desc.includes('air 3rd') || model.includes('A2152') || model.includes('A2153')) {
    const is64Gb = desc.includes('64gb');
    return {
      commercialTitle: `Apple iPad Air 3ra Gen 10.5" Retina ${is64Gb ? '64GB' : '256GB'} (WiFi + 4G LTE Con Chip)`,
      category: 'iPads & Tablets',
      brand: 'Apple',
      referenceImage: '/catalog/ipad-air-3-1.png',
      images: [
        '/catalog/ipad-air-3-1.png',
        '/catalog/ipad-air-3-2.png',
        '/catalog/ipad-air-3-3.png',
      ],
      displaySpecs: 'Retina 10.5" True Tone Laminada con gama P3 (2224 x 1668)',
      cpuSpecs: 'Chip Apple A12 Bionic con Neural Engine',
      ramSpecs: '3 GB RAM',
      storageSpecs: is64Gb ? '64 GB Almacenamiento' : '256 GB Almacenamiento',
      conditionLabel: 'Seminuevo Grado A (Libre para cualquier operador con chip 4G LTE) • 🎁 PACK REGALO: Lápiz Óptico + Soporte Vertical/Horizontal + Cable Nuevos',
      salePricePen: is64Gb ? (product.salePricePen || 699) : 1100,
      regularPricePen: is64Gb ? 849 : 1300,
    };
  }

  // 8. iPad 9na Gen 10.2" (A2602 / A2603)
  if (desc.includes('ipad 9') || desc.includes('9th gen') || desc.includes('a2602') || desc.includes('a2603') || model.includes('A2602') || model.includes('A2603')) {
    const isCellular = desc.includes('cellular') || desc.includes('4g') || model.includes('A2603');
    return {
      commercialTitle: `Apple iPad 9na Gen 10.2" Chip A13 Bionic 64GB ${isCellular ? '(WiFi + 4G Datos Móviles)' : '(WiFi)'}`,
      category: 'iPads & Tablets',
      brand: 'Apple',
      referenceImage: '/catalog/ipad-9-1.png',
      images: [
        '/catalog/ipad-9-1.png',
        '/catalog/ipad-9-2.png',
        '/catalog/ipad-9-3.png',
      ],
      displaySpecs: 'Retina 10.2" True Tone (2160 x 1620) • Cámara 12MP Ultra Gran Angular Center Stage',
      cpuSpecs: 'Chip Apple A13 Bionic con arquitectura de 64 bits y Neural Engine',
      ramSpecs: '3 GB RAM',
      storageSpecs: '64 GB Almacenamiento',
      conditionLabel: 'Seminuevo Grado A • 🎁 PACK REGALO: Lápiz Óptico + Soporte Vertical/Horizontal + Cable Nuevos',
      salePricePen: product.salePricePen || 799,
      regularPricePen: 950,
    };
  }

  // 9. iPad Pro 10.5" (A1701 / A1709)
  if (desc.includes('ipad pro 10.5') || desc.includes('10.5') || model.includes('A1701') || model.includes('A1709')) {
    const is512Gb = desc.includes('512gb') || desc.includes('512 gb');
    const isCellular = desc.includes('cellular') || desc.includes('4g') || desc.includes('lte') || desc.includes('unlocked') || desc.includes('chip') || model.includes('A1709');
    
    // Pricing rule as specified by user:
    // 256GB WiFi: 950 (regular 1150)
    // 256GB Chip: 1050 (regular 1250)
    // 512GB WiFi: 1200 (regular 1500)
    // 512GB Chip: 1300 (regular 1550)
    let finalSalePrice = 950;
    let finalRegPrice = 1150;
    if (is512Gb) {
      finalSalePrice = isCellular ? 1300 : 1200;
      finalRegPrice = isCellular ? 1550 : 1500;
    } else {
      finalSalePrice = isCellular ? 1050 : 950;
      finalRegPrice = isCellular ? 1250 : 1150;
    }

    return {
      commercialTitle: `Apple iPad Pro 10.5" Retina 120Hz ProMotion ${is512Gb ? '512GB' : '256GB'} ${isCellular ? '(WiFi + Celular 4G Con Chip)' : '(WiFi)'}`,
      category: 'iPads & Tablets',
      brand: 'Apple',
      referenceImage: '/catalog/ipad-pro-105-1.png',
      images: [
        '/catalog/ipad-pro-105-1.png',
        '/catalog/ipad-pro-105-2.png',
        '/catalog/ipad-pro-105-3.png',
      ],
      displaySpecs: 'Retina 10.5" 120Hz ProMotion True Tone (2224 x 1668)',
      cpuSpecs: 'Chip Apple A10X Fusion Quad-Core de alto rendimiento',
      ramSpecs: '4 GB RAM',
      storageSpecs: is512Gb ? '512 GB Almacenamiento' : '256 GB Almacenamiento',
      conditionLabel: `Seminuevo Grado A ${isCellular ? '(Libre para chip 4G cualquier operador)' : '(Versión WiFi)'} • 🎁 PACK REGALO: Lápiz Óptico + Soporte Vertical/Horizontal + Cable Nuevos`,
      salePricePen: product.salePricePen || finalSalePrice,
      regularPricePen: finalRegPrice,
    };
  }

  // 10. iPad Mini 5 (A2133 / A2124)
  if (desc.includes('mini 5') || desc.includes('a2133') || desc.includes('a2124') || model.includes('A2133') || model.includes('A2124')) {
    return {
      commercialTitle: 'Apple iPad Mini 5 256GB Retina A12 Bionic (WiFi) + Mica de Pantalla',
      category: 'iPads & Tablets',
      brand: 'Apple',
      referenceImage: '/catalog/ipad-mini-5-1.png',
      images: [
        '/catalog/ipad-mini-5-1.png',
        '/catalog/ipad-mini-5-2.png',
        '/catalog/ipad-mini-5-3.png',
      ],
      displaySpecs: 'Retina 7.9" True Tone Amplia gama P3 (2048 x 1536)',
      cpuSpecs: 'Chip Apple A12 Bionic con Neural Engine',
      ramSpecs: '3 GB RAM',
      storageSpecs: '256 GB Almacenamiento',
      conditionLabel: 'Seminuevo Grado A • 🎁 PACK REGALO: Mica de Pantalla + Lápiz Óptico + Soporte + Cable Nuevos',
      salePricePen: product.salePricePen || 1200,
      regularPricePen: 1380,
    };
  }

  // 11. Cargador Rápido 96W USB-C (Nuevo compatible de alta calidad - NO Original Apple)
  if (desc.includes('charger') || desc.includes('cargador') || desc.includes('96w')) {
    return {
      commercialTitle: 'Cargador Rápido 96W USB-C Power Adapter (Nuevo)',
      category: 'Accesorios',
      brand: 'iTech Compatible',
      referenceImage: '/catalog/charger-96w-1.png',
      images: [
        '/catalog/charger-96w-1.png',
        '/catalog/charger-96w-2.png',
        '/catalog/charger-96w-3.png',
      ],
      displaySpecs: 'Potencia 96W Carga Rápida USB-C PD (Power Delivery)',
      cpuSpecs: 'Voltaje universal 100-240V • Clavija plana americana estándar',
      ramSpecs: 'Protección inteligente contra sobrecalentamiento y cortocircuitos',
      storageSpecs: 'Compatible con MacBook Pro 16", 15", 13", iPad Pro y Laptops Tipo C',
      conditionLabel: 'Producto 100% Nuevo en Caja (Compatible de alta calidad - No es original Apple)',
      salePricePen: product.salePricePen || 180,
      regularPricePen: 220,
    };
  }

  // Fallback
  return {
    commercialTitle: product.description.slice(0, 50),
    category: 'iPads & Tablets',
    brand: 'Apple',
    referenceImage: '/catalog/ipad-9-1.png',
    images: ['/catalog/ipad-9-1.png', '/catalog/ipad-9-2.png', '/catalog/ipad-9-3.png'],
    displaySpecs: 'Pantalla de alta resolución',
    cpuSpecs: 'Procesador multinúcleo',
    ramSpecs: 'Memoria optimizada',
    storageSpecs: product.capacity || 'Almacenamiento amplio',
    conditionLabel: 'Seminuevo Grado A • 🎁 PACK REGALO: Lápiz Óptico + Soporte + Cable Nuevos',
    salePricePen: product.salePricePen || rawPrice || 799,
    regularPricePen: (rawPrice || 799) + 120,
  };
}

export function generateWhatsAppMessage(item: CatalogItemInfo, siteUrl: string = 'https://wa.me'): string {
  const fullImg = `${item.referenceImage}`;
  return `🔥 *OFERTA ESPECIAL | TIKTOK LIVE* 🔥

📱 *${item.commercialTitle}*
🏷️ *Precio Live:* S/ ${item.salePricePen} PEN  _~~(Antes: S/ ${item.regularPricePen})~~_

📋 *Especificaciones Técnicas:*
• 🖥️ *Pantalla:* ${item.displaySpecs}
• ⚙️ *Procesador:* ${item.cpuSpecs}
• 🧠 *Memoria:* ${item.ramSpecs}
• 💾 *Disco / Capacidad:* ${item.storageSpecs}
• ✨ *Estado:* ${item.conditionLabel}
${item.category === 'Laptops & MacBooks' ? '• 🎁 *Regalo Incluido:* Funda portalaptop nueva acolchada de regalo\n' : ''}${item.category === 'iPads & Tablets' ? '• 🎁 *Pack Regalo:* Lápiz óptico + Soporte vertical/horizontal + Cable nuevos\n' : ''}• 🧾 *Comprobante:* Emitimos Boleta de Venta / Factura legal
• 🔍 *Inspección:* Probado en 30 puntos técnicos (WiFi, audio, cámaras, Touch ID, pantalla, botones y sensores). Todo operativo; cualquier detalle de segunda mano se deja como observación previa.

📸 *Fotos y Video:* Equipo físico exhibido en directo en TikTok Live (@itechperu)
🌐 *Web Oficial:* https://www.itechperu.shop

💬 _¿Deseas separar este equipo o coordinar el envío inmediato a tu domicilio o provincia?_`.trim();
}
