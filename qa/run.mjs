// 都道府県リレーの検査。となりの県のデータ・問題の作り方（何千問）・3問の組み方・進む/戻る/ヒント・続きから・上級（地図なし）・県帳・記録・スマホ幅・PWA。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const T = createRequire(import.meta.url)(path.join(root, "gen.js"));
const M = T.M, idx = (n) => M.P.findIndex((p) => p[0] === n), adj = (a, b) => M.N[idx(a)].includes(idx(b));

// 1. となりの県のデータ（地理で確かめられる事実と合うか）
{
  check("県は46（沖縄県は橋・トンネルでつながらないので入れない）", M.P.length === 46 && idx("沖縄県") < 0 && idx("北海道") >= 0);
  check("となりは両方向（AがBのとなりならBもAのとなり）", M.N.every((ns, i) => ns.every((j) => M.N[j].includes(i) && j !== i)));
  const deg = (n) => M.N[idx(n)].length;
  check("となりの数：長野県は8（いちばん多い）・岐阜県と埼玉県は7", deg("長野県") === 8 && deg("岐阜県") === 7 && deg("埼玉県") === 7 && Math.max(...M.N.map((x) => x.length)) === 8);
  const yes = [["京都府", "三重県"], ["愛知県", "三重県"], ["埼玉県", "長野県"], ["福島県", "群馬県"], ["東京都", "千葉県"], ["鳥取県", "広島県"], ["岡山県", "香川県"], ["秋田県", "宮城県"], ["奈良県", "和歌山県"], ["山梨県", "埼玉県"]];
  const no = [["東京都", "茨城県"], ["大阪府", "三重県"], ["滋賀県", "奈良県"], ["福岡県", "宮崎県"], ["岐阜県", "静岡県"], ["山形県", "岩手県"], ["神奈川県", "埼玉県"], ["石川県", "長野県"]];
  const ngY = yes.filter(([a, b]) => !adj(a, b)), ngN = no.filter(([a, b]) => adj(a, b));
  check("接する県・接しない県の見本がデータと合う（京都と三重は接する・大阪と三重は接しない など）", !ngY.length && !ngN.length, [...ngY, ...ngN].map((x) => x.join("-")).join(","));
  const links = M.L.map((l) => [M.P[l[0]][0], M.P[l[1]][0]].sort().join("-")).sort();
  check("海をこえるのは橋・トンネルの5か所だけ（青函・関門・明石海峡・瀬戸大橋・しまなみ）", links.join() === ["北海道-青森県", "山口県-福岡県", "兵庫県-徳島県", "広島県-愛媛県", "岡山県-香川県"].map((x) => x.split("-").sort().join("-")).sort().join());
  { const d = T.bfs(0).d; check("46県が全部つながっている（どこからどこへも行ける）", d.every((x) => x >= 0)); }
  check("県の形は地図の中（中心が地図の範囲内）", M.P.every((p) => p[2] > 0 && p[3] > 0 && p[2] < M.W && p[3] < M.H && p[1].startsWith("M")));
}
// 2. 問題の作り方（ブラウザを使わない）
{
  const bad = [], same = [], dist = {};
  for (let d = 0; d < 3000; d++) [...T.LV, T.HARD].forEach((L, i) => {
    const seed = T.seedOf(`qa${d}:${i}`), p = T.make(seed, L), q = T.make(seed, L);
    if (!p) { bad.push(`${d}:${i} 作れない`); return; }
    if (JSON.stringify(p) !== JSON.stringify(q)) same.push(`${d}:${i}`);
    const r = T.bfs(p.s, p.closed);
    if (r.d[p.g] !== p.d || r.w[p.g] !== p.ways || p.d < L.min || p.d > L.max + (L.close ? 1 : 0) || p.s === p.g) bad.push(`${d}:${i} 最短がずれる`);
    if (L.close) { const base = T.bfs(p.s).d[p.g]; if (p.closed.length !== 1 || p.closed.includes(p.s) || p.closed.includes(p.g) || !(p.d > base && p.d <= base + 3)) bad.push(`${d}:${i} 通行止め`); }
    else if (p.closed.length) bad.push(`${d}:${i} 通行止めがある`);
    const w = T.path(p.s, p.g, p.closed); if (!w || w.length - 1 !== p.d || w.some((x) => p.closed.includes(x)) || w.some((x, k) => k && !M.N[w[k - 1]].includes(x))) bad.push(`${d}:${i} 道`);
    dist[L.name + p.d] = (dist[L.name + p.d] || 0) + 1;
  });
  check("どの問題も最短の数・最短の道の数が正しい・通行止めは最短の道をふさぎ1〜3県の遠回り（4種類×3000問）", bad.length === 0, bad.slice(0, 3).join(","));
  check("同じ種からは同じ問題ができる（だれでも同じ問題）", same.length === 0, same.slice(0, 3).join(","));
  check("最短の数がかたよらない（近場は3と4、遠出は5〜7がどれも2割以上）", ["近場3", "近場4"].every((k) => dist[k] > 600) && ["遠出5", "遠出6", "遠出7"].every((k) => dist[k] > 600), JSON.stringify(dist));
  { // 最短の道の数を、別の数え方（全部の道をたどる）で確かめる
    const ng = [];
    for (let d = 0; d < 60; d++) { const p = T.make(T.seedOf("w" + d), T.LV[d % 3]); let n = 0; const go = (a, k, seen) => { if (a === p.g) { if (k === p.d) n++; return; } if (k >= p.d) return; for (const b of M.N[a]) if (!seen.has(b) && !p.closed.includes(b)) { seen.add(b); go(b, k + 1, seen); seen.delete(b); } }; go(p.s, 0, new Set([p.s])); if (n !== p.ways) ng.push(`${d}:${p.ways}/${n}`); }
    check("「最短の道は○通り」の数が、別の数え方と合う", ng.length === 0, ng.slice(0, 3).join(","));
  }
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習の問題の種だけ（今日の3問・上級は日付の種）", (html.match(/Math\.random/g) || []).length === 1 && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/todofuken-relay/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./gen.js", "./map.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(Promise\.race\(\[net\.then[^\n]*wait\(15000\)[^\n]*wait\(60000\)\]\)\)/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し、外へ何も送らない", need.every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "都道府県リレー" && mf.icons.length >= 2 && mf.start_url === "./"); }
{ const src = html + readFileSync(path.join(root, "gen.js"), "utf8");
  const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
  check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
async function newPage(w = 390, h = 844) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.stack));
  page.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  return page;
}
const curT = (page) => page.evaluate(() => { const c = window.__td.cur(); return { p: c.p, path: c.path.slice(), moves: c.moves, hints: c.hints, done: c.done, hint: c.hint }; });
// 最短の道で、下のボタンを押して進む
async function solveNow(page, extra = 0) {
  let c = await curT(page);
  const at0 = c.path[c.path.length - 1];
  for (let k = 0; k < extra; k++) { const nb = M.N[at0].find((x) => !c.p.closed.includes(x) && x !== c.p.g); await page.click(`#nx button[data-j="${nb}"]`); await page.click("#undo"); }
  c = await curT(page);
  const w = T.path(c.path[c.path.length - 1], c.p.g, c.p.closed);
  for (const j of w.slice(1)) await page.click(`#nx button[data-j="${j}"]`);
}
const KEY = "todofuken-v1";
try {
  const page = await newPage();
  // 3. 3問の組み方（日付の種）
  const sel = await page.evaluate(() => {
    const g = window.__td, out = { bad: [], same: 0 };
    let prev = null;
    for (let n = 0; n < 365; n++) {
      const k = new Date(Date.parse("2026-11-04") + n * 864e5).toISOString().slice(0, 10);
      const d = g.dailyList(k).map(g.probOf), h = g.hardList(k).map(g.probOf);
      if (d.map((p) => p.lv).join() !== "近場,遠出,通行止め" || h.some((p) => p.lv !== "地図なし")) out.bad.push(k);
      const sig = JSON.stringify(d.map((p) => [p.s, p.g]));
      if (sig === prev) out.same++; prev = sig;
    }
    out.d1201 = JSON.stringify(g.dailyList("2026-12-01").map(g.probOf));
    return out;
  });
  check("今日の3問は毎日「近場・遠出・通行止め」、上級は地図なし2問（1年分）", sel.bad.length === 0, sel.bad.slice(0, 3).join(","));
  check("前の日と同じ問題にならない（1年分）", sel.same === 0);
  { const ctx = await browser.newContext(); const p2 = await ctx.newPage(); await p2.goto(url);
    const d2 = await p2.evaluate(() => { const g = window.__td; return JSON.stringify(g.dailyList("2026-12-01").map(g.probOf)); });
    await ctx.close();
    check("同じ日は別のブラウザで開いても同じ3問", sel.d1201 === d2); }

  // 4. 通しで遊ぶ
  check("初めて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  check("ホームに日本全体の地図が出る", (await page.locator(".map path").count()) === 46);
  await page.click("#howto-ok");
  await page.click("#go-d");
  let c = await curT(page);
  check("1問目は近場：出発と目的の県名が出て、となりの県のボタンが並ぶ", (await page.textContent(".goal")).includes(M.P[c.p.s][0]) && (await page.textContent(".goal")).includes(M.P[c.p.g][0]) && (await page.locator("#nx button").count()) === M.N[c.p.s].length);
  check("地図でとなりの県が黄色で光る（押せる）", (await page.locator("#mp path.nb").count()) === M.N[c.p.s].filter((x) => !c.p.closed.includes(x)).length);
  // 地図の県を押して進む・となりでない県は押しても進まない
  const far = M.P.findIndex((_, i) => i !== c.p.s && !M.N[c.p.s].includes(i));
  await page.evaluate((j) => document.querySelector(`#mp path[data-i="${j}"]`).dispatchEvent(new MouseEvent("click", { bubbles: true })), far);
  check("となりでない県を押しても進まない", (await curT(page)).path.length === 1);
  const n0 = M.N[c.p.s].find((x) => !c.p.closed.includes(x) && x !== c.p.g);
  await page.evaluate((j) => document.querySelector(`#mp path[data-i="${j}"]`).dispatchEvent(new MouseEvent("click", { bubbles: true })), n0);
  let n1 = await curT(page);
  check("地図のとなりの県を押すと進み、進んだ回数が1になる", n1.path.join() === [c.p.s, n0].join() && n1.moves === 1 && (await page.textContent("#trip")).includes(T.short(n0)));
  await page.click("#undo");
  n1 = await curT(page);
  check("「ひとつ戻る」で戻れるが、進んだ回数は減らない", n1.path.length === 1 && n1.moves === 1);
  await page.click("#hint");
  n1 = await curT(page);
  { const d = T.bfs(c.p.g, c.p.closed).d; check("ヒントで目的に近づくとなりの県が光る", n1.hints === 1 && n1.hint != null && d[n1.hint] === d[c.p.s] - 1 && (await page.locator("#nx button.hint").count()) === 1); }
  await page.reload(); await page.click("#go-d");
  n1 = await curT(page);
  check("途中で閉じても、進んだ回数とヒントはそのまま（続きから）", n1.moves === 1 && n1.hints === 1 && (await page.textContent("#left")).includes("ヒント 1"));
  // 練習を始めても今日の途中は消えない
  await page.click("#back"); await page.click("#go-p"); await page.locator(".lv button").first().click(); await page.click("#back"); await page.click("#go-d");
  check("練習を始めても、今日の途中経過は消えない", (await curT(page)).moves === 1 && (await page.evaluate(() => window.__td.mode())) === "d");
  await solveNow(page);
  n1 = await curT(page);
  check("目的の県に着くと到着になり、遠回り1回＋ヒント1回で★1、最短の道の数が出る", n1.done && n1.moves === c.p.d + 1 && (await page.locator(".verdict .stars .off").textContent()).length === 2 && /最短の道は\d+通り/.test(await page.textContent(".verdict")));
  await page.click("#next");
  c = await curT(page);
  // 別のタブで先に進んでいたら、古い画面の答えは足さない
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.push({ m: 3, d: 3, h: 0 }); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await solveNow(page);
  check("別のタブで先に進んでいたら、古い画面の答えは足さず今の問題を出し直す", (await page.evaluate(() => window.__td.load().runs.d.res.length)) === 2 && (await page.textContent("header")).includes("3/3"));
  c = await curT(page);
  { const x = c.p.closed[0], at = c.p.s; const nbX = M.N[at].includes(x);
    check("通行止めの県が地図に斜線で出て、県名に✕が付く", (await page.locator("#mp path.x").count()) === 1 && (await page.textContent("#mp")).includes("✕" + T.short(x)));
    if (nbX) check("通行止めの県のボタンは押せない", await page.isDisabled(`#nx button[data-j="${x}"]`)); }
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.pop(); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload(); await page.click("#go-d");
  for (let j = 0; j < 2; j++) { await solveNow(page); await page.click("#next"); }
  const share = await page.textContent(".share");
  check("3問で結果・シェアの文は番号と色だけ（県の名前を出さない）", /都道府県リレー #\d+/.test(share) && /💡🟩🟩/.test(share) && !M.P.some((p) => share.includes(p[0].replace(/(都|府|県)$/, ""))));
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("結果に3問の出発・目的と回数が出る", (await page.locator(".res div").count()) === 3);
  check("ヒントを使った日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる・着いた旅3", (await page.textContent(".stats")).includes("1連続の日") && (await page.textContent(".stats")).includes("3着いた旅") && (await page.textContent("#go-d")).includes("結果"));
  // 上級
  await page.click("#go-h");
  check("上級は地図なし（地図が隠れる）でヒントのボタンが無い", (await page.locator("#mp.hide").count()) === 1 && (await page.locator("#mp svg").count()) === 0 && (await page.locator("#hint").count()) === 0);
  await solveNow(page);
  check("地図なしでも、着くと地図と道が出る", (await page.locator("#mp svg").count()) === 1 && (await page.locator("#mp .rt").count()) === 1);
  await page.click("#next"); await solveNow(page); await page.click("#next");
  check("上級を全部最短で初めて終えると、結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1 && (await page.textContent(".big")).includes("最短"));
  await page.click("#back"); await page.click("#go-h");
  check("2回目に結果を開いても Ko-fi のひとことは出ない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  // 練習：記録の日を増やさず、県帳には載る
  await page.click("#go-p"); await page.locator(".lv button").nth(1).click();
  await solveNow(page); await page.click("#next");
  const after = await page.evaluate(() => { const s = window.__td.load(); return { days: Object.keys(s.days).length, trips: s.trips, seen: Object.keys(s.seen).length }; });
  check("練習は今日の記録を増やさず、着いた旅と県帳には入る", after.days === 1 && after.trips === 6 && (await page.locator(".share").count()) === 0);
  await page.click("#go-dex");
  check("県帳に通った県が出て、まだの県は薄い", (await page.locator(".dex div:not(.no)").count()) === after.seen && (await page.locator(".dex div").count()) === 46);
  await page.close();

  // 5. スマホ幅：はみ出さない・押せる所は44px以上
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); const fb2 = await p3.evaluate(() => { const a = document.querySelector("#howto #fb2"); return a ? a.getBoundingClientRect().height : 0; }); check(`幅${w}px：遊び方の「感想を送る」も高さ44px以上`, fb2 >= 44, `${fb2}px`); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id || e.textContent.trim().slice(0, 6)) }));
    check(`幅${w}px：横にはみ出さず、押せる所は高さ44px以上`, homeOk && !r.over && r.small.length === 0, r.small.join(","));
    await p3.close();
  }
  { // どの問題でも、地図の字が小さすぎず、出発・目的・となりの県が地図に入る（幅320pxで、1年分の今日の3問）
    const pz = await newPage(320, 700); await pz.click("#howto-ok"); await pz.click("#go-d");
    const z = await pz.evaluate(() => { const g = window.__td, P = g.T.M.P, N = g.T.M.N, W = document.querySelector("#mp").clientWidth, ng = []; let min = 99;
      for (let n = 0; n < 365; n++) { const k = new Date(Date.parse("2026-11-04") + n * 864e5).toISOString().slice(0, 10);
        for (const p of g.dailyList(k).map(g.probOf)) { const h = g.mapHtml(p, { path: [p.s], cur: p.s, nb: N[p.s] }), vb = h.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number), fs = +h.match(/font-size="([\d.]+)"/)[1] * W / vb[2]; min = Math.min(min, fs);
          if (![p.s, p.g, ...N[p.s]].every((i) => P[i][2] >= vb[0] && P[i][2] <= vb[0] + vb[2] && P[i][3] >= vb[1] && P[i][3] <= vb[1] + vb[3])) ng.push(k); } }
      return { min, ng }; });
    check("幅320pxでも地図の県名は9px以上・出発・目的・となりの県が地図の中に入る（1年分）", z.min >= 9 && z.ng.length === 0, `${z.min.toFixed(1)}px ${z.ng.slice(0, 3).join(",")}`);
    await pz.close(); }
  { // 保存してあった道が壊れていたら使わない
    const pv = await newPage(); await pv.click("#howto-ok");
    await pv.evaluate((k) => { const g = window.__td, d = g.todayKey(), p = g.probOf(g.dailyList(d)[0]); const far = g.T.M.P.findIndex((_, i) => i !== p.s && !g.T.M.N[p.s].includes(i)); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, seen: {}, trips: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [], cur: { i: 0, path: [p.s, far], moves: 1, hints: 0 }, id: "a" } } })); }, KEY);
    await pv.reload(); await pv.click("#go-d");
    check("壊れた途中経過（となりでない県へ飛ぶ道）は使わず、出発から始める", (await curT(pv)).path.length === 1 && (await curT(pv)).moves === 0);
    await pv.close(); }
  { // 保存できないブラウザでも遊べる
    const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pb.on("pageerror", (e) => errors.push(e.message));
    await pb.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
    await pb.goto(url); await pb.click("#howto-ok"); await pb.click("#go-d");
    { const c0 = await curT(pb), nb = M.N[c0.p.s].find((x) => !c0.p.closed.includes(x)); await pb.click(`#nx button[data-j="${nb}"]`); }
    check("保存できないブラウザでも、今日の1問目で進める", (await pb.textContent("header")).includes("1/3") && (await curT(pb)).moves === 1);
    await pb.click("#back");
    check("保存できないブラウザでも、遊び方が何度も開かない", !(await pb.locator("#howto[open]").count()));
    await pb.close(); }
  { // 前の記録が残っていて、書き込みだけ失敗するとき
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pq.on("pageerror", (e) => errors.push(e.message));
    await pq.addInitScript(() => { const orig = Storage.prototype.setItem; orig.call(localStorage, "todofuken-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, seen: {}, trips: 0, kofi: {}, runs: {} })); Storage.prototype.setItem = () => { throw new Error("full"); }; });
    await pq.goto(url); await pq.click("#go-d");
    check("前の記録があり書き込みだけ失敗しても、今日の1問目が始まる", (await pq.textContent("header")).includes("1/3"));
    await pq.close(); }
  { const pc = await newPage();
    await pc.evaluate((k) => { const g = window.__td, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, seen: {}, trips: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 3, d: 3, h: 0 })), id: "a" } } })); }, KEY);
    await pc.reload();
    check("最後の1問のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__td; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  { const pm = await newPage();
    await pm.evaluate((k) => { const g = window.__td, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, seen: {}, trips: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 3, d: 3, h: 0 })), id: "a" } } })); }, KEY);
    await pm.reload();
    const had = await pm.locator("#go-h").count();
    await pm.evaluate(() => { const RD = Date, off = 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; });
    if (had) await pm.click("#go-h");
    check("結果を開いたまま日付が変わったら、上級のボタンを押しても翌日の上級は始まらない", had > 0 && (await pm.evaluate(() => window.__td.mode())) !== "h");
    await pm.close(); }
  { const pn = await newPage();
    await pn.evaluate((k) => { const g = window.__td, d = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, seen: {}, trips: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 3, d: 3, h: 0 })), id: "a" } } })); }, KEY);
    await pn.reload();
    check("前の日に終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__td; return !!g.load().days[new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10)] && !g.load().runs.d; }));
    check("前の日の結果の画面からは、今日の上級を始められない（今日の分を先に）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, KEY));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残し、県帳の数は多いほう", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": 1 }, seen: { 長野県: 9 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 }, seen: { 長野県: 2 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"] && r.seen["長野県"] === 9; }, KEY));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, lv: 0 }], id: "x", res: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: { d: Object.assign({}, base) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: { d: Object.assign({}, base, { res: [{ m: 3, d: 3, h: 0 }] }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（終えた回の null は戻さない）", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null; }, KEY));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, KEY));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, KEY));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, KEY));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, KEY));
    await pn.close(); }
} catch (e) {
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

const ng = results.filter((r) => !r.ok);
const md = `# 都道府県リレー QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
