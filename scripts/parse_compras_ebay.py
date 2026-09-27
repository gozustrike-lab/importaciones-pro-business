import os
import json
import re
from datetime import datetime
import openpyxl
import pypdf

BASE_DIR = r"C:\dev\CLIENTES\IMPORTACIONES USA - PERU\COMPRAS EBAY"

SPANISH_MONTHS = {
    "enero": "01",
    "febrero": "02",
    "frebrero": "02",
    "marzo": "03",
    "abril": "04",
    "mayo": "05",
    "junio": "06",
    "julio": "07",
    "agosto": "08",
    "setiembre": "09",
    "septiembre": "09",
    "octubre": "10",
    "noviembre": "11",
    "diciembre": "12",
}

def parse_date_str(date_str, default_year=2025, default_month=11):
    if not date_str:
        return f"{default_year:04d}-{default_month:02d}-15T12:00:00.000Z"
    if isinstance(date_str, datetime):
        return date_str.isoformat() + "Z"
    
    s = str(date_str).strip().lower()
    # e.g. "5 de noviembre de 2025 a las 12:57 p. m."
    m = re.search(r'(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})', s)
    if m:
        day = int(m.group(1))
        m_name = m.group(2)
        year = int(m.group(3))
        month = int(SPANISH_MONTHS.get(m_name, default_month))
        return f"{year:04d}-{month:02d}-{day:02d}T12:00:00.000Z"

    # e.g. "2025-11-05"
    m2 = re.search(r'(\d{4})-(\d{2})-(\d{2})', s)
    if m2:
        return f"{m2.group(1)}-{m2.group(2)}-{m2.group(3)}T12:00:00.000Z"

    return f"{default_year:04d}-{default_month:02d}-15T12:00:00.000Z"

def scan_boletas(base_dir):
    boletas_by_month = {}  # "YYYY-MM-fabio" -> { totalSalesPen: 0, items: [] }
    for root, dirs, files in os.walk(base_dir):
        if "boleta" in root.lower():
            is_peggy = "liliana" in root.lower()
            importer_key = "peggy" if is_peggy else "fabio"

            for f in files:
                if f.lower().endswith(".pdf"):
                    path = os.path.join(root, f)
                    try:
                        reader = pypdf.PdfReader(path)
                        text = ""
                        for p in reader.pages:
                            text += p.extract_text() or ""

                        # Extract emission date
                        fecha_m = re.search(r'Fecha de Emisi[oó]n\s*:\s*([0-9/]+)', text, re.IGNORECASE)
                        fecha = fecha_m.group(1) if fecha_m else None

                        # Extract boleta number
                        num_m = re.search(r'EB01-\d+|B\d+-\d+', text)
                        num = num_m.group(0) if num_m else f

                        # Extract client
                        client_m = re.search(r'Se[ñn]or\(es\)\s*:\s*([^\n]+)', text)
                        client = client_m.group(1).strip() if client_m else "Cliente"

                        # Extract total amount
                        imp_m = re.search(r'Importe Total\s*:\s*S/?\s*([0-9,.]+)', text)
                        imp_str = imp_m.group(1).replace(",", "") if imp_m else "0"
                        amount = float(imp_str)

                        if fecha:
                            d, m, y = fecha.split("/")
                            month_key = f"{int(y):04d}-{int(m):02d}"
                        else:
                            # Try to infer from path
                            year_m = re.search(r'(2025|2026)', root)
                            year = year_m.group(1) if year_m else "2025"
                            month_name = None
                            for mn, code in SPANISH_MONTHS.items():
                                if mn in root.lower():
                                    month_name = code
                                    break
                            month_key = f"{year}-{month_name or '11'}"

                        full_key = f"{month_key}-{importer_key}"
                        if full_key not in boletas_by_month:
                            boletas_by_month[full_key] = {
                                "monthKey": month_key,
                                "importerKey": importer_key,
                                "totalSalesPen": 0.0,
                                "boletasCount": 0,
                                "items": [],
                            }

                        boletas_by_month[full_key]["totalSalesPen"] += amount
                        boletas_by_month[full_key]["boletasCount"] += 1
                        boletas_by_month[full_key]["items"].append({
                            "boletaNumber": num,
                            "date": fecha,
                            "client": client,
                            "amountPen": amount,
                            "file": f,
                        })
                    except Exception as e:
                        pass
    return boletas_by_month

def scan_excel_purchases(base_dir):
    purchases = []
    configs = [
        ("fabio", os.path.join(base_dir, "COMPRAS EBAY FABIO", "Compras Ebay FABIO.xlsx")),
        ("peggy", os.path.join(base_dir, "COMPRAS EBAY LILIANA", "Compras Ebay LILIANA.xlsx")),
    ]

    for importer, file_path in configs:
        if not os.path.exists(file_path):
            continue

        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            for sheet_name in wb.sheetnames:
                s_upper = sheet_name.upper().strip()
                if s_upper in ["TODO"]:
                    continue

                ws = wb[sheet_name]
                # Map sheet name to month number
                s_lower = sheet_name.lower().strip()
                month_code = None
                for k, v in SPANISH_MONTHS.items():
                    if k in s_lower:
                        month_code = v
                        break
                if not month_code:
                    continue

                # Determine year: sheets in Liliana and Fabio
                # In 2025: ABRIL, MAYO, JUNIO, JULIO, AGOSTO, SEPTIEMBRE, OCTUBRE, NOVIEMBRE, DICIEMBRE
                # In 2026: ENERO, FEBRERO, MARZO, ABRIL, etc.
                year = 2026 if month_code in ["01", "02", "03"] else 2025

                # Find header row (usually row 3)
                header_map = {}
                header_row = 3
                for hr in [3, 2, 1, 4]:
                    h_test = [ws.cell(hr, c).value for c in range(1, min(ws.max_column + 1, 15))]
                    if any(isinstance(x, str) and ("ORDEN" in x.upper() or "COMPRA" in x.upper() or "DESCRIP" in x.upper()) for x in h_test):
                        header_row = hr
                        break

                for c in range(1, ws.max_column + 1):
                    val = ws.cell(header_row, c).value
                    if val:
                        norm = str(val).upper().replace("Ó", "O").replace("Í", "I").strip()
                        header_map[norm] = c

                def get_col_val(r_idx, keywords, default_col=None):
                    for kw in keywords:
                        for h_name, c_idx in header_map.items():
                            if kw in h_name:
                                return ws.cell(r_idx, c_idx).value
                    return ws.cell(r_idx, default_col).value if default_col else None

                for r in range(header_row + 1, ws.max_row + 1):
                    f_compra = get_col_val(r, ["FECHA COMPRA", "FECHA"], 2)
                    orden = get_col_val(r, ["NUMERO DE ORDEN", "ORDEN"], 5)
                    courier = get_col_val(r, ["COURIER"], 6) or "FedEx"
                    tracking = get_col_val(r, ["TRACKING"], 7) or ""
                    proveedor = get_col_val(r, ["PROVEEDOR", "SELLER", "VENDEDOR"], 8) or "eBay"
                    desc = get_col_val(r, ["DESCRIPCION", "DESCRIP"], 9)
                    p_usd = get_col_val(r, ["PRECIO COMPRA $", "COMPRA $", "PRECIO $"], 10)
                    p_pen = get_col_val(r, ["PRECIO COMPRA S/", "COMPRA S/", "PRECIO SOLES", "PRECIO S/"], 11)

                    # Ignore sum rows or empty rows
                    if not desc and not p_usd:
                        continue
                    if isinstance(orden, str) and ("PRECIO" in orden.upper() or "TOTAL" in orden.upper()):
                        continue
                    if isinstance(desc, str) and ("TOTAL" in desc.upper() or "SUMA" in desc.upper()):
                        continue
                    if not isinstance(p_usd, (int, float)):
                        continue

                    usd_val = float(p_usd)
                    pen_val = float(p_pen) if isinstance(p_pen, (int, float)) else usd_val * 3.40

                    # Parse purchase date
                    iso_date = parse_date_str(f_compra, default_year=year, default_month=int(month_code))

                    purchases.append({
                        "importerProfile": importer,
                        "orderNumber": str(orden or f"ORD-{sheet_name}-{r}"),
                        "purchaseDate": iso_date,
                        "courier": str(courier),
                        "trackingId": str(tracking),
                        "supplier": str(proveedor),
                        "description": str(desc or "Dispositivo importado"),
                        "purchasePriceUsd": usd_val,
                        "totalCostPen": pen_val,
                        "monthKey": f"{year:04d}-{month_code}",
                    })
        except Exception as e:
            pass

    return purchases

if __name__ == "__main__":
    import sys
    out_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "parsed_data.json")
    boletas = scan_boletas(BASE_DIR)
    purchases = scan_excel_purchases(BASE_DIR)

    output = {
        "sales": list(boletas.values()),
        "purchases": purchases,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"SUCCESS: Saved {len(output['sales'])} sales months and {len(output['purchases'])} purchases to {out_path}")
