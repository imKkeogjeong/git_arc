import xlrd
import json

def debug_xls(file_path):
    workbook = xlrd.open_workbook(file_path, encoding_override='cp949')
    sheet = workbook.sheet_by_index(0)
    
    headers = sheet.row_values(0)
    print("Headers:", [str(h) for h in headers])
    
    first_row = sheet.row_values(1)
    print("First Row:", [str(r) for r in first_row])

if __name__ == "__main__":
    debug_xls('c:/vibe coding/git_arc/논문검색리스트Excel시몽동.xls')
