import os
import re
import json
import openpyxl
import pypdf
import collections

base_paths = [
    r'c:\dev\CLIENTES\IMPORTACIONES USA - PERU\COMPRAS EBAY\COMPRAS EBAY LILIANA\2025\BOLETAS DE VENTA',
    r'c:\dev\CLIENTES\IMPORTACIONES USA - PERU\COMPRAS EBAY\COMPRAS EBAY LILIANA\2026\BOLETAS DE VENTA 2026'
]

boletas = []
for bp in base_paths:
    for root, dirs, files in os.walk(bp):
        for f in files:
            if f.lower().endswith('.pdf'):
                fp = os.path.join(root, f)
                try:
                    reader = pypdf.PdfReader(fp)
                    text = ''
                    for page in reader.pages:
                        text += page.extract_text() or ''
                    
                    # Extract Boleta number
                    m_num = re.search(r'EB01-(\d+)', text)
                    num = f'EB01-{int(m_num.group(1))}' if m_num else 'UNKNOWN'
                    
                    # Extract Date
                    m_date = re.search(r'Fecha de Emisi[oó]n\s*:\s*(\d{2}/\d{2}/\d{4})', text)
                    date_str = m_date.group(1) if m_date else ''
                    if not date_str:
                        m_d2 = re.search(r'(\d{2}/\d{2}/\d{4})', text)
                        date_str = m_d2.group(1) if m_d2 else 'N/A'
                    
                    # Extract Total
                    m_tot = re.search(r'Importe Total\s*:\s*([\d,.]+)', text)
                    if not m_tot:
                        m_tot = re.search(r'Total[\s:]*(?:S/\.?|PEN)?\s*([\d,.]+)', text)
                    total_val = float(m_tot.group(1).replace(',', '')) if m_tot else 0.0
                    
                    # Extract Client
                    m_cli = re.search(r'Señor\(es\)\s*:\s*([^\n\r]+)', text)
                    client = m_cli.group(1).strip() if m_cli else 'N/A'
                    
                    boletas.append({
                        'num': num,
                        'num_int': int(m_num.group(1)) if m_num else 999,
                        'date': date_str,
                        'total': total_val,
                        'client': client,
                        'file': f,
                        'folder': os.path.basename(root)
                    })
                except Exception as e:
                    print(f"Error reading {f}: {e}")

boletas.sort(key=lambda x: x['num_int'])
print(f"Total boletas found: {len(boletas)}")
print(f"{'BOLETA':8} | {'FECHA':10} | {'TOTAL S/':10} | {'MES':10} | {'CLIENTE':28} | {'ARCHIVO'}")
print("-" * 90)

b_by_month = collections.defaultdict(float)
b_counts_by_month = collections.defaultdict(int)

for b in boletas:
    # Get month-year from date DD/MM/YYYY
    parts = b['date'].split('/')
    if len(parts) == 3:
        my = f"{parts[1]}/{parts[2]}"
    else:
        my = "UNKNOWN"
    b_by_month[my] += b['total']
    b_counts_by_month[my] += 1
    print(f"{b['num']:8} | {b['date']:10} | S/ {b['total']:7.2f} | {b['folder']:10} | {b['client'][:28]:28} | {b['file']}")

print("\n" + "=" * 50)
print("RESUMEN DE VENTAS POR MES (BOLETAS DE VENTA):")
print("=" * 50)
for my in sorted(b_by_month.keys()):
    cnt = b_counts_by_month[my]
    tot = b_by_month[my]
    print(f"  Mes {my}: {cnt} boletas | Total Ventas: S/ {tot:8.2f}")
