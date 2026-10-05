/**
 * 判断输入是否包含 proxy-providers。
 * provider 模式下不尝试在脚本运行期展开远端订阅，而是直接让 Mihomo
 * 通过 provider 的 use/filter 机制使用节点；这样不会修改或丢失原节点信息。
 */
function hasProxyProviders(config) {
  return !!(
    config &&
    config['proxy-providers'] &&
    typeof config['proxy-providers'] === 'object' &&
    !Array.isArray(config['proxy-providers']) &&
    Object.keys(config['proxy-providers']).length > 0
  );
}
