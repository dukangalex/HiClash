function filterProviderVisibleProxies(config) {
  // provider 节点本体由 mihomo 在脚本执行后加载；脚本阶段只能使用配置中已经可见的
  // proxies 判断哪些地区真实存在。这里沿用原有过滤条件，但绝不标准化/改名，
  // 因为 provider 模式要求原始节点信息原样保留。
  regionMatchCache.clear();

  const filterLowRateProxiesEnabled = activeRuleOptions.过滤低倍率节点;
  const filterHighRateProxiesEnabled = activeRuleOptions.过滤高倍率节点;
  const filterNonRegionProxiesEnabled = activeRuleOptions.过滤非地区节点;

  const lowRateRegex = filterLowRateProxiesEnabled
    ? rateRegionDefinitions.find((r) => r.name === lowRateRegionName)?.regex
    : null;
  const highRateRegex = filterHighRateProxiesEnabled
    ? rateRegionDefinitions.find((r) => r.name === highRateRegionName)?.regex
    : null;

  const originalProxies = Array.isArray(config.proxies) ? config.proxies : [];
  const visible = [];
  const names = new Set();

  for (const proxy of originalProxies) {
    if (!proxy || typeof proxy !== 'object') continue;

    const type = String(proxy.type ?? '').toLowerCase();
    if (type === 'direct' || type === 'reject' || type === 'rematch') continue;

    const name = String(proxy.name ?? '');
    if (!name) continue;

    if (lowRateRegex?.test(name) || highRateRegex?.test(name)) continue;

    if (filterNonRegionProxiesEnabled) {
      const isRegionProxy = getMatchedRegions(name).some((region) => regionDefinitions.includes(region));
      if (strongExcludeFilter.test(name)) continue;
      if (!isRegionProxy && excludeFilter.test(name)) continue;
    }

    if (!names.has(name)) {
      names.add(name);
      visible.push(proxy);
    }
  }

  return visible;
}
