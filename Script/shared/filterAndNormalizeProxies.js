/**
 * 过滤并标准化节点：剔除内置/信息节点、按配置过滤、去重、修复 dialer-proxy 引用，空列表时抛错
 */
function filterAndNormalizeProxies(config) {
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

  const originalProxies = config.proxies || [];

  const filteredRawProxies = originalProxies.filter((proxy) => {
    const type = String(proxy.type ?? '').toLowerCase();
    if (type === 'direct' || type === 'reject' || type === 'rematch') return false;

    if (lowRateRegex?.test(proxy.name) || highRateRegex?.test(proxy.name)) return false;

    if (!filterNonRegionProxiesEnabled) return true;

    const isRegionProxy = getMatchedRegions(proxy.name).some((region) => regionDefinitions.includes(region));

    if (strongExcludeFilter.test(proxy.name)) return false;
    return isRegionProxy || !excludeFilter.test(proxy.name);
  });

  const renameMap = new Map();
  const normalizedProxies = [];
  const uniqueNames = new Set();

  for (const rawProxy of filteredRawProxies) {
    const normalized = normalizeProxyName(rawProxy);
    const safeName = reserveProxyName(normalized.name, getReservedProxyNames(), uniqueNames);
    // 引用修复必须指向最终安全名称，而不仅是标准化后的中间名称。
    // 对重复原名只保留第一次映射，避免后续重复节点覆盖已有引用目标。
    if (!renameMap.has(rawProxy.name)) {
      renameMap.set(rawProxy.name, safeName);
    }
    const safeProxy = safeName === normalized.name ? normalized : { ...normalized, name: safeName };
    if (!uniqueNames.has(safeName)) {
      uniqueNames.add(safeName);
      normalizedProxies.push(safeProxy);
    }
  }

  const normalizedProxyNames = new Set(normalizedProxies.map((p) => p.name));

  const filteredProxies = normalizedProxies.map((proxy) => fixDialerProxy(proxy, renameMap, normalizedProxyNames));

  if (!filteredProxies.length) {
    throw new Error('配置文件中未找到任何代理节点，请使用机场提供的配置文件进行覆写');
  }

  const ipVersionPreference = getIpVersionPreference();
  if (ipVersionPreference) {
    return filteredProxies.map((proxy) =>
      proxy['ip-version'] === ipVersionPreference ? proxy : { ...proxy, 'ip-version': ipVersionPreference },
    );
  }

  return filteredProxies;
}
