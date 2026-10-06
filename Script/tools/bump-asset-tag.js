#!/usr/bin/env node
'use strict';

/**
 * 本仓库的 Icons/ 经 jsDelivr 以版本 tag 引用（`dukangalex/HiClash@assets-vN/...`），
 * 而不是 `@main`，这样合并到 main 不会立即影响所有用户。
 *
 * jsDelivr 会永久缓存版本 tag 的内容：**不要移动或复用已有 tag**，发布新资源必须用新 tag。
 *
 * 发布流程：
 *   1. 修改 Icons/ 并提交；
 *   2. 在该提交上创建新 tag，例如 assets-v2 并推送；
 *   3. node Script/tools/bump-asset-tag.js assets-v2   # 统一改写所有引用（含 Script/shared）
 *      然后 node Script/tools/sync-shared.js 应无漂移；切勿用 --write 反向覆盖
 *   4. UPDATE_GOLDEN=1 node Test/golden-output.test.js # 引用变了，快照需有意更新
 *   5. 提交并合并。
 */
const fs = require('node:fs');
const path = require('node:path');

const BASE_FILES = [
  'Script/Script.js',
  'Script/mihomoScript.js',
  'Script/mihomoScriptProvider.js',
  'Config/mihomoConfig.yaml',
  'Config/mihomoConfigLite.yaml',
];
const ROOT = path.join(__dirname, '..', '..');

/** 含资源引用的全部文件：脚本、配置，以及 Script/shared 下的共享块源文件（它们同样会内联进脚本）。 */
function allFiles(root = ROOT) {
  const sharedDir = path.join(root, 'Script', 'shared');
  const shared = fs.existsSync(sharedDir)
    ? fs
        .readdirSync(sharedDir)
        .filter((f) => f.endsWith('.js'))
        .sort()
        .map((f) => `Script/shared/${f}`)
    : [];
  return [...BASE_FILES, ...shared];
}

const REF = /(dukangalex\/HiClash)@([A-Za-z0-9._-]+)(\/)/g;
const TAG_PATTERN = /^assets-v\d+$/;

function collectTags(root = ROOT) {
  const tags = new Map();
  for (const file of allFiles(root)) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of text.matchAll(REF)) tags.set(match[2], (tags.get(match[2]) || 0) + 1);
  }
  return tags;
}

function bump(tag, root = ROOT) {
  if (!TAG_PATTERN.test(tag)) throw new Error('tag must look like assets-v2, got: ' + tag);
  let total = 0;
  for (const file of allFiles(root)) {
    const filePath = path.join(root, file);
    const text = fs.readFileSync(filePath, 'utf8');
    let count = 0;
    const next = text.replace(REF, (_, repo, _old, slash) => {
      count += 1;
      return `${repo}@${tag}${slash}`;
    });
    if (next !== text) fs.writeFileSync(filePath, next, 'utf8');
    total += count;
    console.log(`${file}: ${count} refs`);
  }
  return total;
}

module.exports = { BASE_FILES, allFiles, REF, TAG_PATTERN, collectTags, bump };

if (require.main === module) {
  const tag = process.argv[2];
  if (!tag) {
    console.log('current refs:', JSON.stringify(Object.fromEntries(collectTags())));
    process.exit(0);
  }
  console.log('total refs rewritten:', bump(tag));
}
