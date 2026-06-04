/* ============================================================
 * 全球能源项目世界地图 —— 纯函数工具层（无 DOM / 无 Leaflet 依赖）
 * ------------------------------------------------------------
 * 抽出 app.js 中可独立测试的纯逻辑：
 *   · SUB_DEFS / classifySub —— 子分类自动归类规则
 *   · parseCapacity          —— 自由文本容量 → 结构化数值
 *   · wgs2gcj / outOfChina    —— WGS-84 → GCJ-02 坐标纠偏
 * 双导出：浏览器挂到 window.ENERGY_UTIL；Node 走 module.exports（供 scripts/test-units.js 单测）。
 * 改这些规则只需改这一个文件，app.js 与单测共享同一份实现。
 * ============================================================ */
;(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ENERGY_UTIL = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 子分类（按关键词在 name/cap/desc 上自动归类）----------
   * 每个品类一组有序子分类：{key,label,zh[],en[]} 或 {key,label,fn}；
   * 末项无规则=兜底桶。classifySub 按顺序取首个命中，未命中归末项。 */
  const SUB_DEFS = {
    renewable: [
      { key: 'hydrogen', label: '绿氢绿氨', zh: ['绿氢', '绿氨', '制氢', '氢氨', '氢能'], en: ['hydrogen', 'ammonia'] },
      { key: 'offshore', label: '海上风电', zh: ['海上风', '海风'], en: ['offshore'] },
      { key: 'csp', label: '光热', zh: ['光热', '熔盐塔', '塔式光'], en: ['csp'] },
      { key: 'hydro', label: '水电', zh: ['水电'], en: ['hydropower', 'hydro'] },
      { key: 'geo', label: '地热', zh: ['地热'], en: ['geothermal'] },
      { key: 'solar', label: '光伏', zh: ['光伏', '太阳能', '光储'], en: ['solar', 'photovolta'] },
      { key: 'wind', label: '陆上风电', zh: ['风电', '风力'], en: ['wind'] },
      { key: 'base', label: '综合基地·其他' },
    ],
    nuclear: [
      { key: 'fusion', label: '核聚变', zh: ['聚变', '托卡马克', '人造太阳'], en: ['fusion', 'tokamak', 'iter'] },
      { key: 'smr', label: '小型模块化堆', zh: ['小型模块化', '模块化堆', '小堆', '玲龙'], en: ['smr', 'small modular'] },
      { key: 'gen4', label: '四代·特种堆', zh: ['高温气冷', '快堆', '第四代', '钍', '熔盐堆'], en: ['htgr', 'fast reactor', 'thorium', 'molten salt'] },
      { key: 'fuel', label: '核燃料·后端', zh: ['核燃料', '浓缩', '铀浓缩', '后处理', '乏燃料'], en: ['enrichment', 'fuel cycle', 'reprocessing'] },
      { key: 'pwr', label: '大型反应堆' },
    ],
    grid: [
      { key: 'uhv', label: '特高压', zh: ['特高压', '±800', '±1100', '1000千伏', '1100千伏'], en: ['uhv'] },
      { key: 'subsea', label: '海底电缆', zh: ['海缆', '海底电缆', '海底线', '跨海'], en: ['submarine', 'subsea'] },
      { key: 'hvdc', label: '直流输电', zh: ['直流', '柔直', '柔性直流', '±'], en: ['hvdc'] },
      { key: 'cross', label: '跨境互联', zh: ['互联', '跨境', '跨国'], en: ['interconnect'] },
      { key: 'ac', label: '交流输变电' },
    ],
    storage: [
      { key: 'pumped', label: '抽水蓄能', zh: ['抽水蓄能', '抽蓄'], en: ['pumped'] },
      { key: 'caes', label: '压缩空气', zh: ['压缩空气'], en: ['compressed air', 'caes'] },
      { key: 'flow', label: '液流电池', zh: ['液流', '全钒'], en: ['vanadium', 'flow batter'] },
      { key: 'novel', label: '新型长时储能', zh: ['钠离子', '锂钠', '重力储能', '液态空气', '熔盐', '储热', '铁空气'], en: ['laes', 'gravity', 'iron-air', 'molten', 'sodium'] },
      { key: 'liion', label: '锂电池储能' },
    ],
    ci: [
      { key: 'semi', label: '半导体晶圆', zh: ['半导体', '晶圆', '封测', '芯片', '晶体管'], en: ['fab', 'semiconductor', 'wafer', 'dram', 'osat'] },
      { key: 'auto', label: '整车工厂', zh: ['整车', '汽车', '车厂'], en: ['motors', 'vinfast'] },
      { key: 'battery', label: '电池工厂', zh: ['电池', '电芯', '储能系统'], en: ['battery', 'gigafactory', 'gwh'] },
      { key: 'steel', label: '绿色钢铁', zh: ['钢', '电弧炉', '绿钢', '直接还原铁'], en: ['steel', 'eaf', 'dri'] },
      { key: 'alu', label: '电解铝·有色', zh: ['电解铝', '铝业', '铝厂', '绿色铝', '惰性阳极'], en: ['aluminum', 'aluminium', 'smelter'] },
      { key: 'solar', label: '光伏制造', zh: ['光伏', '多晶硅', '硅片', '组件', '电池片'], en: ['qcells', 'hjt', 'solar'] },
      { key: 'chem', label: '化工新材料·其他' },
    ],
    datacenter: [
      { key: 'sovereign', label: '主权AI工厂', zh: ['主权'], en: ['sovereign'] },
      { key: 'hub', label: '东数西算枢纽', fn: (h, l, p) => p.region === '中国' && /东数西算|枢纽|集群/.test(h) },
      { key: 'ai', label: 'AI智算中心', zh: ['AI', '智算', '算力', '超算', '万卡', '人工智能'], en: ['stargate', 'xai', 'blackwell', 'nvidia', 'gpu'] },
      { key: 'cloud', label: '超大规模·云' },
    ],
    transport: [
      { key: 'airport', label: '机场', zh: ['机场', '航站楼'], en: ['airport'] },
      { key: 'port', label: '港口码头', zh: ['港', '码头'], en: ['port', 'terminal'] },
      { key: 'bridge', label: '跨海桥隧', fn: (h, l, p) => /大桥|隧道|通道|跨海|跨江|桥/.test(p.name) || /bridge|tunnel|crossing/.test((p.en || '').toLowerCase()) },
      { key: 'metro', label: '城市轨道', zh: ['地铁', '轻轨', '单轨', '市域', '有轨', '快速轨道', '快线'], en: ['metro', 'lrt', 'rrts', 'gtx'] },
      { key: 'hsr', label: '高铁铁路' },
    ],
    petro: [
      { key: 'lng', label: 'LNG液化·接收', zh: ['LNG', '液化天然气', '接收站', '再气化'], en: ['lng', 'flng'] },
      { key: 'pipe', label: '油气管道', zh: ['管道', '输气', '输油'], en: ['pipeline'] },
      { key: 'coal', label: '煤化工', zh: ['煤制', '煤化工', '煤直接液化', '甲醇制烯烃'], en: ['coal-to', 'mto'] },
      { key: 'upstream', label: '上游油气', zh: ['油田', '气田', '页岩', '区块', '增油', '增气', '油气田'], en: ['fpso', 'shale', 'oilfield', 'oil field', 'gas field'] },
      { key: 'refine', label: '炼化·乙烯' },
    ],
    mining: [
      { key: 'lithium', label: '锂', zh: ['锂', '盐湖'], en: ['lithium'] },
      { key: 'rareearth', label: '稀土', zh: ['稀土'], en: ['rare earth', 'rare-earth'] },
      { key: 'iron', label: '铁矿', zh: ['铁矿'], en: ['iron ore'] },
      { key: 'uranium', label: '铀', zh: ['铀'], en: ['uranium'] },
      { key: 'copper', label: '铜', zh: ['铜'], en: ['copper'] },
      { key: 'nickel', label: '镍钴', zh: ['镍', '钴'], en: ['nickel', 'cobalt'] },
      { key: 'other', label: '其他金属·煤' },
    ],
    client: [
      { key: 'powerchina',  label: '中国电建',  fn: (h, l, p) => /中国电建/.test(p.owner || '') },
      { key: 'energychina', label: '中国能建',  fn: (h, l, p) => /中国能建/.test(p.owner || '') },
      { key: 'sgcc',        label: '国网国际',  fn: (h, l, p) => /电力技术装备|国网/.test(p.owner || '') },
      { key: 'cpecc',       label: '中石油工程', fn: (h, l, p) => /中石油工程/.test(p.owner || '') },
      { key: 'ctg',         label: '三峡国际',  fn: (h, l, p) => /三峡/.test(p.owner || '') },
      { key: 'spic',        label: '国家电投',  fn: (h, l, p) => /国家电投/.test(p.owner || '') },
      { key: 'zijin',       label: '紫金矿业',  fn: (h, l, p) => /紫金/.test(p.owner || '') },
      { key: 'cmoc',        label: '洛阳钼业',  fn: (h, l, p) => /洛阳钼业|洛钼/.test(p.owner || '') },
      { key: 'cnmc',        label: '中国有色',  fn: (h, l, p) => /中国有色/.test(p.owner || '') },
      { key: 'byd',         label: '比亚迪',    fn: (h, l, p) => /比亚迪/.test(p.owner || '') },
      { key: 'catl',        label: '宁德时代',  fn: (h, l, p) => /宁德时代/.test(p.owner || '') },
      { key: 'gem',         label: '格林美',    fn: (h, l, p) => /格林美/.test(p.owner || '') },
      { key: 'gds',         label: '万国DayOne', fn: (h, l, p) => /万国数据|DayOne/.test(p.owner || '') },
      { key: 'chindata',    label: '秦淮数据',  fn: (h, l, p) => /秦淮/.test(p.owner || '') },
      { key: 'other', label: '其他客户' },
    ],
  };
  function classifySub(p) {
    const defs = SUB_DEFS[p.cat]; if (!defs) return '';
    const hay = p.name + ' ' + (p.en || '') + ' ' + (p.cap || '') + ' ' + (p.desc || '');
    const low = hay.toLowerCase();
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (!d.zh && !d.en && !d.fn) return d.key;
      if (d.fn) { if (d.fn(hay, low, p)) return d.key; continue; }
      let hit = false;
      if (d.zh) for (const w of d.zh) if (hay.indexOf(w) >= 0) { hit = true; break; }
      if (!hit && d.en) for (const w of d.en) if (low.indexOf(w) >= 0) { hit = true; break; }
      if (hit) return d.key;
    }
    return defs[defs.length - 1].key;
  }

  /* ---------- 容量解析：把自由文本 cap 抽成结构化数值 ----------
   * 返回 { mw, mwh, km, kbd, wty }：电功率MW / 储能MWh / 线路km / 油气万桶日 / 产能万吨年。
   * 取首个匹配为准；遇 "A+B" 加和；"N×M 单位" 相乘；MW/GW 用前瞻避免误吞 MWh/GWh。无则 null。 */
  function parseCapacity(cap) {
    const out = { mw: null, mwh: null, km: null, kbd: null, wty: null };
    if (!cap) return out;
    const s = String(cap).replace(/[，、]/g, ',').replace(/＋/g, '+').replace(/／/g, '/').replace(/[×✕⨯]/g, 'x').replace(/～/g, '~');
    const NUM = '(\\d+(?:\\.\\d+)?)', MUL = '(?:\\s*x\\s*(\\d+(?:\\.\\d+)?))?';
    function collect(unitAlt, factor) {
      const rg = new RegExp(NUM + MUL + '\\s*(?:' + unitAlt + ')', 'gi'), vals = []; let m;
      while ((m = rg.exec(s))) { let v = parseFloat(m[1]); if (m[2]) v *= parseFloat(m[2]); if (!isNaN(v)) vals.push({ v: v * factor, i: m.index }); }
      return vals;
    }
    function pick(vals) {
      if (!vals.length) return null;
      if (vals.length >= 2) {
        let additive = true;
        for (let k = 1; k < vals.length; k++) if (s.slice(vals[k - 1].i, vals[k].i).indexOf('+') < 0) { additive = false; break; }
        if (additive) return vals.reduce((a, b) => a + b.v, 0);
      }
      return vals[0].v;
    }
    const r = n => (n == null ? null : Math.round(n * 100) / 100);
    const power = [].concat(collect('GWp|GW(?!h)|吉瓦', 1000)).concat(collect('万千瓦(?!时)', 10)).concat(collect('MWp|MW(?!h)|兆瓦', 1)).concat(collect('kW(?!h)|千瓦(?!时)', 0.001));
    power.sort((a, b) => a.i - b.i); out.mw = r(pick(power));
    const energy = [].concat(collect('GWh', 1000)).concat(collect('MWh', 1)).concat(collect('万千瓦时', 10)).concat(collect('kWh', 0.001));
    energy.sort((a, b) => a.i - b.i); out.mwh = r(pick(energy));
    const len = collect('公里|km', 1); len.sort((a, b) => a.i - b.i); out.km = len.length ? r(len[0].v) : null;
    let oil = collect('万桶', 1); if (!oil.length) oil = collect('桶', 1 / 10000); oil.sort((a, b) => a.i - b.i); out.kbd = oil.length ? r(oil[0].v) : null;
    const mass = [].concat(collect('万吨', 1)).concat(collect('Mtpa|Mt', 100)); mass.sort((a, b) => a.i - b.i); out.wty = mass.length ? r(mass[0].v) : null;
    return out;
  }

  /* ---------- WGS-84 → GCJ-02 纠偏（高德等国内底图为 GCJ-02） ---------- */
  const PI = Math.PI, AXIS = 6378245.0, EE = 0.00669342162296594323;
  function tLat(x, y) {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
    return r;
  }
  function tLng(x, y) {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
    return r;
  }
  const outOfChina = (lng, lat) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  function wgs2gcj(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
    const radLat = lat / 180 * PI;
    let magic = Math.sin(radLat); magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180) / ((AXIS * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180) / (AXIS / sqrtMagic * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
  }

  /* ---------- 业主归一化（企业排行榜聚合键）----------
   * 取首段（以 / 、，（( 分隔），再剥离纯法律主体后缀，
   * 让「中国电建」与「中国电建集团」、「国家电网」与「国家电网有限公司」归到同一家。
   * 兜底：若剥空（业主本就只是"公司"之类）则回退原文。 */
  function normalizeOwner(o) {
    let k = ((o || '').split(/[\/、，（(]/)[0] || '').trim();
    k = k.replace(/[\s,]*(?:Group|Corp(?:oration)?|Co\.?,?\s*Ltd\.?|Ltd\.?|Inc\.?|PLC)\.?$/i, '');
    k = k.replace(/(?:集团|控股|股份|有限|责任|公司)+$/g, '');
    k = k.trim();
    return k || (o || '').trim();
  }

  return { SUB_DEFS, classifySub, parseCapacity, wgs2gcj, outOfChina, normalizeOwner };
});
