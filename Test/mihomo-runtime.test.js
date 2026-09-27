'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { loadScript } = require('./lib/loader');
const fx = require('./lib/fixtures');

const MIHOMO_BIN = process.env.MIHOMO_BIN;
const MIHOMO_VERSION = 'v1.19.31';

if (!MIHOMO_BIN) {
  throw new Error('MIHOMO_BIN is required');
}

if (!fs.existsSync(MIHOMO_BIN)) {
  throw new Error(`mihomo binary not found: ${MIHOMO_BIN}`);
}

const api = loadScript('Script/mihomoScript.js');
const fixture = fx.typicalSubscription();
// The shared fixture intentionally focuses on script behavior and contains a minimal VMess node.
// For kernel-level validation, add the required mihomo cipher field without changing production code.
fixture.proxies = fixture.proxies.map((proxy) =>
  proxy.type === 'vmess' && !proxy.cipher ? { ...proxy, cipher: 'auto' } : proxy,
);
const config = api.main(fixture);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateGeneratedConfig(config, label) {
  assert(config.tun?.enable === true, label + ': TUN must be enabled');
  assert(config.tun?.stack === 'mips', label + ': TUN stack must be mips');
  assert(config.tun?.['strict-route'] === true, label + ': strict-route must be enabled');
  assert(config.tun?.['auto-redirect'] === true, label + ': auto-redirect must be enabled');
  assert(config.tun?.['auto-detect-interface'] === true, label + ': auto-detect-interface must be enabled');
  assert(
    JSON.stringify(config.tun?.['dns-hijack']) === JSON.stringify(['any:53', 'tcp://any:53']),
    label + ': DNS hijack must retain both UDP/TCP 53 entries',
  );
  assert(config.dns?.enable === true, label + ': DNS must be enabled');
  assert(config.dns?.['enhanced-mode'] === 'fake-ip', label + ': fake-ip DNS must be enabled');
  assert(config.sniffer?.enable === true, label + ': sniffer must be enabled');
  assert(
    config.sniffer?.sniff?.HTTP?.['override-destination'] === true,
    label + ': HTTP sniff override must be enabled',
  );
  assert(config.sniffer?.['override-destination'] === false, label + ': global sniff override must remain disabled');

  assert(config['allow-lan'] === false, label + ': LAN access must remain disabled');
  assert(config['bind-address'] === '127.0.0.1', label + ': inbound bind address must remain loopback-only');
  assert(config['external-controller'] === '127.0.0.1:19090', label + ': external controller must stay loopback-only');

  const fallback = config['proxy-groups']?.find((group) => group.name === '故障转移');
  assert(fallback?.type === 'fallback', label + ': 故障转移 must use fallback strategy type');

  const remote = config['proxy-groups']?.find((group) => group.name === '远控工具');
  assert(remote, label + ': 远控工具 group missing');
  assert(
    Array.isArray(remote.proxies) &&
      remote.proxies.includes('REJECT-DROP') &&
      remote.proxies.includes('默认代理') &&
      remote.proxies.includes('直连'),
    label + ': 远控工具 must retain its fixed proxy choices',
  );
  assert(
    config.rules?.includes('PROCESS-NAME-WILDCARD,*AnyDesk*,远控工具') &&
      config.rules?.includes('PROCESS-NAME-WILDCARD,*RustDesk*,远控工具') &&
      config.rules?.includes('PROCESS-NAME-WILDCARD,*tailscale*,远控工具'),
    label + ': remote-control process rules missing',
  );

  const claude = config['proxy-groups']?.find((group) => group.name === 'Claude');
  const aiIndex = config['proxy-groups']?.findIndex((group) => group.name === 'AI');
  const claudeIndex = config['proxy-groups']?.findIndex((group) => group.name === 'Claude');
  assert(claude, label + ': Claude group missing');
  assert(claudeIndex >= 0 && aiIndex >= 0 && claudeIndex < aiIndex, label + ': Claude must precede AI');
  assert(
    config.rules?.includes('DOMAIN-SUFFIX,claude.ai,Claude') &&
      config.rules?.includes('DOMAIN-SUFFIX,anthropic.com,Claude'),
    label + ': Claude rules missing',
  );
}

function loadWithSwitch(name, enabled) {
  return loadScript('Script/mihomoScript.js', (source) => {
    const token = name + ':';
    let changed = false;
    const updated = source
      .split(String.fromCharCode(10))
      .map((line) => {
        const trimmed = line.trimStart();
        if (!trimmed.startsWith(token)) return line;

        const valueStart = line.indexOf(token) + token.length;
        const suffix = line.slice(valueStart);
        const match = suffix.match(/^([ \t]*)(true|false)([ \t]*,)/);
        if (!match) return line;

        changed = true;
        return line.slice(0, valueStart) + match[1] + String(enabled) + match[3] + suffix.slice(match[0].length);
      })
      .join(String.fromCharCode(10));

    if (!changed) {
      throw new Error('switch injection failed: ' + name + '=' + enabled);
    }
    return updated;
  });
}

function assertSwitchChangesConfig(name, enabled, fixtureFactory) {
  const baseConfig = loadScript('Script/mihomoScript.js').main(fixtureFactory());
  const toggleConfig = loadWithSwitch(name, enabled).main(fixtureFactory());
  assert(
    JSON.stringify(baseConfig) !== JSON.stringify(toggleConfig),
    'switch runtime effect missing: ' + name + '=' + enabled,
  );
}

const switchNames = [
  '手动选择',
  '自动选择',
  '负载均衡',
  '故障转移',
  '远控工具',
  'FCM',
  'YouTube',
  'Google',
  'AI',
  'Claude',
  'Microsoft',
  'Apple',
  'Telegram',
  'Steam',
  'TikTok',
  'Twitter',
  'Meta',
  'Line',
  'Netflix',
  'Emby',
  'PikPak',
  'Spotify',
  'Crypto',
  'EHentai',
  'AdBlock',
  '极简模式',
  '生成地区自动选择组',
  '隐藏地区手动选择组',
  '生成倍率组',
  '分流组添加所有节点',
  '过滤低倍率节点',
  '过滤高倍率节点',
  '过滤非地区节点',
  '屏蔽国外QUIC',
  '代理IPV4优先',
  '代理IPV6优先',
  '链式代理',
];

for (const name of switchNames) {
  const enabled = api.ruleOptionsEnable[name];
  assert(typeof enabled === 'boolean', 'switch definition must be boolean: ' + name);
  if (name === '链式代理') {
    const baseConfig = loadScript('Script/mihomoScript.js').main(fx.typicalSubscription());
    const toggleConfig = loadScript('Script/mihomoScript.js', (source) => {
      const enabledSource = source.replace('链式代理: false', '链式代理: true');
      const customSource = enabledSource.replace(
        'const customizeProxies = [];',
        "const customizeProxies = [{ name: '自建-日本-01', type: 'ss', server: '1.2.3.12', port: 443, cipher: 'aes-256-gcm', password: 'x' }];",
      );
      if (customSource === source) {
        throw new Error('chain switch injection failed');
      }
      return customSource;
    }).main(fx.typicalSubscription());
    assert(JSON.stringify(baseConfig) !== JSON.stringify(toggleConfig), 'switch runtime effect missing: 链式代理=true');
    assert(
      toggleConfig['proxy-groups']?.some((group) => group.name === '链式中转'),
      '链式代理=true must generate 链式中转 group',
    );
    continue;
  }
  assertSwitchChangesConfig(name, !enabled, () => fx.typicalSubscription());
}

const serviceSwitchNames = [
  'FCM',
  'YouTube',
  'Google',
  'AI',
  'Claude',
  'Microsoft',
  'Apple',
  'Telegram',
  'Steam',
  'TikTok',
  'Twitter',
  'Meta',
  'Line',
  'Netflix',
  'Emby',
  'PikPak',
  'Spotify',
  'Crypto',
  'EHentai',
  'AdBlock',
  '远控工具',
];

for (const name of serviceSwitchNames) {
  const enabledConfig = api.main(fx.typicalSubscription());
  const disabledConfig = loadWithSwitch(name, false).main(fx.typicalSubscription());
  const enabledGroup = enabledConfig['proxy-groups']?.find((group) => group.name === name);
  const disabledGroup = disabledConfig['proxy-groups']?.find((group) => group.name === name);
  assert(enabledGroup, 'service switch baseline group missing: ' + name);
  assert(!disabledGroup, 'service switch must remove its group: ' + name);

  const enabledRules = enabledConfig.rules || [];
  const disabledRules = disabledConfig.rules || [];
  const serviceRules = enabledRules.filter((rule) => rule.endsWith(',' + name));
  for (const rule of serviceRules) {
    assert(!disabledRules.includes(rule), 'service switch must remove its routing rule: ' + name);
  }

  const enabledProviders = enabledConfig['rule-providers'] || {};
  const disabledProviders = disabledConfig['rule-providers'] || {};
  const groupProviders = Object.keys(enabledProviders).filter((providerName) => {
    const provider = enabledProviders[providerName];
    return serviceRules.some((rule) => rule.includes(',' + providerName + ','));
  });
  for (const providerName of groupProviders) {
    assert(
      !disabledProviders[providerName],
      'service switch must remove its rule-provider: ' + name + '/' + providerName,
    );
  }
}

function loadWithSwitches(overrides) {
  return loadScript('Script/mihomoScript.js', (source) => {
    let updated = source;
    for (const [name, enabled] of Object.entries(overrides)) {
      const token = name + ':';
      let changed = false;
      updated = updated
        .split(String.fromCharCode(10))
        .map((line) => {
          const trimmed = line.trimStart();
          if (!trimmed.startsWith(token)) return line;
          const valueStart = line.indexOf(token) + token.length;
          const suffix = line.slice(valueStart);
          const match = suffix.match(/^([ \t]*)(true|false)([ \t]*,)/);
          if (!match) return line;
          changed = true;
          return line.slice(0, valueStart) + match[1] + String(enabled) + match[3] + suffix.slice(match[0].length);
        })
        .join(String.fromCharCode(10));
      if (!changed) throw new Error('switch injection failed: ' + name);
    }
    return updated;
  });
}

function namesOfGroups(config) {
  return (config['proxy-groups'] || []).map((group) => group.name);
}

function regionFixture() {
  return {
    proxies: [
      { name: '香港-测试', type: 'ss', server: '1.2.3.30', port: 443, cipher: 'aes-256-gcm', password: 'x' },
      { name: '美国-测试', type: 'ss', server: '1.2.3.31', port: 443, cipher: 'aes-256-gcm', password: 'x' },
      { name: '日本-测试', type: 'ss', server: '1.2.3.32', port: 443, cipher: 'aes-256-gcm', password: 'x' },
    ],
  };
}

const ipFixture = {
  proxies: [{ name: 'IPv4-测试', type: 'ss', server: '1.2.3.40', port: 443, cipher: 'aes-256-gcm', password: 'x' }],
};
const ipv4Preferred = loadWithSwitches({ 代理IPV4优先: true, 代理IPV6优先: false }).main(ipFixture);
const ipv6Preferred = loadWithSwitches({ 代理IPV4优先: false, 代理IPV6优先: true }).main(ipFixture);
const bothPreferred = loadWithSwitches({ 代理IPV4优先: true, 代理IPV6优先: true }).main(ipFixture);
assert(
  ipv4Preferred.proxies.find((proxy) => proxy.name.includes('IPv4-测试'))?.['ip-version'] === 'ipv4-prefer',
  'IPv4 preference switch must set ipv4-prefer',
);
assert(
  ipv6Preferred.proxies.find((proxy) => proxy.name.includes('IPv4-测试'))?.['ip-version'] === 'ipv6-prefer',
  'IPv6 preference switch must set ipv6-prefer',
);
assert(
  bothPreferred.proxies.find((proxy) => proxy.name.includes('IPv4-测试'))?.['ip-version'] === undefined,
  'enabling both IP preference switches must leave proxy ip-version unchanged',
);

const landingSubscriptionConfig = loadScript('Script/mihomoScript.js', (source) =>
  source
    .replace('链式代理: false', '链式代理: true')
    .replace("url: '',\n    path: './proxy_providers/hiclash-landing-socks.yaml'", "url: 'https://example.com/landing-socks',\n    path: './proxy_providers/hiclash-landing-socks.yaml'")
    .replace("url: '',\n    path: './proxy_providers/hiclash-landing-http.yaml'", "url: 'https://example.com/landing-http',\n    path: './proxy_providers/hiclash-landing-http.yaml'")
    .replace('const customizeProxies = [];', "const customizeProxies = [{ name: '自建-日本-落地测试', type: 'ss', server: '1.2.3.50', port: 443, cipher: 'aes-256-gcm', password: 'x' }];"),
).main({
  proxies: [
    { name: '香港-落地链测试', type: 'ss', server: '1.2.3.51', port: 443, cipher: 'aes-256-gcm', password: 'x' },
  ],
});
assert(landingSubscriptionConfig['proxy-providers']?.hiclash_landing_socks?.type === 'http', 'SOCKS landing subscription must use an HTTP proxy-provider');
assert(landingSubscriptionConfig['proxy-providers']?.hiclash_landing_http?.type === 'http', 'HTTP landing subscription must use an HTTP proxy-provider');
assert(landingSubscriptionConfig['proxy-providers']?.hiclash_landing_socks?.url === 'https://example.com/landing-socks', 'SOCKS landing subscription URL must be preserved');
assert(landingSubscriptionConfig['proxy-providers']?.hiclash_landing_http?.url === 'https://example.com/landing-http', 'HTTP landing subscription URL must be preserved');
const landingGroupNames = namesOfGroups(landingSubscriptionConfig);
assert(landingGroupNames.includes('落地 SOCKS'), 'SOCKS landing group must be generated');
assert(landingGroupNames.includes('落地 HTTP'), 'HTTP landing group must be generated');
const landingChainGroup = landingSubscriptionConfig['proxy-groups']?.find((group) => group.name === '链式中转');
assert(landingChainGroup?.proxies?.includes('落地 SOCKS'), 'chain group must expose SOCKS landing group');
assert(landingChainGroup?.proxies?.includes('落地 HTTP'), 'chain group must expose HTTP landing group');
const landingNode = landingSubscriptionConfig.proxies.find((proxy) => proxy.name === '自建-日本-落地测试');
assert(landingNode?.['dialer-proxy'] === '链式中转', 'custom landing node must use the chain group as dialer-proxy');

const regionFixtureConfig = api.main(regionFixture());
const regionBaseline = api.main(fx.typicalSubscription());
const regionNoAuto = loadWithSwitches({ 生成地区自动选择组: false }).main(fx.typicalSubscription());
const hkAuto = regionBaseline['proxy-groups']?.find((group) => group.name === '香港-自动选择');
const hkManual = regionBaseline['proxy-groups']?.find((group) => group.name === '香港');
assert(hkAuto?.type === 'url-test', 'region auto baseline: 香港-自动选择 must be url-test');
assert(hkManual?.type === 'select', 'region baseline: 香港 must be select');
assert(!namesOfGroups(regionNoAuto).includes('香港-自动选择'), 'region auto disabled: auto group must be removed');
assert(namesOfGroups(regionNoAuto).includes('香港'), 'region auto disabled: manual region group must remain');
assert(
  regionFixtureConfig['proxy-groups']
    ?.find((group) => group.name === '香港')
    ?.proxies.some((name) => name.includes('香港-测试')),
  'region fixture: 香港 group must contain only its Hong Kong node',
);
assert(
  !regionFixtureConfig['proxy-groups']
    ?.find((group) => group.name === '香港')
    ?.proxies.some((name) => name.includes('美国-测试') || name.includes('日本-测试')),
  'region fixture: 香港 group must not contain other regions',
);
assert(
  regionFixtureConfig['proxy-groups']
    ?.find((group) => group.name === '美国')
    ?.proxies.some((name) => name.includes('美国-测试')),
  'region fixture: 美国 group must contain its US node',
);

const serviceBaseline = api.main(fx.typicalSubscription());

const hiddenRegions = loadWithSwitches({ 隐藏地区手动选择组: true }).main(fx.typicalSubscription());
const hiddenHongKong = hiddenRegions['proxy-groups']?.find((group) => group.name === '香港');
assert(hiddenHongKong?.hidden === true, 'hidden region switch: 香港 group must be hidden');
assert(
  hiddenRegions['proxy-groups']?.some((group) => group.name === '香港-自动选择'),
  'hidden region switch: auto group must remain when region auto selection is enabled',
);

const serviceNodeNames = new Set(
  (serviceBaseline.proxies || [])
    .filter((proxy) => !['direct', 'reject', 'rematch'].includes(String(proxy.type).toLowerCase()))
    .map((proxy) => proxy.name),
);
const serviceDefaultGroups = new Set(
  (serviceBaseline['proxy-groups'] || []).filter((group) => group.type === 'select').map((group) => group.name),
);
const youtubeBaseline = serviceBaseline['proxy-groups']?.find((group) => group.name === 'YouTube');
const appleBaseline = serviceBaseline['proxy-groups']?.find((group) => group.name === 'Apple');
assert(youtubeBaseline?.proxies.includes('默认代理'), 'YouTube must use 默认代理 by default');
assert(
  youtubeBaseline?.proxies.some((name) => serviceDefaultGroups.has(name)),
  'YouTube must expose strategy groups',
);
assert(
  !youtubeBaseline?.proxies.some((name) => serviceNodeNames.has(name)),
  'YouTube must not include all nodes by default',
);
assert(appleBaseline?.proxies.includes('直连'), 'Apple direct service must expose 直连');
const serviceAll = loadWithSwitches({ 分流组添加所有节点: true }).main(fx.typicalSubscription());
const serviceAllYoutube = serviceAll['proxy-groups']?.find((group) => group.name === 'YouTube');
for (const proxyName of serviceNodeNames) {
  assert(serviceAllYoutube?.proxies.includes(proxyName), 'YouTube all-node mode must include node ' + proxyName);
}

const noRateGroups = loadWithSwitches({ 生成倍率组: false }).main(fx.typicalSubscription());
assert(!namesOfGroups(noRateGroups).includes('低倍率节点'), 'rate groups disabled: low-rate group must be removed');
assert(!namesOfGroups(noRateGroups).includes('高倍率节点'), 'rate groups disabled: high-rate group must be removed');

const allNodesInServices = loadWithSwitches({ 分流组添加所有节点: true }).main(fx.typicalSubscription());
const allNodeNames = new Set(
  (allNodesInServices.proxies || [])
    .filter((proxy) => !['direct', 'reject', 'rematch'].includes(String(proxy.type).toLowerCase()))
    .map((proxy) => proxy.name),
);
const youtubeAll = allNodesInServices['proxy-groups']?.find((group) => group.name === 'YouTube');
assert(youtubeAll, 'all-node service switch: YouTube group missing');
for (const proxyName of allNodeNames) {
  assert(youtubeAll.proxies?.includes(proxyName), 'all-node service switch: YouTube must include node ' + proxyName);
}

const rateFixture = () => ({
  proxies: [
    { name: '[0.5x] 节点', type: 'ss', server: '1.2.3.20', port: 443, cipher: 'aes-256-gcm', password: 'x' },
    { name: '[2x] 节点', type: 'ss', server: '1.2.3.21', port: 443, cipher: 'aes-256-gcm', password: 'x' },
    { name: '香港 普通测试', type: 'ss', server: '1.2.3.22', port: 443, cipher: 'aes-256-gcm', password: 'x' },
  ],
});

const lowFiltered = loadWithSwitches({ 过滤低倍率节点: true }).main(rateFixture());
const lowFilteredNames = new Set((lowFiltered.proxies || []).map((proxy) => proxy.name));
assert(
  ![...lowFilteredNames].some((name) => /0\\.3x|0\\.5倍/i.test(name)),
  'low-rate filter must remove low-rate nodes',
);
assert(
  [...lowFilteredNames].some((name) => name.includes('香港 普通测试')),
  'low-rate filter must retain a normal node',
);

const highFiltered = loadWithSwitches({ 过滤高倍率节点: true }).main(rateFixture());
const highFilteredNames = new Set((highFiltered.proxies || []).map((proxy) => proxy.name));
assert(![...highFilteredNames].some((name) => /2x|\\*3/i.test(name)), 'high-rate filter must remove high-rate nodes');
assert(
  [...highFilteredNames].some((name) => name.includes('香港 普通测试')),
  'high-rate filter must retain a normal node',
);

const nonRegionFiltered = api.main(fx.typicalSubscription());
const nonRegionNames = new Set((nonRegionFiltered.proxies || []).map((proxy) => proxy.name));
assert(!nonRegionNames.has('官方网站'), 'non-region filter baseline must remove information node');
assert(!nonRegionNames.has('剩余流量'), 'non-region filter baseline must remove traffic node');
const nonRegionRetained = loadWithSwitches({ 过滤非地区节点: false }).main(fx.typicalSubscription());
const retainedNames = new Set((nonRegionRetained.proxies || []).map((proxy) => proxy.name));
assert(retainedNames.has('官方网站'), 'non-region filter disabled must retain information node');
assert(retainedNames.has('剩余流量'), 'non-region filter disabled must retain traffic node');

const quicBlocked = api.main(fx.typicalSubscription());
const quicAllowed = loadWithSwitches({ 屏蔽国外QUIC: false }).main(fx.typicalSubscription());
for (const rule of [
  'AND,((NETWORK,UDP),(DST-PORT,3478-3497)),REJECT',
  'AND,((NETWORK,UDP),(DST-PORT,5349)),REJECT',
  'AND,((NETWORK,UDP),(DST-PORT,19302-19309)),REJECT',
  'AND,((NETWORK,TCP),(DST-PORT,3478-3497)),REJECT',
  'AND,((NETWORK,TCP),(DST-PORT,5349)),REJECT',
]) {
  assert(quicBlocked.rules.includes(rule), 'QUIC protection baseline missing: ' + rule);
  assert(quicAllowed.rules.includes(rule), 'STUN protection must remain independent of foreign QUIC switch: ' + rule);
}
const foreignQuicRule = quicBlocked.rules.find((rule) => rule.includes('(DST-PORT,443)') && rule.endsWith(',REJECT'));
assert(foreignQuicRule, 'foreign QUIC protection baseline missing');
assert(!quicAllowed.rules.includes(foreignQuicRule), 'foreign QUIC protection disabled must remove its rule');
assert(quicBlocked['rule-providers']?.cn_additional, 'QUIC protection baseline must retain cn_additional provider');
assert(!quicAllowed['rule-providers']?.cn_additional, 'QUIC protection disabled must remove cn_additional provider');

const ipv4Config = loadWithSwitches({ 代理IPV4优先: true }).main(fx.typicalSubscription());
const ipv6Config = loadWithSwitches({ 代理IPV6优先: true }).main(fx.typicalSubscription());
const dualIpConfig = loadWithSwitches({ 代理IPV4优先: true, 代理IPV6优先: true }).main(fx.typicalSubscription());
assert(
  ipv4Config.proxies
    .filter((proxy) => !['direct', 'reject', 'rematch'].includes(String(proxy.type).toLowerCase()))
    .every((proxy) => proxy['ip-version'] === 'ipv4-prefer'),
  'IPv4 preference must set ip-version=ipv4-prefer on every proxy',
);
assert(
  ipv6Config.proxies
    .filter((proxy) => !['direct', 'reject', 'rematch'].includes(String(proxy.type).toLowerCase()))
    .every((proxy) => proxy['ip-version'] === 'ipv6-prefer'),
  'IPv6 preference must set ip-version=ipv6-prefer on every proxy',
);
assert(
  dualIpConfig.proxies
    .filter((proxy) => !['direct', 'reject', 'rematch'].includes(String(proxy.type).toLowerCase()))
    .every((proxy) => !proxy['ip-version']),
  'IPv4 and IPv6 preferences together must leave ip-version unchanged',
);

const rateGroupsEnabled = api.main(rateFixture());
const rateGroupsDisabled = loadWithSwitches({ 生成倍率组: false }).main(rateFixture());
assert(
  rateGroupsEnabled['proxy-groups']?.some((group) => group.name === '低倍率节点'),
  'rate-group switch baseline must generate low-rate group',
);
assert(
  rateGroupsEnabled['proxy-groups']?.some((group) => group.name === '高倍率节点'),
  'rate-group switch baseline must generate high-rate group',
);
assert(
  !rateGroupsDisabled['proxy-groups']?.some(
    (group) => group.name === '低倍率节点' || group.name === '高倍率节点',
  ),
  'rate-group switch disabled must remove generated rate groups',
);

const chainDisabled = loadWithSwitches({ 链式代理: false }).main({
  proxies: [
    {
      name: '自建-日本-链式测试',
      type: 'ss',
      server: '1.2.3.23',
      port: 443,
      cipher: 'aes-256-gcm',
      password: 'x',
    },
  ],
});
assert(
  !chainDisabled['proxy-groups']?.some((group) => group.name === '链式中转'),
  'chain switch disabled must remove chain group',
);

const minimalConfig = loadWithSwitches({ 极简模式: true }).main(fx.typicalSubscription());
const minimalGroupNames = namesOfGroups(minimalConfig);
assert(minimalGroupNames.includes('默认代理'), 'minimal mode must retain 默认代理');
assert(!minimalGroupNames.includes('YouTube'), 'minimal mode must remove service groups');
assert(!minimalGroupNames.includes('香港'), 'minimal mode must remove generated region groups');
for (const serviceName of serviceSwitchNames) {
  assert(
    !minimalConfig.rules.some((rule) => rule.endsWith(',' + serviceName)),
    'minimal mode must remove functional service rule: ' + serviceName,
  );
}
assert(minimalConfig.rules.length > 0, 'minimal mode must retain base/security rules');

const baseGroups = Object.fromEntries(
  ['默认代理', '手动选择', '自动选择', '负载均衡', '故障转移'].map((name) => [
    name,
    config['proxy-groups']?.find((group) => group.name === name),
  ]),
);
assert(baseGroups['默认代理']?.type === 'select', '默认代理 must be a select group');
assert(baseGroups['手动选择']?.type === 'select', '手动选择 must be a select group');
assert(baseGroups['自动选择']?.type === 'url-test', '自动选择 must be a url-test group');
assert(baseGroups['负载均衡']?.type === 'load-balance', '负载均衡 must be a load-balance group');
assert(baseGroups['故障转移']?.type === 'fallback', '故障转移 must be a fallback group');

for (const name of ['默认代理', '手动选择', '自动选择', '负载均衡', '故障转移']) {
  assert(Array.isArray(baseGroups[name]?.proxies), name + ' must have explicit proxy members in node mode');
  assert(
    baseGroups[name].proxies.includes('REJECT-DROP') || baseGroups[name].proxies.length > 0,
    name + ' must not be empty',
  );
}

const proxyNames = new Set(
  (config.proxies || [])
    .filter((proxy) => !['direct', 'reject', 'rematch'].includes(String(proxy.type).toLowerCase()))
    .map((proxy) => proxy.name),
);
const groupNames = new Set((config['proxy-groups'] || []).map((group) => group.name));
const baseNames = ['手动选择', '自动选择', '负载均衡', '故障转移'];
for (const name of baseNames) {
  const members = baseGroups[name].proxies || [];
  for (const member of members) {
    assert(
      proxyNames.has(member) || groupNames.has(member) || ['DIRECT', 'REJECT', 'REJECT-DROP'].includes(member),
      name + ' member must be a node or group: ' + member,
    );
  }
  for (const proxyName of proxyNames) {
    assert(members.includes(proxyName), name + ' must include node ' + proxyName);
  }
  for (const groupName of baseNames) {
    assert(!members.includes(groupName), name + ' must not include base group ' + groupName);
  }
}
assert(
  baseGroups['默认代理'].proxies.some((member) => groupNames.has(member)),
  '默认代理 must expose a strategy group',
);

const autoGroup = baseGroups['自动选择'];
assert(autoGroup.url && Number(autoGroup.interval) > 0, '自动选择 must define a positive health-check interval');
const loadBalance = baseGroups['负载均衡'];
assert(
  ['consistent-hashing', 'round-robin', 'sticky-sessions'].includes(loadBalance.strategy),
  '负载均衡 must use a documented load-balance strategy',
);
const fallback = baseGroups['故障转移'];
assert(fallback['exclude-type'] === 'DIRECT', '故障转移 must exclude DIRECT');

for (const name of baseNames) {
  const members = baseGroups[name].proxies || [];
  for (const member of members) {
    assert(
      proxyNames.has(member) || groupNames.has(member) || ['DIRECT', 'REJECT', 'REJECT-DROP'].includes(member),
      name + ' member must be a node or group: ' + member,
    );
  }
  for (const proxyName of proxyNames) {
    assert(members.includes(proxyName), name + ' must include node ' + proxyName);
  }
  for (const groupName of baseNames) {
    assert(!members.includes(groupName), name + ' must not include base group ' + groupName);
  }
}
assert(
  baseGroups['默认代理'].proxies.some((member) => groupNames.has(member)),
  '默认代理 must expose a strategy group',
);

validateGeneratedConfig(config, 'typical');

const providerConfig = api.main(fx.providerSubscription());
validateGeneratedConfig(providerConfig, 'provider');
assert(providerConfig['proxy-providers']?.provider1, 'provider: provider1 must be retained');
for (const groupName of ['默认代理', '手动选择', '自动选择', '负载均衡', '故障转移']) {
  const group = providerConfig['proxy-groups']?.find((item) => item.name === groupName);
  assert(group, 'provider: ' + groupName + ' group missing');
  assert(
    Array.isArray(group.use) && group.use.includes('provider1'),
    'provider: ' + groupName + ' must consume provider1',
  );
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiclash-mihomo-'));
const configPath = path.join(tempDir, 'config.yaml');

try {
  fs.writeFileSync(configPath, yaml.dump(config, { noRefs: true, lineWidth: -1 }), 'utf8');

  const result = spawnSync(MIHOMO_BIN, ['-t', '-f', configPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });

  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`mihomo ${MIHOMO_VERSION} config validation failed with exit code ${result.status}`);
  }

  console.log(`Mihomo ${MIHOMO_VERSION} runtime config validation passed`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
const globalBaseline = serviceBaseline;
const globalGroup = globalBaseline['proxy-groups']?.find((group) => group.name === 'GLOBAL');
const remoteGroup = globalBaseline['proxy-groups']?.find((group) => group.name === '远控工具');
const fallbackGroup = globalBaseline['proxy-groups']?.find((group) => group.name === '故障转移');
assert(globalGroup?.proxies.includes('默认代理'), 'GLOBAL must expose 默认代理');
assert(globalGroup?.proxies.includes('直连'), 'GLOBAL must expose 直连');
assert(remoteGroup?.proxies?.join(',') === 'REJECT-DROP,默认代理,直连', '远控工具 must use its fixed proxy set');
assert(fallbackGroup?.type === 'fallback', '故障转移 must remain fallback');
assert(fallbackGroup?.['exclude-type'] === 'DIRECT', '故障转移 must exclude DIRECT');
const ruleList = serviceBaseline.rules || [];
const claudeRuleIndex = ruleList.indexOf('DOMAIN-SUFFIX,claude.ai,Claude');
const anthropicRuleIndex = ruleList.indexOf('DOMAIN-SUFFIX,anthropic.com,Claude');
const aiRuleIndex = ruleList.findIndex((rule) => rule.endsWith(',AI'));
assert(claudeRuleIndex >= 0 && anthropicRuleIndex >= 0, 'Claude rules must be present');
assert(claudeRuleIndex < aiRuleIndex && anthropicRuleIndex < aiRuleIndex, 'Claude rules must precede AI routing rules');
for (const rule of [
  'PROCESS-NAME-WILDCARD,*AnyDesk*,远控工具',
  'PROCESS-NAME-WILDCARD,*ToDesk*,远控工具',
  'PROCESS-NAME-WILDCARD,*TeamViewer*,远控工具',
  'PROCESS-NAME-WILDCARD,*RustDesk*,远控工具',
  'PROCESS-NAME-WILDCARD,*tailscale*,远控工具',
  'PROCESS-NAME-WILDCARD,*zerotier*,远控工具',
]) {
  assert(ruleList.includes(rule), 'remote-control process rule missing: ' + rule);
}
assert(ruleList.includes('AND,((NETWORK,UDP),(DST-PORT,3478-3497)),REJECT'), 'STUN UDP protection rule missing');
assert(ruleList.includes('AND,((NETWORK,UDP),(DST-PORT,5349)),REJECT'), 'STUN/TURN UDP protection rule missing');
assert(ruleList.includes('AND,((NETWORK,TCP),(DST-PORT,3478-3497)),REJECT'), 'STUN TCP protection rule missing');
