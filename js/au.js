/* ============================================================
 * 澳洲电网与能源动态地图（au.html）—— 应用逻辑
 * ------------------------------------------------------------
 * 与平面地图 / 3D 地球 / 陪练共用同一份数据层（js/data*.js + util.js），
 * 只取 country 为「澳大利亚」的项目，叠加四类澳洲专属图层：
 *   · 输电骨架（window.AU_GRID：枢纽站 + 走廊；示意走廊，非测绘线路）
 *   · 州 / 领地面 + 电网公司档案（lib/au-states.js 边界 + js/au-states.js 档案）
 *   · 燃煤退役倒计时（window.AU_COAL，含已关停机组做时间轴背景）
 *   · 项目标记（EPC 状态筛选：未招标 = BD 窗口期）
 *   · 🧭 AEMO 管线（window.AU_PIPELINE：承诺 / 预期 / 拟建，菱形标记，独立聚合）与 🌞 REZ 区划面（window.AU_REZ，示意边界）
 * 项目的所属州由坐标对州面做射线法判定（离岸项目取最近州）。
 * 纯前端零构建；调试句柄 window.__AU__；兼容 scripts/test-au.js 的最小 DOM/Leaflet 桩。
 * ============================================================ */
(function () {
  'use strict';

  const ENERGY = window.ENERGY || {};
  const META = ENERGY.META || {}, CATEGORIES = ENERGY.CATEGORIES || {}, STATUS = ENERGY.STATUS || ['规划', '在建', '投运'];
  const CAT_KEYS = Object.keys(CATEGORIES);
  const U = window.ENERGY_UTIL || {};
  const { buildProjects, LABELS_EN, capFmtMW, invMagnitude, matchProject } = U;
  const PY = window.PINYIN_MAP || null;
  const GRID = window.AU_GRID || { nodes: [], lines: [] };
  const COAL = (window.AU_COAL && window.AU_COAL.plants) || [];
  const COAL_ASOF = (window.AU_COAL && window.AU_COAL.asOf) || '';
  const SHEETS = window.AU_STATES || {};
  const GEO = (window.AU_STATES_GEO && window.AU_STATES_GEO.features) || [];
  const PIPE = (window.AU_PIPELINE && window.AU_PIPELINE.items) || [];
  const PIPE_ASOF = (window.AU_PIPELINE && window.AU_PIPELINE.asOf) || '';
  const ZONES = ((window.AU_REZ && window.AU_REZ.zones) || []).filter(z => Array.isArray(z.polygon) && z.polygon.length >= 3);
  const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const NOW = new Date();

  /* ---------- 州 / 领地 ---------- */
  const STATES = [
    { abbr: 'NSW', name: '新南威尔士州', en: 'New South Wales', short: '新州', color: '#5b8def' },
    { abbr: 'VIC', name: '维多利亚州', en: 'Victoria', short: '维州', color: '#b784f5' },
    { abbr: 'QLD', name: '昆士兰州', en: 'Queensland', short: '昆州', color: '#f2a541' },
    { abbr: 'SA', name: '南澳大利亚州', en: 'South Australia', short: '南澳', color: '#ef6b7f' },
    { abbr: 'WA', name: '西澳大利亚州', en: 'Western Australia', short: '西澳', color: '#f5d76e' },
    { abbr: 'TAS', name: '塔斯马尼亚州', en: 'Tasmania', short: '塔州', color: '#3fd0b0' },
    { abbr: 'NT', name: '北领地', en: 'Northern Territory', short: '北领地', color: '#ff8c5a' },
  ];
  const ST = {}; STATES.forEach(s => { ST[s.abbr] = s; });
  const stColor = a => (ST[a] || {}).color || '#8aa4c2';
  // 首都领地按新州归并（档案在 NSW 卡里，地图上的 ACT 面也染新州色）
  const normState = a => a === 'ACT' ? 'NSW' : a;

  // 射线法：点是否在环内
  function inRing(pt, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  // 坐标 → 州缩写；不在任何州面内（离岸风电 / LNG 等）时取最近州（≤ ~3°），再远返回 null
  function stateOf(coord) {
    if (!coord || !GEO.length) return null;
    for (const f of GEO) {
      for (const poly of f.geometry.coordinates) {
        if (!inRing(coord, poly[0])) continue;
        let hole = false;
        for (let k = 1; k < poly.length; k++) if (inRing(coord, poly[k])) { hole = true; break; }
        if (!hole) return normState(f.properties.abbr);
      }
    }
    let best = null, bd = Infinity;
    const cx = Math.cos(coord[1] * Math.PI / 180);
    GEO.forEach(f => f.geometry.coordinates.forEach(poly => poly[0].forEach(v => {
      const dx = (v[0] - coord[0]) * cx, dy = v[1] - coord[1], d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = f.properties.abbr; }
    })));
    return bd <= 9 ? normState(best) : null;
  }
  // 每州外接框（飞行取景用；ACT 并入 NSW）
  const ST_BOUNDS = {};
  GEO.forEach(f => {
    const a = normState(f.properties.abbr);
    const b = ST_BOUNDS[a] || (ST_BOUNDS[a] = [[90, 180], [-90, -180]]);
    f.geometry.coordinates.forEach(poly => poly[0].forEach(v => {
      if (v[1] < b[0][0]) b[0][0] = v[1]; if (v[0] < b[0][1]) b[0][1] = v[0];
      if (v[1] > b[1][0]) b[1][0] = v[1]; if (v[0] > b[1][1]) b[1][1] = v[0];
    }));
  });
  // 西澳 / 昆州的离岛把外接框拉得很大，略收一下（只影响取景）
  const AU_BOUNDS = [[-44.5, 111.5], [-9.5, 155]];

  /* ---------- 数据装配（与 app.js 同口径）---------- */
  const ALL = buildProjects ? buildProjects(window.ENERGY, window.ENERGY_EXTRA, window.ENERGY_PROGRESS, { requireCoord: true }) : [];
  const PROJECTS = ALL.filter(p => /澳大利亚/.test(p.country || ''));
  PROJECTS.forEach(p => { p.auState = stateOf(p.coord); });

  /* ---------- 🧭 AEMO 管线 + 🌞 REZ 装配 ---------- */
  const FUELS = [
    { key: 'solar', zh: '光伏', en: 'Solar', icon: '☀️', color: '#ffd93b' },
    { key: 'wind', zh: '陆上风电', en: 'Wind', icon: '🌬️', color: '#6fe3a5' },
    { key: 'offshore_wind', zh: '海上风电', en: 'Offshore wind', icon: '🌊', color: '#3fd0b0' },
    { key: 'battery', zh: '电池储能', en: 'Battery', icon: '🔋', color: '#21c7ff' },
    { key: 'pumped_hydro', zh: '抽水蓄能', en: 'Pumped hydro', icon: '💧', color: '#5b8def' },
    { key: 'hydro', zh: '水电', en: 'Hydro', icon: '🏞️', color: '#8aa4c2' },
    { key: 'gas', zh: '燃气', en: 'Gas', icon: '🔥', color: '#ff8c5a' },
    { key: 'hydrogen', zh: '氢能', en: 'Hydrogen', icon: '🧪', color: '#c9a7ff' },
    { key: 'coal', zh: '燃煤', en: 'Coal', icon: '🏭', color: '#ff5c7a' },
    { key: 'other', zh: '其他', en: 'Other', icon: '⚙️', color: '#b0bac9' },
  ];
  const FUEL = {}; FUELS.forEach(f => { FUEL[f.key] = f; });
  const fuelOf = k => FUEL[k] || FUEL.other;
  const PL_STATUS = ['committed', 'anticipated', 'proposed'];
  const PL_ZH = { committed: '承诺（在建）', anticipated: '预期', proposed: '拟建' };
  const PL_EN = { committed: 'Committed', anticipated: 'Anticipated', proposed: 'Proposed' };
  const plStatusName = k => state.lang === 'en' ? (PL_EN[k] || k) : (PL_ZH[k] || k);
  const PL_COLOR = { committed: '#2ee6a6', anticipated: '#ffb02e', proposed: '#8aa4c2' };
  const ZONE_COLOR = { declared: '#2ee6a6', planned: '#ffb02e', candidate: '#8aa4c2' };
  const ZONE_ZH = { declared: '已划定', planned: '规划中', candidate: 'ISP 候选' };
  const ZONE_EN = { declared: 'Declared', planned: 'Planned', candidate: 'ISP candidate' };
  const zoneStatusName = k => state.lang === 'en' ? (ZONE_EN[k] || k) : (ZONE_ZH[k] || k);
  const ZONE_PRI = { declared: 0, planned: 1, candidate: 2 };
  const ZONES_SORTED = ZONES.slice().sort((a, b) => (ZONE_PRI[a.status] - ZONE_PRI[b.status]) || (a.state || '').localeCompare(b.state || ''));
  const ZONE = {}; ZONES.forEach(z => { ZONE[z.key] = z; });
  // 坐标 → 所在 REZ（已划定 > 规划 > ISP 候选）
  function zoneOf(coord) { if (!coord) return null; for (const z of ZONES_SORTED) if (inRing(coord, z.polygon)) return z.key; return null; }
  const normEn = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(the|project|stage|phase|bess|battery energy storage system|battery|wind farm|solar farm|power station|energy storage|farm|hybrid|ltd|pty)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const PROJ_BY_EN = {}; PROJECTS.forEach(p => { const k = normEn(p.en); if (k && !PROJ_BY_EN[k]) PROJ_BY_EN[k] = p; });
  PIPE.forEach((it, i) => {
    if (!it.id) it.id = 'pl-' + i;
    it.codYear = it.cod ? parseInt(String(it.cod).slice(0, 4), 10) : null;
    if (!it.state) it.state = stateOf(it.coord);
    it.zone = zoneOf(it.coord);
    if (!it.projId) { const p = PROJ_BY_EN[normEn(it.en)]; if (p) it.projId = p.id; }
  });
  const PIPE_BY_ID = {}; PIPE.forEach(it => { PIPE_BY_ID[it.id] = it; });
  const PROJ_BY_ID = {}; PROJECTS.forEach(p => { PROJ_BY_ID[p.id] = p; });
  PROJECTS.forEach(p => { p.zone = zoneOf(p.coord); });
  // 每个 REZ 内的管线 / 项目汇总（静态，一次算好）
  const ZONE_STAT = {};
  ZONES.forEach(z => { ZONE_STAT[z.key] = { committed: 0, anticipated: 0, proposed: 0, n: 0, projects: 0 }; });
  PIPE.forEach(it => { const st = it.zone && ZONE_STAT[it.zone]; if (st) { st[it.status] = (st[it.status] || 0) + (it.mw || 0); st.n++; } });
  PROJECTS.forEach(p => { const st = p.zone && ZONE_STAT[p.zone]; if (st) st.projects++; });
  const EPC_STATES = ['未招标', '已授标', '未公开', '不适用'];
  const epcOf = p => p.epcStatus || '无数据';
  const years = PROJECTS.map(p => p.year).filter(y => typeof y === 'number');
  const MIN_YEAR = years.length ? Math.min.apply(null, years) : 2020;
  const MAX_YEAR = years.length ? Math.max.apply(null, years) : 2035;
  const RECENT_SINCE = META.recentSince || '2026-01';
  const isRecent = p => (p.updated || '') >= RECENT_SINCE;
  const THIS_YEAR = NOW.getFullYear();

  // 输电骨架：节点索引 + 每条走廊的折线坐标
  const NODE = {}; (GRID.nodes || []).forEach(n => { NODE[n.id] = n; });
  const LINES = (GRID.lines || []).map(l => {
    const pts = (l.nodes || []).map(id => NODE[id]).filter(Boolean).map(n => n.coord);
    return Object.assign({}, l, { pts });
  }).filter(l => l.pts.length >= 2);
  const KV_BANDS = [
    { key: '500', min: 500, color: '#ff5c7a', w: 3.4, label: '500 kV' },
    { key: '330', min: 330, color: '#ffa43b', w: 2.8, label: '330 kV' },
    { key: '275', min: 275, color: '#ffd93b', w: 2.4, label: '275 kV' },
    { key: '220', min: 220, color: '#6fe3a5', w: 2.0, label: '220 kV' },
    { key: '132', min: 0, color: '#5fb3ff', w: 1.6, label: '≤132 kV' },
  ];
  const DC = { key: 'dc', color: '#d78cff', w: 2.6, label: 'HVDC' };
  const bandOf = l => l.type === 'dc' ? DC : (KV_BANDS.find(b => (l.kv || 0) >= b.min) || KV_BANDS[KV_BANDS.length - 1]);

  /* ---------- 状态 ---------- */
  const state = {
    states: new Set(), cats: new Set(CAT_KEYS), statuses: new Set(), epc: new Set(), epcOnly: false,
    minYear: MIN_YEAR, maxYear: MAX_YEAR, recentOnly: false, q: '',
    layers: { grid: true, planned: true, nodes: true, coal: true, projects: true, fill: true, pipe: true, rez: true },
    plStatus: new Set(['committed', 'anticipated']), plFuelOff: new Set(),   // 🧭 管线：默认只显示承诺 + 预期（拟建按需打开）
    kvOff: new Set(), lang: 'zh',
    card: null,   // {kind:'project'|'coal'|'state'|'line', id}
  };

  /* ---------- 文案 ---------- */
  const T = {
    title: ['澳洲电网与能源动态地图', 'Australia Grid & Energy Map'],
    sub: ['输电骨架 · 州与电网公司 · 燃煤退役倒计时 · EPC 未招标窗口期', 'Transmission backbone · State network companies · Coal retirement countdown · Pre-tender EPC window'],
    proj: ['澳洲项目', 'AU projects'], inv: ['总投资', 'Investment'], open: ['🔧 EPC 未招标', '🔧 EPC pre-tender'], openInv: ['未招标投资', 'Pre-tender value'], coalKpi: ['⏳ 2035 前退役煤电', '⏳ Coal retiring by 2035'],
    states: ['州 / 领地', 'States'], statesHint: ['点州看电网公司档案', 'click a state for its grid sheet'], layers: ['图层', 'Layers'],
    epc: ['EPC / 总承包状态', 'EPC status'], epcHint: ['未招标 = BD 窗口期', 'pre-tender = BD window'], epcOpen: ['🔧 只看 EPC 未招标', '🔧 Pre-tender only'],
    cats: ['能源品类', 'Categories'], status: ['项目状态', 'Status'], year: ['年份', 'Years'], all: ['全部', 'All'], recent: ['🆕 近一年', '🆕 Latest'], future: ['未来 2027+', 'Future 2027+'],
    reset: ['↺ 重置全部筛选', '↺ Reset filters'], search: ['搜项目 / 业主 / EPC / 拼音…', 'Search project / owner / EPC…'], world: ['🗺️ 全球地图', '🗺️ World map'],
    coal: ['⏳ 燃煤退役倒计时', '⏳ Coal retirement countdown'], opps: ['🔧 EPC 未招标机会榜', '🔧 Pre-tender opportunities'], mix: ['📊 当前筛选 · 品类投资', '📊 Investment by category'], lines: ['🚧 在建 / 规划输电工程', '🚧 Transmission under construction / planned'],
    lgGrid: ['⚡ 输电骨架', '⚡ Backbone'], lgPlanned: ['🚧 在建 / 规划线路', '🚧 Building / planned'], lgNodes: ['🔘 枢纽变电站', '🔘 Hub substations'], lgCoal: ['🏭 燃煤电厂', '🏭 Coal plants'], lgProj: ['📍 能源项目', '📍 Projects'], lgFill: ['🗺️ 州界着色', '🗺️ State fill'],
    legend: ['图例', 'Legend'], existing: ['已投运', 'existing'], building: ['在建', 'building'], planned: ['规划', 'planned'], legendNote: ['走廊为示意路径（枢纽站连线），非测绘线路', 'Corridors are schematic (hub-to-hub), not surveyed routes'],
    noData: ['无数据', 'n/a'], closed: ['已关停', 'closed'], left: ['剩', ''], yr: ['年', 'y'], mo: ['个月', 'm'], tbd: ['待定', 'TBD'], due: ['到期 · 待核', 'due · verify'],
    fly: ['🎯 飞到', '🎯 Fly to'], filterSt: ['📍 只看该州项目', '📍 Filter this state'], copy: ['🔗 链接已复制', '🔗 Link copied'], close: ['✕', '✕'],
    sheetMissing: ['该州档案待补充', 'Fact sheet pending'],
    cProjects: ['项目', 'Projects'], cInv: ['投资', 'Investment'], cOpen: ['EPC 未招标', 'Pre-tender'], cCoal: ['在运煤电', 'Coal online'],
    kGrid: ['🔌 电网 / 市场', '🔌 Grid / market'], kTnsp: ['🏗️ 输电商 TNSP', '🏗️ TNSP'], kDnsp: ['🔧 配电商 DNSP', '🔧 DNSPs'], kRez: ['🌞 可再生能源区', '🌞 REZ'], kPolicy: ['📜 州政策', '📜 Policy'], kCoalExit: ['🏭 煤电退出', '🏭 Coal exit'], kProjects: ['🚧 重点电网工程', '🚧 Key grid projects'], kVendor: ['🎯 设备商必读', '🎯 Vendor notes'], kPortals: ['📮 招标 / 供应商门户', '📮 Tender portals'], kSources: ['📚 来源', '📚 Sources'],
    kOwner: ['业主', 'Owner'], kMW: ['在运装机', 'Operating MW'], kUnits: ['机组', 'Units'], kFuel: ['燃料', 'Fuel'], kClose: ['关停时间', 'Closure'], kBasis: ['口径', 'Basis'], kReplace: ['🔁 场址再利用 / 替代项目', '🔁 Site reuse / replacement'], kNotes: ['📝 备注', '📝 Notes'],
    kKv: ['电压', 'Voltage'], kStatus: ['状态', 'Status'], kLen: ['长度', 'Length'], kYear: ['投运 / 目标年', 'Year'], kCost: ['投资', 'Cost'], kRoute: ['🧭 走廊节点', '🧭 Route'],
    black: ['烟煤', 'black coal'], brown: ['褐煤', 'brown coal'],
    pCountry: ['所属州', 'State'], pStatus: ['状态', 'Status'], pCap: ['规模 / 容量', 'Capacity'], pInv: ['投资额', 'Investment'], pOwner: ['业主 / 参与方', 'Owner'], pUpd: ['最近动态', 'Updated'], pEpc: ['🔧 EPC / 总承包', '🔧 EPC'], pProg: ['📍 最新进展', '📍 Latest'],
    filters: ['🔍 筛选', '🔍 Filters'], dash: ['📊 看板', '📊 Dashboard'],
    lgPipe: ['🧭 AEMO 管线', '🧭 AEMO pipeline'], lgRez: ['🌞 REZ 区划', '🌞 REZ zones'],
    pipeKpi: ['🧭 承诺+预期管线', '🧭 Committed + anticipated'], pipeT: ['🧭 AEMO 管线', '🧭 AEMO pipeline'], pipeHint: ['承诺 / 预期 / 拟建', 'committed / anticipated / proposed'],
    pipeR: ['🧭 AEMO 管线 · 当前筛选', '🧭 Pipeline · current filter'], zones: ['🌞 可再生能源区 REZ', '🌞 Renewable Energy Zones'],
    pMw: ['装机', 'Capacity'], pMwh: ['储能', 'Storage'], pCod: ['预期投运 COD', 'Expected COD'], pFuel: ['类型', 'Type'], pConn: ['接入点', 'Connection'], pRez: ['所在 REZ', 'REZ'], pAemo: ['AEMO 状态', 'AEMO status'], pApprox: ['⚠ 示意位置（按所在地 / 邮编 / 接入站 / 州质心放置），待补精确坐标', '⚠ Approximate location (locality / postcode / connection node / state centroid)'], pMix: ['构成', 'Mix'], pSiteMw: ['接入上限', 'site cap'], pTnsp: ['TNSP', 'TNSP'],
    zBody: ['规划 / 交付主体', 'Body'], zTarget: ['目标 / 承载容量', 'Target / hosting'], zTimeline: ['🗓️ 时间线', '🗓️ Timeline'], zTx: ['⚡ 配套输电', '⚡ Transmission'], zAccess: ['🎟️ 接入机制', '🎟️ Access scheme'], zPipe: ['🧭 区内管线', '🧭 Pipeline in zone'], zProj: ['📍 区内项目', '📍 Projects in zone'], zApprox: ['边界为示意范围（按公开区划图 / 地名描述勾画）', 'Boundary is approximate (traced from published maps / locality lists)'],
    inZone: ['区内', 'in zone'], total: ['合计', 'total'], proj: ['项目', 'projects'],
  };
  const L_ = k => (T[k] || [k, k])[state.lang === 'en' ? 1 : 0];
  const en = () => state.lang === 'en';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtNum = n => Math.round(n).toLocaleString('en-US');
  const invMag = n => invMagnitude ? invMagnitude(n, state.lang) : String(Math.round(n));
  const usd = p => '≈$' + invMag(p.inv || 0);
  const nm = p => en() ? (p.en || p.name) : (p.name || p.en || '');
  const altName = p => en() ? (p.name || '') : (p.en || '');
  const catShort = k => en() ? ((LABELS_EN && LABELS_EN.cat && LABELS_EN.cat[k]) || (CATEGORIES[k] || {}).short || k) : ((CATEGORIES[k] || {}).short || k);
  const catName = k => en() ? catShort(k) : ((CATEGORIES[k] || {}).name || k);
  const statusName = s => en() ? ((LABELS_EN && LABELS_EN.status && LABELS_EN.status[s]) || s) : s;
  const stName = a => { const s = ST[a]; return s ? (en() ? s.en : s.name) : (a || '—'); };
  const stShort = a => { const s = ST[a]; return s ? (en() ? s.abbr : s.short) : (a || '—'); };
  const EPC_EN = { '未招标': 'Pre-tender', '已授标': 'Awarded', '未公开': 'Undisclosed', '不适用': 'N/A', '无数据': 'n/a' };
  const epcName = s => en() ? (EPC_EN[s] || s) : s;
  const gw = mw => mw >= 1000 ? (mw / 1000).toFixed(1) + ' GW' : Math.round(mw) + ' MW';
  const pressed = (el, on) => { if (el && el.setAttribute) el.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  const $ = id => document.getElementById(id);
  const hexA = (hex, a) => { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };

  /* ---------- 燃煤倒计时 ---------- */
  function countdown(p) {
    if (p.status === 'closed') return { txt: L_('closed') + (p.closedYear ? ' ' + p.closedYear : ''), cls: 'closed', months: 1e6 - (p.closedYear || 0) };  // 已关停排在最后（越近关停越靠前）
    if (!p.closeYear) return { txt: L_('tbd'), cls: 'tbd', months: 1e5 };   // 无官方日期：排在在运机组之后、已关停之前
    const m = (p.closeYear - NOW.getFullYear()) * 12 + ((p.closeMonth || 12) - 1 - NOW.getMonth());
    if (m <= 0) return { txt: L_('due'), cls: 'due', months: 0 };
    const y = Math.floor(m / 12), mm = m % 12;
    const txt = en() ? (y ? y + 'y ' : '') + (mm ? mm + 'm' : '') : L_('left') + ' ' + (y ? y + ' 年' : '') + (mm ? ' ' + mm + ' 个月' : '');
    return { txt: txt.trim(), cls: m <= 36 ? 'hot' : m <= 96 ? 'warm' : 'cool', months: m };
  }
  const coalColor = p => { const c = countdown(p).cls; return c === 'hot' ? '#ff5c7a' : c === 'warm' ? '#ffb02e' : c === 'cool' ? '#ffd93b' : '#6b7a95'; };
  const coalOperating = COAL.filter(p => p.status !== 'closed');
  const coalSorted = COAL.slice().sort((a, b) => countdown(a).months - countdown(b).months || (b.mw || 0) - (a.mw || 0));   // 倒计时升序：在运(近→远) → 待定 → 已关停

  /* ---------- 地图 ---------- */
  const map = L.map('map', { center: [-27, 134], zoom: 4, minZoom: 3, maxZoom: 17, zoomControl: false, attributionControl: true });
  L.control.zoom({ position: 'topleft' }).addTo(map);   // 左下角留给图例
  if (map.attributionControl && map.attributionControl.setPrefix) map.attributionControl.setPrefix('');
  const base = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { subdomains: ['server', 'services'], maxZoom: 16, attribution: '© Esri · 州界 Natural Earth · 走廊示意' });
  const ref = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    { subdomains: ['server', 'services'], maxZoom: 16 });
  base.addTo(map); ref.addTo(map);
  const toLatLng = c => [c[1], c[0]];
  function flyToBounds(b, opts) { if (REDUCED_MOTION) map.fitBounds(b, Object.assign({}, opts, { animate: false })); else map.flyToBounds(b, opts); }
  function flyTo(ll, z) { if (REDUCED_MOTION) map.setView(ll, z, { animate: false }); else map.flyTo(ll, z, { duration: 1.1 }); }
  const fitAU = () => map.fitBounds(AU_BOUNDS, { padding: [10, 10], animate: false });
  fitAU();

  // 首屏 loader：瓦片到位或超时即淡出
  const loader = $('au-loader');
  const hideLoader = () => { if (loader && loader.classList) loader.classList.add('hidden'); };
  base.on('load', hideLoader); setTimeout(hideLoader, 2800);

  // 图层容器（叠放次序：州面 < 走廊 < 节点 < 煤电 < 项目）
  const fillLayer = L.layerGroup().addTo(map);
  const rezLayer = L.layerGroup().addTo(map);     // 🌞 REZ 面：在走廊之下、州面之上
  const lineLayer = L.layerGroup().addTo(map);
  const nodeLayer = L.layerGroup().addTo(map);
  const coalLayer = L.layerGroup().addTo(map);
  const cluster = L.markerClusterGroup({
    maxClusterRadius: 40, showCoverageOnHover: false, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 9,
    iconCreateFunction: function (c) {
      const ms = c.getAllChildMarkers ? c.getAllChildMarkers() : [];
      const cnt = {}; ms.forEach(m => { cnt[m._cat] = (cnt[m._cat] || 0) + 1; });
      const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      const col = (CATEGORIES[top] || {}).color || '#21c7ff', n = c.getChildCount ? c.getChildCount() : ms.length;
      const d = n < 10 ? 30 : n < 50 ? 36 : 42;
      return L.divIcon({ className: 'mk-cluster', iconSize: [d, d], html: '<div class="mkc" style="--c:' + col + ';width:' + d + 'px;height:' + d + 'px"><b>' + n + '</b></div>' });
    },
  });
  cluster.addTo(map);
  // 🧭 管线标记：独立聚合组（菱形），与项目圆点分开聚合
  const plCluster = L.markerClusterGroup({
    maxClusterRadius: 34, showCoverageOnHover: false, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 9,
    iconCreateFunction: function (c) {
      const ms = c.getAllChildMarkers ? c.getAllChildMarkers() : [];
      let mw = 0; const cnt = {}; ms.forEach(m => { mw += m._mw || 0; cnt[m._fuel] = (cnt[m._fuel] || 0) + (m._mw || 0); });
      const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      const col = fuelOf(top).color, n = c.getChildCount ? c.getChildCount() : ms.length, d = n < 10 ? 28 : n < 50 ? 34 : 40;
      return L.divIcon({ className: 'mk-cluster', iconSize: [d, d], html: '<div class="mkc pl" style="--c:' + col + ';width:' + d + 'px;height:' + d + 'px" title="' + Math.round(mw) + ' MW"><b>' + n + '</b></div>' });
    },
  });
  plCluster.addTo(map);
  map.on('click', () => hideCard());

  /* ---------- 州面 ---------- */
  let geoLayer = null;
  function stateStyle(f) {
    const a = normState(f.properties.abbr), on = state.states.size === 0 || state.states.has(a);
    return { color: hexA(stColor(a), on ? 0.85 : 0.35), weight: on && state.states.has(a) ? 1.8 : 1, fillColor: stColor(a), fillOpacity: !state.layers.fill ? 0 : (state.states.has(a) ? 0.22 : on ? 0.08 : 0.03), dashArray: null };
  }
  function buildGeo() {
    if (!GEO.length) return;
    geoLayer = L.geoJSON(window.AU_STATES_GEO, {
      style: stateStyle,
      onEachFeature: (f, lyr) => {
        const a = normState(f.properties.abbr);
        lyr.bindTooltip(() => '<b>' + esc(stName(a)) + '</b><br>' + fmtNum(countBy.state[a] || 0) + ' ' + L_('cProjects') + ' · ' + L_('cOpen') + ' ' + fmtNum(countBy.open[a] || 0), { sticky: true, className: 'au-tip' });
        lyr.on('click', e => { if (L.DomEvent && L.DomEvent.stopPropagation) L.DomEvent.stopPropagation(e); showState(a, { noFly: true }); });
      },
    }).addTo(fillLayer);
  }
  const restyleGeo = () => { if (geoLayer && geoLayer.setStyle) geoLayer.setStyle(stateStyle); };

  /* ---------- 输电骨架 ---------- */
  const lineVisible = l => (l.status === 'existing' ? state.layers.grid : state.layers.planned)
    && !state.kvOff.has(bandOf(l).key)
    && (state.states.size === 0 || (l.nodes || []).some(id => NODE[id] && state.states.has(normState(NODE[id].state))));
  function lineTip(l) {
    const b = bandOf(l);
    return '<b>' + esc(en() ? (l.en || l.name) : l.name) + '</b><br><span style="color:' + b.color + '">' + (l.type === 'dc' ? 'HVDC ' : '') + l.kv + ' kV</span> · ' + L_(l.status)
      + (l.owner ? ' · ' + esc(l.owner) : '') + (l.year ? ' · ' + l.year : '') + (l.lengthKm ? ' · ' + fmtNum(l.lengthKm) + ' km' : '');
  }
  function renderGrid() {
    lineLayer.clearLayers(); nodeLayer.clearLayers();
    LINES.filter(lineVisible).forEach(l => {
      const b = bandOf(l);
      const opts = { color: b.color, weight: b.w, opacity: l.status === 'existing' ? 0.85 : 0.9, className: 'au-line' + (l.status === 'building' ? ' au-building' : ''), lineCap: 'round', lineJoin: 'round' };
      if (l.status === 'planned') opts.dashArray = '5 8';
      if (l.status === 'building') opts.dashArray = '12 6';
      const pl = L.polyline(l.pts.map(toLatLng), opts);
      pl.bindTooltip(lineTip(l), { sticky: true, className: 'au-tip' });
      pl.on('click', e => { if (L.DomEvent && L.DomEvent.stopPropagation) L.DomEvent.stopPropagation(e); showLine(l.id, { noFly: true }); });
      pl.addTo(lineLayer);
    });
    if (state.layers.nodes) {
      const used = new Set(); LINES.filter(lineVisible).forEach(l => (l.nodes || []).forEach(id => used.add(id)));
      (GRID.nodes || []).filter(n => used.has(n.id)).forEach(n => {
        const b = KV_BANDS.find(x => (n.kv || 0) >= x.min) || KV_BANDS[KV_BANDS.length - 1];
        const d = n.kv >= 330 ? 9 : 7;
        const m = L.marker(toLatLng(n.coord), { icon: L.divIcon({ className: 'node-mk', iconSize: [d, d], iconAnchor: [d / 2, d / 2], html: '<i style="--c:' + b.color + '"></i>' }), interactive: true });
        m.bindTooltip('<b>' + esc(en() ? n.en : n.name) + '</b><br>' + n.kv + ' kV · ' + esc(stShort(normState(n.state))) + (n.owner ? ' · ' + esc(n.owner) : '') + (n.notes ? '<br><span style="color:#93a4c4">' + esc(n.notes) + '</span>' : ''), { direction: 'top', className: 'au-tip' });
        m.addTo(nodeLayer);
      });
    }
  }

  /* ---------- 燃煤电厂 ---------- */
  function renderCoal() {
    coalLayer.clearLayers();
    if (!state.layers.coal) return;
    COAL.forEach((p, i) => {
      if (state.states.size && !state.states.has(p.state)) return;
      const cd = countdown(p), col = coalColor(p);
      const icon = L.divIcon({ className: 'coal-mk', iconSize: [30, 30], iconAnchor: [15, 15], html: '<i class="cm' + (p.status === 'closed' ? ' closed' : '') + '" style="--c:' + col + '">🏭<span>' + (p.status === 'closed' ? (p.closedYear || '') : (p.closeYear || '?')) + '</span></i>' });
      const m = L.marker(toLatLng(p.coord), { icon, zIndexOffset: 500 });
      m.bindTooltip('<b>' + esc(en() ? p.en : p.name) + '</b><br>' + esc(p.owner || '') + ' · ' + (p.mw ? fmtNum(p.mw) + ' MW' : '') + '<br><span style="color:' + col + '">' + esc(cd.txt) + '</span>' + (p.closeText && p.status !== 'closed' ? ' · ' + esc(p.closeText) : ''), { direction: 'top', offset: [0, -14], className: 'au-tip' });
      m.on('click', () => showCoal(i, { noFly: true }));
      m.addTo(coalLayer);
    });
  }

  /* ---------- 🌞 REZ 面 ---------- */
  const zoneVisible = z => state.layers.rez && (state.states.size === 0 || state.states.has(normState(z.state)));
  const zoneLabel = z => (z.ispId ? z.ispId + ' · ' : '') + (en() ? (z.en || z.name) : z.name).replace(/\s*[（(].*?[)）]\s*/g, '').slice(0, 18);
  function renderRez() {
    rezLayer.clearLayers();
    const zoom = map.getZoom ? map.getZoom() : 4;
    ZONES_SORTED.slice().reverse().forEach(z => {   // 候选区先画、已划定后画（在上层）
      if (!zoneVisible(z)) return;
      const col = ZONE_COLOR[z.status] || '#8aa4c2';
      const pg = L.polygon(z.polygon.map(toLatLng), { color: col, weight: z.status === 'declared' ? 1.8 : 1.2, opacity: 0.85, dashArray: z.status === 'planned' ? '6 5' : z.status === 'candidate' ? '2 5' : null, fillColor: col, fillOpacity: z.status === 'declared' ? 0.16 : z.status === 'planned' ? 0.10 : 0.05, className: 'au-rez' });
      const st = ZONE_STAT[z.key] || {};
      pg.bindTooltip('<b>' + esc(en() ? (z.en || z.name) : z.name) + '</b><br>' + esc(zoneStatusName(z.status)) + ' · ' + esc(z.body || '') + (z.targetGw ? ' · ' + z.targetGw + ' GW' : '') + '<br><span style="color:#93a4c4">' + L_('zPipe') + ' ' + gw((st.committed || 0) + (st.anticipated || 0)) + ' + ' + gw(st.proposed || 0) + ' ' + plStatusName('proposed') + '</span>', { sticky: true, className: 'au-tip' });
      pg.on('click', e => { if (L.DomEvent && L.DomEvent.stopPropagation) L.DomEvent.stopPropagation(e); showZone(z.key, { noFly: true }); });
      pg.addTo(rezLayer);
      if (zoom >= 5 && z.center) L.marker(toLatLng(z.center), { icon: L.divIcon({ className: 'rez-lab', iconSize: [0, 0], html: '<span style="--c:' + col + '">' + esc(zoneLabel(z)) + '</span>' }), interactive: false }).addTo(rezLayer);
    });
  }
  map.on('zoomend', () => { if (state.layers.rez) renderRez(); });

  /* ---------- 🧭 管线筛选 / 标记 ---------- */
  const plHay = it => (it._hay || (it._hay = [it.en, it.name, it.owner, it.locality, it.connNode, it.tnsp, it.kci, it.rez, it.tech].join(' ').toLowerCase()));
  function passPipe(it) {
    return state.plStatus.has(it.status)
      && !state.plFuelOff.has(it.fuel)
      && (state.states.size === 0 || state.states.has(it.state))
      // 年份滑块两端为开区间：手柄在最左 / 最右时视为「及更早 / 及以后」，COD 在项目库年份范围之外的管线不会被「全部」误滤掉
      && (!it.codYear || ((it.codYear >= state.minYear || state.minYear <= MIN_YEAR) && (it.codYear <= state.maxYear || state.maxYear >= MAX_YEAR)))
      && (!state.q || plHay(it).indexOf(state.q.toLowerCase()) >= 0);
  }
  const filteredPipe = () => state.layers.pipe ? PIPE.filter(passPipe) : [];
  const plSize = mw => Math.max(8, Math.min(22, 6 + Math.sqrt(Math.max(mw || 0, 1)) * 0.5));
  const mwFmt = it => (it.mw ? fmtNum(it.mw) + ' MW' : '') + (it.mwh ? ' / ' + fmtNum(it.mwh) + ' MWh' : '');
  function renderPipe(items) {
    plCluster.clearLayers();
    if (!state.layers.pipe) return;
    const ms = [];
    items.forEach(it => {
      const f = fuelOf(it.fuel), d = Math.round(plSize(it.mw));
      const m = L.marker(toLatLng(it.coord), { icon: L.divIcon({ className: 'pl-mk', iconSize: [d, d], iconAnchor: [d / 2, d / 2], html: '<i class="' + it.status + (it.approx ? ' approx' : '') + '" style="--c:' + f.color + '"></i>' }), riseOnHover: true });
      m._mw = it.mw || 0; m._fuel = it.fuel;
      m.bindTooltip('<b>' + esc(en() ? it.en : it.name) + '</b><br><span style="color:' + f.color + '">' + f.icon + ' ' + esc(en() ? f.en : f.zh) + '</span> · ' + esc(mwFmt(it)) + '<br><span style="color:' + PL_COLOR[it.status] + '">' + esc(plStatusName(it.status)) + '</span>' + (it.cod ? ' · COD ' + esc(it.cod) : '') + (it.owner ? ' · ' + esc(it.owner) : '') + (it.connNode ? '<br><span style="color:#93a4c4">⚡ ' + esc(it.connNode) + '</span>' : ''), { direction: 'top', offset: [0, -d / 2 - 2], className: 'au-tip', sticky: true });
      m.on('click', () => showPipe(it.id, { noFly: true }));
      ms.push(m);
    });
    if (plCluster.addLayers) plCluster.addLayers(ms);
  }
  function renderPipeStats(items) {
    const bands = $('pipe-bands'), fuelEl = $('pipe-fuel'), list = $('pipe-list'), sum = $('pipe-sum');
    const mwBy = st => items.filter(i => i.status === st).reduce((s, i) => s + (i.mw || 0), 0);
    if (bands) bands.innerHTML = PL_STATUS.map((st, i) => '<div class="b' + (i + 1) + '"><b>' + gw(mwBy(st)) + '</b><span>' + esc(plStatusName(st)) + '</span></div>').join('') + '<div class="b4"><b>' + fmtNum(items.length) + '</b><span>' + L_('proj') + '</span></div>';
    if (bands && bands.classList) bands.classList.add('pipe');
    if (sum) sum.textContent = (PIPE_ASOF ? 'AEMO ' + PIPE_ASOF + ' · ' : '') + fmtNum(PIPE.length) + (en() ? ' records' : ' 条');
    if (fuelEl) {
      const by = {}; items.forEach(i => { by[i.fuel] = (by[i.fuel] || 0) + (i.mw || 0); });
      const keys = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 7); const max = Math.max.apply(null, keys.map(k => by[k]).concat([1]));
      fuelEl.innerHTML = keys.map(k => { const f = fuelOf(k); return '<div class="bar-row" data-fuel="' + k + '"><div class="nm">' + f.icon + ' ' + esc(en() ? f.en : f.zh) + '</div><div class="track"><i style="--c:' + f.color + ';--w:' + Math.round(by[k] / max * 100) + '%"></i></div><div class="val">' + gw(by[k]) + '</div></div>'; }).join('') || '<div class="empty">' + L_('noData') + '</div>';
      fuelEl.querySelectorAll('.bar-row').forEach(r => r.addEventListener('click', () => { const k = r.dataset.fuel; state.plFuelOff = new Set(FUELS.map(f => f.key).filter(x => x !== k)); syncUI(); render(); }));
    }
    if (list) {
      const top = items.slice().sort((a, b) => (PL_STATUS.indexOf(a.status) - PL_STATUS.indexOf(b.status)) || (b.mw || 0) - (a.mw || 0)).slice(0, 10);
      list.innerHTML = top.map(it => { const f = fuelOf(it.fuel); return '<div class="row" data-plid="' + esc(it.id) + '" role="button" tabindex="0"><div class="nm"><span style="color:' + f.color + '">' + f.icon + '</span> ' + esc(en() ? it.en : it.name) + '</div><div class="cd ' + (it.status === 'committed' ? 'cool' : it.status === 'anticipated' ? 'warm' : 'tbd') + '">' + esc(plStatusName(it.status)) + (it.cod ? ' ' + esc(it.cod) : '') + '</div><div class="meta">' + esc(stShort(it.state)) + ' · ' + esc(mwFmt(it)) + (it.owner ? ' · ' + esc(it.owner) : '') + (it.rez ? ' · ' + esc(it.rez) : '') + '</div></div>'; }).join('') || '<div class="empty">' + (en() ? 'No pipeline items under the current filter' : '当前筛选下没有管线项目') + '</div>';
      list.querySelectorAll('.row').forEach(r => { r.addEventListener('click', () => showPipe(r.dataset.plid)); r.addEventListener('keydown', e => { if (e.key === 'Enter') showPipe(r.dataset.plid); }); });
    }
  }
  function renderZoneList() {
    const el = $('zone-list'), sum = $('zone-sum'); if (!el) return;
    const zs = ZONES_SORTED.filter(z => state.states.size === 0 || state.states.has(normState(z.state)));
    if (sum) sum.textContent = fmtNum(zs.filter(z => z.status === 'declared').length) + ' ' + zoneStatusName('declared') + ' · ' + fmtNum(zs.length) + (en() ? ' total' : ' 个');
    el.innerHTML = zs.map(z => { const st = ZONE_STAT[z.key] || {}; const near = (st.committed || 0) + (st.anticipated || 0); return '<div class="row" data-zone="' + esc(z.key) + '" role="button" tabindex="0"><div class="nm"><span style="color:' + ZONE_COLOR[z.status] + '">■</span> ' + (z.ispId ? '<small style="color:#7b8ca6">' + esc(z.ispId) + '</small> ' : '') + esc(en() ? (z.en || z.name) : z.name) + '</div><div class="cd ' + z.status + '">' + esc(zoneStatusName(z.status)) + '</div><div class="meta">' + esc(stShort(normState(z.state))) + ' · ' + esc(z.body || '') + (z.targetGw ? ' · ' + z.targetGw + ' GW' : '') + ' · ' + L_('zPipe') + ' ' + gw(near) + (st.proposed ? ' (+' + gw(st.proposed) + ' ' + plStatusName('proposed') + ')' : '') + '</div></div>'; }).join('') || '<div class="empty">' + L_('noData') + '</div>';
    el.querySelectorAll('.row').forEach(r => { r.addEventListener('click', () => showZone(r.dataset.zone)); r.addEventListener('keydown', e => { if (e.key === 'Enter') showZone(r.dataset.zone); }); });
  }

  /* ---------- 项目筛选 / 标记 ---------- */
  function pass(p) {
    return state.cats.has(p.cat)
      && (state.states.size === 0 || state.states.has(p.auState))
      && (state.statuses.size === 0 || state.statuses.has(p.status))
      && (state.epc.size === 0 || state.epc.has(epcOf(p)))
      && (!state.epcOnly || p.epcStatus === '未招标')
      && (!state.recentOnly || isRecent(p))
      && p.year >= state.minYear && p.year <= state.maxYear
      && (!state.q || !matchProject || matchProject(p, state.q, PY));
  }
  const filtered = () => PROJECTS.filter(pass);
  const sizeFn = v => Math.max(8, Math.min(30, 7 + Math.sqrt(Math.max(v, 1)) * 1.1));
  function renderProjects(items) {
    cluster.clearLayers();
    if (!state.layers.projects) return;
    const ms = [];
    items.forEach(p => {
      const c = CATEGORIES[p.cat] || { color: '#21c7ff', icon: '' }, d = Math.round(sizeFn(p.inv || 0));
      const cls = 'dot' + (p.epcStatus === '未招标' ? ' is-open' : '') + (isRecent(p) ? ' is-new' : '');
      const m = L.marker(toLatLng(p.coord), { icon: L.divIcon({ className: 'mk', iconSize: [d, d], iconAnchor: [d / 2, d / 2], html: '<i class="' + cls + '" style="--c:' + c.color + ';width:' + d + 'px;height:' + d + 'px"></i>' }), riseOnHover: true });
      m._cat = p.cat;
      m.bindTooltip('<b>' + (isRecent(p) ? '🆕 ' : '') + esc(nm(p)) + '</b><br><span style="color:' + c.color + '">' + c.icon + ' ' + esc(catShort(p.cat)) + '</span> · ' + esc(stShort(p.auState)) + ' · ' + esc(statusName(p.status)) + ' ' + p.year + ' · ' + usd(p)
        + (p.epcStatus ? '<br><span style="color:' + (p.epcStatus === '未招标' ? '#ffd48a' : '#93a4c4') + '">🔧 ' + esc(epcName(p.epcStatus)) + (p.epc ? ' · ' + esc(String(p.epc).slice(0, 60)) : '') + '</span>' : ''), { direction: 'top', offset: [0, -d / 2 - 2], className: 'au-tip', sticky: true });
      m.on('click', () => showDetail(p.id, { noFly: true }));
      ms.push(m);
    });
    if (cluster.addLayers) cluster.addLayers(ms);
  }

  /* ---------- 统计 / 看板 ---------- */
  const countBy = { state: {}, open: {} };
  function kpis(items, pitems) {
    const base = items.filter(p => p.cat !== 'client'); const ib = base.length ? base : items;
    const inv = ib.reduce((s, p) => s + (p.inv || 0), 0);
    const open = items.filter(p => p.epcStatus === '未招标');
    const openInv = open.filter(p => p.cat !== 'client').reduce((s, p) => s + (p.inv || 0), 0);
    const coalMW = coalOperating.filter(p => (state.states.size === 0 || state.states.has(p.state)) && p.closeYear && p.closeYear <= 2035).reduce((s, p) => s + (p.mw || 0), 0);
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('kpi-proj', fmtNum(items.length)); set('kpi-inv', '$' + invMag(inv)); set('kpi-open', fmtNum(open.length)); set('kpi-open-inv', '$' + invMag(openInv)); set('kpi-coal', gw(coalMW));
    const nearMW = (pitems || []).filter(i => i.status !== 'proposed').reduce((s, i) => s + (i.mw || 0), 0); set('kpi-pipe', gw(nearMW));
    return { inv, open, openInv, coalMW };
  }
  function renderStateList() {
    const el = $('state-list'); if (!el) return;
    countBy.state = {}; countBy.open = {};
    PROJECTS.forEach(p => { if (!p.auState) return; countBy.state[p.auState] = (countBy.state[p.auState] || 0) + 1; if (p.epcStatus === '未招标') countBy.open[p.auState] = (countBy.open[p.auState] || 0) + 1; });
    el.innerHTML = STATES.map(s => {
      const on = state.states.has(s.abbr), dim = state.states.size && !on;
      return '<div class="state-row' + (on ? ' on' : '') + (dim ? ' dim' : '') + '" data-st="' + s.abbr + '" role="button" tabindex="0" aria-pressed="' + (on ? 'true' : 'false') + '">'
        + '<span class="dot" style="--c:' + s.color + '"></span><span class="nm">' + esc(en() ? s.en : s.name) + '<small>' + s.abbr + '</small></span>'
        + '<span class="ct">' + fmtNum(countBy.state[s.abbr] || 0) + (countBy.open[s.abbr] ? ' <b style="color:#ffd48a">·' + countBy.open[s.abbr] + '</b>' : '') + '</span>'
        + '<button class="doc" data-doc="' + s.abbr + '" aria-label="' + esc(s.name) + ' 档案">' + (en() ? 'Sheet ▸' : '档案 ▸') + '</button></div>';
    }).join('');
    el.querySelectorAll('.state-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target && e.target.dataset && e.target.dataset.doc) { showState(e.target.dataset.doc); return; }
        toggleState(row.dataset.st);
      });
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleState(row.dataset.st); } });
    });
  }
  function renderCoalList() {
    const el = $('coal-list'), bands = $('coal-bands'), sum = $('coal-sum'); if (!el) return;
    const vis = coalSorted.filter(p => state.states.size === 0 || state.states.has(p.state));
    const ops = vis.filter(p => p.status !== 'closed');
    const mwBy = lim => ops.filter(p => p.closeYear && p.closeYear <= lim).reduce((s, p) => s + (p.mw || 0), 0);
    const total = ops.reduce((s, p) => s + (p.mw || 0), 0);
    if (bands) bands.innerHTML = [[2028, 'b1'], [2030, 'b2'], [2035, 'b3']].map(([y, c]) => '<div class="' + c + '"><b>' + gw(mwBy(y)) + '</b><span>≤' + y + '</span></div>').join('') + '<div class="b4"><b>' + gw(total) + '</b><span>' + (en() ? 'online' : '在运合计') + '</span></div>';
    if (sum) sum.textContent = fmtNum(ops.length) + (en() ? ' online' : ' 座在运') + (COAL_ASOF ? ' · ' + COAL_ASOF : '');
    const maxMW = Math.max.apply(null, vis.map(p => p.mw || 0).concat([1]));
    el.innerHTML = vis.map(p => {
      const cd = countdown(p), i = COAL.indexOf(p);
      return '<div class="row' + (p.status === 'closed' ? ' closed' : '') + '" data-coal="' + i + '" role="button" tabindex="0">'
        + '<div class="nm">' + esc(en() ? p.en : p.name) + '</div><div class="cd ' + cd.cls + '">' + esc(cd.txt) + '</div>'
        + '<div class="meta">' + esc(stShort(p.state)) + ' · ' + esc(p.owner || '') + (p.mw ? ' · ' + fmtNum(p.mw) + ' MW' : '') + (p.closeText && p.status !== 'closed' ? ' · ' + esc(p.closeText) : '') + '</div>'
        + '<div class="bar"><i style="--c:' + coalColor(p) + ';--w:' + Math.round((p.mw || 0) / maxMW * 100) + '%"></i></div></div>';
    }).join('') || '<div class="empty">' + L_('noData') + '</div>';
    el.querySelectorAll('.row').forEach(r => { r.addEventListener('click', () => showCoal(+r.dataset.coal)); r.addEventListener('keydown', e => { if (e.key === 'Enter') showCoal(+r.dataset.coal); }); });
  }
  function renderOpps(items) {
    const el = $('opp-list'), sum = $('opps-sum'); if (!el) return;
    const open = items.filter(p => p.epcStatus === '未招标').sort((a, b) => (b.inv || 0) - (a.inv || 0));
    if (sum) sum.textContent = fmtNum(open.length) + (en() ? ' projects' : ' 个项目');
    el.innerHTML = open.slice(0, 15).map(p => {
      const c = CATEGORIES[p.cat] || { color: '#21c7ff', icon: '' };
      return '<div class="row" data-pid="' + p.id + '" role="button" tabindex="0"><div class="nm"><span style="color:' + c.color + '">' + c.icon + '</span> ' + esc(nm(p)) + '</div><div class="amt">' + usd(p) + '</div>'
        + '<div class="meta">' + esc(stShort(p.auState)) + ' · ' + esc(statusName(p.status)) + ' ' + p.year + (p.cap ? ' · ' + esc(p.cap) : '') + (p.owner ? ' · ' + esc(p.owner) : '') + '</div></div>';
    }).join('') || '<div class="empty">' + (en() ? 'No pre-tender projects under the current filter' : '当前筛选下没有 EPC 未招标项目') + '</div>';
    el.querySelectorAll('.row').forEach(r => { r.addEventListener('click', () => showDetail(+r.dataset.pid)); r.addEventListener('keydown', e => { if (e.key === 'Enter') showDetail(+r.dataset.pid); }); });
  }
  function renderCatBars(items) {
    const el = $('cat-bars'); if (!el) return;
    const inv = {}, cnt = {};
    items.forEach(p => { cnt[p.cat] = (cnt[p.cat] || 0) + 1; inv[p.cat] = (inv[p.cat] || 0) + (p.inv || 0); });
    const keys = CAT_KEYS.filter(k => cnt[k]).sort((a, b) => inv[b] - inv[a]);
    const max = Math.max.apply(null, keys.map(k => inv[k]).concat([1]));
    el.innerHTML = keys.map(k => { const c = CATEGORIES[k]; return '<div class="bar-row" data-cat="' + k + '"><div class="nm">' + c.icon + ' ' + esc(catShort(k)) + '</div><div class="track"><i style="--c:' + c.color + ';--w:' + Math.round(inv[k] / max * 100) + '%"></i></div><div class="val">$' + invMag(inv[k]) + ' · ' + cnt[k] + '</div></div>'; }).join('') || '<div class="empty">' + L_('noData') + '</div>';
    el.querySelectorAll('.bar-row').forEach(r => r.addEventListener('click', () => { state.cats = new Set([r.dataset.cat]); syncUI(); render(); }));
  }
  function renderLineList() {
    const el = $('line-list'); if (!el) return;
    const ls = LINES.filter(l => l.status !== 'existing' && lineVisible(l)).sort((a, b) => (a.status === 'building' ? 0 : 1) - (b.status === 'building' ? 0 : 1) || (a.year || 9999) - (b.year || 9999));
    el.innerHTML = ls.map(l => { const b = bandOf(l); return '<div class="row" data-line="' + esc(l.id) + '" role="button" tabindex="0"><div class="nm"><span style="color:' + b.color + '">' + (l.type === 'dc' ? 'HVDC' : l.kv + 'kV') + '</span> ' + esc(en() ? (l.en || l.name) : l.name) + '</div><div class="cd ' + (l.status === 'building' ? 'warm' : 'cool') + '">' + L_(l.status) + (l.year ? ' ' + l.year : '') + '</div><div class="meta">' + esc(l.owner || '') + (l.lengthKm ? ' · ' + fmtNum(l.lengthKm) + ' km' : '') + (l.costAud ? ' · ' + esc(l.costAud) : '') + '</div></div>'; }).join('') || '<div class="empty">' + L_('noData') + '</div>';
    el.querySelectorAll('.row').forEach(r => { r.addEventListener('click', () => showLine(r.dataset.line)); r.addEventListener('keydown', e => { if (e.key === 'Enter') showLine(r.dataset.line); }); });
  }
  function renderLegend() {
    const el = $('map-legend'); if (!el) return;
    el.innerHTML = '<div class="lg-h">' + L_('legend') + '</div>'
      + KV_BANDS.map(b => '<div class="lg-row"><i style="--c:' + b.color + '"></i>' + b.label + '</div>').join('')
      + '<div class="lg-row"><i style="--c:' + DC.color + '"></i>' + DC.label + '</div>'
      + '<div class="lg-row"><i class="dash" style="--c:#cfd8ea"></i>' + L_('building') + ' / ' + L_('planned') + '</div>'
      + '<div class="lg-row"><i class="coal" style="--c:#ff5c7a"></i>🏭 ' + (en() ? 'coal · badge = closure year' : '燃煤电厂 · 角标 = 关停年') + '</div>'
      + '<div class="lg-row"><i class="dot" style="--c:#ffb02e"></i>' + (en() ? 'pulsing = EPC pre-tender' : '脉冲圈 = EPC 未招标') + '</div>'
      + '<div class="lg-row"><i class="dia" style="--c:#21c7ff"></i>' + L_('lgPipe') + ' · ' + esc(plStatusName('committed')) + '</div>'
      + '<div class="lg-row"><i class="dia hollow" style="--c:#21c7ff"></i>' + esc(plStatusName('proposed')) + '</div>'
      + '<div class="lg-row"><i class="zone" style="--c:#2ee6a6"></i>REZ ' + esc(zoneStatusName('declared')) + ' <i class="zone" style="--c:#ffb02e;margin-left:6px"></i>' + esc(zoneStatusName('planned')) + '</div>'
      + '<div class="lg-note">' + L_('legendNote') + '</div>';
  }
  function updateCounts(items) {
    const byCat = {}, bySt = {}, byEpc = {};
    items.forEach(p => { byCat[p.cat] = (byCat[p.cat] || 0) + 1; bySt[p.status] = (bySt[p.status] || 0) + 1; byEpc[epcOf(p)] = (byEpc[epcOf(p)] || 0) + 1; });
    document.querySelectorAll('#cat-list .cat-chip').forEach(c => { const n = c.querySelector('.ct'); if (n) n.textContent = byCat[c.dataset.key] || 0; });
    document.querySelectorAll('#status-chips .chip').forEach(c => { const n = c.querySelector('.ct'); if (n) n.textContent = bySt[c.dataset.status] || 0; });
    document.querySelectorAll('#epc-chips .chip').forEach(c => { const n = c.querySelector('.ct'); if (n) n.textContent = byEpc[c.dataset.epc] || 0; });
    const byPl = {}; PIPE.forEach(it => { if (!state.plFuelOff.has(it.fuel) && (state.states.size === 0 || state.states.has(it.state))) byPl[it.status] = (byPl[it.status] || 0) + 1; });
    document.querySelectorAll('#pl-status-chips .chip').forEach(c => { const n = c.querySelector('.ct'); if (n) n.textContent = byPl[c.dataset.pls] || 0; });
  }

  function render() {
    const items = filtered();
    const pitems = filteredPipe();
    restyleGeo(); renderRez(); renderGrid(); renderCoal(); renderProjects(items); renderPipe(pitems);
    kpis(items, pitems); renderCoalList(); renderOpps(items); renderCatBars(items); renderLineList(); renderPipeStats(pitems); renderZoneList(); updateCounts(items);
    writeHash();
  }

  /* ---------- 卡片 ---------- */
  const cardEl = $('card');
  function hideCard() { if (cardEl && cardEl.classList) cardEl.classList.remove('show'); state.card = null; writeHash(); }
  function openCard(html, kind, id) {
    if (!cardEl) return;
    cardEl.innerHTML = html; if (cardEl.classList) cardEl.classList.add('show');
    state.card = { kind, id };
    const cl = $('c-close'); if (cl) cl.addEventListener('click', hideCard);
    const sh = $('c-share'); if (sh) sh.addEventListener('click', () => copyLink());
    cardEl.querySelectorAll('[data-fly]').forEach(b => b.addEventListener('click', () => { const v = b.dataset.fly.split(':'); if (v[0] === 'st') flyToState(v[1]); else if (v[0] === 'll') flyTo([+v[2], +v[1]], +v[3] || 8); else if (v[0] === 'line') flyToLine(v[1]); else if (v[0] === 'zone') flyToZone(v[1]); }));
    cardEl.querySelectorAll('[data-st-filter]').forEach(b => b.addEventListener('click', () => { state.states = new Set([b.dataset.stFilter]); syncUI(); render(); flyToState(b.dataset.stFilter); }));
    cardEl.querySelectorAll('[data-st-open]').forEach(b => b.addEventListener('click', () => showState(b.dataset.stOpen)));
    cardEl.querySelectorAll('[data-pid]').forEach(b => b.addEventListener('click', () => showDetail(+b.dataset.pid)));
    cardEl.querySelectorAll('[data-coal]').forEach(b => b.addEventListener('click', () => showCoal(+b.dataset.coal)));
    cardEl.querySelectorAll('[data-line]').forEach(b => b.addEventListener('click', () => showLine(b.dataset.line)));
    cardEl.querySelectorAll('[data-plid]').forEach(b => b.addEventListener('click', () => showPipe(b.dataset.plid)));
    cardEl.querySelectorAll('[data-zone]').forEach(b => b.addEventListener('click', () => showZone(b.dataset.zone)));
    writeHash();
  }
  const cell = (k, v) => '<div class="d-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  const head = (color, tag, name, alt, extra) => '<div class="d-top"><button class="d-close" id="c-close" aria-label="关闭">×</button><button class="d-share" id="c-share" aria-label="复制链接" title="复制链接">🔗</button>'
    + '<span class="d-cat" style="background:' + hexA(color, 0.14) + ';color:' + color + '">' + tag + '</span>' + (extra || '') + '<div class="d-name">' + name + '</div>' + (alt ? '<div class="d-en">' + alt + '</div>' : '') + '</div>';
  const sec = (title, body) => body ? '<div class="d-sec"><h4>' + title + '</h4>' + body + '</div>' : '';
  const srcList = srcs => (srcs && srcs.length) ? '<ul class="src">' + srcs.map(s => /^https?:/.test(s) ? '<li><a href="' + esc(s) + '" target="_blank" rel="noopener">' + esc(s.replace(/^https?:\/\//, '').slice(0, 70)) + '</a></li>' : '<li>' + esc(s) + '</li>').join('') + '</ul>' : '';
  const paras = txt => txt ? String(txt).split(/\n+/).map(x => '<p>' + esc(x) + '</p>').join('') : '';

  function showDetail(id, opts) {
    const p = PROJECTS.find(x => x.id === id); if (!p) return;
    const c = CATEGORIES[p.cat] || { color: '#21c7ff', icon: '', name: p.cat };
    const open = p.epcStatus === '未招标';
    const html = head(c.color, c.icon + ' ' + esc(catName(p.cat)), (p.flagship ? '★ ' : '') + esc(nm(p)), esc(altName(p)), isRecent(p) ? '<span class="tag cool">🆕</span>' : '')
      + (p.progress ? '<div class="d-strip"><span class="dp-tag">' + L_('pProg') + '</span>' + esc(p.progress) + '</div>' : '')
      + (p.epc || p.epcStatus ? '<div class="d-strip epc' + (open ? ' open' : '') + '"><span class="dp-tag">' + L_('pEpc') + (p.epcStatus ? ' · ' + esc(epcName(p.epcStatus)) : '') + '</span>' + esc(p.epc || '') + '</div>' : '')
      + '<div class="d-grid" style="margin-top:10px">'
      + cell(L_('pCountry'), '<span class="d-link" data-st-open="' + (p.auState || '') + '">' + esc(stName(p.auState)) + ' ▸</span>')
      + cell(L_('pStatus'), '<span class="st-' + p.status + '">' + esc(statusName(p.status)) + '</span> · ' + p.year)
      + cell(L_('pCap'), esc(p.cap || '—')) + cell(L_('pInv'), usd(p) + (p.invText && !/美元|\$/.test(p.invText) ? ' <small style="color:#7b8ca6">(' + esc(p.invText) + ')</small>' : ''))
      + cell(L_('pOwner'), esc(p.owner || '—')) + cell(L_('pUpd'), esc(p.updated || '—')) + '</div>'
      + '<div class="d-desc">' + paras(p.detail || p.desc) + '</div>'
      + '<div class="d-actions"><button data-fly="ll:' + p.coord[0] + ':' + p.coord[1] + ':9">' + L_('fly') + '</button>' + (p.auState ? '<button data-st-open="' + p.auState + '">' + (en() ? '📄 State sheet' : '📄 州档案') + '</button>' : '') + '</div>';
    openCard(html, 'project', p.id);
    if (!(opts && opts.noFly)) flyTo(toLatLng(p.coord), Math.max(map.getZoom ? map.getZoom() : 6, 7));
  }
  function showCoal(i, opts) {
    const p = COAL[i]; if (!p) return;
    const cd = countdown(p), col = coalColor(p);
    const html = head(col, '🏭 ' + (en() ? 'Coal power station' : '燃煤电厂') + ' · ' + esc(stShort(p.state)), esc(en() ? p.en : p.name), esc(en() ? p.name : p.en), '<span class="tag ' + cd.cls + '">' + esc(cd.txt) + '</span>')
      + '<div class="d-grid">' + cell(L_('kOwner'), esc(p.owner || '—')) + cell(L_('kMW'), p.status === 'closed' ? L_('closed') : fmtNum(p.mw || 0) + ' MW') + cell(L_('kUnits'), esc(p.units || '—')) + cell(L_('kFuel'), L_(p.fuel === 'brown' ? 'brown' : 'black') + (p.grid ? ' · ' + esc(p.grid) : ''))
      + cell(L_('kClose'), esc(p.status === 'closed' ? (L_('closed') + ' ' + (p.closedYear || '')) : ((p.closeYear || '—') + (p.closeMonth ? '-' + String(p.closeMonth).padStart(2, '0') : '')))) + cell(L_('kBasis'), esc(p.basis || '—')) + '</div>'
      + (p.closeText ? '<div class="d-strip"><span class="dp-tag">⏳</span>' + esc(p.closeText) + '</div>' : '')
      + sec(L_('kReplace'), paras(p.replacement)) + sec(L_('kNotes'), paras(p.notes)) + sec(L_('kSources'), srcList(p.sources))
      + '<div class="d-actions"><button data-fly="ll:' + p.coord[0] + ':' + p.coord[1] + ':10">' + L_('fly') + '</button><button data-st-open="' + p.state + '">' + (en() ? '📄 State sheet' : '📄 州档案') + '</button></div>';
    openCard(html, 'coal', i);
    if (!(opts && opts.noFly)) flyTo(toLatLng(p.coord), 8);
  }
  function showLine(id, opts) {
    const l = LINES.find(x => x.id === id); if (!l) return;
    const b = bandOf(l);
    const route = (l.nodes || []).map(nid => NODE[nid]).filter(Boolean).map(n => esc(en() ? n.en : n.name) + ' <small style="color:#7b8ca6">' + n.kv + 'kV</small>').join(' → ');
    const html = head(b.color, (l.type === 'dc' ? 'HVDC ' : '⚡ ') + l.kv + ' kV · ' + L_(l.status), esc(en() ? (l.en || l.name) : l.name), esc(en() ? l.name : (l.en || '')))
      + '<div class="d-grid">' + cell(L_('kOwner'), esc(l.owner || '—')) + cell(L_('kStatus'), L_(l.status)) + cell(L_('kYear'), l.year || '—') + cell(L_('kLen'), l.lengthKm ? fmtNum(l.lengthKm) + ' km' : '—') + cell(L_('kCost'), esc(l.costAud || '—')) + cell(L_('kKv'), (l.type === 'dc' ? 'HVDC ' : 'AC ') + l.kv + ' kV') + '</div>'
      + sec(L_('kRoute'), '<p>' + route + '</p>') + sec(L_('kNotes'), paras(l.notes)) + sec(L_('kSources'), srcList(l.sources))
      + '<div class="d-actions"><button data-fly="line:' + esc(l.id) + '">' + L_('fly') + '</button></div>';
    openCard(html, 'line', l.id);
    if (!(opts && opts.noFly)) flyToLine(l.id);
  }
  function showPipe(id, opts) {
    const it = PIPE_BY_ID[id]; if (!it) return;
    const f = fuelOf(it.fuel), z = it.zone ? ZONE[it.zone] : null, pj = it.projId ? PROJ_BY_ID[it.projId] : null;
    const html = head(f.color, f.icon + ' ' + esc(en() ? f.en : f.zh) + ' · ' + esc(stShort(it.state)), esc(en() ? it.en : it.name), esc(en() ? it.name : it.en), '<span class="tag ' + it.status + '">' + esc(plStatusName(it.status)) + '</span>')
      + '<div class="d-grid">' + cell(L_('pMw'), esc(mwFmt(it) || '—') + (it.siteMw ? ' · ' + L_('pSiteMw') + ' ' + fmtNum(it.siteMw) + ' MW' : '')) + cell(L_('pCod'), esc(it.cod || '—')) + cell(L_('pOwner'), esc(it.owner || '—')) + cell(L_('pAemo'), esc(plStatusName(it.status)) + (it.region ? ' · ' + esc(it.region) : '') + (it.kci ? ' · KCI ' + esc(it.kci) : ''))
      + cell(L_('pConn'), esc([it.connNode, it.tnsp].filter(Boolean).join(' · ') || '—')) + cell(L_('pRez'), z ? '<span class="d-link" data-zone="' + esc(z.key) + '">' + esc(en() ? (z.en || z.name) : z.name) + ' ▸</span>' : esc(it.rez || '—')) + '</div>'
      + (it.approx ? '<div class="d-strip" style="border-color:rgba(255,176,46,0.45);background:rgba(255,176,46,0.08)">' + L_('pApprox') + '</div>' : '')
      + (it.tech ? '<div class="d-strip"><span class="dp-tag">' + L_('pFuel') + '</span>' + esc(it.tech) + (it.locality ? ' · ' + esc(it.locality) : '') + '</div>' : '')
      + (it.mix ? '<div class="d-strip"><span class="dp-tag">' + L_('pMix') + '</span>' + Object.keys(it.mix).map(f => { const ff = fuelOf(f); return ff.icon + ' ' + esc(en() ? ff.en : ff.zh) + ' ' + fmtNum(it.mix[f]) + ' MW'; }).join(' + ') + '</div>' : '')
      + sec(L_('kNotes'), paras(it.notes)) + sec(L_('kSources'), srcList(it.sources))
      + '<div class="d-actions"><button data-fly="ll:' + it.coord[0] + ':' + it.coord[1] + ':9">' + L_('fly') + '</button>' + (pj ? '<button data-pid="' + pj.id + '">📍 ' + (en() ? 'Project card' : '项目详情') + '</button>' : '') + '<button data-st-open="' + it.state + '">' + (en() ? '📄 State sheet' : '📄 州档案') + '</button></div>';
    openCard(html, 'pipe', it.id);
    if (!(opts && opts.noFly)) flyTo(toLatLng(it.coord), 8);
  }
  function showZone(key, opts) {
    const z = ZONE[key]; if (!z) return;
    const col = ZONE_COLOR[z.status] || '#8aa4c2', st = ZONE_STAT[z.key] || {};
    const inPipe = PIPE.filter(it => it.zone === z.key).sort((a, b) => (PL_STATUS.indexOf(a.status) - PL_STATUS.indexOf(b.status)) || (b.mw || 0) - (a.mw || 0));
    const inProj = PROJECTS.filter(p => p.zone === z.key).sort((a, b) => (b.inv || 0) - (a.inv || 0)).slice(0, 8);
    const html = head(col, '🌞 ' + esc(zoneStatusName(z.status)) + (z.ispId ? ' · ' + esc(z.ispId) : '') + ' · ' + esc(stShort(normState(z.state))), esc(en() ? (z.en || z.name) : z.name), esc(en() ? z.name : (z.en || '')))
      + '<div class="kv-pills"><div><b style="color:#bfe9d8">' + gw(st.committed || 0) + '</b><span>' + esc(plStatusName('committed')) + '</span></div><div><b style="color:#ffd48a">' + gw(st.anticipated || 0) + '</b><span>' + esc(plStatusName('anticipated')) + '</span></div><div><b>' + gw(st.proposed || 0) + '</b><span>' + esc(plStatusName('proposed')) + '</span></div><div><b>' + fmtNum(st.projects || 0) + '</b><span>' + L_('zProj') + '</span></div></div>'
      + '<div class="d-grid">' + cell(L_('zBody'), esc(z.body || '—')) + cell(L_('zTarget'), z.targetGw ? z.targetGw + ' GW' : '—') + '</div>'
      + sec(L_('zTimeline'), paras(z.timeline)) + sec(L_('zTx'), paras(z.transmission)) + sec(L_('zAccess'), paras(z.access)) + sec(L_('kNotes'), paras(z.notes))
      + (inPipe.length ? sec(L_('zPipe'), inPipe.slice(0, 12).map(it => { const f = fuelOf(it.fuel); return '<div class="co-row"><span><b class="d-link" data-plid="' + esc(it.id) + '">' + f.icon + ' ' + esc(en() ? it.en : it.name) + '</b><small>' + esc(mwFmt(it)) + (it.cod ? ' · COD ' + esc(it.cod) : '') + (it.owner ? ' · ' + esc(it.owner) : '') + '</small></span><span class="tag ' + it.status + '">' + esc(plStatusName(it.status)) + '</span></div>'; }).join('') + (inPipe.length > 12 ? '<p style="color:#7b8ca6">… +' + (inPipe.length - 12) + '</p>' : '')) : '')
      + (inProj.length ? sec(L_('zProj'), inProj.map(p => '<div class="co-row"><span><b class="d-link" data-pid="' + p.id + '">' + esc(nm(p)) + '</b><small>' + esc(catShort(p.cat)) + ' · ' + esc(statusName(p.status)) + ' ' + p.year + (p.epcStatus === '未招标' ? ' · 🔧 ' + esc(epcName('未招标')) : '') + '</small></span><span class="amt" style="color:#2ee6a6;font-weight:700;white-space:nowrap">' + usd(p) + '</span></div>').join('')) : '')
      + sec(L_('kSources'), srcList(z.sources)) + '<div class="d-sec"><p style="color:#7b8ca6;font-size:11px">' + L_('zApprox') + '</p></div>'
      + '<div class="d-actions"><button data-fly="zone:' + esc(z.key) + '">' + L_('fly') + '</button><button data-st-open="' + normState(z.state) + '">' + (en() ? '📄 State sheet' : '📄 州档案') + '</button></div>';
    openCard(html, 'zone', z.key);
    if (!(opts && opts.noFly)) flyToZone(z.key);
  }
  function flyToZone(key) { const z = ZONE[key]; if (!z) return; const lats = z.polygon.map(c => c[1]), lngs = z.polygon.map(c => c[0]); flyToBounds([[Math.min.apply(null, lats), Math.min.apply(null, lngs)], [Math.max.apply(null, lats), Math.max.apply(null, lngs)]], { padding: [50, 50], maxZoom: 8 }); }
  // 州卡片附加段：该州管线分档 + REZ 列表
  function stateExtra(a) {
    const ps = PIPE.filter(it => it.state === a); if (!ps.length && !ZONES.some(z => normState(z.state) === a)) return '';
    const mwBy = st => ps.filter(i => i.status === st).reduce((s, i) => s + (i.mw || 0), 0);
    const zs = ZONES_SORTED.filter(z => normState(z.state) === a);
    return sec(L_('pipeT'), '<p>' + PL_STATUS.map(st => '<span class="tag ' + st + '">' + esc(plStatusName(st)) + ' ' + gw(mwBy(st)) + '</span>').join(' ') + '</p>')
      + (zs.length ? sec(L_('zones'), '<p>' + zs.map(z => '<span class="tag ' + z.status + ' d-link" data-zone="' + esc(z.key) + '">' + (z.ispId ? esc(z.ispId) + ' ' : '') + esc(en() ? (z.en || z.name) : z.name) + '</span>').join(' ') + '</p>') : '');
  }
  function stateStats(a) {
    const ps = PROJECTS.filter(p => p.auState === a);
    const base = ps.filter(p => p.cat !== 'client'); const ib = base.length ? base : ps;
    return { n: ps.length, inv: ib.reduce((s, p) => s + (p.inv || 0), 0), open: ps.filter(p => p.epcStatus === '未招标').length, coal: coalOperating.filter(p => p.state === a).reduce((s, p) => s + (p.mw || 0), 0), ps };
  }
  function showState(a, opts) {
    a = normState(a); const s = ST[a]; if (!s) return;
    const sh = SHEETS[a], d = stateStats(a);
    const top = d.ps.filter(p => p.epcStatus === '未招标').sort((x, y) => (y.inv || 0) - (x.inv || 0)).slice(0, 5);
    const coalRows = coalSorted.filter(p => p.state === a).map(p => { const cd = countdown(p); return '<div class="co-row"><span><b class="d-link" data-coal="' + COAL.indexOf(p) + '">' + esc(en() ? p.en : p.name) + '</b><small>' + esc(p.owner || '') + (p.mw ? ' · ' + fmtNum(p.mw) + ' MW' : '') + '</small></span><span class="tag ' + cd.cls + '">' + esc(cd.txt) + '</span></div>'; }).join('');
    const proj = sh && sh.keyProjects && sh.keyProjects.length ? sh.keyProjects.map(k => '<div class="co-row"><span><b>' + esc(en() ? (k.en || k.name) : k.name) + '</b>' + (k.kv ? ' <small style="display:inline">' + k.kv + 'kV</small>' : '') + '<small>' + esc(k.desc || '') + (k.owner ? ' — ' + esc(k.owner) : '') + '</small></span><span class="tag ' + (k.status === '在建' ? 'warm' : k.status === '投运' ? 'cool' : '') + '">' + esc(statusName(k.status)) + (k.year ? ' ' + k.year : '') + '</span></div>').join('') : '';
    const dnsps = sh && sh.dnsps && sh.dnsps.length ? sh.dnsps.map(x => '<div class="co-row"><span><b>' + esc(x.name) + '</b>' + (x.owner ? ' <small style="display:inline">' + esc(x.owner) + '</small>' : '') + '<small>' + esc(x.area || '') + (x.voltages ? ' · ' + esc(x.voltages) : '') + '</small>' + (x.notes ? '<small>' + esc(x.notes) + '</small>' : '') + '</span></div>').join('') : '';
    const html = head(s.color, '🗺️ ' + (en() ? 'State grid sheet' : '州电网档案'), esc(en() ? s.en : s.name) + ' <small style="color:#7b8ca6;font-weight:500">' + s.abbr + '</small>', esc(en() ? s.name : s.en))
      + '<div class="kv-pills"><div><b>' + fmtNum(d.n) + '</b><span>' + L_('cProjects') + '</span></div><div><b>$' + invMag(d.inv) + '</b><span>' + L_('cInv') + '</span></div><div><b style="color:#ffd48a">' + fmtNum(d.open) + '</b><span>' + L_('cOpen') + '</span></div><div><b style="color:#ff8fa3">' + gw(d.coal) + '</b><span>' + L_('cCoal') + '</span></div></div>'
      + '<div class="d-actions"><button data-fly="st:' + a + '">' + L_('fly') + '</button><button data-st-filter="' + a + '">' + L_('filterSt') + '</button></div>'
      + (sh ? (sh.summary ? '<div class="d-strip">' + esc(sh.summary) + '</div>' : '')
        + sec(L_('kGrid'), '<p>' + esc(sh.grid || '') + (sh.operator ? ' · ' + esc(sh.operator) : '') + '</p>')
        + sec(L_('kTnsp'), sh.tnsp ? '<p><b>' + esc(sh.tnsp.name) + '</b>' + (sh.tnsp.owner ? ' · ' + esc(sh.tnsp.owner) : '') + (sh.tnsp.voltages ? ' · ' + esc(sh.tnsp.voltages) : '') + '</p>' + paras(sh.tnsp.notes) : '')
        + sec(L_('kDnsp'), dnsps)
        + sec(L_('kRez'), '<p>' + esc(sh.rezBody || '') + '</p>' + ((sh.rezs || []).length ? '<p>' + sh.rezs.map(r => '<span class="tag">' + esc(r) + '</span>').join('') + '</p>' : ''))
        + sec(L_('kPolicy'), paras(sh.policy)) + sec(L_('kCoalExit'), paras(sh.coalExit) + coalRows)
        + sec(L_('kProjects'), proj) + sec(L_('kVendor'), paras(sh.vendor))
        + sec(L_('kPortals'), srcList(sh.tenderPortals)) + sec(L_('kSources'), srcList(sh.sources))
        : '<div class="d-sec"><p>' + L_('sheetMissing') + '</p></div>' + sec(L_('kCoalExit'), coalRows))
      + (top.length ? sec(L_('opps'), top.map(p => '<div class="co-row"><span><b class="d-link" data-pid="' + p.id + '">' + esc(nm(p)) + '</b><small>' + esc(catShort(p.cat)) + ' · ' + esc(statusName(p.status)) + ' ' + p.year + (p.owner ? ' · ' + esc(p.owner) : '') + '</small></span><span class="amt" style="color:#2ee6a6;font-weight:700;white-space:nowrap">' + usd(p) + '</span></div>').join('')) : '');
    openCard(html + stateExtra(a), 'state', a);
    if (!(opts && opts.noFly)) flyToState(a);
  }
  function flyToState(a) { const b = ST_BOUNDS[normState(a)]; if (b) flyToBounds(b, { padding: [30, 30] }); }
  function flyToLine(id) { const l = LINES.find(x => x.id === id); if (!l) return; const lats = l.pts.map(c => c[1]), lngs = l.pts.map(c => c[0]); flyToBounds([[Math.min.apply(null, lats), Math.min.apply(null, lngs)], [Math.max.apply(null, lats), Math.max.apply(null, lngs)]], { padding: [60, 60], maxZoom: 8 }); }

  /* ---------- 左侧筛选 UI ---------- */
  function toggleState(a) { if (state.states.has(a)) state.states.delete(a); else state.states.add(a); syncUI(); render(); if (state.states.size) { const b = ST_BOUNDS[[...state.states][0]]; if (state.states.size === 1 && b) flyToBounds(b, { padding: [30, 30] }); } else fitAU(); }
  function buildCats() {
    const el = $('cat-list'); if (!el) return;
    el.innerHTML = CAT_KEYS.map(k => { const c = CATEGORIES[k]; return '<div class="cat-chip" data-key="' + k + '" role="button" tabindex="0" aria-pressed="true"><span class="dot" style="background:' + c.color + ';color:' + c.color + '"></span><span class="nm">' + c.icon + ' ' + esc(catName(k)) + '</span><span class="ct">0</span></div>'; }).join('');
    el.querySelectorAll('.cat-chip').forEach(ch => {
      const k = ch.dataset.key;
      const go = () => { if (state.cats.has(k)) state.cats.delete(k); else state.cats.add(k); if (!state.cats.size) state.cats = new Set(CAT_KEYS); syncUI(); render(); };
      ch.addEventListener('click', go); ch.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }
  function buildStatus() {
    const el = $('status-chips'); if (!el) return;
    el.innerHTML = STATUS.map(s => '<button class="chip" data-status="' + s + '" aria-pressed="false">' + esc(statusName(s)) + '<span class="ct">0</span></button>').join('');
    el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const s = b.dataset.status; if (state.statuses.has(s)) state.statuses.delete(s); else state.statuses.add(s); syncUI(); render(); }));
  }
  function buildEpc() {
    const el = $('epc-chips'); if (!el) return;
    el.innerHTML = EPC_STATES.concat(['无数据']).map(s => '<button class="chip' + (s === '未招标' ? ' epc-open' : '') + '" data-epc="' + s + '" aria-pressed="false">' + (s === '未招标' ? '🔧 ' : '') + esc(epcName(s)) + '<span class="ct">0</span></button>').join('');
    el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const s = b.dataset.epc; if (state.epc.has(s)) state.epc.delete(s); else state.epc.add(s); syncUI(); render(); }));
    const ob = $('btn-epc-open'); if (ob) ob.addEventListener('click', () => { state.epcOnly = !state.epcOnly; syncUI(); render(); });
  }
  function buildPipeChips() {
    const se = $('pl-status-chips'), fe = $('pl-fuel-chips');
    if (se) {
      se.innerHTML = PL_STATUS.map(st => '<button class="chip pls-' + st + (state.plStatus.has(st) ? ' on' : '') + '" data-pls="' + st + '" aria-pressed="' + (state.plStatus.has(st) ? 'true' : 'false') + '"><span class="fi" style="--c:' + PL_COLOR[st] + '"></span>' + esc(plStatusName(st)) + '<span class="ct">0</span></button>').join('');
      se.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const k = b.dataset.pls; if (state.plStatus.has(k)) state.plStatus.delete(k); else state.plStatus.add(k); syncUI(); render(); }));
    }
    if (fe) {
      fe.innerHTML = FUELS.filter(f => f.key !== 'coal').map(f => '<button class="chip' + (state.plFuelOff.has(f.key) ? '' : ' on') + '" data-plf="' + f.key + '" aria-pressed="' + (state.plFuelOff.has(f.key) ? 'false' : 'true') + '"><span class="fi" style="--c:' + f.color + '"></span>' + f.icon + ' ' + esc(en() ? f.en : f.zh) + '</button>').join('');
      fe.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const k = b.dataset.plf; if (state.plFuelOff.has(k)) state.plFuelOff.delete(k); else state.plFuelOff.add(k); syncUI(); render(); }));
    }
  }
  function buildKv() {
    const el = $('kv-chips'); if (!el) return;
    el.innerHTML = KV_BANDS.concat([DC]).map(b => '<button class="chip on" data-kv="' + b.key + '" aria-pressed="true"><i style="--c:' + b.color + '"></i>' + b.label + '</button>').join('');
    el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const k = b.dataset.kv; if (state.kvOff.has(k)) state.kvOff.delete(k); else state.kvOff.add(k); syncUI(); render(); }));
  }
  function bindStatic() {
    document.querySelectorAll('#layer-chips .chip').forEach(b => b.addEventListener('click', () => { const k = b.dataset.layer; state.layers[k] = !state.layers[k]; syncUI(); render(); }));
    document.querySelectorAll('#year-presets .chip').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.preset; state.recentOnly = false; state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR;
      if (p === 'recent') state.recentOnly = true; if (p === 'future') state.minYear = Math.max(MIN_YEAR, THIS_YEAR + 1);
      syncUI(); render();
    }));
    const q = $('q'); if (q) { let t = null; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = (q.value || '').trim(); render(); }, 180); }); }
    const rs = $('btn-reset'); if (rs) rs.addEventListener('click', () => { resetState(); syncUI(); render(); fitAU(); hideCard(); });
    const hm = $('btn-home'); if (hm) hm.addEventListener('click', fitAU);
    const lg = $('btn-lang'); if (lg) lg.addEventListener('click', () => { state.lang = en() ? 'zh' : 'en'; applyLang(); });
    const sh = $('btn-share'); if (sh) sh.addEventListener('click', copyLink);
    const fl = $('fab-filters'), fd = $('fab-dash'), lp = $('left-panel'), rp = $('right-panel');
    if (fl && lp) fl.addEventListener('click', () => { const on = !lp.classList.contains('open'); lp.classList.toggle('open', on); if (rp) rp.classList.remove('open'); fl.setAttribute('aria-expanded', on ? 'true' : 'false'); });
    if (fd && rp) fd.addEventListener('click', () => { const on = !rp.classList.contains('open'); rp.classList.toggle('open', on); if (lp) lp.classList.remove('open'); fd.setAttribute('aria-expanded', on ? 'true' : 'false'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCard(); });
  }
  function resetState() {
    state.states = new Set(); state.cats = new Set(CAT_KEYS); state.statuses = new Set(); state.epc = new Set(); state.epcOnly = false;
    state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.recentOnly = false; state.q = ''; state.kvOff = new Set();
    state.layers = { grid: true, planned: true, nodes: true, coal: true, projects: true, fill: true, pipe: true, rez: true };
    state.plStatus = new Set(['committed', 'anticipated']); state.plFuelOff = new Set();
    const q = $('q'); if (q) q.value = '';
  }
  // 唯一的「state → 控件视觉」同步点（重置 / 应用 hash / 切语言后都走这里）
  function syncUI() {
    document.querySelectorAll('#state-list .state-row').forEach(r => { const on = state.states.has(r.dataset.st), dim = state.states.size && !on; r.classList.toggle('on', on); r.classList.toggle('dim', !!dim); pressed(r, on); });
    document.querySelectorAll('#cat-list .cat-chip').forEach(c => { const on = state.cats.has(c.dataset.key); c.classList.toggle('off', !on); pressed(c, on); });
    document.querySelectorAll('#status-chips .chip').forEach(c => { const on = state.statuses.has(c.dataset.status); c.classList.toggle('on', on); pressed(c, on); });
    document.querySelectorAll('#epc-chips .chip').forEach(c => { const on = state.epc.has(c.dataset.epc); c.classList.toggle('on', on); pressed(c, on); });
    const ob = $('btn-epc-open'); if (ob) { ob.classList.toggle('on', state.epcOnly); pressed(ob, state.epcOnly); }
    document.querySelectorAll('#kv-chips .chip').forEach(c => { const on = !state.kvOff.has(c.dataset.kv); c.classList.toggle('on', on); c.classList.toggle('off', !on); pressed(c, on); });
    document.querySelectorAll('#layer-chips .chip').forEach(c => { const on = !!state.layers[c.dataset.layer]; c.classList.toggle('on', on); pressed(c, on); });
    document.querySelectorAll('#pl-status-chips .chip').forEach(c => { const on = state.plStatus.has(c.dataset.pls); c.classList.toggle('on', on); pressed(c, on); });
    document.querySelectorAll('#pl-fuel-chips .chip').forEach(c => { const on = !state.plFuelOff.has(c.dataset.plf); c.classList.toggle('on', on); pressed(c, on); });
    const preset = state.recentOnly ? 'recent' : (state.minYear > MIN_YEAR ? 'future' : 'all');
    document.querySelectorAll('#year-presets .chip').forEach(c => { const on = c.dataset.preset === preset; c.classList.toggle('on', on); pressed(c, on); });
  }
  function applyLang() {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('t-title', L_('title')); set('t-sub', L_('sub')); set('lab-proj', L_('proj')); set('lab-inv', L_('inv')); set('lab-open', L_('open')); set('lab-open-inv', L_('openInv')); set('lab-coal', L_('coalKpi'));
    set('states-hint', L_('statesHint')); set('t-layers', L_('layers')); set('epc-hint', L_('epcHint')); set('btn-epc-open', L_('epcOpen')); set('t-cats', L_('cats')); set('t-status', L_('status')); set('t-year', L_('year'));
    set('btn-reset', L_('reset')); set('btn-world', L_('world')); set('t-mix', L_('mix')); set('t-lines', L_('lines')); set('fab-filters', L_('filters')); set('fab-dash', L_('dash'));
    set('lab-pipe', L_('pipeKpi')); set('pipe-hint', L_('pipeHint'));
    const tt = (id, k, keep) => { const el = $(id); if (!el) return; const c = el.querySelector('.count'); el.textContent = L_(k) + ' '; if (keep && c) el.appendChild(c); };
    tt('t-states', 'states', true); tt('t-epc', 'epc', true); tt('t-coal', 'coal', true); tt('t-opps', 'opps', true); tt('t-pipe', 'pipeT', true); tt('t-pipe-r', 'pipeR', true); tt('t-zones', 'zones', true);
    const q = $('q'); if (q) q.placeholder = L_('search');
    const lg = $('btn-lang'); if (lg) lg.textContent = en() ? '中' : 'EN';
    document.querySelectorAll('#layer-chips .chip').forEach(c => { c.textContent = L_({ grid: 'lgGrid', planned: 'lgPlanned', nodes: 'lgNodes', coal: 'lgCoal', projects: 'lgProj', fill: 'lgFill', pipe: 'lgPipe', rez: 'lgRez' }[c.dataset.layer]); });
    document.querySelectorAll('#year-presets .chip').forEach(c => { c.textContent = L_({ all: 'all', recent: 'recent', future: 'future' }[c.dataset.preset]); });
    buildCats(); buildStatus(); buildEpc(); buildPipeChips(); renderStateList(); renderLegend(); syncUI(); render();
    if (state.card) { const c = state.card; if (c.kind === 'project') showDetail(c.id, { noFly: true }); else if (c.kind === 'coal') showCoal(c.id, { noFly: true }); else if (c.kind === 'state') showState(c.id, { noFly: true }); else if (c.kind === 'line') showLine(c.id, { noFly: true }); else if (c.kind === 'pipe') showPipe(c.id, { noFly: true }); else if (c.kind === 'zone') showZone(c.id, { noFly: true }); }
  }

  /* ---------- 分享链接 / hash ---------- */
  function stateToHash() {
    const p = new URLSearchParams();
    if (state.states.size) p.set('st', [...state.states].join('~'));
    const off = CAT_KEYS.filter(k => !state.cats.has(k)); if (off.length) p.set('coff', off.join('~'));
    if (state.statuses.size) p.set('stt', [...state.statuses].join('~'));
    if (state.epc.size) p.set('epc', [...state.epc].join('~'));
    if (state.epcOnly) p.set('epcw', '1');
    if (state.minYear > MIN_YEAR || state.maxYear < MAX_YEAR) p.set('yr', state.minYear + '-' + state.maxYear);
    if (state.recentOnly) p.set('recent', '1');
    if (state.q) p.set('q', state.q);
    const loff = Object.keys(state.layers).filter(k => !state.layers[k]); if (loff.length) p.set('loff', loff.join('~'));
    if (state.kvOff.size) p.set('kvoff', [...state.kvOff].join('~'));
    const plsDef = state.plStatus.size === 2 && state.plStatus.has('committed') && state.plStatus.has('anticipated');
    if (!plsDef) p.set('pls', [...state.plStatus].join('~') || '-');
    if (state.plFuelOff.size) p.set('plf', [...state.plFuelOff].join('~'));
    if (state.lang === 'en') p.set('lang', 'en');
    if (state.card) p.set(state.card.kind, String(state.card.id));
    return p.toString();
  }
  let _hashLock = false;
  function writeHash() { if (_hashLock || !window.history || !history.replaceState) return; try { history.replaceState(null, '', location.pathname + location.search + (stateToHash() ? '#' + stateToHash() : '')); } catch (e) {} }
  function applyHash() {
    const h = (location.hash || '').replace(/^#/, ''); if (!h) return null;
    const p = new URLSearchParams(h);
    if (p.has('st')) state.states = new Set(p.get('st').split('~').filter(a => ST[a]));
    if (p.has('coff')) { const off = new Set(p.get('coff').split('~')); state.cats = new Set(CAT_KEYS.filter(k => !off.has(k))); if (!state.cats.size) state.cats = new Set(CAT_KEYS); }
    if (p.has('stt')) state.statuses = new Set(p.get('stt').split('~').filter(Boolean));
    if (p.has('epc')) state.epc = new Set(p.get('epc').split('~').filter(Boolean));
    if (p.has('epcw')) state.epcOnly = true;
    if (p.has('yr')) { const m = p.get('yr').split('-'); const lo = +m[0], hi = +m[1]; if (!isNaN(lo)) state.minYear = Math.max(MIN_YEAR, Math.min(lo, MAX_YEAR)); if (!isNaN(hi)) state.maxYear = Math.max(MIN_YEAR, Math.min(hi, MAX_YEAR)); }
    if (p.has('recent')) state.recentOnly = true;
    if (p.has('q')) { state.q = p.get('q'); const q = $('q'); if (q) q.value = state.q; }
    if (p.has('loff')) p.get('loff').split('~').forEach(k => { if (k in state.layers) state.layers[k] = false; });
    if (p.has('kvoff')) state.kvOff = new Set(p.get('kvoff').split('~').filter(Boolean));
    if (p.has('pls')) state.plStatus = new Set(p.get('pls').split('~').filter(k => PL_STATUS.indexOf(k) >= 0));
    if (p.has('plf')) state.plFuelOff = new Set(p.get('plf').split('~').filter(Boolean));
    if (p.get('lang') === 'en') state.lang = 'en';
    const card = ['project', 'coal', 'state', 'line', 'pipe', 'zone'].find(k => p.has(k));
    return card ? { kind: card, id: card === 'project' || card === 'coal' ? +p.get(card) : p.get(card) } : null;
  }
  function copyLink() {
    const url = location.href.split('#')[0] + (stateToHash() ? '#' + stateToHash() : '');
    const done = () => toast(L_('copy'));
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done); else done();
  }
  function toast(msg) {
    let t = $('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; if (t.classList) t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => { if (t.classList) t.classList.remove('show'); }, 2200);
  }

  /* ---------- 初始化 ---------- */
  buildGeo(); buildCats(); buildStatus(); buildEpc(); buildKv(); buildPipeChips(); bindStatic(); renderStateList(); renderLegend();
  _hashLock = true;
  const pendingCard = applyHash();
  _hashLock = false;
  if (state.lang === 'en') applyLang(); else { syncUI(); render(); }
  if (state.states.size === 1) flyToState([...state.states][0]);
  if (pendingCard) {
    const c = pendingCard;
    if (c.kind === 'project') showDetail(c.id); else if (c.kind === 'coal') showCoal(c.id); else if (c.kind === 'state') showState(c.id); else if (c.kind === 'line') showLine(c.id); else if (c.kind === 'pipe') showPipe(c.id); else if (c.kind === 'zone') showZone(c.id);
  }

  window.__AU__ = { state, PROJECTS, LINES, NODE, COAL, STATES, PIPE, ZONES, ZONE_STAT, render, filtered, filteredPipe, stateOf, zoneOf, countdown, showDetail, showCoal, showState, showLine, showPipe, showZone, stateToHash, applyHash, applyLang, resetState, syncUI, kpis, stateStats };
})();
