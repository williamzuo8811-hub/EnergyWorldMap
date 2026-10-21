#!/usr/bin/env node
/* ============================================================
 * 布局守卫（真实浏览器；可选依赖 playwright —— 找不到就打印 skip 并 exit 0）
 * 用法：  node scripts/test-layout.js
 *         PLAYWRIGHT_CHROMIUM=/path/to/chrome node scripts/test-layout.js   # 指定浏览器可执行文件（CI 用跑器自带 Google Chrome；
 *         ubuntu-latest 26.04 上 playwright install 会拒装 Chromium，所以不下载浏览器）；设了它或 CI=1 时启动失败算真失败
 * ------------------------------------------------------------
 * 用 Node 自带 http 起一个零依赖静态服务器，在 6 种视口打开 au.html 与 index.html，断言：
 *   · 页面没有比视口宽（html / body / .app 的 scrollWidth ≤ innerWidth）——澳洲地图的顶栏 nowrap 内容曾把整页
 *     撑宽 93–253px，被 overflow:hidden 悄悄裁掉右栏看板与手机上的 📊 看板浮钮，Node 冒烟测试查不出这种 CSS 回归
 *   · au.html 窄屏：🔍 筛选 / 📊 看板浮钮与 ⤢ 复位钮都在视口内；打开筛选抽屉后 ✕ 收起钮可见，点它能关
 *   · 两页都没有 pageerror
 * 地图瓦片请求一律 abort（离线、快）。失败 exit 1。CI 里作为 advisory job（见 .github/workflows/validate.yml）。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const VIEWPORTS = [[390, 844, true], [844, 390, true], [1024, 768, true], [1280, 720, false], [1440, 900, false], [1920, 1080, false]];
const PAGES = ['au.html', 'index.html'];

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
      const pg = await ctx.newPage();
      const errors = []; pg.on('pageerror', e => errors.push(String(e)));
      await pg.route(/arcgisonline|openstreetmap|autonavi|tianditu/, r => r.abort());
      const tag = page + ' @' + w + 'x' + h;
      try {
        await pg.goto('http://127.0.0.1:' + port + '/' + page, { waitUntil: 'load' });
        await pg.waitForFunction(() => window.__AU__ || window.__APP__, null, { timeout: 20000 });
        await pg.waitForTimeout(800);
        const m = await pg.evaluate(() => {
          const sw = el => (el ? el.scrollWidth : 0);
          const over = Math.max(sw(document.documentElement), sw(document.body), sw(document.querySelector('.app'))) - window.innerWidth;
          const inView = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5; };
          return { over, fabL: inView('#fab-filters'), fabR: inView('#fab-dash') != null ? inView('#fab-dash') : inView('#fab-stats'), home: inView('#btn-home') };
        });
        ok(m.over <= 0, tag + ' 页面比视口宽 ' + m.over + 'px（顶栏 / 面板最小内容宽度撑开了网格？）');
        if (w <= 900) {
          ok(m.fabL !== false, tag + ' 🔍 筛选浮钮不在视口内');
          ok(m.fabR !== false, tag + ' 📊 看板浮钮不在视口内');
          if (page === 'au.html') {
            ok(m.home !== false, tag + ' ⤢ 复位钮不在视口内');
            await pg.click('#fab-filters'); await pg.waitForTimeout(400);
            const d = await pg.evaluate(() => { const b = document.getElementById('drawer-close-l'); if (!b) return { btn: null }; const r = b.getBoundingClientRect(); return { btn: r.width > 0 && r.bottom <= window.innerHeight && r.top >= 0, open: document.getElementById('left-panel').classList.contains('open') }; });
            ok(d.btn === true && d.open === true, tag + ' 打开筛选抽屉后 ✕ 收起钮不可见');
            if (d.btn) { await pg.click('#drawer-close-l'); await pg.waitForTimeout(300); ok(!(await pg.evaluate(() => document.getElementById('left-panel').classList.contains('open'))), tag + ' 点 ✕ 收起 后抽屉没关'); }
          }
        }
        ok(!errors.length, tag + ' pageerror：' + errors.join(' | '));
        console.log((fails.length ? '  ' : '  ✔ ') + tag + ' 溢出 ' + m.over + 'px');
      } catch (e) { fails.push(tag + ' 加载 / 断言抛错：' + (e && e.message)); }
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  if (fails.length) { console.error('✘ test-layout 失败：\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('✔ test-layout 通过：' + PAGES.length + ' 页 × ' + VIEWPORTS.length + ' 视口，无溢出、浮钮在视口内、抽屉可关、无 pageerror');
})().catch(e => { console.error('✘ test-layout 异常：', e && e.stack || e); process.exit(1); });
