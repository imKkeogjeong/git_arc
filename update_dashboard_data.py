import pandas as pd
import json
import math

# Heuristic mapping function for 'subject' based on journal/publisher name
def get_subject(journal):
    if pd.isna(journal) or not str(journal).strip():
        return "미분류"
    
    j = str(journal).strip()
    
    if any(k in j for k in ['철학', '사상']):
        return "철학 계열"
    if any(k in j for k in ['문학', '어문', '역사', '인문']):
        return "인문학 계열"
    if any(k in j for k in ['사회', '정치', '경제', '교육', '법학']):
        return "학제간·사회과학"
    if any(k in j for k in ['미술', '예술', '디자인', '건축', '미디어', '영상', '음악']):
        return "예술·미디어"
    if any(k in j for k in ['신학', '종교']):
        return "신학·기타"
        
    return "기타"

def process_data():
    input_path = 'raw_data/메타데이터_통합_개체화.xlsx'
    output_path = 'KCI_Dashboard/data.js'
    
    print(f"Reading {input_path}...")
    df = pd.read_excel(input_path)
    
    results = []
    
    import random
    
    for idx, row in df.iterrows():
        # Handle Authors
        author_str = str(row['저자']) if not pd.isna(row['저자']) else ""
        authors = [{"name": a.strip()} for a in author_str.split(',') if a.strip()]
        
        # Handle Keywords
        kw_str = str(row['키워드']) if not pd.isna(row['키워드']) else ""
        keywords = [k.strip() for k in kw_str.split(',') if k.strip()]
        
        # Determine pub_year (safely parse)
        pub_year_val = row['발행년도']
        pub_year = None
        if not pd.isna(pub_year_val):
            try:
                pub_year = int(float(str(pub_year_val)[:4]))
            except ValueError:
                pub_year = None
                
        # Journal/Publisher
        journal = str(row['출판사/학술지명']) if not pd.isna(row['출판사/학술지명']) else ""
        
        # Determine Subject
        subject = get_subject(journal)
        
        # Title
        title = str(row['제목']) if not pd.isna(row['제목']) else ""
        
        # Abstract
        abstract = str(row['초록/책소개']) if not pd.isna(row['초록/책소개']) else ""
        
        # Simulated Citations (older papers generally have more, plus some random high hitters)
        simulated_citation = 0
        if pub_year:
            age = max(0, 2026 - pub_year)
            # Base citations + some exponential randomness for 'impact'
            base = age * 1.5
            if random.random() > 0.85: # 15% are high impact
                base += random.randint(10, 50)
            simulated_citation = int(base + random.randint(0, 5))
            
        entry = {
            "id": str(row['고유번호/ISBN']) if not pd.isna(row['고유번호/ISBN']) else f"TEMP_{idx}",
            "title": title,
            "authors": authors,
            "journal": journal,
            "pub_year": pub_year,
            "keywords_ko": keywords,
            "subject": subject,
            "abstract": abstract,
            "citations": simulated_citation
        }
        
        results.append(entry)
        
    print(f"Processed {len(results)} records. Saving to {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("window.KCI_DATA = ")
        json.dump(results, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print("Done!")

if __name__ == "__main__":
    process_data()
