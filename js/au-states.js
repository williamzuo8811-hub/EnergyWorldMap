// 澳洲各州 / 领地电网公司档案（window.AU_STATES）—— au.html 州卡片内容，非项目数据（不受 validate-data.js 约束）
// 键为州缩写 NSW / VIC / QLD / SA / WA / TAS / NT（首都领地 ACT 并入 NSW）。2026-10 调研 + 逐州反驳式核验，中文简体。字段：
//   grid / operator / summary / tnsp{name,owner,voltages,notes} / dnsps[{name,area,hq,owner,voltages,notes}] /
//   rezBody / rezs[] / policy / coalExit / keyProjects[{name,en,kv,status(规划|在建|投运),year,owner,desc}] /
//   vendor（设备商必读）/ tenderPortals[] / sources[]。
window.AU_STATES = {
  "NSW": {
    "abbr": "NSW",
    "name": "新南威尔士州（含首都领地 ACT）",
    "en": "New South Wales (incl. ACT)",
    "grid": "NEM（国家电力市场）NSW 区域（ACT 并入 NSW 定价区）",
    "operator": "AEMO（市场与系统运营）；Transgrid 为 NSW 输电规划主体；ASL（原 AEMO Services）为 NSW 路线图 Consumer Trustee 招标机构",
    "summary": "NSW 是 NEM 负荷最大的州，电力仍以四座燃煤电厂为主力（Eraring 2.88 GW、Bayswater 2.64 GW、Vales Point 1.32 GW、Mt Piper 1.4 GW，Liddell 已于 2023 年 4 月关停），风光、屋顶光伏、Snowy 水电与快速扩张的电池储能补足其余。《电力基础设施路线图》（EII Act 2020）锁定 2030 年前新增至少 12 GW 可再生 + 2 GW 长时储能，煤电 2029–2040 年梯次退出，但 EnergyCo 的 REZ 交付已明显滞后于预算（2026 年 9 月 ABC 报道两年少花近 A$10 亿）。电网资本开支由四条主线驱动：REZ 新建 500 kV 骨干（Central-West Orana / New England / South West）、州际互联（EnergyConnect / HumeLink / VNI West）、猎人—悉尼 500 kV 环网（Hunter Transmission Project）以及配网侧的区域变电站更新、SAPS、EV 与数据中心负荷接入。",
    "tnsp": {
      "name": "Transgrid",
      "owner": "NSW Electricity Networks 财团（99 年租约，2015-12 起）：CDPQ 24.99%、UTA（Utilities Trust of Australia，Morrison & Co 管理）20.02%、Tawreed Investments（ADIA）19.99%、OMERS 19.99%（2020 年接手 Wren House/KIA 股份）、Spark Infrastructure（KKR/OTPP/PSP 持有）15.01%",
      "voltages": "500/330/220/132 kV",
      "notes": "网络约 13,100 km 高压线路、104 座枢纽变电站，覆盖 NSW 与 ACT。AER 2023–28 监管期（2023-07 至 2028-06）核定总收入 A$48.5 亿；基础资本开支提案 A$26.07 亿被 AER 削减核定（终案较修订提案低 A$1.54 亿），HumeLink、VNI West、EnergyConnect 等大型项目作为 contingent project 另行核准（HumeLink Stage 2 于 2024-08 获批，VNI West Stage 1 早期工程 2024-05 获批）。2026-02 Transgrid 申请重开 2023–28 决定以上调 EnergyConnect NSW 段资本开支（预算已由 A$21 亿增至 A$38 亿），AER 2026-09-01 发布初步立场、程序仍在进行。旗舰项目：Project EnergyConnect（NSW 700 km 330 kV，2026-06 全线带电、2026 年底前完成 NEM 并网测试）、HumeLink（365 km 500 kV，东西两段均在建）、Waratah Super Battery SIPS 控制系统及 Bannaby–Sydney West / Yass–Marulan 线路增容（Sydney Ring 南段）、Hunter Transmission Project（HTP，与 EnergyCo 签署 Commitment Deed，2026 年内敲定 Network Operator 合同）、VNI West NSW 段（分两阶段，Stage 1 延伸 500 kV 至 Dinawan/South West REZ 目标 2029 年初）、South West REZ Jerilderie–Wagga Wagga 升级（2026-07 与 EnergyCo 签 Project Development Deed，解锁 3.56 GW）。"
    },
    "dnsps": [
      {
        "name": "Ausgrid",
        "area": "悉尼市区与东部/北部、中央海岸（Central Coast）、猎人谷（Newcastle / Lake Macquarie / Upper Hunter）",
        "hq": "Sydney",
        "owner": "NSW 政府 49.6% + IFM Investors / AustralianSuper / APG 财团 50.4%（99 年租约，2016 年）",
        "voltages": "132/33/11 kV",
        "notes": "NSW 最大配网。AER 2024–29 终案（2024-04-30）：A$30.69 亿资本开支提案未被全额接受，核定值介于草案 A$27.36 亿与提案之间（具体见 AER 附件 5）；Macquarie Park / Wallumatta 新建次输电变电站（A$1.47 亿）列为 contingent project。资本开支主题：区域变电站与 132/33 kV 次输电设备更新（公开的 SCS 项目主清单）、社区电池与 EV 负荷、数据中心接入、Hunter-Central Coast REZ 网络运营商（2024-12 签 Commitment Deed、2025-12 签 Project Development Deed，正制定 Access Scheme）。设备准入：Network Standard NS181 规定 Approved Materials List（AML）准入与标准变更申请流程，适用于非竞争性、竞争性（ASP）及外包项目；接入工程走 NSW ASP 制度（Level 1 施工 / Level 2 接户 / Level 3 设计），技术文件库 NS 系列公开。"
      },
      {
        "name": "Endeavour Energy",
        "area": "悉尼西部与西南部（含 Western Sydney Aerotropolis）、蓝山、Southern Highlands、Illawarra（Wollongong）、南海岸",
        "hq": "Parramatta（Sydney）",
        "owner": "NSW 政府 49.6% + Macquarie 领衔财团 50.4%（99 年租约，2017 年）",
        "voltages": "132/66/33/11 kV",
        "notes": "AER 2024–29 终案接受修订后资本开支 A$18.51 亿（2023–24 币值）；公司对外口径为五年 A$27 亿网络投资。资本开支主题：西悉尼增长走廊新建/重建区域变电站（Marayong 改建为户内站、Menangle Park 以永久站替换现役移动变电站等）、老旧 zone substation 设备到寿更新、Illawarra REZ（2025-05 与 EnergyCo 签 MoU，优先在既有配网走廊内升级并布局电池）、EV 与 Aerotropolis 负荷。设备准入：按 Endeavour 自身网络标准与核准材料清单执行，Level 1 ASP 竞争性工程指引 2026-03 更新，ASP 门户提供最新表格；移动变电站是其既有的负荷过渡手段。"
      },
      {
        "name": "Essential Energy",
        "area": "NSW 约 95% 国土面积的区域与乡村电网（北起 Qld 边界、南至 Vic 边界、西至 Broken Hill），含 Central-West Orana / New England / South West 三个 REZ 所在地区",
        "hq": "Port Macquarie",
        "owner": "NSW 政府 100%（州属公司）",
        "voltages": "132/66/33/22/11 kV + SWER",
        "notes": "AER 2024–29 终案接受修订后资本开支 A$26.55 亿（2023–24 币值，较草案高 1.9%），RAB 增长 A$6.99 亿。资本开支主题：最多 400 套受监管 SAPS（独立电源系统）替换偏远线路（2024-06 已装 2 套、27 套在设计），林火风险再分类 contingent project（2024-12 向 AER 申请追加收入，SAPS 可替代约 64 处 clear-to-sky 砍伐点），区域变电站与 66/33 kV 设备更新、REZ 周边配网增容、6 套便携式 SAPS 应急。设备准入：CEOM7004《Standard Contestable (Approved) Materials List》——ASP 只能使用清单内供应商的材料，替代材料仅在例外情形下经 Engineering 书面批准；External Sales 部门向 ASP 直供核准材料（AER 监管价）。供应商进入清单是进入 NSW 乡村配网的前提。"
      },
      {
        "name": "Evoenergy",
        "area": "首都领地 ACT 全境（Canberra）",
        "hq": "Canberra",
        "owner": "Icon Water（ACT 政府，经 ACTEW/Icon Distribution Investments）50% + Jemena（国家电网 60% / 新加坡电力 40%）50%，合营体 ActewAGL Distribution",
        "voltages": "132/66/11 kV",
        "notes": "AER 2024–29 终案核定资本开支 A$5.05 亿（提案 A$5.165 亿，扣除 A$0.14 亿 repex 上浮）；需求驱动增容提案 A$1.62 亿，较上期大幅上升。资本开支主题：ACT 全电气化政策（电采暖/交通替代燃气）带来的负荷增长、区域变电站与 11 kV 馈线扩容、EV 充电接入、132 kV 由 Transgrid 供电点。小型配网，采购走 Jemena 集团供应链与 ACT 政府采购规则。"
      }
    ],
    "rezBody": "EnergyCo（Energy Corporation of NSW）——依据 Electricity Infrastructure Investment Act 2020 任命的 Infrastructure Planner，负责 REZ 划定、接入方案（Access Scheme）、网络运营商招标；ASL（原 AEMO Services，Consumer Trustee）负责 LTESA 招标与 20 年投资目标报告；Transgrid 负责州级输电规划与 contingent project 申报。",
    "rezs": [
      "Central-West Orana REZ",
      "New England REZ",
      "South West REZ",
      "Hunter-Central Coast REZ",
      "Illawarra REZ"
    ],
    "policy": "《NSW Electricity Infrastructure Roadmap》（EII Act 2020，2023 年修订）法定目标：2030 年前新增至少 12 GW 可再生发电、2 GW 长时储能与 1 GW firming 容量，长时储能按 2023 年修法提升至 2034 年底前 28 GWh；《Climate Change (Net Zero Future) Act 2023》设定 2030 年减排 50%、2035 年 70%、2050 年净零。招标机制：ASL（AEMO Services）以 LTESA（长期能源服务协议）滚动招标——2023 年第 2 轮 firming 1,075 MW（含联邦 CIS 加码 550 MW，Liddell / Orana / Smithfield BESS 等）、2025-02 长时储能 1.03 GW/13.8 GWh（首个抽蓄）、2026-02 第 6 轮创纪录 1.17 GW/12 GWh 六个电池项目（累计签约 30 GWh，已达 2 GW/28 GWh 法定下限）；2026-05 启动 2.5 GW 发电 + 12 GWh 储能两项大标（储能结果 2026 年底揭晓）；ASL 2026 年 Firming Infrastructure Investment Objectives 报告指出 2033–34 年约 435 MW 可靠性缺口，计划 2027 年初启动约 1,500 MW firming 招标。州属投资主体：Energy Security Corporation（ESC，2024 年成立，A$10 亿种子资金，单笔 A$2,500 万–1.5 亿，2026-06 首投 A$1 亿支持 Plus Grid Storage 在悉尼/纽卡斯尔/中央海岸的 1 GW 电池平台）；NSW 无类似 SEC Victoria 的州属发电开发商。联邦 CIS：NSW 项目通过 CIS 全国轮次及与 LTESA 联合招标获得收入下限支持。海上风电：联邦已划定 Hunter（2024-07）与 Illawarra（2024-06）两个海上风电区，但 Hunter 唯一获可行性许可的 Novocastrian（Equinor/Oceanex，约 2 GW）已宣布放弃许可，Illawarra 区未发出任何许可、BlueFloat 2026-01 撤回申请——NSW 海上风电事实上停滞。本地化：Renewable Energy Sector Board Plan（2025-08 增补）对 LTESA、REZ 接入权与网络项目设定最低本地含量（如网络项目开发阶段 68%、风电 40%、光伏 49%）及 3% 原住民参与。",
    "coalExit": "Liddell（2,000 MW，AGL）2023-04 已关停。Eraring（2,880 MW，Origin，澳最大燃煤厂）：2024-05 州政府协议延至 2027-08，Origin 于 2026-01-20 宣布四台机组延至 2029-04（协议规定不得晚于 2029-04 关闭，州政府两年保底承诺 2027 年到期且不延长）。Vales Point（1,320 MW，Delta/Sev.en）由 2029 推迟至 2033。Bayswater（2,640 MW，AGL）维持 2033 关停（公司区间 2030–2033）。Mt Piper（1,400 MW，EnergyAustralia）名义 2040，为 NEM 最后一座煤电。NSW 能源部长不排除再度延迟；AEMO 2026 ISP 与 Transgrid/ASL 报告均将 2029–2033 视为 NSW 可靠性与电网交付的关键窗口。",
    "keyProjects": [
      {
        "name": "EnergyConnect NSW 段（Buronga—Wagga Wagga / Dinawan）",
        "en": "Project EnergyConnect (NSW section)",
        "kv": 330,
        "owner": "Transgrid（承包商 Elecnor Australia）",
        "status": "在建",
        "year": 2027,
        "desc": "700 km 330 kV 跨州互联 NSW 段，含 Dinawan 新建 500/330 kV 变电站；2026-06 全线带电，正进行 AEMO 跨网测试、2026 年底并入 NEM，800 MW 全容量预计 2027 年底可用；预算由 A$21 亿增至 A$38 亿，Transgrid 已申请重开监管决定。"
      },
      {
        "name": "HumeLink 500kV 输电工程",
        "en": "HumeLink",
        "kv": 500,
        "owner": "Transgrid（East: Acciona/Genus JV；West: UGL/CPB 等）",
        "status": "在建",
        "year": 2027,
        "desc": "约 365 km 500 kV 线路连接 Wagga Wagga、Bannaby 与 Maragle（Snowy 2.0 出线），新建 Gugaa、Maragle 500 kV 变电站并升级 Wagga 330 kV 站；2026 年东西两段均进入直升机架线高峰，AER 原定东段 2026-07 / 西段 2026-12 完工目标面临后延。"
      },
      {
        "name": "Central-West Orana REZ 500kV 输电网",
        "en": "Central-West Orana REZ Transmission Network",
        "kv": 500,
        "owner": "ACEREZ（Acciona / Cobra / Endeavour Energy），EnergyCo 规划",
        "status": "在建",
        "year": 2028,
        "desc": "澳大利亚首个 REZ 骨干网：约 240 km 500/330 kV 线路（Elong Elong—Merotherie—Barigan Creek）及 Merotherie 等能源枢纽，初期 4.5 GW 接入（已授予 10 个项目 7.15 GW 接入权）；2026-09 已立塔 64 基并开始架线，目标 2028 年起带电（AER 窗口 2028-11 至 2030-04）。"
      },
      {
        "name": "猎人输电工程 (Hunter Transmission Project, Bayswater—Olney)",
        "en": "Hunter Transmission Project (HTP)",
        "kv": 500,
        "owner": "Transgrid（Network Operator，与 EnergyCo 签 Commitment Deed）",
        "status": "规划",
        "year": 2029,
        "desc": "110 km 500 kV 新线连接 Bayswater 与 Olney，构成猎人—悉尼环网北段，把 CWO 与 New England REZ 电力送入悉尼—纽卡斯尔负荷中心；2026-07-28 获 NSW 规划批准，联邦 EPBC 待批，线路与变电站两个标段已短名单，早期工程 2026 年底、主体施工 2027 年、目标 2029 年投运，是 Waratah SIPS 退出前的关键替代。"
      },
      {
        "name": "VNI West NSW 段（Dinawan—维州边界）",
        "en": "VNI West (NSW section)",
        "kv": 500,
        "owner": "Transgrid",
        "status": "规划",
        "year": 2030,
        "desc": "维州—NSW 西部 500 kV 互联；Transgrid 改为分阶段交付，Stage 1 延伸 500 kV 至 Dinawan/South West REZ 目标 2029 年初，Stage 2 Dinawan—边界与维州侧（TCV 延至 2030-11）同步；项目审批预计 2026 年底。"
      },
      {
        "name": "Waratah 超级电池与 SIPS 系统保护方案",
        "en": "Waratah Super Battery + SIPS",
        "kv": 330,
        "owner": "Akaysha Energy（电池）/ Transgrid（SIPS 控制系统）",
        "status": "投运",
        "year": 2026,
        "desc": "850 MW/1,680 MWh（Munmorah 旧煤电厂址），作为“电网减震器”为 Transgrid 提供 700 MW 级 SIPS 服务以提高悉尼走廊输送能力；2025-10 变压器故障后 2026-09-07 恢复 850 MW 满功率并进入商业运行，SIPS 将持续至 HTP 2029 年建成。"
      },
      {
        "name": "New England REZ 500kV 输电网",
        "en": "New England REZ Network Infrastructure Project",
        "kv": 500,
        "owner": "EnergyCo（网络运营商招标中：Future Energy Networks / NewLeaf Energy / Verta Energy 三家短名单）",
        "status": "规划",
        "year": 2032,
        "desc": "约 290 km 500 kV + 25 km 330 kV 线路及 5 座能源枢纽，一二期合计 6 GW、三期再加 2 GW；2026-02 提交联邦 EPBC 申报，2026-05 走廊优化并宣布 A$6,000 万社区收益；AEMO 2026 ISP 列为 actionable，目标 2032 年带电。"
      },
      {
        "name": "South West REZ Jerilderie—Wagga Wagga 电网升级",
        "en": "South West REZ Transmission Upgrade (Jerilderie–Wagga Wagga)",
        "owner": "Transgrid / EnergyCo",
        "status": "规划",
        "year": 2030,
        "desc": "2026-07-21 EnergyCo 与 Transgrid 签署 Project Development Deed，升级 Jerilderie—Wagga Wagga 关键区段以释放 South West REZ 3.56 GW 接入容量，与 EnergyConnect Dinawan 站及 VNI West Stage 1 衔接，目标 2030 年前完成。"
      },
      {
        "name": "Hunter-Central Coast REZ 网络工程",
        "en": "Hunter-Central Coast REZ",
        "kv": 132,
        "owner": "Ausgrid（Network Operator）/ EnergyCo",
        "status": "规划",
        "year": 2028,
        "desc": "以 Ausgrid 既有 132 kV 次输电网为基础的城市型 REZ，2024-12 签 Commitment Deed、2025-12 签 Project Development Deed，EnergyCo 正制定接入方案，第三方时间表预计 2028 年底完成建设。"
      },
      {
        "name": "Snowy 2.0 抽水蓄能",
        "en": "Snowy 2.0 Pumped Hydro",
        "owner": "Snowy Hydro（联邦国企）",
        "status": "在建",
        "year": 2028,
        "desc": "2,200 MW / 350 GWh 抽蓄，2026-03 完成 73%、已花费 A$111 亿（2023 年重置预算 A$120 亿，成本再评估尚未公布），目标 2028 年底全部机组商运，经 HumeLink/Maragle 500 kV 并网。"
      }
    ],
    "vendor": "在 NSW 卖中高压设备首先要进入各 NSP 的核准材料体系：Ausgrid 以 NS181 规定 Approved Materials List 准入与标准变更申请，Essential Energy 以 CEOM7004 核准材料清单约束 ASP 只能用清单内供应商，Endeavour Energy 与 Evoenergy 各有网络标准与核准清单，Transgrid 则通过供应商预审与型式试验报告（IEC/AS 62271、AS 60076、AS/NZS 61439、AS 2067 变电站设计、AS/NZS 3000、AS/NZS 7000 架空线）审核——没有型式认可，再好的价格也进不了 DNSP 的采购单。预制变电站 / E-house 作为“建筑物”要满足 NCC（National Construction Code）与 AS/NZS 1170 系列结构荷载（NSW 内陆为风区 A、北部海岸局部 B，无需 C/D 气旋等级），林火易发区须按 AS 3959 评定 BAL 等级并在 Essential Energy 等林火再分类区域满足网络防火要求；低压侧还需符合 AS/NZS 3000 与 AS/NZS 61439 的澳标认证（RCM/EESS 适用品类）。本地化方面 NSW 没有维州 Local Jobs First 那样的法定本地含量法，但 Renewable Energy Sector Board Plan（2025-08 增补）为 LTESA、REZ 接入权与网络项目设定了最低本地含量（网络项目开发期 68%）和 3% 原住民参与，EnergyCo 项目还须执行 NSW Procurement Policy Framework、SME & Regional Procurement Policy 与 Aboriginal Procurement Policy，联邦 A$5 亿以上项目另需 Australian Industry Participation 计划——海外厂商通常需与 ICN Gateway 注册的本地集成/安装伙伴组队并提供本地化装配与售后方案。接入施工必须由 NSW Fair Trading 持牌电工承包商且在 NSW ASP 制度下取得 Level 1/2/3 认证才能从事竞争性工程，设备供应商自身无需 ASP 资质但需配合 ASP 与 DNSP 的验收流程。真正的买家分四类：TNSP/DNSP（框架协议与 contingent 项目，走 Transgrid/Ausgrid/Endeavour/Essential 的采购门户）、输电 EPC（Elecnor、Acciona/Genus、UGL/CPB、Downer、Zinfra、Beon、GenusPlus、Consolidated Power Projects）、REZ 内的风光储开发商与 BESS 运营商（Akaysha、Origin、AGL、Iberdrola、Plus Grid Storage 等 LTESA 中标方对预制变电站、MV 开关柜与储能撬块需求集中），以及悉尼西部数据中心与矿业（Hunter 煤矿、Cadia 等）客户；移动变电站与 SAPS 则是 Endeavour / Essential 2024–29 期的明确采购主题。",
    "tenderPortals": [
      "buy.nsw / NSW eTendering（州政府与 EnergyCo 招标）：https://www.tenders.nsw.gov.au",
      "ICN Gateway（本地供应商注册，EnergyCo 与 REZ 项目首选供应链平台）：https://gateway.icn.org.au",
      "ASL（原 AEMO Services）LTESA / CIS 联合招标：https://asl.org.au",
      "EnergyCo NSW 项目与采购信息：https://www.energyco.nsw.gov.au/our-projects",
      "Transgrid 供应商与项目信息：https://www.transgrid.com.au",
      "Ausgrid ASP 与承包商技术文件库（NS181 AML）：https://www.ausgrid.com.au/asp-and-contractors/technical-document-library/ns181",
      "Essential Energy Level 1 ASP 门户（CEOM7004 核准材料清单通知）：https://engage.essentialenergy.com.au/level1asp",
      "Endeavour Energy（ASP 指引与网络标准）：https://www.endeavourenergy.com.au",
      "NSW ASP 制度与竞争性工程（DCCEEW NSW）：https://www.energy.nsw.gov.au/nsw-plans-and-progress/regulation-and-policy/asp-scheme-and-contestable-works/asp-scheme-frequently",
      "ACEREZ（CWO REZ 网络运营商）：https://www.acerez.com.au/",
      "联邦 Australian Industry Participation（AIP）计划：https://www.industry.gov.au"
    ],
    "sources": [
      "https://www.aer.gov.au/system/files/AER%20-%20Transgrid%202023-28%20-%20Final%20Decision%20-%20Overview%20-%20April%202023_1.pdf",
      "https://www.aer.gov.au/industry/registers/determinations/transgrid-determination-2023-28",
      "https://www.aer.gov.au/system/files/AER%20-%20Transgrid%202023-28%20-%20Final%20Decision%20-%20Attachment%205%20Capital%20expenditure%20-%20April%202023.pdf",
      "https://en.wikipedia.org/wiki/Transgrid",
      "https://www.adia.ae/en/investments/infrastructure/portfolio/case-studies/transgrid",
      "https://www.aer.gov.au/system/files/2024-04/AER%20-%20Final%20Decision%20-%20Overview%20-%20Endeavour%20Energy%20-%202024%E2%80%9329%20Distribution%20revenue%20proposal%20-%20April%202024.pdf",
      "https://www.aer.gov.au/system/files/2024-04/AER%20-%20Final%20Decision%20-%20Overview%20-%20Essential%20Energy%20-%202024%E2%80%9329%20Distribution%20revenue%20proposal%20-%20April%202024.pdf",
      "https://www.aer.gov.au/system/files/2024-04/AER%20-%20Final%20Decision%20Attachment%205%20-%20Capital%20expenditure%20-%20Ausgrid%20-%202024%E2%80%9329%20Distribution%20revenue%20proposal%20-%20April%202024_0.pdf",
      "https://www.aer.gov.au/system/files/2024-04/AER%20-%20Final%20Decision%20Attachment%205%20-%20Capital%20expenditure%20-%20Evoenergy%20-%202024%E2%80%9329%20%20Distribution%20revenue%20proposal%20-%20April%202024.pdf",
      "https://www.aer.gov.au/industry/registers/determinations/evoenergy-actewagl-determination-2024-29",
      "https://www.ifminvestors.com/news-and-insights/media-centre/six-million-australians-to-invest-in-ausgrid-as-ifm-investors-and-australiansuper-acquire-a-majority-stake/",
      "https://www.aer.gov.au/system/files/Ausgrid%20-%20RIN.09%20-%20Related%20party%20transactions%20%20-%2031%20Jan%202023%20-%20Public.pdf",
      "https://www.ausgrid.com.au/asp-and-contractors/technical-document-library/ns181",
      "https://engage.essentialenergy.com.au/level1asp/news_feed/reminder-only-use-materials-from-suppliers-listed-in-ceom7004-standard-contestable-approved-materials-list-on-essential-energy-s-network",
      "https://www.essentialenergy.com.au/ext/ar2024/pdf/Essential-Energy_Annual-Report_2023-24.pdf",
      "https://www.aer.gov.au/industry/networks/contingent-projects/essential-energy-bushfire-risk-reclassification-contingent-project",
      "https://www.endeavourenergy.com.au/in-the-community/works-in-your-area/menangle-park-zone-substation-upgrade",
      "https://www.endeavourenergy.com.au/community/works-in-your-area/marayong-zone-substation",
      "https://www.energy.nsw.gov.au/nsw-plans-and-progress/regulation-and-policy/asp-scheme-and-contestable-works/asp-scheme-frequently",
      "https://www.energyco.nsw.gov.au/about-us/electricity-infrastructure-roadmap",
      "https://www.abc.net.au/news/2026-09-16/nsw-renewable-energy-zone-delays-2030-energy-targets/107100712",
      "https://www.nsw.gov.au/media-releases/nsw-government-secures-two-year-extension-to-eraring-power-station",
      "https://www.miningweekly.com/article/origin-energy-to-extend-operations-of-nsw-coal-fired-power-plant-to-2029-2026-01-20",
      "https://reneweconomy.com.au/vales-point-coal-closure-date-pushed-back-four-years-in-latest-threat-to-renewables-transition/",
      "https://reneweconomy.com.au/last-coal-generator-in-australias-biggest-grid-will-be-managed-out-earlier-than-you-think/",
      "https://utilitymagazine.com.au/energyconnect-reaches-major-milestone-as-final-nsw-section-energised/",
      "https://www.energymagazine.com.au/when-will-energyconnect-be-fully-energised-in-the-nem/",
      "https://reneweconomy.com.au/not-easy-australias-biggest-transmission-project-energised-after-delays-and-cost-overruns/",
      "https://www.pv-magazine-australia.com/2026/07/02/humelink-west-stringing-of-transmission-tower-conductors-begins/",
      "https://www.transgrid.com.au/media/izedvkkb/humelink-west-quarterly-newsletter-september-2026.pdf",
      "https://www.aer.gov.au/system/files/2024-08/AER%20-%20Determination%20-%20Transgrid%20HumeLink%20Stage%202%20Contingent%20Project%20-%20August%202024.pdf",
      "https://www.acciona.com.au/updates/news/humelink-east-marks-major-milestone-with-start-of-helicopter-stringing",
      "https://utilitymagazine.com.au/transmission-line-underway-at-central-west-orana-rez",
      "https://www.aer.gov.au/industry/registers/determinations/main-central-west-orana-renewable-energy-zone-network-project-contestable",
      "https://www.energyco.nsw.gov.au/our-projects/central-west-orana-renewable-energy-zone",
      "https://www.transgrid.com.au/projects-innovation/hunter-transmission-project/",
      "https://energyco.nsw.gov.au/our-projects/hunter-transmission-project/hunter-transmission-project-frequently-asked-questions",
      "https://theconnectionpoint.au/networks/hunter-transmission-ladder/",
      "https://www.transgrid.com.au/projects-innovation/vni-west/",
      "https://utilitymagazine.com.au/a-big-year-of-energy-goals-and-an-even-bigger-one-to-come/",
      "https://www.pv-magazine-australia.com/2026/07/21/deal-sealed-to-unlock-3-56-gw-capacity-in-nsw-renewable-energy-zone/",
      "https://energyco.nsw.gov.au/our-projects/hunter-central-coast-rez",
      "https://www.energyco.nsw.gov.au/our-projects/illawarra-rez",
      "https://www.endeavourenergy.com.au/about-us/newsroom/powering-the-future-of-the-illawarra",
      "https://www.pv-tech.org/australia-energyco-seeks-federal-approval-for-6gw-new-england-rez-transmission-backbone-spanning-315km/",
      "https://www.pv-tech.org/energyco-shortlists-three-consortia-for-new-england-rez-network-operator-tender-in-new-south-wales-australia/",
      "https://www.hitachienergy.com/news-and-events/press-releases/2026/09/waratah-super-battery-reaches-full-capacity-australia-hitachi",
      "https://www.transgrid.com.au/projects-innovation/waratah-super-battery-enabling-works/",
      "https://www.energy-storage.news/akaysha-energys-waratah-super-battery-in-australia-returns-to-700mw-as-transformer-2-comes-back-online/",
      "https://asl.org.au/news/media-release/260205-asl-nsw-roadmap-tender-6-outcomes-announced",
      "https://asl.org.au/news/media-release/250227-asl-nsw-long-duration-storage-tender-awards-more-than-1gw-and-13gwh",
      "https://aemoservices.com.au/en/news/media-release/231122-nsw-tender-for-firming-capacity-exceeds-expectations",
      "https://www.energy-storage.news/australias-asl-opens-consultation-on-1-5gw-firming-tender-as-post-coal-reliability-gaps-appear-in-new-south-wales/",
      "https://www.energy-storage.news/australias-new-south-wales-seeks-2-5gw-of-generation-and-12gwh-of-energy-storage-in-states-largest-ever-tender/",
      "http://www.pv-magazine-australia.com/2026/06/16/nsws-1-billion-green-bank-backs-big-batteries-with-first-investment/",
      "https://www.energy.nsw.gov.au/nsw-plans-and-progress/government-strategies-and-frameworks/energy-security-corporation",
      "https://www.energy.nsw.gov.au/sites/default/files/2025-08/renewable-energy-sector-board-plan-addendum.pdf",
      "https://www.ipart.nsw.gov.au/sites/default/files/cm9_documents/Annual-Report-from-Infrastructure-Planner-%28Energy-Co%29.PDF",
      "https://nsw.icn.org.au/casestudy/EnergyCo",
      "https://www.dcceew.gov.au/energy/renewable/offshore-wind/areas/illawarra",
      "https://reneweconomy.com.au/global-wind-giant-pulls-plug-on-australias-first-floating-wind-project/",
      "https://alisonbyrnesmp.com.au/media-centre/media-releases/joint-statement-on-the-illawarra-offshore-wind-zone/",
      "https://www.anao.gov.au/work/performance-audit/delivery-of-snowy-two-point-zero",
      "https://www.abc.net.au/news/2026-02-02/snowy-hydro-project-timeline-defend-machine-cost-blowout/106231224"
    ]
  },
  "VIC": {
    "abbr": "VIC",
    "name": "维多利亚州",
    "en": "Victoria",
    "grid": "NEM（国家电力市场）VIC1 区域；经 Heywood 275 kV 交流与 Murraylink HVDC 连 SA，经 Dederang—Murray 330 kV（既有 VNI）连 NSW，经 Basslink HVDC（500 MW，APA；AER 2026-02-27 终案核定 2026–30 年收入后，自 2026-07-01 起由市场型联络线转为受监管联络线）连 TAS；Marinus Link 一期在建、VNI West 规划中",
    "operator": "AEMO（NEM 市场与系统运营；依据 National Electricity (Victoria) Act 2005 长期担任维州 declared shared network 的规划与增容采购主体，大型增容可竞争性交付）；VicGrid（DEECA 下设，2024 年立法后接手 REZ 划定、Victorian Transmission Plan、接入方案与社区收益，并自 2025 年起接管原 AEMO 子公司 Transmission Company Victoria 的职能、负责 VNI West 维州段交付）；AusNet 为输电网业主与运营商；Energy Safe Victoria（ESV）为电气安全监管、Essential Services Commission（ESC）为州级配网规范监管",
    "summary": "维州电力仍以 Latrobe Valley 三座褐煤电厂为主力（Yallourn 1.48 GW、Loy Yang A 2.21 GW、Loy Yang B 约 1.1 GW，Hazelwood 已于 2017 年关停），风电（西维州与 Murray 区）、屋顶与集中式光伏、Kiewa/Dartmouth 水电、燃气调峰及快速扩张的大电池（Victorian Big Battery 300 MW、Melbourne Renewable Energy Hub 600 MW/1.6 GWh 等）补足其余。法定目标为 2030 年 65%、2035 年 95% 可再生，储能 2030 年 2.6 GW / 2035 年 6.3 GW，海上风电 2032 年 2 GW / 2035 年 4 GW / 2040 年 9 GW，Yallourn 2028-06 关停、Loy Yang A 2035 关停，由州属 SEC Victoria 与 VicGrid 的 REZ/输电规划托底。电网资本开支由四条主线驱动：西部 500 kV 骨干（Western Renewables Link）与州际互联（VNI West、Marinus Link）、Gippsland 海上风电陆上送出与 Latrobe Valley 500 kV 枢纽改造、配网侧的 REFCL 林火安全与风暴韧性、以及燃气替代（电气化）、EV 和墨尔本西部数据中心带来的负荷增长。",
    "tnsp": {
      "name": "AusNet（AusNet Services，输电业务 AusNet Transmission Group）",
      "owner": "Brookfield 牵头财团（Brookfield、Australian Retirement Trust、AIMCo、HOOPP、IMCO 等），2022-02 以约 A$102 亿股权对价完成私有化；原股东 Singapore Power（31.1%）与中国国家电网（19.9%）在该交易中全部退出（本地数据集 id 4104 仍记国网持股 19.9%，为过时记录）",
      "voltages": "500/330/275/220/66 kV",
      "notes": "维州唯一 TNSP，约 6,500 km 线路、50 余座 terminal station，覆盖全州；输电与配电、燃气三网同属 AusNet。监管期按 4 月起算：2022–27 期（2022-04-01 至 2027-03-31）由 AER 2022-01 终案核定；2027–32 期收入提案已于 2025-10 提交 AER，草案预计 2026 年下半年、终案 2027 年初——本次离线编制未能核验两期的收入/资本开支核定数，请以 AER 决定页为准。与 NSW 不同，维州大型增容不走 AusNet 的 contingent project 路径，而是由 AEMO/VicGrid 规划后竞争性采购（AusNet 可作投标方），因此 AusNet 受监管资本开支以既有资产更新为主：500/220 kV 断路器、变压器与保护控制到寿更换，Hazelwood / Loy Yang / Moorabool / Keilor / South Morang / Sydenham 等枢纽站改造，系统安全与通信更新。旗舰项目：Western Renewables Link（Bulgana—Sydenham 约 190 km 500 kV，AusNet 开发，2026-09 EES 评估获批、独立成本评估中，待最终规划与 EPBC 审批）、Elaine 500 kV 终端站（接入 Golden Plains 1.33 GW 风场）、Moorabool 500/220 kV 站扩建（Victorian Big Battery 等接入）、Latrobe Valley 500 kV 枢纽为海上风电与储能接入的改造；AusNet 亦是 VNI West 维州段、Marinus Link 陆上段等竞争性工程的潜在承包/运维方。"
    },
    "dnsps": [
      {
        "name": "AusNet（配电，AusNet Electricity Services）",
        "area": "维州东部与东北部：Gippsland（Latrobe Valley、Sale、Bairnsdale 至 Mallacoota）、Hume / 东北（Wodonga、Wangaratta、高原区）及墨尔本外北与外东郊（Whittlesea、Craigieburn、Doncaster、Ringwood、Lilydale）",
        "hq": "Melbourne（Southbank）",
        "owner": "Brookfield 牵头财团（与输电同一股东）",
        "voltages": "66/22/11/6.6 kV + 12.7 kV SWER",
        "notes": "约 80 万用户、维州面积最大的两个配网之一，林火与风暴风险最高（2009 年黑色星期六、2019–20 东 Gippsland 山火、2024-02 Mirboo North 风暴）。2026–31 EDPR（2026-07-01 至 2031-06-30）：AER 2025-09 草案、2026-04 终案——核定资本开支数字本次未核验，见 AER 决定页。资本开支主题：风暴/林火韧性计划（覆盖导线、Early Fault Detection、社区微电网与电池如 Mallacoota）、REFCL 三批已建成后的 22 kV 设备 REFCL 兼容化改造与运维、SAPS 在 Gippsland 偏远 SWER 线路的替代应用、66/22 kV 区域变电站到寿更新、墨尔本北部增长走廊（Wollert、Donnybrook、Mickleham、Pakenham 东）新建区域变电站、燃气替代电气化与 EV 负荷、Latrobe Valley 新负荷（储能、氢能、Energy Security Precinct）。设备准入：AusNet 公开的 Electricity Distribution 网络标准系列 + 核准设备清单，新产品需型式试验报告与试用评估后入册，竞争性工程承包商须用清单设备；接户按 Victorian Service & Installation Rules（VSIR）。移动变电站是其区域变电站改造与应急供电的既有手段。"
      },
      {
        "name": "CitiPower",
        "area": "墨尔本 CBD 与内城区（约 157 km²：Docklands、Southbank、Port Melbourne/Fishermans Bend、Carlton、Richmond、St Kilda、Brunswick 等）",
        "hq": "Melbourne（40 Market Street，与 Powercor / United Energy 共用）",
        "owner": "Victoria Power Networks：CK Infrastructure / Power Assets（长江基建系）51% + KKR–OTPP–PSP 财团（原 Spark Infrastructure，2021 年私有化）49%",
        "voltages": "66/22/11/6.6 kV（CBD 以地下电缆为主）",
        "notes": "约 35 万用户、负荷密度全澳最高，与 Powercor、United Energy 共用管理层、技术标准库与自有施工公司 Beon Energy Solutions。2026–31 EDPR 终案 AER 2026-04-30 发布（核定收入约 A$20.39 亿）。资本开支主题：CBD 高层与数据中心/商业负荷增长（Fishermans Bend 城市更新新建区域变电站、Docklands 与 CBD 北区增容）、6.6 kV 向 11/22 kV 升压改造、地下电缆与开关站到寿更新、Brunswick 等终端站配套 66 kV 扩容、EV 与公共充电、社区电池。设备准入：CitiPower/Powercor/UE 三网统一的 Technical Standards 与核准材料/设备清单，新产品经产品评估（AS/IEC 型式试验 + 现场试用）后进入清单，第三方承包商（Registered Electrical Contractor / 认可施工方）只能用清单设备；主变长期由本地 Wilson Transformer 等框架供货。"
      },
      {
        "name": "Powercor",
        "area": "维州西部与西南部（约 15 万 km²）：墨尔本西郊增长走廊（Werribee、Melton、Tarneit、Truganina、Sunbury 以西）、Geelong、Ballarat、Bendigo、Warrnambool、Horsham、Mildura 直至 SA 边界，含 Wimmera Southern Mallee / North West / South West / Central Highlands 等 REZ 所在地",
        "hq": "Melbourne（40 Market Street），区域中心 Geelong / Ballarat / Bendigo / Warrnambool",
        "owner": "Victoria Power Networks：CK Infrastructure / Power Assets 51% + KKR–OTPP–PSP 财团（原 Spark Infrastructure）49%",
        "voltages": "66/22 kV + 12.7 kV SWER（部分 6.6/11 kV）",
        "notes": "约 93 万用户、维州面积最大配网，承担 REFCL 计划最大份额（Rapid Earth Fault Current Limiter，依据 Electricity Safety (Bushfire Mitigation) Regulations 在 codified areas 的 22 kV 区域变电站加装，三批 2023 年前建成），并执行州 Powerline Replacement Fund 的高风险线路覆盖/地埋改造。2026–31 EDPR 终案 AER 2026-04-30 发布（核定收入约 A$53.35 亿）。资本开支主题：墨尔本西部增长走廊新建区域变电站与 66 kV 环网、Truganina / Derrimut / Laverton 数据中心集群（AirTrunk MEL2 等）与大型物流负荷接入、西维州与 Murray 区风光储 66 kV 接入及出口受限管理（flexible exports）、SWER 线路以 SAPS 替代、老旧 66/22 kV 区域变电站与断路器更新、Early Fault Detection 与林火韧性、燃气替代与 EV。移动变电站（自有 66/22 kV 单元）是其区域变电站重建与应急供电的常规手段。设备准入：与 CitiPower/UE 共用的 Technical Standards 与核准设备清单，REFCL 区域的 22 kV 设备（变压器、避雷器、电缆附件、开关设备绝缘等级）必须满足健全相对地电压升至线电压的 REFCL 兼容要求——这是维州区别于其他州的核心技术门槛；施工以自有 Beon 为主。"
      },
      {
        "name": "Jemena Electricity Networks（JEN）",
        "area": "墨尔本西北部（约 950 km²）：Melbourne Airport / Tullamarine、Sunbury、Broadmeadows、Essendon、Footscray、Yarraville、Williamstown、Altona 部分",
        "hq": "Melbourne（CBD）",
        "owner": "SGSP (Australia) Assets：中国国家电网（State Grid）60% + Singapore Power 40%",
        "voltages": "66/22/11/6.6 kV",
        "notes": "约 39 万用户，维州五网中最小但负荷增长最快之一（机场扩建与航空物流、Sunbury 增长走廊、西部内城区更新与数据中心）。2026–31 EDPR 终案 AER 2026-04-30 发布（核定收入约 A$20 亿）。资本开支主题：Tullamarine/机场精密负荷与数据中心接入、6.6 kV 向 22 kV 升压与老旧内城区区域变电站更新、Sunbury/Bulla 新建区域变电站、REFCL 区域（Sunbury 周边）设备兼容化、社区电池与 EV、Brooklyn/Tottenham 工业区增容。施工与运维长期由同集团 Zinfra 以框架方式承担；设备准入按 Jemena 电气设备技术规格与核准产品清单（型式试验 + 产品评估）。股东为国家电网，是中国设备商最可能建立集团级对接的维州 DNSP（对应本库 CLIENT_META 的 sgid 第二梯队客户）。"
      },
      {
        "name": "United Energy",
        "area": "墨尔本东南部与 Mornington Peninsula（约 1,470 km²）：Dandenong、Frankston、Mornington、Cranbourne、Mount Waverley、Bayside、Monash 等",
        "hq": "Melbourne（40 Market Street，与 CitiPower / Powercor 共用；运营中心 Mount Waverley）",
        "owner": "CK Infrastructure / Power Assets 66% + KKR–OTPP–PSP 财团（原 Spark Infrastructure）34%",
        "voltages": "66/22/11/6.6 kV",
        "notes": "约 72 万用户，由 CitiPower/Powercor 统一管理。2026–31 EDPR 终案 AER 2026-04-30 发布（核定收入约 A$23.19 亿）。资本开支主题：Dandenong South 工业区与数据中心/物流负荷接入、Cranbourne/Clyde 增长走廊新建区域变电站、Mornington Peninsula 风暴韧性与 Dandenong Ranges 林火区（REFCL codified area）设备兼容化、老旧 66/22 kV 区域变电站与开关站更新、6.6 kV 升压、社区/杆上电池（UE 为澳洲杆上电池先行者）、EV 与屋顶光伏出口管理。设备准入与框架合同与 CitiPower/Powercor 一致（共用 Technical Standards、核准清单与 Beon 施工）。"
      }
    ],
    "rezBody": "VicGrid（维州能源、环境与气候行动部 DEECA 下设）——2023 年成立，2024 年 National Electricity (Victoria) Amendment (VicGrid) 立法赋权，负责 Victorian Transmission Plan（首版 2025 年发布，每 4 年更新）、REZ 划定与接入方案（REZ access scheme）、社区收益与土地主补偿（输电走廊每 km 每年 A$8,000）、Gippsland 海上风电陆上输电规划，并自 2025 年起接管 Transmission Company Victoria 职能、负责 VNI West 维州段交付；AEMO 继续担任系统运营与 declared network 既有增容采购；AusNet 负责既有网络更新。",
    "rezs": [
      "Central Highlands REZ",
      "Central North REZ",
      "Gippsland REZ",
      "North West REZ",
      "South West REZ",
      "Wimmera Southern Mallee REZ",
      "Gippsland offshore wind declared area（联邦划定，2022-12）"
    ],
    "policy": "《Climate Change and Energy Legislation Amendment (Renewable Energy and Storage Targets) Act 2024》法定：可再生占比 2025 年 40%、2030 年 65%、2035 年 95%；储能 2030 年 2.6 GW、2035 年 6.3 GW；海上风电 2032 年 2 GW、2035 年 4 GW、2040 年 9 GW；2045 年净零（2035 年较 2005 年减排 75–80%）。州属开发商 SEC Victoria（2023 年重建，A$10 亿启动资本，目标到 2035 年参与 4.5 GW 新增可再生与储能，并经营家庭电气化业务）：首投 Melbourne Renewable Energy Hub（600 MW/1.6 GWh，与 Equis，2025 年投运）、自主开发 SEC Renewable Energy Park Horsham（119 MW 光伏 + 100 MW/200 MWh，在建）、Gippsland Fulham 光储（与 Octopus）。招标机制：VRET1/VRET2 拍卖（2017 / 2022）已完成；Renewable Energy Zone Fund A$5.4 亿；维州参与联邦 CIS（2023-12 首轮 SA/VIC 600 MW 可调度容量试点及其后全国轮次）；海上风电首轮支持合同（目标 2032 年前 2 GW，Gippsland 区已发 12 个联邦可行性许可）由 VicGrid/DEECA 推进中，中标结果本次未核验；Port of Hastings 海上风电码头联邦 EPBC 2024-01 被否后重新设计申报。燃气替代路线图（Gas Substitution Roadmap，新建住宅 2024 年起不接天然气）推动家庭/商业电气化，是配网负荷增长主因。政治：Allan 工党政府执政，2026-11-28 州选举——工党坚持 Yallourn 2028 关停与 95% 目标，反对党主张延长煤电与增加燃气，选举结果可能影响 2027 年后政策。本地化：Local Jobs First Act 2003 适用于政府项目（都市 ≥A$300 万、区域 ≥A$100 万，Strategic Projects ≥A$5,000 万由部长设定最低本地含量），SEC 投资、VRET 拍卖与 VicGrid 输电项目均附带本地含量条款。",
    "coalExit": "Hazelwood（1,600 MW，ENGIE）2017-03 已关停；Anglesea（Alcoa，150 MW）2015 关停。在运三座褐煤厂均在 Latrobe Valley：Yallourn（1,480 MW，EnergyAustralia）2028-06-30 关停（2021 年与州政府协议由 2032 提前，2025–26 年公司与政府多次重申不延期，替代为 Wooreen 350 MW/1.4 GWh 电池与 Yallourn Energy Security Precinct）；Loy Yang A（2,210 MW，AGL）2035 关停（AGL 2022-09 由 2045 提前，AEMO 2026 ESOO 采用）；Loy Yang B（约 1,100 MW，Alinta/Sembcorp，2026-06 完成收购）名义 2047，业主称无提前关停计划但将建同步调相机与储能——与 2035 年 95% 可再生目标隐含的更早退出之间的矛盾是维州最大不确定项。2028 年 Yallourn 全厂同时退出是 NEM 最大一次退役，AEMO 已列为维州可靠性缺口来源；2026–28 是 Latrobe Valley 储能升压、500 kV 枢纽改造与矿区复垦配电的招标窗口。",
    "keyProjects": [
      {
        "name": "VNI West 维州段（Bulgana—Kerang—NSW 边界）500kV",
        "en": "VNI West (Victorian section)",
        "kv": 500,
        "owner": "VicGrid（维州段，2025 年起接管 AEMO 子公司 Transmission Company Victoria 的交付职能）/ Transgrid（新州段）",
        "status": "规划",
        "year": 2030,
        "desc": "维州—NSW 西部 500 kV 互联维州段，约 240 km 双回，新建 Kerang 500 kV 站并接 Bulgana（WRL 西端），与 NSW 段 Dinawan 衔接，大幅提升维州—NSW 双向输送能力并接入 North West / Wimmera 区风光；维州段完工目标推迟至 2030-11，早期工程推进中（2025-11 VicGrid 选定 Iberdrola Australia 为开发伙伴，负责设计、采购与 EES 审批，达标后可获建设—持有—运营授权）。"
      },
      {
        "name": "西部可再生能源链路 (Western Renewables Link, Bulgana—Sydenham)",
        "en": "Western Renewables Link",
        "kv": 500,
        "owner": "AusNet",
        "status": "规划",
        "year": 2029,
        "desc": "约 190 km 500 kV 双回（Bulgana—Ballarat 北—Sydenham），新建 Ballarat 北 500/220 kV 终端站，接入西维州风光并作为 VNI West 落点；2026-09-15 维州规划部长完成 EES 评估并批复（附减缓条件），同日州长下令独立成本评估（2026 年底完成，期间不启动强制征地），仍需州规划许可与联邦 EPBC 审批，社区反对强烈；VicGrid 的 VTP 将其列为优先项目，目标 2029 年投运，尚未开工。"
      },
      {
        "name": "Marinus Link 一期 (Heybridge TAS—Hazelwood VIC)",
        "en": "Marinus Link Stage 1 HVDC",
        "kv": 320,
        "owner": "Marinus Link Pty Ltd（联邦 49% / 维州 33.3% / 塔州 17.7%）",
        "status": "在建",
        "year": 2030,
        "desc": "750 MW ±320 kV HVDC，255 km 海缆 + 90 km 维州陆缆（Waratah Bay 登陆至 Hazelwood 换流站）；2025-08 FID，Prysmian 电缆、Hitachi Energy 换流站、TasVic Greenlink（DT Infrastructure + Samsung C&T）A$9.94 亿土建合同 2025-12 签署，CEFC A$38 亿优惠贷款；2026 年开工、目标 2030 年投运；二期 750 MW 投资决定 2026–27 年。"
      },
      {
        "name": "吉普斯兰海上风电陆上输电 (Giffard West—Loy Yang)",
        "en": "Gippsland Offshore Wind Transmission (VicGrid)",
        "kv": 500,
        "owner": "VicGrid 规划（交付模式待定）",
        "status": "规划",
        "year": 2032,
        "desc": "为 2032 年首批 2 GW 海上风电设计的陆上送出走廊：Giffard West 登陆点至 Loy Yang 500 kV 枢纽（2024 年公示规划走廊），含海上风电汇集/升压站，后续扩展至 2035 年 4 GW、2040 年 9 GW；Star of the South、Gippsland Dawn、Blue Mackerel 等许可项目依赖该走廊。"
      },
      {
        "name": "金平原风电场及 Elaine 500kV 终端站",
        "en": "Golden Plains Wind Farm + Elaine Terminal Station",
        "kv": 500,
        "owner": "TagEnergy（风场）/ AusNet（终端站）",
        "status": "在建",
        "year": 2027,
        "desc": "1,333 MW 南半球最大陆上风场，一期已投运、二期在建，经 AusNet 新建的 Elaine 500 kV 终端站接入 Moorabool—Sydenham 500 kV 线；Vestas 整场 EPC、CPP 电气 BoP，配套 300 MW 储能。"
      },
      {
        "name": "墨尔本可再生能源枢纽储能 (Melbourne Renewable Energy Hub)",
        "en": "Melbourne Renewable Energy Hub BESS",
        "owner": "Equis / SEC Victoria",
        "status": "投运",
        "year": 2025,
        "desc": "Plumpton（Sydenham 终端站旁）600 MW/1.6 GWh，444 台 Tesla Megapack，Samsung C&T + GenusPlus EPC，2025 年投运，SEC 首个投资项目、澳洲已投运最大单址电池。"
      },
      {
        "name": "沃伦电池储能 (Wooreen, Jeeralang)",
        "en": "Wooreen BESS",
        "owner": "EnergyAustralia",
        "status": "在建",
        "year": 2026,
        "desc": "350 MW/1,400 MWh 四小时电池，复用 Jeeralang 燃气电厂并网点，Wärtsilä 供货 + Zenviron 施工，2025 年初开工、2026 年完工，是 Yallourn 2028 关停的首个替代资产。"
      },
      {
        "name": "莫特莱克储能 (Mortlake BESS)",
        "en": "Mortlake BESS",
        "owner": "Origin Energy",
        "status": "在建",
        "year": 2026,
        "desc": "维州西南 Mortlake 燃气电厂旁 300 MW/650 MWh，Fluence Gridstack + SMA 逆变器，复用既有 500 kV 并网点，预计 2026 年投运。"
      },
      {
        "name": "库兰吉储能 (Koorangie, Murray River REZ)",
        "en": "Koorangie BESS",
        "owner": "Edify Energy / Sosteneo",
        "status": "投运",
        "year": 2025,
        "desc": "185 MW/370 MWh 网构型（grid-forming）电池，Kerang 附近接入，用于缓解 Murray River 区系统强度约束；CPP 施工、Tesla Megapack，2025 年投运。"
      },
      {
        "name": "SEC 可再生能源园 (Horsham)",
        "en": "SEC Renewable Energy Park Horsham",
        "owner": "SEC Victoria",
        "status": "在建",
        "year": 2027,
        "desc": "119 MW 光伏 + 100 MW/200 MWh 电池，SEC 自主开发的首个项目（Wimmera Southern Mallee 区），2025 年开工、预计 2026–27 年投运。"
      }
    ],
    "vendor": "在维州卖中高压设备，第一道门是 NSP 的核准设备体系：CitiPower/Powercor/United Energy 共用一套 Technical Standards 与核准材料清单、AusNet 有公开的网络标准与核准设备清单、Jemena 有自身技术规格与核准产品清单，新产品需提交 AS/IEC 型式试验报告（AS/IEC 62271 开关设备、AS 60076 变压器、AS/NZS 61439 低压成套、AS 2067 高压变电站设计、AS/NZS 3000 布线、AS/NZS 7000 架空线）并经产品评估与现场试用才能入册，且必须满足维州独有的 REFCL 兼容要求（codified area 内 22 kV 设备需耐受健全相对地电压升至线电压）。预制变电站 / E-house 按 NCC 作为建筑物需经注册建筑测量师核发 building permit（Building Act 1993），结构按 AS/NZS 1170 系列——全维州均为 AS/NZS 1170.2 风区 A、无 C/D 气旋等级要求，但高原区需计雪荷载；位于 Bushfire Prone Area / Bushfire Management Overlay 的站房需按 AS 3959 评定 BAL 等级，DNSP 资产还受 Electricity Safety (Bushfire Mitigation) Regulations 与 ESV 林火减灾计划约束。电气安装必须由 Energy Safe Victoria 注册的 Registered Electrical Contractor（REC）与持牌电工完成并出具 Certificate of Electrical Safety，低压在售设备按 Electricity Safety (Equipment) Regulations 2019 / RCM 要求；输电侧并网走 AEMO 维州接入流程而非 AusNet。本地化方面维州是全澳最严：Local Jobs First Act 2003 对政府资助项目（都市 ≥A$300 万、区域 ≥A$100 万）强制本地含量与 Major Projects Skills Guarantee（10% 工时学徒/实习生），Strategic Projects（≥A$5,000 万，含 SEC、VicGrid、Marinus 等）须经 ICN Victoria 的 VMC 平台提交 Local Industry Development Plan，联邦 ≥A$5 亿项目另需 Australian Industry Participation 计划——海外厂商通常要与 ICN Gateway 注册的本地集成/安装伙伴组队并提供本地装配、备件与售后方案。真正的买家分五类：TNSP/DNSP（AusNet、Powercor/CitiPower/UE 经 Beon、Jemena 经 Zinfra 的框架与更新项目，区域变电站更新、移动变电站、REFCL 兼容设备、SAPS 是 2026–31 期的明确主题）；输电与储能 EPC（CPP、UGL、Downer、Zinfra、Beon、GenusPlus、Zenviron、Samsung C&T、DT Infrastructure、Elecnor 等）；风光储开发商与 BESS 运营商（Equis、EnergyAustralia、Origin、AGL、Edify、Akaysha、Eku、TagEnergy、SEC Victoria，对预制升压站、MV 开关柜与储能撬块需求集中）；Gippsland 海上风电开发商（Star of the South、Equinor/oet、Parkwind/JERA、Iberdrola 等，陆上升压站与汇集站为 2027 年后标的）；以及墨尔本西部/东南数据中心（AirTrunk、NextDC、Microsoft、AWS、Equinix）与工业电气化客户（Alcoa Portland、Viva Energy Geelong、Opal Maryvale、Latrobe Valley 矿区复垦）。",
    "tenderPortals": [
      "Buying for Victoria / Victorian Government Tenders（州政府、SEC、VicGrid 招标）：https://www.tenders.vic.gov.au",
      "ICN Gateway 与 Local Jobs First VMC（本地供应商注册、LIDP 提交）：https://gateway.icn.org.au",
      "Local Jobs First（政策、门槛与 Strategic Projects 清单）：https://www.localjobsfirst.vic.gov.au",
      "VicGrid（Victorian Transmission Plan、REZ、海上风电输电）：https://www.energy.vic.gov.au/renewable-energy/vicgrid",
      "AEMO VNI West / Transmission Company Victoria 采购信息：https://aemo.com.au/initiatives/major-programs/vni-west",
      "Marinus Link 供应商与项目信息：https://www.marinuslink.com.au",
      "Western Renewables Link（AusNet）：https://www.westernrenewableslink.com.au",
      "AusNet（供应商与网络标准）：https://www.ausnetservices.com.au",
      "Powercor / CitiPower / United Energy（承包商与技术标准）：https://www.powercor.com.au",
      "Jemena / Zinfra（供应商注册）：https://www.jemena.com.au",
      "SEC Victoria（项目与合作伙伴）：https://www.secvictoria.com.au",
      "联邦 Capacity Investment Scheme（CIS）招标：https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme",
      "ASL（原 AEMO Services，CIS 招标执行）：https://asl.org.au",
      "Energy Safe Victoria（REC 注册、电工执照、林火减灾规则）：https://www.esv.vic.gov.au",
      "联邦 Australian Industry Participation（AIP）计划：https://www.industry.gov.au"
    ],
    "sources": [
      "https://www.aer.gov.au/industry/registers/determinations/ausnet-services-transmission-determination-2022-27",
      "https://www.aer.gov.au/industry/registers/determinations/ausnet-services-transmission-determination-2027-32",
      "https://www.aer.gov.au/industry/registers/determinations/ausnet-services-determination-2026-31",
      "https://www.aer.gov.au/industry/registers/determinations/citipower-determination-2026-31",
      "https://www.aer.gov.au/industry/registers/determinations/powercor-determination-2026-31",
      "https://www.aer.gov.au/industry/registers/determinations/jemena-determination-2026-31",
      "https://www.aer.gov.au/industry/registers/determinations/united-energy-determination-2026-31",
      "https://www.energy.vic.gov.au/renewable-energy/vicgrid",
      "https://www.vic.gov.au/victorian-transmission-plan",
      "https://www.energy.vic.gov.au/renewable-energy/victorias-renewable-energy-targets",
      "https://www.energy.vic.gov.au/renewable-energy/offshore-wind-energy",
      "https://www.dcceew.gov.au/energy/renewable/offshore-wind/areas/gippsland",
      "https://www.secvictoria.com.au",
      "https://aemo.com.au/initiatives/major-programs/vni-west",
      "https://infrastructurepipeline.org/project/victoria-to-nsw-interconnector-west",
      "https://www.westernrenewableslink.com.au",
      "https://www.marinuslink.com.au",
      "https://www.energyaustralia.com.au/about-us/media/news/energyaustralia-reaffirms-yallourn-closure-date",
      "https://reneweconomy.com.au/energyaustralia-says-yallourn-coal-generator-to-close-early-in-2028/",
      "https://esdnews.com.au/agl-brings-forward-closure-of-loy-yang-a-and-bayswater/",
      "https://reneweconomy.com.au/it-will-be-the-last-to-close-loy-yang-owner-plans-syncon-and-batteries-but-is-in-no-hurry-to-shut-down-coal-plant/",
      "https://www.alintaenergy.com.au/about-us/news-hub/sembcorp-industries-completes-acquisition-of-alinta-energy",
      "https://www.localjobsfirst.vic.gov.au",
      "https://www.tenders.vic.gov.au",
      "https://gateway.icn.org.au",
      "https://www.esv.vic.gov.au",
      "https://www.ausnetservices.com.au",
      "https://www.powercor.com.au",
      "https://www.jemena.com.au",
      "https://www.unitedenergy.com.au",
      "https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme"
    ]
  },
  "QLD": {
    "abbr": "QLD",
    "name": "昆士兰州",
    "en": "Queensland",
    "grid": "NEM（国家电力市场）QLD1 区域 + Mount Isa 西北电力系统 NWPS（离网孤网，CopperString 建成后并入 NEM）+ Ergon Energy 33 个偏远孤网（Torres Strait / Cape York / Gulf 社区）+ Weipa 等矿业自备电网",
    "operator": "AEMO（NEM 市场与系统运营）；Powerlink Queensland 为州输电规划主体并依据 Energy (Renewable Transformation and Jobs) Act 2024 担任 REZ 与优先输电投资（PTI）交付主体；NWPS 由 Ergon Energy 运营配网、APA Diamantina 燃气电站等供电",
    "summary": "昆士兰拥有 NEM 最大的燃煤机群（8 座在运黑煤电厂约 8.1 GW，Stanwell / CS Energy 两家州属发电企业持有其中大部分），同时屋顶光伏渗透率居世界前列，Western Downs、Darling Downs 与中昆士兰已形成风光储集群。2024-10 上台的 LNP 政府（Crisafulli）废除了前工党政府 2030/2032/2035 的法定可再生目标，2025-10-07 发布《Queensland Energy Roadmap》：煤电按技术寿命运行（部分到 2040 年代中期）、取消 Pioneer-Burdekin 抽蓄、Borumba 继续推进、CopperString 东段由 500 kV 回调至 330 kV 控成本、新增燃气调峰与州属电池。电网资本开支的驱动力因此从“2035 退煤”转为四条主线：北昆士兰 CopperString 与矿业走廊、Gladstone 工业区（铝业脱碳、Gladstone 电厂 2029 退役）电网强化、Borumba 500 kV 接入与州属 BESS 机群，以及 Energex 东南昆士兰（人口增长、2032 奥运、数据中心、EV）与 Ergon 气旋/洪水韧性和孤网改造。",
    "tnsp": {
      "name": "Powerlink Queensland（Queensland Electricity Transmission Corporation Ltd）",
      "owner": "昆士兰州政府 100%（政府所有公司 GOC，股东为财政部长与能源部长）",
      "voltages": "330/275/132/110 kV（275 kV 为主干；330 kV 为 QNI 昆新联络线；规划新建 500 kV 骨干，CopperString 东段 2025 年由 500 kV 回调为 330 kV）",
      "notes": "总部 Brisbane（Virginia），网络约 1.5 万回路公里、约 150 座变电站，南北纵贯 Cairns 至 Gold Coast 约 1,700 km，经 QNI 330 kV 与 Terranora/Directlink 直流两条联络线与 NSW 相连。AER 2022–27 监管期（2022-07-01 至 2027-06-30，终案 2022-04）；旗舰项目：CopperString（Townsville—Hughenden—Mount Isa 约 840 km，总投资逼近 A$120 亿，2025-10 路线图确认续建并控成本，Flinders 变电站 A$2.25 亿 2025-12 获批、2026 年开工，D&C 伙伴 UGL+CPB 联合体）；Gladstone Grid Reinforcement（中昆士兰至 Gladstone 工业区 275 kV 强化，新增约 2.6 GW 接入能力，2026 开工、2029-03 完工）；Borumba 抽蓄 500 kV 接入线路（随 Queensland Hydro 的 FID 推进）；QNI Connect 500 kV 昆新第二互联（AEMO ISP 远期项目）；REZ 就绪评估与 275 kV 枢纽站（Calvale、Stanwell、Broadsound、Western Downs、South Pine 等）二次系统与变压器到寿更新。"
    },
    "dnsps": [
      {
        "name": "Energex",
        "area": "东南昆士兰 SEQ：Brisbane、Gold Coast、Sunshine Coast、Ipswich、Logan、Moreton Bay、Redlands、Scenic Rim、Lockyer Valley、Somerset、Noosa，北至 Gympie、南至 Coolangatta 州界",
        "hq": "Brisbane（Newstead）",
        "owner": "Energy Queensland Limited（昆士兰州政府 100%；集团还含 Ergon Energy Network、Ergon Energy Retail 与非管制业务 Yurika）",
        "voltages": "110/33/11 kV",
        "notes": "约 150 万用户，是昆州负荷密度最高的配网。AER 2025–30 配电决定终案 2025-04-30 发布（监管期 2025-07-01 至 2030-06-30）；资本开支主题：SEQ 人口增长与 2032 布里斯班奥运场馆供电、Brendale / Fortitude Valley / Springfield 数据中心与 EV 充电负荷接入、1960–80 年代 33/11 kV 区域变电站与地下电缆到寿更新、屋顶光伏高渗透下的动态接入（flexible exports）与社区电池、2025-03 气旋 Alfred 后的风暴/洪水韧性。设备准入：Energy Queensland 对 Energex/Ergon 实行统一技术标准（STNW 系列）与核准材料/型式认可制度，客户接入按《Queensland Electricity Connection Manual (QECM)》执行，承包商通过 Electrical Partners 门户管理；昆州无 NSW 式 ASP 竞争性工程制度，网内工程多由 Energy Queensland 自营或其面板承包商执行，客户出资的接入工程须用其核准设备（箱式变电站 kiosk、环网柜、配变均需通过 Energy Queensland 型式认可）。采购走 Energy Queensland 集团统一供应链（框架协议/面板），受《Queensland Procurement Policy》与 Buy Queensland 本地效益测试约束。"
      },
      {
        "name": "Ergon Energy Network",
        "area": "昆州其余约 97% 国土：Cairns、Townsville、Mackay、Rockhampton、Gladstone、Bundaberg、Toowoomba、Mount Isa 及 Cape York、Torres Strait、Gulf 偏远社区",
        "hq": "Townsville",
        "owner": "Energy Queensland Limited（昆士兰州政府 100%）",
        "voltages": "132/110/66/33/22/11 kV + SWER（单线对地回路）",
        "notes": "约 76 万用户、线路约 15 万公里，是澳洲地理覆盖最广的配网之一，还运营 33 个孤网（柴油+光伏/电池混合，正推进“孤网可再生化”改造）与 Mount Isa NWPS 的配网。AER 2025–30 终案 2025-04-30 发布，资本开支核定值本次未能核实（量级数十亿澳元）。资本开支主题：北昆士兰气旋（AS/NZS 1170.2 风区 C）与洪水韧性（2023 Jasper、2025 北昆洪水后重建）、66/33 kV 区域变电站与架空线更新、矿业（Bowen Basin 炼焦煤、西北矿产省 Eva/Ernest Henry 铜）与农业抽水负荷、REZ 周边 132/66 kV 承载能力、SAPS 独立电源系统替换偏远长线路、移动变电站用于气旋灾后与检修过渡（Energy Queensland 持有移动变电站队列，具体数量未核实）。设备准入与采购与 Energex 共用 Energy Queensland 统一技术标准、核准材料与集团框架协议；非管制子公司 Yurika 承接州属 BESS（Tarong、Stanwell）与矿业客户的 EPC/并网工程，是设备商进入昆州州属项目的关键通道。"
      }
    ],
    "rezBody": "Powerlink Queensland（依据 Energy (Renewable Transformation and Jobs) Act 2024 指定的 REZ 交付主体，负责 REZ 就绪评估 REZ Readiness Assessment、接入方案与网络建设）；REZ 由州能源部长（Treasurer and Minister for Energy David Janetzki）依法划定；",
    "rezs": [
      "Far North Queensland (Tablelands) REZ（候选）",
      "Flinders / Hughenden North Queensland REZ（候选，CopperString 走廊）",
      "Barcaldine REZ（候选，Powerlink 就绪评估）",
      "Central Queensland (Capricornia / Calliope–Gladstone) REZ（候选）",
      "Banana / Callide REZ（候选）",
      "Western Downs REZ（候选，既有光储集群）",
      "Southern Downs REZ（候选，Powerlink 就绪评估）",
      "Wide Bay–Burnett / Tarong REZ（候选）"
    ],
    "policy": "LNP 政府（Premier David Crisafulli，2024-10-26 当选）于 2025 年立法废除前工党《Energy (Renewable Transformation and Jobs) Act 2024》中 2030 年 50% / 2032 年 70% / 2035 年 80% 的可再生目标与 2035 退煤安排，2025-10-07 发布《Queensland Energy Roadmap》：煤电按技术寿命运行、Callide B 翻新延寿至至少 2031、Pioneer-Burdekin 5 GW 抽蓄取消（2024-11）、Borumba 继续推进、新增燃气调峰（Stanwell Lockyer 114 MW 燃气 + 6 GWh 宁德时代 EnerQB 长时储能、CS Energy 燃气方案）与州属电池，并设立 A$4 亿能源基金支持新增可调度电源。州属主体：Stanwell、CS Energy（发电）、CleanCo（清洁能源发电零售，Swanbank BESS、Wambo 风电、BMA 绿电 PPA）、Queensland Hydro（Borumba）、Powerlink、Energy Queensland/Yurika；无 SEC Victoria 式的州属新能源开发商，也无 NSW LTESA 式的州级招标。联邦 CIS：昆州项目通过全国轮次获得收入下限合同（Theodore 1.1 GW 风电 2026-05 CIS 第 7 轮、Grahams 350 MW/1,428 MWh 电池 CIS 第 8 轮等）。海上风电：联邦未在昆州划定海上风电区，州政府亦无海上风电规划。",
    "coalExit": "昆州 8 座在运燃煤电厂约 8.1 GW，是 NEM 退煤最慢的州。Gladstone（1,680 MW，Rio Tinto/NRG 合资）2025-10 向 AEMO 提交 2029-03 关停通知，与 Boyne 铝冶炼厂供电合同到期一致，是 2029 前最大的退役节点；Callide B（700 MW，CS Energy）由原 2028 翻新延寿至至少 2031；Stanwell（1,460 MW）按 2025-10 路线图运行至 2040 年代中期（至少 2046）；Tarong / Tarong North（1,843 MW）名义 2036–37、路线图未给明确时间；Kogan Creek（750 MW）名义 2042；Callide C（840 MW，CS Energy/Sev.en）与 Millmerran（852 MW，华能/粤电经 InterGen 控股）名义 2051。前工党 2035 年前将所有州属煤电转为“清洁能源枢纽”的计划已废止，但 Tarong BESS（300 MW/600 MWh，2026-02 商运）、Stanwell BESS（300 MW/1,200 MWh，在建）、Swanbank BESS（250 MW/500 MWh，2026 投运）等厂址储能仍在推进。",
    "keyProjects": [
      {
        "name": "铜线计划输电工程（CopperString，Townsville—Hughenden—Mount Isa）",
        "en": "CopperString (Townsville–Hughenden–Mount Isa)",
        "kv": 330,
        "owner": "Powerlink Queensland（D&C 伙伴 UGL+CPB 联合体，营地 ATCO）",
        "status": "在建",
        "year": 2032,
        "desc": "约 840 km 新建输电线路把 Mount Isa 西北矿产省孤网并入 NEM 并打开北昆士兰 REZ 走廊；总投资逼近 A$120 亿，2025-10 路线图确认续建并把东段由 500 kV 回调至 330 kV 节省 A$21 亿；Hughenden 营地 2025-11 建成，Flinders 变电站（A$2.25 亿）2025-12 获批、2026 年开工，全线目标 2032 年前建成。"
      },
      {
        "name": "格拉德斯通电网强化工程 (Gladstone Grid Reinforcement)",
        "en": "Gladstone Grid Reinforcement",
        "kv": 275,
        "owner": "Powerlink Queensland",
        "status": "在建",
        "year": 2029,
        "desc": "升级中昆士兰至 Gladstone 工业区的 275 kV 输电，新增约 2.6 GW 可再生接入能力，支撑 Rio Tinto 铝业脱碳（Upper Calliope 1.1 GW 光伏、Bungaban 1.4 GW 风电 PPA）与 Gladstone 电厂 2029 退役后的供电；2026 年开工、2029-03 完工，承包商未公开。"
      },
      {
        "name": "博伦巴抽水蓄能及 500kV 接入 (Borumba)",
        "en": "Borumba Pumped Hydro + 500 kV connection",
        "kv": 500,
        "owner": "Queensland Hydro（州属）/ Powerlink（接入线路）",
        "status": "规划",
        "year": 2033,
        "desc": "2 GW / 最高 48 GWh（24 小时）长时储能，Imbil 附近 Borumba 水库；2025 年获联邦环评批准并启动勘探与早期工程（FKG、WSP+AECOM），2025-10 路线图确认继续推进；主体工程未授标，最终投资决定与规模以 Queensland Hydro 后续公告为准。"
      },
      {
        "name": "昆新第二互联 QNI Connect 500kV",
        "en": "QNI Connect (second Qld–NSW interconnector)",
        "kv": 500,
        "owner": "Powerlink / Transgrid",
        "status": "规划",
        "year": 2033,
        "desc": "AEMO ISP 识别的 NSW New England 至昆州 Darling/Western Downs 500 kV 新互联，用于南向输出昆州光伏/风电并北向输入 NSW 储能；ISP 远期项目，时间窗 2030 年代初，昆州路线图后的定位待 AEMO 2026 ISP 最终版确认。"
      },
      {
        "name": "斯坦威尔电池储能 (Stanwell BESS)",
        "en": "Stanwell Battery Energy Storage System",
        "kv": 275,
        "owner": "Stanwell Corporation（州属）；安装总包 Yurika，电池 Tesla Megapack 2XL × 324",
        "status": "在建",
        "year": 2027,
        "desc": "300 MW / 1,200 MWh，位于 Rockhampton 附近 Stanwell 电厂园区、复用 275 kV 枢纽并网，投资 A$7.47 亿，2025 年开工、目标 2027 年中全面商运，是州属“煤电厂址转储能”的最大单体项目。"
      },
      {
        "name": "塔龙电池储能 (Tarong BESS)",
        "en": "Tarong Battery Energy Storage System",
        "kv": 275,
        "owner": "Stanwell Corporation（州属）；安装总包 Yurika，电池 Tesla Megapack 2XL × 164",
        "status": "投运",
        "year": 2026,
        "desc": "300 MW / 600 MWh，South Burnett 地区 Tarong 燃煤电厂旁，投资 A$5.14 亿，2026-02 进入商业运营，Stanwell 首个全资调度储能。"
      },
      {
        "name": "斯旺班克电池储能 (Swanbank BESS)",
        "en": "Swanbank Battery Energy Storage System",
        "kv": 275,
        "owner": "CleanCo Queensland（州属），Tesla Megapack",
        "status": "投运",
        "year": 2026,
        "desc": "250 MW / 500 MWh，Ipswich 原 Swanbank B 煤电厂址，投资约 A$3.3 亿，新建 275 kV 变电站并复用原煤电输电通道，2026 年初投运，是昆州首个退煤场地转清洁能源枢纽的落地案例。"
      },
      {
        "name": "洛克耶燃气+长时储能混合电站 (Lockyer Energy Project)",
        "en": "Lockyer Energy Project (gas + 6 GWh LDES)",
        "kv": 275,
        "owner": "Stanwell Corporation（州属，2025 年收购自 Quinbrook）；储能供货宁德时代 EnerQB",
        "status": "规划",
        "year": 2028,
        "desc": "Gatton 以北 Lockyer Valley，114 MW 燃气调峰 + 约 6 GWh（约 750 MW / 8 小时）长时储能，2025-12 确认选用宁德时代 EnerQB，建成后将是澳洲最大单体电池，是 LNP 路线图“燃气+储能”可调度电源的样板。"
      }
    ],
    "vendor": "在昆士兰卖中高压设备，第一道门槛是 Energy Queensland（Energex / Ergon 共用）与 Powerlink 的型式认可与核准材料体系：箱式变电站、环网柜、配变、断路器必须按其统一技术标准通过型式试验评审（IEC/AS 62271 开关设备、AS 60076 变压器、AS/NZS 61439 低压成套、AS 2067 变电站设计、AS/NZS 3000 布线、AS/NZS 7000 架空线）并进入核准清单，客户接入工程须遵守 QECM，未经认可的设备即使价格再低也无法并网。预制变电站 / E-house 在昆州被视为建筑物，须满足 NCC 与 AS/NZS 1170 系列荷载：Bundaberg 以北沿海（Gladstone、Rockhampton、Mackay、Townsville、Cairns）为 AS/NZS 1170.2 气旋风区 C，围护结构、门、通风与锚固需按 C 区设计并提供飞掷物抗冲击证明，内陆与东南昆士兰为 A/B 区，林火易发的 SEQ 内陆按 AS 3959 评定 BAL；低压设备须符合 EESS（昆州是该体系的东道州，Level 1–3 在册设备需 RCM 标志与数据库登记）。本地化方面，州属 GOC（Powerlink、Energy Queensland、Stanwell、CS Energy、CleanCo、Queensland Hydro）全部适用《Queensland Procurement Policy》与 Buy Queensland 本地效益测试（评标中本地供应商与本地就业加权、A$1 亿以上项目须提交本地产业参与计划），重大矿业与能源项目另有州政府本地参与协议，联邦 A$5 亿以上项目还要 Australian Industry Participation 计划——海外厂商通常需与 ICN Gateway 注册的昆州集成/安装伙伴组队并承诺本地装配、备件与售后。施工与安装须由 Electrical Safety Office 核发的电气承包商执照持有者执行（Electrical Safety Act 2002），涉及建筑工程的预制站房安装还需 QBCC 执照，电气设备进入矿场则要满足昆州《Coal Mining Safety and Health Act》及 AS/NZS 4871 等矿用标准。真正的买家分五类：Powerlink 与 Energy Queensland/Yurika（框架协议、面板与州属 BESS EPC）、输变电 EPC（UGL/CPB、Downer、CPP、Zinfra、GenusPlus、Beon、Decmil）、矿业（Glencore Mount Isa、BHP BMA、Anglo American、Rio Tinto Gladstone/Weipa、Harmony Eva、South32 Cannington，对移动变电站、E-house 与矿用开关柜需求最直接）、BESS/新能源开发商（Stanwell、CS Energy、CleanCo、Akaysha、Ampyr、Genex、Quinbrook、Edify、Neoen、RWE、Windlab）以及 Brendale / Brisbane 的数据中心运营商（NextDC、AirTrunk、Supernode）。",
    "tenderPortals": [
      "QTenders（昆州政府与 GOC 招标门户）：https://qtenders.epw.qld.gov.au",
      "Buy Queensland / Queensland Procurement Policy（本地效益测试与供应商指引）：https://www.forgov.qld.gov.au/finance-and-procurement/procurement",
      "ICN Gateway（本地供应商注册，Powerlink/CopperString、Borumba、矿业项目供应链平台）：https://gateway.icn.org.au",
      "Powerlink Queensland 供应商与项目信息：https://www.powerlink.com.au",
      "Energy Queensland（Energex / Ergon / Yurika）采购与承包商门户：https://www.energyq.com.au",
      "Ergon Energy 承包商与供应商（Electrical Partners）：https://www.ergon.com.au",
      "Energex 承包商与供应商：https://www.energex.com.au",
      "Queensland Hydro（Borumba 采购）：https://www.qldhydro.com.au",
      "Stanwell 供应商：https://www.stanwell.com",
      "CS Energy 供应商：https://www.csenergy.com.au",
      "CleanCo Queensland：https://www.cleancoqld.com.au",
      "ASL（原 AEMO Services）联邦 CIS 招标：https://asl.org.au",
      "联邦 Capacity Investment Scheme（DCCEEW）：https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme",
      "Electrical Safety Office 昆州电气承包商执照：https://www.worksafe.qld.gov.au/licensing-and-registrations/electrical-licences",
      "QBCC 建筑执照：https://www.qbcc.qld.gov.au",
      "联邦 Australian Industry Participation（AIP）计划：https://www.industry.gov.au"
    ],
    "sources": [
      "https://www.abc.net.au/news/2025-10-07/power-stations-extended-callide-energy-road-map-policy/105843616",
      "https://www.abc.net.au/news/2025-10-10/queensland-government-to-establish-400m-energy-fund/105874318",
      "https://esdnews.com.au/queensland-government-extends-coal-plants-in-energy-roadmap/",
      "https://reneweconomy.com.au/rio-tinto-flags-early-closure-of-queenslands-biggest-coal-generator-as-lnp-prepares-new-energy-plan/",
      "https://www.energytodaymag.com.au/gladstone-power-station-may-retire-in-2029/",
      "https://www.csenergy.com.au/news/statement-on-the-future-of-callide-b-power-station",
      "https://wattclarity.com.au/articles/2025/05/08may-callidec-7gi-part-buyout/",
      "https://southburnett.com.au/news2/2025/10/10/no-timeframe-for-tarong-stations/",
      "https://reneweconomy.com.au/new-big-battery-kicks-off-commercial-operations-next-to-outage-prone-queensland-coal-plant/",
      "https://www.energy-storage.news/cleanco-opens-500mwh-tesla-megapack-bess-in-queensland-australia/",
      "https://reneweconomy.com.au/queenslands-bizarre-coal-keeper-matrix-slams-the-door-on-renewables-and-everyone-will-pay-the-price/",
      "https://www.powerlink.com.au",
      "https://www.aer.gov.au/industry/registers/determinations",
      "https://www.aer.gov.au/industry/registers/determinations/powerlink-determination-2022-27",
      "https://www.aer.gov.au/industry/registers/determinations/energex-determination-2025-30",
      "https://www.aer.gov.au/industry/registers/determinations/ergon-energy-determination-2025-30",
      "https://www.energyq.com.au",
      "https://www.ergon.com.au",
      "https://www.energex.com.au",
      "https://www.legislation.qld.gov.au",
      "https://qtenders.epw.qld.gov.au",
      "https://gateway.icn.org.au",
      "https://www.stanwell.com",
      "https://www.cleancoqld.com.au",
      "https://www.qldhydro.com.au"
    ]
  },
  "SA": {
    "abbr": "SA",
    "name": "南澳大利亚州",
    "en": "South Australia",
    "grid": "NEM（国家电力市场）SA1 区域；经 Heywood 275 kV 双回交流（Heywood—South East，2016 年增容后双向约 650 MW）与 Murraylink ±150 kV HVDC（Red Cliffs—Berri，220 MW）连 VIC，经 Project EnergyConnect 330 kV 交流（Robertstown/Bundey—Buronga，SA 段 2024 年带电、全线 800 MW 交换能力待 NSW 东段 2026–27 年完工）连 NSW；州内另有州政府 RAES 计划下的偏远城镇离网微电网（Coober Pedy、Marla、Oodnadatta 等）与矿山自备电（Honeymoon 等）",
    "operator": "AEMO（NEM 市场与系统运营，SA1 区域；因南澳为全球逆变器电源占比最高的大电网之一，AEMO 对南澳设有专门的系统强度、惯量与最低同步机组组合运行要求，并每年发布 SA Advisory 分析）；ElectraNet 为南澳 Jurisdictional Planning Body（年度 Transmission Annual Planning Report、RIT-T）；Department for Energy and Mining（DEM）主导州能源政策、HRE Act 许可与 RAES 离网供电；Essential Services Commission of SA（ESCOSA）负责网络牌照与州级可靠性标准，Office of the Technical Regulator（OTR）负责电气技术与安全监管，Consumer and Business Services（CBS）发放电工/电气承包商执照",
    "summary": "南澳自 2016 年 Port Augusta 煤电全部关停后，已成为全球高比例风光电网的样板：风电 + 屋顶/集中式光伏约占本州发电量四分之三以上（2024–25 财年约 77%：风电 44.5%、屋顶光伏 22.4%、集中式光伏 10.1%），其余靠燃气（Torrens Island、Pelican Point、Barker Inlet、Hallett 等）与 Heywood/Murraylink/EnergyConnect 三条跨州联络线调节，大电池（Hornsdale、Torrens Island、Blyth 等）与 Davenport/Robertstown 四台同步调相机承担系统强度与惯量。2025-02 取消 A$5.93 亿 Hydrogen Jobs Plan（Whyalla 250 MW 电解槽 + 200 MW 氢燃机）后，重心转向绿铁/绿钢、BHP 铜矿省扩产、Northern Water 海水淡化等工业负荷以及储能。电网资本开支由四条主线驱动：EnergyConnect 全容量释放与 Mid North / 北部 REZ 送出增容、Olympic Dam 与 Whyalla 等北部大负荷接入、ElectraNet 系统强度（同步调相机 / 构网型储能合同）与老旧 275/132 kV 资产更新、以及 SA Power Networks 2025–30 期的区域变电站更新、林火/风暴韧性、灵活出口（flexible exports）与电动化负荷。",
    "tnsp": {
      "name": "ElectraNet",
      "owner": "State Grid International Development（中国国家电网，46.56%）、YTL Power Investments（马来西亚杨忠礼，33.5%）、Australian Utilities Trust（19.94%）——1999–2000 年 ETSA 私有化后由私营业主持有，2012 年国网入股",
      "voltages": "330/275/132/66 kV",
      "notes": "南澳唯一 TNSP，总部 Adelaide（East Terrace），约 6,600 回路公里线路、90 余座变电站（ElectraNet 官网口径），275 kV 为骨干、132 kV 覆盖 Eyre 半岛/Riverland/东南部、66 kV 少量，330 kV 仅 EnergyConnect 段（Robertstown—Bundey—州界）。监管期 2023–28（2023-07-01 至 2028-06-30），AER 终案 2023-04——本次离线编制未能核验核定收入与资本开支数，请以 AER 决定页为准；2028–33 期收入提案预计 2027 年提交。旗舰项目：Project EnergyConnect 南澳段（约 A$4.6 亿，Downer 施工，新建 Bundey 330/275 kV 站，2024 年带电）；Eyre Peninsula Link（Cultana—Yadnarie—Port Lincoln 约 270 km 132 kV 双回，替换 1960 年代单回老线，约 A$3.2 亿，Downer 施工，2023-02 全线带电投运）；Davenport + Robertstown 四台同步调相机（Siemens，约 A$1.66 亿，2021 年投运，使 AEMO 得以放宽最低燃气机组组合）；Dalrymple ESCRI-SA 30 MW/8 MWh 受监管电池（2018，NEM 首个网络侧电池）；系统强度（Main Grid System Strength）RIT-T——2025-12 起 AEMO 系统强度新框架生效，ElectraNet 2025-12 PACR 首选方案为给新建同步机组加装离合器并采购低成本通用系统强度服务（约 A$500 万），按当前预测暂不需新增调相机（A$1.5–2 亿），构网型电池不作为最低强度依赖；ISP 远期项目 Mid North SA REZ 扩容与 SA–NSW 互联扩容；BHP Olympic Dam 冶炼二炉与 Northern Water 淡化厂等北部大负荷接入研究。采购方式为框架承包商（Downer、UGL、CPP、Zinfra 等）+ 项目招标，设备需通过 ElectraNet 供应商预审与型式试验审查。"
    },
    "dnsps": [
      {
        "name": "SA Power Networks（SAPN）",
        "area": "南澳全州并网区域：Adelaide 都会区、Barossa、Fleurieu、Yorke Peninsula、Eyre Peninsula、Mid North、Riverland、Limestone Coast（Mount Gambier）、Kangaroo Island（海底电缆供电）至 Far North（Coober Pedy 除外）——全州唯一持牌 DNSP",
        "hq": "Adelaide（Keswick，1 Anzac Highway）",
        "owner": "CK 集团 51%（Cheung Kong Infrastructure 23.07% + Power Assets 27.93%）、Spark Infrastructure 49%（2021-12 起由 KKR / Ontario Teachers' / PSP Investments 财团持有）",
        "voltages": "66/33 kV 次输电 + 11/7.6 kV 配电 + 19 kV SWER + 400/230 V",
        "notes": "约 95 万用户、约 88,000–90,000 km 架空/地下线路（ESCOSA 口径 88,322 km，约 20% 地下），覆盖面积全澳第二大、负荷密度低、夏季 46 °C 高温与林火/风暴风险并存。监管期 2025–30（2025-07-01 至 2030-06-30），AER 终案 2025-04——核定资本开支数字本次未核验，见 AER 决定页。资本开支主题：1950–70 年代区域变电站与 66 kV 线路到寿更新、Adelaide CBD 与北部增长走廊（Playford/Munno Para、Mount Barker）新站、林火高风险区（HBRA）覆盖导线与韧性计划（2022 年 River Murray 洪水、2022-11 全州风暴后强化）、Kangaroo Island 与 Eyre 半岛偏远 SWER 线路的 SAPS 替代、灵活出口（Flexible Exports 动态出口限值，2023-07 起新装光伏强制）与低压可视化、社区电池、EV 与燃气替代电气化、Osborne 船厂（AUKUS）与数据中心等新负荷。设备准入：SAPN 公布 Service & Installation Rules（SIR）、Technical Standards（TS 系列）与核准材料/设备清单，新产品需 AS/IEC 型式试验报告 + 产品评估 + 现场试用后入册（SIR 即 Manual 32，2025 年修订版；技术标准如 TS101/TS108/TS129/TS132）；光伏逆变器须满足州政府 Smarter Homes（2020-09）远程断开与 AS/NZS 4777.2 要求。其非监管子公司 Enerven 承接电池储能、变电站与通信工程（Hallett BESS 一期 BoP、Templers 等），是储能开发商常用的本地 EPC；移动变电站是其区域变电站更新与应急供电的既有手段（待核台数）。"
      },
      {
        "name": "RAES 偏远区供电计划（Remote Area Energy Supply，州政府；Cowell Electric 运营）",
        "area": "未并入 NEM 的内陆偏远城镇与原住民社区：Coober Pedy（市议会 + EDL 风光柴混合电站）、Andamooka、Marla、Oodnadatta、Marree、Glendambo、Kingoonya、Yunta、Manna Hill、Cockburn、Blinman、Parachilna、Nundroo 及 Yalata、Oak Valley 等 APY/西部原住民社区",
        "hq": "Adelaide（DEM 管理）/ Cowell（Cowell Electric Supply）",
        "owner": "南澳州政府（Department for Energy and Mining）所有，RAES 覆盖 28 个偏远城镇/原住民社区（13 镇 + 15 社区，约 3,400 用户），绝大部分由 Cowell Electric Supply 合同运营（Coober Pedy、Andamooka、Yunta 为独立运营商）",
        "voltages": "11 kV / 低压孤网，柴油 + 光伏 + 电池混合",
        "notes": "非 AER 监管的 DNSP，由州政府补贴维持与并网区相当的电价；资本开支以柴油机组更新、光伏+储能混合化（Coober Pedy 2017 年 EDL 混合电站约 70% 可再生）、预制式开关站与远程监控为主，设备需耐受 50 °C 高温与粉尘；采购走 SA Tenders & Contracts 州政府招标，是预制变电站/集装箱储能撬块的小批量但稳定的政府采购口。"
      }
    ],
    "rezBody": "南澳没有 NSW EnergyCo / VIC VicGrid 式的法定 REZ 划定机构：候选 REZ 由 AEMO ISP 划定（S1–S9），接入增容由 ElectraNet 以 TAPR / RIT-T 与 ISP 项目推进（Mid North SA REZ 扩容为 ISP 远期项目）；州政府 DEM 依《Hydrogen and Renewable Energy Act 2023》（2024-07-11 施行）在牧区租约地、皇家土地与州属海域划定 release area 并以竞争方式发放可再生能源可行性/基础设施许可，相当于南澳版的『开发区』机制，取代此前逐宗土地谈判",
    "rezs": [
      "S1 South East SA",
      "S2 Riverland",
      "S3 Mid-North SA",
      "S4 Yorke Peninsula",
      "S5 Northern SA",
      "S6 Leigh Creek",
      "S7 Roxby Downs",
      "S8 Eastern Eyre Peninsula",
      "S9 Western Eyre Peninsula",
      "HRE Act release areas（州政府牧区/海域许可发放区，首批 Gawler Ranges East 约 5,200 km² + Whyalla West 约 6,500 km²，REFL 招标 2026-03-30 开标、06-28 截标，结果以 DEM 公布为准）"
    ],
    "policy": "目标：2027 年净 100% 可再生电力（2024-02 由 2030 提前）、远景『500% 可再生』出口；《Climate Change and Greenhouse Emissions Reduction Act 2007》法定 2030 年减排 60%（较 2005 年）、2050 年净零。政治：Malinauskas 工党政府 2022 年执政，2026-03-21 州选举以压倒性优势连任（众议院 47 席中获 34 席，自由党仅 5 席），能源部长 Tom Koutsantonis 延续；南澳已无煤电，政策分歧集中在燃气机组保留与 Torrens Island B 退役时点。氢能：A$5.93 亿 Hydrogen Jobs Plan（Whyalla 250 MW 电解槽 + 200 MW 氢燃机）2025-02 取消，资金转入 Whyalla 钢厂纾困（州联邦合计 A$24 亿，含 A$10 亿绿铁基金），Office of Hydrogen Power SA 收缩；Port Bonython 氢能枢纽转为按市场需求推进。州属开发商：无（ETSA 1999–2000 年私有化），州政府仅持有 2017 年采购的约 276 MW 应急燃气机组（9 台 GE TM2500，2019 年起以 25 年期租给私企运营：5 台 154 MW 成为 Nexif 的 Snapper Point 电站、2022-06 投运，4 台租给 Infigen/Iberdrola 由 Lonsdale 迁往 Bolivar 改燃气）及 RAES 离网资产，大型项目靠私营开发商（Neoen、AGL、EnergyAustralia、Pacific Green、Iberdrola、ZEN Energy、Amp 等）。招标机制：无 NSW LTESA 式州级长期合同，依赖联邦 Capacity Investment Scheme——2023-12 启动的首轮 SA/VIC 600 MW 可调度容量试点（ASL 执行，2024-09 公布结果共 995 MW/3,626 MWh）及其后全国轮次，南澳电池多次中标（试点轮：Limestone Coast West 250 MW、Solar River 170 MW、Clements Gap 60 MW、Hallett 50 MW；Tender 8：Blanche 125 MW/508 MWh、Emeroo 225 MW/900 MWh）；BHP 与 Neoen 的 7×24 基荷绿电 PPA（Goyder South/North 风电 + Blyth 电池，2029-07 起 100 MW）是州内最大企业购电。海上风电：联邦未在南澳水域划定区域，2024-03 正式划定的 Southern Ocean 区（约 1,030 km²）位于维州 Warrnambool—Port Fairy 外海，已较 2023 年拟议的 Warrnambool—Port MacDonnell 范围大幅缩小，并未延伸至南澳州界；州属海域内的海上风电归 HRE Act 许可。本地化：South Australian Industry Participation Policy（IPP，Industry Advocate 执行）对州政府采购要求提交 Industry Participation Plan 并给予经济贡献（本地工作与供应链）评标权重（2023-01 版政策：A$55 万以上采购本地参与权重最低 15%，A$1,000 万以上最低 20%，更小合同适用 Economic Contribution Test），工党政府 2024 年起强化本地制造与 Whyalla 本地含量要求。",
    "coalExit": "南澳煤电退出已于 2016 年完成：Playford B（240 MW，Alinta/Flinders Power，Port Augusta）2012 年封存、2016-05 退役；Northern（540 MW，Alinta）2016-05-09 关停，Leigh Creek 煤矿 2015-11 关闭，两厂 2018–19 拆除，场地转为 CU-River 港口/光伏与绿色水泥规划，周边建成 Iberdrola Port Augusta Renewable Energy Park（317 MW）。南澳由此成为 NEM 首个无煤州，退役后十年的『补课』路径——同步调相机、大电池、第三条联络线——已成为其他州煤电退出的参考模板。当前的『退役倒计时』对象是燃气：AGL Torrens Island B（原 4×200 MW，剩余 3 台 600 MW）原宣布 2026-06-30 关停，2025 年 AEMO ESOO 对 2027 年初南澳可靠性缺口的警示促使州政府与 AGL 于 2025-10 达成资金协议，3 台机组延至 2028-07-01 关停（金额未披露）；Torrens Island A 已于 2021 年关停，Pelican Point（479 MW）、Osborne、Quarantine、Hallett、Barker Inlet 等燃气机组仍作为 2030 年前的调峰与系统安全底座。",
    "keyProjects": [
      {
        "name": "EnergyConnect 南澳段 (Robertstown—Bundey—州界 330kV)",
        "en": "Project EnergyConnect (SA section)",
        "kv": 330,
        "owner": "ElectraNet（SA 段）/ Transgrid（NSW 段）",
        "status": "投运",
        "year": 2024,
        "desc": "南澳首条与 NSW 的交流联络线：ElectraNet 新建 Bundey 330/275 kV 站并建 Bundey—州界约 200 km 330 kV 双回线（约 A$4.6 亿，Downer 施工），南澳段 2023–24 年建成带电，西段 Buronga—Bundey 已投入初期 150 MW 交换能力；全线 800 MW 待 Transgrid 的 NSW 东段 Buronga—Dinawan—Wagga 完工释放（Transgrid 最新口径 2027 年，具体里程碑以其项目页为准），届时南澳出口风光与进口可靠性同步提升。"
      },
      {
        "name": "艾尔半岛链路 (Eyre Peninsula Link, Cultana—Port Lincoln 132kV)",
        "en": "Eyre Peninsula Link",
        "kv": 132,
        "owner": "ElectraNet",
        "status": "投运",
        "year": 2024,
        "desc": "约 270 km 新线（Cultana—Yadnarie 段按 275 kV 双回标准建设、初期 132 kV 运行；Yadnarie—Port Lincoln 段 132 kV 双回），替换 1960 年代单回老线、新建/扩建 Yadnarie 等变电站，Downer 施工；2023-02 全线带电投运（总投资约 A$3.2 亿，其中 Downer 施工合同约 A$2.45 亿），解除 Eyre 半岛供电可靠性与 Western Eyre 风光接入瓶颈。"
      },
      {
        "name": "Davenport / Robertstown 同步调相机 (4 台)",
        "en": "Davenport & Robertstown Synchronous Condensers",
        "kv": 275,
        "owner": "ElectraNet",
        "status": "投运",
        "year": 2021,
        "desc": "两站各 2 台 Siemens 同步调相机（约 A$1.66 亿），2021 年投运，提供故障电流与惯量，使 AEMO 将南澳最低同步燃气机组组合由 4 台降至 2 台，是南澳高比例逆变器电网的核心系统强度资产；2025-12 起 AEMO 新系统强度框架下，ElectraNet 2025-12 RIT-T PACR 首选方案为新建同步机组加装离合器 + 低成本通用系统强度服务，暂不追加调相机，构网型电池不作最低强度依赖。"
      },
      {
        "name": "Mid North SA REZ 扩容 (ISP 远期项目)",
        "en": "Mid North SA REZ Expansion",
        "kv": 275,
        "owner": "ElectraNet（规划）",
        "status": "规划",
        "year": 2030,
        "desc": "AEMO ISP 列为南澳远期（future ISP）输电项目：新建 Bundey—Tungkillo 275 kV 双回线路（约 100 km）并增容既有 Robertstown—Tungkillo 走廊与相关变电站，以释放 Goyder South/North、Hornsdale 等 Mid North 风光储集群经 EnergyConnect 外送的能力；已更名 Northern Transmission Project（NTx），2026 ISP 终稿列为可执行项目；ElectraNet 2026-04 发布 PADR、2026-10 选定 Mid North 段首选走廊（Corridor 5），PACR 预计 2026 年底–2027 年初确定路径与造价。"
      },
      {
        "name": "北部大负荷接入：Olympic Dam 冶炼二炉 / Northern Water 淡化厂 (Davenport 275kV 枢纽)",
        "en": "Northern SA Load Connections (Olympic Dam smelter expansion / Northern Water desalination)",
        "kv": 275,
        "owner": "ElectraNet / BHP / 南澳州政府",
        "status": "规划",
        "year": 2028,
        "desc": "BHP Copper SA 冶炼厂二炉扩建（阴极铜 20 万→50 万吨/年以上，FY27 上半年 FID）与州政府 Northern Water 海水淡化—输水工程（Cape Hardy/上斯宾塞湾，供 Olympic Dam 等矿山）将使 Davenport—Olympic Dam 275 kV 走廊与 Cultana 枢纽成为南澳最大的新增负荷接入点，ElectraNet 正与业主研究增容方案（BHP 报批范围已含 Davenport 起 275 kV 线路升级，州政府 2025-11-05 核定 EIS 评估要求；NTx 北段 Mid North—Whyalla 亦为此类负荷服务）。"
      },
      {
        "name": "Goyder South 风储基地 + Blyth 大电池 (Neoen, BHP 7×24 绿电)",
        "en": "Goyder South Wind/Storage & Blyth BESS",
        "kv": 275,
        "owner": "Neoen",
        "status": "在建",
        "year": 2029,
        "desc": "Burra 一带 Goyder South 一期 412 MW 风电 2024–25 年分期投运，Blyth 电池 238.5 MW/477 MWh 2025-04 投运（NHOA/Elecnor 承建，构网型），合同为 BHP Olympic Dam 提供 70 MW 基荷绿电（2025-07 起履约）；二期 Goyder North（300 MW 风电 + 200 MW/800 MWh 电池）将自 2029-07 起再供 100 MW 7×24 绿电，总规划约 1.2 GW 风电，经 Robertstown 275 kV 接入，是 Mid North REZ 增容的核心驱动。"
      },
      {
        "name": "Hornsdale 储能电站 (Hornsdale Power Reserve)",
        "en": "Hornsdale Power Reserve",
        "kv": 275,
        "owner": "Neoen",
        "status": "投运",
        "year": 2020,
        "desc": "2017 年投运的『特斯拉大电池』，2020 年扩至 150 MW/194 MWh，2022 年启用构网型『虚拟机』模式提供惯量（约 2,000 MWs），是南澳 FCAS 与系统强度服务的标杆，其运行数据常被 AEMO/ElectraNet 用作构网型储能替代同步机组的依据。"
      },
      {
        "name": "Torrens Island 能源枢纽储能 (AGL, 250 MW)",
        "en": "Torrens Island BESS (AGL Energy Hub)",
        "kv": 275,
        "owner": "AGL Energy",
        "status": "投运",
        "year": 2023,
        "desc": "250 MW/250 MWh 构网型电池（Wärtsilä），2023 年投运于 Torrens Island 燃气电站旁，是 AGL 将该站改造为『能源枢纽』并为 Torrens Island B 退役做准备的首个项目；AGL 保留将电池延长至 4 小时（约 1,000 MWh）的扩容选项，2022 年绿氢枢纽可行性研究后尚无投资决定，2025-10 称仍在洽谈能源枢纽合作方。"
      },
      {
        "name": "Hallett 电池储能一期 (EnergyAustralia)",
        "en": "Hallett BESS Stage 1",
        "kv": 132,
        "owner": "EnergyAustralia",
        "status": "在建",
        "year": 2027,
        "desc": "50 MW/250 MWh（5 小时）电池与既有 235 MW Hallett 燃气电站同址，2026-02-13 融资完成、NHOA Energy 集成 + Enerven 土建电气，预计 2027 年中投运，利用既有并网点；二期 200 MW/1,000 MWh 已获规划批准。"
      },
      {
        "name": "石灰岩海岸储能园 (Pacific Green, 1 GW/2.5 GWh)",
        "en": "Limestone Coast Energy Park BESS",
        "kv": 275,
        "owner": "Pacific Green",
        "status": "规划",
        "year": 2027,
        "desc": "南澳东南 Heywood 联络线走廊旁的 1 GW/2.5 GWh 独立储能园，2025 年完成购地并推进审批与 CIS 竞标，EPC 未招标，是南澳 2027 年后最大的开关站/储能撬块采购标的之一。"
      }
    ],
    "vendor": "在南澳卖中高压设备，第一道门是两家 NSP 的准入体系：SA Power Networks 以 Service & Installation Rules、Technical Standards（TS 系列）与核准材料/设备清单约束所有接入与网络工程，新产品需提交 AS/IEC 型式试验报告（AS/IEC 62271 开关设备、AS 60076 变压器、AS/NZS 61439 低压成套、AS 2067 高压变电站设计、AS/NZS 3000 布线、AS/NZS 7000 架空线、AS/NZS 4777.2 逆变器）并经产品评估与现场试用入册，ElectraNet 则通过供应商预审、框架承包商（Downer、UGL、CPP、Zinfra）与项目招标采购，没有型式认可与本地试用记录就进不了采购单。预制变电站 / E-house 按 NCC 作为建筑物需取得 Planning and Design Code 下的开发批准与建筑许可，结构按 AS/NZS 1170 系列——南澳全境为 AS/NZS 1170.2 风区 A、无 C/D 气旋等级要求，但须按 46 °C 以上环境温度做设备降容并考虑 Spencer Gulf/Port Pirie 沿海腐蚀与内陆粉尘；位于 Bushfire Protection Area / SAPN 高林火风险区（HBRA）的站房需按 AS 3959 评定 BAL 等级并满足 Fire Danger Season 的网络防火要求。电气安装必须由 Consumer and Business Services 持牌的电气承包商与电工完成并向 Office of the Technical Regulator 出具 Certificate of Compliance（eCoC），低压在售设备按 RCM/EESS 认证，光伏/储能逆变器另需满足州 Smarter Homes 远程断开规定。本地化方面南澳没有维州 Local Jobs First 那样的法定本地含量法，但 South Australian Industry Participation Policy 对州政府采购（含 RAES、Northern Water、Whyalla 纾困相关工程）要求 Industry Participation Plan 并给予经济贡献评标权重，联邦 ≥A$5 亿项目另需 Australian Industry Participation 计划，CIS 合同亦附带本地供应链与原住民参与承诺——海外厂商通常要与 ICN Gateway 注册的本地集成/安装伙伴（Enerven、CPP、Nilsen、SAGE 等 Adelaide 本地公司）组队并提供本地装配、备件与售后方案。真正的买家分五类：TNSP/DNSP（ElectraNet 的 275/132 kV 站改造、调相机与系统强度项目，SAPN/Enerven 的区域变电站更新、移动变电站、SAPS 与社区电池）；输电与储能 EPC（Downer、UGL、CPP、Zinfra、Beon、GenusPlus、Elecnor、Enerven、NHOA、Wärtsilä/Tesla 集成商，对预制升压站、MV 开关柜与储能撬块需求集中）；风光储开发商与 BESS 运营商（Neoen、AGL、EnergyAustralia、Pacific Green、Iberdrola、ZEN Energy、Amp、Tilt、Equis 等 CIS 中标方）；矿业与冶炼（BHP Olympic Dam/Carrapateena/Prominent Hill 的 11/33 kV E-house 与 275 kV 接入、Nyrstar Port Pirie 铅锌冶炼厂 2025 年纾困后的配电更新、Hillside 铜金矿、Honeymoon 铀矿、Whyalla 钢厂电弧炉改造）；以及新兴负荷（Osborne AUKUS 船厂、Adelaide 数据中心如 NextDC A1、Northern Water 淡化泵站、绿铁/氢能示范）。",
    "tenderPortals": [
      "SA Tenders & Contracts（州政府、RAES、Northern Water、Whyalla 相关招标）：https://www.tenders.sa.gov.au",
      "Office of the Industry Advocate（SA Industry Participation Policy、本地供应商注册）：https://www.industryadvocate.sa.gov.au",
      "ICN Gateway / ICN South Australia（本地供应商注册、重大项目供应链）：https://gateway.icn.org.au",
      "ElectraNet（供应商、项目与 TAPR）：https://www.electranet.com.au",
      "SA Power Networks 行业/承包商门户（SIR、Technical Standards、核准材料）：https://www.sapowernetworks.com.au/industry/",
      "Enerven（SAPN 非监管工程子公司，储能/变电站 EPC）：https://www.enerven.com.au",
      "Department for Energy and Mining（HRE Act release areas、RAES、能源政策）：https://www.energymining.sa.gov.au",
      "Office of the Technical Regulator（电气安全技术规范、eCoC）：https://www.sa.gov.au/topics/energy-and-environment/office-of-the-technical-regulator",
      "Consumer and Business Services（电工与电气承包商执照）：https://www.cbs.sa.gov.au",
      "ASL（原 AEMO Services，CIS 招标执行，含首轮 SA/VIC 试点）：https://asl.org.au",
      "联邦 Capacity Investment Scheme（CIS）招标：https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme",
      "AEMO 2026 ISP（南澳 REZ S1–S9 与远期项目）：https://aemo.com.au/energy-systems/major-publications/integrated-system-plan-isp/2026-integrated-system-plan-isp",
      "联邦 Australian Industry Participation（AIP）计划：https://www.industry.gov.au"
    ],
    "sources": [
      "https://www.electranet.com.au",
      "https://www.electranet.com.au/projects/project-energyconnect/",
      "https://www.electranet.com.au/projects/eyre-peninsula-link/",
      "https://www.transgrid.com.au/projects-innovation/energyconnect/",
      "https://www.energymagazine.com.au/construction-complete-on-australias-largest-transmission-project/",
      "https://utilitymagazine.com.au/energyconnects-critical-dinawan-substation-nears-energisation/",
      "https://www.aer.gov.au/industry/registers/determinations/electranet-determination-2023-28",
      "https://www.aer.gov.au/industry/registers/determinations/sa-power-networks-determination-2025-30",
      "https://www.aer.gov.au/networks-pipelines/service-providers-assets/murraylink-electricity-transmission-interconnector",
      "https://www.aemo.com.au/-/media/files/electricity/nem/planning_and_forecasting/sa_advisory/historical/the20heywood20interconnector20upgradeupdate202015.pdf",
      "https://aemo.com.au/energy-systems/major-publications/integrated-system-plan-isp/2026-integrated-system-plan-isp",
      "https://aemo.com.au/energy-systems/major-publications/integrated-system-plan-isp/2024-integrated-system-plan-isp",
      "https://www.sapowernetworks.com.au",
      "https://www.sapowernetworks.com.au/industry/",
      "https://www.enerven.com.au",
      "https://www.energymining.sa.gov.au",
      "https://www.industryadvocate.sa.gov.au",
      "https://www.tenders.sa.gov.au",
      "https://gateway.icn.org.au",
      "https://asl.org.au",
      "https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme",
      "https://www.dcceew.gov.au/energy/renewable/offshore-wind/areas/southern-ocean",
      "https://hornsdalepowerreserve.com.au",
      "https://www.neoen.com",
      "https://www.agl.com.au/about-agl/how-we-source-energy/torrens-island-energy-hub",
      "https://reneweconomy.com.au/port-augusta-power-station-sale-to-mark-final-closure-of-south-australias-coal-90043/",
      "https://www.pv-magazine-australia.com/2019/05/10/final-curtain-falls-on-south-australias-coal-fired-era",
      "https://www.ecsa.sa.gov.au",
      "https://www.cbs.sa.gov.au",
      "https://www.sa.gov.au/topics/energy-and-environment/office-of-the-technical-regulator"
    ]
  },
  "WA": {
    "abbr": "WA",
    "name": "西澳大利亚州",
    "en": "Western Australia",
    "grid": "WEM/SWIS（西南互联系统，AEMO 运行，不属 NEM）+ NWIS（Pilbara 西北互联系统，Pilbara ISO 协调）+ Horizon Power 30 余个区域微网 + 矿区离网自备电网",
    "operator": "AEMO（WEM / SWIS 市场与系统运行）；Pilbara ISO（NWIS，Pilbara Networks Rules）；Horizon Power（区域独立系统）；监管：Economic Regulation Authority (ERA) + Energy Policy WA (Coordinator of Energy)",
    "summary": "西澳是澳洲大陆唯一不在 NEM 的州：主网 SWIS 以 Perth 为中心，北到 Geraldton/Kalbarri、东到 Kalgoorlie、南到 Albany，由 AEMO 运行的 WEM（含容量机制）供电；当前电源仍以 Collie 片区煤电（Collie、Muja D、Bluewaters 合计约 1.2 GW）与 Synergy/Alinta 等燃气为基荷，屋顶光伏（>2.5 GW）为最大单一电源，可再生占比约三分之一强（比例本次未核验）。到 2030 年国有煤电全部退出，Collie 转为 >1 GW 的储能枢纽，Synergy 大储 + 风电 + 燃气调峰与 Western Power 330 kV Clean Energy Link 南北走廊是电网资本开支的主线；SWIS Demand Assessment 预计 2042 年前负荷成倍增长（绿色工业、绿氢、数据中心、电气化），需要数千公里新输电线。Pilbara NWIS 与矿企自备网由铁矿脱碳驱动，是全球最大的离网/弱网风光储市场之一，也是预制舱升压站、移动变电站与 E-house 的最直接买家。AEMO 2026 WEM ESOO（2026-06）：2028-29 容量年峰值储备容量目标 6,323 MW，现有 + 承诺容量盈余 347 MW；2029-30 起出现 166 MW 缺口并在 2035-36 扩大到 2,161 MW，预期项目按期交付可把缺口推迟到 2031-32；2030-31 前将新增逾 1,000 MW 承诺发电与储能（含 CIS 与 Priority Project 支持项目），预期储能逾 600 MW，2026 储备容量周期 EOI 收到 85 份、约 3,747 MW；2026 周期起新储能的容量义务时长升至 7 小时，2028-29 基准储备容量价格 A$488,500/MW·年（上限 732,750、下限 244,250）。",
    "tnsp": {
      "name": "Western Power（SWIS 输配一体网络运营商，西澳没有独立 TNSP）",
      "owner": "西澳州政府（Electricity Networks Corporation，依 Electricity Corporations Act 2005 设立的政府贸易企业 GTE，由能源部长代表州持有）",
      "voltages": "330/220/132/66 kV 输电 + 33/22/11 kV 配电 + 19 kV SWER",
      "notes": "总部 Perth（363 Wellington Street）。服务 SWIS 约 120 万用户、线路约 10 万 km（输电约 7,800 km）、区域变电站 160 余座（规模数字本次离线编制未能核验）。由 ERA 依 Electricity Networks Access Code 2004 监管，当前为 AA5 监管期（2022-07-01 至 2027-06-30，ERA 终案 2023 年），下一期 AA6（2027-07-01 至 2032-06-30）提案按 Access Code 时序应于 2026 年提交 ERA、2027 年中前终案——本次未能核验 AA5 核定资本开支额与 AA6 提案金额/提交日期，请以 ERA 决定页为准。旗舰计划：Clean Energy Link North（Three Springs–Pinjar–Neerabup 330 kV 走廊增容与枢纽站扩建，接入 Mid West 风光）；Clean Energy Link South（Collie–Kemerton–Perth 南部走廊，承接退煤与 Kemerton 工业/未来海上风电）；Collie、Kwinana、Muchea 等大储接入；SAPS（偏远长馈线改独立光储系统，已部署逾 500 套、规划十年内约 4,000 套）；Wooroloo 2021 大火后的木杆更新与林火治理；Perth 北部 Alkimos/Yanchep、东南 Byford/Mundijong 增长走廊新建区域变电站；PowerBank 社区电池与 DER 动态运行包络（Project Symphony）；州政府与联邦 Rewiring the Nation（对 WA 最高约 A$30 亿优惠融资，SWIS + Pilbara）共同注资。"
    },
    "dnsps": [
      {
        "name": "Western Power（SWIS 配电）",
        "area": "SWIS 全域：Perth 都会区、Peel/Mandurah、西南（Bunbury、Busselton、Margaret River、Albany）、Wheatbelt（Northam、Merredin、Narrogin）、中西部（Geraldton、Kalbarri、Three Springs）与 Goldfields（Kalgoorlie-Boulder）——西澳唯一公用大网 DNSP（Esperance 除外，属 Horizon Power）",
        "hq": "Perth（363 Wellington Street）",
        "owner": "西澳州政府（Electricity Networks Corporation，GTE）",
        "voltages": "33/22/11 kV 配电 + 19 kV SWER + 415/240 V（上接 66/132/220/330 kV 输电）",
        "notes": "接入与资产技术规范：ERA 批准的 Technical Rules、WA Distribution Connections Manual（WADCM）、Western Power Network Standards 与设备技术规格；新设备须经 Western Power 产品/材料核准（核准材料与设备登记，要求 AS/IEC 型式试验报告与现场试用，流程名称本次未核验），并符合 WA Electrical Requirements（WAER）。采购：Western Power 供应商注册 + Tenders WA 公示，施工/维护以长期框架/面板合同承包（GenusPlus 五年配网+输电架空服务框架、Ventia 五年输配网维护面板约 A$1.5 亿、UGL 架空维护及 Clean Energy Link 枢纽站/330 kV 线路包、Acciona CEL-North 线路包等），受 WA Jobs Act 参与计划约束。AA5 资本开支主题：1950–70 年代木杆与区域变电站到寿更新、林火高风险区（Wooroloo 2021、Parkerville 2014 后）覆盖导线/快速保护、北部 Alkimos–Yanchep 与东南 Byford 增长走廊新站、Clean Energy Link 南北走廊、Collie/Kwinana/Muchea 大储接入、SAPS 与社区电池、EV 充电与 METRONET 铁路牵引供电、Kwinana/Rockingham 锂精炼与数据中心（NEXTDC、AirTrunk、Equinix）等工业负荷接入；移动变电站/模块化变电站用于到寿更新与应急（如 33 MVA、132 kV 一次侧的快速响应移动变电站 RRST-T81，车队总数未公开）。"
      },
      {
        "name": "Horizon Power（区域电力公司）",
        "area": "SWIS 以外的西澳全部区域：Kimberley（Broome、Derby、Fitzroy Crossing、Halls Creek、Kununurra/Wyndham 东 Kimberley 互联系统）、Pilbara NWIS（Karratha、Roebourne、Port Hedland/South Hedland、Marble Bar、Nullagine）、Gascoyne/Mid West（Carnarvon、Exmouth、Denham、Meekatharra、Cue、Mount Magnet、Wiluna）、北 Goldfields（Laverton、Leonora、Menzies）、南海岸 Esperance/Hopetoun 及 20 余个偏远原住民社区",
        "hq": "Bentley（Perth 都会区），区域中心 Karratha / Broome / Kununurra / Esperance / Carnarvon",
        "owner": "西澳州政府（Regional Power Corporation，GTE，发输配售一体）",
        "voltages": "220/132/66 kV（NWIS 输电）+ 33/22/11 kV 配电 + 19 kV SWER + 415/240 V",
        "notes": "约 4.7 万用户连接（覆盖逾 10 万居民）、服务面积约 230 万 km²、30 余个独立微网。技术规范：Horizon Power Technical Rules（NWIS 下为 Pilbara Networks Technical Rules）、Distribution/Transmission 接入标准与核准设备清单，沿用 WA Electrical Requirements；偏远站点与气旋区（AS/NZS 1170.2 风区 D/C）决定其偏好预制化、模块化、可空运/海运的设备。采购走 Tenders WA 与 Horizon 供应商注册，受 WA Jobs Act 约束（区域本地含量权重更高）。当前资本主题：Pilbara 气旋韧性与网架重建（2025-01 气旋 Sean 袭 Karratha、2025-02 气旋 Zelia 重创 Port Hedland 片区）、South Hedland 等地下电缆化（Pilbara Underground Power）、Esperance 风光储微网（Contract Power/Pacific Energy 供电 + Horizon 网络）、Kununurra Ord 水电联网区 DER、Denham 氢能微网示范、偏远原住民社区光储改造、集中式 SAPS 替代老旧 SWER 线、WA EV 快充网络（Perth–Kununurra）、矿业与绿氢负荷（Boodarie、Maitland、Ashburton North SIA）接入与 NWIS 公用输电骨干前期工作。"
      },
      {
        "name": "Pilbara 矿企 / APA 自营网络（NWIS 综合区域许可持有人，非公用 DNSP）",
        "area": "Pilbara：Port Hedland–Newman（APA，原 Alinta Pilbara 业务）、Dampier/Cape Lambert–Tom Price–Paraburdoo（Rio Tinto Pilbara Iron）、Newman Yarnima–Mt Whaleback–Port Hedland（BHP WAIO）、Solomon–Christmas Creek–Cloudbreak–Iron Bridge（Fortescue PEC）、Roy Hill 矿区",
        "hq": "Perth（各矿企/APA 西澳总部）",
        "owner": "APA Group（2024 年收购 Alinta Energy Pilbara 业务，约 A$17 亿）、Rio Tinto、BHP、Fortescue、Hancock/Roy Hill",
        "voltages": "220/132/33 kV 矿区输配 + 11/6.6 kV 矿区配电",
        "notes": "持 ERA 综合区域许可（Integrated Regional Licence），依 Pilbara Networks Access Code 2021 轻监管开放接入，Pilbara ISO 协调 NWIS 运行。不是公用 DNSP，但却是西澳中高压设备最大的『私营买家』：矿区脱碳驱动 GW 级风光储（Rio Tinto 1 GW 可再生计划、BHP WAIO >500 MW 风光储与 Port Hedland 绿电 PPA、Fortescue PEC 2–3 GW、APA Port Hedland 光储与 Chichester 太阳能），需要 33/132 kV 预制舱升压站、储能并网舱、移动变电站与中压成套开关柜。采购经矿企自有 EPC/框架（Monford、GenusPlus、Zenith Energy、Pacific Energy/Contract Power、Clough-Webuild、Worley/Hatch 设计）与自营供应商预审，设备要求 AS/IEC 型式试验、风区 D 气旋等级、50 °C 环境温度降容、沙尘/盐雾防护，交付以预制舱/E-house 为主流。"
      }
    ],
    "rezBody": "西澳没有 NSW EnergyCo / VIC VicGrid 式的法定 REZ 划定机构，AEMO ISP 亦不覆盖 WA。主网规划由 Energy Policy WA（Coordinator of Energy）主导：2020 Whole of System Plan → 2023-05 SWIS Demand Assessment 提出 2042 年前新增最多约 51 GW 电源与储能、约 4,000 km 新建高压输电线，具体走廊由 Western Power 以 Clean Energy Link North/South 等计划落实并经 ERA Access Arrangement 核定资本开支；AEMO (WA) 发布 WEM ESOO 与 Reserve Capacity 结果提示容量缺口。Pilbara 由 Energy Policy WA 的 Pilbara Energy Transition Plan 规划公用输电骨干（联邦 Rewiring the Nation 优惠融资）。海上风电申报区由联邦 DCCEEW 划定（Bunbury）。工业负荷『开发区』则是 DevelopmentWA 的战略工业区（SIA）。",
    "rezs": [
      "Mid West / North Country corridor（Clean Energy Link North：Three Springs–Eneabba–Geraldton 风光，330 kV 接入 Perth）",
      "South West / Collie–Kemerton corridor（Clean Energy Link South：Collie 储能枢纽 + Kemerton 工业区）",
      "Eastern Goldfields / Kalgoorlie corridor（单回 655 km 220 kV 矿业负荷走廊，暂无输电增容计划，以 ≤150 MW 本地电池/备用电源招标补强）",
      "Pilbara NWIS common-user infrastructure（Pilbara Energy Transition Plan，Karratha–Port Hedland–Newman 220 kV 公用骨干，规划中）",
      "Bunbury Offshore Wind Declared Area（联邦 2024-09 划定）",
      "Strategic Industrial Areas: Oakajee（Mid West 绿氢）、Boodarie / Maitland / Ashburton North / Anketell（Pilbara）、Kwinana-Rockingham、Collie Shotts（DevelopmentWA，非法定 REZ）"
    ],
    "policy": "州目标：净零 2050，州政府机构（含 Synergy、Western Power、Horizon Power）2030 年排放较 2020 年降 80%；没有立法的可再生占比目标（州气候变化立法推进状态本次未核验）。退煤政策：2022-06 宣布国有煤电 2030 年前全部退役（Collie 2027、Muja D 2029），配套约 A$38 亿国有新能源与储能投资（Synergy Collie BESS、Kwinana BESS、King Rocks 风电等）与 A$5.474 亿 Collie 转型包（含 A$2 亿 Collie 工业转型基金，后增至 A$2.3 亿）；私营 Bluewaters 未设法定退役日。2025-03 Cook 工党政府连任，路线延续，并以 Clean Energy Link 与 Rewiring the Nation（联邦对 WA 最高约 A$30 亿优惠融资）扩建输电。国有开发主体：Synergy（发电/零售/大储与风电）、Horizon Power（区域微网、SAPS、Pilbara）、Western Power（网络）；州没有 NSW LTESA 式长期合约招标，Synergy 以自有招标采购，但 WEM 参与联邦 Capacity Investment Scheme（WEM 专项可调度/发电标段，中标项目与规模本次未核验）。海上风电：联邦 2024-09 划定 Bunbury 申报区，2026-01 向 3 个项目（Oceanex/EDF 的 Bunbury North/South、Ocean Winds 的 Westward Wind，合计约 4 GW、约 730 km²）发放可行性许可。其他：Domestic Gas Policy（15% 国内留存）、WA Battery & Critical Minerals Strategy（Kwinana 锂精炼集群）、Pilbara 氢能枢纽（联邦 A$7,000 万）、WA EV Network 充电走廊。",
    "coalExit": "国有煤电 2030 年前全退：Collie（Synergy，340 MW，1999 年投运）2027-10 关停，由 Synergy Collie BESS 500 MW/2,000 MWh（2026 年初投运）与 Neoen Collie Battery 560 MW/2,240 MWh 承接；Muja D 7–8 号机（Synergy，约 450 MW）2029-10 关停，Muja C 5 号机 2022-10、6 号机 2025-04 已退役，Muja AB 2018 已关。私营 Bluewaters（434 MW，2009 年投运，债权人控制）无正式关停日期——AEMO 2025 WEM 展望按其运行至本十年末，2025-09 州政府提前关停方案据报生变，2026-01 州政府将 Griffin Coal 供煤补贴协议延至 2031-06（补贴额度下调，2022 年以来累计约 A$3.08 亿）。AEMO 提示 2027-28 起 SWIS 若无新增可调度容量将出现缺口，因此退煤倒计时同步意味着燃气调峰、大储与 330 kV 走廊的集中采购窗口。AEMO 2026 WEM ESOO 建模口径：Collie 2027-10-01、Muja G7/G8 2029-10-01 退出，Bluewaters 两台机组假定 2031-10-01 起不可用，Synergy Pinjar 燃机 2031-32 起分期退役（GT1–5/GT7 2031-10、GT9 2032-10、GT10 2034-10），Tesla Geraldton 2027-10、Tiwest 热电 2034-12 退出；2031-32 起若无新增可调度容量，缺口迅速扩大。",
    "keyProjects": [
      {
        "name": "清洁能源链北线 330kV 走廊 (Clean Energy Link North)",
        "en": "Clean Energy Link – North (Three Springs–Pinjar–Neerabup 330 kV corridor)",
        "kv": 330,
        "owner": "Western Power（州政府拨款 + 联邦 Rewiring the Nation 优惠融资）",
        "status": "在建",
        "year": 2028,
        "desc": "把 Mid West/North Country 风光接入 Perth 的 330 kV 走廊：Pinjar–Three Springs 既有 330 kV 线增容加回、Neerabup/Three Springs 枢纽站扩建与新建变电站，是 SWIS 退煤后第一条『输电骨干』；分期建设，首期线路/变电站施工合同据报授予本地 EPC（投运年份、总投资与承包商本次未核验）。"
      },
      {
        "name": "清洁能源链南线 330kV (Clean Energy Link South)",
        "en": "Clean Energy Link – South (Collie–Kemerton–Perth south-west 330/132 kV upgrades)",
        "kv": 330,
        "owner": "Western Power",
        "status": "规划",
        "year": 2030,
        "desc": "围绕 Collie 储能/风电枢纽与 Kemerton 工业区（锂精炼、未来 Bunbury 海上风电登陆点）增强 Collie–Kemerton–Perth 330/132 kV 走廊与枢纽站，承接 Muja/Collie 退煤后的南部电源重构，处于规划与前期设计阶段。"
      },
      {
        "name": "科利大电池 CBESS (Synergy 500MW/2000MWh)",
        "en": "Synergy Collie Battery Energy Storage System (CBESS)",
        "owner": "Synergy（州政府）",
        "status": "投运",
        "year": 2026,
        "desc": "Collie 煤电厂旁 500 MW 级国有大储（能量规模 2,000 MWh 或 2,400 MWh 两种口径并存，待以 Synergy 官网统一；宁德时代电芯，投资逾 A$16 亿），接入 Collie 输电枢纽，2026 年 2 月全容量投运时为澳洲已投运最大电池，预留扩至 1 GW/4 GWh，是 Collie 电厂 2027-10 退役的直接替代容量。"
      },
      {
        "name": "Neoen 科利电池一期+二期 (560MW/2240MWh)",
        "en": "Neoen Collie Battery Stage 1 (219 MW/877 MWh) + Stage 2 (341 MW/1,363 MWh)",
        "owner": "Neoen（Tesla Megapack，UGL 施工）",
        "status": "投运",
        "year": 2025,
        "desc": "私营开发商 Neoen 在 Collie 分两期建设的电池，一期 2024 年、二期 2025 年投运，合计 560 MW / 2,240 MWh，持有 WEM 容量信用，与 Synergy CBESS 共同把 Collie 变为 >1 GW 的 SWIS 储能枢纽。"
      },
      {
        "name": "奎纳纳电池一期/二期 (Synergy KBESS 100MW/200MWh + 200MW/800MWh)",
        "en": "Synergy Kwinana BESS 1 & 2",
        "owner": "Synergy",
        "status": "投运",
        "year": 2025,
        "desc": "位于 Kwinana 工业区原燃气电厂场地，KBESS1 100 MW/200 MWh（2023）与 KBESS2 200 MW/800 MWh（2024–25）先后投运，是西澳首批公用事业级储能，验证了 Synergy『以储代煤』路线。"
      },
      {
        "name": "穆奇亚长时电池 (Neoen Muchea 164MW/905MWh)",
        "en": "Neoen Muchea BESS",
        "owner": "Neoen",
        "status": "在建",
        "year": 2027,
        "desc": "Perth 以北约 50 km Muchea 的 164 MW / 905 MWh（约 5.5 小时）长时电池，接入 Western Power 北部输电走廊，支撑 Clean Energy Link North 风光外送与 Muja 退役后的晚峰保供。"
      },
      {
        "name": "皮尔巴拉公用输电骨干 (Pilbara common-user infrastructure)",
        "en": "Pilbara Energy Transition – common-user transmission backbone (NWIS)",
        "kv": 220,
        "owner": "Energy Policy WA / Horizon Power（联邦 Rewiring the Nation 优惠融资）",
        "status": "规划",
        "year": 2030,
        "desc": "州政府 Pilbara Energy Transition Plan 提出以 220 kV 公用输电骨干联通 Karratha–Port Hedland–Newman 的矿企自备网与 Horizon Power/APA 网络，接入大规模风光储并向第三方开放，服务铁矿脱碳、绿氢与 Boodarie/Maitland SIA；处于规划与前期开发阶段：州政府划定 4 条优先走廊（东、西 Pilbara 各 2 条）并依托联邦 Rewiring the Nation 最高 A$30 亿优惠融资，首段为 Horizon Power 的 Burrup 132 kV 公用线，APA 走廊正洽签 Corridor Development Agreement，整体路径与投资额尚未公布。"
      },
      {
        "name": "福特斯库皮尔巴拉能源连接 PEC 629km 输电网",
        "en": "Fortescue Pilbara Energy Connect (629 km private 220/132 kV grid + solar/BESS)",
        "kv": 220,
        "owner": "Fortescue",
        "status": "在建",
        "year": 2030,
        "desc": "全球最大矿企自建电网之一：629 km 220/132 kV 线路串联 Solomon、Christmas Creek、Cloudbreak、Iron Bridge 等矿区，配 North Star 100 MW 光伏、储能及后续 2–3 GW 风光储，目标 2030 年铁矿运营『真零』，预制舱升压站/储能并网舱需求批量化。"
      },
      {
        "name": "邦伯里海上风电申报区 (Bunbury offshore wind zone)",
        "en": "Bunbury Offshore Wind Declared Area",
        "owner": "联邦 DCCEEW 划定；可行性许可申请方待公布",
        "status": "规划",
        "year": 2035,
        "desc": "2024-09 联邦宣布西澳首个海上风电申报区（Bunbury 外海 Cape Naturaliste–Dawesville 之间，面积约 4,000 km²、离岸 ≥30 km），潜力最高 11.4 GW；可行性许可评审进展本次未能核验，登陆点预计指向 Kemerton/Collie 330 kV 枢纽。"
      },
      {
        "name": "国王岩风电场 (Synergy King Rocks)",
        "en": "Synergy King Rocks Wind Farm (Hyden, Wheatbelt)",
        "owner": "Synergy",
        "status": "规划",
        "year": 2028,
        "desc": "Synergy 在 Wheatbelt Hyden 东北约 35 km 在建的国有风电项目（17 台 Vestas V162-6.2 MW、105 MW，州政府投入 A$5.13 亿，2025-10 开工、2027 年投运），是 2022 年约 A$38 亿『以绿电替代煤电』投资包的主体项目之一，需新建接入线并入 Western Power 东部网架。"
      }
    ],
    "vendor": "在西澳卖中高压设备，第一道门是两家州有 NSP 的准入体系：Western Power 以 ERA 批准的 Technical Rules、WA Distribution Connections Manual、Network Standards 与核准材料/设备登记约束一切接入与网络资产，Horizon Power 另有自己的 Technical Rules 与核准设备清单，新产品都要先提交 AS/IEC 型式试验报告（AS/IEC 62271 开关设备、AS 60076 变压器、AS/NZS 61439 低压成套、AS 2067 高压变电站、AS/NZS 3000 布线、AS/NZS 7000 架空线、AS/NZS 4777.2 逆变器）并通过产品评估与现场试用，否则进不了采购单；Pilbara 矿企与 APA 不受公用 NSP 清单约束，但执行同等 AS/IEC 型式试验加各自工程规范，采购走矿企自有 EPC 与供应商预审。预制变电站 / E-house 作为建筑物须按 NCC 与 WA Building Act 2011 取得建筑许可（或走网络基础设施豁免路径），结构按 AS/NZS 1170 系列：Pilbara 沿海 Exmouth–Karratha–Port Hedland 为风区 D（全澳最高气旋等级）、Kimberley 与 Carnarvon 为风区 C、Perth/西南为风区 A，并须按 50 °C 环境温度降容与盐雾/沙尘防护；位于 DFES 林火易发区（SPP 3.7）的站房需按 AS 3959 做 BAL 评定。本地含量方面，WA Jobs Act 2017 / WAIPS 要求州政府机构及 Western Power、Synergy、Horizon Power 等 GTE 的招标（货物/服务约 A$100 万、工程约 A$500 万以上，区域门槛更低，具体以 JTSI 现行政策为准）附参与计划并计分，联邦资助项目另需 Australian Industry Participation 计划，WA 还对 Collie、Pilbara 等区域项目加权本地就业。电气施工必须由 Building and Energy（DEMIRS）持牌的电气承包商执行，并遵守 WA Electrical Requirements。真正的买家：Western Power、Horizon Power、Synergy（大储/风电）；它们的框架 EPC（GenusPlus、Zinfra、Downer、UGL、Ventia、Monford）；Pilbara 矿企（Rio Tinto、BHP、Fortescue、Roy Hill、Mineral Resources）、APA 与离网电力商（Zenith Energy、Pacific Energy/Contract Power、Juwi）；BESS 开发商（Neoen、Atmos、Frontier Energy、Potentia）；Kwinana 锂精炼与 Perth 数据中心（NEXTDC、AirTrunk、Equinix）。供货窗口集中在 2026–2030：Collie/Muja 退煤倒计时、Clean Energy Link 南北走廊、Pilbara 公用骨干与矿区脱碳。（本条目为离线编制，上述准入流程名称、门槛与承包商名单请在投标前以官网核验。）",
    "tenderPortals": [
      "Tenders WA（州政府、Western Power、Horizon Power、Synergy 公开招标）：https://www.tenders.wa.gov.au",
      "WA Industry Link / WAIPS（JTSI 本地参与计划与本地供应商资源）：https://industrylink.wa.gov.au",
      "ICN Gateway（本地供应商注册、重大项目供应链）：https://gateway.icn.org.au",
      "Western Power（供应商、Technical Rules、WADCM、Network Standards）：https://www.westernpower.com.au",
      "Horizon Power（供应商、Technical Rules、区域项目）：https://www.horizonpower.com.au",
      "Synergy（大储/风电项目与采购）：https://www.synergy.net.au",
      "Economic Regulation Authority（Western Power Access Arrangement、电力许可）：https://www.erawa.com.au",
      "Energy Policy WA（SWIS Demand Assessment、Pilbara Energy Transition、政策）：https://www.wa.gov.au/organisation/energy-policy-wa",
      "AEMO WEM（WEM ESOO、Reserve Capacity、Pilbara 之外的 SWIS 市场）：https://aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem",
      "Building and Energy（DEMIRS，电气承包商执照、WA Electrical Requirements）：https://www.wa.gov.au/organisation/building-and-energy",
      "ASL（原 AEMO Services，CIS 招标执行）：https://asl.org.au",
      "联邦 Capacity Investment Scheme（含 WEM 专项标段）：https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme",
      "联邦 Bunbury 海上风电申报区：https://www.dcceew.gov.au/energy/renewable/offshore-wind/areas/bunbury",
      "DevelopmentWA（战略工业区 SIA：Oakajee、Boodarie、Maitland、Kwinana）：https://developmentwa.com.au",
      "联邦 Australian Industry Participation（AIP）计划：https://www.industry.gov.au"
    ],
    "sources": [
      "https://www.aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/wem-forecasting-and-planning/wem-electricity-statement-of-opportunities-wem-esoo","https://www.westernpower.com.au/about/reports-publications/access-arrangement/",
      "https://www.erawa.com.au/electricity/electricity-access/western-power-network",
      "https://www.wa.gov.au/organisation/energy-policy-wa",
      "https://aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem",
      "https://www.horizonpower.com.au",
      "https://www.synergy.net.au",
      "https://www.wa.gov.au/government/media-statements/McGowan%20Labor%20Government/Muja-Power-Station-in-Collie-to-be-scaled-back-from-2022-20190805",
      "https://www.nzea.gov.au/collie-wa",
      "https://www.etunational.asn.au/wp-content/uploads/2026/05/Collie-NZEA-Joint-Union-COI-Submission-May-2026-1.pdf",
      "https://www.abc.net.au/news/2025-09-18/wa-coal-phaseout-uncertain-amid-energy-grid-upgrade-plan/105788864",
      "https://www.abc.net.au/news/2025-07-07/griffin-coal-mine-debt-bluewaters-power/105492506",
      "https://www.colliebulletin.com.au/muja-unit-6-generator-retired-decommissioning-activities-underway?amp=1",
      "https://www.businessnews.com.au/article/Two-coal-units-to-close-at-Muja",
      "https://www.gem.wiki/Collie_power_station",
      "https://www.gem.wiki/Muja_Power_Station",
      "https://www.gem.wiki/Bluewaters_power_station",
      "https://www.dcceew.gov.au/energy/renewable/offshore-wind/areas/bunbury",
      "https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme",
      "https://www.wa.gov.au/organisation/department-of-jobs-tourism-science-and-innovation/western-australian-industry-participation-strategy-waips",
      "https://www.tenders.wa.gov.au",
      "https://gateway.icn.org.au",
      "https://www.wa.gov.au/organisation/building-and-energy",
      "https://developmentwa.com.au"
    ]
  },
  "TAS": {
    "abbr": "TAS",
    "name": "塔斯马尼亚州",
    "en": "Tasmania",
    "grid": "NEM（国家电力市场）TAS1 区域（2005-05 加入 NEM）；经 Basslink 400 kV 单极 HVDC（Loy Yang VIC—George Town TAS，500 MW 持续南送 / 约 630 MW 短时北送，370 km，APA Group 所有，AER 2026-02-27 终案后自 2026-07-01 起由市场型联络线转为受监管输电资产）连 VIC；Marinus Link 一期 750 MW ±320 kV HVDC（Heybridge—Waratah Bay—Hazelwood）2026-10 正式开工、目标 2030 年投运，二期 750 MW 待决；King Island 与 Flinders Island 为 Hydro Tasmania 运营的离网混合（柴油 + 风 + 光 + 储能/飞轮）孤网，不属 NEM。",
    "operator": "AEMO（NEM 市场与系统运营，TAS1 区域；塔州执行独立于大陆的宽频率带 Tasmanian Frequency Operating Standard，并因 Basslink 单极特性对系统强度/惯量与 FCAS 有专门安排）；TasNetworks 为塔州 Jurisdictional Planning Body（年度 Transmission Annual Planning Report、RIT-T，并执行 NER 第 5 章输电接入流程）；Office of the Tasmanian Economic Regulator（OTTER）负责电力许可、小客户标准零售电价监管、Tasmanian Electricity Code 与配网可靠性标准；Renewables, Climate and Future Industries Tasmania（ReCFIT，隶属 Department of State Growth）主导州能源政策、TRET、REZ 框架、氢能与 Battery of the Nation；Consumer, Building and Occupational Services（CBOS，Department of Justice）发放电气承包商/电工执照并管理建筑控制；WorkSafe Tasmania 负责电气安全监管。",
    "summary": "塔斯马尼亚是澳大利亚唯一以水电为主体的州：Hydro Tasmania 30 座水电站（连同 Tamar Valley 燃气机组，集团总装机约 2.6 GW，年报口径）加上 Woolnorth/Musselroe/Granville Harbour/Cattle Hill 等约 0.6 GW 风电，2020-11 起已实现本州用电 100% 可再生自给（发电量口径），无燃煤电厂，Tamar Valley 燃气机组仅作枯水/备用，余缺靠 Basslink 与大陆互济；四大工业用户（Bell Bay Aluminium、Nyrstar Hobart、Liberty Bell Bay、Norske Skog Boyer）约占州内负荷六成。方向是法定 TRET——2030 年达 2020 年发电量的 150%、2040 年 200%（约 21,000 GWh）——以『国家电池 Battery of the Nation』（Cethana 抽蓄、既有水电增容）+ Marinus Link 第二联络线把塔州风电与水电储能卖往退煤中的大陆，并以 Bell Bay 氢能/绿色燃料、Launceston Firmus AI 数据中心等新负荷消纳本州绿电。电网资本开支由四条主线驱动：Marinus Link 一期（2026-10 开工、2030 年投运）及其前置的 TasNetworks 西北输电工程（NWTD，Hampshire—Staverton—Sheffield 220 kV 与 Heybridge 新站）、北西部/中部高地 REZ 风电（Robbins Island、Cellars Hill、St Patricks Plains 等）送出、TasNetworks 2024–29 期的输电/配电老旧资产更新与林火韧性，以及 Bell Bay 工业区与 Launceston/Hobart 新增大负荷接入。",
    "tnsp": {
      "name": "TasNetworks（Tasmanian Networks Pty Ltd）— 输配一体的州有网络公司",
      "owner": "塔斯马尼亚州政府 100%（State-owned Company，股东为 Treasurer 与 Minister for Energy and Renewables）；2014-07 由输电公司 Transend Networks 与 Aurora Energy 配网业务合并而成",
      "voltages": "220/110 kV（输电）",
      "notes": "塔州唯一 TNSP，总部 Hobart（Lenah Valley, Maria Street），约 3,600 回路公里输电线路、49 座输电变电站（另 7 座开关站）；220 kV 为骨干（Farrell—Sheffield—Palmerston—George Town—Hadspen 北部环，Waddamana—Liapootah—Chapel Street 南下 Hobart），110 kV 覆盖西海岸矿区（Farrell—Rosebery—Queenstown）、西北（Burnie—Smithton）与东北；George Town 220 kV 为 Basslink 换流站与 Bell Bay 工业区落点，Sheffield 为 Mersey-Forth 水电与 NWTD 枢纽，Hampshire 为西北风电汇集点。监管期 2024–29（2024-07-01 至 2029-06-30），AER 2024-04-30 发布输电 + 配电合并终案——核定收入配电约 A$18.5 亿、输电约 A$8.9 亿（名义、平滑后，合计约 A$27.4 亿），输电资本开支核定约 A$2.9 亿（2023–24 价），配电资本开支提案净额约 A$7.3 亿（终案数请以 AER 决定页为准）；2029–34 期收入提案预计 2028-01 提交。旗舰项目：(1) North West Transmission Developments（NWTD）——新建 Hampshire—Staverton—Sheffield 220 kV 双回线、Sheffield—Palmerston 220 kV 增容、新建 Heybridge 220 kV 变电站（Marinus 换流站接入点）及 Hampshire/Sheffield/Palmerston 站扩建，为 Marinus 一期与北西 REZ 送出的前置工程，2026-02 与 Marinus 同获 AER 批复、CEFC/Rewiring the Nation 优惠融资支持，目标与 Marinus 同步在 2030 年前投运（一期 129 km：Cressy/Palmerston—Sheffield—Heybridge/Burnie 新建与增容线路及新建变电站/开关站，造价估算约 A$13.2 亿，主承包商 GenusPlus〔2024-12 委任，合同约 A$7.5 亿〕，2026-05 融资关闭、主体施工预计 2026 Q3 起；二期 Staverton—Hampshire Hills 约 A$5.5 亿另行推进）；(2) Marinus Link 配套的 Heybridge 220 kV 接入与系统强度措施；(3) 既有 220/110 kV 老旧资产更新（1950–70 年代水电送出线与变电站、变压器/断路器到寿替换、保护与通信更新）；(4) 中部高地 Waddamana/Palmerston 一带 REZ 并网增容（Cattle Hill、St Patricks Plains、Cellars Hill 等）；(5) George Town/Bell Bay 氢能与 Launceston 数据中心等大负荷接入研究。采购模式：常规输配电维护/资本工程/应急抢修由单一战略伙伴 Zinfra 承担（5 年 Distribution and Transmission Services 合同，取代此前多家承包商 panel 模式）+ 大项目单独招标（如 NWTD 一期主承包商 GenusPlus），设备须通过 TasNetworks 供应商预审、核准设备/材料评审与 AS/IEC 型式试验审查。"
    },
    "dnsps": [
      {
        "name": "TasNetworks（配电业务）",
        "area": "塔斯马尼亚本岛全部并网区域：Hobart 都会区（Glenorchy、Kingston、Clarence）、Launceston 与 Tamar Valley、Devonport—Burnie 西北沿海、Smithton—Circular Head、西海岸矿业城镇（Queenstown、Rosebery、Zeehan、Strahan）、中部高地与 Midlands 农业区、东海岸（St Helens—Swansea）、Huon Valley 与 Bruny Island（海底电缆供电）——全州唯一持牌 DNSP（Bass Strait 两岛除外）",
        "hq": "Hobart（Lenah Valley）",
        "owner": "塔斯马尼亚州政府 100%（同 TNSP，输配一体）",
        "voltages": "33/22/11 kV 配电（少量旧区馈线仍为 6.6 kV）+ 19.1 kV SWER + 400/230 V",
        "notes": "约 29.5 万用户、约 22,400 km 架空/地下配电线路（约 22.7 万根电杆），地广人稀、用户密度低，冬季为用电高峰（电采暖为主，与大陆夏峰相反），林火、强风与山区覆冰并存。监管期 2024–29，AER 2024-04 终案（配电核定资本开支数本次未核验）。资本开支主题：老旧区域变电站（zone substation）与 33/22 kV 次输电更新（Hobart 周边 1950–70 年代站房、油浸开关与 11 kV 开关柜到寿替换，已知案例如 North Hobart 开关柜更换工程〔Zinfra 中标〕）；木杆与导线更新（全州数十万根木杆的检测/替换计划）；林火减灾（Bushfire Mitigation Plan，覆盖 2013 Dunalley 等高风险区的导线、跌落式熔断器与重合闸策略、植被管理、高风险日停电协议）；Launceston（Firmus AI 数据中心、St Leonards）与 Hobart 东岸增长区的 33/11 kV 扩容；电动车与电采暖负荷增长、屋顶光伏（渗透率低于大陆但在增长）与动态出口管理；偏远支线以 SAPS（独立供电系统）替代长距离 SWER 线路的试点（AEMC 2022 年 SAPS 框架下，数量待核）；移动变电站/应急备用变压器用于区域站更新期间保供。技术/准入：执行 TasNetworks Service & Installation Rules、Network Design Standards 与核准设备/材料清单（Approved Products），对外接入按 OTTER Tasmanian Electricity Code 与 NER；对 EPC 以单一战略伙伴 Zinfra 的 5 年输配电服务合同承担常规工程为主，大项目另行招标。"
      },
      {
        "name": "Hydro Tasmania — Bass Strait Islands（King Island / Flinders Island 离网系统）",
        "area": "King Island（Currie）与 Flinders Island（Whitemark / Lady Barron）两座巴斯海峡岛屿的发电与配电（非 NEM 孤网，Hydro Tasmania 兼营发电与配网，约 2,150 用户，无输电网）",
        "hq": "Hobart（Hydro Tasmania 总部，4 Elizabeth Street）",
        "owner": "塔斯马尼亚州政府 100%（Hydro Tasmania 为 GBE）",
        "voltages": "11 kV 配电 + 400/230 V（待核）",
        "notes": "两岛由 Hydro Tasmania 以柴油 + 风电 + 光伏 + 电池/飞轮的混合微网供电：King Island Renewable Energy Integration Project（KIREIP，含飞轮、电池、动态电阻与柴油 UPS，可实现 100% 瞬时可再生渗透）与 Flinders Island Hybrid Energy Hub（2017 年投运），是澳大利亚离网混合微网的标杆；柴油机组更新、储能扩容、11 kV 开关设备与微网控制由 Hydro Tasmania 采购，Entura 任工程顾问；Aurora Energy 零售；OTTER 发放许可。规模小，但对集装箱式储能、预制开关站与 11 kV 开关柜是对口场景（具体资本计划待核）。"
      }
    ],
    "rezBody": "塔州没有 NSW EnergyCo / VIC VicGrid 式的独立 REZ 法定机构：州政府 ReCFIT（Department of State Growth）通过 Renewable Energy Coordination Framework 主导 REZ 政策与划定方式，TasNetworks 作为 Jurisdictional Planner 负责 REZ 网络规划与送出方案（NWTD 即北西 REZ 的送出骨干），AEMO ISP 把塔州划为三个候选 REZ（T1 North East Tasmania、T2 North West Tasmania、T3 Tasmania Midlands / Central Highlands）；Marinus Link Pty Ltd（联邦 49% / 维州 33.3% / 塔州 17.7%）负责联络线；海上风电申报区由联邦 DCCEEW 划定（Bass Strait off Northern Tasmania）。州政府 2023–24 年就『塔州 REZ 框架』完成咨询（REZ 修正法案 2024 草案 + 拟议北西 REZ 公众咨询 2024-05 至 2024-09），北西 REZ 为首个推进对象（正式法定划定以 renewableenergyzones.tas.gov.au 公告为准）。",
    "rezs": [
      "North West Tasmania REZ (T2 — Robbins Island / Jim's Plain / Hampshire–Burnie corridor, 由 NWTD 220 kV 送出)",
      "North East Tasmania REZ (T1 — Musselroe / Scottsdale–George Town corridor)",
      "Tasmania Midlands / Central Highlands REZ (T3 — Waddamana / Bothwell: Cattle Hill, St Patricks Plains, Cellars Hill)",
      "Bass Strait off Northern Tasmania Offshore Wind Declared Area (联邦 DCCEEW 2024-12 划定, 约 7,100 km²; 可行性许可申请 2025-04 截止, 2026-01 初步决定不授予许可, 终决待定)"
    ],
    "policy": "法定 Tasmanian Renewable Energy Target（TRET，Energy Co-ordination and Planning Amendment (TRET) Act 2022）：2030 年可再生发电量达 2020 年水平的 150%（约 15,750 GWh）、2040 年 200%（约 21,000 GWh），2020-11 已达成 100% 自给；Tasmanian Renewable Energy Action Plan（2020）与 Tasmanian Renewable Hydrogen Action Plan（Bell Bay 氢能枢纽：联邦 A$7,000 万 Regional Hydrogen Hub + 州 A$5,000 万基金；ABEL Bell Bay Powerfuels、HIF Tasmania 入围联邦 Hydrogen Headstart，Fortescue 2023 年、Woodside 2024 年先后退出）；Battery of the Nation（Hydro Tasmania：Cethana 750 MW 抽蓄、既有电站增容/延寿）与 Marinus Link 是州政府两大旗舰，2023 年 Marinus 股权重谈后塔州出资比例降至 17.7%。州有企业：Hydro Tasmania（发电 + Entura 工程顾问 + Bass Strait Islands 微网）、TasNetworks（输配一体）、Aurora Energy（零售，小客户电价由 OTTER 监管）。政治：Rockliff 自由党少数政府 2024-03 连任，2025-06 不信任案后 2025-07-19 提前选举再度组阁，能源政策连续（Minister for Energy and Renewables：Nick Duigan，兼 Parks and Heritage、Sport）；州政府支持新增风电但严格执行 Tasmanian Planning Commission / EPA 评估（Robbins Island 橙腹鹦鹉停机条件之争为典型）。联邦：Cellars Hill（341 MW + 600 MW/2,400 MWh）2026-05 获 CIS Tender 7 合同；Marinus 获 CEFC A$38 亿（2025-09）与 Rewiring the Nation 优惠融资，NWTD 亦获 CEFC 支持；Bass Strait off Northern Tasmania 海上风电区由 DCCEEW 2024-12 划定（可行性许可申请 2025-04 截止，2026-01 初步决定不授予许可，终决待定）。塔州无 NSW LTESA 式州级长期合约机制，可再生项目主要依赖 PPA（Hydro Tasmania、大陆零售商、Firmus 等）与联邦 CIS。",
    "coalExit": "塔州无燃煤电厂，不存在退煤倒计时——本州约九成电量来自 Hydro Tasmania 水电、其余为风电；Tamar Valley 燃气电站（Bell Bay，386 MW，含 208 MW CCGT + 178 MW OCGT 调峰机组〔58 MW Trent 60 + 3×40 MW FT8〕，2025 年招标将 CCGT 改为联合/开式双模式运行）仅在枯水年或 Basslink 停运时启用。塔州的『保供风险』是水库枯水与对 Basslink 单回联络线的依赖（2016 年 Basslink 断缆 + 枯水危机曾启用柴油发电），因此 Marinus Link（2030）、Cethana 抽蓄与大陆 Yallourn（2028）/ Loy Yang A（2035）退煤共同决定塔州风电/抽蓄的出口窗口——大陆煤电退役越快，塔州 Battery of the Nation 与 REZ 风电的商业价值越高。",
    "keyProjects": [
      {
        "name": "Marinus Link 一期 (Heybridge—Waratah Bay—Hazelwood)",
        "en": "Marinus Link Stage 1 HVDC",
        "kv": 320,
        "owner": "Marinus Link Pty Ltd（联邦 49% / 维州 33.3% / 塔州 17.7%）",
        "status": "在建",
        "year": 2030,
        "desc": "750 MW ±320 kV HVDC：Heybridge（Burnie 东）换流站—255 km 巴斯海峡海缆—Waratah Bay 登陆—约 90 km 维州地下电缆—Hazelwood 换流站；2025-08 FID、2026-02 AER 批复（一期资本开支约 A$34.7 亿）、2026-10 初正式开工；Prysmian 电缆（约 €6 亿）、Hitachi Energy 换流站、TasVic Greenlink（DT Infrastructure + Samsung C&T）A$9.94 亿土建/陆上工程；CEFC A$38 亿优惠贷款；目标 2030 年投运；二期 750 MW 商业案例 2026–27 年由三方政府审议。"
      },
      {
        "name": "西北输电工程 (North West Transmission Developments)",
        "en": "NWTD – Hampshire–Staverton–Sheffield 220 kV & Heybridge substation",
        "kv": 220,
        "owner": "TasNetworks（州有；CEFC / Rewiring the Nation 优惠融资）",
        "status": "在建",
        "year": 2030,
        "desc": "Marinus 一期与北西 REZ 的前置送出工程：新建 Hampshire—Staverton—Sheffield 220 kV 双回线、Sheffield—Palmerston 220 kV 增容、新建 Heybridge 220 kV 变电站（Marinus 换流站接入）及 Hampshire/Sheffield/Palmerston 站扩建，合计约 238 km 新建/改建双回线路（约 390 基新塔，其中一期 129 km）；2026-02 与 Marinus 同获监管批复，2026-05 一期融资关闭（CEFC 债务 + 州政府股权），一期造价估算约 A$13.2 亿（AER 核定可回收约 A$11.75 亿）、主承包商 GenusPlus（2024-12 委任，合同约 A$7.5 亿），主体施工预计 2026 Q3 起；二期 Staverton—Hampshire Hills（约 A$5.5 亿）另行推进，须在 2030 年 Marinus 投运前完成。"
      },
      {
        "name": "Basslink 维州—塔州 HVDC 转受监管资产 (Loy Yang—George Town)",
        "en": "Basslink HVDC conversion to regulated interconnector",
        "kv": 400,
        "owner": "APA Group",
        "status": "投运",
        "year": 2026,
        "desc": "500 MW 单极 HVDC（61 km 维州架空 + 290 km 海缆 + 11 km 塔州架空，2006 年投运，APA 2022 年收购）；AER 2023-09 受理转换申请、2026-02-27 终案核定 2026–30 年收入 A$4.595 亿，自 2026-07-01 起由市场型联络线转为受监管输电资产（最终以 APA 向 AEMO 重新注册为准）；George Town 换流站设备更新与备件是 APA 侧的持续资本开支。"
      },
      {
        "name": "Cethana 抽水蓄能 (Lake Cethana PHES)",
        "en": "Lake Cethana Pumped Hydro (Battery of the Nation)",
        "kv": 220,
        "owner": "Hydro Tasmania（州有）",
        "status": "规划",
        "year": 2032,
        "desc": "Battery of the Nation 首选抽蓄站址，约 750 MW / 20 小时储能，以既有 Cethana 水库为下库、新建上库，拟经 NWTD 新建的 Staverton 220 kV 变电站接入（再经 Staverton—Sheffield 220 kV 入网），与 Marinus 一期配套；已完成可行性与前期工程设计，2026-01 重新提交 EPBC 申报（2026-02 判定为 controlled action）、EIS 与开发申请 2026 年中公示，FID 取决于 Marinus 进度与联邦承销/合作方（目标 2027 年，建设期约 6–8 年）。"
      },
      {
        "name": "Tarraleah 水电重建/延寿 (Tarraleah Redevelopment)",
        "en": "Tarraleah Hydropower Redevelopment / Life Extension",
        "kv": 220,
        "owner": "Hydro Tasmania（州有）",
        "status": "规划",
        "year": 2030,
        "desc": "拟把 1938 年投运的 Tarraleah 电站（约 90 MW）重建为约 190 MW 的灵活调峰电站（BOTN 组成部分，造价估算已由 2023 年的约 A$10.5 亿升至约 A$19.6 亿〔2024 年价〕），项目未暂停：2026-02 启动首阶段施工招标、2026-04 EIS 公示，FID 尚待作出；仍是 Derwent 梯级 220 kV 送出与开关设备更新的潜在标的。"
      },
      {
        "name": "Robbins Island 与 Jim's Plain 风电 (ACEN)",
        "en": "Robbins Island & Jim's Plain Wind Farms",
        "kv": 220,
        "owner": "ACEN Australia（菲律宾 Ayala 集团）",
        "status": "规划",
        "year": 2030,
        "desc": "北西 REZ 旗舰：Robbins Island 最多 100 台风机、约 900 MW，Jim's Plain 约 200 MW，经新建 220 kV 线接入 Hampshire 并依赖 NWTD；塔州 EPA 2022 年批复并附橙腹鹦鹉迁徙期停机条件，TASCAT 与州最高法院维持该条件，联邦 EPBC 于 2025-08 由环境部长 Murray Watt 附条件批准（送出线路另行审批、预计 2026 年完成），ACEN 尚未公布 FID，开工预计 2030–31 年；若落地将是塔州最大单体风电与升压站/汇集站需求。"
      },
      {
        "name": "Cellars Hill 风电+储能 (Bothwell)",
        "en": "Cellars Hill Wind Farm + BESS",
        "kv": 220,
        "owner": "Gamuda Renewables（马来西亚）/ Alternate Path",
        "status": "规划",
        "year": 2030,
        "desc": "中部高地 Bothwell 附近 56 台风机 341 MW + 600 MW/2,400 MWh 电池（EPBC 申报口径风电上限 350 MW），2026-05 获联邦 CIS Tender 7 合同（仅风电部分）、2025-02 获塔州 Major Project 认定，计划 2027–28 年开工（视 FID）、2030 年投运，经穿越场址的既有 220 kV 线路就地接入、不新建外部送出线路（Gamuda 持股并担任 EPC）；Gamuda 自身具承建能力，升压站、储能升压与 33 kV 汇集设备为供货窗口。"
      },
      {
        "name": "St Patricks Plains 风电 (Central Highlands)",
        "en": "St Patricks Plains Wind Farm",
        "kv": 220,
        "owner": "Ark Energy（韩国高丽亚铅 Korea Zinc 旗下，原 Epuron）",
        "status": "规划",
        "year": 2029,
        "desc": "中部高地 Steppes 附近约 47 台风机、约 300 MW，拟接入 Waddamana 220 kV；塔州审批经 TASCAT 2025-08 驳回上诉后维持（噪声裕度窄、开工前须编制噪声管理计划），联邦 EPBC 2025-12 批准，2026-07 Vestas 自 Ark Energy 收购项目，计划 2027 上半年开工、2030 年投运，与 Cattle Hill（144 MW，Goldwind 建设）相邻形成 Central Highlands 风电集群。"
      },
      {
        "name": "Firmus Southgate AI 数据中心 (Launceston St Leonards)",
        "en": "Firmus Project Southgate AI Factory",
        "kv": 110,
        "owner": "Firmus Technologies（NVIDIA 参投）",
        "status": "在建",
        "year": 2026,
        "desc": "依托塔州水电的『AI 工厂』：一期 1a 44 MW、1b 扩至 90 MW（约 3.68 万颗 GB300，浸没液冷），2026 年底建成，总体规划约 US$45 亿；为 Launceston 东郊 110/33 kV 注入新增大负荷，是 TasNetworks 北部配网/变电站扩容与预制变电站、MV 开关柜的现实需求点。"
      },
      {
        "name": "Bell Bay 氢能/绿色燃料走廊 (George Town)",
        "en": "Bell Bay Hydrogen & e-Fuels Hub",
        "kv": 220,
        "owner": "ABEL Energy（Bell Bay Powerfuels 300 MW）/ HIF Asia Pacific（140 MW）/ TasPorts 与州政府（Bell Bay Advanced Manufacturing Zone）",
        "status": "规划",
        "year": 2030,
        "desc": "George Town 220 kV 枢纽旁的工业区：ABEL 300 MW 电解制绿色甲醇与 HIF 140 MW e-fuel 入围联邦 Hydrogen Headstart，Woodside/Fortescue 2024 年退出；Bell Bay Aluminium（Rio Tinto）与 Liberty Bell Bay 为既有大负荷；若氢能项目 FID 落地，将带来 220/33 kV 整流变电站、MV 开关柜与 E-house 需求（ABEL Bell Bay Powerfuels 300 MW 电解槽项目 2026-05 入围 Hydrogen Headstart 第二轮、尚未 FID、拟 2030 年前后投产；Countrywide 10 MW 一期预计 2027 上半年 FID）。"
      }
    ],
    "vendor": "在塔州卖中高压设备，第一道门是 TasNetworks 的准入体系：输配一体的 TasNetworks 以 Service & Installation Rules、Network Design Standards 与核准设备/材料清单约束一切网络资产与接入，新产品须先提交 AS/IEC 型式试验报告（AS/IEC 62271 开关设备、AS 60076 变压器、AS/NZS 61439 低压成套、AS 2067 高压变电站设计、AS/NZS 3000 布线、AS/NZS 7000 架空线、AS/NZS 4777.2 逆变器）并通过产品评估与现场试用才能入册；Hydro Tasmania（含 Bass Strait Islands 微网）与 Marinus Link 不受 TasNetworks 清单约束但执行同等 AS/IEC 型式试验加各自工程规范（Entura 常任业主工程师），Marinus 的换流站/电缆一次设备已由 Hitachi Energy 与 Prysmian 锁定，海外厂商的机会在 Heybridge 220 kV 站、NWTD 变电站二次/MV 设备与风电场升压站。预制变电站 / E-house 作为建筑物须按 NCC 与 Tasmanian Building Act 2016 取得建筑许可（或走公用基础设施豁免路径），结构按 AS/NZS 1170 系列——全州为 AS/NZS 1170.2 风区 A、无气旋 C/D 要求，但西海岸与巴斯海峡沿岸盐雾腐蚀严重、中部高地（Waddamana、Bothwell、Steppes）须计雪/覆冰荷载与低温启动，位于 Tasmanian Planning Scheme『Bushfire-Prone Areas Code』划定区的站房须按 AS 3959 做 BAL 评定（Tasmania Fire Service 认可评估师出具）。本地含量方面，塔州政府 Buy Local Policy（Treasurer's Instructions）要求 A$10 万以上竞争性采购至少邀请两家本地企业并在评标中设 30% 权重的『经济与社会效益』指标，A$500 万以上合同（含延期选项；A$200–500 万可酌情要求）须附 Tasmanian Industry Participation Plan，TasNetworks / Hydro Tasmania 等 GBE 按其采购政策比照执行；Marinus Link 同时是维州 Local Jobs First 战略项目并须向联邦提交 Australian Industry Participation（AIP）计划，联邦 CIS 合同亦附本地供应链/社会许可承诺——海外厂商通常须与 ICN Gateway 注册的塔州集成/安装伙伴组队并提供本地装配、备件与售后方案（Marinus 一期主体工程由 DT Infrastructure + Samsung C&T 的 TasVic Greenlink JV 承建，Heybridge 换流站土建/机电分包是本地企业的切入口）。电气施工必须由 CBOS（Department of Justice）持牌的电气承包商与电工完成（Occupational Licensing Act 2005），并接受 WorkSafe Tasmania 电气安全监管；输电侧并网走 AEMO + TasNetworks 的 NER 5.3 流程并须满足塔州独有的宽频率带 Frequency Operating Standard 与 Basslink 相关的系统强度要求。真正的买家：TasNetworks（NWTD、区域变电站更新、移动变电站、SAPS）、Hydro Tasmania / Entura（Cethana、Tarraleah、水电站 220 kV 开关站更新、King/Flinders 微网）、Marinus Link Pty Ltd 及其 EPC（Samsung C&T / DT Infrastructure、Hitachi Energy）、TasNetworks 的框架承包商（Zinfra、Downer、UGL）、风电/储能开发商（ACEN、Ark Energy、Gamuda、Goldwind、Woolnorth Renewables——神华 75% / Hydro Tasmania 25%、Lacuna）、矿企（Grange Resources Savage River——沙钢为大股东、MMG Rosebery、Renison 锡矿——Metals X / 云南锡业合资、Mt Lyell 铜矿重启方）、工业用户（Nyrstar Hobart、Bell Bay Aluminium、Norske Skog Boyer 电气化）、Firmus 数据中心与 Bell Bay 氢能开发商；供货窗口集中在 2026–2030：Marinus/NWTD 建设高峰、REZ 风电 FID 潮、TasNetworks 2024–29 与 2029–34 期更新计划。（本条目为离线编制，上述准入流程名称、门槛与承包商名单请在投标前以官网核验。）",
    "tenderPortals": [
      "Tasmanian Government Tenders（州政府部门与部分 GBE 公开招标）：https://www.tenders.tas.gov.au",
      "Tasmanian Government Buy Local Policy / 采购政策（Department of Treasury and Finance）：https://www.purchasing.tas.gov.au",
      "TasNetworks（供应商注册、Service & Installation Rules、网络标准、NWTD 项目）：https://www.tasnetworks.com.au",
      "Hydro Tasmania（采购、Battery of the Nation、Bass Strait Islands）：https://www.hydro.com.au",
      "Entura（Hydro Tasmania 工程顾问，常任业主工程师）：https://www.entura.com.au",
      "Marinus Link（供应商登记、本地产业参与）：https://www.marinuslink.com.au",
      "ICN Gateway / ICN Tasmania（本地供应商注册、Marinus 与 NWTD 供应链）：https://gateway.icn.org.au",
      "ReCFIT（TRET、REZ 框架、氢能与 Battery of the Nation 政策）：https://recfit.tas.gov.au",
      "Office of the Tasmanian Economic Regulator（电力许可、Tasmanian Electricity Code）：https://www.economicregulator.tas.gov.au",
      "CBOS（电气承包商/电工执照、建筑控制）：https://www.cbos.tas.gov.au",
      "AER（TasNetworks 2024–29 决定、Basslink 转换、Marinus/NWTD 批复）：https://www.aer.gov.au",
      "AEMO（NEM 接入、ISP、Tasmanian Frequency Operating Standard）：https://aemo.com.au",
      "联邦 Capacity Investment Scheme（CIS）招标：https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme",
      "ASL（原 AEMO Services，CIS 招标执行）：https://asl.org.au",
      "联邦 Bass Strait off Northern Tasmania 海上风电申报区：https://www.dcceew.gov.au/energy/renewable/offshore-wind/areas/bass-strait-tasmania",
      "联邦 Australian Industry Participation（AIP）计划：https://www.industry.gov.au"
    ],
    "sources": [
      "https://www.marinuslink.com.au/overview/",
      "https://www.marinuslink.com.au/2026/06/isp-finds-marinus-link-essential-as-construction-ramps-up/",
      "http://www.pv-magazine-australia.com/2026/10/05/construction-officially-kicks-off-on-project-marinus/",
      "https://www.abc.net.au/news/2026-02-10/marinus-link-north-west-transmission-line-regulator-approval/106322966",
      "https://www.aer.gov.au/news/articles/news-releases/final-revenue-decision-regulated-basslink",
      "https://wattclarity.com.au/articles/2026/03/basslink-gets-final-revenue-determination-for-operation-as-a-regulated-service/",
      "https://www.aer.gov.au/system/files/2023-09/Basslink%20-%20Conversion%20and%20transmission%20determination%20-%20overview%20-%2015%20September%202023.pdf",
      "https://www.aer.gov.au/industry/registers/determinations/tasnetworks-determination-2024-29",
      "https://www.tasnetworks.com.au/nwtd",
      "https://recfit.tas.gov.au/renewable_energy",
      "https://www.hydro.com.au/clean-energy/battery-of-the-nation",
      "https://www.dcceew.gov.au/energy/renewable/offshore-wind/areas/bass-strait-tasmania",
      "https://www.dcceew.gov.au/energy/renewable/capacity-investment-scheme",
      "https://www.tenders.tas.gov.au",
      "https://www.purchasing.tas.gov.au",
      "https://www.cbos.tas.gov.au",
      "https://gateway.icn.org.au",
      "https://www.robbinsislandwindfarm.com",
      "https://www.economicregulator.tas.gov.au",
      "本地数据集：js/data-extra.js (Marinus Link id 986)、js/data-refresh2606.js (Cellars Hill id 5911)、js/data-refresh2606c.js (Firmus Southgate id 6652)、js/data-australia2608.js (Bell Bay ids 7214/7215/7251/7262)、js/data-clients2.js (MMG Rosebery id 4089)",
      "同批次已核验文件：scratchpad/au-research/grid-VIC.json 与 state-VIC.json（Basslink / Marinus Link 条目）"
    ]
  },
  "NT": {
    "abbr": "NT",
    "name": "北领地",
    "en": "Northern Territory",
    "grid": "非 NEM、非 WEM：三个相互独立的受监管电网 —— DKIS 达尔文—凯瑟琳互联系统（峰荷约 300MW，占全区负荷约 85%）、Alice Springs 爱丽斯泉电网（峰荷约 55MW）、Tennant Creek 电网（<10MW），加上 72 个 IES 原住民社区离网微电网与 Gove / Groote Eylandt / McArthur River / Tanami 等矿区自备电站；批发市场为过渡性的 I-NTEM（Interim Northern Territory Electricity Market）",
    "operator": "NTESMO（Northern Territory Electricity System and Market Operator，Power and Water 内部职能隔离的系统与市场运营机构，原 System Control）；监管：Utilities Commission of the NT（牌照、Network Technical Code、可靠性标准）+ AER（PWC 网络收入，依北领地版 NER）",
    "summary": "北领地不在 NEM 内，三大孤立电网以 Blacktip / Amadeus 气田供气的燃气机组为主（燃气约占 DKIS 发电八成以上），可再生（含屋顶光伏）占比约 15–25%，距 2030 年 50% 可再生目标仍有明显差距。2024 年 8 月 CLP 政府上台后重心转向 Beetaloo 页岩气保供、Middle Arm 工业区与 Territory Coordinator 快速审批，同时延续 DK BESS 一类系统安全投资与爱丽斯泉未来电网。电网资本开支的驱动力是老化资产置换、热带气旋/雷击/腐蚀韧性、高比例逆变电源下的系统强度与储能，以及 SunCable、Middle Arm、数据中心与国防（RAAF Tindal）带来的新增负荷。",
    "tnsp": {
      "name": "Power and Water Corporation (PWC) — Power Networks（输电与配电一体，北领地唯一受 AER 监管的网络企业）",
      "owner": "北领地政府（Government Owned Corporations Act 下的 GOC，股东部长为财政部长 Treasurer）",
      "voltages": "132/66/22/11 kV（DKIS：Channel Island—Hudson Creek—Darwin/Palmerston—Manton—Batchelor—Pine Creek—Katherine 132kV 骨干约 300km，达尔文市区 66kV 次输电；Alice Springs：Owen Springs—Lovegrove—Sadadeen 66kV 环网；Tennant Creek：22/11kV）",
      "notes": "PWC 同时持有电网、供水/污水与（经职能隔离的）NTESMO 系统运营，电力用户约 9 万户；电网资产自 2015 年起由 AER 按北领地版 National Electricity Rules 监管，首个监管期 2019–24，第二个监管期 2024–29（AER 最终决定 2024 年 4 月发布，核定收入与资本支出以 AER 决定页为准）。2024–29 期资本支出主题：老化变电站/开关设备与 132kV 线路置换（Channel Island、Hudson Creek、Katherine 等 1980 年代资产）、热带气旋与雷击韧性、系统强度与保护控制升级（高比例光伏接入后的 DKIS 稳定问题）、Katherine 长辐射线路电压支撑、数字化与 SCADA/OT 安全。旗舰工程：DKESP 下的电网强化、IES 社区光储混合升级；Channel Island 35MW 构网型 Darwin-Katherine BESS（2024 年投运）由发电 GOC Territory Generation 投资持有、Hitachi Energy 交付，PWC/NTESMO 负责并网与系统运行。采购遵循 NT Procurement Rules + Buy Local 政策，设备须符合 PWC 技术标准与 Utilities Commission 批准的 Network Technical Code。"
    },
    "dnsps": [
      {
        "name": "Power and Water Corporation — Power Networks（受监管配电）",
        "area": "达尔文—凯瑟琳互联系统（Darwin、Palmerston、Litchfield、Batchelor、Adelaide River、Pine Creek、Katherine）、爱丽斯泉及周边、Tennant Creek 三大受监管电网，约 9 万电力用户，覆盖北领地约 9 成人口",
        "hq": "Darwin（Mitchell Centre, 55 Mitchell St）",
        "owner": "北领地政府（GOC）",
        "voltages": "132/66 kV 输电、22/11 kV 配电、415 V 低压",
        "notes": "客户：Jacana Energy（政府零售商，占零售主体）、Rimfire Energy 等私营零售/发电商、Territory Generation 并网电厂、ENI/其他独立光伏（Katherine 25MW、Manton Dam、Batchelor）、Inpex/Santos 等工业。技术制度：Utilities Commission 批准的 Network Technical Code（含 Generator Performance Standards、System Control Technical Code / NTESMO Secure System Guidelines）+ PWC 内部技术规范与型式认可清单（标准设计图、22/11kV 环网柜、柱上设备、变压器、预制式变电站须经 PWC Asset Standards 评审；热带 50℃ 环境、C4–C5 腐蚀、白蚁、雷电密度全国最高为硬约束）。框架合同：PWC 通过多年期供应面板采购电缆、变压器、开关设备及承包商服务（面板招标走 NT Quotations and Tenders Online）。当前资本开支主题：Darwin 市区与 Palmerston 区域变电站更新、老化 11kV 开关柜置换、Katherine 电压支撑/功率因数设备、DK BESS 配套、构网型储能与系统强度、配网光伏托管（DER 可见性与动态出力限制）、Middle Arm/国防/数据中心新增负荷接入、移动变电站与应急复电能力（气旋后快速复电）。"
      },
      {
        "name": "Indigenous Essential Services Pty Ltd (IES)（PWC 非营利子公司，离网社区）",
        "area": "北领地 72 个偏远原住民社区与 79 个 outstations（Top End、Arnhem Land、Tiwi、Barkly、中澳沙漠地区）的离网电力、供水与污水服务",
        "hq": "Darwin（PWC 内）",
        "owner": "Power and Water Corporation（北领地政府拨款）",
        "voltages": "柴油/光储混合电站 → 11 kV 或 22 kV 社区配网 → 415 V",
        "notes": "客户为社区居民与政府设施；设备以集装箱/撬装化柴油机组、光伏阵列、电池储能及小型预制变电站为主。ARENA 资助的 SETuP 计划（2016–2019，约 A$5900 万，25 个社区共约 10MW 光伏）之后持续推进「光伏+储能+柴油」混合升级与远程监控，目标降低柴油依赖；Jabiru 为示范样板（EDL 承建的 3.9MW 光伏 + 3MW/5MWh 储能 + 柴油，2021 年投运）。采购通过 PWC 框架合同与 NT 招标平台，承包商以 EDL、Pacific Energy、Zenith、本地电气承包商为主；气旋区（Region C/D）与极端偏远运输（旱季道路/海运）是设备选型关键。"
      },
      {
        "name": "矿区与企业自备电网（非 DNSP，参考）",
        "area": "Gove/Nhulunbuy（Rio Tinto 电站与镇区电网，Rio 退出后向北领地政府/PWC 过渡）、Groote Eylandt（South32 GEMCO 锰矿）、McArthur River（Glencore 锌铅矿，燃气电站）、Tanami（Newmont 金矿，Tanami 气管供气）、Yulara（Voyages）、Jabiru（已由 PWC 接管）",
        "hq": "各矿企/业主",
        "owner": "Rio Tinto / South32 / Glencore / Newmont / Voyages 等",
        "voltages": "多为 11 kV 或 22 kV 厂区中压，自建燃气/柴油/光储电站",
        "notes": "这些离网负荷是模块化变电站、E-house、中压开关柜与储能撬装的直接买家，采购走业主或 EPCM（如 Hatch、Worley、GR Engineering、Lycopodium）渠道，电气标准依 AS/NZS 4871（矿用）与 AS 2067，并受 NT Work Health and Safety (NUL) Act 2011 监管。近期动向：Gove 镇区电力转型（Rio Tinto 2030 年前后退出）、Nolans 稀土自备混合电站（燃气+光伏）、Finniss 锂矿重启、Tanami Expansion 2、McArthur River 可再生替代研究。"
      }
    ],
    "rezBody": "无 NEM 式法定 REZ 机构。系统规划由北领地政府能源部门（Department of Mining and Energy 能源司，原 Department of Industry, Tourism and Trade）通过《Darwin-Katherine Electricity System Plan》（DKESP，2021 年）与《Alice Springs Future Grid Roadmap》（2023 年）确定，NTESMO 每年发布《Northern Territory Electricity Outlook Report (NTEOR)》给出供需与接入展望；2025 年起重大项目由 Territory Coordinator（Territory Coordinator Act 2025）统筹快速审批。",
    "rezs": [
      "Darwin–Katherine solar / firming precincts (DKESP, non-statutory: Katherine, Batchelor–Manton, Darwin rural)",
      "Powell Creek Solar Precinct (SunCable AAPowerLink, Barkly / Elliott)",
      "Middle Arm Sustainable Development Precinct (Darwin Harbour industrial load hub)",
      "Alice Springs Future Grid solar-storage zone (Owen Springs / Brewer Estate)",
      "Tennant Creek / Barkly green-hydrogen & solar hub (Desert Bloom Hydrogen)",
      "Gove Peninsula renewable transition (Allied Green Ammonia, Rio Tinto exit)"
    ],
    "policy": "目标：2030 年可再生电力占比 50%（2017 年《Roadmap to Renewables》，工党政府设定）；2024 年 8 月 CLP（Finocchiaro）政府上台后未正式废除该目标，但公开表态以「可靠、可负担」优先，政策重心转向 Beetaloo 盆地页岩气保供（与 Tamboran 签订北领地供气合同）、Middle Arm 可持续发展区、Territory Coordinator 快速审批与矿业/油气；无煤电故无「煤退」议题，也无海上风电（联邦未在北领地划定海上风电区）。国有开发主体：Territory Generation（发电 GOC，Channel Island/Weddell/Katherine/Owen Springs/Tennant Creek 燃气电站 + Channel Island 35MW Darwin-Katherine BESS + Alice Springs 5MW BESS）、Power and Water（电网 + NTESMO 系统运营 + IES）、Jacana Energy（零售）。专项计划：DKESP（Darwin-Katherine BESS、灵活燃气、大型光伏、电网强化、DER 托管）、Alice Springs Future Grid（ARENA 约 A$1250 万资助，路线图建议 2030 年前新增大型储能与系统强度设备）、SETuP 偏远社区光伏、NT Renewable Hydrogen Strategy（Tiwi H2、Desert Bloom、Allied Green Ammonia 获重大项目资质）。联邦层面：北领地不在 Capacity Investment Scheme 的 NEM/WEM 招标地理范围内（截至 2026 年公开资料），主要依靠 ARENA 资助、NAIF 贷款、Middle Arm 联邦 A$15 亿公共基础设施拨款与国防投资（RAAF Tindal 等）。电力市场改革（I-NTEM 向竞争性 NTEM 过渡、Essential System Services 市场）仍在推进，CLP 政府 2025 年对改革节奏重新评估。",
    "coalExit": "北领地没有燃煤电厂，三大电网及矿区电站几乎全部为燃气（Blacktip 海上气田→Bonaparte 管线、Amadeus 盆地、Beetaloo 新气源）与柴油，因此没有燃煤退役倒计时。真正的「退役倒计时」是：Channel Island（1986–87 年投运）与 Katherine 等老旧燃气机组进入寿命末期，Territory Generation 需在 2030 年前后以灵活燃气往复机组 + 储能替换；Blacktip 气田产量递减（2024–25 年供气紧张）促使政府锁定 Beetaloo 气（Tamboran Shenandoah South → Sturt Plateau Pipeline → Amadeus 管线，目标 2026 年供气）；2030 年 50% 可再生目标意味着 DKIS 需新增数百 MW 光伏与数十至上百 MW 储能及系统强度设备。",
    "keyProjects": [
      {
        "name": "达尔文—凯瑟琳大电池 (Darwin-Katherine BESS, Channel Island)",
        "en": "Darwin-Katherine Battery Energy Storage System (DK BESS)",
        "owner": "Territory Generation（北领地发电 GOC；Hitachi Energy 供货/集成）",
        "status": "投运",
        "year": 2024,
        "desc": "Channel Island 35MW 构网型电池，替代燃气机组旋转备用、提供系统强度并提高 DKIS 光伏接入上限，约 A$4500 万，2024 年正式投运。"
      },
      {
        "name": "SunCable 澳亚电力链路·达尔文段 (Powell Creek→Darwin 输电 + Murrumujuk 换流站)",
        "en": "SunCable Australia-Asia PowerLink – Darwin stage (Powell Creek–Darwin ~800 km transmission)",
        "owner": "SunCable（Grok Ventures）",
        "status": "规划",
        "year": 2032,
        "desc": "Barkly 地区 Powell Creek 光伏/储能基地经约 800km 架空输电线送达尔文（首期约 900MW 供达尔文工业用户），再经 4300km 海底 HVDC 输往新加坡；已获 EPBC（2024）、NT EPA、新加坡 EMA 有条件批准（1.75GW）与印尼路由批准，FID 目标推迟至 2027 年，达尔文首送电推至 2030 年代初。"
      },
      {
        "name": "Middle Arm 可持续发展区公共电力与供水基础设施 (达尔文港)",
        "en": "Middle Arm Sustainable Development Precinct – common-user power & water infrastructure",
        "owner": "北领地政府（联邦 A$15 亿拨款）",
        "status": "规划",
        "year": 2028,
        "desc": "达尔文港 Middle Arm 约 1500 公顷工业区（NTLNG、Tivan、Avenira 磷酸铁锂、绿氢/氨、数据中心等意向），需新建 132kV 供电走廊、区域变电站与供水；联邦/NT 环评 2024–2026 年推进，为 DKIS 最大的潜在新增负荷。"
      },
      {
        "name": "DKESP 达尔文—凯瑟琳电网强化 (Katherine 电压支撑 / 系统强度 / 保护控制升级)",
        "en": "Darwin-Katherine Electricity System Plan grid reinforcement (Katherine voltage support, system strength, protection)",
        "owner": "Power and Water Corporation / NTESMO",
        "status": "在建",
        "year": 2029,
        "kv": 132,
        "desc": "DKESP 下的分阶段电网工程：Katherine 长辐射 132kV 线路电压支撑与无功设备、变电站保护/控制数字化、构网型储能与系统强度措施、光伏动态出力管理，以支撑 2030 年 50% 可再生接入；具体分项与进度请以 PWC/NTESMO 年报核实。"
      },
      {
        "name": "爱丽斯泉未来电网与大型储能 (Alice Springs Future Grid)",
        "en": "Alice Springs Future Grid roadmap & grid-scale BESS / system strength",
        "owner": "北领地政府 / Territory Generation / Power and Water（ARENA 资助）",
        "status": "规划",
        "year": 2030,
        "desc": "ARENA 与 NT 政府联合资助的 Future Grid 项目（2020–2023）完成后形成 2030 路线图：爱丽斯泉 66kV 孤网需新增约数十 MW 大型储能、同步调相/构网能力与光伏托管，以替代 Owen Springs 燃气机组并实现 50% 可再生。"
      },
      {
        "name": "Beetaloo 气源保障链 (Shenandoah South → Sturt Plateau Pipeline → Amadeus 管线)",
        "en": "Beetaloo gas-to-grid supply chain (Tamboran Shenandoah South pilot + APA Sturt Plateau Pipeline)",
        "owner": "Tamboran Resources / APA Group / Power and Water（购气方）",
        "status": "在建",
        "year": 2026,
        "desc": "为缓解 Blacktip 气田递减导致的 DKIS 燃料风险，NT 政府与 Tamboran 签订供气合同，APA 建设约 37km Sturt Plateau 管线接入 Amadeus 管线，目标 2026 年向北领地电网供气——决定燃气机组在 2030 年前的运行基础。"
      },
      {
        "name": "Jabiru 混合可再生微电网 (卡卡杜)",
        "en": "Jabiru Hybrid Renewable Power Station (EDL)",
        "owner": "EDL（为 Power and Water 建设运营）",
        "status": "投运",
        "year": 2021,
        "desc": "卡卡杜国家公园 Jabiru 镇 3.9MW 光伏 + 3MW/5MWh 电池 + 4.5MW 柴油混合电站，取代 Ranger 铀矿旧电站，是北领地离网社区光储微网的标杆，模式正复制到 IES 社区。"
      },
      {
        "name": "Territory Generation 达尔文燃气机组更新 (Channel Island / Weddell 灵活燃气+储能)",
        "en": "Territory Generation Darwin generation renewal (flexible gas engines + BESS at Channel Island / Weddell)",
        "owner": "Territory Generation",
        "status": "规划",
        "year": 2030,
        "desc": "Channel Island 1980 年代燃气轮机进入寿命末期，TGen 规划以高效灵活往复机组与储能替换并配合可再生并网；范围、容量与时间表以 Territory Generation 公告为准。"
      },
      {
        "name": "IES 偏远原住民社区光储混合升级计划",
        "en": "Indigenous Essential Services remote community solar + storage hybrid program (post-SETuP)",
        "owner": "Power and Water / IES（ARENA、NT 政府资助）",
        "status": "在建",
        "year": 2028,
        "desc": "继 SETuP 25 个社区约 10MW 光伏之后，IES 持续在 72 个离网社区推进光伏+电池+柴油混合与远程控制升级，单点规模数百 kW 至数 MW，是集装箱式储能与预制变电设备的持续订单来源。"
      }
    ],
    "vendor": "在北领地卖中高压设备，第一道门槛是 Power and Water 的技术制度：设备须通过 PWC Asset Standards 的型式认可并符合 Utilities Commission 批准的 Network Technical Code（并网还要满足 Generator Performance Standards 与 NTESMO Secure System Guidelines），常用标准为 AS/NZS 3000、AS 2067（高压装置）、AS 62271.200/202（金属封闭开关柜与预制式变电站）、AS/NZS 61439、AS 60076、AS/NZS 7000、AS/NZS 1768（雷电防护——达尔文雷电密度全国最高），E-house/预制变电站作为「建筑」须按 NCC（气候 1 区）与 NT Building Act 取得 building permit，并按 AS/NZS 1170.2 风区 C（达尔文、Middle Arm、Gove、Groote 等北部沿海，Region D 仅限西北沿海极少数区域；Alice Springs 为 Region A）做气旋级结构设计，同时考虑 50℃ 环境温度降容、C4–C5 盐雾腐蚀与白蚁防护；BAL 林火等级仅在划定的林火易发区（主要为中澳/热带稀树草原部分地区）适用，远不如气旋与雷击关键。本地含量方面，NT 政府与 PWC/Territory Generation 等 GOC 的采购适用 NT Procurement Rules 与 Buy Local 政策（对 Territory Enterprise 的本地利益承诺 Local Benefit Commitment 通常占评标权重 30%，并有 Aboriginal Procurement Policy 目标），联邦出资或 ≥A$5 亿的项目（Middle Arm、SunCable、Beetaloo/NTLNG）须提交 Australian Industry Participation 计划，因此海外厂商宜与达尔文本地电气承包商或 NT 注册企业组成联合体并在 ICN Gateway 注册。现场安装须由持有北领地 Electrical Workers and Contractors Licensing Board 牌照的电气承包商执行（北领地无强制工程师注册制度，但设计需经 PWC/业主审核），矿区设备另需满足 AS/NZS 4871 与 NT WHS 法规。真正的买家是：Power and Water（变电站更新、DK BESS 类储能、移动/预制变电站、IES 社区光储）、Territory Generation（机组更新配套中压开关与储能）、国防（RAAF Tindal、Larrakeyah、Robertson Barracks，通过 Lendlease/Laing O'Rourke/Downer 等总包）、油气与矿业业主（Inpex、Santos、Tamboran、Glencore MRM、South32 GEMCO、Newmont Tanami、Arafura Nolans、Core Lithium、Tivan）、SunCable 与 Middle Arm 进驻企业、NEXTDC 等数据中心，以及承接这些项目的 EPC/承包商（UGL、Downer、Ventia、CPP、Monford Group、Sitzler、DCOH、EDL/Pacific Energy/Zenith 离网电站商、Hatch/Worley 等 EPCM）；达尔文港距东南亚 3–5 天航程，是中国供应商交付集装箱式 E-house、储能撬装与预制变电站的天然物流优势。",
    "tenderPortals": [
      "NT Government Quotations and Tenders Online（北领地政府及 GOC 招标）— https://tendersonline.nt.gov.au/",
      "ICN Gateway（Industry Capability Network 供应商注册与项目工作包，北领地分部 ICN NT）— https://gateway.icn.org.au/",
      "Buy Local NT / Buy Local Industry Advocate（本地利益承诺与评标规则）— https://buylocal.nt.gov.au/",
      "Power and Water Corporation（供应商与承包商信息、技术标准）— https://www.powerwater.com.au/",
      "Territory Generation（采购与项目）— https://territorygeneration.com.au/",
      "AEMO Services / Capacity Investment Scheme（注意：北领地不在 CIS 招标范围，仅供参照）— https://www.aemoservices.com.au/",
      "ARENA（北领地离网/储能资助项目）— https://arena.gov.au/",
      "NAIF 北澳基础设施基金（项目融资）— https://naif.gov.au/",
      "AusTender（联邦国防等采购）— https://www.tenders.gov.au/"
    ],
    "sources": [
      "https://www.aer.gov.au/industry/registers/determinations/power-and-water-corporation-determination-2024-29",
      "https://www.powerwater.com.au/",
      "https://territorygeneration.com.au/",
      "https://utilicom.nt.gov.au/",
      "https://territoryrenewableenergy.nt.gov.au/",
      "https://www.suncable.energy/",
      "https://buylocal.nt.gov.au/",
      "https://tendersonline.nt.gov.au/",
      "https://gateway.icn.org.au/",
      "https://arena.gov.au/",
      "https://www.aemoservices.com.au/",
      "https://naif.gov.au/"
    ]
  },
};
