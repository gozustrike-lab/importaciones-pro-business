import os
import re
import json
import openpyxl
import pypdf
import collections
from datetime import datetime

transcript_path = r'C:\Users\fabio\.gemini\antigravity\brain\bea8428c-0bb9-42f9-b137-87da2700fb33\.system_generated\logs\transcript_full.jsonl'

print("--- Step 1: Extract all eBay orders from chat history ---")
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

print(f"Total unique orders extracted from chat: {len(ebay_orders)}")

print("\n--- Step 2: Scan Peggy OneDrive PDFs & Excel files ---")
base_lil = r'C:\Users\fabio\OneDrive\Desktop\COMPRAS EBAY\COMPRAS EBAY LILIANA'
order_regex = re.compile(r'\b\d{2}-\d{5}-\d{5}\b')

peggy_pdf_map = {}
for root, dirs, files in os.walk(base_lil):
    for f in files:
        if f.endswith('.pdf') and 'BOLETA' not in root.upper() and 'HOMOLOGACION' not in f.upper():
            p = os.path.join(root, f)
            rel = os.path.relpath(p, base_lil)
            try:
                reader = pypdf.PdfReader(p)
                full_text = ''
                for page in reader.pages:
                    full_text += page.extract_text() or ''
                if 'Peggy Liliana Bonilla' in full_text:
                    oids = order_regex.findall(full_text)
                    for oid in oids:
                        peggy_pdf_map[oid] = {
                            'file': rel,
                            'folder': os.path.basename(root),
                            'path': p
                        }
            except Exception as e:
                pass

peggy_excel_oids = set()
for root, dirs, files in os.walk(base_lil):
    for f in files:
        if ('TRADUCCION' in f.upper()) and f.endswith('.xlsx') and not f.startswith('~$'):
            p = os.path.join(root, f)
            try:
                wb = openpyxl.load_workbook(p, data_only=True)
                ws = wb.active
                for r in range(1, ws.max_row+1):
                    for c in range(1, ws.max_column+1):
                        val = str(ws.cell(r, c).value or '')
                        for oid in order_regex.findall(val):
                            peggy_excel_oids.add(oid)
            except:
                pass

all_peggy_identified = set(peggy_pdf_map.keys()).union(peggy_excel_oids)
print(f"Total orders linked to Peggy in OneDrive: {len(all_peggy_identified)}")
print(f"  From Invoices (PDF): {len(peggy_pdf_map)}")
print(f"  From Translations (Excel): {len(peggy_excel_oids)}")

print("\n--- Step 3: Match chat orders with Peggy ---")
peggy_matched = []
fabio_matched = []
for oid, o in ebay_orders.items():
    if o['canceled']:
        continue
    if oid in all_peggy_identified:
        o['source_doc'] = peggy_pdf_map.get(oid, {}).get('file', 'Translation Excel')
        peggy_matched.append(o)
    else:
        fabio_matched.append(o)

print(f"Peggy orders in 2026 chat: {len(peggy_matched)}")
print(f"Fabio orders in 2026 chat: {len(fabio_matched)}")

tot_peggy_usd = sum(x['total_usd'] for x in peggy_matched)
print(f"Total Peggy 2026 USD: ${tot_peggy_usd:.2f} (S/ {tot_peggy_usd * 3.42:.2f})")

print("\n--- Step 4: Breakdown by Month (eBay Purchase Date) ---")
month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
by_month = collections.defaultdict(list)
for o in peggy_matched:
    m = o['date'].split()[0]
    by_month[m].append(o)

for m in month_names:
    if m in by_month:
        items = by_month[m]
        tot_u = sum(x['total_usd'] for x in items)
        tot_s = tot_u * 3.42
        print(f"  {m} 2026: {len(items)} orders | ${tot_u:8.2f} USD | S/ {tot_s:8.2f} PEN")

print("\n--- Step 5: Check 2025 Excel and Orders ---")
wb_2025 = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA 2025.xlsx', data_only=True)
for sname in wb_2025.sheetnames:
    ws = wb_2025[sname]
    tot_s = 0.0
    cnt = 0
    for r in range(4, ws.max_row + 1):
        p_val = ws.cell(r, 12).value
        o_val = ws.cell(r, 5).value
        if o_val or p_val:
            try:
                tot_s += float(p_val)
                cnt += 1
            except:
                pass
    print(f"  2025 Sheet [{sname}]: {cnt} items | Total PEN = S/ {tot_s:.2f}")

print("\n--- Step 6: Check Boletas de Venta Emitidas ---")
base_bol = r'C:\Users\fabio\OneDrive\Desktop\COMPRAS EBAY\COMPRAS EBAY LILIANA\BOLETAS DE VENTA'
base_bol_2026 = r'C:\Users\fabio\OneDrive\Desktop\COMPRAS EBAY\COMPRAS EBAY LILIANA\BOLETAS DE VENTA 2026'

boletas = []
for pth in [base_bol, base_bol_2026]:
    if os.path.exists(pth):
        for root, dirs, files in os.walk(pth):
            for f in files:
                if f.lower().endswith('.pdf'):
                    fp = os.path.join(root, f)
                    try:
                        reader = pypdf.PdfReader(fp)
                        text = reader.pages[0].extract_text()
                        # Extract Boleta number: EB01-X
                        m_num = re.search(r'EB01-(\d+)', text)
                        # Extract Date: DD/MM/YYYY
                        m_date = re.search(r'(\d{2}/\d{2}/\d{4})', text)
                        # Extract Total Importe: Total: S/ X or Importe Total S/ X
                        m_tot = re.search(r'(?:TOTAL|Importe Total)[\s:]*(?:S/\.?|PEN)?\s*([\d,.]+)', text, re.IGNORECASE)
                        num = f"EB01-{m_num.group(1)}" if m_num else f
                        b_date = m_date.group(1) if m_date else "N/A"
                        b_tot = float(m_tot.group(1).replace(',', '')) if m_tot else 0.0
                        boletas.append({'num': num, 'date': b_date, 'total': b_tot, 'file': f})
                    except Exception as e:
                        pass

boletas_sorted = sorted(boletas, key=lambda x: int(re.search(r'\d+', x['num']).group(0)) if re.search(r'\d+', x['num']) else 999)
print(f"Found {len(boletas_sorted)} Boletas de Venta:")
b_by_month = collections.defaultdict(float)
for b in boletas_sorted:
    m_yr = b['date'][3:] if len(b['date']) == 10 else "Unknown"
    b_by_month[m_yr] += b['total']
    print(f"  {b['num']}: {b['date']} | S/ {b['total']:.2f} ({b['file']})")

print("\nVentas Mensuales Totales por Boleta:")
for my, tot in sorted(b_by_month.items()):
    print(f"  {my}: S/ {tot:.2f}")
