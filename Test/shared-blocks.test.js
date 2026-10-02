'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { syncAll, SCRIPTS } = require('../Script/tools/sync-shared');

const repoRoot = path.join(__dirname, '..');

// 1. 仓库当前状态必须无漂移。
const clean = syncAll({ root: repoRoot });
assert.deepEqual(clean.problems, [], '共享块存在漂移:\n' + clean.problems.join('\n'));

// 2. 用临时副本验证检查本身有效（防止检查形同虚设）。
function withTempCopy(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiclash-shared-'));
  try {
    fs.cpSync(path.join(repoRoot, 'Script'), path.join(dir, 'Script'), { recursive: true });
    mutate(dir);
    return syncAll({ root: dir });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 2a. 有人只改了其中一份脚本里的块 → 必须报漂移。
const drifted = withTempCopy((dir) => {
  const file = path.join(dir, 'Script', 'Script.js');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes("'香港'") || text.includes('香港'), 'fixture assumption');
  fs.writeFileSync(file, text.replace(/(@shared:begin regionDefinitions[^\n]*\n[\s\S]*?)香港/, '$1香巷'), 'utf8');
});
assert.ok(
  drifted.problems.some((p) => p.includes('regionDefinitions') && p.includes('不一致')),
  '应检测到块被手改',
);

// 2b. 精简版悄悄漏掉某个块的标记 → 必须报缺失。
const missing = withTempCopy((dir) => {
  const file = path.join(dir, 'Script', 'Script.js');
  const text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(
    file,
    text.replace(/\/\/ @shared:begin blockWebRtcStun[^\n]*\n/, '').replace('// @shared:end blockWebRtcStun\n', ''),
    'utf8',
  );
});
assert.ok(
  missing.problems.some((p) => p.includes('缺少共享块 blockWebRtcStun')),
  '应检测到某份脚本缺少共享块',
);

// 2c. 孤儿标记（没有共享文件）→ 必须报错。
const orphan = withTempCopy((dir) => fs.rmSync(path.join(dir, 'Script', 'shared', 'directProxies.js')));
assert.ok(
  orphan.problems.some((p) => p.includes('directProxies')),
  '应检测到孤儿标记',
);

// 3. 共享块至少覆盖地区表，并且两份脚本里的标记集合完全一致。
const names = SCRIPTS.map((script) => {
  const text = fs.readFileSync(path.join(repoRoot, script), 'utf8');
  return [...text.matchAll(/^\/\/ @shared:begin (\w+)/gm)].map((m) => m[1]).sort();
});
assert.deepEqual(names[0], names[1], '两份脚本的共享块集合必须一致');
assert.ok(names[0].includes('regionDefinitions'), '地区表应为共享块');

console.log('Shared block tests passed (' + names[0].length + ' blocks)');
