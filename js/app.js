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

  /* ---------- 容量解析：把自由文本 cap 抽成结构化数值 ----------
   * 返回 { mw, mwh, km, kbd, wty }：电功率MW / 储能MWh / 线路km / 油气万桶日 / 产能万吨年。
   * 取首个匹配为准；遇 "A+B" 加和；"N×M 单位" 相乘；MW/GW 用前瞻避免误吞 MWh/GWh。无则 null。 */
  function parseCapacity(cap) {
    const out = { mw: null, mwh: null, km: null, kbd: null, wty: null };
    if (!cap) return out;
    const s = String(cap).replace(/[，、]/g, ',').replace(/＋/g, '+').replace(/／/g, '/').replace(/[×✕⨯]/g, 'x').replace(/～/g, '~');
    const NUM = '(\\d+(?:\\.\\d+)?)', MUL = '(?:\\s*x\\s*(\\d+(?:\\.\\d+)?))?';
    function collect(unitAlt, factor) {
      const rg = new RegExp(NUM + MUL + '\\s*(?:' + unitAlt + ')', 'gi'), vals = []; let m;
      while ((m = rg.exec(s))) { let v = parseFloat(m[1]); if (m[2]) v *= parseFloat(m[2]); if (!isNaN(v)) vals.push({ v: v * factor, i: m.index }); }
      return vals;
    }
    function pick(vals) {
      if (!vals.length) return null;
      if (vals.length >= 2) {
        let additive = true;
        for (let k = 1; k < vals.length; k++) if (s.slice(vals[k - 1].i, vals[k].i).indexOf('+') < 0) { additive = false; break; }
        if (additive) return vals.reduce((a, b) => a + b.v, 0);
      }
      return vals[0].v;
    }
    const r = n => (n == null ? null : Math.round(n * 100) / 100);
    const power = [].concat(collect('GWp|GW(?!h)|吉瓦', 1000)).concat(collect('万千瓦(?!时)', 10)).concat(collect('MWp|MW(?!h)|兆瓦', 1)).concat(collect('kW(?!h)|千瓦(?!时)', 0.001));
    power.sort((a, b) => a.i - b.i); out.mw = r(pick(power));
    const energy = [].concat(collect('GWh', 1000)).concat(collect('MWh', 1)).concat(collect('万千瓦时', 10)).concat(collect('kWh', 0.001));
    energy.sort((a, b) => a.i - b.i); out.mwh = r(pick(energy));
    const len = collect('公里|km', 1); len.sort((a, b) => a.i - b.i); out.km = len.length ? r(len[0].v) : null;
    let oil = collect('万桶', 1); if (!oil.length) oil = collect('桶', 1 / 10000); oil.sort((a, b) => a.i - b.i); out.kbd = oil.length ? r(oil[0].v) : null;
    const mass = [].concat(collect('万吨', 1)).concat(collect('Mtpa|Mt', 100)); mass.sort((a, b) => a.i - b.i); out.wty = mass.length ? r(mass[0].v) : null;
    return out;
  }

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
    minYear: MIN_YEAR, maxYear: MAX_YEAR, q: '', recentOnly: false, heat: false,
    weight: 'inv', sort: 'inv', // weight: 圆点/热力按 inv 投资 或 cap 装机容量；sort: TOP 排序
    playYear: null,             // 时间轴播放时的"当前年"（用于年份大字 + 当年新项目高亮）
  };

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
      // —— 热力图模式：按 √(投资 或 装机容量) 加权显示宏观格局，隐藏聚合标记 ——
      if (map.hasLayer(markerCluster)) map.removeLayer(markerCluster);
      const hlCap = document.querySelector('.heat-legend .hl-cap');
      if (hlCap) hlCap.textContent = state.weight === 'cap' ? '装机热力' : '投资热力';
      const pts = items.map(p => {
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
        '<b>' + (isRecent(p) ? '🆕 ' : '') + esc(p.name) + '</b><br>' +
        '<span style="color:' + c.color + '">' + c.short + (subLabel(p) ? ' / ' + subLabel(p) : '') + '</span> · ' + esc(p.country) +
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

  document.getElementById('search').addEventListener('input', e => { state.q = e.target.value.trim(); render(); });

  document.getElementById('btn-reset').addEventListener('click', () => {
    pausePlay();
    state.cats = new Set(CAT_KEYS); state.subOff.clear(); state.regions.clear(); state.statuses.clear();
    state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.q = ''; state.recentOnly = false;
    state.weight = 'inv'; state.sort = 'inv';
    clearPresetActive(); document.querySelector('.year-presets .yp[data-preset="all"]').classList.add('on');
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
      ? chips.map(c => '<div class="cap-chip"><div class="cc-ico">' + c[0] + '</div><div class="cc-body"><div class="cc-v">' + c[2] + '</div><div class="cc-l">' + c[1] + '</div></div></div>').join('')
      : '<div class="cap-empty">当前筛选无可解析的容量指标</div>';
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
      '<div class="region-cell' + (state.regions.has(r) ? ' on' : '') + '" data-region="' + r + '"><div class="rv">' + regCount[r] + '</div><div class="rl">' + r + '</div></div>').join('');
  }

  /* ---------- 项目列表（投资额排序） ---------- */
  function updateList(items) {
    const listEl = document.getElementById('proj-list');
    if (!items.length) { listEl.innerHTML = '<div class="empty">无匹配项目，请调整筛选条件</div>'; return; }
    const sortCap = state.sort === 'cap';
    const sorted = items.slice().sort((a, b) => sortCap ? ((b.capMW || 0) - (a.capMW || 0)) : (b.inv - a.inv)).slice(0, 14);
    listEl.innerHTML = sorted.map(p => {
      const c = CATEGORIES[p.cat];
      return '<div class="proj-item" data-id="' + p.id + '" style="border-left-color:' + c.color + '">' +
        '<div class="pn">' + (p.flagship ? '<span class="star">★</span>' : '') + esc(p.name) +
        (isRecent(p) ? '<span class="newtag">🆕</span>' : '') + '</div>' +
        '<div class="pm"><span>' + esc(p.country) + '</span><span>' + c.short + '</span><span>' + (sortCap ? esc(capFmt(p.capMW)) : esc(usd(p))) + '</span></div></div>';
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
      cell('投资额', esc(p.invText) + (/美元|\$/.test(p.invText || '') ? '' : ' <span class="d-usd">（' + usd(p) + '）</span>')) +
      cell('业主 / 参与方', esc(p.owner || '—')) +
      cell('最近动态', esc(p.updated || '—')) +
      '</div><div class="d-desc">' + esc(p.detail || p.desc) + '</div>';
    detailEl.classList.add('show');
    document.getElementById('d-close').addEventListener('click', hideDetail);
  }
  const cell = (k, v) => '<div class="d-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  const hideDetail = () => detailEl.classList.remove('show');
  map.on('click', hideDetail);

  /* ---------- 品类色图例（地图左上，点击=切换该品类）---------- */
  const legendEl = document.getElementById('cat-legend');
  if (legendEl) {
    legendEl.innerHTML = '<div class="cl-title">品类（点击切换）</div>' + CAT_KEYS.map(k => {
      const c = CATEGORIES[k];
      return '<div class="cl" data-key="' + k + '"><span class="d" style="background:' + c.color + '"></span>' + c.short + '</div>';
    }).join('');
    legendEl.querySelectorAll('.cl').forEach(el => el.addEventListener('click', () => toggleCat(el.dataset.key)));
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
    const sEl = document.getElementById('search'); if (sEl) sEl.value = state.q;
    if (yearMin) { yearMin.value = state.minYear; yearMax.value = state.maxYear; syncYearUI(); }
  }

  /* ---------- 渲染 ---------- */
  function render() { const items = filtered(); updateMap(items); updateStats(items); updateList(items); }

  // 顶栏：数据更新时间
  const lu = document.getElementById('last-updated');
  if (lu) lu.textContent = '数据更新 ' + META.lastUpdated;

  // 应用 URL 分享状态（如有），同步 UI 后首次渲染
  applyHash();
  applyUIFromState();
  render();

  // 调试 / 程序化控制句柄
  window.__APP__ = { map, BASES, switchBase, render, state, markerCluster, lineLayer, stateToHash };
})();
