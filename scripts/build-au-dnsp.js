#!/usr/bin/env node
/* ============================================================
 * 生成 js/au-dnsp.js —— 澳洲配网公司（DNSP）服务范围面（au.html 🔧 配网图层）
 * 用法：  npm i --no-save polygon-clipping   （仅构建时需要；运行时 / CI 零依赖）
 *         node scripts/build-au-dnsp.js [--out js/au-dnsp.js] [--check]
 *
 * 输入：scripts/data/au-dnsp-src.js（手描示意边界 + 配网元数据，按州分组、按优先级排序）
 *       lib/au-states.js（Natural Earth 1:50m 州 / 领地面，lib 目录下、勿手改）
 * 做法：每个显式区 = 手描多边形 ∩ 州面（NSW 含 ACT）− 同州前面已划出的区（相邻区共用顶点即可无缝拼合，
 *       手描线可以越过海岸线——海岸由州面裁出，精度与州界一致）；每州最后一个 default 区 = 州面 − 全部显式区。
 *       geo:'ACT' 直接取首都领地面。输出 GeoJSON MultiPolygon（[lng, lat]，3 位小数），面积 < 0.0003 deg²（≈3 km²）的碎片丢弃。
 * --check：只比对现有 js/au-dnsp.js 是否与当前源一致（不一致退出码 1）。输出不带时间戳，diff 可读。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, argOf('--out', 'js/au-dnsp.js'));
const CHECK = args.indexOf('--check') >= 0;

let pc;
try { pc = require('polygon-clipping'); } catch (e) {
  console.error('✘ 需要 polygon-clipping（仅构建时）：npm i --no-save polygon-clipping  然后重跑');
  process.exit(2);
}
const SRC = require('./data/au-dnsp-src.js');

/* ---------- 州面 ---------- */
const w = {};
new vm.Script(fs.readFileSync(path.join(ROOT, 'lib/au-states.js'), 'utf8')).runInNewContext({ window: w });
const FEATS = (w.AU_STATES_GEO && w.AU_STATES_GEO.features) || [];
if (!FEATS.length) { console.error('✘ lib/au-states.js 没有州面'); process.exit(1); }
const normState = a => (a === 'ACT' ? 'NSW' : a);
const geomOf = f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);   // → MultiPolygon
const STATE_UNION = {};
FEATS.forEach(f => { const a = normState(f.properties.abbr); STATE_UNION[a] = STATE_UNION[a] ? pc.union(STATE_UNION[a], geomOf(f)) : geomOf(f); });
const featGeom = abbr => { const f = FEATS.find(x => x.properties.abbr === abbr); if (!f) throw new Error('州面不存在：' + abbr); return geomOf(f); };

/* ---------- 几何清理 ---------- */
const MIN_AREA = 0.0003;   // deg²，≈3 km²：裁剪产生的碎片（真实小岛也在这个量级以下，缩放 ≤8 看不见）
const r3 = v => Math.round(v * 1000) / 1000;
const ringArea = ring => { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return Math.abs(s) / 2; };
function cleanRing(ring) {
  const out = [];
  ring.forEach(p => { const q = [r3(p[0]), r3(p[1])]; const l = out[out.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q); });
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  if (out.length < 3) return null;
  out.push([out[0][0], out[0][1]]);   // GeoJSON 闭合
  return out;
}
function clean(mp) {
  const polys = [];
  (mp || []).forEach(poly => {
    const outer = cleanRing(poly[0]); if (!outer || ringArea(outer) < MIN_AREA) return;
    const holes = poly.slice(1).map(cleanRing).filter(h => h && ringArea(h) >= MIN_AREA);
    polys.push([outer].concat(holes));
  });
  return polys;
}
const closeRing = pts => { const r = pts.map(p => [p[0], p[1]]); if (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) r.push([r[0][0], r[0][1]]); return r; };
const bboxOf = mp => { const b = [[180, 90], [-180, -90]]; mp.forEach(poly => poly[0].forEach(p => { if (p[0] < b[0][0]) b[0][0] = p[0]; if (p[1] < b[0][1]) b[0][1] = p[1]; if (p[0] > b[1][0]) b[1][0] = p[0]; if (p[1] > b[1][1]) b[1][1] = p[1]; })); return b; };
const km2 = mp => { let s = 0; mp.forEach(poly => { const lat = poly[0][0][1]; const k = 111 * 111 * Math.cos(lat * Math.PI / 180); s += ringArea(poly[0]) * k; poly.slice(1).forEach(h => { s -= ringArea(h) * k; }); }); return Math.round(s); };

/* ---------- 按州裁剪 ---------- */
const byState = {};
SRC.areas.forEach(a => { (byState[a.state] = byState[a.state] || []).push(a); });
const errors = [];
Object.keys(byState).forEach(st => {
  const su = STATE_UNION[st]; if (!su) { errors.push('源里的州没有州面：' + st); return; }
  const list = byState[st], defaults = list.filter(a => a.default);
  if (defaults.length !== 1) { errors.push(st + ' 必须恰有一个 default 区（实际 ' + defaults.length + '）'); return; }
  if (list[list.length - 1] !== defaults[0]) errors.push(st + ' 的 default 区应排在该州最后');
  let taken = null;
  list.filter(a => !a.default).forEach(a => {
    if (!a.geo && !(Array.isArray(a.polygon) && a.polygon.length >= 3)) { errors.push(a.key + ' 缺 polygon / geo'); return; }
    let g = a.geo ? featGeom(a.geo) : [[closeRing(a.polygon)]];
    g = pc.intersection(g, su);
    if (taken) g = pc.difference(g, taken);
    g = clean(g);
    if (!g.length) errors.push(a.key + ' 裁剪后为空（手描边界是否全在海上 / 被前面的区盖住？）');
    taken = taken ? pc.union(taken, g) : g;
    a._geom = g;
  });
  defaults[0]._geom = clean(taken ? pc.difference(su, taken) : su);
});
const keys = new Set();
SRC.areas.forEach(a => { if (keys.has(a.key)) errors.push('key 重复：' + a.key); keys.add(a.key); if (!/^#[0-9a-f]{6}$/i.test(a.color || '')) errors.push(a.key + ' color 需为 #rrggbb'); if (!a.label || a.label.length !== 2) errors.push(a.key + ' 缺 label'); });
if (errors.length) { console.error('✘ 源定义有误：\n - ' + errors.join('\n - ')); process.exit(1); }

/* ---------- 输出 ---------- */
const areas = SRC.areas.map(a => ({
  key: a.key, name: a.name, zh: a.zh, state: a.state, kind: a.kind, color: a.color, sheet: a.sheet,
  desc: a.desc, descEn: a.descEn, label: a.label, labelZoom: a.labelZoom || 5,
  bbox: bboxOf(a._geom), km2: km2(a._geom),
  geometry: { type: 'MultiPolygon', coordinates: a._geom },
}));
const head = '/* 澳洲配网公司（DNSP）服务范围面（window.AU_DNSP）—— au.html 🔧 配网图层。非项目数据。\n'
  + ' * 由 scripts/build-au-dnsp.js 生成（手描源 scripts/data/au-dnsp-src.js × lib/au-states.js 州面裁剪，需 npm i --no-save polygon-clipping）——勿手改，改源文件后重跑。\n'
  + ' * areas[{key, name, zh, state(ACT 并入 NSW), kind(dnsp 公用配网 | regional 州属区域电力公司 | private 矿企 / 私网), color, sheet(匹配 js/au-states.js dnsps[].name 的开头),\n'
  + ' *        desc / descEn(覆盖范围一句话), label[lng,lat] + labelZoom(地图标签位置 / 出现缩放), bbox[[minLng,minLat],[maxLng,maxLat]], km2, geometry(GeoJSON MultiPolygon [lng,lat])}]\n'
  + ' * 顺序即判定顺序：同州显式区在前、兜底区（Essential / Powercor / Ergon / Horizon / SAPN / TasNetworks / PWC）最后；相邻区无缝拼合，海岸与州界同精度。\n'
  + ' * 边界为示意范围（都会区边界精确到街道级，这里只到区 / 市镇级，±10–30 km）：卡片与图例均注明，接入前请以 DNSP 官方地址查询为准。 */\n';
const body = 'window.AU_DNSP = {\n  asOf: ' + JSON.stringify(SRC.asOf) + ',\n  source: ' + JSON.stringify(SRC.source) + ',\n  sources: ' + JSON.stringify(SRC.sources) + ',\n  areas: [\n'
  + areas.map(a => '    ' + JSON.stringify(a)).join(',\n') + '\n  ]\n};\n';
const text = head + body;

if (CHECK) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== text) { console.error('✘ ' + path.relative(ROOT, OUT) + ' 与当前源不一致 —— 运行 node scripts/build-au-dnsp.js 后提交'); process.exit(1); }
  console.log('✔ ' + path.relative(ROOT, OUT) + ' 与源一致');
  process.exit(0);
}
fs.writeFileSync(OUT, text);
console.log('✔ 写出 ' + path.relative(ROOT, OUT) + '（' + (text.length / 1024).toFixed(1) + ' KB，' + areas.length + ' 个配网区）');
areas.forEach(a => console.log('   ' + a.key.padEnd(18) + a.state.padEnd(4) + String(a.geometry.coordinates.length).padStart(3) + ' 面 ' + String(a.geometry.coordinates.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0)).padStart(5) + ' 点  ≈' + a.km2.toLocaleString('en-US') + ' km²'));
