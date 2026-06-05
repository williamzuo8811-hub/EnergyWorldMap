#!/usr/bin/env node
/* ============================================================
 * 生成社交分享卡 + PWA 图标（零依赖，纯 Node：zlib + 内嵌位图字体）
 * 用法：  node scripts/build-og.js
 * 产物：  assets/og-cover.png (1200×630)  ·  assets/icon-512.png  ·  assets/icon-192.png
 *
 * 为什么需要它：主流社交平台（微信/Twitter/Facebook/LinkedIn/Slack）的 og:image
 * 不渲染 SVG，必须是 PNG/JPEG；PWA manifest 也需要方形 PNG 图标。本仓库零构建、
 * 且环境无 rsvg/inkscape/imagemagick，故这里用纯 Node 把图光栅化。项目数量从真实数据层读取，永不过期。
 * 因无 CJK 字体，卡面文案为拉丁字符（更适合国际分享）；中文版仍保留 assets/og-cover.svg。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

/* ---------- 从真实数据层取计数（与 validate-data.js 同口径，永不过期）---------- */
function liveCounts() {
  global.window = {};
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  [...indexHtml.matchAll(/<script[^>]*\ssrc="(js\/[^"]+\.js)"><\/script>/g)]
    .map(m => m[1]).filter(s => /^js\/data.*\.js$/.test(s))
    .forEach(rel => { try { require(path.join(ROOT, rel)); } catch (e) { /* 忽略，用兜底 */ } });
  const E = global.window.ENERGY;
  if (!E) return { projects: 3000, cats: 10, regions: 8 };
  const all = E.PROJECTS.concat(global.window.ENERGY_EXTRA || []);
  const seen = new Set(); all.forEach(p => { if (p && p.name) seen.add(p.name); });
  return { projects: seen.size, cats: Object.keys(E.CATEGORIES).length, regions: E.REGIONS.length };
}

/* ---------- 5×7 位图字体（仅图面所需字符）---------- */
const FONT = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], 'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], 'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], 'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01110'], 'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], 'J': ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], 'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], 'N': ['10001', '11001', '10101', '10101', '10011', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], 'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], 'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], 'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], 'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'], 'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], 'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'], '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'], ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '·': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
};

const hex = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };

/* ---------- 画布工厂 ---------- */
function canvas(W, H) {
  const buf = Buffer.alloc(W * H * 3);
  const px = (x, y, c, a) => {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    if (a == null || a >= 1) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; return; }
    buf[i] = Math.round(buf[i] * (1 - a) + c[0] * a); buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + c[1] * a); buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + c[2] * a);
  };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  const border = (x, y, w, h, c) => { for (let i = 0; i < w; i++) { px(x + i, y, c); px(x + i, y + h - 1, c); } for (let j = 0; j < h; j++) { px(x, y + j, c); px(x + w - 1, y + j, c); } };
  const disc = (cx, cy, r, c) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) px(cx + i, cy + j, c); };
  const ring = (cx, cy, r, t, c, a) => { const r2 = r * r, ri2 = (r - t) * (r - t); for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = i * i + j * j; if (d <= r2 && d >= ri2) px(cx + i, cy + j, c, a); } };
  const vline = (cx, cy, r, c, a) => { for (let i = -r; i <= r; i++) px(cx + i, cy, c, a); };
  const ellipseV = (cx, cy, rx, ry, c, a) => { for (let j = -ry; j <= ry; j++) { const x = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry)))); px(cx + x, cy + j, c, a); px(cx - x, cy + j, c, a); } };
  const gradV = (top, bot) => { for (let y = 0; y < H; y++) { const t = y / (H - 1), c = [Math.round(top[0] + (bot[0] - top[0]) * t), Math.round(top[1] + (bot[1] - top[1]) * t), Math.round(top[2] + (bot[2] - top[2]) * t)]; for (let x = 0; x < W; x++) px(x, y, c); } };
  const measure = (s, sc, ls) => s.length * (5 * sc + ls) - ls;
  const text = (x, y, str, sc, c, ls) => { ls = ls == null ? sc : ls; let cx = x; for (const ch of str.toUpperCase()) { const g = FONT[ch] || FONT[' ']; for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) if (g[r][col] === '1') rect(cx + col * sc, y + r * sc, sc, sc, c); cx += 5 * sc + ls; } };
  // 地球意象（经纬环 + 品类色散点），按比例 s（相对 150 半径）缩放
  const globe = (gx, gy, R) => {
    const CYAN = hex('#21c7ff'), s = R / 150;
    ring(gx, gy, R, Math.max(2, Math.round(2 * s)), CYAN, 0.6); ring(gx, gy, R, 1, CYAN, 0.2);
    ellipseV(gx, gy, Math.round(64 * s), R, CYAN, 0.45); ellipseV(gx, gy, Math.round(118 * s), R, CYAN, 0.3);
    vline(gx, gy, R, CYAN, 0.4); vline(gx, gy - Math.round(56 * s), Math.round(140 * s), CYAN, 0.22); vline(gx, gy + Math.round(56 * s), Math.round(140 * s), CYAN, 0.22);
    [[-120, -60, '#2ee6a6', 6], [40, -90, '#facc15', 5], [95, 70, '#ff5fa8', 7], [-70, 105, '#ffb02e', 5], [10, 40, '#21c7ff', 4], [-30, -30, '#b388ff', 5], [120, 10, '#5b8cff', 4], [60, 120, '#a3e635', 5]]
      .forEach(d => disc(gx + Math.round(d[0] * s), gy + Math.round(d[1] * s), Math.max(2, Math.round(d[3] * s)), hex(d[2])));
  };
  return { W, H, buf, px, rect, border, disc, ring, vline, ellipseV, gradV, text, measure, globe };
}

/* ---------- PNG 编码（truecolor RGB，filter 0）---------- */
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0); return Buffer.concat([len, t, data, crc]); }
function encodePNG(cv) {
  const { W, H, buf } = cv;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; buf.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function save(name, cv) { const out = path.join(ROOT, 'assets', name); const png = encodePNG(cv); fs.writeFileSync(out, png); console.log('✔ ' + path.relative(ROOT, out) + '（' + (png.length / 1024).toFixed(1) + ' KB，' + cv.W + '×' + cv.H + '）'); }

/* ============================================================ 绘制 ============================================================ */
const INK = hex('#e8eefb'), MUTE = hex('#93a4c4'), CYAN = hex('#21c7ff'), GREEN = hex('#2ee6a6'), PANEL = hex('#101a30'), STROKE = hex('#2a3a5c');
const cnt = liveCounts();

/* ---- 社交卡 og-cover.png 1200×630 ---- */
(function () {
  const cv = canvas(1200, 630);
  cv.gradV(hex('#060b18'), hex('#0a1228'));
  for (let y = 0; y < 630; y++) for (let x = 0; x < 1200; x++) { const d1 = Math.hypot(x - 1032, y + 40) / 620; if (d1 < 1) cv.px(x, y, CYAN, 0.13 * (1 - d1)); const d2 = Math.hypot(x + 30, y - 630) / 620; if (d2 < 1) cv.px(x, y, GREEN, 0.11 * (1 - d2)); }
  cv.globe(1040, 250, 150);
  cv.text(90, 150, 'GLOBAL ENERGY', 9, INK); cv.text(90, 238, 'PROJECTS MAP', 9, INK);
  for (let i = 0; i < 150; i++) { const t = i / 149, c = [Math.round(CYAN[0] + (GREEN[0] - CYAN[0]) * t), Math.round(CYAN[1] + (GREEN[1] - CYAN[1]) * t), Math.round(CYAN[2] + (GREEN[2] - CYAN[2]) * t)]; for (let j = 0; j < 8; j++) cv.px(92 + i, 322 + j, c); }
  cv.text(92, 352, 'INTERACTIVE WORLD MAP', 4, MUTE);
  const chips = [[cnt.projects + ' PROJECTS', '#2ee6a6'], [cnt.cats + ' CATEGORIES', '#21c7ff'], [cnt.regions + ' REGIONS', '#ffb02e']];
  let cx = 90; const cy = 462, ch = 70, pad = 24, sc = 4;
  chips.forEach(([s, col]) => { const cw = cv.measure(s, sc, sc) + pad * 2; cv.rect(cx, cy, cw, ch, PANEL); cv.border(cx, cy, cw, ch, STROKE); cv.text(cx + pad, cy + (ch - 7 * sc) / 2, s, sc, hex(col)); cx += cw + 20; });
  cv.text(90, 588, 'ENERGYWORLDMAP · UPDATED 2026-06', 3, hex('#5f718f'));
  save('og-cover.png', cv);
})();

/* ---- PWA 方形图标 icon-512 / icon-192 ---- */
function icon(size) {
  const cv = canvas(size, size);
  cv.gradV(hex('#0a1228'), hex('#060b18'));
  const R = Math.round(size * 0.40);
  cv.globe(Math.round(size / 2), Math.round(size * 0.46), R);
  // 底部强调条
  const bw = Math.round(size * 0.34), bx = Math.round((size - bw) / 2), by = Math.round(size * 0.84), bh = Math.max(3, Math.round(size * 0.018));
  for (let i = 0; i < bw; i++) { const t = i / (bw - 1), c = [Math.round(CYAN[0] + (GREEN[0] - CYAN[0]) * t), Math.round(CYAN[1] + (GREEN[1] - CYAN[1]) * t), Math.round(CYAN[2] + (GREEN[2] - CYAN[2]) * t)]; for (let j = 0; j < bh; j++) cv.px(bx + i, by + j, c); }
  return cv;
}
save('icon-512.png', icon(512));
save('icon-192.png', icon(192));
