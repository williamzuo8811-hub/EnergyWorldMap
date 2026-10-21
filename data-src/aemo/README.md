# AEMO 源数据快照（data-src/aemo/）

`js/au-pipeline.js`（澳洲地图 🧭 AEMO 管线图层）由这里的 AEMO 原始工作簿生成；保留原件是为了下季度能复现差异清单，
也方便核对。**页面不会加载这些文件**（不在 `sw.js` 缓存、不受 `validate-data.js` 约束）。

| 文件 | 来源 | 说明 |
|---|---|---|
| `NEM-Generation-Information-2026-07.xlsx` | AEMO [Generation information](https://aemo.com.au/energy-systems/electricity/national-electricity-market-nem/nem-forecasting-and-planning/forecasting-and-planning-data/generation-information) | 2026 年 7 月版 NEM Generation Information（Generator Information 工作表，Commitment Status / Agg Nameplate (MW AC) 等列） |
| `KCI-Datafile-Compiled-NEM-2026Q2.xlsx` | 同上页面 Key Connection Information 栏目 | 2026 Q2 KCI 汇编（Site Location Description / TNSP / AEMO KCI ID） |
| `Generating-Unit-Expected-Closure-Year-2026-07.xlsx` | 同上页面 | 机组预期关停年（用于核对 `js/au-coal.js` 的退役倒计时） |

版权：© Australian Energy Market Operator Limited，按 AEMO 网站的版权许可使用（引用须注明来源）。

## 刷新步骤

```
node scripts/import-aemo.js data-src/aemo/NEM-Generation-Information-<YYYY-MM>.xlsx \
     --kci data-src/aemo/KCI-Datafile-Compiled-NEM-<YYYYQn>.xlsx --asof <YYYY-MM>
node scripts/test-au.js
```

导入器会打印新增 / 状态变化 / 容量变化 / 不再出现 / 需补坐标清单，并沿用上一版的坐标、中文名与备注；同时写出
`js/au-changes.js`（`window.AU_CHANGES`，澳洲地图 📰 本季变化面板的数据：added / status(from→to) / mw / gone / needCoord）和一页中文简报
`data-src/aemo/brief-<asOf>.md`（本目录保留每季一份；`--prev-asof` 可指定上一版的季度标签，`--no-changes` / `--no-brief` 关闭）。
当前：`brief-2026-07.md` = 2026-04 → 2026-07 的差异（新增 55 · 状态变化 33 · 容量变化 45 · 不再出现 46 · 需补坐标 1；新增里含手工补入的
西澳承诺风电 5 条与 NWIS/Pilbara 8 条）。

## KCI 2026 Q3 / NWIS

- **KCI 2026 Q3 尚未导入**：aemo.com.au 在 Claude 云容器里不可达，Q3 汇编表需本地下载后放到本目录，再运行
  `node scripts/import-aemo.js data-src/aemo/NEM-Generation-Information-2026-07.xlsx --kci data-src/aemo/KCI-Datafile-Compiled-NEM-2026Q3.xlsx --asof 2026-07 --prev-asof 2026-04`
  （只更新位置描述 / TNSP，坐标、中文名与备注从上一版记忆；仍在州质心的只剩 pl-qld-115 Elai Genesis BESS）。
- 2026-10-21 核对：用户上传的 `KCI_Datafile_Compiled_NEM.xlsx` 与本目录 Q2 文件 MD5 相同（工作表 "Q2 2026 KCI"，1005 条），即 AEMO 页面当时仍只有 Q2 版；Q3 版挂出后再走上面的命令。
- **NWIS 参考文档**（公开，不入库，`js/au-grid.js` Pilbara 节点 / 走廊与 `js/au-states.js` WA 档案的 Pilbara 条目据此编制）：Horizon Power
  [Pilbara 网络接线图](https://pilbara.horizonpower.com.au/globalassets/pn-pilbara-network/pn-media/pn-design-assets/pilbara-network.pdf)（各家网络归属、电源与电压等级）、
  [系统描述 2021-12](https://pilbara.horizonpower.com.au/globalassets/pn-pilbara-network/pn-documents/6-system-description-and-user-access-guide/6-system-description-compressed.pdf)（West Pilbara 132 kV / East Pilbara 66 kV、190 km 单回 220 kV、约束与发电限额、变电站备用容量）、
  [ACCC 授权决定 AA1000666（2024-12）](https://www.accc.gov.au/system/files/public-registers/documents/Final%20Determination%20-%2018.12.24%20-%20PR%20-%20AA1000666%20Pilbara%20ISOCo%20Ltd.pdf)（附录 1：Pilbara ISO 注册网络服务商 / 注册控制方 / 接入申请人）。
- **NWIS（Pilbara）**：AEMO 不发布 NWIS 逐项目表，`region: "NWIS"` 条目按业主公告、EPA 转介与州政府 Pilbara Energy Transition 资料手工维护
  （Fortescue PEC 光储、Jinbi、Cloudbreak 光伏、Baru Marnda、Woodside Solar、Perdaman Helios、Ngarluma / Banjima 原住民项目、力拓沿海光储、
  Horizon Power Karratha 86 MW 替代电源招标）；AREH（15 GW，ICE 主导，bp 2025 退出）不作管线条目，见 REZ 图层与输电节点。
改名的场站在上一版条目加 `aemo:"<AEMO Site Name>"` 后重跑即可保留。西澳（WEM）另有 "WEM Generation Information"，
导入时加 `--wem`。

## 西澳 WEM（SWIS）

AEMO 不为 WEM 发布逐项目的 "Generation Information" 表；西澳管线按 **2026 WEM ESOO**（2026-06，[页面](https://www.aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/wem-forecasting-and-planning/wem-electricity-statement-of-opportunities-wem-esoo)）
的附录 A2/A3、Data Register（Figure 21 逐设施容量信用）与 Reserve Capacity Information Pack 手工核对：2027-28 容量年新获容量信用的设施记为承诺，
预期 / 拟建按 ESOO 汇总口径与业主公告推断。`WEM-2026-ESOO-capacity-credits-2027-28.csv` 是从 Data Register 抽出的逐设施容量信用表；
ESOO 原件（主报告 / 附录 PDF 5 MB、Data Register 23 MB）体积大，不入库，刷新时从上述页面重新下载。

主报告第 3 章（3.2.2 / 3.2.3）表 17、表 18 是正文里唯一的逐项目清单——具名的承诺项目只有 4 座风电（Narrogin 168 MW · Kondinin 130 MW ·
Parron 484 MW · Alinta Marri 550 MW）与 East Rockingham RRF 29 MW，其余按技术类别汇总（燃气 / 柴油 442 MW、储能 781 MW / 3,828 MWh、
DSP 41 MW、其他风光 439 MW；预期：光伏 129 MW、储能 891 MW / 4,908 MWh）。`WEM-2026-ESOO-table17-18-committed-anticipated.csv` 抄录了这两张表并标注对应的
`pl-wa-*` 管线 id；具名项目已逐条进入 `js/au-pipeline.js`（状态与 COD 按 AEMO 口径，场址为所在地示意坐标 `approx:true`）。
