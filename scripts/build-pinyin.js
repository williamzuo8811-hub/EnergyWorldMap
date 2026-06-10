#!/usr/bin/env node
/* ============================================================
 * 生成 js/pinyin-map.js —— 搜索框拼音/首字母匹配用的静态字表
 * ------------------------------------------------------------
 * 收集全库项目 name / country / owner 中出现过的汉字，逐字生成
 * 无声调小写拼音（ü→v），输出为运行时零依赖的静态映射文件。
 * 仅【生成时】需要 pinyin-pro（运行时/CI 均不需要）：
 *   npm i --no-save pinyin-pro && node scripts/build-pinyin.js
 *   （或 NODE_PATH=<任一含 pinyin-pro 的 node_modules> node scripts/build-pinyin.js）
 * 何时重跑：新增数据批次后若 validate-data.js 提示「拼音字表缺字」。
 * 已知限制：多音字取单字默认读音（如 重→zhong），搜索容错场景可接受。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

let pinyin;
try { pinyin = require('pinyin-pro').pinyin; }
catch (e) {
  console.error('✘ 缺少 pinyin-pro（仅生成此字表时需要）：请先 npm i --no-save pinyin-pro');
  process.exit(1);
}

global.window = {};
const ROOT = path.join(__dirname, '..');
// 按 index.html 实际 <script> 顺序加载全部数据文件（与 validate-data.js 同法，容忍 defer 属性）
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script[^>]*\ssrc="js\/((?:data[^"]*|progress))\.js"/g)].map(m => m[1]);
files.forEach(f => require(path.join(ROOT, 'js', f + '.js')));

const all = (global.window.ENERGY.PROJECTS || []).concat(global.window.ENERGY_EXTRA || []);
const chars = new Set();
const feed = s => { for (const ch of String(s || '')) if (/[㐀-鿿]/.test(ch)) chars.add(ch); };
all.forEach(p => { feed(p.name); feed(p.country); feed(p.owner); });

const map = {};
[...chars].sort().forEach(ch => {
  const py = String(pinyin(ch, { toneType: 'none', type: 'string' }) || '')
    .toLowerCase().replace(/ü/g, 'v').replace(/[^a-z]/g, '');
  if (py) map[ch] = py;
});

const out = '/* ============================================================\n' +
  ' * 自动生成（node scripts/build-pinyin.js）——勿手改\n' +
  ' * 搜索框拼音/首字母匹配用：项目 name/country/owner 出现过的汉字 → 无声调拼音（ü→v）\n' +
  ' * ============================================================ */\n' +
  "(function () { 'use strict';\n" +
  '  var M = ' + JSON.stringify(map) + ';\n' +
  "  if (typeof module !== 'undefined' && module.exports) module.exports = M;\n" +
  "  if (typeof window !== 'undefined') window.PINYIN_MAP = M;\n" +
  '})();\n';
fs.writeFileSync(path.join(ROOT, 'js', 'pinyin-map.js'), out);
console.log('✔ 已生成 js/pinyin-map.js：' + Object.keys(map).length + ' 个汉字（' +
  Math.round(Buffer.byteLength(out) / 1024) + ' KB），来源 ' + all.length + ' 个项目的 name/country/owner');
