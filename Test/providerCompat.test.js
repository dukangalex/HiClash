const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync(require('path').join(__dirname, '..', 'Script', 'mihomoScriptProvider.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source + '\nthis.__main = main;', sandbox);

const originalProxies = [
  { name: '机场节点-01', type: 'ss', server: 'example.com', port: 443 },
  { name: '🇨🇳 直连 | 双栈', type: 'direct' },
];

const config = {
  proxies: originalProxies,
  'proxy-providers': {
    provider1: { type: 'http', url: 'https://example.com/sub' },
  },
  'proxy-groups': [
    { name: '默认代理', type: 'select', proxies: ['机场节点-01'] },
    { name: '直连', type: 'select', proxies: ['DIRECT'] },
  ],
  rules: ['MATCH,默认代理'],
};

const result = sandbox.__main(config);

assert.deepStrictEqual(result.proxies, originalProxies);
assert.ok(result['proxy-providers'].provider1);
assert.ok(result['proxy-groups'].some(function (group) {
  return group.name === 'HiClash-自动选择' && group.use.indexOf('provider1') !== -1;
}));
assert.ok(result['proxy-groups'].some(function (group) {
  return group.name === 'HiClash-故障转移' && group.use.indexOf('provider1') !== -1;
}));
assert.strictEqual(result.rules[result.rules.length - 1], 'MATCH,默认代理');

console.log('providerCompat: PASS');
