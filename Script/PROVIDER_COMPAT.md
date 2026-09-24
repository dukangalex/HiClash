# HiClash `proxy-providers` 兼容层

当前 `Script/Script.js` 与 `Script/mihomoScript.js` 已原生支持包含 `proxy-providers` 的完整 Mihomo 配置：直接覆写控制面，原始 `proxies` / `proxy-providers` 节点信息原样保留。`mihomoScriptProvider.js` 保留作为独立兼容层，不再是使用主脚本的前置条件。

## 修复内容

- 不再因为 `proxy-providers` 存在而直接失败。
- 原始 `proxies` 原样保留，不过滤、不删除、不改写。
- 原始 `proxy-providers` 原样保留。
- 原始 `rules`、DNS、TUN、Sniffer 等控制面保持不变。
- 现有代理型策略组自动获得 provider 节点来源。
- 增加 provider-aware 的自动选择、故障转移以及主要地区组。
- 已存在 `MATCH` 规则时不改动；没有 `MATCH` 时才补 `MATCH,HiClash-自动选择`。

## 适用场景

包含 `proxy-providers` 的完整配置现在可直接使用：

- `Script/Script.js`
- `Script/mihomoScript.js`

主脚本不会在脚本阶段下载或展开 provider，而是使用 Mihomo 的 `include-all` / `filter` 机制在运行期消费 provider 节点；这样可以保留原节点信息，同时由 HiClash 接管 DNS、TUN、Sniffer、策略组和规则。

`Script/mihomoScriptProvider.js` 继续保留，供需要独立 provider 兼容层的场景使用。

## 验证

`Test/providerCompat.test.js` 验证：

1. `proxies` 内容不发生变化；
2. `proxy-providers` 保留；
3. provider 节点进入自动选择和故障转移组；
4. 已存在的 `MATCH` 不被改写。
