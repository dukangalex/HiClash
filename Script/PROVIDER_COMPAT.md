# HiClash `proxy-providers` 兼容层

`mihomoScriptProvider.js` 用于机场/完整 Mihomo 配置已经包含 `proxy-providers` 的场景。

## 修复内容

- 不再因为 `proxy-providers` 存在而直接失败。
- 原始 `proxies` 原样保留，不过滤、不删除、不改写。
- 原始 `proxy-providers` 原样保留。
- 原始 `rules`、DNS、TUN、Sniffer 等控制面保持不变。
- 现有代理型策略组自动获得 provider 节点来源。
- 增加 provider-aware 的自动选择、故障转移以及主要地区组。
- 已存在 `MATCH` 规则时不改动；没有 `MATCH` 时才补 `MATCH,HiClash-自动选择`。

## 适用场景

当机场返回的是完整 Mihomo 配置，节点位于 `proxy-providers`，而不是直接展开到 `proxies` 时，使用：

`Script/mihomoScriptProvider.js`

普通机场订阅已经直接提供节点到 `proxies` 时，继续使用原有 `Script.js` / `mihomoScript.js`。

## 验证

`Test/providerCompat.test.js` 验证：

1. `proxies` 内容不发生变化；
2. `proxy-providers` 保留；
3. provider 节点进入自动选择和故障转移组；
4. 已存在的 `MATCH` 不被改写。
