/* =============================================================
 * 国际大客户 · BD 元数据（《特锐德 50 家中国出海大客户》清单结构化）
 * key = SUB_DEFS.client 的子分类键；供 app.js 的「🎯 客户 BD 看板」使用。
 *   tier     BD 优先级梯队（第一/二/三梯队；其他=不在 50 家清单但有海外项目）
 *   fit      产品关联度（极高/高/中高/中）
 *   type     客户类型
 *   product  重点关联（特锐德）产品
 *   scenario 典型海外场景
 *   approach 推荐打法（BD 切入）
 * 核心产品：模块化预制舱变电站、车载移动变电站、E-house、中低压成套、储能并网舱。
 * ============================================================= */
window.CLIENT_META = {
  // ===== 第一梯队 =====
  powerchina:  { tier: '第一梯队', fit: '极高', type: '海外EPC/投资商', product: '预制舱变电站·车载移动变·E-house·中低压成套', scenario: '海外新能源、水电、矿业基建、输变电、施工临电', approach: '集团/区域公司+设计院双线突破，先做技术交流与入库' },
  energychina: { tier: '第一梯队', fit: '极高', type: '海外EPC/投资商', product: '预制舱变电站·储能并网舱·车载移动变', scenario: '风光储、燃机、电网、变电站、海外能源电力', approach: '围绕风光储与燃机项目做标准方案包' },
  sgcc:        { tier: '第一梯队', fit: '极高', type: '国家电网系海外平台(CET)', product: '预制舱变电站·移动应急变·配网开关站', scenario: '海外输变电、变电站、配网改造', approach: '集团级/技术线入库与样板方案，直连海外电网项目' },
  ctg:         { tier: '第一梯队', fit: '极高', type: '海外清洁能源投资商', product: '预制舱升压站·移动备用变·存量改造', scenario: '水电、风电、光伏、储能', approach: '业主侧框架+EPC 伙伴双向推进' },
  spic:        { tier: '第一梯队', fit: '极高', type: '海外电力投资商', product: '新能源升压站·储能并网·厂用电', scenario: '光伏、风电、储能、火电', approach: '业主侧技术标准与供应商准入切入，项目池大' },
  zijin:       { tier: '第一梯队', fit: '极高', type: '海外矿业业主', product: '矿山变电站·移动应急变·矿区微网', scenario: '海外铜、金、锂矿', approach: '从保供电、减少停产损失切入，矿山最适合移动变' },
  cmoc:        { tier: '第一梯队', fit: '极高', type: '海外矿业业主', product: '矿山保供电·移动变·备用供电系统', scenario: '刚果金铜钴矿、巴西铌磷矿', approach: '用停电损失与快速恢复供电价值切入，刚果金为重点' },
  cnmc:        { tier: '第一梯队', fit: '高',   type: '矿业/工程承包', product: '矿山预制舱·冶炼厂配电·移动变', scenario: '海外矿山、冶炼、电力配套', approach: '业主+工程承包双路径，矿冶电一体化场景强' },
  cpecc:       { tier: '第一梯队', fit: '高',   type: '油气EPC', product: '油气站场配电舱·移动变·营地供电', scenario: '油气田、管道、炼化、站场', approach: '从站场分散供电与临时供电切入，弱电网国家适配高' },
  // ===== 第二梯队 =====
  cmec:        { tier: '第二梯队', fit: '高',   type: '海外电力EPC', product: '预制舱变电站·中低压成套·E-house', scenario: '火电、新能源、工业园、电网配套', approach: '按国别/项目切入设备包，适合厂用电系统' },
  cneec:       { tier: '第二梯队', fit: '高',   type: '海外电力EPC', product: '中压开关柜·预制舱开关站·车载移动变', scenario: '电站、输变电、配网项目', approach: '从电站与配网标准化电气包切入，投标阶段联动' },
  norinco:     { tier: '第二梯队', fit: '高',   type: '海外EPC/投建营', product: '模块化预制舱·车载移动变·电站电气包', scenario: '弱电网国家、电站、矿业、新能源、轨交', approach: '用弱电网快速交付与应急供电方案切入亚非拉' },
  mcc:         { tier: '第二梯队', fit: '高',   type: '冶金/矿山/工业EPC', product: 'E-house·预制舱变电站·工业配电', scenario: '钢铁、矿山、冶炼、工业园', approach: '从冶金与矿山工业电气包切入，高负荷匹配强' },
  sgid:        { tier: '第二梯队', fit: '高',   type: '海外电网投资运营', product: '移动变·存量变电站改造·配网设备', scenario: '海外电网资产运营、升级、抢修', approach: '从存量资产运维与应急抢修切入（业主侧）' },
  csg:         { tier: '第二梯队', fit: '高',   type: '海外电网投资运营', product: '配网自动化·预制舱·移动变', scenario: '东南亚、港澳及海外电网', approach: '关注东南亚配网与岛屿供电项目' },
  tbea:        { tier: '第二梯队', fit: '高',   type: '输变电/新能源EPC', product: '预制舱·光伏升压站·输变电配套', scenario: '海外变电站、光伏、风电、输变电', approach: '竞合关系，选择非冲突包做差异化配套' },
  cgn:         { tier: '第二梯队', fit: '高',   type: '海外新能源投资商', product: '预制舱升压站·运维备用移动变', scenario: '风电、光伏、储能资产', approach: '从欧洲/澳洲/东南亚项目标准化切入，重本地认证' },
  chnenergy:   { tier: '第二梯队', fit: '高',   type: '新能源运营商(龙源/国家能源)', product: '风电开关站·光伏升压站·移动备用变', scenario: '风电、光伏项目', approach: '强调运维备用与快速替换，风电场适配移动变' },
  mmg:         { tier: '第二梯队', fit: '高',   type: '海外矿业业主(五矿)', product: '采选厂配电·矿山开关站·应急电源', scenario: '铜、锌、铅等海外资源项目', approach: '从矿山连续生产与供电稳定性切入' },
  chinalco:    { tier: '第二梯队', fit: '高',   type: '有色金属EPC/业主(中铝)', product: '高负荷工业配电·预制舱变电站', scenario: '氧化铝、电解铝、矿山、冶炼', approach: '从海外铝产业园、矿山、冶炼厂切入，重可靠性' },
  huayou:      { tier: '第二梯队', fit: '高',   type: '海外镍钴资源/冶炼', product: '镍冶炼园区供配电·移动变', scenario: '印尼镍项目、非洲钴资源', approach: '从印尼产业园与冶炼负荷切入，高负荷连续生产' },
  tsingshan:   { tier: '第二梯队', fit: '高',   type: '海外镍铁/不锈钢园区', product: '园区变电站·E-house·移动备用变', scenario: '印尼工业园、冶炼负荷', approach: '从园区高可靠供电与扩容切入，需求持续' },
  hqc:         { tier: '第二梯队', fit: '高',   type: '油气化工EPC(寰球)', product: '防护型E-house·工业预制舱', scenario: 'LNG、炼化、化工园区', approach: '从化工园区电气模块化切入，重可靠性与安全规范' },
  seg:         { tier: '第二梯队', fit: '高',   type: '炼化EPC(中石化炼化)', product: '工业配电系统·E-house·移动备用电源', scenario: '炼厂、化工、天然气处理', approach: '从炼化装置电气房与站场切入' },
  cncec:       { tier: '第二梯队', fit: '高',   type: '化工/工业园EPC', product: '工业园变电站·E-house·配电舱', scenario: '海外化工园、化肥、炼化、材料', approach: '从海外化工园区总包配电系统切入，场景高度适配' },
  // ===== 第三梯队 =====
  complant:    { tier: '第三梯队', fit: '中高', type: '海外工程承包', product: '工业配电舱·箱式变电站·临时供电', scenario: '电站、糖厂、工业园、基础设施', approach: '项目型切入，先找工业园/工厂类项目' },
  camce:       { tier: '第三梯队', fit: '中高', type: '海外工程承包', product: '园区供配电·预制舱配电站', scenario: '工业、农业、能源、园区项目', approach: '按海外园区与工业项目切入，跟踪国别机会' },
  crcc:        { tier: '第三梯队', fit: '中高', type: '海外基建EPC(中国铁建)', product: '施工临电·轨交配电·移动变', scenario: '铁路、公路、城市基建、营地、站场', approach: '从施工期临电与营地供电切入' },
  crec:        { tier: '第三梯队', fit: '中高', type: '海外基建EPC(中国中铁)', product: '施工期供电·临时变电站·配电舱', scenario: '铁路、城市轨交、隧道、港口', approach: '项目型 BD，配合总包施工方案' },
  cccc:        { tier: '第三梯队', fit: '中高', type: '海外基建EPC(中国交建)', product: '港口配电·岸电·移动备用变', scenario: '港口、公路、桥梁、园区、海工', approach: '重点盯港口与园区类项目，岸电可靠性要求高' },
  chec:        { tier: '第三梯队', fit: '中高', type: '港口/海工EPC(中国港湾)', product: '港口配电·岸电系统·移动备用变', scenario: '海外港口、码头、物流园', approach: '从港口岸电与码头配电切入' },
  crbc:        { tier: '第三梯队', fit: '中',   type: '基建EPC(中国路桥)', product: '施工临电·移动箱变', scenario: '公路、桥梁、营地、站场', approach: '做施工电源标准包，用电规模取决于项目' },
  sinosteel:   { tier: '第三梯队', fit: '中高', type: '冶金EPC(中钢)', product: '工业配电·预制舱变电站', scenario: '钢铁厂、矿山、焦化、球团', approach: '围绕钢铁/矿山项目切入，关注海外钢铁产能' },
  sinoma:      { tier: '第三梯队', fit: '中高', type: '水泥/建材EPC(中材)', product: '水泥厂配电·矿山供电·移动变', scenario: '海外水泥厂、矿山、余热发电', approach: '从水泥厂总包配电系统切入，设备包相对标准化' },
  xj:          { tier: '第三梯队', fit: '中高', type: '电力装备/EPC配套(许继)', product: '一次+二次集成预制舱', scenario: '二次、保护、自动化、变电站系统', approach: '以联合方案/互补配套切入（竞合）' },
  pinggao:     { tier: '第三梯队', fit: '中高', type: '高压开关/电网装备(平高)', product: 'GIS站配套预制舱·中低压系统', scenario: 'GIS、变电站、输变电项目', approach: '围绕 GIS 站配套做合作，找非冲突设备包' },
  sdee:        { tier: '第三梯队', fit: '中高', type: '输变电装备(山东电工)', product: '移动变联合方案·成套站合作', scenario: '变压器、开关、电网工程', approach: '从移动变与成套站联合方案切入' },
  chint:       { tier: '第三梯队', fit: '中高', type: '新能源投资/EPC(正泰)', product: '光伏升压站·开关站·箱变·并网舱', scenario: '海外光伏、储能、电站开发', approach: '从海外光伏项目标准化方案切入，适合批量' },
  sungrow:     { tier: '第三梯队', fit: '中高', type: '储能/光伏系统集成(阳光)', product: '储能升压舱·MV站·E-house配套', scenario: '海外储能电站、逆变器、PCS', approach: '作为储能系统中压侧配套切入' },
  envision:    { tier: '第三梯队', fit: '中高', type: '风电/储能/零碳园区(远景)', product: '风电升压·储能并网·园区配电', scenario: '海外风电、储能、绿色园区', approach: '从风储与零碳园区项目切入，模块化方案' },
  huaneng:     { tier: '第三梯队', fit: '中高', type: '电力投资商(华能)', product: '厂用电·升压站·预制舱', scenario: '火电、新能源、港口能源', approach: '从电源项目配套电气系统切入' },
  huadian:     { tier: '第三梯队', fit: '中高', type: '电力投资商(华电)', product: '电站配电·临时供电·移动变', scenario: '海外电站、燃机、新能源', approach: '关注燃机与新能源项目，项目型切入' },
  datang:      { tier: '第三梯队', fit: '中高', type: '电力投资商(大唐)', product: '升压站·厂用电·应急移动变', scenario: '电源项目、清洁能源', approach: '从海外电源项目设备包切入，跟踪项目节奏' },
  beih:        { tier: '第三梯队', fit: '中高', type: '新能源投资商(京能)', product: '新能源升压站·储能接入系统', scenario: '光伏、风电、储能', approach: '从具体海外新能源资产切入' },
  ganfeng:     { tier: '第三梯队', fit: '中高', type: '海外锂资源业主(赣锋)', product: '盐湖/矿山供电·移动变·储能接入', scenario: '阿根廷、非洲等锂资源项目', approach: '围绕偏远矿区与新能源微网切入' },
  gem:         { tier: '第三梯队', fit: '中高', type: '海外镍钴/新能源材料(格林美)', product: '工业园配电·预制舱变电站', scenario: '印尼镍资源、新能源材料产业链', approach: '从新能源材料园区配电切入，适合 E-house' },
  cooec:       { tier: '第三梯队', fit: '中高', type: '海洋油气工程(海油工程)', product: '海工模块电气舱·预制化配电系统', scenario: '海上平台、陆地终端、模块化工程', approach: '从海工模块化电气舱切入，重海工认证' },
  tianqi:      { tier: '第三梯队', fit: '中',   type: '海外锂资源业主(天齐)', product: '矿山及化工厂配电系统', scenario: '澳洲锂矿/锂化工相关资产', approach: '从存量改造与工厂配电切入（澳洲合规高）' },
  cecep:       { tier: '第三梯队', fit: '中',   type: '新能源投资商(中节能)', product: '光伏升压站·预制舱开关站', scenario: '光伏、电站运营', approach: '从光伏电站并网配套切入' },
  gcl:         { tier: '第三梯队', fit: '中',   type: '新能源开发/组件/系统(协鑫)', product: '光伏电气包·储能接入·开关站', scenario: '海外光伏与储能项目', approach: '项目型切入，跟随开发/EPC' },
  crrc:        { tier: '第三梯队', fit: '中',   type: '轨道交通装备(中车)', product: '轨交牵引供电·储能并网舱·站段配电', scenario: '海外地铁/城际/铁路电气化、车辆基地', approach: '随中车海外轨交项目配套牵引供电与储能，切入车辆基地与站段配电' },
  // ===== 其他出海客户（不在 50 家清单，但有海外项目且产品契合）=====
  gds:         { tier: '其他', fit: '高',   type: '海外数据中心(万国/DayOne)', product: 'E-house·中压配电·备用电源', scenario: '海外数据中心园区', approach: '从园区中压配电与备用电源切入' },
  chindata:    { tier: '其他', fit: '高',   type: '海外数据中心(秦淮)', product: 'E-house·中压配电', scenario: '东南亚/南亚数据中心', approach: '从数据中心配电与扩容切入' },
  byd:         { tier: '其他', fit: '中高', type: '新能源车/电池/储能(比亚迪)', product: '园区配电·储能并网舱', scenario: '海外整车/电池厂、储能', approach: '从工厂园区配电与储能并网切入' },
  catl:        { tier: '其他', fit: '中高', type: '电池/储能(宁德时代)', product: '储能并网舱·园区配电', scenario: '海外电池厂、储能电站', approach: '从储能并网与工厂配电切入' },
  // ===== 六大全球矿业巨头（非中资，海外重点目标客户：矿山/冶炼负荷大、偏远矿点多，移动变与预制舱极契合）=====
  bhp:         { tier: '第一梯队', fit: '极高', type: '全球矿业巨头(必和必拓BHP)', product: '矿山预制舱变电站·车载移动应急变·矿区微网·E-house', scenario: '智利/澳洲/秘鲁/加拿大铜·铁·钾·镍矿', approach: '从矿区保供电、停产损失与偏远矿点快速恢复供电切入，移动变与预制舱最适配' },
  riotinto:    { tier: '第一梯队', fit: '极高', type: '全球矿业/铝业巨头(力拓Rio Tinto)', product: '矿山升压站·移动变·铝厂高负荷配电·E-house', scenario: '蒙古/澳洲/美国/几内亚/加拿大铜·铁·铝·锂', approach: '矿山供电可靠性+铝冶炼高负荷配电双线切入，重本地认证与绿电并网' },
  fortescue:   { tier: '第一梯队', fit: '极高', type: '铁矿/绿色能源巨头(福特斯库Fortescue)', product: '矿区光储微网并网舱·移动变·预制舱升压站', scenario: '西澳皮尔巴拉铁矿、绿氢、加蓬铁矿', approach: '从皮尔巴拉零碳电网(风光储)并网与离网微网切入，移动变保供电' },
  glencore:    { tier: '第一梯队', fit: '极高', type: '全球多金属矿业巨头(嘉能可Glencore)', product: '矿山预制舱变电站·移动应急变·冶炼厂配电', scenario: '刚果金/智利/秘鲁/澳洲/加拿大/哈萨克铜钴镍锌', approach: '从弱电网国家(刚果金/赞比亚)保供电与停产损失切入' },
  anglo:       { tier: '第一梯队', fit: '极高', type: '全球矿业巨头(英美资源Anglo American)', product: '矿山升压站·移动变·选厂/海淡配电·E-house', scenario: '秘鲁/智利铜、南非铂铁、巴西铁、英欧钾铜', approach: '从智利/秘鲁铜矿海淡输水配电与南非铂矿供电切入' },
  vale:        { tier: '第一梯队', fit: '极高', type: '全球铁矿/镍业巨头(淡水河谷Vale)', product: '矿区预制舱·移动变·冶炼厂E-house·球团厂配电', scenario: '巴西铁铜、加拿大/印尼镍、阿曼球团', approach: '从巴西铁矿与印尼镍冶炼高负荷配电、移动应急变切入' },
};
