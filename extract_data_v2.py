import pandas as pd
import json
import sys

def extract_xls(file_path):
    try:
        # Try reading with different encodings if it's an HTML table
        try:
            # First try reading as real Excel
            df = pd.read_excel(file_path)
        except:
            # If it fails, it's likely an HTML table (common for KCI exports)
            # Try to read with CP949 encoding
            with open(file_path, 'r', encoding='cp949', errors='ignore') as f:
                html_content = f.read()
            df = pd.read_html(html_content)[0]
        
        # Clean column names (strip whitespace and garbled chars if any)
        df.columns = [str(c).strip() for c in df.columns]
        
        print("Actual Columns found:", df.columns.tolist())
        
        # Save full data to JSON with UTF-8
        df.to_json('kci_metadata_utf8.json', orient='records', force_ascii=False, indent=2)
        print("Full data saved to kci_metadata_utf8.json")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_xls('c:/vibe coding/git_arc/논문검색리스트Excel시몽동.xls')
