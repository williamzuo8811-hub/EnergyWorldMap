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
ok(empty.mw === null && empty.mwh === null && empty.km === null && empty.kbd === null && empty.wty === null, '空 cap → 全 null');
eq(pc('日产 60 万桶').kbd, 60, '油气 万桶/日');
eq(pc('产能 200 万吨/年').wty, 200, '产能 万吨/年');

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
