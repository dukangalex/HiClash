function buildProviderRegionGroups(filteredProxies, customProxies, providerNames) {
  // Provider 本身的远程节点在脚本执行阶段不可见，因此严格沿用原有
  // getMatchedRegions() + buildRegionGroups() 逻辑：只有当前脚本实际可见的
  // 节点能够证明某地区存在时，才创建该地区组；绝不为未知/空地区预建空组。
  const groups = buildRegionGroups(filteredProxies, customProxies);
  const regionByName = new Map(allRegionDefinitions.map((region) => [region.name, region]));

  for (const group of groups) {
    const regionName = group.name.endsWith('-自动选择') ? group.name.slice(0, -5) : group.name;
    const region = regionByName.get(regionName);
    if (!region) continue;

    group.use = [...providerNames];
    group.filter = getProviderRegionFilter(region);
    const exclude = getProviderExcludeFilter('region');
    if (exclude) group['exclude-filter'] = exclude;
    group['exclude-type'] = 'DIRECT|REJECT|REJECT-DROP|PASS';
  }

  return groups;
}
