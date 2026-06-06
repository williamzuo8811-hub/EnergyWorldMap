#!/usr/bin/env node
/* ============================================================
 * coach.js 初始化冒烟测试（零依赖，CI 友好）
 * 用法：  node scripts/test-coach.js
 *
 * 用最小 DOM stub 在 Node 里加载 util + 数据 + clients-meta + coach-content + coach.js，
 * 断言：IIFE 初始化不抛错、暴露 window.__COACH__、商机池装配、客户画像派生、
 * 上下文模板替换、离线评分（开放题要点覆盖 + 语气词典；好话术 > 跪舔话术）、
 * 选择题评分、段位换算、开关一个完整剧本 / 单项特训 render() 不抛错。
 * 专门兜住"无浏览器也能测到的运行时引用错误"。
 * ============================================================ */
'use strict';
const path = require('path');

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* ---------- 最小 DOM stub ---------- */
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.dataset = {}; this.style = {}; this.children = []; this._html = ''; this.value = ''; this.scrollTop = 0; this.textContent = '';
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  addEventListener() {} removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { return c; }
  setAttribute() {} getAttribute() { return null; }
  querySelector() { return new El(); }
  querySelectorAll() { return []; }
  closest() { return null; }
}
const byId = new Map();
const doc = {
  readyState: 'complete',
  getElementById(id) { if (!byId.has(id)) byId.set(id, new El(id)); return byId.get(id); },
  querySelector() { return new El(); },
  querySelectorAll() { return []; },
  createElement(t) { return new El(t); },
  addEventListener() {},
  body: new El('body'),
};

/* ---------- 注入全局 ---------- */
global.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {} };
global.document = doc;
global.location = { hash: '', href: 'http://localhost/coach.html', pathname: '/coach.html', search: '' };
global.setTimeout = () => 0; global.setInterval = () => 0; global.clearTimeout = () => {}; global.clearInterval = () => {};

try {
  global.window.ENERGY_UTIL = require(path.join(__dirname, '..', 'js', 'util.js'));
  ['data', 'data-extra', 'data-brazil', 'data-mideast', 'data-russia-ca', 'data-clients',
    'data-brazil-future', 'data-saudi-future', 'data-seasia', 'data-africa', 'data-oceania',
    'data-europe', 'data-nuclear', 'data-northam', 'data-southasia', 'data-china-future',
    'data-clients2', 'data-refresh2606', 'progress', 'clients-meta', 'coach-content']
    .forEach(f => require(path.join(__dirname, '..', 'js', f + '.js')));
  require(path.join(__dirname, '..', 'js', 'coach.js'));
} catch (e) {
  console.error('✘ coach.js 初始化抛出异常：\n', e && e.stack || e);
  process.exit(1);
}

/* ---------- 断言 ---------- */
const K = global.window.__COACH__;
ok(K && typeof K === 'object', 'window.__COACH__ 已暴露');
ok(K && Array.isArray(K.PROJECTS) && K.PROJECTS.length > 1000, 'PROJECTS 装配（' + (K && K.PROJECTS && K.PROJECTS.length) + '）');
ok(K && Array.isArray(K.OPPS) && K.OPPS.length > 1000, '商机池装配（' + (K && K.OPPS && K.OPPS.length) + '）');
ok(K && K.CONTENT && Array.isArray(K.CONTENT.stages) && K.CONTENT.stages.length === 8, '8 阶段成交漏斗');

// 商机池应按训练价值排序，且 Top 段有"重点客户"（命中 CLIENT_META）
const metaHits = K.OPPS.filter(o => o.meta).length;
ok(metaHits > 20, '存在命中 CLIENT_META 的重点客户商机（' + metaHits + '）');
ok(K.OPPS[0].tv >= K.OPPS[K.OPPS.length - 1].tv, '商机按训练价值降序');

// 客户画像 / 上下文
let ctx;
try {
  const opp = K.OPPS.find(o => o.meta) || K.OPPS[0];
  ctx = K.buildContext(opp);
  ok(ctx && ctx.t && ctx.kw, 'buildContext 返回 t(展示) 与 kw(匹配)');
  ok(ctx.t.co && ctx.t.cust && ctx.t.role && ctx.t.product && ctx.t.pain, '上下文字段齐全');
  ok(ctx.persona && ctx.persona.role && ctx.persona.styleText, 'persona 派生角色与性格');
} catch (e) { fails.push('buildContext 抛错：' + (e && e.message)); }

// 模板替换：不应残留占位符
try {
  const brief = K.tpl(K.CONTENT.stages[0].brief, ctx);
  ok(brief.indexOf('{') < 0, '模板 {占位符} 全部替换为真实数据');
} catch (e) { fails.push('tpl 抛错：' + (e && e.message)); }

// 客户匹配：至少能从 owner 命中一家出海大客户
const someClient = K.PROJECTS.map(p => K.clientKeyOf(p)).filter(Boolean);
ok(someClient.length > 20, 'clientKeyOf 能从 owner 命中出海大客户（' + someClient.length + '）');

// —— 离线评分：开放题 ——
try {
  const round = K.CONTENT.stages[0].rounds[1]; // intel-hook，含 rubric
  const goodTxt = '【该项目】最怕弱电网下停产，我方预制舱变电站工厂预制、现场数周就位，移动变数小时复电，可帮您把交付工期缩短约 30%、降低停产损失，建议本周安排技术交流。';
  const badTxt = '求您给个机会，最低价随便卖，您说了算，亏本也行。';
  const g = K.scoreFree(goodTxt, round, ctx);
  const b = K.scoreFree(badTxt, round, ctx);
  ok(g && Array.isArray(g.detail) && g.detail.length === round.rubric.length, '开放题返回逐要点明细');
  ok(g.total >= 60, '优质话术得分达标（' + g.total + '）');
  ok(g.total > b.total + 25, '优质话术显著高于跪舔话术（' + g.total + ' vs ' + b.total + '）');
  ok(b.tone.bad.length > 0, '跪舔用词被语气词典捕获（' + b.tone.bad.join('、') + '）');
  const tooShort = K.scoreFree('好的', round, ctx);
  ok(tooShort.total <= 35, '过短回答被限分（' + tooShort.total + '）');
} catch (e) { fails.push('scoreFree 抛错：' + (e && e.message)); }

// —— 离线评分：选择题 ——
try {
  const r0 = K.CONTENT.stages[0].rounds[0];
  const best = r0.choices.reduce((a, c) => (c.score > a.score ? c : a), r0.choices[0]);
  const s = K.scoreChoice(best);
  ok(s.total === best.score && s.stars >= 4, '选择题按预置分值评分');
} catch (e) { fails.push('scoreChoice 抛错：' + (e && e.message)); }

// 段位换算
try {
  const lv0 = K.levelOf(0), lvHi = K.levelOf(99999);
  ok(lv0.cur && lv0.idx === 0, '0 XP → 见习段位');
  ok(lvHi.idx === K.CONTENT.levels.length - 1 && lvHi.pct === 100, '高 XP → 封顶段位');
} catch (e) { fails.push('levelOf 抛错：' + (e && e.message)); }

// 开关完整剧本 / 单项特训 + render 不抛错
try {
  const opp = K.OPPS.find(o => o.meta) || K.OPPS[0];
  K.startDeal(opp);
  ok(K.state.deal && K.state.deal.steps.length >= 8, '完整剧本展开 ≥8 步（' + (K.state.deal && K.state.deal.steps.length) + '）');
  K.render();
  K.startDeal(opp, K.CONTENT.stages[4]); // 单项特训：异议化解
  ok(K.state.deal.single === true, '单项特训剧本为单阶段');
  K.render();
  ok(true, 'startDeal + render 全程不抛错');
} catch (e) { fails.push('剧本 / render 抛错：' + (e && e.stack || e)); }

// 用真实交互句柄把一个完整剧本从第一关驱动到结算，覆盖「情境 / 反馈 / 结算」三态 render
try {
  const opp = K.OPPS.find(o => o.meta) || K.OPPS[0];
  K.startDeal(opp);
  const d = K.state.deal;
  let guard = 0;
  while (d.step < d.steps.length && guard++ < 40) {
    const step = d.steps[d.step];
    if (K.useMC(step)) { K.doChoose(0); }           // 选择题：选第一项
    else {
      const ta = doc.getElementById('free-input');  // 开放题：填入文本框后提交
      ta.value = '理解贵司对工期与成本的关注；我方预制舱变电站工厂预制、现场数周就位，车载移动变数小时复电，可降低停产损失、提升可用率，建议本周安排技术交流并出初步方案。';
      K.doSubmit();
    }
    ok(K.state.answered != null, '作答后进入反馈态（第 ' + (d.step + 1) + ' 关）');
    K.advance();                                     // 进入下一关 / 结算
  }
  ok(d.step >= d.steps.length, '剧本被推进到结算（render 结算态不抛错）');
} catch (e) { fails.push('驱动完整剧本抛错：' + (e && e.stack || e)); }

// —— 经典大单战役（手写 · 绑定真实项目）——
try {
  ok(Array.isArray(K.CONTENT.signatures) && K.CONTENT.signatures.length >= 2, '经典大单战役 ≥2 个（' + (K.CONTENT.signatures || []).length + '）');
  const sig = K.CONTENT.signatures[0];
  K.startSignature(sig);
  ok(K.state.deal.kind === 'signature', 'signature 剧本 kind=signature');
  ok(K.state.deal.steps.length >= 8, 'signature 展开全 8 阶段（' + K.state.deal.steps.length + '）');
  ok(K.state.deal.ctx.t.cust === sig.over.cust, 'signature 客户画像被覆盖（' + K.state.deal.ctx.t.cust + '）');
  ok(K.tpl(sig.stages[0].brief, K.state.deal.ctx).indexOf('{') < 0, 'signature 旁白占位符已替换');
  K.render();
  for (let i = 0; i < 3 && K.state.deal.step < K.state.deal.steps.length; i++) {
    const st = K.state.deal.steps[K.state.deal.step];
    if (K.useMC(st)) K.doChoose(0);
    else { doc.getElementById('free-input').value = '我理解贵司对认证与可靠性的顾虑，按 IEC 标准、海外已有交付业绩，建议先做一个试点单元、配驻场与质保，验证达标再扩大，帮您把风险拆小、守住净零节点。'; K.doSubmit(); }
    K.advance();
  }
  ok(true, 'signature 可推进、各态 render 不抛错');
} catch (e) { fails.push('signature 抛错：' + (e && e.stack || e)); }

// —— 抗压特训（销售经理抗压能力）——
try {
  ok(K.PRESSURE_STAGE && Array.isArray(K.PRESSURE_STAGE.rounds) && K.PRESSURE_STAGE.rounds.length >= 5, '抗压特训 ≥5 回合（' + (K.PRESSURE_STAGE && K.PRESSURE_STAGE.rounds.length) + '）');
  K.startDeal(K.OPPS[0], K.PRESSURE_STAGE);
  ok(K.state.deal.kind === 'pressure', '抗压剧本 kind=pressure');
  K.render();
  const ctx = K.state.deal.ctx, prRound = K.PRESSURE_STAGE.rounds[0];
  const composed = K.scoreFree('我理解您的不满，先跟您说声抱歉，沟通没到位是我的问题。您别急，咱们对事不对人，我把价值和总账重新讲清楚，给我十分钟。', prRound, ctx);
  const lost = K.scoreFree('凭什么说我们贵？你这是无理取闹，没法谈那就算了，随你便。', prRound, ctx);
  ok(lost.tone.defensive.length > 0, '情绪失控 / 顶撞防御被捕获（' + lost.tone.defensive.join('、') + '）');
  ok(composed.tone.goodHit.composure === true, '镇定从容被识别');
  ok(composed.total > lost.total + 25, '镇定从容显著高于情绪失控（' + composed.total + ' vs ' + lost.total + '）');
} catch (e) { fails.push('抗压特训抛错：' + (e && e.stack || e)); }

// —— 当地文化 / 当地标准 / 分品类谈资 ——
try {
  ok(K.CONTENT.culture && K.CONTENT.standards && K.CONTENT.catTopics, '文化 / 标准 / 谈资 内容层存在');
  ok(K.COUNTRIES.length > 50, '国家清单装配（' + K.COUNTRIES.length + '）');
  // 沙特：country 覆盖 region 默认，命中本地化(LCGPA/Saudization)与 60Hz
  const saudi = K.localPack({ country: '沙特阿拉伯', region: '中东', cat: 'datacenter' });
  ok(saudi.cultureSrc === '沙特阿拉伯', '沙特命中国家级文化覆盖');
  ok(/60Hz/.test(saudi.standards.volt) && /SASO|SABER/.test(saudi.standards.codes + saudi.standards.cert), '沙特标准含 60Hz 与 SASO/SABER');
  ok(/愿景 2030|NEOM|C 罗/.test(saudi.culture.smalltalk), '沙特谈资含愿景2030/NEOM');
  ok(/PUE|算力|液冷|2N/.test(saudi.topics.hot + saudi.topics.talk), '数据中心谈资含 PUE/液冷/算力');
  // 刚果金 + 矿业：弱电网 + 移动变谈资
  const congo = K.localPack({ country: '刚果（金）', region: '非洲', cat: 'mining' });
  ok(congo.cultureSrc === '刚果（金）', '刚果金命中国家级文化覆盖');
  ok(/移动变|停产|保供电/.test(congo.topics.care + congo.topics.talk), '矿业谈资含移动变/停产/保供电');
  // 无覆盖国家回退大区默认
  const fb = K.localPack({ country: '某不存在国', region: '南美', cat: 'renewable' });
  ok(fb.cultureSrc === '南美' && /葡语|足球/.test(fb.culture.taboo + fb.culture.smalltalk), '未覆盖国家回退大区默认');
  // 展示 HTML 不抛错、占位无残留
  ok(typeof K.localPackHTML({ country: '印度', region: '南亚', cat: 'grid' }) === 'string', 'localPackHTML 生成不抛错');
  // 「当地·谈资」速查页 render 不抛错
  K.state.mode = 'local'; K.render(); K.state.mode = 'deal';
  ok(true, 'renderLocal() 不抛错');
} catch (e) { fails.push('当地文化/标准/谈资 抛错：' + (e && e.stack || e)); }

// —— 销售军规：方法论 + 战绩弹药（提炼自特锐德培训资料）——
try {
  ok(Array.isArray(K.CONTENT.method) && K.CONTENT.method.length >= 12, '方法论框架 ≥12（' + (K.CONTENT.method || []).length + '）');
  ok(Array.isArray(K.CONTENT.cases) && K.CONTENT.cases.length >= 7, '战绩弹药案例 ≥7（' + (K.CONTENT.cases || []).length + '）');
  ok(K.CONTENT.method.every(m => m.name && m.essence && Array.isArray(m.points) && m.points.length), '每个方法论含 name/essence/points');
  ok(K.CONTENT.method.some(m => m.key === 'consult') && K.CONTENT.method.some(m => m.key === 'base'), '新增「顾问式沟通范式」与「根据地+生态圈」方法论');
  ok(K.CONTENT.cases.some(c => /火神山/.test(c.name)), '新增「火神山」业绩弹药');
  ok(K.CONTENT.pitchLib.some(g => /请教式开场/.test(g.stage)), '话术库新增「请教式开场」金句组');
  K.state.mode = 'method'; K.render(); K.state.mode = 'deal';
  ok(true, 'renderMethod() 不抛错');
  const intelIds = K.CONTENT.stages[0].rounds.map(r => r.id);
  ok(intelIds.indexOf('intel-early') >= 0, '情报阶段新增「先入为主」选择题回合');
  const vb = K.CONTENT.stages[3].rounds.filter(r => r.id === 'value-bideval')[0];
  ok(vb && Array.isArray(vb.rubric), '价值阶段新增「综合评标」开放回合（含 rubric）');
} catch (e) { fails.push('销售军规 抛错：' + (e && e.stack || e)); }

/* ---------- 汇总 ---------- */
console.log('═══════════════════════════════════════════════');
console.log(' 国际销售话术陪练 · coach.js 初始化冒烟测试');
console.log('═══════════════════════════════════════════════');
if (fails.length) {
  console.log(`✘ 失败 ${fails.length}：`);
  fails.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('✔ 初始化 / 商机池 / 客户画像 / 离线评分 / 段位 / 剧本 render 全部通过。');
console.log(`  projects=${K.PROJECTS.length}  opps=${K.OPPS.length}  metaHits=${metaHits}  stages=${K.CONTENT.stages.length}`);
process.exit(0);
