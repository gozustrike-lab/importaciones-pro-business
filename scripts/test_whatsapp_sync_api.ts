import 'dotenv/config';

async function testArrivalNotice() {
  const sampleMessage = `🇵🇪 ShiPer — Tus embarques llegaron a Lima
Hola, HERRERA. Tienes 2 embarques en Lima:
EMBARQUE 26 10

1️⃣ GUÍA HAWBO0132870 · #CC261026892042
    HERRERA BONILLA FABIO CESAR · Recojo Surco · 2 bultos · 1.75 kg · $25.50

2️⃣ GUÍA HAWBO0132894 · #CC261026417468
    BONILLA ORDUÑA PEGGY LILIANA · Recojo Surco · 2 bultos · 1.5 kg · $23.00

💰 Total liquidación: $48.50
🔐 Casillero: SPR6559
🔗 Rastrea tus guías: https://whs.shiper.pe/tracking/guias/f6pz2dak
Utiliza tu código de GUÍA para recoger tu pedido.

Equipo ShiPer 💙`;

  console.log('Testing WhatsApp sync parser directly on logic...');
  // Import the logic directly to test without running HTTP server
  const text = sampleMessage.trim();
  const linkMatch = text.match(/https:\/\/whs\.shiper\.pe\/tracking\/guias\/([a-z0-9]+)/i);
  const headerEmbarque = text.match(/EMBARQUE\s+([0-9\s/]+)/i);

  const subBlocks = text.split(/(?=[1-9]️⃣)/);
  console.log('Found subBlocks:', subBlocks.length - 1);

  for (let i = 1; i < subBlocks.length; i++) {
    const block = subBlocks[i];
    const hawbMatch = block.match(/HAWBO\d+/i);
    const ccMatch = block.match(/#?(CC\d+)/i);
    const nameMatch = block.match(/(HERRERA BONILLA FABIO CESAR|BONILLA ORDUÑA PEGGY LILIANA)/i);
    const bultosMatch = block.match(/(\d+)\s+bultos?/i);
    const kgMatch = block.match(/([0-9.]+)\s*kg/i);
    const costMatch = block.match(/\$([0-9.]+)/i);

    console.log(`Shipment ${i}:`, {
      hawb: hawbMatch?.[0],
      cc: ccMatch?.[1],
      consignee: nameMatch?.[0],
      bultos: bultosMatch?.[1],
      kg: kgMatch?.[1],
      cost: costMatch?.[1],
      headerDate: headerEmbarque?.[1],
      link: linkMatch?.[0]
    });
  }
}

testArrivalNotice();
