import os
import glob
import json
import re
import pandas as pd
import numpy as np

def clean_empty(val, type_="string"):
    if pd.isna(val) or val is None:
        return [] if type_ == "list" else (0 if type_ == "number" else None)
    if isinstance(val, str):
        val = val.strip()
        if val in ("", "null", "None"):
            return [] if type_ == "list" else (0 if type_ == "number" else None)
    return val

def parse_authors(author_string, role="first_author"):
    val = clean_empty(author_string, "string")
    if val is None: return []
    
    # 괄호 안의 쉼표 처리를 위한 로직
    parts = re.split(r'[,;]', val)
    merged_parts = []
    temp = ""
    for p in parts:
        if temp: temp += "," + p
        else: temp = p
        
        # 괄호의 짝이 맞으면(또는 괄호가 아예 없으면) 하나의 저자 블록으로 인식
        if temp.count('(') == temp.count(')'):
            merged_parts.append(temp.strip())
            temp = ""
    # 남은 부분 처리
    if temp: merged_parts.append(temp.strip())
        
    authors = []
    for p in merged_parts:
        if not p: continue
        # 이름과 괄호 안의 소속 추출
        match = re.match(r'(.+?)\s*\((.*?)\)', p)
        if match:
            authors.append({"name": match.group(1).strip(), "institution": match.group(2).strip(), "role": role})
        else:
            authors.append({"name": p.strip(), "institution": None, "role": role})
    return authors

def parse_keywords(kw_string):
    val = clean_empty(kw_string, "string")
    if val is None: return []
    parts = re.split(r'[,;]', val)
    cleaned = []
    for p in parts:
        # 불필요한 기호 제거 및 소문자 정규화
        p = p.strip().strip("'\"`.·")
        if p: cleaned.append(p.lower())
    return cleaned

def clean_title(title):
    val = clean_empty(title, "string")
    if val is None: return None
    # PUA (Private Use Area) 제거
    t = re.sub(r'[\uE000-\uF8FF]', '', val)
    # 부제 정규화 (다양한 부제 기호를 " : " 로 통일)
    t = re.sub(r'\s*[-\:]\s+', ' : ', t)
    t = re.sub(r'\s*<\s*(.*?)\s*>', r' : \1', t)
    t = re.sub(r'( \: )+', ' : ', t)
    return t.strip()

def get_top_institution(inst):
    if not inst: return None
    # 상위 기관 매핑을 위한 Fallback Dictionary
    fallback_map = {
        "카이스트": "KAIST", "KAIST": "KAIST", 
        "POSTECH": "포항공과대학교", "포스텍": "포항공과대학교",
        "KIST": "한국과학기술연구원"
    }
    for key, val in fallback_map.items():
        if key.upper() in inst.upper(): return val
            
    # 띄어쓰기 기준으로 최상위 기관 찾기
    parts = inst.split()
    for p in parts:
        if any(kw in p for kw in ["대학교", "대학", "연구원", "연구소", "학회", "교육청", "재단", "병원"]):
            return p.strip()
    return inst.strip()

def process_files(input_dir, output_file):
    all_files = glob.glob(os.path.join(input_dir, "*.*"))
    if not all_files:
        print(f"No files found in {input_dir}")
        return
        
    dfs = []
    for f in all_files:
        if not (f.endswith('.xls') or f.endswith('.xlsx') or f.endswith('.csv')):
            continue
        print(f"Reading {f}...")
        try:
            if f.endswith('.csv'):
                df = pd.read_csv(f, encoding='utf-8-sig')
            else:
                df = pd.read_excel(f, engine='xlrd' if f.endswith('.xls') else 'openpyxl')
        except Exception as e:
            print(f"Failed to read {f}: {e}")
            continue
            
        # 컬럼명 표준화 (앞뒤 공백 및 줄바꿈 제거)
        df.columns = [str(c).strip().replace('\n', '').replace('\t', '') for c in df.columns]
        dfs.append(df)
        
    if not dfs: return
    
    merged_df = pd.concat(dfs, ignore_index=True)
    
    print(f"Total rows before dedup: {len(merged_df)}")
    
    # 통합 ID 컬럼 생성
    id_cols = [c for c in merged_df.columns if 'ID' in str(c).upper() or '논문번호' in str(c) or '고유번호' in str(c)]
    if id_cols:
        merged_df['_unified_id'] = merged_df[id_cols].bfill(axis=1).iloc[:, 0]
        merged_df = merged_df.drop_duplicates(subset=['_unified_id'], keep='first')
    else:
        # 통합 제목 컬럼 생성
        title_cols = [c for c in merged_df.columns if '명' in str(c) or '제목' in str(c)]
        if title_cols:
            merged_df['_unified_title'] = merged_df[title_cols].bfill(axis=1).iloc[:, 0]
            merged_df = merged_df.drop_duplicates(subset=['_unified_title'], keep='first')
            
    print(f"Total rows after dedup: {len(merged_df)}")
    
    processed_data = []
    
    for idx, row in merged_df.iterrows():
        def get_val(col_names):
            for c in col_names:
                if c in row.index and not pd.isna(row[c]) and str(row[c]).strip() != "":
                    return row[c]
            return None
            
        article_id = get_val(['논문ID', 'ID', '논문고유번호'])
        title = get_val(['논문명', '제목', '논문제목', ''])
        title_en = get_val(['논문 외국어명', '외국어 논문명', '논문제목(영문)'])
        authors_raw = get_val(['저자', '저자명', ''])
        coauthors_raw = get_val(['공동저자'])
        journal = get_val(['학술지 명', '학술지명'])
        publisher = get_val(['발행기관 명', '발행기관명'])
        pub_year = get_val(['발행년', '출판년도', '발행년도'])
        vol_issue = get_val(['권(호)', '권호'])
        pages = get_val(['페이지'])
        kw_ko = get_val(['키워드(한국어)', 'Ű(ѱ)', '키워드'])
        kw_en = get_val(['키워드(외국어)', 'Ű(ܱ)'])
        subject = get_val(['주제분야', 'м ', '주제어'])
        citations = get_val(['피인용횟수', 'οȽ'])
        url = get_val(['URL'])
        doi = get_val(['DOI'])
        abstract_ko = get_val(['초록(원문)'])
        abstract_en = get_val(['초록(영문)'])
        
        # 1. 논문명 정제
        title_clean = clean_title(title)
        
        # 2. 저자 및 공동저자 정제
        author_list = parse_authors(authors_raw, "first_author")
        coauthor_list = parse_authors(coauthors_raw, "co_author")
        all_authors = author_list + coauthor_list
        
        # 소속기관 상위 매핑 적용
        for a in all_authors:
            a['top_institution'] = get_top_institution(a['institution'])
            
        # 3. 키워드 분리 및 노이즈 제거
        keywords_ko_clean = parse_keywords(kw_ko)
        keywords_en_clean = parse_keywords(kw_en)
        
        # 4. 숫자형 데이터 캐스팅
        try:
            pub_year = int(float(str(pub_year).strip())) if clean_empty(pub_year) else None
        except:
            pub_year = None
            
        try:
            citations = int(float(str(citations).strip())) if clean_empty(citations) else 0
        except:
            citations = 0

        # 빈 값 정책에 따른 데이터 조립
        processed_data.append({
            "id": clean_empty(article_id),
            "title": title_clean,
            "title_en": clean_title(title_en),
            "authors": all_authors, # 빈 배열 허용
            "journal": clean_empty(journal),
            "publisher": clean_empty(publisher),
            "pub_year": pub_year,
            "vol_issue": clean_empty(vol_issue),
            "pages": clean_empty(pages),
            "keywords_ko": keywords_ko_clean, # 빈 배열 허용
            "keywords_en": keywords_en_clean, # 빈 배열 허용
            "subject": clean_empty(subject),
            "citations": citations,
            "url": clean_empty(url),
            "doi": clean_empty(doi),
            "abstract_ko": clean_empty(abstract_ko),
            "abstract_en": clean_empty(abstract_en)
        })
        
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(processed_data, f, ensure_ascii=False, indent=2)
        
    print(f"Processed data saved to {output_file}")
    
    # Generate data.js for dashboard
    dashboard_data = []
    for d in processed_data:
        author_name = ""
        if d['authors'] and len(d['authors']) > 0:
            first_author = d['authors'][0]
            author_name = first_author['name']
            if first_author['institution']:
                author_name += f"({first_author['institution']})"
                
        dashboard_data.append({
            "title": d['title'] or "",
            "author": author_name,
            "journal": d['journal'] or "",
            "year": d['pub_year'],
            "keywords": d['keywords_ko'] or [],
            "theme": d['subject'] or "기타",
            "citations": d['citations'] or 0,
            "abstract": d['abstract_ko'] or "",
            "url": d['url'] or ""
        })
        
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write("window.KCI_DATA = ")
        json.dump(dashboard_data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print("Dashboard data saved to data.js")

if __name__ == "__main__":
    process_files("raw_data", "kci_metadata_processed.json")
