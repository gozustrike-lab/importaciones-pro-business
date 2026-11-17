import openpyxl

wb = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA 2025.xlsx', data_only=True)

sheets = wb.sheetnames
for sname in sheets:
    ws = wb[sname]
    print(f"\n================ 2025 SHEET: {sname} (max_row={ws.max_row}) ================")
    tot_usd = 0.0
    tot_pen = 0.0
    cnt = 0
    for r in range(1, ws.max_row + 1):
        row_vals = [ws.cell(r, c).value for c in range(1, 15)]
        if any(v is not None for v in row_vals):
            usd_v = row_vals[10]
            pen_v = row_vals[11]
            try:
                u = float(usd_v)
                p = float(pen_v)
                tot_usd += u
                tot_pen += p
                cnt += 1
            except:
                pass
            print(f"Row {r:2}: date={row_vals[1]} | order={row_vals[4]} | prov={row_vals[8]} | USD={usd_v} | PEN={pen_v} | desc={str(row_vals[9])[:25]}")
    print(f"  --> Valid items count: {cnt} | USD: ${tot_usd:.2f} | PEN: S/ {tot_pen:.2f}")
