// 都道府県リレーの検査。となりの県のデータ・問題の作り方（何千問）・3問の組み方・進む/戻る/ヒント・続きから・上級（地図なし）・県帳・最短の目安と答え合わせ・実績・カレンダー・あとから・記録・スマホ幅・PWA。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

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
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
check("到着を記録できなかったら到着の画面を出さない（2026-11-04 CodeRabbit）", /if \(!saved\) \{ toast\("別の画面で先に進んでいます"\); return play\(\); \}/.test(html));
check("別のタブで先に進んだ道を、古いタブの短い道で上書きしない（2026-11-04 CodeRabbit）", /r\.cur\.i === cur\.i && r\.cur\.moves > cur\.moves\)\) r\.cur =/.test(html));
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの問題の種だけ（今日の3問・上級は日付の種）", (html.match(/Math\.random/g) || []).length === 3 && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/todofuken-relay/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./transfer.js", "./gen.js", "./map.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
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
    check("前の日の結果の画面に、今日の上級のボタンを出さない", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, KEY));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残し、県帳の数は多いほう", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": 1 }, seen: { 長野県: 9 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 }, seen: { 長野県: 2 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"] && r.seen["長野県"] === 9; }, KEY));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, lv: 0 }], id: "x", res: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: { d: Object.assign({}, base) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: { d: Object.assign({}, base, { res: [{ m: 3, d: 3, h: 0 }] }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（その日を終えた記録があれば null を使う・終えた回は日ごとの結果に残す）", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b, dd) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }, dd ? { days: Object.assign({}, s0.days, dd) } : {}))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }, { "2000-01-01": 1 }), r3 = put({ d: base }, { d: null }), r4 = put({ d: done }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null && !!r3.runs.d && r3.runs.d.date === "2000-01-01" && r4.runs.d === null && !!r4.days["2000-01-01"]; }, KEY));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, KEY));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, KEY));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__td, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, KEY));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, KEY));
    await pn.close(); }

  // 6. おもしろさ：最短の目安・遠回りの色・着いたら道を引き直し、最短でなければ最短の例を重ねる
  { // 遠回りできる隣県がある日を選ぶ（北海道が出発の日は隣が1つだけ。実行した日で QA が変わらないように。2026-11-04 CodeRabbit の指摘）
    const p0 = await newPage();
    const day = await p0.evaluate(() => { const g = window.__td; for (let n = 0; n < 365; n++) { const k = new Date(Date.parse("2026-11-04") + n * 864e5).toISOString().slice(0, 10); const p = g.probOf(g.dailyList(k)[0]), d = g.T.bfs(p.g, p.closed).d; if (g.T.M.N[p.s].some((x) => !p.closed.includes(x) && x !== p.g && d[x] >= d[p.s])) return k; } return null; });
    await p0.close();
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pg.on("pageerror", (e) => errors.push(e.stack));
    await pg.addInitScript((at) => { const RD = Date, off = RD.parse(at) - RD.now(); window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; }, day + "T03:00:00Z");
    await pg.goto(url); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.click("#howto-ok"); await pg.click("#go-d");
    let c = await curT(pg);
    check("問題の画面に最短の回数（目安）が出る", (await pg.textContent("#par")).includes(`${c.p.d}回`));
    const d = T.bfs(c.p.g, c.p.closed).d, wrong = M.N[c.p.s].find((x) => !c.p.closed.includes(x) && x !== c.p.g && d[x] >= d[c.p.s]);
    check("遠回りを試す問題に、目的の県に近づかない隣県がある（実行した日によらず下の検査が全部動く）", wrong !== undefined, `${day} ${c.p.s}`);
    await pg.click(`#nx button[data-j="${wrong}"]`);
    const w = T.path(wrong, c.p.g, c.p.closed);
    for (const j of w.slice(1, -1)) await pg.click(`#nx button[data-j="${j}"]`);
    check("最短の回数をこえたら、進んだ回数の色が変わる", (await curT(pg)).moves > c.p.d ? (await pg.locator("#left.over").count()) === 1 : true);
    await pg.click(`#nx button[data-j="${w[w.length - 1]}"]`);
    check("遠回りで着くと、道を引き直して見せ、最短の道の例を点線で重ねる（答え合わせ。色の名前に頼らず「点線」と書く）", (await pg.locator("#mp .rt.draw").count()) === 1 && (await pg.locator("#mp .best").count()) === 1 && (await pg.locator("#mp path.g.got").count()) === 1 && (await pg.textContent(".verdict")).includes("点線（‥‥）が最短の例"));
    await pg.click("#next"); await solveNow(pg);
    check("最短で着いたときは点線を重ねない", (await pg.locator("#mp .best").count()) === 0 && (await pg.locator("#mp .rt.draw").count()) === 1 && (await pg.locator("#left.over").count()) === 0);
    await pg.close(); }

  // 7. やりこみ：実績・カレンダー・取りこぼした日をあとから
  const base = () => ({ v: 1, tut: true, days: {}, hdays: {}, adays: {}, seen: {}, trips: 0, runs: {}, kofi: {} });
  const R3 = (m) => ({ r: m.map((x) => ({ m: 3 + x, d: 3, h: 0 })) });
  async function pageAt(day, w = 390, state = null) {
    const pg = await browser.newPage({ viewport: { width: w, height: 844 } });
    pg.on("pageerror", (e) => errors.push(e.stack));
    pg.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
    await pg.addInitScript((at) => { const RD = Date, off = RD.parse(at) - RD.now(); window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; }, day + "T03:00:00Z");
    await pg.goto(url);
    await pg.evaluate(([k, st]) => { localStorage.clear(); if (st) localStorage.setItem(k, JSON.stringify(st)); }, [KEY, state]);
    await pg.reload();
    return pg;
  }
  { // 実績の数え方（いまの記録から毎回数える）
    const pa = await newPage();
    const r = await pa.evaluate(() => {
      const g = window.__td, A = g.ACH, ids = A.map((a) => a[0]), P = g.T.M.P;
      const st = { v: 1, days: {}, hdays: {}, adays: {}, seen: {}, runs: {}, kofi: {} };
      for (let i = 0; i < 7; i++) st.days["2027-01-0" + (i + 1)] = { r: [0, 1, 2].map((j) => ({ m: 3 + (i >= 5 && j === 0 ? 1 : 0), d: 3, h: 0 })) };
      st.days["2027-01-08"] = { r: [{ m: 3, d: 3, h: 0 }, { m: 5, d: 5, h: 0 }, { m: 6, d: 5, h: 0 }] };
      st.hdays["2027-01-01"] = { r: [{ m: 7, d: 6, h: 0 }, { m: 6, d: 6, h: 0 }] };
      st.days["2000-01-01"] = 1; // 形のちがう古い記録が混じっても止まらない
      ["徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県"].forEach((n) => (st.seen[n] = 1));
      P.slice(0, 20).forEach((q) => (st.seen[q[0]] = 1));
      const t = g.tally(st), got = g.achGot(st);
      const st2 = JSON.parse(JSON.stringify(st)); st2.hdays["2027-01-02"] = { r: [{ m: 6, d: 6, h: 0 }, { m: 7, d: 7, h: 0 }] }; P.forEach((q) => (st2.seen[q[0]] = 1)); delete st2.seen["高知県"];
      return { n: A.length, uniq: new Set(ids).size === A.length, grp: [0, 1, 2].map((x) => A.filter((a) => a[3] === x).length), t, got, got2: g.achGot(st2), empty: g.achGot({ days: {}, hdays: {}, seen: {} }).length };
    });
    check("実績は10〜14個・名前が重ならず、腕前・集める・続けるが3つ以上ずつ", r.n >= 10 && r.n <= 14 && r.uniq && r.grp.every((x) => x >= 3), r.grp.join("・"));
    check("実績は記録から数える：全部最短の日5・通行止めを最短7・遊んだ日9・上級1日（全部最短ではない）・四国4県", r.t.clean === 5 && r.t.detour === 7 && r.t.days === 9 && r.t.hard === 1 && r.t.hclean === 0 && r.t.shikoku === 4 && ["clean1", "clean5", "detour5", "hard1", "shikoku", "first", "d7"].every((x) => r.got.includes(x)) && !r.got.includes("hclean") && !r.got.includes("kyushu") && !r.got.includes("late1"), JSON.stringify(r.t));
    check("実績：上級を全部最短で「頭の中の地図」・45県では「全県制覇」にならず、高知県を外すと「四国めぐり」も消える（記録から数え直す）", r.got2.includes("hclean") && r.got2.includes("kyushu") && r.got2.includes("dex23") && !r.got2.includes("dex46") && !r.got2.includes("shikoku") && r.empty === 0);
    await pa.close(); }
  { // 取りこぼした日：何百日分作って、過去7日・始めた日より後・遊んでいない日だけ
    const pl = await newPage();
    const bad = await pl.evaluate(() => {
      const g = window.__td, out = [], day = (n) => new Date(Date.parse("2026-11-04") + n * 864e5).toISOString().slice(0, 10);
      for (let n = 0; n < 700; n++) {
        const k = day(n), s = { days: {}, adays: {} };
        for (let j = Math.max(0, n - 12); j < n; j++) { const x = (j * 7 + n * 3) % 5; if (x === 0) s.days[day(j)] = { r: [] }; else if (x === 1) s.adays[day(j)] = { r: [] }; }
        const L = g.lateDays(s, k), want = [];
        for (let j = n - 1; j >= Math.max(0, n - 7); j--) if (!s.days[day(j)] && !s.adays[day(j)]) want.push(day(j));
        if (JSON.stringify(L) !== JSON.stringify(want) || L.some((d) => d >= k || d < "2026-11-04")) out.push(k);
      }
      return out;
    });
    check("取りこぼした日は過去7日のうち遊んでいない日だけ・始めた日より前と今日は出ない（700日分）", bad.length === 0, bad.slice(0, 3).join(","));
    await pl.close(); }
  { // カレンダーの印とあとから遊ぶ（2026-11-20 として開く）
    const st = base();
    st.days["2026-11-19"] = R3([0, 0, 0]); st.days["2026-11-18"] = R3([0, 1, 0]); st.days["2026-11-17"] = R3([0, 4, 0]);
    st.hdays["2026-11-19"] = { r: [{ m: 6, d: 6, h: 0 }, { m: 6, d: 6, h: 0 }] };
    const pc = await pageAt("2026-11-20", 390, st);
    check("ホームのカレンダーのボタンに、あとから遊べる日の数が出る", (await pc.getAttribute("#go-cal", "aria-label")).includes("あとから遊べる日 4") && (await pc.textContent("#go-cal .badge")) === "▶4");
    // 今日の3問を1歩だけ進めておく（あとから遊んでも消えない）
    await pc.click("#go-d"); { const c0 = await curT(pc), nb = M.N[c0.p.s].find((x) => !c0.p.closed.includes(x) && x !== c0.p.g); await pc.click(`#nx button[data-j="${nb}"]`); }
    await pc.click("#back"); await pc.click("#go-cal");
    const cls = (d) => pc.getAttribute(`.cal [data-k="2026-11-${d}"]`, "class");
    check("カレンダー：全部最短の日は濃い★3・どれも★2以上は★2・★1がある日は★1、上級の日に「上」", (await cls(19)).includes("p3") && (await cls(18)).includes("p2") && (await cls(17)).includes("p1") && (await pc.textContent('.cal [data-k="2026-11-19"]')).includes("上"));
    check("カレンダー：取りこぼした過去7日だけ押せる（8日前より前と今日は押せない）", (await pc.locator(".cal button.miss").count()) === 4 && (await pc.locator('.cal button[data-k="2026-11-12"]').count()) === 0 && (await cls(20)).includes("today"));
    check("カレンダー：連続の日は1以上のときだけ小さく出す・休んだ日を責める言葉を書かない", (await pc.textContent("header")).includes("連続 3日") && !/サボ|休んだ|さぼ|失敗|残念/.test(await pc.textContent("#app")));
    { // キーボードで選んだボタンに枠が出る（all:unset で消えない。2026-11-04 CodeRabbit の指摘）
      await pc.keyboard.press("Shift");
      const bad = await pc.evaluate(() => [...document.querySelectorAll("button:not([disabled]),a[href]")].filter((b) => b.checkVisibility()).filter((b) => { b.focus(); const cs = getComputedStyle(b); return !b.matches(":focus-visible") || cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) < 2; }).map((b) => b.className || b.id || b.tagName));
      check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", bad.length === 0 && (await pc.locator(".cal button.miss").count()) > 0, bad.join(","));
    }
    check("カレンダー：始めた月より前と今月より先へは行けない", (await pc.isDisabled("#prev")) && (await pc.isDisabled("#next")));
    await pc.click('.cal button[data-k="2026-11-16"]');
    const late = await pc.evaluate(() => { const g = window.__td, c = g.cur(), p = g.probOf(g.dailyList("2026-11-16")[0]); return { mode: g.mode(), ok: c.p.s === p.s && c.p.g === p.g && JSON.stringify(c.p.closed) === JSON.stringify(p.closed) }; });
    check("取りこぼした日を押すと、その日の今日の3問と同じ問題で遊べる（途中経過は日付ごとの入れ物）", late.mode === "a:2026-11-16" && late.ok && (await pc.textContent("header")).includes("11/16"));
    for (let j = 0; j < 3; j++) { await solveNow(pc); await pc.click("#next"); }
    const after = await pc.evaluate(() => { const g = window.__td, s = g.load(); return { days: Object.keys(s.days).length, a: !!s.adays["2026-11-16"], st: g.streak(s.days), seen: g.dailyList("2026-11-16").map(g.probOf).every((p) => s.seen[g.T.name(p.g)] >= 1), d: s.runs.d && s.runs.d.cur ? s.runs.d.cur.moves : -1, ra: s.runs.a, rs: s.runs["a:2026-11-16"] }; });
    check("あとから遊んだ日は今日の記録・連続の日を増やさず、県帳には載り、今日の途中経過も消さない", after.a && after.days === 3 && after.st === 3 && after.seen && after.d === 1 && !after.ra && !after.rs, JSON.stringify(after));
    check("あとから遊んだ結果：シェアと Ko-fi は出さず、新しい実績を「🏅 実績：」で小さく出す", (await pc.locator(".share").count()) === 0 && (await pc.locator(".kofi").count()) === 0 && (await pc.textContent("#achnew")).includes("🏅 実績：寄り道の旅"));
    await pc.click("#go-cal");
    check("あとから遊んだ日はカレンダーで ↺ に変わり、もう押せない", (await cls(16)).includes("late") && (await pc.textContent('.cal [data-k="2026-11-16"]')).includes("↺") && (await pc.locator(".cal button.miss").count()) === 3);
    await pc.click("#back"); await pc.click("#go-ach");
    check("実績の画面：取った実績は「達成」、まだの実績は条件と進み具合（3/7 など）", (await pc.locator(".ach").count()) === (await pc.evaluate(() => window.__td.ACH.length)) && (await pc.textContent('.ach[data-id="late1"]')).includes("達成") && (await pc.textContent('.ach[data-id="d7"] .pg')) === "3/7" && (await pc.locator('.ach[data-id="d7"] .bar').count()) === 1);
    await pc.close(); }
  { // あとから：A日を途中まで → B日を始める → A日に戻ると続きから（前の日の途中を黙って消さない。CodeRabbit が前のゲームで指摘）
    const pr = await pageAt("2026-11-20", 390, base());
    const step = async () => { const c0 = await curT(pr), nb = M.N[c0.p.s].find((x) => !c0.p.closed.includes(x) && x !== c0.p.g); await pr.click(`#nx button[data-j="${nb}"]`); };
    await pr.click("#go-cal"); await pr.click('.cal button[data-k="2026-11-16"]'); await step();
    await pr.click("#back"); await pr.click("#go-cal"); await pr.click('.cal button[data-k="2026-11-15"]'); await step();
    await pr.click("#back"); await pr.click("#go-cal");
    const mark = await pr.textContent('.cal button[data-k="2026-11-16"]');
    await pr.click('.cal button[data-k="2026-11-16"]');
    const back = await pr.evaluate(() => { const g = window.__td, c = g.cur(), s = g.load(), p16 = g.probOf(g.dailyList("2026-11-16")[0]), r15 = s.runs["a:2026-11-15"]; return { a: c.p.s === p16.s && c.moves === 1 && c.path.length === 2, b: !!r15 && r15.cur.moves === 1 && r15.list[0].seed === g.dailyList("2026-11-15")[0].seed }; });
    check("あとから：A日を途中まで→B日を始める→A日に戻ると続きから（B日の途中も残る・カレンダーに「続き」）", back.a && back.b && mark.includes("続き"), JSON.stringify(back));
    await pr.close(); }
  { // load：保存に失敗したあと、片方にしか無い新しいキー（adays）も失わない（両方を先に fresh() で補う）
    const pn2 = await newPage();
    check("保存に失敗したあと、片方の記録にしか無い「あとから」の記録も統合で失わない", await pn2.evaluate((K) => { const g = window.__td, s0 = g.load(); const old = Object.assign({}, s0, { t: 9 }); delete old.adays; mem = JSON.stringify(Object.assign({}, s0, { t: 5, adays: { "2000-01-01": { r: [] } } })); localStorage.setItem(K, JSON.stringify(old)); const r = g.load(); mem = null; const r2 = (() => { mem = JSON.stringify(old); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, adays: { "2000-01-02": { r: [] } } }))); const x = g.load(); mem = null; return x; })(); return !!r.adays["2000-01-01"] && !!r2.adays["2000-01-02"]; }, KEY));
    await pn2.close(); }
  { // 0時をまたいで8日前になった日は、カレンダーを開いたままでも始めない
    const pz = await pageAt("2026-11-20", 390, base());
    await pz.click("#go-cal");
    await pz.evaluate(() => { const RD = Object.getPrototypeOf(Date), off = 7 * 864e5; const now = Date.now(); window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(now + off); } static now() { return now + off; } }; });
    await pz.click('.cal button[data-k="2026-11-13"]');
    check("開いたまま日付が進んで過去7日から外れた日は、あとから始めない", !(await pz.evaluate(() => window.__td.mode())).startsWith("a"));
    await pz.close(); }
  { // とことん：問題が次々に出る・近場→遠出→通行止め・ヒントは何も減らさない・降りるまで終わらない・降りると自己ベスト（2026-11-05「一日で遊べる量が少なすぎる」・2026-11-06「好きなだけ遊んでほしい」satou さん）
    const pe = await pageAt("2026-11-20", 390, base());
    check("とことんの並び（300回）：近場3→遠出7→通行止め50、1回の中で同じ問題（出発・目的・通行止め）を出さない・問題が作れる", await pe.evaluate(() => { const g = window.__td; for (let n = 0; n < 300; n++) { const L = g.endlessList(); if (L.length !== 60) return false; if (!L.every((x, i) => x.lv === (i < 3 ? 0 : i < 10 ? 1 : 2))) return false; const ps = L.map(g.probOf); if (!ps.every(Boolean) || new Set(ps.map(g.keyOf)).size !== 60) return false; } return true; }));
    check("とことんの足し分（100回）：遠出・通行止めを40問足し、それまでの並びと重ねない", await pe.evaluate(() => { const g = window.__td; for (let n = 0; n < 100; n++) { const run = { list: g.endlessList() }; const more = g.moreList(run); const all = [...run.list, ...more].map(g.probOf); if (more.length !== 40 || !more.every((x) => x.lv === 1 || x.lv === 2) || !all.every(Boolean) || new Set(all.map(g.keyOf)).size !== 100) return false; } return true; }));
    check("とことんは最近遊んだ問題（recent）を出さない（100回）", await pe.evaluate(() => { const g = window.__td; for (let n = 0; n < 100; n++) { const avoid = new Set(g.endlessList().map((x) => g.keyOf(g.probOf(x)))); const L = g.endlessList(avoid); if (L.some((x) => avoid.has(g.keyOf(g.probOf(x))))) return false; } return true; }));
    check("ホームに「とことん」の大きなボタン", (await pe.locator("#go-e.main").count()) === 1);
    check("ページに🎫・「…すると開く」が無い（好きなだけ遊べる）", !html.includes("🎫") && !/すると開く|で開きます|クリアで解放/.test(html) && !/\blife\s*:/.test(html));
    await pe.click("#go-e");
    for (let j = 0; j < 3; j++) { await solveNow(pe); await pe.click("#next"); }
    check("とことんは何問目かを出し、🎫を出さない", (await pe.textContent("header")).includes("4問目") && !(await pe.content()).includes("🎫"));
    check("遊んでいる画面に Ko-fi を出さない", !/ko-fi/i.test(await pe.evaluate(() => document.body.innerText + [...document.querySelectorAll("a")].map((x) => x.href).join(" "))));
    await pe.click("#hint"); await pe.click("#hint");
    check("とことんのヒントは何も減らさず、2回使っても続けられる", (await pe.evaluate(() => window.__td.cur().hints)) === 2 && (await pe.locator("#quit").count()) === 1);
    await pe.click("#back"); await pe.click("#go-e");
    check("とことんは途中で閉じても続きから（4問目・ヒント2回のまま）", (await pe.textContent("header")).includes("4問目") && (await pe.evaluate(() => window.__td.cur().hints)) === 2);
    await solveNow(pe, 2); await pe.click("#next");
    check("遠回り・ヒントのあとも終わらず次の問題へ進む", (await pe.textContent("header")).includes("5問目") && (await pe.evaluate(() => window.__td.load().runs.e.res.length)) === 4);
    await pe.click("#quit");
    check("降りると着いた数と自己ベスト更新が出て、記録に残る（今日の記録・連続には入らない）", (await pe.textContent("#eres")).includes("4問") && (await pe.textContent("#ebest")).includes("自己ベスト更新") && (await pe.evaluate(() => { const s = window.__td.load(); return s.ebest === 4 && !s.runs.e && Object.keys(s.days).length === 0; })));
    check("遊んだ問題を recent に覚える", (await pe.evaluate(() => Object.keys(window.__td.load().recent).length)) === 4);
    await pe.click("#go-e"); await pe.click("#quit");
    check("ベストに届かないと、ベストと「あと何問で更新」を出し、ベストは下げない", (await pe.textContent("#ebest")).includes("あと5問で更新") && (await pe.evaluate(() => window.__td.load().ebest)) === 4);
    // 並びの終わり近くまで進めても終わらず、問題が足される
    await pe.click("#go-e");
    await pe.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); const r = s.runs.e; r.res = r.list.slice(0, 56).map(() => ({ m: 3, d: 3, h: 0 })); r.cur = null; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    await pe.click("#back"); await pe.click("#go-e");
    await solveNow(pe);
    check("並びの残りが少なくなると問題を足して終わらない（「結果を見る」にしない）", (await pe.evaluate(() => { const r = window.__td.load().runs.e; return r.list.length === 100 && r.res.length === 57; })) && (await pe.textContent("#next")).includes("次の問題"));
    await pe.click("#next");
    check("足したあとも続けて遊べる（58問目）", (await pe.textContent("header")).includes("58問目"));
    // 前の版の途中経過（🎫の life あり・0枚）も読めて、ヒントが押せる
    await pe.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.e.life = 0; localStorage.setItem(k, JSON.stringify(s)); }, KEY); await pe.click("#back"); await pe.click("#go-e");
    check("前の版の途中経過（life: 0）でも続きから遊べ、ヒントが押せる", (await pe.textContent("header")).includes("58問目") && !(await pe.locator("#hint").isDisabled()));
    await pe.close(); }
  { // 練習は何度でも・最近遊んだ問題を出さない
    const pr = await pageAt("2026-11-20", 390, base());
    check("練習を60回続けても、同じ問題が出ない（種類ごと・recent で避ける）", await pr.evaluate(() => { const g = window.__td; for (let lv = 0; lv < 4; lv++) { const s = { recent: {} }, seen = new Set(); for (let n = 0; n < 60; n++) { const it = g.freshItem(lv, new Set(Object.keys(s.recent))); const p = g.probOf(it), k = g.keyOf(p); if (seen.has(k)) return false; seen.add(k); g.remember(s, p); } } return true; }));
    check("recent は新しい RECENT 問だけ残す", await pr.evaluate(() => { const g = window.__td, s = { recent: {} }; for (let n = 0; n < g.RECENT + 30; n++) g.remember(s, { s: n % 46, g: (n * 7) % 46, closed: [n] }); return Object.keys(s.recent).length === g.RECENT; }));
    check("上級ははじめて開いた日からホームで押せる（今日の3問の前でも）", (await pr.locator("#go-h").count()) === 1);
    await pr.click("#go-h");
    check("今日の3問の前に上級を始められる", (await pr.evaluate(() => window.__td.mode())) === "h");
    await pr.close(); }
  { // 1回目の今日の3問を終えると「旅立ち」が出て、結果を開き直すと出ない
    const pf = await pageAt("2026-11-20", 390, base());
    await pf.click("#go-d"); for (let j = 0; j < 3; j++) { await solveNow(pf); await pf.click("#next"); }
    const a1 = await pf.textContent("#achnew").catch(() => "");
    await pf.click("#back"); await pf.click("#go-d");
    check("初めて今日の3問を終えると結果に「🏅 実績：旅立ち」、開き直すと出ない（うるさくしない）", a1.includes("旅立ち") && a1.includes("まっすぐの日") && (await pf.locator("#achnew").count()) === 0, a1);
    check("結果に「あと少しの実績」を1つだけ出す：まだの実績のうち目標にいちばん近いもの（取った・0のものは選ばない。研究の要点 12）", await pf.evaluate(() => { const g = window.__td, s = g.load(), t = g.tally(s), nx = g.nextAch(s), el = document.querySelectorAll("#achnext"); if (!nx) return el.length === 0; const cand = g.ACH.filter((a) => t[a[4]] > 0 && t[a[4]] < a[5]); return el.length === 1 && el[0].textContent.includes(nx.name) && el[0].textContent.includes("あと" + nx.left) && cand.every((a) => t[a[4]] / a[5] <= nx.r + 1e-12) && !g.achGot(s).includes(nx.id); }) && await pf.evaluate(() => window.__td.nextAch(window.__td.load()) !== null));
    check("今日の3問の結果はシェアの文がある（あとからとは別）", (await pf.locator(".share").count()) === 1);
    check("今日の3問の結果に「続けて遊ぶ：とことん」の大きなボタン", (await pf.locator("#go-e.main").count()) === 1);
    await pf.close(); }
  { // 320px・390px：ホーム・実績・カレンダー・結果が横にはみ出さず、押せる所は44px以上
    const st = base(); st.days["2026-11-19"] = R3([0, 0, 0]); st.adays["2026-11-15"] = R3([1, 0, 0]);
    mkdirSync(path.join(root, "qa-report"), { recursive: true });
    for (const w of [320, 390]) {
      const pw = await pageAt("2026-11-20", w, st), bad = [];
      const look = async (name) => { await pw.screenshot({ path: path.join(root, `qa-report/${name}-${w}.png`), fullPage: true }); const r = await pw.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) })); if (r.over || r.small.length) bad.push(`${name}:${r.over ? "はみ出し" : ""}${r.small.join("/")}`); };
      await look("home"); await pw.click("#go-ach"); await look("ach"); await pw.click("#back"); await pw.click("#go-cal"); await look("cal");
      await pw.click('.cal button[data-k="2026-11-18"]'); await look("late-play");
      for (let j = 0; j < 3; j++) { await solveNow(pw); await pw.click("#next"); }
      await look("late-result"); await pw.click("#back"); await pw.click("#go-d"); for (let j = 0; j < 3; j++) { await solveNow(pw); await pw.click("#next"); } await look("result");
      check(`幅${w}px：ホーム・実績・カレンダー・あとから・結果が横にはみ出さず、押せる所は44px以上`, bad.length === 0, bad.join(" "));
      await pw.close();
    } }
} catch (e) {
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  try { // 色だけで分けない（WCAG 1.4.1。shared-workflows routines/game-dev.md A1）：出発・目的・いまいる所・となり・ヒント・最短の点線・進み具合・星・県帳のまだ・最短をこえた回数が、記号・文字・形でも出ている。知らせは #live に文字で出る
    const pa = await newPage();
    await pa.click("#howto-ok");
    await pa.click("#go-d");
    let c = await curT(pa);
    const lab = await pa.evaluate(() => [...document.querySelectorAll("#mp svg text")].map((t) => t.textContent));
    const sn = T.short(c.p.s), gn = T.short(c.p.g);
    check("色だけで分けない：地図の県名に出発は▶・目的は◎、問題の上にも「▶ 出発」「◎ 目的」", lab.includes("▶" + sn) && lab.includes("◎" + gn) && (await pa.textContent(".goal")).includes("▶ 出発") && (await pa.textContent(".goal")).includes("◎ 目的"));
    const nbStyle = await pa.evaluate(() => { const e = document.querySelector("#mp path.nb"); const cs = getComputedStyle(e); return cs.strokeDasharray !== "none" && parseFloat(cs.strokeWidth) >= 1.5; });
    check("色だけで分けない：となりの県（押せる県）は地図で点線の縁", nbStyle);
    const dots = await pa.evaluate(() => [...document.querySelectorAll(".dots i")].map((i) => { const cs = getComputedStyle(i); return { h: i.getBoundingClientRect().height, bg: cs.backgroundColor, bw: cs.borderTopWidth }; }));
    check("色だけで分けない：何問目かの点は、いまの問題が高く・まだの問題は中が空（枠だけ）", dots[0].h > dots[1].h && dots[1].bg === "rgba(0, 0, 0, 0)" && parseFloat(dots[1].bw) >= 1);
    const first = M.N[c.p.s].find((x) => !c.p.closed.includes(x) && x !== c.p.g);
    await pa.click(`#nx button[data-j="${first}"]`);
    check("色だけで分けない：道の札は出発に▶・いまいる県に●（読み上げにも「〜へ進みました」）", await pa.evaluate(() => getComputedStyle(document.querySelector("#trip b.s"), "::before").content.includes("▶") && getComputedStyle(document.querySelector("#trip b.c"), "::before").content.includes("●")) && /へ進みました/.test(await pa.waitForFunction(() => document.getElementById("live").textContent).then(() => pa.textContent("#live"))));
    await pa.click("#hint");
    c = await curT(pa);
    const hl = await pa.evaluate(() => [...document.querySelectorAll("#mp svg text")].map((t) => t.textContent));
    check("色だけで分けない：ヒントの県は地図の県名とボタンに💡と「ヒント」、知らせ（#live）にも県名", hl.includes("💡" + T.short(c.hint)) && (await pa.textContent("#nx button.hint")).includes("💡") && (await pa.textContent("#nx button.hint")).includes("ヒント") && (await pa.waitForFunction((n) => document.getElementById("live").textContent.includes(n), M.P[c.hint][0]).then(() => true, () => false)));
    // 遠回りして、最短をこえた数を文字でも出す
    const at = c.path[c.path.length - 1], back = c.path[0];
    for (let k = 0; k < 6 && c.moves <= c.p.d; k++) { await pa.click(`#nx button[data-j="${back}"]`); await pa.click(`#nx button[data-j="${at}"]`); c = await curT(pa); }
    check("色だけで分けない：最短の回数をこえたら「最短より+N」と文字でも出す", (await pa.textContent("#left")).includes(`最短より+${c.moves - c.p.d}`));
    await solveNow(pa);
    check("色だけで分けない：着いた知らせを #live に文字で（星の数も）、取れない星は ☆", /に到着。星\dつ/.test(await pa.waitForFunction(() => /到着/.test(document.getElementById("live").textContent)).then(() => pa.textContent("#live"))) && /^☆*$/.test(await pa.textContent(".verdict .stars .off")));
    await pa.click("#back"); await pa.click("#go-dex");
    check("色だけで分けない：県帳のまだの県は「まだ」の文字と破線の枠（薄くするだけにしない）", await pa.evaluate(() => { const d = document.querySelector(".dex .no"); return !!d && d.textContent.includes("まだ") && getComputedStyle(d).borderTopStyle === "dashed" && getComputedStyle(d).opacity === "1"; }));
    await pa.click("#back"); await pa.click("#go-cal");
    check("色だけで分けない：カレンダーの色の見本に★の数も書く", /★★★ 全部最短/.test(await pa.textContent(".legend")) && /★★ ★2以上/.test(await pa.textContent(".legend")));
    // 色の見分けを助ける設定：地図の色をカラーユニバーサルデザインの組に替え、振動を止める設定がある
    await pa.evaluate(() => { localStorage.setItem("a11y-v1", JSON.stringify({ cvd: true, calm: true })); }); await pa.reload();
    await pa.click("#go-d");
    const cv = await pa.evaluate(() => ({ cvd: document.documentElement.classList.contains("a11y-cvd"), s: getComputedStyle(document.querySelector("#mp path.s")).fill, best: (() => { const l = document.createElementNS("http://www.w3.org/2000/svg", "polyline"); l.setAttribute("class", "best"); document.querySelector("#mp svg").append(l); return getComputedStyle(l).stroke; })() }));
    check("「色の見分けを助ける」では出発の県を青・最短の点線を青（#0072B2）に替える", cv.cvd && cv.s === "rgb(143, 200, 238)" && cv.best === "rgb(0, 114, 178)", JSON.stringify(cv));
    check("「動きを減らす」で振動させない・すべるスクロールにしない", /const buzz = \(n = 12\) => \{ if \(calm\(\)\) return;/.test(html) && /behavior: calm\(\) \? "auto" : "smooth"/.test(html));
    await pa.close();
  } catch (e) { check("色だけで分けない検査", false, e.message.split("\n")[0]); }
  try { // 引き継ぎコード（別の端末へ記録を移す。shared-workflows template/qa/transfer-check.mjs）
    await checkTransfer({ browser, url, game: "todofuken-relay", sample: { "todofuken-v1": JSON.stringify({ v: 1, tut: true }) }, check, open: async (p) => { await p.click("#howto-ok", { timeout: 1500 }).catch(() => {}); } });
  } catch (e) { check("引き継ぎコード", false, e.message.split("\n")[0]); }
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し。routines/game-dev.md「だれでも遊べるように」）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 都道府県リレー QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
