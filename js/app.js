/* ============================================================
 * 全球能源项目世界地图 —— 交互逻辑（Leaflet 瓦片地图版）
 * 国界/国名/省/市/街道随缩放由底图自然显示；支持底图切换。
 * ============================================================ */
(function () {
  'use strict';

  const { META, CATEGORIES, REGIONS, STATUS } = window.ENERGY;
  const CAT_KEYS = Object.keys(CATEGORIES);
  // 纯逻辑（子分类规则 / 容量解析 / 坐标纠偏）抽至 js/util.js，与 scripts/test-units.js 共享同一实现
  const { SUB_DEFS, classifySub, parseCapacity, wgs2gcj, normalizeOwner } = window.ENERGY_UTIL;

  const SUB_LABEL = {};
  Object.keys(SUB_DEFS).forEach(cat => { SUB_LABEL[cat] = {}; SUB_DEFS[cat].forEach(d => { SUB_LABEL[cat][d.key] = d.label; }); });
  const subLabel = p => (SUB_LABEL[p.cat] && SUB_LABEL[p.cat][p.sub]) || '';

  // 合并核心数据与扩充数据（data-extra.js），按名称去重
  const PROJECTS = (function () {
    const all = window.ENERGY.PROJECTS.concat(window.ENERGY_EXTRA || []);
    const PROG = window.ENERGY_PROGRESS || {};
    const seen = new Set(), out = [];
    all.forEach(p => {
      if (p && p.name && !seen.has(p.name)) {
        if (!p.progress && PROG[p.id]) p.progress = PROG[p.id];
        p.sub = classifySub(p);
        const cc = parseCapacity(p.cap);
        p.capMW = cc.mw; p.capMWh = cc.mwh; p.capKm = cc.km; p.capKbd = cc.kbd; p.capWty = cc.wty;
        seen.add(p.name); out.push(p);
      }
    });
    return out;
  })();
  const RECENT_SINCE = META.recentSince;
  const isRecent = p => (p.updated || '') >= RECENT_SINCE;

  /* ---------- 地图与底图 ---------- */
  const map = L.map('map', {
    center: [25, 30], zoom: 3, minZoom: 2, maxZoom: 18,
    zoomControl: false, worldCopyJump: true, attributionControl: true,
    maxBounds: [[-85, -200], [85, 200]], maxBoundsViscosity: 0.6,
  });
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  map.attributionControl.setPrefix('');

  const esriDarkBase = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { subdomains: ['server', 'services'], maxZoom: 16, attribution: '© Esri' });
  const esriDark = L.layerGroup([
    esriDarkBase,
    L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { subdomains: ['server', 'services'], maxZoom: 16 }),
  ]);
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });

  const BASES = [
    { key: 'dark',   name: '暗色科技',   crs: 'wgs84', layer: esriDark },
    { key: 'osm',    name: 'OSM',       crs: 'wgs84', layer: osm },
  ];
  let currentCRS = 'wgs84';
  let activeBaseKey = 'dark';
  BASES[0].layer.addTo(map);

  function switchBase(key) {
    if (key === activeBaseKey) return;
    const prev = BASES.find(b => b.key === activeBaseKey);
    const next = BASES.find(b => b.key === key);
    map.removeLayer(prev.layer);
    next.layer.addTo(map);
    activeBaseKey = key;
    currentCRS = next.crs;
    document.querySelectorAll('#basemap-switch .bm').forEach(el => el.classList.toggle('on', el.dataset.key === key));
    render();
  }

  // 投影：项目 [lng,lat](WGS84) → Leaflet [lat,lng]（按底图 CRS 纠偏）
  function toLatLng(coord) {
    const c = currentCRS === 'gcj02' ? wgs2gcj(coord[0], coord[1]) : coord;
    return [c[1], c[0]];
  }

  /* ---------- 状态 ---------- */
  const years = PROJECTS.map(p => p.year);
  const MIN_YEAR = Math.min.apply(null, years);
  const MAX_YEAR = Math.max.apply(null, years);
  const state = {
    cats: new Set(CAT_KEYS), subOff: new Set(), regions: new Set(), statuses: new Set(),
    minYear: MIN_YEAR, maxYear: MAX_YEAR, q: '', recentOnly: false, heat: false,
    weight: 'inv', sort: 'inv', // weight: 圆点/热力按 inv 投资 或 cap 装机容量；sort: TOP 排序
    playYear: null,             // 时间轴播放时的"当前年"（用于年份大字 + 当年新项目高亮）
    lang: 'zh',                 // 'zh' | 'en'：项目名称与分析标签的中英切换
    lines: true,                // 飞线（输变电/高铁/管道连线）显隐开关
    compare: [],                // 🆚 国别对比已选国家（最多 4 个）
    heatCat: null,              // 🔥 热力分面：聚焦单一品类（null=全部）
  };

  /* ---------- 中 / EN 语言（项目名走 en 字段；分类/大区/状态/界面标签走映射） ---------- */
  const CAT_EN = { renewable: 'Renewables', nuclear: 'Nuclear', grid: 'Grid & T&D', storage: 'Storage', ci: 'Industry', datacenter: 'Data Center', transport: 'Transport', petro: 'Oil·Gas·Chem', mining: 'Mining', client: 'Key Clients' };
  const REGION_EN = { '中国': 'China', '亚洲': 'Asia', '中东': 'Middle East', '欧洲': 'Europe', '北美': 'N. America', '南美': 'S. America', '非洲': 'Africa', '大洋洲': 'Oceania' };
  const STATUS_EN = { '规划': 'Planned', '在建': 'Building', '投运': 'Operating' };
  const I18N = {
    '国家 / 地区': 'Country / Region', '状态': 'Status', '规模 / 容量': 'Capacity', '投资额': 'Investment',
    '业主 / 参与方': 'Owner', '最近动态': 'Updated', '📍 最新进展': '📍 Latest', '🆕 近一年': '🆕 Recent',
    '项目数': 'Projects', '总投资': 'Investment', '装机容量': 'Capacity', '分品类（项目数 · 投资额）': 'By category (count · investment)',
    '项目状态': 'Status', '里程碑年份分布': 'Milestone years', '重点项目 TOP（按投资额）': 'Top projects (by investment)',
    '无匹配项目，请调整筛选条件': 'No matching projects — adjust filters', '当前筛选无可解析的容量指标': 'No parseable capacity metrics in current filter',
    '装机': 'Power', '储能': 'Storage', '线路': 'Lines', '油气产能': 'Oil/Gas', '产能': 'Output',
    '企业 / 业主排行榜': 'Company / Owner League Table', '项目数': 'Projects', '按项目数排名（投资额为该业主累计）': 'Ranked by project count (investment = owner total)',
    '点公司名筛选其全部项目': 'Click a company to filter its projects', '🏢 企业榜': '🏢 Companies',
  };
  const tr = s => state.lang === 'en' ? (I18N[s] || s) : s;
  const nm = p => state.lang === 'en' ? (p.en || p.name) : (p.name || p.en || '');
  const altName = p => state.lang === 'en' ? (p.name || '') : (p.en || '');
  const catShort = k => state.lang === 'en' ? (CAT_EN[k] || (CATEGORIES[k] || {}).short || k) : ((CATEGORIES[k] || {}).short || k);
  const catName = k => state.lang === 'en' ? (CAT_EN[k] || (CATEGORIES[k] || {}).name || k) : ((CATEGORIES[k] || {}).name || k);
  const regionName = r => state.lang === 'en' ? (REGION_EN[r] || r) : r;
  const statusName = s => state.lang === 'en' ? (STATUS_EN[s] || s) : s;

  const sizeFn = v => Math.max(8, Math.min(34, 7 + Math.sqrt(Math.max(v, 1)) * 0.95));
  const fmtNum = n => Math.round(n).toLocaleString('en-US');
  const fmtInv = n => n >= 10000 ? (n / 10000).toFixed(1) + ' 万亿' : fmtNum(n) + ' 亿';
  // 圆点/热力权重值：投资额 或 装机容量(MW)
  const weightVal = p => state.weight === 'cap' ? (p.capMW || 0) : (p.inv || 0);
  // 统一美元口径展示（小额保留 1 位小数）
  const usd = p => { const n = p.inv || 0; return '≈$' + (n >= 10000 ? (n / 10000).toFixed(1) + ' 万亿' : (n < 10 ? (Math.round(n * 10) / 10) : Math.round(n)).toLocaleString('en-US') + ' 亿'); };
  const capFmt = mw => mw == null ? '—' : (mw >= 1000 ? (mw / 1000).toFixed(mw < 10000 ? 1 : 0) + ' GW' : Math.round(mw) + ' MW');
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function matchQ(p, q) {
    if (!q) return true;
    const hay = (p.name + ' ' + (p.en || '') + ' ' + p.country + ' ' + (p.owner || '') + ' ' + p.desc).toLowerCase();
    return hay.indexOf(q.toLowerCase()) >= 0;
  }
  function passBase(p) {
    return (state.regions.size === 0 || state.regions.has(p.region))
      && (state.statuses.size === 0 || state.statuses.has(p.status))
      && (!state.recentOnly || isRecent(p))
      && p.year >= state.minYear && p.year <= state.maxYear && matchQ(p, state.q);
  }
  const filtered = () => PROJECTS.filter(p => state.cats.has(p.cat) && !state.subOff.has(p.cat + ':' + p.sub) && passBase(p));

  // 品类 / 大区切换（供品类条、图例、区域格、筛选项共用，保持联动）
  function toggleCat(key) { if (state.cats.has(key)) state.cats.delete(key); else state.cats.add(key); syncCatUI(); render(); }
  function syncCatUI() {
    document.querySelectorAll('.cat-chip').forEach(el => el.classList.toggle('off', !state.cats.has(el.dataset.key)));
    document.querySelectorAll('.cat-legend .cl').forEach(el => el.classList.toggle('off', !state.cats.has(el.dataset.key)));
  }
  function toggleRegion(r) {
    if (state.regions.has(r)) state.regions.delete(r); else state.regions.add(r);
    document.querySelectorAll('#region-chips .pill').forEach(el => el.classList.toggle('on', state.regions.has(el.dataset.v)));
    render();
  }

  /* ---------- 地图标记（含聚合） ---------- */
  // 飞线常显（不参与聚合），项目标记进入聚合组
  const lineLayer = L.layerGroup().addTo(map);
  let heatLayer = null;
  // 投资热力图渐变（适配暗色底图）：蓝→青→绿→黄→橙→红
  const HEAT_GRADIENT = { 0.0: '#0b1f4d', 0.22: '#1e63ff', 0.42: '#15c2c2', 0.60: '#34d058', 0.76: '#ffd000', 0.88: '#ff7a18', 1.0: '#ff2d2d' };
  const markerCluster = L.markerClusterGroup({
    maxClusterRadius: 46,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    chunkedLoading: true,
    removeOutsideVisibleBounds: true,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      const tally = {};
      cluster.getAllChildMarkers().forEach(m => { const k = m._cat; if (k) tally[k] = (tally[k] || 0) + 1; });
      let best = null, bestN = -1;
      Object.keys(tally).forEach(k => { if (tally[k] > bestN) { bestN = tally[k]; best = k; } });
      const color = (CATEGORIES[best] && CATEGORIES[best].color) || '#21c7ff';
      const size = count < 10 ? 36 : count < 30 ? 42 : count < 80 ? 50 : 58;
      return L.divIcon({
        className: 'mk-cluster',
        html: '<div class="mkc" style="--c:' + color + ';width:' + size + 'px;height:' + size + 'px"><b>' + count + '</b></div>',
        iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      });
    },
  }).addTo(map);

  function updateMap(items) {
    lineLayer.clearLayers();
    markerCluster.clearLayers();
    // 连线（输变电/高铁/管道，飞线）—— 可经 ⚡ 按钮显隐
    if (state.lines) items.forEach(p => {
      if (p.route && p.route.length >= 2) {
        L.polyline(p.route.map(toLatLng), {
          color: CATEGORIES[p.cat].color, weight: 2, opacity: 0.55,
          className: 'flowline', dashArray: '1 11', lineCap: 'round',
        }).addTo(lineLayer);
      }
    });
    if (state.heat) {
      // —— 热力图模式：按 √(投资 或 装机容量) 加权显示宏观格局，隐藏聚合标记 ——
      if (map.hasLayer(markerCluster)) map.removeLayer(markerCluster);
      // 分面：聚焦单一品类时，只让该品类项目贡献热力
      const hitems = state.heatCat ? items.filter(p => p.cat === state.heatCat) : items;
      const hlCap = document.querySelector('.heat-legend .hl-cap');
      if (hlCap) hlCap.textContent = (state.weight === 'cap' ? '装机热力' : '投资热力') + (state.heatCat ? ' · ' + catShort(state.heatCat) : '');
      const pts = hitems.map(p => {
        const ll = toLatLng(p.coord);
        const w = weightVal(p); const v = (w > 0) ? w : 1;   // 开方压缩量级，避免超大项目独占
        return [ll[0], ll[1], Math.sqrt(v)];
      });
      const ws = pts.map(a => a[2]).sort((a, b) => a - b);
      // max 取约 92 分位，让中大型项目与密集簇都能“发烫”，少数巨无霸推到红
      const max = ws.length ? Math.max(0.5, ws[Math.floor(ws.length * 0.92)] * 1.15) : 1;
      const opts = { radius: 30, blur: 24, minOpacity: 0.20, maxZoom: 8, max: max, gradient: HEAT_GRADIENT };
      if (!heatLayer) { heatLayer = L.heatLayer(pts, opts).addTo(map); }
      else { heatLayer.setOptions(opts); heatLayer.setLatLngs(pts); if (!map.hasLayer(heatLayer)) heatLayer.addTo(map); }
      return;
    }
    // —— 标记/聚合模式 ——
    if (heatLayer && map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
    if (!map.hasLayer(markerCluster)) markerCluster.addTo(map);
    // 项目标记（批量加入聚合组）
    const markers = [];
    items.forEach(p => {
      const c = CATEGORIES[p.cat], d = Math.round(sizeFn(weightVal(p)));
      const cls = 'dot' + (p.flagship ? ' is-flag' : '') + (isRecent(p) ? ' is-new' : '') + (state.playYear === p.year ? ' is-year-new' : '');
      const icon = L.divIcon({
        className: 'mk', iconSize: [d, d], iconAnchor: [d / 2, d / 2],
        html: '<i class="' + cls + '" style="--c:' + c.color + ';width:' + d + 'px;height:' + d + 'px"></i>',
      });
      const m = L.marker(toLatLng(p.coord), { icon, riseOnHover: true });
      m._cat = p.cat;
      m.bindTooltip(
        '<b>' + (isRecent(p) ? '🆕 ' : '') + esc(nm(p)) + '</b><br>' +
        '<span style="color:' + c.color + '">' + catShort(p.cat) + (subLabel(p) ? ' / ' + subLabel(p) : '') + '</span> · ' + esc(p.country) +
        ' · ' + esc(usd(p)) + (p.capMW ? ' · ' + capFmt(p.capMW) : '') +
        (p.progress ? '<br><span style="color:#8fb0e0">📍 ' + esc(p.progress) + '</span>' : ''),
        { direction: 'top', offset: [0, -d / 2 - 2], className: 'mk-tip', sticky: true }
      );
      m.on('click', () => showDetail(p));
      markers.push(m);
    });
    markerCluster.addLayers(markers);
  }

  /* ---------- 左侧筛选 UI ---------- */
  const catListEl = document.getElementById('cat-list');
  CAT_KEYS.forEach(key => {
    const c = CATEGORIES[key];
    const group = document.createElement('div');
    group.className = 'cat-group'; group.dataset.key = key;
    const chip = document.createElement('div');
    chip.className = 'cat-chip'; chip.dataset.key = key;
    chip.innerHTML = '<span class="dot" style="background:' + c.color + ';color:' + c.color + '"></span>' +
      '<span class="nm">' + c.icon + ' ' + c.name + '</span><span class="ct">0</span>' +
      '<span class="caret" title="展开子分类">▸</span>';
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('caret')) { group.classList.toggle('open'); return; }
      toggleCat(key);
    });
    group.appendChild(chip);
    const subWrap = document.createElement('div');
    subWrap.className = 'sub-list';
    SUB_DEFS[key].forEach(d => {
      const s = document.createElement('div');
      s.className = 'sub-chip'; s.dataset.key = key; s.dataset.sub = d.key;
      s.innerHTML = '<span class="sdot" style="background:' + c.color + '"></span><span class="snm">' + d.label + '</span><span class="sct">0</span>';
      s.addEventListener('click', () => {
        const id = key + ':' + d.key;
        if (state.subOff.has(id)) state.subOff.delete(id); else state.subOff.add(id);
        s.classList.toggle('off', state.subOff.has(id));
        render();
      });
      subWrap.appendChild(s);
    });
    group.appendChild(subWrap);
    catListEl.appendChild(group);
  });

  const regionEl = document.getElementById('region-chips');
  REGIONS.forEach(r => {
    const el = document.createElement('div');
    el.className = 'pill'; el.textContent = r; el.dataset.v = r;
    el.addEventListener('click', () => toggleRegion(r));
    regionEl.appendChild(el);
  });

  const statusEl = document.getElementById('status-chips');
  STATUS.forEach(s => {
    const el = document.createElement('div');
    el.className = 'pill status'; el.textContent = s; el.dataset.v = s;
    el.addEventListener('click', () => {
      if (state.statuses.has(s)) state.statuses.delete(s); else state.statuses.add(s);
      el.classList.toggle('on', state.statuses.has(s)); render();
    });
    statusEl.appendChild(el);
  });

  // 🆕 仅看最近一年
  const recentBtn = document.getElementById('recent-toggle');
  recentBtn.addEventListener('click', () => {
    state.recentOnly = !state.recentOnly;
    recentBtn.classList.toggle('on', state.recentOnly);
    render();
  });

  // 年份区间：双手柄滑块 [minYear, maxYear] + 快捷预设
  const yearLabel = document.getElementById('year-label');
  const yearMin = document.getElementById('year-min');
  const yearMax = document.getElementById('year-max');
  const yearMinLab = document.getElementById('year-min-lab');
  const yearMaxLab = document.getElementById('year-max-lab');
  const rdFill = document.getElementById('rd-fill');
  [yearMin, yearMax].forEach(s => { s.min = MIN_YEAR; s.max = MAX_YEAR; });
  yearMin.value = MIN_YEAR; yearMax.value = MAX_YEAR;
  function syncYearUI() {
    yearMinLab.textContent = state.minYear; yearMaxLab.textContent = state.maxYear;
    const span = (MAX_YEAR - MIN_YEAR) || 1;
    rdFill.style.left = ((state.minYear - MIN_YEAR) / span * 100) + '%';
    rdFill.style.right = ((MAX_YEAR - state.maxYear) / span * 100) + '%';
    yearLabel.textContent = (state.minYear <= MIN_YEAR && state.maxYear >= MAX_YEAR) ? '全部' : state.minYear + '–' + state.maxYear;
  }
  function clearPresetActive() { document.querySelectorAll('.year-presets .yp').forEach(b => b.classList.remove('on')); }
  function onYearInput(which) {
    pausePlay();
    let lo = +yearMin.value, hi = +yearMax.value;
    if (lo > hi) { if (which === 'min') { yearMin.value = hi; lo = hi; } else { yearMax.value = lo; hi = lo; } }
    state.minYear = lo; state.maxYear = hi;
    clearPresetActive(); syncYearUI(); render();
  }
  yearMin.addEventListener('input', () => onYearInput('min'));
  yearMax.addEventListener('input', () => onYearInput('max'));
  document.querySelectorAll('.year-presets .yp').forEach(btn => {
    btn.addEventListener('click', () => {
      pausePlay();
      const pr = btn.dataset.preset;
      if (pr === 'recent') { state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.recentOnly = true; }
      else if (pr === 'future') { state.minYear = Math.min(2027, MAX_YEAR); state.maxYear = MAX_YEAR; state.recentOnly = false; }
      else { state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.recentOnly = false; }
      clearPresetActive(); btn.classList.add('on');
      yearMin.value = state.minYear; yearMax.value = state.maxYear;
      if (recentBtn) recentBtn.classList.toggle('on', state.recentOnly);
      syncYearUI(); render();
    });
  });

  // ▶ 时间轴播放：2012→今 逐年累计揭示，看能源版图"长"出来
  let playTimer = null, playYearN = MIN_YEAR;
  const btnPlay = document.getElementById('btn-play');
  const yearTicker = document.getElementById('year-ticker');
  function setPlayUI(on) {
    if (btnPlay) { btnPlay.classList.toggle('on', on); btnPlay.textContent = on ? '⏸ 暂停' : '▶ 播放时间轴'; }
    if (yearTicker) yearTicker.classList.toggle('show', on);
  }
  function playStep(y) {
    state.maxYear = y; state.playYear = y; yearMax.value = y;
    if (yearTicker) yearTicker.textContent = y;
    syncYearUI(); render();
  }
  function pausePlay() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    state.playYear = null; setPlayUI(false);
  }
  function startPlay() {
    if (!btnPlay) return;
    clearPresetActive();
    state.minYear = MIN_YEAR; yearMin.value = MIN_YEAR;      // 从头累计
    playYearN = (state.maxYear >= MAX_YEAR || state.maxYear <= MIN_YEAR) ? MIN_YEAR : state.maxYear; // 重头或续播
    setPlayUI(true); playStep(playYearN);
    playTimer = setInterval(() => {
      if (playYearN >= MAX_YEAR) {                            // 到末年：定格全量并停
        pausePlay(); state.maxYear = MAX_YEAR; yearMax.value = MAX_YEAR; syncYearUI(); render(); return;
      }
      playYearN += 1; playStep(playYearN);
    }, 850);
  }
  if (btnPlay) btnPlay.addEventListener('click', () => { playTimer ? pausePlay() : startPlay(); });

  // 搜索：防抖 160ms（2600+ 项目，避免逐字符全量重渲染卡顿）
  let searchTimer = null;
  document.getElementById('search').addEventListener('input', e => {
    const v = e.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = v; render(); }, 160);
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    pausePlay();
    state.cats = new Set(CAT_KEYS); state.subOff.clear(); state.regions.clear(); state.statuses.clear();
    state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.q = ''; state.recentOnly = false;
    state.weight = 'inv'; state.sort = 'inv'; state.heatCat = null;
    clearPresetActive(); document.querySelector('.year-presets .yp[data-preset="all"]').classList.add('on');
    if (typeof syncHeatFacets === 'function') syncHeatFacets();
    applyUIFromState(); render();
  });

  // 底图切换按钮
  const bmEl = document.getElementById('basemap-switch');
  BASES.forEach(b => {
    const el = document.createElement('div');
    el.className = 'bm' + (b.key === activeBaseKey ? ' on' : ''); el.dataset.key = b.key;
    el.textContent = b.name;
    el.addEventListener('click', () => switchBase(b.key));
    bmEl.appendChild(el);
  });
  document.getElementById('btn-home').addEventListener('click', () => map.flyTo([25, 30], 3, { duration: 0.6 }));

  // 🔥 投资热力图切换
  const btnHeat = document.getElementById('btn-heat');
  btnHeat.addEventListener('click', () => {
    state.heat = !state.heat;
    btnHeat.classList.toggle('on', state.heat);
    document.body.classList.toggle('heat-on', state.heat);
    render();
  });

  // ⚖️ 加权口径切换：投资额 ↔ 装机容量（影响圆点大小与热力）
  const btnWeight = document.getElementById('btn-weight');
  btnWeight.addEventListener('click', () => {
    state.weight = state.weight === 'cap' ? 'inv' : 'cap';
    btnWeight.classList.toggle('on', state.weight === 'cap');
    btnWeight.textContent = state.weight === 'cap' ? '⚖️ 容量权重' : '⚖️ 投资权重';
    render();
  });

  // 重点项目 TOP 排序切换：投资额 ↔ 装机容量
  const sortToggle = document.getElementById('sort-toggle');
  if (sortToggle) sortToggle.addEventListener('click', () => {
    state.sort = state.sort === 'cap' ? 'inv' : 'cap';
    sortToggle.textContent = state.sort === 'cap' ? '按装机容量 ⇄' : '按投资额 ⇄';
    render();
  });

  // ⚡ 飞线显隐（输变电/高铁/管道连线）
  const btnFlow = document.getElementById('btn-flow');
  if (btnFlow) btnFlow.addEventListener('click', () => {
    state.lines = !state.lines;
    btnFlow.classList.toggle('on', state.lines);
    render();
  });

  // 🏢 企业 / 业主排行榜
  const btnLeague = document.getElementById('btn-league');
  if (btnLeague) btnLeague.addEventListener('click', showLeague);

  // 🆚 国别对比
  const btnCompare = document.getElementById('btn-compare');
  if (btnCompare) btnCompare.addEventListener('click', openCompare);

  // 中 / EN 语言切换
  const btnLang = document.getElementById('btn-lang');
  function applyLang() {
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-CN';
    document.body.classList.toggle('lang-en', state.lang === 'en');
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (el.dataset.zh == null) el.dataset.zh = el.textContent;
      el.textContent = state.lang === 'en' ? el.dataset.i18n : el.dataset.zh;
    });
    const sEl = document.getElementById('search');
    if (sEl) sEl.placeholder = state.lang === 'en' ? 'Search project / country / owner…' : '搜索项目 / 国家 / 业主…';
    if (btnLang) btnLang.textContent = state.lang === 'en' ? '中' : 'EN';
    if (sortToggle) sortToggle.textContent = state.lang === 'en' ? (state.sort === 'cap' ? 'by capacity ⇄' : 'by investment ⇄') : (state.sort === 'cap' ? '按装机容量 ⇄' : '按投资额 ⇄');
  }
  if (btnLang) btnLang.addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'zh' : 'en';
    applyLang(); render();
  });

  /* ---------- 右侧统计 ---------- */
  // 硬指标：把结构化容量按当前筛选汇总（仅显示有数值的口径）
  function updateCapStats(items) {
    const el = document.getElementById('cap-stats'); if (!el) return;
    const sum = f => items.reduce((s, p) => s + (f(p) || 0), 0);
    const gw = sum(p => p.capMW) / 1000, gwh = sum(p => p.capMWh) / 1000;
    const km = sum(p => p.capKm), kbd = sum(p => p.capKbd), wty = sum(p => p.capWty);
    const n1 = x => (x < 10 ? (Math.round(x * 10) / 10) : Math.round(x)).toLocaleString('en-US');
    const chips = [];
    if (gw > 0) chips.push(['⚡', '装机', gw >= 1000 ? (gw / 1000).toFixed(1) + ' TW' : n1(gw) + ' GW']);
    if (gwh > 0) chips.push(['🔋', '储能', n1(gwh) + ' GWh']);
    if (km > 0) chips.push(['🔌', '线路', Math.round(km).toLocaleString('en-US') + ' km']);
    if (kbd > 0) chips.push(['🛢️', '油气产能', Math.round(kbd).toLocaleString('en-US') + ' 万桶/日']);
    if (wty > 0) chips.push(['🏭', '产能', Math.round(wty).toLocaleString('en-US') + ' 万吨/年']);
    el.innerHTML = chips.length
      ? chips.map(c => '<div class="cap-chip"><div class="cc-ico">' + c[0] + '</div><div class="cc-body"><div class="cc-v">' + c[2] + '</div><div class="cc-l">' + tr(c[1]) + '</div></div></div>').join('')
      : '<div class="cap-empty">' + tr('当前筛选无可解析的容量指标') + '</div>';
  }

  function updateStats(items) {
    // 投资/容量默认排除"国际大客户"，避免与能源品类对同一物理项目重复计；仅看 client 时照常计入
    const clientOnly = state.cats.size === 1 && state.cats.has('client');
    const statItems = clientOnly ? items : items.filter(p => p.cat !== 'client');
    const totalInv = statItems.reduce((s, p) => s + (p.inv || 0), 0);
    const countries = new Set(items.map(p => p.country)).size;
    const recentN = items.filter(isRecent).length;
    document.getElementById('kpi-proj').textContent = items.length;
    document.getElementById('kpi-country').textContent = countries;
    document.getElementById('kpi-inv').textContent = fmtInv(totalInv);
    document.getElementById('kpi-recent').textContent = recentN;
    updateCapStats(statItems);

    const base = PROJECTS.filter(passBase);
    const catCount = {}; CAT_KEYS.forEach(k => catCount[k] = 0);
    base.forEach(p => catCount[p.cat]++);
    const maxC = Math.max(1, ...Object.values(catCount));
    document.getElementById('cat-bars').innerHTML = CAT_KEYS.map(k => {
      const c = CATEGORIES[k], n = catCount[k], dim = state.cats.has(k) ? '' : 'opacity:.35';
      return '<div class="bar-row" data-key="' + k + '" style="cursor:pointer;' + dim + '"><div class="bar-head"><span class="dot" style="background:' + c.color + '"></span>' +
        '<span class="nm">' + catShort(k) + '</span><span class="vv">' + n + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + (n / maxC * 100) + '%;background:' + c.color + '"></div></div></div>';
    }).join('');
    document.querySelectorAll('.cat-chip').forEach(el => { el.querySelector('.ct').textContent = catCount[el.dataset.key]; });

    const subCount = {};
    base.forEach(p => { const id = p.cat + ':' + p.sub; subCount[id] = (subCount[id] || 0) + 1; });
    document.querySelectorAll('.sub-chip').forEach(el => {
      el.querySelector('.sct').textContent = subCount[el.dataset.key + ':' + el.dataset.sub] || 0;
    });

    const regCount = {}; REGIONS.forEach(r => regCount[r] = 0);
    items.forEach(p => { if (regCount[p.region] != null) regCount[p.region]++; });
    document.getElementById('region-grid').innerHTML = REGIONS.map(r =>
      '<div class="region-cell' + (state.regions.has(r) ? ' on' : '') + '" data-region="' + r + '"><div class="rv">' + regCount[r] + '</div><div class="rl">' + regionName(r) + '</div></div>').join('');
  }

  /* ---------- 项目列表（投资额排序） ---------- */
  function updateList(items) {
    const listEl = document.getElementById('proj-list');
    if (!items.length) { listEl.innerHTML = '<div class="empty">' + tr('无匹配项目，请调整筛选条件') + '</div>'; return; }
    const sortCap = state.sort === 'cap';
    const sorted = items.slice().sort((a, b) => sortCap ? ((b.capMW || 0) - (a.capMW || 0)) : (b.inv - a.inv)).slice(0, 14);
    listEl.innerHTML = sorted.map(p => {
      const c = CATEGORIES[p.cat];
      return '<div class="proj-item" data-id="' + p.id + '" style="border-left-color:' + c.color + '">' +
        '<div class="pn">' + (p.flagship ? '<span class="star">★</span>' : '') + esc(nm(p)) +
        (isRecent(p) ? '<span class="newtag">🆕</span>' : '') + '</div>' +
        '<div class="pm"><span>' + esc(p.country) + '</span><span>' + catShort(p.cat) + '</span><span>' + (sortCap ? esc(capFmt(p.capMW)) : esc(usd(p))) + '</span></div></div>';
    }).join('');
    listEl.querySelectorAll('.proj-item').forEach(el => {
      el.addEventListener('click', () => {
        const p = PROJECTS.find(x => String(x.id) === el.dataset.id);
        if (p) { showDetail(p); map.flyTo(toLatLng(p.coord), 8, { duration: 0.7 }); }
      });
    });
  }

  /* ---------- 详情卡 ---------- */
  // 正文双语：EN 模式优先用 detailEn/descEn；缺失则回退中文并加一行说明（避免大规模机翻失真）
  function descBody(p) {
    if (state.lang === 'en') {
      const enTxt = p.detailEn || p.descEn;
      if (enTxt) return esc(enTxt);
      return esc(p.detail || p.desc) + '<div class="d-zh-note">— description in Chinese (English summary pending) —</div>';
    }
    return esc(p.detail || p.desc);
  }
  const detailEl = document.getElementById('detail');
  function showDetail(p) {
    const c = CATEGORIES[p.cat];
    detailEl.innerHTML =
      '<div class="d-top"><button class="d-close" id="d-close" aria-label="关闭详情卡" title="关闭">×</button>' +
      '<span class="d-cat" style="background:' + c.color + '22;color:' + c.color + '">' + c.icon + ' ' + catName(p.cat) + (subLabel(p) ? ' · ' + subLabel(p) : '') + '</span>' +
      (isRecent(p) ? '<span class="d-new">' + tr('🆕 近一年') + '</span>' : '') +
      '<div class="d-name">' + (p.flagship ? '★ ' : '') + esc(nm(p)) + '</div>' +
      (altName(p) ? '<div class="d-en">' + esc(altName(p)) + '</div>' : '') + '</div>' +
      (p.progress ? '<div class="d-progress"><span class="dp-tag">' + tr('📍 最新进展') + '</span>' + esc(p.progress) + '</div>' : '') +
      '<div class="d-grid">' +
      cell(tr('国家 / 地区'), '<span class="d-country-link" data-country="' + esc(p.country) + '">' + esc(p.country) + ' 🔎</span>') +
      cell(tr('状态'), '<span class="tag-status st-' + p.status + '">' + statusName(p.status) + '</span>') +
      cell(tr('规模 / 容量'), esc(p.cap)) +
      cell(tr('投资额'), usd(p) + (/美元|\$/.test(p.invText || '') || !p.invText ? '' : ' <span class="d-usd">（原币种：' + esc(p.invText) + '）</span>')) +
      cell(tr('业主 / 参与方'), esc(p.owner || '—')) +
      cell(tr('最近动态'), esc(p.updated || '—')) +
      '</div><div class="d-desc">' + descBody(p) + '</div>';
    detailEl.classList.add('show');
    document.getElementById('d-close').addEventListener('click', hideDetail);
    const cl = detailEl.querySelector('.d-country-link');
    if (cl) cl.addEventListener('click', () => showCountry(cl.dataset.country));
  }
  const cell = (k, v) => '<div class="d-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  const hideDetail = () => detailEl.classList.remove('show');
  map.on('click', hideDetail);

  /* ---------- 国别下钻面板（点详情卡的国家打开）---------- */
  const countryPanel = document.getElementById('country-panel');
  const countryBackdrop = document.getElementById('country-backdrop');
  function hideCountry() { countryPanel.classList.remove('show'); countryBackdrop.classList.remove('show'); }
  // 单国能源组合聚合（showCountry 与 🆚 国别对比 共用；投资/装机口径排除国际大客户）
  function computeCountry(country) {
    const ps = PROJECTS.filter(p => p.country === country);
    const hasClient = ps.some(p => p.cat === 'client');
    const base = ps.filter(p => p.cat !== 'client');
    const invBase = base.length ? base : ps;
    const totalInv = invBase.reduce((s, p) => s + (p.inv || 0), 0);
    const totalMW = invBase.reduce((s, p) => s + (p.capMW || 0), 0);
    const catCount = {}, catInv = {};
    ps.forEach(p => { catCount[p.cat] = (catCount[p.cat] || 0) + 1; catInv[p.cat] = (catInv[p.cat] || 0) + (p.inv || 0); });
    const recentN = ps.filter(isRecent).length;
    const statusCount = {}; STATUS.forEach(s => { statusCount[s] = ps.filter(p => p.status === s).length; });
    return { country, ps, hasClient, totalInv, totalMW, catCount, catInv, recentN, statusCount };
  }

  function showCountry(country) {
    const d = computeCountry(country);
    const ps = d.ps;
    if (!ps.length) return;
    const cats = CAT_KEYS.filter(k => d.catCount[k]).sort((a, b) => (d.catInv[b] || 0) - (d.catInv[a] || 0));
    const maxCatInv = Math.max(1, ...cats.map(k => d.catInv[k] || 0));
    const ys = ps.map(p => p.year), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const yc = {}; for (let y = ymin; y <= ymax; y++) yc[y] = 0; ps.forEach(p => { yc[p.year] = (yc[p.year] || 0) + 1; });
    const ymaxN = Math.max(1, ...Object.values(yc));
    const top = ps.slice().sort((a, b) => b.inv - a.inv).slice(0, 12);

    const kpi = (v, l) => '<div class="cp-kpi"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>';
    const catBars = cats.map(k => {
      const c = CATEGORIES[k];
      return '<div class="bar-row"><div class="bar-head"><span class="dot" style="background:' + c.color + '"></span>' +
        '<span class="nm">' + catShort(k) + '</span><span class="vv">' + d.catCount[k] + ' · ≈$' + fmtInv(d.catInv[k] || 0) + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + ((d.catInv[k] || 0) / maxCatInv * 100) + '%;background:' + c.color + '"></div></div></div>';
    }).join('');
    const statusChips = STATUS.map(s => '<div class="s"><b>' + d.statusCount[s] + '</b><span>' + statusName(s) + '</span></div>').join('');
    const yearBars = Object.keys(yc).map(y => '<div class="yb" style="height:' + (yc[y] / ymaxN * 100) + '%" title="' + y + '：' + yc[y] + ' 个"></div>').join('');
    const topRows = top.map(p => {
      const c = CATEGORIES[p.cat];
      return '<div class="proj-item" data-id="' + p.id + '" style="border-left-color:' + c.color + '">' +
        '<div class="pn">' + (p.flagship ? '<span class="star">★</span>' : '') + esc(nm(p)) + (isRecent(p) ? '<span class="newtag">🆕</span>' : '') + '</div>' +
        '<div class="pm"><span>' + catShort(p.cat) + '</span><span>' + statusName(p.status) + '</span><span>' + esc(usd(p)) + (p.capMW ? ' · ' + capFmt(p.capMW) : '') + '</span></div></div>';
    }).join('');

    countryPanel.classList.remove('wide');
    countryPanel.innerHTML =
      '<div class="cp-head"><span style="font-size:20px">🌍</span><div class="cp-name">' + esc(country) + '</div>' +
      '<button class="cp-add" id="cp-add" title="加入国别对比">⊕ ' + (state.lang === 'en' ? 'Compare' : '加入对比') + '</button>' +
      '<button class="cp-close" id="cp-close" aria-label="关闭面板" title="关闭">×</button></div>' +
      '<div class="cp-kpis">' +
      kpi(ps.length, tr('项目数')) + kpi('≈$' + fmtInv(d.totalInv), tr('总投资')) +
      kpi(d.totalMW >= 1000 ? (d.totalMW / 1000).toFixed(1) + ' GW' : Math.round(d.totalMW) + ' MW', tr('装机容量')) +
      kpi(d.recentN, tr('🆕 近一年')) + '</div>' +
      '<div class="cp-body">' +
      '<div class="cp-sec-title">' + tr('分品类（项目数 · 投资额）') + '</div>' + catBars +
      '<div class="cp-sec-title">' + tr('项目状态') + '</div><div class="cp-status">' + statusChips + '</div>' +
      '<div class="cp-sec-title">' + tr('里程碑年份分布') + '（' + ymin + '–' + ymax + '）</div>' +
      '<div class="cp-years">' + yearBars + '</div><div class="cp-years-ax"><span>' + ymin + '</span><span>' + ymax + '</span></div>' +
      '<div class="cp-sec-title">' + tr('重点项目 TOP（按投资额）') + '</div><div class="cp-proj">' + topRows + '</div>' +
      (d.hasClient ? '<div class="cp-note">* 总投资/装机口径不含「国际大客户」，避免与能源品类对同一物理项目重复计。</div>' : '') +
      '</div>';
    countryBackdrop.classList.add('show');
    countryPanel.classList.add('show');
    document.getElementById('cp-close').addEventListener('click', hideCountry);
    const addBtn = document.getElementById('cp-add');
    if (addBtn) addBtn.addEventListener('click', () => addCompare(country));
    countryPanel.querySelectorAll('.proj-item').forEach(el => el.addEventListener('click', () => {
      const p = PROJECTS.find(x => String(x.id) === el.dataset.id);
      if (p) { hideCountry(); showDetail(p); map.flyTo(toLatLng(p.coord), 8, { duration: 0.7 }); }
    }));
  }
  countryBackdrop.addEventListener('click', hideCountry);

  /* ---------- 🆚 国别对比（多国并排，复用 computeCountry 聚合）---------- */
  let comparePickerOpen = false;
  function openCompare() { comparePickerOpen = state.compare.length < 2; showCompare(); }
  function addCompare(country) {
    if (country && !state.compare.includes(country) && state.compare.length < 4) state.compare.push(country);
    comparePickerOpen = state.compare.length < 2;
    showCompare();
  }
  function removeCompare(country) { state.compare = state.compare.filter(c => c !== country); showCompare(); }
  const cmpKpi = (v, l) => '<div class="cmp-kpi"><b>' + v + '</b><span>' + l + '</span></div>';
  function countryCounts() {
    const m = {}; PROJECTS.forEach(p => { m[p.country] = (m[p.country] || 0) + 1; });
    return Object.keys(m).sort((a, b) => m[b] - m[a]).map(c => ({ c, n: m[c] }));
  }
  function showCompare() {
    const cols = state.compare.map(country => {
      const d = computeCountry(country);
      const cats = CAT_KEYS.filter(k => d.catCount[k]).sort((a, b) => (d.catInv[b] || 0) - (d.catInv[a] || 0)).slice(0, 6);
      const maxCatInv = Math.max(1, ...cats.map(k => d.catInv[k] || 0));
      const catBars = cats.map(k => {
        const c = CATEGORIES[k];
        return '<div class="cmp-cat"><span class="dot" style="background:' + c.color + '"></span><span class="cn">' + catShort(k) + '</span>' +
          '<span class="cv">≈$' + fmtInv(d.catInv[k] || 0) + '</span>' +
          '<div class="cmp-cbar"><i style="width:' + ((d.catInv[k] || 0) / maxCatInv * 100) + '%;background:' + c.color + '"></i></div></div>';
      }).join('');
      const top = d.ps.slice().sort((a, b) => b.inv - a.inv).slice(0, 3).map((p, i) =>
        '<div class="cmp-top" data-id="' + p.id + '"><span class="r">' + (i + 1) + '</span><span class="t">' + esc(nm(p)) + '</span><span class="v">' + esc(usd(p)) + '</span></div>').join('');
      return '<div class="cmp-col">' +
        '<div class="cmp-col-head"><span class="cc-name">' + esc(country) + '</span>' +
        '<button class="cmp-rm" data-rm="' + esc(country) + '" aria-label="移除" title="移除">✕</button></div>' +
        '<div class="cmp-kpis">' +
        cmpKpi(d.ps.length, tr('项目数')) + cmpKpi('≈$' + fmtInv(d.totalInv), tr('总投资')) +
        cmpKpi(d.totalMW >= 1000 ? (d.totalMW / 1000).toFixed(1) + ' GW' : Math.round(d.totalMW) + ' MW', tr('装机容量')) +
        cmpKpi(d.recentN, tr('🆕 近一年')) + '</div>' +
        '<div class="cmp-sec">' + tr('分品类（项目数 · 投资额）') + '</div>' + (catBars || '<div class="cmp-empty">—</div>') +
        '<div class="cmp-sec">' + tr('重点项目 TOP（按投资额）') + '</div>' + (top || '<div class="cmp-empty">—</div>') +
        '</div>';
    }).join('');
    const canAdd = state.compare.length < 4;
    const addTile = canAdd ? '<button class="cmp-addtile" id="cmp-addtile">＋<span>' + (state.lang === 'en' ? 'Add' : '添加') + '</span></button>' : '';
    let picker = '';
    if (comparePickerOpen && canAdd) {
      const list = countryCounts().filter(o => !state.compare.includes(o.c))
        .map(o => '<button class="cmp-pick" data-pick="' + esc(o.c) + '">' + esc(o.c) + '<span>' + o.n + '</span></button>').join('');
      picker = '<div class="cmp-picker"><input id="cmp-search" placeholder="' + (state.lang === 'en' ? 'Search country…' : '搜索国家…') + '" aria-label="搜索国家"><div class="cmp-picklist" id="cmp-picklist">' + list + '</div></div>';
    }
    const hint = state.compare.length < 2
      ? '<div class="cmp-hint">' + (state.lang === 'en' ? 'Pick at least two countries to compare.' : '至少选择两个国家并排对比。') + '</div>' : '';

    countryPanel.classList.add('wide');
    countryPanel.innerHTML =
      '<div class="cp-head"><span style="font-size:20px">🆚</span><div class="cp-name">' + (state.lang === 'en' ? 'Country comparison' : '国别对比') + '</div>' +
      '<button class="cp-close" id="cp-close" aria-label="关闭面板" title="关闭">×</button></div>' +
      '<div class="cp-body">' + hint +
      '<div class="cmp-grid">' + cols + addTile + '</div>' + picker +
      '<div class="cp-note">* 各国投资/装机口径不含「国际大客户」。点 TOP 项目可看详情。</div>' +
      '</div>';
    countryBackdrop.classList.add('show'); countryPanel.classList.add('show');
    document.getElementById('cp-close').addEventListener('click', hideCountry);
    const addtile = document.getElementById('cmp-addtile');
    if (addtile) addtile.addEventListener('click', () => { comparePickerOpen = !comparePickerOpen; showCompare(); });
    countryPanel.querySelectorAll('.cmp-rm').forEach(el => el.addEventListener('click', () => removeCompare(el.dataset.rm)));
    countryPanel.querySelectorAll('.cmp-pick').forEach(el => el.addEventListener('click', () => addCompare(el.dataset.pick)));
    countryPanel.querySelectorAll('.cmp-top').forEach(el => el.addEventListener('click', () => {
      const p = PROJECTS.find(x => String(x.id) === el.dataset.id);
      if (p) { hideCountry(); showDetail(p); map.flyTo(toLatLng(p.coord), 8, { duration: 0.7 }); }
    }));
    const cs = document.getElementById('cmp-search');
    if (cs) cs.addEventListener('input', () => {
      const q = cs.value.trim().toLowerCase();
      countryPanel.querySelectorAll('#cmp-picklist .cmp-pick').forEach(b => {
        b.style.display = b.dataset.pick.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
    });
  }

  /* ---------- 🏢 企业 / 业主全球排行榜（点公司名筛选其全部项目）---------- */
  const ownerKey = normalizeOwner;  // 归并「中国电建」与「中国电建集团」等同义业主
  function showLeague() {
    const ag = {};
    PROJECTS.forEach(p => {
      const k = ownerKey(p.owner); if (!k || k === '—') return;
      if (!ag[k]) ag[k] = { n: 0, inv: 0, cats: {}, countries: new Set() };
      ag[k].n++; ag[k].inv += (p.inv || 0); ag[k].cats[p.cat] = (ag[k].cats[p.cat] || 0) + 1; ag[k].countries.add(p.country);
    });
    const rows = Object.entries(ag).sort((a, b) => b[1].n - a[1].n || b[1].inv - a[1].inv).slice(0, 40);
    const maxN = Math.max(1, ...rows.map(r => r[1].n));
    const body = rows.map((r, i) => {
      const o = r[0], d = r[1];
      const domCats = Object.keys(d.cats).sort((a, b) => d.cats[b] - d.cats[a]).slice(0, 5)
        .map(k => '<span class="lg-dot" title="' + catShort(k) + '" style="background:' + (CATEGORIES[k] || {}).color + '"></span>').join('');
      return '<div class="lg-row" data-owner="' + esc(o) + '">' +
        '<div class="lg-rank">' + (i + 1) + '</div>' +
        '<div class="lg-main"><div class="lg-name">' + esc(o) + ' ' + domCats + '</div>' +
        '<div class="lg-track"><div class="lg-fill" style="width:' + (d.n / maxN * 100) + '%"></div></div></div>' +
        '<div class="lg-meta"><b>' + d.n + '</b><span>' + tr('项目数') + '</span></div>' +
        '<div class="lg-meta"><b>≈$' + fmtInv(d.inv) + '</b><span>' + d.countries.size + ' ' + (state.lang === 'en' ? 'countries' : '国') + '</span></div></div>';
    }).join('');
    countryPanel.innerHTML =
      '<div class="cp-head"><span style="font-size:20px">🏢</span><div class="cp-name">' + tr('企业 / 业主排行榜') + '</div>' +
      '<button class="cp-close" id="cp-close" aria-label="关闭面板" title="关闭">×</button></div>' +
      '<div class="cp-body"><div class="cp-note" style="margin:0 0 8px">' + tr('按项目数排名（投资额为该业主累计）') + ' · ' + tr('点公司名筛选其全部项目') + '</div>' +
      '<div class="lg-list">' + body + '</div></div>';
    countryBackdrop.classList.add('show'); countryPanel.classList.add('show');
    document.getElementById('cp-close').addEventListener('click', hideCountry);
    countryPanel.querySelectorAll('.lg-row').forEach(el => el.addEventListener('click', () => {
      hideCountry(); state.q = el.dataset.owner; const sEl = document.getElementById('search'); if (sEl) sEl.value = state.q; render();
    }));
  }

  /* ---------- 品类色图例（地图左上，点击=切换该品类）---------- */
  const legendEl = document.getElementById('cat-legend');
  if (legendEl) {
    legendEl.innerHTML = '<div class="cl-title">品类（点击切换）</div>' + CAT_KEYS.map(k => {
      const c = CATEGORIES[k];
      return '<div class="cl" data-key="' + k + '"><span class="d" style="background:' + c.color + '"></span>' + c.short + '</div>';
    }).join('');
    legendEl.querySelectorAll('.cl').forEach(el => el.addEventListener('click', () => toggleCat(el.dataset.key)));
  }

  /* ---------- 🔥 热力分面：聚焦单一品类（仅热力模式显示）---------- */
  const heatFacetsEl = document.getElementById('heat-facets');
  function syncHeatFacets() {
    if (!heatFacetsEl) return;
    heatFacetsEl.querySelectorAll('.hf').forEach(el =>
      el.classList.toggle('on', (el.dataset.cat || '') === (state.heatCat || '')));
  }
  if (heatFacetsEl) {
    heatFacetsEl.innerHTML = '<div class="hf' + (state.heatCat ? '' : ' on') + '" data-cat="">' + (state.lang === 'en' ? 'All' : '全部') + '</div>' +
      CAT_KEYS.map(k => '<div class="hf" data-cat="' + k + '"><span class="d" style="background:' + CATEGORIES[k].color + '"></span>' + CATEGORIES[k].short + '</div>').join('');
    heatFacetsEl.querySelectorAll('.hf').forEach(el => el.addEventListener('click', () => {
      state.heatCat = el.dataset.cat || null;
      syncHeatFacets(); render();
    }));
  }

  /* ---------- 点统计即筛选（右侧分类条 / 区域格 双向联动）---------- */
  document.getElementById('cat-bars').addEventListener('click', e => {
    const row = e.target.closest('.bar-row'); if (row && row.dataset.key) toggleCat(row.dataset.key);
  });
  document.getElementById('region-grid').addEventListener('click', e => {
    const cell = e.target.closest('.region-cell'); if (cell && cell.dataset.region) toggleRegion(cell.dataset.region);
  });

  /* ---------- 轻量提示条 ---------- */
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- 可分享链接：把筛选状态编码进 URL（仅记录非默认项）---------- */
  function stateToHash() {
    const p = new URLSearchParams();
    const offCats = CAT_KEYS.filter(k => !state.cats.has(k));
    if (offCats.length) p.set('coff', offCats.join('~'));
    if (state.subOff.size) p.set('soff', [...state.subOff].join('~'));
    if (state.regions.size) p.set('reg', [...state.regions].join('~'));
    if (state.statuses.size) p.set('st', [...state.statuses].join('~'));
    if (state.minYear > MIN_YEAR || state.maxYear < MAX_YEAR) p.set('yr', state.minYear + '-' + state.maxYear);
    if (state.q) p.set('q', state.q);
    if (state.recentOnly) p.set('recent', '1');
    if (state.heat) p.set('heat', '1');
    if (state.weight === 'cap') p.set('w', 'cap');
    if (state.sort === 'cap') p.set('sort', 'cap');
    if (state.lang === 'en') p.set('lang', 'en');
    if (!state.lines) p.set('lines', '0');
    return p.toString();
  }
  function applyHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    const p = new URLSearchParams(h);
    if (p.has('coff')) { const off = new Set(p.get('coff').split('~')); state.cats = new Set(CAT_KEYS.filter(k => !off.has(k))); }
    if (p.has('soff')) state.subOff = new Set(p.get('soff').split('~').filter(Boolean));
    if (p.has('reg')) state.regions = new Set(p.get('reg').split('~').filter(Boolean));
    if (p.has('st')) state.statuses = new Set(p.get('st').split('~').filter(Boolean));
    if (p.has('yr')) {
      const m = p.get('yr').split('-'); const lo = +m[0], hi = +m[1];
      if (!isNaN(lo)) state.minYear = Math.max(MIN_YEAR, Math.min(lo, MAX_YEAR));
      if (!isNaN(hi)) state.maxYear = Math.max(MIN_YEAR, Math.min(hi, MAX_YEAR));
      if (state.minYear > state.maxYear) { const t = state.minYear; state.minYear = state.maxYear; state.maxYear = t; }
    }
    if (p.has('q')) state.q = p.get('q');
    if (p.has('recent')) state.recentOnly = true;
    if (p.has('heat')) state.heat = true;
    if (p.get('w') === 'cap') state.weight = 'cap';
    if (p.get('sort') === 'cap') state.sort = 'cap';
    if (p.get('lang') === 'en') state.lang = 'en';
    if (p.get('lines') === '0') state.lines = false;
  }
  document.getElementById('btn-share').addEventListener('click', () => {
    const hash = stateToHash();
    const url = location.href.split('#')[0] + (hash ? ('#' + hash) : '');
    try { history.replaceState(null, '', hash ? ('#' + hash) : (location.pathname + location.search)); } catch (e) { /* file:// 等环境忽略 */ }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => toast('🔗 视图链接已复制到剪贴板'), () => toast('🔗 链接已生成（见地址栏）'));
    } else { toast('🔗 链接已生成（见地址栏）'); }
  });

  /* ---------- 导出当前筛选结果为 CSV（含 BOM，Excel 中文不乱码）---------- */
  document.getElementById('btn-export').addEventListener('click', () => {
    const items = filtered();
    const head = ['编号', '名称', '英文名', '国家', '大区', '品类', '子分类', '状态', '里程碑年', '更新', '容量', '投资亿美元', '投资文本', '业主', '旗舰', '经度', '纬度', '简介'];
    const q = v => { v = (v == null ? '' : String(v)); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const rows = items.map(p => [p.id, p.name, p.en, p.country, p.region, (CATEGORIES[p.cat] || {}).name || p.cat, subLabel(p), p.status, p.year, p.updated, p.cap, p.inv, p.invText, p.owner, p.flagship ? '是' : '', p.coord && p.coord[0], p.coord && p.coord[1], p.desc].map(q).join(','));
    const csv = '﻿' + head.join(',') + '\n' + rows.join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'energy-projects-' + items.length + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('⤓ 已导出 ' + items.length + ' 个项目 (CSV)');
  });

  /* ---------- 📸 当前视图快照（信息图 SVG，可分享/插入文档）----------
   * 地图瓦片跨域无法截图，这里把"当前筛选"的统计与 TOP 做成一张矢量信息图海报。 */
  function buildSnapshotSVG() {
    const items = filtered();
    const clientOnly = state.cats.size === 1 && state.cats.has('client');
    const statItems = clientOnly ? items : items.filter(p => p.cat !== 'client');
    const totalInv = statItems.reduce((s, p) => s + (p.inv || 0), 0);
    const countries = new Set(items.map(p => p.country)).size;
    const recentN = items.filter(isRecent).length;
    const catCount = {}; CAT_KEYS.forEach(k => catCount[k] = 0); items.forEach(p => catCount[p.cat]++);
    const topCats = CAT_KEYS.filter(k => catCount[k]).sort((a, b) => catCount[b] - catCount[a]).slice(0, 6);
    const maxCat = Math.max(1, ...topCats.map(k => catCount[k]));
    const sortCap = state.sort === 'cap';
    const top = items.slice().sort((a, b) => sortCap ? ((b.capMW || 0) - (a.capMW || 0)) : (b.inv - a.inv)).slice(0, 6);
    const en = state.lang === 'en';
    const parts = [];
    if (state.cats.size && state.cats.size < CAT_KEYS.length) parts.push((en ? 'Categories: ' : '品类: ') + [...state.cats].map(catShort).join('/'));
    if (state.regions.size) parts.push((en ? 'Regions: ' : '大区: ') + [...state.regions].map(regionName).join('/'));
    if (state.statuses.size) parts.push((en ? 'Status: ' : '状态: ') + [...state.statuses].map(statusName).join('/'));
    if (state.minYear > MIN_YEAR || state.maxYear < MAX_YEAR) parts.push(state.minYear + '–' + state.maxYear);
    if (state.recentOnly) parts.push(en ? 'Recent 12mo' : '近一年');
    if (state.q) parts.push('“' + state.q + '”');
    const filterDesc = parts.length ? parts.join('   ·   ') : (en ? 'All projects' : '全部项目');
    const clip = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const X = esc;

    const kpiCard = (i, val, lab, color) => {
      const x = 60 + i * 273;
      return '<g transform="translate(' + x + ',196)">' +
        '<rect width="255" height="96" rx="12" fill="#101a30" stroke="#2a3a5c"/>' +
        '<text x="18" y="50" font-size="30" font-weight="800" fill="' + color + '">' + X(val) + '</text>' +
        '<text x="18" y="76" font-size="14" fill="#93a4c4">' + X(lab) + '</text></g>';
    };
    const catRows = topCats.map((k, i) => {
      const y = 392 + i * 39, c = CATEGORIES[k], w = 520 * catCount[k] / maxCat;
      return '<g transform="translate(60,' + y + ')">' +
        '<circle cx="6" cy="-4" r="6" fill="' + c.color + '"/>' +
        '<text x="22" y="0" font-size="16" fill="#cdd7ea">' + X(catShort(k)) + '</text>' +
        '<text x="520" y="0" font-size="15" font-weight="700" fill="#e8eefb" text-anchor="end">' + catCount[k] + '</text>' +
        '<rect x="0" y="9" width="520" height="6" rx="3" fill="#1b2742"/>' +
        '<rect x="0" y="9" width="' + w.toFixed(1) + '" height="6" rx="3" fill="' + c.color + '"/></g>';
    }).join('');
    const topRows = top.map((p, i) => {
      const y = 392 + i * 39, c = CATEGORIES[p.cat];
      const val = sortCap ? capFmt(p.capMW) : usd(p);
      return '<g transform="translate(620,' + y + ')">' +
        '<rect x="0" y="-16" width="3" height="22" rx="1.5" fill="' + c.color + '"/>' +
        '<text x="14" y="-2" font-size="13" font-weight="800" fill="#5f718f">' + (i + 1) + '</text>' +
        '<text x="36" y="0" font-size="15" fill="#e8eefb">' + X(clip(nm(p), 22)) + '</text>' +
        '<text x="520" y="0" font-size="14" font-weight="700" fill="#2ee6a6" text-anchor="end">' + X(val) + '</text></g>';
    }).join('');

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" ' +
      'font-family="\'PingFang SC\',\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif">' +
      '<defs><radialGradient id="g1" cx="78%" cy="-10%" r="70%"><stop offset="0" stop-color="#21c7ff" stop-opacity="0.14"/><stop offset="1" stop-color="#21c7ff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="g2" cx="6%" cy="112%" r="70%"><stop offset="0" stop-color="#2ee6a6" stop-opacity="0.12"/><stop offset="1" stop-color="#2ee6a6" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="1200" height="675" fill="#060b18"/><rect width="1200" height="675" fill="url(#g1)"/><rect width="1200" height="675" fill="url(#g2)"/>' +
      '<text x="60" y="78" font-size="36" font-weight="800" fill="#e8eefb">🌐 ' + (en ? 'Global Energy Projects Map' : '全球能源项目世界地图') + '</text>' +
      '<text x="60" y="108" font-size="15" letter-spacing="1.5" fill="#93a4c4">GLOBAL ENERGY PROJECTS · ' + X((en ? 'Updated ' : '数据更新 ') + META.lastUpdated) + '</text>' +
      '<rect x="60" y="130" width="1080" height="40" rx="9" fill="#0d1730" stroke="#1f2c4a"/>' +
      '<text x="78" y="156" font-size="16" fill="#7fd4ff">▸ ' + X(clip(filterDesc, 92)) + '</text>' +
      kpiCard(0, items.length, en ? 'Projects' : '项目总数', '#21c7ff') +
      kpiCard(1, countries, en ? 'Countries' : '覆盖国家', '#e8eefb') +
      kpiCard(2, '≈$' + fmtInv(totalInv), en ? 'Investment' : '总投资(美元)', '#2ee6a6') +
      kpiCard(3, recentN, en ? 'Recent 12mo' : '🆕 近一年', '#ffb02e') +
      '<text x="60" y="360" font-size="14" letter-spacing="1" fill="#5f718f">' + (en ? 'BY CATEGORY (count)' : '分品类（项目数）') + '</text>' +
      '<text x="620" y="360" font-size="14" letter-spacing="1" fill="#5f718f">' + (en ? (sortCap ? 'TOP (by capacity)' : 'TOP (by investment)') : (sortCap ? '重点项目 TOP（按装机）' : '重点项目 TOP（按投资）')) + '</text>' +
      catRows + topRows +
      '<text x="60" y="652" font-size="13" fill="#5f718f">' + items.length + (en ? ' projects · ' : ' 个项目 · ') + countries + (en ? ' countries' : ' 国') + '  ·  ' + X(en ? 'Generated from Global Energy Projects Map' : '由「全球能源项目世界地图」生成') + '</text>' +
      '</svg>';
  }
  const snapBtn = document.getElementById('btn-snapshot');
  if (snapBtn) snapBtn.addEventListener('click', () => {
    const n = filtered().length;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buildSnapshotSVG()], { type: 'image/svg+xml;charset=utf-8' }));
    a.download = 'energy-snapshot-' + n + '.svg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('📸 已导出当前视图快照 (SVG)');
  });

  /* ---------- 由 state 同步所有筛选 UI（用于 URL 载入与重置）---------- */
  function applyUIFromState() {
    syncCatUI();
    document.querySelectorAll('.sub-chip').forEach(el => el.classList.toggle('off', state.subOff.has(el.dataset.key + ':' + el.dataset.sub)));
    document.querySelectorAll('#region-chips .pill').forEach(el => el.classList.toggle('on', state.regions.has(el.dataset.v)));
    document.querySelectorAll('#status-chips .pill').forEach(el => el.classList.toggle('on', state.statuses.has(el.dataset.v)));
    if (recentBtn) recentBtn.classList.toggle('on', state.recentOnly);
    if (btnHeat) { btnHeat.classList.toggle('on', state.heat); document.body.classList.toggle('heat-on', state.heat); }
    if (btnWeight) { btnWeight.classList.toggle('on', state.weight === 'cap'); btnWeight.textContent = state.weight === 'cap' ? '⚖️ 容量权重' : '⚖️ 投资权重'; }
    if (sortToggle) sortToggle.textContent = state.sort === 'cap' ? '按装机容量 ⇄' : '按投资额 ⇄';
    if (btnFlow) btnFlow.classList.toggle('on', state.lines);
    const sEl = document.getElementById('search'); if (sEl) sEl.value = state.q;
    if (yearMin) { yearMin.value = state.minYear; yearMax.value = state.maxYear; syncYearUI(); }
  }

  /* ---------- 渲染 ---------- */
  function render() { const items = filtered(); updateMap(items); updateStats(items); updateList(items); }

  // 顶栏：数据更新时间
  const lu = document.getElementById('last-updated');
  if (lu) lu.textContent = '数据更新 ' + META.lastUpdated;

  /* ---------- 移动端抽屉：窄屏由 🔍/📊 浮动按钮调出左右面板 ---------- */
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const sideLeft = document.querySelector('.side.left');
  const sideRight = document.querySelector('.side.right');
  function closeDrawers() {
    if (sideLeft) sideLeft.classList.remove('open');
    if (sideRight) sideRight.classList.remove('open');
    if (drawerBackdrop) drawerBackdrop.classList.remove('show');
  }
  function toggleDrawer(side) {
    const el = side === 'left' ? sideLeft : sideRight;
    const other = side === 'left' ? sideRight : sideLeft;
    if (!el) return;
    const willOpen = !el.classList.contains('open');
    if (other) other.classList.remove('open');
    el.classList.toggle('open', willOpen);
    if (drawerBackdrop) drawerBackdrop.classList.toggle('show', willOpen);
  }
  const fabFilters = document.getElementById('fab-filters');
  const fabStats = document.getElementById('fab-stats');
  if (fabFilters) fabFilters.addEventListener('click', () => toggleDrawer('left'));
  if (fabStats) fabStats.addEventListener('click', () => toggleDrawer('right'));
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawers);
  document.querySelectorAll('.drawer-close').forEach(b => b.addEventListener('click', closeDrawers));

  /* ---------- Esc 关闭浮层（详情卡 / 国别面板·企业榜 / 移动端抽屉）---------- */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (detailEl.classList.contains('show')) hideDetail();
    if (countryPanel.classList.contains('show')) hideCountry();
    closeDrawers();
  });

  // 应用 URL 分享状态（如有），同步 UI 后首次渲染
  applyHash();
  applyUIFromState();
  applyLang();
  syncHeatFacets();
  render();

  /* ---------- 首屏加载态：地图瓦片就绪（或超时兜底）后淡出 ---------- */
  (function () {
    const loaderEl = document.getElementById('app-loader');
    if (!loaderEl) return;
    let done = false;
    const hide = () => { if (done) return; done = true; loaderEl.classList.add('hidden'); setTimeout(() => loaderEl.remove(), 480); };
    esriDarkBase.once('load', hide);     // 首批暗色瓦片绘制完成
    map.whenReady(() => setTimeout(hide, 400)); // 视图就绪后短暂保留，避免闪烁
    setTimeout(hide, 2600);              // 离线/瓦片失败兜底，确保不卡 loading
  })();

  // 调试 / 程序化控制句柄
  window.__APP__ = { map, BASES, switchBase, render, state, markerCluster, lineLayer, stateToHash, buildSnapshotSVG };
})();
