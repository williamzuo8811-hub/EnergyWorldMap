#!/usr/bin/env node
/* ============================================================
 * 国际大客户 BD 元数据校验（零依赖 / CI 友好）
 * 用法：  node scripts/test-clients-meta.js
 * 退出码：有 ERROR → 1；仅 WARN 或全通过 → 0
 *
 * js/clients-meta.js（window.CLIENT_META）不在 validate-data.js 覆盖范围内，
 * 但它与 js/util.js 的 SUB_DEFS.client 强耦合：键改名 / 漏配会让
 * 「🎯 客户 BD 看板」与详情卡 BD 画像静默丢数据。这里把这层契约做成机器门禁：
 *   1. SUB_DEFS.client 每个非 'other' 子键都必须有 CLIENT_META 条目（防漏配 / 改名漂移）
 *   2. CLIENT_META 每个键都必须存在于 SUB_DEFS.client（防孤儿元数据）
 *   3. tier / fit 取值合法；必填字段（type/product/scenario/approach）齐全
 *   4. WARN：按真实数据统计——有 client 项目落入兜底 'other' 桶（业主缺 matcher）
 *   5. WARN：CLIENT_META 子分类在全库零项目（可能是已退场客户）
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const errors = [];
const warns = [];
const E = (m) => errors.push(m);
const W = (m) => warns.push(m);

/* ---------- 加载 util.js（SUB_DEFS + classifySub）与全量数据 ---------- */
const UTIL = require('../js/util.js');
const { SUB_DEFS, classifySub } = UTIL;

// 按 index.html 的真实顺序加载数据文件（与 validate-data.js 同口径）
global.window = {};
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dataRefs = [...indexHtml.matchAll(/<script[^>]*\ssrc="(js\/[^"]+\.js)"><\/script>/g)]
  .map(m => m[1]).filter(s => /^js\/(data.*|progress)\.js$/.test(s));
dataRefs.forEach(rel => { try { require(path.join(ROOT, rel)); } catch (err) { E(`加载失败 ${rel}：${err.message}`); } });
require(path.join(ROOT, 'js/clients-meta.js')); // 挂 window.CLIENT_META

const ENERGY = global.window.ENERGY;
if (!ENERGY) { console.error('✘ 致命：window.ENERGY 未定义'); process.exit(1); }
const META = global.window.CLIENT_META;
if (!META) { console.error('✘ 致命：window.CLIENT_META 未定义（clients-meta.js 未正确加载）'); process.exit(1); }

const PROJECTS = ENERGY.PROJECTS.concat(global.window.ENERGY_EXTRA || []);

/* ---------- 契约 1/2：SUB_DEFS.client ↔ CLIENT_META 双向一致 ---------- */
const clientDefs = SUB_DEFS.client || [];
const subKeys = clientDefs.filter(d => d.key !== 'other').map(d => d.key);
const metaKeys = Object.keys(META);

subKeys.forEach(k => { if (!META[k]) E(`SUB_DEFS.client 子键「${k}」(${(clientDefs.find(d => d.key === k) || {}).label || ''}) 缺 CLIENT_META 条目`); });
metaKeys.forEach(k => { if (!subKeys.includes(k)) E(`CLIENT_META 存在孤儿键「${k}」——SUB_DEFS.client 里没有对应子分类（漏配 matcher 或拼写不一致）`); });

/* ---------- 契约 3：字段枚举 / 必填 ---------- */
const TIERS = ['第一梯队', '第二梯队', '第三梯队', '其他'];
const FITS = ['极高', '高', '中高', '中'];
metaKeys.forEach(k => {
  const m = META[k] || {};
  if (!TIERS.includes(m.tier)) E(`CLIENT_META.${k}.tier 非法：「${m.tier}」(应∈ ${TIERS.join('/')})`);
  if (!FITS.includes(m.fit)) E(`CLIENT_META.${k}.fit 非法：「${m.fit}」(应∈ ${FITS.join('/')})`);
  ['type', 'product', 'scenario', 'approach'].forEach(f => { if (!m[f] || !String(m[f]).trim()) E(`CLIENT_META.${k}.${f} 为空`); });
});

/* ---------- 契约 4/5：按真实数据统计落桶情况 ---------- */
const seen = new Set();
const clientProjects = PROJECTS.filter(p => p && p.name && !seen.has(p.name) && (seen.add(p.name), p.cat === 'client'));
const tally = {};
const otherOwners = new Set();
clientProjects.forEach(p => {
  const sub = classifySub(p);
  tally[sub] = (tally[sub] || 0) + 1;
  if (sub === 'other') otherOwners.add(p.owner || '(无业主)');
});
if (otherOwners.size) W(`有 client 项目落入兜底「其他客户」桶的业主 ${otherOwners.size} 家（如为目标客户请在 util.js SUB_DEFS.client 补 matcher）：${[...otherOwners].slice(0, 8).join(' / ')}`);
const orphanMeta = metaKeys.filter(k => !tally[k]);
if (orphanMeta.length) W(`CLIENT_META 子分类在全库零项目 ${orphanMeta.length} 个（可能已退场）：${orphanMeta.join(' / ')}`);

/* ---------- 汇总 ---------- */
console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · 国际大客户 BD 元数据校验');
console.log('═══════════════════════════════════════════════');
console.log(`SUB_DEFS.client 子分类：${subKeys.length}（+兜底 other）  |  CLIENT_META 条目：${metaKeys.length}  |  client 项目：${clientProjects.length}`);
if (warns.length) { console.log(`\n⚠ 警告 ${warns.length}：`); warns.forEach(w => console.log('  · ' + w)); }
if (errors.length) {
  console.log(`\n✘ 错误 ${errors.length}：`);
  errors.forEach(e => console.log('  · ' + e));
  process.exit(1);
}
console.log('\n✔ CLIENT_META 与 SUB_DEFS.client 契约一致，字段合法。');
process.exit(0);
