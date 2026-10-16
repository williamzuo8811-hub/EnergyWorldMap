#!/usr/bin/env node
/* ============================================================
 * au.js（澳洲电网与能源动态地图）初始化冒烟测试 + 澳洲专属数据完整性检查（零依赖，CI 友好）
 * 用法：  node scripts/test-au.js
 *
 * 用最小 DOM + Leaflet stub 在 Node 里加载 util + 数据链 + lib/au-states.js +
 * js/au-*.js + js/au.js，断言：IIFE 初始化不抛错、暴露 window.__AU__、
 * 项目能按坐标归到州、render() / 四种卡片 / stateToHash() / 语言切换不抛错；
 * 并校验澳洲专属数据：走廊节点 id 可解析、坐标落在澳洲范围、燃煤机组字段齐全、
 * 州档案覆盖 7 个州 / 领地。
 * ============================================================ */
'use strict';
const path = require('path');

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* ---------- 最小 DOM stub ---------- */
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.dataset = {}; this.style = {}; this.children = []; this._html = ''; this.value = ''; this.textContent = '';
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
  focus() {} blur() {} click() {} remove() {}
}
const byId = new Map();
const doc = {
  getElementById(id) { if (!byId.has(id)) byId.set(id, new El(id)); return byId.get(id); },
  querySelector() { return new El(); },
  querySelectorAll() { return []; },
  createElement(t) { return new El(t); },
  addEventListener() {},
  head: new El('head'), body: new El('body'), documentElement: new El('html'),
};

/* ---------- 最小 Leaflet stub（链式 Proxy）---------- */
function leafObj() {
  const overrides = { getChildCount: () => 0, getAllChildMarkers: () => [], hasLayer: () => false, getCenter: () => ({ lat: -27, lng: 134 }), getZoom: () => 4,
    attributionControl: { setPrefix() {}, addAttribution() {} } };
  const obj = new Proxy(function () {}, {
    get(_t, prop) { if (prop === 'then') return undefined; if (prop in overrides) return overrides[prop]; return () => obj; },
    apply() { return obj; }, set() { return true; },
  });
  return obj;
}
const L = { map: () => leafObj(), tileLayer: () => leafObj(), layerGroup: () => leafObj(), markerClusterGroup: () => leafObj(), divIcon: () => leafObj(), marker: () => leafObj(),
  polyline: () => leafObj(), polygon: () => leafObj(), geoJSON: () => leafObj(), circleMarker: () => leafObj(), control: { zoom: () => leafObj() }, DomEvent: { stopPropagation() {} } };

/* ---------- 注入全局，加载数据链 + au.js ---------- */
global.window = {};
global.document = doc;
global.location = { hash: '', href: 'http://localhost/au.html', pathname: '/au.html', search: '' };
global.history = { replaceState() {} };
global.L = L;
global.setTimeout = () => 0; global.setInterval = () => 0; global.clearTimeout = () => {}; global.clearInterval = () => {};

const J = f => path.join(__dirname, '..', f);
try {
  global.window.ENERGY_UTIL = require(J('js/util.js'));
  ['data', 'data-extra', 'data-brazil', 'data-mideast', 'data-russia-ca', 'data-clients', 'data-brazil-future', 'data-saudi-future', 'data-seasia', 'data-africa',
    'data-oceania', 'data-europe', 'data-nuclear', 'data-northam', 'data-southasia', 'data-china-future', 'data-clients2', 'data-refresh2606', 'data-refresh2606b',
    'data-refresh2606c', 'data-clients3', 'data-mining2607', 'data-mining2608', 'data-australia2608', 'data-clients-mining', 'data-refresh2607', 'data-refresh2608', 'progress', 'pinyin-map']
    .forEach(f => require(J('js/' + f + '.js')));
  require(J('lib/au-states.js'));
  require(J('js/au-states.js'));
  require(J('js/au-grid.js'));
  require(J('js/au-coal.js'));
  require(J('js/au-pipeline.js'));
  require(J('js/au-rez.js'));
  require(J('js/au.js'));
} catch (e) {
  console.error('✘ au.js 初始化抛出异常：\n', e && e.stack || e);
  process.exit(1);
}

/* ---------- 断言：应用 ---------- */
const AU = global.window.__AU__;
ok(AU && typeof AU === 'object', 'window.__AU__ 已暴露');
ok(AU && AU.PROJECTS.length >= 200, '澳洲项目 ≥200（实际 ' + (AU && AU.PROJECTS.length) + '）');
const noState = AU ? AU.PROJECTS.filter(p => !p.auState) : [];
ok(noState.length <= Math.ceil(AU.PROJECTS.length * 0.02), '≥98% 的澳洲项目能按坐标归到州（未归：' + noState.map(p => p.id + ' ' + p.name).join('; ') + '）');
const byState = {}; AU.PROJECTS.forEach(p => { byState[p.auState] = (byState[p.auState] || 0) + 1; });
ok(['NSW', 'VIC', 'QLD', 'SA', 'WA'].every(s => byState[s] > 0), '五个主要州都有项目：' + JSON.stringify(byState));
// 抽查：伊拉灵电厂坐标 → NSW；珀斯近郊 → WA；达尔文 → NT；离岸吉普斯兰海上风电 → VIC（最近州回退）
ok(AU.stateOf([151.52, -33.06]) === 'NSW', 'stateOf 伊拉灵 → NSW');
ok(AU.stateOf([115.86, -31.95]) === 'WA', 'stateOf 珀斯 → WA');
ok(AU.stateOf([130.84, -12.46]) === 'NT', 'stateOf 达尔文 → NT');
ok(AU.stateOf([147.80, -38.70]) === 'VIC', 'stateOf 吉普斯兰外海 → VIC（最近州回退）');
ok(AU.stateOf([149.13, -35.28]) === 'NSW', 'stateOf 堪培拉（ACT 并入 NSW）');
ok(AU.stateOf([0, 0]) === null, 'stateOf 远离澳洲 → null');

try { AU.render(); ok(true, 'render() 不抛错'); } catch (e) { fails.push('render() 抛错：' + (e && e.message)); }
try { const f = AU.filtered(); ok(Array.isArray(f) && f.length === AU.PROJECTS.length, '默认筛选 = 全部澳洲项目'); } catch (e) { fails.push('filtered() 抛错：' + (e && e.message)); }
try { AU.state.epcOnly = true; const f = AU.filtered(); ok(f.length > 0 && f.every(p => p.epcStatus === '未招标'), 'EPC 未招标筛选只留未招标项目（' + f.length + ' 个）'); AU.state.epcOnly = false; } catch (e) { fails.push('epcOnly 筛选抛错：' + (e && e.message)); }
try { AU.state.states = new Set(['WA']); const f = AU.filtered(); ok(f.length > 0 && f.every(p => p.auState === 'WA'), '州筛选只留该州项目'); AU.state.states = new Set(); AU.render(); } catch (e) { fails.push('州筛选抛错：' + (e && e.message)); }
try { AU.showDetail(AU.PROJECTS[0].id); ok(true, 'showDetail() 不抛错'); } catch (e) { fails.push('showDetail() 抛错：' + (e && e.message)); }
try { if (AU.COAL.length) AU.showCoal(0); ok(true, 'showCoal() 不抛错'); } catch (e) { fails.push('showCoal() 抛错：' + (e && e.message)); }
try { AU.STATES.forEach(s => AU.showState(s.abbr)); ok(true, 'showState() 七州不抛错'); } catch (e) { fails.push('showState() 抛错：' + (e && e.message)); }
try { if (AU.LINES.length) AU.showLine(AU.LINES[0].id); ok(true, 'showLine() 不抛错'); } catch (e) { fails.push('showLine() 抛错：' + (e && e.message)); }
try { const h = AU.stateToHash(); ok(typeof h === 'string', 'stateToHash() 返回字符串'); } catch (e) { fails.push('stateToHash() 抛错：' + (e && e.message)); }
try { AU.state.lang = 'en'; AU.applyLang(); ok(/Australia Grid/.test(doc.getElementById('t-title').textContent), 'applyLang() 切到 EN 后标题为英文'); AU.state.lang = 'zh'; AU.applyLang(); } catch (e) { fails.push('applyLang() 抛错：' + (e && e.message)); }
try { const c = AU.countdown({ status: 'operating', closeYear: new Date().getFullYear() + 3, closeMonth: 6 }); ok(c.months > 24 && c.months <= 36 && c.cls === 'hot', 'countdown 三年内 → hot'); } catch (e) { fails.push('countdown 抛错：' + (e && e.message)); }
try { const k = AU.kpis(AU.PROJECTS); ok(k.inv > 0 && k.open.length > 0, 'kpis() 有投资与未招标数'); } catch (e) { fails.push('kpis() 抛错：' + (e && e.message)); }

/* ---------- 断言：澳洲专属数据 ---------- */
const inAU = c => Array.isArray(c) && c.length === 2 && c[0] >= 105 && c[0] <= 160 && c[1] <= -8 && c[1] >= -48;
const GRID = global.window.AU_GRID || { nodes: [], lines: [] };
const ids = new Set();
(GRID.nodes || []).forEach(n => {
  ok(!ids.has(n.id), '节点 id 重复：' + n.id); ids.add(n.id);
  ok(inAU(n.coord), '节点坐标不在澳洲范围：' + n.id + ' ' + JSON.stringify(n.coord));
  ok(typeof n.kv === 'number' && n.kv > 0, '节点缺 kv：' + n.id);
});
const lids = new Set();
(GRID.lines || []).forEach(l => {
  ok(!lids.has(l.id), '走廊 id 重复：' + l.id); lids.add(l.id);
  ok(['existing', 'building', 'planned'].indexOf(l.status) >= 0, '走廊状态非法：' + l.id + ' ' + l.status);
  ok(Array.isArray(l.nodes) && l.nodes.length >= 2, '走廊节点不足：' + l.id);
  (l.nodes || []).forEach(id => ok(ids.has(id), '走廊 ' + l.id + ' 引用了不存在的节点 ' + id));
});
ok((GRID.lines || []).length >= 20, '走廊 ≥20 条（实际 ' + (GRID.lines || []).length + '）');
const COAL = (global.window.AU_COAL && global.window.AU_COAL.plants) || [];
ok(COAL.length >= 12, '燃煤机组 ≥12 座（实际 ' + COAL.length + '）');
COAL.forEach(p => {
  ok(inAU(p.coord), '燃煤坐标不在澳洲范围：' + p.en);
  ok(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT'].indexOf(p.state) >= 0, '燃煤州代码非法：' + p.en);
  if (p.status !== 'closed') { ok((typeof p.closeYear === 'number' && p.closeYear >= 2026) || /无官方|未定|未公布/.test(p.closeText || ''), '在运燃煤缺关停年（且 closeText 未说明无官方日期）：' + p.en); ok(typeof p.mw === 'number' && p.mw > 0, '在运燃煤缺 MW：' + p.en); }
  ok(Array.isArray(p.sources) && p.sources.length > 0, '燃煤缺来源：' + p.en);
});
const SHEETS = global.window.AU_STATES || {};
['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT'].forEach(a => {
  const s = SHEETS[a];
  ok(s && s.tnsp && s.tnsp.name && Array.isArray(s.dnsps) && s.dnsps.length > 0 && s.vendor && Array.isArray(s.sources) && s.sources.length >= 3, '州档案不完整：' + a);
});

/* ---------- 断言：🧭 管线 + 🌞 REZ ---------- */
const PIPE = (global.window.AU_PIPELINE && global.window.AU_PIPELINE.items) || [];
const ZONES = (global.window.AU_REZ && global.window.AU_REZ.zones) || [];
ok(PIPE.length >= 500, '管线 ≥500 条（实际 ' + PIPE.length + '）');
ok(/^\d{4}-\d{2}$/.test(String(global.window.AU_PIPELINE && global.window.AU_PIPELINE.asOf)), '管线 asOf 应为 YYYY-MM');
ok(PIPE.filter(it => it.status === 'committed').length >= 40 && PIPE.filter(it => it.status === 'anticipated').length >= 40 && PIPE.filter(it => it.status === 'proposed').length >= 300, '管线三档各有足够条目');
ok(ZONES.length >= 40, 'REZ ≥40 个（实际 ' + ZONES.length + '）');
const pids = new Set();
PIPE.forEach(it => {
  ok(it.id && !pids.has(it.id), '管线 id 缺失或重复：' + it.en); pids.add(it.id);
  ok(['committed', 'anticipated', 'proposed', 'existing'].indexOf(it.status) >= 0, '管线状态非法：' + it.en + ' ' + it.status);
  ok(['solar', 'wind', 'offshore_wind', 'battery', 'pumped_hydro', 'hydro', 'gas', 'hydrogen', 'coal', 'other'].indexOf(it.fuel) >= 0, '管线燃料非法：' + it.en + ' ' + it.fuel);
  ok(typeof it.mw === 'number' && it.mw > 0, '管线缺 MW：' + it.en);
  ok(inAU(it.coord), '管线坐标不在澳洲范围：' + it.en + ' ' + JSON.stringify(it.coord));
  ok(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT'].indexOf(it.state) >= 0, '管线州代码非法：' + it.en);
  ok(!it.cod || /^\d{4}(-\d{2})?$/.test(String(it.cod)), '管线 COD 格式应为 YYYY 或 YYYY-MM：' + it.en + ' ' + it.cod);
  ok(!it.mix || (Object.keys(it.mix).length > 1 && Math.abs(Object.keys(it.mix).reduce((a, k) => a + it.mix[k], 0) - it.mw) < 1), '管线 mix 构成应 ≥2 种燃料且合计 = mw：' + it.en);
  ok(!it.siteMw || (typeof it.siteMw === 'number' && it.siteMw > 0), '管线 siteMw 应为正数：' + it.en);
  ok(!it.mwh || (typeof it.mwh === 'number' && it.mwh > 0), '管线 mwh 应为正数：' + it.en);
  ok(it.name && it.en && /[\u4e00-\u9fff]/.test(it.name), '管线中文名缺失：' + it.en);
});
ok(PIPE.filter(it => !it.approx).length >= 100, '至少 100 条管线有精确坐标（实际 ' + PIPE.filter(it => !it.approx).length + '）');
const zkeys = new Set();
ZONES.forEach(z => {
  ok(z.key && !zkeys.has(z.key), 'REZ key 缺失或重复：' + z.en); zkeys.add(z.key);
  ok(['declared', 'planned', 'candidate'].indexOf(z.status) >= 0, 'REZ 状态非法：' + z.en);
  ok(Array.isArray(z.polygon) && z.polygon.length >= 3 && z.polygon.every(inAU), 'REZ 边界不足 3 点或越界：' + z.en);
  ok(inAU(z.center), 'REZ 中心点越界：' + z.en);
});
try { AU.render(); ok(AU.filteredPipe().every(it => it.status !== 'proposed'), '默认管线筛选不含拟建'); } catch (e) { fails.push('filteredPipe() 抛错：' + (e && e.message)); }
try { AU.state.plStatus = new Set(['committed', 'anticipated', 'proposed']); const f = AU.filteredPipe(); ok(f.length === PIPE.length, '三档全开 = 全部管线（' + f.length + '/' + PIPE.length + '）'); AU.state.plStatus = new Set(['committed', 'anticipated']); } catch (e) { fails.push('plStatus 筛选抛错：' + (e && e.message)); }
try { if (PIPE.length) AU.showPipe(PIPE[0].id); ok(true, 'showPipe() 不抛错'); } catch (e) { fails.push('showPipe() 抛错：' + (e && e.message)); }
try { ZONES.forEach(z => AU.showZone(z.key)); ok(true, 'showZone() 不抛错'); } catch (e) { fails.push('showZone() 抛错：' + (e && e.message)); }
try { ZONES.forEach(z => ok(AU.zoneOf(z.center) != null, 'zoneOf(中心点) 应命中某区：' + z.en)); } catch (e) { fails.push('zoneOf() 抛错：' + (e && e.message)); }
try { AU.render(); ok(true, 'render() 含管线/REZ 不抛错'); } catch (e) { fails.push('render() 抛错：' + (e && e.message)); }

/* ---------- 汇报 ---------- */
if (fails.length) { console.error('✘ test-au 失败：\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('✔ test-au 通过：' + AU.PROJECTS.length + ' 个澳洲项目 · ' + (GRID.nodes || []).length + ' 节点 / ' + (GRID.lines || []).length + ' 走廊 · ' + COAL.length + ' 燃煤机组 · ' + Object.keys(SHEETS).length + ' 州档案 · ' + PIPE.length + ' 管线 · ' + ZONES.length + ' REZ');
