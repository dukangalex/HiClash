#!/usr/bin/env node
'use strict';

/**
 * 全量版 / 精简版共用的数据块只维护一份：Script/shared/<NAME>.js。
 * 两份脚本里用下面一对标记包住对应的块（脚本仍是单文件，用户拉取的链接不变）：
 *
 *   // @shared:begin NAME
 *   ...块内容...
 *   // @shared:end NAME
 *
 * 用法：
 *   node Script/tools/sync-shared.js           # 检查（有漂移则退出码 1，CI 使用）
 *   node Script/tools/sync-shared.js --write   # 以 Script/shared 为准改写两份脚本
 *
 * 修改共享块的流程：改 Script/shared/NAME.js → 运行 --write → 提交三处变更。
 */
const fs = require('node:fs');
const path = require('node:path');

const SCRIPTS = ['Script/Script.js', 'Script/mihomoScript.js'];
const MARKER = /^\/\/ @shared:begin (\w+)[^\n]*\n([\s\S]*?)\n\/\/ @shared:end \1[ \t]*$/gm;
const BEGIN_HINT = (name) => `// @shared:begin ${name} — 由 Script/shared/${name}.js 同步，请勿在此直接修改`;

function readSharedFiles(root) {
  const dir = path.join(root, 'Script', 'shared');
  const shared = {};
  for (const file of fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []) {
    if (!file.endsWith('.js')) continue;
    shared[file.slice(0, -3)] = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\n+$/, '');
  }
  return shared;
}

/**
 * 检查（或改写）两份脚本。返回 { problems: string[], changed: string[] }。
 * problems 非空表示存在漂移或结构错误。
 */
function syncAll({ root = path.join(__dirname, '..', '..'), write = false } = {}) {
  const shared = readSharedFiles(root);
  const problems = [];
  const changed = [];
  const namesByScript = {};

  for (const script of SCRIPTS) {
    const filePath = path.join(root, script);
    const original = fs.readFileSync(filePath, 'utf8');
    const seen = [];
    const updated = original.replace(MARKER, (whole, name, body) => {
      seen.push(name);
      if (!(name in shared)) {
        problems.push(`${script}: 标记块 ${name} 没有对应的 Script/shared/${name}.js`);
        return whole;
      }
      if (body !== shared[name]) {
        problems.push(`${script}: 共享块 ${name} 与 Script/shared/${name}.js 不一致`);
      }
      return `${BEGIN_HINT(name)}\n${shared[name]}\n// @shared:end ${name}`;
    });
    if (new Set(seen).size !== seen.length) problems.push(`${script}: 存在重复的共享块标记`);
    namesByScript[script] = new Set(seen);
    if (updated !== original && write) {
      fs.writeFileSync(filePath, updated, 'utf8');
      changed.push(script);
    }
  }

  // 每个共享文件必须同时被两份脚本使用，否则「精简版」可能悄悄少一块。
  for (const name of Object.keys(shared)) {
    for (const script of SCRIPTS) {
      if (!namesByScript[script].has(name)) problems.push(`${script}: 缺少共享块 ${name} 的标记`);
    }
  }
  return { problems: write ? problems.filter((p) => !p.includes('不一致')) : problems, changed };
}

module.exports = { syncAll, SCRIPTS };

if (require.main === module) {
  const write = process.argv.includes('--write');
  const { problems, changed } = syncAll({ write });
  if (write) console.log(changed.length ? '已同步: ' + changed.join(', ') : '无需改动');
  if (problems.length) {
    console.error(problems.map((p) => '  ✗ ' + p).join('\n'));
    console.error('\n运行 node Script/tools/sync-shared.js --write 以 Script/shared 为准同步。');
    process.exit(1);
  }
  if (!write)
    console.log('共享块一致（' + Object.keys(readSharedFiles(path.join(__dirname, '..', '..'))).length + ' 个）');
}
