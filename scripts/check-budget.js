#!/usr/bin/env node
/* ============================================================
 * 体积预算检查（零依赖，CI 友好）
 * 用法：  node scripts/check-budget.js
 * ------------------------------------------------------------
 * 盯住"零构建直出"站点的负载上限，超线输出 ::warning::（不挡合并）：
 *   · 单个 js/data*.js > 600 KB —— 该批次该拆分新文件了
 *   · 首屏同步 JS（index.html 实际 <script> 链，不含懒加载的
 *     i18n-en.js / world-110m.js）总量 > 6.5 MB
 *   · 懒加载资源单独列出，仅展示不告警
 * lib/ 为锁定的 vendored 库，只展示。永远 exit 0。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PER_DATA_KB = Number(process.env.BUDGET_DATA_KB || 600);
const TOTAL_SYNC_MB = Number(process.env.BUDGET_TOTAL_MB || 6.5);

const kb = f => { try { return fs.statSync(path.join(ROOT, f)).size / 1024; } catch (e) { return 0; } };
const fmt = n => (n >= 1024 ? (n / 1024).toFixed(2) + ' MB' : Math.round(n) + ' KB');

// index.html 的实际同步脚本链（容忍 defer 等属性）
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const syncScripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+\.js)"/g)].map(m => m[1]);
const LAZY = ['js/i18n-en.js', 'lib/world-110m.js'];   // app.js 运行时按需注入

console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · 体积预算');
console.log('═══════════════════════════════════════════════');

let warned = 0;
// 1) 单数据文件预算
fs.readdirSync(path.join(ROOT, 'js')).filter(f => /^data.*\.js$/.test(f)).sort()
  .forEach(f => {
    const size = kb('js/' + f);
    const over = size > PER_DATA_KB;
    if (over) { warned++; console.log(`::warning::js/${f} ${fmt(size)} 超过单文件预算 ${PER_DATA_KB} KB —— 新批次请拆分独立 data 文件`); }
    else console.log(`  js/${f.padEnd(26)} ${fmt(size)}`);
  });

// 2) 首屏同步链总量
const total = syncScripts.reduce((s, f) => s + kb(f), 0);
console.log(`\n首屏同步 JS（${syncScripts.length} 个脚本）：${fmt(total)}（预算 ${TOTAL_SYNC_MB} MB）`);
if (total / 1024 > TOTAL_SYNC_MB) { warned++; console.log(`::warning::首屏同步 JS 总量 ${fmt(total)} 超预算 ${TOTAL_SYNC_MB} MB —— 考虑把大数据文件改为按需懒加载`); }

// 3) 懒加载资源（仅展示）
console.log('\n懒加载（不计入首屏）：');
LAZY.forEach(f => console.log(`  ${f.padEnd(30)} ${fmt(kb(f))}`));

console.log(warned ? `\n⚠ ${warned} 项超预算（见上方 warning）。` : '\n✔ 体积全部在预算内。');
process.exit(0);
