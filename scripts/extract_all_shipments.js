const fs = require('fs');
const path = require('path');

const chatPath = 'C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\WHATSAPP CHAT\\SHIPERHISTORIAL 04 11\\chat.txt';
const raw = fs.readFileSync(chatPath, 'utf8');

// Parse messages
const rawLines = raw.split('\n');
const msgs = [];
let cur = null;

for (let i = 0; i < rawLines.length; i++) {
  const line = rawLines[i].replace(/\r$/, '');
  const m = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM|am|pm)?)\]\s+([^:]+):\s*(.*)$/i);
  if (m) {
    if (cur) msgs.push(cur);
    cur = {
      index: msgs.length,
      date: m[1],
      time: m[2],
      sender: m[3].trim(),
      text: m[4]
    };
  } else if (cur) {
    cur.text += '\n' + line;
  }
}
if (cur) msgs.push(cur);

console.log(`Parsed ${msgs.length} messages.`);

// Parse shipments from the chat
const shipments = [];

// Helper to look ahead for flight date confirmation
function findConfirmedFlightDate(msgIndex) {
  // Look forward up to 10 messages for a user question about flight date and Shiper reply
  for (let j = 1; j <= 12 && (msgIndex + j) < msgs.length; j++) {
    const next = msgs[msgIndex + j];
    const textLower = next.text.toLowerCase();
    if (
      (textLower.includes('fecha') && (textLower.includes('embarque') || textLower.includes('embarcacion') || textLower.includes('embarcación'))) ||
      textLower.includes('que guia') || textLower.includes('qué fecha') || textLower.includes('de que fecha')
    ) {
      // Find subsequent reply from Shiper
      for (let k = 1; k <= 4 && (msgIndex + j + k) < msgs.length; k++) {
        const reply = msgs[msgIndex + j + k];
        if (reply.sender.includes('Shiper')) {
          const dateMatch = reply.text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\w+\s+\d{1,2})/i);
          if (dateMatch) {
            return {
              confirmedDate: reply.text.trim(),
              userPrompt: next.text.trim(),
              shiperResponse: reply.text.trim(),
              at: `${reply.date} ${reply.time}`
            };
          }
        }
      }
    }
  }
  return null;
}

for (let i = 0; i < msgs.length; i++) {
  const m = msgs[i];
  const t = m.text;

  // New Shiper Notification Format:
  if (t.includes('ShiPer — Tu embarque llegó a Lima') || t.includes('ShiPer — Tus embarques llegaron a Lima')) {
    const dateConfirmed = findConfirmedFlightDate(i);
    
    // Extract Embarque label if in header (e.g. EMBARQUE 28 10 or EMBARQUE 26 10)
    const headerEmbarque = t.match(/EMBARQUE\s+([0-9\s/]+)/i);

    // Extract tracking link
    const linkMatch = t.match(/https:\/\/whs\.shiper\.pe\/tracking\/guias\/([a-z0-9]+)/i);
    const trackingUrl = linkMatch ? linkMatch[0] : null;

    // Split multiple shipments in this notice (e.g. 1️⃣, 2️⃣)
    const subBlocks = t.split(/(?=[1-9]️⃣)/);

    if (subBlocks.length > 1) {
      // Multiple embarques
      for (let sIdx = 1; sIdx < subBlocks.length; sIdx++) {
        const block = subBlocks[sIdx];
        const hawbMatch = block.match(/HAWBO\d+/i);
        const ccMatch = block.match(/#?(CC\d+)/i);
        const nameMatch = block.match(/(HERRERA BONILLA FABIO CESAR|BONILLA ORDUÑA PEGGY LILIANA|PEGGY LILIANA BONILLA|FABIO CESAR HERRERA)/i);
        const bultosMatch = block.match(/(\d+)\s+bultos?/i);
        const kgMatch = block.match(/([0-9.]+)\s*kg/i);
        const costMatch = block.match(/\$([0-9.]+)/i);

        shipments.push({
          msgIndex: i,
          noticeDate: m.date,
          noticeTime: m.time,
          rawText: block.trim(),
          headerEmbarque: headerEmbarque ? headerEmbarque[1].trim() : null,
          flightConfirmed: dateConfirmed ? dateConfirmed.confirmedDate : (headerEmbarque ? headerEmbarque[1].trim() : null),
          hawb: hawbMatch ? hawbMatch[0].toUpperCase() : null,
          ccCode: ccMatch ? ccMatch[1].toUpperCase() : null,
          consignee: nameMatch ? nameMatch[0].toUpperCase() : 'UNKNOWN',
          bultos: bultosMatch ? parseInt(bultosMatch[1], 10) : 1,
          weightKg: kgMatch ? parseFloat(kgMatch[1]) : null,
          costUsd: costMatch ? parseFloat(costMatch[1]) : null,
          pickupLocation: block.includes('Recojo Surco') ? 'Recojo Surco' : 'Almacén Lima',
          trackingUrl,
          notes: dateConfirmed ? `Usuario preguntó: "${dateConfirmed.userPrompt}" -> Shiper confirmó: "${dateConfirmed.shiperResponse}"` : ''
        });
      }
    } else {
      // Single embarque notice
      const hawbMatch = t.match(/GUÍA:\s*([A-Z0-9—-]+)/i);
      const ccMatch = t.match(/Embarque:\s*#?(CC\d+)/i);
      const nameMatch = t.match(/Consignatario:\s*([^\n]+)/i);
      const bultosMatch = t.match(/Bultos:\s*([^\n]+)/i);
      const kgMatch = t.match(/Peso:\s*([0-9.]+)\s*kg/i);
      const totalMatch = t.match(/Total:\s*\$([0-9.]+)/i);
      const modalMatch = t.match(/Modalidad:\s*([^\n]+)/i);

      let cleanHawb = hawbMatch ? hawbMatch[1].trim() : null;
      if (cleanHawb === '—' || cleanHawb === '-') cleanHawb = null;

      shipments.push({
        msgIndex: i,
        noticeDate: m.date,
        noticeTime: m.time,
        rawText: t.trim(),
        headerEmbarque: headerEmbarque ? headerEmbarque[1].trim() : null,
        flightConfirmed: dateConfirmed ? dateConfirmed.confirmedDate : (headerEmbarque ? headerEmbarque[1].trim() : null),
        hawb: cleanHawb,
        ccCode: ccMatch ? ccMatch[1].toUpperCase() : null,
        consignee: nameMatch ? nameMatch[1].trim().toUpperCase() : 'HERRERA BONILLA FABIO CESAR',
        bultos: bultosMatch && !bultosMatch[1].includes('—') ? parseInt(bultosMatch[1], 10) : 1,
        weightKg: kgMatch ? parseFloat(kgMatch[1]) : null,
        costUsd: totalMatch ? parseFloat(totalMatch[1]) : null,
        pickupLocation: modalMatch && !modalMatch[1].includes('—') ? modalMatch[1].trim() : 'Recojo Surco',
        trackingUrl,
        notes: dateConfirmed ? `Usuario preguntó: "${dateConfirmed.userPrompt}" -> Shiper confirmó: "${dateConfirmed.shiperResponse}"` : ''
      });
    }
  }

  // Older Shiper Notification format: e.g. "HAWBO0092553 FABIO CESAR HERRERA BONILLA 4 4.6 KILOS POR CANCELAR: $54"
  else if (t.includes('KILOS POR CANCELAR') && t.includes('HAWBO')) {
    const hawbMatch = t.match(/HAWBO\d+/i);
    const nameMatch = t.match(/(FABIO CESAR HERRERA BONILLA|PEGGY LILIANA BONILLA ORDUÑA|PEGGY LILIANA BONILLA)/i);
    const kgMatch = t.match(/([0-9.]+)\s*KILOS/i);
    const costMatch = t.match(/CANCELAR:\s*\$([0-9.]+)/i);

    shipments.push({
      msgIndex: i,
      noticeDate: m.date,
      noticeTime: m.time,
      rawText: t.trim(),
      headerEmbarque: null,
      flightConfirmed: null,
      hawb: hawbMatch ? hawbMatch[0].toUpperCase() : null,
      ccCode: null,
      consignee: nameMatch ? nameMatch[0].toUpperCase() : 'UNKNOWN',
      bultos: 1,
      weightKg: kgMatch ? parseFloat(kgMatch[1]) : null,
      costUsd: costMatch ? parseFloat(costMatch[1]) : null,
      pickupLocation: 'Recojo Surco',
      trackingUrl: null,
      notes: 'Formato clásico de notificación de liquidación Shiper'
    });
  }
}

console.log(`Total parsed shipments across chat history: ${shipments.length}`);

// Write structured shipment history to JSON
fs.writeFileSync(
  'C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\scratch\\structured_shipments.json',
  JSON.stringify(shipments, null, 2)
);

console.log('Saved to scratch/structured_shipments.json');
