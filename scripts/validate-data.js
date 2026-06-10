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
const scriptOrder = [...indexHtml.matchAll(/<script[^>]*\ssrc="(js\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
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
// 稀疏空洞 / 假值元素检测：data 文件里多一个逗号会产生数组 elision，forEach 会静默跳过、各种统计悄悄对不上
for (let i = 0; i < PROJECTS.length; i++) {
  if (!(i in PROJECTS)) E(`项目数组存在空洞（elision）@ 索引 ${i}——多半是某 data 文件里多了一个逗号`);
  else if (!PROJECTS[i] || typeof PROJECTS[i] !== 'object') E(`项目数组含假值元素 @ 索引 ${i}：${JSON.stringify(PROJECTS[i])}`);
}
// '中国' 历史大区已并入 '东亚'（与 util.buildProjects 同口径）：把源数据里的 region:'中国' 视作 '东亚'，
// 让枚举校验 / 坐标框 / 大区概览都按合并后的东亚口径统一处理。
const LEGACY_REGION = { '中国': '东亚' };
PROJECTS.forEach(p => { if (p && LEGACY_REGION[p.region]) p.region = LEGACY_REGION[p.region]; });
const PROGRESS = global.window.ENERGY_PROGRESS || {};
// 复用与 app.js 相同的容量解析（检测"有 cap 文本却解析不出任何数值"的盲区）
let UTIL = null;
try { UTIL = require(path.join(ROOT, 'js/util.js')); } catch (e) { W(`无法加载 js/util.js（跳过容量解析盲区检测）：${e.message}`); }

/* ---------- 大区合理坐标范围（启发式，越界=可能符号/归属错误）----------
 * [lngMin, lngMax, latMin, latMax]；大洋洲跨 ±180 单独处理 */
const REGION_BOX = {
  '东亚':   [73, 147, 1, 54],    // 中国大陆 + 日/韩/蒙古 + 中国台港（中国已并入东亚；含南海岛礁约 1°N、东至日本约 147°E）
  '东南亚': [92, 142, -11, 29],  // 东盟十国（印尼巴布亚东至约 141°E、爪哇南至约 -11°）
  '南亚':   [60, 98, 0, 39],     // 印/巴/孟/斯/尼/不/阿 + 马尔代夫（近赤道）
  '中亚':   [46, 88, 34, 56],    // 中亚五国（哈萨克斯坦西临里海约 46°E、东至约 87°E）
  '中东':   [25, 65, 11, 43],
  '欧洲':   [-32, 180, 31, 78],  // 含地中海互联 + 数据集将俄罗斯归入欧洲的约定（东至远东堪察加约 166°E）+ 外高加索阿塞拜疆
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

/* ---------- 5a) 英文正文映射（js/i18n-en.js，按 id 合并，与 progress 同模式）孤儿检测 ---------- */
try { require(path.join(ROOT, 'js/i18n-en.js')); } catch (e) { /* 文件可缺省 */ }
const EN = global.window.ENERGY_EN || {};
const enKeys = Object.keys(EN).map(Number);
const enOrphan = enKeys.filter(id => !idSet.has(id));
if (enOrphan.length) E(`ENERGY_EN 有 ${enOrphan.length} 条 id 对不上任何项目（孤儿英文正文）：${enOrphan.slice(0, 15).join(', ')}${enOrphan.length > 15 ? ' …' : ''}`);

/* ---------- 5b) 数据健康度（异常值 / 重复坐标 / route 合法性 / 容量解析盲区）---------- */
// 重复坐标：同一精确 [lng,lat] 被 ≥4 个项目复用，多半是占位坐标
const coordMap = new Map();
PROJECTS.forEach(p => {
  if (Array.isArray(p.coord) && typeof p.coord[0] === 'number' && typeof p.coord[1] === 'number') {
    const k = p.coord[0] + ',' + p.coord[1];
    (coordMap.get(k) || coordMap.set(k, []).get(k)).push(p);
  }
});
[...coordMap.entries()].filter(([, ps]) => ps.length >= 4).sort((a, b) => b[1].length - a[1].length)
  .forEach(([k, ps]) => W(`坐标 [${k}] 被 ${ps.length} 个项目复用（疑似占位坐标）：${ps.slice(0, 3).map(p => p.name).join(' / ')}${ps.length > 3 ? ' …' : ''}`));

// 投资额离群：inv ≥ 5000 亿美元（≈$500B），确认非录入错误（少量超级工程可能合法）
PROJECTS.filter(p => typeof p.inv === 'number' && p.inv >= 5000)
  .sort((a, b) => b.inv - a.inv)
  .forEach(p => W(`投资额异常大 inv=${p.inv}（≈$${(p.inv / 10).toFixed(0)}B）确认非录入错误：#${p.id} ${p.name}`));

// route 连线坐标合法性（malformed 会导致渲染异常）
PROJECTS.forEach(p => {
  if (p.route === undefined) return;
  if (!Array.isArray(p.route)) { E(`#${p.id} route 必须为坐标数组（${p.name}）`); return; }
  p.route.forEach((pt, i) => {
    if (!Array.isArray(pt) || pt.length !== 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number'
      || pt[0] < -180 || pt[0] > 180 || pt[1] < -90 || pt[1] > 90)
      E(`#${p.id} route[${i}] 非法坐标 ${JSON.stringify(pt)}（应为 [lng,lat]，${p.name}）`);
  });
});

// 容量解析盲区：cap 含数字但 parseCapacity 五个口径全 null（解析规则可能漏了单位）
if (UTIL && UTIL.parseCapacity) {
  const blind = PROJECTS.filter(p => p.cap && /\d/.test(p.cap))
    .filter(p => { const c = UTIL.parseCapacity(p.cap); return c.mw == null && c.mwh == null && c.km == null && c.kbd == null && c.wty == null && c.pf == null; });
  if (blind.length) W(`容量解析盲区 ${blind.length} 个（cap 有数字但解析不出任何口径，可补 SUB/解析规则）：` +
    blind.slice(0, 8).map(p => `#${p.id}"${p.cap}"`).join(' · ') + (blind.length > 8 ? ' …' : ''));
}

// 5e) 国际大客户子分类兜底：client 项目落入"其他客户"= 可能漏配 SUB_DEFS.client matcher
if (UTIL && UTIL.classifySub) {
  const otherOwners = new Set();
  PROJECTS.forEach(p => { if (p && p.cat === 'client' && UTIL.classifySub(p) === 'other') otherOwners.add(p.owner || '(无业主)'); });
  if (otherOwners.size) W(`国际大客户落入兜底「其他客户」桶的业主 ${otherOwners.size} 家（若为目标客户，请在 util.js SUB_DEFS.client 补 matcher）：` +
    [...otherOwners].slice(0, 12).join(' · ') + (otherOwners.size > 12 ? ' …' : ''));
}

// 5f) 准重复检测（高精度）：两个项目名仅在"空格/分隔点/工程·项目后缀"上不同 → 几乎必为同一项目重复录入
//     （按 name 去重抓不到，因原始串不同；但归一化后相同）。分期"二期/扩建/不同机组"因保留区分词不会命中。
(function () {
  const key = s => String(s || '').replace(/[\s·]/g, '').replace(/(工程|项目)$/, '');
  const seen = new Map();   // normKey -> 首个 {id,name}
  PROJECTS.forEach(p => {
    if (!p || !p.name) return;
    const k = key(p.name);
    if (seen.has(k) && seen.get(k).name !== p.name)
      W(`准重复（名称仅空格/后缀差异，疑似重复录入并双重计数）：#${p.id}「${p.name}」≈ #${seen.get(k).id}「${seen.get(k).name}」`);
    else if (!seen.has(k)) seen.set(k, { id: p.id, name: p.name });
  });
})();

// 5g) 拼音字表覆盖（js/pinyin-map.js，搜索框拼音匹配用）：新数据批次可能引入新汉字 → 提示重跑 build-pinyin
(function () {
  let PY = null;
  try { PY = require(path.join(ROOT, 'js/pinyin-map.js')); } catch (e) { W('js/pinyin-map.js 缺失或不可加载（搜索的拼音匹配将退化为子串匹配）：node scripts/build-pinyin.js 生成'); return; }
  const missing = new Set();
  const feed = s => { for (const ch of String(s || '')) if (/[㐀-鿿]/.test(ch) && !PY[ch]) missing.add(ch); };
  PROJECTS.forEach(p => { if (p) { feed(p.name); feed(p.country); feed(p.owner); } });
  if (missing.size) W(`拼音字表缺 ${missing.size} 个汉字（新数据引入；这些字暂无法被拼音搜索命中）：${[...missing].slice(0, 20).join('')}${missing.size > 20 ? ' …' : ''} → 重跑 node scripts/build-pinyin.js`);
})();

// 5h) 国别染色映射覆盖（util.geoNameOf ↔ lib/world-110m.js）：新国家进库时提示补 LABELS_EN.country / GEO_FIX
if (UTIL && UTIL.geoNameOf) {
  try {
    require(path.join(ROOT, 'lib/world-110m.js'));
    const GEO = new Set((((global.window.WORLD_GEO || {}).features) || []).map(f => f.properties && f.properties.name));
    const bad = new Map();
    PROJECTS.forEach(p => {
      if (!p || !p.country || /[—、\/]/.test(p.country)) return;   // 复合走廊不参与染色
      const g = UTIL.geoNameOf(p.country);
      if (g === null) {
        // 显式 null（GEO_FIX 里 110m 没有的微型经济体/多国聚合）合法；完全未知的国名才告警
        const known = (UTIL.LABELS_EN.country && Object.prototype.hasOwnProperty.call(UTIL.LABELS_EN.country, p.country)) ||
          (UTIL.GEO_FIX && Object.prototype.hasOwnProperty.call(UTIL.GEO_FIX, p.country));
        if (!known) bad.set(p.country, (bad.get(p.country) || 0) + 1);
      } else if (GEO.size && !GEO.has(g)) {
        bad.set(p.country + '→"' + g + '"(110m 无此要素，需在 util.js GEO_FIX 修正)', (bad.get(p.country) || 0) + 1);
      }
    });
    if (bad.size) W(`国别染色映射缺口 ${bad.size} 个国名（这些国家不会被染色；补 util.js LABELS_EN.country / GEO_FIX）：` +
      [...bad.entries()].slice(0, 8).map(([k, n]) => `${k}(${n})`).join(' · ') + (bad.size > 8 ? ' …' : ''));
  } catch (e) { W(`无法加载 lib/world-110m.js（跳过国别染色映射检查）：${e.message}`); }
}

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
// 英文正文覆盖（内联 detailEn/descEn + js/i18n-en.js 按 id 合并；EN 模式详情卡用得到）
const enInline = new Set(PROJECTS.filter(p => p && (p.detailEn || p.descEn)).map(p => p.id));
const enCovered = new Set([...enInline, ...enKeys].filter(id => idSet.has(id)));
console.log(`英文正文(detailEn/descEn) 覆盖：${enCovered.size}/${idSeen.size}（${(enCovered.size / idSeen.size * 100).toFixed(1)}%；内联 ${enInline.size} + i18n-en ${enKeys.length}）`);
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
