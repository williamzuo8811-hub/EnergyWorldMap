/* ============================================================
 * 全球能源项目世界地图 —— Service Worker（离线 + 秒开重访）
 * ------------------------------------------------------------
 * 纯静态零构建站点。除地图瓦片外一切本地化；此 SW 让重访秒开、断网也能用
 * （瓦片缺网时仅底图空白，标记/筛选/统计/详情全部照常）。
 * 策略：
 *   · 安装：预缓存极小 app shell（导航页 + manifest + 图标），首访不加重负担。
 *   · 导航请求(HTML)：network-first → 离线回退缓存 → 兜底 index.html。
 *     **部署检测**：拿到的 HTML 与缓存里那份不同（ETag 变了，或无 ETag 时正文变了）= 刚部署过，
 *     先清掉所有已缓存的同源 JS/CSS 再把 HTML 交给页面——这次加载的脚本/样式全走网络拿新版本。
 *     否则 stale-while-revalidate 会把【旧 JS/CSS 配新 HTML】跑一次：澳洲地图曾因此只显示 4 个项目、
 *     抽屉按钮裸露、右栏被裁（新 HTML 不再带全球数据链，旧 au.js 不认识 AU_PROJECTS）。
 *   · 同源静态资源（js/css/data/png）：stale-while-revalidate——先回缓存、后台更新。
 *     缓存键去掉查询串（GitHub Pages 部署给 css/js 追加 ?v=<sha>；Cloudflare 原样部署），每个文件只存一份。
 *   · 跨域瓦片（Esri/OSM/高德）：不拦截，交浏览器默认（不缓存海量瓦片）。
 * 改动本文件内容即触发 SW 更新；activate 时清理旧版缓存。CACHE 名升版本 = 让所有旧缓存一次性作废。
 * scripts/test-sw.js 在 Node 里用桩验证上述分支。
 * ============================================================ */
'use strict';
const CACHE = 'ewm-cache-v2';
// app shell：保证离线也能打开页面；其余重资源在首访 fetch 时按需缓存
const SHELL = ['./', 'index.html', 'globe.html', 'coach.html', 'au.html', 'manifest.json', 'favicon.svg', 'assets/icon-192.png', 'assets/icon-512.png'];

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
const isAsset = (url) => /\.(?:js|css)$/i.test(url.pathname);

// 部署检测：两份 HTML 都带 ETag 就比 ETag（代理注入的内容不会误判），否则比正文
async function htmlChanged(fresh, cached) {
  if (!cached) return false;
  const a = fresh.headers && fresh.headers.get('etag'), b = cached.headers && cached.headers.get('etag');
  if (a && b) return a !== b;
  const [x, y] = await Promise.all([fresh.clone().text(), cached.clone().text()]);
  return x !== y;
}
// 清掉所有已缓存的同源 JS/CSS（HTML 本身保留并随后覆盖；图片 / manifest 不动）
async function purgeAssets(c) {
  const keys = await c.keys();
  await Promise.all(keys.filter(r => { try { const u = new URL(r.url); return u.origin === self.location.origin && isAsset(u); } catch (e) { return false; } }).map(r => c.delete(r)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域瓦片：交浏览器默认

  // 导航（HTML）：network-first，离线回退缓存；HTML 变了 = 刚部署 → 先清 JS/CSS 再放行
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const key = keyOf(url);
      try {
        const net = await fetch(req);
        if (net && net.ok) {
          const old = await c.match(key);
          if (await htmlChanged(net, old)) await purgeAssets(c);
          await c.put(key, net.clone());
        }
        return net;
      } catch (err) {
        return (await c.match(key)) || (await c.match('index.html')) || (await c.match('./')) || Response.error();
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
    if (cached) { e.waitUntil(network); return cached; }
    return (await network) || Response.error();
  })());
});
