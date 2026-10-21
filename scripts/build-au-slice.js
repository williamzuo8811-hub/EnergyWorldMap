#!/usr/bin/env node
/* ============================================================
 * 澳洲项目切片生成器（零依赖）
 * 用法：  node scripts/build-au-slice.js            # 重新生成 js/au-projects.js
 *        node scripts/build-au-slice.js --check    # 只比对：与全球数据链不一致则 exit 1（CI 门禁）
 * ------------------------------------------------------------
 * au.html 只用 ~260 个澳洲项目，却曾要下载并解析 4.1 MB 的全球数据链（27 个 data*.js + progress.js）。
 * 本脚本按 index.html 的真实 <script> 顺序加载全部数据，用 util.buildProjects（与 app.js / globe.js
 * 同一管线：按 name 去重 → 挂 progress → classifySub → parseCapacity；requireCoord:true）装配后，
 * 只取 country 含「澳大利亚」的项目，写成 js/au-projects.js（window.AU_PROJECTS，≈210 KB）；au.js 优先读它，
 * 没有切片时（scripts/test-au.js 走全量链）仍按同口径现场装配。
 * 单一事实来源仍是 js/data*.js：改了数据就重跑本脚本；CI 用 --check 挡住忘记重跑的提交；
 * scripts/test-au.js 另从切片与全量链各装配一次做字段级比对。
 * 输出确定性（按 id 排序、键名排序、无时间戳），便于 diff。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'js', 'au-projects.js');
const CHECK = process.argv.includes('--check');

function build() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // 与 validate-data.js 同一解析方式（容忍 defer 等属性），只取数据链
  const order = [...html.matchAll(/<script[^>]*\ssrc="(js\/[^"]+\.js)"/g)].map(m => m[1]).filter(s => /^js\/(data.*|progress)\.js$/.test(s));
  global.window = {};
  const U = require(path.join(ROOT, 'js', 'util.js'));
  order.forEach(f => require(path.join(ROOT, f)));
  const W = global.window;
  const all = U.buildProjects(W.ENERGY, W.ENERGY_EXTRA, W.ENERGY_PROGRESS, { requireCoord: true });
  const au = all.filter(p => /澳大利亚/.test(p.country || '')).sort((a, b) => a.id - b.id);
  const META = (W.ENERGY || {}).META || {};
  const items = au.map(p => { const o = {}; Object.keys(p).sort().forEach(k => { if (k[0] !== '_' && p[k] !== undefined) o[k] = p[k]; }); return o; });
  const lines = [
    '// 澳洲项目切片（window.AU_PROJECTS）—— 由 scripts/build-au-slice.js 按 index.html 的真实数据链用 util.buildProjects 装配后筛出 country 含「澳大利亚」的项目生成，勿手改。',
    '// au.html 只加载 data.js（META / CATEGORIES / STATUS）+ 本文件，省掉 ≈4 MB 全球数据；单一事实来源仍是 js/data*.js —— 改了数据就重跑 node scripts/build-au-slice.js（CI 用 --check 门禁，test-au.js 做字段比对）。',
    '// 字段 = 项目原字段 + buildProjects 派生字段（progress / sub / capMW …）；按 id 排序、键名排序。',
    'window.AU_PROJECTS = {',
    '  builtFrom: ' + JSON.stringify(META.lastUpdated || '') + ',',
    '  source: ' + JSON.stringify(order.join(' + ')) + ',',
    '  count: ' + items.length + ',',
    '  items: [',
  ].concat(items.map((o, i) => '    ' + JSON.stringify(o) + (i < items.length - 1 ? ',' : '')), ['  ],', '};', '']);
  return { text: lines.join('\n'), count: items.length, sources: order.length, lastUpdated: META.lastUpdated || '' };
}

const built = build();
if (CHECK) {
  let cur = '';
  try { cur = fs.readFileSync(OUT, 'utf8'); } catch (e) { cur = ''; }
  if (cur !== built.text) {
    console.error(`✘ js/au-projects.js 与全球数据链不一致（链上 ${built.count} 个澳洲项目 / ${built.sources} 个数据文件）—— 请运行 node scripts/build-au-slice.js 重新生成并一起提交`);
    process.exit(1);
  }
  console.log(`✔ js/au-projects.js 与全球数据链一致（${built.count} 个澳洲项目，META.lastUpdated ${built.lastUpdated}）`);
} else {
  fs.writeFileSync(OUT, built.text);
  console.log(`✔ 已生成 js/au-projects.js：${built.count} 个澳洲项目，${(Buffer.byteLength(built.text) / 1024).toFixed(0)} KB（来源 ${built.sources} 个数据文件，META.lastUpdated ${built.lastUpdated}）`);
}
