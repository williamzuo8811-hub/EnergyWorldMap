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

导入器会打印新增 / 状态变化 / 容量变化 / 不再出现 / 需补坐标清单，并沿用上一版的坐标、中文名与备注；
改名的场站在上一版条目加 `aemo:"<AEMO Site Name>"` 后重跑即可保留。西澳（WEM）另有 "WEM Generation Information"，
导入时加 `--wem`。

## 西澳 WEM（SWIS）

AEMO 不为 WEM 发布逐项目的 "Generation Information" 表；西澳管线按 **2026 WEM ESOO**（2026-06，[页面](https://www.aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/wem-forecasting-and-planning/wem-electricity-statement-of-opportunities-wem-esoo)）
的附录 A2/A3、Data Register（Figure 21 逐设施容量信用）与 Reserve Capacity Information Pack 手工核对：2027-28 容量年新获容量信用的设施记为承诺，
预期 / 拟建按 ESOO 汇总口径与业主公告推断。`WEM-2026-ESOO-capacity-credits-2027-28.csv` 是从 Data Register 抽出的逐设施容量信用表；
ESOO 原件（附录 PDF 5 MB、Data Register 23 MB）体积大，不入库，刷新时从上述页面重新下载。
