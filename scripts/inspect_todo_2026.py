import openpyxl
import collections

wb = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx', data_only=True)
ws_todo = wb['TODO 2026']

by_month = collections.defaultdict(list)
for r in range(4, ws_todo.max_row + 1):
    d = ws_todo.cell(r, 2).value
    ord_num = ws_todo.cell(r, 5).value
    prov = ws_todo.cell(r, 9).value
    desc = ws_todo.cell(r, 10).value
    usd = ws_todo.cell(r, 11).value
    pen = ws_todo.cell(r, 12).value
    if ord_num:
        m_str = str(d)[:3]
        by_month[m_str].append({
            'row': r, 'date': d, 'order': ord_num, 'prov': prov, 'desc': desc, 'usd': usd, 'pen': pen
        })

print(f"{'MES':6} | {'CANT':5} | {'TOTAL USD':12} | {'TOTAL S/ (TC 3.42)':18}")
print("-" * 50)
total_all_usd = 0.0
total_all_pen = 0.0

for m in ['Jan', 'Feb', 'May', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']:
    items = by_month[m]
    tot_usd = sum(float(x['usd'] or 0) for x in items)
    tot_pen = tot_usd * 3.42
    total_all_usd += tot_usd
    total_all_pen += tot_pen
    print(f"{m:6} | {len(items):5} | ${tot_usd:10.2f} | S/ {tot_pen:14.2f}")

print("-" * 50)
print(f"{'TOTAL':6} | {sum(len(v) for v in by_month.values()):5} | ${total_all_usd:10.2f} | S/ {total_all_pen:14.2f}")
