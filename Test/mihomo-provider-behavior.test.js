'use strict';

/**
 * 端到端：让真实 Mihomo 执行脚本生成的 provider 模式 filter / exclude-filter，
 * 再通过 API 读出每个组最终留下了哪些节点。
 * 单元测试只能证明「正则能编译、在 JS 里表现如预期」；regexp2 引擎的实际行为只有内核说了算。
 *
 *   MIHOMO_BIN=/path/to/mihomo node Test/mihomo-provider-behavior.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { loadScript } = require('./lib/loader');
const fx = require('./lib/fixtures');

const MIHOMO_BIN = process.env.MIHOMO_BIN;
if (!MIHOMO_BIN || !fs.existsSync(MIHOMO_BIN)) throw new Error('MIHOMO_BIN must point to a mihomo binary');

const INFO = ['剩余流量：120.5 GB', '客服 TG @xxx', '套餐到期：2026-12-31', 'Traffic: 100 GB'];
const WEAK_ONLY_INFO = ['使用说明', '备用域名', '邀请好友'];
const LEGIT_WEAK = ['日本 支持 Netflix', '香港 备用 01', '美国 使用 IEPL'];
const PLAIN = ['🇭🇰 香港 02', '日本 东京 03'];

const dummy = (name) => ({ name, type: 'socks5', server: '203.0.113.1', port: 1080 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildConfig(dir, port, customOptions) {
  const api = loadScript('Script/mihomoScript.js');
  const output = api.main(fx.providerRegionSubscription(), { customOptions });
  const providerFile = path.join(dir, 'provider1.yaml');
  fs.writeFileSync(
    providerFile,
    yaml.dump({ proxies: [...INFO, ...WEAK_ONLY_INFO, ...LEGIT_WEAK, ...PLAIN].map(dummy) }),
    'utf8',
  );
  // 只保留与 provider 过滤相关的部分：策略组 + provider，避免依赖 Geo 数据。
  return {
    'mixed-port': port + 1,
    'external-controller': '127.0.0.1:' + port,
    secret: 'probe',
    proxies: output.proxies,
    'proxy-providers': { provider1: { type: 'file', path: providerFile } },
    'proxy-groups': output['proxy-groups'],
    rules: ['MATCH,默认代理'],
  };
}

async function groupMembers(customOptions, port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiclash-behavior-'));
  const config = buildConfig(dir, port, customOptions);
  fs.writeFileSync(path.join(dir, 'config.yaml'), yaml.dump(config, { noRefs: true, lineWidth: -1 }), 'utf8');
  const child = spawn(MIHOMO_BIN, ['-d', dir, '-f', path.join(dir, 'config.yaml')], { stdio: 'ignore' });
  try {
    let proxies;
    for (let attempt = 0; attempt < 40 && !proxies; attempt += 1) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/proxies`, { headers: { Authorization: 'Bearer probe' } });
        if (res.ok) proxies = (await res.json()).proxies;
      } catch (_) {
        /* core not up yet */
      }
    }
    assert.ok(proxies, 'mihomo did not start (config rejected?)');
    return Object.fromEntries(Object.entries(proxies).map(([name, p]) => [name, p.all || []]));
  } finally {
    child.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

(async () => {
  const version = spawnSync(MIHOMO_BIN, ['-v'], { encoding: 'utf8' }).stdout || '';
  assert.ok(/v1\.19\./.test(version), 'unexpected mihomo version: ' + version.split('\n')[0]);

  const on = await groupMembers({}, 19400);
  const has = (group, name) => (on[group] || []).includes(name);

  // 基础组：强信息词一律排除；弱词只在「没有地区特征」时排除；带地区特征的正常节点保留。
  for (const group of ['默认代理', '手动选择']) {
    assert.ok(on[group], `group ${group} missing`);
    for (const name of [...INFO, ...WEAK_ONLY_INFO])
      assert.equal(has(group, name), false, `${group} must exclude ${name}`);
    for (const name of [...LEGIT_WEAK, ...PLAIN]) assert.equal(has(group, name), true, `${group} must keep ${name}`);
  }

  // 地区组：节点被地区正则选中后，只排除强信息词。
  const hk = Object.keys(on).find((name) => name === '香港');
  const jp = Object.keys(on).find((name) => name === '日本');
  assert.ok(hk && jp, 'region groups 香港 / 日本 missing: ' + Object.keys(on).join(','));
  for (const name of INFO) {
    assert.equal(has(hk, name), false, `香港 must exclude ${name}`);
    assert.equal(has(jp, name), false, `日本 must exclude ${name}`);
  }
  assert.equal(has(hk, '香港 备用 01'), true, '香港 must keep 香港 备用 01 (region wins over weak words)');
  assert.equal(has(jp, '日本 支持 Netflix'), true, '日本 must keep 日本 支持 Netflix');

  // 关闭「过滤非地区节点」：内核不再过滤任何节点（包括信息节点）。
  const off = await groupMembers({ 过滤非地区节点: false }, 19410);
  for (const name of [...INFO, ...WEAK_ONLY_INFO]) {
    assert.equal((off['手动选择'] || []).includes(name), true, `with filtering off, 手动选择 should include ${name}`);
  }

  console.log('Mihomo provider behavior tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
