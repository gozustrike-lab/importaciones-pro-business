import fs from 'fs';

const assetIds: Record<string, string> = {
  ipadmini5: 'image-b737d4f68597ff767ffc14b10292eb2498654522-800x800-png',
  ipad105: 'image-7011d8372143b4b46d82ffeec39fdadc570bac94-800x800-png',
  ipad129: 'image-9097efc98b761c70309a6ab9a4acbd698cb941e1-800x800-png',
  ipad9: 'image-63bf9ccb9e99c6e6083505db50021f951372e596-800x800-png',
  ipadair3: 'image-53bf215ec16b39bf7af3766dbb3b2cab62dfe919-800x800-png',
  mbp16: 'image-1189f3e9e0778c529d6fb8c59b5227fad2dc161d-800x800-png',
  dell: 'image-d88826aa275949b471b93fffddbe5ee4f956d06c-800x800-png',
  charger96: 'image-b73a6b11beaf76e29f2ed55bdcf934847911e337-800x800-png',
  mbp15: 'image-407623aa9ebc4d815fb5ca5a0f88ab09a6fd36a4-800x800-png',
  mbp13: 'image-940ca333729ad4dc48ad5006e109506e5614e187-800x800-png',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const res = await fetch('http://localhost:3000/api/products?archived=false');
  const prods = await res.json();
  console.log(`Fetched ${prods.length} active products from database`);

  const sanityDocs: any[] = [];

  prods.forEach((p: any, idx: number) => {
    const desc = (p.description || '').toLowerCase();
    const model = (p.model || '').toUpperCase();
    const orderNum = p.orderNumber;
    const docId = `prod-${orderNum.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    let title = '';
    let category = 'category-tablets';
    let collection = 'Apple';
    let assetKey = 'ipad105';
    let price = p.salePricePEN || p.suggestedPricePEN || 950;
    let comparePrice = price + 200;
    let descriptionText = '';
    let features: string[] = [];

    // Screen Assembly
    if (desc.includes('screen assembly') || desc.includes('assembly space')) {
      title = `Pantalla Completa Display Original Apple MacBook Pro 16" (A2141) • Ord: ${orderNum.slice(-5)}`;
      category = 'category-accesorios';
      collection = 'Apple';
      assetKey = 'mbp16';
      price = 650;
      comparePrice = 850;
      descriptionText = `Ensamble de pantalla completo original Apple Retina 16" IPS (3072 x 1920) 500 nits Space Gray para MacBook Pro A2141. Seminuevo original garantizado.`;
      features = [
        'Repuesto original Apple garantizado',
        'Pantalla Retina 16" IPS (3072 x 1920) 500 nits',
        'Color Space Gray con cámara FaceTime HD integrada',
        'Listo para ensamblaje e instalación',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // Cargador Apple 96W
    else if (desc.includes('charger') || desc.includes('cargador') || desc.includes('96w')) {
      price = 169;
      comparePrice = 220;
      title = `Cargador Original Apple 96W USB-C Power Adapter • Ord: ${orderNum.slice(-5)}`;
      category = 'category-accesorios';
      collection = 'Apple';
      assetKey = 'charger96';
      descriptionText = `Adaptador de corriente USB-C de 96W original Apple con clavija americana plana. Ofrece carga rápida y segura para MacBook Pro 16", 15" y 13".`;
      features = [
        'Original Apple 100% certificado y garantizado',
        'Potencia de salida 96W con protocolo USB-PD',
        'Carga rápida segura con protección contra sobretensión',
        'Compatible con MacBook Pro 16", 15", 14", 13", iPad Pro y iPad Air',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // MacBook Pro 16"
    else if (desc.includes('macbook pro 16') || desc.includes('16,1') || model.includes('A2141')) {
      const is32Gb = desc.includes('32gb') || desc.includes('1tb') || desc.includes('1 tera');
      price = is32Gb ? 2550 : 2300;
      comparePrice = is32Gb ? 3200 : 2700;
      title = `Apple MacBook Pro 16" Retina Touch Bar Core i7 (${is32Gb ? '32GB RAM / 1TB SSD' : '16GB RAM / 512GB SSD'}) • Ord: ${orderNum.slice(-5)}`;
      category = 'category-laptops';
      collection = 'Apple';
      assetKey = 'mbp16';
      descriptionText = `Apple MacBook Pro 16" Retina Touch Bar (2019) Intel Core i7 ${is32Gb ? '32GB RAM y 1TB SSD' : '16GB RAM y 512GB SSD'}. Doble gráfica con 4GB Video Dedicado AMD Radeon Pro + Intel UHD Graphics 630 integrado, macOS actualizado. 🎁 Incluye funda portalaptop nueva de regalo.`;
      features = [
        'Grado A — Seminuevo certificado en impecable estado estético y operativo',
        'Pantalla inmersiva Retina 16" (3072 x 1920) 500 nits True Tone',
        'Procesador Intel Core i7 6 núcleos hasta 4.5 GHz con Turbo Boost',
        is32Gb ? '32 GB de memoria RAM DDR4 2666 MHz' : '16 GB de memoria RAM DDR4 2666 MHz',
        is32Gb ? '1 TB (1000 GB) SSD NVMe ultrarrápido' : '512 GB SSD NVMe ultrarrápido',
        'Doble Gráfica: 4 GB Video Dedicado AMD Radeon Pro + Gráficos Integrados Intel UHD Graphics 630',
        'Sistema Operativo macOS actualizado',
        'Teclado Magic Keyboard con Touch Bar y Touch ID',
        'Sistema de audio de 6 bocinas con sonido espacial',
        '🎁 INCLUYE: Funda portalaptop nueva de regalo + Cargador Original',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // MacBook Pro 15.4"
    else if (desc.includes('15.4') || desc.includes('a1990') || model.includes('A1990')) {
      price = 2200;
      comparePrice = 2600;
      title = `Apple MacBook Pro 15.4" Retina Touch Bar (2019) Core i7 16GB / 512GB SSD • Ord: ${orderNum.slice(-5)}`;
      category = 'category-laptops';
      collection = 'Apple';
      assetKey = 'mbp15';
      descriptionText = `Apple MacBook Pro 15.4" Retina con Touch Bar y Touch ID. Procesador Intel Core i7 6-Core, 16GB RAM y 512GB SSD. Gráfica Dedicada AMD Radeon Pro + Intel UHD integrado, macOS actualizado. 🎁 Incluye funda portalaptop nueva de regalo.`;
      features = [
        'Grado A — Seminuevo certificado en excelente estado',
        'Pantalla Retina 15.4" IPS (2880 x 1800) True Tone P3',
        'Procesador Intel Core i7 6 núcleos hasta 4.5 GHz',
        '16GB de memoria RAM DDR4',
        '512GB SSD NVMe ultrarrápido',
        'Gráfica Dedicada AMD Radeon Pro + Intel UHD Graphics integrado',
        'Sistema Operativo macOS actualizado',
        'Teclado retroiluminado con Touch Bar y Touch ID',
        '🎁 INCLUYE: Funda portalaptop nueva de regalo + Cargador Original',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // MacBook Pro 13" i7 10ma Gen (A2251)
    else if (desc.includes('1068ng7') || model.includes('A2251')) {
      price = 1599;
      comparePrice = 1950;
      title = `Apple MacBook Pro 13.3" Retina Touch Bar (2020) Core i7 16GB / 512GB SSD • Ord: ${orderNum.slice(-5)}`;
      category = 'category-laptops';
      collection = 'Apple';
      assetKey = 'mbp13';
      descriptionText = `Apple MacBook Pro 13.3" Retina Touch Bar y Touch ID. Procesador Intel Core i7 10ma Generación Quad-Core, 16GB RAM LPDDR4X y 512GB SSD. 4 puertos Thunderbolt 3. macOS actualizado. 🎁 Incluye funda portalaptop nueva de regalo.`;
      features = [
        'Grado A — Seminuevo certificado en impecable estado',
        'Pantalla Retina 13.3" True Tone P3 (2560 x 1600)',
        'Procesador Intel Core i7 10ma Gen Quad-Core',
        '16GB de memoria RAM LPDDR4X 3733 MHz de alta velocidad',
        '512GB SSD NVMe de máxima velocidad',
        'Sistema Operativo macOS actualizado',
        'Teclado Magic Keyboard con Touch Bar y Touch ID',
        '4 puertos Thunderbolt 3 (USB-C) de alta velocidad',
        '🎁 INCLUYE: Funda portalaptop nueva de regalo + Cargador Original',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // MacBook Pro 13" i5
    else if (desc.includes('macbook pro 13') || desc.includes('a2159') || model.includes('A2159') || model.includes('A1989') || model.includes('A1706')) {
      const is16Gb = desc.includes('16gb');
      const is512Gb = desc.includes('512gb');
      price = is16Gb ? 1449 : 1299;
      comparePrice = price + 250;
      title = `Apple MacBook Pro 13.3" Retina Touch Bar Core i5 (${is16Gb ? '16GB' : '8GB'} RAM / ${is512Gb ? '512GB' : '256GB'} SSD) • Ord: ${orderNum.slice(-5)}`;
      category = 'category-laptops';
      collection = 'Apple';
      assetKey = 'mbp13';
      descriptionText = `Apple MacBook Pro 13.3" Retina Touch Bar y Touch ID. Procesador Intel Core i5 Quad-Core, ${is16Gb ? '16GB' : '8GB'} RAM y ${is512Gb ? '512GB' : '256GB'} SSD NVMe. macOS actualizado. 🎁 Incluye funda portalaptop nueva de regalo.`;
      features = [
        'Grado A — Seminuevo certificado en excelente estado',
        'Pantalla Retina 13.3" True Tone P3 (2560 x 1600)',
        'Procesador Intel Core i5 Quad-Core Turbo Boost',
        `${is16Gb ? '16GB' : '8GB'} de memoria RAM LPDDR3`,
        `${is512Gb ? '512GB' : '256GB'} SSD NVMe ultrarrápido`,
        'Sistema Operativo macOS actualizado',
        'Teclado retroiluminado con Touch Bar y Touch ID',
        '🎁 INCLUYE: Funda portalaptop nueva de regalo + Cargador Original',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // Dell Latitude 3330 i5
    else if (desc.includes('dell') || desc.includes('latitude') || model.includes('LATITUDE')) {
      price = 1250;
      comparePrice = 1500;
      title = `Laptop Dell Latitude 3330 13.3" FHD Intel Core i5 11va Gen • Ord: ${orderNum.slice(-5)}`;
      category = 'category-laptops';
      collection = 'Dell';
      assetKey = 'dell';
      descriptionText = `Laptop Dell Latitude 3330 de 13.3" Full HD Antirreflejo. Procesador Intel Core i5 de 11va Generación (hasta 4.5 GHz), 8GB RAM DDR4 y 256GB SSD M.2 NVMe. Gráficos Intel Iris Xe y Windows 11 Pro activado. 🎁 Incluye funda portalaptop nueva de regalo.`;
      features = [
        'Grado A — Seminuevo en impecable estado estético y operativo',
        'Pantalla 13.3" Full HD (1920 x 1080) Antirreflejo',
        'Procesador Intel Core i5-1155G7 11va Generación (hasta 4.5 GHz)',
        '8GB de memoria RAM DDR4',
        '256GB SSD M.2 NVMe de alta velocidad',
        'Gráficos Intel Iris Xe de alto rendimiento',
        'Windows 11 Pro 64-bit activado y optimizado',
        '🎁 INCLUYE: Funda portalaptop nueva de regalo + Cargador Original',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // iPad Mini 5
    else if (desc.includes('mini 5') || model.includes('A2133')) {
      price = 1200;
      comparePrice = 1380;
      title = `Apple iPad Mini 5 256GB Retina A12 Bionic (WiFi) + Mica • Ord: ${orderNum.slice(-5)}`;
      category = 'category-tablets';
      collection = 'Apple';
      assetKey = 'ipadmini5';
      descriptionText = `Apple iPad Mini 5 256GB WiFi con Chip A12 Bionic y pantalla Retina 7.9". Seminuevo Grado A con mica de pantalla incluida.`;
      features = [
        'Grado A — Seminuevo en excelente estado',
        'Pantalla Retina 7.9" True Tone y amplia gama P3',
        'Chip Apple A12 Bionic con Neural Engine',
        '256GB de almacenamiento interno',
        'Conectividad WiFi de alta velocidad',
        'Incluye mica de pantalla instalada / de regalo',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // iPad Pro 12.9" 2da Gen
    else if (desc.includes('12.9') || model.includes('A1670')) {
      price = 1199;
      comparePrice = 1380;
      title = `Apple iPad Pro 12.9" 2da Gen Retina 120Hz ProMotion 256GB • Ord: ${orderNum.slice(-5)}`;
      category = 'category-tablets';
      collection = 'Apple';
      assetKey = 'ipad129';
      descriptionText = `Apple iPad Pro 12.9" 2da Generación con pantalla Retina de 12.9 pulgadas, tasa de refresco 120Hz ProMotion, chip A10X Fusion y 256GB.`;
      features = [
        'Grado A — Seminuevo certificado en excelente estado',
        'Pantalla Retina gigante de 12.9" (2732 x 2048) ProMotion 120Hz',
        'Chip Apple A10X Fusion con coprocesador M10',
        '256GB de almacenamiento y 4GB de memoria RAM',
        'Compatible con Apple Pencil 1 y Smart Keyboard gigante',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // iPad Air 3
    else if (desc.includes('ipad air') || model.includes('A2152') || model.includes('A2153')) {
      const isCell = desc.includes('cel') || desc.includes('4g') || desc.includes('lte') || model.includes('A2153');
      const is64Gb = desc.includes('64gb');
      price = is64Gb ? 699 : 879;
      comparePrice = price + 150;
      title = `Apple iPad Air 3ra Gen 10.5" Retina (${is64Gb ? '64GB' : '256GB'}) ${isCell ? '(WiFi + 4G LTE)' : '(WiFi)'} • Ord: ${orderNum.slice(-5)}`;
      category = 'category-tablets';
      collection = 'Apple';
      assetKey = 'ipadair3';
      descriptionText = `Apple iPad Air 3ra Generación con pantalla laminada Retina 10.5" True Tone, chip A12 Bionic con Neural Engine y ${is64Gb ? '64GB' : '256GB'} de almacenamiento.`;
      features = [
        'Grado A — Seminuevo certificado en impecable estado',
        'Pantalla Retina laminada de 10.5" True Tone con amplia gama P3',
        'Chip Apple A12 Bionic de alta velocidad',
        `${is64Gb ? '64GB' : '256GB'} de capacidad de almacenamiento`,
        isCell ? 'Conectividad WiFi + 4G LTE libre de fábrica' : 'Conectividad WiFi de alta velocidad',
        'Compatible con Apple Pencil 1 y Smart Keyboard',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // iPad Pro 10.5"
    else if (desc.includes('ipad pro') || model.includes('A1701') || model.includes('A1709')) {
      const isCell = desc.includes('cel') || desc.includes('4g') || desc.includes('lte') || desc.includes('gsm') || model.includes('A1709');
      const is512 = desc.includes('512gb') || desc.includes('512 gb');
      const hasPencil = desc.includes('pencil');
      const isRoseGold = desc.includes('rose gold');
      const isSpaceGray = desc.includes('space gray');
      const isSilver = desc.includes('silver') || desc.includes('wh');
      const colorTag = isRoseGold ? ' (Rose Gold)' : isSpaceGray ? ' (Space Gray)' : isSilver ? ' (Silver)' : '';

      price = is512 ? 1050 : isCell ? 1050 : 950;
      comparePrice = price + 200;
      title = `Apple iPad Pro 10.5" Retina 120Hz ProMotion (${is512 ? '512GB' : '256GB'}) ${isCell ? 'WiFi + 4G Chip' : 'WiFi'}${colorTag} • Ord: ${orderNum.slice(-5)}`;
      category = 'category-tablets';
      collection = 'Apple';
      assetKey = 'ipad105';
      descriptionText = `Apple iPad Pro 10.5" con pantalla fluida ProMotion de 120Hz Retina True Tone. Procesador Apple A10X Fusion Quad-Core, ${is512 ? '512GB' : '256GB'} de almacenamiento.${hasPencil ? ' Incluye Apple Pencil de regalo.' : ''}`;
      features = [
        'Grado A — Seminuevo certificado en excelente estado',
        'Pantalla Retina fluida 120Hz ProMotion True Tone de 10.5 pulgadas',
        'Chip Apple A10X Fusion de alta potencia gráfica',
        `${is512 ? '512GB' : '256GB'} de almacenamiento interno ultrarrápido`,
        isCell ? 'Conectividad WiFi + 4G LTE libre para cualquier operador' : 'Conectividad WiFi de alta velocidad',
        '4 parlantes estéreo Hi-Fi y cámara de 12MP con flash True Tone',
        hasPencil ? '🎁 Incluye Apple Pencil original de regalo' : 'Compatible con Apple Pencil 1 y Smart Keyboard',
        '3 meses de garantía directa iTechPeru',
      ];
    }
    // iPad 9na Gen
    else if (desc.includes('ipad 9') || desc.includes('a2602') || desc.includes('a2603') || model.includes('A2602') || model.includes('A2603')) {
      const isCell = desc.includes('4g') || desc.includes('cel') || model.includes('A2603');
      price = 799;
      comparePrice = 950;
      title = `Apple iPad 9na Gen 10.2" Chip A13 Bionic 64GB ${isCell ? '(WiFi + 4G)' : '(WiFi)'} • Ord: ${orderNum.slice(-5)}`;
      category = 'category-tablets';
      collection = 'Apple';
      assetKey = 'ipad9';
      descriptionText = `Apple iPad 9na Generación con pantalla Retina de 10.2" True Tone, chip Apple A13 Bionic y cámara frontal Ultra Gran Angular de 12MP con Encuadre Centrado (Center Stage).`;
      features = [
        'Grado A — Seminuevo en excelente estado como nuevo',
        'Pantalla Retina de 10.2 pulgadas con tecnología True Tone',
        'Chip Apple A13 Bionic con arquitectura de 64 bits y Neural Engine',
        'Cámara frontal de 12MP Ultra Gran Angular con Encuadre Centrado',
        '64GB de capacidad de almacenamiento rápido',
        isCell ? 'Conectividad WiFi + Celular 4G LTE' : 'Conectividad WiFi de alta velocidad',
        'Batería con más de 90% de salud para todo el día',
        '3 meses de garantía directa iTechPeru',
      ];
    }

    const slugStr = slugify(`${title}-${orderNum.slice(-5)}`);

    sanityDocs.push({
      _id: docId,
      _type: 'product',
      name: title,
      slug: { _type: 'slug', current: slugStr },
      sku: orderNum,
      category: { _type: 'reference', _ref: category },
      collection,
      price,
      compareAtPrice: comparePrice,
      description: descriptionText,
      features,
      inStock: true,
      featured: idx < 12, // top 12 featured on homepage
      order: idx + 1,
      mainImage: {
        _type: 'image',
        asset: {
          _type: 'reference',
          _ref: assetIds[assetKey] || assetIds.ipad105,
        },
      },
    });
  });

  fs.writeFileSync('sanity_all_39_products.json', JSON.stringify(sanityDocs, null, 2), 'utf8');
  console.log(`Saved ${sanityDocs.length} product documents to sanity_all_39_products.json`);

  // Write chunks of 10
  for (let i = 0; i < sanityDocs.length; i += 10) {
    const chunkNum = Math.floor(i / 10) + 1;
    const chunk = sanityDocs.slice(i, i + 10);
    fs.writeFileSync(`sanity_sub${chunkNum}.json`, JSON.stringify(chunk, null, 2), 'utf8');
    console.log(`Saved chunk ${chunkNum} (${chunk.length} items) to sanity_sub${chunkNum}.json`);
  }
}

main().catch(console.error);
