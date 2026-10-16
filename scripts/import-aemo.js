#!/usr/bin/env node
/* ============================================================
 * AEMO 发电信息（Generation Information）→ js/au-pipeline.js 导入器（零依赖）
 * ------------------------------------------------------------
 * 用法：
 *   node scripts/import-aemo.js <NEM Generation Information.xlsx|.csv> [--sheet "<工作表名>"] [--wem]
 *                               [--asof 2026-10] [--include-existing] [--dry] [--out js/au-pipeline.js]
 *   AEMO 页面：https://aemo.com.au/energy-systems/electricity/national-electricity-market-nem/nem-forecasting-and-planning/forecasting-and-planning-data/generation-information
 *   （季度更新的 Excel；WEM 的 "WEM Generation Information" 用 --wem，region 记为 SWIS）
 *
 * 做什么：
 *   · 自己解析 .xlsx（ZIP + sharedStrings + sheet XML，不用任何 npm 包）或 .csv；
 *   · 自动找表头行（含 "Site Name"/"Facility" 与 "Capacity"/"Nameplate" 的那一行），按表头正则映射列；
 *   · 只保留 AEMO 状态为 Committed / Committed* / Anticipated / Proposed（含 Publicly Announced /
 *     Application to connect）的行（--include-existing 时也保留 Existing），按「场站名 + 状态」合并多机组行
 *     （MW / MWh 求和，COD 取最早）；
 *   · 燃料归一到 solar / wind / offshore_wind / battery / pumped_hydro / hydro / gas / hydrogen / coal / other；
 *   · 坐标记忆：读取现有 js/au-pipeline.js，按英文名匹配把 coord / locality / 中文名 / connNode / rez / notes /
 *     sources / projId 带过来（AEMO 表里没有坐标）；新项目若 connNode 命中 js/au-grid.js 的枢纽站则放到该站
 *     并标 approx:true，否则放州质心 + approx:true，并在末尾列出「需补坐标」清单；
 *   · 打印上一版 → 本版的差异（新增 / 移除 / 状态变化 / 容量变化），这就是每季度的 BD 变化清单。
 * 校验：node scripts/test-import-aemo.js（用内存生成的迷你 xlsx 跑一遍解析 + 转换）。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- 最小 ZIP 读取 ---------- */
function unzip(buf) {
  // 从尾部找 EOCD
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('不是 ZIP/xlsx 文件（找不到 EOCD）');
  const n = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16);
  const files = {};
  let p = cdOff;
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP 中央目录损坏');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const fn = buf.readUInt16LE(p + 28), ex = buf.readUInt16LE(p + 30), cm = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + fn);
    const lfn = buf.readUInt16LE(lho + 26), lex = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lfn + lex;
    const data = buf.subarray(start, start + csize);
    files[name] = { method, data, usize };
    p += 46 + fn + ex + cm;
  }
  return {
    read(name) {
      const f = files[name]; if (!f) return null;
      if (f.method === 0) return f.data.toString('utf8');
      if (f.method === 8) return zlib.inflateRawSync(f.data).toString('utf8');
      throw new Error('不支持的压缩方式 ' + f.method + '：' + name);
    },
    names: Object.keys(files),
  };
}

/* ---------- XML 小工具 ---------- */
const decode = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag); return m ? decode(m[1]) : null; };
const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

/* ---------- xlsx → 二维表 ---------- */
function parseWorkbook(buf) {
  const z = unzip(buf);
  const wb = z.read('xl/workbook.xml') || '';
  const rels = z.read('xl/_rels/workbook.xml.rels') || '';
  const relMap = {};
  (rels.match(/<Relationship\b[^>]*>/g) || []).forEach(t => { const id = attr(t, 'Id'), target = attr(t, 'Target'); if (id && target) relMap[id] = target.replace(/^\/?xl\//, '').replace(/^\//, ''); });
  const sheets = (wb.match(/<sheet\b[^>]*>/g) || []).map(t => ({ name: attr(t, 'name'), rid: attr(t, 'r:id') || attr(t, 'id') })).map(s => ({ name: s.name, path: 'xl/' + (relMap[s.rid] || ('worksheets/sheet' + (s.rid || '').replace(/\D/g, '') + '.xml')) }));
  const ssXml = z.read('xl/sharedStrings.xml') || '';
  const shared = (ssXml.match(/<si>[\s\S]*?<\/si>/g) || []).map(si => decode((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<t[^>]*>|<\/t>/g, '')).join('')));
  function readSheet(sheetPath) {
    const xml = z.read(sheetPath); if (xml == null) return [];
    const rows = [];
    (xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || []).forEach(rowXml => {
      const r = [];
      (rowXml.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).forEach(c => {
        const open = c.match(/^<c\b[^>]*>/)[0];
        const ref = attr(open, 'r') || ''; const t = attr(open, 't');
        let v = null;
        const vm = c.match(/<v>([\s\S]*?)<\/v>/);
        if (t === 's') v = vm ? shared[+vm[1]] : null;
        else if (t === 'inlineStr') { const im = c.match(/<t[^>]*>([\s\S]*?)<\/t>/); v = im ? decode(im[1]) : null; }
        else if (t === 'b') v = vm ? vm[1] === '1' : null;
        else if (t === 'str' || t === 'e') v = vm ? decode(vm[1]) : null;
        else v = vm ? (isNaN(+vm[1]) ? decode(vm[1]) : +vm[1]) : null;
        if (ref) r[colIndex(ref)] = v;
      });
      rows.push(r);
    });
    return rows;
  }
  return { sheets, readSheet };
}

/* ---------- CSV ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(v => (v !== '' && !isNaN(+v)) ? +v : v));
}

/* ---------- 表头识别 + 列映射 ---------- */
const COLS = {
  region: /^region$|nem region|^state$/i,
  siteName: /site name|facility name|project name|^facility$|^site$/i,
  owner: /^owner|participant|proponent/i,
  tech: /technology type|^technology$/i,
  fuel: /fuel type|fuel bucket|^fuel$/i,
  mw: /(upper )?nameplate.*mw|capacity.*\(mw\)|^capacity \(mw\)|nameplate capacity|^mw$|sent.?out.*mw/i,
  mwh: /storage.*mwh|energy.*mwh|\(mwh\)/i,
  status: /unit status|^status$|project status|development status/i,
  cod: /full commercial use|commercial use date|expected.*(date|year)|target.*date|cod/i,
  closure: /expected closure/i,
  assetType: /asset type/i,
  duid: /^duid$/i,
};
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cells = (rows[i] || []).map(c => String(c == null ? '' : c));
    if (cells.some(c => COLS.siteName.test(c)) && cells.some(c => COLS.mw.test(c))) return i;
  }
  return -1;
}
function mapColumns(header) {
  const idx = {};
  Object.keys(COLS).forEach(k => { const i = header.findIndex(h => COLS[k].test(String(h == null ? '' : h).trim())); if (i >= 0) idx[k] = i; });
  return idx;
}

/* ---------- 归一化 ---------- */
const STATUS_MAP = [[/^committed/i, 'committed'], [/anticipated/i, 'anticipated'], [/proposed|publicly announced|application|enquiry|maturing|emerging/i, 'proposed'], [/existing|in service|operating|commissioning|commissioned/i, 'existing'], [/withdrawn|cancelled|retired|decommissioned/i, 'withdrawn']];
const normStatus = s => { const t = String(s || '').trim(); for (const [re, v] of STATUS_MAP) if (re.test(t)) return v; return null; };
const FUEL_MAP = [[/offshore/i, 'offshore_wind'], [/wind/i, 'wind'], [/solar|photovoltaic|pv/i, 'solar'], [/battery|bess|storage.*battery|lithium/i, 'battery'], [/pumped/i, 'pumped_hydro'], [/hydro|water/i, 'hydro'], [/hydrogen|h2/i, 'hydrogen'], [/gas|ocgt|ccgt|diesel|distillate|liquid/i, 'gas'], [/coal|brown|black/i, 'coal']];
const normFuel = (fuel, tech) => { const t = (String(fuel || '') + ' ' + String(tech || '')).trim(); for (const [re, v] of FUEL_MAP) if (re.test(t)) return v; return 'other'; };
const REGION_STATE = { NSW1: 'NSW', QLD1: 'QLD', VIC1: 'VIC', SA1: 'SA', TAS1: 'TAS', SWIS: 'WA', NWIS: 'WA', NT: 'NT' };
const STATE_CENTROID = { NSW: [147.0, -32.5], VIC: [144.3, -36.9], QLD: [145.0, -23.0], SA: [136.0, -31.5], WA: [121.0, -27.5], TAS: [146.6, -42.0], NT: [133.5, -19.5] };
function normCod(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { if (v > 20000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); } if (v > 1990 && v < 2100) return String(Math.round(v)); return null; }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})/); if (m) return m[1] + '-' + m[2];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + m[2].padStart(2, '0');
  const MON = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  m = s.match(/^(\d{1,2})?\s*([a-z]{3})[a-z]*[\s-]+(\d{4})/i); if (m && MON[m[2].toLowerCase()]) return m[3] + '-' + MON[m[2].toLowerCase()];
  m = s.match(/^q([1-4])\s*(\d{4})/i); if (m) return m[2] + '-' + ['03', '06', '09', '12'][+m[1] - 1];
  m = s.match(/(\d{4})/); if (m) return m[1];
  return null;
}
const normKey = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(the|project|stage|phase|unit|units|bess|battery energy storage system|battery|wind farm|solar farm|power station|energy storage|farm|hybrid|ltd|pty)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/* ---------- 行 → 管线记录 ---------- */
function convertRows(rows, opts) {
  const h = findHeader(rows); if (h < 0) throw new Error('找不到表头行（需含 Site Name/Facility 与 Capacity/Nameplate 列）。表头示例：' + JSON.stringify((rows[0] || []).slice(0, 8)));
  const idx = mapColumns(rows[h]);
  const missing = ['siteName', 'mw', 'status'].filter(k => idx[k] == null);
  if (missing.length) throw new Error('缺少必要列：' + missing.join(', ') + '；识别到的列：' + JSON.stringify(idx) + '；表头：' + JSON.stringify(rows[h]));
  const get = (r, k) => idx[k] == null ? null : r[idx[k]];
  const groups = {};
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || []; const site = String(get(r, 'siteName') || '').trim(); if (!site) continue;
    const st = normStatus(get(r, 'status'));
    if (!st || st === 'withdrawn') continue;
    if (st === 'existing' && !opts.includeExisting) continue;
    const regionRaw = String(get(r, 'region') || (opts.wem ? 'SWIS' : '')).trim().toUpperCase();
    const region = opts.wem ? 'SWIS' : (regionRaw.match(/^(NSW1|QLD1|VIC1|SA1|TAS1)/) || [regionRaw])[0];
    const state = REGION_STATE[region] || REGION_STATE[regionRaw.slice(0, 3)] || (opts.wem ? 'WA' : null);
    const key = site + '|' + st;
    const g = groups[key] || (groups[key] = { en: site, owner: String(get(r, 'owner') || '').trim(), state, region, fuel: normFuel(get(r, 'fuel'), get(r, 'tech')), tech: String(get(r, 'tech') || '').trim(), mw: 0, mwh: 0, cod: null, status: st, duids: [] });
    const mw = +get(r, 'mw') || 0, mwh = +get(r, 'mwh') || 0; g.mw += mw; g.mwh += mwh;
    const cod = normCod(get(r, 'cod')); if (cod && (!g.cod || cod < g.cod)) g.cod = cod;
    const duid = get(r, 'duid'); if (duid) g.duids.push(String(duid));
    if (!g.owner) g.owner = String(get(r, 'owner') || '').trim();
  }
  return Object.values(groups).map(g => { g.mw = Math.round(g.mw * 10) / 10; g.mwh = Math.round(g.mwh * 10) / 10; if (!g.mwh) delete g.mwh; if (!g.duids.length) delete g.duids; return g; }).filter(g => g.mw > 0);
}

/* ---------- 坐标记忆 + 节点回退 ---------- */
function loadPrev(file) {
  try { const w = {}; const src = fs.readFileSync(file, 'utf8'); new Function('window', src)(w); return (w.AU_PIPELINE && w.AU_PIPELINE.items) || []; } catch (e) { return []; }
}
function loadNodes(file) {
  try { const w = {}; const src = fs.readFileSync(file, 'utf8'); new Function('window', src)(w); return (w.AU_GRID && w.AU_GRID.nodes) || []; } catch (e) { return []; }
}
function enrich(items, prev, nodes) {
  const byKey = {}; prev.forEach(p => { byKey[normKey(p.en)] = p; });
  const needCoord = [];
  const used = new Set();
  items.forEach((it, i) => {
    const k = normKey(it.en);
    let p = byKey[k];
    if (!p) { const cands = Object.keys(byKey).filter(x => x && (x.startsWith(k) || k.startsWith(x))); if (cands.length === 1) p = byKey[cands[0]]; }
    if (p) {
      used.add(p.id);
      it.id = p.id; it.name = p.name || it.en; it.coord = p.coord; if (p.approx) it.approx = true;
      ['locality', 'connNode', 'rez', 'notes', 'sources', 'projId'].forEach(f => { if (p[f] != null && it[f] == null) it[f] = p[f]; });
      if (!it.owner && p.owner) it.owner = p.owner;
    } else {
      it.name = it.en;
      const node = it.connNode ? nodes.find(n => n.en && it.connNode.toLowerCase().indexOf(n.en.toLowerCase()) >= 0) : null;
      it.coord = node ? node.coord.slice() : (STATE_CENTROID[it.state] || [134, -27]).slice();
      it.approx = true; needCoord.push(it);
    }
  });
  // 新 id：按州顺序编号，避开已有 id
  const taken = new Set(items.filter(x => x.id).map(x => x.id).concat(prev.map(p => p.id)));
  const counters = {};
  items.forEach(it => { if (it.id) return; const pre = 'pl-' + (it.state || 'xx').toLowerCase() + '-'; let n = counters[pre] || 1; let id; do { id = pre + String(n).padStart(3, '0'); n++; } while (taken.has(id)); counters[pre] = n; it.id = id; taken.add(id); });
  const removed = prev.filter(p => !used.has(p.id));
  return { needCoord, removed };
}

/* ---------- 差异 ---------- */
function diff(prev, items) {
  const pm = {}; prev.forEach(p => { pm[p.id] = p; });
  const out = { added: [], status: [], mw: [] };
  items.forEach(it => { const p = pm[it.id]; if (!p) { out.added.push(it); return; } if (p.status !== it.status) out.status.push([p, it]); else if (Math.abs((p.mw || 0) - (it.mw || 0)) >= 5) out.mw.push([p, it]); });
  return out;
}

/* ---------- 输出 ---------- */
function writeOut(file, items, asOf, source) {
  const ORDER = { committed: 0, anticipated: 1, proposed: 2, existing: 3 };
  items.sort((a, b) => (a.state || '').localeCompare(b.state || '') || (ORDER[a.status] - ORDER[b.status]) || (b.mw - a.mw));
  const KEYS = ['id', 'en', 'name', 'owner', 'state', 'region', 'fuel', 'tech', 'mw', 'mwh', 'cod', 'status', 'coord', 'approx', 'locality', 'connNode', 'rez', 'notes', 'sources', 'projId', 'duids'];
  const ordered = items.map(it => { const o = {}; KEYS.forEach(k => { if (it[k] != null && it[k] !== '') o[k] = it[k]; }); return o; });
  const out = `// 澳洲发电 / 储能管线（window.AU_PIPELINE）—— au.html 🧭 管线图层。按 AEMO Generation Information 口径：
//   status: committed（承诺，全部 5 项标准达成 / 在建）· anticipated（预期，≥3 项标准）· proposed（拟建，公开宣布 / 接入申请）
//   fuel: solar / wind / offshore_wind / battery / pumped_hydro / hydro / gas / hydrogen / coal / other；mw 为交流铭牌，mwh 为储能能量
//   cod: 预期全面商业运行 'YYYY' 或 'YYYY-MM'；coord [lng,lat]（approx:true = 放在接入站 / 州质心的示意位置，待补精确坐标）
//   connNode: 接入变电站；rez: 所在 REZ；projId: 主项目库里同一项目的 id（有则详情卡可互跳）
// 由 scripts/import-aemo.js 从 AEMO Excel 生成（坐标 / 中文名 / 备注从上一版记忆），也可手工维护；非项目数据（不受 validate-data.js 约束），
// 由 scripts/test-au.js 校验字段与坐标范围。
window.AU_PIPELINE = {
  asOf: ${JSON.stringify(asOf)},
  source: ${JSON.stringify(source)},
  items: [
${ordered.map(o => '    ' + JSON.stringify(o) + ',').join('\n')}
  ],
};
`;
  fs.writeFileSync(file, out);
}

/* ---------- CLI ---------- */
function main() {
  const argv = process.argv.slice(2);
  const opt = { wem: false, includeExisting: false, dry: false, out: path.join(__dirname, '..', 'js', 'au-pipeline.js'), asof: null, sheet: null };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--wem') opt.wem = true; else if (a === '--include-existing') opt.includeExisting = true; else if (a === '--dry') opt.dry = true;
    else if (a === '--out') opt.out = argv[++i]; else if (a === '--asof') opt.asof = argv[++i]; else if (a === '--sheet') opt.sheet = argv[++i];
    else files.push(a);
  }
  if (!files.length) { console.error('用法：node scripts/import-aemo.js <AEMO Generation Information.xlsx|.csv> [--sheet 名] [--wem] [--asof YYYY-MM] [--include-existing] [--dry] [--out 路径]'); process.exit(1); }
  const src = files[0];
  if (!fs.existsSync(src)) { console.error('文件不存在：' + src); process.exit(1); }
  let rows;
  if (/\.csv$/i.test(src)) rows = parseCSV(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
  else {
    const wb = parseWorkbook(fs.readFileSync(src));
    let sheet = opt.sheet ? wb.sheets.find(s => s.name === opt.sheet) : null;
    if (!sheet) {
      for (const s of wb.sheets) { const r = wb.readSheet(s.path); if (findHeader(r) >= 0) { sheet = s; rows = r; break; } }
      if (!sheet) { console.error('没有找到含管线表头的工作表。工作表：' + wb.sheets.map(s => s.name).join(' | ')); process.exit(1); }
      console.log('使用工作表：' + sheet.name);
    } else rows = wb.readSheet(sheet.path);
  }
  const items = convertRows(rows, opt);
  const prev = loadPrev(opt.out);
  const nodes = loadNodes(path.join(__dirname, '..', 'js', 'au-grid.js'));
  const { needCoord, removed } = enrich(items, prev, nodes);
  const d = diff(prev, items);
  const asOf = opt.asof || new Date().toISOString().slice(0, 7);
  console.log(`解析 ${rows.length} 行 → ${items.length} 条管线记录（committed ${items.filter(x => x.status === 'committed').length} · anticipated ${items.filter(x => x.status === 'anticipated').length} · proposed ${items.filter(x => x.status === 'proposed').length}）`);
  console.log(`与上一版（${prev.length} 条）比较：新增 ${d.added.length} · 状态变化 ${d.status.length} · 容量变化 ${d.mw.length} · 不再出现 ${removed.length}`);
  d.status.forEach(([p, it]) => console.log(`  ↗ ${it.en}: ${p.status} → ${it.status}${it.cod ? '（COD ' + it.cod + '）' : ''}`));
  d.added.slice(0, 40).forEach(it => console.log(`  + ${it.en} · ${it.state} · ${it.fuel} · ${it.mw} MW · ${it.status}`));
  removed.slice(0, 40).forEach(p => console.log(`  − ${p.en}（${p.status}）— 本版未出现（投运 / 撤回 / 改名？）`));
  if (needCoord.length) console.log(`需补坐标（暂放接入站或州质心，approx:true）：\n  ` + needCoord.map(it => it.id + ' ' + it.en + (it.connNode ? ' @' + it.connNode : '')).join('\n  '));
  if (opt.dry) { console.log('--dry：不写文件'); return; }
  writeOut(opt.out, items, asOf, (opt.wem ? 'AEMO WEM Generation Information' : 'AEMO NEM Generation Information') + ' · ' + path.basename(src));
  console.log('写出 ' + opt.out);
}

module.exports = { unzip, parseWorkbook, parseCSV, findHeader, mapColumns, convertRows, normStatus, normFuel, normCod, normKey, enrich, diff, writeOut };
if (require.main === module) main();
