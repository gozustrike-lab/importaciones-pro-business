import fs from 'fs';
import path from 'path';

const targetDir = path.join(process.cwd(), 'public', 'catalog');

const REMAINING = [
  {
    fileName: 'ipad-9-1.png',
    url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1000&q=80'
  },
  {
    fileName: 'ipad-9-3.png',
    url: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=1000&q=80'
  },
  {
    fileName: 'ipad-pro-129-1.png',
    url: 'https://images.unsplash.com/photo-1585792180666-f7347c490ee2?w=1000&q=80'
  },
  {
    fileName: 'ipad-pro-129-3.png',
    url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1000&q=80'
  },
  {
    fileName: 'dell-latitude-3330-1.png',
    url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=1000&q=80'
  },
  {
    fileName: 'dell-latitude-3330-2.png',
    url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1000&q=80'
  },
  {
    fileName: 'dell-latitude-3330-3.png',
    url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=1000&q=80'
  },
  {
    fileName: 'charger-96w-1.png',
    url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1000&q=80'
  }
];

async function run() {
  for (const item of REMAINING) {
    const dest = path.join(targetDir, item.fileName);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
      console.log(`[EXISTE] ${item.fileName}`);
      continue;
    }
    console.log(`Descargando ${item.fileName}...`);
    const res = await fetch(item.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log(`✅ OK ${item.fileName} (${Math.round(buf.length / 1024)} KB)`);
    } else {
      console.log(`❌ Falló ${item.fileName}`);
    }
  }

  // Ensure default .png copies exist
  const models = ['macbook-pro-16', 'macbook-pro-15', 'macbook-pro-13', 'ipad-pro-105', 'ipad-air-3', 'ipad-9', 'ipad-pro-129', 'dell-latitude-3330', 'charger-96w'];
  for (const m of models) {
    const def = path.join(targetDir, `${m}.png`);
    const first = path.join(targetDir, `${m}-1.png`);
    if (fs.existsSync(first)) {
      fs.copyFileSync(first, def);
    }
  }
  console.log('Completado.');
}

run();
