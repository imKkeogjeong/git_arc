import pandas as pd
import json
import re
import math

def is_mostly_english(text):
    # If text is empty
    if not text.strip():
        return True
    
    # Remove spaces and special characters for counting
    text_clean = re.sub(r'[^a-zA-Z가-힣]', '', text)
    if not text_clean:
        return False
        
    eng_chars = len(re.findall(r'[a-zA-Z]', text_clean))
    # If more than 50% of the characters are English alphabets, filter it out
    return (eng_chars / len(text_clean)) > 0.5

def get_subject_from_journal(journal):
    if pd.isna(journal) or not str(journal).strip():
        return "미분류"
    
    j = str(journal).strip()
    
    if any(k in j for k in ['철학', '사상']):
        return "철학 계열"
    if any(k in j for k in ['문학', '어문', '역사', '인문']):
        return "인문학 계열"
    if any(k in j for k in ['사회', '정치', '경제', '교육', '법학', '문화', '여성', '학제', '신문', '방송']):
        return "학제간·사회과학"
    if any(k in j for k in ['미술', '예술', '디자인', '건축', '미디어', '영상', '영화', '음악', '체육', '사진']):
        return "예술·미디어"
    if any(k in j for k in ['신학', '종교', '기독교']):
        return "신학·기타"
        
    return "신학·기타" # default bin for unclassified

def process_data():
    input_path = 'raw_data/메타데이터_통합_개체화.xlsx'
    output_path = 'KCI_Dashboard/data.js'
    
    print(f"Reading {input_path}...")
    df = pd.read_excel(input_path)
    
    results = []
    
    for idx, row in df.iterrows():
        # Handle Authors
        author_str = str(row['저자']) if not pd.isna(row['저자']) else ""
        authors = [{"name": a.strip()} for a in author_str.split(',') if a.strip()]
        
        # Handle Keywords
        kw_str = str(row['키워드']) if not pd.isna(row['키워드']) else ""
        raw_keywords = [k.strip() for k in kw_str.split(',') if k.strip()]
        
        # Filter out English-dominant keywords
        keywords_ko = [k for k in raw_keywords if not is_mostly_english(k)]
        
        # Determine pub_year (safely parse)
        pub_year_val = row['발행년도']
        pub_year = None
        if not pd.isna(pub_year_val):
            try:
                # sometimes year can be float like 2023.0
                pub_year = int(float(str(pub_year_val)[:4]))
            except ValueError:
                pub_year = None
                
        # Journal/Publisher
        journal = str(row['출판사/학술지명']) if not pd.isna(row['출판사/학술지명']) else ""
        
        # Determine Subject
        subject = get_subject_from_journal(journal)
        
        # Title
        title = str(row['제목']) if not pd.isna(row['제목']) else ""
        
        entry = {
            "id": str(row['고유번호/ISBN']) if not pd.isna(row['고유번호/ISBN']) else f"TEMP_{idx}",
            "title": title,
            "authors": authors,
            "journal": journal,
            "pub_year": pub_year,
            "keywords_ko": keywords_ko,
            "subject": subject,
            "citations": 0 # Default to 0 since API didn't provide it
        }
        
        results.append(entry)
        
    print(f"Processed {len(results)} records. Saving to {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("window.KCI_DATA = ")
        json.dump(results, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print("Done! The dashboard data is now updated.")

if __name__ == "__main__":
    process_data()
