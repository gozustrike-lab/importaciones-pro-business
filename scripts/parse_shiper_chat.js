const fs = require('fs');
const path = require('path');

const chatPath = 'C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\WHATSAPP CHAT\\SHIPERHISTORIAL 04 11\\chat.txt';
const content = fs.readFileSync(chatPath, 'utf8');

const rawLines = content.split('\n');
const msgs = [];
let currentMsg = null;

for (let i = 0; i < rawLines.length; i++) {
  const line = rawLines[i].replace(/\r$/, '');
  const m = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM|am|pm)?)\]\s+([^:]+):\s*(.*)$/i);
  if (m) {
    if (currentMsg) msgs.push(currentMsg);
    currentMsg = {
      date: m[1],
      time: m[2],
      sender: m[3].trim(),
      text: m[4]
    };
  } else if (currentMsg) {
    currentMsg.text += '\n' + line;
  }
}
if (currentMsg) msgs.push(currentMsg);

console.log('Total messages parsed:', msgs.length);

// Let's identify the date range
if (msgs.length > 0) {
  console.log('First message:', msgs[0].date, msgs[0].time, msgs[0].sender);
  console.log('Last message:', msgs[msgs.length - 1].date, msgs[msgs.length - 1].time, msgs[msgs.length - 1].sender);
}

// 1. Analyze arrival notices / liquidaciones
const arrivals = [];
const hawbs = new Map();
const embarquesCC = new Map();

for (let i = 0; i < msgs.length; i++) {
  const msg = msgs[i];
  const t = msg.text;

  // Check if arrival message
  if (t.includes('llegó a Lima') || t.includes('llegaron a Lima') || t.includes('HAWBO') || t.includes('KILOS POR CANCELAR') || t.includes('whs.shiper.pe')) {
    arrivals.push({
      idx: i,
      msg
    });
  }

  // Extract HAWBO codes
  const hawbMatches = t.matchAll(/HAWBO\d{6,8}/gi);
  for (const m of hawbMatches) {
    const code = m[0].toUpperCase();
    if (!hawbs.has(code)) {
      hawbs.set(code, { code, firstSeen: msg.date, sampleText: t.slice(0, 150) });
    }
  }

  // Extract CC codes (CC followed by numbers)
  const ccMatches = t.matchAll(/#?(CC\d{10,14})/gi);
  for (const m of ccMatches) {
    const code = m[1].toUpperCase();
    if (!embarquesCC.has(code)) {
      embarquesCC.set(code, { code, firstSeen: msg.date, sampleText: t.slice(0, 150) });
    }
  }
}

console.log('Total Arrival notices:', arrivals.length);
console.log('Unique HAWB codes found:', hawbs.size);
console.log('Unique CC Embarque codes found:', embarquesCC.size);

// 2. Identify queries where User asks about dates & Shiper confirms
const dateQueries = [];
for (let i = 0; i < msgs.length; i++) {
  const m = msgs[i];
  if (m.sender.toLowerCase().includes('tú') || m.sender.toLowerCase().includes('tu') || m.sender === 'Herrera') {
    const textLower = m.text.toLowerCase();
    if (
      (textLower.includes('fecha') && (textLower.includes('embarque') || textLower.includes('embarcacion') || textLower.includes('embarcación') || textLower.includes('guia') || textLower.includes('guía'))) ||
      textLower.includes('que guia') || textLower.includes('qué guía') || textLower.includes('de que dia') || textLower.includes('de qué día')
    ) {
      // Look at following 1-3 messages for Shiper's response
      const followUps = [];
      for (let j = 1; j <= 4 && (i + j) < msgs.length; j++) {
        followUps.push(msgs[i + j]);
      }
      dateQueries.push({
        queryIdx: i,
        query: m,
        responses: followUps
      });
    }
  }
}

console.log('Date/Guide queries by user:', dateQueries.length);

// Write comprehensive parsed analysis to JSON
const outputData = {
  totalMessages: msgs.length,
  dateRange: { start: msgs[0]?.date, end: msgs[msgs.length - 1]?.date },
  hawbCount: hawbs.size,
  hawbList: Array.from(hawbs.values()),
  ccCount: embarquesCC.size,
  ccList: Array.from(embarquesCC.values()),
  arrivalsCount: arrivals.length,
  recentArrivals: arrivals.slice(-15).map(a => ({
    date: a.msg.date,
    time: a.msg.time,
    sender: a.msg.sender,
    text: a.msg.text
  })),
  recentDateQueries: dateQueries.slice(-15).map(q => ({
    date: q.query.date,
    time: q.query.time,
    userText: q.query.text,
    responses: q.responses.map(r => `[${r.sender} ${r.time}]: ${r.text}`)
  }))
};

fs.writeFileSync(
  'C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\scratch\\shiper_chat_analysis.json',
  JSON.stringify(outputData, null, 2)
);

console.log('Parsed analysis written to scratch/shiper_chat_analysis.json');
