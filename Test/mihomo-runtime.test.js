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
