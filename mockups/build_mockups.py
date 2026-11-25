"""시안 3종(A 요약형 · B 지도형 · C 단계형) 정적 HTML 생성. 예시 상태: 토요일 10시 · 휠체어 동행."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MAP = json.loads((ROOT / "data/park_map.json").read_text(encoding="utf-8"))
STATS = json.loads((ROOT / "data/parking_2025_stats.json").read_text(encoding="utf-8"))
T = STATS["levelThresholds"]
HOURS = [s for s in STATS["stats"] if s["season"] == "가을" and s["dayType"] == "주말·휴일" and 6 <= s["hour"] <= 21]
PICK = 10
FONT = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">'

ICON = {
    "wheelchair": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M12 7v6h5l2 5"/><path d="M9 10a6 6 0 1 0 7 8"/></svg>',
    "stroller": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h2l2 9h10"/><path d="M8 13a6 6 0 0 1 10-6v6"/><circle cx="9" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>',
    "senior": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><path d="M10 22l1-7-2-3 1-4h2l2 4 3 1"/><path d="M17 12v10"/></svg>',
    "toilet": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="4" r="1.6"/><circle cx="17" cy="4" r="1.6"/><path d="M5 8h4l1 7H8v6H6v-6H4z"/><path d="M15 8h4v7h-1v6h-2v-6h-1z"/><path d="M12 3v18"/></svg>',
    "parking": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>',
    "clock": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "check": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>',
    "phone": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    "music": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    "info": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
}
PIN_COLOR = {"rental": "var(--isa)", "toilet": "var(--isa)", "nursing": "var(--green)", "parking": "var(--ink)",
             "venue": "var(--mid)"}
PIN_GLYPH = {"rental": "♿", "toilet": "WC", "nursing": "수", "parking": "P", "venue": "♪"}


def level(v):
    if v <= T["low_max"]:
        return "low", "여유"
    if v >= T["high_min"]:
        return "high", "붐빔"
    return "mid", "보통"


def map_svg(show_labels=True, highlight=None, compact=False):
    w, h = MAP["width"], MAP["height"]
    parts = [f'<svg class="park-map" viewBox="-40 -40 {w + 80} {h + 80}" role="img" aria-label="올림픽공원 편의시설 지도">',
             f'<path class="park-map__park" d="{MAP["park"]}"/>']
    parts += [f'<path class="park-map__water" d="{d}"/>' for d in MAP["water"]]
    for p in MAP["pins"]:
        r = 30 if p["id"] == highlight else 22
        color = PIN_COLOR[p["kind"]]
        glyph = PIN_GLYPH[p["kind"]]
        size = 22 if len(glyph) > 1 else 26
        parts.append(f'<g><circle cx="{p["x"]}" cy="{p["y"]}" r="{r}" fill="{color}" stroke="var(--surface)" stroke-width="5"/>'
                     f'<text x="{p["x"]}" y="{p["y"] + 9}" text-anchor="middle" font-size="{size}" font-weight="800" fill="#fff" font-family="sans-serif">{glyph}</text></g>')
        if show_labels and p["kind"] in ("rental", "nursing") and not compact:
            dy = -40
            parts.append(f'<text class="park-map__label" x="{p["x"]}" y="{p["y"] + dy}" text-anchor="middle">{p["label"].split("(")[0]}</text>')
    parts.append("</svg>")
    return "".join(parts)


def day_chart(height=120):
    w = 440
    max_v = max(s["median"] for s in HOURS)
    n = len(HOURS)
    step = w / (n - 1)
    pts = [(i * step, height - 18 - (s["median"] / max_v) * (height - 40)) for i, s in enumerate(HOURS)]
    line = "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    area = line + f"L{w},{height - 18}L0,{height - 18}Z"
    ly = height - 18 - (T["high_min"] / max_v) * (height - 40)
    pick_i = [s["hour"] for s in HOURS].index(PICK)
    px, py = pts[pick_i]
    ticks = "".join(f'<text x="{i * step:.1f}" y="{height - 2}" text-anchor="middle" class="chart__tick">{s["hour"]}</text>'
                    for i, s in enumerate(HOURS) if s["hour"] % 3 == 0)
    return (f'<svg class="chart" viewBox="-6 0 {w + 12} {height}" role="img" aria-label="시간대별 차량 이용 수준">'
            f'<line x1="0" x2="{w}" y1="{ly:.1f}" y2="{ly:.1f}" class="chart__guide"/>'
            f'<text x="{w}" y="{ly - 5:.1f}" text-anchor="end" class="chart__tick">붐빔 기준</text>'
            f'<path d="{area}" class="chart__area"/><path d="{line}" class="chart__line"/>'
            f'<line x1="{px:.1f}" x2="{px:.1f}" y1="8" y2="{height - 18}" class="chart__pick"/>'
            f'<circle cx="{px:.1f}" cy="{py:.1f}" r="6" class="chart__dot"/>{ticks}</svg>')


PICK_STAT = next(s for s in HOURS if s["hour"] == PICK)
LV, LV_LABEL = level(PICK_STAT["median"])
QUIET = sorted((s for s in HOURS if 9 <= s["hour"] <= 18), key=lambda s: s["median"])[:2]
QUIET_TEXT = " · ".join(f'{s["hour"]}시' for s in sorted(QUIET, key=lambda s: s["hour"]))

CHART_CSS = """
.chart { width: 100%; height: auto; display: block; }
.chart__area { fill: var(--green-soft); }
.chart__line { fill: none; stroke: var(--green); stroke-width: 2.5; }
.chart__guide { stroke: var(--high); stroke-dasharray: 4 4; stroke-width: 1.2; opacity: .7; }
.chart__pick { stroke: var(--ink); stroke-width: 1.5; }
.chart__dot { fill: var(--surface); stroke: var(--ink); stroke-width: 3; }
.chart__tick { font: 500 12px var(--font); fill: var(--muted); }
"""


def page(title, css, body):
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>{FONT}<link rel="stylesheet" href="base.css"><style>{CHART_CSS}{css}</style></head>
<body><div class="app">{body}</div></body></html>"""


# ---------- A. 요약형: 결론 한 문장 → 하루 곡선 → 핵심 3가지 ----------
A_CSS = """
.hero { margin: 18px 0 18px; }
.hero__meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-size: 14px; font-weight: 600; }
.pill--on { background: var(--isa); border-color: var(--isa); color: #fff; }
.hero__answer { margin: 0; font-size: 30px; line-height: 1.25; font-weight: 800; letter-spacing: -.03em; text-wrap: balance; }
.hero__answer em { font-style: normal; color: var(--green); }
.hero__sub { margin: 10px 0 0; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 18px; margin-bottom: 14px; }
.panel__head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.panel__title { margin: 0; font-size: 16px; font-weight: 800; }
.big { font-size: 15px; color: var(--muted); }
.big strong { color: var(--ink); font-size: 22px; font-variant-numeric: tabular-nums; }
.facts { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.fact { display: grid; grid-template-columns: 40px 1fr; gap: 12px; align-items: start; }
.fact__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--isa-soft); color: var(--isa); }
.fact__title { font-weight: 800; }
.fact__desc { color: var(--muted); font-size: 15px; }
.flag { display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: 6px; background: #fff3d6; color: #7a4f00; font-size: 12px; font-weight: 700; vertical-align: 2px; }
.map-thumb { border-radius: 16px; overflow: hidden; background: var(--paper); }
.call { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 54px; border: 0; border-radius: 16px; background: var(--ink); color: var(--paper); font: 800 17px var(--font); }
"""
A_BODY = f"""
<div class="brand"><span class="brand__mark">{ICON['wheelchair']}</span>모두의 올팍</div>
<section class="hero">
  <div class="hero__meta"><span class="pill pill--on">{ICON['wheelchair']}휠체어</span><span class="pill">11월 29일 토요일</span><span class="pill">{ICON['clock']}오전 10시 도착</span></div>
  <h1 class="hero__answer">토요일 오전 10시는<br><em>오후보다 한산한 편</em>이에요</h1>
  <p class="hero__sub">작년 가을 토·일요일 같은 시간엔 오후 3시의 60% 정도만 차가 있었어요. 휠체어는 평화의광장 앞에서 빌리면 돼요.</p>
</section>
<section class="panel">
  <div class="panel__head"><h2 class="panel__title">그날의 차량 흐름</h2><span class="chip chip--{LV}">{LV_LABEL}</span></div>
  <p class="big"><strong>{PICK_STAT['median']:,}대</strong> 10시 중앙값 · 가장 한산: {QUIET_TEXT}</p>
  {day_chart()}
  <p class="source-line">2025년 가을 주말·휴일 {PICK_STAT['n']}일 기록 · 한국체육산업개발 연계 데이터 · 예측이 아닌 과거 비교</p>
</section>
<section class="panel">
  <h2 class="panel__title">휠체어로 갈 때 알아둘 3가지</h2>
  <ul class="facts">
    <li class="fact"><span class="fact__icon">{ICON['wheelchair']}</span><div><div class="fact__title">휠체어 대여 2곳</div><div class="fact__desc">평화의광장 앞 공원안내센터 · 만남의광장 동1문 안내센터. 수량은 공개되지 않아 전화 확인이 안전해요.</div></div></li>
    <li class="fact"><span class="fact__icon">{ICON['toilet']}</span><div><div class="fact__title">휠체어 화장실 4곳 표시</div><div class="fact__desc">지도에 위치를 표시했어요(오픈스트리트맵 기준).</div></div></li>
    <li class="fact"><span class="fact__icon">{ICON['parking']}</span><div><div class="fact__title">장애인 주차 140<span class="flag">확인 필요</span></div><div class="fact__desc">출처마다 «장애인 주차장 140칸» / «주차 개수 140»으로 달라요.</div></div></li>
  </ul>
</section>
<section class="panel"><h2 class="panel__title">어디서 빌리고, 어디서 쉬나</h2><div class="map-thumb">{map_svg()}</div><p class="source-line">지도 © OpenStreetMap · 시설 정보 한국관광공사 무장애 여행 정보</p></section>
<button class="call" type="button">{ICON['phone']}공원 안내 02-410-1114</button>
"""

# ---------- B. 지도형: 지도가 화면의 주인공, 아래 시트 ----------
B_CSS = """
.app { padding-top: 0; padding-left: 0; padding-right: 0; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px max(16px, env(safe-area-inset-left, 0px)) 8px; }
.filters { display: flex; gap: 8px; overflow-x: auto; padding: 4px max(16px, env(safe-area-inset-left, 0px)) 12px; }
.filter { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-weight: 700; font-size: 15px; }
.filter--on { background: var(--isa); color: #fff; border-color: var(--isa); }
.mapwrap { position: relative; background: color-mix(in srgb, var(--green-soft) 60%, var(--paper)); padding: 6px 10px 70px; }
.legend { position: absolute; left: 14px; bottom: 82px; display: flex; gap: 10px; padding: 6px 10px; border-radius: 10px; background: var(--surface); font-size: 12.5px; font-weight: 600; }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; background: var(--dot); vertical-align: -1px; }
.sheet { position: relative; margin-top: -60px; background: var(--surface); border-radius: 26px 26px 0 0; padding: 10px max(18px, env(safe-area-inset-left, 0px)) 24px; box-shadow: 0 -8px 30px rgba(20, 40, 30, .12); }
.sheet__grip { width: 44px; height: 5px; border-radius: 3px; background: var(--line); margin: 0 auto 14px; }
.place__kind { font-size: 13px; font-weight: 800; color: var(--isa); letter-spacing: .04em; }
.place__name { margin: 2px 0 6px; font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
.place__rows { display: grid; gap: 10px; margin: 14px 0; }
.row { display: grid; grid-template-columns: 22px 1fr; gap: 10px; color: var(--ink); }
.row .icon { color: var(--muted); }
.row small { display: block; color: var(--muted); font-size: 14px; }
.strip { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; margin-top: 6px; }
.strip__cell { height: 30px; border-radius: 6px; display: grid; place-items: end center; font-size: 11px; color: var(--muted); padding-bottom: 2px; }
.strip__cell--low { background: color-mix(in srgb, var(--low) 25%, transparent); }
.strip__cell--mid { background: color-mix(in srgb, var(--mid) 30%, transparent); }
.strip__cell--high { background: color-mix(in srgb, var(--high) 32%, transparent); }
.strip__cell--pick { outline: 2.5px solid var(--ink); }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
.btn { min-height: 52px; border-radius: 14px; border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); font: 800 16px var(--font); display: flex; align-items: center; justify-content: center; gap: 6px; }
.btn--primary { background: var(--isa); color: #fff; border-color: var(--isa); }
"""
strip = "".join(
    f'<div class="strip__cell strip__cell--{level(s["median"])[0]}{" strip__cell--pick" if s["hour"] == PICK else ""}">{s["hour"]}</div>'
    for s in HOURS if 9 <= s["hour"] <= 18)
B_BODY = f"""
<div class="topbar"><div class="brand"><span class="brand__mark">{ICON['wheelchair']}</span>모두의 올팍</div><span class="chip chip--{LV}">토 10시 · {LV_LABEL}</span></div>
<div class="filters"><span class="filter filter--on">{ICON['wheelchair']}휠체어 대여</span><span class="filter filter--on">{ICON['toilet']}휠체어 화장실</span><span class="filter">{ICON['stroller']}수유실</span><span class="filter">{ICON['music']}공연장</span><span class="filter">{ICON['parking']}주차</span></div>
<div class="mapwrap">{map_svg(highlight="info-peace")}
  <div class="legend"><span style="--dot: var(--isa)">대여·화장실</span><span style="--dot: var(--green)">수유실</span><span style="--dot: var(--mid)">공연장</span></div></div>
<section class="sheet">
  <div class="sheet__grip"></div>
  <div class="place__kind">휠체어·유모차 대여</div>
  <h1 class="place__name">평화의광장 공원안내센터</h1>
  <div class="place__rows">
    <div class="row">{ICON['wheelchair']}<div>휠체어 대여 · 유모차 대여(4대)<small>보유 수량·대여 가능 여부는 공개되지 않아요</small></div></div>
    <div class="row">{ICON['stroller']}<div>수유실 있음<small>한성백제박물관 1층에도 있어요</small></div></div>
    <div class="row">{ICON['clock']}<div>토요일 이 근처 차량 흐름<small>가을 주말·휴일 기준, 9~18시</small>
      <div class="strip">{strip}</div></div></div>
  </div>
  <p class="source-line">한국관광공사 무장애 여행 정보 · 한국체육산업개발 2025 연계 데이터 · 지도 © OpenStreetMap</p>
  <div class="actions"><button class="btn" type="button">{ICON['phone']}전화로 확인</button><button class="btn btn--primary" type="button">길찾기</button></div>
</section>
"""

# ---------- C. 단계형: 출발 전 준비를 체크하며 끝까지 ----------
C_CSS = """
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 18px 0 22px; }
.step { font-size: 13px; font-weight: 700; color: var(--muted); }
.step::before { content: ""; display: block; height: 5px; border-radius: 3px; background: var(--line); margin-bottom: 6px; }
.step--done::before, .step--now::before { background: var(--green); }
.step--now { color: var(--ink); }
.kicker { font-size: 14px; font-weight: 800; color: var(--green); }
.title { margin: 4px 0 6px; font-size: 28px; line-height: 1.25; font-weight: 800; letter-spacing: -.03em; text-wrap: balance; }
.lead { margin: 0 0 18px; color: var(--muted); }
.progress { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 16px; background: var(--green-soft); margin-bottom: 14px; }
.progress__ring { --p: 50; width: 46px; height: 46px; border-radius: 50%; background: conic-gradient(var(--green) calc(var(--p) * 1%), var(--line) 0); display: grid; place-items: center; }
.progress__ring::after { content: attr(data-v); width: 34px; height: 34px; border-radius: 50%; background: var(--green-soft); display: grid; place-items: center; font-size: 13px; font-weight: 800; }
.checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.check { display: grid; grid-template-columns: 30px 1fr; gap: 12px; padding: 16px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); }
.check__box { width: 30px; height: 30px; border-radius: 9px; border: 2px solid var(--line); display: grid; place-items: center; color: #fff; }
.check--done .check__box { background: var(--green); border-color: var(--green); }
.check--done .check__title { text-decoration: line-through; text-decoration-color: var(--muted); color: var(--muted); }
.check__title { font-weight: 800; }
.check__desc { color: var(--muted); font-size: 15px; margin-top: 2px; }
.check__tag { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 3px 8px; border-radius: 8px; background: var(--isa-soft); color: var(--isa); font-size: 13px; font-weight: 700; }
.summary { margin-top: 18px; padding: 18px; border-radius: 20px; background: var(--ink); color: var(--paper); }
.summary h2 { margin: 0 0 8px; font-size: 16px; }
.summary p { margin: 0; font-size: 15px; opacity: .9; }
.summary button { margin-top: 14px; width: 100%; min-height: 50px; border: 0; border-radius: 14px; background: var(--paper); color: var(--ink); font: 800 16px var(--font); }
"""
C_BODY = f"""
<div class="brand"><span class="brand__mark">{ICON['wheelchair']}</span>모두의 올팍</div>
<div class="steps"><div class="step step--done">누구와</div><div class="step step--done">언제</div><div class="step step--now">출발 전 준비</div></div>
<div class="kicker">휠체어 · 11월 29일(토) 오전 10시</div>
<h1 class="title">출발 전에 이 4가지만 챙기면 돼요</h1>
<p class="lead">토요일 10시는 작년 같은 시기 기준 <strong>{LV_LABEL}</strong>이에요({PICK_STAT['median']:,}대). 오후 2~3시보다 덜 붐벼요.</p>
<div class="progress"><div class="progress__ring" style="--p: 50" data-v="2/4"></div><div><strong>2개 준비 완료</strong><br><span class="source-line">체크한 항목은 이 기기에만 저장돼요</span></div></div>
<ul class="checks">
  <li class="check check--done"><span class="check__box">{ICON['check']}</span><div><div class="check__title">도착 시간 정하기</div><div class="check__desc">10시 도착 · 가장 한산한 때는 {QUIET_TEXT}</div></div></li>
  <li class="check"><span class="check__box"></span><div><div class="check__title">휠체어 대여 전화 확인</div><div class="check__desc">평화의광장 앞 공원안내센터 또는 동1문 안내센터. 수량은 공개되지 않아요.</div><span class="check__tag">{ICON['phone']}02-410-1114</span></div></li>
  <li class="check check--done"><span class="check__box">{ICON['check']}</span><div><div class="check__title">쉴 곳·화장실 위치 보기</div><div class="check__desc">휠체어 화장실 4곳을 지도에 표시했어요.</div></div></li>
  <li class="check"><span class="check__box"></span><div><div class="check__title">그날 공연 있는지 확인</div><div class="check__desc">공연이 끝나는 시간 앞뒤로 차가 몰려요. 공원 홈페이지 일정에서 확인하세요.</div><span class="check__tag">{ICON['music']}공연 일정 보기</span></div></li>
</ul>
<section class="summary"><h2>가족에게 보내기</h2><p>11/29(토) 10시 올림픽공원 · 휠체어는 평화의광장 앞 안내센터에서 대여 · 화장실 4곳 · 공원 안내 02-410-1114</p><button type="button">문장 복사하기</button></section>
"""

for name, title, css, body in [("a", "모두의 올팍 · 요약형", A_CSS, A_BODY), ("b", "모두의 올팍 · 지도형", B_CSS, B_BODY),
                               ("c", "모두의 올팍 · 단계형", C_CSS, C_BODY)]:
    (HERE / f"{name}.html").write_text(page(title, css, body), encoding="utf-8")
print("ok")
