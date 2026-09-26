/**
 * HiClash Provider 兼容层
 *
 * 目标：处理机场/完整配置中已经存在 proxy-providers 的情况。
 * 原始 proxies、proxy-providers、rules、dns、tun、sniffer 等均保留；
 * 仅补充 provider-aware 策略组，避免旧脚本因 proxy-providers 直接报错。
 *
 * 适用于 Mihomo v1.19.31+。
 */

const PROVIDER_EXCLUDE_FILTER =
  '(?i)(群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|电报|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|优惠|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|过滤|⚠️|@|t\\.me\\/\\+|\\bexpire\\b|\\bhttps?:\\/\\/|\\btraffic\\b)';

const REGIONS = [
  ['香港', '(?i)🇭🇰|香港|\\bHK\\b|HKG|hong[\\s_-]*kong'],
  ['台湾', '(?i)🇹🇼|台湾|\\bTW\\b|TWN|taiwan'],
  ['日本', '(?i)🇯🇵|日本|\\bJP\\b|JPN|japan|tokyo|osaka|东京|大阪'],
  ['韩国', '(?i)🇰🇷|韩国|\\bKR\\b|KOR|korea|seoul|首尔'],
  ['新加坡', '(?i)🇸🇬|新加坡|狮城|\\bSG\\b|SGP|singapore'],
  ['美国', '(?i)🇺🇸|美国|\\bUS\\b|USA|america|united[\\s_-]*states|los[\\s_-]*angeles|洛杉矶|san[\\s_-]*jose|圣何塞'],
  ['英国', '(?i)🇬🇧|英国|\\bUK\\b|GBR|united[\\s_-]*kingdom|london|伦敦'],
  ['德国', '(?i)🇩🇪|德国|\\bDE\\b|DEU|germany|frankfurt|法兰克福'],
  ['荷兰', '(?i)🇳🇱|荷兰|\\bNL\\b|NLD|netherlands|amsterdam|阿姆斯特丹'],
  ['法国', '(?i)🇫🇷|法国|\\bFR\\b|FRA|france|paris|巴黎'],
  ['加拿大', '(?i)🇨🇦|加拿大|\\bCA\\b|CAN|canada|toronto|多伦多'],
  ['澳大利亚', '(?i)🇦🇺|澳大利亚|澳洲|\\bAU\\b|AUS|australia|sydney|悉尼|melbourne|墨尔本'],
];

function hasObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function providerNames(config) {
  const providers = config['proxy-providers'];
  return hasObject(providers) ? Object.keys(providers) : [];
}

function cloneArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function isProxyGroupType(type) {
  return type === 'select' || type === 'url-test' || type === 'fallback' || type === 'load-balance';
}

function addGroup(groups, group) {
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].name === group.name) return;
  }
  groups.push(group);
}

function isBuiltInOnlyGroup(group) {
  if (!Array.isArray(group.proxies) || group.proxies.length === 0) return false;
  return group.proxies.every(function (name) {
    return /^(DIRECT|REJECT|REJECT-DROP|PASS|COMPATIBLE)$/i.test(String(name));
  });
}

function main(config) {
  if (!hasObject(config)) throw new Error('HiClash Provider 兼容层：输入配置不是有效对象');

  const names = providerNames(config);
  if (names.length === 0) {
    return config;
  }

  const output = config;
  const groups = cloneArray(output['proxy-groups']);

  // 仅把 provider 注入代理型策略组；原始 proxies、provider、rules 均不删除。
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (!hasObject(group) || !isProxyGroupType(String(group.type || '').toLowerCase())) continue;
    const name = String(group.name || '');
    if (/直连|广告|拦截|拒绝|REJECT|DROP|AdBlock/i.test(name)) continue;
    if (isBuiltInOnlyGroup(group)) continue;
    if (group.use || group['include-all'] || group['include-all-providers']) continue;

    group.use = names.slice();
    group['exclude-filter'] = group['exclude-filter'] || PROVIDER_EXCLUDE_FILTER;
    if (group.type !== 'select' && group['exclude-type'] == null) {
      group['exclude-type'] = 'DIRECT|REJECT|REJECT-DROP|PASS';
    }
  }

  addGroup(groups, {
    name: 'HiClash-全部节点',
    type: 'select',
    use: names.slice(),
    'exclude-filter': PROVIDER_EXCLUDE_FILTER,
    'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Global.svg',
  });

  addGroup(groups, {
    name: 'HiClash-自动选择',
    type: 'url-test',
    use: names.slice(),
    'exclude-filter': PROVIDER_EXCLUDE_FILTER,
    'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
    url: 'https://www.gstatic.com/generate_204',
    interval: 300,
    tolerance: 50,
    lazy: true,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Auto.svg',
  });

  addGroup(groups, {
    name: 'HiClash-故障转移',
    type: 'fallback',
    use: names.slice(),
    'exclude-filter': PROVIDER_EXCLUDE_FILTER,
    'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
    url: 'https://www.gstatic.com/generate_204',
    interval: 300,
    lazy: true,
    'max-failed-times': 3,
    timeout: 3000,
    'empty-fallback': 'REJECT',
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Auto.svg',
  });

  for (let i = 0; i < REGIONS.length; i++) {
    const item = REGIONS[i];
    const region = item[0];
    const filter = item[1];

    addGroup(groups, {
      name: 'HiClash-' + region,
      type: 'select',
      use: names.slice(),
      filter: filter,
      'exclude-filter': PROVIDER_EXCLUDE_FILTER,
      'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
      icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/WorldMap.svg',
    });

    addGroup(groups, {
      name: 'HiClash-' + region + '-自动选择',
      type: 'url-test',
      use: names.slice(),
      filter: filter,
      'exclude-filter': PROVIDER_EXCLUDE_FILTER,
      'exclude-type': 'DIRECT|REJECT|REJECT-DROP|PASS',
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      lazy: true,
      icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@main/Icons/svg/Auto.svg',
    });
  }

  // 没有规则时才添加兜底规则；已有规则保持原样，避免改变机场原始路由契约。
  if (!Array.isArray(output.rules)) {
    output.rules = ['MATCH,HiClash-自动选择'];
  } else {
    let hasMatch = false;
    for (let i = 0; i < output.rules.length; i++) {
      if (/^MATCH,/i.test(String(output.rules[i]))) {
        hasMatch = true;
        break;
      }
    }
    if (!hasMatch) output.rules = output.rules.concat(['MATCH,HiClash-自动选择']);
  }

  output['proxy-groups'] = groups;
  return output;
}
