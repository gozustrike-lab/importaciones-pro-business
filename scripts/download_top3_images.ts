import fs from 'fs';
import path from 'path';

interface SearchTarget {
  key: string;
  query: string;
}

const ALL_TARGETS: SearchTarget[] = [
  { key: 'macbook-pro-16', query: 'macbook pro 16 touch bar 2019' },
  { key: 'macbook-pro-15', query: 'macbook pro 15 touch bar 2019' },
  { key: 'macbook-pro-13', query: 'macbook pro 13 touch bar' },
  { key: 'ipad-pro-105', query: 'ipad pro 10.5' },
  { key: 'ipad-air-3', query: 'ipad air 3 10.5' },
  { key: 'ipad-9', query: 'ipad 9th gen 10.2' },
  { key: 'ipad-pro-129', query: 'ipad pro 12.9 2nd gen' },
  { key: 'dell-latitude-3330', query: 'dell latitude 3330 laptop' },
  { key: 'charger-96w', query: 'apple 96w usb-c power adapter' },
];

// Process only targets where image 3 does not exist yet
const TARGETS = ALL_TARGETS.filter(t => !fs.existsSync(path.join(process.cwd(), 'public', 'catalog', `${t.key}-3.png`)));

const targetDir = path.join(process.cwd(), 'public', 'catalog');

async function getVqd(query: string): Promise<string | null> {
  const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const tokenHtml = await tokenRes.text();
  const vqdMatch = tokenHtml.match(/vqd=["']?([^&"'\s]+)/);
  return vqdMatch ? vqdMatch[1] : null;
}

async function searchImages(query: string): Promise<string[]> {
  try {
    const vqd = await getVqd(query);
    if (!vqd) return [];

    await new Promise((r) => setTimeout(r, 1500));

    const apiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,type:photo,,&p=1`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://duckduckgo.com/'
      }
    });

    const text = await res.text();
    if (!text.startsWith('{')) {
      console.warn('API returned non-JSON response');
      return [];
    }

    const data = JSON.parse(text);
    const results = data.results || [];
    return results
      .filter((r: any) => r.image && (r.width >= 400 || r.height >= 400))
      .map((r: any) => r.image);
  } catch (err: any) {
    console.warn(`Error en searchImages para "${query}":`, err.message);
    return [];
  }
}

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) return false; // At least 5KB

    fs.writeFileSync(destPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function processTarget(target: SearchTarget) {
  console.log(`\n🔍 Buscando 3 imágenes para: "${target.query}" (${target.key})`);
  const urls = await searchImages(target.query);
  console.log(`  Encontradas ${urls.length} imágenes candidatas.`);

  let downloadedCount = 0;
  for (let idx = 1; idx <= 3; idx++) {
    const destFileName = `${target.key}-${idx}.png`;
    const destPath = path.join(targetDir, destFileName);

    // If target is macbook-pro-16 and idx is 1, keep the user provided one!
    if (target.key === 'macbook-pro-16' && idx === 1 && fs.existsSync(destPath)) {
      console.log(`  [OK] Imagen 1 conservada (foto seleccionada por usuario): ${destFileName}`);
      downloadedCount++;
      continue;
    }

    // Try downloading next working URL
    let success = false;
    for (let uIdx = 0; uIdx < urls.length; uIdx++) {
      const url = urls[uIdx];
      // Skip already tried or duplicate domains
      process.stdout.write(`  Probando imagen ${idx} desde ${url.slice(0, 50)}... `);
      const ok = await downloadImage(url, destPath);
      if (ok) {
        console.log(`✅ Guardada como ${destFileName} (${Math.round(fs.statSync(destPath).size / 1024)} KB)`);
        urls.splice(uIdx, 1); // Remove so subsequent images are distinct
        success = true;
        downloadedCount++;
        break;
      } else {
        console.log(`❌ Falló`);
      }
    }

    if (!success) {
      console.warn(`  ⚠️ No se pudo descargar la imagen ${idx} para ${target.key}`);
    }
  }

  // Also make target.key.png a copy of target.key-1.png for default view
  const defaultFile = path.join(targetDir, `${target.key}.png`);
  const firstFile = path.join(targetDir, `${target.key}-1.png`);
  if (fs.existsSync(firstFile)) {
    fs.copyFileSync(firstFile, defaultFile);
  }

  console.log(`  Total imágenes guardadas para ${target.key}: ${downloadedCount}/3`);
}

async function run() {
  for (const target of TARGETS) {
    await processTarget(target);
  }
  console.log('\n🎉 ¡Todas las imágenes de los modelos han sido descargadas!');
}

run().catch(console.error);
