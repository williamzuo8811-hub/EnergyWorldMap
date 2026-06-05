#!/usr/bin/env node
/* ============================================================
 * 特锐德产品适配匹配单元测试（零依赖 / CI 友好）
 * 用法：  node scripts/test-products.js
 * 退出码：有断言失败 → 1；全通过 → 0
 *
 * 覆盖 js/products-meta.js 的纯逻辑（app.js 与本测试共享同一实现）：
 *   · PRODUCTS 结构完整（必备字段 / 键唯一 / cats 引用合法品类）
 *   · match() —— 按品类 / 关键词跨场景匹配，client 横切项目返回空
 * ============================================================ */
'use strict';
const P = require('../js/products-meta.js');

let pass = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else fails.push(msg); }
const has = (arr, k, msg) => ok(Array.isArray(arr) && arr.indexOf(k) >= 0, msg + ' —— 实得 ' + JSON.stringify(arr));
const hasNot = (arr, k, msg) => ok(Array.isArray(arr) && arr.indexOf(k) < 0, msg + ' —— 实得 ' + JSON.stringify(arr));

/* ---------- 目录结构 ---------- */
ok(Array.isArray(P.PRODUCTS) && P.PRODUCTS.length === 6, 'PRODUCTS 恰为 6 个核心产品');
ok(P.PRODUCTS.map(pr => pr.key).join(',') === 'prefab,mobile,aipower,ehouse,switchgear,storage', '产品为 预制舱/移动变/算电岛/E-house/中低压/储能并网舱');
ok(typeof P.match === 'function', 'match 可调用');
ok(new Set(P.PRODUCTS.map(pr => pr.color)).size === 6, '6 个产品颜色互不重复（看板/详情卡可区分）');
const CATS = ['renewable', 'nuclear', 'grid', 'storage', 'ci', 'datacenter', 'transport', 'petro', 'mining', 'client'];
const seenKeys = new Set();
P.PRODUCTS.forEach(pr => {
  ok(pr.key && pr.zh && pr.en && pr.icon && pr.color, '产品「' + (pr.key || '?') + '」必备展示字段齐全');
  ok(Array.isArray(pr.cats) && pr.cats.length > 0, '产品「' + pr.key + '」cats 非空');
  ok(Array.isArray(pr.kw), '产品「' + pr.key + '」kw 是数组');
  ok(pr.scenario && pr.pitch && pr.blurb, '产品「' + pr.key + '」BD 文案齐全（含中文）');
  ok(pr.scenarioEn && pr.pitchEn && pr.blurbEn, '产品「' + pr.key + '」BD 文案齐全（含英文）');
  pr.cats.forEach(c => ok(CATS.indexOf(c) >= 0, '产品「' + pr.key + '」cats 引用合法品类：' + c));
  ok(!seenKeys.has(pr.key), '产品键唯一：' + pr.key); seenKeys.add(pr.key);
});

/* ---------- match：预制舱变电站（按品类 + 关键词）---------- */
has(P.match({ cat: 'renewable', name: '光伏电站升压站', desc: '' }), 'prefab', '光伏升压 → 预制舱变电站');
has(P.match({ cat: 'grid', name: '某变电站工程', desc: '' }), 'prefab', '电网项目 → 预制舱变电站');
has(P.match({ cat: 'nuclear', name: '某核电送出工程', desc: '' }), 'prefab', '核电项目 → 预制舱变电站');
has(P.match({ cat: 'ci', name: '某工业园配电', cap: '', desc: '110kV 变电站送出并网' }), 'prefab', '工商业含「变电站/并网」关键词 → 预制舱变电站');

/* ---------- match：车载移动变电站（按品类 + 关键词）---------- */
has(P.match({ cat: 'mining', name: '铜矿采选', desc: '' }), 'mobile', '矿业项目 → 车载移动变电站');
has(P.match({ cat: 'transport', name: '城市轨交', desc: '' }), 'mobile', '轨交基建 → 车载移动变电站');
has(P.match({ cat: 'grid', name: '电网应急抢修工程', desc: '' }), 'mobile', '电网含「应急/抢修」关键词 → 车载移动变电站');

/* ---------- match：算电岛 AI PowerHouse（算力中心供电；按品类 + 关键词）---------- */
has(P.match({ cat: 'datacenter', name: '海外数据中心园区', desc: '' }), 'aipower', '数据中心 → 算电岛 AI PowerHouse');
has(P.match({ cat: 'ci', name: '某智算中心', cap: '', desc: '配套算力供电与液冷' }), 'aipower', '非数据中心品类含「智算/算力」关键词 → 算电岛');
hasNot(P.match({ cat: 'datacenter', name: '海外数据中心园区', desc: '' }), 'prefab', '纯数据中心不误入预制舱变电站');

/* ---------- match：E-house / 中低压成套 / 储能并网舱（按品类 + 关键词）---------- */
has(P.match({ cat: 'petro', name: 'LNG 接收站', desc: '' }), 'ehouse', '油气化工 → E-house 预制电气房');
has(P.match({ cat: 'datacenter', name: '海外数据中心园区', desc: '' }), 'ehouse', '数据中心 → E-house（与算电岛多产品并存）');
has(P.match({ cat: 'ci', name: '工业园区配电', cap: '', desc: '配网改造' }), 'switchgear', '工商业含「配网」关键词 → 中低压成套 / 配网');
has(P.match({ cat: 'storage', name: '电池储能电站', desc: '' }), 'storage', '储能项目 → 储能并网舱');
has(P.match({ cat: 'renewable', name: '风光储一体化', cap: '', desc: '配套电池储能' }), 'storage', '风光项目含「储能」关键词 → 储能并网舱');

/* ---------- match：可多产品命中（电网变电站 + 应急抢修 同时命中多类）---------- */
const gridFit = P.match({ cat: 'grid', name: '变电站应急抢修', desc: '' });
has(gridFit, 'prefab', '多命中：含预制舱变电站（cat=grid）');
has(gridFit, 'mobile', '多命中：含车载移动变电站（kw=应急/抢修）');
has(gridFit, 'switchgear', '多命中：含中低压成套 / 配网（cat=grid）');

/* ---------- match：client 横切项目返回空（避免与公司级 BD 画像重复计）---------- */
ok(P.match({ cat: 'client', name: '某出海大客户海外项目', desc: '储能 矿山 变电站' }).length === 0, 'client 项目 match 返回空数组');
ok(P.match(null).length === 0, 'match(null) 安全返回空数组');

/* ---------- 汇总 ---------- */
console.log('═══════════════════════════════════════════════');
console.log(' 能源世界地图 · 特锐德产品适配匹配单测');
console.log('═══════════════════════════════════════════════');
if (fails.length) {
  console.log(`✘ 失败 ${fails.length} / 通过 ${pass}：`);
  fails.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log(`✔ 全部通过（${pass} 断言）：PRODUCTS 结构 + match 匹配 / client 排除。`);
process.exit(0);
