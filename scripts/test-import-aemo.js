#!/usr/bin/env node
/* ============================================================
 * import-aemo.js 单元测试（零依赖）：在内存里拼一个迷你 .xlsx（ZIP + sharedStrings + sheet），
 * 跑 parseWorkbook → convertRows → enrich，断言表头识别、状态过滤、多机组合并、燃料归一、
 * COD 归一（Excel 序列日期 / 文本）、坐标记忆与枢纽站回退、CSV 解析。
 * 用法：node scripts/test-import-aemo.js
 * ============================================================ */
'use strict';
const zlib = require('zlib');
const path = require('path');
const I = require(path.join(__dirname, 'import-aemo.js'));

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* ---------- 最小 ZIP 写入（deflate + CRC32）---------- */
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return buf => { let c = -1; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
function zip(entries) {
  const locals = [], centrals = []; let off = 0;
  entries.forEach(([name, text]) => {
    const raw = Buffer.from(text, 'utf8'), data = zlib.deflateRawSync(raw), nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(CRC(raw), 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(CRC(raw), 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, data); centrals.push(ch, nm); off += lh.length + nm.length + data.length;
  });
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat(locals.concat([cd, eocd]));
}

/* ---------- 迷你 AEMO 工作簿 ---------- */
const strings = ['Region', 'Asset Type', 'Site Name', 'Owner', 'Technology Type', 'Fuel Type', 'DUID', 'Unit Status', 'Nameplate Capacity (MW)', 'Storage Capacity (MWh)', 'Full Commercial Use Date',
  'NSW1', 'Battery Storage', 'Orana BESS', 'Akaysha Energy', 'Battery', 'Committed', 'ORANAB1', 'ORANAB2', 'VIC1', 'Wind', 'Golden Plains Wind Farm Stage 2', 'TagEnergy', 'Anticipated', 'Q4 2027',
  'Existing', 'Hornsdale Power Reserve', 'SA1', 'Proposed', 'Solar', 'Bulli Creek Solar Farm', 'Genex', 'QLD1', 'Withdrawn', 'Dead Project', 'Dec 2026', 'Gas', 'OCGT', 'Kurri Kurri', 'Snowy Hydro', 'Committed*', '&amp;'];
const sidx = s => strings.indexOf(s);
const ss = '<?xml version="1.0"?><sst xmlns="x" count="' + strings.length + '"><si><t>' + strings.join('</t></si><si><t>') + '</t></si></sst>';
const S = (col, row, s) => '<c r="' + col + row + '" t="s"><v>' + sidx(s) + '</v></c>';
const N = (col, row, n) => '<c r="' + col + row + '"><v>' + n + '</v></c>';
const header = '<row r="3">' + ['Region', 'Asset Type', 'Site Name', 'Owner', 'Technology Type', 'Fuel Type', 'DUID', 'Unit Status', 'Nameplate Capacity (MW)', 'Storage Capacity (MWh)', 'Full Commercial Use Date'].map((h, i) => S(String.fromCharCode(65 + i), 3, h)).join('') + '</row>';
const rows = [
  '<row r="1"><c r="A1" t="inlineStr"><is><t>NEM Generation Information Oct 2026</t></is></c></row>',
  header,
  // Orana BESS：两台机组，Committed，Excel 序列日期 2027-03-01 (46447)
  '<row r="4">' + S('A', 4, 'NSW1') + S('B', 4, 'Battery Storage') + S('C', 4, 'Orana BESS') + S('D', 4, 'Akaysha Energy') + S('E', 4, 'Battery') + S('F', 4, 'Battery') + S('G', 4, 'ORANAB1') + S('H', 4, 'Committed') + N('I', 4, 207.5) + N('J', 4, 415) + N('K', 4, 46447) + '</row>',
  '<row r="5">' + S('A', 5, 'NSW1') + S('B', 5, 'Battery Storage') + S('C', 5, 'Orana BESS') + S('D', 5, 'Akaysha Energy') + S('E', 5, 'Battery') + S('F', 5, 'Battery') + S('G', 5, 'ORANAB2') + S('H', 5, 'Committed') + N('I', 5, 207.5) + N('J', 5, 415) + N('K', 5, 46447) + '</row>',
  // Golden Plains 2：Anticipated，文本 COD "Q4 2027"
  '<row r="6">' + S('A', 6, 'VIC1') + S('B', 6, 'Wind') + S('C', 6, 'Golden Plains Wind Farm Stage 2') + S('D', 6, 'TagEnergy') + S('E', 6, 'Wind') + S('F', 6, 'Wind') + S('H', 6, 'Anticipated') + N('I', 6, 577) + S('K', 6, 'Q4 2027') + '</row>',
  // Existing：默认剔除
  '<row r="7">' + S('A', 7, 'SA1') + S('B', 7, 'Battery Storage') + S('C', 7, 'Hornsdale Power Reserve') + S('E', 7, 'Battery') + S('F', 7, 'Battery') + S('H', 7, 'Existing') + N('I', 7, 150) + N('J', 7, 194) + '</row>',
  // Proposed 光伏，COD "Dec 2026"
  '<row r="8">' + S('A', 8, 'QLD1') + S('B', 8, 'Solar') + S('C', 8, 'Bulli Creek Solar Farm') + S('D', 8, 'Genex') + S('E', 8, 'Solar') + S('F', 8, 'Solar') + S('H', 8, 'Proposed') + N('I', 8, 775) + S('K', 8, 'Dec 2026') + '</row>',
  // Withdrawn：剔除
  '<row r="9">' + S('A', 9, 'QLD1') + S('B', 9, 'Solar') + S('C', 9, 'Dead Project') + S('H', 9, 'Withdrawn') + N('I', 9, 100) + '</row>',
  // Committed* 燃气（无 COD）
  '<row r="10">' + S('A', 10, 'NSW1') + S('B', 10, 'Gas') + S('C', 10, 'Kurri Kurri') + S('D', 10, 'Snowy Hydro') + S('E', 10, 'OCGT') + S('F', 10, 'Gas') + S('H', 10, 'Committed*') + N('I', 10, 660) + '</row>',
].join('');
const sheet = '<?xml version="1.0"?><worksheet xmlns="x"><sheetData>' + rows + '</sheetData></worksheet>';
const wb = '<?xml version="1.0"?><workbook xmlns="x" xmlns:r="r"><sheets><sheet name="Cover" sheetId="1" r:id="rId1"/><sheet name="ExistingGeneration&amp;NewDevs" sheetId="2" r:id="rId2"/></sheets></workbook>';
const rels = '<?xml version="1.0"?><Relationships xmlns="x"><Relationship Id="rId1" Type="t" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="t" Target="worksheets/sheet2.xml"/></Relationships>';
const cover = '<?xml version="1.0"?><worksheet xmlns="x"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>cover</t></is></c></row></sheetData></worksheet>';
const xlsx = zip([['[Content_Types].xml', '<?xml version="1.0"?><Types/>'], ['xl/workbook.xml', wb], ['xl/_rels/workbook.xml.rels', rels], ['xl/sharedStrings.xml', ss], ['xl/worksheets/sheet1.xml', cover], ['xl/worksheets/sheet2.xml', sheet]]);

/* ---------- 解析 ---------- */
let parsed;
try { parsed = I.parseWorkbook(xlsx); ok(true, 'parseWorkbook 不抛错'); } catch (e) { fails.push('parseWorkbook 抛错：' + e.message); }
if (parsed) {
  ok(parsed.sheets.length === 2 && parsed.sheets[1].name === 'ExistingGeneration&NewDevs', '工作表名解码（含 &amp;）：' + JSON.stringify(parsed.sheets.map(s => s.name)));
  const coverRows = parsed.readSheet(parsed.sheets[0].path);
  ok(I.findHeader(coverRows) < 0, '封面表无表头');
  const r = parsed.readSheet(parsed.sheets[1].path);
  ok(I.findHeader(r) === 1, '表头在第 2 行（index 1），实际 ' + I.findHeader(r));
  ok(r[2] && r[2][2] === 'Orana BESS' && r[2][8] === 207.5, '共享字符串与数值单元格读取');
  let items = [];
  try { items = I.convertRows(r, { wem: false, includeExisting: false }); ok(true, 'convertRows 不抛错'); } catch (e) { fails.push('convertRows 抛错：' + e.message); }
  const by = {}; items.forEach(it => { by[it.en] = it; });
  ok(items.length === 4, '保留 4 条（剔除 Existing / Withdrawn），实际 ' + items.length + '：' + items.map(i => i.en).join(', '));
  ok(by['Orana BESS'] && by['Orana BESS'].mw === 415 && by['Orana BESS'].mwh === 830 && by['Orana BESS'].duids.length === 2, '多机组合并：Orana 415 MW / 830 MWh / 2 DUID');
  ok(by['Orana BESS'] && by['Orana BESS'].cod === '2027-03', 'Excel 序列日期 → 2027-03（实际 ' + (by['Orana BESS'] || {}).cod + '）');
  ok(by['Orana BESS'] && by['Orana BESS'].fuel === 'battery' && by['Orana BESS'].state === 'NSW' && by['Orana BESS'].region === 'NSW1', '燃料 / 州 / 区域归一');
  ok(by['Golden Plains Wind Farm Stage 2'] && by['Golden Plains Wind Farm Stage 2'].status === 'anticipated' && by['Golden Plains Wind Farm Stage 2'].cod === '2027-12', 'Anticipated + "Q4 2027" → 2027-12');
  ok(by['Bulli Creek Solar Farm'] && by['Bulli Creek Solar Farm'].status === 'proposed' && by['Bulli Creek Solar Farm'].cod === '2026-12' && by['Bulli Creek Solar Farm'].fuel === 'solar', 'Proposed + "Dec 2026" → 2026-12');
  ok(by['Kurri Kurri'] && by['Kurri Kurri'].status === 'committed' && by['Kurri Kurri'].fuel === 'gas' && !by['Kurri Kurri'].cod, 'Committed* → committed；OCGT → gas；无 COD');
  const withExisting = I.convertRows(r, { wem: false, includeExisting: true });
  ok(withExisting.length === 5 && withExisting.some(i => i.status === 'existing'), '--include-existing 保留 Existing');

  /* ---------- 坐标记忆 / 节点回退 ---------- */
  const prev = [{ id: 'pl-nsw-001', en: 'Orana Battery Energy Storage System', name: '奥拉纳储能电站 (Orana BESS)', status: 'committed', mw: 415, coord: [148.9, -32.3], locality: 'Wellington', rez: 'Central-West Orana', sources: ['x'] }];
  const nodes = [{ id: 'nsw-wellington', en: 'Wellington', coord: [148.98, -32.56] }];
  by['Kurri Kurri'].connNode = 'Kurri Kurri 330 kV';
  by['Bulli Creek Solar Farm'].connNode = 'Wellington 330 kV';
  const { needCoord } = I.enrich(items, prev, nodes);
  ok(by['Orana BESS'].id === 'pl-nsw-001' && by['Orana BESS'].coord[0] === 148.9 && by['Orana BESS'].name.indexOf('奥拉纳') === 0 && by['Orana BESS'].rez === 'Central-West Orana', '坐标 / 中文名 / REZ 从上一版记忆（归一名匹配 "Orana BESS" ≈ "Orana Battery Energy Storage System"）');
  ok(by['Bulli Creek Solar Farm'].approx === true && by['Bulli Creek Solar Farm'].coord[0] === 148.98, '新项目按接入站回退坐标 + approx');
  ok(by['Kurri Kurri'].approx === true && by['Kurri Kurri'].coord[0] === 147.0, '无匹配节点 → 州质心 + approx');
  ok(needCoord.length === 3, '需补坐标清单 3 条（实际 ' + needCoord.length + '）');
  const ids = items.map(i => i.id); ok(new Set(ids).size === ids.length && ids.every(x => /^pl-[a-z]{2,3}-\d{3}$/.test(x)), '新 id 形如 pl-nsw-002 且唯一：' + ids.join(','));
  const d = I.diff(prev, items);
  ok(d.added.length === 3 && d.status.length === 0, 'diff：新增 3、状态变化 0');
  const ch = I.buildChanges(prev, items, { asOf: '2026-07', prevAsOf: '2026-04', source: 'test', needCoord: needCoord });
  ok(ch.counts.added === 3 && ch.counts.gone === 0 && ch.counts.needCoord === 3 && ch.added.every(x => x.id && x.en && x.state && x.fuel) && Array.isArray(ch.status) && Array.isArray(ch.mw), 'buildChanges：计数 + 精简条目字段');
  const brief = I.buildBrief(ch);
  ok(/季度变化简报 2026-04 → 2026-07/.test(brief) && brief.indexOf('Bulli Creek') > 0 && /需补坐标/.test(brief), 'buildBrief：标题 / 新增项目 / 需补坐标段');
  const prevOps = [{ id: 'a', en: 'A BESS', name: 'A', state: 'NSW', fuel: 'battery', mw: 100, status: 'anticipated' }, { id: 'b', en: 'B Solar', name: 'B', state: 'VIC', fuel: 'solar', mw: 50, status: 'committed' }];
  const nowOps = [{ id: 'a', en: 'A BESS', name: 'A', state: 'NSW', fuel: 'battery', mw: 120, status: 'committed', cod: '2028-06' }];
  const ch2 = I.buildChanges(prevOps, nowOps, { asOf: '2026-07' });
  ok(ch2.status.length === 1 && ch2.status[0].from === 'anticipated' && ch2.status[0].to === 'committed' && ch2.mw.length === 0 && ch2.gone.length === 1 && ch2.gone[0].id === 'b', 'buildChanges：状态变化优先于容量变化，消失条目来自上一版');
}

/* ---------- CSV ---------- */
const csv = 'Region,Site Name,Owner,Technology Type,Fuel Type,Unit Status,Nameplate Capacity (MW),Storage Capacity (MWh),Full Commercial Use Date\nSA1,"Blyth Battery, Stage 2",Neoen,Battery,Battery,Committed,238.5,477,2026-11-01\nSA1,Goyder South Wind Farm,Neoen,Wind,Wind,Anticipated,412,,2027\n';
const crows = I.parseCSV(csv);
ok(crows.length === 3 && crows[1][1] === 'Blyth Battery, Stage 2' && crows[1][6] === 238.5, 'CSV 引号 / 数值解析');
const citems = I.convertRows(crows, { wem: false });
ok(citems.length === 2 && citems[0].cod === '2026-11' && citems[1].cod === '2027' && citems[1].fuel === 'wind', 'CSV → 记录：COD 2026-11 / 2027');

/* ---------- 归一化函数 ---------- */
ok(I.normStatus('Committed*') === 'committed' && I.normStatus('Publicly Announced') === 'proposed' && I.normStatus('Existing less announced withdrawal') === 'existing', 'normStatus');
ok(I.normFuel('Wind', 'Offshore Wind') === 'offshore_wind' && I.normFuel('Hydro', 'Pumped Hydro') === 'pumped_hydro' && I.normFuel('Natural Gas', 'CCGT') === 'gas' && I.normFuel('', '') === 'other', 'normFuel');
ok(I.normCod('15/03/2027') === '2027-03' && I.normCod('2028') === '2028' && I.normCod(2029) === '2029' && I.normCod('') === null, 'normCod');
ok(I.normKey('Golden Plains Wind Farm Stage 2') === 'golden plains 2' && I.normKey('Orana BESS') === 'orana', 'normKey');


/* ---------- 2026 版 "Generator Information" 表头（Commitment Status / Site Owner / Agg Nameplate (MW AC|DC) / Technology Detail / Max Site Capacity / KCI ID）---------- */
function sheetFromRows(rowsArr) {
  const cell = (ci, ri, v) => { const ref = String.fromCharCode(65 + ci) + ri; if (v == null || v === '') return ''; return typeof v === 'number' ? '<c r="' + ref + '"><v>' + v + '</v></c>' : '<c r="' + ref + '" t="inlineStr"><is><t>' + String(v).replace(/&/g, '&amp;') + '</t></is></c>'; };
  return '<?xml version="1.0"?><worksheet xmlns="x"><sheetData>' + rowsArr.map((r, i) => '<row r="' + (i + 1) + '">' + r.map((v, ci) => cell(ci, i + 1, v)).join('') + '</row>').join('') + '</sheetData></worksheet>';
}
function workbook1(sheetName, rowsArr) {
  return zip([['[Content_Types].xml', '<?xml version="1.0"?><Types/>'], ['xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="x" xmlns:r="r"><sheets><sheet name="' + sheetName + '" sheetId="1" r:id="rId1"/></sheets></workbook>'], ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="x"><Relationship Id="rId1" Type="t" Target="worksheets/sheet1.xml"/></Relationships>'], ['xl/worksheets/sheet1.xml', sheetFromRows(rowsArr)]]);
}
const H2 = ['AEMO Survey ID', 'Site Name', 'AEMO KCI ID', 'Site Owner', 'Custodian', 'Region', 'Max Site Capacity (AC)', 'Gen Info Unit ID', 'Unit Name', 'Technology Type', 'Technology Detail', 'Gas Turbine Fuel Type', 'DUID', 'Dispatch Type', 'Unit Count', 'Unit Capacity (MW DC)', 'Unit Capacity (MW AC)', 'Agg Nameplate Capacity (MW DC)', 'Agg Nameplate Capacity (MW AC)', 'Agg Nameplate Storage Capacity (MWh)', 'Commitment Status', 'Full Commercial Use Date', 'Expected Closure Year'];
const R2 = [
  ['Generator Information'], [], [],
  H2,
  // 光储混合场站：两行（Solar PV + Battery），DC ≠ AC，Max Site Capacity 97 < 铭牌合计
  [1, 'Ardandra Solar Farm And BESS', 'Q00011', 'Ardandra SF Pty Ltd as trustee for Ardandra SF Trust (ABN 12 345 678 901)', '', 'QLD1', 97, 101, 'Ardandra:Solar', 'Solar PV', 'Single Axis Tracking', '', '', 'Semi-scheduled', 1, 129.3, 97, 129.3, 97, '', 'Publicly Announced', 47256, ''],
  [1, 'Ardandra Solar Farm And BESS', 'Q00011', 'Ardandra SF Pty Ltd as trustee for Ardandra SF Trust (ABN 12 345 678 901)', '', 'QLD1', 97, 102, 'Ardandra:BESS', 'Battery Storage', 'Lithium-ion', '', '', 'Scheduled', 1, 74.9, 74.9, 74.9, 74.9, 150, 'Publicly Announced', 47300, ''],
  // 海上风电（Technology Detail 决定 offshore）
  [2, 'Bass Offshore Wind', '', 'Nexsphere Pty Ltd', '', 'TAS1', 500, 201, 'Bass:WTG', 'Wind', 'Offshore - fixed', '', '', 'Semi-scheduled', 50, 500, 500, 500, 500, '', 'Anticipated', '', ''],
  // Committed* 燃气（Gas Turbine Fuel Type 列）+ KCI N00001
  [3, 'Kurri Kurri GT', 'N00001', 'Snowy Hydro Limited', '', 'NSW1', 660, 301, 'KK:GT1', 'Gas Turbine', 'OCGT', 'Natural Gas', 'KURRI1', 'Scheduled', 2, '', 330, '', 660, '', 'Committed*', '', ''],
  // 无 Agg 列值 → Unit Capacity (MW AC) × Unit Count 回退；按场站名定位（Ettamogah）
  [4, 'Ettamogah Solar Farm', '', 'Some Developer', '', 'NSW1', '', 401, 'Etta:PV', 'Solar PV', 'Fixed', '', '', 'Semi-scheduled', 2, '', 50, '', '', '', 'Publicly Announced', '2028', ''],
  // In Service / Announced Withdrawal → 剔除
  [5, 'Old Plant', '', 'X', '', 'VIC1', 100, 501, 'Old:1', 'Coal', 'Black Coal', '', 'OLD1', 'Scheduled', 1, '', 100, '', 100, '', 'In Service', '', 2030],
  [6, 'Dead Project', '', 'X', '', 'VIC1', 100, 601, 'Dead:1', 'Solar PV', 'Fixed', '', '', '', 1, '', 100, '', 100, '', 'Announced Withdrawal', '', ''],
  // 主项目库同名（Snowy 2.0）→ projId + 精确坐标
  [7, 'Snowy 2.0', '', 'Snowy Hydro Limited', '', 'NSW1', 2040, 701, 'S2:PH', 'Hydro', 'Pumped Hydro', '', '', 'Scheduled', 6, '', 340, '', 2040, 350000, 'Committed', 47000, ''],
];
let items2 = [];
try {
  const wb2 = I.parseWorkbook(workbook1('Generator Information', R2));
  const r2 = wb2.readSheet(wb2.sheets[0].path);
  ok(I.findHeader(r2) === 3, '2026 版表头在第 4 行（index 3），实际 ' + I.findHeader(r2));
  const idx2 = I.mapColumns(r2[3]);
  ok(idx2.mw === 18 && idx2.mwDc === 17 && idx2.status === 20 && idx2.owner === 3 && idx2.siteMw === 6 && idx2.kci === 2 && idx2.techDetail === 10 && idx2.mwh === 19 && idx2.cod === 21, '2026 版列映射：mw=AC 列(18) 而非 DC(17)、Commitment Status、Site Owner、Max Site Capacity、KCI ID；实际 ' + JSON.stringify(idx2));
  items2 = I.convertRows(r2, {});
  ok(true, 'convertRows(2026 版) 不抛错');
} catch (e) { fails.push('2026 版解析抛错：' + (e && e.message)); }
const by2 = {}; items2.forEach(it => { by2[it.en] = it; });
ok(items2.length === 5, '2026 版保留 5 条（剔除 In Service / Announced Withdrawal），实际 ' + items2.length + '：' + items2.map(i => i.en).join(', '));
const ard = by2['Ardandra Solar Farm And BESS'];
ok(ard && ard.mw === 171.9 && ard.mwh === 150 && ard.siteMw === 97 && ard.status === 'proposed', '光储场站：mw=交流铭牌合计 171.9（非 DC）、mwh 150、siteMw=Max Site Capacity 97、Publicly Announced→proposed；实际 ' + JSON.stringify(ard && { mw: ard.mw, mwh: ard.mwh, siteMw: ard.siteMw, status: ard.status }));
ok(ard && ard.fuel === 'solar' && ard.mix && ard.mix.solar === 97 && ard.mix.battery === 74.9, '主燃料 = MW 最大者（solar）+ mix 构成；实际 ' + JSON.stringify(ard && { fuel: ard.fuel, mix: ard.mix }));
ok(ard && ard.kci === 'Q00011' && ard.owner === 'Ardandra SF Pty Ltd' && ard.tech === 'Solar PV · Single Axis Tracking + Battery Storage · Lithium-ion' && ard.state === 'QLD', 'KCI ID / 业主去受托尾巴 / tech 串 / 州；实际 ' + JSON.stringify(ard && { kci: ard.kci, owner: ard.owner, tech: ard.tech, state: ard.state }));
ok(ard && ard.cod === I.normCod(47256), 'COD 取两行里最早的序列日期');
ok(by2['Bass Offshore Wind'] && by2['Bass Offshore Wind'].fuel === 'offshore_wind' && by2['Bass Offshore Wind'].status === 'anticipated' && by2['Bass Offshore Wind'].state === 'TAS', 'Technology Detail "Offshore - fixed" → offshore_wind');
ok(by2['Kurri Kurri GT'] && by2['Kurri Kurri GT'].fuel === 'gas' && by2['Kurri Kurri GT'].status === 'committed' && by2['Kurri Kurri GT'].mw === 660 && by2['Kurri Kurri GT'].kci === 'N00001', 'Committed* + Gas Turbine Fuel Type → gas / committed');
ok(by2['Ettamogah Solar Farm'] && by2['Ettamogah Solar Farm'].mw === 100, '无 Agg 列 → Unit Capacity (MW AC) × Unit Count = 100；实际 ' + (by2['Ettamogah Solar Farm'] || {}).mw);
ok(by2['Snowy 2.0'] && by2['Snowy 2.0'].fuel === 'pumped_hydro' && by2['Snowy 2.0'].mwh === 350000, 'Hydro · Pumped Hydro → pumped_hydro');

/* ---------- 地名定位 geocode ---------- */
const gaz = I.parseGazetteer('# comment\nlocality,state,postcode,lng,lat\nARMIDALE,NSW,2350,151.6655,-30.5116\nETTAMOGAH,NSW,2640,147.0265,-36.0162\nAUSTRALIA PLAINS,SA,5374,139.1,-34.1\nBOWER,SA,5374,139.3,-34.1\nTORRENS ISLAND,SA,5960,138.53,-34.8\nKERI KERI,NSW,2711,143.98,-34.77\nWOLLAR,NSW,2850,149.95,-32.35\n');
const G = (t, s) => { const r = I.geocode(t, s, gaz, [{ en: 'Wollar', coord: [149.9, -32.3] }]); return r && (r.label + '@' + r.coord.join(',') + '#' + r.how); };
ok(G('5km east of Armidale, NSW', 'NSW') === 'Armidale@151.6655,-30.5116#locality', '"5km east of Armidale, NSW" → Armidale；实际 ' + G('5km east of Armidale, NSW', 'NSW'));
ok(G('Hub Road, Ettamogah NSW 2640', 'NSW') === 'Ettamogah@147.0265,-36.0162#locality', '街道地址 → Ettamogah；实际 ' + G('Hub Road, Ettamogah NSW 2640', 'NSW'));
ok(G('Lot 315 Bower Road, Lot 309 Emmaus Road, Australia Plains, SA', 'SA') === 'Australia Plains@139.1,-34.1#locality', '最长地名短语优先（Australia Plains > Bower）；实际 ' + G('Lot 315 Bower Road, Lot 309 Emmaus Road, Australia Plains, SA', 'SA'));
ok(G('North East of Torrens Island B Station Switchyard', 'SA') === 'Torrens Island@138.53,-34.8#locality', '"North East of Torrens Island …" → Torrens Island；实际 ' + G('North East of Torrens Island B Station Switchyard', 'SA'));
ok(G('12km East of Keri Keri town', 'NSW') === 'Keri Keri@143.98,-34.77#locality', '"12km East of Keri Keri town" → Keri Keri；实际 ' + G('12km East of Keri Keri town', 'NSW'));
ok(G('Approx 2.5 km away from the Wollar 500/330 kV Substation', 'NSW') === 'Wollar@149.95,-32.35#locality', '变电站描述 → Wollar 地名；实际 ' + G('Approx 2.5 km away from the Wollar 500/330 kV Substation', 'NSW'));
ok(G('Windfarm located offshore in Bass Strait, landing point TBC', 'TAS') == null, '海上描述无地名 → null');
ok((G('Somewhere unknown NSW 2350', 'NSW') || '').indexOf('#postcode') > 0, '无地名时按邮编质心回退；实际 ' + G('Somewhere unknown NSW 2350', 'NSW'));
ok(G('Armidale', 'VIC') == null, '地名限定在所属州（Armidale 不在 VIC）');
ok(G('East of Wollar substation', 'VIC') === 'Wollar@149.9,-32.3#node', '州内无地名时按接入站名回退');

/* ---------- 场站名 → 地名 / 中文名 ---------- */
ok(I.stripTypeWords('Argoon Wind Farm (RES Group) - KCI') === 'Argoon' && I.stripTypeWords('Abermain BESS') === 'Abermain' && I.stripTypeWords('Baldon Wind Farm Stage 2 - BESS') === 'Baldon', 'stripTypeWords：' + [I.stripTypeWords('Argoon Wind Farm (RES Group) - KCI'), I.stripTypeWords('Abermain BESS'), I.stripTypeWords('Baldon Wind Farm Stage 2 - BESS')].join(' | '));
ok(I.zhName('Abermain BESS', 'battery') === 'Abermain 储能电站' && I.zhName('Argoon Wind Farm (RES Group) - KCI', 'wind') === 'Argoon 风电场' && I.zhName('Ardandra Solar Farm And BESS', 'solar', { solar: 97, battery: 74.9 }) === 'Ardandra 光储项目' && I.zhName('Baldon Wind Farm Stage 2', 'wind') === 'Baldon 风电场二期' && I.zhName('Bass Offshore Wind', 'offshore_wind') === 'Bass 海上风电', 'zhName：' + [I.zhName('Abermain BESS', 'battery'), I.zhName('Argoon Wind Farm (RES Group) - KCI', 'wind'), I.zhName('Ardandra Solar Farm And BESS', 'solar', { solar: 97, battery: 74.9 }), I.zhName('Baldon Wind Farm Stage 2', 'wind'), I.zhName('Bass Offshore Wind', 'offshore_wind')].join(' | '));
ok(I.cleanOwner('Equis Energy (Australia) Projects (Ngumi 4) Pty Ltd as trustee for the Equis Energy Ngumi 4 Holding Trust (ABN 14 157 167 633)') === 'Equis Energy (Australia) Projects (Ngumi 4) Pty Ltd' && I.cleanOwner('  ACENergy Pty Ltd ') === 'ACENergy Pty Ltd', 'cleanOwner 去受托 / ABN 尾巴');

/* ---------- KCI 汇编表 + enrich（KCI 位置 → 坐标；按名定位；aemo 别名；非本表州保留）---------- */
const KR = [
  ['Key Connection Information (KCI)'], ['Connection Enquiry / Application'],
  ['TNSP Name', 'KCI datafile compilation date time stamp', 'TNSP Connection Enquiry / Application ID', 'Site Name', 'Site Location Description', 'Region to be supplied', 'AEMO KCI ID'],
  ['TransGrid', 201912201146, 'TGCE201218', 'Kurri Kurri Gas Project', 'Loxford', 'NSW1', 'N00001'],
  ['TransGrid', 202109161600, 'TGCE21091616009', 'Kurri Kurri GT', '5km east of Armidale, NSW', 'NSW1', 'N00001'],
  ['Powerlink', 202301010000, 'PLQ1', 'Ardandra Solar Farm And BESS', 'n/a', 'QLD1', 'Q00011'],
];
let kciMap = {};
try { kciMap = I.parseKci(I.parseWorkbook(workbook1('Q2 2026 KCI', KR))); ok(true, 'parseKci 不抛错'); } catch (e) { fails.push('parseKci 抛错：' + (e && e.message)); }
ok(kciMap.N00001 && kciMap.N00001.locs[0] === '5km east of Armidale, NSW' && kciMap.N00001.locs.length === 2 && kciMap.N00001.tnsp === 'TransGrid' && kciMap.N00001.sites.length === 2, 'KCI：最新时间戳的位置描述排最前、TNSP、两个场站名；实际 ' + JSON.stringify(kciMap.N00001));
ok(kciMap.Q00011 && kciMap.Q00011.locs.length === 0, 'KCI：n/a 位置描述被丢弃');
const prev2 = [
  { id: 'pl-tas-001', en: 'Bass Strait Offshore Wind (old name)', aemo: 'Bass Offshore Wind', name: '巴斯海上风电', status: 'proposed', mw: 500, coord: [146.5, -39.8], notes: '旧版备注' },
  { id: 'pl-wa-001', en: 'Muchea BESS', name: 'Muchea 储能电站', state: 'WA', region: 'SWIS', fuel: 'battery', mw: 164, status: 'committed', coord: [115.95, -31.6] },
];
const main2 = I.loadMainProjects(path.join(__dirname, '..', 'js'));
ok(main2.length >= 100 && main2.every(p => Array.isArray(p.coord) && p.en), '主项目库：≥100 个带坐标的澳洲项目（实际 ' + main2.length + '）');
const { needCoord: nc2, removed: rm2, kept: kp2, geo: geo2 } = I.enrich(items2, prev2, [{ en: 'Wollar', coord: [149.9, -32.3] }], { gaz, kci: kciMap, main: main2 });
const kk = by2['Kurri Kurri GT'], et = by2['Ettamogah Solar Farm'], bs = by2['Bass Offshore Wind'], sn = by2['Snowy 2.0'];
ok(kk.coord[0] === 151.6655 && kk.approx === true && kk.locality === '5km east of Armidale, NSW' && kk.tnsp === 'TransGrid', 'KCI 位置描述 → Armidale 坐标 + approx + locality + tnsp；实际 ' + JSON.stringify({ coord: kk.coord, approx: kk.approx, locality: kk.locality, tnsp: kk.tnsp }));
ok(et.coord[0] === 147.0265 && et.approx === true && et.locality === 'Ettamogah' && et.name === 'Ettamogah 光伏电站', '按场站名定位 → Ettamogah + 自动中文名；实际 ' + JSON.stringify({ coord: et.coord, locality: et.locality, name: et.name }));
ok(bs.id === 'pl-tas-001' && bs.name === '巴斯海上风电' && bs.coord[0] === 146.5 && bs.notes === '旧版备注' && bs.status === 'anticipated', 'aemo 别名匹配上一版（状态变化仍沿用 id / 中文名 / 坐标 / 备注）；实际 ' + JSON.stringify({ id: bs.id, name: bs.name, coord: bs.coord, status: bs.status }));
const snowyMain = main2.find(p => /^snowy 2\.0/i.test(p.en));
ok(!snowyMain || (sn.projId === snowyMain.id && !sn.approx && sn.coord[0] === snowyMain.coord[0] && sn.name === snowyMain.name), '主项目库同名 → projId + 精确坐标 + 中文名；实际 ' + JSON.stringify({ projId: sn.projId, approx: sn.approx, name: sn.name }));
ok(kp2.length === 1 && kp2[0].id === 'pl-wa-001' && items2.some(i => i.id === 'pl-wa-001') && rm2.length === 0, '导 NEM 时 WA 条目原样保留、不计入移除；实际 kept=' + kp2.length + ' removed=' + rm2.length);
ok(ard.approx === true && ard.coord[0] === 145.0 && nc2.some(i => i.en === 'Ardandra Solar Farm And BESS'), '无 KCI 位置、名字不是地名 → 州质心 + 需补坐标清单');
ok(geo2.kci === 1 && geo2.name === 1 && geo2.centroid === 1 && geo2.memory === 1, '定位统计：kci 1 / name 1 / centroid 1 / memory 1；实际 ' + JSON.stringify(geo2));
const ids2 = items2.map(i => i.id); ok(new Set(ids2).size === ids2.length, '2026 版 id 唯一：' + ids2.join(','));

if (fails.length) { console.error('✘ test-import-aemo 失败：\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('✔ test-import-aemo 通过：xlsx 解析 / 状态过滤 / 多机组合并 / 燃料·COD 归一 / 坐标记忆 / CSV / 2026 版表头 / KCI / 地名定位 / 中文名 / 季度变化 + 简报');
