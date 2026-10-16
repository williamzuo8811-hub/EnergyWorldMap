// 澳洲可再生能源区 REZ（window.AU_REZ）—— au.html 🌞 REZ 图层。非项目数据。
//   zones[{key, ispId, name, en, state, body, status(declared|planned|candidate), targetGw, timeline, transmission, access,
//          polygon[[lng,lat]…]（示意边界，4–12 顶点）, center[lng,lat], notes, sources[]}]
//   declared = 已正式划定（有接入机制 / 网络工程）；planned = 州规划中的区（VTP 2025 / 昆州路线图等）；candidate = 仅 AEMO ISP 候选区
window.AU_REZ = { asOf: '2026-10', zones: [] };
