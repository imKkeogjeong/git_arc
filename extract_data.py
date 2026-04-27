import pandas as pd
import json

def extract_xls(file_path):
    try:
        # XLS might be an HTML table or a real XLS
        try:
            df = pd.read_excel(file_path)
        except:
            df = pd.read_html(file_path)[0]
        
        # Display columns to see what we have
        print("Columns found:", df.columns.tolist())
        
        # Save a sample to JSON to inspect data
        sample = df.head(5).to_dict(orient='records')
        print("Sample data:", json.dumps(sample, ensure_ascii=False, indent=2))
        
        # Save full data to a temporary JSON for processing
        df.to_json('kci_metadata.json', orient='records', force_ascii=False)
        print("Full data saved to kci_metadata.json")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_xls('c:/vibe coding/git_arc/논문검색리스트Excel시몽동.xls')
