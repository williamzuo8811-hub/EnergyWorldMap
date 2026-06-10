#!/usr/bin/env node
/* ============================================================
 * Lighthouse 评分阈值检查（零依赖；解析 lighthouse CLI 的 JSON 输出）
 * 用法：  npx lighthouse <url> --output=json --output-path=lh.json …
 *        node scripts/check-lighthouse.js lh.json
 * ------------------------------------------------------------
 * 打印四大类评分；低于警告线输出 ::warning::（不挡合并——分数受 CI
 * 机器波动影响，作为趋势线而非门禁）。阈值可用环境变量覆盖：
 *   LH_MIN_PERF（默认 60）/ LH_MIN_A11Y（默认 90）/
 *   LH_MIN_BP（默认 80）/ LH_MIN_SEO（默认 80）
 * ============================================================ */
'use strict';
const fs = require('fs');

const file = process.argv[2] || 'lh.json';
const MIN = {
  performance: Number(process.env.LH_MIN_PERF || 60),
  accessibility: Number(process.env.LH_MIN_A11Y || 90),
  'best-practices': Number(process.env.LH_MIN_BP || 80),
  seo: Number(process.env.LH_MIN_SEO || 80),
};
const ZH = { performance: '性能', accessibility: '无障碍', 'best-practices': '最佳实践', seo: 'SEO' };

let lh;
try { lh = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.log(`::warning::无法读取 Lighthouse 输出 ${file}：${e.message}`); process.exit(0); }

console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · Lighthouse 评分');
console.log('═══════════════════════════════════════════════');
console.log(`URL: ${lh.finalDisplayedUrl || lh.requestedUrl || '?'}`);

let warned = 0;
Object.keys(MIN).forEach(k => {
  const cat = (lh.categories || {})[k];
  if (!cat || cat.score == null) { console.log(`  ${ZH[k]}：无数据`); return; }
  const score = Math.round(cat.score * 100);
  const pass = score >= MIN[k];
  console.log(`  ${pass ? '✔' : '⚠'} ${ZH[k].padEnd(4)} ${score}（警告线 ${MIN[k]}）`);
  if (!pass) { warned++; console.log(`::warning::Lighthouse ${ZH[k]} ${score} 分低于警告线 ${MIN[k]}`); }
});
console.log(warned ? `\n⚠ ${warned} 项低于警告线（仅提醒，不挡合并）。` : '\n✔ 全部达标。');
process.exit(0);
