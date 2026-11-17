import os
import re
import json
import openpyxl
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

# Peggy orders (54)
wb_peggy = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx', data_only=True)
ws_p_todo = wb_peggy['TODO 2026']
peggy_oids = set()
for r in range(4, ws_p_todo.max_row + 1):
    o = ws_p_todo.cell(r, 5).value
    if o: peggy_oids.add(str(o).strip())

fabio_chat_orders = [o for oid, o in ebay_orders.items() if oid not in peggy_oids and not o['canceled']]
print(f"Fabio orders in 2026 chat paste: {len(fabio_chat_orders)}")

# Check what is currently in Fabio Compras Ebay FABIO.xlsx
wb_fabio = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY FABIO/Compras Ebay FABIO.xlsx', data_only=True)
ws_f_todo = wb_fabio['TODO 2026']
fabio_excel_oids = set()
for r in range(4, ws_f_todo.max_row + 1):
    o = ws_f_todo.cell(r, 5).value
    d = ws_f_todo.cell(r, 2).value
    u = ws_f_todo.cell(r, 11).value
    if o:
        fabio_excel_oids.add(str(o).strip())

print(f"Fabio orders currently in Compras Ebay FABIO.xlsx (TODO 2026): {len(fabio_excel_oids)}")

# Compare
missing_in_excel = [o for o in fabio_chat_orders if o['order_num'] not in fabio_excel_oids]
in_excel_not_in_chat = [o for o in fabio_excel_oids if o not in ebay_orders]

print(f"Orders in chat but missing in Fabio Excel: {len(missing_in_excel)}")
print(f"Orders in Fabio Excel but not in 6-page chat paste: {len(in_excel_not_in_chat)}")
