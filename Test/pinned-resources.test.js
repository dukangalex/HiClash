'use strict';

/**
 * 外部资源的来源与版本约束（脚本输出 + 两份 YAML 模板都要满足）：
 *  - 所有规则集只来自 MetaCubeX 官方 meta-rules-dat，且没有两个 provider 指向同一 URL；
 *  - QUIC 放行规则引用的规则集都已定义，且不再依赖任何第三方/自托管名单；
 *  - 控制台 UI（zashboard）固定到具体版本，而不是 releases/latest。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');

const root = path.join(__dirname, '..');
const OFFICIAL = 'https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/';
const PINNED_UI = /^https:\/\/github\.com\/Zephyruso\/zashboard\/releases\/download\/v\d+\.\d+\.\d+\/dist\.zip$/;

function check(label, config) {
  const providers = config['rule-providers'];
  const urls = Object.values(providers).map((p) => p.url);
  assert.ok(urls.length > 0, label + ': no rule providers');
  assert.equal(new Set(urls).size, urls.length, label + ': two providers share one URL');
  for (const [name, provider] of Object.entries(providers)) {
    assert.ok(
      provider.url.startsWith(OFFICIAL),
      `${label}: ${name} is not an official meta-rules-dat source: ${provider.url}`,
    );
  }

  assert.equal(providers.cn_additional, undefined, label + ': cn_additional must not come back');
  const quic = config.rules.find((r) => r.includes('DST-PORT,443') && r.includes('REJECT'));
  assert.ok(quic, label + ': QUIC rule missing');
  for (const match of quic.matchAll(/RULE-SET,([^,)]+)/g)) {
    assert.ok(providers[match[1]], `${label}: QUIC rule references undefined rule-set ${match[1]}`);
  }

  assert.match(config['external-ui-url'], PINNED_UI, label + ': external-ui-url must be pinned to a version');
}

for (const file of ['Script/mihomoScript.js', 'Script/Script.js']) {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
  check(
    file,
    sandbox.main({
      proxies: [
        { name: 'HK 01', type: 'ss', server: 'a.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' },
      ],
    }),
  );
}
for (const file of ['Config/mihomoConfig.yaml', 'Config/mihomoConfigLite.yaml']) {
  check(file, yaml.load(fs.readFileSync(path.join(root, file), 'utf8')));
}

console.log('Pinned resource tests passed');
