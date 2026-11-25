# 모두의 올팍

휠체어·유모차·어르신과 함께 서울 올림픽공원에 가기 전, 공식 공공데이터로 **출발 전 준비**를 확인하는 모바일 웹.
한국체육산업개발 2026 공공데이터 활용 경진대회 출품작.

- 서비스: https://hyeonj.github.io/olpark-for-all/

## 쓰는 데이터
| 데이터 | 제공 | 쓰는 곳 |
|---|---|---|
| 올림픽공원 2025 차량입출차·공연·날씨 연계 데이터 (API_CPM_009) | 한국체육산업개발 | 시간대별 주차대수 과거 비교 |
| 올림픽공원 실시간 주차현황 | 한국체육산업개발 | 지금 주차대수 |
| 무장애 여행 정보 (KorWithService2) | 한국관광공사 | 편의시설 안내 |
| 특일 정보 (getRestDeInfo) | 한국천문연구원 | 공휴일 판정 |
| 공원 경계·물·화장실 위치 | © OpenStreetMap contributors (ODbL) | 편의시설 지도 |

## 데이터 다시 만들기
키는 환경변수로만 넘긴다(저장소에 넣지 않는다).
```bash
export KCISA_KEY_LINKED=...    # 문화공공데이터광장 서비스키
export DATA_GO_KR_KEY_ENC=...  # 공공데이터포털 인증키(Encoding)
scripts/fetch_linked.sh         # raw/ 에 원본 XML (5초에 1회 제한)
python3 scripts/build_data.py   # data/parking_2025_stats.json
python3 scripts/build_map.py    # data/park_map.json (raw/osm_*.json 필요)
python3 scripts/build_holidays.py 2026 2027  # data/holidays.json
```
품질 규칙(제외한 날과 이유)은 `data/parking_2025_stats.json` 의 `quality` 에 같이 적힌다.
