import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import json
import re
import collections
import os
import shutil

# 1. Gather all 82 Fabio orders from scripts/group_fabio_by_month.py logic
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

wb_fabio_orig = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY FABIO/Compras Ebay FABIO.xlsx', data_only=True)
ws_f = wb_fabio_orig['TODO 2026']
existing_fabio_orders = {}
for r in range(4, ws_f.max_row+1):
    o = ws_f.cell(r, 5).value
    d = ws_f.cell(r, 2).value
    prov = ws_f.cell(r, 9).value
    desc = ws_f.cell(r, 10).value
    u = ws_f.cell(r, 11).value
    if o:
        oid = str(o).strip()
        if oid in peggy_oids:
            continue
        existing_fabio_orders[oid] = {
            'order_num': oid,
            'date': d,
            'prov': prov,
            'desc': desc,
            'usd': u
        }

fabio_chat_active = {oid: o for oid, o in ebay_orders.items() if oid not in peggy_oids and not o['canceled']}

all_fabio_2026 = {}
for oid, o in existing_fabio_orders.items():
    d_clean = ebay_orders[oid]['date'] if oid in ebay_orders else str(o['date'])
    all_fabio_2026[oid] = {
        'order_num': oid,
        'date': d_clean,
        'prov': o['prov'] or 'eBay Seller',
        'desc': o['desc'] or 'Electronic item',
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

# Month mapping
month_order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
es_to_en = {
    'enero': 'Jan', 'febrero': 'Feb', 'marzo': 'Mar', 'abril': 'Apr', 'mayo': 'May', 'junio': 'Jun',
    'julio': 'Jul', 'agosto': 'Aug', 'septiembre': 'Sep', 'setiembre': 'Sep', 'octubre': 'Oct', 'noviembre': 'Nov', 'diciembre': 'Dec'
}
en_to_sheet = {
    'Jan': 'ENERO', 'Feb': 'FEBRERO', 'Mar': 'MARZO', 'Apr': 'ABRIL', 'May': 'MAYO', 'Jun': 'JUNIO',
    'Jul': 'JULIO', 'Aug': 'AGOSTO', 'Sep': 'SEPTIEMBRE', 'Oct': 'OCTUBRE', 'Nov': 'NOVIEMBRE', 'Dec': 'DICIEMBRE'
}

def get_month_key(date_str):
    d = str(date_str).lower()
    for es, en in es_to_en.items():
        if es in d: return en
    for en in month_order:
        if en.lower() in d: return en
    return 'Jan'

# Date sort helper
from datetime import datetime
def parse_date_for_sort(d_str):
    # Try Jan 15, 2026
    m = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(2026)', str(d_str))
    if m:
        m_name = m.group(1)[:3].capitalize()
        day = int(m.group(2))
        m_idx = month_order.index(m_name) + 1 if m_name in month_order else 1
        return datetime(2026, m_idx, day)
    return datetime(2026, 1, 1)

sorted_fabio_orders = sorted(all_fabio_2026.values(), key=lambda x: parse_date_for_sort(x['date']))

print(f"Total Fabio 2026 sorted orders: {len(sorted_fabio_orders)}")

# Rebuild Excel file
def build_fabio_excel(filepath):
    print(f"Building clean Fabio Excel at: {filepath}")
    wb = openpyxl.Workbook()
    
    # Ensure sheets
    sheet_names = ['TODO 2026', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    wb.remove(wb.active) # remove default sheet
    for s in sheet_names:
        wb.create_sheet(s)

    headers = [
        None, 'FECHA COMPRA', 'SISTEMA', 'ENVIADO EMBARCACIÓN', 'NUMERO DE ORDEN',
        'COURIER', 'TRACKING ORIGINAL', 'TRACKING SHIPER (EMBARQUE)', 'PROVEEDOR',
        'DESCRIPCIÓN', 'PRECIO COMPRA $', 'PRECIO COMPRA S/', 'PRECIO DE VENTA', 'PUBLICIDAD'
    ]

    header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
    border_thin = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )

    # Populate TODO 2026
    ws_todo = wb['TODO 2026']
    # Row 3 headers
    for c_idx, h in enumerate(headers, start=1):
        cell = ws_todo.cell(3, c_idx)
        cell.value = h
        if h:
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center')

    for idx, o in enumerate(sorted_fabio_orders):
        r = 4 + idx
        ws_todo.cell(r, 2).value = o['date']
        ws_todo.cell(r, 5).value = o['order_num']
        ws_todo.cell(r, 9).value = o['prov']
        ws_todo.cell(r, 10).value = o['desc']
        
        c_u = ws_todo.cell(r, 11)
        c_u.data_type = 'n'
        c_u.value = round(o['usd'], 2)
        c_u.number_format = '$#,##0.00'
        
        c_p = ws_todo.cell(r, 12)
        c_p.data_type = 'n'
        c_p.value = round(o['usd'] * 3.42, 2)
        c_p.number_format = '"S/"#,##0.00'

        for c in range(2, 14):
            ws_todo.cell(r, c).border = border_thin
            ws_todo.cell(r, c).font = Font(name='Calibri', size=10)

    # Total row in TODO 2026
    tot_r = 4 + len(sorted_fabio_orders) + 1
    ws_todo.cell(tot_r, 10).value = "TOTAL"
    ws_todo.cell(tot_r, 10).font = Font(name='Calibri', size=11, bold=True)
    ws_todo.cell(tot_r, 10).alignment = Alignment(horizontal='right')
    
    c_u = ws_todo.cell(tot_r, 11)
    c_u.data_type = 'f'
    c_u.value = f"=SUM(K4:K{tot_r-2})"
    c_u.font = Font(name='Calibri', size=11, bold=True)
    c_u.number_format = '$#,##0.00'
    c_u.fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")

    c_p = ws_todo.cell(tot_r, 12)
    c_p.data_type = 'f'
    c_p.value = f"=SUM(L4:L{tot_r-2})"
    c_p.font = Font(name='Calibri', size=11, bold=True)
    c_p.number_format = '"S/"#,##0.00'
    c_p.fill = PatternFill(start_color="D9EAD3", end_color="D9EAD3", fill_type="solid")

    # Group orders for monthly sheets
    monthly_groups = collections.defaultdict(list)
    for o in sorted_fabio_orders:
        m_k = get_month_key(o['date'])
        s_name = en_to_sheet.get(m_k, 'ENERO')
        monthly_groups[s_name].append(o)

    # Populate each monthly sheet
    for s_name in sheet_names[1:]: # skip TODO 2026
        ws = wb[s_name]
        for c_idx, h in enumerate(headers, start=1):
            cell = ws.cell(3, c_idx)
            cell.value = h
            if h:
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(horizontal='center', vertical='center')

        items = monthly_groups[s_name]
        for idx, o in enumerate(items):
            r = 4 + idx
            ws.cell(r, 2).value = o['date']
            ws.cell(r, 5).value = o['order_num']
            ws.cell(r, 9).value = o['prov']
            ws.cell(r, 10).value = o['desc']
            
            c_u = ws.cell(r, 11)
            c_u.data_type = 'n'
            c_u.value = round(o['usd'], 2)
            c_u.number_format = '$#,##0.00'
            
            c_p = ws.cell(r, 12)
            c_p.data_type = 'n'
            c_p.value = round(o['usd'] * 3.42, 2)
            c_p.number_format = '"S/"#,##0.00'

            for c in range(2, 14):
                ws.cell(r, c).border = border_thin
                ws.cell(r, c).font = Font(name='Calibri', size=10)

        if items:
            tot_r = 4 + len(items) + 1
            ws.cell(tot_r, 10).value = "TOTAL"
            ws.cell(tot_r, 10).font = Font(name='Calibri', size=11, bold=True)
            ws.cell(tot_r, 10).alignment = Alignment(horizontal='right')
            
            c_u = ws.cell(tot_r, 11)
            c_u.data_type = 'f'
            c_u.value = f"=SUM(K4:K{tot_r-2})"
            c_u.font = Font(name='Calibri', size=11, bold=True)
            c_u.number_format = '$#,##0.00'
            c_u.fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")

            c_p = ws.cell(tot_r, 12)
            c_p.data_type = 'f'
            c_p.value = f"=SUM(L4:L{tot_r-2})"
            c_p.font = Font(name='Calibri', size=11, bold=True)
            c_p.number_format = '"S/"#,##0.00'
            c_p.fill = PatternFill(start_color="D9EAD3", end_color="D9EAD3", fill_type="solid")

    # Column widths
    for s in wb.sheetnames:
        ws = wb[s]
        ws.column_dimensions['B'].width = 15
        ws.column_dimensions['E'].width = 18
        ws.column_dimensions['I'].width = 20
        ws.column_dimensions['J'].width = 45
        ws.column_dimensions['K'].width = 15
        ws.column_dimensions['L'].width = 15

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    wb.save(filepath)
    print(f"Successfully saved clean Fabio Excel: {filepath}")

# Build both local and OneDrive
build_fabio_excel(r'c:\dev\CLIENTES\IMPORTACIONES USA - PERU\COMPRAS EBAY\COMPRAS EBAY FABIO\Compras Ebay FABIO.xlsx')
build_fabio_excel(r'C:\Users\fabio\OneDrive\Desktop\COMPRAS EBAY\COMPRAS EBAY FABIO\Compras Ebay FABIO.xlsx')
