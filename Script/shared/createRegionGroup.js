/**
 * 构建地区策略组，可附带自动选择组
 */
function createRegionGroup(name, icon, proxies) {
  const generateRegionAutoSelectEnabled = activeRuleOptions.生成地区自动选择组;
  const hideManualSelectGroupEnabled = activeRuleOptions.隐藏地区手动选择组;

  if (generateRegionAutoSelectEnabled) {
    const urlTestName = `${name}-自动选择`;
    return [
      {
        ...urlTestBaseOption,
        name: urlTestName,
        proxies,
      },
      {
        ...selectBaseOption,
        name,
        icon,
        proxies: [...proxies, urlTestName],
        hidden: hideManualSelectGroupEnabled,
      },
    ];
  }
  return [
    {
      ...selectBaseOption,
      name,
      icon,
      proxies,
      hidden: hideManualSelectGroupEnabled,
    },
  ];
}
