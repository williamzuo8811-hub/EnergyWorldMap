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
 *   · 🎯 BD 线索榜（管线 × 产品匹配 × 采购窗口 × 状态/EPC 评分，Top 50 + CSV）· 🏢 业主 / EPC 账户视图 · 📰 本季变化（window.AU_CHANGES）
 * 项目的所属州由坐标对州面做射线法判定（离岸项目取最近州）。
 * 纯前端零构建；调试句柄 window.__AU__；兼容 scripts/test-au.js 的最小 DOM/Leaflet 桩。
 * ============================================================ */
(function () {
  'use strict';

  const ENERGY = window.ENERGY || {};
  const META = ENERGY.META || {}, CATEGORIES = ENERGY.CATEGORIES || {}, STATUS = ENERGY.STATUS || ['规划', '在建', '投运'];
  const CAT_KEYS = Object.keys(CATEGORIES);
  const U = window.ENERGY_UTIL || {};
  const { buildProjects, LABELS_EN, capFmtMW, invMagnitude, matchProject, epcCosOf } = U;
  const PY = window.PINYIN_MAP || null;
  const GRID = window.AU_GRID || { nodes: [], lines: [] };
  const COAL = (window.AU_COAL && window.AU_COAL.plants) || [];
  const COAL_ASOF = (window.AU_COAL && window.AU_COAL.asOf) || '';
  const SHEETS = window.AU_STATES || {};
  const GEO = (window.AU_STATES_GEO && window.AU_STATES_GEO.features) || [];
  const PIPE = (window.AU_PIPELINE && window.AU_PIPELINE.items) || [];
  const PIPE_ASOF = (window.AU_PIPELINE && window.AU_PIPELINE.asOf) || '';
  const ZONES = ((window.AU_REZ && window.AU_REZ.zones) || []).filter(z => Array.isArray(z.polygon) && z.polygon.length >= 3);
  const CHANGES = window.AU_CHANGES || null;   // 📰 本季变化（scripts/import-aemo.js 生成；缺省时面板提示）
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
  // 优先读预生成的澳洲切片（js/au-projects.js，scripts/build-au-slice.js 按同口径装配，≈210 KB），省掉 ≈4 MB 全球数据链；
  // 没有切片时（scripts/test-au.js 走全量链）仍按 app.js 同口径现场装配
  const SLICE = window.AU_PROJECTS && Array.isArray(window.AU_PROJECTS.items) ? window.AU_PROJECTS.items : null;
  const ALL = SLICE || (buildProjects ? buildProjects(window.ENERGY, window.ENERGY_EXTRA, window.ENERGY_PROGRESS, { requireCoord: true }) : []);
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
  // TNSP 名称归一（与 scripts/import-aemo.js 的 normTnsp 同表）：老数据里 TransGrid / Transgrid、ElectraNet / Electranet 混用
  const TNSP_CANON = [[/^trans ?grid$/i, 'Transgrid'], [/^electra ?net$/i, 'ElectraNet'], [/^power ?link( queensland)?$/i, 'Powerlink'], [/^tas ?networks$/i, 'TasNetworks'], [/^vic ?grid$/i, 'VicGrid'], [/^western ?power$/i, 'Western Power']];
  const normTnsp = v => { const s = String(v || '').trim(); const hit = s && TNSP_CANON.find(([re]) => re.test(s)); return hit ? hit[1] : s; };
  PIPE.forEach((it, i) => {
    if (!it.id) it.id = 'pl-' + i;
    if (it.tnsp) it.tnsp = normTnsp(it.tnsp);
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
    layers: { grid: true, planned: true, nodes: true, coal: true, projects: true, fill: true, pipe: true, rez: true, changes: true },
    plStatus: new Set(['committed', 'anticipated']), plFuelOff: new Set(),   // 🧭 管线：默认只显示承诺 + 预期（拟建按需打开）
    codMax: null, playYear: null,   // 🗓️ COD 时间轴：截止年（null = 关闭）/ ▶ 播放中的当前年
    plWin: false, plHot: false, plUp: false, plMine: false,   // 🧭 快捷筛选：⏰ 采购窗口进行中 / 🔥 线索分 ≥75 / ⬆️ 本季升级为承诺 / 📋 我的线索
    kvOff: new Set(), lang: 'zh',
    basemap: null,   // 底图 key（dark | osm | amap；null = 按时区默认）
    card: null,   // {kind:'project'|'coal'|'state'|'line', id}
    plOwner: null,   // 🏢 业主筛选（归并键，见 ownerGroup）
    view: null,      // 打开的宽面板：leads | accounts | epc | changes
  };

  /* ---------- 文案 ---------- */
  const T = {
    title: ['澳洲电网与能源动态地图', 'Australia Grid & Energy Map'],
    sub: ['输电骨架 · 州与电网公司 · 燃煤退役倒计时 · EPC 窗口期 · AEMO 管线 · REZ · 🎯 BD 线索榜', 'Transmission backbone · State network companies · Coal retirement countdown · EPC window · AEMO pipeline · REZ · 🎯 BD leads'],
    proj: ['澳洲项目', 'AU projects'], inv: ['总投资', 'Investment'], open: ['🔧 EPC 未招标', '🔧 EPC pre-tender'], openInv: ['未招标投资', 'Pre-tender value'], coalKpi: ['⏳ 2035 前退役煤电', '⏳ Coal retiring by 2035'],
    states: ['州 / 领地', 'States'], statesHint: ['点州看电网公司档案', 'click a state for its grid sheet'], layers: ['图层', 'Layers'],
    epc: ['EPC / 总承包状态', 'EPC status'], epcHint: ['未招标 = BD 窗口期', 'pre-tender = BD window'], epcOpen: ['🔧 只看 EPC 未招标', '🔧 Pre-tender only'],
    cats: ['能源品类', 'Categories'], status: ['项目状态', 'Status'], year: ['年份', 'Years'], all: ['全部', 'All'], recent: ['🆕 近一年', '🆕 Latest'], future: ['未来 2027+', 'Future 2027+'],
    reset: ['↺ 重置全部筛选', '↺ Reset filters'], search: ['搜项目 / 业主 / EPC / 拼音…', 'Search project / owner / EPC…'], world: ['🗺️ 全球地图', '🗺️ World map'],
    coal: ['⏳ 燃煤退役倒计时', '⏳ Coal retirement countdown'], opps: ['🔧 EPC 未招标机会榜', '🔧 Pre-tender opportunities'], mix: ['📊 当前筛选 · 品类投资', '📊 Investment by category'], lines: ['🚧 在建 / 规划输电工程', '🚧 Transmission under construction / planned'],
    lgGrid: ['⚡ 输电骨架', '⚡ Backbone'], lgPlanned: ['🚧 在建 / 规划线路', '🚧 Building / planned'], lgNodes: ['🔘 枢纽变电站', '🔘 Hub substations'], lgCoal: ['🏭 燃煤电厂', '🏭 Coal plants'], lgProj: ['📍 能源项目', '📍 Projects'], lgFill: ['🗺️ 州界着色', '🗺️ State fill'],
    legend: ['图例', 'Legend'], existing: ['已投运', 'existing'], building: ['在建', 'building'], planned: ['规划', 'planned'], legendNote: ['走廊为示意路径（枢纽站连线），非测绘线路', 'Corridors are schematic (hub-to-hub), not surveyed routes'], legendToggle: ['折叠 / 展开图例', 'Collapse / expand legend'],
    noData: ['无数据', 'n/a'], closed: ['已关停', 'closed'], left: ['剩', ''], yr: ['年', 'y'], mo: ['个月', 'm'], tbd: ['待定', 'TBD'], due: ['到期 · 待核', 'due · verify'],
    fly: ['🎯 飞到', '🎯 Fly to'], filterSt: ['📍 只看该州项目', '📍 Filter this state'], copy: ['🔗 链接已复制', '🔗 Link copied'], close: ['✕', '✕'],
    sheetMissing: ['该州档案待补充', 'Fact sheet pending'],
    cProjects: ['项目', 'Projects'], cInv: ['投资', 'Investment'], cOpen: ['EPC 未招标', 'Pre-tender'], cCoal: ['在运煤电', 'Coal online'],
    kGrid: ['🔌 电网 / 市场', '🔌 Grid / market'], kTnsp: ['🏗️ 输电商 TNSP', '🏗️ TNSP'], kDnsp: ['🔧 配电商 DNSP', '🔧 DNSPs'], kRez: ['🌞 可再生能源区', '🌞 REZ'], kPolicy: ['📜 州政策', '📜 Policy'], kCoalExit: ['🏭 煤电退出', '🏭 Coal exit'], kProjects: ['🚧 重点电网工程', '🚧 Key grid projects'], kVendor: ['🎯 设备商必读', '🎯 Vendor notes'], kPortals: ['📮 招标 / 供应商门户', '📮 Tender portals'], kSources: ['📚 来源', '📚 Sources'],
    kOwner: ['业主', 'Owner'], kMW: ['在运装机', 'Operating MW'], kUnits: ['机组', 'Units'], kFuel: ['燃料', 'Fuel'], kClose: ['关停时间', 'Closure'], kBasis: ['口径', 'Basis'], kReplace: ['🔁 场址再利用 / 替代项目', '🔁 Site reuse / replacement'], kNotes: ['📝 备注', '📝 Notes'],
    kKv: ['电压', 'Voltage'], kStatus: ['状态', 'Status'], kLen: ['长度', 'Length'], kYear: ['投运 / 目标年', 'Year'], kCost: ['投资', 'Cost'], kRoute: ['🧭 走廊节点', '🧭 Route'],
    black: ['烟煤', 'black coal'], brown: ['褐煤', 'brown coal'],
    pCountry: ['所属州', 'State'], pStatus: ['状态', 'Status'], pCap: ['规模 / 容量', 'Capacity'], pInv: ['投资额', 'Investment'], pOwner: ['业主 / 参与方', 'Owner'], pUpd: ['最近动态', 'Updated'], pEpc: ['🔧 EPC / 总承包', '🔧 EPC'], pProg: ['📍 最新进展', '📍 Latest'],
    filters: ['🔍 筛选', '🔍 Filters'], dash: ['📊 看板', '📊 Dashboard'], drawerClose: ['✕ 收起', '✕ Close'], kpiToggle: ['📊 数据 ▾', '📊 Data ▾'],
    lgPipe: ['🧭 AEMO 管线', '🧭 AEMO pipeline'], lgRez: ['🌞 REZ 区划', '🌞 REZ zones'], lgChanges: ['📰 本季变化高亮', '📰 Highlight this quarter'],
    lgUp: ['升级为承诺', 'upgraded'], lgAdded: ['本季新增', 'added'],
    codAll: ['全部年份', 'All COD years'], codLab: ['COD ≤ {y} · 无 COD 的 {n} 条已隐藏', 'COD ≤ {y} · {n} without COD hidden'], codPlay: ['▶ 逐年播放 COD 时间轴', '▶ Play COD timeline'], codPause: ['⏸ 暂停', '⏸ Pause'], codTick: ['预期投运累计至', 'pipeline online by'],
    codTitle: ['按预期投运年份累计显示管线：拖动看到某年为止投运 / 在建的容量（KPI 与右栏同步），拉到最右恢复全部；▶ 从今年起逐年播放', 'Cumulative pipeline by expected COD: drag to see capacity online by a year (KPIs follow), far right = all; ▶ plays year by year'],
    stPoster: ['📸 海报 PNG', '📸 Poster PNG'], posterOk: ['📸 已导出州海报 (PNG)，可直接发微信', '📸 State poster exported (PNG)'], posterSvg: ['已导出海报 (SVG)', 'Poster exported (SVG)'],
    pipeKpi: ['🧭 承诺+预期管线', '🧭 Committed + anticipated'], pipeT: ['🧭 AEMO 管线', '🧭 AEMO pipeline'], pipeHint: ['承诺 / 预期 / 拟建', 'committed / anticipated / proposed'],
    pipeR: ['🧭 AEMO 管线 · 当前筛选', '🧭 Pipeline · current filter'], zones: ['🌞 可再生能源区 REZ', '🌞 Renewable Energy Zones'],
    pMw: ['装机', 'Capacity'], pMwh: ['储能', 'Storage'], pCod: ['预期投运 COD', 'Expected COD'], pFuel: ['类型', 'Type'], pConn: ['接入点', 'Connection'], pRez: ['所在 REZ', 'REZ'], pAemo: ['AEMO 状态', 'AEMO status'], pApprox: ['⚠ 示意位置（按所在地 / 邮编 / 接入站 / 州质心放置），待补精确坐标', '⚠ Approximate location (locality / postcode / connection node / state centroid)'], pMix: ['构成', 'Mix'], pSiteMw: ['接入上限', 'site cap'], pTnsp: ['TNSP', 'TNSP'],
    zBody: ['规划 / 交付主体', 'Body'], zTarget: ['目标 / 承载容量', 'Target / hosting'], zTimeline: ['🗓️ 时间线', '🗓️ Timeline'], zTx: ['⚡ 配套输电', '⚡ Transmission'], zAccess: ['🎟️ 接入机制', '🎟️ Access scheme'], zPipe: ['🧭 区内管线', '🧭 Pipeline in zone'], zProj: ['📍 区内项目', '📍 Projects in zone'], zApprox: ['边界为示意范围（按公开区划图 / 地名描述勾画）', 'Boundary is approximate (traced from published maps / locality lists)'],
    inZone: ['区内', 'in zone'], total: ['合计', 'total'], proj: ['项目', 'projects'],
    leads: ['🎯 本季度线索 Top 10', '🎯 Top 10 leads this quarter'], leadsT: ['🎯 BD 线索榜 · 本季度 Top 50', '🎯 BD leads · Top 50 this quarter'], leadsBtn: ['🎯 线索榜', '🎯 Leads'],
    leadsMore: ['查看 Top 50 / 导出 CSV ▸', 'Top 50 / export CSV ▸'], leadsHint: ['线索分 = 产品匹配 × 采购窗口 × 状态/EPC（0–100），范围跟随当前筛选', 'score = product fit × procurement window × status/EPC (0–100), scope = current filter'],
    leadsCsv: ['⤓ 导出 CSV（分单）', '⤓ Export CSV'], lScore: ['线索分', 'Score'], lProduct: ['产品匹配', 'Product fit'], lWindow: ['采购窗口', 'Procurement window'], lEpc: ['EPC', 'EPC'], lCoach: ['🎓 陪练', '🎓 Coach'], lCard: ['📍 详情', '📍 Card'],
    leadsNote: ['评分：产品匹配 ≤40（储能 → 储能升压一体化舱 / E-house；风光 → 预制舱变电站 + 集电线路开关设备；燃气调峰 → 中压开关柜；规模加成；示意坐标 −2）+ 采购窗口 ≤35（距 COD 12–30 个月最高 ≈ 设备定标期；窗口 = COD 前 24→9 个月）+ 状态/EPC ≤30（承诺：未招标 30 / 未公开 27 / 无数据 24 / 已授标 16 → 分包机会；预期：23 / 21 / 18 / 12；拟建 6；本季升级为承诺 +4）。「未公开」= 已核实尚未授标，「无数据」= 尚未查证；EPC 状态来自主项目库字段或备注文本推断，请以实地核实为准。', 'Score: product fit ≤40 (BESS → step-up skid / E-house; solar & wind → prefab substation + collector switchgear; gas peakers → MV switchgear; size bonus; approximate site −2) + procurement window ≤35 (12–30 months before COD scores highest; window = COD −24 → −9 months) + status/EPC ≤30 (committed: pre-tender 30 / undisclosed 27 / no data 24 / awarded 16 = subcontract chance; anticipated 23 / 21 / 18 / 12; proposed 6; upgraded to committed this quarter +4). "Undisclosed" = verified not yet awarded, "no data" = not yet researched; EPC status is inferred from the project library or notes — verify on the ground.'],
    accBtn: ['🏢 账户', '🏢 Accounts'], accT: ['🏢 业主 / EPC 账户视图', '🏢 Owner / EPC account view'], accHint: ['按业主归并全部管线（承诺 / 预期 / 拟建），看每家在各州有几个项目、各在什么阶段；EPC 页列出澳洲主流总承包商及其承接项目', 'Pipeline grouped by owner (all statuses): projects per state and stage; the EPC tab lists mainstream contractors and their projects'],
    accOwner: ['业主作战地图', 'Owner map'], accEpc: ['EPC / 总承包商', 'EPC contractors'],
    accNote: ['业主按别名表 + 法人后缀归一（Pty Ltd / Australia / Holdings …），SPV 项目公司可能单列；点「地图筛选」把管线与项目筛到该业主并飞到其项目分布。', 'Owners merged by alias table + legal-suffix stripping; SPVs may stay separate. "Map" filters the pipeline to that owner and flies to its footprint.'],
    epcNote: ['识别表 util.EPC_COS（与全球地图 🔧 EPC 榜共用）：主项目库的 epc 字段 + 管线备注里的自由文本；风机 / 电池集成商（Vestas / Tesla / Fluence…）在澳洲常兼 EPC，故计入；🔧 = 该项目 EPC 未招标。', 'Recognition table util.EPC_COS (shared with the world map EPC league): structured epc field + free-text pipeline notes; turbine / battery integrators often act as EPC in Australia and are counted; 🔧 = pre-tender.'],
    chBtn: ['📰 本季变化', '📰 This quarter'], chT: ['📰 本季变化 · AEMO 管线季度差异', '📰 Quarterly pipeline changes'], chT2: ['📰 本季变化', '📰 This quarter'],
    chAdded: ['新增', 'Added'], chUp: ['升级为承诺', 'Upgraded to committed'], chStatus: ['状态变化', 'Status moves'], chMw: ['容量变化', 'Capacity changes'], chGone: ['不再出现', 'Gone'], chCoord: ['需补坐标', 'Need coordinates'],
    chBrief: ['⤓ 导出简报 (.md)', '⤓ Export brief (.md)'], chCopy: ['📋 复制简报', '📋 Copy brief'], chMore: ['查看明细 / 导出简报 ▸', 'Details / export brief ▸'],
    chNone: ['尚无季度变化数据：运行 node scripts/import-aemo.js <新季度 AEMO 表> 会生成 js/au-changes.js', 'No quarterly change data yet: run node scripts/import-aemo.js <new AEMO workbook> to generate js/au-changes.js'],
    chNote: ['每季度换一份 AEMO Generation Information 表并运行 scripts/import-aemo.js，即自动生成这四类清单（js/au-changes.js）与一页中文简报（data-src/aemo/brief-<asOf>.md）；点行可打开管线卡片（「不再出现」的条目已不在管线里）。', 'Each quarter, drop in the new AEMO Generation Information workbook and run scripts/import-aemo.js: these four lists (js/au-changes.js) and a one-page brief (data-src/aemo/brief-<asOf>.md) regenerate automatically; click a row to open its card ("gone" rows are no longer in the pipeline).'],
    ownerPill: ['🏢 业主', '🏢 Owner'],
    stBrief: ['⤓ 州机会简报', '⤓ State brief'],
    closeA: ['关闭', 'Close'], shareA: ['复制链接', 'Copy link'], more: ['展开其余 {n} 条 ▾', 'Show {n} more ▾'], less: ['收起 ▴', 'Show less ▴'],
    quickWin: ['⏰ 采购窗口进行中', '⏰ Window open now'], quickHot: ['🔥 线索分 ≥75', '🔥 Score ≥75'], quickUp: ['⬆️ 本季升级为承诺', '⬆️ Upgraded this quarter'],
    quickHint: ['本月落在 COD 前 24→9 个月之间 = 设备定标期', 'this month falls 24→9 months before COD = equipment award period'],
    upTag: ['⬆️ 本季升级为承诺', '⬆️ Upgraded to committed this quarter'],
    track: ['跟进', 'Follow-up'], trackNone: ['尚未记录 · 填好保存即存在本机浏览器', 'Not tracked yet · saved in this browser'], trackLocal: ['仅存本机浏览器，可在线索榜 ⤓ 备份 / ⤒ 恢复', 'Stored in this browser only; back up / restore from the leads board'],
    trackSave: ['💾 保存跟进', '💾 Save'], trackDel: ['🗑 删除记录', '🗑 Delete'], trackWho: ['负责人', 'Owner'], trackNext: ['下次动作日期', 'Next action date'], trackNote: ['备注：联系人 / 需求 / 下一步', 'Notes: contact / needs / next step'],
    trackSaved: ['📋 跟进已保存（本机）', '📋 Follow-up saved (local)'], trackDeleted: ['已删除跟进记录', 'Follow-up deleted'], unassigned: ['— 跟进状态', '— status'],
    quickMine: ['📋 我的线索', '📋 My leads'], trackSum: ['📋 跟进中 {n} · ⏰ 7 天内到期 {d}', '📋 Tracking {n} · ⏰ due within 7 days {d}'],
    trkExp: ['⤓ 备份跟进 (JSON)', '⤓ Back up follow-ups'], trkImp: ['⤒ 恢复跟进', '⤒ Restore'], trkImpOk: ['已合并 {n} 条跟进记录', 'Merged {n} follow-ups'], trkImpBad: ['文件不是有效的跟进备份', 'Not a valid follow-up backup'], trkImpAsk: ['合并 {n} 条跟进记录到本机？（同一项目以较新记录为准）', 'Merge {n} follow-ups into this browser? (newer record wins per project)'],
    fresh: ['数据截至', 'Data as of'], freshStale: ['已 {n} 个月未更新，AEMO 每季度发布新表，请运行 scripts/import-aemo.js', '{n} months old — AEMO publishes quarterly; run scripts/import-aemo.js'],
    basemap: ['底图', 'Base map'], tileFail: ['底图瓦片加载失败：可在「图层 → 底图」切换 OSM / 高德', 'Base-map tiles failed to load — switch the base map under Layers'],
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
  // zoomSnap 0.5：fitBounds 可落在 3.5 这类半级，手机竖屏 / iPad 上整个大陆铺满地图区（整级 3 时只占 1/3 宽）
  const map = L.map('map', { center: [-27, 134], zoom: 4, minZoom: 3, maxZoom: 17, zoomSnap: 0.5, zoomControl: false, attributionControl: true });
  L.control.zoom({ position: 'topleft' }).addTo(map);   // 左下角留给图例
  if (map.attributionControl && map.attributionControl.setPrefix) map.attributionControl.setPrefix('');
  /* ---------- 底图：暗色 Esri（海外默认）/ OSM / 高德（国内默认；澳洲在 GCJ-02 偏移区之外，无需纠偏）----------
   * 与 app.js 同一套来源与时区判断：Esri / OSM 在大陆加载慢甚至打不开，按【时区】识别大陆访客默认高德；任何人都可在「图层 → 底图」切换。 */
  const esriBase = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { subdomains: ['server', 'services'], maxZoom: 16, attribution: '© Esri · 州界 Natural Earth · 走廊示意' });
  const esriRef = L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    { subdomains: ['server', 'services'], maxZoom: 16 });
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap · 州界 Natural Earth · 走廊示意' });
  const amap = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    { subdomains: ['1', '2', '3', '4'], maxZoom: 18, attribution: '© 高德地图 AutoNavi · 州界 Natural Earth · 走廊示意' });
  const BASES = [
    { key: 'dark', zh: '🌑 暗色', en: '🌑 Dark', layer: L.layerGroup([esriBase, esriRef]), tile: esriBase },
    { key: 'osm', zh: '🗺️ OSM', en: '🗺️ OSM', layer: osm, tile: osm },
    { key: 'amap', zh: '🇨🇳 高德', en: '🇨🇳 AMap', layer: amap, tile: amap },
  ];
  function inChina() { try { const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || ''); return /^(Asia\/(Shanghai|Chongqing|Chungking|Urumqi|Harbin)|PRC)$/i.test(tz); } catch (e) { return false; } }
  const BASE_DEFAULT = inChina() ? 'amap' : 'dark';
  const baseOf = k => BASES.find(b => b.key === k) || BASES[0];
  let activeBase = null;
  function applyBase(key) {
    const nb = baseOf(key);
    if (activeBase && activeBase.key === nb.key) return;
    if (activeBase) map.removeLayer(activeBase.layer);
    nb.layer.addTo(map); activeBase = nb; state.basemap = nb.key;
    document.querySelectorAll('#bm-chips .chip').forEach(c => { const on = c.dataset.bm === nb.key; c.classList.toggle('on', on); pressed(c, on); });
  }
  const toLatLng = c => [c[1], c[0]];
  // 开卡后飞行：目标放到卡片没盖住的那半边（桌面 / 横屏手机的右侧卡 → 目标偏左；手机竖屏的底部半屏卡 → 目标偏上）。
  // 1366 笔记本上 713px 宽的地图区被 380px 卡片盖掉一半、手机上卡片占 62dvh：居中飞到的点正好落在卡片底下。
  // 返回卡片盖住的像素宽 / 高（x 或 y 之一）；露出的部分太窄（<220 / <160px）就不偏移。show*() 都是先 openCard 再飞，所以量得到。
  function cardPad() {
    const c = $('card'), m = $('map');
    if (!c || !m || !c.classList || !c.classList.contains('show') || typeof c.getBoundingClientRect !== 'function') return null;
    const cr = c.getBoundingClientRect(), mr = m.getBoundingClientRect();
    if (!cr.width || !mr.width) return null;
    if (cr.width >= mr.width - 40 && cr.top > mr.top + 40) { const h = Math.round(mr.bottom - cr.top); return h > 40 && mr.height - h >= 160 ? { x: 0, y: h } : null; }   // 底部半屏
    if (cr.left > mr.left + mr.width * 0.35) { const w = Math.round(mr.right - cr.left); return w > 40 && mr.width - w >= 220 ? { x: w, y: 0 } : null; }   // 右侧卡
    return null;
  }
  function flyToBounds(b, opts) {
    const pad = cardPad(); opts = Object.assign({}, opts);
    if (pad) { const p = opts.padding || [0, 0], br = opts.paddingBottomRight || p; opts.paddingTopLeft = opts.paddingTopLeft || p; opts.paddingBottomRight = [br[0] + pad.x, br[1] + pad.y]; }
    if (REDUCED_MOTION) map.fitBounds(b, Object.assign(opts, { animate: false })); else map.flyToBounds(b, opts);
  }
  function flyTo(ll, z) {
    const pad = cardPad();
    if (pad && map.project && map.unproject) { try { const zz = z == null ? map.getZoom() : z; ll = map.unproject(map.project(ll, zz).add([pad.x / 2, pad.y / 2]), zz); } catch (e) { /* stub */ } }
    if (REDUCED_MOTION) map.setView(ll, z, { animate: false }); else map.flyTo(ll, z, { duration: 1.1 });
  }
  const fitAU = () => map.fitBounds(AU_BOUNDS, { padding: [10, 10], animate: false });
  fitAU();

  // 首屏 loader：瓦片到位或超时即淡出；若 12 秒内一张瓦片都没到而错误不断（海外瓦片被墙 / 断网），提示切底图
  const loader = $('au-loader');
  const hideLoader = () => { if (loader && loader.classList) loader.classList.add('hidden'); };
  let _tileOk = 0, _tileErr = 0;
  BASES.forEach(b => { b.tile.on('load', hideLoader); b.tile.on('tileload', () => { _tileOk++; }); b.tile.on('tileerror', () => { _tileErr++; }); });
  setTimeout(hideLoader, 2800);
  setTimeout(() => { if (!_tileOk && _tileErr >= 4) toast(L_('tileFail')); }, 12000);

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
    // 不设 disableClusteringAtZoom：41% 的管线与别的条目坐标完全相同（按所在地 / 接入站放置，最大一叠 17 条），
    // 保持聚合到最大层级，点同点聚合会直接 spiderfy 展开，否则放大后只有最上面一颗菱形能点
    maxClusterRadius: 34, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
    iconCreateFunction: function (c) {
      const ms = c.getAllChildMarkers ? c.getAllChildMarkers() : [];
      let mw = 0, up = 0, added = 0, yr = 0; const cnt = {};
      ms.forEach(m => { mw += m._mw || 0; cnt[m._fuel] = (cnt[m._fuel] || 0) + (m._mw || 0); if (m._up) up++; if (m._added) added++; if (m._yr) yr++; });
      const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      const col = fuelOf(top).color, n = c.getChildCount ? c.getChildCount() : ms.length, d = n < 10 ? 28 : n < 50 ? 34 : 40;
      // 聚合气泡也带本季变化 / 播放年高亮（全国视角下单个菱形都在聚合里，否则高亮看不见）
      const hl = (yr ? ' yr' : up ? ' up' : added ? ' added' : '');
      return L.divIcon({ className: 'mk-cluster', iconSize: [d, d], html: '<div class="mkc pl' + hl + '" style="--c:' + col + ';width:' + d + 'px;height:' + d + 'px" title="' + Math.round(mw) + ' MW' + (up ? ' · ' + up + ' ' + L_('lgUp') : '') + (added ? ' · ' + added + ' ' + L_('lgAdded') : '') + '"><b>' + n + '</b></div>' });
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
    if (!memo('grid', [state.layers.grid, state.layers.planned, state.layers.nodes, [...state.kvOff].sort().join('~'), stSig(), state.lang].join('|'))) return;
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

  /* ---------- 渲染记忆：每个图层记住上次的输入签名，输入没变就不重画（搜索框每个按键只重画项目 / 管线标记）---------- */
  const _sig = {};
  const memo = (key, sig) => { if (_sig[key] === sig) return false; _sig[key] = sig; return true; };
  const stSig = () => [...state.states].sort().join('~');
  const zoomNow = () => (map.getZoom ? map.getZoom() : 4);
  // 燃煤标记按缩放分档：全国视角 20px、州视角 24px、放大后 30px；已关停电厂只在 zoom ≥ 6 显示（低层级只添噪音）
  const coalBand = () => { const z = zoomNow(); return z <= 4 ? 'a' : z <= 5 ? 'b' : 'c'; };

  /* ---------- 燃煤电厂 ---------- */
  function renderCoal() {
    const band = coalBand();
    if (!memo('coal', [state.layers.coal, stSig(), state.lang, band].join('|'))) return;
    coalLayer.clearLayers();
    if (!state.layers.coal) return;
    const d = band === 'a' ? 20 : band === 'b' ? 24 : 30, small = band !== 'c';
    COAL.forEach((p, i) => {
      if (state.states.size && !state.states.has(p.state)) return;
      if (p.status === 'closed' && small) return;
      const cd = countdown(p), col = coalColor(p);
      const icon = L.divIcon({ className: 'coal-mk', iconSize: [d, d], iconAnchor: [d / 2, d / 2], html: '<i class="cm' + (p.status === 'closed' ? ' closed' : '') + (small ? ' sm' : '') + '" style="--c:' + col + '">🏭<span>' + (p.status === 'closed' ? (p.closedYear || '') : (p.closeYear || '?')) + '</span></i>' });
      const m = L.marker(toLatLng(p.coord), { icon, zIndexOffset: 500 });
      m.bindTooltip('<b>' + esc(en() ? p.en : p.name) + '</b><br>' + esc(p.owner || '') + ' · ' + (p.mw ? fmtNum(p.mw) + ' MW' : '') + '<br><span style="color:' + col + '">' + esc(cd.txt) + '</span>' + (p.closeText && p.status !== 'closed' ? ' · ' + esc(p.closeText) : ''), { direction: 'top', offset: [0, -14], className: 'au-tip' });
      m.on('click', () => showCoal(i, { noFly: true }));
      m.addTo(coalLayer);
    });
  }

  /* ---------- 🌞 REZ 面 ---------- */
  const zoneVisible = z => state.layers.rez && (state.states.size === 0 || state.states.has(normState(z.state)));
  // 地图上的 REZ 标签：去掉括号别名，超过 22 字在词边界截断加 …（原来硬切 18 字，"Pilbara" 会断成 "Pilbar"）
  const zoneLabel = z => { const t = (z.ispId ? z.ispId + ' · ' : '') + (en() ? (z.en || z.name) : z.name).replace(/\s*[（(].*?[)）]\s*/g, '').trim(); if (t.length <= 22) return t; const cut = t.slice(0, 22), sp = cut.lastIndexOf(' '); return (sp > 10 && /[A-Za-z0-9]/.test(cut) ? cut.slice(0, sp) : cut).replace(/[\s·/–-]+$/, '') + '…'; };
  function renderRez() {
    const zoom = zoomNow();
    if (!memo('rez', [state.layers.rez, stSig(), state.lang, zoom >= 5 ? 1 : 0].join('|'))) return;
    rezLayer.clearLayers();
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
  map.on('zoomend', () => { renderRez(); renderCoal(); });   // 两者都带签名记忆：只在标签 / 尺寸档位真变时重画

  /* ---------- 🧭 管线筛选 / 标记 ---------- */
  const plHay = it => (it._hay || (it._hay = [it.en, it.name, it.owner, it.locality, it.connNode, it.tnsp, it.kci, it.rez, it.tech].join(' ').toLowerCase()));
  // 管线搜索与项目搜索同口径（util.matchProject：多词 AND + 拼音全拼 / 首字母）：把管线字段映射成 matchProject 认得的 name/en/country/owner
  const plProxy = it => (it._sp || (it._sp = { name: it.name, en: it.en, owner: it.owner,
    // country 槽位塞进「州中英文名 + 燃料中英文名 + 所在地 / 接入站 / TNSP / KCI / REZ / 技术」，拼音索引也从这里取（搜「xinzhou chuneng」能命中新州储能）
    country: [ST[it.state] ? ST[it.state].name + ' ' + ST[it.state].short + ' ' + ST[it.state].en : it.state, fuelOf(it.fuel).zh, fuelOf(it.fuel).en, it.locality, it.connNode, it.tnsp, it.kci, it.rez, it.tech].filter(Boolean).join(' ') }));
  const plMatch = it => matchProject ? matchProject(plProxy(it), state.q, PY) : plHay(it).indexOf(state.q.toLowerCase()) >= 0;
  // 基础筛选（状态 / 燃料 / 业主 / 州 / 年份 / 搜索）；快捷筛选（⏰ 窗口期 / 🔥 高分 / ⬆️ 本季升级）单列，便于给快捷芯片算「还剩几条」
  function passPipeBase(it) {
    return state.plStatus.has(it.status)
      && !state.plFuelOff.has(it.fuel)
      && (!state.plOwner || ownerKeyOf(it) === state.plOwner)
      && (state.states.size === 0 || state.states.has(it.state))
      // 年份滑块两端为开区间：手柄在最左 / 最右时视为「及更早 / 及以后」，COD 在项目库年份范围之外的管线不会被「全部」误滤掉
      && (!it.codYear || ((it.codYear >= state.minYear || state.minYear <= MIN_YEAR) && (it.codYear <= state.maxYear || state.maxYear >= MAX_YEAR)))
      // COD 时间轴打开时：只显示预期投运年 ≤ 截止年的管线（无 COD 的暂隐藏，标签里提示条数）
      && (!state.codMax || (it.codYear && it.codYear <= state.codMax))
      && (!state.q || plMatch(it));
  }
  // 🗓️ COD 时间轴：按预期投运年份累计显示管线（codMax = 截止年；null = 关闭）；范围 = 今年 → 数据最晚年（最多 +10）
  const codYears = PIPE.map(i => i.codYear).filter(y => y && y >= 2000);
  const COD_MIN = Math.max(THIS_YEAR, codYears.length ? Math.min.apply(null, codYears) : THIS_YEAR);
  const COD_MAX = Math.max(COD_MIN + 1, Math.min(THIS_YEAR + 10, codYears.length ? Math.max.apply(null, codYears) : THIS_YEAR + 9));
  // 📰 本季新增的管线 id（来自 js/au-changes.js）——地图高亮虚线框
  const ADDED = new Set(((CHANGES && CHANGES.added) || []).map(x => x.id));
  const PL_QUICK = [
    { key: 'win', st: 'plWin', t: 'quickWin', fn: it => windowOpen(it) },   // 惰性引用：windowOpen 在下文评分段定义
    { key: 'hot', st: 'plHot', t: 'quickHot', fn: it => leadScore(it).score >= 75 },
    { key: 'up', st: 'plUp', t: 'quickUp', fn: it => UPGRADED.has(it.id) },
    { key: 'mine', st: 'plMine', t: 'quickMine', fn: it => trackActive(it.id) },   // 📋 有本机跟进记录（不跟进除外）
  ];
  const passQuick = it => PL_QUICK.every(q => !state[q.st] || q.fn(it));
  const passPipe = it => passPipeBase(it) && passQuick(it);
  const filteredPipe = () => state.layers.pipe ? PIPE.filter(passPipe) : [];
  const plSize = mw => Math.max(8, Math.min(22, 6 + Math.sqrt(Math.max(mw || 0, 1)) * 0.5));
  const mwFmt = it => (it.mw ? fmtNum(it.mw) + ' MW' : '') + (it.mwh ? ' / ' + fmtNum(it.mwh) + ' MWh' : '');
  function renderPipe(items) {
    plCluster.clearLayers();
    if (!state.layers.pipe) return;
    const ms = [];
    items.forEach(it => {
      const f = fuelOf(it.fuel), d = Math.round(plSize(it.mw));
      // 📰 本季变化高亮：升级为承诺 = 绿色脉冲框，新增 = 青色虚线框；▶ 播放时当年投运的闪白框
      const hl = (state.layers.changes ? (UPGRADED.has(it.id) ? ' is-up' : ADDED.has(it.id) ? ' is-added' : '') : '') + (state.playYear && it.codYear === state.playYear ? ' is-year' : '');
      const m = L.marker(toLatLng(it.coord), { icon: L.divIcon({ className: 'pl-mk', iconSize: [d, d], iconAnchor: [d / 2, d / 2], html: '<i class="' + it.status + (it.approx ? ' approx' : '') + hl + '" style="--c:' + f.color + '"></i>' }), riseOnHover: true, zIndexOffset: hl ? 200 : 0 });
      m._mw = it.mw || 0; m._fuel = it.fuel;
      m._up = state.layers.changes && UPGRADED.has(it.id); m._added = state.layers.changes && ADDED.has(it.id); m._yr = !!(state.playYear && it.codYear === state.playYear);
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
    if (!memo('zoneList', [stSig(), state.lang].join('|'))) return;
    const zs = ZONES_SORTED.filter(z => state.states.size === 0 || state.states.has(normState(z.state)));
    if (sum) sum.textContent = fmtNum(zs.filter(z => z.status === 'declared').length) + ' ' + zoneStatusName('declared') + ' · ' + fmtNum(zs.length) + (en() ? ' total' : ' 个');
    el.innerHTML = zs.map(z => { const st = ZONE_STAT[z.key] || {}; const near = (st.committed || 0) + (st.anticipated || 0); return '<div class="row" data-zone="' + esc(z.key) + '" role="button" tabindex="0"><div class="nm"><span style="color:' + ZONE_COLOR[z.status] + '">■</span> ' + (z.ispId ? '<small style="color:#7b8ca6">' + esc(z.ispId) + '</small> ' : '') + esc(en() ? (z.en || z.name) : z.name) + '</div><div class="cd ' + z.status + '">' + esc(zoneStatusName(z.status)) + '</div><div class="meta">' + esc(stShort(normState(z.state))) + ' · ' + esc(z.body || '') + (z.targetGw ? ' · ' + z.targetGw + ' GW' : '') + ' · ' + L_('zPipe') + ' ' + gw(near) + (st.proposed ? ' (+' + gw(st.proposed) + ' ' + plStatusName('proposed') + ')' : '') + '</div></div>'; }).join('') || '<div class="empty">' + L_('noData') + '</div>';
    el.querySelectorAll('.row').forEach(r => { r.addEventListener('click', () => showZone(r.dataset.zone)); r.addEventListener('keydown', e => { if (e.key === 'Enter') showZone(r.dataset.zone); }); });
  }

  /* ---------- 🎯 BD 线索评分（管线 → 本季度该去谈谁）----------
   * 三项相加（0–100）：产品匹配（燃料类型 → 特锐德产品 + 规模加成）· 采购窗口（距 COD 12–30 个月 = 设备定标期）· 状态 / EPC
   * （承诺且 EPC 未招标 / 未公开最高；已授标转为分包机会；拟建最低）。EPC 状态：链接到主项目库的用结构化字段，否则从备注推断。 */
  const PRODUCT_FIT = {
    battery: { zh: '储能升压一体化舱 / E-house', en: 'BESS step-up skid / E-house', pts: 32 },
    solar: { zh: '预制舱变电站 + 集电线路开关设备', en: 'Prefab substation + collector switchgear', pts: 28 },
    wind: { zh: '预制舱变电站 + 集电线路开关设备', en: 'Prefab substation + collector switchgear', pts: 28 },
    offshore_wind: { zh: '海上升压站预制模块 / 中压开关设备', en: 'Offshore substation modules / MV switchgear', pts: 20 },
    gas: { zh: '中压开关柜 / 预制舱变电站', en: 'MV switchgear / prefab substation', pts: 24 },
    hydrogen: { zh: 'E-house / 中压配电成套', en: 'E-house / MV distribution', pts: 18 },
    pumped_hydro: { zh: '高压开关设备（机会有限）', en: 'HV switchgear (limited)', pts: 12 },
    hydro: { zh: '高压开关设备（机会有限）', en: 'HV switchgear (limited)', pts: 10 },
    coal: { zh: '—', en: '—', pts: 2 },
    other: { zh: '按项目判断', en: 'Case by case', pts: 8 },
  };
  const EPC_KNOWN = ['未招标', '已授标', '未公开'];
  function epcHintOf(it) {
    if (it._epcHint) return it._epcHint;
    let h = '无数据';
    const pj = it.projId ? PROJ_BY_ID[it.projId] : null;
    if (pj && pj.epcStatus && EPC_KNOWN.indexOf(pj.epcStatus) >= 0) h = pj.epcStatus;
    else if (it.notes) {
      const t = String(it.notes);
      if (/(EPC|BoP|总承包|承包商|承建)[^。；;]{0,24}?(待核|未公开|未定|待定|待公布|尚未|未招标|未宣布|不详)/.test(t) || /(尚未|未)(公布|确定|授予|定标)[^。；;]{0,10}(EPC|总承包|承包商)/.test(t)) h = '未公开';
      else if (/(EPC|BoP|总承包|承建|施工总包)[^。；;]{0,16}?(为|由|：|:|是)\s*[A-Za-z一-鿿]/.test(t) || /(授予|签约|下达|中标|授标|拿下)[^。；;]{0,20}(EPC|BoP|总承包|开工令|开工通知|整机|合同)/.test(t) || (epcCosOf && epcCosOf(t).length)) h = '已授标';
    }
    return (it._epcHint = h);
  }
  const codParts = it => { const m = String(it.cod || '').match(/^(\d{4})(?:-(\d{2}))?$/); return m ? { y: +m[1], m: m[2] ? +m[2] : 12 } : null; };
  const ymAdd = (y, m, d) => { const t = y * 12 + (m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };
  const ymFmt = o => o.y + '-' + String(o.m).padStart(2, '0');
  // 设备采购窗口 ≈ COD 前 24 → 9 个月
  const procWindow = it => { const c = codParts(it); return c ? { from: ymAdd(c.y, c.m, -24), to: ymAdd(c.y, c.m, -9), cod: c } : null; };
  // 采购窗口此刻是否打开（本月落在 COD 前 24→9 个月之间）—— 「⏰ 采购窗口进行中」快捷筛选
  const ymNow = () => NOW.getFullYear() * 12 + NOW.getMonth() + 1;
  const windowOpen = it => { const w = procWindow(it); if (!w) return false; const n = ymNow(); return n >= w.from.y * 12 + w.from.m && n <= w.to.y * 12 + w.to.m; };
  // 本季升级为承诺（FID / 开工）的管线 id —— 来自 js/au-changes.js；评分 +4、「⬆️ 本季升级为承诺」快捷筛选、卡片标签
  const UPGRADED = new Set(((CHANGES && CHANGES.status) || []).filter(x => x.to === 'committed').map(x => x.id));
  function windowScore(it) {
    const c = codParts(it); if (!c) return { pts: 12, why: 'COD 未知' };
    const mt = (c.y - NOW.getFullYear()) * 12 + (c.m - 1 - NOW.getMonth());
    if (mt <= 6) return { pts: 4, why: '≤6 个月投运，设备已采购' };
    if (mt <= 15) return { pts: 24, why: '9–15 个月投运，采购收尾' };
    if (mt <= 30) return { pts: 35, why: '距 COD 12–30 个月，定标期' };
    if (mt <= 42) return { pts: 28, why: '窗口将开（2.5–3.5 年）' };
    if (mt <= 60) return { pts: 16, why: '3.5–5 年，早期布局' };
    return { pts: 8, why: '>5 年' };
  }
  // 状态 / EPC 分：区分「未公开」（已核实、尚未授标 = 真窗口）与「无数据」（没查过）；本季升级为承诺 +4（FID 信号），上限 30
  function statusScore(it) {
    const e = epcHintOf(it);
    let r;
    if (it.status === 'committed') r = e === '已授标' ? { pts: 16, why: '承诺 · EPC 已授标 → 分包机会' } : e === '未招标' ? { pts: 30, why: '承诺 · EPC 未招标' } : e === '未公开' ? { pts: 27, why: '承诺 · EPC 未公开（已核、未授标）' } : { pts: 24, why: '承诺 · EPC 无数据（待核）' };
    else if (it.status === 'anticipated') r = e === '已授标' ? { pts: 12, why: '预期 · EPC 已授标' } : e === '未招标' ? { pts: 23, why: '预期 · EPC 未招标' } : e === '未公开' ? { pts: 21, why: '预期 · EPC 未公开' } : { pts: 18, why: '预期 · EPC 无数据（待核）' };
    else if (it.status === 'existing') r = { pts: 0, why: '已投运' };
    else r = { pts: 6, why: '拟建' };
    if (it.id && UPGRADED.has(it.id) && r.pts < 30) r = { pts: Math.min(30, r.pts + 4), why: r.why + ' · 本季升级为承诺 +4' };
    return r;
  }
  function leadScore(it) {
    if (it._lead) return it._lead;
    const f = PRODUCT_FIT[it.fuel] || PRODUCT_FIT.other;
    const size = Math.max(0, Math.min(8, Math.round((Math.log10(Math.max(it.mw || 10, 10)) - 1) * 4)));
    // 示意坐标 −2：同分时让场址已核实的项目排前面（坐标按所在地 / 接入站放置的，拜访前还得先找场址）
    const prod = Math.max(0, Math.min(40, f.pts + size + (it.mix ? 2 : 0) - (it.approx ? 2 : 0)));
    const w = windowScore(it), st = statusScore(it);
    return (it._lead = { score: Math.min(100, prod + w.pts + st.pts), prod, win: w.pts, st: st.pts, winWhy: w.why, stWhy: st.why, product: f, epc: epcHintOf(it), window: procWindow(it), winOpen: windowOpen(it), up: !!(it.id && UPGRADED.has(it.id)) });
  }
  const scoreCls = s => s >= 75 ? 's3' : s >= 55 ? 's2' : 's1';
  // 线索榜：默认跟随当前筛选（州 / 状态 / 燃料 / 年份 / 搜索 / 业主），与管线图层开关无关
  const leads = items => (items || PIPE.filter(passPipe)).slice().sort((a, b) => leadScore(b).score - leadScore(a).score || (b.mw || 0) - (a.mw || 0));

  /* ---------- 🏢 业主归并（作战地图）---------- */
  const OWNER_ALIAS = [
    [/neoen/i, 'Neoen'], [/akaysha/i, 'Akaysha Energy'], [/\bagl\b/i, 'AGL'], [/origin energy|\borigin\b/i, 'Origin Energy'], [/\bacen\b/i, 'ACEN'],
    [/\bedpr?\b|edp renew/i, 'EDP Renewables'], [/x-?elio/i, 'X-Elio'], [/iberdrola|infigen/i, 'Iberdrola'], [/tilt renew/i, 'Tilt Renewables'], [/squadron|\bcwp\b/i, 'Squadron Energy'],
    [/windlab/i, 'Windlab'], [/fortescue|\bfmg\b/i, 'Fortescue'], [/synergy/i, 'Synergy'], [/cleanco/i, 'CleanCo'], [/stanwell/i, 'Stanwell'], [/cs energy/i, 'CS Energy'],
    [/\bequis\b/i, 'Equis'], [/engie/i, 'ENGIE'], [/\benel\b/i, 'Enel Green Power'], [/lightsource|\bbp\b/i, 'Lightsource bp'], [/\brwe\b/i, 'RWE'], [/vena energy/i, 'Vena Energy'],
    [/potentia/i, 'Potentia Energy'], [/octopus/i, 'Octopus Australia'], [/ampyr/i, 'AMPYR'], [/\beku\b/i, 'Eku Energy'], [/gentari/i, 'Gentari'], [/edify/i, 'Edify Energy'],
    [/\bark energy/i, 'ARK Energy'], [/elgin/i, 'Elgin Energy'], [/private energy partners|\bpep\b/i, 'Private Energy Partners'], [/tag ?energy/i, 'TagEnergy'], [/energy estate/i, 'Energy Estate'],
    [/firm ?power/i, 'Firm Power'], [/zebre/i, 'Zebre'], [/\bapa\b/i, 'APA Group'], [/samsung/i, 'Samsung C&T'], [/oceanex/i, 'OceanEx'], [/synco/i, 'SynCo Global'], [/esco (pacific|solar)/i, 'ESCO Pacific'],
    [/\btbsol\b/i, 'TBSOL'], [/genex/i, 'Genex Power'], [/enervest/i, 'Enervest'], [/european energy/i, 'European Energy'], [/libra energy/i, 'Libra Energy'], [/\bfrv\b/i, 'FRV'], [/pottinger/i, 'Pottinger'],
    [/alinta/i, 'Alinta Energy'], [/acciona/i, 'Acciona Energía'], [/ib ?vogt/i, 'ib vogt'], [/\box2\b/i, 'OX2'], [/cubico/i, 'Cubico'], [/atmos/i, 'Atmos Renewables'], [/foresight/i, 'Foresight'],
    [/\bbhp\b/i, 'BHP'], [/rio tinto/i, 'Rio Tinto'], [/zenith/i, 'Zenith Energy'], [/frontier energy/i, 'Frontier Energy'], [/goldwind/i, 'Goldwind'], [/\bsec\b|state electricity commission/i, 'SEC Victoria'],
    [/snowy/i, 'Snowy Hydro'], [/^energy ?australia\b|\benergyaustralia\b/i, 'EnergyAustralia'], [/\bshell\b/i, 'Shell Energy'], [/total ?energies/i, 'TotalEnergies'], [/pacific (blue|hydro)/i, 'Pacific Blue'], [/bright energy/i, 'Bright Energy'],
    [/goldman|\bgsam\b/i, 'Goldman Sachs AM'], [/\bbp\b/i, 'bp'], [/ampol/i, 'Ampol'], [/macquarie|\bmam\b/i, 'Macquarie'], [/brookfield/i, 'Brookfield'], [/\bqic\b/i, 'QIC'], [/\bgpg\b|global power generation|naturgy/i, 'Naturgy (GPG)'],
    [/\bsun ?cable\b/i, 'SunCable'], [/\bwind ?prospect\b/i, 'Wind Prospect'], [/\bres\b/i, 'RES'], [/sunpower|maoneng/i, 'Maoneng'], [/\btesla\b/i, 'Tesla'], [/\bameresco\b/i, 'Ameresco'], [/\bsimec\b|\bgfg\b/i, 'SIMEC (GFG)'],
  ];
  const ownerKey = o => String(o || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[.,'’]/g, ' ').replace(/\b(pty|ltd|limited|p\/l|plc|inc|llc|australia|australian|aus|holdings?|holdco|group|co|corporation|corp|partners|partnership|trust|fund|no\s*\d+|development|developments|services|projects?|project ?co|renewables?|renewable|energy|power|solar|wind|bess|battery|storage|farm|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
  function ownerGroup(o) { if (!o) return { key: '', name: null }; for (const [re, name] of OWNER_ALIAS) if (re.test(o)) return { key: name, name }; const k = ownerKey(o); return { key: k || o, name: null }; }
  const ownerKeyOf = it => (it._okey != null ? it._okey : (it._okey = ownerGroup(it.owner).key));
  function buildAccounts(items) {
    const g = {};
    (items || PIPE).forEach(it => {
      const og = ownerGroup(it.owner); const k = og.key || '—';
      const a = g[k] || (g[k] = { key: k, name: og.name, raw: {}, items: [], mw: { committed: 0, anticipated: 0, proposed: 0, existing: 0 }, states: {} });
      a.items.push(it); a.mw[it.status] = (a.mw[it.status] || 0) + (it.mw || 0); if (it.state) a.states[it.state] = (a.states[it.state] || 0) + 1; if (it.owner) a.raw[it.owner] = (a.raw[it.owner] || 0) + 1;
    });
    return Object.keys(g).map(k => { const a = g[k];
      if (!a.name) a.name = Object.keys(a.raw).sort((x, y) => a.raw[y] - a.raw[x] || x.length - y.length)[0] || (en() ? '(owner not listed)' : '（未填业主）');
      a.near = a.mw.committed + a.mw.anticipated; a.total = a.near + a.mw.proposed;
      a.top = a.items.slice().sort((x, y) => (PL_STATUS.indexOf(x.status) - PL_STATUS.indexOf(y.status)) || (y.mw || 0) - (x.mw || 0))[0];
      a.lead = a.items.reduce((m, i) => Math.max(m, leadScore(i).score), 0);
      return a;
    }).sort((x, y) => y.near - x.near || y.total - x.total || y.items.length - x.items.length);
  }
  // EPC / 总承包商账户：主项目库 epc 字段 + 管线备注文本（util.epcCosOf 识别表）
  function buildEpcAccounts() {
    const g = {}, seen = new Set();
    const add = (name, kind, ref, st) => { const a = g[name] || (g[name] = { name, main: [], pipe: [], mw: 0, inv: 0, states: {} }); if (kind === 'main') { a.main.push(ref); if (ref.cat !== 'client') a.inv += ref.inv || 0; } else { a.pipe.push(ref); a.mw += ref.mw || 0; } if (st) a.states[st] = (a.states[st] || 0) + 1; };
    if (epcCosOf) {
      PROJECTS.forEach(p => { if (!p.epc) return; epcCosOf(p.epc).forEach(n => { seen.add(n + '|' + p.id); add(n, 'main', p, p.auState); }); });
      PIPE.forEach(it => { if (!it.notes) return; epcCosOf(it.notes).forEach(n => { if (it.projId && seen.has(n + '|' + it.projId)) return; add(n, 'pipe', it, it.state); }); });
    }
    return Object.keys(g).map(k => { const a = g[k]; a.n = a.main.length + a.pipe.length; return a; }).sort((x, y) => y.n - x.n || y.inv - x.inv || y.mw - x.mw);
  }
  function filterOwner(key) {
    state.plOwner = key || null; if (key) state.plStatus = new Set(PL_STATUS);
    syncUI(); render();
    const its = PIPE.filter(passPipe); if (!its.length) return;
    const lats = its.map(i => i.coord[1]), lngs = its.map(i => i.coord[0]);
    flyToBounds([[Math.min.apply(null, lats), Math.min.apply(null, lngs)], [Math.max.apply(null, lats), Math.max.apply(null, lngs)]], { padding: [40, 40], maxZoom: 7 });
  }

  /* ---------- 宽面板（🎯 线索榜 / 🏢 账户 / 📰 本季变化）---------- */
  const modalEl = $('modal'), modalBox = $('modal-box');
  const mhead = (title, sub, actions) => '<div class="m-head"><h2>' + title + '</h2><div class="m-actions">' + (actions || '') + '</div><button class="m-close" aria-label="' + L_('closeA') + '">×</button>' + (sub ? '<div class="m-sub">' + sub + '</div>' : '') + '</div>';
  const navBtns = cur => ['leads', 'accounts', 'changes'].filter(v => v !== cur).map(v => '<button data-view="' + v + '">' + L_(v === 'leads' ? 'leadsBtn' : v === 'accounts' ? 'accBtn' : 'chBtn') + '</button>').join('');
  function openModal(html, view) {
    if (!modalEl || !modalBox) return;
    closeDrawers();
    if (!state.view) _modalPrev = document.activeElement || null;   // 视图间切换时保留最初的触发按钮
    modalBox.innerHTML = html; modalEl.hidden = false; if (modalEl.removeAttribute) modalEl.removeAttribute('hidden');
    state.view = view; writeHash();
    const cl = modalBox.querySelector('.m-close'); if (cl) { cl.addEventListener('click', closeModal); if (cl.focus) cl.focus(); }
    modalBox.querySelectorAll('[data-plid]').forEach(b => b.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); closeModal(); showPipe(b.dataset.plid); }));
    modalBox.querySelectorAll('[data-pid]').forEach(b => b.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); closeModal(); showDetail(+b.dataset.pid); }));
    modalBox.querySelectorAll('[data-owner]').forEach(b => b.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); closeModal(); filterOwner(b.dataset.owner); }));
    modalBox.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => openView(b.dataset.view)));
  }
  function closeModal() {
    if (!modalEl) return; modalEl.hidden = true; if (modalEl.setAttribute) modalEl.setAttribute('hidden', ''); if (state.view) { state.view = null; writeHash(); }
    if (_modalPrev && _modalPrev.focus) { try { _modalPrev.focus(); } catch (e) { /* ignore */ } }   // 焦点回到打开弹窗的按钮
    _modalPrev = null;
  }
  // 弹窗焦点圈：Tab 不逃出弹窗（与 app.js 的 countryPanel 同规则）
  let _modalPrev = null;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !state.view || !modalBox || !modalBox.querySelectorAll) return;
    const f = modalBox.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!modalBox.contains || !modalBox.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  });
  function openView(v) { if (v === 'leads') showLeads(); else if (v === 'accounts') showAccounts('owner'); else if (v === 'epc') showAccounts('epc'); else if (v === 'changes') showChanges(); }
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  // 表格单元：data-l = 列名；窄屏下 au.css 把每行拆成一张卡、用它当标签（.mtable td::before），12 列表格不必横向滑动
  const td = (label, html, cls) => '<td' + (cls ? ' class="' + cls + '"' : '') + ' data-l="' + esc(label) + '">' + html + '</td>';
  function download(name, text, mime) {
    try {
      if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL || !document.body || !document.body.appendChild) return false;
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' })); a.download = name;
      document.body.appendChild(a); if (a.click) a.click(); setTimeout(() => { try { URL.revokeObjectURL(a.href); if (a.remove) a.remove(); } catch (e) { /* ignore */ } }, 600);
      return true;
    } catch (e) { return false; }
  }
  const pageUrl = () => (typeof location !== 'undefined' && location.href ? location.href.split('#')[0] : 'au.html');

  /* ---------- 📋 线索跟进（本地轻量 CRM）----------
   * 每条管线可记 跟进状态 / 负责人 / 下次动作日期 / 备注，存本机 localStorage（au.leads.v1；隐私模式 / Node 退化为内存），
   * 线索榜可 JSON 备份 / 恢复（跨设备迁移、同事合并，同一项目以较新记录为准），CSV 导出带跟进列；
   * 「📋 我的线索」快捷筛选 + 右栏「跟进中 N · 7 天内到期 M」提醒。 */
  const TRACK_KEY = 'au.leads.v1', TRACK_VER = 1;
  const TRACK_ST = [['todo', '待联系', 'To contact'], ['contacted', '已联系', 'Contacted'], ['quoted', '已报价', 'Quoted'], ['won', '赢单', 'Won'], ['lost', '丢单', 'Lost'], ['skip', '不跟进', 'Skip']];
  const TRACK_OPEN = new Set(['todo', 'contacted', 'quoted']);
  const trackStName = k => { const r = TRACK_ST.find(x => x[0] === k); return r ? (en() ? r[2] : r[1]) : (k || ''); };
  const hasLS = () => { try { return typeof localStorage !== 'undefined' && !!localStorage; } catch (e) { return false; } };
  function loadTrack() { try { if (hasLS()) { const o = JSON.parse(localStorage.getItem(TRACK_KEY) || 'null'); if (o && o.items && typeof o.items === 'object') return o.items; } } catch (e) { /* 损坏 / 隐私模式 */ } return {}; }
  const TRACK = loadTrack();
  function saveTrack() { try { if (hasLS()) localStorage.setItem(TRACK_KEY, JSON.stringify({ ver: TRACK_VER, items: TRACK })); } catch (e) { /* 配额 / 隐私模式：仅内存 */ } }
  const cleanRec = r => { const o = {}; ['st', 'who', 'next', 'note'].forEach(k => { const v = String((r && r[k]) || '').trim(); if (v) o[k] = v.slice(0, k === 'note' ? 600 : 80); }); if (o.st && !TRACK_ST.some(x => x[0] === o.st)) delete o.st; if (o.next && !/^\d{4}-\d{2}-\d{2}$/.test(o.next)) delete o.next; return o; };
  const trackOf = id => TRACK[id] || null;
  function setTrack(id, rec) { const o = cleanRec(rec); if (!Object.keys(o).length) delete TRACK[id]; else { o.t = new Date().toISOString().slice(0, 10); TRACK[id] = o; } saveTrack(); return TRACK[id] || null; }
  function delTrack(id) { delete TRACK[id]; saveTrack(); }
  const todayStr = () => NOW.toISOString().slice(0, 10);
  // 到期：有下次动作日期、状态仍在推进（待联系 / 已联系 / 已报价）且日期 ≤ 今天 + days（过期也算）
  const dueIn = (rec, days) => { if (!rec || !rec.next || (rec.st && !TRACK_OPEN.has(rec.st))) return false; const d = new Date(rec.next + 'T00:00:00'); return !isNaN(d) && d <= new Date(NOW.getTime() + days * 864e5); };
  const trackActive = id => { const r = TRACK[id]; return !!r && r.st !== 'skip'; };
  function trackCounts() { let n = 0, due = 0; Object.keys(TRACK).forEach(id => { if (!PIPE_BY_ID[id]) return; if (trackActive(id)) n++; if (dueIn(TRACK[id], 7)) due++; }); return { n, due }; }
  function trackCell(it) {
    const r = trackOf(it.id); if (!r) return '<span class="mini">—</span>';
    return (r.st ? '<span class="tag tr-' + r.st + '">' + esc(trackStName(r.st)) + '</span>' : '')
      + ((r.next || r.who) ? '<div class="mini">' + (r.next ? (dueIn(r, 7) ? '<b style="color:#ffb3c1">⏰ ' + esc(r.next) + '</b>' : '⏰ ' + esc(r.next)) : '') + (r.who ? (r.next ? ' · ' : '') + esc(r.who) : '') + '</div>' : '');
  }
  function exportTrack() { const t = JSON.stringify({ ver: TRACK_VER, exported: todayStr(), source: pageUrl(), items: TRACK }, null, 1); if (download('au-leads-track-' + todayStr() + '.json', t, 'application/json')) toast(en() ? 'Follow-ups backed up (JSON)' : '已备份跟进记录 (JSON)'); return t; }
  function importTrackText(text, opts) {
    let o = null; try { o = JSON.parse(text); } catch (e) { o = null; }
    const items = o && o.items && typeof o.items === 'object' ? o.items : null;
    if (!items) { toast(L_('trkImpBad')); return 0; }
    const ids = Object.keys(items).filter(id => items[id] && typeof items[id] === 'object');
    if (!(opts && opts.silent) && typeof confirm === 'function' && !confirm(L_('trkImpAsk').replace('{n}', ids.length))) return 0;
    let n = 0;
    ids.forEach(id => { const inc = cleanRec(items[id]); if (!Object.keys(inc).length) return; const cur = TRACK[id]; if (cur && cur.t && items[id].t && String(items[id].t) < String(cur.t)) return; inc.t = String(items[id].t || todayStr()).slice(0, 10); TRACK[id] = inc; n++; });
    saveTrack(); toast(L_('trkImpOk').replace('{n}', n)); render(); return n;
  }

  /* ---------- 🎯 线索榜 ---------- */
  function leadRow(it, i) {
    const s = leadScore(it), f = fuelOf(it.fuel), pj = it.projId ? PROJ_BY_ID[it.projId] : null;
    const w = s.window ? ymFmt(s.window.from) + ' ~ ' + ymFmt(s.window.to) : '—';
    return '<tr class="clk" data-plid="' + esc(it.id) + '">' + td('#', String(i + 1), 'num rk') + td('', '<div class="nm"><span class="rk-in">' + (i + 1) + '. </span>' + esc(en() ? it.en : it.name) + '<small>' + esc(en() ? it.name : it.en) + (it.owner ? ' · ' + esc(it.owner) : '') + '</small></div>', 'full')
      + td(L_('pCountry'), esc(stShort(it.state)), 'nw') + td(L_('pFuel'), '<span style="color:' + f.color + '">' + f.icon + '</span> ' + esc(en() ? f.en : f.zh), 'nw') + td(L_('pMw'), esc(mwFmt(it) || '—'), 'num') + td('COD', esc(it.cod || '—'), 'nw')
      + td(L_('pAemo'), '<span class="tag ' + it.status + '">' + esc(plStatusName(it.status)) + '</span>') + td(L_('lEpc'), '<span class="tag' + (s.epc === '未招标' || s.epc === '未公开' ? ' open' : '') + '">' + esc(epcName(s.epc)) + '</span>') + td(L_('lWindow'), esc(w), 'num') + td(L_('lProduct'), esc(en() ? s.product.en : s.product.zh))
      + td(L_('lScore'), '<span class="sc ' + scoreCls(s.score) + '" title="' + esc((en() ? 'product ' : '产品 ') + s.prod + ' + ' + (en() ? 'window ' : '窗口 ') + s.win + '（' + (s.winWhy || '') + '）+ ' + (en() ? 'status/EPC ' : '状态/EPC ') + s.st + '（' + (s.stWhy || '') + '）') + '">' + s.score + '</span>', 'num')
      + td(L_('track'), trackCell(it))
      + td('', '<button data-plid="' + esc(it.id) + '">' + L_('lCard') + '</button>' + (pj ? '<a href="coach.html#project=' + pj.id + '" target="_blank" rel="noopener" title="' + esc(en() ? 'Open this project in the sales coach' : '用这个项目开一局销售陪练') + '">' + L_('lCoach') + '</a>' : ''), 'act') + '</tr>';
  }
  function showLeads() {
    const all = leads(), top = all.slice(0, 50);
    const mw = top.reduce((s, i) => s + (i.mw || 0), 0);
    const n = st => top.filter(i => i.status === st).length, openN = top.filter(i => { const e = leadScore(i).epc; return e === '未招标' || e === '未公开'; }).length;
    const byProd = {}; top.forEach(it => { const k = en() ? leadScore(it).product.en : leadScore(it).product.zh; byProd[k] = (byProd[k] || 0) + 1; });
    const prodTop = Object.keys(byProd).sort((a, b) => byProd[b] - byProd[a]).slice(0, 3).map(k => esc(k) + ' <b style="display:inline;font-size:12px">' + byProd[k] + '</b>').join(' · ');
    const tc = trackCounts();
    const html = mhead(L_('leadsT'), L_('leadsHint') + ' · ' + fmtNum(all.length) + (en() ? ' candidates' : ' 条候选') + (PIPE_ASOF ? ' · AEMO ' + PIPE_ASOF : '') + (tc.n ? ' · ' + L_('trackSum').replace('{n}', tc.n).replace('{d}', tc.due) : ''),
      '<button id="m-csv">' + L_('leadsCsv') + '</button><button id="m-trk-exp" title="' + esc(L_('trackLocal')) + '">' + L_('trkExp') + '</button><button id="m-trk-imp">' + L_('trkImp') + '</button><input type="file" id="m-trk-file" accept=".json,application/json" hidden>' + navBtns('leads'))
      + '<div class="m-body"><div class="m-kpis"><div><b>' + fmtNum(top.length) + '</b><span>Top 50 · ' + gw(mw) + '</span></div><div><b style="color:#bfe9d8">' + n('committed') + '</b><span>' + esc(plStatusName('committed')) + '</span></div><div><b style="color:#ffd48a">' + n('anticipated') + '</b><span>' + esc(plStatusName('anticipated')) + '</span></div><div><b style="color:#ffd48a">' + openN + '</b><span>' + (en() ? 'EPC pre-tender / undisclosed' : 'EPC 未招标 / 未公开') + '</span></div><div style="grid-column:span 2"><b style="font-size:13px">' + (prodTop || '—') + '</b><span>' + L_('lProduct') + '</span></div></div>'
      + '<div class="tbl-wrap"><table class="mtable"><thead><tr><th>#</th><th>' + (en() ? 'Project' : '项目') + '</th><th>' + L_('pCountry') + '</th><th>' + L_('pFuel') + '</th><th class="num">' + L_('pMw') + '</th><th>COD</th><th>' + L_('pAemo') + '</th><th>' + L_('lEpc') + '</th><th class="num">' + L_('lWindow') + '</th><th>' + L_('lProduct') + '</th><th class="num">' + L_('lScore') + '</th><th>' + L_('track') + '</th><th></th></tr></thead><tbody>' + top.map(leadRow).join('') + '</tbody></table></div>'
      + (top.length ? '' : '<div class="empty">' + L_('noData') + '</div>')
      + '<p class="m-note">' + L_('leadsNote') + '</p></div>';
    openModal(html, 'leads');
    const b = $('m-csv'); if (b) b.addEventListener('click', () => exportLeadsCSV(top));
    const te = $('m-trk-exp'); if (te) te.addEventListener('click', exportTrack);
    const ti = $('m-trk-imp'), tf = $('m-trk-file');
    if (ti && tf) { ti.addEventListener('click', () => { if (tf.click) tf.click(); }); tf.addEventListener('change', () => { const f = tf.files && tf.files[0]; if (!f || typeof FileReader === 'undefined') return; const rd = new FileReader(); rd.onload = () => { importTrackText(String(rd.result || '')); showLeads(); }; rd.readAsText(f); }); }
  }
  function leadsCSV(items) {
    const H = ['排名', '线索分', '产品分', '窗口分', '状态EPC分', '项目', '英文名', '州', '类型', 'MW', 'MWh', 'COD', 'AEMO 状态', 'EPC 状态', '采购窗口', '窗口进行中', '本季升级', '产品匹配', '业主', '接入点', 'TNSP', 'REZ', '经度', '纬度', '示意坐标', '链接', '备注', '跟进状态', '负责人', '下次动作', '跟进备注'];
    const rows = items.map((it, i) => { const s = leadScore(it), tr = trackOf(it.id) || {}; return [i + 1, s.score, s.prod, s.win, s.st, it.name, it.en, it.state, fuelOf(it.fuel).zh, it.mw || '', it.mwh || '', it.cod || '', PL_ZH[it.status] || it.status, s.epc, s.window ? ymFmt(s.window.from) + '~' + ymFmt(s.window.to) : '', s.winOpen ? '是' : '', s.up ? '是' : '', s.product.zh, it.owner || '', it.connNode || '', it.tnsp || '', it.rez || '', it.coord[0], it.coord[1], it.approx ? '是' : '', pageUrl() + '#pipe=' + it.id, String(it.notes || '').slice(0, 300), tr.st ? (TRACK_ST.find(x => x[0] === tr.st) || [])[1] || tr.st : '', tr.who || '', tr.next || '', tr.note || '']; });
    return '﻿' + [H].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n');
  }
  function exportLeadsCSV(items) { const csv = leadsCSV(items || leads().slice(0, 50)); if (download('au-leads-' + (PIPE_ASOF || 'now') + '.csv', csv, 'text/csv;charset=utf-8')) toast(en() ? 'CSV exported' : '已导出 CSV（可分单给同事）'); return csv; }
  function renderLeads(pitems) {
    const el = $('lead-list'), sum = $('leads-sum'); if (!el) return;
    const pool = PIPE.filter(passPipe), ls = leads(pool).slice(0, 10);
    if (sum) sum.textContent = fmtNum(pool.length) + (en() ? ' candidates' : ' 条候选');
    el.innerHTML = ls.map((it, i) => { const s = leadScore(it), f = fuelOf(it.fuel); return '<div class="row" data-plid="' + esc(it.id) + '" role="button" tabindex="0"><div class="nm"><span style="color:#7b8ca6">' + (i + 1) + '.</span> <span style="color:' + f.color + '">' + f.icon + '</span> ' + esc(en() ? it.en : it.name) + '</div><div class="cd ' + (s.score >= 75 ? 'cool' : s.score >= 55 ? 'warm' : 'tbd') + '" title="' + L_('lScore') + '">' + s.score + '</div><div class="meta">' + esc(stShort(it.state)) + ' · ' + esc(mwFmt(it)) + (it.cod ? ' · COD ' + esc(it.cod) : '') + ' · ' + esc(plStatusName(it.status)) + ' · EPC ' + esc(epcName(s.epc)) + '<br>' + esc(en() ? s.product.en : s.product.zh) + (s.window ? ' · ' + ymFmt(s.window.from) + '~' + ymFmt(s.window.to) + (s.winOpen ? ' ⏰' : '') : '') + (function () { const tr = trackOf(it.id); return tr ? ' · <b style="color:#c9a7ff">📋 ' + esc(trackStName(tr.st || 'todo')) + (tr.next ? ' ' + esc(tr.next.slice(5)) : '') + '</b>' : ''; })() + '</div></div>'; }).join('') || '<div class="empty">' + L_('noData') + '</div>';
    el.querySelectorAll('.row').forEach(r => { r.addEventListener('click', () => showPipe(r.dataset.plid)); r.addEventListener('keydown', e => { if (e.key === 'Enter') showPipe(r.dataset.plid); }); });
    // 📋 跟进中 N · 7 天内到期 M（点击 → 「我的线索」筛选）
    const ts = $('track-sum');
    if (ts) {
      const c = trackCounts();
      if (c.n) { ts.innerHTML = '<span class="d-link" data-mine="1">' + L_('trackSum').replace('{n}', c.n).replace('{d}', c.due) + '</span>'; ts.hidden = false; if (ts.removeAttribute) ts.removeAttribute('hidden'); const lk = ts.querySelector('[data-mine]'); if (lk) lk.addEventListener('click', () => { state.plMine = !state.plMine; syncUI(); render(); }); }
      else { ts.innerHTML = ''; ts.hidden = true; if (ts.setAttribute) ts.setAttribute('hidden', ''); }
    }
  }

  /* ---------- 🏢 账户视图 ---------- */
  const stChips = m => STATES.map(s => s.abbr).filter(a => m[a]).map(a => esc(stShort(a)) + ' ' + m[a]).join(' · ') || '—';
  function showAccounts(tab) {
    tab = tab === 'epc' ? 'epc' : 'owner';
    const tabs = '<div class="tabs"><button class="' + (tab === 'owner' ? 'on' : '') + '" data-view="accounts">' + L_('accOwner') + '</button><button class="' + (tab === 'epc' ? 'on' : '') + '" data-view="epc">' + L_('accEpc') + '</button></div>';
    let body = '';
    if (tab === 'owner') {
      const acc = buildAccounts(PIPE), top = acc.slice(0, 60), nearAll = acc.reduce((s, a) => s + a.near, 0), near10 = acc.slice(0, 10).reduce((s, a) => s + a.near, 0);
      body = '<div class="m-kpis"><div><b>' + fmtNum(acc.length) + '</b><span>' + (en() ? 'owner groups' : '业主（归并后）') + '</span></div><div><b>' + gw(nearAll) + '</b><span>' + (en() ? 'committed + anticipated MW' : '承诺 + 预期 MW') + '</span></div><div><b>' + (nearAll ? Math.round(near10 / nearAll * 100) : 0) + '%</b><span>' + (en() ? 'top-10 owners share' : '前 10 家业主占比') + '</span></div></div>'
        + '<div class="tbl-wrap"><table class="mtable"><thead><tr><th>#</th><th>' + (en() ? 'Owner' : '业主') + '</th><th class="num">' + (en() ? 'Projects' : '项目') + '</th><th class="num">' + esc(plStatusName('committed')) + '</th><th class="num">' + esc(plStatusName('anticipated')) + '</th><th class="num">' + esc(plStatusName('proposed')) + '</th><th>' + (en() ? 'By state' : '各州') + '</th><th>' + (en() ? 'Flagship' : '最大项目') + '</th><th class="num">' + L_('lScore') + '</th><th></th></tr></thead><tbody>'
        + top.map((a, i) => '<tr>' + td('#', String(i + 1), 'num rk') + td('', '<div class="nm"><span class="rk-in">' + (i + 1) + '. </span>' + esc(a.name) + (Object.keys(a.raw).length > 1 ? '<small>' + esc(Object.keys(a.raw).filter(r => r !== a.name).slice(0, 3).join(' / ')) + (Object.keys(a.raw).length > 4 ? ' …' : '') + '</small>' : '') + '</div>', 'full') + td(en() ? 'Projects' : '项目', String(a.items.length), 'num') + td(plStatusName('committed'), (a.mw.committed ? gw(a.mw.committed) : '—'), 'num') + td(plStatusName('anticipated'), (a.mw.anticipated ? gw(a.mw.anticipated) : '—'), 'num') + td(plStatusName('proposed'), (a.mw.proposed ? gw(a.mw.proposed) : '—'), 'num') + td(en() ? 'By state' : '各州', stChips(a.states), 'mini') + td(en() ? 'Flagship' : '最大项目', (a.top ? '<span class="d-link" data-plid="' + esc(a.top.id) + '">' + esc(en() ? a.top.en : a.top.name) + '</span> <span class="mini">' + esc(mwFmt(a.top)) + '</span>' : '—')) + td(L_('lScore'), '<span class="sc ' + scoreCls(a.lead) + '">' + a.lead + '</span>', 'num') + td('', '<button data-owner="' + esc(a.key) + '">' + (en() ? '📍 Map' : '📍 地图筛选') + '</button>', 'act') + '</tr>').join('')
        + '</tbody></table></div><p class="m-note">' + L_('accNote') + '</p>';
    } else {
      const ep = buildEpcAccounts();
      body = '<div class="m-kpis"><div><b>' + fmtNum(ep.length) + '</b><span>' + (en() ? 'contractors identified' : '识别到的承包商') + '</span></div><div><b>' + fmtNum(ep.reduce((s, a) => s + a.main.length, 0)) + '</b><span>' + (en() ? 'awards in project library' : '主项目库授标记录') + '</span></div><div><b>' + fmtNum(ep.reduce((s, a) => s + a.pipe.length, 0)) + '</b><span>' + (en() ? 'mentions in pipeline notes' : '管线备注提及') + '</span></div></div>'
        + '<div class="tbl-wrap"><table class="mtable"><thead><tr><th>#</th><th>EPC</th><th class="num">' + (en() ? 'Projects' : '项目') + '</th><th class="num">' + (en() ? 'Value' : '参与投资') + '</th><th class="num">' + (en() ? 'Pipeline MW' : '管线 MW') + '</th><th>' + (en() ? 'By state' : '各州') + '</th><th>' + (en() ? 'Projects (click for card)' : '承接项目（点开卡片）') + '</th></tr></thead><tbody>'
        + ep.map((a, i) => { const chips = a.main.map(p => '<span class="d-link" data-pid="' + p.id + '">' + esc(nm(p)) + (p.epcStatus === '未招标' ? ' 🔧' : '') + '</span>').concat(a.pipe.map(it => '<span class="d-link" data-plid="' + esc(it.id) + '">🧭 ' + esc(en() ? it.en : it.name) + '</span>')); return '<tr>' + td('#', String(i + 1), 'num rk') + td('', '<div class="nm"><span class="rk-in">' + (i + 1) + '. </span>' + esc(a.name) + '</div>', 'full') + td(en() ? 'Projects' : '项目', a.n + ' <span class="mini">(' + a.main.length + '+' + a.pipe.length + ')</span>', 'num') + td(en() ? 'Value' : '参与投资', (a.inv ? '$' + invMag(a.inv) : '—'), 'num') + td(en() ? 'Pipeline MW' : '管线 MW', (a.mw ? gw(a.mw) : '—'), 'num') + td(en() ? 'By state' : '各州', stChips(a.states), 'mini') + td('', '<div class="chips">' + chips.slice(0, 8).join('') + (chips.length > 8 ? '<span class="mini">+' + (chips.length - 8) + '</span>' : '') + '</div>', 'full') + '</tr>'; }).join('')
        + '</tbody></table></div><p class="m-note">' + L_('epcNote') + '</p>';
    }
    openModal(mhead(L_('accT'), L_('accHint'), navBtns('accounts')) + '<div class="m-body">' + tabs + body + '</div>', tab === 'epc' ? 'epc' : 'accounts');
  }

  /* ---------- 📰 本季变化 ---------- */
  function renderChangesBlock() {
    const el = $('changes-bands'), sum = $('changes-sum'), more = $('btn-changes-more'); if (!el) return;
    if (!memo('changes', state.lang)) return;
    if (!CHANGES) { el.innerHTML = '<div class="empty" style="grid-column:1/-1">' + L_('chNone') + '</div>'; if (more) more.hidden = true; return; }
    const up = (CHANGES.status || []).filter(x => x.to === 'committed').length, c = CHANGES.counts || {};
    if (sum) sum.textContent = (CHANGES.prevAsOf ? CHANGES.prevAsOf + ' → ' : '') + (CHANGES.asOf || '');
    el.innerHTML = '<div class="b1"><b>' + fmtNum(c.added || 0) + '</b><span>' + L_('chAdded') + '</span></div><div class="b2"><b>' + fmtNum(up) + '</b><span>' + L_('chUp') + '</span></div><div class="b3"><b>' + fmtNum(c.mw || 0) + '</b><span>' + L_('chMw') + '</span></div><div class="b4"><b>' + fmtNum(c.gone || 0) + '</b><span>' + L_('chGone') + '</span></div>';
  }
  function chRow(x, mid) {
    const f = fuelOf(x.fuel), live = PIPE_BY_ID[x.id];
    return '<tr' + (live ? ' class="clk" data-plid="' + esc(x.id) + '"' : '') + '>' + td('', '<div class="nm">' + esc(en() ? x.en : x.name) + '<small>' + esc(en() ? x.name : x.en) + (x.owner ? ' · ' + esc(x.owner) : '') + '</small></div>', 'full') + td(L_('pCountry'), esc(stShort(x.state)), 'nw') + td(L_('pFuel'), '<span style="color:' + f.color + '">' + f.icon + '</span> ' + esc(en() ? f.en : f.zh), 'nw') + td(L_('pMw'), (x.mw ? fmtNum(x.mw) + ' MW' : '—') + (x.mwh ? ' / ' + fmtNum(x.mwh) + ' MWh' : ''), 'num') + td(L_('pAemo'), (mid || '<span class="tag ' + x.status + '">' + esc(plStatusName(x.status)) + '</span>')) + td('COD', esc(x.cod || '—')) + td(L_('lScore'), (live ? '<span class="sc ' + scoreCls(leadScore(live).score) + '">' + leadScore(live).score + '</span>' : '—'), 'num') + '</tr>';
  }
  const chTable = (rows, mid) => rows.length ? '<div class="tbl-wrap"><table class="mtable"><thead><tr><th>' + (en() ? 'Project' : '项目') + '</th><th>' + L_('pCountry') + '</th><th>' + L_('pFuel') + '</th><th class="num">' + L_('pMw') + '</th><th>' + L_('pAemo') + '</th><th>COD</th><th class="num">' + L_('lScore') + '</th></tr></thead><tbody>' + rows.map(x => chRow(x, mid ? mid(x) : null)).join('') + '</tbody></table></div>' : '<div class="empty">' + L_('noData') + '</div>';
  function showChanges() {
    if (!CHANGES) { openModal(mhead(L_('chT'), L_('chNone'), navBtns('changes')) + '<div class="m-body"></div>', 'changes'); return; }
    const c = CHANGES.counts || {}, up = (CHANGES.status || []).filter(x => x.to === 'committed'), other = (CHANGES.status || []).filter(x => x.to !== 'committed');
    const mwOf = a => a.reduce((s, x) => s + (x.mw || 0), 0);
    const secH = (t, n) => '<div class="m-sec"><h3>' + t + '<span class="count">' + n + '</span></h3>';
    const html = mhead(L_('chT'), (CHANGES.prevAsOf || '') + ' → ' + CHANGES.asOf + ' · ' + esc(CHANGES.source || '') + (CHANGES.generated ? ' · ' + (en() ? 'generated ' : '生成 ') + CHANGES.generated : ''), '<button id="m-brief">' + L_('chBrief') + '</button><button id="m-copy">' + L_('chCopy') + '</button>' + navBtns('changes'))
      + '<div class="m-body"><div class="m-kpis"><div><b>' + fmtNum(c.prev || 0) + ' → ' + fmtNum(c.now || 0) + '</b><span>' + (en() ? 'pipeline records' : '管线条数') + '</span></div><div><b style="color:var(--accent)">' + fmtNum(c.added || 0) + '</b><span>' + L_('chAdded') + ' · ' + gw(mwOf(CHANGES.added || [])) + '</span></div><div><b style="color:#bfe9d8">' + up.length + '</b><span>' + L_('chUp') + ' · ' + gw(mwOf(up)) + '</span></div><div><b style="color:#ffd48a">' + fmtNum(c.mw || 0) + '</b><span>' + L_('chMw') + '</span></div><div><b>' + fmtNum(c.gone || 0) + '</b><span>' + L_('chGone') + ' · ' + gw(mwOf(CHANGES.gone || [])) + '</span></div><div><b>' + fmtNum(c.needCoord || 0) + '</b><span>' + L_('chCoord') + '</span></div></div>'
      + secH('⬆️ ' + L_('chUp') + (en() ? ' (FID / construction start)' : '（FID / 开工，采购窗口已开）'), up.length) + chTable(up, x => '<span class="tag">' + esc(plStatusName(x.from)) + '</span> → <span class="tag committed">' + esc(plStatusName(x.to)) + '</span>') + '</div>'
      + (other.length ? secH('↔️ ' + L_('chStatus'), other.length) + chTable(other, x => '<span class="tag">' + esc(plStatusName(x.from)) + '</span> → <span class="tag ' + x.to + '">' + esc(plStatusName(x.to)) + '</span>') + '</div>' : '')
      + secH('➕ ' + L_('chAdded'), (CHANGES.added || []).length) + chTable(CHANGES.added || []) + '</div>'
      + secH('📐 ' + L_('chMw') + ' (≥5 MW)', (CHANGES.mw || []).length) + chTable(CHANGES.mw || [], x => '<span class="mini">' + fmtNum(x.from) + ' → <b>' + fmtNum(x.to) + '</b> MW</span>') + '</div>'
      + secH('➖ ' + L_('chGone') + (en() ? ' (commissioned / withdrawn / renamed)' : '（投运 / 撤回 / 改名，逐条核对）'), (CHANGES.gone || []).length) + chTable(CHANGES.gone || []) + '</div>'
      + ((CHANGES.needCoord || []).length ? secH('📍 ' + L_('chCoord'), CHANGES.needCoord.length) + '<div class="chips" style="display:flex;flex-wrap:wrap;gap:6px">' + CHANGES.needCoord.map(id => { const it = PIPE_BY_ID[id]; return it ? '<span class="tag d-link" data-plid="' + esc(id) + '" style="cursor:pointer">' + esc(en() ? it.en : it.name) + ' · ' + esc(stShort(it.state)) + '</span>' : '<span class="tag">' + esc(id) + '</span>'; }).join('') + '</div></div>' : '')
      + '<p class="m-note">' + L_('chNote') + '</p></div>';
    openModal(html, 'changes');
    const b = $('m-brief'); if (b) b.addEventListener('click', exportBrief);
    const cp = $('m-copy'); if (cp) cp.addEventListener('click', () => { const t = buildChangesBrief(); const done = () => toast(en() ? 'Brief copied' : '简报已复制'); if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done); else done(); });
  }
  // 一页中文简报（Markdown）—— 与 scripts/import-aemo.js 写出的 data-src/aemo/brief-<asOf>.md 同构，外加线索分
  function buildChangesBrief() {
    if (!CHANGES) return '';
    const c = CHANGES.counts || {}, mwOf = a => fmtNum(a.reduce((s, x) => s + (x.mw || 0), 0));
    const cell = v => String(v == null ? '' : v).replace(/\|/g, '／');
    const sc = x => { const it = PIPE_BY_ID[x.id]; return it ? leadScore(it).score : ''; };
    const row = x => '| ' + cell(x.name || x.en) + ' | ' + cell(x.state) + ' | ' + (fuelOf(x.fuel).zh) + ' | ' + (x.mw || '') + (x.mwh ? ' / ' + x.mwh + ' MWh' : '') + ' | ' + (PL_ZH[x.status] || x.status) + ' | ' + (x.cod || '—') + ' | ' + cell(x.owner) + ' | ' + sc(x) + ' |';
    const table = rows => rows.length ? '| 项目 | 州 | 类型 | MW | AEMO 状态 | COD | 业主 | 线索分 |\n|---|---|---|---|---|---|---|---|\n' + rows.map(row).join('\n') : '（无）';
    const up = (CHANGES.status || []).filter(x => x.to === 'committed'), other = (CHANGES.status || []).filter(x => x.to !== 'committed');
    const byState = a => { const m = {}; a.forEach(x => { m[x.state] = (m[x.state] || 0) + 1; }); return Object.keys(m).sort((p, q) => m[q] - m[p]).map(k => k + ' ' + m[k]).join(' · ') || '—'; };
    const L = [];
    L.push('# 澳洲 AEMO 管线季度变化简报 ' + (CHANGES.prevAsOf || '上一版') + ' → ' + CHANGES.asOf, '');
    L.push('来源：' + (CHANGES.source || 'AEMO Generation Information') + '（生成 ' + (CHANGES.generated || '') + '）。口径：AEMO 承诺 / 预期 / 拟建，容量为交流铭牌 MW；线索分 = 产品匹配 × 采购窗口 × 状态/EPC（0–100）。', '');
    L.push('## 摘要', '');
    L.push('- 管线 ' + (c.prev || 0) + ' → ' + (c.now || 0) + ' 条：**新增 ' + (c.added || 0) + ' 条**（' + mwOf(CHANGES.added || []) + ' MW）· **状态变化 ' + (c.status || 0) + ' 条**（升级为承诺 ' + up.length + ' 条 / ' + mwOf(up) + ' MW）· 容量变化 ' + (c.mw || 0) + ' 条 · 不再出现 ' + (c.gone || 0) + ' 条（' + mwOf(CHANGES.gone || []) + ' MW）· 需补坐标 ' + (c.needCoord || 0) + ' 条');
    L.push('- 新增按州：' + byState(CHANGES.added || []) + '；升级为承诺按州：' + byState(up), '');
    L.push('## 1. 升级为承诺（FID / 开工 —— 设备采购窗口已开）', '', table(up), '');
    if (other.length) L.push('其他状态变化：' + other.map(x => (x.name || x.en) + '（' + (PL_ZH[x.from] || x.from) + ' → ' + (PL_ZH[x.to] || x.to) + '）').join('；'), '');
    L.push('## 2. 新增项目（承诺 / 预期在前，按容量排序）', '', table((CHANGES.added || []).slice(0, 40)), (CHANGES.added || []).length > 40 ? '\n… 另有 ' + ((CHANGES.added || []).length - 40) + ' 条新增（拟建为主）。' : '', '');
    L.push('## 3. 容量变化（≥5 MW）', '', (CHANGES.mw || []).length ? (CHANGES.mw || []).map(x => '- ' + (x.name || x.en) + '（' + x.state + ' · ' + fuelOf(x.fuel).zh + '）：' + x.from + ' → ' + x.to + ' MW').join('\n') : '（无）', '');
    L.push('## 4. 不再出现（已投运 / 撤回 / 改名，需逐条核对）', '', table(CHANGES.gone || []), '');
    L.push('## 5. 需补坐标（仍放在州质心）', '', (CHANGES.needCoord || []).length ? CHANGES.needCoord.map(id => { const it = PIPE_BY_ID[id]; return it ? (it.name + '（' + id + '）') : id; }).join('、') : '（无）', '');
    L.push('## BD 提示', '');
    L.push('- 升级为承诺的项目 = FID 已过、总包 / BoP 正在定标：储能 → 储能升压一体化舱 / E-house；风光 → 预制舱变电站 + 集电线路开关设备；燃气调峰 → 中压开关柜。');
    L.push('- 本季度线索 Top 10（当前筛选）：' + leads().slice(0, 10).map((it, i) => (i + 1) + '. ' + it.name + '（' + leadScore(it).score + ' 分）').join('；'));
    L.push('- 「不再出现」里的承诺项目多为已投运，可转入客情经营（备件 / 扩容）；拟建项目消失多为撤回或改名，改名请在上一版条目加 aemo 别名后重跑导入。');
    return L.join('\n') + '\n';
  }
  function exportBrief() { const t = buildChangesBrief(); if (!t) return ''; if (download('au-pipeline-brief-' + ((CHANGES && CHANGES.asOf) || 'now') + '.md', t, 'text/markdown;charset=utf-8')) toast(en() ? 'Brief exported' : '已导出简报 (.md)'); return t; }

  /* ---------- 📄 州机会简报（一键导出给总部：Markdown 一页）---------- */
  function buildStateBrief(a) {
    a = normState(a); const s = ST[a]; if (!s) return '';
    const sh = SHEETS[a] || {}, d = stateStats(a), today = NOW.toISOString().slice(0, 10);
    const ps = PIPE.filter(it => it.state === a);
    const mwBy = st => ps.filter(i => i.status === st).reduce((x, i) => x + (i.mw || 0), 0);
    const cell = v => String(v == null ? '' : v).replace(/\|/g, '／').replace(/\s*\n+\s*/g, ' ');
    const tbl = (head, rows) => rows.length ? '| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|\n' + rows.map(r => '| ' + r.map(cell).join(' | ') + ' |').join('\n') : '（无）';
    const coalRows = coalSorted.filter(p => p.state === a && p.status !== 'closed').map(p => { const cd = countdown(p); return [p.name, p.owner || '', p.mw ? fmtNum(p.mw) + ' MW' : '', (p.closeYear || '—') + (p.closeMonth ? '-' + String(p.closeMonth).padStart(2, '0') : ''), cd.txt + (p.closeText ? ' · ' + p.closeText : '')]; });
    const top = leads(ps).slice(0, 10).map((it, i) => { const sc = leadScore(it), tr = trackOf(it.id); return [i + 1, it.name, fuelOf(it.fuel).zh, mwFmt(it), it.cod || '—', PL_ZH[it.status] || it.status, sc.epc, sc.window ? ymFmt(sc.window.from) + '~' + ymFmt(sc.window.to) + (sc.winOpen ? '（进行中）' : '') : '—', sc.product.zh, sc.score, tr ? trackStName(tr.st || 'todo') + (tr.next ? ' ' + tr.next : '') + (tr.who ? ' ' + tr.who : '') : '']; });
    const open = d.ps.filter(p => p.epcStatus === '未招标').sort((x, y) => (y.inv || 0) - (x.inv || 0)).slice(0, 10).map(p => [p.name, (CATEGORIES[p.cat] || {}).short || p.cat, p.status + ' ' + p.year, usd(p), p.owner || '', p.cap || '']);
    const owners = buildAccounts(ps).slice(0, 8).map(o => '- ' + o.name + '：' + o.items.length + ' 条 · 承诺 ' + fmtNum(o.mw.committed) + ' MW · 预期 ' + fmtNum(o.mw.anticipated) + ' MW · 拟建 ' + fmtNum(o.mw.proposed) + ' MW' + (o.top ? ' · 最大：' + o.top.name + '（' + mwFmt(o.top) + '）' : ''));
    const lines = LINES.filter(l => l.status !== 'existing' && (l.nodes || []).some(id => NODE[id] && normState(NODE[id].state) === a)).sort((x, y) => (x.status === 'building' ? 0 : 1) - (y.status === 'building' ? 0 : 1) || (x.year || 9999) - (y.year || 9999)).map(l => '- ' + l.name + '（' + (l.type === 'dc' ? 'HVDC ' : '') + l.kv + ' kV · ' + (l.status === 'building' ? '在建' : '规划') + (l.year ? ' ' + l.year : '') + (l.owner ? ' · ' + l.owner : '') + (l.lengthKm ? ' · ' + fmtNum(l.lengthKm) + ' km' : '') + (l.costAud ? ' · ' + l.costAud : '') + '）');
    const zones = ZONES_SORTED.filter(z => normState(z.state) === a).map(z => { const st = ZONE_STAT[z.key] || {}; return '- ' + (z.ispId ? z.ispId + ' ' : '') + z.name + '（' + (ZONE_ZH[z.status] || z.status) + (z.body ? ' · ' + z.body : '') + (z.targetGw ? ' · 目标 ' + z.targetGw + ' GW' : '') + '）：承诺+预期 ' + gw((st.committed || 0) + (st.anticipated || 0)) + ' · 拟建 ' + gw(st.proposed || 0) + ' · 项目 ' + (st.projects || 0); });
    const chUp = CHANGES ? (CHANGES.status || []).filter(x => x.state === a && x.to === 'committed') : [], chAdd = CHANGES ? (CHANGES.added || []).filter(x => x.state === a) : [], chGone = CHANGES ? (CHANGES.gone || []).filter(x => x.state === a) : [];
    const keyProj = (sh.keyProjects || []).map(k => '- ' + k.name + (k.kv ? '（' + k.kv + ' kV）' : '') + '：' + (k.status || '') + (k.year ? ' ' + k.year : '') + (k.owner ? ' · ' + k.owner : '') + (k.desc ? ' — ' + k.desc : ''));
    const L = [];
    L.push('# ' + s.name + '（' + a + '）能源市场机会简报 · ' + today.slice(0, 7), '');
    L.push('来源：澳洲电网与能源动态地图 au.html（项目库 + AEMO ' + (PIPE_ASOF || '') + ' 管线 + 州电网档案' + (CHANGES ? ' + 本季变化 ' + (CHANGES.prevAsOf || '') + '→' + CHANGES.asOf : '') + '）· 生成 ' + today + '。线索分 = 产品匹配 × 采购窗口 × 状态/EPC（0–100）；管线坐标与 EPC 推断以实地核实为准。', '');
    if (sh.summary) L.push('## 一句话', '', sh.summary, '');
    L.push('## 关键数字', '');
    L.push('- 项目库：' + fmtNum(d.n) + ' 个项目 · 投资 ≈$' + invMag(d.inv) + ' · EPC 未招标 ' + fmtNum(d.open) + ' 个');
    L.push('- AEMO 管线：承诺 ' + gw(mwBy('committed')) + ' · 预期 ' + gw(mwBy('anticipated')) + ' · 拟建 ' + gw(mwBy('proposed')) + '（共 ' + fmtNum(ps.length) + ' 条）');
    L.push('- 在运煤电 ' + gw(d.coal) + '，≤2030 退役 ' + gw(coalOperating.filter(p => p.state === a && p.closeYear && p.closeYear <= 2030).reduce((x, p) => x + (p.mw || 0), 0)) + '，≤2035 退役 ' + gw(coalOperating.filter(p => p.state === a && p.closeYear && p.closeYear <= 2035).reduce((x, p) => x + (p.mw || 0), 0)));
    L.push('- REZ：' + zones.length + ' 个（已划定 ' + ZONES_SORTED.filter(z => normState(z.state) === a && z.status === 'declared').length + '）· 在建 / 规划输电工程 ' + lines.length + ' 项', '');
    L.push('## 电网与政策', '');
    if (sh.grid) L.push('- 电网 / 市场：' + sh.grid + (sh.operator ? ' · ' + sh.operator : ''));
    if (sh.tnsp) L.push('- 输电商 TNSP：' + sh.tnsp.name + (sh.tnsp.owner ? '（' + sh.tnsp.owner + '）' : '') + (sh.tnsp.voltages ? ' · ' + sh.tnsp.voltages : '') + (sh.tnsp.notes ? ' — ' + cell(sh.tnsp.notes) : ''));
    if (sh.dnsps && sh.dnsps.length) L.push('- 配电商 DNSP：' + sh.dnsps.map(x => x.name + (x.owner ? '（' + x.owner + '）' : '')).join('；'));
    if (sh.policy) L.push('- 州政策：' + sh.policy);
    if (sh.coalExit) L.push('- 煤电退出：' + sh.coalExit);
    L.push('', '## 煤电退役时间表', '', tbl(['电厂', '业主', '在运', '关停', '倒计时 / 口径'], coalRows), '');
    L.push('## 本季度线索 Top 10（该州管线，按线索分）', '', tbl(['#', '项目', '类型', '装机', 'COD', 'AEMO 状态', 'EPC', '采购窗口', '产品匹配', '线索分', '跟进'], top), '');
    L.push('## EPC 未招标机会（项目库，按投资）', '', tbl(['项目', '品类', '状态 · 年', '投资', '业主', '规模'], open), '');
    L.push('## 重点业主（该州管线）', '', owners.join('\n') || '（无）', '');
    L.push('## 在建 / 规划输电工程', '', lines.join('\n') || '（无）', '');
    L.push('## 可再生能源区 REZ', '', zones.join('\n') || '（无）', '');
    if (CHANGES) {
      L.push('## 本季变化（' + (CHANGES.prevAsOf || '上一版') + ' → ' + CHANGES.asOf + '，该州）', '');
      L.push('- 升级为承诺 ' + chUp.length + ' 条' + (chUp.length ? '：' + chUp.map(x => x.name + '（' + fmtNum(x.mw) + ' MW' + (x.cod ? '，COD ' + x.cod : '') + '）').join('；') : ''));
      L.push('- 新增 ' + chAdd.length + ' 条' + (chAdd.length ? '：' + chAdd.slice(0, 6).map(x => x.name + '（' + (PL_ZH[x.status] || x.status) + '，' + fmtNum(x.mw) + ' MW）').join('；') + (chAdd.length > 6 ? '；…' : '') : ''));
      L.push('- 不再出现 ' + chGone.length + ' 条' + (chGone.length ? '（投运 / 撤回 / 改名）：' + chGone.slice(0, 6).map(x => x.name).join('；') + (chGone.length > 6 ? '；…' : '') : ''), '');
    }
    if (keyProj.length) L.push('## 重点电网工程（州档案）', '', keyProj.join('\n'), '');
    if (sh.vendor) L.push('## 设备商必读', '', sh.vendor, '');
    if (sh.tenderPortals && sh.tenderPortals.length) L.push('## 招标 / 供应商门户', '', sh.tenderPortals.map(x => '- ' + x).join('\n'), '');
    L.push('## 行动建议', '');
    L.push('- 优先跟进线索分 ≥75 且 EPC 未招标 / 未公开的承诺项目：储能 → 储能升压一体化舱 / E-house；风光 → 预制舱变电站 + 集电线路开关设备；燃气调峰 → 中压开关柜。');
    L.push('- EPC 已授标的项目转为找总包分包（升压站成套、中压柜、预制舱）；煤电退役场址关注替代储能 / 燃气项目的接入改造。');
    L.push('- 升级为承诺的项目 = FID 已过，设备定标期在 COD 前 24→9 个月，按采购窗口倒排拜访计划。', '');
    if (sh.sources && sh.sources.length) L.push('## 来源', '', sh.sources.map(x => '- ' + x).join('\n'), '');
    return L.join('\n') + '\n';
  }
  function exportStateBrief(a) { const t = buildStateBrief(a); if (!t) return ''; if (download('au-' + normState(a) + '-brief-' + NOW.toISOString().slice(0, 7) + '.md', t, 'text/markdown;charset=utf-8')) toast(en() ? 'State brief exported' : '已导出州机会简报 (.md)'); return t; }

  /* ---------- 📸 州海报（PNG）：一张 1080×1620 的信息图——KPI / 管线分档 / 煤电倒计时 / 线索 Top 8 / REZ·输电·本季变化 / 行动建议 ----------
   * 微信里 .md 不渲染，总部和同事更习惯看图；SVG → <img> → canvas 栅格化（与全球地图 📸 快照同路径），失败回退 SVG。不用 emoji，避免栅格化时缺字。 */
  function buildStateSVG(a) {
    a = normState(a); const s = ST[a]; if (!s) return '';
    const sh = SHEETS[a] || {}, d = stateStats(a), ps = PIPE.filter(it => it.state === a);
    const mwBy = st => ps.filter(i => i.status === st).reduce((x, i) => x + (i.mw || 0), 0);
    const W = 1080, H = 1620, X = esc, clip = (t, n) => { t = String(t == null ? '' : t); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
    const FONT = 'PingFang SC, Microsoft YaHei, HarmonyOS Sans SC, Noto Sans CJK SC, Segoe UI, sans-serif';
    const coal = coalSorted.filter(p => p.state === a && p.status !== 'closed').slice(0, 5), maxCoal = Math.max.apply(null, coal.map(p => p.mw || 0).concat([1]));
    const top = leads(ps).slice(0, 8);
    const zones = ZONES_SORTED.filter(z => normState(z.state) === a), lines = LINES.filter(l => l.status !== 'existing' && (l.nodes || []).some(id => NODE[id] && normState(NODE[id].state) === a));
    const chUp = CHANGES ? (CHANGES.status || []).filter(x => x.state === a && x.to === 'committed') : [], chAdd = CHANGES ? (CHANGES.added || []).filter(x => x.state === a) : [];
    const P = [];
    const title = (y, t) => P.push('<text x="60" y="' + y + '" font-size="26" font-weight="800" fill="#e8eefb">' + X(t) + '</text><rect x="60" y="' + (y + 12) + '" width="960" height="2" fill="' + s.color + '" opacity="0.6"/>');
    P.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + FONT + '">');
    P.push('<rect width="' + W + '" height="' + H + '" fill="#060b18"/><rect width="' + W + '" height="196" fill="' + s.color + '" opacity="0.16"/><rect x="0" y="194" width="' + W + '" height="3" fill="' + s.color + '"/>');
    P.push('<text x="60" y="86" font-size="46" font-weight="800" fill="#e8eefb">' + X(s.name) + '<tspan font-size="24" fill="#93a4c4" dx="16">' + a + ' · ' + X(s.en) + '</tspan></text>');
    P.push('<text x="60" y="138" font-size="24" fill="#93a4c4">' + X(en() ? 'Energy market opportunity brief' : '能源市场机会简报') + ' · ' + todayStr().slice(0, 7) + ' · AEMO ' + X(PIPE_ASOF || '') + (COAL_ASOF ? ' · ' + X(en() ? 'coal ' : '煤电 ') + X(COAL_ASOF) : '') + '</text>');
    P.push('<text x="1020" y="86" text-anchor="end" font-size="20" fill="#7b8ca6">' + X(en() ? 'Australia Grid & Energy Map' : '澳洲电网与能源动态地图') + '</text>');
    [[fmtNum(d.n), L_('cProjects'), '#21c7ff'], ['$' + invMag(d.inv), L_('cInv'), '#2ee6a6'], [fmtNum(d.open), L_('cOpen'), '#ffb02e'], [gw(d.coal), L_('cCoal'), '#ff5c7a']].forEach((t, i) => {
      P.push('<g transform="translate(' + (60 + i * 243) + ',226)"><rect width="222" height="104" rx="14" fill="#101a30" stroke="#2a3a5c"/><text x="20" y="56" font-size="34" font-weight="800" fill="' + t[2] + '">' + X(t[0]) + '</text><text x="20" y="86" font-size="17" fill="#93a4c4">' + X(t[1]) + '</text></g>');
    });
    // 管线分档
    let y = 384; title(y, (en() ? 'AEMO pipeline ' : 'AEMO 管线 ') + fmtNum(ps.length) + (en() ? ' records' : ' 条'));
    const mx = Math.max(mwBy('committed'), mwBy('anticipated'), mwBy('proposed'), 1);
    PL_STATUS.forEach((st, i) => { const v = mwBy(st), yy = y + 40 + i * 34; P.push('<text x="60" y="' + (yy + 16) + '" font-size="18" fill="#93a4c4">' + X(plStatusName(st)) + '</text><rect x="190" y="' + yy + '" width="640" height="20" rx="6" fill="#141f38"/><rect x="190" y="' + yy + '" width="' + Math.max(4, Math.round(v / mx * 640)) + '" height="20" rx="6" fill="' + PL_COLOR[st] + '"/><text x="846" y="' + (yy + 16) + '" font-size="18" font-weight="700" fill="#e8eefb">' + X(gw(v)) + '</text>'); });
    // 煤电倒计时（分区纵坐标按实际行数推进，避免重叠）
    y = 486 + 62; title(y, L_('coal'));
    if (!coal.length) P.push('<text x="60" y="' + (y + 44) + '" font-size="18" fill="#7b8ca6">' + X(en() ? 'No operating coal plants' : '无在运煤电') + '</text>');
    coal.forEach((p, i) => { const cd = countdown(p), yy = y + 40 + i * 38, col = coalColor(p); P.push('<rect x="60" y="' + (yy + 4) + '" width="' + Math.max(4, Math.round((p.mw || 0) / maxCoal * 300)) + '" height="22" rx="5" fill="' + col + '" opacity="0.35"/><text x="68" y="' + (yy + 21) + '" font-size="17" font-weight="700" fill="#e8eefb">' + X(clip(p.name, 16)) + '</text><text x="400" y="' + (yy + 21) + '" font-size="16" fill="#93a4c4">' + X(clip(p.owner || '', 16)) + ' · ' + fmtNum(p.mw || 0) + ' MW</text><text x="1020" y="' + (yy + 21) + '" text-anchor="end" font-size="17" font-weight="800" fill="' + col + '">' + X((p.closeYear || '—') + (p.closeMonth ? '-' + String(p.closeMonth).padStart(2, '0') : '') + ' · ' + cd.txt) + '</text>'); });
    // 线索 Top 8
    y = y + 40 + Math.max(1, coal.length) * 38 + 50; title(y, L_('leads').replace('Top 10', 'Top 8').replace('Top 10', 'Top 8'));
    P.push('<text x="60" y="' + (y + 38) + '" font-size="14" fill="#7b8ca6">' + X(en() ? '#  project · fuel · MW · COD · AEMO · EPC · window · product · score' : '#  项目 · 类型 · 装机 · COD · 状态 · EPC · 采购窗口 · 产品 · 线索分') + '</text>');
    top.forEach((it, i) => { const sc = leadScore(it), f = fuelOf(it.fuel), yy = y + 52 + i * 44, tr = trackOf(it.id);
      P.push('<rect x="60" y="' + yy + '" width="960" height="38" rx="8" fill="' + (i % 2 ? '#0c1428' : '#101a30') + '"/><text x="72" y="' + (yy + 25) + '" font-size="16" fill="#7b8ca6">' + (i + 1) + '</text><rect x="96" y="' + (yy + 12) + '" width="12" height="12" rx="2" fill="' + f.color + '" transform="rotate(45 102 ' + (yy + 18) + ')"/>'
        + '<text x="118" y="' + (yy + 25) + '" font-size="17" font-weight="700" fill="#e8eefb">' + X(clip(it.name, 18)) + '</text><text x="430" y="' + (yy + 25) + '" font-size="15" fill="#93a4c4">' + X(clip((en() ? f.en : f.zh) + ' · ' + (mwFmt(it) || '—') + ' · ' + (it.cod || '—') + ' · ' + plStatusName(it.status) + ' · EPC ' + epcName(sc.epc), 46)) + '</text>'
        + '<text x="872" y="' + (yy + 25) + '" font-size="14" fill="#93a4c4">' + X(sc.window ? ymFmt(sc.window.from).slice(2) + '~' + ymFmt(sc.window.to).slice(2) : '—') + (tr ? ' · ' + X(trackStName(tr.st || 'todo')) : '') + '</text><rect x="968" y="' + (yy + 7) + '" width="44" height="24" rx="7" fill="' + (sc.score >= 75 ? 'rgba(46,230,166,0.2)' : 'rgba(255,176,46,0.2)') + '"/><text x="990" y="' + (yy + 24) + '" text-anchor="middle" font-size="16" font-weight="800" fill="' + (sc.score >= 75 ? '#bfe9d8' : '#ffd48a') + '">' + sc.score + '</text>'); });
    // REZ · 输电 · 本季变化
    y = y + 52 + Math.max(1, top.length) * 44 + 46; title(y, en() ? 'REZ · grid works · this quarter' : 'REZ · 输电工程 · 本季变化');
    const facts = [
      (en() ? 'REZ: ' : '可再生能源区：') + zones.length + (en() ? ' zones (' : ' 个（已划定 ') + zones.filter(z => z.status === 'declared').length + (en() ? ' declared) · ' : '）· ') + (zones.slice(0, 4).map(z => (z.ispId ? z.ispId + ' ' : '') + z.name).join('，') || '—'),
      (en() ? 'Transmission building / planned: ' : '在建 / 规划输电工程：') + lines.length + (en() ? ' · ' : ' 项 · ') + (lines.slice(0, 3).map(l => l.name + '（' + (l.type === 'dc' ? 'HVDC ' : '') + l.kv + ' kV）').join('，') || '—'),
      CHANGES ? ((en() ? 'This quarter (' : '本季变化（') + (CHANGES.prevAsOf || '') + ' → ' + CHANGES.asOf + (en() ? '): upgraded to committed ' : '）：升级为承诺 ') + chUp.length + (en() ? ' · added ' : ' 条 · 新增 ') + chAdd.length + (en() ? '' : ' 条') + (chUp.length ? ' · ' + chUp.slice(0, 3).map(x => x.name).join('，') : '')) : (en() ? 'No quarterly change data' : '尚无季度变化数据'),
    ];
    facts.forEach((t, i) => P.push('<text x="60" y="' + (y + 46 + i * 32) + '" font-size="17" fill="#d6e0f5">' + X(clip(t, 64)) + '</text>'));
    // 行动建议
    y = y + 46 + 3 * 32 + 30; title(y, en() ? 'Actions' : '行动建议');
    const acts = [
      en() ? 'Prioritise committed projects scoring ≥75 with pre-tender / undisclosed EPC; BESS → step-up skid / E-house, solar & wind → prefab substation + collector switchgear.' : '优先跟进线索分 ≥75 且 EPC 未招标 / 未公开的承诺项目：储能 → 储能升压一体化舱 / E-house；风光 → 预制舱变电站 + 集电线路开关设备。',
      en() ? 'Awarded EPC → subcontract (substation packages, MV switchgear); coal sites → replacement BESS / gas grid works.' : 'EPC 已授标的项目转为找总包分包（升压站成套、中压柜、预制舱）；煤电退役场址关注替代储能 / 燃气项目的接入改造。',
      sh.vendor ? clip(String(sh.vendor).split(/[。；]/)[0], 60) : (en() ? 'Procurement window = COD −24 → −9 months; plan visits backwards from it.' : '设备定标期在 COD 前 24→9 个月，按采购窗口倒排拜访计划。'),
    ];
    acts.forEach((t, i) => P.push('<text x="60" y="' + (y + 46 + i * 32) + '" font-size="17" fill="#d6e0f5">• ' + X(clip(t, 62)) + '</text>'));
    P.push('<text x="60" y="' + (H - 40) + '" font-size="14" fill="#7b8ca6">' + X((en() ? 'Source: project library + AEMO Generation Information ' : '来源：项目库 + AEMO Generation Information ') + (PIPE_ASOF || '') + (en() ? ' + state grid sheets · scores = product fit × window × status/EPC · verify on the ground · ' : ' + 州电网档案 · 线索分 = 产品匹配 × 采购窗口 × 状态/EPC · 请以实地核实为准 · ') + pageUrl() + '#state=' + a) + '</text>');
    P.push('</svg>');
    return P.join('');
  }
  function downloadBlob(blob, name) {
    try { if (typeof URL === 'undefined' || !URL.createObjectURL || !document.body || !document.body.appendChild) return false; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); if (a.click) a.click(); setTimeout(() => { try { URL.revokeObjectURL(a.href); if (a.remove) a.remove(); } catch (e) { /* ignore */ } }, 600); return true; } catch (e) { return false; }
  }
  function exportStatePoster(a) {
    const svg = buildStateSVG(a); if (!svg) return '';
    const name = 'au-' + normState(a) + '-poster-' + todayStr().slice(0, 7);
    let fell = false;
    const fallback = () => { if (fell) return; fell = true; if (download(name + '.svg', svg, 'image/svg+xml;charset=utf-8')) toast(L_('posterSvg')); };
    try {
      if (typeof Image === 'undefined' || typeof Blob === 'undefined') { fallback(); return svg; }
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => {
        try {
          const sc = 2, cv = document.createElement('canvas'); cv.width = 1080 * sc; cv.height = 1620 * sc;
          const ctx = cv.getContext('2d'); ctx.scale(sc, sc); ctx.drawImage(img, 0, 0, 1080, 1620); URL.revokeObjectURL(url);
          cv.toBlob(b => { if (b && downloadBlob(b, name + '.png')) toast(L_('posterOk')); else fallback(); }, 'image/png');
        } catch (e) { URL.revokeObjectURL(url); fallback(); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); fallback(); };
      img.src = url;
    } catch (e) { fallback(); }
    return svg;
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
    if (!memo('coalList', [stSig(), state.lang].join('|'))) return;
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
    if (!memo('lineList', [state.layers.grid, state.layers.planned, [...state.kvOff].sort().join('~'), stSig(), state.lang].join('|'))) return;
    const ls = LINES.filter(l => l.status !== 'existing' && lineVisible(l)).sort((a, b) => (a.status === 'building' ? 0 : 1) - (b.status === 'building' ? 0 : 1) || (a.year || 9999) - (b.year || 9999));
    el.innerHTML = ls.map(l => { const b = bandOf(l); return '<div class="row" data-line="' + esc(l.id) + '" role="button" tabindex="0"><div class="nm"><span style="color:' + b.color + '">' + (l.type === 'dc' ? 'HVDC' : l.kv + 'kV') + '</span> ' + esc(en() ? (l.en || l.name) : l.name) + '</div><div class="cd ' + (l.status === 'building' ? 'warm' : 'cool') + '">' + L_(l.status) + (l.year ? ' ' + l.year : '') + '</div><div class="meta">' + esc(l.owner || '') + (l.lengthKm ? ' · ' + fmtNum(l.lengthKm) + ' km' : '') + (l.costAud ? ' · ' + esc(l.costAud) : '') + '</div></div>'; }).join('') || '<div class="empty">' + L_('noData') + '</div>';
    el.querySelectorAll('.row').forEach(r => { r.addEventListener('click', () => showLine(r.dataset.line)); r.addEventListener('keydown', e => { if (e.key === 'Enter') showLine(r.dataset.line); }); });
  }
  // 图例折叠状态记在本机（au.legend.v1）：16 行图例在 1366×768 笔记本上盖住西南角的聚合点，看熟了就收成一枚胶囊
  const LEGEND_KEY = 'au.legend.v1';
  let legendOpen = (function () { try { return !(hasLS() && localStorage.getItem(LEGEND_KEY) === '0'); } catch (e) { return true; } })();
  function renderLegend() {
    const el = $('map-legend'), inl = $('legend-inline'); if (!el && !inl) return;
    const html = '<button type="button" class="lg-h" aria-expanded="' + (legendOpen ? 'true' : 'false') + '" title="' + L_('legendToggle') + '">' + L_('legend') + '<span class="lg-caret" aria-hidden="true">▾</span></button><div class="lg-body">'
      + '<div class="lg-kv">' + KV_BANDS.map(b => '<div class="lg-row"><i style="--c:' + b.color + '"></i>' + b.label + '</div>').join('')
      + '<div class="lg-row"><i style="--c:' + DC.color + '"></i>' + DC.label + '</div></div>'
      + '<div class="lg-row"><i class="dash" style="--c:#cfd8ea"></i>' + L_('building') + ' / ' + L_('planned') + '</div>'
      + '<div class="lg-row"><i class="coal" style="--c:#ff5c7a"></i>🏭 ' + (en() ? 'coal · badge = closure year' : '燃煤电厂 · 角标 = 关停年') + '</div>'
      + '<div class="lg-row"><i class="dot" style="--c:#ffb02e"></i>' + (en() ? 'pulsing = EPC pre-tender' : '脉冲圈 = EPC 未招标') + '</div>'
      + '<div class="lg-row"><i class="dia" style="--c:#21c7ff"></i>' + L_('lgPipe') + ' · ' + esc(plStatusName('committed')) + '</div>'
      + '<div class="lg-row"><i class="dia hollow" style="--c:#21c7ff"></i>' + esc(plStatusName('proposed')) + '</div>'
      + '<div class="lg-row"><i class="dia up" style="--c:#21c7ff"></i>' + L_('lgUp') + ' <i class="dia added" style="--c:#21c7ff;margin-left:8px"></i>' + L_('lgAdded') + '</div>'
      + '<div class="lg-row"><i class="zone" style="--c:#2ee6a6"></i>REZ ' + esc(zoneStatusName('declared')) + ' <i class="zone" style="--c:#ffb02e;margin-left:6px"></i>' + esc(zoneStatusName('planned')) + '</div>'
      + '<div class="lg-note">' + L_('legendNote') + '</div></div>';
    if (el) {
      el.innerHTML = html; if (el.classList) el.classList.toggle('collapsed', !legendOpen);
      const t = el.querySelector('.lg-h');
      if (t) t.addEventListener('click', () => { legendOpen = !legendOpen; try { if (hasLS()) localStorage.setItem(LEGEND_KEY, legendOpen ? '1' : '0'); } catch (e) { /* 隐私模式 */ } renderLegend(); });
    }
    if (inl) inl.innerHTML = html.replace(/^<button[^>]*>/, '<div class="lg-h">').replace('</button>', '</div>');   // 窄屏：同一份图例画进左栏「图层」块（标题不是按钮、不折叠）
  }
  function updateCounts(items) {
    const byCat = {}, bySt = {}, byEpc = {};
    items.forEach(p => { byCat[p.cat] = (byCat[p.cat] || 0) + 1; bySt[p.status] = (bySt[p.status] || 0) + 1; byEpc[epcOf(p)] = (byEpc[epcOf(p)] || 0) + 1; });
    document.querySelectorAll('#cat-list .cat-chip').forEach(c => { const n = c.querySelector('.ct'); if (n) n.textContent = byCat[c.dataset.key] || 0; });
    document.querySelectorAll('#status-chips .chip').forEach(c => { const n = c.querySelector('.ct'); if (n) n.textContent = bySt[c.dataset.status] || 0; });
    document.querySelectorAll('#epc-chips .chip').forEach(c => { const n = c.querySelector('.ct'); if (n) n.textContent = byEpc[c.dataset.epc] || 0; });
    const byPl = {}; PIPE.forEach(it => { if (!state.plFuelOff.has(it.fuel) && (state.states.size === 0 || state.states.has(it.state))) byPl[it.status] = (byPl[it.status] || 0) + 1; });
    document.querySelectorAll('#pl-status-chips .chip').forEach(c => { const n = c.querySelector('.ct'); if (n) n.textContent = byPl[c.dataset.pls] || 0; });
    const qbase = PIPE.filter(passPipeBase);
    document.querySelectorAll('#pl-quick-chips .chip').forEach(c => { const q = PL_QUICK.find(x => x.key === c.dataset.plq); const n = c.querySelector('.ct'); if (q && n) n.textContent = qbase.filter(q.fn).length; });
    // 🗓️ COD 时间轴标签：关闭 = 全部年份；打开 = COD ≤ Y · 无 COD 的 N 条已隐藏（N 按其余筛选算）
    const cl = $('cod-lab');
    if (cl) {
      if (!state.codMax) cl.textContent = L_('codAll');
      else { const saved = state.codMax; state.codMax = null; const noCod = PIPE.filter(it => passPipeBase(it) && !it.codYear).length; state.codMax = saved; cl.textContent = L_('codLab').replace('{y}', saved).replace('{n}', noCod); }
    }
  }
  /* ---------- 🗓️ COD 时间轴 ▶ 播放：从今年起逐年累计显示，当年投运的管线闪白框 + 大字年份 ---------- */
  let _play = null;
  function startPlay() {
    pausePlay();
    state.codMax = COD_MIN; state.playYear = COD_MIN; syncUI(); render();
    _play = setInterval(() => {
      if (state.codMax >= COD_MAX - 1) { pausePlay(); state.codMax = null; syncUI(); render(); return; }   // 播到最后一年回到「全部」
      state.codMax += 1; state.playYear = state.codMax; syncUI(); render();
    }, REDUCED_MOTION ? 1600 : 1200);
    syncUI();
  }
  function pausePlay() { if (_play) { clearInterval(_play); _play = null; } state.playYear = null; syncUI(); }

  function render() {
    const items = filtered();
    const pitems = filteredPipe();
    restyleGeo(); renderRez(); renderGrid(); renderCoal(); renderProjects(items); renderPipe(pitems);
    kpis(items, pitems); renderLeads(pitems); renderCoalList(); renderOpps(items); renderCatBars(items); renderLineList(); renderPipeStats(pitems); renderZoneList(); renderChangesBlock(); updateCounts(items);
    writeHash();
    fitTopbar(false);   // KPI 数字变宽时只允许升档（去副标 / 换行），不降档，筛选时顶栏高度不来回跳
  }

  /* ---------- 卡片 ---------- */
  const cardEl = $('card'), appEl = $('app');
  const appFlag = (cls, on) => { if (appEl && appEl.classList) appEl.classList.toggle(cls, !!on); };   // .app.card-open / .drawer-open：窄屏隐藏浮钮
  function hideCard() { if (cardEl && cardEl.classList) cardEl.classList.remove('show'); appFlag('card-open', false); state.card = null; writeHash(); }
  function openCard(html, kind, id) {
    if (!cardEl) return;
    closeDrawers();   // 窄屏：底部抽屉会盖住底部卡片，开卡先收抽屉
    cardEl.innerHTML = html; if (cardEl.classList) cardEl.classList.add('show'); appFlag('card-open', true);
    try { cardEl.scrollTop = 0; } catch (e) { /* stub */ }
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
    cardEl.querySelectorAll('[data-brief]').forEach(b => b.addEventListener('click', () => exportStateBrief(b.dataset.brief)));
    cardEl.querySelectorAll('[data-poster]').forEach(b => b.addEventListener('click', () => exportStatePoster(b.dataset.poster)));
    cardEl.querySelectorAll('[data-tr-save]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.trSave; const v = k => { const e = $(k); return e ? e.value : ''; }; setTrack(id, { st: v('tr-st'), who: v('tr-who'), next: v('tr-next'), note: v('tr-note') }); toast(L_('trackSaved')); render(); showPipe(id, { noFly: true }); }));
    cardEl.querySelectorAll('[data-tr-del]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.trDel; delTrack(id); toast(L_('trackDeleted')); render(); showPipe(id, { noFly: true }); }));
    cardEl.querySelectorAll('[data-more]').forEach(b => b.addEventListener('click', () => { const ul = b.previousElementSibling; if (!ul || !ul.classList) return; const open = ul.classList.toggle('open'); b.textContent = open ? L_('less') : L_('more').replace('{n}', b.dataset.more); }));
    writeHash();
  }
  const cell = (k, v) => '<div class="d-cell"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  const head = (color, tag, name, alt, extra) => '<div class="d-top"><button class="d-close" id="c-close" aria-label="' + L_('closeA') + '">×</button><button class="d-share" id="c-share" aria-label="' + L_('shareA') + '" title="' + L_('shareA') + '">🔗</button>'
    + '<span class="d-cat" style="background:' + hexA(color, 0.14) + ';color:' + color + '">' + tag + '</span>' + (extra || '') + '<div class="d-name">' + name + '</div>' + (alt ? '<div class="d-en">' + alt + '</div>' : '') + '</div>';
  const sec = (title, body) => body ? '<div class="d-sec"><h4>' + title + '</h4>' + body + '</div>' : '';
  const srcList = srcs => (srcs && srcs.length) ? '<ul class="src">' + srcs.map(s => /^https?:/.test(s) ? '<li><a href="' + esc(s) + '" target="_blank" rel="noopener">' + esc(s.replace(/^https?:\/\//, '').slice(0, 70)) + '</a></li>' : '<li>' + esc(s) + '</li>').join('') + '</ul>' : '';
  const paras = txt => txt ? String(txt).split(/\n+/).map(x => '<p>' + esc(x) + '</p>').join('') : '';
  // 长段落（州政策 / 设备商必读 / 煤电退出：单段 700–2,200 字）按句切成要点，默认只展开前 n 条，其余「展开」——卡片里不再是一面文字墙
  function clampList(txt, n) {
    if (!txt) return '';
    const items = String(txt).split(/\n+/).reduce((a, par) => a.concat(par.replace(/([。！？!?])\s*/g, '$1\u0000').split('\u0000')), []).map(s => s.trim()).filter(s => s.length > 1);
    if (items.length <= 1) return paras(txt);
    n = n || 3;
    return '<ul class="d-bul">' + items.map((s, i) => '<li' + (i >= n ? ' class="hid"' : '') + '>' + esc(s) + '</li>').join('') + '</ul>'
      + (items.length > n ? '<button class="d-more" data-more="' + (items.length - n) + '">' + L_('more').replace('{n}', items.length - n) + '</button>' : '');
  }

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
    const html = head(f.color, f.icon + ' ' + esc(en() ? f.en : f.zh) + ' · ' + esc(stShort(it.state)), esc(en() ? it.en : it.name), esc(en() ? it.name : it.en), '<span class="tag ' + it.status + '">' + esc(plStatusName(it.status)) + '</span>' + (UPGRADED.has(it.id) ? ' <span class="tag cool">' + L_('upTag') + '</span>' : '') + (windowOpen(it) ? ' <span class="tag warm">' + L_('quickWin') + '</span>' : ''))
      + '<div class="d-grid">' + cell(L_('pMw'), esc(mwFmt(it) || '—') + (it.siteMw ? ' · ' + L_('pSiteMw') + ' ' + fmtNum(it.siteMw) + ' MW' : '')) + cell(L_('pCod'), esc(it.cod || '—')) + cell(L_('pOwner'), esc(it.owner || '—')) + cell(L_('pAemo'), esc(plStatusName(it.status)) + (it.region ? ' · ' + esc(it.region) : '') + (it.kci ? ' · KCI ' + esc(it.kci) : ''))
      + cell(L_('pConn'), esc([it.connNode, it.tnsp].filter(Boolean).join(' · ') || '—')) + cell(L_('pRez'), z ? '<span class="d-link" data-zone="' + esc(z.key) + '">' + esc(en() ? (z.en || z.name) : z.name) + ' ▸</span>' : esc(it.rez || '—')) + '</div>'
      + (function () { const s = leadScore(it); return '<div class="d-strip" style="border-color:rgba(46,230,166,0.4);background:rgba(46,230,166,0.07)"><span class="dp-tag" style="color:#bfe9d8">🎯 ' + L_('lScore') + ' ' + s.score + '</span>' + esc(en() ? s.product.en : s.product.zh) + ' · ' + L_('lWindow') + ' ' + (s.window ? ymFmt(s.window.from) + ' ~ ' + ymFmt(s.window.to) : '—') + ' · EPC ' + esc(epcName(s.epc)) + '</div>'; })()
      + (function () {   // 📋 本机跟进记录：状态 / 负责人 / 下次动作 / 备注
        const tr = trackOf(it.id);
        const opt = '<option value="">' + L_('unassigned') + '</option>' + TRACK_ST.map(x => '<option value="' + x[0] + '"' + (tr && tr.st === x[0] ? ' selected' : '') + '>' + esc(en() ? x[2] : x[1]) + '</option>').join('');
        return '<div class="d-track"><div class="dt-h"><span class="dp-tag">📋 ' + L_('track') + '</span>' + (tr ? (tr.st ? '<span class="tag tr-' + tr.st + '">' + esc(trackStName(tr.st)) + '</span>' : '') + (tr.next ? '<small' + (dueIn(tr, 7) ? ' style="color:#ffb3c1;font-weight:700"' : '') + '>⏰ ' + esc(tr.next) + '</small>' : '') + (tr.t ? '<small>· ' + esc(tr.t) + '</small>' : '') : '<small>' + L_('trackNone') + '</small>') + '</div>'
          + '<div class="dt-row"><select id="tr-st" aria-label="' + L_('track') + '">' + opt + '</select><input id="tr-who" placeholder="' + L_('trackWho') + '" value="' + esc(tr && tr.who || '') + '" maxlength="80" aria-label="' + L_('trackWho') + '"><input id="tr-next" type="date" value="' + esc(tr && tr.next || '') + '" aria-label="' + L_('trackNext') + '"></div>'
          + '<textarea id="tr-note" rows="2" maxlength="600" placeholder="' + L_('trackNote') + '" aria-label="' + L_('trackNote') + '">' + esc(tr && tr.note || '') + '</textarea>'
          + '<div class="dt-act"><button data-tr-save="' + esc(it.id) + '">' + L_('trackSave') + '</button>' + (tr ? '<button data-tr-del="' + esc(it.id) + '">' + L_('trackDel') + '</button>' : '') + '<small>' + L_('trackLocal') + '</small></div></div>';
      })()
      + (it.approx ? '<div class="d-strip" style="border-color:rgba(255,176,46,0.45);background:rgba(255,176,46,0.08)">' + L_('pApprox') + '</div>' : '')
      + (it.tech ? '<div class="d-strip"><span class="dp-tag">' + L_('pFuel') + '</span>' + esc(it.tech) + (it.locality ? ' · ' + esc(it.locality) : '') + '</div>' : '')
      + (it.mix ? '<div class="d-strip"><span class="dp-tag">' + L_('pMix') + '</span>' + Object.keys(it.mix).map(f => { const ff = fuelOf(f); return ff.icon + ' ' + esc(en() ? ff.en : ff.zh) + ' ' + fmtNum(it.mix[f]) + ' MW'; }).join(' + ') + '</div>' : '')
      + sec(L_('kNotes'), paras(it.notes)) + sec(L_('kSources'), srcList(it.sources))
      + '<div class="d-actions"><button data-fly="ll:' + it.coord[0] + ':' + it.coord[1] + ':9">' + L_('fly') + '</button>' + (pj ? '<button data-pid="' + pj.id + '">📍 ' + (en() ? 'Project card' : '项目详情') + '</button><a href="coach.html#project=' + pj.id + '" target="_blank" rel="noopener">' + L_('lCoach') + '</a>' : '') + '<button data-st-open="' + it.state + '">' + (en() ? '📄 State sheet' : '📄 州档案') + '</button></div>';
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
      + '<div class="d-actions"><button data-fly="st:' + a + '">' + L_('fly') + '</button><button data-st-filter="' + a + '">' + L_('filterSt') + '</button><button data-brief="' + a + '" title="' + esc(en() ? 'One-page Markdown brief for HQ: KPIs, coal exit, top leads, pre-tender projects, owners, grid works, REZ, this quarter' : '一页 Markdown 简报（向总部汇报）：关键数字、煤电退役、线索 Top 10、EPC 未招标、重点业主、输电工程、REZ、本季变化') + '">' + L_('stBrief') + '</button><button data-poster="' + a + '" title="' + esc(en() ? 'One-page PNG infographic (1080×1620): KPIs, pipeline, coal countdown, top leads, REZ / grid / this quarter, actions' : '一页 PNG 信息图（1080×1620，可直接发微信）：关键数字、管线分档、煤电倒计时、线索 Top 8、REZ / 输电 / 本季变化、行动建议') + '">' + L_('stPoster') + '</button></div>'
      + (sh ? (sh.summary ? '<div class="d-strip">' + esc(sh.summary) + '</div>' : '')
        + sec(L_('kGrid'), '<p>' + esc(sh.grid || '') + (sh.operator ? ' · ' + esc(sh.operator) : '') + '</p>')
        + sec(L_('kTnsp'), sh.tnsp ? '<p><b>' + esc(sh.tnsp.name) + '</b>' + (sh.tnsp.owner ? ' · ' + esc(sh.tnsp.owner) : '') + (sh.tnsp.voltages ? ' · ' + esc(sh.tnsp.voltages) : '') + '</p>' + paras(sh.tnsp.notes) : '')
        + sec(L_('kDnsp'), dnsps)
        + sec(L_('kRez'), '<p>' + esc(sh.rezBody || '') + '</p>' + ((sh.rezs || []).length ? '<p>' + sh.rezs.map(r => '<span class="tag">' + esc(r) + '</span>').join('') + '</p>' : ''))
        + sec(L_('kPolicy'), clampList(sh.policy, 3)) + sec(L_('kCoalExit'), clampList(sh.coalExit, 2) + coalRows)
        + sec(L_('kProjects'), proj) + sec(L_('kVendor'), clampList(sh.vendor, 3))
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
    const se = $('pl-status-chips'), fe = $('pl-fuel-chips'), qe = $('pl-quick-chips');
    if (qe) {
      qe.innerHTML = PL_QUICK.map(q => '<button class="chip pq-' + q.key + (state[q.st] ? ' on' : '') + '" data-plq="' + q.key + '" aria-pressed="' + (state[q.st] ? 'true' : 'false') + '" title="' + esc(q.key === 'win' ? L_('quickHint') : '') + '">' + L_(q.t) + '<span class="ct">0</span></button>').join('');
      qe.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const q = PL_QUICK.find(x => x.key === b.dataset.plq); if (!q) return; state[q.st] = !state[q.st]; syncUI(); render(); }));
    }
    if (se) {
      se.innerHTML = PL_STATUS.map(st => '<button class="chip pls-' + st + (state.plStatus.has(st) ? ' on' : '') + '" data-pls="' + st + '" aria-pressed="' + (state.plStatus.has(st) ? 'true' : 'false') + '"><span class="fi" style="--c:' + PL_COLOR[st] + '"></span>' + esc(plStatusName(st)) + '<span class="ct">0</span></button>').join('');
      se.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const k = b.dataset.pls; if (state.plStatus.has(k)) state.plStatus.delete(k); else state.plStatus.add(k); syncUI(); render(); }));
    }
    if (fe) {
      fe.innerHTML = FUELS.filter(f => f.key !== 'coal').map(f => '<button class="chip' + (state.plFuelOff.has(f.key) ? '' : ' on') + '" data-plf="' + f.key + '" aria-pressed="' + (state.plFuelOff.has(f.key) ? 'false' : 'true') + '"><span class="fi" style="--c:' + f.color + '"></span>' + f.icon + ' ' + esc(en() ? f.en : f.zh) + '</button>').join('');
      fe.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { const k = b.dataset.plf; if (state.plFuelOff.has(k)) state.plFuelOff.delete(k); else state.plFuelOff.add(k); syncUI(); render(); }));
    }
  }
  function buildBasemap() {
    const el = $('bm-chips'); if (!el) return;
    el.innerHTML = '<span class="bm-lab">' + L_('basemap') + '</span>' + BASES.map(b => '<button class="chip' + (activeBase && activeBase.key === b.key ? ' on' : '') + '" data-bm="' + b.key + '" aria-pressed="' + (activeBase && activeBase.key === b.key ? 'true' : 'false') + '">' + esc(en() ? b.en : b.zh) + '</button>').join('');
    el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { applyBase(b.dataset.bm); writeHash(); }));
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
    const fl = $('fab-filters'), fd = $('fab-dash');
    if (fl) fl.addEventListener('click', () => toggleDrawer('left'));
    if (fd) fd.addEventListener('click', () => toggleDrawer('right'));
    const bd = $('drawer-backdrop'); if (bd) bd.addEventListener('click', closeDrawers);
    document.querySelectorAll('.drawer-close').forEach(b => b.addEventListener('click', closeDrawers));
    // 把手下滑 ≥48px 也收起抽屉（触屏习惯）
    document.querySelectorAll('.drawer-head').forEach(h => {
      let y0 = null;
      h.addEventListener('touchstart', e => { y0 = e.touches && e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
      h.addEventListener('touchend', e => { const t = e.changedTouches && e.changedTouches[0]; if (y0 != null && t && t.clientY - y0 > 48) closeDrawers(); y0 = null; }, { passive: true });
    });
    const kt = $('kpi-toggle'), tb = document.querySelector('.topbar');
    if (kt && tb && tb.classList) kt.addEventListener('click', () => { const open = tb.classList.toggle('kpis-open'); kt.setAttribute('aria-expanded', open ? 'true' : 'false'); setTimeout(() => { try { map.invalidateSize(); } catch (e) { /* stub */ } }, 230); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (state.view) closeModal(); else if (state.card) hideCard(); else closeDrawers(); } });
    const bl = $('btn-leads'), bl2 = $('btn-leads-more'), ba = $('btn-accounts'), bc = $('btn-changes'), bc2 = $('btn-changes-more');
    if (bl) bl.addEventListener('click', showLeads); if (bl2) bl2.addEventListener('click', showLeads);
    if (ba) ba.addEventListener('click', () => showAccounts('owner'));
    if (bc) bc.addEventListener('click', showChanges); if (bc2) bc2.addEventListener('click', showChanges);
    if (modalEl) modalEl.addEventListener('click', e => { if (e && e.target === modalEl) closeModal(); });
    const op = $('pl-owner-pill'); if (op) op.addEventListener('click', () => { state.plOwner = null; syncUI(); render(); });
    // 🗓️ COD 时间轴：拖动 = 手动截止年（拉到最右 = 关闭）；▶ / ⏸ 播放
    const cr = $('cod-range'), cp = $('cod-play'), crow = $('cod-row');
    if (crow) crow.title = L_('codTitle');
    if (cr) cr.addEventListener('input', () => { const y = +cr.value; pausePlay(); state.codMax = y >= COD_MAX ? null : y; syncUI(); render(); });   // 先读值再 pausePlay（它会 syncUI 回写滑块）
    if (cp) cp.addEventListener('click', () => { if (_play) { pausePlay(); writeHash(); } else startPlay(); });
  }
  /* ---------- 窄屏抽屉（🔍 筛选 / 📊 看板）：遮罩 + 关闭钮 + 把手下滑；开卡 / 开宽面板时自动收起 ---------- */
  function closeDrawers() {
    ['left-panel', 'right-panel'].forEach(id => { const el = $(id); if (el && el.classList) el.classList.remove('open'); });
    const bd = $('drawer-backdrop'); if (bd && bd.classList) bd.classList.remove('show');
    ['fab-filters', 'fab-dash'].forEach(id => { const b = $(id); if (b && b.setAttribute) b.setAttribute('aria-expanded', 'false'); });
    appFlag('drawer-open', false);
  }
  function toggleDrawer(side) {
    const el = $(side === 'left' ? 'left-panel' : 'right-panel'), other = $(side === 'left' ? 'right-panel' : 'left-panel'), fab = $(side === 'left' ? 'fab-filters' : 'fab-dash');
    if (!el || !el.classList) return;
    const willOpen = !el.classList.contains('open');
    if (other && other.classList) other.classList.remove('open');
    el.classList.toggle('open', willOpen);
    const bd = $('drawer-backdrop'); if (bd && bd.classList) bd.classList.toggle('show', willOpen);
    if (fab && fab.setAttribute) fab.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    appFlag('drawer-open', willOpen);
    if (willOpen && state.card) hideCard();   // 窄屏下底部抽屉与底部卡片共用一个槽位
  }
  function resetState() {
    state.states = new Set(); state.cats = new Set(CAT_KEYS); state.statuses = new Set(); state.epc = new Set(); state.epcOnly = false;
    state.minYear = MIN_YEAR; state.maxYear = MAX_YEAR; state.recentOnly = false; state.q = ''; state.kvOff = new Set();
    state.layers = { grid: true, planned: true, nodes: true, coal: true, projects: true, fill: true, pipe: true, rez: true, changes: true };
    state.plStatus = new Set(['committed', 'anticipated']); state.plFuelOff = new Set(); state.plOwner = null;
    pausePlay(); state.codMax = null;
    state.plWin = false; state.plHot = false; state.plUp = false; state.plMine = false;
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
    document.querySelectorAll('#pl-quick-chips .chip').forEach(c => { const q = PL_QUICK.find(x => x.key === c.dataset.plq); const on = !!(q && state[q.st]); c.classList.toggle('on', on); pressed(c, on); });
    const cr = $('cod-range'), cp = $('cod-play'), ct = $('cod-ticker');
    if (cr) { cr.min = COD_MIN; cr.max = COD_MAX; cr.value = state.codMax || COD_MAX; }
    if (cp) { cp.textContent = _play ? '⏸' : '▶'; cp.title = _play ? L_('codPause') : L_('codPlay'); if (cp.classList) cp.classList.toggle('on', !!_play); pressed(cp, !!_play); }
    if (ct) { if (state.playYear) { ct.innerHTML = esc(String(state.playYear)) + '<small>' + L_('codTick') + '</small>'; ct.hidden = false; if (ct.removeAttribute) ct.removeAttribute('hidden'); } else { ct.hidden = true; if (ct.setAttribute) ct.setAttribute('hidden', ''); } }
    const preset = state.recentOnly ? 'recent' : (state.minYear > MIN_YEAR ? 'future' : 'all');
    document.querySelectorAll('#year-presets .chip').forEach(c => { const on = c.dataset.preset === preset; c.classList.toggle('on', on); pressed(c, on); });
    const orow = $('pl-owner-row'), opill = $('pl-owner-pill');
    if (orow) { orow.hidden = !state.plOwner; if (state.plOwner && orow.removeAttribute) orow.removeAttribute('hidden'); else if (!state.plOwner && orow.setAttribute) orow.setAttribute('hidden', ''); }
    if (opill && state.plOwner) { const g = buildAccounts(PIPE.filter(it => ownerKeyOf(it) === state.plOwner))[0]; opill.textContent = L_('ownerPill') + ' ' + (g ? g.name : state.plOwner) + ' ✕'; }
  }
  // 顶栏「数据截至」胶囊：AEMO 管线表季度版本 + 煤电关停表；管线落后 >4 个月变黄（AEMO 每季度发新表）
  const ageMonths = ym => { const m = String(ym || '').match(/^(\d{4})-(\d{2})$/); return m ? (NOW.getFullYear() - +m[1]) * 12 + (NOW.getMonth() + 1 - +m[2]) : null; };
  /* ---------- 顶栏自适应：副标 → 去副标 → KPI 换到第二行，按内容实测而不是视口断点 ----------
   * 中英文标签、按钮数、系统字体都会改变顶栏内容宽度，媒体查询断点总有某种组合让最后一个 KPI 滑到 📅 AEMO 胶囊底下
   * （旧断点下中文 1501–1680px、英文 1401–1920px 都中招）。这里直接量：.kpis 内容溢出自己的盒子（= 压到操作条底下）或副标被截断，就升一档。
   * full=true（初始化 / resize / 切语言）从头量；full=false（render 后 KPI 数字变宽）只升不降。≤900 手机档交给 CSS。
   * 顶栏高度变了地图容器就变了，但没有 window resize，Leaflet 不会自己 invalidateSize —— 下面用 ResizeObserver 盯住容器。 */
  const topbarEl = document.querySelector('.topbar');
  function fitTopbar(full) {
    const tb = topbarEl, kp = $('kpis'), sub = $('t-sub');
    if (!tb || !tb.classList || !kp || typeof kp.scrollWidth !== 'number') return;
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) { tb.classList.remove('no-sub', 'kpi-wrap'); return; }
    const over = e => !!e && typeof e.scrollWidth === 'number' && e.scrollWidth - e.clientWidth > 1;
    const fits = () => !over(kp) && !(!tb.classList.contains('no-sub') && over(sub));
    if (full) tb.classList.remove('no-sub', 'kpi-wrap');
    if (!tb.classList.contains('kpi-wrap') && !fits()) { tb.classList.add('no-sub'); if (!fits()) tb.classList.add('kpi-wrap'); }
  }
  let _fitRaf = 0;
  const raf = fn => (window.requestAnimationFrame ? window.requestAnimationFrame(fn) : setTimeout(fn, 16));
  if (window.addEventListener) window.addEventListener('resize', () => { if (_fitRaf) return; _fitRaf = raf(() => { _fitRaf = 0; fitTopbar(true); }); });
  if (typeof ResizeObserver === 'function') { try { const mw = $('map'); if (mw) new ResizeObserver(() => { try { map.invalidateSize(); } catch (e) { /* stub */ } }).observe(mw); } catch (e) { /* 老浏览器 */ } }
  function renderFresh() {
    const el = $('fresh-pill'); if (!el) return;
    const age = ageMonths(PIPE_ASOF), stale = age != null && age > 4;
    el.textContent = (stale ? '⚠ ' : '📅 ') + 'AEMO ' + (PIPE_ASOF || '—');
    el.title = L_('fresh') + '：AEMO Generation Information ' + (PIPE_ASOF || '—') + (age != null ? '（' + (stale ? L_('freshStale').replace('{n}', age) : (en() ? age + ' months ago' : age + ' 个月前')) + '）' : '') + (COAL_ASOF ? ' · ' + (en() ? 'coal closures ' : '煤电关停表 ') + COAL_ASOF : '') + ' · ' + (en() ? 'project library ' : '项目库 ') + (META.lastUpdated || '—');
    if (el.classList) el.classList.toggle('stale', !!stale);
  }
  function applyLang() {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    renderFresh();
    set('t-title', L_('title')); set('t-sub', L_('sub')); set('lab-proj', L_('proj')); set('lab-inv', L_('inv')); set('lab-open', L_('open')); set('lab-open-inv', L_('openInv')); set('lab-coal', L_('coalKpi'));
    set('states-hint', L_('statesHint')); set('t-layers', L_('layers')); set('epc-hint', L_('epcHint')); set('btn-epc-open', L_('epcOpen')); set('t-cats', L_('cats')); set('t-status', L_('status')); set('t-year', L_('year'));
    set('btn-reset', L_('reset')); set('btn-world', L_('world')); set('t-mix', L_('mix')); set('t-lines', L_('lines')); set('fab-filters', L_('filters')); set('fab-dash', L_('dash'));
    set('drawer-title-l', L_('filters')); set('drawer-title-r', L_('dash')); set('drawer-close-l', L_('drawerClose')); set('drawer-close-r', L_('drawerClose')); set('kpi-toggle', L_('kpiToggle'));
    set('lab-pipe', L_('pipeKpi')); set('pipe-hint', L_('pipeHint'));
    set('btn-leads', L_('leadsBtn')); set('btn-accounts', L_('accBtn')); set('btn-changes', L_('chBtn')); set('btn-leads-more', L_('leadsMore')); set('btn-changes-more', L_('chMore'));
    const tt = (id, k, keep) => { const el = $(id); if (!el) return; const c = el.querySelector('.count'); el.textContent = L_(k) + ' '; if (keep && c) el.appendChild(c); };
    tt('t-states', 'states', true); tt('t-epc', 'epc', true); tt('t-coal', 'coal', true); tt('t-opps', 'opps', true); tt('t-pipe', 'pipeT', true); tt('t-pipe-r', 'pipeR', true); tt('t-zones', 'zones', true); tt('t-leads', 'leads', true); tt('t-changes', 'chT2', true);
    const q = $('q'); if (q) q.placeholder = L_('search');
    const lg = $('btn-lang'); if (lg) lg.textContent = en() ? '中' : 'EN';
    document.querySelectorAll('#layer-chips .chip').forEach(c => { c.textContent = L_({ grid: 'lgGrid', planned: 'lgPlanned', nodes: 'lgNodes', coal: 'lgCoal', projects: 'lgProj', fill: 'lgFill', pipe: 'lgPipe', rez: 'lgRez', changes: 'lgChanges' }[c.dataset.layer]); });
    document.querySelectorAll('#year-presets .chip').forEach(c => { c.textContent = L_({ all: 'all', recent: 'recent', future: 'future' }[c.dataset.preset]); });
    buildCats(); buildStatus(); buildEpc(); buildPipeChips(); buildBasemap(); renderStateList(); renderLegend(); syncUI(); render();
    if (state.card) { const c = state.card; if (c.kind === 'project') showDetail(c.id, { noFly: true }); else if (c.kind === 'coal') showCoal(c.id, { noFly: true }); else if (c.kind === 'state') showState(c.id, { noFly: true }); else if (c.kind === 'line') showLine(c.id, { noFly: true }); else if (c.kind === 'pipe') showPipe(c.id, { noFly: true }); else if (c.kind === 'zone') showZone(c.id, { noFly: true }); }
    if (state.view) openView(state.view);
    fitTopbar(true);   // 标签宽度变了，从头量
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
    if (state.plWin) p.set('plw', '1'); if (state.plHot) p.set('plh', '1'); if (state.plUp) p.set('plu', '1'); if (state.plMine) p.set('plm', '1');
    if (state.codMax) p.set('cod', String(state.codMax));
    if (state.lang === 'en') p.set('lang', 'en');
    if (state.basemap && state.basemap !== BASE_DEFAULT) p.set('bm', state.basemap);
    if (state.plOwner) p.set('own', state.plOwner);
    if (state.view) p.set('view', state.view);
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
    if (p.has('plw')) state.plWin = true; if (p.has('plh')) state.plHot = true; if (p.has('plu')) state.plUp = true; if (p.has('plm')) state.plMine = true;
    if (p.has('cod')) { const y = +p.get('cod'); if (y >= COD_MIN && y < COD_MAX) state.codMax = y; }
    if (p.get('lang') === 'en') state.lang = 'en';
    if (p.has('bm') && BASES.some(b => b.key === p.get('bm'))) state.basemap = p.get('bm');
    if (p.has('own')) state.plOwner = p.get('own') || null;
    if (p.has('view') && ['leads', 'accounts', 'epc', 'changes'].indexOf(p.get('view')) >= 0) state.view = p.get('view');
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
  applyBase(state.basemap || BASE_DEFAULT); buildBasemap(); renderFresh(); fitTopbar(true);
  if (state.lang === 'en') applyLang(); else { syncUI(); render(); }
  if (state.states.size === 1) flyToState([...state.states][0]);
  else if (!pendingCard) { try { map.invalidateSize(); } catch (e) { /* stub */ } fitAU(); }   // 顶栏换行后地图矮了 41px：按最终尺寸重新套住大陆
  if (pendingCard) {
    const c = pendingCard;
    if (c.kind === 'project') showDetail(c.id); else if (c.kind === 'coal') showCoal(c.id); else if (c.kind === 'state') showState(c.id); else if (c.kind === 'line') showLine(c.id); else if (c.kind === 'pipe') showPipe(c.id); else if (c.kind === 'zone') showZone(c.id);
  }
  if (state.view && state.lang !== 'en') openView(state.view);   // EN 时 applyLang() 已按 state.view 打开

  window.__AU__ = { map, state, PROJECTS, LINES, NODE, COAL, STATES, PIPE, ZONES, ZONE_STAT, CHANGES, render, filtered, filteredPipe, stateOf, zoneOf, countdown, showDetail, showCoal, showState, showLine, showPipe, showZone, stateToHash, applyHash, applyLang, resetState, syncUI, kpis, stateStats,
    leadScore, leads, leadsCSV, exportLeadsCSV, epcHintOf, ownerGroup, buildAccounts, buildEpcAccounts, filterOwner, showLeads, showAccounts, showChanges, buildChangesBrief, exportBrief, buildStateBrief, exportStateBrief, openModal, closeModal, openView,
    windowOpen, UPGRADED, PL_QUICK, passPipeBase, normTnsp, renderFresh, applyBase, BASES, closeDrawers, toggleDrawer, clampList,
    TRACK, TRACK_ST, trackOf, setTrack, delTrack, trackCounts, trackActive, dueIn, exportTrack, importTrackText,
    COD_MIN, COD_MAX, ADDED, startPlay, pausePlay, buildStateSVG, exportStatePoster };
})();
