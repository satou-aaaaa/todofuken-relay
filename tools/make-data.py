#!/usr/bin/env python3
"""map.js を作る。使い方: python3 tools/make-data.py <japan.geojson>
japan.geojson は https://github.com/dataofjapan/land の japan.geojson（国土数値情報の行政区域から作られた都道府県の形）。
となりの県は、県境の点を共有しているかで機械的に決める（手で書かない）。地図は線を間引いて小さくする。
"""
import json, math, sys, collections

SRC = sys.argv[1]
# 橋・トンネルでつながる県（陸の県境は無いが、車や鉄道で行ける）。出典は README
LINKS = [("青森県", "北海道", "青函トンネル"), ("山口県", "福岡県", "関門トンネル"), ("兵庫県", "徳島県", "明石海峡大橋・大鳴門橋"), ("広島県", "愛媛県", "しまなみ海道"), ("岡山県", "香川県", "瀬戸大橋")]
SKIP = {"沖縄県"}  # 橋・トンネルでつながっていない
LON0, LAT0, K = 128.6, 45.6, 40.0
CX = math.cos(math.radians(37))

d = json.load(open(SRC, encoding="utf-8"))
feats = sorted(d["features"], key=lambda f: f["properties"]["id"])
pts = collections.defaultdict(set)
for f in feats:
    n = f["properties"]["nam_ja"]
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for p in polys:
        for ring in p:
            for x, y in ring:
                pts[(round(x, 4), round(y, 4))].add(n)
cnt = collections.Counter()
for s in pts.values():
    s = sorted(s)
    for i in range(len(s)):
        for j in range(i + 1, len(s)):
            cnt[(s[i], s[j])] += 1
# 点を3つ以上共有していれば県境で接する（1点だけの角は数えない）
adj = collections.defaultdict(set)
for (a, b), c in cnt.items():
    if c >= 3:
        adj[a].add(b); adj[b].add(a)

def proj(x, y):
    return ((x - LON0) * CX * K, (LAT0 - y) * K)

def dp(points, eps):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-9
    best, bi = 0, 0
    for i in range(1, len(points) - 1):
        x0, y0 = points[i]
        dist = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / L if L > 1e-9 else math.hypot(x0 - x1, y0 - y1)
        if dist > best:
            best, bi = dist, i
    if best > eps:
        return dp(points[: bi + 1], eps)[:-1] + dp(points[bi:], eps)
    return [points[0], points[-1]]

def area(r):
    return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2

P = []
for f in feats:
    n = f["properties"]["nam_ja"]
    if n in SKIP:
        continue
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    parts, big, tot, sx, sy = [], 0, 0, 0, 0
    for p in polys:
        if max(y for _, y in p[0]) < 30.5 or (n == "東京都" and max(y for _, y in p[0]) < 35.3):
            continue  # 遠い島（奄美・小笠原・伊豆諸島など）は描かない
        ring = [proj(x, y) for x, y in p[0]]
        a = area(ring)
        if a < 1.2:  # 小さな島は描かない
            continue
        s = dp(ring, 0.6)
        if len(s) < 4:
            continue
        parts.append("M" + "L".join(f"{round(x)},{round(y)}" for x, y in s[:-1]) + "Z")
        if a > big:
            big = a
            sx = sum(x for x, _ in ring) / len(ring); sy = sum(y for _, y in ring) / len(ring)
    P.append([n, "".join(parts).replace(".0,", ",").replace(".0L", "L").replace(".0Z", "Z"), round(sx, 1), round(sy, 1)])

names = [p[0] for p in P]
idx = {n: i for i, n in enumerate(names)}
N = [sorted(idx[b] for b in adj[a] if b in idx) for a in names]
L = []
for a, b, how in LINKS:
    i, j = idx[a], idx[b]
    if j not in N[i]:
        N[i].append(j); N[j].append(i)
    L.append([i, j, how])
N = [sorted(x) for x in N]
xs = [float(v) for p in P for v in p[1].replace("M", " ").replace("L", " ").replace("Z", " ").replace(",", " ").split()]
W = math.ceil(max(xs[0::2])) + 2; H = math.ceil(max(xs[1::2])) + 2
out = {"W": W, "H": H, "P": P, "N": N, "L": L}
with open("map.js", "w", encoding="utf-8") as fo:
    fo.write("// 都道府県の形ととなり。tools/make-data.py で作る（手で直さない）。形は dataofjapan/land（国土数値情報の行政区域から）を間引いたもの。\n")
    fo.write("(function(r){var D=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";if(typeof module!=='undefined')module.exports=D;else r.TD_MAP=D;})(this);\n")
print(len(P), "県", W, "x", H, "links", len(L))
