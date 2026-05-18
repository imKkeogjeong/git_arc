import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import ssl
import time
import pandas as pd
import os

API_KEY = "10132607"
KEYWORD = "개체화"
DISPLAY_COUNT = 100

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_xml(url):
    req = urllib.request.Request(url)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                return response.read().decode('utf-8')
        except Exception as e:
            print(f"Error fetching URL (attempt {attempt+1}/{max_retries}): {e}")
            time.sleep(2)
    return None

def get_article_ids():
    print(f"'{KEYWORD}' 키워드로 논문 검색을 시작합니다...")
    article_ids = []
    page = 1
    total_pages = 1
    
    while page <= total_pages:
        url = f"https://open.kci.go.kr/po/openapi/openApiSearch.kci?apiCode=articleSearch&key={API_KEY}&keyword={urllib.parse.quote_plus(KEYWORD)}&displayCount={DISPLAY_COUNT}&page={page}"
        xml_data = fetch_xml(url)
        if not xml_data:
            break
            
        root = ET.fromstring(xml_data)
        
        if page == 1:
            total_str = root.find('.//total')
            if total_str is not None:
                total_records = int(total_str.text)
                total_pages = (total_records // DISPLAY_COUNT) + (1 if total_records % DISPLAY_COUNT > 0 else 0)
                print(f"총 {total_records}건의 논문이 검색되었습니다. (총 {total_pages} 페이지)")
        
        print(f"페이지 {page}/{total_pages} 가져오는 중...")
        for article in root.findall('.//articleInfo'):
            arti_id = article.get('article-id')
            if arti_id:
                article_ids.append(arti_id)
                
        page += 1
        time.sleep(0.5) # API 부하 방지
        
    return article_ids

def get_article_details(article_ids):
    print(f"\n총 {len(article_ids)}건의 논문 상세 정보를 가져옵니다 (키워드, 초록 등 포함). 시간이 다소 소요될 수 있습니다...")
    data = []
    
    for i, arti_id in enumerate(article_ids):
        if (i + 1) % 10 == 0:
            print(f"진행 상황: {i + 1}/{len(article_ids)}...")
            
        url = f"https://open.kci.go.kr/po/openapi/openApiSearch.kci?apiCode=articleDetail&key={API_KEY}&id={arti_id}"
        xml_data = fetch_xml(url)
        if not xml_data:
            continue
            
        try:
            root = ET.fromstring(xml_data)
            record = root.find('.//record')
            if record is None:
                continue
                
            article_info = record.find('.//articleInfo')
            journal_info = record.find('.//journalInfo')
            
            # 제목
            title_orig = ""
            title_eng = ""
            for t in article_info.findall('.//article-title'):
                if t.get('lang') == 'original': title_orig = t.text or ""
                if t.get('lang') == 'english': title_eng = t.text or ""
                
            # 저자
            authors = []
            institutions = []
            for author in article_info.findall('.//author'):
                name = author.find('name')
                name = name.text.strip() if name is not None and name.text else ""
                inst = author.find('institution')
                inst = inst.text.strip() if inst is not None and inst.text else ""
                
                if name:
                    authors.append(f"{name}({inst})" if inst else name)
                if inst and inst not in institutions:
                    institutions.append(inst)
                    
            author_str = ", ".join(authors)
            inst_str = ", ".join(institutions)
            
            # 키워드
            keywords = []
            for kw in article_info.findall('.//keyword'):
                if kw.text:
                    keywords.append(kw.text.strip())
            keyword_str = ", ".join(keywords)
            
            # 주제어 (KCI 카테고리)
            cat = article_info.find('article-categories')
            categories = cat.text if cat is not None else ""
            
            # 초록
            abs_orig = ""
            abs_eng = ""
            for ab in article_info.findall('.//abstract'):
                if ab.get('lang') == 'original': abs_orig = ab.text or ""
                if ab.get('lang') == 'english': abs_eng = ab.text or ""
                
            # 저널 정보
            journal_name = journal_info.find('journal-name').text if journal_info.find('journal-name') is not None else ""
            pub_year = journal_info.find('pub-year').text if journal_info.find('pub-year') is not None else ""
            issue = journal_info.find('issue').text if journal_info.find('issue') is not None else ""
            volume = journal_info.find('volume').text if journal_info.find('volume') is not None else ""
            
            data.append({
                '논문고유번호': arti_id,
                '논문제목': title_orig,
                '논문제목(영문)': title_eng,
                '저자명': author_str,
                '소속기관명': inst_str,
                '학술지명': journal_name,
                '발행년도': pub_year,
                '권호': f"Vol.{volume} No.{issue}" if volume else (f"No.{issue}" if issue else ""),
                '키워드': keyword_str,
                '주제어': categories,
                '초록(원문)': abs_orig,
                '초록(영문)': abs_eng
            })
            
        except Exception as e:
            print(f"Error parsing article {arti_id}: {e}")
            
        time.sleep(0.2) # API 부하 방지 (1초에 최대 5회 요청)
        
    return data

if __name__ == "__main__":
    ids = get_article_ids()
    if ids:
        result_data = get_article_details(ids)
        
        # 데이터프레임으로 변환
        df = pd.DataFrame(result_data)
        
        # 저장 디렉토리 확인
        os.makedirs('raw_data', exist_ok=True)
        
        # CSV로 저장 (엑셀 호환성)
        output_path = 'raw_data/논문검색리스트Excel_개체화_API.csv'
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        
        # openpyxl이 설치되어 있으면 Excel로도 저장 시도
        try:
            excel_path = 'raw_data/논문검색리스트Excel_개체화_API.xlsx'
            df.to_excel(excel_path, index=False)
            print(f"\n완료! 데이터가 저장되었습니다:")
            print(f"- {output_path}")
            print(f"- {excel_path}")
        except ImportError:
            print(f"\n완료! 데이터가 저장되었습니다: {output_path}")
            print("(openpyxl 패키지가 없어 .xlsx 저장 대신 .csv로 저장했습니다. 'pip install openpyxl' 설치 시 엑셀 저장 가능)")
    else:
        print("검색된 논문이 없습니다.")
