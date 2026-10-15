// 澳洲输电骨架（window.AU_GRID）—— au.html 走廊 / 枢纽站图层。示意走廊（枢纽站连线），非测绘线路。非项目数据。
//   nodes[{id,name,en,state,kv,coord[lng,lat],kind,owner,notes}]
//   lines[{id,name,en,kv,type(ac|dc),status(existing|building|planned),owner,nodes[id…],year,lengthKm,costAud,notes,sources[]}]
window.AU_GRID = { nodes: [], lines: [] };
