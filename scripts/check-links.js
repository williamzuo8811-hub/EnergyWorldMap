#!/usr/bin/env node
/* ============================================================
 * 链接检查（零依赖，CI 友好；Node ≥18 自带 fetch）
 * 用法：  node scripts/check-links.js
 * ------------------------------------------------------------
 * 扫描 *.html / README.md / docs/*.md 里的链接：
 *   · 站内相对链接（href/src/markdown）：目标文件必须存在 → 缺失 = ERROR（exit 1）
 *     —— 部署后即 404，必须挡住
 *   · 外部 http(s) 链接：去重后逐个探活（8s 超时；HEAD 被拒则退 GET）→
 *     失败仅 ::warning::（外站抖动不挡合并）；CHECK_LINKS_EXTERNAL=0 可跳过
 *   · 瓦片模板 URL（含 {z} 等占位符）与锚点/mailto/data: 跳过
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECK_EXTERNAL = process.env.CHECK_LINKS_EXTERNAL !== '0';
const TIMEOUT_MS = 8000;

const files = ['index.html', 'globe.html', 'coach.html', 'README.md']
  .concat(fs.existsSync(path.join(ROOT, 'docs')) ? fs.readdirSync(path.join(ROOT, 'docs')).filter(f => f.endsWith('.md')).map(f => 'docs/' + f) : [])
  .filter(f => fs.existsSync(path.join(ROOT, f)));

const internal = [];   // {file, target}
const external = new Map();   // url -> 首个出现的 file
for (const f of files) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const links = [];
  for (const m of txt.matchAll(/(?:href|src)="([^"]+)"/g)) links.push(m[1]);
  if (f.endsWith('.md')) for (const m of txt.matchAll(/\]\((https?:\/\/[^)\s]+|[^)\s:]+)\)/g)) links.push(m[1]);
  for (let l of links) {
    l = l.trim();
    if (!l || l.startsWith('#') || l.startsWith('data:') || l.startsWith('mailto:') || l.startsWith('javascript:')) continue;
    if (/^https?:\/\//.test(l)) {
      if (l.includes('{')) continue;                    // 瓦片/模板 URL
      if (!external.has(l)) external.set(l, f);
    } else if (!l.startsWith('//')) {
      internal.push({ file: f, target: l.split(/[?#]/)[0] });
    }
  }
}

console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · 链接检查');
console.log('═══════════════════════════════════════════════');
console.log(`扫描 ${files.length} 个文件：站内链接 ${internal.length} · 外部链接 ${external.size}${CHECK_EXTERNAL ? '' : '（外链检查已跳过）'}`);

// 1) 站内链接：文件必须存在
let errors = 0;
for (const { file, target } of internal) {
  const abs = path.resolve(path.join(ROOT, path.dirname(file)), target);
  if (!fs.existsSync(abs)) { errors++; console.log(`✘ ${file} → "${target}" 不存在（部署后 404）`); }
}
if (!errors) console.log('✔ 站内链接全部存在。');

// 2) 外部链接：探活（仅警告）
(async () => {
  if (CHECK_EXTERNAL && external.size) {
    const urls = [...external.keys()];
    const probe = async (url) => {
      const tryOnce = async (method) => {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
        try {
          return await fetch(url, {
            method, redirect: 'follow', signal: ac.signal,
            headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', accept: '*/*' },
          });
        } finally { clearTimeout(t); }
      };
      try {
        let res = await tryOnce('HEAD');
        if (res.status === 405 || res.status === 501) res = await tryOnce('GET');
        if (res.ok || (res.status >= 300 && res.status < 400)) return null;
        // 401/403/429 = 服务器在线但拒绝机器人探测（shields.io 等常见）——链接没死，视为可达
        if (res.status === 401 || res.status === 403 || res.status === 429) return null;
        return `HTTP ${res.status}`;
      } catch (e) { return e.name === 'AbortError' ? '超时' : (e.cause && e.cause.code) || e.message; }
    };
    let bad = 0;
    const POOL = 8;
    for (let i = 0; i < urls.length; i += POOL) {
      const batch = urls.slice(i, i + POOL);
      const results = await Promise.all(batch.map(probe));
      results.forEach((err, j) => {
        if (err) { bad++; console.log(`::warning::外链不可达（${err}）：${batch[j]}（首见于 ${external.get(batch[j])}）`); }
      });
    }
    console.log(bad ? `⚠ ${bad}/${urls.length} 条外链不可达（仅警告）。` : `✔ ${urls.length} 条外链全部可达。`);
  }
  if (errors) { console.log(`\n✘ ${errors} 条站内链接缺失。`); process.exit(1); }
  console.log('\n✔ 链接检查通过。');
  process.exit(0);
})();
