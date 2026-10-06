'use strict';

/**
 * provider 模式的 exclude-filter 语义（节点名只有内核运行时才可见）：
 *  - 地区组：只排除「强信息词」，与普通模式「地区匹配优先于弱词」一致；
 *  - 基础组 / 链式组（收纳全部节点）：强词一律排除，弱词只在节点没有地区特征时才排除（用否定前瞻还原）；
 *  - 关闭「过滤非地区节点」时不下发任何 exclude-filter。
 */
const assert = require('node:assert/strict');
const { loadScript } = require('./lib/loader');
const fx = require('./lib/fixtures');

/** 把下发给 Mihomo 的 `(?i)…` 还原成 JS 正则，以便在这里断言它「会排除什么」。 */
function compile(filter) {
  assert.ok(filter.startsWith('(?i)'), 'filter must be case-insensitive: ' + filter.slice(0, 20));
  return new RegExp(filter.slice(4), 'i');
}

const INFO_NODES = [
  '剩余流量：120.5 GB',
  '客服 TG @xxx',
  '套餐到期：2026-12-31',
  'Traffic: 100 GB',
  '官网 example.com',
];
const LEGIT_WITH_WEAK_WORDS = ['日本 支持 Netflix', '香港 备用 01', '美国 使用 IEPL', '新加坡 选择 03'];
const WEAK_ONLY_INFO = ['使用说明', '备用域名', '邀请好友'];

function inspect(label, buildConfig, setOption) {
  const on = buildConfig();
  const fed = on['proxy-groups'].filter((g) => Array.isArray(g.use) && g.use.length > 0);
  const regionGroups = fed.filter((g) => g.filter);
  const baseGroups = fed.filter((g) => !g.filter);
  assert.ok(regionGroups.length >= 2, label + ': expected provider-fed region groups, got ' + regionGroups.length);
  assert.ok(baseGroups.length >= 1, label + ': expected provider-fed base groups');

  for (const group of regionGroups) {
    const re = compile(group['exclude-filter']);
    for (const name of INFO_NODES)
      assert.ok(re.test(name), `${label}: region group ${group.name} should exclude ${name}`);
    for (const name of LEGIT_WITH_WEAK_WORDS) {
      assert.equal(
        re.test(name),
        false,
        `${label}: region group ${group.name} must keep ${name} (region wins over weak words)`,
      );
    }
  }
  for (const group of baseGroups) {
    const re = compile(group['exclude-filter']);
    for (const name of [...INFO_NODES, ...WEAK_ONLY_INFO]) {
      assert.ok(re.test(name), `${label}: base group ${group.name} should exclude ${name}`);
    }
    // 基础组同样「地区优先于弱词」：带地区特征的正常节点必须保留（与普通模式一致）。
    for (const name of LEGIT_WITH_WEAK_WORDS) {
      assert.equal(re.test(name), false, `${label}: base group ${group.name} must keep ${name}`);
    }
  }

  setOption(false);
  const off = buildConfig();
  for (const group of off['proxy-groups'].filter((g) => Array.isArray(g.use))) {
    assert.equal(
      'exclude-filter' in group,
      false,
      `${label}: ${group.name} must not carry exclude-filter when 过滤非地区节点 is off`,
    );
  }
  setOption(true);
}

// 全量版：通过运行时 customOptions 切换。
const full = loadScript('Script/mihomoScript.js');
let fullOption = true;
inspect(
  'full',
  () => full.main(fx.providerRegionSubscription(), { customOptions: { 过滤非地区节点: fullOption } }),
  (value) => {
    fullOption = value;
  },
);

// 精简版：选项在脚本头部，通过 loader 暴露的 ruleOptionsEnable 切换。
const lite = loadScript('Script/Script.js');
inspect(
  'lite',
  () => lite.main(fx.providerRegionSubscription()),
  (value) => {
    lite.ruleOptionsEnable.过滤非地区节点 = value;
  },
);

console.log('Provider filter tests passed');
