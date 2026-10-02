'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');

const root = path.join(__dirname, '..');
const listPath = path.join(root, 'Rules', 'cn-additional-list.txt');
const raw = fs.readFileSync(listPath, 'utf8');
const lines = raw.split('\n').filter((line) => line !== '');

// Source list: LF endings, "+.domain" suffix entries only, sorted (LC_ALL=C) and unique, no TLD-wide entries.
assert.ok(!raw.includes('\r'), 'CRLF found; use LF line endings');
assert.ok(lines.length > 1000, 'cn-additional-list.txt looks truncated');
assert.equal(new Set(lines).size, lines.length, 'duplicate entries');
assert.deepEqual(lines, [...lines].sort(), 'list must stay sorted (LC_ALL=C sort -u)');
for (const line of lines) {
  assert.match(line, /^\+\.[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'bad entry: ' + line);
}
assert.ok(fs.statSync(path.join(root, 'Rules', 'cn-additional-list.mrs')).size > 1000, 'mrs missing or empty');

// Every config must reference a file that really exists in this repo (jsDelivr serves it once merged to main).
const SELF_HOSTED = /^https:\/\/fastly\.jsdelivr\.net\/gh\/dukangalex\/HiClash@main\/(Rules\/[^/]+\.mrs)$/;
function checkProvider(label, provider) {
  assert.ok(provider, label + ': cn_additional provider missing');
  const match = SELF_HOSTED.exec(provider.url);
  assert.ok(match, label + ': cn_additional must be self-hosted in this repo, got ' + provider.url);
  assert.ok(fs.existsSync(path.join(root, match[1])), label + ': referenced file not in repo: ' + match[1]);
  // No bundled copy exists for a self-hosted list; a stale path-in-bundle would load the wrong data.
  assert.equal(provider['path-in-bundle'], undefined, label + ': must not set path-in-bundle');
}

const QUIC_SETS = ['cn', 'cn_additional', 'cn_ip'];
function checkQuicRule(label, rules, providers) {
  const quic = rules.find((r) => r.includes('DST-PORT,443') && r.includes('REJECT'));
  assert.ok(quic, label + ': QUIC rule missing');
  for (const name of QUIC_SETS) {
    assert.ok(quic.includes('RULE-SET,' + name), label + ': QUIC rule must reference ' + name);
    assert.ok(providers[name], label + ': QUIC rule references undefined rule-set ' + name);
  }
}

for (const file of ['Script/mihomoScript.js', 'Script/Script.js']) {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
  const out = sandbox.main({
    proxies: [{ name: 'HK 01', type: 'ss', server: 'a.example.com', port: 443, cipher: 'aes-128-gcm', password: 'x' }],
  });
  checkProvider(file, out['rule-providers'].cn_additional);
  assert.match(
    out['external-ui-url'],
    /\/releases\/download\/v[\d.]+\/dist\.zip$/,
    file + ': external-ui-url must be pinned to a version',
  );
  checkQuicRule(file, out.rules, out['rule-providers']);
}
for (const file of ['Config/mihomoConfig.yaml', 'Config/mihomoConfigLite.yaml']) {
  const config = yaml.load(fs.readFileSync(path.join(root, file), 'utf8'));
  assert.match(
    config['external-ui-url'],
    /\/releases\/download\/v[\d.]+\/dist\.zip$/,
    file + ': external-ui-url must be pinned to a version',
  );
  checkProvider(file, config['rule-providers'].cn_additional);
  checkQuicRule(file, config.rules, config['rule-providers']);
}

console.log('Rules file tests passed');
