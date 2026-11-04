// 都道府県リレー：出発の県から、となりの県だけを通って目的の県へ。make(seed, lv) が種から問題を作る。
(function (root) {
  "use strict";
  const M = typeof module !== "undefined" ? require("./map.js") : root.TD_MAP;
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 問題の種類：最短の県の数（出発から何回となりへ進むか）の範囲と、通れない県の数
  const LV = [
    { name: "近場", min: 3, max: 4, close: 0 },
    { name: "遠出", min: 5, max: 7, close: 0 },
    { name: "通行止め", min: 4, max: 6, close: 1 },
  ];
  const HARD = { name: "地図なし", min: 6, max: 9, close: 0 };
  const N = M.N, n = N.length;
  // 出発から全部の県への最短の数と、最短の道の数（closed の県は通れない）
  function bfs(s, closed = []) {
    const d = new Array(n).fill(-1), w = new Array(n).fill(0); d[s] = 0; w[s] = 1; const q = [s];
    while (q.length) { const a = q.shift(); for (const b of N[a]) { if (closed.includes(b)) continue; if (d[b] < 0) { d[b] = d[a] + 1; q.push(b); } if (d[b] === d[a] + 1) w[b] += w[a]; } }
    return { d, w };
  }
  // 最短の道を1本（a から b へ。となりの番号の小さい順にたどる）
  function path(a, b, closed = []) { const { d } = bfs(b, closed); if (d[a] < 0) return null; const p = [a]; let c = a; while (c !== b) { c = N[c].filter((x) => !closed.includes(x) && d[x] === d[c] - 1)[0]; p.push(c); } return p; }
  function make(seed, L) {
    const R = rng(seed);
    for (let t = 0; t < 2000; t++) {
      const s = Math.floor(R() * n), base = bfs(s), cand = [];
      for (let g = 0; g < n; g++) if (base.d[g] >= (L.close ? L.min - 1 : L.min) && base.d[g] <= L.max) cand.push(g);
      if (!cand.length) continue;
      const g = cand[Math.floor(R() * cand.length)];
      let closed = [];
      if (L.close) { // 最短の道の途中の県を1つ通れなくする。遠回りは1〜3県ぶん
        const mid = []; for (let c = 0; c < n; c++) if (c !== s && c !== g && base.d[c] > 0 && base.d[c] < base.d[g] && bfs(c).d[g] === base.d[g] - base.d[c]) mid.push(c);
        const c = mid[Math.floor(R() * mid.length)], r = bfs(s, [c]);
        if (c == null || r.d[g] < 0 || r.d[g] <= base.d[g] || r.d[g] > base.d[g] + 3 || r.d[g] < L.min || r.d[g] > L.max + 1) continue;
        closed = [c];
      }
      const r = bfs(s, closed);
      return { s, g, closed, d: r.d[g], ways: r.w[g], lv: L.name };
    }
    return null;
  }
  const B = { rng, seedOf, LV, HARD, M, bfs, path, make, name: (i) => M.P[i][0], short: (i) => M.P[i][0].replace(/(都|府|県)$/, "") };
  if (typeof module !== "undefined") module.exports = B; else root.TDR = B;
})(this);
