# HiClash Universal Core

本目录把 HiClash 从“以 Mihomo 覆写脚本为中心”扩展为可承载 **Mihomo / sing-box / Xray** 的统一控制平面。现有 `Script/` 与 `Config/` 行为保持独立，不改变现有机场覆写规则。

## 已落地

- `config-sniffer.js`：Share Link / Mihomo YAML / sing-box JSON / Xray JSON 自动识别。
- `chain-compiler.js`：节点→节点、节点→订阅、订阅→节点、订阅→订阅统一抽象；内核编译分别生成 Mihomo `dialer-proxy`、sing-box `detour`、Xray `dialerProxy`。
- `adapters.js`：统一 Core Adapter 生命周期与控制接口，供 Android/桌面端绑定真实内核控制 API。
- `network-context.js`：Wi-Fi/移动网络/公共网络/Captive Portal/UDP 丢包状态机。
- `bypass-engine.js`：进程、SNI、ASN、低延迟四信号交叉决策。
- `security-policy.js`：Kill Switch、WebRTC STUN、IPv6 泄漏、禁止意外 DIRECT fallback 等安全基线。
- `self-healing.js`：连续失败阈值与备用节点切换状态机。
- `schema.json`：跨内核统一配置模型。
- `index.js`：统一控制平面入口。

## 四种链路

统一链路模型不预设“前置/中转/落地”的固定角色，仅描述有序 hop：

1. node → node
2. node → subscription pool
3. subscription pool → node
4. subscription pool → subscription pool

订阅池的实际 URLTest/fallback/selector 策略由上层适配器实现；Core 只负责保持链路拓扑与安全约束。

## 安全原则

默认策略为 fail-closed：核心停止、链路异常或禁止的直接回退均不得自动放行。公共 Wi-Fi 默认进入 TUN + Kill Switch；Captive Portal 由平台层提供最小临时白名单；UDP 丢包超过 80% 时建议切换到 TCP 承载。

## 当前边界

本目录是跨内核控制/编译核心，不把 Go 内核二进制直接塞进配置仓库。Android `VpnService/JNI`、Windows WFP/TUN、真实 Mihomo REST/WS、sing-box Command/WS、Xray gRPC 等平台绑定应作为 Adapter 实现接入。这样可以避免把平台权限、进程管理和内核生命周期耦合进机场覆写脚本。

## 测试

运行：

```bash
node Test/universal-core.test.js
node Test/run-tests.js
```
