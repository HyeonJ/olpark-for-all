#!/usr/bin/env bash
# 연계 데이터(API_CPM_009) 원본을 raw/ 에 받는다. 키는 환경변수로만 받는다(저장소에 안 남긴다).
# API 는 5초에 1회 제한이라 간격을 두고, 429 면 다시 시도한다.
set -euo pipefail
: "${KCISA_KEY_LINKED:?KCISA_KEY_LINKED 환경변수가 필요하다}"
cd "$(dirname "$0")/.."
mkdir -p raw
pages=${PAGES:-8}
for page in $(seq 1 "$pages"); do
    for attempt in 1 2 3 4 5; do
        sleep 8
        curl -sS "https://api.kcisa.kr/openapi/API_CPM_009/request?serviceKey=${KCISA_KEY_LINKED}&numOfRows=1000&pageNo=${page}" \
            -o "raw/linked_${page}.xml"
        if grep -q '<resultCode>0000</resultCode>' "raw/linked_${page}.xml"; then
            echo "page ${page}: $(grep -o '<item>' "raw/linked_${page}.xml" | wc -l) items"
            break
        fi
        echo "page ${page}: retry ${attempt}" >&2
    done
done
