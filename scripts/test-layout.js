#!/usr/bin/env node
/* ============================================================
 * 布局守卫（真实浏览器；可选依赖 playwright —— 找不到就打印 skip 并 exit 0）
 * 用法：  node scripts/test-layout.js
 *         PLAYWRIGHT_CHROMIUM=/path/to/chrome node scripts/test-layout.js   # 指定浏览器可执行文件（CI 用跑器自带 Google Chrome；
 *         ubuntu-latest 26.04 上 playwright install 会拒装 Chromium，所以不下载浏览器）；设了它或 CI=1 时启动失败算真失败
 * ------------------------------------------------------------
 * 用 Node 自带 http 起一个零依赖静态服务器，在 7 种视口打开 au.html（中文 + 桌面档再跑一遍英文）/ index.html / globe.html / coach.html，断言：
 *   · 页面没有比视口宽（html / body / .app 的 scrollWidth ≤ innerWidth）——澳洲地图的顶栏 nowrap 内容曾把整页
 *     撑宽 93–253px，被 overflow:hidden 悄悄裁掉右栏看板与手机上的 📊 看板浮钮，Node 冒烟测试查不出这种 CSS 回归
 *   · au.html 窄屏：🔍 筛选 / 📊 看板浮钮与 ⤢ 复位钮都在视口内；打开筛选抽屉后 ✕ 收起钮可见，点它能关；
 *     卡片在 Leaflet 控件层之上（z-index > 1000）且底边不压住浮钮；开卡飞到的点落在卡片没盖住的那片；1024 宽时右栏已收成抽屉、地图 ≥ 700px
 *   · au.html 桌面（1280–1920，中英文）：KPI 不溢出自己的盒子、任一 KPI 都不和操作条相交、副标没被截断
 *     （旧的 ≤1500 / ≤1400 断点在 1536 中文 / 任何宽度英文下都把「承诺+预期管线」压到 📅 AEMO 胶囊底下；
 *     hit('.kpis', '.top-actions') 量的是盒子、看不见溢出的子元素，所以这里逐个 KPI 量）；开卡飞到的点落在卡片左侧
 *   · index.html 窄屏：展开 ⋯ 工具坞后坞体不掉出视口、底图切换行没被压扁；热力 / 区域洞察模式的底部图例不和浮钮相碰；
 *     详情卡底边不压住浮钮；竖屏手机的详情卡是底部半屏（贴地图底边、z > 1000、开卡时浮钮隐藏、关卡恢复），flyTo / 点圆点开卡后
 *     目标点落在卡片上方；热力图例单行（left:50% 的绝对定位可用宽度只有半屏，360px 上曾折成两行）；大区图例 10 个芯片全部可见；
 *     长 toast 不按半屏宽折行；≤560 国别面板头的国家名不被按钮挤成一列字；921–1180：署名不和 📊 浮钮相碰；
 *     桌面（中英文）：热力分面条不被左下角缩放钮盖住、底部提示条不压署名胶囊 / 缩放钮（1280–1536 曾叠在一起）
 *   · au.html 1920：首屏（fitAU 落在缩放 5）不画 REZ 区名标签（固定 ≥5 时东海岸 ~40 个标签叠成一团），放大一级后出现
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
// 1536×864 = 1920 屏 125% 缩放（最常见的 Windows 笔记本），正是顶栏 KPI 被 📅 胶囊盖住的宽度带
const VIEWPORTS = [[390, 844, true], [844, 390, true], [1024, 768, true], [1280, 720, false], [1440, 900, false], [1536, 864, false], [1920, 1080, false]];
// au.html 的英文档只跑桌面视口（标签更宽，顶栏最容易放不下）
const PAGES = ['au.html', 'au.html#lang=en', 'index.html', 'index.html#lang=en', 'globe.html', 'coach.html'];
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
  const rectOf = sel => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } : null; };
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
      const isAU = page.startsWith('au.html'); const isIndex = page.startsWith('index.html');
      if (page.includes('#lang=en') && w <= 1180) continue;
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

        if (isAU) {
          // 开卡后飞行：目标点应落在卡片没盖住的那片（桌面右侧卡 → 卡片左边；手机竖屏底部半屏 → 卡片上方）
          const flyCheck = async () => {
            await pg.evaluate(() => { const it = window.__AU__.PIPE.find(x => x.status === 'committed' && !x.approx) || window.__AU__.PIPE[0]; window.__AU__.showPipe(it.id); });
            await pg.waitForTimeout(1700);   // flyTo 1.1s
            return pg.evaluate(() => { const A = window.__AU__, it = A.state.card && A.PIPE.find(x => x.id === A.state.card.id); if (!it) return null; const p = A.map.latLngToContainerPoint([it.coord[1], it.coord[0]]); const c = document.querySelector('.card.show').getBoundingClientRect(), m = document.getElementById('map').getBoundingClientRect(); return { x: Math.round(p.x), y: Math.round(p.y), cardL: Math.round(c.left - m.left), cardT: Math.round(c.top - m.top), mw: Math.round(m.width), mh: Math.round(m.height) }; });
          };
          if (w <= 900) {
            ok((await ev(pg, "return inView('#fab-filters')")) !== false, tag + ' 🔍 筛选浮钮不在视口内');
            ok((await ev(pg, "return inView('#fab-dash')")) !== false, tag + ' 📊 看板浮钮不在视口内');
            ok((await ev(pg, "return inView('#btn-home')")) !== false, tag + ' ⤢ 复位钮不在视口内');
            // 两行顶栏：标题可见（不被挤成 0 宽）、操作条在标题行下方（≤900 的 flex-wrap 曾靠 ≤1400 的规则供给，改成 .kpi-wrap 类后掉过）
            const tb = await ev(pg, "const h = rectOf('.brand h1'), a = rectOf('.top-actions'), b = rectOf('.brand'); return { h1w: h ? Math.round(h.w) : 0, actT: a ? Math.round(a.t) : null, brandB: b ? Math.round(b.b) : null }");
            ok(tb.h1w > 60 && tb.actT != null && tb.actT >= tb.brandB - 2, tag + ' 手机顶栏没有换成两行（标题被挤没 / 操作条没在第二行）：' + JSON.stringify(tb));
            await pg.click('#fab-filters'); await pg.waitForTimeout(400);
            const d = await pg.evaluate(() => { const b = document.getElementById('drawer-close-l'); if (!b) return { btn: null }; const r = b.getBoundingClientRect(); return { btn: r.width > 0 && r.bottom <= window.innerHeight && r.top >= 0, open: document.getElementById('left-panel').classList.contains('open') }; });
            ok(d.btn === true && d.open === true, tag + ' 打开筛选抽屉后 ✕ 收起钮不可见');
            if (d.btn) { await pg.click('#drawer-close-l'); await pg.waitForTimeout(300); ok(!(await pg.evaluate(() => document.getElementById('left-panel').classList.contains('open'))), tag + ' 点 ✕ 收起 后抽屉没关'); }
            // 卡片：在 Leaflet 控件层（1000）之上，整卡在视口内（横屏改右侧竖卡、竖屏底部半屏都不该超出）
            await pg.evaluate(() => { const it = window.__AU__.PIPE.find(x => x.status === 'committed'); window.__AU__.showPipe(it.id); }); await pg.waitForTimeout(400);
            const c = await ev(pg, "const el = document.querySelector('.card.show'); return el ? { z: +getComputedStyle(el).zIndex, v: inView('.card.show') } : null");
            ok(c && c.z > 1000, tag + ' 卡片 z-index 未高于 Leaflet 控件层：' + JSON.stringify(c));
            ok(c && c.v === true, tag + ' 打开的卡片超出视口：' + JSON.stringify(c));
            if (h > w) { const fc = await flyCheck(); ok(fc && fc.y > 0 && fc.y < fc.cardT, tag + ' 竖屏开卡后目标点被底部卡片盖住：' + JSON.stringify(fc)); }
            await pg.evaluate(() => { const b = document.querySelector('.card .d-close'); if (b) b.click(); }); await pg.waitForTimeout(200);
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
            // 桌面：KPI 不溢出自己的盒子、不被顶栏操作条盖住、副标没被截断（1536 中文 / 任何宽度英文曾把「承诺+预期管线」压在 📅 AEMO 胶囊底下）
            const k = await ev(pg, "const kp = document.querySelector('.kpis'), sub = document.querySelector('.brand .sub'); return { over: kp.scrollWidth - kp.clientWidth, hitAny: [...document.querySelectorAll('.kpi')].some(x => hit(x, '.top-actions')), subCut: sub && getComputedStyle(sub).display !== 'none' ? sub.scrollWidth - sub.clientWidth : 0, wrap: document.querySelector('.topbar').className }");
            ok(k.over <= 1 && !k.hitAny, tag + ' 顶栏 KPI 溢出 / 压到操作条底下：' + JSON.stringify(k));
            ok(k.subCut <= 1, tag + ' 顶栏副标被截断：' + JSON.stringify(k));
            const fc = await flyCheck(); ok(fc && fc.x > 0 && fc.x < fc.cardL, tag + ' 开卡后目标点被右侧卡片盖住：' + JSON.stringify(fc));
            await pg.evaluate(() => { const b = document.querySelector('.card .d-close'); if (b) b.click(); }); await pg.waitForTimeout(200);
            // 首屏不画 REZ 区名（1920 宽屏 fitAU 落在缩放 5，阈值固定 ≥5 时东海岸 ~40 个标签叠成一团）；放大一级后出现
            await pg.evaluate(() => { const A = window.__AU__; A.map.fitBounds([[-44.5, 111.5], [-9.5, 155]], { padding: [10, 10], animate: false }); A.render(); }); await pg.waitForTimeout(300);
            const rz0 = await pg.evaluate(() => document.querySelectorAll('.rez-lab').length);
            ok(rz0 === 0, tag + ' 首屏就画了 ' + rz0 + ' 个 REZ 区名标签');
            await pg.evaluate(() => { const A = window.__AU__; A.map.setView([-33, 150], A.map.getZoom() + 1.5, { animate: false }); }); await pg.waitForTimeout(400);
            ok((await pg.evaluate(() => document.querySelectorAll('.rez-lab').length)) > 0, tag + ' 放大后仍没有 REZ 区名标签');
          }
        }

        if (isIndex) {
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
            // 详情卡：底边不压住浮钮、整卡在视口内；竖屏手机 = 底部半屏（贴地图底边、z > 1000、浮钮隐藏），flyTo 的目标点落在卡片上方
            await pg.evaluate(() => { const A = window.__APP__; const p = A.PROJECTS.find(x => x.flagship && x.coord && x.country === '沙特阿拉伯') || A.PROJECTS[0]; A.showDetail(p); A.flyTo(A.toLatLng(p.coord), 6, { duration: 0.3 }); }); await pg.waitForTimeout(900);
            ok(!(await ev(pg, "return hit('.detail.show', '#fab-filters') || hit('.detail.show', '#fab-stats')")), tag + ' 详情卡压住底部浮钮');
            ok((await ev(pg, "return inView('.detail.show')")) === true, tag + ' 详情卡超出视口');
            const dc = await pg.evaluate(() => { const A = window.__APP__; const p = A.PROJECTS.find(x => x.flagship && x.coord && x.country === '沙特阿拉伯') || A.PROJECTS[0]; const c = document.querySelector('.detail.show').getBoundingClientRect(), m = document.getElementById('map').getBoundingClientRect(); const pt = A.map.latLngToContainerPoint(A.toLatLng(p.coord)); return { l: Math.round(c.left - m.left), t: Math.round(c.top - m.top), r: Math.round(c.right - m.left), b: Math.round(c.bottom - m.top), mw: Math.round(m.width), mh: Math.round(m.height), x: Math.round(pt.x), y: Math.round(pt.y), z: +getComputedStyle(document.querySelector('.detail')).zIndex, fab: getComputedStyle(document.getElementById('fab-filters')).display }; });
            const covered = dc.x > dc.l && dc.x < dc.r && dc.y > dc.t && dc.y < dc.b;
            ok(!covered, tag + ' 开卡飞行后目标点被详情卡盖住：' + JSON.stringify(dc));
            if (h > w) {
              ok(dc.l <= 1 && dc.r >= dc.mw - 1 && dc.b >= dc.mh - 1 && dc.t > dc.mh * 0.25, tag + ' 竖屏详情卡不是贴底的半屏卡：' + JSON.stringify(dc));
              ok(dc.z > 1000 && dc.fab === 'none', tag + ' 竖屏半屏卡应高于 Leaflet 控件层且开卡时隐藏浮钮：' + JSON.stringify(dc));
              // 点圆点开卡：被卡片盖住的圆点要被挪到卡片上方
              await pg.evaluate(() => { document.querySelector('.detail .d-close').click(); window.__APP__.map.setView([24.7, 46.7], 7, { animate: false }); }); await pg.waitForTimeout(600);
              const mk = await pg.evaluate(() => { const m = document.getElementById('map').getBoundingClientRect(); const mk = [...document.querySelectorAll('.leaflet-marker-pane .mk')].map(el => ({ el, r: el.getBoundingClientRect() })).filter(x => x.r.width > 0 && x.r.top > m.top + 60 && x.r.bottom < m.bottom).sort((a, b) => b.r.top - a.r.top)[0]; if (!mk) return null; mk.el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; });
              if (mk) { await pg.waitForTimeout(800); const mv = await pg.evaluate(() => { const A = window.__APP__; const nm = document.querySelector('.detail.show .d-name'); const p = nm && A.PROJECTS.find(x => nm.textContent.replace('★ ', '').trim() === x.name); if (!p) return null; const c = document.querySelector('.detail.show').getBoundingClientRect(), m = document.getElementById('map').getBoundingClientRect(); const pt = A.map.latLngToContainerPoint(A.toLatLng(p.coord)); return { y: Math.round(pt.y), cardT: Math.round(c.top - m.top) }; }); ok(mv && mv.y > 0 && mv.y < mv.cardT, tag + ' 点圆点开卡后圆点仍被半屏卡盖住：' + JSON.stringify(mv)); }
            }
            await pg.evaluate(() => { const c = document.querySelector('.detail .d-close'); if (c) c.click(); }); await pg.waitForTimeout(200);
            ok((await ev(pg, "return getComputedStyle(document.getElementById('fab-filters')).display")) !== 'none', tag + ' 关卡后浮钮没有恢复');
            // 长 toast：left:50% 的绝对定位元素可用宽度只有容器一半，没有 width:max-content 时按半屏宽折行
            await pg.evaluate(() => document.getElementById('btn-share').click()); await pg.waitForTimeout(250);
            const tw = await ev(pg, "const r = rectOf('.toast.show'); return r ? { w: r.w, h: r.h } : null");
            ok(tw && tw.h < 44, tag + ' toast 被折成多行：' + JSON.stringify(tw));
            // ≤560 国别面板头：国家名独占首行（宽 ≥ 100px），📍 / ⊕ 按钮换到第二行
            if (w <= 560) {
              await pg.evaluate(() => window.__APP__.showCountry('沙特阿拉伯')); await pg.waitForTimeout(400);
              const ch = await ev(pg, "const n = rectOf('.cp-head .cp-name'), f = rectOf('.cp-head .cp-filter'); return { nw: n && n.w, nb: n && n.b, ft: f && f.t }");
              ok(ch.nw >= 100 && ch.ft != null && ch.ft >= ch.nb - 2, tag + ' 国别面板头：国家名被按钮挤扁 / 按钮没换行：' + JSON.stringify(ch));
              await pg.evaluate(() => { const c = document.getElementById('cp-close'); if (c) c.click(); }); await pg.waitForTimeout(200);
            }
            // 热力模式：分面条 / 图例让开浮钮
            await pg.evaluate(() => document.getElementById('btn-heat').click()); await pg.waitForTimeout(500);
            ok(!(await ev(pg, "return hit('.heat-facets', '#fab-filters') || hit('.heat-facets', '#fab-stats') || hit('.heat-legend', '#fab-filters') || hit('.heat-legend', '#fab-stats') || hit('.heat-legend', '.heat-facets')")), tag + ' 热力分面条 / 图例与浮钮（或彼此）相交');
            const hl = await ev(pg, "const r = rectOf('#heat-legend'); return r ? r.h : null");
            ok(hl != null && hl < 40, tag + ' 顶部热力图例被折成两行（高 ' + hl + 'px）');
            await pg.evaluate(() => document.getElementById('btn-heat').click()); await pg.waitForTimeout(200);
            // 区域洞察模式（懒加载国界后渲染图例）
            await pg.evaluate(() => document.getElementById('btn-region').click()); await pg.waitForTimeout(1500);
            ok(!(await ev(pg, "return hit('.region-legend', '#fab-filters') || hit('.region-legend', '#fab-stats')")), tag + ' 大区图例与浮钮相交');
            const rl = await ev(pg, "const box = document.querySelector('.region-legend .rl-chips'); if (!box) return null; const b = box.getBoundingClientRect(); return [...box.querySelectorAll('.rl-chip')].filter(c => c.getBoundingClientRect().bottom > b.bottom + 1).length");
            ok(rl === 0, tag + ' 大区图例有 ' + rl + ' 个芯片被裁掉（滚动容器太矮）');
            await pg.evaluate(() => document.getElementById('btn-region').click()); await pg.waitForTimeout(200);
          } else if (w <= 1180) {
            ok(!(await ev(pg, "return hit('.map-credit', '#fab-stats')")), tag + ' 署名胶囊被 📊 浮钮压住');
          } else {
            // 底部居中的操作提示条不压右下角署名 / 左下角缩放钮（1280–1536 中英文曾叠在一起；英文更长）
            ok(!(await ev(pg, "return hit('.map-hint', '.map-credit') || hit('.map-hint', '.leaflet-control-zoom')")), tag + ' 操作提示条压住署名胶囊 / 缩放钮');
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
  console.log('✔ test-layout 通过：' + PAGES.length + ' 页 × ' + VIEWPORTS.length + ' 视口，无溢出、顶栏 KPI 不压操作条、浮钮 / 卡片 / 图例互不相压、开卡飞行避开卡片、抽屉可关、无 pageerror');
})().catch(e => { console.error('✘ test-layout 异常：', e && e.stack || e); process.exit(1); });

function innerH(h) { return h + 0.5; }
