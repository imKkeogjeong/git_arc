import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import ssl

key = "10132607"
keyword = "개체화"
url = f"https://open.kci.go.kr/po/openapi/openApiSearch.kci?apiCode=articleSearch&key={key}&keyword={urllib.parse.quote_plus(keyword)}&displayCount=10&page=1"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(url)
with urllib.request.urlopen(req, context=ctx) as response:
    content = response.read().decode('utf-8')
    print("Status Code:", response.getcode())
    print("Response text length:", len(content))
    with open('api_response.xml', 'w', encoding='utf-8') as f:
        f.write(content)
