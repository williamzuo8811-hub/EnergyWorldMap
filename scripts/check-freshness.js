#!/usr/bin/env node
/* ============================================================
 * 数据新鲜度告警（零依赖，CI 友好）
 * 用法：  node scripts/check-freshness.js
 * ------------------------------------------------------------
 * 读取 META.lastUpdated（YYYY-MM），落后当前月份 > STALE_MONTHS（默
 * 认 2）个月时输出 GitHub Actions ::warning:: 提醒维护者触发一轮
 * 「刷新能源地图数据」。永远 exit 0——新鲜度是提醒线，不是门禁。
 * ============================================================ */
'use strict';
const path = require('path');

const STALE_MONTHS = Number(process.env.STALE_MONTHS || 2);

global.window = {};
require(path.join(__dirname, '..', 'js', 'data.js'));
const META = (global.window.ENERGY || {}).META || {};
const last = META.lastUpdated || '';

if (!/^\d{4}-\d{2}$/.test(last)) {
  console.log(`::warning::META.lastUpdated="${last}" 不是 YYYY-MM，无法判断数据新鲜度`);
  process.exit(0);
}
const now = new Date();
const [y, m] = last.split('-').map(Number);
const ageMonths = (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m);

console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · 数据新鲜度');
console.log('═══════════════════════════════════════════════');
console.log(`META.lastUpdated = ${last}（距今 ${ageMonths} 个月）  recentSince = ${META.recentSince || '?'}`);

if (ageMonths > STALE_MONTHS) {
  console.log(`::warning::数据已 ${ageMonths} 个月未刷新（lastUpdated=${last}，告警线 ${STALE_MONTHS} 个月）——建议对维护助手说「刷新能源地图数据」跑一轮更新`);
} else {
  console.log(`✔ 数据新鲜（告警线 ${STALE_MONTHS} 个月）。`);
}

// 澳洲地图（au.html）：AEMO Generation Information 每季度一版——管线 asOf 落后 >4 个月提醒换表重跑导入；
// 燃煤关停表 asOf 落后 >6 个月提醒按 AEMO Generating Unit Expected Closure Year 核对。同样只是提醒线。
try {
  require(path.join(__dirname, '..', 'js', 'au-pipeline.js'));
  require(path.join(__dirname, '..', 'js', 'au-coal.js'));
  const check = (label, ym, limit, hint) => {
    if (!/^\d{4}-\d{2}$/.test(ym || '')) { console.log(`::warning::${label}="${ym}" 不是 YYYY-MM`); return; }
    const [yy, mm] = ym.split('-').map(Number);
    const age = (now.getUTCFullYear() - yy) * 12 + (now.getUTCMonth() + 1 - mm);
    console.log(`${label} = ${ym}（距今 ${age} 个月，告警线 ${limit} 个月）`);
    if (age > limit) console.log(`::warning::${label} 已 ${age} 个月未更新——${hint}`);
  };
  check('AU_PIPELINE.asOf', (global.window.AU_PIPELINE || {}).asOf, Number(process.env.AU_STALE_MONTHS || 4), '下载新季度 AEMO NEM Generation Information 表到 data-src/aemo/ 后运行 node scripts/import-aemo.js（见 CLAUDE.md 刷新路径）');
  check('AU_COAL.asOf', (global.window.AU_COAL || {}).asOf, Number(process.env.AU_COAL_STALE_MONTHS || 6), '按 AEMO Generating Unit Expected Closure Year 最新表核对 js/au-coal.js');
} catch (e) { console.log('::warning::澳洲数据新鲜度检查跳过：' + (e && e.message)); }
process.exit(0);
