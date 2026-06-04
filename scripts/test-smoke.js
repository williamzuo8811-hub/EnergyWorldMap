#!/usr/bin/env node
/* ============================================================
 * app.js 初始化冒烟测试（零依赖，CI 友好）
 * 用法：  node scripts/test-smoke.js
 *
 * 用最小 DOM + Leaflet stub 在 Node 里真正加载 util + 数据 + app.js，
 * 断言：IIFE 初始化不抛错、暴露了 window.__APP__、render() 与
 * buildSnapshotSVG() 可正常运行且产出结构合理。专门兜住"无浏览器
 * 环境下测不到的运行时引用错误"。
 * ============================================================ */
'use strict';
const path = require('path');

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* ---------- 最小 DOM stub ---------- */
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.dataset = {};
    this.style = {};
    this.children = [];
    this._html = '';
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  addEventListener() {} removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { return c; }
  append() {} insertBefore(c) { return c; }
  querySelector() { return new El(); }
  querySelectorAll() { return []; }
  closest() { return null; }
  matches() { return false; }
  setAttribute() {} getAttribute() { return null; } removeAttribute() {}
  focus() {} blur() {} click() {} remove() {}
  getContext() { return { scale() {}, drawImage() {} }; }
  toBlob(cb) { cb(null); }
}

const byId = new Map();
const doc = {
  getElementById(id) { if (!byId.has(id)) byId.set(id, new El(id)); return byId.get(id); },
  querySelector() { return new El(); },
  querySelectorAll() { return []; },
  createElement(t) { return new El(t); },
  createElementNS(_ns, t) { return new El(t); },
  addEventListener() {},
  body: new El('body'),
  documentElement: new El('html'),
};

/* ---------- 最小 Leaflet stub（链式 Proxy + 少量具体返回值）---------- */
function leafObj() {
  const overrides = {
    getChildCount: () => 0,
    getAllChildMarkers: () => [],
    hasLayer: () => false,
    getCenter: () => ({ lat: 25, lng: 30 }),
    getZoom: () => 3,
    attributionControl: { setPrefix() {}, addAttribution() {} },
  };
  const obj = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (prop in overrides) return overrides[prop];
      return () => obj;       // 任何未知方法都链式返回自身
    },
    apply() { return obj; },
    set() { return true; },   // 允许 m._cat = ... 之类赋值（静默吞掉）
  });
  return obj;
}
const L = {
  map: () => leafObj(),
  tileLayer: () => leafObj(),
  layerGroup: () => leafObj(),
  markerClusterGroup: () => leafObj(),
  divIcon: () => leafObj(),
  marker: () => leafObj(),
  polyline: () => leafObj(),
  heatLayer: () => leafObj(),
  control: { zoom: () => leafObj() },
  Browser: {},
};

/* ---------- 注入全局，加载 util + 数据 + app ---------- */
global.window = {};
global.document = doc;
// navigator 是 Node 只读全局，app 仅在点击时用 navigator.clipboard（已做存在性判断），无需注入
global.location = { hash: '', href: 'http://localhost/', pathname: '/', search: '' };
global.history = { replaceState() {} };
global.L = L;
// 让初始化完全同步：把定时器变 no-op（init 仅 loader 用到 setTimeout）
global.setTimeout = () => 0;
global.setInterval = () => 0;
global.clearTimeout = () => {};
global.clearInterval = () => {};

try {
  // util.js 在 Node 走 module.exports 分支，手动桥接到浏览器同名全局供 app.js 解构
  global.window.ENERGY_UTIL = require(path.join(__dirname, '..', 'js', 'util.js'));
  ['data', 'data-extra', 'data-brazil', 'data-mideast', 'data-russia-ca', 'data-clients',
    'data-brazil-future', 'data-saudi-future', 'data-seasia', 'data-africa', 'data-oceania',
    'data-europe', 'data-nuclear', 'data-northam', 'data-southasia', 'data-china-future', 'progress']
    .forEach(f => require(path.join(__dirname, '..', 'js', f + '.js')));
  require(path.join(__dirname, '..', 'js', 'app.js'));
} catch (e) {
  console.error('✘ app.js 初始化抛出异常：\n', e && e.stack || e);
  process.exit(1);
}

/* ---------- 断言 ---------- */
const APP = global.window.__APP__;
ok(APP && typeof APP === 'object', 'window.__APP__ 已暴露');
ok(APP && APP.state && Array.isArray(APP.state.compare), 'state.compare 初始化为数组');
ok(APP && typeof APP.render === 'function', 'render 可调用');

try { APP.render(); ok(true, 'render() 重渲染不抛错'); }
catch (e) { fails.push('render() 抛错：' + (e && e.message)); }

let svg = '';
try { svg = APP.buildSnapshotSVG(); ok(true, 'buildSnapshotSVG() 不抛错'); }
catch (e) { fails.push('buildSnapshotSVG() 抛错：' + (e && e.message)); }
ok(/^<svg[\s>]/.test(svg) && svg.indexOf('</svg>') > 0, '快照输出是完整 SVG');
ok((svg.match(/<text/g) || []).length >= 6, '快照含多段文本（KPI/标题等）');

try {
  const h = APP.stateToHash();
  ok(typeof h === 'string', 'stateToHash() 返回字符串');
} catch (e) { fails.push('stateToHash() 抛错：' + (e && e.message)); }

/* ---------- 汇总 ---------- */
console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · app.js 初始化冒烟测试');
console.log('═══════════════════════════════════════════════');
if (fails.length) {
  console.log(`✘ 失败 ${fails.length}：`);
  fails.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('✔ app.js 初始化 / render / 快照 / stateToHash 全部通过。');
process.exit(0);
