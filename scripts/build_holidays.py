"""한국천문연구원 특일 정보 API(getRestDeInfo) → data/holidays.json (공휴일·대체공휴일 날짜 목록).

키는 환경변수 DATA_GO_KR_KEY_ENC(포털 Encoding 키)로만 받는다 — 저장소에 남기지 않는다.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"


def fetch_year(key, year):
    with urllib.request.urlopen(f"{URL}?serviceKey={key}&solYear={year}&numOfRows=100&_type=json", timeout=30) as res:
        body = json.load(res)["response"]["body"]
    items = body["items"]["item"] if body["items"] else []
    items = items if isinstance(items, list) else [items]
    return [{"date": f"{str(i['locdate'])[:4]}-{str(i['locdate'])[4:6]}-{str(i['locdate'])[6:]}", "name": i["dateName"]}
            for i in items if i.get("isHoliday") == "Y"]


def main():
    key = os.environ.get("DATA_GO_KR_KEY_ENC")
    if not key:
        sys.exit("DATA_GO_KR_KEY_ENC 환경변수가 필요하다")
    years = sys.argv[1:] or ["2026", "2027"]
    days = [d for y in years for d in fetch_year(key, y)]
    out = {"source": "한국천문연구원 특일 정보(공공데이터포털 15012690) getRestDeInfo", "years": years, "holidays": days}
    (ROOT / "data/holidays.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"holidays={len(days)}")


if __name__ == "__main__":
    main()
