/* ============================================================
 * 国际销售经理 · 话术陪练 —— 引擎 + UI（coach.html 专用）
 * ------------------------------------------------------------
 * 与平面地图 / 3D 地球共用同一份数据层（js/data*.js + util.js）。把 3,100 个真实项目
 * 当作「商机池」、把 CLIENT_META 的 54 家出海大客户当作「客户画像 + 官方打法」，
 * 生成可无限复用的成交剧本（剧本/评分要点/黄金话术在 js/coach-content.js）。
 *
 * 设计目标：让岗位小白循序渐进、稳扎稳打地把一个项目从零做到成交，
 *           练就「不卑不亢」的专业姿态，且全程没有过度压力（练习模式 + 提示 + 黄金话术 + 无限重来）。
 *
 * 评分全离线、确定性：开放题按「要点覆盖率 rubric」+「语气词典」打分；选择题按预置分值。
 * 可选「AI 自由陪练」（自备 API Key，默认关闭，不破坏离线核心）。
 * 调试句柄：window.__COACH__。
 * ============================================================ */
(function () {
  'use strict';

  const U = window.ENERGY_UTIL;
  const C = window.COACH_CONTENT;
  const ENERGY = window.ENERGY || {};
  const META = ENERGY.META || {};
  const CATEGORIES = ENERGY.CATEGORIES || {};
  const CLIENT_META = window.CLIENT_META || {};
  const SUB_DEFS = (U && U.SUB_DEFS) || {};

  /* ---------- 数据装配（与 app.js / globe.js 同口径，复用 util.buildProjects）---------- */
  const PROJECTS = U.buildProjects(ENERGY, window.ENERGY_EXTRA, window.ENERGY_PROGRESS, {});

  /* ---------- 客户中文标签：从 SUB_DEFS.client 取（key→label）---------- */
  const CLIENT_LABEL = {};
  (SUB_DEFS.client || []).forEach(d => { if (d.key) CLIENT_LABEL[d.key] = d.label; });

  /* ---------- 基础小工具 ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const invMag = n => (U.invMagnitude ? U.invMagnitude(n || 0, 'zh') : String(n || 0));
  const usd = p => '≈$' + invMag(p.inv || 0);
  const catShort = k => (CATEGORIES[k] || {}).short || k;
  const catName = k => (CATEGORIES[k] || {}).name || k;
  const catIcon = k => (CATEGORIES[k] || {}).icon || '•';
  const catColor = k => (CATEGORIES[k] || {}).color || '#21c7ff';
  const norm = s => String(s == null ? '' : s).toLowerCase();
  function hash(x) { let h = 0; const s = String(x); for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  const $ = id => (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null;
  function setHTML(id, html) { const e = $(id); if (e) e.innerHTML = html; }

  /* ---------- localStorage 封装（私密模式 / Node 测试下回退内存）---------- */
  const memStore = {};
  const store = {
    get(k) { try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : memStore[k]; } catch (e) { return memStore[k]; } },
    set(k, v) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); else memStore[k] = v; } catch (e) { memStore[k] = v; } },
  };

  /* ============================================================
   * 客户画像 / 商机 派生
   * ============================================================ */
  // owner 命中哪家出海大客户（复用 SUB_DEFS.client 的 fn，匹配 p.owner，不限品类）
  function clientKeyOf(p) {
    const defs = SUB_DEFS.client || [];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (d.fn) { try { if (d.fn('', '', p)) return d.key; } catch (e) { /* ignore */ } }
    }
    return null;
  }

  // 按品类的痛点 / 推荐产品 / 场景 / 打法兜底（无 CLIENT_META 时使用）
  const PAIN = {
    mining:     { txt: '偏远矿区保供电、停电即停产损失',       kw: ['保供电', '停产', '可靠', '偏远', '应急', '矿'] },
    petro:      { txt: '站场分散、弱电网、安全合规要求高',     kw: ['弱电网', '站场', '合规', '可靠', '防护', '应急'] },
    grid:       { txt: '并网节点紧、设备入网认证、交付周期',   kw: ['并网', '认证', '工期', '交付', '节点'] },
    renewable:  { txt: '升压站标准化、批量交付与降本、工期节点', kw: ['升压站', '工期', '批量', '降本', '交付', '并网'] },
    storage:    { txt: '储能并网集成与认证、交付节点',         kw: ['并网', '储能', '认证', '集成', '交付'] },
    datacenter: { txt: '高可靠中压配电、快速扩容',            kw: ['可靠', '中压', '配电', '扩容', '冗余'] },
    ci:         { txt: '高负荷可靠供电、园区扩容',            kw: ['可靠', '负荷', '配电', '扩容', '园区'] },
    transport:  { txt: '施工临电与站段配电、工期',            kw: ['临电', '配电', '工期', '施工'] },
    nuclear:    { txt: '高可靠厂用电与严苛认证',              kw: ['可靠', '厂用电', '认证'] },
    client:     { txt: '海外项目供电可靠性与交付周期',         kw: ['可靠', '交付', '工期', '保供电'] },
    _default:   { txt: '供电可靠性与交付周期',                kw: ['可靠', '交付', '工期', '保供电'] },
  };
  const PRODUCT = {
    mining: '矿山预制舱变电站 + 车载移动变（应急保供电）',
    petro: '防护型 E-house + 站场预制舱变电站',
    grid: '模块化预制舱变电站 + 移动应急变',
    renewable: '新能源升压站预制舱 + 储能并网舱',
    storage: '储能并网舱 + 中压配电',
    datacenter: 'E-house + 中压配电',
    ci: 'E-house + 中低压成套',
    transport: '施工临电方案 + 站段配电预制舱',
    nuclear: '厂用电预制舱 + 中低压成套',
    client: '模块化预制舱变电站 + 车载移动变',
    _default: '模块化预制舱变电站',
  };
  const SCENARIO = {
    mining: '海外矿山供配电与应急保供电', petro: '油气站场 / 炼化园区配电', grid: '海外输变电与配网工程',
    renewable: '风光储升压站与并网', storage: '海外储能电站并网集成', datacenter: '海外数据中心园区配电',
    ci: '工业园区高可靠配电', transport: '基建施工临电与站段配电', nuclear: '电站厂用电系统', client: '海外能源电力项目',
    _default: '海外能源 / 基建项目配电',
  };
  const APPROACH = {
    _default: '研判项目阶段与决策链，找准产品契合点后做技术交流入库，再推进方案与样板',
  };
  const ROLE = {
    mining: '矿山项目供电负责人', petro: '油气项目电气经理', grid: '电网项目采购负责人',
    renewable: '新能源项目电气经理', storage: '储能项目技术负责人', datacenter: '数据中心采购总监',
    ci: '工业园区采购总监', transport: '基建项目机电经理', nuclear: '电站电气负责人', client: '海外项目负责人',
    _default: '项目采购负责人',
  };
  const STYLE = [
    { k: '务实稳健', t: '对方务实稳健、重交付与口碑，节奏不紧不慢。' },
    { k: '谨慎重风险', t: '对方谨慎、风险厌恶，会反复确认可靠性与业绩。' },
    { k: '强势压价', t: '对方强势、对价格敏感，习惯施压压价。' },
    { k: '关系导向', t: '对方重关系与信任，先做人后做事。' },
    { k: '技术控', t: '对方技术出身，喜欢深挖参数与方案细节。' },
  ];
  const PRODUCT_TOKENS = ['预制舱', '移动变', 'e-house', 'ehouse', '储能', '并网', '配电', '开关', '升压', '成套'];

  function persona(p) {
    const i = hash(p.id) % STYLE.length;
    return { role: ROLE[p.cat] || ROLE._default, style: STYLE[i].k, styleText: STYLE[i].t };
  }

  // 训练价值评分：有客户画像 / 旗舰 / 大投资 / 近期更优先
  function trainValue(p, ck, meta) {
    let s = 0;
    if (meta) s += 60;
    if (ck) s += 15;
    if (p.flagship) s += 18;
    s += Math.log10((p.inv || 0) + 10) * 8;
    if ((p.updated || '') >= (META.recentSince || '9999')) s += 10;
    if (p.owner) s += 6;
    return s;
  }

  // 构建商机池
  const OPPS = PROJECTS.map(p => {
    const ck = clientKeyOf(p);
    const meta = ck ? CLIENT_META[ck] : null;
    return { p: p, ck: ck, meta: meta, tv: trainValue(p, ck, meta) };
  }).sort((a, b) => b.tv - a.tv);
  const OPP_BY_ID = {};
  OPPS.forEach(o => { OPP_BY_ID[o.p.id] = o; });

  // 国家→大区映射 + 按项目数排序的国家清单（供「当地·谈资」速查的国家选择）
  const CAT_KEYS = Object.keys(CATEGORIES);
  const COUNTRY_REGION = {}, COUNTRY_CNT = {};
  PROJECTS.forEach(p => { if (p.country) { if (!COUNTRY_REGION[p.country]) COUNTRY_REGION[p.country] = p.region; COUNTRY_CNT[p.country] = (COUNTRY_CNT[p.country] || 0) + 1; } });
  const COUNTRIES = Object.keys(COUNTRY_CNT).sort((a, b) => COUNTRY_CNT[b] - COUNTRY_CNT[a]);

  // 上下文：t=展示文本（模板替换）；kw=匹配用短词（rubric 占位符展开）
  // over/kwOver：经典大单剧本(signature)用，覆盖客户画像/产品/痛点等字段与匹配短词
  function buildContext(opp, over, kwOver) {
    const p = opp.p, meta = opp.meta;
    const cust = opp.ck ? (CLIENT_LABEL[opp.ck] || U.normalizeOwner(p.owner || '')) : (U.normalizeOwner(p.owner || '') || '该项目业主');
    const per = persona(p);
    const product = (meta && meta.product) || PRODUCT[p.cat] || PRODUCT._default;
    const scenario = (meta && meta.scenario) || SCENARIO[p.cat] || SCENARIO._default;
    const approach = (meta && meta.approach) || APPROACH._default;
    const pain = (PAIN[p.cat] || PAIN._default);
    // 产品匹配短词：扫描推荐产品串中出现的已知 token，没命中给兜底
    let prodKw = PRODUCT_TOKENS.filter(t => norm(product).indexOf(t) >= 0);
    if (!prodKw.length) prodKw = ['预制舱'];
    const t = {
      co: p.country || '该国', cust: cust, role: per.role, proj: p.name, cat: catShort(p.cat),
      usd: usd(p), inv: p.invText || usd(p), product: product, scenario: scenario,
      pain: pain.txt, status: p.status || '规划', approach: approach, persona: per.styleText,
    };
    const kw = {
      pain: pain.kw, product: prodKw, cust: [cust, U.normalizeOwner(p.owner || '')].filter(Boolean),
      proj: [p.country, catShort(p.cat), '项目'].filter(Boolean), co: [p.country].filter(Boolean), cat: [catShort(p.cat)],
    };
    if (over) Object.keys(over).forEach(k => { if (over[k] != null) t[k] = over[k]; });
    if (kwOver) Object.keys(kwOver).forEach(k => { if (kwOver[k]) kw[k] = kwOver[k]; });
    return { opp: opp, p: p, persona: per, t: t, kw: kw };
  }

  // 模板替换 {key}
  function tpl(str, ctx) {
    return String(str == null ? '' : str).replace(/\{(\w+)\}/g, (m, k) => (ctx && ctx.t && ctx.t[k] != null) ? ctx.t[k] : m);
  }

  /* ---------- 当地适配 & 谈资：按 country 覆盖 region 默认，cat 取分品类谈资 ---------- */
  function mergeDefs(map, country, region) {
    const base = (map && (map[region] || map._default)) || {};
    const over = (map && country && map[country]) || null;
    return Object.assign({}, base, over || {});
  }
  function localPack(p) {
    const co = p.country || '', rg = p.region || '';
    return {
      culture: mergeDefs(C.culture, co, rg),
      standards: mergeDefs(C.standards, co, rg),
      topics: (C.catTopics && (C.catTopics[p.cat] || C.catTopics._default)) || {},
      cultureSrc: (C.culture && co && C.culture[co]) ? co : (rg || '通用'),
      standardsSrc: (C.standards && co && C.standards[co]) ? co : (rg || '通用'),
    };
  }
  // 当地适配 + 谈资的展示 HTML（被对练步骤的折叠盒与「当地·谈资」速查页共用）
  function localPackHTML(p) {
    const lp = localPack(p), c = lp.culture, s = lp.standards, tp = lp.topics;
    const sec = (title, rows) => '<div class="lp-sec"><div class="lp-h">' + title + '</div>' +
      rows.filter(r => r[1]).map(r => '<div class="lp-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>';
    return '<div class="localbox">' +
      sec('🤝 商务文化 · ' + esc(lp.cultureSrc), [['礼仪', c.etiquette], ['建立信任', c.rapport], ['谈判风格', c.nego], ['禁忌', c.taboo]]) +
      sec('📐 当地标准 / 准入 · ' + esc(lp.standardsSrc), [['电压 / 频率', s.volt], ['标准体系', s.codes], ['认证 / 准入', s.cert], ['本地含量 / 合规', s.local]]) +
      sec('🗣️ ' + esc(catShort(p.cat)) + ' 谈资（聊这些显专业）', [['行业热点', tp.hot], ['客户最关心', tp.care], ['技术谈资', tp.talk], ['破冰话题', tp.opener]]) +
      (c.smalltalk ? '<div class="lp-smalltalk">☕ 寒暄谈资：' + esc(c.smalltalk) + '</div>' : '') +
      '</div>';
  }
  // 对练步骤里的折叠盒（点开才显，避免喧宾夺主）
  function localBox(ctx) {
    const open = state.revealLocal;
    const head = '<button class="local-toggle" data-act="local">🌍 当地文化 · 标准 · 🗣️ 谈资 <span>' + (open ? '▾ 收起' : '▸ 展开，跟客户聊得更专业') + '</span></button>';
    return '<div class="localwrap">' + head + (open ? localPackHTML(ctx.p) : '') + '</div>';
  }

  /* ============================================================
   * 评分引擎（离线确定性）
   * ============================================================ */
  // kw 可为：普通子串 / 're:正则' / '{占位符}'（展开为 ctx.kw[name] 多个短词）
  function kwMatch(textLow, kw, ctx) {
    if (kw == null) return false;
    const ph = /^\{(\w+)\}$/.exec(kw);
    if (ph) { const arr = (ctx && ctx.kw && ctx.kw[ph[1]]) || []; return arr.some(w => w && textLow.indexOf(norm(w)) >= 0); }
    if (kw.indexOf('re:') === 0) { try { return new RegExp(kw.slice(3), 'i').test(textLow); } catch (e) { return false; } }
    return textLow.indexOf(norm(kw)) >= 0;
  }

  // 语气扫描：good 六类各计是否出现 + bad / arrogant 计数
  function toneScan(textLow) {
    const g = C.tone.good; let goodTypes = 0; const goodHit = {};
    Object.keys(g).forEach(key => {
      const hit = (g[key].kw || []).some(w => textLow.indexOf(norm(w)) >= 0);
      goodHit[key] = hit; if (hit) goodTypes++;
    });
    const bad = (C.tone.bad || []).filter(w => textLow.indexOf(norm(w)) >= 0);
    const arrogant = (C.tone.arrogant || []).filter(w => textLow.indexOf(norm(w)) >= 0);
    const defensive = (C.tone.defensive || []).filter(w => textLow.indexOf(norm(w)) >= 0);
    return { goodTypes: goodTypes, goodHit: goodHit, bad: bad, arrogant: arrogant, defensive: defensive };
  }

  function starsOf(total) { return total >= 90 ? 5 : total >= 75 ? 4 : total >= 58 ? 3 : total >= 40 ? 2 : 1; }
  function xpOf(total, stars) { return Math.round(total / 12) + (stars >= 5 ? 3 : stars >= 4 ? 1 : 0); }

  // 开放题评分
  function scoreFree(text, round, ctx) {
    const t = norm(text);
    const rub = round.rubric || [];
    let totW = 0, gotW = 0; const detail = [];
    rub.forEach(c => {
      totW += c.w; const hit = (c.kw || []).some(k => kwMatch(t, k, ctx));
      if (hit) gotW += c.w; detail.push({ label: c.label, hit: hit, w: c.w });
    });
    let base = totW ? Math.round(gotW / totW * 100) : 60;
    const tn = toneScan(t);
    const bonus = Math.min(tn.goodTypes * 4, 18);
    const penalty = tn.bad.length * 14 + tn.arrogant.length * 12 + (tn.defensive || []).length * 12;
    const len = String(text || '').replace(/\s/g, '').length;
    let lenNote = '';
    if (len < 10) { base = Math.min(base, 35); lenNote = '回答过短，话术需要展开论述。'; }
    else if (len < 24) { lenNote = '可以再展开一点，把价值与下一步说足。'; }
    const total = clamp(base + bonus - penalty, 0, 100);
    const stars = starsOf(total);
    return { total: total, base: base, detail: detail, tone: tn, bonus: bonus, penalty: penalty, lenNote: lenNote, stars: stars, xp: xpOf(total, stars), mode: 'free' };
  }
  // 选择题评分
  function scoreChoice(choice) {
    const total = clamp(choice.score || 0, 0, 100), stars = starsOf(total);
    return { total: total, stars: stars, xp: xpOf(total, stars), fb: choice.fb || '', mode: 'mc' };
  }

  /* ============================================================
   * 进度 / 成长档案（localStorage）
   * ============================================================ */
  function loadProgress() {
    let d = {};
    try { d = JSON.parse(store.get('coach.v1') || '{}') || {}; } catch (e) { d = {}; }
    return {
      xp: d.xp || 0, dealsClosed: d.dealsClosed || 0, dealsRun: d.dealsRun || 0,
      stageBest: d.stageBest || {}, history: d.history || [],
    };
  }
  function saveProgress() { try { store.set('coach.v1', JSON.stringify(prog)); } catch (e) { /* ignore */ } }
  let prog = loadProgress();

  function levelOf(xp) {
    const L = C.levels; let idx = 0;
    for (let i = 0; i < L.length; i++) if (xp >= L[i].min) idx = i;
    const cur = L[idx], next = L[idx + 1] || null;
    const into = xp - cur.min, span = next ? next.min - cur.min : 1;
    return { idx: idx, cur: cur, next: next, pct: next ? clamp(Math.round(into / span * 100), 0, 100) : 100, toNext: next ? next.min - xp : 0 };
  }
  function awardXP(n) { prog.xp += n; saveProgress(); renderHeader(); }

  /* ============================================================
   * 状态机
   * ============================================================ */
  const state = {
    mode: 'deal',          // deal 闯关 | drill 单项特训 | lib 话术库 | product 产品速查 | profile 成长档案
    diff: 'mix',           // easy 选择题 | mix 混合 | free 全开放
    ai: false,             // AI 自由陪练开关
    deal: null,            // 当前剧本：{opp,ctx,steps,step,results,single,kind}
    revealHint: false,
    revealLocal: false,    // 对练步骤里「当地文化·标准·谈资」折叠盒是否展开
    answered: null,        // 当前回合作答结果（评分对象），null=未答
    oppQuery: '',
    localCountry: '', localCat: '',  // 「当地·谈资」速查页的选择
  };

  // 漏斗阶段按 key 索引（signature / drill 的阶段对象虽非同一引用，但 key 相同即可对齐进度条）
  const FUNNEL_IDX = {}; C.stages.forEach((s, i) => { FUNNEL_IDX[s.key] = i; });
  const inFunnel = st => FUNNEL_IDX[st.key] != null;
  // 把若干 stage 展开成「步骤序列」：[{stage, round, sIdx}]；sIdx 取该阶段在完整漏斗中的真实序号
  // （单项特训 / 经典大单按 key 对齐，如「异议化解」恒为第 5 关；抗压等漏斗外阶段 sIdx=0）。
  function stepsOf(stages) {
    const steps = [];
    stages.forEach(st => { const si = FUNNEL_IDX[st.key]; (st.rounds || []).forEach(r => steps.push({ stage: st, round: r, sIdx: si == null ? 0 : si })); });
    return steps;
  }
  const DIFF_LABEL = { easy: '选择题（最轻松）', mix: '混合（推荐）', free: '全开放（高阶）' };

  function useMC(step) {
    if (!step.round.choices) return false;
    if (state.diff === 'easy') return true;
    if (state.diff === 'free') return false;
    return step.sIdx < 4; // mix：前 4 阶段用选择题打基础，之后转开放
  }

  const PRESSURE_STAGE = (C.pressure && C.pressure.stage) || null;

  function startDeal(opp, single) {
    const ctx = buildContext(opp);
    const stages = single ? [single] : C.stages;
    const kind = single ? (single.key === 'pressure' ? 'pressure' : 'drill') : 'deal';
    state.deal = { opp: opp, ctx: ctx, steps: stepsOf(stages), step: 0, results: [], single: !!single, kind: kind, stageKey: single ? single.key : null };
    state.answered = null; state.revealHint = false;
    prog.dealsRun = (prog.dealsRun || 0) + 1; saveProgress();
  }

  // 经典大单剧本：绑定真实项目，覆盖客户画像，走手写的全 8 阶段
  function startSignature(sig) {
    const opp = OPP_BY_ID[sig.projId] || OPPS[0];
    const ctx = buildContext(opp, sig.over, sig.kw);
    state.deal = { opp: opp, ctx: ctx, steps: stepsOf(sig.stages || []), step: 0, results: [], single: false, kind: 'signature', sig: sig };
    state.answered = null; state.revealHint = false;
    prog.dealsRun = (prog.dealsRun || 0) + 1; saveProgress();
  }

  function randomOpp(weighted) {
    if (!OPPS.length) return null;
    if (weighted) { const top = OPPS.slice(0, 120); return top[Math.floor(Math.random() * top.length)]; }
    return OPPS[Math.floor(Math.random() * OPPS.length)];
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  function renderHeader() {
    const lv = levelOf(prog.xp);
    setHTML('lvl-icon', lv.cur.icon);
    setHTML('lvl-name', esc(lv.cur.name));
    setHTML('xp-text', prog.xp + ' XP' + (lv.next ? ' · 距「' + esc(lv.next.name) + '」还差 ' + lv.toNext : ' · 已封顶'));
    const f = $('xp-fill'); if (f) f.style.width = lv.pct + '%';
    setHTML('hd-deals', '成交 ' + (prog.dealsClosed || 0));
  }

  function renderTabs() {
    const tabs = [
      ['deal', '🎯 闯关成交'], ['signature', '🎓 经典战役'], ['drill', '🎚️ 单项特训'],
      ['pressure', '🧘 抗压特训'], ['local', '🌍 当地·谈资'], ['lib', '💬 话术库'],
      ['product', '📦 产品速查'], ['profile', '📈 成长档案'],
    ];
    const c = $('mode-tabs'); if (!c) return;
    c.innerHTML = tabs.map(t => '<button class="mtab' + (state.mode === t[0] ? ' on' : '') + '" data-act="mode" data-mode="' + t[0] + '">' + t[1] + '</button>').join('');
  }

  function render() {
    renderHeader(); renderTabs();
    syncControls();
    const m = state.mode;
    if (m === 'deal') renderDeal();
    else if (m === 'signature') renderSignature();
    else if (m === 'drill') renderDrill();
    else if (m === 'pressure') renderPressure();
    else if (m === 'local') renderLocal();
    else if (m === 'lib') renderLib();
    else if (m === 'product') renderProduct();
    else if (m === 'profile') renderProfile();
  }

  function syncControls() {
    setHTML('diff-label', DIFF_LABEL[state.diff]);
    const ai = $('ai-toggle'); if (ai) ai.classList[state.ai ? 'add' : 'remove']('on');
    const aiBox = $('ai-config'); if (aiBox) aiBox.style.display = state.ai ? 'block' : 'none';
  }

  /* ---------- 商机简报卡 ---------- */
  function briefCard(ctx, compact) {
    const p = ctx.p;
    return '<div class="brief">' +
      '<div class="brief-top"><span class="brief-cat" style="--c:' + catColor(p.cat) + '">' + catIcon(p.cat) + ' ' + esc(catShort(p.cat)) + '</span>' +
      '<span class="brief-stat">' + esc(p.status || '') + '</span><span class="brief-usd">' + esc(usd(p)) + '</span></div>' +
      '<div class="brief-name">' + esc(p.name) + '</div>' +
      '<div class="brief-meta"><b>🌍 ' + esc(p.country || '') + '</b> · 客户 <b>' + esc(ctx.t.cust) + '</b> · 对接 <b>' + esc(ctx.t.role) + '</b></div>' +
      (compact ? '' :
        '<div class="brief-grid">' +
        kv('对接人风格', ctx.t.persona) +
        kv('核心痛点', ctx.t.pain) +
        kv('推荐产品', ctx.t.product) +
        kv('海外场景', ctx.t.scenario) +
        kv('建议打法', ctx.t.approach) +
        (p.owner ? kv('业主 / 参与方', p.owner) : '') +
        '</div>' +
        (p.desc ? '<div class="brief-desc">📄 ' + esc(p.desc) + '</div>' : '')) +
      '</div>';
  }
  function kv(k, v) { return '<div class="kvp"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; }

  /* ---------- 闯关成交 ---------- */
  function renderDeal() {
    const d = state.deal;
    if (!d || d.kind !== 'deal') return renderOppPicker();
    if (d.step >= d.steps.length) return renderSummary();
    renderStep();
  }

  // 经典大单战役
  function renderSignature() {
    const d = state.deal;
    if (d && d.kind === 'signature') { if (d.step >= d.steps.length) return renderSummary(); return renderStep(); }
    const cards = (C.signatures || []).map(s =>
      '<button class="sig-card" data-act="sig" data-key="' + s.key + '">' +
      '<div class="sig-ico">' + s.icon + '</div>' +
      '<div class="sig-name">' + esc(s.name) + '</div>' +
      '<div class="sig-sub">' + esc(s.subtitle) + '</div>' +
      '<div class="sig-go">▶ 接受挑战 · 全 8 关</div></button>').join('');
    setHTML('deck',
      '<div class="deck-head"><h2>🎓 经典大单战役</h2>' +
      '<p class="deck-tip">手写打磨的真实旗舰大单，从情报到交付走完完整 8 关，每一关都针对该项目的真实痛点——这是检验综合功力的"毕业考"。</p></div>' +
      '<div class="sig-grid">' + cards + '</div>');
  }

  // 抗压特训
  function renderPressure() {
    const d = state.deal;
    if (d && d.kind === 'pressure') { if (d.step >= d.steps.length) return renderSummary(); return renderStep(); }
    const tips = ((C.pressure && C.pressure.tips) || []).map(t => '<li>' + esc(t) + '</li>').join('');
    setHTML('deck',
      '<div class="deck-head"><h2>🧘 抗压特训 · 销售经理心态淬炼</h2>' +
      '<p class="deck-tip">' + esc((C.pressure && C.pressure.intro) || '') + '</p></div>' +
      '<div class="pressure-hero">' +
      '<div class="ph-best">抗压指数最佳 <b>' + (prog.stageBest['pressure'] || 0) + '</b> / 100</div>' +
      '<button class="btn-primary" data-act="pressure-start">🎲 来一场高压对练（6 连击）</button></div>' +
      '<div class="psec"><h3>抗压心法</h3><ul class="tips">' + tips + '</ul></div>');
  }

  function renderOppPicker() {
    const q = norm(state.oppQuery);
    let list;
    if (q) list = OPPS.filter(o => norm(o.p.name).indexOf(q) >= 0 || norm(o.p.country).indexOf(q) >= 0 || norm(o.p.owner).indexOf(q) >= 0).slice(0, 40);
    else list = OPPS.slice(0, 40);
    const cards = list.map(o => {
      const tag = o.meta ? '<span class="opp-tag gold">★ 重点客户</span>' : (o.p.flagship ? '<span class="opp-tag">旗舰</span>' : '');
      const cust = o.ck ? (CLIENT_LABEL[o.ck] || U.normalizeOwner(o.p.owner || '')) : (U.normalizeOwner(o.p.owner || '') || '业主');
      return '<button class="opp-card" data-act="pick" data-id="' + o.p.id + '">' +
        '<div class="opp-h"><span class="opp-cat" style="--c:' + catColor(o.p.cat) + '">' + catIcon(o.p.cat) + '</span>' + tag + '<span class="opp-usd">' + esc(usd(o.p)) + '</span></div>' +
        '<div class="opp-name">' + esc(o.p.name) + '</div>' +
        '<div class="opp-sub">🌍 ' + esc(o.p.country || '') + ' · ' + esc(cust) + ' · ' + esc(o.p.status || '') + '</div>' +
        '<div class="opp-go">▶ 接单开练</div></button>';
    }).join('');
    setHTML('deck',
      '<div class="deck-head"><h2>🎯 选择商机 · 从零做到成交</h2>' +
      '<p class="deck-tip">挑一个真实项目接单，走完「情报→破冰→需求→价值→异议→谈判→促成→交付」八关。带 ★ 的是 54 家出海大客户的项目，画像最完整、最适合上手。</p></div>' +
      '<div class="opp-bar"><input id="opp-search" class="opp-search" type="text" placeholder="🔍 搜索项目 / 国家 / 业主…" value="' + esc(state.oppQuery) + '">' +
      '<button class="btn-rand" data-act="rand">🎲 随机派单</button></div>' +
      '<div class="opp-grid">' + (cards || '<div class="empty">没有匹配的商机，换个关键词试试。</div>') + '</div>');
    const si = $('opp-search'); if (si && si.addEventListener) si.addEventListener('input', e => { state.oppQuery = e.target.value; renderOppPickerListOnly(); });
  }
  // 仅刷新列表，避免重渲染输入框丢焦点
  function renderOppPickerListOnly() {
    const q = norm(state.oppQuery);
    let list = q ? OPPS.filter(o => norm(o.p.name).indexOf(q) >= 0 || norm(o.p.country).indexOf(q) >= 0 || norm(o.p.owner).indexOf(q) >= 0).slice(0, 40) : OPPS.slice(0, 40);
    const grid = document.querySelector ? document.querySelector('.opp-grid') : null;
    if (!grid) return;
    grid.innerHTML = list.map(o => {
      const tag = o.meta ? '<span class="opp-tag gold">★ 重点客户</span>' : (o.p.flagship ? '<span class="opp-tag">旗舰</span>' : '');
      const cust = o.ck ? (CLIENT_LABEL[o.ck] || U.normalizeOwner(o.p.owner || '')) : (U.normalizeOwner(o.p.owner || '') || '业主');
      return '<button class="opp-card" data-act="pick" data-id="' + o.p.id + '">' +
        '<div class="opp-h"><span class="opp-cat" style="--c:' + catColor(o.p.cat) + '">' + catIcon(o.p.cat) + '</span>' + tag + '<span class="opp-usd">' + esc(usd(o.p)) + '</span></div>' +
        '<div class="opp-name">' + esc(o.p.name) + '</div>' +
        '<div class="opp-sub">🌍 ' + esc(o.p.country || '') + ' · ' + esc(cust) + ' · ' + esc(o.p.status || '') + '</div>' +
        '<div class="opp-go">▶ 接单开练</div></button>';
    }).join('') || '<div class="empty">没有匹配的商机，换个关键词试试。</div>';
  }

  // 阶段进度条
  function stepper(d) {
    const curStage = d.steps[Math.min(d.step, d.steps.length - 1)].sIdx;
    return '<div class="stepper">' + C.stages.map((st, i) => {
      const cls = i < curStage ? 'done' : (i === curStage ? 'cur' : '');
      return '<div class="sx ' + cls + '" title="' + esc(st.name) + '"><span>' + st.icon + '</span><i>' + esc(st.name) + '</i></div>';
    }).join('') + '</div>';
  }

  function renderStep() {
    const d = state.deal, ctx = d.ctx, step = d.steps[d.step], st = step.stage, r = step.round;
    const mc = useMC(step);
    const backLabel = d.kind === 'pressure' ? '‹ 退出抗压' : d.kind === 'drill' ? '‹ 换一关' : d.kind === 'signature' ? '‹ 退出战役' : '‹ 换商机';
    const ofLabel = inFunnel(st)
      ? (d.single ? ('第 ' + (step.sIdx + 1) + '/' + C.stages.length + ' 关 · 回合 ' + (d.step + 1) + '/' + d.steps.length)
        : ('第 ' + (step.sIdx + 1) + '/' + C.stages.length + ' 关'))
      : ('压力回合 ' + (d.step + 1) + '/' + d.steps.length);
    const head =
      '<div class="deck-head step-head">' +
      '<button class="btn-back" data-act="abandon">' + backLabel + '</button>' +
      '<h2>' + st.icon + ' ' + esc(st.name) + ' <span class="step-of">' + ofLabel + '</span></h2>' +
      '<p class="stage-goal">🎯 ' + esc(st.goal) + '</p></div>';
    const stepHTML = (d.single ? '' : stepper(d));
    const brief = briefCard(ctx, true);
    const briefLine = st.brief ? '<div class="stage-brief">📋 ' + esc(tpl(st.brief, ctx)) + '</div>' : '';
    const ask = '<div class="bubble cust"><div class="who">🗣️ 情境</div><div class="say">' + esc(tpl(r.ask, ctx)) + '</div></div>';

    let inputHTML = '';
    if (state.answered) {
      inputHTML = feedbackHTML(step, ctx);
    } else if (mc) {
      inputHTML = '<div class="choices">' + r.choices.map((ch, i) =>
        '<button class="choice" data-act="choose" data-i="' + i + '">' + esc(tpl(ch.t, ctx)) + '</button>').join('') + '</div>';
    } else {
      const hint = state.revealHint && r.hint ? '<div class="hintbox"><b>💡 要点提示</b><ul>' + r.hint.map(h => '<li>' + esc(tpl(h, ctx)) + '</li>').join('') + '</ul></div>' : '';
      inputHTML =
        hint +
        '<textarea id="free-input" class="free-input" rows="4" placeholder="在这里写下你的话术应对…（练习模式：随时可看提示、看黄金话术、重来）"></textarea>' +
        '<div class="act-row">' +
        '<button class="btn-primary" data-act="submit">提交话术</button>' +
        '<button class="btn-ghost" data-act="hint">💡 ' + (state.revealHint ? '收起提示' : '看提示') + '</button>' +
        '<button class="btn-ghost" data-act="reveal">🏅 看黄金话术（不计分）</button>' +
        '</div>';
    }
    setHTML('deck', head + stepHTML + brief + briefLine + localBox(ctx) + ask + '<div class="answer-zone">' + inputHTML + '</div>');
  }

  function starStr(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

  function feedbackHTML(step, ctx) {
    const a = state.answered, r = step.round;
    const gold = '<div class="gold"><div class="who">🏅 黄金话术参考</div><div class="say">' + esc(tpl(r.gold || (r.choices ? bestChoice(r) : ''), ctx)) + '</div></div>';
    let body = '';
    if (a.mode === 'mc') {
      body = '<div class="fb-line">' + esc(a.fb ? tpl(a.fb, ctx) : '') + '</div>';
    } else {
      const items = a.detail.map(d =>
        '<li class="' + (d.hit ? 'y' : 'n') + '">' + (d.hit ? '✓' : '✗') + ' ' + esc(d.label) + '</li>').join('');
      const tn = a.tone;
      let toneNotes = [];
      if (tn.bad.length) toneNotes.push('<span class="bad">⚠ 跪舔/自降身价：' + esc(tn.bad.join('、')) + '</span>');
      if (tn.arrogant.length) toneNotes.push('<span class="bad">⚠ 过于强压/傲慢：' + esc(tn.arrogant.join('、')) + '</span>');
      if (tn.defensive && tn.defensive.length) toneNotes.push('<span class="bad">⚠ 情绪失控/顶撞防御：' + esc(tn.defensive.join('、')) + '（抗压要稳住）</span>');
      if (tn.goodHit && tn.goodHit.composure) toneNotes.push('<span class="good">✓ 镇定从容、对事不对人</span>');
      if (tn.goodTypes >= 3) toneNotes.push('<span class="good">✓ 语气专业、不卑不亢（命中 ' + tn.goodTypes + ' 类加分表达）</span>');
      if (a.lenNote) toneNotes.push('<span class="warn">' + esc(a.lenNote) + '</span>');
      body = '<div class="fb-rubric"><b>要点覆盖</b><ul>' + items + '</ul></div>' +
        (toneNotes.length ? '<div class="fb-tone">' + toneNotes.join('') + '</div>' : '');
    }
    const verdict = a.total >= 75 ? '<span class="v good">表现优秀</span>' : a.total >= 55 ? '<span class="v warn">合格，可更好</span>' : '<span class="v bad">需要重练</span>';
    const next = (state.deal.step >= state.deal.steps.length - 1) ? '完成本剧本 →' : '进入下一关 →';
    return '<div class="feedback">' +
      '<div class="fb-head"><span class="stars">' + starStr(a.stars) + '</span><span class="score">' + a.total + ' 分</span>' + verdict + '<span class="xp">+' + a.xp + ' XP</span></div>' +
      body + gold +
      '<div class="act-row">' +
      (a.total < 55 ? '<button class="btn-ghost" data-act="retry">↺ 重练这关</button>' : '') +
      '<button class="btn-primary" data-act="next">' + next + '</button></div></div>';
  }
  function bestChoice(r) { let b = (r.choices || [])[0]; (r.choices || []).forEach(c => { if ((c.score || 0) > (b.score || 0)) b = c; }); return b ? b.t : ''; }

  function commitResult(a, step) {
    state.answered = a;
    awardXP(a.xp);
    const key = step.stage.key;
    if (!prog.stageBest[key] || a.total > prog.stageBest[key]) prog.stageBest[key] = a.total;
    state.deal.results.push({ stage: key, total: a.total, stars: a.stars });
    saveProgress();
  }

  function renderSummary() {
    const d = state.deal, ctx = d.ctx;
    const res = d.results, n = res.length || 1;
    const avg = Math.round(res.reduce((s, r) => s + r.total, 0) / n);
    let outcome, oc;
    if (avg >= 80) { outcome = '🏆 高度认可 · 成功签约'; oc = 'win'; }
    else if (avg >= 62) { outcome = '✅ 顺利成交'; oc = 'ok'; }
    else if (avg >= 45) { outcome = '⚠️ 勉强推进 · 客户仍有顾虑'; oc = 'warn'; }
    else { outcome = '❌ 暂时丢单 · 复盘再来'; oc = 'lose'; }
    const closed = avg >= 62;
    if (closed) { prog.dealsClosed = (prog.dealsClosed || 0) + 1; }
    const bonus = Math.round(avg / 5) + (avg >= 80 ? 20 : 0);
    awardXP(bonus);
    prog.history.unshift({ name: ctx.p.name, avg: avg, outcome: outcome, at: Date.now() });
    prog.history = prog.history.slice(0, 30); saveProgress();
    const bars = res.map(r => {
      const st = C.stages.filter(s => s.key === r.stage)[0] || { name: r.stage, icon: '•' };
      return '<div class="sumbar"><span>' + (st.icon || '') + ' ' + esc(st.name) + '</span><i style="width:' + r.total + '%"></i><b>' + r.total + '</b></div>';
    }).join('');
    setHTML('deck',
      '<div class="summary ' + oc + '">' +
      '<div class="sum-outcome">' + outcome + '</div>' +
      '<div class="sum-deal">' + esc(ctx.p.name) + ' · ' + esc(ctx.t.cust) + '</div>' +
      '<div class="sum-avg">综合得分 <b>' + avg + '</b> / 100 · 本单 +' + bonus + ' XP</div>' +
      '<div class="sum-bars">' + bars + '</div>' +
      '<div class="sum-msg">' + esc(summaryMsg(avg)) + '</div>' +
      '<div class="act-row"><button class="btn-primary" data-act="replay">↺ 复盘重打</button>' +
      '<button class="btn-ghost" data-act="newdeal">🎯 换个商机</button></div></div>');
  }
  function summaryMsg(avg) {
    if (avg >= 80) return '炉火纯青——从研判到交付全程不卑不亢、价值清晰，客户高度信任。这就是资深国际销售经理的样子。';
    if (avg >= 62) return '稳扎稳打地拿下了！再打磨异议化解与谈判的"条件交换"，离金牌更近一步。';
    if (avg >= 45) return '推进住了但客户仍有顾虑。回看哪几关掉了分，多用量化价值与共同行动计划补强。';
    return '别气馁——丢单是最好的老师。对照黄金话术逐关复盘，换个商机再来，进步很快。';
  }

  // 当地适配 & 谈资速查（独立参考页：选国家 + 品类）
  function renderLocal() {
    const dft = state.deal ? state.deal.opp.p : ((OPPS[0] && OPPS[0].p) || { country: '沙特阿拉伯', region: '中东', cat: 'renewable' });
    if (!state.localCountry) state.localCountry = dft.country;
    if (!state.localCat) state.localCat = dft.cat;
    const co = state.localCountry, cat = state.localCat;
    const region = COUNTRY_REGION[co] || dft.region || '中东';
    const pseudo = { country: co, region: region, cat: cat };
    const catChips = CAT_KEYS.map(k => '<button class="lp-chip' + (k === cat ? ' on' : '') + '" data-act="localcat" data-cat="' + k + '" style="--c:' + catColor(k) + '">' + catIcon(k) + ' ' + esc(catShort(k)) + '</button>').join('');
    const dl = '<datalist id="co-list">' + COUNTRIES.map(c => '<option value="' + esc(c) + '"></option>').join('') + '</datalist>';
    setHTML('deck',
      '<div class="deck-head"><h2>🌍 当地适配 & 谈资速查</h2>' +
      '<p class="deck-tip">选国家与能源品类，临场前快速过一遍当地商务文化、标准 / 准入与可聊的谈资——跟客户交流更对路、更显专业、更有"谈资"。</p></div>' +
      '<div class="lp-bar"><input id="local-country" class="opp-search" list="co-list" placeholder="🔍 输入国家，如 沙特阿拉伯 / 印度 / 巴西…" value="' + esc(co) + '">' + dl + '</div>' +
      '<div class="lp-chips">' + catChips + '</div>' +
      localPackHTML(pseudo));
    const inp = $('local-country');
    if (inp && inp.addEventListener) inp.addEventListener('change', e => { const v = (e.target.value || '').trim(); if (v) { state.localCountry = v; renderLocal(); } });
  }

  /* ---------- 单项特训 ---------- */
  function renderDrill() {
    const d = state.deal;
    if (d && d.kind === 'drill') { if (d.step >= d.steps.length) return renderSummary(); return renderStep(); }
    const cards = C.stages.map(st =>
      '<button class="drill-card" data-act="drill" data-key="' + st.key + '">' +
      '<div class="dc-ico">' + st.icon + '</div><div class="dc-name">' + esc(st.name) + '</div>' +
      '<div class="dc-goal">' + esc(st.goal) + '</div>' +
      '<div class="dc-best">最佳 ' + (prog.stageBest[st.key] || 0) + ' 分</div></button>').join('');
    setHTML('deck',
      '<div class="deck-head"><h2>🎚️ 单项特训 · 专攻一关</h2>' +
      '<p class="deck-tip">哪一关弱就单独刷哪一关，系统会随机派一个真实商机让你反复打磨。</p></div>' +
      '<div class="drill-grid">' + cards + '</div>');
  }

  /* ---------- 话术库 ---------- */
  function renderLib() {
    const ctx = state.deal ? state.deal.ctx : buildContext(OPPS[0]);
    const groups = (C.pitchLib || []).map(g =>
      '<div class="lib-group"><div class="lib-stage">' + esc(g.stage) + '</div>' +
      g.lines.map(li => '<div class="lib-line"><span>' + esc(tpl(li, ctx)) + '</span><button class="btn-copy" data-act="copy" data-txt="' + esc(tpl(li, ctx)) + '">复制</button></div>').join('') +
      '</div>').join('');
    setHTML('deck',
      '<div class="deck-head"><h2>💬 话术库 · 即取即用</h2>' +
      '<p class="deck-tip">按成交阶段整理的金句，已套用当前商机「' + esc(ctx.p.name) + '」。点"复制"直接拿去用。</p></div>' +
      '<div class="lib-wrap">' + groups + '</div>');
  }

  /* ---------- 产品速查 ---------- */
  function renderProduct() {
    const cards = (C.products || []).map(pr =>
      '<div class="prod-card"><div class="pc-h"><span class="pc-ico">' + pr.icon + '</span><b>' + esc(pr.name) + '</b></div>' +
      '<div class="pc-pitch">' + esc(pr.pitch) + '</div>' +
      '<ul class="pc-val">' + pr.value.map(v => '<li>✓ ' + esc(v) + '</li>').join('') + '</ul>' +
      '<div class="pc-scene">📍 适用：' + esc(pr.scene) + '</div>' +
      '<div class="pc-proof">🔎 ' + esc(pr.proof) + '</div></div>').join('');
    const edge = (C.company.edge || []).map(e => '<li>✓ ' + esc(e) + '</li>').join('');
    setHTML('deck',
      '<div class="deck-head"><h2>📦 产品速查 · ' + esc(C.company.name) + '</h2>' +
      '<p class="deck-tip">' + esc(C.company.intro) + '</p>' +
      '<ul class="edge">' + edge + '</ul></div>' +
      '<div class="prod-grid">' + cards + '</div>');
  }

  /* ---------- 成长档案 ---------- */
  function renderProfile() {
    const lv = levelOf(prog.xp);
    const ladder = C.levels.map((l, i) =>
      '<div class="lad ' + (i === lv.idx ? 'cur' : (prog.xp >= l.min ? 'done' : '')) + '">' +
      '<span class="lad-ico">' + l.icon + '</span><b>' + esc(l.name) + '</b><i>' + l.min + ' XP</i>' +
      '<em>' + esc(l.tip) + '</em></div>').join('');
    const stageDefs = C.stages.concat(PRESSURE_STAGE ? [PRESSURE_STAGE] : []);
    const stageRows = stageDefs.map(st =>
      '<div class="prow"><span>' + st.icon + ' ' + esc(st.name) + '</span><i style="width:' + (prog.stageBest[st.key] || 0) + '%"></i><b>' + (prog.stageBest[st.key] || 0) + '</b></div>').join('');
    const hist = (prog.history || []).slice(0, 12).map(h =>
      '<div class="hrow"><span>' + esc(h.name) + '</span><b>' + h.avg + '</b><em>' + esc(h.outcome.replace(/^[^\s]+\s/, '')) + '</em></div>').join('') || '<div class="empty">还没有完整成交记录，去「闯关成交」打第一单吧。</div>';
    const tips = (C.tips || []).map(t => '<li>' + esc(t) + '</li>').join('');
    setHTML('deck',
      '<div class="deck-head"><h2>📈 成长档案</h2></div>' +
      '<div class="profile-top">' +
      '<div class="pcard"><div class="big">' + lv.cur.icon + '</div><b>' + esc(lv.cur.name) + '</b><span>' + prog.xp + ' XP</span></div>' +
      '<div class="pcard"><div class="big">' + (prog.dealsClosed || 0) + '</div><b>成功成交</b><span>共接单 ' + (prog.dealsRun || 0) + '</span></div>' +
      '<div class="pcard"><div class="big">' + lv.pct + '%</div><b>本段进度</b><span>' + (lv.next ? '距「' + esc(lv.next.name) + '」' + lv.toNext + ' XP' : '已封顶') + '</span></div>' +
      '</div>' +
      '<div class="psec"><h3>各关最佳成绩</h3><div class="pstages">' + stageRows + '</div></div>' +
      '<div class="psec"><h3>成长阶梯</h3><div class="ladder">' + ladder + '</div></div>' +
      '<div class="psec"><h3>近期成交</h3><div class="hist">' + hist + '</div></div>' +
      '<div class="psec"><h3>资深销售心法</h3><ul class="tips">' + tips + '</ul></div>' +
      '<div class="act-row"><button class="btn-ghost danger" data-act="wipe">⚠ 清空成长档案</button></div>');
  }

  /* ============================================================
   * AI 自由陪练（可选，自备 Key，OpenAI 兼容 /chat/completions）
   * ============================================================ */
  function aiConfig() {
    let c = {};
    try { c = JSON.parse(store.get('coach.ai') || '{}') || {}; } catch (e) { c = {}; }
    return { base: c.base || '', key: c.key || '', model: c.model || 'gpt-4o-mini' };
  }
  function saveAiConfig(c) { store.set('coach.ai', JSON.stringify(c)); }
  function aiSystemPrompt(ctx) {
    return '你在扮演一个 B2B 国际销售陪练里的"客户"。背景：销售方是中国特锐德(TGOOD)的国际销售经理，向你推销模块化预制舱变电站/车载移动变电站/E-house/中低压成套/储能并网舱。' +
      '你的身份：' + ctx.t.cust + ' 的' + ctx.persona.role + '，负责【' + ctx.p.name + '】(' + ctx.t.co + ' · ' + ctx.t.cat + ')。' +
      '你的性格：' + ctx.persona.styleText + ' 你方核心痛点：' + ctx.t.pain + '。' +
      '请用中文、以真实客户口吻回应销售的每句话：可以质疑、压价、提顾虑，但若对方话术专业、有量化价值与下一步，就逐步给予认可。每次回复 1~3 句，简洁真实。' +
      '在回复末尾另起一行用【教练】给销售一句不超过 30 字的改进点评。';
  }
  function aiChat(messages, ctx, cb) {
    const cfg = aiConfig();
    if (!cfg.base || !cfg.key) { cb('（未配置 AI：请在左侧填入 API 地址与 Key。）'); return; }
    if (typeof fetch === 'undefined') { cb('（当前环境不支持网络请求。）'); return; }
    const url = cfg.base.replace(/\/$/, '') + '/chat/completions';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: aiSystemPrompt(ctx) }].concat(messages), temperature: 0.7 }),
    }).then(r => r.json()).then(j => {
      const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      cb(txt || '（AI 无回复，请检查模型与配置。）');
    }).catch(e => cb('（AI 请求失败：' + (e && e.message || e) + '）'));
  }

  /* ============================================================
   * 事件
   * ============================================================ */
  function onClick(e) {
    const t = e.target && (e.target.closest ? e.target.closest('[data-act]') : null);
    if (!t) return;
    const act = t.getAttribute('data-act');
    if (act === 'mode') { state.mode = t.getAttribute('data-mode'); state.answered = null; render(); }
    else if (act === 'diff') { state.diff = state.diff === 'mix' ? 'easy' : state.diff === 'easy' ? 'free' : 'mix'; if (state.deal && !state.answered) render(); else syncControls(); }
    else if (act === 'ai') { state.ai = !state.ai; syncControls(); }
    else if (act === 'pick') { const o = OPP_BY_ID[+t.getAttribute('data-id')]; if (o) { startDeal(o); render(); } }
    else if (act === 'rand') { const o = randomOpp(true); if (o) { startDeal(o); render(); } }
    else if (act === 'drill') { const st = C.stages.filter(s => s.key === t.getAttribute('data-key'))[0]; if (st) { startDeal(randomOpp(true), st); render(); } }
    else if (act === 'sig') { const s = (C.signatures || []).filter(x => x.key === t.getAttribute('data-key'))[0]; if (s) { startSignature(s); render(); } }
    else if (act === 'pressure-start') { if (PRESSURE_STAGE) { startDeal(randomOpp(true), PRESSURE_STAGE); render(); } }
    else if (act === 'submit') { doSubmit(); }
    else if (act === 'choose') { doChoose(+t.getAttribute('data-i')); }
    else if (act === 'hint') { state.revealHint = !state.revealHint; render(); }
    else if (act === 'local') { state.revealLocal = !state.revealLocal; render(); }
    else if (act === 'localcat') { state.localCat = t.getAttribute('data-cat'); renderLocal(); }
    else if (act === 'reveal') { doReveal(); }
    else if (act === 'next') { advance(); }
    else if (act === 'retry') { state.answered = null; state.revealHint = false; render(); }
    else if (act === 'abandon' || act === 'newdeal') { state.deal = null; state.answered = null; render(); }
    else if (act === 'replay') {
      const d = state.deal;
      if (d.kind === 'signature') startSignature(d.sig);
      else if (d.single) startDeal(d.opp, d.steps[0].stage);
      else startDeal(d.opp);
      render();
    }
    else if (act === 'copy') { doCopy(t.getAttribute('data-txt')); }
    else if (act === 'wipe') { if (confirmSafe('确定清空全部成长档案与进度？此操作不可恢复。')) { prog = { xp: 0, dealsClosed: 0, dealsRun: 0, stageBest: {}, history: [] }; saveProgress(); render(); } }
    else if (act === 'ai-save') { doAiSave(); }
    else if (act === 'ai-send') { doAiSend(); }
  }
  function confirmSafe(msg) { try { return (typeof confirm === 'function') ? confirm(msg) : true; } catch (e) { return true; } }

  function doSubmit() {
    const ta = $('free-input'); const txt = ta ? ta.value : '';
    if (!txt || !txt.trim()) { flash('请先写下你的话术再提交～'); return; }
    const step = state.deal.steps[state.deal.step];
    const a = scoreFree(txt, step.round, state.deal.ctx); a.userText = txt;
    commitResult(a, step); render();
  }
  function doChoose(i) {
    const step = state.deal.steps[state.deal.step];
    const ch = step.round.choices[i];
    const a = scoreChoice(ch);
    commitResult(a, step); render();
  }
  function advance() { state.deal.step++; state.answered = null; state.revealHint = false; state.revealLocal = false; render(); }
  function doReveal() {
    // 看黄金话术（不计分）：直接进入反馈态但标记 0 XP、低分提示
    const step = state.deal.steps[state.deal.step];
    const a = { mode: 'free', total: 0, base: 0, stars: 0, xp: 0, detail: (step.round.rubric || []).map(c => ({ label: c.label, hit: false, w: c.w })), tone: { goodTypes: 0, bad: [], arrogant: [] }, lenNote: '（直接查看范例，本回合不计分）', revealed: true };
    state.answered = a; render();
  }
  function doCopy(txt) {
    try { if (navigator && navigator.clipboard) navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
    flash('已复制到剪贴板');
  }
  function flash(msg) {
    const f = $('toast'); if (!f) return;
    f.textContent = msg; f.classList.add('show');
    try { setTimeout(() => f.classList.remove('show'), 1600); } catch (e) { /* ignore */ }
  }
  function doAiSave() {
    const c = { base: ($('ai-base') || {}).value || '', key: ($('ai-key') || {}).value || '', model: ($('ai-model') || {}).value || 'gpt-4o-mini' };
    saveAiConfig(c); flash('AI 配置已保存（仅存于本机）');
  }
  function doAiSend() {
    const inp = $('ai-input'); const txt = inp ? inp.value : '';
    if (!txt || !txt.trim()) return;
    if (!state.deal) { flash('请先在「闯关成交」接一个商机'); return; }
    const log = $('ai-log');
    const ctx = state.deal.ctx;
    state.aiMsgs = state.aiMsgs || [];
    state.aiMsgs.push({ role: 'user', content: txt });
    if (log) log.innerHTML += '<div class="ai-u">🧑‍💼 你：' + esc(txt) + '</div>';
    if (inp) inp.value = '';
    aiChat(state.aiMsgs, ctx, reply => {
      state.aiMsgs.push({ role: 'assistant', content: reply });
      if (log) { log.innerHTML += '<div class="ai-c">🗣️ ' + esc(reply) + '</div>'; log.scrollTop = log.scrollHeight; }
    });
  }

  /* ============================================================
   * 启动
   * ============================================================ */
  function bindStatic() {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    document.addEventListener('click', onClick);
    const di = $('diff-cycle'); if (di && di.addEventListener) di.addEventListener('click', () => { state.diff = state.diff === 'mix' ? 'easy' : state.diff === 'easy' ? 'free' : 'mix'; if (state.deal && !state.answered) render(); else syncControls(); });
    // AI 配置回填
    const cfg = aiConfig();
    ['ai-base', 'ai-key', 'ai-model'].forEach((id, k) => { const e = $(id); if (e) e.value = [cfg.base, cfg.key, cfg.model][k]; });
  }

  function init() {
    bindStatic();
    render();
    // 首屏加载态淡出
    const ld = $('coach-loader'); if (ld && ld.classList) { try { setTimeout(() => ld.classList.add('gone'), 100); } catch (e) { ld.classList.add('gone'); } }
  }

  // 调试 / 测试句柄
  window.__COACH__ = {
    PROJECTS: PROJECTS, OPPS: OPPS, CONTENT: C, state: state,
    clientKeyOf: clientKeyOf, buildContext: buildContext, persona: persona, tpl: tpl,
    localPack: localPack, localPackHTML: localPackHTML, COUNTRIES: COUNTRIES, COUNTRY_REGION: COUNTRY_REGION,
    scoreFree: scoreFree, scoreChoice: scoreChoice, toneScan: toneScan, levelOf: levelOf,
    stepsOf: stepsOf, startDeal: startDeal, startSignature: startSignature, randomOpp: randomOpp, render: render,
    useMC: useMC, doSubmit: doSubmit, doChoose: doChoose, advance: advance, PRESSURE_STAGE: PRESSURE_STAGE,
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  } else {
    // Node 冒烟测试：无 DOM 事件循环，直接跑一次 render 校验装配
    try { render(); } catch (e) { /* 测试侧自行断言 */ }
  }
})();
