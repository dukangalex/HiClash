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
  assert.equal(region['include-all'], undefined);
  assert.equal(auto['include-all'], undefined);
  // Behaviour, not a byte-for-byte snapshot: Mihomo evaluates this filter at runtime.
  assert.ok(region.filter.startsWith('(?i)'));
  const re = new RegExp(region.filter.slice(4), 'i');
  for (const hit of ['🇺🇸 US 01', '美国 洛杉矶', '美國 矽谷', '纽约 04']) assert.ok(re.test(hit), hit);
  for (const miss of ['日本 东京', '🇭🇰 香港 01']) assert.equal(re.test(miss), false, miss);
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
    assert.equal(group['include-all'], undefined, name + ' must not mix all outbound proxies into provider mode');
    assert.deepEqual(Array.from(group.use || []), ['airport']);
  }
});

test('script preserves dialer-proxy when the target node is renamed for a reserved name', () => {
  const main = loadMain();
  const output = main({
    proxies: [
      {
        name: '默认代理',
        type: 'socks',
        server: 'landing.example',
        port: 1080,
      },
      {
        name: '🇺🇸 US 01',
        type: 'socks',
        server: 'front.example',
        port: 443,
        'dialer-proxy': '默认代理',
      },
    ],
  });

  const renamedLanding = output.proxies.find((proxy) => proxy.name === '节点-默认代理');
  const front = output.proxies.find((proxy) => proxy.name === '🇺🇸 US 01');

  assert.ok(renamedLanding);
  assert.equal(front?.['dialer-proxy'], '节点-默认代理');
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
  // The host-side runtime may mutate ruleOptionsEnable after loading the script,
  // then invoke main(config). Execute that mutation in the same VM lexical scope.
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

test('both scripts pass through a client-supplied controller secret', () => {
  for (const file of ['mihomoScript.js', 'Script.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Script', file), 'utf8');
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: file });

    assert.equal(sandbox.main({ ...baseConfig(), secret: 's3cret' }).secret, 's3cret', file);
    assert.equal('secret' in sandbox.main(baseConfig()), false, file + ': no secret invented');
    assert.equal('secret' in sandbox.main({ ...baseConfig(), secret: '' }), false, file + ': empty not emitted');
  }
});

test('both scripts keep client ports/loopback controller but never relax the security baseline', () => {
  for (const file of ['mihomoScript.js', 'Script.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Script', file), 'utf8');
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: file });
    const run = (extra) => sandbox.main({ ...baseConfig(), ...extra });

    assert.equal(run({ 'external-controller': '127.0.0.1:9097' })['external-controller'], '127.0.0.1:9097', file);
    assert.equal(run({ 'external-controller': 'localhost:9090' })['external-controller'], 'localhost:9090', file);
    for (const bad of ['0.0.0.0:9097', '192.168.1.5:9097', '127.0.0.1:99999', 'example.com:9090']) {
      assert.equal(run({ 'external-controller': bad })['external-controller'], '127.0.0.1:19090', file + ' ' + bad);
    }
    assert.equal(run({ 'mixed-port': 7899 })['mixed-port'], 7899, file);
    assert.equal(run({ 'mixed-port': 'abc' })['mixed-port'], 7890, file);
    assert.equal(run({ 'allow-lan': true })['allow-lan'], false, file);
  }
});

test('traffic/expiry info entries containing "GB" are not mistaken for UK nodes', () => {
  for (const file of ['mihomoScript.js', 'Script.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Script', file), 'utf8');
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: file });
    const mk = (name, i) => ({
      name,
      type: 'ss',
      server: 'h' + i + '.example.com',
      port: 443,
      cipher: 'aes-128-gcm',
      password: 'x',
    });
    const info = ['剩余流量：120GB', '已用流量：35.2GB', '总流量 500GB', 'Traffic: 80GB left'];
    const real = ['🇬🇧 英国 01', 'GB-London 02', 'GB 03', 'Node-GB'];
    const out = sandbox.main({
      proxies: [mk('🇭🇰 香港 01', 0), ...real.map((n, i) => mk(n, i + 1)), ...info.map((n, i) => mk(n, i + 10))],
    });
    const names = out.proxies.map((proxy) => proxy.name);
    for (const n of info)
      assert.equal(
        names.some((k) => k.includes(n)),
        false,
        file + ' leaked: ' + n,
      );
    for (const n of real)
      assert.equal(
        names.some((k) => k.includes(n.replace(/^🇬🇧 /, ''))),
        true,
        file + ' lost: ' + n,
      );
  }
});

test('屏蔽WebRTC toggles the STUN block rules and defaults to on', () => {
  const main = loadMain();
  const hasStun = (rules) => rules.some((rule) => rule.includes('3478-3497'));
  assert.equal(hasStun(main(baseConfig()).rules), true);
  assert.equal(hasStun(main(baseConfig(), { customOptions: { 屏蔽WebRTC: false } }).rules), false);
  assert.equal(hasStun(main(baseConfig(), { customOptions: { 屏蔽WebRTC: true } }).rules), true);
});

function groupsContaining(output, server) {
  const proxy = output.proxies.find((p) => p.server === server);
  if (!proxy) return null;
  return output['proxy-groups'].filter((g) => (g.proxies || []).includes(proxy.name)).map((g) => g.name);
}

test('airport info nodes are excluded even when their text collides with a region abbreviation', () => {
  for (const file of ['mihomoScript.js', 'Script.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Script', file), 'utf8');
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: file });
    const build = (name) =>
      sandbox.main({
        proxies: [
          {
            name: '🇭🇰 香港 SENTINEL',
            type: 'ss',
            server: 's.example.com',
            port: 443,
            cipher: 'aes-128-gcm',
            password: 'x',
          },
          { name, type: 'ss', server: 'x.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
        ],
      });

    // "GB" -> United Kingdom, "TG" -> Togo used to turn these into fake countries.
    for (const info of ['剩余流量：120.5 GB', '客服 TG @xxx', '套餐到期：2026-12-31', 'Traffic: 100 GB']) {
      assert.equal(groupsContaining(build(info), 'x.example.com'), null, `${file}: ${info} should be excluded`);
    }
    // Weak words / "流量" without a colon must not knock out legitimate nodes.
    for (const [name, group] of [
      ['香港 使用 01', '香港'],
      ['日本 支持 Netflix', '日本'],
      ['香港 不限流量 01', '香港'],
    ]) {
      assert.ok(groupsContaining(build(name), 'x.example.com').includes(group), `${file}: ${name}`);
    }
  }
});

test('traditional-Chinese and city names are recognised as their region', () => {
  for (const file of ['mihomoScript.js', 'Script.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Script', file), 'utf8');
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: file });
    const cases = [
      ['台灣 HiNet 02', '台湾'],
      ['臺灣 03', '台湾'],
      ['台北 家宽', '台湾'],
      ['美國 矽谷', '美国'],
      ['纽约 04', '美国'],
      ['韓國 首爾 01', '韩国'],
      ['俄羅斯 莫斯科', '俄罗斯'],
    ];
    for (const [name, region] of cases) {
      const out = sandbox.main({
        proxies: [
          {
            name: '🇭🇰 香港 SENTINEL',
            type: 'ss',
            server: 's.example.com',
            port: 443,
            cipher: 'aes-128-gcm',
            password: 'x',
          },
          { name, type: 'ss', server: 'x.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
        ],
      });
      assert.ok(groupsContaining(out, 'x.example.com').includes(region), `${file}: ${name} -> ${region}`);
    }
  }
});
