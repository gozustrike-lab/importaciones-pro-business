import openpyxl
import json
import re
import collections

# Load chat orders
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
existing_fabio_orders = {}
for r in range(4, ws_f.max_row+1):
    o = ws_f.cell(r, 5).value
    d = ws_f.cell(r, 2).value
    prov = ws_f.cell(r, 9).value
    desc = ws_f.cell(r, 10).value
    u = ws_f.cell(r, 11).value
    p = ws_f.cell(r, 12).value
    if o:
        oid = str(o).strip()
        if oid in peggy_oids:
            continue
        existing_fabio_orders[oid] = {
            'order_num': oid,
            'date': d,
            'prov': prov,
            'desc': desc,
            'usd': u,
            'pen': p
        }

fabio_chat_active = {oid: o for oid, o in ebay_orders.items() if oid not in peggy_oids and not o['canceled']}

all_fabio_2026 = {}
for oid, o in existing_fabio_orders.items():
    # If in chat, prefer chat date format (e.g. 'Jan 15, 2026')
    d_clean = ebay_orders[oid]['date'] if oid in ebay_orders else str(o['date'])
    all_fabio_2026[oid] = {
        'order_num': oid,
        'date': d_clean,
        'prov': o['prov'],
        'desc': o['desc'],
        'usd': float(o['usd'] or 0),
    }

for oid, o in fabio_chat_active.items():
    if oid not in all_fabio_2026:
        all_fabio_2026[oid] = {
            'order_num': oid,
            'date': o['date'],
            'prov': o['seller'],
            'desc': o['title'],
            'usd': o['total_usd']
        }

# Group by month
by_month = collections.defaultdict(list)
month_order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
# also handle spanish names if in string: 'enero', 'febrero', etc.
es_to_en = {
    'enero': 'Jan', 'febrero': 'Feb', 'marzo': 'Mar', 'abril': 'Apr', 'mayo': 'May', 'junio': 'Jun',
    'julio': 'Jul', 'agosto': 'Aug', 'septiembre': 'Sep', 'setiembre': 'Sep', 'octubre': 'Oct', 'noviembre': 'Nov', 'diciembre': 'Dec'
}

for oid, o in all_fabio_2026.items():
    d = str(o['date']).lower()
    m_key = 'Unknown'
    for es, en in es_to_en.items():
        if es in d:
            m_key = en
            break
    if m_key == 'Unknown':
        for en in month_order:
            if en.lower() in d:
                m_key = en
                break
    by_month[m_key].append(o)

print("Fabio 2026 orders breakdown by month:")
print(f"{'MES':8} | {'ORDENES':7} | {'TOTAL USD':12} | {'TOTAL S/ (TC 3.42)':18}")
print("-" * 52)
grand_u = 0.0
grand_s = 0.0
for m in month_order:
    if m in by_month:
        items = by_month[m]
        u = sum(x['usd'] for x in items)
        s = u * 3.42
        grand_u += u
        grand_s += s
        print(f"{m:8} | {len(items):7} | ${u:10.2f} | S/ {s:14.2f}")

if 'Unknown' in by_month:
    print(f"Unknown date: {len(by_month['Unknown'])}")
    for x in by_month['Unknown']:
        print('  ', x)

print("-" * 52)
print(f"{'TOTAL':8} | {len(all_fabio_2026):7} | ${grand_u:10.2f} | S/ {grand_s:14.2f}")
