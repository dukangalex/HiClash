'use strict';

/**
 * 输出快照：固定输入下，两份覆写脚本生成的完整配置必须保持不变。
 * 目的是给「抽取共享块 / 重构 / 换 URL」这类不应改变行为的修改一张安全网。
 *
 * 快照只存 SHA-256（完整输出每份 100KB+），所以失败时只会告诉你哪个场景变了。
 * 若变化是有意的，请先人工确认差异，再执行：
 *   UPDATE_GOLDEN=1 node Test/golden-output.test.js
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadScript } = require('./lib/loader');
const fx = require('./lib/fixtures');
const { SCRIPTS } = require('./lib/scripts');

const GOLDEN_PATH = path.join(__dirname, 'golden-output.json');

const FIXTURES = {
  typical: fx.typicalSubscription,
  provider: fx.providerSubscription,
  providerRegion: fx.providerRegionSubscription,
  minimal: fx.minimalSubscription,
  hostsMapped: fx.hostsMappedSubscription,
};

const OPTION_SETS = {
  default: {},
  'quic-off': { 屏蔽国外QUIC: false },
  'ai-off': { AI: false },
};

/** 键排序后序列化：键的书写顺序变化不算输出变化，数组顺序变化算。 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function hashOf(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function collect() {
  const result = {};
  for (const script of SCRIPTS) {
    const api = loadScript(script.file);
    for (const [fixtureName, makeFixture] of Object.entries(FIXTURES)) {
      for (const [optionName, patch] of Object.entries(OPTION_SETS)) {
        const saved = {};
        for (const key of Object.keys(patch)) {
          saved[key] = api.ruleOptionsEnable[key];
          api.ruleOptionsEnable[key] = patch[key];
        }
        try {
          result[`${script.file}|${fixtureName}|${optionName}`] = hashOf(api.main(makeFixture()));
        } finally {
          for (const key of Object.keys(patch)) api.ruleOptionsEnable[key] = saved[key];
        }
      }
    }
  }
  return result;
}

const actual = collect();

if (process.env.UPDATE_GOLDEN === '1') {
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(actual, null, 2) + '\n', 'utf8');
  console.log('golden snapshot updated (' + Object.keys(actual).length + ' scenarios)');
} else {
  const expected = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), 'scenario set changed');
  const changed = Object.keys(actual).filter((key) => actual[key] !== expected[key]);
  assert.equal(
    changed.length,
    0,
    'output changed in ' +
      changed.length +
      ' scenario(s):\n  ' +
      changed.join('\n  ') +
      '\nIf intended, review the diff and run: UPDATE_GOLDEN=1 node Test/golden-output.test.js',
  );
  console.log('Golden output tests passed (' + Object.keys(actual).length + ' scenarios)');
}
