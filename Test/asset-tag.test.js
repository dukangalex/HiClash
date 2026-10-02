'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BASE_FILES, allFiles, TAG_PATTERN, collectTags, bump } = require('../Script/tools/bump-asset-tag');

const repoRoot = path.join(__dirname, '..');
const FILES = allFiles(repoRoot);
assert.ok(
  FILES.some((f) => f.startsWith('Script/shared/')),
  '共享块源文件也必须在资源引用的改写范围内',
);

// 1. 所有对本仓库资源的引用必须使用同一个版本 tag，而不是 @main 或混用多个版本。
const tags = collectTags(repoRoot);
assert.equal(tags.size, 1, '引用了多个资源版本: ' + JSON.stringify(Object.fromEntries(tags)));
const [tag] = [...tags.keys()];
assert.match(tag, TAG_PATTERN, '资源引用必须是 assets-vN 版本 tag，而不是分支: ' + tag);
assert.ok(tags.get(tag) > 50, '引用数量异常偏少，可能漏改');

// 2. 脚本与配置文件都必须使用当前资源版本（共享块源文件未必含有图标 URL，
//    它们只受第 1 条约束：若有引用，就必须与其他文件是同一个 tag）。
for (const file of BASE_FILES) {
  const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  assert.ok(text.includes(`dukangalex/HiClash@${tag}/`), file + ' 没有使用当前资源版本 ' + tag);
}

// 3. 引用的资源文件必须真实存在于仓库中（tag 只是版本，路径必须对）。
for (const file of FILES) {
  const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  for (const match of text.matchAll(/dukangalex\/HiClash@[\w.-]+\/((?:Icons|Rules)\/[^\s'")]+)/g)) {
    assert.ok(fs.existsSync(path.join(repoRoot, match[1])), file + ' 引用了不存在的文件: ' + match[1]);
  }
}

// 4. bump 工具本身：在临时副本里改版本，所有引用同步变化，且拒绝非法 tag。
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiclash-tag-'));
try {
  for (const file of FILES) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, file), path.join(dir, file));
  }
  const log = console.log;
  console.log = () => {};
  try {
    bump('assets-v99', dir);
  } finally {
    console.log = log;
  }
  const after = collectTags(dir);
  assert.deepEqual([...after.keys()], ['assets-v99']);
  assert.equal(after.get('assets-v99'), tags.get(tag), '改写前后引用数应一致');
  assert.throws(() => bump('main', dir), /tag must look like/);
  assert.throws(() => bump('v1.0.0', dir), /tag must look like/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('Asset tag tests passed (' + tag + ', ' + tags.get(tag) + ' refs)');
