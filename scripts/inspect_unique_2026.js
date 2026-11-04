const list = require('C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\scratch\\structured_shipments.json');

const filtered = list.filter(s => s.ccCode || (s.hawb && s.noticeDate.includes('/26')));
console.log('2026 Shipments with CC or HAWB:', filtered.length);

const grouped = {};
filtered.forEach(s => {
  const key = s.ccCode || s.hawb;
  if (!grouped[key]) grouped[key] = s;
});

console.log('Unique shipment keys in 2026:', Object.keys(grouped).length);
console.log('Sample keys:');
Object.values(grouped).slice(-15).forEach(s => {
  console.log(
    s.noticeDate,
    '| Flight:', s.flightConfirmed || 'N/A',
    '| CC:', s.ccCode || '-',
    '| HAWB:', s.hawb || 'PENDIENTE',
    '| Consignee:', s.consignee.includes('PEGGY') ? 'PEGGY' : 'FABIO',
    '| Cost USD:', s.costUsd,
    '| Weight:', s.weightKg + 'kg'
  );
});
