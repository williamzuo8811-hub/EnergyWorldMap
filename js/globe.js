/* ============================================================
 * 全球能源项目世界地图 —— 3D 地球版（globe.gl / three.js）
 * ------------------------------------------------------------
 * 与平面地图（app.js）共用同一份数据层（js/data*.js + util.js）。
 * 三大视觉语言：
 *   · 地表挤出柱（pointsData）——  柱高 ∝ √投资额(或装机MW)，柱色=品类
 *   · 跨境弧线（arcsData）——      由项目 route 走廊画大圆弧，流动虚线
 *   · 点阵陆地（hexPolygonsData）+ 大气辉光 + 经纬网 —— 暗色"指挥球"底
 * 纯前端零构建：globe.gl 自带 three.js（lib/globe.gl.min.js，UMD 全局 Globe），
 * 国界点阵来自 lib/world-110m.js（window.WORLD_GEO）。一切离线可用。
 * 调试句柄：window.__GLOBE__。
 * ============================================================ */
(function () {
  'use strict';

  const { META, CATEGORIES, REGIONS, STATUS } = window.ENERGY;
  const CAT_KEYS = Object.keys(CATEGORIES);
  const { buildProjects, LABELS_EN, capFmtMW, invMagnitude } = window.ENERGY_UTIL;
  const LAND = (window.WORLD_GEO && window.WORLD_GEO.features) || [];
  // 尊重「减少动态效果」系统偏好：默认不自转，相机飞行降级为瞬时跳转
  const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- 数据装配（与 app.js 同口径，共用 util.buildProjects；3D 只保留有 coord 的项目）----------
   * 不传 en：globe 详情卡正文始终用中文 desc/detail，从不读 descEn/detailEn，故无需加载 i18n-en.js。 */
  const PROJECTS = buildProjects(window.ENERGY, window.ENERGY_EXTRA, window.ENERGY_PROGRESS, { requireCoord: true });

  const years = PROJECTS.map(p => p.year).filter(y => typeof y === 'number');
  const MIN_YEAR = Math.min.apply(null, years);
  const MAX_YEAR = Math.max.apply(null, years);
  const RECENT_SINCE = META.recentSince;
  const isRecent = p => (p.updated || '') >= RECENT_SINCE;
  // 柱高归一化用的全库最大权重（投资额 / 装机MW 两套，使柱高在切换筛选时保持稳定基准）
  const MAXW = {
    inv: Math.max.apply(null, PROJECTS.map(p => p.inv || 0).concat([1])),
    cap: Math.max.apply(null, PROJECTS.map(p => p.capMW || 0).concat([1])),
  };

  /* ---------- 状态 ---------- */
  const state = {
    cats: new Set(CAT_KEYS), regions: new Set(), statuses: new Set(),
    minYear: MIN_YEAR, maxYear: MAX_YEAR, recentOnly: false,
    weight: 'inv',        // 柱高/口径：投资额 inv | 装机容量 cap(MW)
    arcs: true,           // 跨境弧线显隐
    rotate: true,         // 自动旋转
    lang: 'zh',           // zh | en
    focus: null,          // 当前聚焦项目 id
    insightRegion: null,  // 🌍 当前打开的区域洞察大区（null=未打开）
  };

  /* ---------- 中 / EN 标签 + 金额量级 ---------- */
  const CAT_EN = LABELS_EN.cat, REGION_EN = LABELS_EN.region, STATUS_EN = LABELS_EN.status;
  const T = {
    title: ['全球能源项目 · 3D 地球', 'Global Energy · 3D Globe'],
    sub: ['柱高≈投资额 · 弧线=跨境通道 · 拖拽旋转', 'Bar ≈ investment · Arcs = cross-border corridors'],
    proj: ['项目', 'Projects'], country: ['国家/地区', 'Countries'], inv: ['总投资', 'Investment'], recent: ['🆕 最新', '🆕 Latest'],
    cats: ['能源品类', 'Categories'], regionsL: ['所属大区', 'Regions'], statusL: ['项目状态', 'Status'], yearL: ['年份', 'Years'],
    all: ['全部', 'All'], recentP: ['🆕 近一年', '🆕 Latest'], future: ['未来 2027+', 'Future 2027+'],
    weightInv: ['⚖️ 柱高：投资额', '⚖️ Bars: Investment'], weightCap: ['⚖️ 柱高：装机 MW', '⚖️ Bars: Capacity MW'],
    arcsOn: ['⚡ 跨境弧线', '⚡ Arcs'], rotateOn: ['🌀 自动旋转', '🌀 Auto-rotate'],
    reset: ['↺ 重置', '↺ Reset'], flat: ['🗺️ 平面地图', '🗺️ Flat map'],
    countryRow: ['国家 / 地区', 'Country'], status: ['状态', 'Status'], year: ['年份', 'Year'], cap: ['规模 / 容量', 'Capacity'], invest: ['投资额', 'Investment'],
    owner: ['业主 / 参与方', 'Owner'], updated: ['最近动态', 'Updated'], progress: ['📍 最新进展', '📍 Latest'],
    flyto: ['🎯 聚焦', '🎯 Focus'], close: ['✕ 关闭', '✕ Close'],
    insight: ['🌍 区域能源洞察', '🌍 Regional Insight'],
    legend: ['柱高≈投资额', 'Bar height ≈ investment'], corridor: ['弧线 = 跨境/输送走廊', 'Arc = transmission / pipeline corridor'],
    clickHint: ['点击柱体看项目详情 · 滚轮缩放', 'Click a bar for details · scroll to zoom'],
    flagship: ['旗舰项目', 'Flagship'],
  };
  const L = (k) => T[k][state.lang === 'en' ? 1 : 0];
  const fmtNum = n => Math.round(n).toLocaleString('en-US');
  // 量级实现抽到 util.invMagnitude（不含币种符号），与 app.js 共用；KPI/详情各自前置 $ / ≈$
  const invMag = n => invMagnitude(n, state.lang);
  const usd = p => '≈$' + invMag(p.inv || 0);
  const nm = p => state.lang === 'en' ? (p.en || p.name) : (p.name || p.en || '');
  const altName = p => state.lang === 'en' ? (p.name || '') : (p.en || '');
  const catShort = k => state.lang === 'en' ? (CAT_EN[k] || (CATEGORIES[k] || {}).short || k) : ((CATEGORIES[k] || {}).short || k);
  const regionName = r => state.lang === 'en' ? (REGION_EN[r] || r) : r;
  const statusName = s => state.lang === 'en' ? (STATUS_EN[s] || s) : s;
  const capFmt = capFmtMW;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hexA(hex, a) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ---------- 🌍 区域能源洞察（与 2D 地图同源 window.REGION_INSIGHT）---------- */
  const REGION_INSIGHT = window.REGION_INSIGHT || {};
  const REGION_COLOR = {
    '东亚': '#ef5a6f', '东南亚': '#27c2a0', '南亚': '#f4a13c', '中亚': '#b98a4e', '中东': '#e7c84b',
    '欧洲': '#4d8bf0', '北美': '#8d6cf0', '南美': '#4fb86a', '非洲': '#e066c4', '大洋洲': '#33c6e0',
  };
  const RI_ORDER = REGIONS.filter(r => REGION_INSIGHT[r]);   // 有洞察内容的大区（按 REGIONS 顺序）
  // 大区质心（项目坐标平均，相机飞行用）
  const REGION_CENTROID = {};
  (function () {
    const acc = {};
    PROJECTS.forEach(p => { if (!p.coord) return; const a = acc[p.region] || (acc[p.region] = { x: 0, y: 0, n: 0 }); a.x += p.coord[0]; a.y += p.coord[1]; a.n++; });
    Object.keys(acc).forEach(r => { const a = acc[r]; REGION_CENTROID[r] = [a.x / a.n, a.y / a.n]; });
  })();
  // 单大区聚合（KPI 用；投资/装机口径排除「国际大客户」，与 app.js 一致）
  function computeRegionG(region) {
    const ps = PROJECTS.filter(p => p.region === region);
    const base = ps.filter(p => p.cat !== 'client'); const ib = base.length ? base : ps;
    return { n: ps.length, inv: ib.reduce((s, p) => s + (p.inv || 0), 0), mw: ib.reduce((s, p) => s + (p.capMW || 0), 0), recent: ps.filter(isRecent).length };
  }
  function defaultInsightRegion() {
    let best = RI_ORDER[0], bestN = -1;
    RI_ORDER.forEach(r => { const n = computeRegionG(r).n; if (n > bestN) { bestN = n; best = r; } });
    return best;
  }
  function flyToRegion(region) {
    const c = REGION_CENTROID[region]; if (!c) return;
    setRotate(false);
    try { world.pointOfView({ lat: c[1], lng: c[0], altitude: 1.75 }, REDUCED_MOTION ? 0 : 1100); } catch (e) {}
  }
  function hideRegionInsight() {
    const card = document.getElementById('region-card'); if (card) card.classList.remove('on');
    state.insightRegion = null;
    const ib = document.getElementById('btn-insight'); if (ib && ib.classList) ib.classList.remove('on');
  }
  function showRegionInsight(region, opts) {
    if (!REGION_INSIGHT[region]) return;
    const card = document.getElementById('region-card'); if (!card) return;
    hideDetail();
    state.insightRegion = region;
    const ins = REGION_INSIGHT[region], d = computeRegionG(region);
    const color = REGION_COLOR[region] || '#4d8bf0', en = state.lang === 'en';
    const idx = RI_ORDER.indexOf(region);
    const prev = RI_ORDER[(idx - 1 + RI_ORDER.length) % RI_ORDER.length];
    const next = RI_ORDER[(idx + 1) % RI_ORDER.length];
    const mw = d.mw >= 1000 ? (d.mw / 1000).toFixed(1) + ' GW' : Math.round(d.mw) + ' MW';
    const sec = (ic, t, b) => b ? '<div class="rc-sec"><div class="rc-h">' + ic + ' ' + t + '</div><div class="rc-b">' + b + '</div></div>' : '';
    const dyn = (ins.dynamics && ins.dynamics.length) ? '<ul class="rc-dyn">' + ins.dynamics.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
    const ctys = (ins.countries && ins.countries.length) ? '<div class="rc-ctys">' + ins.countries.map(c => '<span class="rc-cty">' + esc(c.name) + '</span>').join('') + '</div>' : '';
    const strip = '<div class="rc-strip">' + RI_ORDER.map(r => '<button class="rc-chip' + (r === region ? ' on' : '') + '" data-rg="' + esc(r) + '"><i style="background:' + (REGION_COLOR[r] || '#4d8bf0') + '"></i>' + esc(regionName(r)) + '</button>').join('') + '</div>';
    card.innerHTML =
      '<button class="d-close" id="rc-close">' + L('close') + '</button>'
      + '<div class="rc-head"><span class="rc-dot" style="background:' + color + '"></span><div class="rc-title">' + esc(regionName(region)) + ' · ' + (en ? 'Energy Insight' : '区域能源洞察') + '</div></div>'
      + '<div class="rc-nav"><button class="rc-navb" data-rg="' + esc(prev) + '" aria-label="上一大区">◂</button><button class="rc-navb" data-rg="' + esc(next) + '" aria-label="下一大区">▸</button><button class="rc-fly" id="rc-fly">' + (en ? '🎯 Fly here' : '🎯 飞到该区') + '</button></div>'
      + (ins.summary ? '<div class="rc-lead">' + esc(ins.summary) + '</div>' : '')
      + '<div class="rc-kpis"><div><b>' + d.n + '</b><span>' + (en ? 'Projects' : '项目') + '</span></div><div><b>≈$' + invMag(d.inv) + '</b><span>' + (en ? 'Investment' : '投资') + '</span></div><div><b>' + mw + '</b><span>' + (en ? 'Capacity' : '装机') + '</span></div></div>'
      + sec('📊', en ? 'Energy mix' : '能源结构', ins.energy ? esc(ins.energy) : '')
      + sec('🔌', en ? 'Grid status' : '电网情况', ins.grid ? esc(ins.grid) : '')
      + sec('📰', en ? 'Latest (2024–26)' : '最新动态（2024–26）', dyn)
      + sec('🎯', en ? 'Vendor opportunities' : '设备商机会', ins.opportunity ? esc(ins.opportunity) : '')
      + (ctys ? '<div class="rc-sec"><div class="rc-h">🗺️ ' + (en ? 'Key countries' : '重点国家') + '</div>' + ctys + '</div>' : '')
      + strip;
    card.classList.add('on');
    const cl = document.getElementById('rc-close'); if (cl) cl.onclick = hideRegionInsight;
    const fly = document.getElementById('rc-fly'); if (fly) fly.onclick = () => flyToRegion(region);
    card.querySelectorAll('.rc-navb, .rc-chip').forEach(el => { el.onclick = () => showRegionInsight(el.dataset.rg); });
    const ib = document.getElementById('btn-insight'); if (ib && ib.classList) ib.classList.add('on');
    if (!(opts && opts.noFly)) flyToRegion(region);
  }

  /* ---------- 筛选 ---------- */
  function passBase(p) {
    return (state.regions.size === 0 || state.regions.has(p.region))
      && (state.statuses.size === 0 || state.statuses.has(p.status))
      && (!state.recentOnly || isRecent(p))
      && p.year >= state.minYear && p.year <= state.maxYear;
  }
  const filtered = () => PROJECTS.filter(p => state.cats.has(p.cat) && passBase(p));
  const weightVal = p => state.weight === 'cap' ? (p.capMW || 0) : (p.inv || 0);
  const altFor = w => 0.012 + Math.sqrt(Math.max(w, 0)) / Math.sqrt(MAXW[state.weight] || 1) * 0.55;

  /* ---------- 构造挤出柱（points）与跨境弧线（arcs）---------- */
  function pointLabelHTML(p) {
    const c = CATEGORIES[p.cat];
    return '<div class="globe-tip">'
      + '<div class="gt-cat" style="color:' + c.color + '">' + c.icon + ' ' + esc(catShort(p.cat)) + (p.flagship ? ' · ★' : '') + '</div>'
      + '<div class="gt-name">' + esc(nm(p)) + '</div>'
      + '<div class="gt-meta">' + esc(p.country) + ' · ' + esc(statusName(p.status)) + ' · ' + p.year + '</div>'
      + '<div class="gt-inv">' + usd(p) + (p.cap ? ' · <span>' + esc(p.cap) + '</span>' : '') + '</div>'
      + '</div>';
  }
  function buildPoints(list) {
    return list.map(p => ({
      lat: p.coord[1], lng: p.coord[0],
      alt: altFor(weightVal(p)),
      radius: p.flagship ? 0.30 : 0.17,
      color: state.focus === p.id ? '#ffffff' : CATEGORIES[p.cat].color,
      p, label: pointLabelHTML(p),
    }));
  }
  function buildArcs(list) {
    if (!state.arcs) return [];
    const out = [];
    list.forEach(p => {
      if (p.route && p.route.length >= 2) {
        const col = CATEGORIES[p.cat].color;
        const stroke = 0.35 + Math.min((p.inv || 0) / 250, 1.4);
        for (let i = 0; i < p.route.length - 1; i++) {
          const a = p.route[i], b = p.route[i + 1];
          if (!a || !b || a.length < 2 || b.length < 2) continue;
          out.push({
            startLat: a[1], startLng: a[0], endLat: b[1], endLng: b[0],
            color: [hexA(col, 0.08), hexA(col, 0.95)], stroke, p,
            label: '<div class="globe-tip"><div class="gt-cat" style="color:' + col + '">' + CATEGORIES[p.cat].icon + ' ' + esc(catShort(p.cat)) + '</div><div class="gt-name">' + esc(nm(p)) + '</div><div class="gt-inv">' + usd(p) + '</div></div>',
          });
        }
      }
    });
    return out;
  }

  /* ============================================================
   * 3D 地球
   * ============================================================ */
  const el = document.getElementById('globe');
  const world = window.Globe({ animateIn: true, waitForGlobeReady: false })(el)
    .backgroundColor('rgba(0,0,0,0)')
    .showGlobe(true)
    .showGraticules(true)
    .showAtmosphere(true)
    .atmosphereColor('#3aa0ff')
    .atmosphereAltitude(0.24)
    // 点阵陆地（暗色"指挥球"底）
    .hexPolygonsData(LAND)
    .hexPolygonResolution(3)
    .hexPolygonMargin(0.28)
    .hexPolygonUseDots(true)
    .hexPolygonAltitude(0.004)
    .hexPolygonColor(() => 'rgba(78,132,200,0.32)')
    // 地表挤出柱
    .pointsData([])
    .pointLat('lat').pointLng('lng')
    .pointAltitude('alt').pointRadius('radius').pointColor('color')
    .pointResolution(6).pointsMerge(false).pointsTransitionDuration(700)
    .pointLabel('label')
    .onPointClick(d => d && d.p && focusProject(d.p))
    // 跨境弧线
    .arcsData([])
    .arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
    .arcColor('color').arcStroke('stroke').arcAltitudeAutoScale(0.45)
    .arcDashLength(0.45).arcDashGap(0.16).arcDashInitialGap(() => Math.random()).arcDashAnimateTime(2600)
    .arcsTransitionDuration(600)
    .arcLabel('label')
    .onArcClick(d => d && d.p && focusProject(d.p))
    // 聚焦脉冲环
    .ringColor(d => t => hexA(d.color, Math.max(0, 1 - t)))
    .ringMaxRadius(4).ringPropagationSpeed(2).ringRepeatPeriod(900)
    .ringsData([]);

  // 暗色地球材质（直接改现有材质的颜色，无需引用 THREE 构造器）
  try {
    const mat = world.globeMaterial();
    if (mat) {
      if (mat.color && mat.color.set) mat.color.set('#0a1430');
      if (mat.emissive && mat.emissive.set) { mat.emissive.set('#0a1f47'); mat.emissiveIntensity = 0.55; }
      mat.shininess = 4;
    }
  } catch (e) { /* 离屏/stub 环境下材质可能不可改，忽略 */ }

  // 相机 / 控制器
  function sizeGlobe() { try { world.width(el.clientWidth || window.innerWidth).height(el.clientHeight || window.innerHeight); } catch (e) {} }
  sizeGlobe();
  window.addEventListener('resize', sizeGlobe);
  try { world.pointOfView({ lat: 22, lng: 80, altitude: 2.6 }, 0); } catch (e) {}
  let controls = null;
  try {
    controls = world.controls();
    if (controls) {
      controls.autoRotate = !REDUCED_MOTION; controls.autoRotateSpeed = 0.42;
      if (REDUCED_MOTION) { state.rotate = false; const rb = document.getElementById('btn-rotate'); if (rb && rb.classList) rb.classList.remove('on'); }
      controls.enableDamping = true; controls.dampingFactor = 0.12;
      controls.minDistance = 140; controls.maxDistance = 700;
    }
  } catch (e) {}

  /* ---------- 渲染 ---------- */
  let _last = { points: [], arcs: [] };
  function render() {
    const list = filtered();
    const points = buildPoints(list);
    const arcs = buildArcs(list);
    _last = { points, arcs };
    try { world.pointsData(points).arcsData(arcs); } catch (e) {}
    updateKPIs(list);
    updateLegend(list);
  }
  function updateKPIs(list) {
    const onlyClient = state.cats.size === 1 && state.cats.has('client');
    const invList = list.filter(p => onlyClient || p.cat !== 'client'); // 国际大客户为跨视图，避免与实体项目重复计投资
    setText('kpi-proj', fmtNum(list.length));
    setText('kpi-country', fmtNum(new Set(list.map(p => p.country)).size));
    setText('kpi-inv', (state.lang === 'en' ? '$' : '') + invMag(invList.reduce((s, p) => s + (p.inv || 0), 0)));
    setText('kpi-recent', fmtNum(list.filter(isRecent).length));
  }
  function updateLegend(list) {
    // 图例：仅显示当前开启且有项目的品类，色点 + 名称 + 计数
    const cnt = {}; list.forEach(p => { cnt[p.cat] = (cnt[p.cat] || 0) + 1; });
    const box = document.getElementById('legend-cats'); if (!box) return;
    box.innerHTML = CAT_KEYS.filter(k => state.cats.has(k) && cnt[k]).map(k =>
      '<span class="lg-item"><i style="background:' + CATEGORIES[k].color + '"></i>' + esc(catShort(k)) + '<b>' + cnt[k] + '</b></span>'
    ).join('');
  }
  function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  /* ---------- 聚焦 / 详情卡 ---------- */
  function focusProject(p) {
    state.focus = p.id;
    setRotate(false);
    try {
      world.pointOfView({ lat: p.coord[1], lng: p.coord[0], altitude: 1.5 }, REDUCED_MOTION ? 0 : 1100);
      world.ringsData([{ lat: p.coord[1], lng: p.coord[0], color: CATEGORIES[p.cat].color }]);
    } catch (e) {}
    showDetail(p);
    // 重画一遍让聚焦柱体变白
    try { world.pointsData(buildPoints(filtered())); } catch (e) {}
  }
  function showDetail(p) {
    const card = document.getElementById('detail'); if (!card) return;
    hideRegionInsight();   // 项目详情与区域洞察卡互斥（同侧浮层）
    const c = CATEGORIES[p.cat];
    const row = (lab, val) => val ? '<div class="d-row"><span>' + esc(lab) + '</span><b>' + val + '</b></div>' : '';
    const alt = altName(p);
    card.innerHTML =
      '<button class="d-close" id="d-close">' + L('close') + '</button>'
      + '<div class="d-cat" style="color:' + c.color + '">' + c.icon + ' ' + esc(catShort(p.cat))
      + (p.flagship ? ' · <span class="d-star">★ ' + L('flagship') + '</span>' : '') + (isRecent(p) ? ' · <span class="d-new">🆕</span>' : '') + '</div>'
      + '<div class="d-name">' + esc(nm(p)) + '</div>'
      + (alt ? '<div class="d-alt">' + esc(alt) + '</div>' : '')
      + '<div class="d-grid">'
      + row(L('countryRow'), esc(p.country))
      + row(L('status'), esc(statusName(p.status)))
      + row(L('year'), p.year)
      + row(L('cap'), esc(p.cap || '—'))
      + row(L('invest'), '<span class="d-inv">' + usd(p) + '</span>' + (p.invText ? ' <span class="d-org">' + esc(p.invText) + '</span>' : ''))
      + row(L('owner'), esc(p.owner || '—'))
      + row(L('updated'), esc(p.updated || '—'))
      + '</div>'
      + (p.detail ? '<div class="d-desc">' + esc(p.detail) + '</div>' : (p.desc ? '<div class="d-desc">' + esc(p.desc) + '</div>' : ''))
      + (p.progress ? '<div class="d-prog"><b>' + L('progress') + '</b> ' + esc(p.progress) + '</div>' : '');
    card.classList.add('on');
    const close = document.getElementById('d-close');
    if (close) close.onclick = hideDetail;
  }
  function hideDetail() {
    const card = document.getElementById('detail'); if (card) card.classList.remove('on');
    state.focus = null;
    try { world.ringsData([]); world.pointsData(buildPoints(filtered())); } catch (e) {}
  }

  /* ---------- 自动旋转开关 ---------- */
  function setRotate(on) {
    state.rotate = on;
    if (controls) controls.autoRotate = on;
    const b = document.getElementById('btn-rotate'); if (b) b.classList.toggle('on', on);
  }

  /* ============================================================
   * UI 装配
   * ============================================================ */
  function toggleSet(set, k) { if (set.has(k)) set.delete(k); else set.add(k); }

  function buildChips() {
    // 品类
    const cl = document.getElementById('cat-list');
    if (cl) {
      cl.innerHTML = '';
      CAT_KEYS.forEach(k => {
        const c = CATEGORIES[k];
        const b = document.createElement('button');
        b.className = 'chip cat-chip' + (state.cats.has(k) ? ' on' : '');
        b.innerHTML = '<i style="background:' + c.color + '"></i>' + c.icon + ' ' + esc(catShort(k));
        b.onclick = () => { toggleSet(state.cats, k); b.classList.toggle('on', state.cats.has(k)); render(); };
        cl.appendChild(b);
      });
    }
    // 大区
    const rc = document.getElementById('region-chips');
    if (rc) {
      rc.innerHTML = '';
      REGIONS.forEach(r => {
        const b = document.createElement('button');
        b.className = 'chip' + (state.regions.has(r) ? ' on' : '');
        b.textContent = regionName(r);
        b.onclick = () => { toggleSet(state.regions, r); b.classList.toggle('on', state.regions.has(r)); render(); };
        rc.appendChild(b);
      });
    }
    // 状态
    const sc = document.getElementById('status-chips');
    if (sc) {
      sc.innerHTML = '';
      STATUS.forEach(s => {
        const b = document.createElement('button');
        b.className = 'chip' + (state.statuses.has(s) ? ' on' : '');
        b.textContent = statusName(s);
        b.onclick = () => { toggleSet(state.statuses, s); b.classList.toggle('on', state.statuses.has(s)); render(); };
        sc.appendChild(b);
      });
    }
  }

  function setYearPreset(preset) {
    if (preset === 'all') { state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.recentOnly = false; }
    else if (preset === 'recent') { state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.recentOnly = true; }
    else if (preset === 'future') { state.minYear = 2027; state.maxYear = MAX_YEAR; state.recentOnly = false; }
    document.querySelectorAll('#year-presets .yp').forEach(b => b.classList.toggle('on', b.dataset.preset === preset));
    render();
  }

  function applyLangText() {
    setText('g-title', L('title'));
    setText('g-sub', L('sub'));
    setText('lab-proj', L('proj')); setText('lab-country', L('country')); setText('lab-inv', L('inv')); setText('lab-recent', L('recent'));
    setText('t-cats', L('cats')); setText('t-regions', L('regionsL')); setText('t-status', L('statusL')); setText('t-year', L('yearL'));
    const yp = document.querySelectorAll('#year-presets .yp');
    if (yp[0]) yp[0].textContent = L('all'); if (yp[1]) yp[1].textContent = L('recentP'); if (yp[2]) yp[2].textContent = L('future');
    setText('btn-weight', state.weight === 'cap' ? L('weightCap') : L('weightInv'));
    setText('btn-arcs', L('arcsOn')); setText('btn-rotate', L('rotateOn'));
    setText('btn-reset', L('reset'));
    const flat = document.getElementById('btn-flat'); if (flat) flat.textContent = L('flat');
    setText('btn-insight', L('insight'));
    setText('legend-cap', L('legend')); setText('legend-corridor', L('corridor'));
    setText('g-hint', L('clickHint'));
    const lb = document.getElementById('btn-lang'); if (lb) lb.textContent = state.lang === 'en' ? '中文' : 'EN';
  }

  function wireControls() {
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
    // 年份预设
    document.querySelectorAll('#year-presets .yp').forEach(b => { b.onclick = () => setYearPreset(b.dataset.preset); });
    // 柱高权重
    on('btn-weight', () => { state.weight = state.weight === 'inv' ? 'cap' : 'inv'; const b = document.getElementById('btn-weight'); b.classList.toggle('on', state.weight === 'cap'); b.textContent = state.weight === 'cap' ? L('weightCap') : L('weightInv'); render(); });
    // 弧线
    on('btn-arcs', () => { state.arcs = !state.arcs; document.getElementById('btn-arcs').classList.toggle('on', state.arcs); render(); });
    // 旋转
    on('btn-rotate', () => setRotate(!state.rotate));
    // 🌍 区域能源洞察（开/关；默认打开项目最多的大区）
    on('btn-insight', () => {
      const card = document.getElementById('region-card');
      if (card && card.classList && card.classList.contains('on')) { hideRegionInsight(); return; }
      if (!RI_ORDER.length) return;
      showRegionInsight(state.insightRegion || defaultInsightRegion());
    });
    // 重置
    on('btn-reset', () => {
      state.cats = new Set(CAT_KEYS); state.regions = new Set(); state.statuses = new Set();
      state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.recentOnly = false; state.weight = 'inv'; state.arcs = true;
      hideDetail(); hideRegionInsight(); buildChips();
      document.querySelectorAll('#year-presets .yp').forEach(b => b.classList.toggle('on', b.dataset.preset === 'all'));
      const bw = document.getElementById('btn-weight'); if (bw) { bw.classList.remove('on'); bw.textContent = L('weightInv'); }
      const ba = document.getElementById('btn-arcs'); if (ba) ba.classList.add('on');
      setRotate(!REDUCED_MOTION);
      try { world.pointOfView({ lat: 22, lng: 80, altitude: 2.6 }, REDUCED_MOTION ? 0 : 1000); } catch (e) {}
      render();
    });
    // 语言
    on('btn-lang', () => {
      state.lang = state.lang === 'en' ? 'zh' : 'en'; applyLangText(); buildChips(); render();
      if (state.focus) { const p = PROJECTS.find(x => x.id === state.focus); if (p) showDetail(p); }
      else if (state.insightRegion) showRegionInsight(state.insightRegion, { noFly: true }); // 洞察卡随语言重渲染（不重新飞行）
    });
    // 左侧面板收起（移动端）
    on('panel-toggle', () => { const p = document.getElementById('left-panel'); if (p) p.classList.toggle('collapsed'); });
  }

  /* ---------- 背景星空（一次性绘制到 #stars canvas）---------- */
  function drawStars() {
    try {
      const cv = document.getElementById('stars'); if (!cv || !cv.getContext) return;
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth, h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      const ctx = cv.getContext('2d'); if (!ctx) return;
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
      const n = Math.min(520, Math.round(w * h / 2600));
      for (let i = 0; i < n; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 1.3 + 0.2;
        const a = Math.random() * 0.6 + 0.1;
        const tint = Math.random() < 0.18 ? '120,190,255' : (Math.random() < 0.1 ? '120,255,210' : '255,255,255');
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + tint + ',' + a.toFixed(2) + ')'; ctx.fill();
      }
    } catch (e) { /* stub 环境忽略 */ }
  }

  /* ---------- 启动 ---------- */
  function hideLoader() { const l = document.getElementById('globe-loader'); if (l) l.classList.add('hide'); }
  try { world.onGlobeReady(() => setTimeout(hideLoader, 350)); } catch (e) {}
  setTimeout(hideLoader, 2600); // 兜底

  drawStars();
  window.addEventListener('resize', drawStars);
  buildChips();
  wireControls();
  applyLangText();
  document.querySelectorAll('#year-presets .yp').forEach(b => b.classList.toggle('on', b.dataset.preset === 'all'));
  document.getElementById('btn-arcs') && document.getElementById('btn-arcs').classList.add('on');
  document.getElementById('btn-rotate') && document.getElementById('btn-rotate').classList.add('on');
  // 窄屏默认收起筛选面板：首屏先看完整地球，点 ☰ 再展开
  if (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) {
    const lp = document.getElementById('left-panel'); if (lp) lp.classList.add('collapsed');
  }
  render();

  // 调试句柄（也供 scripts/test-globe.js 在无 WebGL 环境断言数据装配）
  window.__GLOBE__ = {
    world, state, PROJECTS, render, filtered, buildPoints, buildArcs, focusProject,
    showRegionInsight, hideRegionInsight, flyToRegion, REGION_INSIGHT, RI_ORDER,
    get last() { return _last; }, MIN_YEAR, MAX_YEAR, MAXW,
  };
})();
