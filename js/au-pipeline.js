// 澳洲发电 / 储能管线（window.AU_PIPELINE）—— au.html 🧭 管线图层。按 AEMO Generation Information 口径：
//   status: committed（承诺，全部 5 项标准达成 / 在建）· anticipated（预期，≥3 项标准）· proposed（拟建，公开宣布 / 接入申请）
//   fuel: solar / wind / offshore_wind / battery / pumped_hydro / hydro / gas / hydrogen / coal / other；mw 为交流铭牌，mwh 为储能能量
//   cod: 预期全面商业运行 'YYYY' 或 'YYYY-MM'；coord [lng,lat]（approx:true = 放在接入站 / 州质心的示意位置，待补精确坐标）
//   connNode: 接入变电站；rez: 所在 REZ；projId: 主项目库里同一项目的 id（有则详情卡可互跳）
// 由 scripts/import-aemo.js 从 AEMO Excel 生成（坐标 / 中文名 / 备注从上一版记忆），也可手工维护；非项目数据（不受 validate-data.js 约束），
// 由 scripts/test-au.js 校验字段与坐标范围。
window.AU_PIPELINE = { asOf: '2026-10', source: '', items: [] };
