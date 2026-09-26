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
