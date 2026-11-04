// アプリのアイコン（icon-192.png・icon-512.png）を作る。日本地図の形に、県をつなぐ朱色の線。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const M = require(path.join(__dirname, "..", "map.js"));
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const route = ["岩手県", "宮城県", "福島県", "群馬県", "長野県", "岐阜県", "滋賀県", "京都府"].map((n) => M.P.find((p) => p[0] === n));
  const land = M.P.map((p) => `<path d="${p[1]}" fill="#f6f0e1" stroke="#8a8170" stroke-width="2"/>`).join("");
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#cfe1ea"/>
      <g transform="translate(8 10) scale(${84 / M.W})">${land}
      <polyline points="${route.map((q) => q[2] + "," + q[3]).join(" ")}" fill="none" stroke="#d2492f" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${route[0][2]}" cy="${route[0][3]}" r="16" fill="#2f8a5b" stroke="#fff" stroke-width="5"/><circle cx="${route[7][2]}" cy="${route[7][3]}" r="16" fill="#d2492f" stroke="#fff" stroke-width="5"/></g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
