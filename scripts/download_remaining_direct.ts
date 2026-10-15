import fs from 'fs';
import path from 'path';

const targetDir = path.join(process.cwd(), 'public', 'catalog');

const DIRECT_TARGETS = [
  {
    key: 'ipad-9',
    urls: [
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-2021-hero-space-gray-wifi-select?wid=940&hei=1112&fmt=png-alpha',
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-2021-hero-silver-wifi-select?wid=940&hei=1112&fmt=png-alpha',
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111883_ipad-9th-gen.png'
    ]
  },
  {
    key: 'ipad-pro-129',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111878_ipad-pro-12.9-2nd.png',
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1000&q=80',
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-2021-hero-space-gray-wifi-select?wid=940&hei=1112&fmt=png-alpha'
    ]
  },
  {
    key: 'dell-latitude-3330',
    urls: [
      'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/latitude-notebooks/latitude-3330/media-gallery/laptop-latitude-3330-gallery-1.psd?fmt=png-alpha&pscan=optimized&hei=600',
      'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/latitude-notebooks/latitude-3330/media-gallery/laptop-latitude-3330-gallery-2.psd?fmt=png-alpha&pscan=optimized&hei=600',
      'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/latitude-notebooks/latitude-3330/media-gallery/laptop-latitude-3330-gallery-4.psd?fmt=png-alpha&pscan=optimized&hei=600'
    ]
  },
  {
    key: 'charger-96w',
    urls: [
      'https://cdsassets.apple.com/live/SZLF0YNV/images/sp/111904_sp809_apple-96w-usb-c-power-adapter.png',
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MX0J2?wid=1000&hei=1000&fmt=jpeg&qlt=95',
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1000&q=80'
    ]
  }
];

async function downloadOne(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 3000) return false;
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  for (const item of DIRECT_TARGETS) {
    console.log(`\nDescargando fotos para: ${item.key}`);
    for (let idx = 1; idx <= 3; idx++) {
      const url = item.urls[idx - 1];
      const fileName = `${item.key}-${idx}.png`;
      const destPath = path.join(targetDir, fileName);

      process.stdout.write(`  Descargando ${fileName} desde ${url.slice(0, 50)}... `);
      const ok = await downloadOne(url, destPath);
      if (ok) {
        console.log(`✅ OK (${Math.round(fs.statSync(destPath).size / 1024)} KB)`);
      } else {
        console.log(`❌ Falló`);
      }
    }

    // Copy -1 to default .png
    const defaultFile = path.join(targetDir, `${item.key}.png`);
    const firstFile = path.join(targetDir, `${item.key}-1.png`);
    if (fs.existsSync(firstFile)) {
      fs.copyFileSync(firstFile, defaultFile);
    }
  }
}

run();
