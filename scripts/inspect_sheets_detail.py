import openpyxl

wb = openpyxl.load_workbook('COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx', data_only=True)

sheets = ['ENERO', 'FEBRERO', 'MAYO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

for sname in sheets:
    ws = wb[sname]
    print(f"\n================ SHEET: {sname} (max_row={ws.max_row}) ================")
    for r in range(1, ws.max_row + 1):
        row_vals = [ws.cell(r, c).value for c in range(1, 15)]
        # Check if non-empty
        if any(v is not None for v in row_vals):
            print(f"Row {r:2}: date={row_vals[1]} | order={row_vals[4]} | prov={row_vals[8]} | USD={row_vals[10]} | PEN={row_vals[11]} | desc={str(row_vals[9])[:25]}")
