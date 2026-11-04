// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題は入れず、見本の道だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const M = require(path.join(__dirname, "..", "map.js"));
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const route = ["岩手県", "宮城県", "福島県", "群馬県", "長野県", "岐阜県", "滋賀県", "京都府"].map((n) => M.P.find((q) => q[0] === n));
  const land = M.P.map((q) => `<path d="${q[1]}" fill="${route.includes(q) ? "#f3c9b9" : "#f6f0e1"}" stroke="#8a8170" stroke-width="1.2"/>`).join("");
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 80px;background:#dbe8ef;color:#26323a;position:relative;overflow:hidden">
    <div style="font-size:34px;color:#9b3220;letter-spacing:.1em">だれでも同じ 1日3問・3分</div>
    <div style="font-size:96px;font-weight:900;margin-top:16px;letter-spacing:.04em">都道府県リレー</div>
    <div style="font-size:40px;margin-top:18px;line-height:1.5">となりの県だけで、<br>目的の県まで行ける？</div>
    <svg style="position:absolute;left:640px;top:20px" width="560" height="590" viewBox="0 0 ${M.W} ${M.H}">${land}
      <polyline points="${route.map((q) => q[2] + "," + q[3]).join(" ")}" fill="none" stroke="#d2492f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${route[0][2]}" cy="${route[0][3]}" r="9" fill="#2f8a5b" stroke="#fff" stroke-width="3"/><circle cx="${route[7][2]}" cy="${route[7][3]}" r="9" fill="#d2492f" stroke="#fff" stroke-width="3"/></svg>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
