'use strict';

/**
 * 性能护栏：节点过滤/标准化阶段的开销必须与节点数线性相关，不能每个节点都重建与节点无关的数据。
 * 典型反例：在逐节点循环里调用 getReservedProxyNames()（每次重建 200+ 地区名的 Set），
 * 上千节点时会占掉大半耗时，在客户端常用的 QuickJS 运行时里尤其明显。
 */
const assert = require('node:assert/strict');
const { loadScript } = require('./lib/loader');
const { SCRIPTS } = require('./lib/scripts');

const NODE_COUNT = 500;
const REGIONS = ['香港', '日本', '美国', '新加坡', '台湾', '其他'];

function bigSubscription() {
  const proxies = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    proxies.push({
      name: `${REGIONS[i % REGIONS.length]} ${i}`,
      type: 'ss',
      server: `n${i}.example.com`,
      port: 443,
      cipher: 'aes-256-gcm',
      password: 'x',
    });
  }
  return { proxies };
}

for (const script of SCRIPTS) {
  const scriptPath = script.file;
  const mod = loadScript(
    scriptPath,
    (code) =>
      code.replace('function getReservedProxyNames() {', 'function getReservedProxyNames() {\n  __countReserved();') +
      '\nfunction __countReserved() { module.exports.__calls = (module.exports.__calls || 0) + 1; }',
  );
  const out = mod.main(bigSubscription());
  const calls = mod.__calls || 0;
  assert.ok(out.proxies.length >= NODE_COUNT, `${scriptPath}: all nodes kept`);
  assert.ok(calls > 0, `${scriptPath}: instrumentation did not hook getReservedProxyNames`);
  assert.ok(
    calls <= 4,
    `${scriptPath}: getReservedProxyNames called ${calls} times for ${NODE_COUNT} nodes (expected O(1))`,
  );
}

console.log(`Perf guard tests passed (${SCRIPTS.length} scripts, ${NODE_COUNT} nodes)`);
