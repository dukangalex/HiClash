/**
 * provider 模式下 exclude-filter 的取值。节点名只有内核运行时才可见，脚本无法逐个判断，
 * 因此把普通模式的规则「强信息词一律排除；弱词只在节点没有地区特征时才排除」翻译成正则。
 * Mihomo 使用 regexp2（支持否定前瞻），所以两种范围都能精确还原：
 *  - 'region'：地区组。节点已被地区正则选中，只需排除强信息词
 *    （「日本 支持 Netflix」保留，「剩余流量 120 GB」排除）；
 *  - 'all'：收纳全部节点的基础组 / 链式组。排除 = 强信息词，或「不含任何地区特征且含弱词」
 *    （「香港 备用 01」保留，「备用域名」「使用说明」排除）。
 * 关闭「过滤非地区节点」时返回空串（不下发 exclude-filter），与普通模式不做过滤一致。
 */
function getProviderExcludeFilter(scope) {
  if (!activeRuleOptions.过滤非地区节点) return '';
  const strong = strongExcludeFilter.source;
  if (scope === 'region') return '(?i)' + strong;
  const anyRegion = allRegionDefinitions
    .map((region) => getProviderRegionFilter(region).replace(/^\(\?i\)/, ''))
    .join('|');
  return '(?i)' + strong + '|^(?!.*(?:' + anyRegion + ')).*(?:' + excludeFilter.source + ')';
}
