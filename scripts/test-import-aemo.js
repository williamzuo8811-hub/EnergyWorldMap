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

if (fails.length) { console.error('✘ test-import-aemo 失败：\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('✔ test-import-aemo 通过：xlsx 解析 / 状态过滤 / 多机组合并 / 燃料·COD 归一 / 坐标记忆 / CSV');
