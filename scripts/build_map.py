"""오픈스트리트맵(ODbL) 올림픽공원 윤곽·물·주요 지점 → 화면용 SVG 조각(data/park_map.json).

입력: raw/osm_park.json(Nominatim polygon) · raw/osm_water.json(Overpass natural=water)
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
W = 1000
LAT0 = 37.5190

PINS = [
    {"id": "info-peace", "label": "평화의광장 공원안내센터", "lat": 37.51906, "lon": 127.11614, "kind": "rental",
     "detail": "휠체어·유모차 대여 · 수유실"},
    {"id": "info-east1", "label": "동1문 안내센터(만남의광장)", "lat": 37.51702, "lon": 127.12949, "kind": "rental",
     "detail": "휠체어·유모차 대여 · 수유실"},
    {"id": "museum", "label": "한성백제박물관", "lat": 37.51545, "lon": 127.12072, "kind": "nursing", "detail": "1층 수유실"},
    {"id": "wc-1", "label": "휠체어 화장실", "lat": 37.5211, "lon": 127.12099, "kind": "toilet"},
    {"id": "wc-2", "label": "휠체어 화장실", "lat": 37.52026, "lon": 127.12577, "kind": "toilet"},
    {"id": "wc-3", "label": "휠체어 화장실", "lat": 37.51716, "lon": 127.12086, "kind": "toilet"},
    {"id": "wc-4", "label": "휠체어 화장실", "lat": 37.51809, "lon": 127.11679, "kind": "toilet"},
    {"id": "p-south2", "label": "남2문 주차장", "lat": 37.51491, "lon": 127.12422, "kind": "parking"},
    {"id": "hall", "label": "올림픽홀", "lat": 37.51473, "lon": 127.12759, "kind": "venue"},
    {"id": "arthall", "label": "우리금융아트홀", "lat": 37.51673, "lon": 127.12505, "kind": "venue"},
    {"id": "kspo", "label": "KSPO DOME", "lat": 37.51923, "lon": 127.12747, "kind": "venue"},
]


def build():
    park = json.loads((ROOT / "raw/osm_park.json").read_text())
    ring = park["coordinates"][0]
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    kx = math.cos(math.radians(LAT0))
    min_x, max_x = min(lons) * kx, max(lons) * kx
    min_y, max_y = min(lats), max(lats)
    scale = W / (max_x - min_x)
    h = round((max_y - min_y) * scale)

    def xy(lon, lat):
        return round((lon * kx - min_x) * scale, 1), round((max_y - lat) * scale, 1)

    def path(points):
        pts = [xy(lon, lat) for lon, lat in points]
        return "M" + "L".join(f"{x},{y}" for x, y in pts) + "Z"

    water = []
    for e in json.loads((ROOT / "raw/osm_water.json").read_text())["elements"]:
        if e["type"] == "way" and e.get("geometry"):
            water.append(path([(g["lon"], g["lat"]) for g in e["geometry"]]))
        for m in e.get("members", []):
            if m.get("role") == "outer" and m.get("geometry"):
                water.append(path([(g["lon"], g["lat"]) for g in m["geometry"]]))
    pins = []
    for p in PINS:
        x, y = xy(p["lon"], p["lat"])
        pins.append({**p, "x": x, "y": y})
    out = {"width": W, "height": h, "park": path(ring), "water": water, "pins": pins,
           "attribution": "© OpenStreetMap contributors (ODbL)"}
    (ROOT / "data/park_map.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"map {W}x{h} water={len(water)} pins={len(pins)}")


if __name__ == "__main__":
    build()
