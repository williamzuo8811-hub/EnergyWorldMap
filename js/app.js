/* ============================================================
 * 全球能源项目世界地图 —— 交互逻辑（Leaflet 瓦片地图版）
 * 国界/国名/省/市/街道随缩放由底图自然显示；支持底图切换。
 * ============================================================ */
(function () {
  'use strict';

  const { META, CATEGORIES, REGIONS, STATUS } = window.ENERGY;
  const CAT_KEYS = Object.keys(CATEGORIES);
  // 纯逻辑（子分类规则 / 容量解析 / 坐标纠偏 / 标签映射 / 量级 / 数据装配）抽至 js/util.js，
  // 与 scripts/test-units.js 及 globe.js 共享同一实现
  const { SUB_DEFS, wgs2gcj, normalizeOwner, LABELS_EN, capFmtMW, invMagnitude, buildProjects } = window.ENERGY_UTIL;

  const SUB_LABEL = {};
  Object.keys(SUB_DEFS).forEach(cat => { SUB_LABEL[cat] = {}; SUB_DEFS[cat].forEach(d => { SUB_LABEL[cat][d.key] = d.label; }); });
  const subLabel = p => (SUB_LABEL[p.cat] && SUB_LABEL[p.cat][p.sub]) || '';

  // 合并核心数据与扩充数据（data-extra.js），按名称去重 + 进展/英文正文/子类/容量装配（与 globe.js 同口径）
  const PROJECTS = buildProjects(window.ENERGY, window.ENERGY_EXTRA, window.ENERGY_PROGRESS, { en: window.ENERGY_EN });

  // 脉冲只给"各国旗舰"：每个国家按投资额取前 2 个 flagship，避免 1/3 标记都脉冲的视觉噪声。
  // （★ 仍按 p.flagship 在 TOP 列表 / 详情卡显示，不受影响。）
  const PULSE_IDS = (function () {
    const byCountry = {};
    PROJECTS.forEach(p => { if (p.flagship) (byCountry[p.country] = byCountry[p.country] || []).push(p); });
    const set = new Set();
    Object.values(byCountry).forEach(arr => {
      arr.sort((a, b) => (b.inv || 0) - (a.inv || 0));
      arr.slice(0, 2).forEach(p => set.add(p.id));
    });
    return set;
  })();
  const isPulse = p => !!p.flagship && PULSE_IDS.has(p.id);
  const RECENT_SINCE = META.recentSince;
  const isRecent = p => (p.updated || '') >= RECENT_SINCE;

  /* ---------- 地图与底图 ---------- */
  const map = L.map('map', {
    center: [25, 30], zoom: 3, minZoom: 2, maxZoom: 18,
    zoomControl: false, worldCopyJump: true, attributionControl: true,
    maxBounds: [[-85, -200], [85, 200]], maxBoundsViscosity: 0.6,
  });
  // 窄屏把缩放控件放左上角（标题栏下方的空地），彻底避开底部 🔍/📊 浮钮；桌面端仍放左下
  var _isNarrow = !!(window.matchMedia && window.matchMedia('(max-width: 820px)').matches);
  L.control.zoom({ position: _isNarrow ? 'topleft' : 'bottomleft' }).addTo(map);
  map.attributionControl.setPrefix('');

  const esriDarkBase = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { subdomains: ['server', 'services'], maxZoom: 16, attribution: '© Esri' });
  const esriDark = L.layerGroup([
    esriDarkBase,
    L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { subdomains: ['server', 'services'], maxZoom: 16 }),
  ]);
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
  // 高德地图：服务器在国内、加载快；坐标系为 GCJ-02（火星坐标），靠 crs:'gcj02' 让 toLatLng 用 wgs2gcj 纠偏对齐
  const amap = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    { subdomains: ['1', '2', '3', '4'], maxZoom: 18, attribution: '© 高德地图 AutoNavi' });

  const BASES = [
    { key: 'osm',    name: 'OSM（国际）',     crs: 'wgs84', layer: osm },
    { key: 'amap',   name: '高德（中国）',     crs: 'gcj02', layer: amap },
    { key: 'dark',   name: '暗色科技（国际）', crs: 'wgs84', layer: esriDark },
  ];
  // 国内访客默认高德底图：海外瓦片（OSM/Esri）在大陆加载慢甚至打不开，按浏览器时区/语言识别中国大陆访客，
  // 默认改用国内服务器的高德底图（crs:'gcj02'，toLatLng 已用 wgs2gcj 纠偏对齐）。海外访客仍默认 OSM。
  function preferAmap() {
    try {
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      if (/^(Asia\/(Shanghai|Chongqing|Chungking|Urumqi|Harbin)|PRC)$/i.test(tz)) return true;
      const langs = (navigator.languages && navigator.languages.length ? navigator.languages
        : [navigator.language || '']).join(',').toLowerCase();
      // 简体中文(zh-CN / zh-Hans / 裸 zh) 视为大陆；排除繁体地区(zh-TW/HK/MO/Hant)
      return /(^|,)zh(-cn|-hans|-hans-cn)?(,|$)/.test(langs) && !/zh-(tw|hk|mo|hant)/.test(langs);
    } catch (e) { return false; }
  }
  const initBase = BASES.find(b => b.key === (preferAmap() ? 'amap' : 'osm')) || BASES[0];
  let currentCRS = initBase.crs;
  let activeBaseKey = initBase.key;
  initBase.layer.addTo(map);

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
  // 默认大区：初始进入与重置都展示全部大区（空集合 = 全部项目可见）
  const DEFAULT_REGIONS = [];
  // 全球取景：fitBounds 自动适配各屏幕（SW [纬,经] → NE [纬,经]）
  const WORLD_BOUNDS = [[-58, -170], [72, 185]];
  function fitWorld() { map.fitBounds(WORLD_BOUNDS, { padding: [24, 24] }); }
  const state = {
    cats: new Set(CAT_KEYS), subOff: new Set(), regions: new Set(), countries: new Set(), statuses: new Set(),
    minYear: MIN_YEAR, maxYear: MAX_YEAR, q: '', recentOnly: false, heat: false,
    weight: 'inv', sort: 'inv', // weight: 圆点/热力按 inv 投资 或 cap 装机容量；sort: TOP 排序
    playYear: null,             // 时间轴播放时的"当前年"（用于年份大字 + 当年新项目高亮）
    lang: 'zh',                 // 'zh' | 'en'：项目名称与分析标签的中英切换
    lines: true,                // 飞线（输变电/高铁/管道连线）显隐开关
    compare: [],                // 🆚 国别对比已选国家（最多 4 个）
    heatCat: null,              // 🔥 热力分面：聚焦单一品类（null=全部）
  };

  // 大区 → 国家映射（由项目数据派生）：左侧"所属大区"可展开列出各区国家，点击国家即筛选地图
  const COUNTRY_COUNT = {};                 // 每个国家的项目总数（静态参考值，显示在国家芯片上）
  PROJECTS.forEach(p => { COUNTRY_COUNT[p.country] = (COUNTRY_COUNT[p.country] || 0) + 1; });
  const REGION_COUNTRIES = {};              // 大区 → 该区国家列表（按项目数降序）
  REGIONS.forEach(r => {
    const seen = {};
    PROJECTS.forEach(p => { if (p.region === r) seen[p.country] = true; });
    REGION_COUNTRIES[r] = Object.keys(seen).sort((a, b) => (COUNTRY_COUNT[b] - COUNTRY_COUNT[a]) || a.localeCompare(b, 'zh-Hans-CN'));
  });

  /* ---------- 中 / EN 语言（项目名走 en 字段；分类/大区/状态/界面标签走映射） ---------- */
  const CAT_EN = LABELS_EN.cat, REGION_EN = LABELS_EN.region, STATUS_EN = LABELS_EN.status;
  const I18N = {
    '国家 / 地区': 'Country / Region', '状态': 'Status', '规模 / 容量': 'Capacity', '投资额': 'Investment',
    '业主 / 参与方': 'Owner', '最近动态': 'Updated', '📍 最新进展': '📍 Latest', '🆕 最新': '🆕 Latest',
    '项目数': 'Projects', '总投资': 'Investment', '装机容量': 'Capacity', '分品类（项目数 · 投资额）': 'By category (count · investment)',
    '项目状态': 'Status', '里程碑年份分布': 'Milestone years', '重点项目 TOP（按投资额）': 'Top projects (by investment)',
    '无匹配项目，请调整筛选条件': 'No matching projects — adjust filters', '当前筛选无可解析的容量指标': 'No parseable capacity metrics in current filter',
    '装机': 'Power', '储能': 'Storage', '算力': 'AI Compute', '线路': 'Lines', '油气产能': 'Oil/Gas', '产能': 'Output',
    '变电': 'Substation', '客运': 'Passengers', '吞吐': 'Containers', '晶圆': 'Wafers', '整车': 'Vehicles',
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
  // 国名中→英（全库约 139 个原子国名；EN 模式下悬浮/列表/详情/国别面板/对比统一显示英文）。
  // 仅用于"显示"，dataset/状态键仍存中文原串；复合国名（"英国—德国"/"贝宁、多哥等"）逐段翻译再拼接。
  const COUNTRY_EN = {
    '中国': 'China', '中国台湾': 'Taiwan, China', '中国香港': 'Hong Kong, China', '不丹': 'Bhutan',
    '丹麦': 'Denmark', '乌克兰': 'Ukraine', '乌兹别克斯坦': 'Uzbekistan', '乌干达': 'Uganda', '乍得': 'Chad',
    '以色列': 'Israel', '伊拉克': 'Iraq', '伊朗': 'Iran', '佛得角': 'Cape Verde', '俄罗斯': 'Russia',
    '保加利亚': 'Bulgaria', '克罗地亚': 'Croatia', '冈比亚': 'Gambia', '冰岛': 'Iceland', '几内亚': 'Guinea',
    '几内亚比绍': 'Guinea-Bissau', '刚果（布）': 'Congo-Brazzaville', '刚果（金）': 'DR Congo', '利比亚': 'Libya',
    '加拿大': 'Canada', '加纳': 'Ghana', '加蓬': 'Gabon', '匈牙利': 'Hungary', '南苏丹': 'South Sudan',
    '南非': 'South Africa', '博茨瓦纳': 'Botswana', '卡塔尔': 'Qatar', '卢旺达': 'Rwanda', '印度': 'India',
    '印度尼西亚': 'Indonesia', '厄瓜多尔': 'Ecuador', '厄立特里亚': 'Eritrea', '吉尔吉斯斯坦': 'Kyrgyzstan',
    '吉布提': 'Djibouti', '哈萨克斯坦': 'Kazakhstan', '哥伦比亚': 'Colombia', '喀麦隆': 'Cameroon',
    '土库曼斯坦': 'Turkmenistan', '土耳其': 'Turkey', '圭亚那': 'Guyana', '坦桑尼亚': 'Tanzania', '埃及': 'Egypt',
    '埃塞俄比亚': 'Ethiopia', '塔吉克斯坦': 'Tajikistan', '塞内加尔': 'Senegal', '塞尔维亚': 'Serbia',
    '塞浦路斯': 'Cyprus', '墨西哥': 'Mexico', '多哥': 'Togo', '多哥等': 'Togo etc.', '奥地利': 'Austria',
    '孟加拉国': 'Bangladesh', '安哥拉': 'Angola', '尼日利亚': 'Nigeria', '尼日尔': 'Niger', '尼泊尔': 'Nepal',
    '巴基斯坦': 'Pakistan', '巴布亚新几内亚': 'Papua New Guinea', '巴拿马': 'Panama', '巴林': 'Bahrain',
    '巴西': 'Brazil', '布基纳法索': 'Burkina Faso', '布隆迪': 'Burundi', '希腊': 'Greece', '德国': 'Germany',
    '意大利': 'Italy', '挪威': 'Norway', '捷克': 'Czechia', '摩洛哥': 'Morocco', '文莱': 'Brunei',
    '斯里兰卡': 'Sri Lanka', '新加坡': 'Singapore', '新西兰': 'New Zealand', '日本': 'Japan', '智利': 'Chile',
    '柬埔寨': 'Cambodia', '格陵兰': 'Greenland', '欧盟': 'EU', '比利时': 'Belgium', '毛里塔尼亚': 'Mauritania',
    '沙特': 'Saudi Arabia', '沙特阿拉伯': 'Saudi Arabia', '法国': 'France', '波兰': 'Poland',
    '波斯尼亚和黑塞哥维那': 'Bosnia & Herzegovina', '波黑': 'Bosnia & Herzegovina', '泰国': 'Thailand',
    '津巴布韦': 'Zimbabwe', '澳大利亚': 'Australia', '爱尔兰': 'Ireland', '爱沙尼亚': 'Estonia', '牙买加': 'Jamaica',
    '玻利维亚': 'Bolivia', '瑞典': 'Sweden', '科威特': 'Kuwait', '科特迪瓦': 'Côte d’Ivoire', '秘鲁': 'Peru',
    '突尼斯': 'Tunisia', '立陶宛': 'Lithuania', '约旦': 'Jordan', '纳米比亚': 'Namibia', '缅甸': 'Myanmar',
    '罗马尼亚': 'Romania', '美国': 'United States', '老挝': 'Laos', '肯尼亚': 'Kenya', '芬兰': 'Finland',
    '苏里南': 'Suriname', '英国': 'United Kingdom', '荷兰': 'Netherlands', '莫桑比克': 'Mozambique',
    '莱索托': 'Lesotho', '菲律宾': 'Philippines', '葡萄牙': 'Portugal', '蒙古': 'Mongolia', '蒙古国': 'Mongolia',
    '西班牙': 'Spain', '贝宁': 'Benin', '赞比亚': 'Zambia', '赤道几内亚': 'Equatorial Guinea', '越南': 'Vietnam',
    '阿塞拜疆': 'Azerbaijan', '阿富汗': 'Afghanistan', '阿尔及利亚': 'Algeria', '阿拉伯联合酋长国': 'UAE',
    '阿曼': 'Oman', '阿根廷': 'Argentina', '阿联酋': 'UAE', '韩国': 'South Korea', '马拉维': 'Malawi',
    '马来西亚': 'Malaysia', '马耳他': 'Malta', '马达加斯加': 'Madagascar', '马里': 'Mali', '黑山': 'Montenegro',
  };
  const countryName = c => {
    if (state.lang !== 'en' || !c) return c;
    if (COUNTRY_EN[c]) return COUNTRY_EN[c];
    if (/[—\/、]/.test(c)) return c.split(/[—\/、]/).map(t => COUNTRY_EN[t.trim()] || t.trim()).filter(Boolean).join(' – ');
    return c;
  };

  const sizeFn = v => Math.max(8, Math.min(34, 7 + Math.sqrt(Math.max(v, 1)) * 0.95));
  const fmtNum = n => Math.round(n).toLocaleString('en-US');
  // 投资额量级（inv 单位为亿美元，语言感知）：实现抽到 util.invMagnitude，与 globe.js 共用
  const invMag = n => invMagnitude(n, state.lang);
  const fmtInv = invMag;
  // 圆点/热力权重值：投资额 或 装机容量(MW)
  const weightVal = p => state.weight === 'cap' ? (p.capMW || 0) : (p.inv || 0);
  // 统一美元口径展示
  const usd = p => '≈$' + invMag(p.inv || 0);
  const capFmt = capFmtMW;
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function matchQ(p, q) {
    if (!q) return true;
    const hay = (p.name + ' ' + (p.en || '') + ' ' + p.country + ' ' + (p.owner || '') + ' ' + p.desc).toLowerCase();
    return hay.indexOf(q.toLowerCase()) >= 0;
  }
  function passBase(p) {
    // 地理筛选：选了国家则以国家为准（更具体，覆盖大区选择，避免"大区∩国家"为空的困惑）；否则按大区
    const geoOK = state.countries.size
      ? state.countries.has(p.country)
      : (state.regions.size === 0 || state.regions.has(p.region));
    return geoOK
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
    if (state.countries.size) { state.countries.clear(); syncCountryUI(); }  // 大区与国家是同一地理维度的两种粒度，切大区时清掉国家
    document.querySelectorAll('#region-chips .rg-pill').forEach(el => el.classList.toggle('on', state.regions.has(el.dataset.v)));
    render();
  }
  // 国家筛选：点击国家即只显示该国项目并飞到其范围；可多选（再次点击取消）
  function toggleCountry(c) {
    const add = !state.countries.has(c);
    if (add) state.countries.add(c); else state.countries.delete(c);
    syncCountryUI();
    render();
    if (add) flyToCountries();
  }
  function syncCountryUI() {
    document.querySelectorAll('#region-chips .country-chip').forEach(el =>
      el.classList.toggle('on', state.countries.has(el.dataset.country)));
    // 含选中国家的大区组自动展开并高亮，便于定位
    document.querySelectorAll('#region-chips .region-group').forEach(g => {
      const has = (REGION_COUNTRIES[g.dataset.region] || []).some(c => state.countries.has(c));
      g.classList.toggle('has-sel', has);
      if (has) g.classList.add('open');
    });
  }
  // 把地图飞到当前选中国家的项目范围（多选则框选全部）
  function flyToCountries() {
    if (!state.countries.size) return;
    const pts = PROJECTS.filter(p => state.countries.has(p.country) && p.coord).map(p => toLatLng(p.coord));
    if (!pts.length) return;
    if (pts.length === 1) { map.flyTo(pts[0], 6, { duration: 0.7 }); return; }
    if (L.latLngBounds) {
      try { map.flyToBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 7, duration: 0.7 }); return; } catch (e) { /* 兜底降级 */ }
    }
    map.flyTo(pts[0], 5, { duration: 0.7 });
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
      const cls = 'dot' + (isPulse(p) ? ' is-flag' : '') + (isRecent(p) ? ' is-new' : '') + (state.playYear === p.year ? ' is-year-new' : '');
      const icon = L.divIcon({
        className: 'mk', iconSize: [d, d], iconAnchor: [d / 2, d / 2],
        html: '<i class="' + cls + '" style="--c:' + c.color + ';width:' + d + 'px;height:' + d + 'px"></i>',
      });
      const m = L.marker(toLatLng(p.coord), { icon, riseOnHover: true });
      m._cat = p.cat;
      m.bindTooltip(
        '<b>' + (isRecent(p) ? '🆕 ' : '') + esc(nm(p)) + '</b><br>' +
        '<span style="color:' + c.color + '">' + catShort(p.cat) + (subLabel(p) ? ' / ' + subLabel(p) : '') + '</span> · ' + esc(countryName(p.country)) +
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
    chip.className = 'cat-chip'; chip.dataset.key = key; chip.tabIndex = 0; chip.setAttribute('role', 'button');
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
    // 国际大客户：54 家子分类按 BD 梯队（CLIENT_META）分组并加梯队小标题，避免一长条平铺难扫读
    const META = (key === 'client' && window.CLIENT_META) ? window.CLIENT_META : null;
    const TIER_ORDER = ['第一梯队', '第二梯队', '第三梯队', '其他'];
    const TIER_LABEL = { '第一梯队': '🥇 第一梯队', '第二梯队': '🥈 第二梯队', '第三梯队': '🥉 第三梯队', '其他': '其他出海客户', '未归类': '未归类' };
    const TIER_HUE = { '第一梯队': '#ffd24a', '第二梯队': '#cbd5e6', '第三梯队': '#d98c4a', '其他': '#7f8db0', '未归类': '#7f8db0' };
    const tierOf = d => d.key === 'other' ? '未归类' : (TIER_ORDER.indexOf((META[d.key] || {}).tier) >= 0 ? (META[d.key] || {}).tier : '其他');
    let ordered = SUB_DEFS[key];
    if (META) ordered = ordered.map((d, i) => ({ d, i })).sort((a, b) => {
      const oa = a.d.key === 'other' ? 99 : TIER_ORDER.indexOf(tierOf(a.d));
      const ob = b.d.key === 'other' ? 99 : TIER_ORDER.indexOf(tierOf(b.d));
      return oa - ob || a.i - b.i;
    }).map(x => x.d);
    let lastTier = null;
    ordered.forEach(d => {
      if (META) { const t = tierOf(d); if (t !== lastTier) { const tv = document.createElement('div'); tv.className = 'sub-tier'; tv.setAttribute('style', '--tc:' + (TIER_HUE[t] || '#7f8db0')); tv.textContent = TIER_LABEL[t] || t; subWrap.appendChild(tv); lastTier = t; } }
      const s = document.createElement('div');
      s.className = 'sub-chip'; s.dataset.key = key; s.dataset.sub = d.key; s.tabIndex = 0; s.setAttribute('role', 'button');
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

  // 所属大区：每个大区一组，可展开列出该区国家；点大区芯片按大区筛选，点国家芯片按国家筛选并飞到该国
  const regionEl = document.getElementById('region-chips');
  // 左侧"所属大区→国家"树：抽成函数以便语言切换时整树重建（大区名/国家名随之中英切换）
  function buildRegionTree() {
    const en = state.lang === 'en';
    regionEl.className = 'region-tree';
    regionEl.innerHTML = '';
    REGIONS.forEach(r => {
      const countries = REGION_COUNTRIES[r] || [];
      const regProj = countries.reduce((s, c) => s + (COUNTRY_COUNT[c] || 0), 0);
      const group = document.createElement('div');
      group.className = 'region-group'; group.dataset.region = r;

      const row = document.createElement('div');
      row.className = 'region-row';
      const pill = document.createElement('span');
      pill.className = 'pill rg-pill'; pill.textContent = regionName(r); pill.dataset.v = r;
      pill.tabIndex = 0; pill.setAttribute('role', 'button'); pill.setAttribute('aria-label', regionName(r) + (en ? ' region filter' : ' 大区筛选'));
      pill.addEventListener('click', () => toggleRegion(r));
      const meta = document.createElement('span');
      meta.className = 'rg-meta'; meta.textContent = countries.length + (en ? ' ctry · ' : ' 国 · ') + regProj;
      const caret = document.createElement('span');
      caret.className = 'rg-caret'; caret.textContent = '▸'; caret.tabIndex = 0; caret.setAttribute('role', 'button');
      caret.setAttribute('aria-label', en ? 'Expand / collapse countries' : '展开 / 收起该区国家');
      caret.addEventListener('click', () => group.classList.toggle('open'));
      row.appendChild(pill); row.appendChild(meta); row.appendChild(caret);

      const list = document.createElement('div');
      list.className = 'country-list';
      countries.forEach(c => {
        const chip = document.createElement('span');
        chip.className = 'country-chip'; chip.dataset.country = c; chip.tabIndex = 0; chip.setAttribute('role', 'button');
        chip.innerHTML = '<span class="cn">' + esc(countryName(c)) + '</span><i class="cc">' + (COUNTRY_COUNT[c] || 0) + '</i>';
        chip.addEventListener('click', () => toggleCountry(c));
        list.appendChild(chip);
      });
      if (!countries.length) { const e = document.createElement('div'); e.className = 'country-empty'; e.textContent = en ? 'None' : '暂无'; list.appendChild(e); }

      group.appendChild(row); group.appendChild(list);
      regionEl.appendChild(group);
    });
    // 重建后把已选大区/国家的高亮态还原
    document.querySelectorAll('#region-chips .rg-pill').forEach(el => el.classList.toggle('on', state.regions.has(el.dataset.v)));
    syncCountryUI();
  }
  buildRegionTree();

  const statusEl = document.getElementById('status-chips');
  STATUS.forEach(s => {
    const el = document.createElement('div');
    el.className = 'pill status'; el.textContent = s; el.dataset.v = s; el.tabIndex = 0; el.setAttribute('role', 'button');
    el.addEventListener('click', () => {
      if (state.statuses.has(s)) state.statuses.delete(s); else state.statuses.add(s);
      el.classList.toggle('on', state.statuses.has(s)); render();
    });
    statusEl.appendChild(el);
  });

  // 🆕 仅看最新动态
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
    state.cats = new Set(CAT_KEYS); state.subOff.clear(); state.countries.clear(); state.statuses.clear();
    state.regions = new Set(DEFAULT_REGIONS); // 重置后展示全部大区
    state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.q = ''; state.recentOnly = false;
    state.weight = 'inv'; state.sort = 'inv'; state.heatCat = null;
    clearPresetActive(); document.querySelector('.year-presets .yp[data-preset="all"]').classList.add('on');
    if (typeof syncHeatFacets === 'function') syncHeatFacets();
    fitWorld(); // 重置视图取景到全球
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

  // 🎯 国际大客户 BD 看板
  const btnBoard = document.getElementById('btn-board');
  if (btnBoard) btnBoard.addEventListener('click', showClientBoard);

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
    buildCatLegend();   // 地图浮层文案随语言重建
    buildHeatFacets();
    buildRegionTree();  // 左侧大区/国家树随语言整树重建（含国名中英切换）
  }
  function toggleLang() {
    state.lang = state.lang === 'en' ? 'zh' : 'en';
    applyLang(); render();
    if (_detailP && detailEl.classList.contains('show')) showDetail(_detailP); // 详情卡随语言即时重渲染
  }
  if (btnLang) btnLang.addEventListener('click', toggleLang);

  /* ---------- 右侧统计 ---------- */
  // 硬指标：把结构化容量按当前筛选汇总（仅显示有数值的口径）
  function updateCapStats(items) {
    const el = document.getElementById('cap-stats'); if (!el) return;
    const sum = f => items.reduce((s, p) => s + (f(p) || 0), 0);
    const gw = sum(p => p.capMW) / 1000, gwh = sum(p => p.capMWh) / 1000;
    const km = sum(p => p.capKm), kbd = sum(p => p.capKbd), wty = sum(p => p.capWty), pf = sum(p => p.capPF);
    const pax = sum(p => p.capPax), teu = sum(p => p.capTeu), wafer = sum(p => p.capWafer), veh = sum(p => p.capVeh), mva = sum(p => p.capMva);
    const n1 = x => (x < 10 ? (Math.round(x * 10) / 10) : Math.round(x)).toLocaleString('en-US');
    const chips = [];
    if (gw > 0) chips.push(['⚡', '装机', gw >= 1000 ? (gw / 1000).toFixed(1) + ' TW' : n1(gw) + ' GW']);
    if (gwh > 0) chips.push(['🔋', '储能', n1(gwh) + ' GWh']);
    if (pf > 0) chips.push(['🧠', '算力', pf >= 1000 ? (pf / 1000).toFixed(pf < 10000 ? 1 : 0) + ' EFLOPS' : Math.round(pf).toLocaleString('en-US') + ' PFLOPS']);
    if (mva > 0) chips.push(['🔻', '变电', mva >= 1000 ? (mva / 1000).toFixed(1) + ' GVA' : Math.round(mva).toLocaleString('en-US') + ' MVA']);
    if (km > 0) chips.push(['🔌', '线路', Math.round(km).toLocaleString('en-US') + ' km']);
    if (kbd > 0) chips.push(['🛢️', '油气产能', Math.round(kbd).toLocaleString('en-US') + ' 万桶/日']);
    if (wty > 0) chips.push(['🏭', '产能', Math.round(wty).toLocaleString('en-US') + ' 万吨/年']);
    if (pax > 0) chips.push(['🚉', '客运', pax >= 10000 ? (pax / 10000).toFixed(1) + ' 亿人次/年' : n1(pax) + ' 万人次/年']);
    if (teu > 0) chips.push(['📦', '吞吐', teu >= 10000 ? (teu / 10000).toFixed(1) + ' 亿TEU/年' : n1(teu) + ' 万TEU/年']);
    if (wafer > 0) chips.push(['💽', '晶圆', n1(wafer) + ' 万片/月']);
    if (veh > 0) chips.push(['🚗', '整车', n1(veh) + ' 万辆/年']);
    // 数值与单位拆开渲染，避免窄屏上"27,468 万吨/年"在单位中间硬折行
    const splitVal = v => { const i = v.indexOf(' '); return i < 0 ? [v, ''] : [v.slice(0, i), v.slice(i + 1)]; };
    el.innerHTML = chips.length
      ? chips.map(c => { const nu = splitVal(c[2]); return '<div class="cap-chip"><div class="cc-ico">' + c[0] + '</div><div class="cc-body"><div class="cc-v"><span class="cc-n">' + nu[0] + '</span><span class="cc-u">' + nu[1] + '</span></div><div class="cc-l">' + tr(c[1]) + '</div></div></div>'; }).join('')
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
    // 投资额离群透明化：单个项目占比 ≥25% 时在总投资 KPI 上挂 title 提示（如 Stargate $500B 独占却无感）
    const invEl = document.getElementById('kpi-inv');
    if (invEl) {
      const top = statItems.reduce((a, p) => (p.inv || 0) > (a ? (a.inv || 0) : -1) ? p : a, null);
      invEl.title = (top && totalInv > 0 && top.inv / totalInv >= 0.25)
        ? (state.lang === 'en' ? 'incl. ' : '其中「') + nm(top) + (state.lang === 'en' ? ' ' : '」') + '≈$' + fmtInv(top.inv) + ' · ' + Math.round(top.inv / totalInv * 100) + '%'
        : '';
    }
    updateCapStats(statItems);

    const base = PROJECTS.filter(passBase);
    const catCount = {}; CAT_KEYS.forEach(k => catCount[k] = 0);
    base.forEach(p => catCount[p.cat]++);
    const maxC = Math.max(1, ...Object.values(catCount));
    document.getElementById('cat-bars').innerHTML = CAT_KEYS.map(k => {
      const c = CATEGORIES[k], n = catCount[k], dim = state.cats.has(k) ? '' : 'opacity:.35';
      return '<div class="bar-row" data-key="' + k + '" tabindex="0" role="button" style="cursor:pointer;' + dim + '"><div class="bar-head"><span class="dot" style="background:' + c.color + '"></span>' +
        '<span class="nm">' + catShort(k) + '</span><span class="vv">' + n + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + (n / maxC * 100) + '%;background:' + c.color + '"></div></div></div>';
    }).join('');
    document.querySelectorAll('.cat-chip').forEach(el => { el.querySelector('.ct').textContent = catCount[el.dataset.key]; });

    const subCount = {};
    base.forEach(p => { const id = p.cat + ':' + p.sub; subCount[id] = (subCount[id] || 0) + 1; });
    document.querySelectorAll('.sub-chip').forEach(el => {
      const n = subCount[el.dataset.key + ':' + el.dataset.sub] || 0;
      el.querySelector('.sct').textContent = n;
      el.classList.toggle('is-zero', n === 0);
    });

    const regCount = {}; REGIONS.forEach(r => regCount[r] = 0);
    items.forEach(p => { if (regCount[p.region] != null) regCount[p.region]++; });
    document.getElementById('region-grid').innerHTML = REGIONS.map(r =>
      '<div class="region-cell' + (state.regions.has(r) ? ' on' : '') + '" data-region="' + r + '" tabindex="0" role="button"><div class="rv">' + regCount[r] + '</div><div class="rl">' + regionName(r) + '</div></div>').join('');
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
        '<div class="pm"><span>' + esc(countryName(p.country)) + '</span><span>' + catShort(p.cat) + '</span><span>' + (sortCap ? esc(capFmt(p.capMW)) : esc(usd(p))) + '</span></div></div>';
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
  // 国际大客户详情卡的 BD 画像（梯队/产品契合/重点产品/海外场景/推荐打法），数据来自 window.CLIENT_META
  // 模态焦点管理：打开时记录并把焦点移入，关闭时还原（无障碍）
  let _lastFocus = null;
  const captureFocus = () => { _lastFocus = document.activeElement; };
  const restoreFocus = () => { try { if (_lastFocus && _lastFocus.focus) _lastFocus.focus(); } catch (e) { /* ignore */ } _lastFocus = null; };
  const focusEl = id => { const el = document.getElementById(id); if (el && el.focus) try { el.focus(); } catch (e) { /* ignore */ } };

  const detailEl = document.getElementById('detail');
  let _detailP = null; // 当前打开的项目（供语言切换时即时重渲染详情卡）
  function showDetail(p) {
    const c = CATEGORIES[p.cat];
    _detailP = p;
    captureFocus();
    detailEl.innerHTML =
      '<div class="d-top"><button class="d-close" id="d-close" aria-label="关闭详情卡" title="关闭">×</button>' +
      '<button class="d-share" id="d-share" aria-label="复制该项目的分享链接" title="复制项目链接">🔗</button>' +
      '<button class="d-lang" id="d-lang" title="中文 / English" aria-label="切换中文 / English">' + (state.lang === 'en' ? '中' : 'EN') + '</button>' +
      '<span class="d-cat" style="background:' + c.color + '22;color:' + c.color + '">' + c.icon + ' ' + catName(p.cat) + (subLabel(p) ? ' · ' + subLabel(p) : '') + '</span>' +
      (isRecent(p) ? '<span class="d-new">' + tr('🆕 最新') + '</span>' : '') +
      '<div class="d-name">' + (p.flagship ? '★ ' : '') + esc(nm(p)) + '</div>' +
      (altName(p) ? '<div class="d-en">' + esc(altName(p)) + '</div>' : '') + '</div>' +
      (p.progress ? '<div class="d-progress"><span class="dp-tag">' + tr('📍 最新进展') + '</span>' + esc(p.progress) + '</div>' : '') +
      '<div class="d-grid">' +
      cell(tr('国家 / 地区'), '<span class="d-country-link" data-country="' + esc(p.country) + '">' + esc(countryName(p.country)) + ' 🔎</span>') +
      cell(tr('状态'), '<span class="tag-status st-' + p.status + '">' + statusName(p.status) + '</span>') +
      cell(tr('规模 / 容量'), esc(p.cap)) +
      cell(tr('投资额'), usd(p) + (/美元|\$/.test(p.invText || '') || !p.invText ? '' : ' <span class="d-usd">（原币种：' + esc(p.invText) + '）</span>')) +
      cell(tr('业主 / 参与方'), esc(p.owner || '—')) +
      cell(tr('最近动态'), esc(p.updated || '—')) +
      '</div>' + '<div class="d-desc">' + descBody(p) + '</div>';
    detailEl.classList.add('show');
    document.getElementById('d-close').addEventListener('click', hideDetail);
    const ds = document.getElementById('d-share');
    if (ds) ds.addEventListener('click', () => {
      const params = new URLSearchParams(stateToHash());
      params.set('project', p.id);
      const url = location.href.split('#')[0] + '#' + params.toString();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast('🔗 项目链接已复制'), () => toast('🔗 链接已生成'));
      else toast('🔗 链接已生成');
    });
    const dlang = document.getElementById('d-lang');
    if (dlang) dlang.addEventListener('click', toggleLang); // toggleLang 内部会重渲染当前详情卡
    const cl = detailEl.querySelector('.d-country-link');
    if (cl) cl.addEventListener('click', () => showCountry(cl.dataset.country));
    focusEl('d-close');
  }
  const cell = (k, v) => '<div class="d-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  const hideDetail = () => { const was = detailEl.classList.contains('show'); detailEl.classList.remove('show'); _detailP = null; if (was) restoreFocus(); };
  map.on('click', hideDetail);

  /* ---------- 国别下钻面板（点详情卡的国家打开）---------- */
  const countryPanel = document.getElementById('country-panel');
  const countryBackdrop = document.getElementById('country-backdrop');
  function hideCountry() { const was = countryPanel.classList.contains('show'); countryPanel.classList.remove('show'); countryBackdrop.classList.remove('show'); if (was) restoreFocus(); }
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
      '<div class="cp-head"><span style="font-size:20px">🌍</span><div class="cp-name">' + esc(countryName(country)) + '</div>' +
      '<button class="cp-filter" id="cp-filter" title="在地图上只看该国项目">📍 ' + (state.lang === 'en' ? 'Show on map' : '地图筛选') + '</button>' +
      '<button class="cp-add" id="cp-add" title="加入国别对比">⊕ ' + (state.lang === 'en' ? 'Compare' : '加入对比') + '</button>' +
      '<button class="cp-close" id="cp-close" aria-label="关闭面板" title="关闭">×</button></div>' +
      '<div class="cp-kpis">' +
      kpi(ps.length, tr('项目数')) + kpi('≈$' + fmtInv(d.totalInv), tr('总投资')) +
      kpi(d.totalMW >= 1000 ? (d.totalMW / 1000).toFixed(1) + ' GW' : Math.round(d.totalMW) + ' MW', tr('装机容量')) +
      kpi(d.recentN, tr('🆕 最新')) + '</div>' +
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
    focusEl('cp-close');
    const addBtn = document.getElementById('cp-add');
    if (addBtn) addBtn.addEventListener('click', () => addCompare(country));
    const filterBtn = document.getElementById('cp-filter');
    if (filterBtn) filterBtn.addEventListener('click', () => {
      state.regions.clear();
      state.countries = new Set([country]);
      document.querySelectorAll('#region-chips .rg-pill').forEach(el => el.classList.remove('on'));
      syncCountryUI();
      hideCountry();
      render();
      flyToCountries();
      toast((state.lang === 'en' ? 'Filtered to ' : '已筛选：') + country);
    });
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
        '<div class="cmp-col-head"><span class="cc-name">' + esc(countryName(country)) + '</span>' +
        '<button class="cmp-rm" data-rm="' + esc(country) + '" aria-label="移除" title="移除">✕</button></div>' +
        '<div class="cmp-kpis">' +
        cmpKpi(d.ps.length, tr('项目数')) + cmpKpi('≈$' + fmtInv(d.totalInv), tr('总投资')) +
        cmpKpi(d.totalMW >= 1000 ? (d.totalMW / 1000).toFixed(1) + ' GW' : Math.round(d.totalMW) + ' MW', tr('装机容量')) +
        cmpKpi(d.recentN, tr('🆕 最新')) + '</div>' +
        '<div class="cmp-sec">' + tr('分品类（项目数 · 投资额）') + '</div>' + (catBars || '<div class="cmp-empty">—</div>') +
        '<div class="cmp-sec">' + tr('重点项目 TOP（按投资额）') + '</div>' + (top || '<div class="cmp-empty">—</div>') +
        '</div>';
    }).join('');
    const canAdd = state.compare.length < 4;
    const addTile = canAdd ? '<button class="cmp-addtile" id="cmp-addtile">＋<span>' + (state.lang === 'en' ? 'Add' : '添加') + '</span></button>' : '';
    let picker = '';
    if (comparePickerOpen && canAdd) {
      const list = countryCounts().filter(o => !state.compare.includes(o.c))
        .map(o => '<button class="cmp-pick" data-pick="' + esc(o.c) + '" data-en="' + esc(COUNTRY_EN[o.c] || '') + '">' + esc(countryName(o.c)) + '<span>' + o.n + '</span></button>').join('');
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
    focusEl('cp-close');
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
        b.style.display = (b.dataset.pick + ' ' + (b.dataset.en || '')).toLowerCase().indexOf(q) >= 0 ? '' : 'none';
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
      return '<div class="lg-row" data-owner="' + esc(o) + '" tabindex="0" role="button">' +
        '<div class="lg-rank">' + (i + 1) + '</div>' +
        '<div class="lg-main"><div class="lg-name">' + esc(o) + ' ' + domCats + '</div>' +
        '<div class="lg-track"><div class="lg-fill" style="width:' + (d.n / maxN * 100) + '%"></div></div></div>' +
        '<div class="lg-meta"><b>' + d.n + '</b><span>' + tr('项目数') + '</span></div>' +
        '<div class="lg-meta"><b>≈$' + fmtInv(d.inv) + '</b><span>' + d.countries.size + ' ' + (state.lang === 'en' ? 'countries' : '国') + '</span></div></div>';
    }).join('');
    countryPanel.classList.remove('wide');
    countryPanel.innerHTML =
      '<div class="cp-head"><span style="font-size:20px">🏢</span><div class="cp-name">' + tr('企业 / 业主排行榜') + '</div>' +
      '<button class="cp-close" id="cp-close" aria-label="关闭面板" title="关闭">×</button></div>' +
      '<div class="cp-body"><div class="cp-note" style="margin:0 0 8px">' + tr('按项目数排名（投资额为该业主累计）') + ' · ' + tr('点公司名筛选其全部项目') + '</div>' +
      '<div class="lg-list">' + body + '</div></div>';
    countryBackdrop.classList.add('show'); countryPanel.classList.add('show');
    document.getElementById('cp-close').addEventListener('click', hideCountry);
    focusEl('cp-close');
    countryPanel.querySelectorAll('.lg-row').forEach(el => el.addEventListener('click', () => {
      hideCountry(); state.q = el.dataset.owner; const sEl = document.getElementById('search'); if (sEl) sEl.value = state.q; render();
    }));
  }

  /* ---------- 🎯 国际大客户 BD 看板（按梯队/产品契合；点公司即筛其全部海外项目）---------- */
  function showClientBoard() {
    const META = window.CLIENT_META || {};
    const stat = {};
    PROJECTS.forEach(p => {
      if (p.cat !== 'client') return;
      const k = p.sub || 'other';
      if (!stat[k]) stat[k] = { n: 0, inv: 0, countries: new Set(), recentN: 0 };
      stat[k].n++; stat[k].inv += (p.inv || 0); stat[k].countries.add(p.country); if (isRecent(p)) stat[k].recentN++;
    });
    const en = state.lang === 'en';
    const TIER_ORDER = ['第一梯队', '第二梯队', '第三梯队', '其他'];
    const TIER_EN = { '第一梯队': 'Tier 1', '第二梯队': 'Tier 2', '第三梯队': 'Tier 3', '其他': 'Other' };
    const TIER_COLOR = { '第一梯队': '#ff5fa8', '第二梯队': '#ffb02e', '第三梯队': '#21c7ff', '其他': '#7f8db0' };
    const FIT_COLOR = { '极高': '#ff2d2d', '高': '#ff7a18', '中高': '#ffd000', '中': '#8aa0c8' };
    const subs = SUB_DEFS.client.filter(d => d.key !== 'other').map(d => d.key);
    const rowsByTier = {}; TIER_ORDER.forEach(t => rowsByTier[t] = []);
    subs.forEach(k => {
      const m = META[k] || {};
      const tier = TIER_ORDER.indexOf(m.tier) >= 0 ? m.tier : '其他';
      const s = stat[k] || { n: 0, inv: 0, countries: new Set(), recentN: 0 };
      rowsByTier[tier].push({ k, label: (SUB_LABEL.client[k] || k), m, s });
    });
    const maxN = Math.max(1, ...subs.map(k => (stat[k] ? stat[k].n : 0)));
    const totalProj = Object.values(stat).reduce((a, b) => a + b.n, 0);
    const fitBadge = f => f ? '<span class="bd-fit" style="--fc:' + (FIT_COLOR[f] || '#8aa0c8') + '">' + esc(f) + '</span>' : '';

    let html = '';
    TIER_ORDER.forEach(tier => {
      const list = rowsByTier[tier]; if (!list.length) return;
      list.sort((a, b) => b.s.n - a.s.n);
      const tierProj = list.reduce((a, b) => a + b.s.n, 0);
      html += '<div class="bd-tier" style="--tc:' + TIER_COLOR[tier] + '"><span class="bd-tier-dot"></span><b>' +
        (en ? TIER_EN[tier] : tier) + '</b><span class="bd-tier-meta">' + list.length + (en ? ' cos · ' : ' 家 · ') + tierProj + (en ? ' proj' : ' 项目') + '</span></div>';
      html += list.map(r => {
        const m = r.m, s = r.s;
        return '<div class="lg-row bd-row" data-sub="' + r.k + '" tabindex="0" role="button" title="' + esc(m.approach || '') + '">' +
          '<div class="lg-main"><div class="lg-name">' + esc(r.label) + ' ' + fitBadge(m.fit) +
          (m.type ? '<span class="bd-type">' + esc(m.type) + '</span>' : '') + '</div>' +
          (m.product ? '<div class="bd-line">🔌 ' + esc(m.product) + '</div>' : '') +
          (m.scenario ? '<div class="bd-line bd-dim">🌍 ' + esc(m.scenario) + '</div>' : '') +
          '<div class="lg-track"><div class="lg-fill" style="width:' + (s.n / maxN * 100) + '%;background:' + TIER_COLOR[tier] + '"></div></div></div>' +
          '<div class="lg-meta"><b>' + s.n + '</b><span>' + (en ? 'proj' : '项目') + '</span></div>' +
          '<div class="lg-meta"><b>' + s.countries.size + '</b><span>' + (en ? 'countries' : '国') + '</span></div></div>';
      }).join('');
    });

    countryPanel.classList.remove('wide');
    countryPanel.innerHTML =
      '<div class="cp-head"><span style="font-size:20px">🎯</span><div class="cp-name">' + (en ? 'Key Clients · BD Board' : '国际大客户 · BD 看板') + '</div>' +
      '<button class="cp-close" id="cp-close" aria-label="关闭面板" title="关闭">×</button></div>' +
      '<div class="cp-body"><div class="cp-note" style="margin:0 0 8px">' +
      (en ? subs.length + ' target companies · ' + totalProj + ' overseas projects · grouped by BD tier & product fit. Click a company to filter its projects on the map.'
          : subs.length + ' 家目标客户 · ' + totalProj + ' 个海外项目 · 按 BD 梯队与产品关联度分组。点公司即在地图上筛出其全部海外项目。') +
      '</div><div class="lg-list">' + html + '</div></div>';
    countryBackdrop.classList.add('show'); countryPanel.classList.add('show');
    document.getElementById('cp-close').addEventListener('click', hideCountry);
    focusEl('cp-close');
    countryPanel.querySelectorAll('.bd-row').forEach(el => el.addEventListener('click', () => {
      const sub = el.dataset.sub;
      state.cats = new Set(['client']);
      state.subOff = new Set(SUB_DEFS.client.filter(d => d.key !== sub).map(d => 'client:' + d.key));
      state.regions.clear(); state.countries.clear(); state.statuses.clear();
      state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.recentOnly = false; state.q = '';
      hideCountry(); clearPresetActive();
      const allBtn = document.querySelector('.year-presets .yp[data-preset="all"]'); if (allBtn) allBtn.classList.add('on');
      applyUIFromState(); render();
      const pts = PROJECTS.filter(p => p.cat === 'client' && p.sub === sub && p.coord).map(p => toLatLng(p.coord));
      if (pts.length === 1) map.flyTo(pts[0], 6, { duration: 0.7 });
      else if (pts.length && L.latLngBounds) { try { map.flyToBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 6, duration: 0.7 }); } catch (e) { /* ignore */ } }
      toast((en ? 'Filtered to ' : '已筛选客户：') + (SUB_LABEL.client[sub] || sub));
    }));
  }

  /* ---------- 品类色图例（地图左上，点击=切换该品类；随语言重建）---------- */
  const legendEl = document.getElementById('cat-legend');
  function buildCatLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = '<div class="cl-title">' + (state.lang === 'en' ? 'Categories (click to toggle)' : '品类（点击切换）') + '</div>' + CAT_KEYS.map(k => {
      const c = CATEGORIES[k];
      return '<div class="cl" data-key="' + k + '" tabindex="0" role="button"><span class="d" style="background:' + c.color + '"></span>' + catShort(k) + '</div>';
    }).join('');
    legendEl.querySelectorAll('.cl').forEach(el => el.addEventListener('click', () => toggleCat(el.dataset.key)));
    syncCatUI();
  }
  buildCatLegend();

  /* ---------- 🔥 热力分面：聚焦单一品类（仅热力模式显示；随语言重建）---------- */
  const heatFacetsEl = document.getElementById('heat-facets');
  function syncHeatFacets() {
    if (!heatFacetsEl) return;
    heatFacetsEl.querySelectorAll('.hf').forEach(el =>
      el.classList.toggle('on', (el.dataset.cat || '') === (state.heatCat || '')));
  }
  function buildHeatFacets() {
    if (!heatFacetsEl) return;
    heatFacetsEl.innerHTML = '<div class="hf' + (state.heatCat ? '' : ' on') + '" data-cat="" tabindex="0" role="button">' + (state.lang === 'en' ? 'All' : '全部') + '</div>' +
      CAT_KEYS.map(k => '<div class="hf" data-cat="' + k + '" tabindex="0" role="button"><span class="d" style="background:' + CATEGORIES[k].color + '"></span>' + catShort(k) + '</div>').join('');
    heatFacetsEl.querySelectorAll('.hf').forEach(el => el.addEventListener('click', () => {
      state.heatCat = el.dataset.cat || null;
      syncHeatFacets(); render();
    }));
  }
  buildHeatFacets();

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
    if (state.countries.size) p.set('cty', [...state.countries].join('~'));
    if (state.statuses.size) p.set('st', [...state.statuses].join('~'));
    if (state.minYear > MIN_YEAR || state.maxYear < MAX_YEAR) p.set('yr', state.minYear + '-' + state.maxYear);
    if (state.q) p.set('q', state.q);
    if (state.recentOnly) p.set('recent', '1');
    if (state.heat) p.set('heat', '1');
    if (state.weight === 'cap') p.set('w', 'cap');
    if (state.sort === 'cap') p.set('sort', 'cap');
    if (state.lang === 'en') p.set('lang', 'en');
    if (!state.lines) p.set('lines', '0');
    if (state.heatCat) p.set('hcat', state.heatCat);
    if (state.compare.length) p.set('cmp', state.compare.join('~'));
    return p.toString();
  }
  let pendingProjectId = null;  // 深链接 #project=<id>：首屏渲染后打开该项目
  function applyHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    const p = new URLSearchParams(h);
    if (p.has('coff')) { const off = new Set(p.get('coff').split('~')); state.cats = new Set(CAT_KEYS.filter(k => !off.has(k))); }
    if (p.has('soff')) state.subOff = new Set(p.get('soff').split('~').filter(Boolean));
    if (p.has('reg')) state.regions = new Set(p.get('reg').split('~').filter(Boolean));
    if (p.has('cty')) state.countries = new Set(p.get('cty').split('~').filter(Boolean));
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
    if (p.has('hcat') && CATEGORIES[p.get('hcat')]) state.heatCat = p.get('hcat');
    if (p.has('cmp')) state.compare = p.get('cmp').split('~').filter(Boolean).slice(0, 4);
    if (p.has('project')) pendingProjectId = p.get('project');
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
    if (state.recentOnly) parts.push(en ? 'Latest' : '最新');
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
      kpiCard(3, recentN, en ? 'Latest' : '🆕 最新', '#ffb02e') +
      '<text x="60" y="360" font-size="14" letter-spacing="1" fill="#5f718f">' + (en ? 'BY CATEGORY (count)' : '分品类（项目数）') + '</text>' +
      '<text x="620" y="360" font-size="14" letter-spacing="1" fill="#5f718f">' + (en ? (sortCap ? 'TOP (by capacity)' : 'TOP (by investment)') : (sortCap ? '重点项目 TOP（按装机）' : '重点项目 TOP（按投资）')) + '</text>' +
      catRows + topRows +
      '<text x="60" y="652" font-size="13" fill="#5f718f">' + items.length + (en ? ' projects · ' : ' 个项目 · ') + countries + (en ? ' countries' : ' 国') + '  ·  ' + X(en ? 'Generated from Global Energy Projects Map' : '由「全球能源项目世界地图」生成') + '</text>' +
      '</svg>';
  }
  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  // 优先导 PNG（SVG→canvas 光栅化，纯矢量无外部资源不会污染 canvas）；失败回退 SVG
  function exportSnapshot() {
    const n = filtered().length, svg = buildSnapshotSVG();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    let fellBack = false;
    const fallback = () => { if (fellBack) return; fellBack = true; saveBlob(svgBlob, 'energy-snapshot-' + n + '.svg'); toast('📸 已导出快照 (SVG)'); };
    try {
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = 2, cv = document.createElement('canvas');
          cv.width = 1200 * scale; cv.height = 675 * scale;
          const ctx = cv.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, 1200, 675);
          URL.revokeObjectURL(url);
          cv.toBlob(b => { if (b) { saveBlob(b, 'energy-snapshot-' + n + '.png'); toast('📸 已导出当前视图快照 (PNG)'); } else fallback(); }, 'image/png');
        } catch (e) { URL.revokeObjectURL(url); fallback(); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); fallback(); };
      img.src = url;
    } catch (e) { fallback(); }
  }
  const snapBtn = document.getElementById('btn-snapshot');
  if (snapBtn) snapBtn.addEventListener('click', exportSnapshot);

  /* ---------- 由 state 同步所有筛选 UI（用于 URL 载入与重置）---------- */
  function applyUIFromState() {
    syncCatUI();
    document.querySelectorAll('.sub-chip').forEach(el => el.classList.toggle('off', state.subOff.has(el.dataset.key + ':' + el.dataset.sub)));
    document.querySelectorAll('#region-chips .rg-pill').forEach(el => el.classList.toggle('on', state.regions.has(el.dataset.v)));
    syncCountryUI();
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

  /* 移动端：顶栏「关键数据」开关——默认收起 KPI，点击展开/收起，给地图让出空间 */
  const kpiToggle = document.getElementById('kpi-toggle');
  const topbarEl = document.querySelector('.topbar');
  if (kpiToggle && topbarEl) kpiToggle.addEventListener('click', () => {
    const open = topbarEl.classList.toggle('kpis-open');
    kpiToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 220);
  });
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawers);
  document.querySelectorAll('.drawer-close').forEach(b => b.addEventListener('click', closeDrawers));

  /* ---------- 移动端：右上角工具栏折叠成「⋯ 工具」菜单，避免 8 个按钮竖排占满屏 ---------- */
  const mapTools = document.querySelector('.map-tools');
  const toolsToggle = document.getElementById('tools-toggle');
  if (toolsToggle && mapTools) {
    toolsToggle.addEventListener('click', () => mapTools.classList.toggle('tools-open'));
    // 点击任一工具按钮后自动收起菜单（底图切换条除外，便于连续切换）
    mapTools.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b && b !== toolsToggle && !e.target.closest('.basemap-switch')) mapTools.classList.remove('tools-open');
    });
  }

  /* ---------- Esc 关闭浮层（详情卡 / 国别面板·企业榜 / 移动端抽屉）---------- */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (detailEl.classList.contains('show')) hideDetail();
    if (countryPanel.classList.contains('show')) hideCountry();
    closeDrawers();
  });

  /* ---------- 键盘可达性：role=button 的自定义控件支持 Enter/Space 触发 ---------- */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const t = e.target;
    if (t && t.matches && t.matches('.cat-chip,.sub-chip,.pill,.country-chip,.rg-caret,.cl,.hf,.region-cell,.bar-row[role],.cmp-pick,.lg-row,.region-cell[role]')) {
      e.preventDefault(); t.click();
    }
  });

  // 应用 URL 分享状态（如有），同步 UI 后首次渲染
  applyHash();
  // 初始进入（无分享链接时）展示全部大区的项目，并把视图取景到全球
  if (!location.hash) {
    state.regions = new Set(DEFAULT_REGIONS);
    fitWorld();
  }
  applyUIFromState();
  applyLang();
  syncHeatFacets();
  render();

  // 深链接：#project=<id> 打开该项目详情并定位；#cmp=… 直接打开国别对比
  if (pendingProjectId != null) {
    const pp = PROJECTS.find(x => String(x.id) === String(pendingProjectId));
    if (pp) { showDetail(pp); map.flyTo(toLatLng(pp.coord), 7, { duration: 0.8 }); }
  } else if (state.compare.length >= 2) {
    showCompare();
  }

  /* ---------- 首屏加载态：地图瓦片就绪（或超时兜底）后淡出 ---------- */
  (function () {
    const loaderEl = document.getElementById('app-loader');
    if (!loaderEl) return;
    let done = false;
    const hide = () => { if (done) return; done = true; loaderEl.classList.add('hidden'); setTimeout(() => loaderEl.remove(), 480); };
    osm.once('load', hide);              // 首批 OSM 瓦片绘制完成（默认底图）
    map.whenReady(() => setTimeout(hide, 400)); // 视图就绪后短暂保留，避免闪烁
    setTimeout(hide, 2600);              // 离线/瓦片失败兜底，确保不卡 loading
  })();

  // 调试 / 程序化控制句柄
  window.__APP__ = { map, BASES, switchBase, render, state, markerCluster, lineLayer, stateToHash, buildSnapshotSVG, showClientBoard, showLeague, showDetail, PROJECTS, applyLang, buildRegionTree, showCompare, openCompare };
})();
