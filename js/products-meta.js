/* ============================================================
 * 特锐德 / 特来电 核心产品 → 能源项目「适配匹配」层
 * ------------------------------------------------------------
 * 把特锐德 2 大核心产品线（模块化预制舱变电站 / 车载移动变电站）
 * 按「项目场景」映射到全量项目上，供 app.js 的「🔌 产品适配看板」
 * 与详情卡的产品适配块使用。
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
