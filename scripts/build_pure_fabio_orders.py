import openpyxl
import json
import re
import collections

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

# Peggy orders (54 orders)
wb_peggy = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx', data_only=True)
ws_p = wb_peggy['TODO 2026']
peggy_oids = set()
for r in range(4, ws_p.max_row+1):
    o = ws_p.cell(r, 5).value
    if o: peggy_oids.add(str(o).strip())

# Existing Fabio orders in TODO 2026
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
        # If this order belongs to Peggy, SKIP IT!
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

print(f"Existing Fabio-only orders in Compras Ebay FABIO.xlsx (after removing Peggy's): {len(existing_fabio_orders)}")

# Check chat orders that are Fabio's
fabio_chat_active = {oid: o for oid, o in ebay_orders.items() if oid not in peggy_oids and not o['canceled']}
print(f"Active Fabio orders from 2026 eBay chat paste: {len(fabio_chat_active)}")

# Combine them: union of existing Fabio orders and chat Fabio orders
all_fabio_2026 = {}
# Start with existing
for oid, o in existing_fabio_orders.items():
    all_fabio_2026[oid] = {
        'order_num': oid,
        'date': o['date'],
        'prov': o['prov'],
        'desc': o['desc'],
        'usd': float(o['usd'] or 0),
    }

# Merge chat orders
for oid, o in fabio_chat_active.items():
    if oid in all_fabio_2026:
        # update date format or title if needed
        pass
    else:
        all_fabio_2026[oid] = {
            'order_num': oid,
            'date': o['date'],
            'prov': o['seller'],
            'desc': o['title'],
            'usd': o['total_usd']
        }

print(f"Total true Fabio 2026 orders: {len(all_fabio_2026)}")
tot_u = sum(x['usd'] for x in all_fabio_2026.values())
print(f"Total true Fabio 2026 USD: ${tot_u:.2f} (S/ {tot_u*3.42:.2f})")
