import openpyxl

f = r"C:\Users\fabio\OneDrive\Desktop\COMPRAS EBAY\COMPRAS EBAY LILIANA\Compras Ebay LILIANA.xlsx"
wb = openpyxl.load_workbook(f, data_only=True)
print("Sheet names in OneDrive Liliana:", wb.sheetnames)

for s in wb.sheetnames:
    ws = wb[s]
    print(f"\n=== Sheet {s} (max_row={ws.max_row}) ===")
    total_usd = 0.0
    orders = []
    for r in range(4, ws.max_row+1):
        fecha = ws.cell(r, 2).value
        oid = ws.cell(r, 5).value
        usd = ws.cell(r, 11).value
        desc = ws.cell(r, 10).value
        if oid and usd:
            if isinstance(usd, (int, float)):
                total_usd += usd
            orders.append((str(fecha)[:25], str(oid), usd, str(desc)[:30]))
    print(f"Total orders: {len(orders)} | Total USD: ${total_usd:.2f}")
    for o in orders[:5]:
        print("  ", o)
