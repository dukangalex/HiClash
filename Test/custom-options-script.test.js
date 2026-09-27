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
