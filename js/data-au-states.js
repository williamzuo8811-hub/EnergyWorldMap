// 澳洲各州 / 领地电网公司档案（window.AU_STATES）—— au.html 州卡片内容，非项目数据（不受 validate-data.js 约束）
// 键为州缩写 NSW / VIC / QLD / SA / WA / TAS / NT（首都领地 ACT 并入 NSW）。字段：
//   grid / operator / summary / tnsp{name,owner,voltages,notes} / dnsps[{name,area,hq,owner,voltages,notes}] /
//   rezBody / rezs[] / policy / coalExit / keyProjects[{name,en,kv,status(规划|在建|投运),year,owner,desc}] /
//   vendor（设备商必读）/ tenderPortals[] / sources[]。内容为 2026-10 调研 + 逐条核验，中文简体。
window.AU_STATES = {};
