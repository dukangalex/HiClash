/**
 * 保留名：策略组、地区组、内置节点等名称。节点或自定义节点与之重名会让内核拒绝配置，需要改名避开。
 */
function getReservedProxyNames() {
  const names = new Set([
    '默认代理',
    'GLOBAL',
    '漏网之鱼',
    '直连',
    '其他节点',
    '自建节点',
    '链式落地',
    dialerProxyName,
    'REJECT',
    'REJECT-DROP',
    'PASS',
    ...directProxies.map((proxy) => proxy.name),
    ...baseGroups.map((group) => group.name),
    ...serviceConfigs.map((group) => group.name),
    ...regionDefinitions.map((region) => region.name),
    ...rateRegionDefinitions.map((region) => region.name),
  ]);
  for (const region of allRegionDefinitions) names.add(region.name + '-自动选择');
  return names;
}
