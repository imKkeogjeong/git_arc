import pandas as pd
import json
import xlrd

def extract_xls(file_path):
    try:
        # Use xlrd for binary .xls files
        df = pd.read_excel(file_path, engine='xlrd')
        
        # Clean column names
        df.columns = [str(c).strip() for c in df.columns]
        
        print("Columns found:", df.columns.tolist())
        
        # Save sample to verify encoding
        sample = df.head(3).to_dict(orient='records')
        print("Sample data:", json.dumps(sample, ensure_ascii=False, indent=2))
        
        # Save full data
        df.to_json('kci_metadata_final.json', orient='records', force_ascii=False, indent=2)
        print("Full data saved to kci_metadata_final.json")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_xls('c:/vibe coding/git_arc/논문검색리스트Excel시몽동.xls')
