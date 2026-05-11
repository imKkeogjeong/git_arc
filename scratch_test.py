import re

def clean_author(author_str):
    if not author_str:
        return []
    
    # Split by comma or semicolon
    authors = re.split(r'[,;]', author_str)
    cleaned = []
    for a in authors:
        a = a.strip()
        if not a: continue
        # Extract name and institution
        match = re.match(r'(.+?)\s*\((.*?)\)', a)
        if match:
            name, inst = match.groups()
            cleaned.append({"name": name.strip(), "institution": inst.strip()})
        else:
            cleaned.append({"name": a, "institution": None})
    return cleaned

def clean_title(title):
    if not title: return title
    # Remove PUA
    title = re.sub(r'[\uE000-\uF8FF]', '', title)
    title = title.strip()
    return title

def extract_top_institution(inst):
    if not inst: return None
    # Usually the first word if it contains '대학교' or '대학'
    parts = inst.split()
    for p in parts:
        if '대학교' in p or '대학' in p:
            return p
    return inst # fallback

print(clean_author("이춘식(경인교육대학교), 고봉수(홍익대학교 기계공학과)"))
print(extract_top_institution("홍익대학교 기계공학과"))
print(extract_top_institution("한국교원대학교"))
