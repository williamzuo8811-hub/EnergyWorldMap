#!/usr/bin/env node
/* ============================================================
 * 数据 Schema 校验（零依赖，可复跑 / CI 友好）
 * 用法：  node scripts/validate-data.js
 * 退出码：有 ERROR → 1；仅 WARN 或全通过 → 0
 *
 * 校验内容：
 *  1. 按 index.html 的真实 <script> 顺序加载数据（并检查磁盘上的 data*.js 是否都已挂载）
 *  2. 必填字段齐全；枚举合法（cat∈CATEGORIES / region∈REGIONS / status∈STATUS）
 *  3. 坐标为 [lng,lat] 且落在所属大区的合理范围（抓"美洲正经/南半球正纬"等符号错误）
 *  4. name 唯一（重名会被 app.js 按名去重静默丢弃）、id 唯一、各文件 id 段不重叠
 *  5. inv 为数字、year 合理、updated 形如 YYYY-MM
 *  6. ENERGY_PROGRESS 的 id 是否都能对上项目（孤儿进展）
 *  7. 概览：总数 / 分品类 / 分大区 / 分状态 / 容量解析覆盖
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const errors = [];
const warns = [];
const E = (msg) => errors.push(msg);
const W = (msg) => warns.push(msg);

/* ---------- 1) 解析 index.html 的脚本加载顺序 ---------- */
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptOrder = [...indexHtml.matchAll(/<script\s+src="(js\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
const dataRefs = scriptOrder.filter(s => /^js\/(data.*|progress)\.js$/.test(s));

// 磁盘上的数据文件是否都已在 index.html 挂载
const diskData = fs.readdirSync(path.join(ROOT, 'js')).filter(f => /^(data.*|progress)\.js$/.test(f)).map(f => 'js/' + f);
diskData.forEach(f => { if (!dataRefs.includes(f)) E(`数据文件未在 index.html 挂载：${f}`); });
dataRefs.forEach(f => { if (!diskData.includes(f)) E(`index.html 引用了不存在的数据文件：${f}`); });

/* ---------- 2) 按真实顺序加载（一次加载内归因各文件 id 段，避免 require 缓存）---------- */
global.window = {};
const fileRanges = [];
let prevIds = new Set();
dataRefs.forEach(rel => {
  try { require(path.join(ROOT, rel)); }
  catch (err) { E(`加载失败 ${rel}：${err.message}`); return; }
  if (!/data.*\.js$/.test(rel)) return; // progress.js 不计入 id 段归因
  const cur = ((global.window.ENERGY && global.window.ENERGY.PROJECTS) || []).concat(global.window.ENERGY_EXTRA || []);
  const ids = cur.map(p => p && p.id).filter(x => x != null);
  const newIds = ids.filter(id => !prevIds.has(id));
  prevIds = new Set(ids);
  if (newIds.length) fileRanges.push({ file: rel, min: Math.min(...newIds), max: Math.max(...newIds), n: newIds.length });
});
const ENERGY = global.window.ENERGY;
if (!ENERGY) { console.error('✘ 致命：window.ENERGY 未定义（data.js 未正确加载）'); process.exit(1); }
const { CATEGORIES, REGIONS, STATUS } = ENERGY;
const CAT_KEYS = Object.keys(CATEGORIES);
const PROJECTS = ENERGY.PROJECTS.concat(global.window.ENERGY_EXTRA || []);
const PROGRESS = global.window.ENERGY_PROGRESS || {};

/* ---------- 大区合理坐标范围（启发式，越界=可能符号/归属错误）----------
 * [lngMin, lngMax, latMin, latMax]；大洋洲跨 ±180 单独处理 */
const REGION_BOX = {
  '中国':   [73, 136, 1, 54],
  '亚洲':   [25, 180, -11, 82],
  '中东':   [25, 65, 11, 43],
  '欧洲':   [-32, 100, 31, 78],  // 含地中海互联 + 数据集将俄罗斯归入欧洲的约定（东至西伯利亚）
  '北美':   [-170, -10, 6, 84],  // 含格陵兰（东岸约 -12°）
  '南美':   [-82, -28, -56, 14],  // 含巴西大西洋岛屿（费尔南多·迪诺罗尼亚约 -32°）
  '非洲':   [-26, 60, -37, 38],   // 含佛得角 + 印度洋岛屿
  '大洋洲': null, // 特判
};
function coordInRegion(region, lng, lat) {
  if (region === '大洋洲') {
    const lngOK = (lng >= 110 && lng <= 180) || (lng >= -180 && lng <= -130);
    return lngOK && lat >= -55 && lat <= 6;
  }
  const b = REGION_BOX[region];
  if (!b) return true; // 未知大区在别处报枚举错
  return lng >= b[0] && lng <= b[1] && lat >= b[2] && lat <= b[3];
}

/* ---------- 3) 逐项目校验 ---------- */
const REQUIRED = ['id', 'name', 'country', 'region', 'cat', 'coord', 'status', 'year'];
const RECOMMENDED = ['en', 'cap', 'inv', 'invText', 'desc', 'detail', 'updated', 'owner'];
const nameSeen = new Map();   // name -> first id
const idSeen = new Map();     // id -> {name}
let recMissing = 0;

PROJECTS.forEach((p, idx) => {
  const tag = p && p.id != null ? `#${p.id}` : `(序号 ${idx})`;
  if (!p || typeof p !== 'object') { E(`${tag} 非对象`); return; }
  REQUIRED.forEach(f => { if (p[f] === undefined || p[f] === null || p[f] === '') E(`${tag} 缺必填字段 ${f}（${p.name || ''}）`); });

  // 枚举
  if (p.cat && !CAT_KEYS.includes(p.cat)) E(`${tag} 非法 cat="${p.cat}"（${p.name}）`);
  if (p.region && !REGIONS.includes(p.region)) E(`${tag} 非法 region="${p.region}"（${p.name}）`);
  if (p.status && !STATUS.includes(p.status)) E(`${tag} 非法 status="${p.status}"（${p.name}）`);

  // 坐标
  if (!Array.isArray(p.coord) || p.coord.length !== 2 || typeof p.coord[0] !== 'number' || typeof p.coord[1] !== 'number') {
    E(`${tag} coord 必须为 [lng,lat] 数字对（${p.name}）`);
  } else {
    const [lng, lat] = p.coord;
    if (lat < -90 || lat > 90) E(`${tag} 纬度越界 lat=${lat}（${p.name}）`);
    if (lng < -180 || lng > 180) E(`${tag} 经度越界 lng=${lng}（${p.name}）`);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && p.region && REGIONS.includes(p.region) && !coordInRegion(p.region, lng, lat))
      W(`${tag} 坐标 [${lng},${lat}] 不在「${p.region}」常规范围（疑似符号/归属错误）：${p.name}`);
  }

  // 类型
  if (p.inv !== undefined && typeof p.inv !== 'number') E(`${tag} inv 应为数字（亿美元），实为 ${typeof p.inv}（${p.name}）`);
  if (p.year !== undefined && (typeof p.year !== 'number' || p.year < 2000 || p.year > 2040)) W(`${tag} year=${p.year} 超出 2000–2040（${p.name}）`);
  if (p.updated !== undefined && p.updated !== '' && !/^\d{4}-\d{2}$/.test(p.updated)) W(`${tag} updated="${p.updated}" 非 YYYY-MM（${p.name}）`);

  // 唯一性
  if (p.name) {
    if (nameSeen.has(p.name)) E(`重名（会被去重丢弃）："${p.name}" 同名于 #${nameSeen.get(p.name)}（本条 ${tag}）`);
    else nameSeen.set(p.name, p.id);
  }
  if (p.id != null) {
    if (idSeen.has(p.id)) E(`重复 id ${p.id}："${p.name}" 与 "${idSeen.get(p.id).name}"`);
    else idSeen.set(p.id, { name: p.name });
  }

  // 推荐字段（仅统计，不报错）
  RECOMMENDED.forEach(f => { if (p[f] === undefined || p[f] === null || p[f] === '') recMissing++; });
});

/* ---------- 4) 各文件 id 段重叠检测（fileRanges 已在加载时归因）---------- */
const sorted = fileRanges.slice().sort((a, b) => a.min - b.min);
for (let i = 1; i < sorted.length; i++) {
  if (sorted[i].min <= sorted[i - 1].max) W(`id 段重叠：${sorted[i - 1].file}(${sorted[i - 1].min}-${sorted[i - 1].max}) 与 ${sorted[i].file}(${sorted[i].min}-${sorted[i].max})`);
}

/* ---------- 5) 进展映射孤儿 ---------- */
const idSet = new Set(PROJECTS.map(p => p && p.id));
const orphan = Object.keys(PROGRESS).map(Number).filter(id => !idSet.has(id));
if (orphan.length) W(`ENERGY_PROGRESS 有 ${orphan.length} 条 id 对不上任何项目（孤儿）：${orphan.slice(0, 15).join(', ')}${orphan.length > 15 ? ' …' : ''}`);

/* ---------- 6) 概览 ---------- */
const by = (key) => PROJECTS.reduce((m, p) => { const k = p[key]; m[k] = (m[k] || 0) + 1; return m; }, {});
const capPresent = PROJECTS.filter(p => p.cap && /\d/.test(p.cap)).length;

console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · 数据校验');
console.log('═══════════════════════════════════════════════');
console.log(`数据文件（按 index.html 顺序，${dataRefs.length}）：`);
fileRanges.forEach(r => console.log(`  ${r.file.padEnd(28)} id ${r.min}-${r.max}  (${r.n})`));
console.log(`\n项目总数：${PROJECTS.length}  |  去重后唯一名：${nameSeen.size}  |  唯一 id：${idSeen.size}`);
console.log(`品类（${CAT_KEYS.length}）：` + CAT_KEYS.map(k => `${CATEGORIES[k].short} ${by('cat')[k] || 0}`).join(' · '));
console.log('大区：' + REGIONS.map(r => `${r} ${by('region')[r] || 0}`).join(' · '));
console.log('状态：' + STATUS.map(s => `${s} ${by('status')[s] || 0}`).join(' · '));
console.log(`含数值容量(cap) 的项目：${capPresent}/${PROJECTS.length}（${(capPresent / PROJECTS.length * 100).toFixed(0)}%）`);
console.log(`META.lastUpdated=${ENERGY.META && ENERGY.META.lastUpdated}  recentSince=${ENERGY.META && ENERGY.META.recentSince}`);

console.log('\n───────────────────────────────────────────────');
if (warns.length) {
  console.log(`⚠ 警告 ${warns.length}：`);
  warns.forEach(w => console.log('  · ' + w));
}
if (errors.length) {
  console.log(`\n✘ 错误 ${errors.length}：`);
  errors.forEach(e => console.log('  · ' + e));
  console.log('\n校验未通过。');
  process.exit(1);
}
console.log(warns.length ? '\n✔ 无错误（有警告，见上）。' : '\n✔ 全部校验通过，无错误无警告。');
process.exit(0);
