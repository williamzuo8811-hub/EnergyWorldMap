#!/usr/bin/env node
/* ============================================================
 * sw.js（Service Worker）策略单测（零依赖，Node ≥18：用内置 Request / Response，自造 caches / self 桩）
 * 用法：  node scripts/test-sw.js
 * ------------------------------------------------------------
 * 断言：
 *   · 导航 network-first：HTML 没变 → 已缓存的 JS/CSS 保留（重访仍秒开）
 *   · 部署检测：HTML 变了（ETag 不同，或无 ETag 时正文不同）→ 已缓存的同源 JS/CSS 全部清掉，图片 / manifest 不动，HTML 更新
 *   · ETag 相同而正文不同（代理注入）→ 不误判为部署
 *   · 离线导航 → 回退缓存的 HTML
 *   · 静态资源：缓存键剥离 ?v=，先回缓存、后台更新；无缓存时走网络
 *   · 跨域请求不拦截
 * ============================================================ */
'use strict';
const path = require('path');
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const ORIGIN = 'https://example.test';

/* ---------- 桩：caches / self / fetch ---------- */
const store = new Map();   // key(url string) → Response
const cacheObj = {
  async match(k) { const r = store.get(typeof k === 'string' ? (k.startsWith('http') ? k : ORIGIN + '/' + k.replace(/^\.\//, '')) : k.url); return r ? r.clone() : undefined; },
  async put(k, res) { store.set(typeof k === 'string' ? k : k.url, res); },
  async keys() { return [...store.keys()].map(u => ({ url: u })); },
  async delete(r) { return store.delete(typeof r === 'string' ? r : r.url); },
  async add() { /* install 预缓存：测试里不关心 */ },
};
global.caches = { open: async () => cacheObj, keys: async () => ['ewm-cache-v1', 'ewm-cache-v2', 'other'], delete: async () => true };
const handlers = {};
global.self = { addEventListener: (t, fn) => { handlers[t] = fn; }, location: { origin: ORIGIN }, skipWaiting() {}, clients: { claim: async () => {} } };
let netMap = {};   // url → () => Response | throws
let fetchLog = [];
// 浏览器里同源响应的 type 是 'basic'（sw.js 据此决定是否写缓存）；Node 的 Response.type 恒为 'default'，这里补上
global.fetch = async (req) => { const u = typeof req === 'string' ? req : req.url; fetchLog.push(u); const f = netMap[u.split('?')[0]]; if (!f) throw new Error('offline ' + u); const res = f(); Object.defineProperty(res, 'type', { value: 'basic' }); return res; };

require(path.join(__dirname, '..', 'sw.js'));
ok(typeof handlers.fetch === 'function' && typeof handlers.install === 'function' && typeof handlers.activate === 'function', 'sw.js 注册了 install / activate / fetch');

const mkRes = (body, h) => new Response(body, { status: 200, headers: Object.assign({ 'content-type': 'text/plain' }, h || {}) });
const seed = async () => {
  store.clear();
  await cacheObj.put(ORIGIN + '/au.html', mkRes('<html>v1</html>', { etag: '"h1"' }));
  await cacheObj.put(ORIGIN + '/js/au.js', mkRes('old js'));
  await cacheObj.put(ORIGIN + '/css/au.css', mkRes('old css'));
  await cacheObj.put(ORIGIN + '/assets/icon-192.png', mkRes('png'));
  await cacheObj.put(ORIGIN + '/manifest.json', mkRes('{}'));
};
async function navigate(url) {
  // Node 的 Request 不接受 mode:'navigate'；sw.js 只读 req.url / req.method / req.mode 并把 req 交给 fetch 桩，用普通对象即可
  const ev = { request: { url, method: 'GET', mode: 'navigate' }, respondWith(p) { ev.result = p; }, waitUntil() {} };
  handlers.fetch(ev);
  return ev.result ? await ev.result : null;
}
async function asset(url) {
  const ev = { request: new Request(url), respondWith(p) { ev.result = p; }, waitUntil(p) { ev.bg = p; } };
  handlers.fetch(ev);
  const res = ev.result ? await ev.result : null;
  if (ev.bg) await ev.bg;
  return res;
}

(async () => {
  // 1) HTML 没变（ETag 相同）→ 不清资源
  await seed(); netMap = { [ORIGIN + '/au.html']: () => mkRes('<html>v1</html>', { etag: '"h1"' }) };
  let r = await navigate(ORIGIN + '/au.html');
  ok(r && (await r.text()) === '<html>v1</html>', '导航返回网络 HTML');
  ok(store.has(ORIGIN + '/js/au.js') && store.has(ORIGIN + '/css/au.css'), 'HTML 未变：已缓存 JS/CSS 保留');

  // 2) 部署：ETag 变了 → JS/CSS 清空，图片 / manifest 保留，HTML 更新
  await seed(); netMap = { [ORIGIN + '/au.html']: () => mkRes('<html>v2</html>', { etag: '"h2"' }) };
  r = await navigate(ORIGIN + '/au.html');
  ok(!store.has(ORIGIN + '/js/au.js') && !store.has(ORIGIN + '/css/au.css'), '部署检测（ETag 变）：已缓存 JS/CSS 被清掉');
  ok(store.has(ORIGIN + '/assets/icon-192.png') && store.has(ORIGIN + '/manifest.json'), '部署检测：图片 / manifest 不动');
  ok((await (await cacheObj.match(ORIGIN + '/au.html')).text()) === '<html>v2</html>', '部署检测：缓存的 HTML 更新为新版');

  // 3) 无 ETag：比正文
  await seed(); await cacheObj.put(ORIGIN + '/au.html', mkRes('<html>v1</html>'));
  netMap = { [ORIGIN + '/au.html']: () => mkRes('<html>v3</html>') };
  await navigate(ORIGIN + '/au.html');
  ok(!store.has(ORIGIN + '/js/au.js'), '部署检测（无 ETag，正文变）：JS 被清掉');
  await seed(); await cacheObj.put(ORIGIN + '/au.html', mkRes('<html>v1</html>'));
  netMap = { [ORIGIN + '/au.html']: () => mkRes('<html>v1</html>') };
  await navigate(ORIGIN + '/au.html');
  ok(store.has(ORIGIN + '/js/au.js'), '无 ETag 正文相同：不清');

  // 4) ETag 相同、正文不同（代理注入）→ 不误判
  await seed(); netMap = { [ORIGIN + '/au.html']: () => mkRes('<html>v1 + injected</html>', { etag: '"h1"' }) };
  await navigate(ORIGIN + '/au.html');
  ok(store.has(ORIGIN + '/js/au.js'), 'ETag 相同（代理注入正文）：不误判为部署');

  // 5) 离线导航 → 缓存 HTML
  await seed(); netMap = {};
  r = await navigate(ORIGIN + '/au.html');
  ok(r && (await r.text()) === '<html>v1</html>', '离线导航回退缓存 HTML');

  // 6) 静态资源：键剥离 ?v=，先回缓存后台更新
  await seed(); fetchLog = []; netMap = { [ORIGIN + '/js/au.js']: () => mkRes('new js') };
  r = await asset(ORIGIN + '/js/au.js?v=7');
  ok(r && (await r.text()) === 'old js', '资源：先返回缓存（?v= 被剥离后命中）');
  ok(fetchLog.length === 1 && (await (await cacheObj.match(ORIGIN + '/js/au.js')).text()) === 'new js', '资源：后台已更新缓存');
  store.delete(ORIGIN + '/js/au.js');
  r = await asset(ORIGIN + '/js/au.js?v=7');
  ok(r && (await r.text()) === 'new js', '资源：无缓存时走网络');

  // 7) 跨域不拦截
  const ev = { request: new Request('https://tile.openstreetmap.org/1/1/1.png'), respondWith() { ev.hit = true; }, waitUntil() {} };
  handlers.fetch(ev);
  ok(!ev.hit, '跨域瓦片请求不拦截');

  if (fails.length) { console.error('✘ test-sw 失败：\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('✔ test-sw 通过：导航 network-first + 部署检测清 JS/CSS（ETag / 正文）· 离线回退 · 资源 stale-while-revalidate（剥离 ?v=）· 跨域放行');
})().catch(e => { console.error('✘ test-sw 异常：', e && e.stack || e); process.exit(1); });
