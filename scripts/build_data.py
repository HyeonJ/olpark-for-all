"""2025 올림픽공원 연계 데이터(API_CPM_009) 원본 XML → 서비스용 집계 JSON.

원본은 raw/linked_*.xml (키가 필요해 저장소에 안 올린다 — scripts/fetch_linked.sh 로 받는다).
'방문객' 열은 주차대수의 고정 배율(평일 ×3, 주말·휴일 ×5)이라 쓰지 않고 주차대수만 집계한다.
"""
import datetime
import glob
import html
import json
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OPEN_FIRST_HOUR = 6
OPEN_LAST_HOUR = 21
SEASONS = {12: "겨울", 1: "겨울", 2: "겨울", 3: "봄", 4: "봄", 5: "봄",
           6: "여름", 7: "여름", 8: "여름", 9: "가을", 10: "가을", 11: "가을"}


def parse_pairs(text):
    out = {}
    for part in text.split(","):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def load_rows(raw_dir):
    rows = []
    for path in sorted(glob.glob(str(raw_dir / "linked_*.xml"))):
        text = Path(path).read_text(encoding="utf-8")
        for item in re.findall(r"<item>(.*?)</item>", text, re.S):
            def field(tag):
                m = re.search(f"<{tag}>(.*?)</{tag}>", item, re.S)
                if not m:
                    return ""
                return html.unescape(m.group(1)).replace("<![CDATA[", "").replace("]]>", "")
            title = parse_pairs(field("TITLE"))
            desc = parse_pairs(field("DESCRIPTION"))
            rows.append({
                "ts": field("ISSUED_DATE"),
                "parking": int(desc["주차대수"]),
                "visitors": int(desc["방문객"]),
                "holiday": desc.get("휴일", ""),
                "rain": desc.get("강수량", ""),
                "performance": title.get("공연명", ""),
                "audience": int(title.get("공연관람객수", "0") or 0),
            })
    return rows


def day_type(ts, holiday):
    d = datetime.date.fromisoformat(ts[:10])
    return "주말·휴일" if d.weekday() >= 5 or holiday else "평일"


def quantile(sorted_vals, q):
    idx = (len(sorted_vals) - 1) * q
    lo, hi = int(idx), min(int(idx) + 1, len(sorted_vals) - 1)
    return round(sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (idx - lo))


def check_visitor_ratio(rows):
    ratios = {}
    for r in rows:
        if r["parking"] == 0:
            continue
        key = (day_type(r["ts"], r["holiday"]), round(r["visitors"] / r["parking"], 2))
        ratios[key] = ratios.get(key, 0) + 1
    return {f"{k[0]} ×{k[1]}": v for k, v in sorted(ratios.items())}


def flag_days(rows):
    """의심 일자를 규칙으로 가른다 — 규칙은 결과 JSON 에 같이 적어 누구나 다시 돌릴 수 있게 한다."""
    by_day = {}
    for r in rows:
        by_day.setdefault(r["ts"][:10], {})[int(r["ts"][11:13])] = r["parking"]
    days = sorted(by_day)
    daily_max = {d: max(by_day[d].values()) for d in days}
    median_max = statistics.median(daily_max.values())
    flags = {}
    for d in days:
        if len(by_day[d]) < 20:
            flags.setdefault(d, []).append("incomplete")
    run = []
    for d in days + [None]:
        if d is not None and daily_max[d] < 0.15 * median_max:
            run.append(d)
            continue
        if len(run) >= 3:
            for x in run:
                flags.setdefault(x, []).append("decay_run")
        run = []
    monthly = {}
    for d in days:
        if d not in flags:
            monthly.setdefault(d[:7], []).append(daily_max[d])
    shifted = {m for m, v in monthly.items() if statistics.median(v) < 0.35 * median_max}
    for d in days:
        if d[:7] in shifted:
            flags.setdefault(d, []).append("level_shift")
    rules = {
        "incomplete": "그날 관측 시간이 20시간 미만",
        "decay_run": f"일 최대 주차대수가 연간 일최대 중앙값({median_max})의 15% 미만인 날이 3일 이상 연속(수집 장애 의심)",
        "level_shift": "그 달(위 두 규칙 제외)의 일최대 중앙값이 연간 중앙값의 35% 미만(집계 범위 변경 의심)",
    }
    return flags, rules, sorted(shifted)


def build(rows):
    flags, rules, shifted = flag_days(rows)
    flagged_rows = [r for r in rows if r["ts"][:10] in flags]
    rows = [r for r in rows if r["ts"][:10] not in flags]
    # 등급 경계는 공원 차량 출입 시간(06~21시) 관측만으로 정한다 — 밤을 넣으면 낮은 거의 다 «많음»이 된다.
    all_parking = sorted(r["parking"] for r in rows if OPEN_FIRST_HOUR <= int(r["ts"][11:13]) <= OPEN_LAST_HOUR)
    thresholds = {"low_max": quantile(all_parking, 1 / 3), "high_min": quantile(all_parking, 2 / 3)}
    groups = {}
    for r in rows:
        month = int(r["ts"][5:7])
        key = (SEASONS[month], day_type(r["ts"], r["holiday"]), int(r["ts"][11:13]))
        groups.setdefault(key, []).append(r["parking"])
    stats = []
    for (season, dtype, hour), vals in sorted(groups.items()):
        vals.sort()
        stats.append({"season": season, "dayType": dtype, "hour": hour, "n": len(vals),
                      "median": round(statistics.median(vals)), "p25": quantile(vals, .25),
                      "p75": quantile(vals, .75), "min": vals[0], "max": vals[-1]})
    days = {r["ts"][:10] for r in rows}
    return {
        "source": "한국체육산업개발(주)_올림픽공원 2025 차량입출차, 공연, 날씨정보 등 연계 데이터 (문화공공데이터광장 API_CPM_009)",
        "period": [min(r["ts"] for r in rows), max(r["ts"] for r in rows)],
        "rows": len(rows) + len(flagged_rows),
        "metric": "시간대별 주차대수(대) — 기관 제공값 그대로",
        "visitorColumnCheck": check_visitor_ratio(rows + flagged_rows),
        "quality": {
            "rules": rules,
            "flaggedDays": len(flags),
            "flaggedRows": len(flagged_rows),
            "keptDays": len(days),
            "keptRows": len(rows),
            "levelShiftMonths": shifted,
            "byReason": {k: sum(1 for v in flags.values() if k in v) for k in rules},
            "flagged": {d: v for d, v in sorted(flags.items())},
        },
        "levelThresholds": thresholds,
        "stats": stats,
    }


def main():
    rows = load_rows(ROOT / "raw")
    if not rows:
        sys.exit("raw/linked_*.xml 이 없다 — scripts/fetch_linked.sh 먼저")
    out = build(rows)
    (ROOT / "data" / "parking_2025_stats.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"rows={out['rows']} groups={len(out['stats'])} thresholds={out['levelThresholds']}")
    print("visitor ratio check:", out["visitorColumnCheck"])


if __name__ == "__main__":
    main()
