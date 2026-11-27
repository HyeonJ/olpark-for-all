(() => {
    "use strict";

    const DATA_BASE = new URL("data/", document.currentScript.src).href;
    const LIVE_URL = "https://www.ksponco.or.kr/online/main/parkingorsApi.do?apiKey=PARKING21803504";
    const PARK_PHONE = "02-410-1114";
    const SEASONS = { 12: "겨울", 1: "겨울", 2: "겨울", 3: "봄", 4: "봄", 5: "봄",
        6: "여름", 7: "여름", 8: "여름", 9: "가을", 10: "가을", 11: "가을" };
    const OPEN = { first: 6, last: 21 };
    const MIN_DAYS = 8;
    const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
    const WHO_ORDER = ["wheelchair", "stroller", "senior", "visual"];
    // 동행 «유형»을 사람 명칭으로 부른다(관광공사 열린관광·서울동행맵 표기) — 사람 수가 아니라 세는 말을 붙이지 않는다
    const WHO_LABEL = { wheelchair: "휠체어", stroller: "유모차·아이 동반", senior: "어르신", visual: "시각장애인" };
    const DEFAULT_FILTERS = {
        wheelchair: ["rental", "toilet", "parking"],
        stroller: ["rental", "nursing", "toilet"],
        senior: ["rental", "toilet"],
        visual: ["venue"],
    };
    const FILTERS = [
        { kind: "rental", label: "대여소" },
        { kind: "toilet", label: "휠체어 화장실" },
        { kind: "nursing", label: "수유실" },
        { kind: "parking", label: "주차장" },
        { kind: "venue", label: "공연장" },
    ];
    const CHIP_SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    const CHECK_ICON = CHIP_SVG("<path d=\"M5 12.5l4.5 4.5L19 7\"/>");
    const GLYPH = { rental: "대여", toilet: "WC", nursing: "수유", parking: "P", venue: "공연" };
    const KIND_LABEL = {
        rental: "대여소",
        toilet: "휠체어 이용 가능으로 등록된 화장실",
        nursing: "수유실",
        parking: "주차장",
        venue: "공연장",
    };
    const SHORT_NAME = { "info-peace": "평화의광장", "info-east1": "동1문", museum: "박물관" };
    const STAY_OPTIONS = [1, 2, 3, 4];
    const STAY_DEFAULT = 3;
    const STAY_SHOWN_OTHERS = 3;
    const STAY_BETTER_BY = 0.1;
    const MUST_ITEMS = [
        { id: "wheelchair", label: "휠체어 대여", key: "wheelchair", rental: "휠체어", link: true },
        { id: "stroller", label: "유모차 대여", key: "stroller", rental: "유모차", link: true },
        { id: "restroom", label: "장애인 화장실", key: "restroom", link: true },
        { id: "parking", label: "장애인 주차", key: "parking" },
        { id: "nursing", label: "수유실", key: "nursing", link: true },
        { id: "entrance", label: "턱 없는 출입구", key: "entrance" },
        { id: "ramp", label: "경사로", key: "ramp" },
        { id: "braille", label: "점자 안내", key: "braille" },
    ];
    // 꼭 필요한 것 → 지도에서 보여줄 시설 종류. 수유실은 안내센터 2곳(대여소)에도 있어 둘을 같이 연다
    const MUST_MAP = {
        wheelchair: ["rental"],
        stroller: ["rental"],
        restroom: ["toilet"],
        nursing: ["nursing", "rental"],
    };
    const DEFAULT_MUST = {
        wheelchair: ["wheelchair", "restroom", "parking"],
        stroller: ["stroller", "restroom", "nursing"],
        senior: ["wheelchair", "restroom"],
        visual: ["braille"],
    };
    const PLACE_INFO = {
        "info-peace": { rows: [
            ["휠체어 대여는 전화로 확인해 주세요", "수량과 당일 대여 가능 여부는 공개되지 않았어요.", "bag"],
            ["유모차 대여 4대", "한국관광공사 자료 기준이에요. 관광공사 누리집은 센터별 수량 없이 ‘4대’로만 안내해요.", "stroller"],
            ["수유실", "안내센터 안에 있어요.", "bottle"],
        ] },
        "info-east1": { rows: [
            ["휠체어 대여는 전화로 확인해 주세요", "만남의광장 안이에요. 수량과 당일 대여 가능 여부는 공개되지 않았어요.", "bag"],
            ["유모차 대여 3대", "한국관광공사 자료 기준이에요. 관광공사 누리집에는 이 센터의 수량이 없어요.", "stroller"],
            ["수유실", "안내센터 안에 있어요.", "bottle"],
        ] },
        museum: { rows: [["1층 수유실", "한성백제박물관 안이에요.", "bottle"]] },
        "p-south2": { rows: [["남2문 주차장", "실시간 주차 현황은 공원 전체 합계만 공개돼요.", "parking"]] },
        hall: { rows: [["점자 안내", "이 장소가 점자 안내 목록에 있는지는 확인되지 않았어요. 공원 안내로 문의해 주세요.", "braille"]] },
        arthall: { rows: [["점자 안내", "점자 안내 목록에 있는 곳이에요. 출처마다 ‘점자안내판’, ‘점자 홍보물 수령장소’로 달라서 전화로 확인해 주세요.", "braille"]] },
        kspo: { rows: [["공연이 있는 날", "주변이 붐빌 수 있어요. 일정은 공연 일정 페이지에서 확인해 주세요.", "music"]] },
    };
    const TOILET_INFO = { rows: [["현장 확인 전 자료예요", "오픈스트리트맵에 ‘휠체어 이용 가능’으로 등록된 곳이에요. 정확한 이용 가능 여부는 현장에서 확인해 주세요.", "toilet"]] };

    const $ = (id) => document.getElementById(id);
    const state = {
        who: new Set(["wheelchair"]),
        must: new Set(DEFAULT_MUST.wheelchair),
        filters: new Set(DEFAULT_FILTERS.wheelchair),
        place: null,
        view: "summary",
        // «○시 도착으로 바꾸기»를 누른 직후의 되돌리기 정보 — 사용자가 조건을 직접 바꾸면 지운다
        applied: null,
        // 요약 화면의 «필요한 곳»에서 지도로 왔을 때 무엇을 보러 왔는지
        from: null,
    };
    let stats;
    let access;
    let parkMap;
    let toiletNames = new Map();
    let holidays = { years: [], map: new Map(), loaded: false };

    const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
    const fmt = (n) => n.toLocaleString("ko-KR");
    const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;

    const hourWord = (h) => {
        if (h === 12) {
            return "낮 12시";
        }
        return h < 12 ? `오전 ${h}시` : `오후 ${h - 12}시`;
    };

    const periodOf = (h) => {
        if (h === 12) {
            return "낮";
        }
        return h < 12 ? "오전" : "오후";
    };

    const clock12 = (h) => (h > 12 ? h - 12 : h);

    // 시작에는 오전/오후를 늘 붙이고, 끝은 시작과 다를 때만 붙인다 — «오전 10시~오후 1시», «오후 2시~5시»
    const rangeWord = (start, end) => {
        const endText = periodOf(end) === periodOf(start) ? `${clock12(end)}시` : `${periodOf(end)} ${clock12(end)}시`;
        return `${periodOf(start)} ${clock12(start)}시~${endText}`;
    };

    const whoLabels = () => WHO_ORDER.filter((w) => state.who.has(w)).map((w) => WHO_LABEL[w]);

    const showDate = (dateText) => {
        if (!dateText) {
            $("visit-date-shown").textContent = "날짜 선택";
            return;
        }
        const day = new Date(`${dateText}T12:00:00+09:00`).getUTCDay();
        $("visit-date-shown").textContent = `${Number(dateText.slice(5, 7))}월 ${Number(dateText.slice(8, 10))}일 (${WEEKDAY[day]})`;
    };

    const readWhen = () => {
        const dateText = $("visit-date").value;
        showDate(dateText);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
            return null;
        }
        const day = new Date(`${dateText}T12:00:00+09:00`).getUTCDay();
        const year = dateText.slice(0, 4);
        const hour = Number($("visit-hour").value);
        const stay = Number($("visit-stay").value);
        const holidayName = holidays.map.get(dateText) || null;
        return {
            dateText,
            month: Number(dateText.slice(5, 7)),
            dayNum: Number(dateText.slice(8, 10)),
            weekday: WEEKDAY[day],
            isWeekend: day === 0 || day === 6,
            holidayName,
            holidayKnown: holidays.years.includes(year),
            dayType: day === 0 || day === 6 || holidayName ? "주말·휴일" : "평일",
            hour,
            stay,
            stayUsed: Math.min(stay, OPEN.last + 1 - hour),
        };
    };

    const dayRows = (season, dayType) => stats.stats
        .filter((s) => s.season === season && s.dayType === dayType && s.hour >= OPEN.first && s.hour <= OPEN.last)
        .sort((a, b) => a.hour - b.hour);

    // 고른 시각이 «그날 시간대들 안에서» 어디쯤인지 — 제일 붐빈 시각과만 대면 거의 모든 시각이 «덜 붐볐다»가 돼서
    //   가이드가 안 된다(Darren M:7dpb). 그래서 «하루 중 위치» + «앞뒤 2시간 안의 더 한산한 때»로 말한다.
    const NEAR_WINDOW = 2;
    // 대안으로 권하는 시각은 공원을 둘러볼 수 있는 때로만 — 새벽·마감 직전(차량 22시 마감)을 권하면 한산해도 쓸모가 없다
    const SUGGEST = { first: 9, last: 19 };
    const BETTER_BY = 0.1;
    const dayPosition = (rows, pick) => {
        const below = rows.filter((s) => s.median < pick.median).length;
        const share = below / (rows.length - 1);
        if (share >= 2 / 3) {
            return "많은 편";
        }
        if (share <= 1 / 3) {
            return "적은 편";
        }
        return "보통 수준";
    };

    const nearbyBetter = (rows, pick) => {
        const near = rows.filter((s) => s.hour !== pick.hour && Math.abs(s.hour - pick.hour) <= NEAR_WINDOW
            && s.hour >= SUGGEST.first && s.hour <= SUGGEST.last);
        if (!near.length) {
            return null;
        }
        const best = near.reduce((a, b) => (b.median < a.median ? b : a));
        return best.median <= pick.median * (1 - BETTER_BY) ? best : null;
    };

    const shiftWord = (from, to) => {
        const d = to - from;
        return d > 0 ? `${d}시간 늦게` : `${-d}시간 일찍`;
    };

    const chartSvg = (rows, pick, threshold) => {
        const left = 24;
        const width = 300;
        const base = 168;
        const rise = 112;
        const yMax = Math.max(...rows.map((s) => s.median), threshold);
        const x = (hour) => left + ((hour - OPEN.first) / (OPEN.last - OPEN.first)) * width;
        const y = (value) => base - (value / yMax) * rise;
        const pts = rows.map((s) => `${x(s.hour).toFixed(1)},${y(s.median).toFixed(1)}`);
        const line = `M${pts.join(" L")}`;
        const area = `${line} L${x(rows[rows.length - 1].hour).toFixed(1)},${base} L${x(rows[0].hour).toFixed(1)},${base}Z`;
        const gy = y(threshold).toFixed(1);
        const px = x(pick.hour);
        const py = y(pick.median);
        const tagX = Math.min(Math.max(px, left + 6), left + width - 6);
        const ticks = [6, 9, 12, 15, 18, 21].map((h) =>
            `<text x="${x(h).toFixed(1)}" y="193" text-anchor="middle">${h}시</text>`).join("");
        const label = `2025년 시간대별 주차대수 중앙값. ${pick.hour}시 ${fmt(pick.median)}대. 점선은 상위 1/3 경계 ${fmt(threshold)}대. 과거 비교예요.`;
        return `<svg class="chart" viewBox="0 0 350 202" role="img" aria-label="${esc(label)}">
            <path class="chart__grid" d="M${left} ${base}H${left + width}M${left} ${base - rise / 2}H${left + width}"/>
            <path class="chart__area" d="${area}"/>
            <path class="chart__threshold" d="M${left} ${gy}H${left + width}"/>
            <text class="chart__threshold-label" x="${left + width}" y="${(gy - 7).toFixed(1)}" text-anchor="end">상위 1/3 경계 ${fmt(threshold)}대</text>
            <path class="chart__line" d="${line}"/>
            <path class="chart__cursor" d="M${px.toFixed(1)} 26V${base}"/>
            <circle class="chart__point" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5"/>
            <rect class="chart__tag" x="${(tagX - 26).toFixed(1)}" y="2" width="52" height="24" rx="4"/>
            <text class="chart__tag-text" x="${tagX.toFixed(1)}" y="19" text-anchor="middle">${pick.hour}시</text>${ticks}</svg>`;
    };

    const hourTable = (rows) => {
        const half = Math.ceil(rows.length / 2);
        const cell = (s) => (s ? `<th scope="row">${s.hour}시</th><td>${fmt(s.median)}대</td>` : "<th></th><td></td>");
        const body = Array.from({ length: half }, (_, i) => `<tr>${cell(rows[i])}${cell(rows[i + half])}</tr>`).join("");
        return `<table class="chart-table"><caption>6~21시 주차대수 중앙값</caption>
            <thead><tr><th scope="col">시간</th><th scope="col">주차대수</th><th scope="col">시간</th><th scope="col">주차대수</th></tr></thead>
            <tbody>${body}</tbody></table>`;
    };

    const renderFlow = (when, season, rows, pick) => {
        const t = stats.levelThresholds.high_min;
        const most = rows.reduce((a, b) => (b.median > a.median ? b : a));
        const calm = rows.filter((s) => s.hour >= SUGGEST.first && s.hour <= SUGGEST.last);
        const least = calm.reduce((a, b) => (b.median < a.median ? b : a));
        const comparison = `가장 많았던 때: <strong>${hourWord(most.hour)} ${fmt(most.median)}대</strong><br>가장 적었던 때(${SUGGEST.first}~${SUGGEST.last}시): <strong>${hourWord(least.hour)} ${fmt(least.median)}대</strong>`;
        const year = stats.period[0].slice(0, 4);
        $("flow").innerHTML = `<div class="section-head"><h2 id="flow-title">${hourWord(when.hour)} 주차대수</h2></div>
            <div class="metric"><strong>${fmt(pick.median)}<small>대</small></strong><span>작년 중앙값</span></div>
            <p class="range">작년 기록의 가운데 절반은 ${fmt(pick.p25)}~${fmt(pick.p75)}대였어요</p>
            ${chartSvg(rows, pick, t)}
            <p class="comparison">${comparison}</p>
            <p class="source-line">한국체육산업개발 · ${year}년 ${season} ${when.dayType} ${pick.n}일<br>같은 조건의 과거 비교이며, 방문일의 예측은 아니에요.</p>
            <details class="data-detail"><summary class="data-detail__summary">범위와 기준 보기${icon("down")}</summary>
            <div class="detail-body">
                <p>${fmt(pick.median)}대는 ${pick.n}일 기록의 <strong>중앙값</strong>이에요. 가운데 절반의 날은 ${fmt(pick.p25)}~${fmt(pick.p75)}대였고, 가장 적은 날은 ${fmt(pick.min)}대, 가장 많은 날은 ${fmt(pick.max)}대였어요.</p>
                <p>점선은 <strong>상위 1/3 경계 ${fmt(t)}대</strong>예요. 작년 6~21시 관측값 전체를 크기순으로 나눴을 때 큰 쪽 3분의 1이 시작되는 값이에요. 가운데 절반의 범위와는 다른 기준이고, 선을 넘는다고 해서 어떤 상태라고 단정하지는 않아요.</p>
                <p>주차된 차량 대수예요. 남은 주차면 수나 방문객 수를 뜻하지 않아요.</p>
                ${hourTable(rows)}
            </div></details>`;
    };

    // 같은 길이로 머무는 창의 평균 — 창 안 시간대가 하나라도 비었거나 표본이 모자라면 세지 않는다
    const windowAvg = (rows, start, len) => {
        const parts = rows.filter((s) => s.hour >= start && s.hour < start + len);
        if (parts.length !== len || parts.some((s) => s.n < MIN_DAYS)) {
            return null;
        }
        return {
            start,
            avg: Math.round(parts.reduce((sum, s) => sum + s.median, 0) / len),
            days: Math.min(...parts.map((s) => s.n)),
        };
    };

    const stayCandidates = (rows, when) => {
        const found = [];
        for (let start = SUGGEST.first; start <= SUGGEST.last; start += 1) {
            // 후보는 머무는 마지막 시간대가 19시를 넘지 않는 창만 — 해 진 뒤·마감 직전 창을 «한산하다»고 권하면 쓸모가 없다
            const win = start === when.hour || start + when.stayUsed - 1 > SUGGEST.last
                ? null : windowAvg(rows, start, when.stayUsed);
            if (win) {
                found.push(win);
            }
        }
        return found.sort((a, b) => a.avg - b.avg).slice(0, STAY_SHOWN_OTHERS);
    };

    // 카드의 «언제» 줄 — 대안은 아래 «머무는 동안의 차량»과 같은 창 비교 하나로 말한다.
    //   시각 하나(«1시간 일찍 12%»)와 창 평균(«10%»)이 서로 다른 수를 말하던 것을 맞춘다(codex 리뷰 3)
    const stayBest = (rows, when) => {
        const chosen = windowAvg(rows, when.hour, when.stayUsed);
        if (!chosen) {
            return null;
        }
        const shown = [chosen, ...stayCandidates(rows, when)];
        const lowest = shown.reduce((a, b) => (b.avg < a.avg ? b : a));
        return { chosen, lowest, shown, gain: Math.round((1 - lowest.avg / chosen.avg) * 100) };
    };

    const planTime = (when, rows, pick) => {
        const head = `<p class="plan__label">${icon("calendar")}언제</p>
            <p class="plan__text">${hourWord(when.hour)} 도착은 차량이 <strong>${dayPosition(rows, pick)}</strong>이었어요</p>`;
        const len = when.stayUsed;
        const best = stayBest(rows, when);
        let sub;
        let applyHour = null;
        if (best && best.lowest !== best.chosen && best.gain >= STAY_BETTER_BY * 100) {
            applyHour = best.lowest.start;
            // 몇 시간씩 떨어진 대안에 «5시간 일찍»을 붙이면 어색해서, 가까울 때만 얼마나 당기는지 말한다
            const near = Math.abs(applyHour - when.hour) <= NEAR_WINDOW ? `${shiftWord(when.hour, applyHour)} 와서 ` : "";
            sub = `${near}${rangeWord(applyHour, applyHour + len)}에 머물면 차가 약 ${best.gain}% 적었어요`;
        } else if (best && best.lowest === best.chosen) {
            sub = `같은 ${len}시간 중 ${rangeWord(when.hour, when.hour + len)}가 가장 한산했어요 · 평균 ${fmt(best.chosen.avg)}대`;
        } else if (best) {
            sub = `다른 시간에 머물러도 차이가 크지 않았어요 · 평균 ${fmt(best.chosen.avg)}대`;
        } else {
            const better = nearbyBetter(rows, pick);
            if (better) {
                applyHour = better.hour;
                sub = `${shiftWord(when.hour, better.hour)}(${hourWord(better.hour)}) 오면 차가 약 ${Math.round((1 - better.median / pick.median) * 100)}% 적었어요`;
            } else {
                sub = `앞뒤 ${NEAR_WINDOW}시간 중에는 이때가 한산한 편이에요`;
            }
        }
        const actions = applyHour === null ? ""
            : `<div class="plan__actions"><button class="btn btn--primary" type="button" data-apply-hour="${applyHour}">${hourWord(applyHour)} 도착으로 바꾸기</button>${best ? "<button class=\"btn btn--ghost\" type=\"button\" data-scroll=\"stay\">시간대별 비교</button>" : ""}</div>`;
        return `${head}<p class="plan__sub">${sub}</p>${actions}`;
    };

    const stayRowHtml = (win, len, flags, top) => {
        const classes = ["window", flags.pick ? "window--pick" : "", flags.best ? "window--best" : ""].filter(Boolean).join(" ");
        const mark = flags.pick ? "<span class=\"window__sr\"> (고른 시간)</span>" : "";
        const tag = flags.best ? "<small class=\"window__tag\">가장 적음</small>" : "";
        return `<li class="${classes}"><span class="window__label">${rangeWord(win.start, win.start + len)}${mark}${tag}</span>
            <span class="window__bar" aria-hidden="true"><span class="window__fill" style="width:${((win.avg / top) * 100).toFixed(1)}%"></span></span>
            <span class="window__num">${fmt(win.avg)}대</span></li>`;
    };

    const renderStay = (when, season, rows) => {
        const box = $("stay");
        const len = when.stayUsed;
        const best = stayBest(rows, when);
        if (!best) {
            box.hidden = true;
            box.innerHTML = "";
            return;
        }
        const { chosen, lowest } = best;
        const shown = [...best.shown].sort((a, b) => a.start - b.start);
        const top = Math.max(...shown.map((w) => w.avg));
        const lowestRange = rangeWord(lowest.start, lowest.start + len);
        const gain = Math.round((1 - lowest.avg / chosen.avg) * 100);
        let comparison;
        if (lowest === chosen) {
            comparison = "같은 길이로 머문다면 <strong>이때가 가장 한산했어요</strong>";
        } else if (gain >= STAY_BETTER_BY * 100) {
            comparison = `<strong>${lowestRange}</strong>에 머물면 차가 약 ${gain}% 적었어요`;
        } else {
            comparison = `${lowestRange}가 약 ${gain}% 적었지만 차이는 크지 않아요`;
        }
        const capped = when.stay > len
            ? `<p class="stay__note">공원 차량 출입은 ${OPEN.last + 1}시까지라 ${hourWord(OPEN.last + 1)}까지만 셌어요</p>` : "";
        const items = shown.map((w) => stayRowHtml(w, len, { pick: w === chosen, best: w === lowest }, top)).join("");
        box.innerHTML = `<div class="section-head"><h2 id="stay-title">머무는 동안의 차량</h2></div>
            <p class="stay__lead">${rangeWord(when.hour, when.hour + len)} 머무는 동안 평균 <strong>${fmt(chosen.avg)}대</strong> · 작년 ${esc(season)} ${esc(when.dayType)} ${chosen.days}일 기준</p>${capped}
            <ul class="window-list" aria-label="같은 ${len}시간을 다른 시각에 머물렀을 때 평균 주차대수">${items}</ul>
            <p class="comparison">${comparison}</p>
            <p class="source-line">과거 같은 조건의 시간대별 중앙값을 평균한 값이에요. 방문일 예측이 아니고, 대여 운영시간·해 지는 시간은 반영하지 않았어요.</p>`;
        box.hidden = false;
    };

    const toiletPinCount = () => parkMap.pins.filter((p) => p.kind === "toilet").length;

    // «이용 가능» 같은 판단어는 쓰지 않는다 — 자료에 적힌 것과 비어 있는 것만 나눠 보여준다
    const mustRow = (def) => {
        const item = access.items.find((it) => it.key === def.key);
        if (!item) {
            return { name: def.label, badge: ["none", "공개 자료 없음"], detail: "관광공사 자료에서 찾지 못했어요.", todos: [], questions: [] };
        }
        const questions = [];
        const todos = [];
        const ask = (line, question) => {
            todos.push(line);
            questions.push(question);
        };
        let badge;
        let detail;
        if (def.id === "restroom") {
            badge = ["none", "위치 공식 자료 없음"];
            detail = `관광공사 자료엔 «있음»만 있고, 위치는 오픈스트리트맵 등록 ${toiletPinCount()}곳(현장 확인 전)`;
            ask("도착할 곳 근처에 있는지 → 전화로 확인", "도착할 곳 근처 장애인 화장실");
        } else if (item.status === "differs") {
            badge = ["diff", "출처마다 다름"];
            detail = `관광공사 자료 «${item.api}» · 관광공사 누리집 «${item.web}»`;
        } else {
            badge = ["ok", "확인됨"];
            detail = item.api;
        }
        // 항목마다 따로 정한 확인거리가 있으면 그것으로 말하고, 없는 «출처마다 다름»만 일반 문구를 쓴다
        if (def.rental) {
            ask("당일 빌릴 수 있는지는 공개되지 않아요 → 전화로 확인", `${def.rental} 당일 대여 가능 여부`);
        } else if (def.id === "parking") {
            ask("140칸이 장애인 전용인지 → 전화로 확인", "장애인 전용 주차면 수");
        } else if (item.status === "differs") {
            ask("정확한 내용은 → 전화로 확인", `${def.label} 정확한 내용`);
        }
        return { id: def.id, name: def.label, badge, detail, todos, questions, link: Boolean(def.link) };
    };

    const mustRowHtml = (row) => {
        const link = row.link && MUST_MAP[row.id]
            ? `<button class="must__link" type="button" data-go-kind="${MUST_MAP[row.id].join(" ")}" data-go-from="${esc(row.name)}">지도에서 위치 보기${icon("right")}</button>` : "";
        const todos = row.todos.map((t) => `<span class="must__todo">${icon("phone")}${esc(t)}</span>`).join("");
        return `<li class="must"><span class="must__name">${esc(row.name)}</span>
            <span class="must__state must__state--${row.badge[0]}">${esc(row.badge[1])}</span>
            <span class="must__detail">${esc(row.detail)}</span>${todos}${link}</li>`;
    };

    const callSummaryHtml = (questions) => `<strong>전화 한 번에 물어볼 것 ${questions.length}가지</strong> <span class="nowrap">· 공원 안내 ${PARK_PHONE}</span>
        <ol>${questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>`;

    const renderMust = () => {
        document.querySelectorAll(".must-pick").forEach((btn) =>
            btn.setAttribute("aria-pressed", String(state.must.has(btn.dataset.must))));
        const rows = MUST_ITEMS.filter((def) => state.must.has(def.id)).map(mustRow);
        const list = $("must-list");
        list.innerHTML = rows.length ? rows.map(mustRowHtml).join("")
            : "<li class=\"empty-note\">꼭 필요한 것을 고르면 확인된 것과 확인할 것을 나눠 보여드려요.</li>";
        if (state.must.has("braille")) {
            // 점자 안내 하나만으론 시각장애인 동행에 부족해서 «물어볼 곳»을 같이 둔다(번호는 관광공사 자료의 공원 안내)
            list.insertAdjacentHTML("beforeend", `<li class="must"><span class="must__name">시설 위치는 공원 안내에 물어보세요</span>
                <span class="must__detail">공개 자료에는 점자 안내 장소 외의 시각장애인 편의 정보가 없어요.<br>공원 안내 ${PARK_PHONE}</span></li>`);
        }
        const questions = rows.flatMap((r) => r.questions);
        const box = $("call-summary");
        box.hidden = questions.length === 0;
        box.innerHTML = questions.length ? callSummaryHtml(questions) : "";
        return questions;
    };

    const renderMustPicks = () => {
        $("must-picks").innerHTML = MUST_ITEMS.map((def) => `<button class="pick must-pick" type="button" data-must="${def.id}" aria-pressed="${state.must.has(def.id)}"><span class="pick__face">${CHIP_SVG("<path d=\"M5 12.5l4.5 4.5L19 7\"/>").replace("<svg ", "<svg class=\"pick__check\" ")}${esc(def.label)}</span></button>`).join("");
    };

    const resetMustToWho = () => {
        state.must = new Set(WHO_ORDER.filter((w) => state.who.has(w)).flatMap((w) => DEFAULT_MUST[w]));
    };

    const planHead = (when) => {
        const labels = whoLabels();
        $("plan-who").textContent = labels.length ? `이번 방문 · ${labels.join(" · ")}` : "이번 방문";
        if (!when) {
            $("plan-title").textContent = "날짜를 골라 주세요";
            return;
        }
        const holiday = when.holidayName ? ` ${esc(when.holidayName)}` : "";
        $("plan-title").innerHTML = `${when.month}월 ${when.dayNum}일(${when.weekday}${holiday}) ${hourWord(when.hour)} 도착,<br>${when.stayUsed}시간 머물러요`;
    };

    const rentalWhat = () => ["wheelchair", "stroller"].filter((id) => state.must.has(id))
        .map((id) => MUST_ITEMS.find((d) => d.id === id).rental).join("·");

    // «필요한 곳» — 꼭 필요한 것으로 고른 항목 중 지도에 위치가 있는 것만, 누르면 그 시설로 바로 연다
    const planPlaces = () => {
        const chips = [];
        const chip = (badge, kind, title, sub, go) => chips.push(`<button class="place-chip" type="button" data-go-kind="${go.kinds.join(" ")}" data-go-from="${esc(go.from)}"${go.place ? ` data-go-place="${esc(go.place)}"` : ""}>
            <span class="place-chip__badge${kind === "toilet" ? " place-chip__badge--wc" : ""}" aria-hidden="true">${badge}</span>
            <span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>${icon("right")}</button>`);
        const what = rentalWhat();
        if (what) {
            parkMap.pins.filter((p) => p.kind === "rental").forEach((p) =>
                chip(GLYPH.rental, "rental", p.label, `${what} 대여 · 위치 보기`, { kinds: ["rental"], from: `${what} 대여`, place: p.id }));
        }
        if (state.must.has("restroom")) {
            chip(GLYPH.toilet, "toilet", `휠체어 화장실 ${toiletPinCount()}곳`, "오픈스트리트맵 등록 · 현장 확인 전", { kinds: ["toilet"], from: "장애인 화장실" });
        }
        if (state.must.has("nursing")) {
            const n = parkMap.pins.filter((p) => MUST_MAP.nursing.includes(p.kind)).length;
            chip(GLYPH.nursing, "nursing", `수유실 있는 곳 ${n}곳`, "안내센터 2곳 · 한성백제박물관", { kinds: MUST_MAP.nursing, from: "수유실" });
        }
        const box = $("plan-places");
        box.hidden = chips.length === 0;
        box.innerHTML = chips.length ? `<p class="plan__label">${icon("pin")}필요한 곳</p><div class="plan__places">${chips.join("")}</div>` : "";
    };

    const planCall = (questions) => {
        const box = $("plan-call");
        box.hidden = questions.length === 0;
        box.innerHTML = questions.length ? `<p class="plan__text">출발 전 전화로 물어볼 것 <span class="plan__count">${questions.length}가지</span></p>
            <p class="plan__sub">${questions.map(esc).join(" · ")}</p>
            <div class="plan__actions"><button class="btn" type="button" data-scroll="call-summary">${icon("phone")}물어볼 것 보기</button></div>` : "";
    };

    const renderApplied = () => {
        const box = $("applied");
        box.hidden = !state.applied;
        box.innerHTML = state.applied
            ? `<span>${hourWord(state.applied.to)} 도착으로 바꿨어요</span><button id="applied-undo" type="button">되돌리기</button>` : "";
    };

    const planMessage = (text) => {
        $("plan-time").classList.remove("is-new");
        $("plan-time").innerHTML = `<p class="plan__label">${icon("calendar")}언제</p><p class="plan__sub">${text}</p>`;
    };

    const dayKindText = (when) => {
        if (when.holidayName) {
            return `${esc(when.holidayName)} · 공휴일이라 주말·휴일 기록과 비교해요.`;
        }
        if (when.isWeekend) {
            return "주말이라 주말·휴일 기록과 비교해요.";
        }
        return when.holidayKnown
            ? "공휴일이 아닌 평일이라 평일 기록과 비교해요."
            : "공휴일 정보가 없는 해라 주말만 구분했어요. 평일 기록과 비교해요.";
    };

    const renderCondition = (when) => {
        const dot = "<span class=\"condition__dot\">·</span>";
        if (!when) {
            $("condition-text").textContent = "날짜를 선택해 주세요";
            $("day-kind").textContent = "";
            return;
        }
        const labels = whoLabels();
        // 여러 유형이면 «○○ 외» — 숫자를 붙이면 «1명/1가지» 중 무엇을 세는지가 생긴다(Darren M:n8ax → M:0ty2 «외»로 시험)
        const who = labels.length > 1 ? `${labels[0]} 외` : labels[0] || "동행 선택 안 함";
        const holiday = when.holidayName ? ` ${esc(when.holidayName)}` : "";
        const tail = esc(who);
        const stayText = rangeWord(when.hour, when.hour + when.stayUsed);
        // aria-label 은 일반 span 에선 낭독되지 않는다 — 누를 수 있는 summary 에 단다
        document.querySelector(".condition__summary").setAttribute("aria-label",
            `${when.month}월 ${when.dayNum}일 ${when.weekday}요일${when.holidayName || ""}, ${hourWord(when.hour)} 도착, 머무는 시간 ${when.stayUsed}시간, ${labels.length ? `함께 가는 분 ${labels.join(", ")}` : "동행 선택 안 함"}`);
        $("condition-text").innerHTML = `<b>${when.month}.${when.dayNum} (${when.weekday})${holiday}</b>${dot}${stayText}${dot}${tail}`;
        $("day-kind").innerHTML = dayKindText(when);
    };

    const renderSummary = () => {
        const when = readWhen();
        renderCondition(when);
        const questions = renderMust();
        renderSources(when);
        planHead(when);
        planPlaces();
        planCall(questions);
        renderApplied();
        if (!when) {
            planMessage("날짜를 고르면 작년 같은 조건의 기록과 비교해 드려요.");
            $("flow").hidden = true;
            $("stay").hidden = true;
            return;
        }
        const season = SEASONS[when.month];
        $("plan-basis").textContent = `작년 ${season} ${when.dayType} 기록과 비교했어요.`;
        const rows = dayRows(season, when.dayType);
        const pick = rows.find((s) => s.hour === when.hour);
        const days = pick ? pick.n : 0;
        if (!pick || days < MIN_DAYS) {
            planMessage(`이 조건은 작년 기록이 ${days}일뿐이라 비교하지 않았어요. 아래 시설 안내와 지도는 그대로 볼 수 있어요.`);
            $("flow").hidden = true;
            $("stay").hidden = true;
            return;
        }
        const timeRow = $("plan-time");
        timeRow.innerHTML = planTime(when, rows, pick);
        timeRow.classList.toggle("is-new", Boolean(state.applied && state.applied.to === when.hour));
        $("flow").hidden = false;
        renderFlow(when, season, rows, pick);
        renderStay(when, season, rows);
    };

    /* 지도 */
    const visiblePins = () => parkMap.pins.filter((p) => state.filters.has(p.kind));

    const placeShortName = (pin) => pin.label.split("(")[0].replace(/\s*(공원)?안내센터$/, "").trim();

    // 화장실은 «1·2·3» 번호가 아무 뜻이 없어서, 지도에 이름 붙은 가장 가까운 장소로 부른다(같은 장소면 북쪽/남쪽으로 가른다)
    const buildToiletNames = () => {
        const places = parkMap.pins.filter((p) => p.kind !== "toilet");
        const toilets = parkMap.pins.filter((p) => p.kind === "toilet").map((t) => {
            const near = places.reduce((a, b) =>
                (Math.hypot(b.x - t.x, b.y - t.y) < Math.hypot(a.x - t.x, a.y - t.y) ? b : a));
            return { pin: t, base: `${placeShortName(near)} 근처 화장실` };
        });
        toiletNames = new Map();
        toilets.forEach(({ pin, base }) => {
            const same = toilets.filter((o) => o.base === base);
            if (same.length < 2) {
                toiletNames.set(pin.id, base);
                return;
            }
            const northmost = same.reduce((a, b) => (b.pin.y < a.pin.y ? b : a)).pin;
            toiletNames.set(pin.id, `${base} (${same.length === 2 ? (pin === northmost ? "북쪽" : "남쪽")
                : `${same.filter((o) => o.pin.y < pin.y).length + 1}번째`})`);
        });
    };

    const pinName = (pin) => (pin.kind === "toilet" ? toiletNames.get(pin.id) : pin.label);

    const labelAnchor = (pin) => {
        if (pin.x < 300) {
            return { x: pin.x - 30, anchor: "start" };
        }
        if (pin.x > 700) {
            return { x: pin.x + 30, anchor: "end" };
        }
        return { x: pin.x, anchor: "middle" };
    };

    const pinSvg = (pin, interactive, chosen) => {
        const r = chosen ? 46 : 38;
        const glyph = GLYPH[pin.kind];
        const attrs = interactive
            ? ` role="button" tabindex="0" aria-label="${esc(pinName(pin))}" aria-pressed="${chosen}" data-place="${esc(pin.id)}"` : "";
        const hit = interactive ? `<circle class="map-pin__hit" cx="${pin.x}" cy="${pin.y}" r="76"/>` : "";
        return `<g class="map-pin map-pin--${pin.kind}${chosen ? " map-pin--chosen" : ""}"${attrs}>
            <circle class="map-pin__dot" cx="${pin.x}" cy="${pin.y}" r="${r}"/>
            <text class="map-pin__glyph" x="${pin.x}" y="${pin.y + 10}" text-anchor="middle">${glyph}</text>${hit}</g>`;
    };

    const labelSvg = (pin) => {
        if (pin.kind === "toilet") {
            return "";
        }
        const pos = labelAnchor(pin);
        const text = SHORT_NAME[pin.id] || pin.label.split("(")[0];
        return `<text class="map-label" x="${pos.x}" y="${pin.y - 58}" text-anchor="${pos.anchor}">${esc(text)}</text>`;
    };

    const mapSvg = (interactive) => {
        const pins = visiblePins();
        const parts = [`<svg class="park-map" viewBox="-65 -85 1130 1100" preserveAspectRatio="${interactive ? "xMidYMid meet" : "xMidYMid slice"}"
            ${interactive ? "role=\"group\" aria-label=\"올림픽공원 편의시설 참고 지도. 아래 목록에서도 같은 장소를 고를 수 있어요.\"" : "aria-hidden=\"true\""}>`,
        `<path class="park-map__ground" d="${parkMap.park}"/>`,
        ...parkMap.water.map((d) => `<path class="park-map__water" d="${d}"/>`)];
        pins.forEach((p) => parts.push(pinSvg(p, interactive, interactive && p.id === state.place)));
        pins.forEach((p) => parts.push(labelSvg(p)));
        parts.push("</svg>");
        return parts.join("");
    };

    const renderThumb = () => {
        $("map-thumb").innerHTML = mapSvg(false);
    };

    const renderFrom = () => {
        const box = $("from-must");
        if (!state.from) {
            box.hidden = true;
            box.innerHTML = "";
            return;
        }
        const labels = FILTERS.filter((f) => state.filters.has(f.kind)).map((f) => f.label).join("·");
        box.hidden = false;
        box.innerHTML = `<strong>${esc(state.from)}</strong>에서 왔어요 · ${esc(labels)} ${visiblePins().length}곳만 보여드려요 · <button id="from-reset" type="button">모든 시설 보기</button>`;
    };

    // 시트 안 «여기에 물어볼 것» — 고른 «꼭 필요한 것»과 이 장소가 겹칠 때만
    const askHere = (pin) => {
        let q = null;
        const what = rentalWhat();
        if (pin.kind === "rental" && what) {
            q = `오늘 ${what}를 빌릴 수 있나요?`;
        } else if (pin.kind === "toilet" && state.must.has("restroom")) {
            q = "이 화장실을 휠체어로 쓸 수 있나요?";
        } else if (pin.kind === "nursing" && state.must.has("nursing")) {
            q = "수유실을 지금 쓸 수 있나요?";
        }
        return q ? `<div class="ask-here"><strong>여기에 물어볼 것</strong>«${esc(q)}» · ${PARK_PHONE}</div>` : "";
    };

    const renderFilters = () => {
        $("map-filters").innerHTML = FILTERS.map((f) =>
            `<button class="filter" type="button" data-kind="${f.kind}" aria-pressed="${state.filters.has(f.kind)}">
                <span class="filter__face"><span class="filter__check">${CHECK_ICON}</span>${f.label}</span></button>`).join("");
        $("map-key").innerHTML = FILTERS.filter((f) => state.filters.has(f.kind)).map((f) =>
            `<li><span class="key-dot key-dot--${f.kind}">${GLYPH[f.kind]}</span>${f.label}</li>`).join("");
        requestAnimationFrame(() => state.refreshScrollEdges?.());
    };

    const naverUrl = (pin) => `https://map.naver.com/p/search/${encodeURIComponent(`올림픽공원 ${pin.label}`)}`;

    const renderPanel = () => {
        const panel = $("place-panel");
        const pin = visiblePins().find((p) => p.id === state.place);
        if (!pin) {
            panel.innerHTML = "<div class=\"handle\" aria-hidden=\"true\"></div><p class=\"empty-note\">표시할 시설을 위에서 골라 주세요.</p>";
            return;
        }
        const info = PLACE_INFO[pin.id] || TOILET_INFO;
        const rows = info.rows.map(([a, b, ic]) => `<div class="place-row">${icon(ic)}<div><b>${esc(a)}</b><p>${esc(b)}</p></div></div>`).join("");
        const naver = pin.kind === "toilet" ? ""
            : `<a href="${naverUrl(pin)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(pin.label)} 네이버 지도에서 보기, 새 창">${icon("map")}네이버 지도</a>`;
        panel.innerHTML = `<div class="handle" aria-hidden="true"></div>
            <p class="place-category">선택한 장소 · ${esc(KIND_LABEL[pin.kind])}</p>
            <h2 id="place-name" tabindex="-1">${esc(pinName(pin))}</h2>
            ${pin.detail ? `<p class="place-sub">${esc(pin.detail)}</p>` : ""}
            ${askHere(pin)}
            ${rows}
            <div class="place-actions"><a href="tel:024101114">${icon("phone")}전화하기</a>${naver}</div>
            <p class="route-note">길찾기는 네이버 지도에서 확인해 주세요.<br>휠체어로 이동 가능한 경로인지는 별도 확인이 필요해요.</p>`;
    };

    const renderList = () => {
        const pins = visiblePins();
        $("place-list").innerHTML = pins.length ? pins.map((p) => `<li><button class="other-row" type="button" data-place="${esc(p.id)}" aria-current="${p.id === state.place}">
            <span class="other-row__badge other-row__badge--${p.kind}" aria-hidden="true">${GLYPH[p.kind]}</span>
            <div><h3>${esc(pinName(p))}</h3><p>${esc(p.detail || KIND_LABEL[p.kind])}</p></div>${icon("right").replace("class=\"icon\"", "class=\"icon arrow\"")}</button></li>`).join("")
            : "<li class=\"empty-note\">표시할 시설이 없어요. 위에서 시설을 골라 주세요.</li>";
    };

    const ensurePlace = () => {
        const pins = visiblePins();
        if (!pins.some((p) => p.id === state.place)) {
            state.place = pins.length ? pins[0].id : null;
        }
    };

    const renderMap = () => {
        ensurePlace();
        renderFrom();
        renderFilters();
        $("big-map").innerHTML = mapSvg(true);
        renderPanel();
        renderList();
        renderThumb();
    };

    const selectPlace = (id, focus) => {
        state.place = id;
        renderMap();
        if (focus) {
            const name = $("place-name");
            $("place-panel").scrollIntoView({ block: "start" });
            if (name) {
                name.focus({ preventScroll: true });
            }
        }
    };

    /* 출처 */
    const renderSources = (when) => {
        const q = stats.quality;
        const ratio = Object.entries(stats.visitorColumnCheck).map(([k, v]) => `${esc(k)} ${fmt(v)}건`).join(", ");
        const web = access.sources.find((s) => s.id === "web");
        const api = access.sources.find((s) => s.id === "api");
        const year = stats.period[0].slice(0, 4);
        const holidayGap = when && !when.holidayKnown
            ? `<p><strong>공휴일 정보 없음</strong><br>고른 날짜는 공휴일 자료 범위(${esc(holidays.years.join("·") || "없음")}년) 밖이라 주말만 구분했어요. 공휴일이면 평일 기록이 섞일 수 있어요.</p>` : "";
        $("sources-body").innerHTML = `
            <p><strong>시간대별 차량 기록</strong><br>${esc(stats.source)}. ${year}년 기록 중 주차대수만 썼어요. 같은 계절·같은 날 종류(평일 또는 주말·휴일)의 시간대별 중앙값을 비교해요.</p>
            <p><strong>제외한 날</strong><br>수집 이상이나 집계 변경이 의심되는 ${q.flaggedDays}일을 뺐어요. 관측 20시간 미만 ${q.byReason.incomplete}일, 값이 날마다 줄어드는 수집 장애 의심 ${q.byReason.decay_run}일, 집계 범위가 바뀐 것으로 보이는 ${esc(q.levelShiftMonths.join("·"))} ${q.byReason.level_shift}일이에요(두 가지 이상에 걸린 날은 겹쳐 세어져요).</p>
            <p><strong>방문객 수를 쓰지 않은 이유</strong><br>원자료의 방문객 수가 주차대수에 고정 배율을 곱한 값이었어요(${ratio}).</p>
            <p><strong>편의시설</strong><br>한국관광공사 무장애 여행 정보(공공데이터 API)와 관광공사 누리집을 대조했어요. 웹 수정 ${esc(web.updatedAt)}, 대조 ${esc(api.checkedAt)}. 출처마다 다른 수량·표현은 각각 보여 드려요.</p>
            <p><strong>시설 지도</strong><br>© OpenStreetMap contributors. 휠체어 화장실은 휠체어 이용 가능으로 등록된 지점이며 현장 검증 전이에요. 경사도·노면·연속된 무장애 동선은 확인되지 않았어요.</p>
            <p><strong>공휴일</strong><br>한국천문연구원 특일 정보${holidays.years.length ? ` (${esc(holidays.years.join("·"))}년)` : ""}.</p>
            ${holidayGap}
            <p><strong>실시간 주차 현황</strong><br>한국체육산업개발 실시간 주차현황의 동2·남2·북2 합계예요. 불러온 시각을 함께 보여 드려요.</p>`;
        $("map-sources-body").innerHTML = `<p>대여·수유실: 한국관광공사 무장애 여행 정보(공공데이터 API)·관광공사 누리집(누리집 수정 ${esc(web.updatedAt)}, 대조 ${esc(api.checkedAt)}). 지도·시설 좌표: © OpenStreetMap contributors.</p>
            <p>휠체어 화장실은 오픈스트리트맵에 ‘휠체어 이용 가능’으로 등록된 지점이며 현장 검증 전이에요. 공식 정보에는 정확한 위치가 없어요. 지도에 표시한 주차장은 남2문 주차장이에요.</p>
            <p>경사도·노면 정보와 연속된 무장애 동선은 제공하지 않아요. 외부 지도를 열어도 휠체어로 갈 수 있는 경로가 보장되지는 않아요.</p>`;
    };

    /* 실시간 */
    const clockText = () => new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });

    const loadLive = async () => {
        const body = $("live-body");
        body.innerHTML = "<p class=\"source-line\">불러오는 중…</p>";
        try {
            const res = await fetch(LIVE_URL, { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            const value = Number(data[0].parking_sum);
            if (!Number.isFinite(value)) {
                throw new Error("parking_sum 값이 숫자가 아니에요");
            }
            body.innerHTML = `<p class="live-number">${fmt(value)}<small>대</small><span>주차 중</span></p>
                <p class="source-line">${clockText()} 조회 · 동2·남2·북2 합계 · 한국체육산업개발</p>`;
        } catch (err) {
            console.error("[loadLive] 실시간 주차 조회 실패", err);
            body.innerHTML = `<p class="source-line">지금은 불러오지 못했어요</p>
                <button class="retry" type="button" id="live-retry">다시 불러오기</button>`;
        }
    };

    const goToMap = (kinds, place, from) => {
        state.filters = new Set(kinds);
        state.place = place || null;
        state.from = from;
        if (location.hash === "#map") {
            showView("map", true);
        } else {
            location.hash = "#map";
        }
    };

    const applyHour = (hour) => {
        const select = $("visit-hour");
        const prev = Number(select.value);
        select.value = String(hour);
        state.applied = { from: prev, to: hour };
        renderSummary();
        $("applied-undo")?.focus();
    };

    const undoApplied = () => {
        if (!state.applied) {
            return;
        }
        $("visit-hour").value = String(state.applied.from);
        state.applied = null;
        renderSummary();
        $("plan-title").setAttribute("tabindex", "-1");
        $("plan-title").focus();
    };

    /* 화면 전환 */
    const viewFromHash = () => (location.hash === "#map" ? "map" : "summary");

    /* 요약 화면에선 조건 입력을 카드 안에서 펼친다 — 같은 입력 묶음을 옮겨 쓰므로 지도 화면과 이벤트가 그대로 공유된다 */
    const openInlineEdit = () => {
        $("plan-cond").appendChild(document.querySelector(".condition__body"));
        $("plan-cond").hidden = false;
        $("cond-done-wrap").hidden = false;
        $("plan-edit").innerHTML = "접기<svg class=\"icon\" aria-hidden=\"true\"><use href=\"#i-down\"/></svg>";
        $("plan-edit").setAttribute("aria-expanded", "true");
        state.inlineEdit = true;
        requestAnimationFrame(() => state.refreshScrollEdges?.());
    };

    const closeInlineEdit = (backToCard) => {
        if (!state.inlineEdit) {
            return;
        }
        document.querySelector(".condition").appendChild(document.querySelector(".condition__body"));
        $("plan-cond").hidden = true;
        $("cond-done-wrap").hidden = true;
        $("plan-edit").textContent = "조건 바꾸기";
        $("plan-edit").setAttribute("aria-expanded", "false");
        state.inlineEdit = false;
        if (backToCard) {
            $("plan").scrollIntoView({ behavior: "smooth", block: "start" });
            $("plan-edit").focus({ preventScroll: true });
        }
    };

    const showView = (name, scrollTop) => {
        if (name !== "summary") {
            closeInlineEdit(false);
        }
        requestAnimationFrame(() => state.refreshScrollEdges?.());
        state.view = name;
        document.body.dataset.view = name;
        $("view-summary").hidden = name !== "summary";
        $("view-map").hidden = name !== "map";
        const setCurrent = (el, on) => (on ? el.setAttribute("aria-current", "page") : el.removeAttribute("aria-current"));
        setCurrent($("tab-summary"), name === "summary");
        setCurrent($("tab-map"), name === "map");
        const toggle = $("bottom-toggle");
        toggle.href = name === "map" ? "#summary" : "#map";
        toggle.querySelector("span").textContent = name === "map" ? "방문 요약" : "시설 지도";
        toggle.querySelector("use").setAttribute("href", name === "map" ? "#i-calendar" : "#i-map");
        if (name === "map") {
            renderMap();
        }
        if (scrollTop) {
            window.scrollTo(0, 0);
        }
    };

    const toggleSet = (set, value) => {
        if (set.has(value)) {
            set.delete(value);
        } else {
            set.add(value);
        }
    };

    const syncFiltersToWho = () => {
        const kinds = [...state.who].flatMap((w) => DEFAULT_FILTERS[w]);
        state.filters = new Set(kinds.length ? kinds : ["rental"]);
    };

    // PC 에선 세로 휠·마우스 끌기로도 옆으로 넘길 수 있게 한다 — 폰은 손가락으로 밀면 되지만
    //   PC 는 스크롤바를 숨겨 놔서 넘길 방법이 없었다(Darren M:cze2)
    const enableHScroll = (el) => {
        const updateEdges = () => {
            const max = el.scrollWidth - el.clientWidth;
            el.classList.toggle("has-more-start", el.scrollLeft > 2);
            el.classList.toggle("has-more-end", el.scrollLeft < max - 2);
        };
        el.addEventListener("scroll", updateEdges, { passive: true });
        window.addEventListener("resize", updateEdges);
        el.addEventListener("wheel", (e) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
                return;
            }
            const max = el.scrollWidth - el.clientWidth;
            const atEdge = (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1);
            if (max <= 0 || atEdge) {
                return;
            }
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        }, { passive: false });
        let drag = null;
        el.addEventListener("pointerdown", (e) => {
            if (e.pointerType !== "mouse" || e.button !== 0) {
                return;
            }
            drag = { x: e.clientX, left: el.scrollLeft, moved: false };
        });
        el.addEventListener("pointermove", (e) => {
            if (!drag) {
                return;
            }
            const dx = e.clientX - drag.x;
            if (!drag.moved && Math.abs(dx) > 5) {
                drag.moved = true;
                el.classList.add("is-dragging");
            }
            if (drag.moved) {
                el.scrollLeft = drag.left - dx;
            }
        });
        const endDrag = () => {
            if (drag?.moved) {
                // 끌기가 끝난 직후의 클릭은 칩을 누른 것이 아니다
                el.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                }, { capture: true, once: true });
            }
            drag = null;
            el.classList.remove("is-dragging");
        };
        el.addEventListener("pointerup", endDrag);
        el.addEventListener("pointerleave", () => {
            if (drag && !drag.moved) {
                drag = null;
            }
        });
        return updateEdges;
    };

    const bind = () => {
        const edgeUpdaters = [...document.querySelectorAll(".h-scroll")].map(enableHScroll);
        state.refreshScrollEdges = () => edgeUpdaters.forEach((fn) => fn());
        requestAnimationFrame(state.refreshScrollEdges);
        // 접힌 상자 안에선 폭이 0 이라 가장자리를 못 잰다 — 펼칠 때 다시 잰다
        document.querySelector(".condition").addEventListener("toggle", () => state.refreshScrollEdges());
        document.querySelectorAll(".condition__picks .pick").forEach((btn) => btn.addEventListener("click", () => {
            toggleSet(state.who, btn.dataset.who);
            btn.setAttribute("aria-pressed", String(state.who.has(btn.dataset.who)));
            resetMustToWho();
            syncFiltersToWho();
            state.applied = null;
            renderSummary();
            renderMap();
        }));
        $("must-picks").addEventListener("click", (e) => {
            const btn = e.target.closest(".must-pick");
            if (btn) {
                toggleSet(state.must, btn.dataset.must);
                renderSummary();
            }
        });
        ["visit-date", "visit-hour", "visit-stay"].forEach((id) => $(id).addEventListener("change", () => {
            state.applied = null;
            renderSummary();
        }));
        $("view-summary").addEventListener("click", (e) => {
            const apply = e.target.closest("[data-apply-hour]");
            if (apply) {
                applyHour(Number(apply.dataset.applyHour));
                return;
            }
            if (e.target.closest("#applied-undo")) {
                undoApplied();
                return;
            }
            const go = e.target.closest("[data-go-kind]");
            if (go) {
                goToMap(go.dataset.goKind.split(" "), go.dataset.goPlace, go.dataset.goFrom);
                return;
            }
            const jump = e.target.closest("[data-scroll]");
            if (jump) {
                $(jump.dataset.scroll).scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
        $("plan-edit").addEventListener("click", () => {
            if (state.inlineEdit) {
                closeInlineEdit(false);
            } else {
                openInlineEdit();
            }
        });
        $("cond-done").addEventListener("click", () => closeInlineEdit(true));
        $("visit-date").addEventListener("click", () => {
            try {
                $("visit-date").showPicker?.();
            } catch (err) {
                console.error("[showPicker] 실패", err);
            }
        });
        $("map-filters").addEventListener("click", (e) => {
            const btn = e.target.closest(".filter");
            if (btn) {
                toggleSet(state.filters, btn.dataset.kind);
                state.from = null;
                renderMap();
            }
        });
        const pickPlace = (e) => {
            const target = e.target.closest("[data-place]");
            if (target) {
                selectPlace(target.dataset.place, true);
            }
        };
        $("view-map").addEventListener("click", (e) => {
            if (e.target.closest("#from-reset")) {
                state.from = null;
                syncFiltersToWho();
                renderMap();
                return;
            }
            pickPlace(e);
        });
        $("big-map").addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pickPlace(e);
            }
        });
        $("live-body").addEventListener("click", (e) => {
            if (e.target.closest("#live-retry")) {
                loadLive();
            }
        });
        window.addEventListener("hashchange", () => showView(viewFromHash(), true));
    };

    const fillWhen = () => {
        for (let h = OPEN.first; h <= OPEN.last; h += 1) {
            const opt = document.createElement("option");
            opt.value = String(h);
            opt.textContent = hourWord(h);
            opt.selected = h === 10;
            $("visit-hour").append(opt);
        }
        STAY_OPTIONS.forEach((n) => {
            const opt = document.createElement("option");
            opt.value = String(n);
            opt.textContent = `${n}시간`;
            opt.selected = n === STAY_DEFAULT;
            $("visit-stay").append(opt);
        });
        const now = new Date(Date.now() + 9 * 3600 * 1000);
        const daysToSat = (6 - now.getUTCDay() + 7) % 7 || 7;
        $("visit-date").value = new Date(now.getTime() + daysToSat * 86400000).toISOString().slice(0, 10);
    };

    const loadHolidays = async () => {
        try {
            const res = await fetch(`${DATA_BASE}holidays.json`);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            holidays = { years: data.years, map: new Map(data.holidays.map((h) => [h.date, h.name])), loaded: true };
        } catch (err) {
            console.error("[loadHolidays] 공휴일 자료를 불러오지 못했어요", err);
        }
    };

    const loadJson = (file) => fetch(`${DATA_BASE}${file}`).then((r) => {
        if (!r.ok) {
            throw new Error(`${file} HTTP ${r.status}`);
        }
        return r.json();
    });

    const init = async () => {
        fillWhen();
        [stats, access, parkMap] = await Promise.all(
            ["parking_2025_stats.json", "accessibility.json", "park_map.json"].map(loadJson));
        buildToiletNames();
        await loadHolidays();
        renderMustPicks();
        bind();
        renderSummary();
        renderMap();
        showView(viewFromHash(), false);
        loadLive();
    };

    init().catch((err) => {
        console.error("[init] 데이터 불러오기 실패", err);
        $("plan-title").textContent = "데이터를 불러오지 못했어요";
        planMessage("잠시 뒤 다시 열어 주세요.");
    });
})();
