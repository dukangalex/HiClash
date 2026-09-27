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

const regionBaseline = api.main(fx.typicalSubscription());
const regionNoAuto = loadWithSwitches({ 生成地区自动选择组: false }).main(fx.typicalSubscription());
const hkAuto = regionBaseline['proxy-groups']?.find((group) => group.name === '香港-自动选择');
const hkManual = regionBaseline['proxy-groups']?.find((group) => group.name === '香港');
assert(hkAuto?.type === 'url-test', 'region auto baseline: 香港-自动选择 must be url-test');
assert(hkManual?.type === 'select', 'region baseline: 香港 must be select');
assert(!namesOfGroups(regionNoAuto).includes('香港-自动选择'), 'region auto disabled: auto group must be removed');
assert(namesOfGroups(regionNoAuto).includes('香港'), 'region auto disabled: manual region group must remain');

const hiddenRegions = loadWithSwitches({ 隐藏地区手动选择组: true }).main(fx.typicalSubscription());
const hiddenHongKong = hiddenRegions['proxy-groups']?.find((group) => group.name === '香港');
assert(hiddenHongKong?.hidden === true, 'hidden region switch: 香港 group must be hidden');
assert(
  hiddenRegions['proxy-groups']?.some((group) => group.name === '香港-自动选择'),
  'hidden region switch: auto group must remain when region auto selection is enabled',
);

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

const rateFixture = () => ({ proxies: [
  { name: '日本 0.3x 测试', type: 'ss', server: '1.2.3.20', port: 443, cipher: 'aes-256-gcm', password: 'x' },
  { name: '美国 2x 测试', type: 'ss', server: '1.2.3.21', port: 443, cipher: 'aes-256-gcm', password: 'x' },
  { name: '香港 普通测试', type: 'ss', server: '1.2.3.22', port: 443, cipher: 'aes-256-gcm', password: 'x' },
] });

const lowFiltered = loadWithSwitches({ 过滤低倍率节点: true }).main(rateFixture());
const lowFilteredNames = new Set((lowFiltered.proxies || []).map((proxy) => proxy.name));
assert(
  ![...lowFilteredNames].some((name) => /0\\.3x|0\\.5倍/i.test(name)),
  'low-rate filter must remove low-rate nodes',
);
assert(lowFilteredNames.has('美国 2x 测试'), 'low-rate filter must retain a high-rate node');

const highFiltered = loadWithSwitches({ 过滤高倍率节点: true }).main(rateFixture());
const highFilteredNames = new Set((highFiltered.proxies || []).map((proxy) => proxy.name));
assert(![...highFilteredNames].some((name) => /2x|\\*3/i.test(name)), 'high-rate filter must remove high-rate nodes');
assert(highFilteredNames.has('日本 0.3x 测试'), 'high-rate filter must retain a low-rate node');

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
  assert(!quicAllowed.rules.includes(rule), 'QUIC protection disabled must remove: ' + rule);
}
assert(quicBlocked['rule-providers']?.cn_additional, 'QUIC protection baseline must retain cn_additional provider');
assert(!quicAllowed['rule-providers']?.cn_additional, 'QUIC protection disabled must remove cn_additional provider');

const ipv4Config = loadWithSwitches({ 代理IPV4优先: true }).main(fx.typicalSubscription());
const ipv6Config = loadWithSwitches({ 代理IPV6优先: true }).main(fx.typicalSubscription());
const dualIpConfig = loadWithSwitches({ 代理IPV4优先: true, 代理IPV6优先: true }).main(fx.typicalSubscription());
assert(
  ipv4Config.proxies.every((proxy) => proxy['ip-version'] === 'ipv4-prefer'),
  'IPv4 preference must set ip-version=ipv4-prefer on every proxy',
);
assert(
  ipv6Config.proxies.every((proxy) => proxy['ip-version'] === 'ipv6-prefer'),
  'IPv6 preference must set ip-version=ipv6-prefer on every proxy',
);
assert(
  dualIpConfig.proxies.every((proxy) => !proxy['ip-version']),
  'IPv4 and IPv6 preferences together must leave ip-version unchanged',
);

const minimalConfig = loadWithSwitches({ 极简模式: true }).main(fx.typicalSubscription());
const minimalGroupNames = namesOfGroups(minimalConfig);
assert(minimalGroupNames.includes('默认代理'), 'minimal mode must retain 默认代理');
assert(!minimalGroupNames.includes('YouTube'), 'minimal mode must remove service groups');
assert(!minimalGroupNames.includes('香港'), 'minimal mode must remove generated region groups');
assert(minimalConfig.rules.length === 0, 'minimal mode must emit no functional routing rules');

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

// Runtime validation is pinned to the official v1.19.31 release binary in CI.
