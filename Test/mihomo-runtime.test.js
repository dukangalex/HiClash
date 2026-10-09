'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { loadScript } = require('./lib/loader');
const fx = require('./lib/fixtures');

const MIHOMO_BIN = process.env.MIHOMO_BIN;
const MIHOMO_VERSION = 'v1.19.32';

if (!MIHOMO_BIN) {
  throw new Error('MIHOMO_BIN is required');
}

if (!fs.existsSync(MIHOMO_BIN)) {
  throw new Error(`mihomo binary not found: ${MIHOMO_BIN}`);
}

const api = loadScript('Script/mihomoScript.js');
const fixture = fx.typicalSubscription();
const config = api.main(fixture);
assert(
  config.proxies.some((proxy) => proxy.type === 'vmess' && proxy.cipher === 'auto'),
  'vmess nodes must gain cipher=auto so mihomo v1.19.32 can parse the profile',
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateGeneratedConfig(config, label) {
  assert(config.tun?.enable === true, label + ': TUN must be enabled');
  assert(config.tun?.stack === 'mips', label + ': TUN stack must be mips');
  assert(config.tun?.['congestion-controller'] === 'bbr', label + ': mips congestion controller must be bbr');
  assert(config.tun?.['strict-route'] === true, label + ': strict-route must be enabled');
  assert(config.tun?.['auto-redirect'] === true, label + ': auto-redirect must be enabled');
  assert(config.tun?.['auto-detect-interface'] === true, label + ': auto-detect-interface must be enabled');
  assert(
    JSON.stringify(config.tun?.['dns-hijack']) === JSON.stringify(['0.0.0.0:53']),
    label + ': DNS hijack must be a single unspecified :53 entry',
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
  assert(Array.isArray(claude.proxies) && claude.proxies.includes('直连'), label + ': Claude must offer DIRECT');
  assert(claude['default-selected'] === '美国', label + ': Claude must default to a US node');
  const claudeRules = [
    'DOMAIN-SUFFIX,anthropic.com,Claude',
    'DOMAIN-SUFFIX,claude.ai,Claude',
    'DOMAIN-SUFFIX,claude.com,Claude',
    'DOMAIN-SUFFIX,claudeusercontent.com,Claude',
    'DOMAIN,anthropic.auth0.com,Claude',
    'DOMAIN,browser-intake-us5-datadoghq.com,Claude',
    'IP-CIDR,160.79.104.0/21,Claude,no-resolve',
    'IP-CIDR6,2607:6bc0::/48,Claude,no-resolve',
    'IP-ASN,399358,Claude,no-resolve',
  ];
  for (const rule of claudeRules) {
    assert(config.rules?.includes(rule), label + ': missing ' + rule);
  }
  assert(
    !config.rules?.some((rule) => rule.includes('http://') || rule.includes('DOMAIN-KEYWORD,datadog')),
    label + ': Claude rules must not keep Surge URLs or broad keywords',
  );
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

// provider 模式：同时覆盖「只有基础组」与「基础组 + 地区组」两种形态，地区组的 exclude-filter 与 filter
// 由 Mihomo 的 regexp2 引擎编译（无法编译会直接 panic），只有真实内核能确认它们可被解析。
const providerRegionConfig = api.main(fx.providerRegionSubscription());
validateGeneratedConfig(providerRegionConfig, 'providerRegion');
assert(
  providerRegionConfig['proxy-groups'].some((group) => group.filter && group['exclude-filter']),
  'providerRegion: expected provider-fed region groups carrying filter + exclude-filter',
);

const SCENARIOS = [
  ['typical', config],
  ['provider', providerConfig],
  ['providerRegion', providerRegionConfig],
];

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiclash-mihomo-'));

try {
  // Fail loudly if CI fetches a different binary than the version this test claims to validate.
  const versionOutput = spawnSync(MIHOMO_BIN, ['-v'], { encoding: 'utf8' }).stdout || '';
  if (!versionOutput.includes(MIHOMO_VERSION)) {
    throw new Error(`expected mihomo ${MIHOMO_VERSION}, binary reports: ${versionOutput.split('\n')[0]}`);
  }

  for (const [label, scenarioConfig] of SCENARIOS) {
    const configPath = path.join(tempDir, label + '.yaml');
    fs.writeFileSync(configPath, yaml.dump(scenarioConfig, { noRefs: true, lineWidth: -1 }), 'utf8');

    const result = spawnSync(MIHOMO_BIN, ['-t', '-f', configPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });

    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`mihomo ${MIHOMO_VERSION} rejected the "${label}" config (exit code ${result.status})`);
    }
    console.log(`  ${label}: accepted by mihomo ${MIHOMO_VERSION}`);
  }

  console.log(`Mihomo ${MIHOMO_VERSION} runtime config validation passed (${SCENARIOS.length} scenarios)`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// Runtime validation is pinned to the official v1.19.32 release binary in CI.
