#!/usr/bin/env node
/* ============================================================
 * AEMO 发电信息（Generation Information）→ js/au-pipeline.js 导入器（零依赖）
 * ------------------------------------------------------------
 * 用法：
 *   node scripts/import-aemo.js <NEM Generation Information.xlsx|.csv> [--kci <KCI 汇编.xlsx>] [--sheet "<工作表名>"]
 *                               [--wem] [--asof 2026-04] [--include-existing] [--dry] [--out js/au-pipeline.js]
 *                               [--gazetteer scripts/data/au-localities.csv | --no-gazetteer] [--no-main] [--prev <上一版 au-pipeline.js>]
 *   AEMO 页面：https://aemo.com.au/energy-systems/electricity/national-electricity-market-nem/nem-forecasting-and-planning/forecasting-and-planning-data/generation-information
 *   （季度更新的 Excel；WEM 的 "WEM Generation Information" 用 --wem，region 记为 SWIS；
 *     --kci 读 AEMO 的 Key Connection Information 汇编表，按 "AEMO KCI ID" / 场站名带入 "Site Location Description" 与 TNSP）
 *
 * 做什么：
 *   · 自己解析 .xlsx（ZIP + sharedStrings + sheet XML，不用任何 npm 包）或 .csv；
 *   · 自动找表头行（含 "Site Name"/"Facility" 与 "Capacity"/"Nameplate" 的那一行），按表头正则（按优先级，先 "(MW AC)" 交流铭牌
 *     再退到任何 Nameplate/Capacity (MW) 列）映射列——兼容 2026 版 "Generator Information" 表头
 *     （Site Name / Site Owner / Region / Technology Type / Technology Detail / Agg Nameplate Capacity (MW AC) /
 *       Agg Nameplate Storage Capacity (MWh) / Commitment Status / Full Commercial Use Date / AEMO KCI ID / Max Site Capacity (AC)）
 *     和旧版 Unit Status / Nameplate Capacity (MW) 表头；
 *   · 只保留 AEMO 状态为 Committed / Committed* / Anticipated / Proposed（含 Publicly Announced /
 *     Application to connect）的行（--include-existing 时也保留 In Service / Existing），按「场站名 + 状态」合并多机组行
 *     （MW / MWh 求和，COD 取最早，按燃料记 mix 构成，siteMw 记接入上限 Max Site Capacity）；
 *   · 燃料归一到 solar / wind / offshore_wind / battery / pumped_hydro / hydro / gas / hydrogen / coal / other（主燃料 = MW 最大者）；
 *   · 坐标记忆：读取现有 js/au-pipeline.js，按英文名（+状态）匹配把 coord / locality / 中文名 / connNode / rez / notes /
 *     sources / projId 带过来（AEMO 表里没有坐标）；主项目库（js/data*.js 里的澳洲项目）同名 → 精确坐标 + projId；
 *   · 新项目定位（approx:true，卡片提示示意位置）：KCI 的位置描述 / 场站名里的地名 → scripts/data/au-localities.csv
 *     （1.8 万个澳洲地名质心）→ 邮编质心 → connNode 命中 js/au-grid.js 的枢纽站 → 州质心，并在末尾列出「需补坐标」清单；
 *   · 中文名：上一版 / 主项目库有则沿用，否则按「地名 + 类型（光伏电站 / 风电场 / 储能电站 / 光储项目 …）+ 期数」自动生成；
 *   · 不在本表范围的州（导 NEM 时的 WA / NT，导 WEM 时的东部各州）原样保留上一版条目；
 *   · 打印上一版 → 本版的差异（新增 / 移除 / 状态变化 / 容量变化），这就是每季度的 BD 变化清单。
 * 校验：node scripts/test-import-aemo.js（用内存生成的迷你 xlsx 跑一遍解析 + 转换 + 定位）。
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
// 每个字段一组按优先级排列的正则：先拿第一条扫整行表头，没命中再用下一条（如 mw 先找 "(MW AC)" 交流铭牌，再退到任何 Nameplate/Capacity (MW) 列）
const COLS = {
  region: [/^region$|nem region|region to be supplied|^state$/i],
  siteName: [/^site name$/i, /site name|facility name|project name|^facility$|^site$/i],
  owner: [/site owner|^owner/i, /participant|proponent|organisation name/i],
  tech: [/^technology type$/i, /technology type|^technology$|energy conversion technology/i],
  techDetail: [/technology detail|technology sub.?type/i],
  fuel: [/fuel type|fuel bucket|^fuel$/i],
  mw: [/nameplate.*\(mw ac\)/i, /(upper )?nameplate.*mw|capacity.*\(mw\)|^capacity \(mw\)|nameplate capacity|^mw$|sent.?out.*mw/i],
  mwDc: [/nameplate.*\(mw dc\)/i],
  unitMw: [/^unit capacity \(mw ac\)/i],
  unitCount: [/^unit count/i],
  siteMw: [/max(imum)? site capacity/i],
  mwh: [/storage.*mwh|energy.*mwh|\(mwh\)/i],
  status: [/commitment status|unit status|^status$|project status|development status/i],
  cod: [/full commercial use|commercial use date/i, /expected.*(date|year)|target.*date|^cod$/i],
  closure: [/expected closure/i],
  assetType: [/asset type/i],
  duid: [/^duid/i],
  kci: [/kci id/i],
};
const colTest = (k, s) => COLS[k].some(re => re.test(s));
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cells = (rows[i] || []).map(c => String(c == null ? '' : c).trim());
    if (cells.some(c => colTest('siteName', c)) && cells.some(c => colTest('mw', c))) return i;
  }
  return -1;
}
function mapColumns(header) {
  const idx = {}; const H = header.map(h => String(h == null ? '' : h).trim());
  Object.keys(COLS).forEach(k => { for (const re of COLS[k]) { const i = H.findIndex(h => re.test(h)); if (i >= 0) { idx[k] = i; break; } } });
  return idx;
}

/* ---------- 归一化 ---------- */
const STATUS_MAP = [[/^committed/i, 'committed'], [/anticipated/i, 'anticipated'], [/proposed|publicly announced|application|enquiry|maturing|emerging/i, 'proposed'], [/existing|in service|operating|commissioning|commissioned/i, 'existing'], [/withdraw|cancelled|retired|decommissioned/i, 'withdrawn']];
const normStatus = s => { const t = String(s || '').trim(); for (const [re, v] of STATUS_MAP) if (re.test(t)) return v; return null; };
const FUEL_MAP = [[/offshore/i, 'offshore_wind'], [/wind/i, 'wind'], [/solar|photovoltaic|\bpv\b/i, 'solar'], [/battery|bess|lithium|flow|iron.?air|compressed air|zinc|sodium|vanadium|caes/i, 'battery'], [/pumped/i, 'pumped_hydro'], [/hydro|water/i, 'hydro'], [/hydrogen|\bh2\b/i, 'hydrogen'], [/gas|ocgt|ccgt|diesel|distillate|liquid|fuel oil|biogas|landfill/i, 'gas'], [/coal|brown|black/i, 'coal']];
const normFuel = (fuel, tech, detail) => { const t = [fuel, tech, detail].map(x => String(x || '')).join(' ').trim(); for (const [re, v] of FUEL_MAP) if (re.test(t)) return v; return 'other'; };
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
// AEMO 表里偶见多重转义（"&amp;amp;amp;"）：反复解码到没有实体为止
const unent = s => { let t = String(s == null ? '' : s); for (let i = 0; i < 6 && /&(amp|lt|gt|quot|apos|#x?[0-9a-f]+);/i.test(t); i++) t = decode(t); return t; };
// AEMO 的 Site Owner 常是冗长法人名（"… Pty Ltd as trustee for … Trust (ABN …)"）——去掉受托 / ABN / ACN 尾巴
const cleanOwner = s => unent(s || '').replace(/\s+/g, ' ').replace(/\s*(?:as trustee (?:for|of)|atf|in its capacity as)\b.*$/i, '').replace(/\(?\b(?:abn|acn)\b:?\s*[\d ]+\)?/gi, '').replace(/\s*\(\s*\)/g, '').replace(/[\s,;:]+$/, '').trim();

/* ---------- 行 → 管线记录 ---------- */
function convertRows(rows, opts) {
  opts = opts || {};
  const h = findHeader(rows); if (h < 0) throw new Error('找不到表头行（需含 Site Name/Facility 与 Capacity/Nameplate 列）。表头示例：' + JSON.stringify((rows[0] || []).slice(0, 8)));
  const idx = mapColumns(rows[h]);
  const missing = ['siteName', 'mw', 'status'].filter(k => idx[k] == null);
  if (missing.length) throw new Error('缺少必要列：' + missing.join(', ') + '；识别到的列：' + JSON.stringify(idx) + '；表头：' + JSON.stringify(rows[h].filter(x => x != null)));
  const get = (r, k) => idx[k] == null ? null : r[idx[k]];
  const num = v => { const n = +v; return isFinite(n) ? n : 0; };
  const r1 = x => Math.round(x * 10) / 10;
  const groups = {};
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || []; const site = unent(get(r, 'siteName') || '').replace(/\s+/g, ' ').trim(); if (!site) continue;
    const st = normStatus(get(r, 'status'));
    if (!st || st === 'withdrawn') continue;
    if (st === 'existing' && !opts.includeExisting) continue;
    const regionRaw = String(get(r, 'region') || (opts.wem ? 'SWIS' : '')).trim().toUpperCase();
    const region = opts.wem ? 'SWIS' : (regionRaw.match(/^(NSW1|QLD1|VIC1|SA1|TAS1)/) || [regionRaw])[0];
    const state = REGION_STATE[region] || REGION_STATE[regionRaw.slice(0, 3)] || (opts.wem ? 'WA' : null);
    const key = site + '|' + st;
    const g = groups[key] || (groups[key] = { en: site, owner: cleanOwner(get(r, 'owner')), state, region, mix: {}, techs: [], mw: 0, mwh: 0, cod: null, status: st, duids: [], siteMw: 0, kci: null });
    const fuelRow = normFuel(get(r, 'fuel'), get(r, 'tech'), get(r, 'techDetail'));
    let mw = num(get(r, 'mw'));
    if (!mw) mw = num(get(r, 'unitMw')) * (num(get(r, 'unitCount')) || 1);
    if (!mw) mw = num(get(r, 'mwDc'));
    g.mw += mw; g.mwh += num(get(r, 'mwh')); g.mix[fuelRow] = (g.mix[fuelRow] || 0) + mw;
    const techStr = [get(r, 'tech'), get(r, 'techDetail')].map(x => unent(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ');
    if (techStr && g.techs.indexOf(techStr) < 0) g.techs.push(techStr);
    const cod = normCod(get(r, 'cod')); if (cod && (!g.cod || cod < g.cod)) g.cod = cod;
    const duid = get(r, 'duid'); if (duid) g.duids.push(String(duid));
    const sm = num(get(r, 'siteMw')); if (sm > g.siteMw) g.siteMw = sm;
    const kci = get(r, 'kci'); if (kci && !g.kci) g.kci = String(kci).trim();
    if (!g.owner) g.owner = cleanOwner(get(r, 'owner'));
  }
  return Object.values(groups).map(g => {
    const fuels = Object.keys(g.mix).sort((a, b) => g.mix[b] - g.mix[a]);
    g.fuel = fuels[0] || 'other';
    if (!g.mw && g.siteMw) { g.mw = g.siteMw; g.mix = {}; }
    g.mw = r1(g.mw); g.mwh = r1(g.mwh); if (!g.mwh) delete g.mwh;
    const mix = {}; fuels.forEach(f => { if (g.mix[f]) mix[f] = r1(g.mix[f]); });
    if (Object.keys(mix).length > 1) g.mix = mix; else delete g.mix;
    g.tech = g.techs.join(' + '); delete g.techs; if (!g.tech) delete g.tech;
    if (g.siteMw && Math.abs(g.siteMw - g.mw) >= 1) g.siteMw = r1(g.siteMw); else delete g.siteMw;
    if (!g.kci) delete g.kci; if (!g.duids.length) delete g.duids;
    return g;
  }).filter(g => g.mw >= 5);   // <5 MW 多为占位 / 试验机组（AEMO 表里有 1 MW 的占位行），与项目库 >$7M 门槛一致
}

/* ---------- KCI（Key Connection Information）汇编表：KCI ID → 位置描述 / TNSP ---------- */
const cleanLoc = v => { const s = unent(v).replace(/\s*[\r\n]+\s*/g, ', ').replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim(); return (!s || /^(n\/?a|not provided|not applicable|tbc|tba|tbd|confidential|unknown|nil|none|-+|\.)$/i.test(s)) ? '' : s; };
function parseKci(wb) {
  const out = {};
  for (const s of wb.sheets) {
    const rows = wb.readSheet(s.path);
    const h = rows.findIndex(r => (r || []).some(c => /kci id/i.test(String(c))) && (r || []).some(c => /site name/i.test(String(c))));
    if (h < 0) continue;
    const H = rows[h].map(c => String(c == null ? '' : c).replace(/\s+/g, ' ').trim());
    const iId = H.findIndex(c => /kci id/i.test(c)), iSite = H.findIndex(c => /^site name$/i.test(c)), iLoc = H.findIndex(c => /site location/i.test(c)), iTnsp = H.findIndex(c => /^tnsp name$/i.test(c)), iTs = H.findIndex(c => /compilation date|time ?stamp/i.test(c));
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i] || []; const id = r[iId]; if (!id) continue;
      const o = out[String(id).trim()] || (out[String(id).trim()] = { sites: [], locs: [], tnsp: null, ts: -1 });
      const site = String(r[iSite] || '').replace(/\s+/g, ' ').trim(); if (site && o.sites.indexOf(site) < 0) o.sites.push(site);
      const loc = iLoc >= 0 ? cleanLoc(r[iLoc]) : ''; const ts = iTs >= 0 ? (+r[iTs] || 0) : 0;
      if (loc && o.locs.indexOf(loc) < 0) { if (ts >= o.ts) { o.locs.unshift(loc); o.ts = ts; } else o.locs.push(loc); }
      if (iTnsp >= 0 && r[iTnsp]) o.tnsp = String(r[iTnsp]).trim();
    }
  }
  return out;
}
const loadKci = file => parseKci(parseWorkbook(fs.readFileSync(file)));

/* ---------- 地名库（scripts/data/au-localities.csv：locality,state,postcode,lng,lat）---------- */
function parseGazetteer(text) {
  const g = { byState: {}, byPostcode: {}, all: {} };
  String(text).split(/\r?\n/).forEach(line => {
    if (!line || line[0] === '#' || /^locality,/i.test(line)) return;
    const [loc, st, pc, lng, lat] = line.split(','); if (!loc || !isFinite(+lng) || !isFinite(+lat)) return;
    const key = loc.toUpperCase().trim(), c = [+lng, +lat];
    const S = g.byState[st] || (g.byState[st] = {}); if (!S[key]) S[key] = c; if (!g.all[key]) g.all[key] = c;
    (g.byPostcode[pc] || (g.byPostcode[pc] = [])).push(c);
  });
  return g;
}
const loadGazetteer = file => parseGazetteer(fs.readFileSync(file, 'utf8'));
const GEO_STOP = new Set(('NORTH SOUTH EAST WEST NORTHERN SOUTHERN EASTERN WESTERN CENTRAL UPPER LOWER NEW OLD GREAT LITTLE BIG MOUNT MT PORT LAKE RIVER CREEK HILL HILLS PARK PLAINS VALLEY ROAD RD HIGHWAY HWY STREET ST LANE DRIVE TRACK WAY COUNCIL SHIRE CITY TOWN TOWNSHIP LGA REGION REGIONAL SUBSTATION TERMINAL STATION SWITCHYARD ZONE OFFSHORE ONSHORE APPROX APPROXIMATELY NEAR NEARBY ADJACENT LOT LOTS KM KMS THE AND OF AT IN ON TO FROM BETWEEN VIA AREA SITE LAND PROPERTY FARM MINE POWER WIND SOLAR BESS BATTERY ENERGY HUB PROJECT NSW VIC QLD SA WA TAS NT ACT AUSTRALIA VICTORIA QUEENSLAND TASMANIA WALES WHOLE PART PARTS CORNER AWAY SIDE BANK BANKS EDGE POINT HEAD HEADS BAY BEACH COAST ISLAND GREEN FOREST STATE LINE SQUARE GAP RANGE RANGES').split(' '));
const titleCase = s => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
function geocode(text, state, gaz, nodes) {
  if (!text || !gaz) return null;
  const up = String(text).toUpperCase().replace(/[’`]/g, "'");
  const S = state ? (gaz.byState[state] || {}) : null;   // 指定了州就只在该州找（没有该州的地名库时不回退到全国，避免跨州误配）
  const lookup = ph => S ? (S[ph] || null) : (gaz.all[ph] || null);
  const pieces = up.replace(/\(.*?\)/g, ' ').split(/[,;:\/|\n]|\s[-–]\s|\bNEAR(?:BY)?\b|\bOF\b|\bAT\b|\bIN\b|\bTO\b|\bFROM\b|\bBETWEEN\b|\bALONG\b|\bOFF\b|\bVIA\b|\bAND\b|\bADJACENT\b|\bWITHIN\b|\bLOCATED\b|\bAPPROX(?:IMATELY)?\b|\bABOUT\b|\bON\b|\.\s/)
    .map(p => p.replace(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b\s*\d{0,4}/g, ' ').replace(/\b\d{4}\b/g, ' ').replace(/\b\d+(\.\d+)?\s*(KM|KMS|KILOMETRES|KILOMETERS|M|METRES|METERS|MI|MILES)\b/g, ' ').replace(/[^A-Z' ]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const hits = [];
  pieces.forEach((p, pi) => {
    const w = p.split(' ').filter(Boolean);
    for (let n = Math.min(4, w.length); n >= 1; n--) for (let i = 0; i + n <= w.length; i++) {
      const ph = w.slice(i, i + n).join(' ');
      if (n === 1 && (GEO_STOP.has(ph) || ph.length < 4)) continue;
      const c = lookup(ph); if (c) hits.push({ ph, c, n, pi, i });
    }
  });
  if (hits.length) { hits.sort((a, b) => b.n - a.n || a.pi - b.pi || a.i - b.i); return { coord: hits[0].c.slice(), label: titleCase(hits[0].ph), how: 'locality' }; }
  const pcs = up.match(/\b(0[289]\d{2}|[2-7]\d{3})\b/g) || [];
  for (const pc of pcs) { const P = gaz.byPostcode[pc]; if (P && P.length) { const c = [0, 0]; P.forEach(x => { c[0] += x[0]; c[1] += x[1]; }); return { coord: [Math.round(c[0] / P.length * 1e4) / 1e4, Math.round(c[1] / P.length * 1e4) / 1e4], label: 'postcode ' + pc, how: 'postcode' }; } }
  if (nodes) for (const nd of nodes) { if (nd.en && nd.en.length >= 4 && nd.coord && up.indexOf(nd.en.toUpperCase()) >= 0) return { coord: nd.coord.slice(), label: nd.en, how: 'node' }; }
  return null;
}
// 场站名 → 去掉技术 / 类型词，留下地名部分（用于按名定位与生成中文名）
const TYPE_WORDS = /\b(bess|battery energy storage( system)?|battery( storage)?( system)?|energy storage( system)?|storage|ess|solar farm|solar park|solar power station|solar pv|solar|pv|photovoltaic|wind farm|windfarm|wind energy|wind|offshore|onshore|pumped hydro( energy storage)?|pumped storage( hydro)?|hydro(electric)?( power)?( scheme| station| option)?|power station|power plant|peaking (power )?plant|peaker|gas turbine|gt|ocgt|ccgt|generator|generation|renewable energy (hub|park|zone|precinct|project|reserve)|renewables|renewable|energy (hub|park|precinct|reserve|project|system|centre|center)|electrical energy reserve|green power hub|hybrid|hub|park|expansion|extension|upgrade|augmentation|repower(ing)?|project|proposal|development|facility|option|new|kci|the|and|&|\+|plus|with|pty|ltd|p\/l)\b/gi;
const stripTypeWords = en => String(en || '').replace(/\s*[-–]\s*KCI\b.*$/i, '').replace(/\(.*?\)/g, ' ').replace(/\b(?:stage|phase|unit)\s*[\w]+/gi, ' ').replace(TYPE_WORDS, ' ').replace(/[^A-Za-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const TYPE_ZH = { solar: '光伏电站', wind: '风电场', offshore_wind: '海上风电', battery: '储能电站', pumped_hydro: '抽水蓄能电站', hydro: '水电站', gas: '燃气电站', hydrogen: '氢能项目', coal: '燃煤电站', other: '能源项目' };
const STAGE_ZH = { 1: '一期', 2: '二期', 3: '三期', 4: '四期', 5: '五期', 6: '六期', i: '一期', ii: '二期', iii: '三期', iv: '四期', one: '一期', two: '二期', three: '三期', a: 'A期', b: 'B期', c: 'C期' };
function zhName(en, fuel, mix) {
  const stage = (String(en || '').match(/\b(?:stage|phase)\s*(\d+|[ivx]+|one|two|three|[abc])\b/i) || [])[1];
  const stageZh = stage ? (STAGE_ZH[stage.toLowerCase()] || (stage + '期')) : '';
  const fuels = mix ? Object.keys(mix) : [fuel];
  const has = f => fuels.indexOf(f) >= 0;
  let type = TYPE_ZH[fuel] || '能源项目';
  if (fuels.length > 1) type = (has('wind') && has('solar') && has('battery')) ? '风光储项目' : (has('solar') && has('battery')) ? '光储项目' : (has('wind') && has('battery')) ? '风储项目' : (has('wind') && has('solar')) ? '风光项目' : (has('gas') && has('battery')) ? '气电+储能项目' : (has('offshore_wind')) ? '海上风电' : '综合能源项目';
  const place = stripTypeWords(en);
  return (place ? place + ' ' : '') + type + stageZh;
}

/* ---------- 主项目库（js/data*.js 里的澳洲项目：精确坐标 + projId + 中文名）---------- */
function loadMainProjects(dir) {
  try {
    const files = fs.readdirSync(dir).filter(f => /^data.*\.js$/.test(f)).sort((a, b) => (a === 'data.js' ? -2 : a === 'data-extra.js' ? -1 : 0) - (b === 'data.js' ? -2 : b === 'data-extra.js' ? -1 : 0) || a.localeCompare(b));
    const w = {}; files.forEach(f => { new Function('window', fs.readFileSync(path.join(dir, f), 'utf8'))(w); });
    const all = ((w.ENERGY && w.ENERGY.PROJECTS) || []).concat(w.ENERGY_EXTRA || []);
    const seen = new Set();
    return all.filter(p => p && p.country === '澳大利亚' && Array.isArray(p.coord) && p.en && !seen.has(p.name) && seen.add(p.name)).map(p => ({ id: p.id, en: p.en, name: p.name, coord: p.coord }));
  } catch (e) { return []; }
}

/* ---------- 坐标记忆 + 定位 + 节点回退 ---------- */
function loadPrev(file) {
  try { const w = {}; const src = fs.readFileSync(file, 'utf8'); new Function('window', src)(w); return (w.AU_PIPELINE && w.AU_PIPELINE.items) || []; } catch (e) { return []; }
}
function loadNodes(file) {
  try { const w = {}; const src = fs.readFileSync(file, 'utf8'); new Function('window', src)(w); return (w.AU_GRID && w.AU_GRID.nodes) || []; } catch (e) { return []; }
}
// 海上风电按地名 / KCI 定位时落在岸上城镇：按州把示意点推到海里（东岸向东、维州向南、塔州向北），仍是 approx
const OFFSHORE_SHIFT = { NSW: [0.45, 0], QLD: [0.45, 0], VIC: [0, -0.35], TAS: [0, 0.35], SA: [0, -0.35], WA: [-0.35, 0] };
// 完全定位不到的海上风电：按名字里的海域关键词 / 所属州放到已划定 / 拟议的海上风电区示意位置，而不是内陆州质心
const OFFSHORE_ZONE = [[/illawarra|wollongong|kiama|south pacific/i, [151.2, -34.6]], [/hunter|newcastle|novocastrian|eastern rise|central coast/i, [152.3, -33.0]], [/gippsland|seaspray|star of the south|ninety mile|deal|bass/i, [147.6, -38.75]], [/southern ocean|portland|warrnambool|spinifex/i, [141.6, -38.85]], [/bunbury|geographe|perth/i, [115.2, -33.3]]];
const OFFSHORE_STATE = { NSW: [151.6, -33.5], VIC: [147.3, -38.9], TAS: [147.2, -40.3], SA: [137.0, -35.6], WA: [115.2, -33.3], QLD: [151.9, -24.2] };
function offshoreFallback(it) { if (it.fuel !== 'offshore_wind') return null; for (const [re, c] of OFFSHORE_ZONE) if (re.test(it.en)) return c.slice(); return (OFFSHORE_STATE[it.state] || null) && OFFSHORE_STATE[it.state].slice(); }
function offshoreShift(coord, it) { const d = it.fuel === 'offshore_wind' && OFFSHORE_SHIFT[it.state]; return d ? [Math.round((coord[0] + d[0]) * 1e4) / 1e4, Math.round((coord[1] + d[1]) * 1e4) / 1e4] : coord; }
function enrich(items, prev, nodes, opts) {
  opts = opts || {}; nodes = nodes || [];
  const gaz = opts.gaz || null, kci = opts.kci || {}, main = opts.main || [];
  const byKS = {}, byKey = {};
  prev.forEach(p => { const k = normKey(p.aemo || p.en); byKS[k + '|' + p.status] = p; if (!byKey[k]) byKey[k] = p; });
  const kciBySite = {}; Object.keys(kci).forEach(id => kci[id].sites.forEach(s => { const k = normKey(s); if (k && !kciBySite[k]) kciBySite[k] = kci[id]; }));
  const mainBy = {}; main.forEach(p => { const k = normKey(p.en); if (k && !mainBy[k]) mainBy[k] = p; });
  const uniquePrefix = (k, map) => { if (!k || k.length < 6) return null; const c = Object.keys(map).filter(x => x && x.length >= 6 && (x.startsWith(k) || k.startsWith(x))); return c.length === 1 ? map[c[0]] : null; };
  const used = new Set(), needCoord = [];
  const geo = { memory: 0, main: 0, kci: 0, name: 0, node: 0, centroid: 0 };
  items.forEach(it => {
    const k = normKey(it.en);
    let p = byKS[k + '|' + it.status]; if (p && used.has(p.id)) p = null;
    if (!p) { p = byKey[k]; if (p && used.has(p.id)) p = null; }
    if (!p) { p = uniquePrefix(k, byKey); if (p && used.has(p.id)) p = null; }
    if (p) {
      used.add(p.id);
      it.id = p.id; it.name = p.name || it.en;
      if (p.coord) { it.coord = p.coord.slice(); if (p.approx) it.approx = true; }
      ['locality', 'connNode', 'rez', 'notes', 'sources', 'projId', 'tnsp', 'kci'].forEach(f => { if (p[f] != null && it[f] == null) it[f] = p[f]; });
      if (!it.owner && p.owner) it.owner = p.owner;
      geo.memory++;
    }
    const kc = (it.kci && kci[it.kci]) || kciBySite[k] || null;
    if (kc) { if (!it.locality && kc.locs.length) it.locality = kc.locs[0]; if (!it.tnsp && kc.tnsp) it.tnsp = kc.tnsp; }
    const mp = mainBy[k] || uniquePrefix(k, mainBy);
    if (mp) { if (!it.projId) it.projId = mp.id; if ((!it.coord || it.approx) && mp.coord) { it.coord = mp.coord.slice(); delete it.approx; geo.main++; } if (!p && !it.name && mp.name) it.name = mp.name; }
    if (!it.coord || it.approx) {
      let g = null, how = null;
      if (gaz && kc) {
        for (const loc of kc.locs) { const r = geocode(loc, it.state, gaz, nodes); if (!r) continue; const inName = k.indexOf(r.label.toLowerCase()) >= 0; if (!g || inName) { g = r; how = 'kci'; } if (inName) break; }
      }
      if (!g && gaz) { const r = geocode(stripTypeWords(it.en), it.state, gaz, null); if (r && r.how === 'locality') { g = r; how = 'name'; } }
      if (g) { it.coord = offshoreShift(g.coord, it); it.approx = true; if (!it.locality) it.locality = g.label; geo[how]++; }
      else if (!it.coord) {
        const node = it.connNode ? nodes.find(n => n.en && n.coord && it.connNode.toLowerCase().indexOf(n.en.toLowerCase()) >= 0) : null;
        const off = offshoreFallback(it);
        it.coord = node ? node.coord.slice() : off || (STATE_CENTROID[it.state] || [134, -27]).slice();
        it.approx = true; geo[node ? 'node' : 'centroid']++; needCoord.push(it);
      }
    }
    if (!it.name) it.name = zhName(it.en, it.fuel, it.mix);
  });
  // 不在本表范围的州（导 NEM 时 WA / NT；导 WEM 时东部各州）：原样保留上一版
  const fileStates = new Set(items.map(x => x.state).filter(Boolean));
  const kept = prev.filter(p => !used.has(p.id) && p.state && !fileStates.has(p.state));
  kept.forEach(p => { used.add(p.id); items.push(p); });
  // 新 id：按州顺序编号，避开已有 id
  const taken = new Set(items.filter(x => x.id).map(x => x.id).concat(prev.map(p => p.id)));
  const counters = {};
  items.forEach(it => { if (it.id) return; const pre = 'pl-' + (it.state || 'xx').toLowerCase() + '-'; let n = counters[pre] || 1; let id; do { id = pre + String(n).padStart(3, '0'); n++; } while (taken.has(id)); counters[pre] = n; it.id = id; taken.add(id); });
  const removed = prev.filter(p => !used.has(p.id));
  return { needCoord, removed, kept, geo };
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
  const KEYS = ['id', 'en', 'name', 'owner', 'state', 'region', 'fuel', 'mix', 'tech', 'mw', 'siteMw', 'mwh', 'cod', 'status', 'coord', 'approx', 'locality', 'connNode', 'tnsp', 'rez', 'kci', 'notes', 'sources', 'projId', 'duids'];
  const ordered = items.map(it => { const o = {}; KEYS.forEach(k => { if (it[k] != null && it[k] !== '') o[k] = it[k]; }); return o; });
  const out = `// 澳洲发电 / 储能管线（window.AU_PIPELINE）—— au.html 🧭 管线图层。按 AEMO Generation Information 口径：
//   status: committed（承诺，全部 5 项标准达成 / 在建）· anticipated（预期，≥3 项标准）· proposed（拟建，公开宣布 / 接入申请）
//   fuel: solar / wind / offshore_wind / battery / pumped_hydro / hydro / gas / hydrogen / coal / other（主燃料 = MW 最大者）；
//   mix: 多技术场站各燃料的交流铭牌 MW；mw 为交流铭牌合计，siteMw 为 AEMO Max Site Capacity（接入上限，与 mw 不同时才给），mwh 为储能能量
//   cod: 预期全面商业运行 'YYYY' 或 'YYYY-MM'；coord [lng,lat]（approx:true = 按所在地 / 邮编 / 接入站 / 州质心放置的示意位置，待补精确坐标）
//   locality: 所在地（KCI 位置描述 / 地名库命中）；connNode: 接入变电站；tnsp: 接入申请所属输电商；rez: 所在 REZ；kci: AEMO KCI ID；
//   projId: 主项目库里同一项目的 id（有则详情卡可互跳）
// 由 scripts/import-aemo.js 从 AEMO Excel（+ KCI 汇编表 + scripts/data/au-localities.csv 地名库）生成（坐标 / 中文名 / 备注从上一版记忆），
// 也可手工维护；非项目数据（不受 validate-data.js 约束），由 scripts/test-au.js 校验字段与坐标范围。
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
  const opt = { wem: false, includeExisting: false, dry: false, out: path.join(__dirname, '..', 'js', 'au-pipeline.js'), prev: null, asof: null, sheet: null, kci: null, gazetteer: path.join(__dirname, 'data', 'au-localities.csv'), main: true };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--wem') opt.wem = true; else if (a === '--include-existing') opt.includeExisting = true; else if (a === '--dry') opt.dry = true;
    else if (a === '--out') opt.out = argv[++i]; else if (a === '--prev') opt.prev = argv[++i]; else if (a === '--asof') opt.asof = argv[++i]; else if (a === '--sheet') opt.sheet = argv[++i];
    else if (a === '--kci') opt.kci = argv[++i]; else if (a === '--gazetteer') opt.gazetteer = argv[++i]; else if (a === '--no-gazetteer') opt.gazetteer = null; else if (a === '--no-main') opt.main = false;
    else files.push(a);
  }
  if (!files.length) { console.error('用法：node scripts/import-aemo.js <AEMO Generation Information.xlsx|.csv> [--kci <KCI.xlsx>] [--sheet 名] [--wem] [--asof YYYY-MM] [--include-existing] [--dry] [--out 路径] [--prev 上一版路径] [--gazetteer csv|--no-gazetteer] [--no-main]'); process.exit(1); }
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
  const prev = loadPrev(opt.prev || opt.out);
  const nodes = loadNodes(path.join(__dirname, '..', 'js', 'au-grid.js'));
  const kci = opt.kci ? loadKci(opt.kci) : {};
  if (opt.kci) console.log('KCI：' + Object.keys(kci).length + ' 个 KCI ID，' + Object.values(kci).filter(k => k.locs.length).length + ' 个带位置描述');
  const gaz = opt.gazetteer && fs.existsSync(opt.gazetteer) ? loadGazetteer(opt.gazetteer) : null;
  if (opt.gazetteer && !gaz) console.log('地名库不存在，跳过按地名定位：' + opt.gazetteer);
  const mainProjects = opt.main ? loadMainProjects(path.join(__dirname, '..', 'js')) : [];
  const { needCoord, removed, kept, geo } = enrich(items, prev, nodes, { gaz, kci, main: mainProjects });
  const d = diff(prev, items);
  const asOf = opt.asof || new Date().toISOString().slice(0, 7);
  const cnt = s => items.filter(x => x.status === s).length;
  console.log(`解析 ${rows.length} 行 → ${items.length} 条管线记录（committed ${cnt('committed')} · anticipated ${cnt('anticipated')} · proposed ${cnt('proposed')}${kept.length ? '；含保留的非本表范围 ' + kept.length + ' 条' : ''}）`);
  console.log(`定位：上一版记忆 ${geo.memory} · 主项目库精确 ${geo.main} · KCI 位置描述 ${geo.kci} · 场站名地名 ${geo.name} · 接入站 ${geo.node} · 州质心 ${geo.centroid}`);
  console.log(`与上一版（${prev.length} 条）比较：新增 ${d.added.length} · 状态变化 ${d.status.length} · 容量变化 ${d.mw.length} · 不再出现 ${removed.length}`);
  d.status.forEach(([p, it]) => console.log(`  ↗ ${it.en}: ${p.status} → ${it.status}${it.cod ? '（COD ' + it.cod + '）' : ''}`));
  d.mw.forEach(([p, it]) => console.log(`  Δ ${it.en}: ${p.mw} → ${it.mw} MW`));
  d.added.slice(0, 40).forEach(it => console.log(`  + ${it.en} · ${it.state} · ${it.fuel} · ${it.mw} MW · ${it.status}`));
  if (d.added.length > 40) console.log(`  + … 另有 ${d.added.length - 40} 条新增`);
  removed.forEach(p => console.log(`  − ${p.en}（${p.status}）— 本版未出现（投运 / 撤回 / 改名？改名请在上一版条目加 aemo:"<AEMO Site Name>" 后重跑）`));
  if (needCoord.length) console.log(`需补坐标（暂放接入站或州质心，approx:true）：\n  ` + needCoord.map(it => it.id + ' ' + it.en + (it.connNode ? ' @' + it.connNode : '') + (it.locality ? ' 「' + it.locality + '」' : '')).join('\n  '));
  if (opt.dry) { console.log('--dry：不写文件'); return; }
  writeOut(opt.out, items, asOf, (opt.wem ? 'AEMO WEM Generation Information' : 'AEMO NEM Generation Information') + ' · ' + path.basename(src) + (opt.kci ? ' + KCI ' + path.basename(opt.kci) : '') + (gaz ? ' · 地名定位 scripts/data/au-localities.csv' : ''));
  console.log('写出 ' + opt.out);
}

module.exports = { unzip, parseWorkbook, parseCSV, findHeader, mapColumns, convertRows, normStatus, normFuel, normCod, normKey, cleanOwner, parseKci, loadKci, parseGazetteer, loadGazetteer, geocode, stripTypeWords, zhName, loadMainProjects, enrich, diff, writeOut };
if (require.main === module) main();
