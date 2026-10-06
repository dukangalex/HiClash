/**
 * Mihomo v1.19.32 起 vmess.cipher 没有 omitempty，缺字段会让整份配置解析失败。
 * 机场订阅经常省略它；Clash 历史默认值是 auto。这里只补缺失字段，不改已有值。
 */
function applyKernelProxyDefaults(proxy) {
  if (!proxy || typeof proxy !== 'object') return proxy;
  const type = String(proxy.type || '').toLowerCase();
  if (type === 'vmess' && !proxy.cipher) {
    return { ...proxy, cipher: 'auto' };
  }
  return proxy;
}
