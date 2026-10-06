/**
 * provider 模式的地区组。
 * Mihomo 会在运行期从 proxy-providers 中加载节点，因此这里使用 use + filter，
 * 不需要脚本读取/下载机场订阅内容。
 */
function getProviderRegionFilter(region) {
  // Mihomo 使用 Go/RE2 正则，不支持 JS 的 lookbehind。
  // 地区识别沿用原 regionDefinitions；倍率识别使用语义等价的 RE2 兼容表达式。
  if (region.name === lowRateRegionName) {
    return '(?i)(?:^|[^0-9])0\\.[0-5](?:倍|[x×*])?(?:$|[^0-9])|(?:^|[^A-Za-z])(?:下载|低倍|免费|free)(?:$|[^A-Za-z])';
  }

  if (region.name === highRateRegionName) {
    return '(?i)(?:^|[^0-9])(?:[2-9]\\d*|1\\d+)(?:\\.\\d+)?(?:倍|[x×*])|(?:^|[^0-9])[*×x]\\s*(?:[2-9]\\d*|1\\d+)(?:\\.\\d+)?';
  }

  return '(?i)' + expandTraditional(region.regex.source);
}
