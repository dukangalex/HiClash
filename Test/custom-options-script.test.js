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
  return {
    proxies: [{ name: '🇯🇵 JP 01', type: 'vmess', server: 'example.com', port: 443 }],
  };
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
    proxies: [{ name: '🇺🇸 US 01', type: 'vmess', server: 'example.com', port: 443 }],
    'proxy-providers': {
      airport: { type: 'http', url: 'https://example.com/sub.yaml', path: './airport.yaml' },
    },
  });

  const region = output['proxy-groups'].find((group) => group.name === '美国');
  const auto = output['proxy-groups'].find((group) => group.name === '美国-自动选择');
  assert.ok(region);
  assert.ok(auto);
  assert.deepEqual(Array.from(region.use), ['airport']);
  assert.deepEqual(Array.from(auto.use), ['airport']);
  assert.equal(region['include-all'], true);
  assert.equal(auto['include-all'], true);
  assert.equal(
    region.filter,
    '(?i)' +
      '🇺🇸|美国|(?:^|[^A-Za-z])US(?:$|[^A-Za-z])|(?:^|[^A-Za-z])USA(?:$|[^A-Za-z])|america|united[\\s_-]*states|los[\\s_-]*angeles|洛杉矶|san[\\s_-]*jose|圣何塞',
  );
});

test('provider-only mode keeps proxy-group references closed', () => {
  const main = loadMain();
  const output = main({
    'proxy-providers': {
      airport: { type: 'http', url: 'https://example.com/sub.yaml', path: './airport.yaml' },
    },
  });

  const groupNames = new Set(output['proxy-groups'].map((group) => group.name));
  const proxyNames = new Set(output.proxies.map((proxy) => proxy.name));
  const builtIns = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']);

  for (const group of output['proxy-groups']) {
    for (const reference of group.proxies || []) {
      assert.ok(
        groupNames.has(reference) || proxyNames.has(reference) || builtIns.has(reference),
        group.name + ' contains unresolved proxy/group reference: ' + reference,
      );
    }
    for (const providerName of group.use || []) {
      assert.ok(output['proxy-providers'][providerName], group.name + ' references missing provider: ' + providerName);
    }
  }
});

test('provider mode keeps mixed visible/provider group references closed', () => {
  const main = loadMain();
  const output = main({
    proxies: [{ name: '🇺🇸 US 01', type: 'vmess', server: 'example.com', port: 443 }],
    'proxy-providers': {
      airport: { type: 'http', url: 'https://example.com/sub.yaml', path: './airport.yaml' },
      backup: { type: 'http', url: 'https://example.com/sub2.yaml', path: './backup.yaml' },
    },
  });

  const groupNames = new Set(output['proxy-groups'].map((group) => group.name));
  const proxyNames = new Set(output.proxies.map((proxy) => proxy.name));
  const builtIns = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']);

  for (const group of output['proxy-groups']) {
    for (const reference of group.proxies || []) {
      assert.ok(
        groupNames.has(reference) || proxyNames.has(reference) || builtIns.has(reference),
        group.name + ' contains unresolved proxy/group reference: ' + reference,
      );
    }
    for (const providerName of group.use || []) {
      assert.ok(output['proxy-providers'][providerName], group.name + ' references missing provider: ' + providerName);
    }
  }
});

test('provider-only mode supplies provider sources to core strategy groups', () => {
  const main = loadMain();
  const output = main({
    'proxy-providers': {
      airport: { type: 'http', url: 'https://example.com/sub.yaml', path: './airport.yaml' },
    },
  });

  for (const name of ['默认代理', '手动选择', '自动选择', '负载均衡', '故障转移']) {
    const group = output['proxy-groups'].find((item) => item.name === name);
    assert.ok(group, 'missing core strategy group: ' + name);
    assert.equal(group['include-all'], true, name + ' should include provider nodes');
    assert.deepEqual(Array.from(group.use || []), ['airport']);
  }
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
  // Bettbox's verified runtime path mutates ruleOptionsEnable after loading the script
  // and then invokes main(config). Execute that mutation in the same VM lexical scope.
  const output = vm.runInContext('ruleOptionsEnable.AI = false; main(' + JSON.stringify(baseConfig()) + ')', sandbox);

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
