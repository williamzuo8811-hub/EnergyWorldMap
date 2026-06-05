/* ============================================================
 * 特锐德 / 特来电 核心产品 → 能源项目「适配匹配」层
 * ------------------------------------------------------------
 * 把特锐德 6 大核心产品线（模块化预制舱变电站 / 车载移动变电站 /
 * 算电岛 AI PowerHouse 算力中心高压交直流预制舱供电站 / E-house 预制电气房 /
 * 中低压成套·配网 / 储能并网舱）按「项目场景」映射到全量项目上，
 * 供 app.js 的「🔌 产品适配看板」与详情卡的产品适配块使用。
 *
 *   key       产品键
 *   zh / en   产品名（中 / 英）
 *   icon      图标
 *   color     主题色（看板进度条 / 详情卡芯片）
 *   core      是否核心拳头产品
 *   blurb     产品一句话定位
 *   scenario  典型适配场景
 *   pitch     推荐打法（BD 切入）
 *   cats      命中的项目品类（CATEGORIES 键）
 *   kw        命中的关键词（在 name/cap/desc 上做包含匹配，跨品类补充）
 *
 * match(p) → 该项目适配的产品键数组（按 PRODUCTS 顺序）。
 *   · cat==='client'（国际大客户横切视图）返回 []：客户项目的产品契合
 *     已由 CLIENT_META（公司级）在详情卡 BD 画像中展示，避免重复 / 重复计。
 *
 * 双导出：浏览器挂到 window.ENERGY_PRODUCTS；Node 走 module.exports
 * （供 scripts/test-products.js 单测、scripts/test-smoke.js 冒烟）。
 * 此文件为「BD 元数据」，与 clients-meta.js 同性质——不是项目数据，
 * 不受 scripts/validate-data.js 约束。
 * ============================================================ */
;(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ENERGY_PRODUCTS = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PRODUCTS = [
    {
      key: 'prefab', zh: '模块化预制舱变电站', en: 'Prefab Substation', icon: '🏭', color: '#21c7ff', core: true,
      blurb: '工厂预制、现场即装的升压 / 变电整体方案',
      blurbEn: 'Factory-prefab boost & substation skid',
      scenario: '风光电站升压并网、输变电、变电站新建 / 扩建',
      scenarioEn: 'Renewable boost-up & grid interconnection, T&D, new substations',
      pitch: '按电压等级做标准化升压站 / 变电站方案包，先做技术交流与入库',
      pitchEn: 'Standardised boost-station packages by voltage class; lead with tech review & vendor listing',
      cats: ['renewable', 'nuclear', 'grid'],
      kw: ['升压站', '变电站', '开关站', '输变电', '并网', '换流站', '送出'],
    },
    {
      key: 'mobile', zh: '车载移动变电站', en: 'Mobile Substation', icon: '🚚', color: '#ff7a18', core: true,
      blurb: '可快速部署的车载 / 移动应急变电单元',
      blurbEn: 'Rapidly deployable vehicle-mounted / emergency substation',
      scenario: '矿山保供电、施工期临电、电网应急抢修、偏远站场',
      scenarioEn: 'Mine power continuity, construction temp-power, grid emergency restore, remote sites',
      pitch: '用「减少停产损失 / 快速恢复供电」价值切入，适配弱电网与偏远项目',
      pitchEn: 'Lead with downtime-loss & fast-restore value; fits weak-grid & remote projects',
      cats: ['mining', 'transport'],
      kw: ['矿', '施工', '临时', '应急', '营地', '保供电', '抢修', '偏远', '微网'],
    },
    {
      key: 'aipower', zh: '算电岛 AI PowerHouse', en: 'AI PowerHouse', icon: '🧠', color: '#2ee6a6', core: true,
      blurb: '算力中心高压交直流预制舱供电站（特锐德全球首创）',
      blurbEn: 'HV AC/DC prefab-cabin power station for compute centers (world-first)',
      scenario: '数据中心 / 智算中心 / AI 算力园区供配电',
      scenarioEn: 'Data centers, AI compute centers & intelligent-computing parks',
      pitch: '以「220kV 高压接入 + 800V 直流直供机房 + 167 模块积木式建站」切入算力中心供电',
      pitchEn: 'Lead with 220kV HV access + 800V DC direct-to-room + 167-module building-block builds',
      cats: ['datacenter'],
      kw: ['算力', '智算', '数据中心', '算电', '直流供电', '液冷', 'IDC', 'AI 数据中心'],
    },
    {
      key: 'ehouse', zh: 'E-house 预制电气房', en: 'E-house', icon: '🏠', color: '#ff5fa8', core: true,
      blurb: '集成式预制电气房，适配高负荷连续生产',
      blurbEn: 'Integrated prefab electrical house for high-load, continuous loads',
      scenario: '工业园、数据中心、炼化 / 化工、冶炼厂高负荷配电',
      scenarioEn: 'Industrial parks, data centers, refining/chem, smelter high-load distribution',
      pitch: '从高负荷电气房 / 站场模块化配电切入，重可靠性与防护规范',
      pitchEn: 'Enter via high-load e-rooms & modular plant distribution; stress reliability & protection codes',
      cats: ['ci', 'datacenter', 'petro'],
      kw: ['工业园', '数据中心', '炼', '化工', '冶炼', '钢', 'LNG', 'E-house', '电气房', '电解铝', '产业园'],
    },
    {
      key: 'switchgear', zh: '中低压成套 / 配网', en: 'MV/LV Switchgear', icon: '🔌', color: '#b06bff', core: true,
      blurb: '中低压成套开关柜与配网自动化设备',
      blurbEn: 'MV/LV switchgear suites & distribution automation',
      scenario: '配网改造、开关站、园区 / 厂用电成套、岸电',
      scenarioEn: 'Distribution upgrades, switching stations, park/aux-power suites, shore power',
      pitch: '按国别标准做中低压设备包，配合配网 / 厂用电系统切入',
      pitchEn: 'Country-spec MV/LV packages; enter alongside distribution & aux-power systems',
      cats: ['grid', 'ci', 'datacenter'],
      kw: ['配网', '配电', '开关柜', '厂用电', '成套', '中低压', '岸电'],
    },
    {
      key: 'storage', zh: '储能并网舱', en: 'Storage Grid-tie', icon: '🔋', color: '#ffd000', core: true,
      blurb: '储能系统中压侧并网舱 / PCS 配套',
      blurbEn: 'MV-side grid-tie skids & PCS for storage systems',
      scenario: '独立储能、风光配储、储能并网与调频',
      scenarioEn: 'Standalone storage, renewable-paired storage, grid-tie & frequency regulation',
      pitch: '作为储能系统中压侧并网舱配套，随储能 / 光伏 EPC 切入',
      pitchEn: 'Bundle as MV-side grid-tie skid; enter with storage / PV EPCs',
      cats: ['storage'],
      kw: ['储能', '配储', '并网舱', 'PCS', '调频', '电池储能'],
    },
  ];

  function match(p) {
    if (!p || p.cat === 'client') return [];           // 国际大客户横切视图：产品契合见 CLIENT_META（公司级）
    const hay = (p.name || '') + ' ' + (p.cap || '') + ' ' + (p.desc || '');
    const out = [];
    for (let i = 0; i < PRODUCTS.length; i++) {
      const pr = PRODUCTS[i];
      let hit = pr.cats.indexOf(p.cat) >= 0;
      if (!hit && pr.kw) for (let j = 0; j < pr.kw.length; j++) if (hay.indexOf(pr.kw[j]) >= 0) { hit = true; break; }
      if (hit) out.push(pr.key);
    }
    return out;
  }

  return { PRODUCTS, match };
});
