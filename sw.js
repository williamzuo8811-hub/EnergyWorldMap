/* ============================================================
 * 全球能源项目世界地图 —— Service Worker（离线 + 秒开重访）
 * ------------------------------------------------------------
 * 纯静态零构建站点。除地图瓦片外一切本地化；此 SW 让重访秒开、断网也能用
 * （瓦片缺网时仅底图空白，标记/筛选/统计/详情全部照常）。
 * 策略：
 *   · 安装：预缓存极小 app shell（导航页 + manifest + 图标），首访不加重负担。
 *   · 同源静态资源（js/css/data/png）：stale-while-revalidate——先回缓存、后台更新。
 *     缓存键去掉查询串（部署给 css/js 追加 ?v=<sha>），保证每个文件只存一份、被最新覆盖。
 *   · 导航请求(HTML)：network-first → 离线回退缓存 → 兜底 index.html。
 *   · 跨域瓦片（Esri/OSM/高德）：不拦截，交浏览器默认（不缓存海量瓦片）。
 * 改动本文件内容即触发 SW 更新；activate 时清理旧版缓存。
 * ============================================================ */
'use strict';
const CACHE = 'ewm-cache-v1';
// app shell：保证离线也能打开页面；其余重资源在首访 fetch 时按需缓存
const SHELL = ['./', 'index.html', 'globe.html', 'manifest.json', 'favicon.svg', 'assets/icon-192.png', 'assets/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('ewm-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const keyOf = (url) => url.origin + url.pathname; // 去查询串：?v=<sha> 不再产生重复条目

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域瓦片：交浏览器默认

  // 导航（HTML）：network-first，离线回退缓存
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE); c.put(keyOf(url), net.clone());
        return net;
      } catch (err) {
        const c = await caches.open(CACHE);
        return (await c.match(keyOf(url))) || (await c.match('index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // 同源静态资源：stale-while-revalidate（键去查询串，缓存有界）
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const key = keyOf(url);
    const cached = await c.match(key);
    const network = fetch(req).then(res => { if (res && res.ok && res.type === 'basic') c.put(key, res.clone()); return res; }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
