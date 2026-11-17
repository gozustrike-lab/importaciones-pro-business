import openpyxl
import json
import re

transcript_path = r'C:\Users\fabio\.gemini\antigravity\brain\bea8428c-0bb9-42f9-b137-87da2700fb33\.system_generated\logs\transcript_full.jsonl'
ebay_orders = {}
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        if obj.get('source') == 'USER_EXPLICIT' and 'content' in obj:
            txt = obj['content']
            if 'Order number:' in txt or 'DeliveredOrder' in txt:
                blocks = re.split(r'(?=[A-Za-z\s\(\):]*Order date:)', txt)
                for b in blocks:
                    if 'Order number:' in b:
                        m_date = re.search(r'Order date:\s*([A-Za-z]+ \d{1,2}, 2026)', b)
                        m_tot = re.search(r'Order total:\s*US \$([\d,.]+)', b)
                        m_num = re.search(r'Order number:\s*([\d-]+)', b)
                        m_title = re.search(r'\[([^\]]+)\]\(https://www.ebay\.com/itm/[^\)]+\)', b)
                        m_seller = re.search(r'Sold by:\s*\n?\[([^\]]+?)\]', b)
                        if m_date and m_tot and m_num:
                            oid = m_num.group(1).strip()
                            seller = m_seller.group(1).replace('user ID', '').strip() if m_seller else 'N/A'
                            is_canceled = 'canceled' in b.lower() or ('refunded' in b.lower() and float(m_tot.group(1).replace(',', '')) == 0.0)
                            ebay_orders[oid] = {
                                'order_num': oid,
                                'date': m_date.group(1).strip(),
                                'total_usd': float(m_tot.group(1).replace(',', '')),
                                'title': m_title.group(1).strip() if m_title else 'N/A',
                                'seller': seller,
                                'canceled': is_canceled
                            }

wb_peggy = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx', data_only=True)
ws_p = wb_peggy['TODO 2026']
peggy_oids = set()
for r in range(4, ws_p.max_row+1):
    o = ws_p.cell(r, 5).value
    if o: peggy_oids.add(str(o).strip())

wb_fabio = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY FABIO/Compras Ebay FABIO.xlsx', data_only=True)
ws_f = wb_fabio['TODO 2026']
fabio_rows = []
for r in range(4, ws_f.max_row+1):
    o = ws_f.cell(r, 5).value
    d = ws_f.cell(r, 2).value
    u = ws_f.cell(r, 11).value
    if o:
        fabio_rows.append({'row': r, 'order': str(o).strip(), 'date': d, 'usd': u})

print(f"Total rows in Fabio TODO 2026: {len(fabio_rows)}")
# Check how many are in peggy_oids!
overlap_with_peggy = [r for r in fabio_rows if r['order'] in peggy_oids]
print(f"Rows in Fabio TODO 2026 that actually belong to Peggy: {len(overlap_with_peggy)}")
for ov in overlap_with_peggy[:10]:
    print(f"  Row {ov['row']}: order {ov['order']} ({ov['date']}) ${ov['usd']}")
