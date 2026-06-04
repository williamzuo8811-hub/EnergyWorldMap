/* ============================================================
 * 全球能源项目世界地图 —— 交互逻辑（Leaflet 瓦片地图版）
 * 国界/国名/省/市/街道随缩放由底图自然显示；支持底图切换。
 * ============================================================ */
(function () {
  'use strict';

  const { META, CATEGORIES, REGIONS, STATUS } = window.ENERGY;
  const CAT_KEYS = Object.keys(CATEGORIES);

  /* ---------- 子分类（按关键词在 name/cap/desc 上自动归类）----------
   * 每个品类一组有序子分类：{key,label,zh[],en[]} 或 {key,label,fn}；
   * 末项无规则=兜底桶。classifySub 按顺序取首个命中，未命中归末项。 */
  const SUB_DEFS = {
    renewable: [
      { key: 'hydrogen', label: '绿氢绿氨', zh: ['绿氢', '绿氨', '制氢', '氢氨', '氢能'], en: ['hydrogen', 'ammonia'] },
      { key: 'offshore', label: '海上风电', zh: ['海上风', '海风'], en: ['offshore'] },
      { key: 'csp', label: '光热', zh: ['光热', '熔盐塔', '塔式光'], en: ['csp'] },
      { key: 'hydro', label: '水电', zh: ['水电'], en: ['hydropower', 'hydro'] },
      { key: 'geo', label: '地热', zh: ['地热'], en: ['geothermal'] },
      { key: 'solar', label: '光伏', zh: ['光伏', '太阳能', '光储'], en: ['solar', 'photovolta'] },
      { key: 'wind', label: '陆上风电', zh: ['风电', '风力'], en: ['wind'] },
      { key: 'base', label: '综合基地·其他' },
    ],
    nuclear: [
      { key: 'fusion', label: '核聚变', zh: ['聚变', '托卡马克', '人造太阳'], en: ['fusion', 'tokamak', 'iter'] },
      { key: 'smr', label: '小型模块化堆', zh: ['小型模块化', '模块化堆', '小堆', '玲龙'], en: ['smr', 'small modular'] },
      { key: 'gen4', label: '四代·特种堆', zh: ['高温气冷', '快堆', '第四代', '钍', '熔盐堆'], en: ['htgr', 'fast reactor', 'thorium', 'molten salt'] },
      { key: 'fuel', label: '核燃料·后端', zh: ['核燃料', '浓缩', '铀浓缩', '后处理', '乏燃料'], en: ['enrichment', 'fuel cycle', 'reprocessing'] },
      { key: 'pwr', label: '大型反应堆' },
    ],
    grid: [
      { key: 'uhv', label: '特高压', zh: ['特高压', '±800', '±1100', '1000千伏', '1100千伏'], en: ['uhv'] },
      { key: 'subsea', label: '海底电缆', zh: ['海缆', '海底电缆', '海底线', '跨海'], en: ['submarine', 'subsea'] },
      { key: 'hvdc', label: '直流输电', zh: ['直流', '柔直', '柔性直流', '±'], en: ['hvdc'] },
      { key: 'cross', label: '跨境互联', zh: ['互联', '跨境', '跨国'], en: ['interconnect'] },
      { key: 'ac', label: '交流输变电' },
    ],
    storage: [
      { key: 'pumped', label: '抽水蓄能', zh: ['抽水蓄能', '抽蓄'], en: ['pumped'] },
      { key: 'caes', label: '压缩空气', zh: ['压缩空气'], en: ['compressed air', 'caes'] },
      { key: 'flow', label: '液流电池', zh: ['液流', '全钒'], en: ['vanadium', 'flow batter'] },
      { key: 'novel', label: '新型长时储能', zh: ['钠离子', '锂钠', '重力储能', '液态空气', '熔盐', '储热', '铁空气'], en: ['laes', 'gravity', 'iron-air', 'molten', 'sodium'] },
      { key: 'liion', label: '锂电池储能' },
    ],
    ci: [
      { key: 'semi', label: '半导体晶圆', zh: ['半导体', '晶圆', '封测', '芯片', '晶体管'], en: ['fab', 'semiconductor', 'wafer', 'dram', 'osat'] },
      { key: 'auto', label: '整车工厂', zh: ['整车', '汽车', '车厂'], en: ['motors', 'vinfast'] },
      { key: 'battery', label: '电池工厂', zh: ['电池', '电芯', '储能系统'], en: ['battery', 'gigafactory', 'gwh'] },
      { key: 'steel', label: '绿色钢铁', zh: ['钢', '电弧炉', '绿钢', '直接还原铁'], en: ['steel', 'eaf', 'dri'] },
      { key: 'alu', label: '电解铝·有色', zh: ['电解铝', '铝业', '铝厂', '绿色铝', '惰性阳极'], en: ['aluminum', 'aluminium', 'smelter'] },
      { key: 'solar', label: '光伏制造', zh: ['光伏', '多晶硅', '硅片', '组件', '电池片'], en: ['qcells', 'hjt', 'solar'] },
      { key: 'chem', label: '化工新材料·其他' },
    ],
    datacenter: [
      { key: 'sovereign', label: '主权AI工厂', zh: ['主权'], en: ['sovereign'] },
      { key: 'hub', label: '东数西算枢纽', fn: (h, l, p) => p.region === '中国' && /东数西算|枢纽|集群/.test(h) },
      { key: 'ai', label: 'AI智算中心', zh: ['AI', '智算', '算力', '超算', '万卡', '人工智能'], en: ['stargate', 'xai', 'blackwell', 'nvidia', 'gpu'] },
      { key: 'cloud', label: '超大规模·云' },
    ],
    transport: [
      { key: 'airport', label: '机场', zh: ['机场', '航站楼'], en: ['airport'] },
      { key: 'port', label: '港口码头', zh: ['港', '码头'], en: ['port', 'terminal'] },
      { key: 'bridge', label: '跨海桥隧', fn: (h, l, p) => /大桥|隧道|通道|跨海|跨江|桥/.test(p.name) || /bridge|tunnel|crossing/.test((p.en || '').toLowerCase()) },
      { key: 'metro', label: '城市轨道', zh: ['地铁', '轻轨', '单轨', '市域', '有轨', '快速轨道', '快线'], en: ['metro', 'lrt', 'rrts', 'gtx'] },
      { key: 'hsr', label: '高铁铁路' },
    ],
    petro: [
      { key: 'lng', label: 'LNG液化·接收', zh: ['LNG', '液化天然气', '接收站', '再气化'], en: ['lng', 'flng'] },
      { key: 'pipe', label: '油气管道', zh: ['管道', '输气', '输油'], en: ['pipeline'] },
      { key: 'coal', label: '煤化工', zh: ['煤制', '煤化工', '煤直接液化', '甲醇制烯烃'], en: ['coal-to', 'mto'] },
      { key: 'upstream', label: '上游油气', zh: ['油田', '气田', '页岩', '区块', '增油', '增气', '油气田'], en: ['fpso', 'shale', 'oilfield', 'oil field', 'gas field'] },
      { key: 'refine', label: '炼化·乙烯' },
    ],
    mining: [
      { key: 'lithium', label: '锂', zh: ['锂', '盐湖'], en: ['lithium'] },
      { key: 'rareearth', label: '稀土', zh: ['稀土'], en: ['rare earth', 'rare-earth'] },
      { key: 'iron', label: '铁矿', zh: ['铁矿'], en: ['iron ore'] },
      { key: 'uranium', label: '铀', zh: ['铀'], en: ['uranium'] },
      { key: 'copper', label: '铜', zh: ['铜'], en: ['copper'] },
      { key: 'nickel', label: '镍钴', zh: ['镍', '钴'], en: ['nickel', 'cobalt'] },
      { key: 'other', label: '其他金属·煤' },
    ],
    client: [
      { key: 'powerchina',  label: '中国电建',  fn: (h, l, p) => /中国电建/.test(p.owner || '') },
      { key: 'energychina', label: '中国能建',  fn: (h, l, p) => /中国能建/.test(p.owner || '') },
      { key: 'sgcc',        label: '国网国际',  fn: (h, l, p) => /电力技术装备|国网/.test(p.owner || '') },
      { key: 'cpecc',       label: '中石油工程', fn: (h, l, p) => /中石油工程/.test(p.owner || '') },
      { key: 'ctg',         label: '三峡国际',  fn: (h, l, p) => /三峡/.test(p.owner || '') },
      { key: 'spic',        label: '国家电投',  fn: (h, l, p) => /国家电投/.test(p.owner || '') },
      { key: 'zijin',       label: '紫金矿业',  fn: (h, l, p) => /紫金/.test(p.owner || '') },
      { key: 'cmoc',        label: '洛阳钼业',  fn: (h, l, p) => /洛阳钼业|洛钼/.test(p.owner || '') },
      { key: 'cnmc',        label: '中国有色',  fn: (h, l, p) => /中国有色/.test(p.owner || '') },
      { key: 'byd',         label: '比亚迪',    fn: (h, l, p) => /比亚迪/.test(p.owner || '') },
      { key: 'catl',        label: '宁德时代',  fn: (h, l, p) => /宁德时代/.test(p.owner || '') },
      { key: 'gem',         label: '格林美',    fn: (h, l, p) => /格林美/.test(p.owner || '') },
      { key: 'gds',         label: '万国DayOne', fn: (h, l, p) => /万国数据|DayOne/.test(p.owner || '') },
      { key: 'chindata',    label: '秦淮数据',  fn: (h, l, p) => /秦淮/.test(p.owner || '') },
      { key: 'other', label: '其他客户' },
    ],
  };
  const SUB_LABEL = {};
  Object.keys(SUB_DEFS).forEach(cat => { SUB_LABEL[cat] = {}; SUB_DEFS[cat].forEach(d => { SUB_LABEL[cat][d.key] = d.label; }); });
  function classifySub(p) {
    const defs = SUB_DEFS[p.cat]; if (!defs) return '';
    const hay = p.name + ' ' + (p.en || '') + ' ' + (p.cap || '') + ' ' + (p.desc || '');
    const low = hay.toLowerCase();
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (!d.zh && !d.en && !d.fn) return d.key;
      if (d.fn) { if (d.fn(hay, low, p)) return d.key; continue; }
      let hit = false;
      if (d.zh) for (const w of d.zh) if (hay.indexOf(w) >= 0) { hit = true; break; }
      if (!hit && d.en) for (const w of d.en) if (low.indexOf(w) >= 0) { hit = true; break; }
      if (hit) return d.key;
    }
    return defs[defs.length - 1].key;
  }
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
        seen.add(p.name); out.push(p);
      }
    });
    return out;
  })();
  const RECENT_SINCE = META.recentSince;
  const isRecent = p => (p.updated || '') >= RECENT_SINCE;

  /* ---------- WGS-84 → GCJ-02 纠偏（高德等国内底图为 GCJ-02） ---------- */
  const PI = Math.PI, AXIS = 6378245.0, EE = 0.00669342162296594323;
  function tLat(x, y) {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
    return r;
  }
  function tLng(x, y) {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
    return r;
  }
  const outOfChina = (lng, lat) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  function wgs2gcj(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
    const radLat = lat / 180 * PI;
    let magic = Math.sin(radLat); magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180) / ((AXIS * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180) / (AXIS / sqrtMagic * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
  }

  /* ---------- 地图与底图 ---------- */
  const map = L.map('map', {
    center: [25, 30], zoom: 3, minZoom: 2, maxZoom: 18,
    zoomControl: false, worldCopyJump: true, attributionControl: true,
    maxBounds: [[-85, -200], [85, 200]], maxBoundsViscosity: 0.6,
  });
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  map.attributionControl.setPrefix('');

  const esriDark = L.layerGroup([
    L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { subdomains: ['server', 'services'], maxZoom: 16, attribution: '© Esri' }),
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
    minYear: MIN_YEAR, q: '', recentOnly: false, heat: false,
  };

  const sizeFn = inv => Math.max(8, Math.min(34, 7 + Math.sqrt(Math.max(inv, 1)) * 0.95));
  const fmtNum = n => Math.round(n).toLocaleString('en-US');
  const fmtInv = n => n >= 10000 ? (n / 10000).toFixed(1) + ' 万亿' : fmtNum(n) + ' 亿';
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
      && p.year >= state.minYear && matchQ(p, state.q);
  }
  const filtered = () => PROJECTS.filter(p => state.cats.has(p.cat) && !state.subOff.has(p.cat + ':' + p.sub) && passBase(p));

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
    // 连线（输变电/高铁/管道，常显）
    items.forEach(p => {
      if (p.route && p.route.length >= 2) {
        L.polyline(p.route.map(toLatLng), {
          color: CATEGORIES[p.cat].color, weight: 2, opacity: 0.55,
          className: 'flowline', dashArray: '1 11', lineCap: 'round',
        }).addTo(lineLayer);
      }
    });
    if (state.heat) {
      // —— 投资热力图模式：按 √inv 加权显示宏观资本格局，隐藏聚合标记 ——
      if (map.hasLayer(markerCluster)) map.removeLayer(markerCluster);
      const pts = items.map(p => {
        const ll = toLatLng(p.coord);
        const v = (+p.inv > 0) ? +p.inv : 1;   // inv 单位亿美元；开方压缩量级，避免超大项目独占
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
      const c = CATEGORIES[p.cat], d = Math.round(sizeFn(p.inv));
      const cls = 'dot' + (p.flagship ? ' is-flag' : '') + (isRecent(p) ? ' is-new' : '');
      const icon = L.divIcon({
        className: 'mk', iconSize: [d, d], iconAnchor: [d / 2, d / 2],
        html: '<i class="' + cls + '" style="--c:' + c.color + ';width:' + d + 'px;height:' + d + 'px"></i>',
      });
      const m = L.marker(toLatLng(p.coord), { icon, riseOnHover: true });
      m._cat = p.cat;
      m.bindTooltip(
        '<b>' + (isRecent(p) ? '🆕 ' : '') + esc(p.name) + '</b><br>' +
        '<span style="color:' + c.color + '">' + c.short + (subLabel(p) ? ' / ' + subLabel(p) : '') + '</span> · ' + esc(p.country) +
        ' · ' + esc(p.invText) +
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
      if (state.cats.has(key)) state.cats.delete(key); else state.cats.add(key);
      chip.classList.toggle('off', !state.cats.has(key));
      render();
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
    el.addEventListener('click', () => {
      if (state.regions.has(r)) state.regions.delete(r); else state.regions.add(r);
      el.classList.toggle('on', state.regions.has(r)); render();
    });
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

  const slider = document.getElementById('year-slider');
  const yearLabel = document.getElementById('year-label');
  const yearCur = document.getElementById('year-cur');
  slider.min = MIN_YEAR; slider.max = MAX_YEAR; slider.value = MIN_YEAR;
  yearCur.textContent = '全部';
  slider.addEventListener('input', () => {
    state.minYear = +slider.value;
    const txt = state.minYear <= MIN_YEAR ? '全部' : state.minYear + ' 年起';
    yearLabel.textContent = txt; yearCur.textContent = txt; render();
  });

  document.getElementById('search').addEventListener('input', e => { state.q = e.target.value.trim(); render(); });

  document.getElementById('btn-reset').addEventListener('click', () => {
    state.cats = new Set(CAT_KEYS); state.subOff.clear(); state.regions.clear(); state.statuses.clear();
    state.minYear = MIN_YEAR; state.q = ''; state.recentOnly = false;
    document.getElementById('search').value = '';
    slider.value = MIN_YEAR; yearLabel.textContent = '全部'; yearCur.textContent = '全部';
    recentBtn.classList.remove('on');
    document.querySelectorAll('.cat-chip').forEach(e => e.classList.remove('off'));
    document.querySelectorAll('.sub-chip').forEach(e => e.classList.remove('off'));
    document.querySelectorAll('.pill').forEach(e => e.classList.remove('on'));
    render();
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

  /* ---------- 右侧统计 ---------- */
  function updateStats(items) {
    const totalInv = items.reduce((s, p) => s + (p.inv || 0), 0);
    const countries = new Set(items.map(p => p.country)).size;
    const recentN = items.filter(isRecent).length;
    document.getElementById('kpi-proj').textContent = items.length;
    document.getElementById('kpi-country').textContent = countries;
    document.getElementById('kpi-inv').textContent = fmtInv(totalInv);
    document.getElementById('kpi-recent').textContent = recentN;

    const base = PROJECTS.filter(passBase);
    const catCount = {}; CAT_KEYS.forEach(k => catCount[k] = 0);
    base.forEach(p => catCount[p.cat]++);
    const maxC = Math.max(1, ...Object.values(catCount));
    document.getElementById('cat-bars').innerHTML = CAT_KEYS.map(k => {
      const c = CATEGORIES[k], n = catCount[k], dim = state.cats.has(k) ? '' : 'opacity:.35';
      return '<div class="bar-row" style="' + dim + '"><div class="bar-head"><span class="dot" style="background:' + c.color + '"></span>' +
        '<span class="nm">' + c.short + '</span><span class="vv">' + n + '</span></div>' +
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
      '<div class="region-cell"><div class="rv">' + regCount[r] + '</div><div class="rl">' + r + '</div></div>').join('');
  }

  /* ---------- 项目列表（投资额排序） ---------- */
  function updateList(items) {
    const listEl = document.getElementById('proj-list');
    if (!items.length) { listEl.innerHTML = '<div class="empty">无匹配项目，请调整筛选条件</div>'; return; }
    const sorted = items.slice().sort((a, b) => b.inv - a.inv).slice(0, 14);
    listEl.innerHTML = sorted.map(p => {
      const c = CATEGORIES[p.cat];
      return '<div class="proj-item" data-id="' + p.id + '" style="border-left-color:' + c.color + '">' +
        '<div class="pn">' + (p.flagship ? '<span class="star">★</span>' : '') + esc(p.name) +
        (isRecent(p) ? '<span class="newtag">🆕</span>' : '') + '</div>' +
        '<div class="pm"><span>' + esc(p.country) + '</span><span>' + c.short + '</span><span>' + esc(p.invText) + '</span></div></div>';
    }).join('');
    listEl.querySelectorAll('.proj-item').forEach(el => {
      el.addEventListener('click', () => {
        const p = PROJECTS.find(x => String(x.id) === el.dataset.id);
        if (p) { showDetail(p); map.flyTo(toLatLng(p.coord), 8, { duration: 0.7 }); }
      });
    });
  }

  /* ---------- 详情卡 ---------- */
  const detailEl = document.getElementById('detail');
  function showDetail(p) {
    const c = CATEGORIES[p.cat];
    detailEl.innerHTML =
      '<div class="d-top"><button class="d-close" id="d-close">×</button>' +
      '<span class="d-cat" style="background:' + c.color + '22;color:' + c.color + '">' + c.icon + ' ' + c.name + (subLabel(p) ? ' · ' + subLabel(p) : '') + '</span>' +
      (isRecent(p) ? '<span class="d-new">🆕 近一年</span>' : '') +
      '<div class="d-name">' + (p.flagship ? '★ ' : '') + esc(p.name) + '</div>' +
      (p.en ? '<div class="d-en">' + esc(p.en) + '</div>' : '') + '</div>' +
      (p.progress ? '<div class="d-progress"><span class="dp-tag">📍 最新进展</span>' + esc(p.progress) + '</div>' : '') +
      '<div class="d-grid">' +
      cell('国家 / 地区', esc(p.country)) +
      cell('状态', '<span class="tag-status st-' + p.status + '">' + p.status + '</span>') +
      cell('规模 / 容量', esc(p.cap)) +
      cell('投资额', esc(p.invText)) +
      cell('业主 / 参与方', esc(p.owner || '—')) +
      cell('最近动态', esc(p.updated || '—')) +
      '</div><div class="d-desc">' + esc(p.detail || p.desc) + '</div>';
    detailEl.classList.add('show');
    document.getElementById('d-close').addEventListener('click', hideDetail);
  }
  const cell = (k, v) => '<div class="d-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  const hideDetail = () => detailEl.classList.remove('show');
  map.on('click', hideDetail);

  /* ---------- 渲染 ---------- */
  function render() { const items = filtered(); updateMap(items); updateStats(items); updateList(items); }

  // 顶栏：数据更新时间
  const lu = document.getElementById('last-updated');
  if (lu) lu.textContent = '数据更新 ' + META.lastUpdated;

  render();

  // 调试 / 程序化控制句柄
  window.__APP__ = { map, BASES, switchBase, render, state, markerCluster, lineLayer };
})();
