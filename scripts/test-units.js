#!/usr/bin/env node
/* ============================================================
 * 纯逻辑单元测试（零依赖 / CI 友好）
 * 用法：  node scripts/test-units.js
 * 退出码：有断言失败 → 1；全通过 → 0
 *
 * 覆盖 js/util.js 的纯函数（app.js 与本测试共享同一实现）：
 *   · parseCapacity —— 自由文本容量 → 结构化数值（A+B 加和 / N×M 相乘 / MW 不吞 MWh）
 *   · classifySub   —— 子分类有序匹配 + 兜底桶
 *   · wgs2gcj / outOfChina —— 坐标纠偏（境外原样返回 / 境内偏移有界）
 * ============================================================ */
'use strict';
const U = require('../js/util.js');

let pass = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else fails.push(msg); }
function eq(actual, expected, msg) {
  ok(actual === expected, `${msg} —— 期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
}
function near(actual, expected, tol, msg) {
  ok(typeof actual === 'number' && Math.abs(actual - expected) <= tol,
    `${msg} —— 期望 ≈${expected}(±${tol})，实得 ${JSON.stringify(actual)}`);
}

/* ---------- parseCapacity ---------- */
const pc = U.parseCapacity;
eq(pc('1.5 GW').mw, 1500, 'GW→MW 换算');
eq(pc('CSP 580 MW').mw, 580, 'MW 直读');
eq(pc('规划装机约 60 GW').mw, 60000, '中文夹叙 60 GW');
eq(pc('100万千瓦').mw, 1000, '万千瓦→MW');
eq(pc('690 MW PV + 380 MW 储能').mw, 1070, 'A+B 加和（690+380）');
eq(pc('400 MW PV + 1 GWh 储能').mw, 400, '加号两侧单位不同→不加和，取首个 MW');
eq(pc('400 MW PV + 1 GWh 储能').mwh, 1000, '同串中 GWh→MWh');
eq(pc('100 GWh').mw, null, 'GW 前瞻：100 GWh 不被当作功率');
eq(pc('100 GWh').mwh, 100000, 'GWh→MWh');
eq(pc('200万千瓦时').mwh, 2000, '万千瓦时→MWh');
eq(pc('约 400 公里').km, 400, '线路 公里→km');
eq(pc('16×100万千瓦').mw, 16000, 'N×M 相乘（16×100 万千瓦）');
const empty = pc('');
ok(empty.mw === null && empty.mwh === null && empty.km === null && empty.kbd === null && empty.wty === null && empty.pf === null
  && empty.pax === null && empty.teu === null && empty.wafer === null && empty.veh === null && empty.mva === null, '空 cap → 全 null');
eq(pc('日产 60 万桶').kbd, 60, '油气 万桶/日');
eq(pc('产能 200 万吨/年').wty, 200, '产能 万吨/年');
eq(pc('±800kV直流/800万kW').mw, 8000, '万kW → MW（同万千瓦）');
eq(pc('250+ MW（初期）').mw, 250, 'N+ MW：去≥语义加号仍解析');
eq(pc('400 MW PV + 1 GWh 储能').mw, 400, 'A+B 不同单位不加和（回归，确保去加号不误伤）');
eq(pc('智算 160 EFLOPS').pf, 160000, '算力 EFLOPS→PFLOPS');
eq(pc('4.4万PFlops，机架12.1万架').pf, 44000, '算力 万PFlops→PFLOPS');
eq(pc('5万P，目标10万P').pf, 50000, '算力 万P→PFLOPS（取首个）');
eq(pc('300 PFLOPS').pf, 300, '算力 PFLOPS 直读');
eq(pc('光伏 500 MW').pf, null, '非算力 cap → pf 为 null');

/* ---------- parseCapacity：新增口径（客运/吞吐/晶圆/整车/变电）---------- */
eq(pc('远期年吞吐 1.85 亿人次').pax, 18500, '客运 亿人次→万人次');
eq(pc('首期年 1000 万人次').pax, 1000, '客运 万人次直读');
eq(pc('近期年 160 万旅客').pax, 160, '客运 万旅客 同 人次');
eq(pc('一期年 2500 万→远期 1 亿人次').pax, 10000, '客运 "万→亿" 取亿人次(远期)，不误把 2500 当万人次');
eq(pc('年吞吐 320 万 TEU').teu, 320, '吞吐 万TEU');
eq(pc('一期 350 万标箱').teu, 350, '吞吐 万标箱 同 TEU');
eq(pc('5.5 万片/月').wafer, 5.5, '晶圆 万片/月');
eq(pc('G1 约 50 万颗/日封测').wafer, null, '晶圆：万颗/日(封测) 不计入');
eq(pc('整车 15 万辆/年(远期 30 万辆)').veh, 15, '整车 万辆/年（取首个，不计远期）');
eq(pc('44列地铁列车').veh, null, '整车：轨道车辆"列"不计入');
eq(pc('500/138kV/600兆伏安').mva, 600, '变电 兆伏安（kV 电压等级不误读）');
eq(pc('30 MVA，液冷').mva, 30, '变电 MVA 直读');
eq(pc('±800kV直流/800万kW').mva, null, '变电：万kW 是功率，非 万千伏安');

/* ---------- classifySub ---------- */
const cs = U.classifySub;
eq(cs({ cat: 'renewable', name: '阳江青洲海上风电基地' }), 'offshore', 'renewable→海上风电');
eq(cs({ cat: 'renewable', name: 'Sudair 光伏电站' }), 'solar', 'renewable→光伏');
eq(cs({ cat: 'renewable', name: '某陆上风电场' }), 'wind', 'renewable→陆上风电');
eq(cs({ cat: 'nuclear', name: '玲龙一号 SMR' }), 'smr', 'nuclear→小堆');
eq(cs({ cat: 'grid', name: '±800kV 特高压直流' }), 'uhv', 'grid→特高压（先于直流命中）');
eq(cs({ cat: 'petro', name: '某 LNG 接收站' }), 'lng', 'petro→LNG');
eq(cs({ cat: 'datacenter', name: '某 AI 智算中心', region: '美国' }), 'ai', 'datacenter→AI（非中国不入枢纽）');
eq(cs({ cat: 'datacenter', name: '某东数西算枢纽集群', region: '中国' }), 'hub', 'datacenter→东数西算枢纽（fn 命中）');
eq(cs({ cat: 'mining', name: '某大型金矿' }), 'other', 'mining→兜底桶（金不在列举金属）');
eq(cs({ cat: 'client', name: 'X 海外电站', owner: '中国电建集团' }), 'powerchina', 'client→按 owner 归到中国电建');
eq(cs({ cat: 'nonexist', name: '空' }), '', '未知品类→空串');

/* ---------- wgs2gcj / outOfChina ---------- */
eq(U.outOfChina(-100, 40), true, '北美在境外');
eq(U.outOfChina(116.39, 39.9), false, '北京在境内');
const beijingOut = U.wgs2gcj(116.39, 39.9);
near(beijingOut[0] - 116.39, 0.0, 0.02, '北京经度偏移有界(<0.02°)');
ok(Math.abs(beijingOut[0] - 116.39) > 0.001 && Math.abs(beijingOut[1] - 39.9) > 0.0005, '北京境内坐标确有偏移');
const nyOut = U.wgs2gcj(-74.0, 40.7);
ok(nyOut[0] === -74.0 && nyOut[1] === 40.7, '境外坐标原样返回（不纠偏）');

/* ---------- normalizeOwner（企业榜归并键）---------- */
const no = U.normalizeOwner;
eq(no('中国电建集团'), '中国电建', '剥「集团」后缀');
eq(no('中国电建'), '中国电建', '无后缀幂等');
eq(no('国家电网有限公司'), '国家电网', '剥「有限公司」');
eq(no('中国电建股份有限公司'), '中国电建', '剥「股份有限公司」');
eq(no('三峡集团'), '三峡', '剥「集团」(三峡)');
eq(no('中核集团、中广核'), '中核', '先取首段再剥后缀');
eq(no('Adani Group'), 'Adani', '剥英文 Group');
eq(no('ACWA Power'), 'ACWA Power', '英文无公司后缀→原样');
eq(no('比亚迪'), '比亚迪', '中文无后缀→原样');
eq(no(''), '', '空业主→空');

/* ---------- invMagnitude（量级串，不含币种符号；app.js 与 globe.js 共用）---------- */
const im = U.invMagnitude;
eq(im(500, 'zh'), '500 亿', '量级 500→500 亿');
eq(im(5, 'zh'), '5 亿', '量级 <10 保留小数位');
eq(im(12000, 'zh'), '1.2 万亿', '量级 ≥1万亿→万亿');
eq(im(5000, 'en'), '500B', '量级 EN：5000→500B（无 $）');
eq(im(12000, 'en'), '1.2T', '量级 EN：≥1T→1.2T');

/* ---------- capFmtMW（装机显示）---------- */
const cf = U.capFmtMW;
eq(cf(null), '—', '容量 null→—');
eq(cf(500), '500 MW', '容量 <1GW→MW');
eq(cf(1500), '1.5 GW', '容量 ≥1GW→GW 一位小数');
eq(cf(20000), '20 GW', '容量 ≥10GW→GW 整数');

/* ---------- buildProjects（数据装配：去重/进展/子类/容量；requireCoord）---------- */
const bp = U.buildProjects;
const ENERGY = { PROJECTS: [{ id: 1, name: 'A', cap: '1 GW', cat: 'renewable' }, { id: 2, name: 'A', cap: '2 GW', cat: 'renewable' }] };
const EXTRA = [{ id: 3, name: 'B', cap: '', cat: 'grid', coord: [1, 2] }];
const built = bp(ENERGY, EXTRA, { 1: 'prog1' });
eq(built.length, 2, 'buildProjects：按 name 去重（A 只留首个）+ B');
eq(built[0].id, 1, 'buildProjects：同名首个占位胜出');
eq(built[0].progress, 'prog1', 'buildProjects：按 id 挂 progress');
eq(built[0].capMW, 1000, 'buildProjects：装配 capMW（1 GW）');
ok(typeof built[0].sub === 'string' && built[0].sub.length > 0, 'buildProjects：计算 sub 子分类');
const builtCoord = bp(ENERGY, EXTRA, {}, { requireCoord: true });
eq(builtCoord.length, 1, 'buildProjects(requireCoord)：只留有 coord 的项目');
eq(builtCoord[0].name, 'B', 'buildProjects(requireCoord)：无 coord 的 A 被剔除');

/* ---------- 汇总 ---------- */
console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · 纯逻辑单元测试');
console.log('═══════════════════════════════════════════════');
if (fails.length) {
  console.log(`✘ 失败 ${fails.length} / 通过 ${pass}：`);
  fails.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log(`✔ 全部 ${pass} 项断言通过。`);
process.exit(0);
