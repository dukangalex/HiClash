'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScript() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'Script', 'mihomoScript.js'), 'utf8');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'mihomoScript.js' });
  assert.equal(typeof sandbox.main, 'function');
  return sandbox;
}

function loadMain() {
  return loadScript().main;
}

function baseConfig() {
  return { proxies: [] };
}

test('script keeps built-in defaults when no custom options are supplied', () => {
  const main = loadMain();
  const output = main(baseConfig());
  assert.ok(Array.isArray(output['proxy-groups']));
  assert.ok(output['proxy-groups'].some((group) => group.name === 'AI'));
  const fallback = output['proxy-groups'].find((group) => group.name === '漏网之鱼');
  assert.equal(fallback?.['default-selected'], '默认代理');
  const rules = output.rules;
  const privateIndex = rules.indexOf('RULE-SET,private,直连');
  const foreignIndex = rules.indexOf('RULE-SET,geolocation-!cn,默认代理');
  const cnIpIndex = rules.indexOf('RULE-SET,cn_ip,直连');
  const fallbackIndex = rules.findIndex((rule) => rule.startsWith('MATCH,'));
  assert.ok(privateIndex >= 0 && foreignIndex >= 0 && cnIpIndex >= 0 && fallbackIndex >= 0);
  assert.ok(privateIndex < foreignIndex);
  assert.ok(foreignIndex < cnIpIndex);
  assert.ok(cnIpIndex < fallbackIndex);
});

test('provider mode preserves visible region groups and binds them to providers', () => {
  const main = loadMain();
  const output = main({
    proxies: [{ name: '🇺🇸 US 01', type: 'direct' }],
    'proxy-providers': {
      airport: { type: 'http', url: 'https://example.com/sub.yaml', path: './airport.yaml' },
    },
  });

  const region = output['proxy-groups'].find((group) => group.name === '美国');
  const auto = output['proxy-groups'].find((group) => group.name === '美国-自动选择');
  assert.ok(region);
  assert.ok(auto);
  assert.deepEqual(region.use, ['airport']);
  assert.deepEqual(auto.use, ['airport']);
  assert.equal(region['include-all'], true);
  assert.equal(auto['include-all'], true);
  assert.equal(
    region.filter,
    '(?i)' +
      '🇺🇸|美国|(?:^|[^A-Za-z])US(?:$|[^A-Za-z])|(?:^|[^A-Za-z])USA(?:$|[^A-Za-z])|america|united[\\s_-]*states|los[\\s_-]*angeles|洛杉矶|san[\\s_-]*jose|圣何塞',
  );
});

test('script accepts generic custom options through the optional adapter context', () => {
  const main = loadMain();
  const output = main(baseConfig(), {
    customOptions: {
      AI: false,
      链式代理: false,
    },
  });

  assert.ok(!output['proxy-groups'].some((group) => group.name === 'AI'));
});

test('script applies host-side ruleOptionsEnable overrides before main()', () => {
  const sandbox = loadScript();
  assert.deepEqual(sandbox.HiClash_CustomOptions, {
    version: 1,
    type: 'toggle-map',
    source: 'ruleOptionsEnable',
  });

  // Bettbox's verified runtime path mutates ruleOptionsEnable after loading the script
  // and then invokes main(config). This test reproduces that exact ordering.
  sandbox.ruleOptionsEnable.AI = false;
  const output = sandbox.main(baseConfig());

  assert.ok(!output['proxy-groups'].some((group) => group.name === 'AI'));
});

test('script rejects unknown custom options', () => {
  const main = loadMain();
  assert.throws(() => main(baseConfig(), { customOptions: { NotARealOption: false } }), /unknown custom option/);
});

test('script rejects non-boolean custom options', () => {
  const main = loadMain();
  assert.throws(() => main(baseConfig(), { customOptions: { AI: 'false' } }), /must be boolean/);
});
