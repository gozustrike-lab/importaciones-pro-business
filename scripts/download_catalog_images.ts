import fs from 'fs';
import path from 'path';

// Clean stock photos for the products in catalog
const IMAGES_TO_DOWNLOAD = [
  {
    name: 'macbook-pro-16.png',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111902_macbook-pro-16-2019.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/MacBook_Pro_16-inch_2019.png/640px-MacBook_Pro_16-inch_2019.png',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'
    ]
  },
  {
    name: 'macbook-pro-13.png',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111901_sp799-mbp13touch-2019.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/MacBook_Pro_13-inch_2020.png/640px-MacBook_Pro_13-inch_2020.png',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&q=80'
    ]
  },
  {
    name: 'macbook-pro-15.png',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111894_sp794-mbp15touch-2019.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/MacBook_Pro_13-inch_2020.png/640px-MacBook_Pro_13-inch_2020.png',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'
    ]
  },
  {
    name: 'ipad-pro-105.png',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111879_ipad-pro-10.5.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/IPad_Pro_10.5-inch.png/640px-IPad_Pro_10.5-inch.png',
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80'
    ]
  },
  {
    name: 'ipad-air-3.png',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111892_sp787-ipad-air-2019.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/IPad_Pro_10.5-inch.png/640px-IPad_Pro_10.5-inch.png',
      'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=800&q=80'
    ]
  },
  {
    name: 'ipad-9.png',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111883_ipad-9th-gen.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/IPad_9th_generation.svg/640px-IPad_9th_generation.svg.png',
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80'
    ]
  },
  {
    name: 'ipad-pro-129.png',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111878_ipad-pro-12.9-2nd.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/IPad_Pro_10.5-inch.png/640px-IPad_Pro_10.5-inch.png',
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80'
    ]
  },
  {
    name: 'dell-latitude-3330.png',
    urls: [
      'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/latitude-notebooks/latitude-3330/media-gallery/laptop-latitude-3330-gallery-1.psd?fmt=png-alpha&pscan=optimized&hei=600',
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80'
    ]
  },
  {
    name: 'charger-96w.png',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111904_sp809_apple-96w-usb-c-power-adapter.png',
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80'
    ]
  }
];

const targetDir = path.join(process.cwd(), 'public', 'catalog');

async function downloadOne(item: { name: string; urls: string[] }) {
  const filePath = path.join(targetDir, item.name);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    console.log(`[EXISTE] ${item.name}`);
    return;
  }

  for (const url of item.urls) {
    try {
      console.log(`Descargando ${item.name} desde ${url.slice(0, 60)}...`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 1000) {
          fs.writeFileSync(filePath, buffer);
          console.log(`✅ [OK] Guardado ${item.name} (${Math.round(buffer.length / 1024)} KB)`);
          return;
        }
      }
    } catch (e: any) {
      console.warn(`Error al intentar ${url}:`, e.message);
    }
  }
  console.error(`❌ Falló la descarga de ${item.name}`);
}

async function run() {
  for (const item of IMAGES_TO_DOWNLOAD) {
    await downloadOne(item);
  }
}

run();
