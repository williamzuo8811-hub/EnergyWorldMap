/* ============================================================
 * 澳洲配网公司（DNSP）服务范围 —— 手描源定义（scripts/build-au-dnsp.js 的输入）
 * ------------------------------------------------------------
 * 每个州按优先级列出「显式区」（hand 多边形，可以越过海岸线 / 相互重叠：构建时会先与州面求交、再按顺序扣除前面的区，
 * 所以相邻区共用顶点即可无缝拼合），最后一个 default:true 的区 = 州面扣掉全部显式区的剩余部分（Essential / Powercor /
 * Ergon / Horizon / SAPN / TasNetworks / PWC 这类「全州兜底」配网）。geo:'ACT' = 直接取 lib/au-states.js 的首都领地面。
 *
 * 边界来源（2026-10 调研）：IPART NSW 配电许可区说明 + Ausgrid / Endeavour / Essential 网络范围描述、Energex「NSW 边界 →
 * Gympie、西至大分水岭山脚」官方口径、维州政府 Find your energy distributor + Powercor Shepparton 片区 / AER 网络图、
 * Western Power SWIS（Kalbarri–Kalgoorlie–Albany）+ Horizon Power 区域描述、Horizon Pilbara 系统描述。都会区内部的边界精确到
 * 街道级（维州五网 / 悉尼三网），这里只勾到「区 / 市镇」级（±10–30 km），卡片与图例均标注「示意范围」。
 * 坐标 [lng, lat]，WGS-84。
 * ============================================================ */
'use strict';

module.exports = {
  asOf: '2026-10',
  source: 'IPART 配电许可区 · AER 州网络图 · 各 DNSP 网络范围描述 · 维州政府配电商查询 · Energex 配电区口径 · Western Power / Horizon Power · Horizon Pilbara 系统描述（手描示意边界）',
  sources: [
    'https://www.ipart.nsw.gov.au/sites/default/files/documents/licence-condition-distribution-districts-april-2018.pdf',
    'https://www.aer.gov.au/queensland',
    'https://www.energex.com.au/__data/assets/pdf_file/0006/1079340/Jimboomba-and-Beaudesert-Non-Network-Options-Report.pdf',
    'https://www.energy.vic.gov.au/households/find-your-energy-distributor',
    'https://www.aer.gov.au/system/files/Powercor%20-%20RIN017%20-%20Map%20of%20Distribution%20System%20-%2031%20January%202020.pdf',
    'https://endeavourenergy.com.au/about/what-we-do',
    'https://engage.essentialenergy.com.au/operational_areas',
    'https://www.energycouncil.com.au/media/12991/western-australia-electricity-networks.pdf',
    'https://www.horizonpower.com.au/your-community/energyhub/where-does-our-energy-come-from/',
  ],
  areas: [
    /* ---------- NSW / ACT ---------- */
    {
      key: 'nsw-ausgrid', name: 'Ausgrid', zh: '奥斯网（Ausgrid）', state: 'NSW', kind: 'dnsp', color: '#5fb3ff', sheet: 'Ausgrid',
      desc: '悉尼市区、东部与北部（含 St George / Sutherland / Hornsby）· 中央海岸 · 猎人谷（Newcastle / Lake Macquarie / Maitland / Cessnock / Singleton / Muswellbrook / Upper Hunter 至 Murrurundi、Port Stephens / Dungog）',
      descEn: 'Sydney CBD, east & north (St George / Sutherland / Hornsby) · Central Coast · Hunter (Newcastle / Lake Macquarie / Maitland / Cessnock / Singleton / Muswellbrook / Upper Hunter, Port Stephens / Dungog)',
      label: [151.25, -32.75], labelZoom: 5.5,
      // 从克罗纳拉外海逆时针：Royal NP 西缘 → Bankstown / Auburn / Parramatta 河 → Epping → Hornsby → Hawkesbury 河 → 中央海岸西缘 →
      // Watagans → Wollombi → Wollemi 内陆 → Merriwa 西 → Murrurundi 北 → Barrington → Dungog / Port Stephens 北界 → 外海回到起点
      polygon: [[151.30, -34.12], [151.10, -34.12], [150.98, -34.02], [150.98, -33.90], [151.03, -33.86], [151.05, -33.80], [151.06, -33.74], [151.03, -33.68], [151.05, -33.58], [151.00, -33.45], [151.00, -33.25], [151.10, -33.10], [151.05, -32.95], [150.75, -32.85], [150.40, -32.60], [150.20, -32.25], [150.30, -31.90], [150.80, -31.70], [151.20, -31.85], [151.60, -32.10], [151.95, -32.35], [152.15, -32.55], [152.40, -32.60], [152.00, -33.00], [151.75, -33.30], [151.55, -33.60], [151.45, -33.90]],
    },
    {
      key: 'nsw-endeavour', name: 'Endeavour Energy', zh: '奋进能源（Endeavour Energy）', state: 'NSW', kind: 'dnsp', color: '#ff8c5a', sheet: 'Endeavour',
      desc: '大悉尼西部与西南部（Parramatta / Blacktown / Penrith / Liverpool / Campbelltown / Hills / Hawkesbury）· 蓝山至 Lithgow · Southern Highlands · 伊拉瓦拉（Wollongong / Shellharbour / Kiama）· 南海岸 Shoalhaven（Nowra 至 Ulladulla）',
      descEn: "Greater Western Sydney (Parramatta / Blacktown / Penrith / Liverpool / Campbelltown / Hills / Hawkesbury) · Blue Mountains to Lithgow · Southern Highlands · Illawarra (Wollongong / Shellharbour / Kiama) · South Coast Shoalhaven (Nowra to Ulladulla)",
      label: [150.45, -34.35], labelZoom: 5.5,
      // 与 Ausgrid 重叠的悉尼部分会被扣掉（Ausgrid 优先）；南界 = Shoalhaven / Eurobodalla 交界（North Durras），西界 = Wingecarribee / Wollondilly / Lithgow 西缘
      polygon: [[151.30, -34.12], [151.20, -34.30], [151.05, -34.60], [150.95, -34.90], [150.70, -35.45], [150.55, -35.55], [150.25, -35.55], [150.00, -35.25], [150.10, -34.75], [150.00, -34.45], [149.95, -34.15], [149.90, -33.55], [149.95, -33.10], [150.30, -33.05], [150.70, -33.15], [151.00, -33.35], [151.10, -33.60], [151.10, -33.80], [151.10, -34.00]],
    },
    {
      key: 'act-evoenergy', name: 'Evoenergy', zh: '伊沃能源（Evoenergy）', state: 'NSW', kind: 'dnsp', color: '#c9a7ff', sheet: 'Evoenergy',
      desc: '首都领地 ACT 全境（Canberra 及周边；档案并入 NSW）', descEn: 'Australian Capital Territory (Canberra; filed under NSW)',
      label: [149.05, -35.45], labelZoom: 6.5,
      geo: 'ACT',
    },
    {
      key: 'nsw-essential', name: 'Essential Energy', zh: '必要能源（Essential Energy）', state: 'NSW', kind: 'dnsp', color: '#6fe3a5', sheet: 'Essential',
      desc: 'NSW 其余约 95% 国土：北海岸（Tweed–Port Macquarie–Taree）、新英格兰、西北、中西部（Dubbo / Orange / Bathurst / Mudgee）、Riverina、远西（Broken Hill）、南部内陆（Goulburn / Snowy）与远南海岸（Batemans Bay–Eden）——含 CWO / New England / South West 三个 REZ',
      descEn: 'The other ~95% of NSW: North Coast (Tweed–Port Macquarie–Taree), New England, North West, Central West (Dubbo / Orange / Bathurst / Mudgee), Riverina, Far West (Broken Hill), Southern Inland (Goulburn / Snowy) and the Far South Coast (Batemans Bay–Eden) — hosts the CWO / New England / South West REZs',
      label: [147.8, -32.3], labelZoom: 4,
      default: true,
    },

    /* ---------- VIC（墨尔本五网：CitiPower → Jemena → United Energy → AusNet 依次扣除，Powercor 兜底）---------- */
    {
      key: 'vic-citipower', name: 'CitiPower', zh: '城市电力（CitiPower）', state: 'VIC', kind: 'dnsp', color: '#e8eefb', sheet: 'CitiPower',
      desc: '墨尔本 CBD 与内城区（Docklands / Port Melbourne / South Melbourne / Richmond / Collingwood / Fitzroy / Carlton / Brunswick / Northcote / Kew / Hawthorn / Prahran / St Kilda）',
      descEn: 'Melbourne CBD and inner suburbs (Docklands / Port Melbourne / Richmond / Collingwood / Fitzroy / Carlton / Brunswick / Northcote / Kew / Hawthorn / Prahran / St Kilda)',
      label: [144.99, -37.81], labelZoom: 8.5,
      polygon: [[144.90, -37.74], [145.08, -37.74], [145.08, -37.88], [144.93, -37.88], [144.90, -37.82]],
    },
    {
      key: 'vic-jemena', name: 'Jemena Electricity Networks', zh: '杰美纳电网（JEN）', state: 'VIC', kind: 'dnsp', color: '#ffb02e', sheet: 'Jemena',
      desc: '墨尔本北部与西北部（Sunbury / Clarkefield / Tullamarine 机场 / Broadmeadows / Craigieburn / Coburg / Essendon / Footscray / Yarraville）',
      descEn: 'Northern & north-western Melbourne (Sunbury / Clarkefield / Tullamarine airport / Broadmeadows / Craigieburn / Coburg / Essendon / Footscray / Yarraville)',
      label: [144.84, -37.60], labelZoom: 7.5,
      polygon: [[144.62, -37.60], [144.68, -37.44], [144.98, -37.44], [144.98, -37.74], [144.90, -37.74], [144.90, -37.86], [144.86, -37.86], [144.86, -37.74], [144.80, -37.66], [144.70, -37.62]],
    },
    {
      key: 'vic-united', name: 'United Energy', zh: '联合能源（United Energy）', state: 'VIC', kind: 'dnsp', color: '#b784f5', sheet: 'United Energy',
      desc: '墨尔本东南与南部（Box Hill / Glen Waverley / Dandenong / Cranbourne / Frankston）与莫宁顿半岛（Mornington / Rosebud / Flinders）',
      descEn: 'South-eastern & southern Melbourne (Box Hill / Glen Waverley / Dandenong / Cranbourne / Frankston) and the Mornington Peninsula',
      label: [145.12, -38.08], labelZoom: 7.5,
      // 东界沿 Western Port 西岸下行（Western Port / French Island / Phillip Island 归 AusNet），与 AusNet 共用顶点
      polygon: [[144.93, -37.88], [145.08, -37.88], [145.08, -37.80], [145.18, -37.80], [145.24, -37.88], [145.28, -37.97], [145.30, -38.08], [145.30, -38.18], [145.24, -38.28], [145.25, -38.37], [145.04, -38.52], [144.95, -38.65], [144.55, -38.45], [144.70, -38.05], [144.93, -37.95]],
    },
    {
      key: 'vic-ausnet', name: 'AusNet (distribution)', zh: '澳网配电（AusNet Electricity Services）', state: 'VIC', kind: 'dnsp', color: '#5b8def', sheet: 'AusNet',
      desc: '墨尔本外北 / 外东（Whittlesea / Doncaster / Ringwood / Lilydale / Berwick / Pakenham）与维州东部、东北部：Seymour / Benalla / Wangaratta / Wodonga / Yarrawonga 以东，Gippsland（Latrobe Valley / Sale / Bairnsdale / Bass Coast / Phillip Island）',
      descEn: "Outer north & east Melbourne (Whittlesea / Doncaster / Ringwood / Lilydale / Berwick / Pakenham) and eastern / north-eastern Victoria: Seymour / Benalla / Wangaratta / Wodonga / Yarrawonga eastwards, Gippsland (Latrobe Valley / Sale / Bairnsdale / Bass Coast / Phillip Island)",
      label: [146.9, -37.4], labelZoom: 4.5,
      // 西界：Kilmore → Seymour 西 → Violet Town / Dookie 东（Shepparton / Echuca / Kyabram 为 Powercor）→ Murray（Yarrawonga 西）
      polygon: [[144.98, -37.44], [144.95, -37.30], [145.00, -37.05], [145.30, -36.80], [145.75, -36.60], [145.85, -36.30], [145.95, -35.80], [147.00, -35.80], [147.90, -35.80], [148.30, -36.70], [149.98, -37.45], [150.30, -37.80], [148.00, -38.30], [146.50, -39.40], [145.40, -38.85], [144.95, -38.65], [145.04, -38.52], [145.25, -38.37], [145.24, -38.28], [145.30, -38.18], [145.30, -38.08], [145.28, -37.97], [145.24, -37.88], [145.18, -37.80], [145.08, -37.80], [145.08, -37.74], [144.98, -37.74]],
    },
    {
      key: 'vic-powercor', name: 'Powercor', zh: '鲍尔科（Powercor）', state: 'VIC', kind: 'dnsp', color: '#ff5c7a', sheet: 'Powercor',
      desc: '墨尔本西部（Werribee / Melton / Sunshine / Altona）与维州中西部：Geelong / Ballarat / Bendigo / Shepparton / Echuca / Mildura / Horsham / Warrnambool / Portland / Colac',
      descEn: 'Western Melbourne (Werribee / Melton / Sunshine / Altona) and central & western Victoria: Geelong / Ballarat / Bendigo / Shepparton / Echuca / Mildura / Horsham / Warrnambool / Portland / Colac',
      label: [142.9, -36.9], labelZoom: 4,
      default: true,
    },

    /* ---------- QLD ---------- */
    {
      key: 'qld-energex', name: 'Energex', zh: '能源网（Energex）', state: 'QLD', kind: 'dnsp', color: '#ffd93b', sheet: 'Energex',
      desc: '东南昆士兰：NSW 边界北至 Gympie、西至大分水岭山脚（Brisbane / Ipswich / Logan / Gold Coast / Sunshine Coast / Moreton Bay / Redlands / Lockyer Valley 至 Gatton / Somerset / Scenic Rim 含 Beaudesert、Boonah）',
      descEn: 'South East Queensland: NSW border north to Gympie and west to the foot of the Great Dividing Range (Brisbane / Ipswich / Logan / Gold Coast / Sunshine Coast / Moreton Bay / Redlands / Lockyer Valley to Gatton / Somerset / Scenic Rim incl. Beaudesert, Boonah)',
      label: [152.55, -27.15], labelZoom: 5.5,
      polygon: [[153.40, -25.90], [152.45, -25.85], [152.30, -26.10], [152.40, -26.55], [152.15, -26.95], [152.10, -27.45], [152.10, -27.70], [152.35, -27.95], [152.45, -28.30], [152.55, -28.40], [153.00, -28.35], [153.56, -28.20], [153.75, -28.20], [153.60, -27.50], [153.30, -26.80], [153.30, -26.20]],
    },
    {
      key: 'qld-ergon', name: 'Ergon Energy Network', zh: '埃尔贡能源电网（Ergon）', state: 'QLD', kind: 'dnsp', color: '#3fd0b0', sheet: 'Ergon',
      desc: '昆士兰其余全部：Toowoomba / Darling Downs / Wide Bay（Bundaberg / Hervey Bay）/ 中部（Rockhampton / Gladstone / Emerald）/ Mackay / Townsville / Cairns / 远北与 Cape York / Mount Isa 西北（NWPS）及 33 个离网孤立系统',
      descEn: 'The rest of Queensland: Toowoomba / Darling Downs / Wide Bay (Bundaberg / Hervey Bay) / Central (Rockhampton / Gladstone / Emerald) / Mackay / Townsville / Cairns / Far North & Cape York / Mount Isa (NWPS) plus 33 isolated systems',
      label: [145.6, -22.4], labelZoom: 4,
      default: true,
    },

    /* ---------- SA ---------- */
    {
      key: 'sa-sapn', name: 'SA Power Networks', zh: '南澳电网（SAPN）', state: 'SA', kind: 'dnsp', color: '#f2a541', sheet: 'SA Power Networks',
      desc: '南澳全州并网区域（Adelaide 都会区至 Eyre / Yorke 半岛、Riverland、Limestone Coast、Far North）；Coober Pedy 等 13 个偏远镇由州政府 RAES 供电',
      descEn: 'All of South Australia on the grid (Adelaide metro to the Eyre / Yorke Peninsulas, Riverland, Limestone Coast, Far North); 13 remote towns such as Coober Pedy are served by the state RAES scheme',
      label: [135.8, -31.0], labelZoom: 4,
      default: true,
    },

    /* ---------- WA（Western Power = SWIS；NWIS 皮尔巴拉 = Horizon + 矿企 / APA 私网；其余 = Horizon 38 个独立系统）---------- */
    {
      key: 'wa-western-power', name: 'Western Power', zh: '西部电力（Western Power）', state: 'WA', kind: 'dnsp', color: '#21c7ff', sheet: 'Western Power',
      desc: 'SWIS 西南互联电网：Perth 都会区、Peel、西南（Bunbury / Busselton / Albany）、Wheatbelt（Northam / Merredin / Narrogin）、中西部（Geraldton / Kalbarri）与 Goldfields（Kalgoorlie-Boulder）——Esperance 除外',
      descEn: 'SWIS (South West Interconnected System): Perth metro, Peel, South West (Bunbury / Busselton / Albany), Wheatbelt (Northam / Merredin / Narrogin), Mid West (Geraldton / Kalbarri) and the Goldfields (Kalgoorlie-Boulder) — excluding Esperance',
      label: [117.3, -31.2], labelZoom: 4.5,
      polygon: [[113.90, -27.60], [114.40, -27.60], [115.30, -28.40], [116.00, -28.90], [116.40, -29.50], [116.90, -30.20], [117.60, -30.70], [118.60, -30.90], [119.40, -31.00], [120.50, -30.60], [121.80, -30.60], [122.00, -31.00], [121.90, -31.40], [121.90, -32.30], [121.50, -33.00], [120.30, -33.50], [120.30, -34.20], [118.00, -35.30], [115.00, -34.60], [114.60, -33.50], [115.20, -31.50], [114.30, -29.50], [113.90, -28.30]],
    },
    {
      key: 'wa-nwis', name: 'NWIS Pilbara (Horizon + private networks)', zh: '皮尔巴拉 NWIS（Horizon + 矿企 / APA 自营网）', state: 'WA', kind: 'private', color: '#d78cff', sheet: 'Pilbara',
      desc: '西北互联电网 NWIS：Karratha / Dampier / Cape Lambert / Port Hedland 沿海（Horizon Power 公用网）+ Rio Tinto / BHP / Fortescue / APA-Alinta 私网（Tom Price / Paraburdoo / Newman / Yandi），Pilbara ISO 协调、轻监管开放接入',
      descEn: 'North West Interconnected System: Karratha / Dampier / Cape Lambert / Port Hedland coast (Horizon Power public network) + Rio Tinto / BHP / Fortescue / APA-Alinta private networks (Tom Price / Paraburdoo / Newman / Yandi), coordinated by the Pilbara ISO under light-handed open access',
      label: [118.4, -21.9], labelZoom: 5.5,
      polygon: [[116.00, -20.00], [119.50, -19.80], [120.30, -20.60], [120.00, -22.00], [119.80, -23.60], [118.50, -23.60], [117.20, -23.40], [116.40, -22.80], [115.80, -22.00], [116.00, -20.90]],
    },
    {
      key: 'wa-horizon', name: 'Horizon Power', zh: '地平线电力（Horizon Power）', state: 'WA', kind: 'regional', color: '#c9a7ff', sheet: 'Horizon',
      desc: 'SWIS 之外的区域西澳（州属区域电力公司，发输配售一体）：Kimberley（Broome / Kununurra）、Gascoyne（Carnarvon / Exmouth）、Mid West 内陆（Meekatharra）、Goldfields-Esperance（Esperance / Laverton）等 38 个独立微电网，以及皮尔巴拉沿海公用网',
      descEn: 'Regional WA outside the SWIS (state-owned vertically integrated regional utility): 38 stand-alone microgrids across the Kimberley (Broome / Kununurra), Gascoyne (Carnarvon / Exmouth), inland Mid West (Meekatharra), Goldfields-Esperance (Esperance / Laverton), plus the Pilbara coastal public network',
      label: [123.5, -25.0], labelZoom: 4,
      default: true,
    },

    /* ---------- TAS / NT ---------- */
    {
      key: 'tas-tasnetworks', name: 'TasNetworks (distribution)', zh: '塔州电网配电（TasNetworks）', state: 'TAS', kind: 'dnsp', color: '#3fd0b0', sheet: 'TasNetworks',
      desc: '塔斯马尼亚本岛全部并网区域（输配一体的州属公司）；Bass Strait 的 King / Flinders 岛由 Hydro Tasmania 供电',
      descEn: 'All of mainland Tasmania (state-owned combined TNSP / DNSP); King & Flinders Islands in Bass Strait are served by Hydro Tasmania',
      label: [146.6, -42.0], labelZoom: 4.5,
      default: true,
    },
    {
      key: 'nt-pwc', name: 'Power and Water Corporation', zh: '北领地电力水务公司（PWC Power Networks）', state: 'NT', kind: 'dnsp', color: '#ffd93b', sheet: 'Power and Water',
      desc: '北领地三大受监管系统 Darwin–Katherine / Alice Springs / Tennant Creek 的配网（AER 监管）；72 个偏远原住民社区由 PWC 子公司 IES 供电',
      descEn: 'Distribution in the three regulated NT systems Darwin–Katherine / Alice Springs / Tennant Creek (AER-regulated); 72 remote Indigenous communities are served by PWC subsidiary IES',
      label: [133.4, -19.3], labelZoom: 4,
      default: true,
    },
  ],
};
