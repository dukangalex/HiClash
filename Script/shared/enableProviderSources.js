/**
 * provider 模式下让原有基础组直接消费 provider 节点。
 * 仅补充节点来源，不删除原有规则、组结构或功能。
 */
function enableProviderSources(groups, chainGroup, providerNames) {
  const baseNames = new Set(baseGroups.map((group) => group.name));
  for (const group of groups) {
    if (!group || (!baseNames.has(group.name) && group.name !== '默认代理')) continue;
    group.use = [...providerNames];
    const exclude = getProviderExcludeFilter('all');
    if (exclude) group['exclude-filter'] = exclude;
    group['exclude-type'] = 'DIRECT|REJECT|REJECT-DROP|PASS';
  }

  if (chainGroup) {
    chainGroup.use = [...providerNames];
    const chainExclude = getProviderExcludeFilter('all');
    if (chainExclude) chainGroup['exclude-filter'] = chainExclude;
    chainGroup['exclude-type'] = 'DIRECT|REJECT|REJECT-DROP|PASS';
  }
}
