import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import ssl
import time
import pandas as pd
import os

KCI_API_KEY = "10132607"
BOOK_API_KEY = "6bb845d5a44a2782184db85933c41346"
KEYWORD = "개체화"
DISPLAY_COUNT = 100

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_url(url, is_json=False):
    req = urllib.request.Request(url)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                data = response.read().decode('utf-8')
                return json.loads(data) if is_json else data
        except Exception as e:
            print(f"Error fetching URL (attempt {attempt+1}/{max_retries}): {e}")
            time.sleep(2)
    return None

def get_kci_article_ids():
    print(f"[KCI] '{KEYWORD}' 논문 검색 시작...")
    article_ids = []
    page = 1
    total_pages = 1
    
    while page <= total_pages:
        url = f"https://open.kci.go.kr/po/openapi/openApiSearch.kci?apiCode=articleSearch&key={KCI_API_KEY}&keyword={urllib.parse.quote_plus(KEYWORD)}&displayCount={DISPLAY_COUNT}&page={page}"
        xml_data = fetch_url(url)
        if not xml_data:
            break
            
        root = ET.fromstring(xml_data)
        
        if page == 1:
            total_str = root.find('.//total')
            if total_str is not None:
                total_records = int(total_str.text)
                total_pages = (total_records // DISPLAY_COUNT) + (1 if total_records % DISPLAY_COUNT > 0 else 0)
                print(f"[KCI] 총 {total_records}건 검색됨. (총 {total_pages} 페이지)")
        
        print(f"[KCI] ID 수집 중... 페이지 {page}/{total_pages}")
        for article in root.findall('.//articleInfo'):
            arti_id = article.get('article-id')
            if arti_id:
                article_ids.append(arti_id)
                
        page += 1
        time.sleep(0.5)
        
    return article_ids

def get_kci_details(article_ids):
    print(f"\n[KCI] 총 {len(article_ids)}건 논문 상세 정보 수집 중...")
    data = []
    
    for i, arti_id in enumerate(article_ids):
        if (i + 1) % 10 == 0:
            print(f"[KCI] 진행 상황: {i + 1}/{len(article_ids)}...")
            
        url = f"https://open.kci.go.kr/po/openapi/openApiSearch.kci?apiCode=articleDetail&key={KCI_API_KEY}&id={arti_id}"
        xml_data = fetch_url(url)
        if not xml_data:
            continue
            
        try:
            root = ET.fromstring(xml_data)
            record = root.find('.//record')
            if record is None: continue
                
            article_info = record.find('.//articleInfo')
            journal_info = record.find('.//journalInfo')
            
            # 제목
            title_orig = ""
            for t in article_info.findall('.//article-title'):
                if t.get('lang') == 'original': title_orig = t.text or ""
                
            # 저자
            authors = []
            for author in article_info.findall('.//author'):
                name = author.find('name')
                if name is not None and name.text:
                    authors.append(name.text.strip())
            author_str = ", ".join(authors)
            
            # 키워드
            keywords = []
            for kw in article_info.findall('.//keyword'):
                if kw.text: keywords.append(kw.text.strip())
            keyword_str = ", ".join(keywords)
            
            # 초록
            abs_orig = ""
            for ab in article_info.findall('.//abstract'):
                if ab.get('lang') == 'original': abs_orig = ab.text or ""
                
            # 저널명, 발행년도
            journal_name = journal_info.find('journal-name').text if journal_info.find('journal-name') is not None else ""
            pub_year = journal_info.find('pub-year').text if journal_info.find('pub-year') is not None else ""
            
            data.append({
                '데이터_출처': 'KCI (학술논문)',
                '고유번호/ISBN': arti_id,
                '제목': title_orig,
                '저자': author_str,
                '출판사/학술지명': journal_name,
                '발행년도': pub_year,
                '키워드': keyword_str,
                '초록/책소개': abs_orig
            })
            
        except Exception as e:
            print(f"Error parsing KCI article {arti_id}: {e}")
            
        time.sleep(0.2)
        
    return data

def get_book_details():
    print(f"\n[도서] '{KEYWORD}' 도서(단행본) 메타데이터 수집 시작...")
    # 국립중앙도서관 서지정보 API (SearchApi.do)
    page_no = 1
    page_size = 100
    total_books = 0
    data = []
    
    url = f"https://www.nl.go.kr/seoji/SearchApi.do?cert_key={BOOK_API_KEY}&result_style=json&page_no={page_no}&page_size={page_size}&title={urllib.parse.quote(KEYWORD)}"
    
    try:
        json_data = fetch_url(url, is_json=True)
        
        # API 키 오류 등 JSON 형식이 반환되지 않았을 경우 방어
        if not json_data:
            print("[도서] 응답이 없습니다.")
            return data
            
        # 오류 확인
        if "RESULT" in json_data and json_data.get("RESULT") == "ERROR":
            err_msg = json_data.get("ERR_MESSAGE", "")
            print(f"[도서] API 에러 발생: {err_msg} (키가 유효하지 않거나 일일 트래픽 초과일 수 있습니다.)")
            return data
            
        total_books = json_data.get("TOTAL_COUNT", 0)
        print(f"[도서] 총 {total_books}건 검색됨.")
        
        docs = json_data.get("docs", [])
        for item in docs:
            book = item.get('doc', {})
            if not book:
                item = item
            
            # API 반환 구조에 따라 다를 수 있음
            title = item.get('TITLE', '') or item.get('title', '')
            author = item.get('AUTHOR', '') or item.get('author', '')
            publisher = item.get('PUBLISHER', '') or item.get('publisher', '')
            pub_date = item.get('PUBLISH_PREARRANGE_DATE', '') or item.get('real_publish_date', '') or item.get('publish_date', '')
            isbn = item.get('EA_ISBN', '') or item.get('isbn', '')
            book_intro = item.get('BOOK_INTRODUCTION', '') or item.get('book_introduction_url', '')
            
            # 년도만 추출
            pub_year = str(pub_date)[:4] if pub_date else ""
            
            data.append({
                '데이터_출처': '국립중앙도서관 (단행본)',
                '고유번호/ISBN': isbn,
                '제목': title,
                '저자': author,
                '출판사/학술지명': publisher,
                '발행년도': pub_year,
                '키워드': "",
                '초록/책소개': book_intro
            })
            
    except Exception as e:
         print(f"[도서] 데이터 수집 중 오류: {e}")
         
    return data

if __name__ == "__main__":
    os.makedirs('raw_data', exist_ok=True)
    output_path = 'raw_data/메타데이터_통합_개체화.xlsx'
    
    # 1. KCI 데이터 수집
    kci_ids = get_kci_article_ids()
    kci_data = get_kci_details(kci_ids) if kci_ids else []
    
    # 2. 도서 데이터 수집
    book_data = get_book_details()
    
    # 3. 통합 및 저장
    all_data = kci_data + book_data
    
    if all_data:
        df = pd.DataFrame(all_data)
        try:
            df.to_excel(output_path, index=False)
            print(f"\n[완료] 총 {len(all_data)}건의 데이터를 '{output_path}'에 저장했습니다.")
        except ImportError:
            print("\n[알림] openpyxl 패키지가 없어 csv로 저장합니다.")
            df.to_csv(output_path.replace('.xlsx', '.csv'), index=False, encoding='utf-8-sig')
    else:
        print("\n수집된 데이터가 없습니다.")
