# HiClash

> **dukangalex/HiClash · Mihomo 全量增强版 + Universal Core 方案B**
>
> 基于 Mihomo 的个人增强版配置与覆写脚本，并新增可承载 Mihomo / sing-box / Xray 的统一控制平面。

## Universal Core（方案B）

项目新增 `Core/` 与 `Dashboard/`，在不破坏现有 Mihomo 覆写体系的前提下，把配置识别、链式编译、网络上下文、安全策略和自愈逻辑抽成独立控制层。

### 已实现

- **格式自动嗅探**：Share Link、Mihomo YAML、sing-box JSON、Xray JSON 自动绑定内核。
- **三内核统一 Adapter**：Mihomo / sing-box / Xray 使用统一生命周期与控制接口。
- **四种链式拓扑**：节点→节点、节点→订阅、订阅→节点、订阅→订阅；编译到 Mihomo `dialer-proxy`、sing-box `detour`、Xray `dialerProxy`。
- **网络环境状态机**：离线、可信网络、公共网络、Captive Portal 与 UDP 高丢包降级策略。
- **精准国内旁路引擎**：进程、SNI、ASN、低延迟四信号交叉判断。
- **安全中心基础**：Kill Switch、WebRTC STUN 阻断、IPv6 泄漏保护、禁止意外 DIRECT fallback。
- **Self-Healing**：连续失败阈值、备用节点选择与冷却时间。
- **本地 REST 控制面**：`Core/server.js`，默认只监听 `127.0.0.1:8787`。
- **极简控制台**：`Dashboard/index.html`。
- **自动化回归测试**：Universal Core 与原有 200+ 覆写测试共同进入 CI。

### 启动 Universal Core

```bash
node Core/server.js
```

默认地址：`127.0.0.1:8787`。

### 测试

```bash
node Test/universal-core.test.js
node Test/run-tests.js
```

> `Core/` 是跨平台控制与编译层，不直接携带 Go 内核二进制。Android `VpnService/JNI`、Windows WFP/TUN 以及真实 Mihomo REST/WS、sing-box Command/WS、Xray gRPC 的平台绑定应分别实现为 Adapter，以保持 UI、控制逻辑和内核解耦。

## Mihomo 全量版

当前核心覆写脚本仍为：

`Script/mihomoScript.js`

Raw：

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Script/mihomoScript.js`

原有 200+ 地区自动识别、动态地区组、倍率识别、节点过滤、安全基线、DNS/Hosts、Sniffer、IPv4/IPv6、链式代理、远控工具与故障转移等能力保持不变。
