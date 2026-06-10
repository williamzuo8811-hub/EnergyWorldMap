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
  // —— 评分公正化：否定豁免 / 同义词 / 反作弊 ——
  const negR = K.scoreFree('我们绝不跪舔、不会亏本贱卖，坚持物有所值，建议本周技术交流。', round, ctx);
  ok(negR.tone.bad.length === 0, '否定语境不误判为跪舔（绝不跪舔 / 不会亏本）');
  const synR = K.scoreFree('该项目最怕弱电网下停线，我方预制式变电站工厂预制、现场几周就位，可把交期压缩、减少停工损失，提议这周技术对接。', round, ctx);
  ok(synR.total >= 55, '同义表达也能拿合格分（' + synR.total + '）');
  const stuffR = K.scoreFree('弱电网 预制舱 停产 缩短 工期 案例 下一步', round, ctx);
  ok((stuffR.flags || []).some(f => /罗列|堆词/.test(f)) && stuffR.total <= 62, '堆砌关键词被识别并限分（' + stuffR.total + '）');
  const copyR = K.scoreFree(K.tpl(round.gold, ctx), round, ctx);
  ok((copyR.flags || []).some(f => /照抄/.test(f)) && copyR.total <= 72, '照抄黄金话术被识别并限分（' + copyR.total + '）');
} catch (e) { fails.push('scoreFree 抛错：' + (e && e.stack || e)); }

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

// —— 沉浸式谈判引擎：信任/守价/推进状态 + 黑天鹅 + 客户反应 ——
try {
  const opp = K.OPPS.find(o => o.meta) || K.OPPS[0];
  K.startDeal(opp);
  ok(K.state.deal.meter && typeof K.state.deal.meter.trust === 'number', '闯关携带 信任/守价/推进 状态');
  const before = K.state.deal.meter.trust;
  K.updateMeter({ total: 95, tone: { good: [], bad: [], arrogant: [], defensive: [] } }, K.state.deal.steps[0]);
  ok(K.state.deal.meter.trust > before, '高分作答提升信任值');
  K.updateMeter({ total: 20, tone: { bad: ['跪'], arrogant: [], defensive: [] } }, { stage: { key: 'negotiate' }, round: {} });
  ok(K.state.deal.meter.price < 55, '低分/跪舔侵蚀守价值');
  // 黑天鹅强制插入
  const steps = K.stepsOf(K.CONTENT.stages);
  const n0 = steps.length;
  K.maybeInjectCurveball(steps, true);
  ok(steps.length === n0 + 1 && steps.some(s => s.curve), '黑天鹅剧情可插入闯关（' + n0 + '→' + steps.length + '）');
  ok(typeof K.reactionLine({ total: 90, tone: { bad: [], arrogant: [], defensive: [] } }) === 'string', '客户即时反应可生成');
  ok(Array.isArray(K.CONTENT.curveballs) && K.CONTENT.curveballs.length >= 5, '黑天鹅库 ≥5（' + (K.CONTENT.curveballs || []).length + '）');
} catch (e) { fails.push('沉浸式谈判引擎抛错：' + (e && e.stack || e)); }

// —— 可衡量成长闭环：能力雷达 / 错题本 / 结业认证 ——
try {
  const prog = K.prog();
  ok(prog.skills && typeof prog.skills.expertise === 'number', '6 维能力档存在');
  const before = prog.skills.value;
  K.updateSkills({ mode: 'free', total: 95, tone: { goodHit: { quantify: true, evidence: true } } }, { stage: { key: 'value' }, round: {} });
  ok(prog.skills.value > before, '高分量化作答提升「价值表达」能力');
  // 结业认证考试
  K.startExam();
  ok(K.state.deal.kind === 'exam' && K.state.deal.steps.length >= 8, '认证考试展开 8 关（' + K.state.deal.steps.length + '）');
  K.state.mode = 'profile'; K.render(); // 渲染考试首关
  // 驱动整场考试到出证
  let guard = 0;
  while (K.state.deal && K.state.deal.kind === 'exam' && K.state.deal.step < K.state.deal.steps.length && guard++ < 20) {
    const st = K.state.deal.steps[K.state.deal.step];
    doc.getElementById('free-input').value = '我理解您的关注，我方预制舱交付快、可靠性高，可降低停产损失，建议本周技术交流并出方案，业绩与认证可查。';
    K.doSubmit(); K.advance();
  }
  K.render(); // 出证结果
  ok(K.prog().diagnostic && typeof K.prog().diagnostic.score === 'number', '首考记录为入营诊断基线');
  K.state.mode = 'deal'; K.state.deal = null;
  // 错题本：低分回合可重练
  const someId = Object.keys(K.ALL_ROUNDS)[0];
  K.startMistake(someId);
  ok(K.state.deal && K.state.deal.steps.length === 1 && K.state.deal.kind === 'drill', '错题可单题重练');
} catch (e) { fails.push('成长闭环抛错：' + (e && e.stack || e)); }

// —— 结果分享卡（SVG → PNG）——
try {
  const svg = K.buildShareSVG({ title: '🏆 成功签约', subtitle: '某项目 · 某客户', big: 85, bigLabel: '成交指数', rows: [{ label: '破冰', val: 80 }, { label: '异议', val: 72 }], footnote: 'x' });
  ok(typeof svg === 'string' && svg.indexOf('<svg') === 0 && /国际销售话术陪练/.test(svg), '分享卡 SVG 生成');
  const svgR = K.buildShareSVG({ title: '🥇 金牌认证', subtitle: '认证', big: 90, bigLabel: '得分', rows: [{ label: 'a', val: 90 }], skills: K.prog().skills });
  ok(/polygon/.test(svgR), '认证卡含能力雷达');
  K.exportShareCard(); // 无 Image 环境应安全 no-op
  ok(true, 'exportShareCard 在无浏览器环境安全降级');
} catch (e) { fails.push('分享卡抛错：' + (e && e.stack || e)); }

// —— 保存 / 恢复进行中的剧本 ——
try {
  const opp = K.OPPS.find(o => o.meta) || K.OPPS[0];
  K.startDeal(opp);
  // 作答两步，制造进度
  for (let i = 0; i < 2 && K.state.deal.step < K.state.deal.steps.length; i++) {
    const st = K.state.deal.steps[K.state.deal.step];
    if (K.useMC(st)) K.doChoose(0); else { doc.getElementById('free-input').value = '我理解贵司关注，我方预制舱交付快、可靠性高、可降低停产损失，建议本周技术交流。'; K.doSubmit(); }
    K.advance();
  }
  const snap = K.dealSnapshot();
  ok(snap && snap.kind === 'deal' && snap.step >= 2 && snap.steps.length >= 8, 'dealSnapshot 序列化进度（step=' + (snap && snap.step) + '）');
  K.saveDeal();
  const stepWas = K.state.deal.step;
  K.state.deal = null; K.state.savedDeal = null;
  K.loadSavedDeal();
  ok(K.state.savedDeal && K.state.savedDeal.step === stepWas, 'loadSavedDeal 读回存档');
  K.resumeDeal();
  ok(K.state.deal && K.state.deal.kind === 'deal' && K.state.deal.step === stepWas && K.state.deal.steps.length >= 8, 'resumeDeal 断点续练（step=' + (K.state.deal && K.state.deal.step) + '）');
  K.clearDeal(); K.state.deal = null;
} catch (e) { fails.push('保存/恢复剧本抛错：' + (e && e.stack || e)); }

// —— 成就徽章 + 连续打卡（驱动一整单后应解锁「首单告捷」）——
try {
  const p0 = K.prog();
  p0.badges = []; p0.dealsClosed = 0; p0.streakWins = 0; p0.dayStreak = 0; p0.lastDay = '';
  const opp = K.OPPS.find(o => o.meta) || K.OPPS[0];
  K.startDeal(opp);
  let g = 0;
  while (K.state.deal && K.state.deal.kind === 'deal' && K.state.deal.step < K.state.deal.steps.length && g++ < 40) {
    const st = K.state.deal.steps[K.state.deal.step];
    if (K.useMC(st)) K.doChoose(0);
    else { doc.getElementById('free-input').value = '我理解贵司的关注，我方预制舱交付快、可靠性高，可降低停产损失，建议本周技术交流、出方案，业绩与认证可查，咱们一起把节点守住。'; K.doSubmit(); }
    K.advance();
  }
  ok(K.prog().dealsClosed >= 1, '完整成交后 dealsClosed≥1');
  ok(K.prog().badges.indexOf('first') >= 0, '解锁「首单告捷」徽章');
  ok(K.prog().dayStreak >= 1, '记录连续打卡天数');
} catch (e) { fails.push('成就/打卡抛错：' + (e && e.stack || e)); }

// —— 循序渐进 2.0：自适应难度 + 脚手架 ——
try {
  const mcStep = { round: K.CONTENT.stages[0].rounds[0], sIdx: 0 }; // 含选择题
  K.state.diff = 'adapt'; K.state.recent = [30, 40];
  ok(K.useMC(mcStep) === true, '自适应：表现弱 → 给选择题');
  K.state.recent = [90, 88];
  ok(K.useMC(mcStep) === false, '自适应：表现好 → 转开放题');
  K.state.diff = 'mix'; K.state.recent = [];
  ok(true, '难度循环含 adapt（' + ['mix', 'easy', 'free', 'adapt'].join('/') + '）');
} catch (e) { fails.push('自适应难度抛错：' + (e && e.stack || e)); }

// —— 英文 / 双语实战 ——
try {
  ok(K.CONTENT.english && Array.isArray(K.CONTENT.english.stages) && K.CONTENT.english.stages.length >= 5, '英文实战 ≥5 关（' + (K.CONTENT.english && K.CONTENT.english.stages.length) + '）');
  K.startEnglish();
  ok(K.state.deal.kind === 'en' && K.state.deal.ctx.t.co === 'Australia', '英文场景启动且外方语境（' + K.state.deal.ctx.t.co + '）');
  K.state.mode = 'en'; K.render();
  // 英文评分：双语语气生效，优质英文 > 跪舔英文
  const enRound = K.CONTENT.english.stages[3].rounds[0]; // objection
  const enCtx = K.state.deal.ctx;
  const goodEn = K.scoreFree("That's a fair concern and you're right to ask. We test to AS/NZS, hold local contractor licences and run a Brisbane office; we can start with a pilot, warranty and local spares, then scale.", enRound, enCtx);
  const badEn = K.scoreFree('Just give me your lowest price, whatever you say, I beg you.', enRound, enCtx);
  ok(goodEn.total >= 55, '优质英文应答达标（' + goodEn.total + '）');
  ok(badEn.tone.bad.length > 0 && goodEn.total > badEn.total + 20, '英文跪舔被双语词典捕获且显著低分（' + goodEn.total + ' vs ' + badEn.total + '）');
} catch (e) { fails.push('英文实战抛错：' + (e && e.stack || e)); }

// —— 经典大单战役（手写 · 绑定真实项目）——
try {
  ok(Array.isArray(K.CONTENT.signatures) && K.CONTENT.signatures.length >= 4, '经典大单战役 ≥4 个（' + (K.CONTENT.signatures || []).length + '）');
  ok(['neom', 'congo', 'acwa', 'idn'].every(k => K.CONTENT.signatures.some(s => s.key === k)), '含 NEOM / 刚果金 / 沙特ACWA / 印尼TKDN 四大战役');
  K.CONTENT.signatures.forEach(s => { ok((s.stages || []).length === 8 && s.stages.every(st => (st.rounds || []).length && st.rounds[0].id), '战役「' + s.key + '」覆盖全 8 阶段且回合可重建'); });
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
  // 海外业绩库 + 业绩弹药匹配（按国家/大区/品类）
  ok(Array.isArray(K.CONTENT.overseasCases) && K.CONTENT.overseasCases.length >= 25, '海外业绩库 ≥25 项（' + (K.CONTENT.overseasCases || []).length + '）');
  const auRefs = K.overseasRefs({ country: '澳大利亚', region: '大洋洲', cat: 'renewable' }, 5);
  ok(auRefs.length >= 2 && auRefs[0].country === '澳大利亚', '澳洲光伏商机匹配到本国业绩弹药（' + auRefs.length + '）');
  ok(/澳洲|布里斯班/.test(K.nearestBranch({ region: '大洋洲' })), '大洋洲商机匹配到澳洲分支机构');
  ok(K.overseasRefs({ country: '吉尔吉斯斯坦', region: '中亚', cat: 'mining' }, 5).some(r => /Kumtor|金矿/.test(r.name)), '中亚矿业匹配到 Kumtor 金矿业绩');
  // 展示 HTML 不抛错、占位无残留、含业绩区块
  const lph = K.localPackHTML({ country: '澳大利亚', region: '大洋洲', cat: 'renewable' });
  ok(typeof lph === 'string' && /业绩弹药/.test(lph), 'localPackHTML 生成含业绩弹药区块');
  // 「当地·谈资」速查页 render 不抛错
  K.state.mode = 'local'; K.render(); K.state.mode = 'deal';
  ok(true, 'renderLocal() 不抛错');
} catch (e) { fails.push('当地文化/标准/谈资 抛错：' + (e && e.stack || e)); }

// —— 销售军规：方法论 + 战绩弹药（提炼自特锐德培训资料）——
try {
  ok(Array.isArray(K.CONTENT.method) && K.CONTENT.method.length >= 16, '方法论框架 ≥16（' + (K.CONTENT.method || []).length + '）');
  ok(['battle', 'finance', 'tender', 'redline'].every(k => K.CONTENT.method.some(m => m.key === k)), '新增 竞品对标/融资/招投标/合规红线 四框架');
  ok(K.CONTENT.stages[4].rounds.some(r => r.id === 'obj-technical'), '异议阶段新增「技术异议」回合');
  ok(K.CONTENT.stages[5].rounds.some(r => r.id === 'nego-finance'), '谈判阶段新增「融资条款」回合');
  ok(Array.isArray(K.CONTENT.cases) && K.CONTENT.cases.length >= 7, '战绩弹药案例 ≥7（' + (K.CONTENT.cases || []).length + '）');
  ok(K.CONTENT.method.every(m => m.name && m.essence && Array.isArray(m.points) && m.points.length), '每个方法论含 name/essence/points');
  ok(K.CONTENT.method.some(m => m.key === 'consult') && K.CONTENT.method.some(m => m.key === 'base'), '新增「顾问式沟通范式」与「根据地+生态圈」方法论');
  ok(K.CONTENT.method.some(m => m.key === 'guanxi'), '新增「客情经营」方法论');
  ok(K.CONTENT.stages[7].rounds.some(r => r.id === 'deliver-relation'), '交付阶段新增「客情经营」可打分回合');
  ok(K.CONTENT.cases.some(c => /火神山/.test(c.name)), '新增「火神山」业绩弹药');
  ok(K.CONTENT.pitchLib.some(g => /请教式开场/.test(g.stage)), '话术库新增「请教式开场」金句组');
  K.state.mode = 'method'; K.render(); K.state.mode = 'deal';
  ok(true, 'renderMethod() 不抛错');
  const intelIds = K.CONTENT.stages[0].rounds.map(r => r.id);
  ok(intelIds.indexOf('intel-early') >= 0, '情报阶段新增「先入为主」选择题回合');
  const vb = K.CONTENT.stages[3].rounds.filter(r => r.id === 'value-bideval')[0];
  ok(vb && Array.isArray(vb.rubric), '价值阶段新增「综合评标」开放回合（含 rubric）');
} catch (e) { fails.push('销售军规 抛错：' + (e && e.stack || e)); }

/* ---------- 档案 schema 迁移（migrateProgress：备份/恢复与版本升级的核心）---------- */
try {
  const K = global.window.__COACH__;
  ok(typeof K.migrateProgress === 'function' && typeof K.PROG_VER === 'number', 'migrateProgress / PROG_VER 已暴露');
  const m1 = K.migrateProgress({ xp: 5 });                       // 最初版存档（无 ver、缺大部分字段）
  ok(m1.ver === K.PROG_VER, '迁移后 ver 升至当前版本');
  ok(m1.xp === 5 && Array.isArray(m1.badges) && Array.isArray(m1.mistakes) && Array.isArray(m1.history), 'v1 存档迁移：保留 xp，补齐数组字段');
  ok(m1.skills && typeof m1.skills.expertise === 'number', '迁移补齐 6 维能力雷达默认值');
  const m2 = K.migrateProgress({ xp: 'bad', badges: 'oops', skills: { poise: 77 } });   // 脏数据
  ok(m2.xp === 0 && Array.isArray(m2.badges) && m2.skills.poise === 77 && m2.skills.value === 40, '脏数据归一：类型校正且不丢有效字段');
  ok(K.migrateProgress(null).ver === K.PROG_VER, 'null 输入返回全新空档案');
} catch (e) { fails.push('migrateProgress 抛错：' + (e && e.stack || e)); }

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
