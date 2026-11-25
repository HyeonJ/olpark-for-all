(() => {
    "use strict";

    const DATA_BASE = new URL("data/", document.currentScript.src).href;
    const LIVE_URL = "https://www.ksponco.or.kr/online/main/parkingorsApi.do?apiKey=PARKING21803504";
    const PARK_PHONE = "02-410-1114";
    const SEASONS = { 12: "겨울", 1: "겨울", 2: "겨울", 3: "봄", 4: "봄", 5: "봄",
        6: "여름", 7: "여름", 8: "여름", 9: "가을", 10: "가을", 11: "가을" };
    const OPEN = { first: 6, last: 21 };
    const VISIT = { first: 9, last: 18 };
    const MIN_DAYS = 8;
    const NEAR_PEAK = 0.9;
    const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
    const WHO_ORDER = ["wheelchair", "stroller", "senior", "visual"];
    const WHO_LABEL = { wheelchair: "휠체어", stroller: "유모차·아이", senior: "어르신", visual: "시각장애" };
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
    const FACT_ICON = {
        parking: "parking", entrance: "door", wheelchair: "bag", stroller: "bag",
        restroom: "pin", ramp: "ramp", nursing: "drop", braille: "braille",
    };
    const MISMATCH_LABEL = { parking: "주차", stroller: "유모차", nursing: "수유실", braille: "점자 안내" };
    const PLACE_INFO = {
        "info-peace": { rows: [
            ["휠체어 대여는 전화로 확인해 주세요", "수량과 당일 대여 가능 여부는 공개되지 않았어요."],
            ["유모차 대여 4대", "한국관광공사 API 기준이에요. 공식 웹은 센터별 수량 없이 ‘4대’로만 안내해요."],
            ["수유실", "안내센터 안에 있어요."],
        ] },
        "info-east1": { rows: [
            ["휠체어 대여는 전화로 확인해 주세요", "만남의광장 안이에요. 수량과 당일 대여 가능 여부는 공개되지 않았어요."],
            ["유모차 대여 3대", "한국관광공사 API 기준이에요. 공식 웹에는 이 센터의 수량이 없어요."],
            ["수유실", "안내센터 안에 있어요."],
        ] },
        museum: { rows: [["1층 수유실", "한성백제박물관 안이에요."]] },
        "p-south2": { rows: [["남2문 주차장", "실시간 주차 현황은 공원 전체 합계만 공개돼요."]] },
        hall: { rows: [["점자 안내", "이 장소가 점자 안내 목록에 있는지는 확인되지 않았어요. 공원 안내로 문의해 주세요."]] },
        arthall: { rows: [["점자 안내", "점자 안내 목록에 있는 곳이에요. 출처마다 ‘점자안내판’, ‘점자 홍보물 수령장소’로 달라서 전화로 확인해 주세요."]] },
        kspo: { rows: [["공연이 있는 날", "주변이 붐빌 수 있어요. 일정은 공연 일정 페이지에서 확인해 주세요."]] },
    };
    const TOILET_INFO = { rows: [["현장 확인 전 자료예요", "오픈스트리트맵에 ‘휠체어 이용 가능’으로 등록된 곳이에요. 정확한 이용 가능 여부는 현장에서 확인해 주세요."]] };

    const $ = (id) => document.getElementById(id);
    const state = { who: new Set(["wheelchair"]), filters: new Set(DEFAULT_FILTERS.wheelchair), place: null, view: "summary" };
    let stats;
    let access;
    let parkMap;
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
            hour: Number($("visit-hour").value),
        };
    };

    const dayRows = (season, dayType) => stats.stats
        .filter((s) => s.season === season && s.dayType === dayType && s.hour >= OPEN.first && s.hour <= OPEN.last)
        .sort((a, b) => a.hour - b.hour);

    const compareWord = (hour, peakHour) => {
        if (hour < 12 && peakHour >= 12) {
            return "오후";
        }
        return hourWord(peakHour);
    };

    const buildAnswer = (when, season, rows, pick) => {
        const peak = rows.reduce((a, b) => (b.median > a.median ? b : a));
        const ratio = pick.median / peak.median;
        const pct = Math.round(ratio * 100);
        const base = `작년 ${season} ${when.dayType} 기준이에요.`;
        if (pick.hour === peak.hour || ratio >= NEAR_PEAK) {
            const visitRows = rows.filter((s) => s.hour >= VISIT.first && s.hour <= VISIT.last);
            const quiet = visitRows.reduce((a, b) => (b.median < a.median ? b : a));
            return {
                title: `${hourWord(when.hour)}는<br><strong>하루 중 차가 가장 많았던 때예요</strong>`,
                sub: `${base}<br>${VISIT.first}~${VISIT.last}시 중에는 ${quiet.hour}시가 가장 한산했어요.`,
                peak,
            };
        }
        return {
            title: `${hourWord(when.hour)}는<br><strong>${compareWord(when.hour, peak.hour)}보다 덜 붐볐어요</strong>`,
            sub: `${base}<br>${when.hour}시 주차대수는 ${peak.hour}시의 약 ${pct}%였어요.`,
            peak,
        };
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

    const renderFlow = (when, season, rows, pick, answer) => {
        const t = stats.levelThresholds.high_min;
        const diff = answer.peak.median - pick.median;
        const comparison = pick.hour === answer.peak.hour
            ? "<strong>가장 많았던 시간이에요</strong>"
            : `${answer.peak.hour}시보다 <strong>${fmt(diff)}대 적었어요</strong>`;
        const year = stats.period[0].slice(0, 4);
        $("flow").innerHTML = `<div class="section-head"><h2 id="flow-title">${when.hour}시 주차대수</h2></div>
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

    const rentalCopy = () => {
        const wheel = state.who.has("wheelchair") || state.who.has("senior");
        const stroller = state.who.has("stroller");
        if (wheel && stroller) {
            return { title: "휠체어·유모차 대여는 전화로 확인해 주세요",
                text: "대여 장소는 2곳이에요.<br>유모차는 안내 자료마다 수량이 달라요(API 4대+3대, 공식 웹 4대). 수량은 전화로 확인해 주세요." };
        }
        if (stroller) {
            return { title: "유모차 대여는 전화로 확인해 주세요",
                text: "대여 장소는 2곳이에요.<br>안내 자료마다 수량이 달라요(API 4대+3대, 공식 웹 4대). 수량은 전화로 확인해 주세요." };
        }
        if (wheel) {
            return { title: "휠체어 대여는 전화로 확인해 주세요",
                text: "대여 장소는 2곳이에요.<br>당일 빌릴 수 있는지는 미리 확인이 필요해요." };
        }
        return null;
    };

    const renderRental = () => {
        const copy = rentalCopy();
        const box = $("rental-call");
        box.hidden = !copy;
        $("bottom-call-label").textContent = copy ? "대여 문의 전화하기" : "공원 안내 전화하기";
        if (!copy) {
            box.innerHTML = "";
            return;
        }
        box.innerHTML = `<div class="rental-call__head">${icon("bag")}<div><h2 id="rental-title">${copy.title}</h2><p>${copy.text}</p></div></div>
            <a class="call-inline" href="tel:024101114">${icon("phone")}공원 안내 전화하기</a>`;
        box.setAttribute("aria-labelledby", "rental-title");
    };

    const factText = (it) => {
        if (it.key === "restroom") {
            return { title: "휠체어 이용 가능으로 등록된 화장실",
                text: "오픈스트리트맵 기준이고 현장 확인 전이에요.<br>공식 자료에는 정확한 위치가 없어요." };
        }
        const note = it.note ? `<br>${esc(it.note)}` : "";
        return { title: esc(it.label), text: `${esc(it.api)}${note}` };
    };

    const mismatchTitle = (items) => {
        const names = items.map((it) => MISMATCH_LABEL[it.key] || it.label);
        const onlyCount = items.every((it) => it.key === "parking" || it.key === "stroller");
        return `${names.join("·")} ${onlyCount ? "수량은" : "정보는"} 확인이 필요해요`;
    };

    const renderFacts = () => {
        const items = access.items.filter((it) => state.who.size === 0 || it.for.some((f) => state.who.has(f)));
        const plain = items.filter((it) => it.status !== "differs");
        const differs = items.filter((it) => it.status === "differs");
        $("facts").innerHTML = plain.length ? plain.map((it) => {
            const t = factText(it);
            const link = it.key === "wheelchair" ? `<a class="fact__link" href="#map">지도에서 위치 보기${icon("right")}</a>` : "";
            return `<li class="fact"><div class="fact__icon">${icon(FACT_ICON[it.key] || "info")}</div>
                <div><h3>${t.title}</h3><p>${t.text}</p>${link}</div></li>`;
        }).join("") : "<li class=\"empty-note\">선택한 동행에 맞는 안내가 아직 없어요.</li>";
        const box = $("mismatch");
        box.hidden = differs.length === 0;
        if (!differs.length) {
            box.innerHTML = "";
            return;
        }
        const web = access.sources.find((s) => s.id === "web");
        const api = access.sources.find((s) => s.id === "api");
        const entries = differs.map((it) => `<p><strong>${esc(it.label)}</strong>
            <span class="versus"><span><b>한국관광공사 API</b>${esc(it.api)}</span><span><b>공식 웹</b>${esc(it.web)}</span></span>
            ${it.note ? `<span class="mismatch-note">${esc(it.note)}</span>` : ""}</p>`).join("");
        box.innerHTML = `<summary class="mismatch__summary">${icon("info")}${esc(mismatchTitle(differs))}${icon("down").replace("class=\"icon\"", "class=\"icon arrow\"")}</summary>
            <div class="detail-body">${entries}
            <p>시설 정보 대조 ${esc(api.checkedAt)} · 웹 수정 ${esc(web.updatedAt)}</p>
            <a class="call-inline" href="tel:024101114">${icon("phone")}공원 안내 전화 문의</a></div>`;
    };

    const setHero = (title, sub, small) => {
        const el = $("hero-title");
        el.innerHTML = title;
        el.classList.toggle("hero__title--small", Boolean(small));
        $("hero-sub").innerHTML = sub;
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
        const who = labels.length > 1 ? `${labels[0]} 외 ${labels.length - 1}명` : labels[0] || "동행 선택 안 함";
        const holiday = when.holidayName ? ` ${esc(when.holidayName)}` : "";
        const tail = labels.length === 1 ? `${esc(who)} 동행` : esc(who);
        $("condition-text").innerHTML = `<b>${when.month}.${when.dayNum} (${when.weekday})${holiday}</b>${dot}${when.hour}시 도착${dot}${tail}`;
        $("day-kind").innerHTML = dayKindText(when);
    };

    const renderSummary = () => {
        const when = readWhen();
        renderCondition(when);
        renderRental();
        renderFacts();
        renderSources(when);
        if (!when) {
            setHero("날짜를 선택해 주세요", "", true);
            $("flow").hidden = true;
            return;
        }
        const season = SEASONS[when.month];
        const rows = dayRows(season, when.dayType);
        const pick = rows.find((s) => s.hour === when.hour);
        const days = pick ? pick.n : 0;
        if (!pick || days < MIN_DAYS) {
            setHero(`이 조건은 작년 기록이 ${days}일뿐이라<br>비교하지 않았어요`,
                `작년 ${season} ${when.dayType} 기준이에요. 아래 시설 안내와 지도는 그대로 볼 수 있어요.`, true);
            $("flow").hidden = true;
            return;
        }
        const answer = buildAnswer(when, season, rows, pick);
        setHero(answer.title, answer.sub, false);
        $("flow").hidden = false;
        renderFlow(when, season, rows, pick, answer);
    };

    /* 지도 */
    const visiblePins = () => parkMap.pins.filter((p) => state.filters.has(p.kind));

    const pinName = (pin) => {
        if (pin.kind !== "toilet") {
            return pin.label;
        }
        const index = parkMap.pins.filter((p) => p.kind === "toilet").findIndex((p) => p.id === pin.id) + 1;
        return `${pin.label} ${index}`;
    };

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
        $("map-thumb").innerHTML = `${mapSvg(false)}<span class="thumb-label">${icon("pin")}지도에서 보기</span>`;
    };

    const renderFilters = () => {
        $("map-filters").innerHTML = FILTERS.map((f) =>
            `<button class="filter" type="button" data-kind="${f.kind}" aria-pressed="${state.filters.has(f.kind)}">
                <span class="filter__face"><span class="filter__check">${CHECK_ICON}</span>${f.label}</span></button>`).join("");
        $("map-key").innerHTML = FILTERS.filter((f) => state.filters.has(f.kind)).map((f) =>
            `<li><span class="key-dot key-dot--${f.kind}">${GLYPH[f.kind]}</span>${f.label}</li>`).join("");
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
        const rows = info.rows.map(([a, b]) => `<div class="place-row">${icon("info")}<div><b>${esc(a)}</b><p>${esc(b)}</p></div></div>`).join("");
        const naver = pin.kind === "toilet" ? ""
            : `<a href="${naverUrl(pin)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(pin.label)} 네이버 지도에서 보기, 새 창">${icon("map")}네이버 지도</a>`;
        panel.innerHTML = `<div class="handle" aria-hidden="true"></div>
            <p class="place-category">선택한 장소 · ${esc(KIND_LABEL[pin.kind])}</p>
            <h2 id="place-name" tabindex="-1">${esc(pinName(pin))}</h2>
            ${pin.detail ? `<p class="place-sub">${esc(pin.detail)}</p>` : ""}
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
            <p><strong>편의시설</strong><br>한국관광공사 무장애 여행 정보 API와 공식 웹을 대조했어요. 웹 수정 ${esc(web.updatedAt)}, 대조 ${esc(api.checkedAt)}. 출처마다 다른 수량·표현은 각각 보여 드려요.</p>
            <p><strong>시설 지도</strong><br>© OpenStreetMap contributors. 휠체어 화장실은 휠체어 이용 가능으로 등록된 지점이며 현장 검증 전이에요. 경사도·노면·연속된 무장애 동선은 확인되지 않았어요.</p>
            <p><strong>공휴일</strong><br>한국천문연구원 특일 정보${holidays.years.length ? ` (${esc(holidays.years.join("·"))}년)` : ""}.</p>
            ${holidayGap}
            <p><strong>실시간 주차 현황</strong><br>한국체육산업개발 실시간 주차현황의 동2·남2·북2 합계예요. 불러온 시각을 함께 보여 드려요.</p>`;
        $("map-sources-body").innerHTML = `<p>대여·수유실: 한국관광공사 무장애 여행 정보 API·공식 웹(웹 수정 ${esc(web.updatedAt)}, 대조 ${esc(api.checkedAt)}). 지도·시설 좌표: © OpenStreetMap contributors.</p>
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

    /* 화면 전환 */
    const viewFromHash = () => (location.hash === "#map" ? "map" : "summary");

    const showView = (name, scrollTop) => {
        state.view = name;
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

    const bind = () => {
        document.querySelectorAll(".pick").forEach((btn) => btn.addEventListener("click", () => {
            toggleSet(state.who, btn.dataset.who);
            btn.setAttribute("aria-pressed", String(state.who.has(btn.dataset.who)));
            syncFiltersToWho();
            renderSummary();
            renderMap();
        }));
        ["visit-date", "visit-hour"].forEach((id) => $(id).addEventListener("change", renderSummary));
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
                renderMap();
            }
        });
        const pickPlace = (e) => {
            const target = e.target.closest("[data-place]");
            if (target) {
                selectPlace(target.dataset.place, true);
            }
        };
        $("view-map").addEventListener("click", pickPlace);
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
            opt.textContent = `${h}시`;
            opt.selected = h === 10;
            $("visit-hour").append(opt);
        }
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
        await loadHolidays();
        bind();
        renderSummary();
        renderMap();
        showView(viewFromHash(), false);
        loadLive();
    };

    init().catch((err) => {
        console.error("[init] 데이터 불러오기 실패", err);
        setHero("데이터를 불러오지 못했어요", "잠시 뒤 다시 열어 주세요.", true);
    });
})();
