#!/usr/bin/env node
/* ============================================================
 * globe.js 初始化冒烟测试（零依赖，CI 友好）
 * 用法：  node scripts/test-globe.js
 *
 * 用最小 DOM + globe.gl(Globe) stub 在 Node 里加载 util + 数据 +
 * world-110m + globe.js，断言：IIFE 初始化不抛错、暴露 window.__GLOBE__、
 * 挤出柱(points) / 跨境弧线(arcs) 正确装配、render() 与 focusProject() 不抛错。
 * 专门兜住"无 WebGL 环境测不到的运行时引用错误"。
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
  querySelector() { return new El(); }
  querySelectorAll() { return []; }
  setAttribute() {} getAttribute() { return null; }
  getContext() { return { scale() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {}, set fillStyle(_v) {} }; }
}

const byId = new Map();
const doc = {
  getElementById(id) { if (!byId.has(id)) byId.set(id, new El(id)); return byId.get(id); },
  querySelector() { return new El(); },
  querySelectorAll() { return []; },
  createElement(t) { return new El(t); },
  addEventListener() {},
  body: new El('body'),
};

/* ---------- globe.gl(Globe) stub：链式 Proxy ---------- */
function globeProxy() {
  const obj = new Proxy(function () {}, {
    get(_t, prop) { if (prop === 'then') return undefined; return obj; },
    apply() { return obj; },
    set() { return true; },
  });
  return obj;
}
const Globe = function () { return function () { return globeProxy(); }; };

/* ---------- 注入全局 ---------- */
global.window = { Globe, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {} };
global.document = doc;
global.location = { hash: '', href: 'http://localhost/globe.html', pathname: '/globe.html', search: '' };
global.setTimeout = () => 0;
global.setInterval = () => 0;
global.clearTimeout = () => {};
global.clearInterval = () => {};

try {
  global.window.ENERGY_UTIL = require(path.join(__dirname, '..', 'js', 'util.js'));
  ['data', 'data-extra', 'data-brazil', 'data-mideast', 'data-russia-ca', 'data-clients',
    'data-brazil-future', 'data-saudi-future', 'data-seasia', 'data-africa', 'data-oceania',
    'data-europe', 'data-nuclear', 'data-northam', 'data-southasia', 'data-china-future', 'data-clients2', 'progress']
    .forEach(f => require(path.join(__dirname, '..', 'js', f + '.js')));
  require(path.join(__dirname, '..', 'lib', 'world-110m.js'));   // window.WORLD_GEO
  require(path.join(__dirname, '..', 'js', 'globe.js'));
} catch (e) {
  console.error('✘ globe.js 初始化抛出异常：\n', e && e.stack || e);
  process.exit(1);
}

/* ---------- 断言 ---------- */
const G = global.window.__GLOBE__;
ok(G && typeof G === 'object', 'window.__GLOBE__ 已暴露');
ok(G && Array.isArray(G.PROJECTS) && G.PROJECTS.length > 500, 'PROJECTS 装配（去重 + 仅含 coord）');
ok(G && G.MAXW && G.MAXW.inv > 0 && G.MAXW.cap > 0, '柱高基准 MAXW.inv / MAXW.cap > 0');
ok(G && typeof G.render === 'function', 'render 可调用');

let list = [], pts = [], arcs = [];
try {
  list = G.filtered();
  pts = G.buildPoints(list);
  arcs = G.buildArcs(list);
  ok(true, 'filtered()/buildPoints()/buildArcs() 不抛错');
} catch (e) { fails.push('数据装配抛错：' + (e && e.message)); }
ok(list.length > 500, 'filtered() 默认返回全量项目（' + list.length + '）');
ok(pts.length === list.length, '每个项目对应一根挤出柱');
ok(pts.every(p => typeof p.lat === 'number' && typeof p.lng === 'number' && p.alt > 0), '柱体含合法经纬度与正柱高');
ok(arcs.length > 50, '跨境弧线由 route 走廊装配（' + arcs.length + ' 段）');
ok(arcs.every(a => typeof a.startLat === 'number' && typeof a.endLat === 'number' && Array.isArray(a.color)), '弧线含起止经纬度与渐变色');

try { G.render(); ok(true, 'render() 重渲染不抛错'); }
catch (e) { fails.push('render() 抛错：' + (e && e.message)); }

try {
  const withRoute = G.PROJECTS.find(p => p.route && p.route.length >= 2) || G.PROJECTS[0];
  G.focusProject(withRoute); ok(true, 'focusProject() 不抛错');
} catch (e) { fails.push('focusProject() 抛错：' + (e && e.message)); }

// 权重切换为装机 MW 后柱高仍合法
try {
  G.state.weight = 'cap';
  const pc = G.buildPoints(G.filtered());
  ok(pc.every(p => p.alt > 0), '装机 MW 口径下柱高仍为正');
  G.state.weight = 'inv';
} catch (e) { fails.push('weight=cap 抛错：' + (e && e.message)); }

/* ---------- 汇总 ---------- */
console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · globe.js（3D 地球）初始化冒烟测试');
console.log('═══════════════════════════════════════════════');
if (fails.length) {
  console.log(`✘ 失败 ${fails.length}：`);
  fails.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('✔ globe.js 初始化 / 挤出柱 / 跨境弧线 / render / focus 全部通过。');
console.log(`  projects=${G.PROJECTS.length}  points=${pts.length}  arcs=${arcs.length}`);
process.exit(0);
