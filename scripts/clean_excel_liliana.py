import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import os

files_to_clean = [
    r'c:\dev\CLIENTES\IMPORTACIONES USA - PERU\COMPRAS EBAY\COMPRAS EBAY LILIANA\Compras Ebay LILIANA.xlsx',
    r'C:\Users\fabio\OneDrive\Desktop\COMPRAS EBAY\COMPRAS EBAY LILIANA\Compras Ebay LILIANA.xlsx'
]

def clean_excel(filepath):
    print(f"Cleaning: {filepath}")
    wb = openpyxl.load_workbook(filepath)
    
    monthly_sheets = ['ENERO', 'FEBRERO', 'MAYO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    
    ws_todo = wb['TODO 2026']
    month_map = {
        'Jan': 'ENERO',
        'Feb': 'FEBRERO',
        'May': 'MAYO',
        'Jul': 'JULIO',
        'Aug': 'AGOSTO',
        'Sep': 'SEPTIEMBRE',
        'Oct': 'OCTUBRE',
        'Nov': 'NOVIEMBRE'
    }
    
    items_by_target_sheet = {s: [] for s in monthly_sheets}
    
    # Clean TODO 2026
    for r in range(4, ws_todo.max_row + 1):
        ord_num = ws_todo.cell(r, 5).value
        d_val = ws_todo.cell(r, 2).value
        if ord_num and d_val:
            usd_val = ws_todo.cell(r, 11).value
            try:
                usd_f = round(float(usd_val), 2)
            except:
                usd_f = 0.0
            pen_f = round(usd_f * 3.42, 2)
            
            c_usd = ws_todo.cell(r, 11)
            c_usd.data_type = 'n'
            c_usd.value = usd_f
            c_usd.number_format = '$#,##0.00'
            
            c_pen = ws_todo.cell(r, 12)
            c_pen.data_type = 'n'
            c_pen.value = pen_f
            c_pen.number_format = '"S/"#,##0.00'
            
            row_data = [ws_todo.cell(r, c).value for c in range(1, 15)]
            m_prefix = str(d_val)[:3]
            target_sheet = month_map.get(m_prefix)
            if target_sheet:
                items_by_target_sheet[target_sheet].append(row_data)

    # Clean each monthly sheet
    for sname in monthly_sheets:
        ws = wb[sname]
        items = items_by_target_sheet[sname]
        
        # Clear everything from row 4 to max_row
        max_r = ws.max_row
        if max_r >= 4:
            ws.delete_rows(4, max_r - 3 + 5)
            
        # Write clean items
        for idx, item in enumerate(items):
            cur_r = 4 + idx
            for c_idx, val in enumerate(item, start=1):
                cell = ws.cell(cur_r, c_idx)
                if c_idx == 11: # USD
                    cell.data_type = 'n'
                    cell.value = round(float(val), 2) if val else 0.0
                    cell.number_format = '$#,##0.00'
                elif c_idx == 12: # PEN
                    usd_val = round(float(item[10]), 2) if item[10] else 0.0
                    cell.data_type = 'n'
                    cell.value = round(usd_val * 3.42, 2)
                    cell.number_format = '"S/"#,##0.00'
                else:
                    cell.value = val
                
                cell.font = Font(name='Calibri', size=10)
                cell.alignment = Alignment(vertical='center')

        # Add total row if there are items
        if items:
            tot_r = 4 + len(items) + 1
            ws.cell(tot_r, 10).value = "TOTAL"
            ws.cell(tot_r, 10).font = Font(name='Calibri', size=11, bold=True)
            ws.cell(tot_r, 10).alignment = Alignment(horizontal='right')
            
            # USD Total
            cell_u = ws.cell(tot_r, 11)
            cell_u.data_type = 'f'
            cell_u.value = f"=SUM(K4:K{tot_r-2})"
            cell_u.font = Font(name='Calibri', size=11, bold=True)
            cell_u.number_format = '$#,##0.00'
            cell_u.fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
            
            # PEN Total
            cell_p = ws.cell(tot_r, 12)
            cell_p.data_type = 'f'
            cell_p.value = f"=SUM(L4:L{tot_r-2})"
            cell_p.font = Font(name='Calibri', size=11, bold=True)
            cell_p.number_format = '"S/"#,##0.00'
            cell_p.fill = PatternFill(start_color="D9EAD3", end_color="D9EAD3", fill_type="solid")

    wb.save(filepath)
    print(f"Successfully cleaned and saved: {filepath}")

for fp in files_to_clean:
    if os.path.exists(fp):
        clean_excel(fp)
