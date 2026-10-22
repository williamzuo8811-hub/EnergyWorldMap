#!/usr/bin/env node
/* ============================================================
 * 布局守卫（真实浏览器；可选依赖 playwright —— 找不到就打印 skip 并 exit 0）
 * 用法：  node scripts/test-layout.js
 *         PLAYWRIGHT_CHROMIUM=/path/to/chrome node scripts/test-layout.js   # 指定浏览器可执行文件（CI 用跑器自带 Google Chrome；
 *         ubuntu-latest 26.04 上 playwright install 会拒装 Chromium，所以不下载浏览器）；设了它或 CI=1 时启动失败算真失败
 * ------------------------------------------------------------
 * 用 Node 自带 http 起一个零依赖静态服务器，在 6 种视口打开 au.html / index.html / globe.html / coach.html，断言：
 *   · 页面没有比视口宽（html / body / .app 的 scrollWidth ≤ innerWidth）——澳洲地图的顶栏 nowrap 内容曾把整页
 *     撑宽 93–253px，被 overflow:hidden 悄悄裁掉右栏看板与手机上的 📊 看板浮钮，Node 冒烟测试查不出这种 CSS 回归
 *   · au.html 窄屏：🔍 筛选 / 📊 看板浮钮与 ⤢ 复位钮都在视口内；打开筛选抽屉后 ✕ 收起钮可见，点它能关；
 *     卡片在 Leaflet 控件层之上（z-index > 1000）且底边不压住浮钮；1024 宽时右栏已收成抽屉、地图 ≥ 700px
 *   · index.html 窄屏：展开 ⋯ 工具坞后坞体不掉出视口、底图切换行没被压扁；热力 / 区域洞察模式的底部图例不和浮钮相碰；
 *     详情卡底边不压住浮钮；921–1180：署名不和 📊 浮钮相碰；桌面：热力分面条不被左下角缩放钮盖住
 *   · globe.html：顶栏不比视口宽（360px 手机曾把操作按钮挤出屏外）；桌面图例不被左栏盖住
 *   · coach.html：顶栏不比视口宽、页面不横向溢出，窄屏首屏能看到对练台（模式页签改横条后，对练内容紧随其后）
 *   · 没有 pageerror（globe.gl 在软件渲染下的 WebGL 内部报错除外）
 * 地图瓦片请求一律 abort（离线、快）。失败 exit 1。CI 里作为 advisory job（见 .github/workflows/validate.yml）。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const VIEWPORTS = [[390, 844, true], [844, 390, true], [1024, 768, true], [1280, 720, false], [1440, 900, false], [1920, 1080, false]];
const PAGES = ['au.html', 'index.html', 'globe.html', 'coach.html'];
// coach.html 的访问口令门：已解锁标记（与 coach.html 内联脚本一致）
const COACH_UNLOCK = '7a96764cc44efb32ba02e5ecf68c78740256a25c594e57b1a7972c1a2ecf5677';

function loadPlaywright() {
  const cands = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) { /* next */ } }
  return null;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent((req.url || '/').split('?')[0]);
      let f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

// 页面内通用量具：矩形、是否在视口内、两元素是否相交（都可见时）
const HELPERS = `
  const rectOf = sel => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } : null; };
  const inView = sel => { const r = rectOf(sel); return r ? (r.l >= -0.5 && r.t >= -0.5 && r.r <= innerWidth + 0.5 && r.b <= innerHeight + 0.5) : null; };
  const hit = (a, b) => { const x = rectOf(a), y = rectOf(b); if (!x || !y) return false; return Math.min(x.r, y.r) - Math.max(x.l, y.l) > 2 && Math.min(x.b, y.b) - Math.max(x.t, y.t) > 2; };
  const over = () => { const sw = el => (el ? el.scrollWidth : 0); return Math.max(sw(document.documentElement), sw(document.body), sw(document.querySelector('.app'))) - innerWidth; };
`;
const ev = (pg, body) => pg.evaluate(new Function(HELPERS + body));

(async () => {
  const pw = loadPlaywright();
  if (!pw) { console.log('⚠ 未找到 playwright 模块，跳过布局守卫（本地可 npm i --no-save playwright && npx playwright install chromium）'); process.exit(0); }
  const { srv, port } = await serve();
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  let browser;
  try {
    // PLAYWRIGHT_CHROMIUM 指定可执行文件（CI 用跑器自带的 Google Chrome）；chromiumSandbox:false 兼容容器 / 跑器
    browser = await pw.chromium.launch(Object.assign({ chromiumSandbox: false }, process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}));
  } catch (e) {
    // 明确指定了浏览器（或在 CI 里）却起不来 = 真失败；本地没装浏览器只是跳过
    const hard = !!(process.env.PLAYWRIGHT_CHROMIUM || process.env.CI);
    console.log((hard ? '✘' : '⚠') + ' 浏览器启动失败' + (hard ? '' : '，跳过布局守卫') + '：' + (e && e.message)); srv.close(); process.exit(hard ? 1 : 0);
  }
  for (const page of PAGES) {
    for (const [w, h, mobile] of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN', timezoneId: 'Australia/Sydney' });
      if (page === 'coach.html') await ctx.addInitScript(k => { try { localStorage.setItem('coach_access_v1', k); } catch (e) {} }, COACH_UNLOCK);
      const pg = await ctx.newPage();
      const errors = []; pg.on('pageerror', e => { const s = String(e && e.stack || e); if (page === 'globe.html' && /globe\.gl/.test(s)) return; errors.push(String(e)); });
      await pg.route(/arcgisonline|openstreetmap|autonavi|tianditu/, r => r.abort());
      const tag = page + ' @' + w + 'x' + h;
      const narrow = w <= 820 || (w <= 1180 && h <= 500);   // 与 styles.css / app.js 的「窄屏 OR 矮屏横向」判定一致
      try {
        await pg.goto('http://127.0.0.1:' + port + '/' + page, { waitUntil: 'load' });
        if (page === 'globe.html') await pg.waitForTimeout(1500);   // 不等 WebGL 场景：布局断言只看 DOM
        else await pg.waitForFunction(() => window.__AU__ || window.__APP__ || window.__COACH__, null, { timeout: 20000 });
        await pg.waitForTimeout(800);
        ok((await ev(pg, 'return over()')) <= 0, tag + ' 页面比视口宽 ' + (await ev(pg, 'return over()')) + 'px（顶栏 / 面板最小内容宽度撑开了网格？）');

        if (page === 'au.html') {
          if (w <= 900) {
            ok((await ev(pg, "return inView('#fab-filters')")) !== false, tag + ' 🔍 筛选浮钮不在视口内');
            ok((await ev(pg, "return inView('#fab-dash')")) !== false, tag + ' 📊 看板浮钮不在视口内');
            ok((await ev(pg, "return inView('#btn-home')")) !== false, tag + ' ⤢ 复位钮不在视口内');
            await pg.click('#fab-filters'); await pg.waitForTimeout(400);
            const d = await pg.evaluate(() => { const b = document.getElementById('drawer-close-l'); if (!b) return { btn: null }; const r = b.getBoundingClientRect(); return { btn: r.width > 0 && r.bottom <= window.innerHeight && r.top >= 0, open: document.getElementById('left-panel').classList.contains('open') }; });
            ok(d.btn === true && d.open === true, tag + ' 打开筛选抽屉后 ✕ 收起钮不可见');
            if (d.btn) { await pg.click('#drawer-close-l'); await pg.waitForTimeout(300); ok(!(await pg.evaluate(() => document.getElementById('left-panel').classList.contains('open'))), tag + ' 点 ✕ 收起 后抽屉没关'); }
            // 卡片：在 Leaflet 控件层（1000）之上，整卡在视口内（横屏改右侧竖卡、竖屏底部半屏都不该超出）
            await pg.evaluate(() => { const it = window.__AU__.PIPE.find(x => x.status === 'committed'); window.__AU__.showPipe(it.id); }); await pg.waitForTimeout(400);
            const c = await ev(pg, "const el = document.querySelector('.card.show'); return el ? { z: +getComputedStyle(el).zIndex, v: inView('.card.show') } : null");
            ok(c && c.z > 1000, tag + ' 卡片 z-index 未高于 Leaflet 控件层：' + JSON.stringify(c));
            ok(c && c.v === true, tag + ' 打开的卡片超出视口：' + JSON.stringify(c));
            await pg.evaluate(() => window.__AU__.hideCard && window.__AU__.hideCard()); await pg.waitForTimeout(200);
          } else if (w <= 1180) {
            // iPad 横屏档：右栏已收成抽屉（📊 浮钮可见），地图不再只剩 444px
            ok((await ev(pg, "return inView('#fab-dash')")) === true, tag + ' 📊 看板浮钮应可见（右栏应为抽屉）');
            const mw = await ev(pg, "const r = rectOf('#map'); return r ? r.w : 0");
            ok(mw >= 700, tag + ' 地图区宽度仅 ' + mw + 'px（右栏没收成抽屉？）');
            await pg.click('#fab-dash'); await pg.waitForTimeout(400);
            ok(await pg.evaluate(() => document.getElementById('right-panel').classList.contains('open')), tag + ' 点 📊 后右侧抽屉没开');
            ok((await ev(pg, "return inView('#drawer-close-r')")) === true, tag + ' 右侧抽屉的 ✕ 收起钮不可见');
            await pg.click('#drawer-close-r'); await pg.waitForTimeout(300);
          } else {
            // 桌面：KPI 不被顶栏操作条盖住（1366 笔记本曾把「承诺+预期管线」压在 📅 AEMO 胶囊底下）
            ok(!(await ev(pg, "return hit('.kpis', '.top-actions')")), tag + ' 顶栏 KPI 与操作条相交');
          }
        }

        if (page === 'index.html') {
          if (narrow) {
            ok((await ev(pg, "return inView('#fab-filters')")) !== false, tag + ' 🔍 筛选浮钮不在视口内');
            ok((await ev(pg, "return inView('#fab-stats')")) !== false, tag + ' 📊 统计浮钮不在视口内');
            // ⋯ 工具坞：展开后坞体不掉出视口（底边让开浮钮行），底图切换行没被压扁
            await pg.click('#tools-toggle'); await pg.waitForTimeout(300);
            const t = await ev(pg, "const m = rectOf('.map-tools'), b = rectOf('.basemap-switch'), f = rectOf('#fab-stats'); return { mb: m && m.b, fb: f && f.t, bh: b && b.h, z: rectOf('.leaflet-control-zoom'), hitZoom: hit('.map-tools', '.leaflet-control-zoom') }");
            ok(t.mb != null && t.mb <= innerH(h), tag + ' 展开的工具坞掉出视口：' + JSON.stringify(t));
            ok(t.bh != null && t.bh >= 28, tag + ' 底图切换行被压扁：' + JSON.stringify(t));
            ok(!t.hitZoom, tag + ' 展开的工具坞压住缩放 ＋/－');
            await pg.click('#tools-toggle'); await pg.waitForTimeout(200);
            // 详情卡底边不压住浮钮
            await pg.evaluate(() => { const p = window.__APP__.PROJECTS.find(x => x.flagship && x.coord) || window.__APP__.PROJECTS[0]; window.__APP__.showDetail(p); }); await pg.waitForTimeout(400);
            ok(!(await ev(pg, "return hit('.detail.show', '#fab-filters') || hit('.detail.show', '#fab-stats')")), tag + ' 详情卡压住底部浮钮');
            ok((await ev(pg, "return inView('.detail.show')")) === true, tag + ' 详情卡超出视口');
            await pg.evaluate(() => { const c = document.querySelector('.detail .d-close'); if (c) c.click(); }); await pg.waitForTimeout(200);
            // 热力模式：分面条 / 图例让开浮钮
            await pg.evaluate(() => document.getElementById('btn-heat').click()); await pg.waitForTimeout(500);
            ok(!(await ev(pg, "return hit('.heat-facets', '#fab-filters') || hit('.heat-facets', '#fab-stats') || hit('.heat-legend', '#fab-filters') || hit('.heat-legend', '#fab-stats') || hit('.heat-legend', '.heat-facets')")), tag + ' 热力分面条 / 图例与浮钮（或彼此）相交');
            await pg.evaluate(() => document.getElementById('btn-heat').click()); await pg.waitForTimeout(200);
            // 区域洞察模式（懒加载国界后渲染图例）
            await pg.evaluate(() => document.getElementById('btn-region').click()); await pg.waitForTimeout(1500);
            ok(!(await ev(pg, "return hit('.region-legend', '#fab-filters') || hit('.region-legend', '#fab-stats')")), tag + ' 大区图例与浮钮相交');
            await pg.evaluate(() => document.getElementById('btn-region').click()); await pg.waitForTimeout(200);
          } else if (w <= 1180) {
            ok(!(await ev(pg, "return hit('.map-credit', '#fab-stats')")), tag + ' 署名胶囊被 📊 浮钮压住');
          } else {
            await pg.evaluate(() => document.getElementById('btn-heat').click()); await pg.waitForTimeout(500);
            ok(!(await ev(pg, "return hit('.heat-facets', '.leaflet-control-zoom')")), tag + ' 热力分面条被左下角缩放钮盖住');
            ok(!(await ev(pg, "return hit('.heat-legend', '.map-hint')")), tag + ' 热力图例与操作提示条相交');
            await pg.evaluate(() => document.getElementById('btn-heat').click()); await pg.waitForTimeout(200);
          }
        }

        if (page === 'globe.html') {
          const tb = await ev(pg, "const el = document.querySelector('.topbar'); return el ? el.scrollWidth - el.clientWidth : 0");
          ok(tb <= 0, tag + ' 顶栏内容比视口宽 ' + tb + 'px（操作按钮被挤出屏外？）');
          if (w > 820) ok(!(await ev(pg, "return hit('.legend', '.left-panel')")), tag + ' 底部图例被左栏盖住');
        }

        if (page === 'coach.html') {
          const tb = await ev(pg, "const el = document.querySelector('.topbar'); return el ? el.scrollWidth - el.clientWidth : 0");
          ok(tb <= 0, tag + ' 顶栏内容比视口宽 ' + tb + 'px');
          if (w <= 860) {
            const dt = await ev(pg, "const r = rectOf('.deck'); return r ? r.t : null");
            ok(dt != null && dt < h, tag + ' 窄屏首屏看不到对练台（.deck top=' + dt + '）');
          }
        }

        ok(!errors.length, tag + ' pageerror：' + errors.join(' | '));
        console.log((fails.length ? '  ' : '  ✔ ') + tag);
      } catch (e) { fails.push(tag + ' 加载 / 断言抛错：' + (e && e.message)); }
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  if (fails.length) { console.error('✘ test-layout 失败：\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('✔ test-layout 通过：' + PAGES.length + ' 页 × ' + VIEWPORTS.length + ' 视口，无溢出、浮钮 / 卡片 / 图例互不相压、抽屉可关、无 pageerror');
})().catch(e => { console.error('✘ test-layout 异常：', e && e.stack || e); process.exit(1); });

function innerH(h) { return h + 0.5; }
