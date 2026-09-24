const Compatible_With_Bettbox = { ruleOptionsEnable: true };

/**
 * HiClash Mihomo 配置覆写脚本（精简版 · 多地区自动识别 + 安全基线）
 * 原作者：AIsouler
 * 二次维护：dukangalex
 * 上游项目：https://github.com/AIsouler/MyClash
 * 项目仓库：https://github.com/dukangalex/HiClash
 * 脚本链接：https://raw.githubusercontent.com/dukangalex/HiClash/main/Script/Script.js
 */

// --- 静态配置区域 ---

/**
 * 自定义配置选项
 * true = 启用
 * false = 禁用
 */
const ruleOptionsEnable = {
  // 基础策略组
  手动选择: true, // 是否启用手动选择策略组
  自动选择: true, // 是否启用自动选择策略组
  故障转移: true, // 是否启用故障转移策略组
  远控工具: true, // 是否启用远控工具分流组

  // 以下为分流策略配置
  Google: true, // Google服务
  AI: true, // 国外AI服务
  Telegram: true, // Telegram通讯软件
  Steam: true, // Steam游戏平台
  AdBlock: true, // 广告拦截

  // 以下为非分流策略配置
  极简模式: false, // 是否启用极简模式
  生成地区自动选择组: true, // 是否生成地区自动选择策略组
  隐藏地区手动选择组: false, // 是否隐藏地区手动选择策略组
  生成倍率组: true, // 是否生成低倍率/高倍率策略组
  分流组添加所有节点: false, // 是否为分流策略组添加所有节点
  过滤低倍率节点: false, // 是否过滤低倍率节点
  过滤高倍率节点: false, // 是否过滤高倍率节点
  过滤非地区节点: true, // 是否过滤非地区节点
  屏蔽国外QUIC: true, // 是否屏蔽国外QUIC流量
  代理IPV4优先: false, // 是否将订阅节点统一为 IPv4 优先（与“代理IPV6优先”同时开启时不生效）
  代理IPV6优先: false, // 是否将订阅节点统一为 IPv6 优先（与“代理IPV4优先”同时开启时不生效）
  链式代理: false, // 是否启用链式代理（自定义节点作为落地节点，经“链式中转”策略组中转）
};

// 定义前置规则
const prefixRules = [
  // 私有网络直连
  'RULE-SET,private,直连',

  // 国内直连
  'RULE-SET,geolocation-cn,直连',
  'RULE-SET,games_cn,直连', // 已包含 steam 下载域名
  'RULE-SET,epicgames,直连',
  'RULE-SET,apple_cn,直连',
  'RULE-SET,microsoft_cn,直连',
  'DOMAIN,fsend.cn,直连',
  'DOMAIN,international-gfe.download.nvidia.com,直连',
];

// 此处添加自定义节点，填入下方[]内（可选，留空则不生成“自建节点”策略组）
// 自定义节点不参与节点过滤与 hosts 改写；与订阅节点（标准化后）重名时自动添加“自建-”前缀
// 示例：
// const customizeProxies = [
//   {
//     name: '自建-日本-01',
//     type: 'vmess',
//     server: '5.6.7.8',
//     port: 443,
//     uuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
//     alterId: 0,
//     cipher: 'auto',
//     tls: true,
//     servername: 'example.com',
//     network: 'ws',
//     'ws-opts': {
//       path: '/path',
//       headers: { Host: 'example.com' },
//     },
//   },
// ];
const customizeProxies = [];

// 链式代理启用时，自定义节点的 dialer-proxy 引用目标
const dialerProxyName = '链式中转';

// 定义全局排除节点的正则表达式，用于排除非地区节点
const excludeFilter =
  /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|电报|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|优惠|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|过滤|⚠️|@|t\.me\/\+|\bexpire\b|\bhttps?:\/\/|\btraffic\b/iu;

// 屏蔽国外QUIC
const blockWebRtcStun = [
  'AND,((NETWORK,UDP),(DST-PORT,3478-3497)),REJECT',
  'AND,((NETWORK,UDP),(DST-PORT,5349)),REJECT',
  'AND,((NETWORK,UDP),(DST-PORT,19302-19309)),REJECT',
  'AND,((NETWORK,TCP),(DST-PORT,3478-3497)),REJECT',
  'AND,((NETWORK,TCP),(DST-PORT,5349)),REJECT',
];

const blockForeignQuic = [
  'AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn_additional),(RULE-SET,cn_ip,no-resolve)))))),REJECT',
];

// 直连节点
const directProxies = [
  {
    name: '🇨🇳 直连 | 双栈',
    type: 'direct',
  },
  {
    name: '🇨🇳 直连 | IPv4优先',
    type: 'direct',
    'ip-version': 'ipv4-prefer',
  },
  {
    name: '🇨🇳 直连 | IPv6优先',
    type: 'direct',
    'ip-version': 'ipv6-prefer',
  },
  {
    name: '🇨🇳 直连 | 仅IPv4',
    type: 'direct',
    'ip-version': 'ipv4',
  },
  {
    name: '🇨🇳 直连 | 仅IPv6',
    type: 'direct',
    'ip-version': 'ipv6',
  },
];

// 定义地区策略组
const regionDefinitions = [
  { name: '香港', flag: '🇭🇰', regex: new RegExp('🇭🇰|香港|\\bHKG?\\b|hong[\\s_-]*kong', 'i'), icon: '' },
  { name: '台湾', flag: '🇹🇼', regex: new RegExp('🇹🇼|台湾|\\bTWN?\\b|taiwan', 'i'), icon: '' },
  { name: '日本', flag: '🇯🇵', regex: new RegExp('🇯🇵|日本|\\bJPN?\\b|japan|tokyo|osaka|东京|大阪', 'i'), icon: '' },
  { name: '韩国', flag: '🇰🇷', regex: new RegExp('🇰🇷|韩国|\\bKR\\b|korea|seoul|首尔', 'i'), icon: '' },
  { name: '新加坡', flag: '🇸🇬', regex: new RegExp('🇸🇬|新加坡|狮城|\\bSGP?\\b|singapore', 'i'), icon: '' },
  {
    name: '美国',
    flag: '🇺🇸',
    regex: new RegExp(
      '🇺🇸|美国|\\bUSA?\\b|america|united[\\s_-]*states|los[\\s_-]*angeles|洛杉矶|san[\\s_-]*jose|圣何塞',
      'i',
    ),
    icon: '',
  },
  { name: '英国', flag: '🇬🇧', regex: new RegExp('🇬🇧|英国|\\bGB\\b|united[\\s_-]*kingdom|london|伦敦', 'i'), icon: '' },
  { name: '德国', flag: '🇩🇪', regex: new RegExp('🇩🇪|德国|\\bDE\\b|germany|frankfurt|法兰克福', 'i'), icon: '' },
  { name: '荷兰', flag: '🇳🇱', regex: new RegExp('🇳🇱|荷兰|\\bNL\\b|nether?lands|amsterdam|阿姆斯特丹', 'i'), icon: '' },
  {
    name: '马来西亚',
    flag: '🇲🇾',
    regex: new RegExp('🇲🇾|马来西亚|\\bMY\\b|malaysia|kuala[\\s_-]*lumpur|吉隆坡', 'i'),
    icon: '',
  },
  { name: '泰国', flag: '🇹🇭', regex: new RegExp('🇹🇭|泰国|\\bTH\\b|thailand|bangkok|曼谷', 'i'), icon: '' },
  {
    name: '越南',
    flag: '🇻🇳',
    regex: new RegExp('🇻🇳|越南|\\bVN\\b|vietnam|hanoi|河内|ho[\\s_-]*chi[\\s_-]*minh|胡志明', 'i'),
    icon: '',
  },
  { name: '菲律宾', flag: '🇵🇭', regex: new RegExp('🇵🇭|菲律宾|\\bPH\\b|philippines|manila|马尼拉', 'i'), icon: '' },
  {
    name: '印尼',
    flag: '🇮🇩',
    regex: new RegExp('🇮🇩|印尼|印度尼西亚|\\bID\\b|indonesia|jakarta|雅加达', 'i'),
    icon: '',
  },
  { name: '印度', flag: '🇮🇳', regex: new RegExp('🇮🇳|印度|\\bIN\\b|india|mumbai|孟买|delhi|德里', 'i'), icon: '' },
  {
    name: '澳大利亚',
    flag: '🇦🇺',
    regex: new RegExp('🇦🇺|澳大利亚|澳洲|\\bAU\\b|australia|sydney|悉尼|melbourne|墨尔本', 'i'),
    icon: '',
  },
  { name: '法国', flag: '🇫🇷', regex: new RegExp('🇫🇷|法国|\\bFR\\b|france|paris|巴黎', 'i'), icon: '' },
  { name: '俄罗斯', flag: '🇷🇺', regex: new RegExp('🇷🇺|俄罗斯|\\bRU\\b|russia|moscow|莫斯科', 'i'), icon: '' },
  { name: '意大利', flag: '🇮🇹', regex: new RegExp('🇮🇹|意大利|\\bIT\\b|\\bitaly\\b|rome|罗马', 'i'), icon: '' },
  { name: '加拿大', flag: '🇨🇦', regex: new RegExp('🇨🇦|加拿大|\\bCA\\b|canada|toronto|多伦多', 'i'), icon: '' },
  {
    name: '阿根廷',
    flag: '🇦🇷',
    regex: new RegExp('🇦🇷|阿根廷|\\bAR\\b|argentina|buenos[\\s_-]*aires|布宜诺斯艾利斯', 'i'),
    icon: '',
  },
  { name: '巴西', flag: '🇧🇷', regex: new RegExp('🇧🇷|巴西|\\bBR\\b|brazil|sao[\\s_-]*paulo|圣保罗', 'i'), icon: '' },
  { name: '墨西哥', flag: '🇲🇽', regex: new RegExp('🇲🇽|墨西哥|\\bMX\\b|mexico', 'i'), icon: '' },
  {
    name: '沙特阿拉伯',
    flag: '🇸🇦',
    regex: new RegExp('🇸🇦|沙特阿拉伯|沙特|\\bSA\\b|saudi[\\s_-]*arabia', 'i'),
    icon: '',
  },
  {
    name: '南非',
    flag: '🇿🇦',
    regex: new RegExp('🇿🇦|南非|\\bZA\\b|south[\\s_-]*africa|johannesburg|约翰内斯堡', 'i'),
    icon: '',
  },
  { name: '土耳其', flag: '🇹🇷', regex: new RegExp('🇹🇷|土耳其|\\bTR\\b|turkey|istanbul|伊斯坦布尔', 'i'), icon: '' },
  { name: '文莱', flag: '🇧🇳', regex: new RegExp('🇧🇳|文莱|\\bBN\\b|brunei', 'i'), icon: '' },
  {
    name: '柬埔寨',
    flag: '🇰🇭',
    regex: new RegExp('🇰🇭|柬埔寨|\\bKH\\b|cambodia|phnom[\\s_-]*penh|金边', 'i'),
    icon: '',
  },
  { name: '老挝', flag: '🇱🇦', regex: new RegExp('🇱🇦|老挝|\\bLA\\b|\\blaos\\b|vientiane|万象', 'i'), icon: '' },
  { name: '缅甸', flag: '🇲🇲', regex: new RegExp('🇲🇲|缅甸|\\bMM\\b|myanmar|yangon|仰光', 'i'), icon: '' },
  { name: '奥地利', flag: '🇦🇹', regex: new RegExp('🇦🇹|奥地利|\\bAT\\b|austria|vienna|维也纳', 'i'), icon: '' },
  { name: '比利时', flag: '🇧🇪', regex: new RegExp('🇧🇪|比利时|\\bBE\\b|belgium|brussels|布鲁塞尔', 'i'), icon: '' },
  { name: '保加利亚', flag: '🇧🇬', regex: new RegExp('🇧🇬|保加利亚|\\bBG\\b|bulgaria|sofia|索非亚', 'i'), icon: '' },
  { name: '克罗地亚', flag: '🇭🇷', regex: new RegExp('🇭🇷|克罗地亚|\\bHR\\b|croatia', 'i'), icon: '' },
  { name: '塞浦路斯', flag: '🇨🇾', regex: new RegExp('🇨🇾|塞浦路斯|\\bCY\\b|cyprus', 'i'), icon: '' },
  { name: '捷克', flag: '🇨🇿', regex: new RegExp('🇨🇿|捷克|捷克共和国|\\bCZ\\b|czech|prague|布拉格', 'i'), icon: '' },
  { name: '丹麦', flag: '🇩🇰', regex: new RegExp('🇩🇰|丹麦|\\bDK\\b|denmark|copenhagen|哥本哈根', 'i'), icon: '' },
  { name: '爱沙尼亚', flag: '🇪🇪', regex: new RegExp('🇪🇪|爱沙尼亚|\\bEE\\b|estonia', 'i'), icon: '' },
  { name: '芬兰', flag: '🇫🇮', regex: new RegExp('🇫🇮|芬兰|\\bFI\\b|finland|helsinki|赫尔辛基', 'i'), icon: '' },
  { name: '希腊', flag: '🇬🇷', regex: new RegExp('🇬🇷|希腊|\\bGR\\b|greece|athens|雅典', 'i'), icon: '' },
  { name: '匈牙利', flag: '🇭🇺', regex: new RegExp('🇭🇺|匈牙利|\\bHU\\b|hungary|budapest|布达佩斯', 'i'), icon: '' },
  { name: '爱尔兰', flag: '🇮🇪', regex: new RegExp('🇮🇪|爱尔兰|\\bIE\\b|ireland|dublin|都柏林', 'i'), icon: '' },
  { name: '拉脱维亚', flag: '🇱🇻', regex: new RegExp('🇱🇻|拉脱维亚|\\bLV\\b|latvia', 'i'), icon: '' },
  { name: '立陶宛', flag: '🇱🇹', regex: new RegExp('🇱🇹|立陶宛|\\bLT\\b|lithuania', 'i'), icon: '' },
  { name: '卢森堡', flag: '🇱🇺', regex: new RegExp('🇱🇺|卢森堡|\\bLU\\b|luxembourg', 'i'), icon: '' },
  { name: '马耳他', flag: '🇲🇹', regex: new RegExp('🇲🇹|马耳他|\\bMT\\b|malta', 'i'), icon: '' },
  { name: '波兰', flag: '🇵🇱', regex: new RegExp('🇵🇱|波兰|\\bPL\\b|poland|warsaw|华沙', 'i'), icon: '' },
  { name: '葡萄牙', flag: '🇵🇹', regex: new RegExp('🇵🇹|葡萄牙|\\bPT\\b|portugal|lisbon|里斯本', 'i'), icon: '' },
  {
    name: '罗马尼亚',
    flag: '🇷🇴',
    regex: new RegExp('🇷🇴|罗马尼亚|\\bRO\\b|romania|bucharest|布加勒斯特', 'i'),
    icon: '',
  },
  { name: '斯洛伐克', flag: '🇸🇰', regex: new RegExp('🇸🇰|斯洛伐克|\\bSK\\b|slovakia', 'i'), icon: '' },
  { name: '斯洛文尼亚', flag: '🇸🇮', regex: new RegExp('🇸🇮|斯洛文尼亚|\\bSI\\b|slovenia', 'i'), icon: '' },
  { name: '西班牙', flag: '🇪🇸', regex: new RegExp('🇪🇸|西班牙|\\bES\\b|\\bspain\\b|madrid|马德里', 'i'), icon: '' },
  { name: '瑞典', flag: '🇸🇪', regex: new RegExp('🇸🇪|瑞典|\\bSE\\b|sweden|stockholm|斯德哥尔摩', 'i'), icon: '' },
  { name: '阿尔及利亚', flag: '🇩🇿', regex: new RegExp('🇩🇿|阿尔及利亚|\\bDZ\\b|algeria', 'i'), icon: '' },
  { name: '安哥拉', flag: '🇦🇴', regex: new RegExp('🇦🇴|安哥拉|\\bAO\\b|angola', 'i'), icon: '' },
  { name: '贝宁', flag: '🇧🇯', regex: new RegExp('🇧🇯|贝宁|\\bBJ\\b|benin', 'i'), icon: '' },
  { name: '博茨瓦纳', flag: '🇧🇼', regex: new RegExp('🇧🇼|博茨瓦纳|\\bBW\\b|botswana', 'i'), icon: '' },
  { name: '布基纳法索', flag: '🇧🇫', regex: new RegExp('🇧🇫|布基纳法索|\\bBF\\b|burkina[\\s_-]*faso', 'i'), icon: '' },
  { name: '布隆迪', flag: '🇧🇮', regex: new RegExp('🇧🇮|布隆迪|\\bBI\\b|burundi', 'i'), icon: '' },
  {
    name: '佛得角',
    flag: '🇨🇻',
    regex: new RegExp('🇨🇻|佛得角|\\bCV\\b|cabo[\\s_-]*verde|cape[\\s_-]*verde', 'i'),
    icon: '',
  },
  { name: '喀麦隆', flag: '🇨🇲', regex: new RegExp('🇨🇲|喀麦隆|\\bCM\\b|cameroon', 'i'), icon: '' },
  {
    name: '中非共和国',
    flag: '🇨🇫',
    regex: new RegExp('🇨🇫|中非共和国|中非|\\bCF\\b|central[\\s_-]*african', 'i'),
    icon: '',
  },
  { name: '乍得', flag: '🇹🇩', regex: new RegExp('🇹🇩|乍得|\\bTD\\b|\\bchad\\b', 'i'), icon: '' },
  { name: '科摩罗', flag: '🇰🇲', regex: new RegExp('🇰🇲|科摩罗|\\bKM\\b|comoros', 'i'), icon: '' },
  { name: '刚果共和国', flag: '🇨🇬', regex: new RegExp('🇨🇬|刚果共和国|刚果（布）|\\bCG\\b|\\bcongo\\b', 'i'), icon: '' },
  {
    name: '刚果民主共和国',
    flag: '🇨🇩',
    regex: new RegExp(
      '🇨🇩|刚果民主共和国|刚果（金）|民主刚果|\\bCD\\b|dr[\\s_-]*congo|democratic[\\s_-]*republic[\\s_-]*of[\\s_-]*the[\\s_-]*congo',
      'i',
    ),
    icon: '',
  },
  {
    name: '科特迪瓦',
    flag: '🇨🇮',
    regex: new RegExp('🇨🇮|科特迪瓦|象牙海岸|\\bCI\\b|cote[\\s_-]*d.ivoire|ivory[\\s_-]*coast', 'i'),
    icon: '',
  },
  { name: '吉布提', flag: '🇩🇯', regex: new RegExp('🇩🇯|吉布提|\\bDJ\\b|djibouti', 'i'), icon: '' },
  { name: '埃及', flag: '🇪🇬', regex: new RegExp('🇪🇬|埃及|\\bEG\\b|egypt|cairo|开罗', 'i'), icon: '' },
  {
    name: '赤道几内亚',
    flag: '🇬🇶',
    regex: new RegExp('🇬🇶|赤道几内亚|\\bGQ\\b|equatorial[\\s_-]*guinea', 'i'),
    icon: '',
  },
  { name: '厄立特里亚', flag: '🇪🇷', regex: new RegExp('🇪🇷|厄立特里亚|\\bER\\b|eritrea', 'i'), icon: '' },
  {
    name: '斯威士兰',
    flag: '🇸🇿',
    regex: new RegExp('🇸🇿|斯威士兰|埃斯瓦蒂尼|\\bSZ\\b|eswatini|swaziland', 'i'),
    icon: '',
  },
  { name: '埃塞俄比亚', flag: '🇪🇹', regex: new RegExp('🇪🇹|埃塞俄比亚|\\bET\\b|ethiopia', 'i'), icon: '' },
  { name: '加蓬', flag: '🇬🇦', regex: new RegExp('🇬🇦|加蓬|\\bGA\\b|\\bgabon\\b', 'i'), icon: '' },
  { name: '冈比亚', flag: '🇬🇲', regex: new RegExp('🇬🇲|冈比亚|\\bGM\\b|gambia', 'i'), icon: '' },
  { name: '加纳', flag: '🇬🇭', regex: new RegExp('🇬🇭|加纳|\\bGH\\b|\\bghana\\b', 'i'), icon: '' },
  { name: '几内亚', flag: '🇬🇳', regex: new RegExp('🇬🇳|几内亚|\\bGN\\b|\\bguinea\\b', 'i'), icon: '' },
  {
    name: '几内亚比绍',
    flag: '🇬🇼',
    regex: new RegExp('🇬🇼|几内亚比绍|\\bGW\\b|guinea-bissau|guinea[\\s_-]*bissau', 'i'),
    icon: '',
  },
  { name: '肯尼亚', flag: '🇰🇪', regex: new RegExp('🇰🇪|肯尼亚|\\bKE\\b|kenya|nairobi|内罗毕', 'i'), icon: '' },
  { name: '莱索托', flag: '🇱🇸', regex: new RegExp('🇱🇸|莱索托|\\bLS\\b|lesotho', 'i'), icon: '' },
  { name: '利比里亚', flag: '🇱🇷', regex: new RegExp('🇱🇷|利比里亚|\\bLR\\b|liberia', 'i'), icon: '' },
  { name: '利比亚', flag: '🇱🇾', regex: new RegExp('🇱🇾|利比亚|\\bLY\\b|\\blibya\\b', 'i'), icon: '' },
  { name: '马达加斯加', flag: '🇲🇬', regex: new RegExp('🇲🇬|马达加斯加|\\bMG\\b|madagascar', 'i'), icon: '' },
  { name: '马拉维', flag: '🇲🇼', regex: new RegExp('🇲🇼|马拉维|\\bMW\\b|malawi', 'i'), icon: '' },
  { name: '马里', flag: '🇲🇱', regex: new RegExp('🇲🇱|马里|\\bML\\b|\\bmali\\b', 'i'), icon: '' },
  { name: '毛里塔尼亚', flag: '🇲🇷', regex: new RegExp('🇲🇷|毛里塔尼亚|\\bMR\\b|mauritania', 'i'), icon: '' },
  { name: '毛里求斯', flag: '🇲🇺', regex: new RegExp('🇲🇺|毛里求斯|\\bMU\\b|mauritius', 'i'), icon: '' },
  { name: '摩洛哥', flag: '🇲🇦', regex: new RegExp('🇲🇦|摩洛哥|\\bMA\\b|morocco|casablanca|卡萨布兰卡', 'i'), icon: '' },
  { name: '莫桑比克', flag: '🇲🇿', regex: new RegExp('🇲🇿|莫桑比克|\\bMZ\\b|mozambique', 'i'), icon: '' },
  { name: '纳米比亚', flag: '🇳🇦', regex: new RegExp('🇳🇦|纳米比亚|\\bNA\\b|\\bnamibia\\b', 'i'), icon: '' },
  { name: '尼日尔', flag: '🇳🇪', regex: new RegExp('🇳🇪|尼日尔|\\bNE\\b|\\bniger\\b', 'i'), icon: '' },
  { name: '尼日利亚', flag: '🇳🇬', regex: new RegExp('🇳🇬|尼日利亚|\\bNG\\b|nigeria|lagos|拉各斯', 'i'), icon: '' },
  { name: '卢旺达', flag: '🇷🇼', regex: new RegExp('🇷🇼|卢旺达|\\bRW\\b|rwanda', 'i'), icon: '' },
  {
    name: '圣多美和普林西比',
    flag: '🇸🇹',
    regex: new RegExp('🇸🇹|圣多美和普林西比|\\bST\\b|sao[\\s_-]*tome', 'i'),
    icon: '',
  },
  { name: '塞内加尔', flag: '🇸🇳', regex: new RegExp('🇸🇳|塞内加尔|\\bSN\\b|senegal', 'i'), icon: '' },
  { name: '塞舌尔', flag: '🇸🇨', regex: new RegExp('🇸🇨|塞舌尔|\\bSC\\b|seychelles', 'i'), icon: '' },
  { name: '塞拉利昂', flag: '🇸🇱', regex: new RegExp('🇸🇱|塞拉利昂|\\bSL\\b|sierra[\\s_-]*leone', 'i'), icon: '' },
  { name: '索马里', flag: '🇸🇴', regex: new RegExp('🇸🇴|索马里|\\bSO\\b|somalia', 'i'), icon: '' },
  { name: '南苏丹', flag: '🇸🇸', regex: new RegExp('🇸🇸|南苏丹|\\bSS\\b|south[\\s_-]*sudan', 'i'), icon: '' },
  { name: '苏丹', flag: '🇸🇩', regex: new RegExp('🇸🇩|苏丹|\\bSD\\b|\\bsudan\\b', 'i'), icon: '' },
  { name: '坦桑尼亚', flag: '🇹🇿', regex: new RegExp('🇹🇿|坦桑尼亚|\\bTZ\\b|tanzania', 'i'), icon: '' },
  { name: '多哥', flag: '🇹🇬', regex: new RegExp('🇹🇬|多哥|\\bTG\\b|\\btogo\\b', 'i'), icon: '' },
  { name: '突尼斯', flag: '🇹🇳', regex: new RegExp('🇹🇳|突尼斯|\\bTN\\b|tunisia', 'i'), icon: '' },
  { name: '乌干达', flag: '🇺🇬', regex: new RegExp('🇺🇬|乌干达|\\bUG\\b|uganda', 'i'), icon: '' },
  { name: '赞比亚', flag: '🇿🇲', regex: new RegExp('🇿🇲|赞比亚|\\bZM\\b|zambia', 'i'), icon: '' },
  { name: '津巴布韦', flag: '🇿🇼', regex: new RegExp('🇿🇼|津巴布韦|\\bZW\\b|zimbabwe', 'i'), icon: '' },
  { name: '阿富汗', flag: '🇦🇫', regex: new RegExp('🇦🇫|阿富汗|afghanistan', 'i'), icon: '' },
  { name: '亚美尼亚', flag: '🇦🇲', regex: new RegExp('🇦🇲|亚美尼亚|armenia', 'i'), icon: '' },
  { name: '阿塞拜疆', flag: '🇦🇿', regex: new RegExp('🇦🇿|阿塞拜疆|azerbaijan', 'i'), icon: '' },
  { name: '巴林', flag: '🇧🇭', regex: new RegExp('🇧🇭|巴林|bahrain', 'i'), icon: '' },
  { name: '孟加拉国', flag: '🇧🇩', regex: new RegExp('🇧🇩|孟加拉国|bangladesh', 'i'), icon: '' },
  { name: '不丹', flag: '🇧🇹', regex: new RegExp('🇧🇹|不丹|bhutan', 'i'), icon: '' },
  { name: '格鲁吉亚', flag: '🇬🇪', regex: new RegExp('🇬🇪|格鲁吉亚|georgia', 'i'), icon: '' },
  { name: '伊朗', flag: '🇮🇷', regex: new RegExp('🇮🇷|伊朗|iran', 'i'), icon: '' },
  { name: '伊拉克', flag: '🇮🇶', regex: new RegExp('🇮🇶|伊拉克|iraq', 'i'), icon: '' },
  { name: '以色列', flag: '🇮🇱', regex: new RegExp('🇮🇱|以色列|israel', 'i'), icon: '' },
  { name: '约旦', flag: '🇯🇴', regex: new RegExp('🇯🇴|约旦|jordan', 'i'), icon: '' },
  { name: '哈萨克斯坦', flag: '🇰🇿', regex: new RegExp('🇰🇿|哈萨克斯坦|kazakhstan', 'i'), icon: '' },
  { name: '科威特', flag: '🇰🇼', regex: new RegExp('🇰🇼|科威特|kuwait', 'i'), icon: '' },
  { name: '吉尔吉斯斯坦', flag: '🇰🇬', regex: new RegExp('🇰🇬|吉尔吉斯斯坦|kyrgyzstan', 'i'), icon: '' },
  { name: '黎巴嫩', flag: '🇱🇧', regex: new RegExp('🇱🇧|黎巴嫩|lebanon', 'i'), icon: '' },
  { name: '马尔代夫', flag: '🇲🇻', regex: new RegExp('🇲🇻|马尔代夫|maldives', 'i'), icon: '' },
  { name: '蒙古', flag: '🇲🇳', regex: new RegExp('🇲🇳|蒙古|mongolia', 'i'), icon: '' },
  { name: '尼泊尔', flag: '🇳🇵', regex: new RegExp('🇳🇵|尼泊尔|nepal', 'i'), icon: '' },
  { name: '朝鲜', flag: '🇰🇵', regex: new RegExp('🇰🇵|朝鲜|north[\\s_-]*korea|dprk', 'i'), icon: '' },
  { name: '阿曼', flag: '🇴🇲', regex: new RegExp('🇴🇲|阿曼|oman', 'i'), icon: '' },
  { name: '巴基斯坦', flag: '🇵🇰', regex: new RegExp('🇵🇰|巴基斯坦|pakistan', 'i'), icon: '' },
  { name: '巴勒斯坦', flag: '🇵🇸', regex: new RegExp('🇵🇸|巴勒斯坦|palestine|west[\\s_-]*bank|gaza', 'i'), icon: '' },
  { name: '卡塔尔', flag: '🇶🇦', regex: new RegExp('🇶🇦|卡塔尔|qatar', 'i'), icon: '' },
  { name: '斯里兰卡', flag: '🇱🇰', regex: new RegExp('🇱🇰|斯里兰卡|sri[\\s_-]*lanka', 'i'), icon: '' },
  { name: '叙利亚', flag: '🇸🇾', regex: new RegExp('🇸🇾|叙利亚|syria', 'i'), icon: '' },
  { name: '塔吉克斯坦', flag: '🇹🇯', regex: new RegExp('🇹🇯|塔吉克斯坦|tajikistan', 'i'), icon: '' },
  { name: '东帝汶', flag: '🇹🇱', regex: new RegExp('🇹🇱|东帝汶|timor[\\s_-]*leste|east[\\s_-]*timor', 'i'), icon: '' },
  { name: '土库曼斯坦', flag: '🇹🇲', regex: new RegExp('🇹🇲|土库曼斯坦|turkmenistan', 'i'), icon: '' },
  {
    name: '阿联酋',
    flag: '🇦🇪',
    regex: new RegExp('🇦🇪|阿联酋|迪拜|阿布扎比|dubai|abu[\s_-]*dhabi|uae|united[\\s_-]*arab[\\s_-]*emirates', 'i'),
    icon: '',
  },
  { name: '乌兹别克斯坦', flag: '🇺🇿', regex: new RegExp('🇺🇿|乌兹别克斯坦|uzbekistan', 'i'), icon: '' },
  { name: '也门', flag: '🇾🇪', regex: new RegExp('🇾🇪|也门|yemen', 'i'), icon: '' },
  { name: '澳门', flag: '🇲🇴', regex: new RegExp('🇲🇴|澳门|macau|macao', 'i'), icon: '' },
  { name: '阿尔巴尼亚', flag: '🇦🇱', regex: new RegExp('🇦🇱|阿尔巴尼亚|albania', 'i'), icon: '' },
  { name: '安道尔', flag: '🇦🇩', regex: new RegExp('🇦🇩|安道尔|andorra', 'i'), icon: '' },
  { name: '白俄罗斯', flag: '🇧🇾', regex: new RegExp('🇧🇾|白俄罗斯|belarus', 'i'), icon: '' },
  {
    name: '波斯尼亚和黑塞哥维那',
    flag: '🇧🇦',
    regex: new RegExp('🇧🇦|波斯尼亚和黑塞哥维那|bosnia|bosnia[\\s_-]*and[\\s_-]*herzegovina', 'i'),
    icon: '',
  },
  { name: '冰岛', flag: '🇮🇸', regex: new RegExp('🇮🇸|冰岛|iceland', 'i'), icon: '' },
  { name: '列支敦士登', flag: '🇱🇮', regex: new RegExp('🇱🇮|列支敦士登|liechtenstein', 'i'), icon: '' },
  { name: '摩尔多瓦', flag: '🇲🇩', regex: new RegExp('🇲🇩|摩尔多瓦|moldova', 'i'), icon: '' },
  { name: '摩纳哥', flag: '🇲🇨', regex: new RegExp('🇲🇨|摩纳哥|monaco', 'i'), icon: '' },
  { name: '黑山', flag: '🇲🇪', regex: new RegExp('🇲🇪|黑山|montenegro', 'i'), icon: '' },
  { name: '北马其顿', flag: '🇲🇰', regex: new RegExp('🇲🇰|北马其顿|north[\\s_-]*macedonia|macedonia', 'i'), icon: '' },
  { name: '挪威', flag: '🇳🇴', regex: new RegExp('🇳🇴|挪威|norway', 'i'), icon: '' },
  { name: '圣马力诺', flag: '🇸🇲', regex: new RegExp('🇸🇲|圣马力诺|san[\\s_-]*marino', 'i'), icon: '' },
  { name: '塞尔维亚', flag: '🇷🇸', regex: new RegExp('🇷🇸|塞尔维亚|serbia', 'i'), icon: '' },
  { name: '瑞士', flag: '🇨🇭', regex: new RegExp('🇨🇭|瑞士|switzerland', 'i'), icon: '' },
  { name: '乌克兰', flag: '🇺🇦', regex: new RegExp('🇺🇦|乌克兰|ukraine', 'i'), icon: '' },
  { name: '梵蒂冈', flag: '🇻🇦', regex: new RegExp('🇻🇦|梵蒂冈|vatican', 'i'), icon: '' },
  { name: '科索沃', flag: '🇽🇰', regex: new RegExp('🇽🇰|科索沃|kosovo', 'i'), icon: '' },
  { name: '巴哈马', flag: '🇧🇸', regex: new RegExp('🇧🇸|巴哈马|bahamas', 'i'), icon: '' },
  { name: '巴巴多斯', flag: '🇧🇧', regex: new RegExp('🇧🇧|巴巴多斯|barbados', 'i'), icon: '' },
  { name: '伯利兹', flag: '🇧🇿', regex: new RegExp('🇧🇿|伯利兹|belize', 'i'), icon: '' },
  { name: '哥斯达黎加', flag: '🇨🇷', regex: new RegExp('🇨🇷|哥斯达黎加|costa[\\s_-]*rica', 'i'), icon: '' },
  { name: '古巴', flag: '🇨🇺', regex: new RegExp('🇨🇺|古巴|cuba', 'i'), icon: '' },
  { name: '多米尼克', flag: '🇩🇲', regex: new RegExp('🇩🇲|多米尼克|dominica', 'i'), icon: '' },
  { name: '多米尼加', flag: '🇩🇴', regex: new RegExp('🇩🇴|多米尼加|dominican[\\s_-]*republic|dominican', 'i'), icon: '' },
  { name: '萨尔瓦多', flag: '🇸🇻', regex: new RegExp('🇸🇻|萨尔瓦多|el[\\s_-]*salvador', 'i'), icon: '' },
  { name: '格林纳达', flag: '🇬🇩', regex: new RegExp('🇬🇩|格林纳达|grenada', 'i'), icon: '' },
  { name: '危地马拉', flag: '🇬🇹', regex: new RegExp('🇬🇹|危地马拉|guatemala', 'i'), icon: '' },
  { name: '海地', flag: '🇭🇹', regex: new RegExp('🇭🇹|海地|haiti', 'i'), icon: '' },
  { name: '洪都拉斯', flag: '🇭🇳', regex: new RegExp('🇭🇳|洪都拉斯|honduras', 'i'), icon: '' },
  { name: '牙买加', flag: '🇯🇲', regex: new RegExp('🇯🇲|牙买加|jamaica', 'i'), icon: '' },
  { name: '尼加拉瓜', flag: '🇳🇮', regex: new RegExp('🇳🇮|尼加拉瓜|nicaragua', 'i'), icon: '' },
  { name: '巴拿马', flag: '🇵🇦', regex: new RegExp('🇵🇦|巴拿马|panama', 'i'), icon: '' },
  {
    name: '圣基茨和尼维斯',
    flag: '🇰🇳',
    regex: new RegExp('🇰🇳|圣基茨和尼维斯|saint[\\s_-]*kitts|st[\\s_-]*kitts', 'i'),
    icon: '',
  },
  { name: '圣卢西亚', flag: '🇱🇨', regex: new RegExp('🇱🇨|圣卢西亚|saint[\\s_-]*lucia|st[\\s_-]*lucia', 'i'), icon: '' },
  {
    name: '圣文森特和格林纳丁斯',
    flag: '🇻🇨',
    regex: new RegExp('🇻🇨|圣文森特和格林纳丁斯|saint[\\s_-]*vincent|st[\\s_-]*vincent', 'i'),
    icon: '',
  },
  {
    name: '特立尼达和多巴哥',
    flag: '🇹🇹',
    regex: new RegExp('🇹🇹|特立尼达和多巴哥|trinidad[\\s_-]*and[\\s_-]*tobago', 'i'),
    icon: '',
  },
  {
    name: '安提瓜和巴布达',
    flag: '🇦🇬',
    regex: new RegExp('🇦🇬|安提瓜和巴布达|antigua[\\s_-]*and[\\s_-]*barbuda', 'i'),
    icon: '',
  },
  {
    name: '哥伦比亚',
    flag: '🇨🇴',
    regex: new RegExp('🇨🇴|哥伦比亚|波哥大|麦德林|\\bCO\\b|bogot[aá]|medellin|colombia', 'i'),
    icon: '',
  },
  { name: '智利', flag: '🇨🇱', regex: new RegExp('🇨🇱|智利|chile', 'i'), icon: '' },
  { name: '秘鲁', flag: '🇵🇪', regex: new RegExp('🇵🇪|秘鲁|peru', 'i'), icon: '' },
  { name: '乌拉圭', flag: '🇺🇾', regex: new RegExp('🇺🇾|乌拉圭|uruguay', 'i'), icon: '' },
  { name: '巴拉圭', flag: '🇵🇾', regex: new RegExp('🇵🇾|巴拉圭|paraguay', 'i'), icon: '' },
  { name: '玻利维亚', flag: '🇧🇴', regex: new RegExp('🇧🇴|玻利维亚|bolivia', 'i'), icon: '' },
  { name: '厄瓜多尔', flag: '🇪🇨', regex: new RegExp('🇪🇨|厄瓜多尔|ecuador', 'i'), icon: '' },
  { name: '委内瑞拉', flag: '🇻🇪', regex: new RegExp('🇻🇪|委内瑞拉|venezuela', 'i'), icon: '' },
  { name: '圭亚那', flag: '🇬🇾', regex: new RegExp('🇬🇾|圭亚那|guyana', 'i'), icon: '' },
  { name: '苏里南', flag: '🇸🇷', regex: new RegExp('🇸🇷|苏里南|suriname', 'i'), icon: '' },
  {
    name: '新西兰',
    flag: '🇳🇿',
    regex: new RegExp('🇳🇿|新西兰|new[\\s_-]*zealand|auckland|奥克兰|wellington|惠灵顿', 'i'),
    icon: '',
  },
  { name: '斐济', flag: '🇫🇯', regex: new RegExp('🇫🇯|斐济|fiji', 'i'), icon: '' },
  {
    name: '巴布亚新几内亚',
    flag: '🇵🇬',
    regex: new RegExp('🇵🇬|巴布亚新几内亚|papua[\\s_-]*new[\\s_-]*guinea', 'i'),
    icon: '',
  },
  { name: '所罗门群岛', flag: '🇸🇧', regex: new RegExp('🇸🇧|所罗门群岛|solomon[\\s_-]*islands', 'i'), icon: '' },
  { name: '瓦努阿图', flag: '🇻🇺', regex: new RegExp('🇻🇺|瓦努阿图|vanuatu', 'i'), icon: '' },
  { name: '萨摩亚', flag: '🇼🇸', regex: new RegExp('🇼🇸|萨摩亚|samoa', 'i'), icon: '' },
  { name: '汤加', flag: '🇹🇴', regex: new RegExp('🇹🇴|汤加|tonga', 'i'), icon: '' },
  { name: '基里巴斯', flag: '🇰🇮', regex: new RegExp('🇰🇮|基里巴斯|kiribati', 'i'), icon: '' },
  { name: '图瓦卢', flag: '🇹🇻', regex: new RegExp('🇹🇻|图瓦卢|tuvalu', 'i'), icon: '' },
  { name: '瑙鲁', flag: '🇳🇷', regex: new RegExp('🇳🇷|瑙鲁|nauru', 'i'), icon: '' },
  { name: '帕劳', flag: '🇵🇼', regex: new RegExp('🇵🇼|帕劳|palau', 'i'), icon: '' },
  { name: '马绍尔群岛', flag: '🇲🇭', regex: new RegExp('🇲🇭|马绍尔群岛|marshall[\\s_-]*islands', 'i'), icon: '' },
  {
    name: '密克罗尼西亚',
    flag: '🇫🇲',
    regex: new RegExp('🇫🇲|密克罗尼西亚|micronesia|federated[\\s_-]*states[\\s_-]*of[\\s_-]*micronesia', 'i'),
    icon: '',
  },
  { name: '关岛', flag: '🇬🇺', regex: new RegExp('🇬🇺|关岛|guam', 'i'), icon: '' },
  { name: '波多黎各', flag: '🇵🇷', regex: new RegExp('🇵🇷|波多黎各|puerto[\\s_-]*rico', 'i'), icon: '' },
  { name: '百慕大', flag: '🇧🇲', regex: new RegExp('🇧🇲|百慕大|bermuda', 'i'), icon: '' },
  { name: '格陵兰', flag: '🇬🇱', regex: new RegExp('🇬🇱|格陵兰|greenland', 'i'), icon: '' },
  { name: '库拉索', flag: '🇨🇼', regex: new RegExp('🇨🇼|库拉索|curacao|curaçao', 'i'), icon: '' },
  { name: '阿鲁巴', flag: '🇦🇼', regex: new RegExp('🇦🇼|阿鲁巴|aruba', 'i'), icon: '' },
  { name: '开曼群岛', flag: '🇰🇾', regex: new RegExp('🇰🇾|开曼群岛|cayman[\\s_-]*islands', 'i'), icon: '' },
  {
    name: '英属维尔京群岛',
    flag: '🇻🇬',
    regex: new RegExp('🇻🇬|英属维尔京群岛|british[\\s_-]*virgin[\\s_-]*islands', 'i'),
    icon: '',
  },
  {
    name: '美属维尔京群岛',
    flag: '🇻🇮',
    regex: new RegExp('🇻🇮|美属维尔京群岛|us[\\s_-]*virgin[\\s_-]*islands|u\\.s\\.[\\s_-]*virgin[\\s_-]*islands', 'i'),
    icon: '',
  },
  { name: '新喀里多尼亚', flag: '🇳🇨', regex: new RegExp('🇳🇨|新喀里多尼亚|new[\\s_-]*caledonia', 'i'), icon: '' },
  { name: '法属波利尼西亚', flag: '🇵🇫', regex: new RegExp('🇵🇫|法属波利尼西亚|french[\\s_-]*polynesia', 'i'), icon: '' },
  { name: '库克群岛', flag: '🇨🇰', regex: new RegExp('🇨🇰|库克群岛|cook[\\s_-]*islands', 'i'), icon: '' },
  { name: '纽埃', flag: '🇳🇺', regex: new RegExp('🇳🇺|纽埃|niue', 'i'), icon: '' },
];

// 定义倍率策略组
const lowRateRegionName = '低倍率节点';
const highRateRegionName = '高倍率节点';

const rateRegionDefinitions = [
  {
    name: lowRateRegionName,
    regex:
      /^(?!.*(?:剩|期)).*(?:(?<!\d)0\.[0-5]|(?<=[ \[\(|｜丨∣┃\-‐–—−－﹣])0[*×✕✖⨯⨉x倍])|(?:(?<=[ \[\(|｜丨∣┃\-‐–—−－﹣])[*×✕✖⨯⨉x]0(?=[ \)\]]|倍|$))|^(?!.*(?:客户端|软件)).*下载|低倍|免费|(?<![A-Za-z])free(?![A-Za-z])/i,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Available.svg',
  },
  {
    name: highRateRegionName,
    regex:
      /(?<=[ \[\(|｜丨∣┃\-‐–—−－﹣])((?:[*×✕✖⨯⨉x]\s*(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?)|(?:(?<![\d.])(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?\s*(?:倍|[*×✕✖⨯⨉x])))/i,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Airport.svg',
  },
];

// 全部策略组定义（地区 + 倍率），统一用于节点匹配与归类
const allRegionDefinitions = [...regionDefinitions, ...rateRegionDefinitions];

// Rule Providers 通用配置
const ruleProviderCommonDomain = {
  type: 'http',
  format: 'mrs',
  interval: 86400,
  behavior: 'domain',
};
const ruleProviderCommonIpcidr = {
  type: 'http',
  format: 'mrs',
  interval: 86400,
  behavior: 'ipcidr',
};

// 定义基础 Rule Providers
const baseRuleProviders = {
  // --- 直连规则集 ---

  private: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/private.mrs',
    path: './ruleset/private.mrs',
    'path-in-bundle': 'geo/geosite/private.mrs',
  },
  private_ip: {
    ...ruleProviderCommonIpcidr,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/private.mrs',
    path: './ruleset/private_ip.mrs',
    'path-in-bundle': 'geo/geoip/private.mrs',
  },
  games_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/category-games@cn.mrs',
    path: './ruleset/category-games@cn.mrs',
    'path-in-bundle': 'geo/geosite/category-games@cn.mrs',
  },
  epicgames: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/epicgames.mrs',
    path: './ruleset/epicgames.mrs',
    'path-in-bundle': 'geo/geosite/epicgames.mrs',
  },
  apple_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/apple@cn.mrs',
    path: './ruleset/apple@cn.mrs',
    'path-in-bundle': 'geo/geosite/apple@cn.mrs',
  },
  microsoft_cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/microsoft@cn.mrs',
    path: './ruleset/microsoft@cn.mrs',
    'path-in-bundle': 'geo/geosite/microsoft@cn.mrs',
  },
  'geolocation-cn': {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/geolocation-cn.mrs',
    path: './ruleset/geolocation-cn.mrs',
    'path-in-bundle': 'geo/geosite/geolocation-cn.mrs',
  },
  cn_ip: {
    ...ruleProviderCommonIpcidr,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/cn.mrs',
    path: './ruleset/cn_ip.mrs',
    'path-in-bundle': 'geo/geoip/cn.mrs',
  },

  // --- 代理规则集 ---

  'geolocation-!cn': {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/geolocation-!cn.mrs',
    path: './ruleset/geolocation-!cn.mrs',
    'path-in-bundle': 'geo/geosite/geolocation-!cn.mrs',
  },

  // --- 其他规则集 ---

  fakeip_filter: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/fakeip-filter.mrs',
    path: './ruleset/fakeip-filter.mrs',
    'path-in-bundle': 'geo/geosite/fakeip-filter.mrs',
  },
  cn_additional: {
    ...ruleProviderCommonDomain,
    url: 'https://static-file-global.353355.xyz/rules/cn-additional-list.mrs',
    path: './ruleset/cn-additional-list.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },
  cn: {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/cn.mrs',
    path: './ruleset/cn.mrs',
    'path-in-bundle': 'geo/geosite/cn.mrs',
  },
};

// 策略组公共配置
const groupBaseOption = {
  interval: 600,
  timeout: 3000,
  url: 'https://www.apple.com/library/test/success.html',
  lazy: true,
  'max-failed-times': 3,
  'empty-fallback': 'REJECT',
};

// select策略组通用配置
const selectBaseOption = {
  ...groupBaseOption,
  type: 'select',
};

// url-test策略组通用配置
const urlTestBaseOption = {
  ...groupBaseOption,
  type: 'url-test',
  tolerance: 50,
  'exclude-type': 'DIRECT',
  icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Auto.svg',
  hidden: true,
};

// 定义基础策略组
const baseGroups = [
  {
    name: '手动选择',
    baseOption: selectBaseOption,
    includeAll: true,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Static.svg',
  },
  {
    name: '自动选择',
    baseOption: urlTestBaseOption,
    includeAll: true,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Auto.svg',
  },
  {
    name: '故障转移',
    baseOption: {
      ...groupBaseOption,
      type: 'fallback',
      'exclude-type': 'DIRECT',
      icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Auto.svg',
    },
    includeAll: true,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Auto.svg',
  },
];

// 定义分流策略组配置
const serviceConfigs = [
  ...baseGroups,
  {
    name: 'Google',
    baseOption: selectBaseOption,
    providers: {
      google: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/google.mrs',
        path: './ruleset/google.mrs',
        'path-in-bundle': 'geo/geosite/google.mrs',
      },
      google_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/google.mrs',
        path: './ruleset/google_ip.mrs',
        'path-in-bundle': 'geo/geoip/google.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Google.svg',
    rules: ['RULE-SET,google,Google', 'RULE-SET,google_ip,Google,no-resolve'],
  },
  {
    name: 'AI',
    baseOption: selectBaseOption,
    defaultSelected: '美国',
    providers: {
      ai: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/category-ai-!cn.mrs',
        path: './ruleset/ai.mrs',
        'path-in-bundle': 'geo/geosite/category-ai-!cn.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/ChatGPT.svg',
    rules: ['RULE-SET,ai,AI'],
  },
  {
    name: 'Telegram',
    baseOption: selectBaseOption,
    providers: {
      telegram: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/telegram.mrs',
        path: './ruleset/telegram.mrs',
        'path-in-bundle': 'geo/geosite/telegram.mrs',
      },
      telegram_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/telegram.mrs',
        path: './ruleset/telegram_ip.mrs',
        'path-in-bundle': 'geo/geoip/telegram.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Telegram.svg',
    rules: ['RULE-SET,telegram,Telegram', 'RULE-SET,telegram_ip,Telegram,no-resolve'],
  },
  {
    name: 'Steam',
    baseOption: selectBaseOption,
    direct: true,
    providers: {
      steam: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/steam.mrs',
        path: './ruleset/steam.mrs',
        'path-in-bundle': 'geo/geosite/steam.mrs',
      },
      steam_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/steam.mrs',
        path: './ruleset/steam_ip.mrs',
        'path-in-bundle': 'geo/geoip/steam.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Steam.svg',
    rules: ['RULE-SET,steam,Steam', 'RULE-SET,steam_ip,Steam,no-resolve'],
  },
  {
    name: '远控工具',
    baseOption: selectBaseOption,
    fixedProxies: ['REJECT-DROP', '默认代理', '直连'],
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Remote.svg',
    rules: [
      'PROCESS-NAME-WILDCARD,*AnyDesk*,远控工具',
      'PROCESS-NAME-WILDCARD,*ToDesk*,远控工具',
      'PROCESS-NAME-WILDCARD,*TeamViewer*,远控工具',
      'PROCESS-NAME-WILDCARD,*RustDesk*,远控工具',
      'PROCESS-NAME-WILDCARD,*rustdesk*,远控工具',
      'PROCESS-NAME-WILDCARD,*tailscale*,远控工具',
      'PROCESS-NAME-WILDCARD,*tailscaled*,远控工具',
      'PROCESS-NAME-WILDCARD,*zerotier*,远控工具',
      'PROCESS-NAME-WILDCARD,*ngrok*,远控工具',
      'PROCESS-NAME-WILDCARD,*frpc*,远控工具',
      'PROCESS-NAME-WILDCARD,*frps*,远控工具',
      'PROCESS-NAME-WILDCARD,*cloudflared*,远控工具',
      'PROCESS-NAME-WILDCARD,*natapp*,远控工具',
      'PROCESS-NAME-WILDCARD,*nblink*,远控工具',
    ],
  },
  {
    name: 'AdBlock',
    baseOption: selectBaseOption,
    reject: true,
    providers: {
      adblockmihomolite: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomolite.mrs',
        path: './ruleset/adblockmihomolite.mrs',
        'path-in-bundle': 'geo/geosite/category-ads-all.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/AdBlock.svg',
    rules: ['RULE-SET,adblockmihomolite,AdBlock'],
  },
];

// ---节点过滤、重命名及验证---

/**
 * 节点匹配缓存，避免重复执行正则
 */
const regionMatchCache = new Map();
function getMatchedRegions(proxyName) {
  if (regionMatchCache.has(proxyName)) {
    return regionMatchCache.get(proxyName);
  }

  const regions = allRegionDefinitions.filter((region) => region.regex.test(proxyName));
  const geoMatches = regions.filter((region) => regionDefinitions.includes(region));
  const otherMatches = regions.filter((region) => !regionDefinitions.includes(region));
  let selectedGeo = geoMatches;
  if (geoMatches.length > 1) {
    const bestLen = Math.max(...geoMatches.map((r) => r.regex.source.length));
    selectedGeo = geoMatches.filter((r) => r.regex.source.length === bestLen);
  }
  const result = [...selectedGeo, ...otherMatches];
  regionMatchCache.set(proxyName, result);

  return result;
}

/**
 * 标准化节点名称：补全地区国旗、折叠多余空格，并预缓存匹配结果
 */
const flagRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
function normalizeProxyName(proxy) {
  const originalName = proxy.name;

  const flag = originalName.match(flagRegex)?.[0];

  const nameWithoutFlag = (flag ? originalName.replace(flag, '') : originalName).replace(/\s+/g, ' ').trim();

  const matchedRegions = getMatchedRegions(originalName);

  const regionFlag = flag || matchedRegions.find((region) => region.flag)?.flag;

  const normalizedName = regionFlag ? `${regionFlag} ${nameWithoutFlag}` : nameWithoutFlag;

  if (normalizedName !== originalName) {
    regionMatchCache.set(normalizedName, matchedRegions);
  }

  return normalizedName === originalName ? proxy : { ...proxy, name: normalizedName };
}

/**
 * 修复 dialer-proxy 引用：目标被重命名则更新，被移除或不存在则删除引用
 */
function fixDialerProxy(proxy, renameMap, normalizedProxyNames) {
  const target = proxy['dialer-proxy'];
  if (!target) return proxy;

  if (renameMap.has(target)) {
    return { ...proxy, 'dialer-proxy': renameMap.get(target) };
  }

  if (normalizedProxyNames.has(target)) {
    return proxy;
  }

  const copy = { ...proxy };
  delete copy['dialer-proxy'];
  return copy;
}

/**
 * 读取代理 IP 版本偏好：仅其中一个开关开启时返回对应偏好，
 * 同时开启或同时关闭时返回 null（不应用任何偏好，节点保持原样）
 */
function getIpVersionPreference() {
  const ipv4PreferEnabled = ruleOptionsEnable.代理IPV4优先;
  const ipv6PreferEnabled = ruleOptionsEnable.代理IPV6优先;

  if (ipv4PreferEnabled && !ipv6PreferEnabled) return 'ipv4-prefer';
  if (ipv6PreferEnabled && !ipv4PreferEnabled) return 'ipv6-prefer';
  return null;
}

/**
 * 过滤并标准化节点：剔除内置/信息节点、按配置过滤、去重、修复 dialer-proxy 引用，空列表时抛错
 */
function filterAndNormalizeProxies(config) {
  regionMatchCache.clear();

  const filterLowRateProxiesEnabled = ruleOptionsEnable.过滤低倍率节点;
  const filterHighRateProxiesEnabled = ruleOptionsEnable.过滤高倍率节点;
  const filterNonRegionProxiesEnabled = ruleOptionsEnable.过滤非地区节点;

  const lowRateRegex = filterLowRateProxiesEnabled
    ? rateRegionDefinitions.find((r) => r.name === lowRateRegionName)?.regex
    : null;
  const highRateRegex = filterHighRateProxiesEnabled
    ? rateRegionDefinitions.find((r) => r.name === highRateRegionName)?.regex
    : null;

  const originalProxies = config.proxies || [];

  const filteredRawProxies = originalProxies.filter((proxy) => {
    const type = String(proxy.type ?? '').toLowerCase();
    if (type === 'direct' || type === 'reject' || type === 'rematch') return false;

    if (lowRateRegex?.test(proxy.name) || highRateRegex?.test(proxy.name)) return false;

    if (!filterNonRegionProxiesEnabled) return true;

    const isRegionProxy = getMatchedRegions(proxy.name).some((region) => regionDefinitions.includes(region));

    return isRegionProxy || !excludeFilter.test(proxy.name);
  });

  const renameMap = new Map();
  const normalizedProxies = [];
  const uniqueNames = new Set();

  for (const rawProxy of filteredRawProxies) {
    const normalized = normalizeProxyName(rawProxy);
    if (normalized.name !== rawProxy.name) {
      renameMap.set(rawProxy.name, normalized.name);
    }
    if (!uniqueNames.has(normalized.name)) {
      uniqueNames.add(normalized.name);
      normalizedProxies.push(normalized);
    }
  }

  const normalizedProxyNames = new Set(normalizedProxies.map((p) => p.name));

  const filteredProxies = normalizedProxies.map((proxy) => fixDialerProxy(proxy, renameMap, normalizedProxyNames));

  if (!filteredProxies.length) {
    throw new Error('配置文件中未找到任何代理节点，请使用机场提供的配置文件进行覆写');
  }

  const ipVersionPreference = getIpVersionPreference();
  if (ipVersionPreference) {
    return filteredProxies.map((proxy) =>
      proxy['ip-version'] === ipVersionPreference ? proxy : { ...proxy, 'ip-version': ipVersionPreference },
    );
  }

  return filteredProxies;
}

// ---构建地区组和倍率组---

/**
 * 构建地区策略组，可附带自动选择组
 */
function createRegionGroup(name, icon, proxies) {
  const generateRegionAutoSelectEnabled = ruleOptionsEnable.生成地区自动选择组;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;

  if (generateRegionAutoSelectEnabled) {
    const urlTestName = `${name}-自动选择`;
    return [
      {
        ...urlTestBaseOption,
        name: urlTestName,
        proxies,
      },
      {
        ...selectBaseOption,
        name,
        icon,
        proxies: [...proxies, urlTestName],
        hidden: hideManualSelectGroupEnabled,
      },
    ];
  }
  return [
    {
      ...selectBaseOption,
      name,
      icon,
      proxies,
      hidden: hideManualSelectGroupEnabled,
    },
  ];
}

/**
 * 将节点按地区/倍率归类，构建地区策略组、倍率策略组与“其他节点”组
 */
function buildRegionGroups(filteredProxies, customProxies) {
  const generateRateGroupEnabled = ruleOptionsEnable.生成倍率组;

  const regionGroups = Object.fromEntries(allRegionDefinitions.map(({ name }) => [name, []]));
  const otherProxies = [];

  for (const proxy of [...filteredProxies, ...customProxies]) {
    const matchedRegions = getMatchedRegions(proxy.name);
    const isRegionProxy = matchedRegions.some((region) => regionDefinitions.includes(region));

    for (const region of matchedRegions) {
      regionGroups[region.name].push(proxy.name);
    }

    if (!isRegionProxy) {
      otherProxies.push(proxy.name);
    }
  }

  const generatedRegionGroups = allRegionDefinitions
    .filter((r) => regionGroups[r.name].length > 0 && (generateRateGroupEnabled || !rateRegionDefinitions.includes(r)))
    .flatMap((r) => createRegionGroup(r.name, r.icon, regionGroups[r.name]));

  if (otherProxies.length > 0) {
    generatedRegionGroups.push(
      ...createRegionGroup(
        '其他节点',
        'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/WorldMap.svg',
        otherProxies,
      ),
    );
  }

  return generatedRegionGroups;
}

// ---构建自定义节点组---

/**
 * 处理自定义节点：标准化名称、与订阅节点重名时添加“自建-”前缀、内部去重，
 * 并构建“自建节点”策略组。
 * 自定义节点不参与订阅节点过滤，也不参与 hosts 改写及 DNS 域名处理。
 */
function buildCustomizeGroups(filteredProxies, customizeList = customizeProxies) {
  const chainEnabled = ruleOptionsEnable.链式代理;

  if (!customizeList.length) {
    if (chainEnabled) {
      throw new Error('启用失败，请在脚本中添加自定义节点后尝试');
    }
    return { customProxies: [], customProxyNames: [], customGroup: null };
  }

  const usedNames = new Set(filteredProxies.map((p) => p.name));
  const customPrefix = '自建-';
  const customProxies = [];

  for (const proxy of customizeList) {
    const normalized = normalizeProxyName(proxy);
    let name = normalized.name;
    while (usedNames.has(name)) {
      name = normalizeProxyName({ name: `${customPrefix}${name}` }).name.replace(`${customPrefix} `, customPrefix);
    }
    usedNames.add(name);

    let customProxy = name === normalized.name ? normalized : { ...normalized, name };
    if (chainEnabled && customProxy['dialer-proxy'] !== dialerProxyName) {
      customProxy = { ...customProxy, 'dialer-proxy': dialerProxyName };
    }
    customProxies.push(customProxy);
  }

  const customProxyNames = customProxies.map((p) => p.name);

  const customGroup = {
    ...selectBaseOption,
    name: chainEnabled ? '链式落地' : '自建节点',
    proxies: customProxyNames,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Server.svg',
  };

  return {
    customProxies,
    customProxyNames,
    customGroup,
  };
}

// ---构建基础策略组和分流策略组---

/**
 * 构建基础/分流策略组/部分节点组、GLOBAL 组与规则集，并汇总分流规则
 */
function buildFunctionalGroups(filteredProxies, generatedRegionGroups, customizeInfo) {
  const minimalModeEnabled = ruleOptionsEnable.极简模式;
  const blockForeignQuicEnabled = ruleOptionsEnable.屏蔽国外QUIC;
  const addAllNodesToServiceGroupsEnabled = ruleOptionsEnable.分流组添加所有节点;
  const chainEnabled = ruleOptionsEnable.链式代理;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;

  const functionalGroups = [];
  const functionalRules = [];
  const finalRuleProviders = { ...baseRuleProviders };

  if (!blockForeignQuicEnabled) {
    delete finalRuleProviders.cn_additional;
  }

  const { customProxyNames = [], customGroup = null } = customizeInfo || {};
  const filteredProxyNames = filteredProxies.map((p) => p.name);
  const allProxiesNames = [...customProxyNames, ...filteredProxyNames];
  const groupNamesOfSelect = generatedRegionGroups.filter((g) => g.type === 'select').map((g) => g.name);
  const baseGroupNames = baseGroups.filter((g) => ruleOptionsEnable[g.name]).map((g) => g.name);
  const customGroupNames = customGroup ? [customGroup.name] : [];

  const chainGroup =
    chainEnabled && customGroup
      ? {
          ...selectBaseOption,
          name: dialerProxyName,
          proxies: filteredProxyNames,
          icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Bypass.svg',
        }
      : null;

  if (minimalModeEnabled) {
    const defaultGroup = {
      ...selectBaseOption,
      name: '默认代理',
      proxies: allProxiesNames,
      icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Proxy.svg',
    };
    const finalRuleProviders = { ...baseRuleProviders };
    if (!blockForeignQuicEnabled) delete finalRuleProviders.cn_additional;
    const directGroup = {
      ...selectBaseOption,
      name: '直连',
      proxies: [...directProxies.map((p) => p.name)],
      icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/China.svg',
      hidden: true,
    };
    const globalGroup = {
      ...selectBaseOption,
      name: 'GLOBAL',
      proxies: ['默认代理', ...customGroupNames, ...(chainGroup ? [chainGroup.name] : []), '直连'],
      icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Global.svg',
    };
    return {
      globalGroup,
      functionalGroups: [defaultGroup],
      functionalRules: [],
      finalRuleProviders,
      chainGroup,
      directGroup,
    };
  }

  functionalGroups.push({
    ...selectBaseOption,
    name: '默认代理',
    proxies: [...groupNamesOfSelect, ...baseGroupNames, ...customGroupNames],
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Proxy.svg',
  });

  const orderedServiceConfigs = [
    ...serviceConfigs.filter((svc) => svc.name === 'AdBlock'),
    ...serviceConfigs.filter((svc) => svc.name !== 'AdBlock'),
  ];
  for (const svc of orderedServiceConfigs) {
    if (!ruleOptionsEnable[svc.name]) continue;

    functionalRules.push(...(svc.rules || []));
    Object.assign(finalRuleProviders, svc.providers || {});
  }

  for (const svc of serviceConfigs) {
    if (!ruleOptionsEnable[svc.name]) continue;

    let groupProxies = [];
    if (svc.fixedProxies) {
      groupProxies = [...svc.fixedProxies];
    } else if (svc.includeAll) {
      groupProxies = [...allProxiesNames];
    } else if (svc.reject) {
      groupProxies = ['REJECT', 'REJECT-DROP', 'PASS'];
    } else {
      groupProxies = !addAllNodesToServiceGroupsEnabled
        ? ['默认代理', ...customGroupNames, ...baseGroupNames, ...groupNamesOfSelect, ...(svc.direct ? ['直连'] : [])]
        : [
            '默认代理',
            ...customGroupNames,
            ...baseGroupNames,
            ...groupNamesOfSelect,
            ...allProxiesNames,
            ...(svc.direct ? ['直连'] : []),
          ];
    }

    functionalGroups.push({
      ...svc.baseOption,
      name: svc.name,
      icon: svc.icon,
      proxies: groupProxies,
      ...(svc.defaultSelected !== undefined && {
        'default-selected': svc.defaultSelected,
      }),
    });
  }

  functionalGroups.push({
    ...selectBaseOption,
    name: '漏网之鱼',
    proxies: ['默认代理', '直连', ...groupNamesOfSelect],
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Stack.svg',
  });

  const directGroup = {
    ...selectBaseOption,
    name: '直连',
    proxies: [...directProxies.map((p) => p.name)],
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/China.svg',
    hidden: hideManualSelectGroupEnabled,
  };

  const globalGroup = {
    ...selectBaseOption,
    name: 'GLOBAL',
    proxies: [
      ...functionalGroups.map((g) => g.name),
      ...customGroupNames,
      ...(chainGroup ? [chainGroup.name] : []),
      directGroup.name,
      ...generatedRegionGroups.map((g) => g.name),
    ],
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Global.svg',
  };

  return { globalGroup, functionalGroups, functionalRules, finalRuleProviders, chainGroup, directGroup };
}

// ---dns和hosts相关处理---

// 常见的公共 DNS，用于过滤订阅中的公共 DNS
const commonDnsList = [
  // IPv4（国内）
  '223.5.5.5',
  '223.6.6.6',
  '119.29.29.29',
  '1.12.12.12',
  '120.53.53.53',
  '114.114.114.114',
  '180.76.76.76',
  '1.2.4.8',
  '116.116.116.116',
  '101.226.4.6',
  '123.125.81.6',
  '180.184.1.1',
  '180.184.2.2',

  // IPv6（国内）
  '2400:3200::1',
  '2400:3200:baba::1',
  '2402:4e00::',
  '2400:da00::6666',

  // IPv4（国外）
  '1.1.1.1',
  '1.0.0.1',
  '8.8.8.8',
  '8.8.4.4',
  '9.9.9.9',
  '149.112.112.112',
  '208.67.222.222',
  '208.67.220.220',
  '94.140.14.14',
  '94.140.15.15',
  '76.76.2.0',
  '76.76.10.0',
  '185.228.168.9',
  '185.228.169.9',
  '77.88.8.8',
  '77.88.8.1',
  '156.154.70.1',
  '156.154.71.1',

  // IPv6（国外）
  '2606:4700:4700::1111',
  '2606:4700:4700::1001',
  '2001:4860:4860::8888',
  '2001:4860:4860::8844',
  '2620:fe::fe',
  '2620:fe::9',
  '2620:119:35::35',
  '2620:119:53::53',
  '2a10:50c0::bad1:ff',
  '2a10:50c0::bad2:ff',
  '2a10:50c0::ad1:ff',
  '2a10:50c0::ad2:ff',
  '2a0d:2a00:1::2',
  '2a0d:2a00:2::2',
  '2a02:6b8::feed:0ff',
  '2a02:6b8:0:1::feed:0ff',
  '2610:a1:1018::1',
  '2610:a1:1019::1',

  // 关键词（国内）
  'alidns',
  'doh.pub',
  'dot.pub',
  'dns.pub',
  'dnspod',
  'dns.baidu',

  // 关键词（国外）
  'dns.google',
  'dns.cloudflare',
  'dns.apple',
  'cloudflare-dns',
  'quad9',
  'opendns',
  'nextdns',
  'adguard',
  'one.one.one.one',
];

// 预编译公共 DNS 正则
const commonDnsRegex = new RegExp(
  commonDnsList.map((dns) => dns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i',
);

// 国内外 DNS 定义
const chinaDNS = ['223.5.5.5#DIRECT', '119.29.29.29#DIRECT'];
const foreignDNS = ['https://cloudflare-dns.com/dns-query#默认代理', 'https://dns.google/dns-query#默认代理'];
const defaultDNS = ['114.114.114.114#DIRECT', 'tls://223.5.5.5#DIRECT', 'https://1.12.12.12/dns-query#DIRECT'];
const proxyServerDNS = ['114.114.114.114#DIRECT', 'tls://223.5.5.5#DIRECT', 'https://doh.pub/dns-query#DIRECT'];

/**
 * hosts 匹配优先级：精确 > +. > . > *（同级按出现顺序）
 */
function hostSpecificity(pattern) {
  if (pattern.startsWith('+.')) return 2;
  if (pattern.startsWith('.')) return 1;
  if (pattern.includes('*')) return 0;
  return 3;
}

/**
 * 判断域名规则（精确/通配）是否匹配节点域名集合，忽略大小写
 */
function matchDomainPattern(pattern, domains) {
  pattern = pattern.toLowerCase();

  // 精确匹配
  if (!pattern.includes('*') && !pattern.startsWith('+.') && !pattern.startsWith('.')) {
    return typeof domains === 'string'
      ? domains.toLowerCase() === pattern
      : [...domains].some((d) => d.toLowerCase() === pattern);
  }

  const domainList = typeof domains === 'string' ? [domains.toLowerCase()] : [...domains].map((d) => d.toLowerCase());

  // +.example.com
  if (pattern.startsWith('+.')) {
    const suffix = pattern.slice(2);
    return domainList.some((domain) => domain === suffix || domain.endsWith(`.${suffix}`));
  }

  // .example.com
  if (pattern.startsWith('.')) {
    const suffix = pattern.slice(1);
    return domainList.some((domain) => domain !== suffix && domain.endsWith(`.${suffix}`));
  }

  // *.example.com、example.*.com 等
  const patternParts = pattern.split('.');
  return domainList.some((domain) => {
    const domainParts = domain.split('.');
    return (
      patternParts.length === domainParts.length &&
      patternParts.every((part, index) => part === '*' || part === domainParts[index])
    );
  });
}

/**
 * 根据订阅 hosts 映射改写节点 server，改写后无需再复制 hosts 进新配置。
 * 支持链式映射（如 a: b、b: c 时节点 a 改写为 c）；
 * 回环映射（a: b、b: a）由内核校验拒绝，此处仅以已访问集合防御性终止
 */
function applyHostsToProxies(proxies, hosts) {
  if (!hosts || typeof hosts !== 'object') return proxies;

  const hostEntries = Object.entries(hosts)
    .filter(
      ([, value]) => (typeof value === 'string' && value.length > 0) || (Array.isArray(value) && value.length > 0),
    )
    .sort((a, b) => hostSpecificity(b[0]) - hostSpecificity(a[0]));

  if (hostEntries.length === 0) return proxies;

  const targetOf = (value) => {
    if (Array.isArray(value)) value = value.find((v) => typeof v === 'string' && v.length > 0);
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  const resolveCache = new Map();
  const resolve = (server) => {
    const cached = resolveCache.get(server);
    if (cached !== undefined) return cached;

    const seen = new Set();
    let current = server.toLowerCase();
    let result = server;
    while (!seen.has(current)) {
      seen.add(current);
      const entry = hostEntries.find(([pattern]) => matchDomainPattern(pattern, current));
      const target = entry && targetOf(entry[1]);
      if (!target) break;
      result = target;
      current = target.toLowerCase();
    }
    resolveCache.set(server, result);
    return result;
  };

  return proxies.map((proxy) => {
    if (typeof proxy.server !== 'string') return proxy;
    const server = resolve(proxy.server);
    return server === proxy.server ? proxy : { ...proxy, server };
  });
}

/**
 * 剥离 DNS 地址的 # 策略组后缀；
 * 参数包含 direct 或 直连 时，强制改为 #DIRECT
 */
function stripDnsSuffix(dns) {
  const str = String(dns);
  const hashIndex = str.indexOf('#');
  if (hashIndex === -1) return str;

  const prefix = str.slice(0, hashIndex).trim();

  const suffix = str
    .slice(hashIndex + 1)
    .toLowerCase()
    .trim();

  if (suffix.includes('direct') || suffix.includes('直连')) return prefix + '#DIRECT';

  return prefix;
}

/**
 * 判断节点 server 是否为 IP 地址（IPv4 / IPv6），用于从节点域名集合中排除 IP 类型的 server
 */
function isIpAddress(server) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(server) || server.includes(':');
}

/**
 * 简化节点域名策略：将相同 DNS 的节点域名按后缀归类，至少三段的域名可合并为 +. 后缀形式
 */
function simplifyDomainPolicy(policy) {
  const groups = new Map();

  for (const [domain, dns] of Object.entries(policy)) {
    const dnsKey = JSON.stringify(Array.isArray(dns) ? [...dns].sort() : dns);

    if (domain.startsWith('+.') || domain.startsWith('.') || domain.includes('*')) {
      groups.set(`keep:${domain}`, [{ domain, dns, dnsKey }]);
      continue;
    }

    const parts = domain.split('.');

    if (parts.length < 3) {
      groups.set(`keep:${domain}`, [{ domain, dns, dnsKey }]);
      continue;
    }

    const suffix = parts.slice(-2).join('.');

    if (!groups.has(suffix)) {
      groups.set(suffix, []);
    }

    groups.get(suffix).push({ domain, dns, dnsKey });
  }

  const result = {};

  for (const [suffix, domains] of groups) {
    const firstDnsKey = domains[0].dnsKey;
    const sameDns = domains.every(({ dnsKey }) => dnsKey === firstDnsKey);

    if (domains.length >= 2 && sameDns) {
      result[`+.${suffix}`] = domains[0].dns;
    } else {
      for (const { domain, dns } of domains) {
        result[domain] = dns;
      }
    }
  }

  return result;
}

/**
 * 构建 DNS 与 hosts：保留私有 DNS、节点域名 policy/fake-ip-filter，并按 hosts 改写节点 server
 * hosts改写条件（满足任意一个条件即可）：
 * 1. proxy-server-nameserver 有且仅有一个 DNS 并且该 DNS 包含非空的 listen 值
 * 2. proxy-server-nameserver 有且仅有一个 DNS 并且该 DNS 包含 127.0.0.1 并且 listen 包含 0.0.0.0
 */
function buildDnsAndHostsConfig(config, filteredProxies) {
  const originalDnsConfig = config.dns || {};

  const proxyServerNameservers = originalDnsConfig['proxy-server-nameserver'] || [];
  const listenValue = originalDnsConfig['listen'];

  const shouldRewriteByHosts =
    proxyServerNameservers.length === 1 &&
    typeof listenValue === 'string' &&
    listenValue.length > 0 &&
    (proxyServerNameservers.some((dns) => String(dns).toLowerCase().includes(listenValue.toLowerCase())) ||
      (listenValue.includes('0.0.0.0') &&
        proxyServerNameservers.some((dns) => String(dns).toLowerCase().includes('127.0.0.1'))));

  const mappedProxies = shouldRewriteByHosts ? applyHostsToProxies(filteredProxies, config.hosts) : filteredProxies;

  const proxyDomains = new Set(
    mappedProxies
      .filter((proxy) => typeof proxy.server === 'string')
      .map((proxy) => proxy.server.toLowerCase())
      .filter((server) => !isIpAddress(server)),
  );

  const privateProxyServerNameservers = shouldRewriteByHosts ? [] : proxyServerNameservers;

  const isCommonDns = (dns) => {
    const value = String(dns).trim().toLowerCase();
    if (value === 'system' || value === 'system://') return true;

    return commonDnsRegex.test(value);
  };

  const privateDNS = [
    ...new Set(
      [...(originalDnsConfig['nameserver'] || []), ...privateProxyServerNameservers]
        .map(stripDnsSuffix)
        .filter((dns) => dns.length > 0 && !isCommonDns(dns)),
    ),
  ];

  const matchedProxyPolicy = {};
  for (const [domain, dns] of Object.entries({
    ...originalDnsConfig['nameserver-policy'],
    ...originalDnsConfig['proxy-server-nameserver-policy'],
  })) {
    if (!matchDomainPattern(domain, proxyDomains)) continue;

    const stripedDns = Array.isArray(dns) ? dns.map(stripDnsSuffix).filter((d) => d.length > 0) : stripDnsSuffix(dns);
    if (Array.isArray(stripedDns) && stripedDns.length === 0) continue;

    matchedProxyPolicy[domain] = stripedDns;
  }

  if (privateDNS.length > 0 && Object.keys(matchedProxyPolicy).length === 0) {
    for (const domain of proxyDomains) {
      matchedProxyPolicy[domain] = privateDNS;
    }
  }

  const matchedPolicyDomains = Object.keys(matchedProxyPolicy);
  const proxyServerPolicy =
    proxyDomains.size === matchedPolicyDomains.length &&
    matchedPolicyDomains.every((domain) => proxyDomains.has(domain.toLowerCase()))
      ? simplifyDomainPolicy(matchedProxyPolicy)
      : matchedProxyPolicy;

  const originalFakeIpFilter = originalDnsConfig['fake-ip-filter'] || [];
  const proxyFakeIpFilter = originalFakeIpFilter.filter((pattern) => {
    const p = String(pattern);
    return matchDomainPattern(p, proxyDomains);
  });

  const dns = {
    enable: true,
    ipv6: true,
    'use-hosts': true,
    'cache-algorithm': 'arc',
    'prefer-h3': false,
    'use-system-hosts': true,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/15',
    'fake-ip-range6': '2001:2::1/48',
    'fake-ip-filter': ['rule-set:private', 'rule-set:fakeip_filter', 'rule-set:geolocation-cn', ...proxyFakeIpFilter],
    'default-nameserver': defaultDNS,
    'proxy-server-nameserver': proxyServerDNS,
    ...(Object.keys(proxyServerPolicy).length > 0 && {
      'proxy-server-nameserver-policy': proxyServerPolicy,
    }),
    nameserver: foreignDNS,
    'nameserver-policy': {
      'rule-set:cn': chinaDNS,
    },
    'direct-nameserver': chinaDNS,
  };

  const hosts = {
    'doh.pub': ['1.12.12.12', '120.53.53.53'],
    'cloudflare-dns.com': ['1.1.1.1', '1.0.0.1'],
    'dns.google': ['8.8.8.8', '8.8.4.4'],

    // 解决谷歌商店无法下载的问题
    'services.googleapis.cn': 'services.googleapis.com',

    // 屏蔽哔哩哔哩PCDN，解决访问视频/直播卡顿问题
    '+.mcdn.bilivideo.com': ['0.0.0.0'],
    '+.mcdn.bilivideo.cn': ['0.0.0.0'],
    '+.edge.mountaintoys.cn': ['0.0.0.0'],
    '+.h2.smtcdns.net': ['0.0.0.0'],
  };

  return { dns, hosts, proxies: mappedProxies };
}

// --- proxy-providers 兼容：保留节点信息，脚本接管其余配置 ---

/**
 * 判断输入是否包含 proxy-providers。
 * provider 模式下不尝试在脚本运行期展开远端订阅，而是直接让 Mihomo
 * 通过 include-all/filter 使用 provider 中的节点；这样不会修改或丢失原节点信息。
 */
function hasProxyProviders(config) {
  return !!(
    config &&
    config['proxy-providers'] &&
    typeof config['proxy-providers'] === 'object' &&
    !Array.isArray(config['proxy-providers']) &&
    Object.keys(config['proxy-providers']).length > 0
  );
}

/**
 * provider 模式的地区组。
 * Mihomo 会在运行期从 proxy-providers 中加载节点，因此这里使用 include-all + filter，
 * 不需要脚本读取/下载机场订阅内容。
 */
function getProviderRegionFilter(region) {
  // Mihomo 使用 Go/RE2 正则，不支持 JS 的 lookbehind。
  // 地区识别沿用原 regionDefinitions；倍率识别使用语义等价的 RE2 兼容表达式。
  if (region.name === lowRateRegionName) {
    return '(?i)(?:^|[^0-9])0\\.[0-5](?:倍|[x×*])?(?:$|[^0-9])|(?:^|[^A-Za-z])(?:下载|低倍|免费|free)(?:$|[^A-Za-z])';
  }

  if (region.name === highRateRegionName) {
    return '(?i)(?:^|[^0-9])(?:[2-9]\\d*|1\\d+)(?:\\.\\d+)?(?:倍|[x×*])|(?:^|[^0-9])[*×x]\\s*(?:[2-9]\\d*|1\\d+)(?:\\.\\d+)?';
  }

  return '(?i)' + region.regex.source;
}

function buildProviderRegionGroups() {
  const generateRegionAutoSelectEnabled = ruleOptionsEnable.生成地区自动选择组;
  const generateRateGroupEnabled = ruleOptionsEnable.生成倍率组;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;
  const groups = [];

  for (const region of allRegionDefinitions) {
    if (rateRegionDefinitions.includes(region) && !generateRateGroupEnabled) continue;

    const filter = getProviderRegionFilter(region);

    if (generateRegionAutoSelectEnabled) {
      groups.push({
        ...urlTestBaseOption,
        name: `${region.name}-自动选择`,
        'include-all': true,
        filter,
        'exclude-filter': excludeFilter.source,
        'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
      });
      groups.push({
        ...selectBaseOption,
        name: region.name,
        icon: region.icon,
        'include-all': true,
        filter,
        'exclude-filter': excludeFilter.source,
        'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
        hidden: hideManualSelectGroupEnabled,
      });
    } else {
      groups.push({
        ...selectBaseOption,
        name: region.name,
        icon: region.icon,
        'include-all': true,
        filter,
        'exclude-filter': excludeFilter.source,
        'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
        hidden: hideManualSelectGroupEnabled,
      });
    }
  }

  // Provider 节点无法在脚本执行阶段可靠判断“其他节点”，因此保留一个全量兜底组，
  // 避免因 provider 节点尚未加载而误判为空。
  groups.push({
    ...selectBaseOption,
    name: '其他节点',
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/WorldMap.svg',
    'include-all': true,
    'exclude-filter': excludeFilter.source,
    'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
  });

  return groups;
}

/**
 * provider 模式下让原有基础组直接消费 provider 节点。
 * 仅补充节点来源，不删除原有规则、组结构或功能。
 */
function enableProviderSources(groups, chainGroup) {
  const baseNames = new Set(baseGroups.map((group) => group.name));
  for (const group of groups) {
    if (!group || (!baseNames.has(group.name) && group.name !== '默认代理')) continue;
    group['include-all'] = true;
    group['exclude-filter'] = excludeFilter.source;
    group['exclude-type'] = 'DIRECT|REJECT|REJECT-DROP|PASS';
  }

  if (chainGroup) {
    chainGroup['include-all'] = true;
    chainGroup['exclude-filter'] = excludeFilter.source;
    chainGroup['exclude-type'] = 'DIRECT|REJECT|REJECT-DROP|PASS';
  }
}

// --- 主入口 ---

/**
 * 主入口：覆写机场订阅配置，生成完整 mihomo 配置
 */
function main(config) {
  const providerMode = hasProxyProviders(config);
  const newConfig = {};

  // 普通订阅沿用原有节点标准化流程；provider 配置不下载、不展开、不改写节点。
  const originalProxies = Array.isArray(config.proxies) ? config.proxies : [];
  const filteredProxies = providerMode ? [] : filterAndNormalizeProxies(config);

  const { customProxies, customProxyNames, customGroup } = buildCustomizeGroups(filteredProxies);

  const generatedRegionGroups = ruleOptionsEnable.极简模式
    ? []
    : providerMode
      ? buildProviderRegionGroups()
      : buildRegionGroups(filteredProxies, customProxies);

  const { globalGroup, functionalGroups, functionalRules, finalRuleProviders, chainGroup, directGroup } =
    buildFunctionalGroups(filteredProxies, generatedRegionGroups, { customProxyNames, customGroup });

  if (providerMode) {
    enableProviderSources(functionalGroups, chainGroup);
  }

  const {
    dns,
    hosts,
    proxies: mappedProxies,
  } = buildDnsAndHostsConfig(config, providerMode ? originalProxies : filteredProxies);

  newConfig['dns'] = dns;
  newConfig['hosts'] = hosts;
  newConfig['mixed-port'] = 7890;
  newConfig['allow-lan'] = false;
  newConfig['ipv6'] = true;
  newConfig['mode'] = 'rule';
  newConfig['log-level'] = 'info';
  newConfig['bind-address'] = '127.0.0.1';
  newConfig['unified-delay'] = true;
  newConfig['tcp-concurrent'] = true;
  newConfig['keep-alive-interval'] = 15;
  newConfig['keep-alive-idle'] = 15;
  newConfig['disable-keep-alive'] = false;
  newConfig['find-process-mode'] = 'strict';
  newConfig['etag-support'] = true;
  newConfig['geodata-mode'] = false;
  newConfig['geodata-loader'] = 'memconservative';

  newConfig['external-controller'] = '127.0.0.1:19090';
  newConfig['external-ui'] = 'ui';
  newConfig['external-ui-url'] = 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip';

  newConfig['profile'] = {
    'store-selected': true,
    'store-fake-ip': true,
  };

  newConfig['ntp'] = {
    enable: false,
    'write-to-system': false,
    server: 'ntp.aliyun.com',
    port: 123,
    interval: 30,
  };

  newConfig['tun'] = {
    enable: true,
    stack: 'mips',
    'auto-route': true,
    'strict-route': true,
    'auto-redirect': true,
    'auto-detect-interface': true,
    'dns-hijack': ['any:53', 'tcp://any:53'],
    'udp-timeout': 300,
  };
  newConfig['sniffer'] = {
    enable: true,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    sniff: {
      HTTP: { ports: [80, '8080-8880'], enable: true, 'override-destination': true },
      TLS: { ports: [443, 8443], enable: true, 'override-destination': true },
      QUIC: { ports: [443, 8443], enable: true, 'override-destination': true },
    },
  };

  // 节点信息是唯一不由脚本覆盖的部分：
  // - 原始 proxies 原样保留；
  // - 原始 proxy-providers 原样保留；
  // 脚本只接管其余配置结构。
  newConfig['proxies'] = [...(providerMode ? originalProxies : mappedProxies), ...customProxies, ...directProxies];
  if (providerMode) {
    newConfig['proxy-providers'] = config['proxy-providers'];
  }
  newConfig['proxy-groups'] = [
    globalGroup,
    ...functionalGroups,
    ...(customGroup ? [customGroup] : []),
    ...(chainGroup ? [chainGroup] : []),
    directGroup,
    ...generatedRegionGroups,
  ];
  newConfig['rule-providers'] = finalRuleProviders;

  newConfig['rules'] = [
    ...prefixRules,
    ...blockWebRtcStun,
    ...(ruleOptionsEnable.屏蔽国外QUIC ? blockForeignQuic : []),
    ...functionalRules,

    // 兜底规则
    'RULE-SET,geolocation-!cn,默认代理',
    'RULE-SET,cn_ip,直连',
    'RULE-SET,private_ip,直连',
    `MATCH,${ruleOptionsEnable.极简模式 ? '默认代理' : '漏网之鱼'}`,
  ];

  return newConfig;
}
