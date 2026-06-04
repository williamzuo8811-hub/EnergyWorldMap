/* =============================================================
 * 全球能源项目世界地图 —— 数据层
 * -------------------------------------------------------------
 * 唯一数据源，便于替换 / 扩充。数据为公开信息整理（截至 2026-06），
 * 坐标、投资额为近似/示意值。
 *
 * 纳入门槛：投资额 > 5000 万元人民币（约 700 万美元）。
 *
 * 字段说明：
 *   id        唯一编号
 *   name      中文名称
 *   en        英文/原文名称（可空）
 *   country   所在国家/地区
 *   region    所属大区：中国 / 亚洲 / 中东 / 欧洲 / 北美 / 南美 / 非洲 / 大洋洲
 *   cat       品类键（见 CATEGORIES）
 *   coord     [经度, 纬度]（WGS-84；高德底图会自动做 GCJ-02 纠偏）
 *   cap       容量 / 规模描述
 *   inv       投资额（单位：亿美元，用于统计；估算值）
 *   invText   投资额展示文本
 *   status    规划 / 在建 / 投运
 *   year      关键里程碑年份
 *   updated   最近动态时间 'YYYY-MM'（≥ META.recentSince 自动标记为 🆕 近一年）
 *   owner     业主 / 主要参与方
 *   flagship  是否旗舰项目（地图上有高亮脉冲）
 *   desc      一句话摘要（用于悬浮提示 / 列表）
 *   detail    详细项目介绍（点击项目后在详情卡展示，一段话）
 *   route     可选：[[经度,纬度], ...] 连线（输变电走廊 / 高铁等）
 * ============================================================= */
window.ENERGY = (function () {
  const META = { lastUpdated: '2026-06', recentSince: '2025-06', minInvestmentRMB: '5000 万元' };

  const CATEGORIES = {
    renewable:  { name: '可再生能源发电', short: '新能源发电', color: '#2ee6a6', icon: '☀️' },
    grid:       { name: '输变电 · 电网',   short: '输变电',     color: '#21c7ff', icon: '⚡' },
    storage:    { name: '储能',            short: '储能',       color: '#b388ff', icon: '🔋' },
    ci:         { name: '工商业 · 配网大客户', short: '工商业',  color: '#ffb02e', icon: '🏭' },
    datacenter: { name: '数据中心',        short: '数据中心',   color: '#ff5fa8', icon: '🖥️' },
    transport:  { name: '大交通 · 轨交机场港口', short: '大交通', color: '#5b8cff', icon: '🚄' },
    petro:      { name: '石油化工 · LNG',   short: '石化',       color: '#ff6f59', icon: '🛢️' },
    mining:     { name: '矿业',            short: '矿业',       color: '#d4a23a', icon: '⛏️' },
    client:     { name: '国际大客户',       short: '国际大客户',  color: '#a3e635', icon: '🤝' },
  };

  const REGIONS = ['中国', '亚洲', '中东', '欧洲', '北美', '南美', '非洲', '大洋洲'];
  const STATUS  = ['规划', '在建', '投运'];

  const PROJECTS = [
    /* ============ 可再生能源发电 ============ */
    { id: 1, name: '墨脱（雅鲁藏布江下游）水电工程', en: 'Medog / Yarlung Tsangpo Hydropower', country: '中国', region: '中国', cat: 'renewable', coord: [95.3, 29.3], cap: '规划装机约 60 GW', inv: 1670, invText: '约 1.2 万亿元', status: '在建', year: 2025, updated: '2025-07', owner: '中国雅江集团', flagship: true, desc: '全球规模最大水电工程，2025 年 7 月开工。',
      detail: '工程位于雅鲁藏布江下游"大拐弯"，利用约 2000 米的天然落差建设引水式梯级电站。2025 年 7 月 19 日由国务院总理李强出席仪式宣布开工，总投资约 1.2 万亿元，规划总装机约 60 GW、年发电量约 3000 亿千瓦时，约为三峡的三倍。建成后将成为全球规模最大的水电工程，并计划通过特高压外送、就地发展绿氢与高载能产业，预计 2033 年前后投产。' },
    { id: 2, name: '白鹤滩水电站', en: 'Baihetan Hydropower', country: '中国', region: '中国', cat: 'renewable', coord: [102.9, 27.2], cap: '16 GW（16×100万千瓦）', inv: 310, invText: '约 2200 亿元', status: '投运', year: 2022, updated: '2022-12', owner: '三峡集团', flagship: true, desc: '全球单机容量最大水电站。',
      detail: '位于金沙江下游川滇交界处，总装机 16 GW，安装 16 台单机容量 100 万千瓦的水轮发电机组，单机容量为世界第一。2021 年首批机组投产、2022 年全部并网，年均发电量约 624 亿千瓦时，是"西电东送"骨干清洁电源，配套白鹤滩—浙江、白鹤滩—江苏两条 ±800kV 特高压直流送往长三角。' },
    { id: 3, name: '三峡水电站', en: 'Three Gorges Dam', country: '中国', region: '中国', cat: 'renewable', coord: [111.0, 30.82], cap: '22.5 GW', inv: 350, invText: '约 2500 亿元', status: '投运', year: 2012, updated: '2020-12', owner: '三峡集团', flagship: true, desc: '全球装机最大的水电站。',
      detail: '位于湖北宜昌长江干流，总装机 22.5 GW（32 台机组），是全球装机容量最大的水电站，2012 年全部机组投产、2020 年完成整体竣工验收。集防洪、发电、航运、水资源调配于一体，年发电量峰值超 1100 亿千瓦时，是中国电力系统的标志性骨干工程。' },
    { id: 4, name: '两河口水电站', en: 'Lianghekou Hydropower', country: '中国', region: '中国', cat: 'renewable', coord: [101.0, 30.8], cap: '3 GW', inv: 95, invText: '约 665 亿元', status: '投运', year: 2022, updated: '2022-09', owner: '雅砻江流域水电', flagship: false, desc: '雅砻江上的高海拔大型水电站。',
      detail: '位于四川甘孜雅砻江干流，总装机 3 GW，坝高 295 米，是雅砻江流域的"龙头"调节水库电站。2021—2022 年机组陆续投产，凭借巨大库容增强了下游梯级电站及四川电网的调峰与抗旱能力，并支撑"水风光"互补清洁能源基地。' },
    { id: 5, name: '库布其沙漠"光伏长城"大基地', en: 'Kubuqi Desert PV Base', country: '中国', region: '中国', cat: 'renewable', coord: [109.0, 39.6], cap: '风光约 100 GW', inv: 450, invText: '约 3000 亿元', status: '在建', year: 2023, updated: '2025-09', owner: '三峡 / 亿利等', flagship: true, desc: '内蒙古"沙戈荒"大型风光基地。',
      detail: '位于内蒙古鄂尔多斯库布其沙漠，是国家"沙戈荒"大型风电光伏基地的旗舰，规划风光装机约 100 GW，沿黄河"几字弯"形成约 400 公里的"光伏长城"。项目把治沙、发电与生态修复结合：板上发电、板间种植、板下修复，并配套特高压外送华北、华中负荷中心。' },
    { id: 6, name: '腾格里沙漠风光大基地', en: 'Tengger Desert Base', country: '中国', region: '中国', cat: 'renewable', coord: [105.0, 37.8], cap: '风光约 13 GW', inv: 130, invText: '约 900 亿元', status: '在建', year: 2023, updated: '2024-12', owner: '国能 / 国电投', flagship: false, desc: '宁夏中卫沙漠风光基地。',
      detail: '位于宁夏中卫腾格里沙漠，是首批"沙戈荒"大型新能源基地之一，规划风光约 13 GW，配套"宁电入湘"等特高压通道把清洁电力外送华中。基地同样采取光伏治沙模式，兼顾发电与防风固沙。' },
    { id: 7, name: '阳江青洲海上风电基地', en: 'Yangjiang Qingzhou Offshore Wind', country: '中国', region: '中国', cat: 'renewable', coord: [111.7, 21.5], cap: '规划约 7 GW', inv: 130, invText: '约 900 亿元', status: '在建', year: 2024, updated: '2025-09', owner: '三峡 / 明阳 等', flagship: false, desc: '广东深远海海上风电集群。',
      detail: '位于广东阳江外海，是中国深远海海上风电规模化开发的代表性集群，多个青洲标段陆续核准、开工与并网，规划总装机约 7 GW。基地采用大兆瓦机组与柔性直流送出，并探索"海上风电+海洋牧场+制氢"的融合开发模式。' },
    { id: 8, name: '台湾海峡（潮州）海上风电基地', en: 'Taiwan Strait (Chaozhou) Offshore Wind', country: '中国', region: '中国', cat: 'renewable', coord: [117.2, 22.4], cap: '规划约 43.3 GW', inv: 700, invText: '约 5000 亿元', status: '规划', year: 2025, updated: '2025-08', owner: '广东 / 待定', flagship: true, desc: '规划中全球最大海上风电基地。',
      detail: '广东潮州规划在台湾海峡西侧风能富集海域建设约 43.3 GW 的超大型海上风电基地，若落地将成为全球规模最大的海上风电项目。台湾海峡"狭管效应"带来全球少有的优质海上风资源，但需突破深远海施工、长距离送出与生态协调等挑战。' },
    { id: 9, name: 'NEOM 绿氢项目（NGHC）', en: 'NEOM Green Hydrogen (NGHC)', country: '沙特', region: '中东', cat: 'renewable', coord: [35.2, 28.0], cap: '4 GW 风光 + 绿氢 600t/日', inv: 84, invText: '约 84 亿美元', status: '在建', year: 2023, updated: '2026-01', owner: 'NEOM / ACWA / 空气化工', flagship: true, desc: '全球最大在建绿氢工厂。',
      detail: '位于沙特西北"新未来城"NEOM，由 ACWA Power、沙特 NEOM 与美国空气化工各持股建设，配套约 4 GW 风电与光伏，日产约 600 吨绿氢并就地合成绿氨。项目 2023 年完成融资、计划 2026 年投产，绿氨将主要出口欧洲，是全球最大的在建绿氢工厂之一。' },
    { id: 10, name: 'Sudair 光伏电站', en: 'Sudair Solar PV', country: '沙特', region: '中东', cat: 'renewable', coord: [45.6, 25.6], cap: '1.5 GW', inv: 9, invText: '约 9 亿美元', status: '投运', year: 2023, updated: '2023-12', owner: 'ACWA / 阿美', flagship: false, desc: '沙特最大单体光伏之一。',
      detail: '位于沙特中部苏代尔工业城，装机 1.5 GW，是沙特"2030 愿景"国家可再生能源计划的首批旗舰项目之一，由 ACWA Power、沙特阿美与水电控股公司共同投资。2023 年并网，曾以极低的中标电价刷新区域纪录，年减碳约 290 万吨。' },
    { id: 11, name: 'Al Dhafra 光伏电站', en: 'Al Dhafra Solar PV', country: '阿联酋', region: '中东', cat: 'renewable', coord: [54.0, 24.0], cap: '2 GW', inv: 12, invText: '约 12 亿美元', status: '投运', year: 2023, updated: '2023-11', owner: 'EWEC / 马斯达尔', flagship: false, desc: '曾创全球最低光伏电价纪录。',
      detail: '位于阿布扎比，单体装机 2 GW，采用约 400 万块双面组件，2023 年投运时为全球最大单体光伏电站之一。项目曾以约 1.32 美分/千瓦时刷新全球最低光伏电价纪录，由阿联酋 EWEC 主导，马斯达尔、法国 EDF 与中国晶科等参与。' },
    { id: 12, name: 'Noor Ouarzazate 光热电站', en: 'Noor Ouarzazate CSP', country: '摩洛哥', region: '非洲', cat: 'renewable', coord: [-6.86, 30.93], cap: 'CSP 580 MW', inv: 24, invText: '约 24 亿美元', status: '投运', year: 2024, updated: '2024-03', owner: 'MASEN / ACWA', flagship: false, desc: '全球最大光热综合体之一。',
      detail: '位于摩洛哥瓦尔扎扎特撒哈拉沙漠边缘，由槽式与塔式聚光太阳能（光热）机组组成，总装机约 580 MW 并配备熔盐储热，可在日落后继续供电数小时。它是非洲清洁能源的标杆，帮助摩洛哥大幅降低化石能源进口依赖。' },
    { id: 13, name: 'Benban 光伏园区', en: 'Benban Solar Park', country: '埃及', region: '非洲', cat: 'renewable', coord: [32.7, 24.4], cap: '1.65 GW', inv: 40, invText: '约 40 亿美元', status: '投运', year: 2024, updated: '2024-01', owner: '多家开发商', flagship: false, desc: '非洲最大光伏园区之一。',
      detail: '位于埃及阿斯旺省本班，由约 40 座独立电站组成、总装机约 1.65 GW，是非洲最大的光伏园区之一。园区在世界银行等多边机构支持下建成，吸引全球开发商投资，显著提升了埃及电力供应并带动当地就业。' },
    { id: 14, name: 'Dogger Bank 海上风电', en: 'Dogger Bank Wind Farm', country: '英国', region: '欧洲', cat: 'renewable', coord: [1.8, 54.7], cap: '3.6 GW', inv: 110, invText: '约 90 亿英镑', status: '在建', year: 2024, updated: '2026-01', owner: 'SSE / Equinor', flagship: true, desc: '世界最大在建海上风电场。',
      detail: '位于英国东北海岸约 130 公里外的北海多格滩，分 A/B/C 三期、总装机 3.6 GW，采用 GE Haliade-X 大兆瓦机组，是目前世界最大的在建海上风电场。由 SSE、挪威 Equinor 与 Vårgrønn 合建，截至 2025 年底基础桩全部安装完成，各阶段 2026 年陆续并网，建成后可为约 600 万英国家庭供电。' },
    { id: 15, name: 'Gemini 光伏+储能', en: 'Gemini Solar + Storage', country: '美国', region: '北美', cat: 'renewable', coord: [-114.8, 35.7], cap: '690 MW PV + 380 MW 储能', inv: 12, invText: '约 12 亿美元', status: '投运', year: 2024, updated: '2024-05', owner: 'Primergy', flagship: false, desc: '内华达州大型光储一体项目。',
      detail: '位于美国内华达州拉斯维加斯东北的联邦土地上，690 MW 光伏配套 380 MW/1.4 GWh 电池储能，2024 年全面投运。它是美国当时最大的光储一体化项目之一，向拉斯维加斯都会区供应清洁电力并提供夜间出力支撑。' },
    { id: 16, name: 'Vineyard Wind 1', en: 'Vineyard Wind 1', country: '美国', region: '北美', cat: 'renewable', coord: [-70.5, 41.1], cap: '806 MW', inv: 40, invText: '约 40 亿美元', status: '在建', year: 2024, updated: '2025-06', owner: 'Avangrid / CIP', flagship: false, desc: '美国首个商业规模海上风电场。',
      detail: '位于马萨诸塞州玛莎葡萄园岛以南海域，装机 806 MW，是美国首个商业规模的海上风电场，由 Avangrid 与哥本哈根基础设施基金（CIP）合建。项目自 2023 年底首台机组发电后分批并网，为新英格兰地区约 40 万户家庭供电，是美国海上风电产业起步的标志。' },
    { id: 17, name: 'Khavda 可再生能源园区', en: 'Khavda RE Park', country: '印度', region: '亚洲', cat: 'renewable', coord: [68.9, 23.9], cap: '规划 30 GW', inv: 200, invText: '约 200 亿美元', status: '在建', year: 2024, updated: '2025-10', owner: 'Adani', flagship: true, desc: '全球最大在建可再生能源园区。',
      detail: '位于印度古吉拉特邦卡奇地区接近巴基斯坦边境的盐碱荒地，规划风光总装机约 30 GW、占地约 538 平方公里，建成后将是全球最大的可再生能源园区。由阿达尼集团主导开发，并配套大规模储能与外送线路，是印度能源转型的旗舰工程。' },
    { id: 18, name: 'Cerro Dominador 光热+光伏', en: 'Cerro Dominador', country: '智利', region: '南美', cat: 'renewable', coord: [-69.3, -23.5], cap: 'CSP 110 MW + PV 100 MW', inv: 13, invText: '约 13 亿美元', status: '投运', year: 2021, updated: '2021-06', owner: 'Cerro Dominador', flagship: false, desc: '拉美首座光热电站。',
      detail: '位于智利阿塔卡马沙漠，由 110 MW 塔式光热（配 17.5 小时熔盐储热）与 100 MW 光伏组成，是拉丁美洲首座聚光太阳能光热电站。凭借全球最佳的光照资源，它可实现近乎全天候的清洁出力，为智利北部矿业负荷提供绿色电力。' },
    { id: 19, name: 'Belo Monte 水电站', en: 'Belo Monte Dam', country: '巴西', region: '南美', cat: 'renewable', coord: [-51.95, -3.1], cap: '11.2 GW', inv: 190, invText: '约 190 亿美元', status: '投运', year: 2021, updated: '2021-11', owner: 'Norte Energia', flagship: false, desc: '巴西第二大水电站。',
      detail: '位于巴西帕拉州亚马孙地区欣古河上，总装机 11.2 GW，是巴西第二大、全球第四大水电站，2019—2021 年全部机组投产。电站为巴西电网提供大量清洁电力，并通过中国国家电网建设的美丽山特高压直流送往东南负荷中心。' },
    { id: 20, name: '红海新城离网微电网', en: 'Red Sea Microgrid', country: '沙特', region: '中东', cat: 'renewable', coord: [35.5, 25.0], cap: '400 MW PV + 1 GWh 储能', inv: 18, invText: '约 18 亿美元', status: '投运', year: 2023, updated: '2023-04', owner: 'ACWA / Red Sea Global', flagship: false, desc: '全球最大离网光储微电网。',
      detail: '为沙特红海旅游新城供电，由约 400 MW 光伏与超过 1 GWh 电池储能组成，是全球最大的离网（不接入国家电网）光储微电网。项目实现景区 100% 可再生能源供电，全天候稳定运行，是沙特绿色旅游与零碳目的地的示范。' },

    /* ============ 输变电 · 电网 ============ */
    { id: 21, name: '哈密—重庆 ±800kV 特高压', en: 'Hami-Chongqing UHVDC', country: '中国', region: '中国', cat: 'grid', coord: [93.5, 42.8], cap: '±800kV / 8 GW / 2260km', inv: 40, invText: '约 286 亿元', status: '投运', year: 2025, updated: '2025-06', owner: '国家电网', flagship: true, desc: '2025 年 6 月送电的特高压新通道。',
      detail: '线路从新疆哈密巴里坤起、止于重庆，全长约 2260 公里，额定电压 ±800kV、输送容量 8 GW，2025 年 6 月 10 日正式送电。工程把新疆"沙戈荒"风光与火电打捆外送西南，每年向重庆输送电量约 360 亿千瓦时，是西北新能源大规模外送的标志性大动脉。', route: [[93.5, 42.8], [106.5, 29.6]] },
    { id: 22, name: '甘肃—浙江 ±800kV 特高压', en: 'Gansu-Zhejiang UHVDC', country: '中国', region: '中国', cat: 'grid', coord: [103.8, 36.0], cap: '±800kV / 8 GW', inv: 40, invText: '约 280 亿元', status: '在建', year: 2026, updated: '2026-01', owner: '国家电网', flagship: true, desc: '2026 年投运的西电东送新通道。',
      detail: '工程从甘肃送往浙江，额定 ±800kV、容量 8 GW，由日立能源等提供关键直流设备，计划 2026 年投运。建成后每年向浙江输送约 360 亿千瓦时电量、其中较高比例为新能源，缓解长三角负荷中心的电力缺口。', route: [[103.8, 36.0], [120.2, 30.3]] },
    { id: 23, name: '宁夏—湖南（宁电入湘）±800kV', en: 'Ningxia-Hunan UHVDC', country: '中国', region: '中国', cat: 'grid', coord: [106.2, 37.5], cap: '±800kV / 8 GW / 1600km', inv: 41, invText: '约 290 亿元', status: '在建', year: 2025, updated: '2025-06', owner: '国家电网', flagship: false, desc: '宁夏新能源外送湖南。',
      detail: '"宁电入湘"特高压直流从宁夏中卫送往湖南衡阳，全长约 1600 公里、容量 8 GW，是全国首条以输送新能源为主的特高压通道，配套腾格里沙漠大型风光基地。建成后每年向湖南送电约 360 亿千瓦时，新能源占比过半。', route: [[106.2, 37.5], [112.6, 26.9]] },
    { id: 24, name: '白鹤滩—浙江 ±800kV 特高压', en: 'Baihetan-Zhejiang UHV', country: '中国', region: '中国', cat: 'grid', coord: [102.9, 27.2], cap: '±800kV / 8 GW / 2140km', inv: 44, invText: '约 306 亿元', status: '投运', year: 2022, updated: '2022-07', owner: '国家电网', flagship: false, desc: '白鹤滩水电送长三角。',
      detail: '线路全长约 2140 公里、容量 8 GW，把金沙江白鹤滩水电站的清洁水电送往浙江，2022 年投运。它采用世界领先的特高压直流技术，每年向长三角输送清洁电量数百亿千瓦时。', route: [[102.9, 27.2], [120.1, 30.3]] },
    { id: 25, name: '白鹤滩—江苏 ±800kV 特高压', en: 'Baihetan-Jiangsu UHV', country: '中国', region: '中国', cat: 'grid', coord: [102.9, 27.2], cap: '±800kV / 8 GW / 2080km', inv: 43, invText: '约 307 亿元', status: '投运', year: 2022, updated: '2022-06', owner: '国家电网', flagship: false, desc: '白鹤滩水电送江苏。',
      detail: '全长约 2080 公里、容量 8 GW，是白鹤滩水电外送的另一条特高压直流通道，落点江苏苏州负荷中心，2022 年投运。工程为长三角提供稳定的清洁电力，助力区域减煤降碳。', route: [[102.9, 27.2], [118.8, 32.0]] },
    { id: 26, name: '陕北—湖北 ±800kV 特高压', en: 'Shaanbei-Hubei UHV', country: '中国', region: '中国', cat: 'grid', coord: [109.7, 38.3], cap: '±800kV / 8 GW', inv: 26, invText: '约 185 亿元', status: '投运', year: 2021, updated: '2021-01', owner: '国家电网', flagship: false, desc: '陕北能源外送华中。',
      detail: '从陕西榆林送往湖北武汉，额定 ±800kV、容量 8 GW，2021 年投运。工程把陕北能源基地的火电与新能源打捆外送华中负荷中心，提升华中电网的供电保障能力。', route: [[109.7, 38.3], [114.3, 30.6]] },
    { id: 27, name: '张北柔性直流电网', en: 'Zhangbei Flexible DC Grid', country: '中国', region: '中国', cat: 'grid', coord: [114.7, 41.16], cap: '±500kV / 四端柔直', inv: 18, invText: '约 125 亿元', status: '投运', year: 2020, updated: '2020-06', owner: '国家电网', flagship: false, desc: '世界首个柔性直流电网示范。',
      detail: '位于河北张家口，采用 ±500kV 四端柔性直流组网，是世界首个真正意义上的柔性直流电网示范工程，2020 年投运。它解决了大规模风光新能源并网消纳难题，并曾为 2022 年北京冬奥会场馆提供 100% 绿电。' },
    { id: 28, name: '美丽山特高压直流', en: 'Belo Monte UHV (Brazil)', country: '巴西', region: '南美', cat: 'grid', coord: [-51.95, -3.1], cap: '±800kV / 4 GW / 2500km', inv: 50, invText: '约 50 亿美元', status: '投运', year: 2021, updated: '2021-03', owner: '国家电网巴西公司', flagship: true, desc: '中国特高压技术出海标杆。',
      detail: '美丽山一期、二期均为 ±800kV、4 GW 的特高压直流，线路长约 2500 公里，把亚马孙美丽山水电送往里约热内卢等东南负荷中心。它由中国国家电网在巴西投资建设运营，是中国特高压成套技术、标准与装备走出国门的标志性工程。', route: [[-51.95, -3.1], [-43.2, -22.9]] },
    { id: 29, name: 'Viking Link 直流联网', en: 'Viking Link HVDC', country: '英国—丹麦', region: '欧洲', cat: 'grid', coord: [-0.2, 52.9], cap: '1.4 GW / 765km', inv: 23, invText: '约 21 亿欧元', status: '投运', year: 2024, updated: '2024-01', owner: 'National Grid / Energinet', flagship: false, desc: '世界最长陆海联合直流互联。',
      detail: '连接英国林肯郡与丹麦西部，全长约 765 公里、容量 1.4 GW，是目前世界最长的陆海联合高压直流互联线路，2024 年投运。它让英国风电与丹麦/北欧水电、风电互济，增强了双方电网的灵活性与供电安全。', route: [[-0.2, 52.9], [9.0, 55.5]] },
    { id: 30, name: 'North Sea Link 直流联网', en: 'North Sea Link', country: '挪威—英国', region: '欧洲', cat: 'grid', coord: [6.6, 59.5], cap: '1.4 GW / 720km', inv: 22, invText: '约 20 亿欧元', status: '投运', year: 2021, updated: '2021-10', owner: 'Statnett / National Grid', flagship: false, desc: '跨北海的英挪直流互联。',
      detail: '连接挪威西南部与英格兰东北部，全长约 720 公里、容量 1.4 GW，2021 年投运。线路实现挪威水电与英国风电的双向互济：英国风大时向挪威送电、风小时用挪威水电回供，提升两国可再生能源消纳能力。', route: [[6.6, 59.5], [-1.5, 55.1]] },
    { id: 31, name: 'SunZia 输电+风电', en: 'SunZia Transmission', country: '美国', region: '北美', cat: 'grid', coord: [-106.0, 34.0], cap: '±525kV / 3.5 GW / 885km', inv: 110, invText: '约 110 亿美元', status: '在建', year: 2024, updated: '2026-02', owner: 'Pattern Energy', flagship: true, desc: '美国史上最大清洁能源输电工程。',
      detail: '由新墨西哥州的 3.5 GW 陆上风电场与一条约 885 公里、±525kV 的高压直流输电线组成，把风电送往亚利桑那并接入加州市场，总投资约 110 亿美元，是美国史上最大的清洁能源基础设施项目。截至 2026 年初 674 台风机已全部交付安装，工程接近完工。', route: [[-106.0, 34.0], [-111.0, 33.3]] },
    { id: 32, name: 'Champlain Hudson 输电', en: 'Champlain Hudson Power Express', country: '美国', region: '北美', cat: 'grid', coord: [-73.6, 45.5], cap: '1.25 GW / 545km', inv: 60, invText: '约 60 亿美元', status: '在建', year: 2026, updated: '2026-05', owner: 'TDI / Blackstone', flagship: false, desc: '魁北克水电直送纽约市。',
      detail: '一条约 545 公里、容量 1.25 GW 的地埋/水下高压直流线路，沿尚普兰湖与哈德逊河把加拿大魁北克的水电送入纽约市，计划 2026 年 5 月起送电。它将为纽约市提供约 20% 的电力需求，大幅降低当地化石电源依赖与碳排放。', route: [[-73.6, 45.5], [-73.95, 40.75]] },
    { id: 33, name: '沙特—埃及电网互联', en: 'Saudi-Egypt Interconnector', country: '沙特—埃及', region: '中东', cat: 'grid', coord: [36.5, 28.0], cap: '±500kV / 3 GW', inv: 18, invText: '约 18 亿美元', status: '在建', year: 2024, updated: '2025-09', owner: '沙特电力 / 埃及电网', flagship: false, desc: '中东首个大型高压直流互联。',
      detail: '连接沙特与埃及，额定 ±500kV、容量 3 GW，是中东与北非地区首个大型高压直流互联工程。两国负荷高峰错时（沙特夏季用电高、埃及晚间高），互联后可错峰互济、共享备用，提升区域电网经济性与稳定性。', route: [[36.5, 28.0], [31.5, 28.5]] },
    { id: 34, name: 'Southern Spirit 直流输电', en: 'Southern Spirit Transmission', country: '美国', region: '北美', cat: 'grid', coord: [-94.8, 31.8], cap: '525kV / 3 GW / 320mi', inv: 30, invText: '约 30 亿美元', status: '在建', year: 2025, updated: '2025-08', owner: 'Pattern Energy', flagship: false, desc: '首次连通德州与美东南电网。',
      detail: '约 320 英里、525kV、3 GW 的双向高压直流线路，首次把相对孤立的德州 ERCOT 电网与美国东南部电网连通。建成后两大电网可在极端天气下相互支援，显著提升供电可靠性，是美国跨区联网的重要工程。', route: [[-94.8, 31.8], [-88.3, 33.4]] },

    /* ============ 储能 ============ */
    { id: 35, name: 'Snowy 2.0 抽水蓄能', en: 'Snowy 2.0', country: '澳大利亚', region: '大洋洲', cat: 'storage', coord: [148.4, -35.9], cap: '2.2 GW / 350 GWh', inv: 90, invText: '约 120 亿澳元', status: '在建', year: 2024, updated: '2025-06', owner: 'Snowy Hydro', flagship: true, desc: '南半球最大抽水蓄能。',
      detail: '在新南威尔士雪山地区已有水库间开挖隧洞、加装可逆机组，装机 2.2 GW、储能约 350 GWh，是南半球最大的抽水蓄能工程。建成后可为澳大利亚高比例可再生电网提供长时调节与兜底，相当于一座超大型"水电池"。' },
    { id: 36, name: 'Waratah 超级电池', en: 'Waratah Super Battery', country: '澳大利亚', region: '大洋洲', cat: 'storage', coord: [151.2, -33.0], cap: '850 MW / 1680 MWh', inv: 8, invText: '约 18 亿澳元', status: '投运', year: 2025, updated: '2025-08', owner: 'Akaysha Energy', flagship: false, desc: '南半球最大电池储能之一。',
      detail: '位于新南威尔士原电厂场地，规模 850 MW/1680 MWh，是南半球最大的电池储能项目之一。它充当电网的"减震器/缓冲器"，在线路故障时快速吞吐功率以保护输电通道，使既有线路能输送更多可再生电力。' },
    { id: 37, name: 'Moss Landing 储能电站', en: 'Moss Landing Energy Storage', country: '美国', region: '北美', cat: 'storage', coord: [-121.8, 36.8], cap: '约 3 GWh', inv: 10, invText: '约 10 亿美元', status: '投运', year: 2023, updated: '2023-05', owner: 'Vistra', flagship: false, desc: '加州大型锂电储能电站。',
      detail: '位于加州蒙特雷湾的原天然气电厂厂区，由 Vistra 建设运营，规模约 3 GWh，曾长期为全球最大的锂电池储能电站。它在加州傍晚光伏出力骤降时顶峰放电，是高比例新能源电网调峰的代表项目。' },
    { id: 38, name: 'Google–Xcel 铁空气长时储能', en: 'Google-Xcel Form Energy BESS', country: '美国', region: '北美', cat: 'storage', coord: [-93.3, 45.0], cap: '300 MW / 30 GWh', inv: 10, invText: '约 10 亿美元', status: '在建', year: 2026, updated: '2026-02', owner: 'Google / Xcel / Form Energy', flagship: true, desc: '迄今按吉瓦时计全球最大电池项目。',
      detail: '2026 年 2 月由 Xcel Energy 与 Google 公布、采用 Form Energy 铁空气电池技术，规模 300 MW/30 GWh，是迄今按吉瓦时计全球最大的电池储能项目。铁空气电池可实现约 100 小时的长时储能，主要为明尼苏达的数据中心与电网提供多日级别的可靠供电。' },
    { id: 39, name: '马斯达尔 24/7 光储项目', en: 'Masdar 24/7 Solar+Storage', country: '阿联酋', region: '中东', cat: 'storage', coord: [54.4, 24.4], cap: '5.2 GW PV + 19 GWh 电池', inv: 60, invText: '约 60 亿美元', status: '在建', year: 2025, updated: '2025-12', owner: 'Masdar / EWEC', flagship: true, desc: '全球首个吉瓦级全天候光储。',
      detail: '由阿联酋马斯达尔与 EWEC 推进，配置约 5.2 GW 光伏与约 19 GWh 电池储能，目标实现 1 GW 级的全天候（24/7）稳定出力，是全球首个该量级的光储一体化项目。它将证明纯光伏+电池也能提供接近基荷的可靠电力。' },
    { id: 40, name: '拉达克 BESS 储能', en: 'Ladakh BESS', country: '印度', region: '亚洲', cat: 'storage', coord: [77.6, 34.2], cap: '约 12 GWh', inv: 15, invText: '约 15 亿美元', status: '在建', year: 2025, updated: '2025-10', owner: 'SECI / 印度国企', flagship: false, desc: '高原超大电池储能。',
      detail: '位于印度高海拔的拉达克地区，规模约 12 GWh，配套当地大型可再生能源基地，用于平抑出力波动并支撑长距离外送。它是印度规模最大的电池储能项目之一，对高原电网稳定具有示范意义。' },
    { id: 41, name: 'Oasis de Atacama 储能', en: 'Oasis de Atacama', country: '智利', region: '南美', cat: 'storage', coord: [-69.3, -23.6], cap: '约 11 GWh', inv: 20, invText: '约 20 亿美元', status: '在建', year: 2025, updated: '2025-09', owner: 'Grenergy', flagship: false, desc: '阿塔卡马沙漠超大储能。',
      detail: '由西班牙 Grenergy 在智利阿塔卡马沙漠建设，分期配置约 11 GWh 电池储能，与大型光伏配套。它把白天充沛的太阳能储存到夜间释放，是拉美规模最大的储能项目之一，助力智利电网摆脱对化石调峰电源的依赖。' },
    { id: 42, name: '大连液流电池储能调峰电站', en: 'Dalian Flow Battery', country: '中国', region: '中国', cat: 'storage', coord: [121.6, 38.9], cap: '200 MW / 800 MWh', inv: 3, invText: '约 19 亿元', status: '投运', year: 2022, updated: '2022-10', owner: '融科 / 大连恒流', flagship: false, desc: '全球最大全钒液流电池储能。',
      detail: '位于辽宁大连，一期 100 MW/400 MWh 已投运、远期 200 MW/800 MWh，是全球最大的全钒液流电池储能电站。全钒液流电池本征安全、循环寿命长，适合大规模长时储能，是国家级化学储能调峰示范工程。' },
    { id: 43, name: '湖北应城压缩空气储能', en: 'Yingcheng Compressed Air Storage', country: '中国', region: '中国', cat: 'storage', coord: [113.5, 30.9], cap: '300 MW / 1500 MWh', inv: 3, invText: '约 20 亿元', status: '投运', year: 2024, updated: '2024-04', owner: '中能建 等', flagship: false, desc: '世界最大压缩空气储能。',
      detail: '位于湖北应城，单机 300 MW，利用地下盐穴储存压缩空气，是当时世界单机规模最大、效率最高的非补燃压缩空气储能电站，2024 年投运。它为长时、大容量、低成本储能提供了新路径，是新型储能多元化的代表。' },
    { id: 44, name: '沙特四基地电池储能', en: 'Saudi BESS Mega Project', country: '沙特', region: '中东', cat: 'storage', coord: [42.6, 19.98], cap: '约 8 GWh', inv: 5, invText: '约 5 亿美元', status: '在建', year: 2024, updated: '2025-07', owner: 'BYD / 沙特电力', flagship: true, desc: '全球最大单体电池储能之一。',
      detail: '沙特电力公司在比沙等多个基地部署的大型电池储能，单批容量达数 GWh，由比亚迪等供货，是全球最大的单体电池储能项目之一。它支撑沙特快速增长的光伏装机消纳，并为"2030 愿景"高比例可再生目标兜底。' },

    /* ============ 工商业 · 配网大客户 ============ */
    { id: 45, name: '特斯拉柏林超级工厂', en: 'Tesla Gigafactory Berlin', country: '德国', region: '欧洲', cat: 'ci', coord: [13.8, 52.4], cap: '整车+电池，年用电 TWh 级', inv: 60, invText: '约 50 亿欧元', status: '投运', year: 2022, updated: '2024-06', owner: 'Tesla', flagship: true, desc: '欧洲超级工厂、超大工商业用户。',
      detail: '位于德国勃兰登堡格林海德，2022 年投产，是特斯拉在欧洲的整车与电池超级工厂，规划年产能数十万辆。作为年用电 TWh 级的超大工商业用户，工厂自建屋顶光伏并对当地高压配电与水资源提出巨大需求，是绿色制造与电网增容协同的典型案例。' },
    { id: 46, name: 'TSMC 亚利桑那晶圆厂', en: 'TSMC Arizona Fab', country: '美国', region: '北美', cat: 'ci', coord: [-112.1, 33.7], cap: '先进制程，城市级用电', inv: 1650, invText: '约 1650 亿美元', status: '在建', year: 2024, updated: '2025-10', owner: '台积电', flagship: true, desc: '美国最大半导体投资。',
      detail: '台积电在亚利桑那凤凰城建设多座先进制程晶圆厂，累计承诺投资已追加至约 1650 亿美元，是美国历史上最大的外商半导体投资。单座晶圆厂的用电、用水规模相当于一座中型城市，正推动当地电网与供水系统大规模扩容，并带动完整的半导体供应链落地。' },
    { id: 47, name: 'Intel 俄亥俄晶圆厂', en: 'Intel Ohio Fab', country: '美国', region: '北美', cat: 'ci', coord: [-82.7, 40.1], cap: '先进制程园区', inv: 280, invText: '约 280 亿美元', status: '在建', year: 2024, updated: '2025-09', owner: 'Intel', flagship: false, desc: '"硅心脏"超大晶圆园区。',
      detail: '位于俄亥俄州哥伦布附近，英特尔规划建设号称"硅心脏"的超大晶圆制造园区，初期投资约 280 亿美元。受半导体市场调整影响投产节奏有所推迟，但项目仍是美国本土先进制程制造与电网增容的重大工程。' },
    { id: 48, name: '宁德时代福鼎电池基地', en: 'CATL Fuding Base', country: '中国', region: '中国', cat: 'ci', coord: [119.5, 26.9], cap: '动力电池超级工厂', inv: 30, invText: '约 200 亿元', status: '投运', year: 2022, updated: '2024-03', owner: '宁德时代', flagship: false, desc: '全球最大动力电池企业核心基地。',
      detail: '位于福建宁德福鼎，是全球最大动力电池制造商宁德时代的核心生产基地之一，已建成"灯塔工厂"与零碳工厂示范。基地大量采用光伏与绿电，并以极高的自动化水平大规模生产动力与储能电池，是新能源产业链上的超大工商业用户。' },
    { id: 49, name: '塔塔 Dholera 半导体厂', en: 'Tata Dholera Fab', country: '印度', region: '亚洲', cat: 'ci', coord: [72.2, 22.2], cap: '印度首座大型晶圆厂', inv: 110, invText: '约 110 亿美元', status: '在建', year: 2024, updated: '2025-08', owner: 'Tata / PSMC', flagship: false, desc: '印度首座大型晶圆厂。',
      detail: '塔塔集团联合中国台湾力积电（PSMC）在古吉拉特邦多勒拉建设印度首座大型晶圆厂，投资约 110 亿美元。作为印度芯片自主战略的旗舰，项目配套专用电力、超纯水与产业新城，对当地电网与基础设施带来巨大增量需求。' },

    /* ============ 数据中心 ============ */
    { id: 50, name: 'Stargate AI 超级数据中心', en: 'Stargate', country: '美国', region: '北美', cat: 'datacenter', coord: [-99.73, 32.45], cap: '规划 10 GW / 多站点', inv: 5000, invText: '约 5000 亿美元（至2029）', status: '在建', year: 2025, updated: '2026-06', owner: 'OpenAI / Oracle / 软银 / MGX', flagship: true, desc: '全美最大 AI 基建。',
      detail: '由 OpenAI、甲骨文、软银与 MGX 合资，计划到 2029 年投资高达 5000 亿美元、建成约 10 GW 的 AI 算力。首个旗舰园区位于得州阿比林，2025—2026 年已扩展至得州、新墨西哥、俄亥俄、密歇根等约 10 个站点。其惊人的电力需求（单园区数 GW）正重塑美国电力规划，并催生配套的发电与储能投资。' },
    { id: 51, name: 'xAI Colossus 超算中心', en: 'xAI Colossus', country: '美国', region: '北美', cat: 'datacenter', coord: [-90.0, 35.1], cap: 'GW 级 AI 超算', inv: 150, invText: '约 150 亿美元', status: '在建', year: 2024, updated: '2025-09', owner: 'xAI', flagship: false, desc: '孟菲斯 AI 超级计算中心。',
      detail: '马斯克旗下 xAI 在田纳西州孟菲斯建设的"Colossus"超级计算集群，部署数十万张 GPU 训练大模型，并持续向 GW 级电力需求扩张。项目因临时燃气发电与电力、用水问题引发当地关注，是 AI 算力急速扩张带来电网压力的缩影。' },
    { id: 52, name: 'UAE Stargate 数据中心', en: 'UAE Stargate (Abu Dhabi)', country: '阿联酋', region: '中东', cat: 'datacenter', coord: [54.45, 24.45], cap: '规划 5 GW', inv: 300, invText: '数百亿美元', status: '在建', year: 2026, updated: '2026-01', owner: 'G42 / Nvidia / OpenAI', flagship: true, desc: '美国境外最大 AI 数据中心集群。',
      detail: '位于阿布扎比，由阿联酋 G42 联合英伟达、OpenAI、思科、甲骨文等打造，规划约 5 GW 算力，是美国境外规模最大的 AI 数据中心集群，2026 年起分期投用。依托当地廉价能源与资本，阿联酋意在成为中东人工智能与算力枢纽。' },
    { id: 53, name: '北弗吉尼亚数据中心走廊', en: 'Northern Virginia Data Center Alley', country: '美国', region: '北美', cat: 'datacenter', coord: [-77.49, 39.04], cap: '全球最大集群 >5 GW', inv: 500, invText: '累计数百亿美元', status: '投运', year: 2024, updated: '2026-03', owner: 'AWS / 微软 / Google 等', flagship: true, desc: '全球数据中心最密集区域。',
      detail: '弗吉尼亚州劳登县阿什本一带聚集了全球最密集的数据中心集群，承载着全球相当大比例的互联网流量，总用电已超 5 GW 并持续扩张。AWS、微软、谷歌等在此密集布局，其电力需求已迫使当地电网与电源规划进行大规模调整。' },
    { id: 54, name: '柔佛数据中心集群', en: 'Johor Data Center Hub', country: '马来西亚', region: '亚洲', cat: 'datacenter', coord: [103.76, 1.49], cap: '在建数 GW', inv: 200, invText: '约 200 亿美元', status: '在建', year: 2024, updated: '2025-11', owner: '多家云厂商', flagship: false, desc: '东南亚增长最快的数据中心枢纽。',
      detail: '马来西亚柔佛紧邻新加坡，承接新加坡因土地与电力受限而外溢的数据中心需求，在建容量已达数 GW，是东南亚增长最快的数据中心枢纽。各大云厂商与 AI 公司在此密集投资，带动当地电力、光伏与配套基础设施快速扩张。' },
    { id: 55, name: '利雅得 AI 数据中心（HUMAIN）', en: 'Riyadh AI Data Centers', country: '沙特', region: '中东', cat: 'datacenter', coord: [46.7, 24.7], cap: '规划数 GW', inv: 150, invText: '约 150 亿美元', status: '在建', year: 2025, updated: '2025-11', owner: 'HUMAIN / 多家云厂商', flagship: false, desc: '中东 AI 算力中心。',
      detail: '沙特主权基金支持的 HUMAIN 联合英伟达、AMD 等在利雅得等地建设大规模 AI 数据中心，规划数 GW 算力。依托廉价能源与资本，沙特意在把算力打造成"2030 愿景"下的新经济支柱。' },
    { id: 56, name: 'Meta Luleå 数据中心', en: 'Meta Luleå Data Center', country: '瑞典', region: '欧洲', cat: 'datacenter', coord: [22.1, 65.6], cap: '100% 水电供能', inv: 20, invText: '约 20 亿美元', status: '投运', year: 2023, updated: '2023-06', owner: 'Meta', flagship: false, desc: '北极圈绿色数据中心。',
      detail: '位于瑞典北部接近北极圈的吕勒奥，Meta 利用当地寒冷气候自然冷却、并以 100% 水电供能，运营高能效的绿色数据中心。它是利用气候与清洁能源禀赋选址数据中心的经典案例。' },

    /* ============ 大交通 · 轨交机场港口 ============ */
    { id: 57, name: '雅万高铁', en: 'Jakarta–Bandung HSR', country: '印度尼西亚', region: '亚洲', cat: 'transport', coord: [106.8, -6.2], cap: '时速 350km / 142km', inv: 73, invText: '约 73 亿美元', status: '投运', year: 2023, updated: '2023-10', owner: 'KCIC（中印尼合资）', flagship: true, desc: '东南亚首条高速铁路。',
      detail: '连接印尼首都雅加达与万隆，全长约 142 公里、设计时速 350 公里，2023 年 10 月开通，是东南亚首条高速铁路，全套采用中国技术、标准与装备。它把两市间旅行时间压缩到约 40 分钟，是"一带一路"和中印尼合作的标志性工程。', route: [[106.8, -6.2], [107.6, -6.9]] },
    { id: 58, name: '中老铁路', en: 'China–Laos Railway', country: '中国—老挝', region: '亚洲', cat: 'transport', coord: [102.7, 25.04], cap: '电气化铁路 / 1035km', inv: 59, invText: '约 59 亿美元', status: '投运', year: 2021, updated: '2021-12', owner: '中老铁路公司', flagship: false, desc: '连接昆明与万象的跨境铁路。',
      detail: '北起云南昆明、南至老挝万象，全长约 1035 公里的电气化铁路，2021 年 12 月开通。它让"陆锁国"老挝变身"陆联国"，大幅降低跨境客货运成本，并带动沿线电气化供电、口岸与产业发展，是中老命运共同体的旗舰工程。', route: [[102.7, 25.04], [102.6, 17.97]] },
    { id: 59, name: '匈塞铁路', en: 'Budapest–Belgrade Railway', country: '匈牙利—塞尔维亚', region: '欧洲', cat: 'transport', coord: [20.46, 44.79], cap: '电气化提速 / 350km', inv: 30, invText: '约 30 亿美元', status: '在建', year: 2024, updated: '2025-06', owner: '中国中铁 / 中交', flagship: false, desc: '中国—中东欧旗舰铁路。',
      detail: '连接匈牙利布达佩斯与塞尔维亚贝尔格莱德，全长约 350 公里的电气化提速改造铁路。其中贝尔格莱德—诺维萨德段已通车运营，是中国—中东欧合作和"一带一路"在欧洲的旗舰项目，将提升中欧陆海快线的运输效率。', route: [[20.46, 44.79], [19.0, 47.5]] },
    { id: 60, name: '麦加—麦地那高铁（哈拉曼）', en: 'Haramain HSR', country: '沙特', region: '中东', cat: 'transport', coord: [39.8, 21.4], cap: '时速 300km / 450km', inv: 60, invText: '约 60 亿美元', status: '投运', year: 2021, updated: '2021-03', owner: '沙特铁路', flagship: false, desc: '连接两大圣城的高速铁路。',
      detail: '连接麦加、麦地那并经吉达、阿卜杜拉国王经济城，全长约 450 公里、时速 300 公里。它是朝觐运输的主动脉，高峰期每年运送数百万朝觐者，显著缓解公路压力，是沙特现代化交通的标志。', route: [[39.2, 21.5], [39.6, 24.5]] },
    { id: 61, name: '钱凯港', en: 'Port of Chancay', country: '秘鲁', region: '南美', cat: 'transport', coord: [-77.27, -11.57], cap: '南美首个智慧绿色大港', inv: 35, invText: '约 35 亿美元', status: '投运', year: 2024, updated: '2024-11', owner: '中远海运 / Volcan', flagship: true, desc: '南美—亚洲海运新枢纽。',
      detail: '位于秘鲁首都利马以北，由中远海运控股建设运营，是南美西海岸首个智慧、绿色深水大港，2024 年 11 月开港。它开通了直达上海的航线，把秘鲁到中国的海运时间缩短约 10 天，重塑南美—亚洲贸易格局并带动港口岸电等绿色基建。' },
    { id: 62, name: '利雅得萨勒曼国王国际机场', en: 'King Salman Intl Airport', country: '沙特', region: '中东', cat: 'transport', coord: [46.7, 24.96], cap: '远期年吞吐 1.85 亿人次', inv: 300, invText: '约 300 亿美元', status: '在建', year: 2025, updated: '2025-09', owner: '沙特 PIF', flagship: true, desc: '规划中全球最大机场之一。',
      detail: '由沙特主权基金 PIF 主导，规划六条跑道、远期年吞吐量高达 1.85 亿人次，建成后将是全球最大的机场之一。它是利雅得打造全球航空与物流枢纽、支撑"2030 愿景"经济多元化的核心基建。' },
    { id: 63, name: '隆城国际机场', en: 'Long Thanh Intl Airport', country: '越南', region: '亚洲', cat: 'transport', coord: [107.0, 10.8], cap: '一期年 2500 万→远期 1 亿人次', inv: 78, invText: '约 78 亿美元（一期）', status: '在建', year: 2026, updated: '2026-01', owner: 'ACV', flagship: true, desc: '越南最大空港。',
      detail: '位于胡志明市以东同奈省，一期工程计划 2026 年完工、年吞吐 2500 万人次，远期扩至 1 亿人次，建成后将是越南最大机场。它将分流新山一机场压力、强化越南区域航空枢纽地位，并带动周边产业与电力配套。' },
    { id: 64, name: '西悉尼国际机场', en: 'Western Sydney Airport', country: '澳大利亚', region: '大洋洲', cat: 'transport', coord: [150.7, -33.88], cap: '首期年 1000 万人次', inv: 75, invText: '约 110 亿澳元', status: '在建', year: 2026, updated: '2026-01', owner: 'WSA Co', flagship: false, desc: '悉尼第二机场。',
      detail: '位于悉尼西郊，计划 2026 年下半年投运，首期年吞吐约 1000 万人次，是悉尼第二个国际机场。机场配套新建专用地铁线与道路、电力网络，缓解金斯福德·史密斯机场的运力瓶颈并带动悉尼西部发展。' },
    { id: 65, name: '波兰中央机场（CPK）', en: 'Central Airport (CPK)', country: '波兰', region: '欧洲', cat: 'transport', coord: [20.5, 52.0], cap: '机场+高铁枢纽', inv: 330, invText: '约 300 亿欧元', status: '在建', year: 2026, updated: '2026-02', owner: 'CPK', flagship: true, desc: '欧洲最大在建空铁枢纽。',
      detail: '位于华沙与罗兹之间，规划两条平行跑道、并整合高速铁路枢纽与公路网，投资约 300 亿欧元、2026 年开工，服务约 2100 万人口腹地。它将成为中东欧最大的航空与高铁综合枢纽，并提供高铁"以铁代航"的连接。' },
    { id: 66, name: '加州高速铁路', en: 'California High-Speed Rail', country: '美国', region: '北美', cat: 'transport', coord: [-119.0, 35.4], cap: '一期 Bakersfield–Merced', inv: 1000, invText: '超 1000 亿美元', status: '在建', year: 2025, updated: '2025-12', owner: 'CAHSR', flagship: false, desc: '美国首条真正意义高铁。',
      detail: '规划连接旧金山与洛杉矶，目前在中央谷地 119 英里区段全面施工，绝大多数结构已在建或完工，是美国首条真正意义上的高速铁路。项目工期与预算屡受挑战，但被视为美国客运铁路现代化的关键尝试。', route: [[-119.0, 35.4], [-120.5, 37.3]] },
    { id: 67, name: '比雷埃夫斯港', en: 'Port of Piraeus', country: '希腊', region: '欧洲', cat: 'transport', coord: [23.62, 37.94], cap: '地中海第一大港', inv: 15, invText: '累计约 15 亿欧元', status: '投运', year: 2022, updated: '2024-06', owner: '中远海运', flagship: false, desc: '中欧陆海快线南端门户。',
      detail: '由中远海运控股运营，集装箱吞吐量跃居地中海前列，是"中欧陆海快线"的南端门户。港口持续投资扩建并推进岸电改造，使靠港船舶停泊期间使用清洁岸电、减少排放，是绿色港口与"一带一路"互联互通的典范。' },
    { id: 68, name: '瓜达尔港', en: 'Gwadar Port', country: '巴基斯坦', region: '亚洲', cat: 'transport', coord: [62.33, 25.12], cap: '深水良港+自贸区', inv: 16, invText: '约 16 亿美元', status: '在建', year: 2024, updated: '2025-03', owner: '中国海外港口 / 巴方', flagship: false, desc: '中巴经济走廊出海口。',
      detail: '位于巴基斯坦俾路支省阿拉伯海沿岸，是中巴经济走廊（CPEC）的出海门户，配套自由贸易区、电厂与海水淡化设施。建成后可为中国西部提供更短的印度洋出海通道，并带动当地能源与基础设施发展。' },

    /* ============ 石油化工 · LNG ============ */
    { id: 69, name: '北方气田 LNG 扩能', en: 'North Field LNG Expansion', country: '卡塔尔', region: '中东', cat: 'petro', coord: [51.6, 25.9], cap: 'LNG 产能增至 142 MTPA', inv: 290, invText: '约 290 亿美元', status: '在建', year: 2024, updated: '2025-12', owner: 'QatarEnergy', flagship: true, desc: '全球最大 LNG 扩能工程。',
      detail: '卡塔尔依托全球最大的单体气田——北方气田，分东、南两期及进一步扩建把 LNG 年产能从约 7700 万吨提升到 2030 年前的约 1.42 亿吨。这是全球最大的 LNG 扩能工程，将进一步巩固卡塔尔作为全球头号 LNG 出口国的地位。' },
    { id: 70, name: 'CP2 LNG（二期）', en: 'CP2 LNG Phase 2', country: '美国', region: '北美', cat: 'petro', coord: [-93.34, 29.77], cap: 'LNG 大型出口', inv: 280, invText: '二期约 86 亿美元融资', status: '在建', year: 2026, updated: '2026-03', owner: 'Venture Global', flagship: true, desc: '路易斯安那大型出口 LNG。',
      detail: '由 Venture Global 在路易斯安那州卡尔克苏建设的大型出口 LNG 项目，2026 年 3 月二期完成最终投资决定并落实约 86 亿美元融资。它是 2025—2026 年美国新一轮 LNG 投资潮的代表，进一步扩大美国对欧洲、亚洲的天然气出口能力。' },
    { id: 71, name: 'Plaquemines LNG', en: 'Plaquemines LNG', country: '美国', region: '北美', cat: 'petro', coord: [-89.9, 29.5], cap: 'LNG 约 24 MTPA', inv: 250, invText: '约 250 亿美元', status: '在建', year: 2024, updated: '2025-12', owner: 'Venture Global', flagship: true, desc: '路易斯安那大型出口 LNG。',
      detail: '位于路易斯安那州密西西比河口附近，规模约 2400 万吨/年，采用模块化建造、快速投产，已于 2024—2025 年开始分阶段产出 LNG。它是 Venture Global 的旗舰出口终端之一，助推美国成为全球最大 LNG 出口国。' },
    { id: 72, name: 'Lake Charles LNG', en: 'Lake Charles LNG', country: '美国', region: '北美', cat: 'petro', coord: [-93.3, 30.2], cap: 'LNG 约 16.5 MTPA', inv: 150, invText: '约 150 亿美元', status: '规划', year: 2026, updated: '2026-01', owner: 'Energy Transfer', flagship: false, desc: '推进 FID 的得州墨西哥湾 LNG。',
      detail: '由 Energy Transfer 在路易斯安那州查尔斯湖既有接收站基础上改建为出口终端，规模约 1650 万吨/年，2026 年初在锁定多项长期供气协议后推进最终投资决定。它是美国 LNG 出口扩张的又一重要后备产能。' },
    { id: 73, name: '阿拉斯加 LNG', en: 'Alaska LNG', country: '美国', region: '北美', cat: 'petro', coord: [-149.9, 61.2], cap: 'LNG 约 20 MTPA + 800mi 管道', inv: 440, invText: '约 440 亿美元', status: '规划', year: 2026, updated: '2026-03', owner: 'Glenfarne', flagship: true, desc: '北坡天然气液化出口。',
      detail: '由 Glenfarne 牵头，把阿拉斯加北坡丰富的天然气经约 800 英里管道输送到基奈半岛尼基斯基进行液化出口，总投资约 440 亿美元。项目已与多家油气巨头锁定气源、2026 年推进最终投资决定，建成后可向亚洲市场提供更短航程的 LNG。', route: [[-148.3, 70.2], [-151.3, 60.7]] },
    { id: 74, name: 'LNG Canada 二期', en: 'LNG Canada Phase 2', country: '加拿大', region: '北美', cat: 'petro', coord: [-128.6, 54.0], cap: 'LNG 扩能', inv: 200, invText: '约 200 亿加元', status: '规划', year: 2026, updated: '2026-05', owner: 'Shell 等', flagship: false, desc: '基蒂马特 LNG 扩能。',
      detail: '位于不列颠哥伦比亚省基蒂马特，由壳牌牵头的合资体运营，一期已投产并向亚洲出口 LNG，二期扩能在 2026 年内推进最终投资决定。依托加拿大西海岸到亚洲的较短航程，它是北美对亚 LNG 供应的重要增量。' },
    { id: 75, name: 'Stabroek 深海油田', en: 'Stabroek Block', country: '圭亚那', region: '南美', cat: 'petro', coord: [-56.5, 7.8], cap: '可采 >110 亿桶', inv: 430, invText: '累计约 430 亿美元', status: '投运', year: 2022, updated: '2025-09', owner: 'ExxonMobil / Hess / 中海油', flagship: true, desc: '近十年全球最大深海油气发现。',
      detail: '位于圭亚那外海，由埃克森美孚作业、赫斯与中海油参股，已探明可采资源超过 110 亿桶油当量，是近十年全球最大的深海油气发现。多艘浮式生产储油卸油装置（FPSO）陆续投产，使圭亚那一跃成为人均产油量极高的新兴产油国。' },
    { id: 76, name: '丹格特炼油厂', en: 'Dangote Refinery', country: '尼日利亚', region: '非洲', cat: 'petro', coord: [3.6, 6.45], cap: '65 万桶/日', inv: 200, invText: '约 200 亿美元', status: '投运', year: 2024, updated: '2025-06', owner: 'Dangote Group', flagship: true, desc: '全球最大单体炼油厂。',
      detail: '位于尼日利亚拉各斯莱基自贸区，加工能力 65 万桶/日，是全球最大的单一系列炼油厂，2024 年起投产。它扭转了西非长期依赖成品油进口的格局，使尼日利亚有望从原油出口国转变为成品油净出口国，并配套自备电厂与码头。' },
    { id: 77, name: 'Jafurah 页岩气田', en: 'Jafurah Shale Gas', country: '沙特', region: '中东', cat: 'petro', coord: [49.5, 25.0], cap: '中东最大非常规气田', inv: 1000, invText: '约 1000 亿美元', status: '在建', year: 2024, updated: '2025-08', owner: '沙特阿美', flagship: true, desc: '沙特"气代油"战略核心。',
      detail: '位于沙特东部，是中东最大的非常规（页岩）气田，沙特阿美计划投入约 1000 亿美元分阶段开发。增产的天然气用于发电、工业和制蓝氢，从而把更多原油腾出用于出口，是沙特"气代油"能源战略的核心工程。' },
    { id: 78, name: '北极 LNG-2', en: 'Arctic LNG 2', country: '俄罗斯', region: '欧洲', cat: 'petro', coord: [73.3, 71.5], cap: 'LNG 约 20 MTPA', inv: 210, invText: '约 210 亿美元', status: '在建', year: 2024, updated: '2025-06', owner: 'Novatek 等', flagship: false, desc: '北极圈重力式 LNG 工厂。',
      detail: '位于俄罗斯北极圈格丹半岛，由诺瓦泰克牵头，采用建在重力式基座（GBS）上的模块化液化线，规划产能约 2000 万吨/年。项目受西方制裁影响，在设备、船运与销售上进展受阻，是地缘政治对能源工程影响的典型案例。' },
    { id: 79, name: '恒力长兴岛炼化一体化', en: 'Hengli Changxing Refinery', country: '中国', region: '中国', cat: 'petro', coord: [121.5, 39.6], cap: '炼油 2000 万吨/年', inv: 90, invText: '约 740 亿元', status: '投运', year: 2021, updated: '2023-06', owner: '恒力石化', flagship: false, desc: '世界级炼化一体化基地。',
      detail: '位于辽宁大连长兴岛，2000 万吨/年炼油配套大型乙烯与芳烃装置，是世界级的炼化一体化基地。它走"减油增化"路线、最大化生产高附加值化工产品，代表中国民营大炼化的崛起。' },

    /* ============ 矿业 ============ */
    { id: 80, name: 'Simandou 铁矿', en: 'Simandou Iron Ore', country: '几内亚', region: '非洲', cat: 'mining', coord: [-8.9, 9.0], cap: '高品位铁矿 + 620km 铁路', inv: 230, invText: '约 230 亿美元', status: '投运', year: 2025, updated: '2026-01', owner: '力拓 / 中铝 / 赢联盟', flagship: true, desc: '全球最大在建高品位铁矿。',
      detail: '位于几内亚东南部山区，铁品位约 65.8%，是全球最大、品位最高的未开发铁矿之一。Blocks 1-2 由中资主导的赢联盟、Blocks 3-4 由力拓-中铝合资开发，配套约 620 公里的 TransGuinéen 重载铁路与新建港口。首船矿石于 2025 年 12 月发运、2026 年 1 月运抵浙江，未来年产能将爬坡至约 1.2 亿吨，重塑全球铁矿石供应格局。', route: [[-8.9, 9.0], [-13.3, 9.4]] },
    { id: 81, name: 'Escondida 铜矿', en: 'Escondida Copper Mine', country: '智利', region: '南美', cat: 'mining', coord: [-69.07, -24.27], cap: '全球最大铜矿', inv: 130, invText: '近年扩产约 130 亿美元', status: '投运', year: 2024, updated: '2025-08', owner: 'BHP / 力拓', flagship: true, desc: '全球产量第一的铜矿。',
      detail: '位于智利阿塔卡马沙漠，由必和必拓运营、力拓等参股，是全球产量第一的铜矿。近年持续投入约 130 亿美元用于扩产、海水淡化与选矿升级，并已实现 100% 可再生能源供电，对全球能源转型所需的铜供应至关重要。' },
    { id: 82, name: 'Quellaveco 铜矿', en: 'Quellaveco Copper Mine', country: '秘鲁', region: '南美', cat: 'mining', coord: [-70.6, -16.9], cap: '年产铜约 30 万吨', inv: 55, invText: '约 55 亿美元', status: '投运', year: 2022, updated: '2022-09', owner: 'Anglo American / 三菱', flagship: false, desc: '秘鲁特大型铜矿。',
      detail: '位于秘鲁南部莫克瓜地区，由英美资源与三菱合资开发，年产铜约 30 万吨，2022 年投产。它是全球首批全数字化、远程操控的"无人矿山"之一，代表现代铜矿开采的智能化方向。' },
    { id: 83, name: '科卢韦齐钴铜矿', en: 'Kolwezi Cobalt-Copper', country: '刚果（金）', region: '非洲', cat: 'mining', coord: [25.47, -10.7], cap: '全球钴供应核心', inv: 40, invText: '累计约 40 亿美元', status: '投运', year: 2023, updated: '2025-06', owner: '洛阳钼业 / 嘉能可等', flagship: true, desc: '全球钴矿心脏地带。',
      detail: '位于刚果（金）加丹加铜钴矿带的科卢韦齐，是全球钴供应的心脏地带，由洛阳钼业（TFM、KFM 等矿山）、嘉能可等运营。这里出产的钴是动力电池正极的关键原料，其供应与可持续采矿状况直接影响全球电动车产业链。' },
    { id: 84, name: 'Morowali 镍工业园（IMIP）', en: 'Morowali Nickel Park', country: '印度尼西亚', region: '亚洲', cat: 'mining', coord: [121.9, -2.7], cap: '全球最大镍冶炼基地', inv: 150, invText: '累计约 150 亿美元', status: '投运', year: 2023, updated: '2025-09', owner: '青山 / 印尼 Bintang', flagship: true, desc: '全球最大镍冶炼基地。',
      detail: '位于印尼苏拉威西岛，由中国青山集团与印尼方共建，是全球最大的镍冶炼与不锈钢、电池前驱体产业基地。园区集采矿、冶炼、不锈钢、电池材料于一体并自备大型电厂，深刻影响全球镍与动力电池供应链，但也面临能耗与环境争议。' },
    { id: 85, name: 'Greenbushes 锂矿', en: 'Greenbushes Lithium', country: '澳大利亚', region: '大洋洲', cat: 'mining', coord: [116.06, -33.85], cap: '全球最大硬岩锂矿', inv: 30, invText: '近年扩产约 30 亿澳元', status: '投运', year: 2023, updated: '2025-06', owner: '天齐 / 雅保 / IGO', flagship: true, desc: '全球最大硬岩锂矿。',
      detail: '位于西澳，是全球品位最高、规模最大的硬岩锂辉石矿，由天齐锂业、雅保与 IGO 共同持有。其锂精矿供应全球大量电池级锂盐产能，近年持续扩产以满足电动车与储能的爆发式需求，是全球锂供应链的源头之一。' },
    { id: 86, name: '皮尔巴拉铁矿群', en: 'Pilbara Iron Ore', country: '澳大利亚', region: '大洋洲', cat: 'mining', coord: [118.6, -22.6], cap: '年出口逾 10 亿吨', inv: 100, invText: '累计数百亿美元', status: '投运', year: 2024, updated: '2025-06', owner: '力拓 / 必和必拓 / FMG', flagship: false, desc: '全球铁矿石供应中枢。',
      detail: '西澳皮尔巴拉地区是全球铁矿石供应的中枢，力拓、必和必拓、FMG 等在此运营多座超大型矿山，年出口逾 10 亿吨、主要销往中国。区域内大规模应用自动驾驶矿卡、无人重载列车与远程操控中心，是矿业自动化的标杆。' },
    { id: 87, name: '锂三角盐湖项目', en: 'Lithium Triangle Brines', country: '阿根廷', region: '南美', cat: 'mining', coord: [-66.6, -23.5], cap: '碳酸锂盐湖提锂', inv: 40, invText: '约 40 亿美元', status: '在建', year: 2024, updated: '2025-10', owner: '紫金 / 赣锋 等', flagship: false, desc: '全球新增锂供应高地。',
      detail: '阿根廷、智利、玻利维亚交界的"锂三角"拥有全球过半的锂资源，盐湖卤水提锂成本相对低廉。紫金、赣锋等中国企业与多家国际矿商在阿根廷密集投建盐湖提锂项目，使该区域成为全球新增锂供应的主要高地。' },
  ];

  return { META, CATEGORIES, REGIONS, STATUS, PROJECTS };
})();
