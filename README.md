# HiClash

> **dukangalex/HiClash · Mihomo 全量增强版**
>
> 基于 Mihomo 的个人增强版配置与覆写脚本。当前核心版本为 **200+ 地区自动识别 + 动态节点归类 + 倍率识别 + DNS/Hosts 优化 + 安全基线 + 冷启动优化**，对齐 **Mihomo v1.19.32**。

## 🚀 本版本的核心特色

- 🌍 **200+ 地区自动识别**：内置大量国家/地区、英文名称、常见缩写及城市关键词，自动识别节点归属。
- 🧩 **动态地区策略组**：根据实际节点匹配结果生成和整理地区组，减少无效策略组。
- 📊 **倍率自动识别**：自动识别低倍率/高倍率节点，并分别归类。
- 🧹 **智能节点过滤**：自动排除官网、客服、订阅、通知、流量、到期等非代理信息节点。
- 🛡️ **安全基线增强**：默认限制局域网访问、管理接口本地绑定，并强化 CORS、进程匹配等配置。
- ⚡ **冷启动优化**：记住策略选择与 fake-ip 映射，策略组懒测速，TUN 使用 mihomo v1.19.32 默认的 `mips` 栈，并指定 `congestion-controller: bbr`。
- 🌐 **DNS / Hosts 优化**：针对机场私有 DNS、Hosts 映射和节点域名解析问题进行统一处理。
- 🔍 **Sniffer 增强**：提供 HTTP/TLS 等流量嗅探及必要的域名覆盖配置。
- 🚫 **QUIC 控制**：支持屏蔽国外 QUIC 流量。
- 🔀 **IPv4 / IPv6 策略**：支持双栈、IPv4 优先、IPv6 优先、仅 IPv4、仅 IPv6。
- 🔗 **链式代理**：支持自定义节点作为落地节点，经订阅节点中转。
- ⚙️ **高度可配置**：通过 `ruleOptionsEnable` 可按需启用或关闭大量功能。

## ⭐ 推荐使用：全量版

当前项目重点维护：

**`Script/mihomoScript.js` — 全量版 · 200+地区自动识别 + 安全基线**

Raw 地址：

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Script/mihomoScript.js`

GitHub：

`https://github.com/dukangalex/HiClash/blob/main/Script/mihomoScript.js`

## 🌍 200+ 地区自动识别

脚本内置 200+ 地区定义，可通过国家/地区名称、英文名称、常见缩写以及部分城市名称匹配节点。例如香港、台湾、日本、韩国、新加坡、美国、英国、德国、法国、加拿大、澳大利亚、俄罗斯、印度、巴西、南非等，并覆盖更多国家和地区。

节点匹配成功后会自动进入对应地区策略组；无法匹配具体地区但属于有效节点的内容会归入「其他节点」。

## 🛡️ 安全基线

本版本在原有覆写能力基础上加入安全基线，重点包括：

- `allow-lan: false`，默认不开放局域网访问
- `bind-address: 127.0.0.1`，管理相关服务默认本机绑定
- 本地 CORS 限制
- 严格进程匹配相关配置
- DNS、Hosts、Sniffer 统一处理
- Mihomo GeoData / GeoIP / GeoSite / MMDB / ASN 数据配置
- 默认关闭 NTP 写系统时钟
- HTTP / TLS / QUIC Sniffer 配置
- 针对常见 Google、YouTube、Telegram、AI 等服务的必要域名处理
- TUN 严格路由与 DNS 劫持（默认强制开启，可通过 `强制TUN` 关闭）
  - TUN 启动失败（没有管理员权限、`/dev/net/tun` 不可用等）**不会让内核退出**：日志里会出现 `Start TUN listening error`，代理端口与 API 照常工作，只是没有接管系统流量。
  - Linux 上 `auto-redirect` 需要 `iptables` 或 `nftables`；缺失时**整个 TUN** 都会启动失败。非 Linux 平台上内核会自动忽略 `auto-redirect`。
  - 无权限、缺少上述依赖，或由客户端自行管理 TUN 时，把 `强制TUN` 设为 `false`：脚本不再接管，原样保留订阅/客户端自带的 `tun` 设置（没有则不输出）。
- 阻断常见 WebRTC STUN UDP/TCP 端口，降低浏览器真实地址暴露风险（可通过 `屏蔽WebRTC` 开关关闭；关闭后 Zoom/Teams/Discord 等通话更顺畅，但可能暴露真实 IP）

> 安全基线用于提高默认配置的安全性；实际安全效果仍取决于客户端、系统、订阅内容和网络环境。

## ⚡ 冷启动优化

针对「打开客户端后前几秒打不开网页 / 全部节点一起测速」做了内核级优化，对齐 **Mihomo v1.19.32**（2026-09-30）：

| 项                                               | 作用                                                  |
| ------------------------------------------------ | ----------------------------------------------------- |
| `profile.store-selected: true`                   | 记住上次策略组选择，重启后不必重新测速                |
| `profile.store-fake-ip: true`                    | 持久化 fake-ip 映射，首包不再等 DNS                   |
| `lazy: true`                                     | url-test / fallback / 负载均衡仅在被选中时测速        |
| `tcp-concurrent` + `unified-delay`               | 并发握手，延迟读数不受协议握手差影响                  |
| `keep-alive-interval/idle: 15`                   | 复用已建立连接，缩短二次请求                          |
| `etag-support: true`                             | 规则集按 ETag 跳过重复下载                            |
| `geodata-loader: memconservative`                | 低内存加载 Geo 数据，弱设备启动更快                   |
| `dns.cache-algorithm: arc` + `prefer-h3: false`  | ARC 缓存；冷启动不做 HTTP/3 探测，避免 UDP 不通时卡住 |
| `tun.stack: mips` + `congestion-controller: bbr` | v1.19.32 默认自研 IP 栈；`bbr` 只在 mips 上生效       |

> `tun.stack: mips` 需要 **Mihomo ≥ v1.19.31**。v1.19.32 起这是默认栈，并支持 `congestion-controller`（`cubic` / `reno` / `bbr` / `bbr3`）。更早的内核请把栈改成 `mixed`。

开启覆写后如果日志里还是 `ProxyMedia`、`GoogleCN`、`Telegram` 这类机场规则集，并且地址是 `http://127.0.0.1:25500/getruleset`，说明脚本结果没有被内核吃进去，订阅自带的 subconverter 规则集仍在跑。v1.19.32 会因为 vmess 缺少 `cipher` 拒绝整份配置。脚本现在会补上 `cipher: auto`，并整表替换 `rule-providers`，不再保留这些本机转换地址。本机 `127.0.0.0/8` 也会先走 `DIRECT`。

## 📚 官方规则源

规则集已从第三方镜像换成 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) 的 `meta` 分支 MRS，和内核自带的 `path-in-bundle` 对齐。规则下载走 `proxy: DIRECT`，节点还没就绪时也能更新。

按社区里反复出现的问题，在官方集合上做了这些取舍：

- **B 站本体直连、国际版走默认代理**，减轻国内视频被送去代理后的卡顿。
- **OneDrive 直连**，避免和微软国内服务抢路由导致同步失败。
- **Disney+ 走默认代理**，用官方 `disney` 域名集，不另开策略组。
- **广告**改用官方 `category-ads-all`。它比第三方大列表更瘦，误杀更少，拦截面也更小。
- **STUN** 用官方 `category-stun` 做 fake-ip 例外，减少通话和网页拿不到真实地址或连不上的情况。
- **国内 QUIC 放行**复用官方 `cn`，不再为同一份 `cn.mrs` 建第二个 provider。Bettbox 会按 URL 重写 `path`，两个 provider 共用一个文件时会互相覆盖。
- 官方没有发布的 IP 集（Microsoft / Apple / Steam / TikTok / Spotify）已去掉，只保留有域名集、以及官方确实提供的 IP 集（Google、Telegram、Twitter、Netflix、Facebook）。
- Emby 改为官方 `category-emby`，客户端进程名规则仍保留。

## 🌐 DNS / Hosts 优化

针对部分机场常见的私有 DNS、节点域名 Hosts 映射、DNS 覆写导致的解析异常等问题，本版本会对 DNS 与 Hosts 进行统一处理，并将必要的节点 Hosts 映射应用到节点配置。

## 📊 倍率与节点过滤

- **低倍率节点**：默认识别倍率 ≤ 0.5
- **高倍率节点**：默认识别倍率 ≥ 2
- 自动排除官网、客服、订阅、流量、到期、通知、教程、优惠等常见信息节点

**Provider 模式的过滤语义**：节点名只有内核运行时才可见，脚本把普通模式的规则「强信息词一律排除；弱词（使用/支持/备用…）只在节点没有地区特征时才排除」翻译成 `exclude-filter`（Mihomo 使用 regexp2 引擎，支持否定前瞻）。地区组只需排除强信息词；基础组与链式组还会排除「不含地区特征且含弱词」的节点。因此 `日本 支持 Netflix`、`香港 备用 01` 不会被误删，而 `剩余流量 120 GB`、`客服 TG`、`备用域名` 会被排除。关闭 `过滤非地区节点` 时不下发任何 `exclude-filter`。

## ⚙️ 主要可配置功能

脚本顶部的 `ruleOptionsEnable` 支持控制：

- 手动选择 / 自动选择 / 负载均衡
- FCM、YouTube、Google、AI、Claude、Microsoft、Apple
- Telegram、Steam、TikTok、Twitter、Meta、Line
- Netflix、Emby、PikPak、Spotify、Crypto、EHentai、AdBlock
- 极简模式
- 地区自动选择及地区手动组显示
- 高/低倍率节点组
- 分流组是否加入全部节点
- 低倍率 / 高倍率 / 非地区节点过滤
- 国外 QUIC 屏蔽、WebRTC STUN 屏蔽
- IPv4 / IPv6 优先
- 链式代理

## 🛠️ 远控工具与故障转移

HiClash 新增独立的「故障转移」策略组及「远控工具」分流。

### 🔧 远控工具

默认识别以下常见远控、组网和内网穿透程序：

- AnyDesk
- ToDesk
- TeamViewer
- RustDesk
- Tailscale / tailscaled
- ZeroTier
- ngrok
- frpc / frps
- cloudflared
- natapp
- nblink

「远控工具」策略组默认提供 **REJECT-DROP / 默认代理 / 直连** 三种选择。规则使用 Mihomo 的 `PROCESS-NAME-WILDCARD`，因此 Android 上也可匹配包名。

### 🔁 故障转移

「故障转移」使用 Mihomo 的 `fallback` 策略组，自动健康检查组内节点；节点不可用时按组内顺序切换到可用节点。当前使用 600 秒检测周期、3000ms 超时、连续 3 次失败阈值，并以 `REJECT` 作为空组兜底。

## ⚙️ 脚本自定义功能

HiClash 保留并整合了完整的脚本自定义能力；这些功能属于脚本本身，不依赖特定客户端。

脚本顶部的 `ruleOptionsEnable` 可直接开关以下功能：

- **策略组开关**：手动选择、自动选择、负载均衡，以及 FCM、YouTube、Google、AI、Claude、Microsoft、Apple、Telegram、Steam、TikTok、Twitter、Meta、Line、Netflix、Emby、PikPak、Spotify、Crypto、EHentai、AdBlock 等分流组。
- **极简模式**：仅保留基础代理/直连/兜底分流结构。
- **地区策略自定义**：控制是否生成地区自动选择组、是否隐藏地区手动选择组。
- **倍率策略自定义**：控制是否生成低倍率/高倍率节点组。
- **节点范围自定义**：控制分流组是否加入全部节点。
- **节点过滤自定义**：分别控制过滤低倍率、高倍率、非地区节点。
- **QUIC 自定义**：控制国外 QUIC 屏蔽。
- **IP 版本自定义**：可将订阅节点统一为 IPv4 优先或 IPv6 优先；同时开启时保持原节点设置。
- **自定义节点**：通过 `customizeProxies` 直接添加自建 Mihomo 节点；与订阅节点重名时自动增加「自建-」前缀。
- **链式代理**：开启 `链式代理` 后，自定义节点自动作为落地节点，通过「链式中转」使用订阅节点中转，并自动维护 `dialer-proxy` 引用。

### 自定义节点示例

在 `Script/mihomoScript.js` 或 `Script/Script.js` 顶部找到 `customizeProxies`，将空数组替换为自己的节点对象即可：

```javascript
const customizeProxies = [
  {
    name: '自建-日本-01',
    type: 'vmess',
    server: '5.6.7.8',
    port: 443,
    uuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    alterId: 0,
    cipher: 'auto',
    tls: true,
    servername: 'example.com',
    network: 'ws',
    'ws-opts': {
      path: '/path',
      headers: { Host: 'example.com' },
    },
  },
];
```

> 自定义节点不会参与订阅节点的过滤与 Hosts 改写；开启链式代理后会自动设置 `dialer-proxy`。配置项为空时不会生成「自建节点」组；开启链式代理但未配置自定义节点会直接提示配置错误。

## 🔗 自定义节点与链式代理

可以在 `customizeProxies` 中加入自定义 Mihomo 节点。

支持：

- 自动生成「自建节点」策略组
- 与订阅节点重名时自动添加「自建-」前缀
- 自定义节点不参与订阅节点过滤
- 启用链式代理后，通过「链式中转」使用订阅节点作为中转

## 📋 主要策略组

`默认代理`、`手动选择`、`自动选择`、`负载均衡`、`故障转移`、`远控工具`、`FCM`、`YouTube`、`Google`、`AI`、`Microsoft`、`Apple`、`Telegram`、`Steam`、`TikTok`、`Netflix`、`Twitter`、`Meta`、`Line`、`Emby`、`PikPak`、`Spotify`、`Crypto`、`EHentai`、`AdBlock`、`直连`、`漏网之鱼`、`自建节点/链式落地`、`链式中转`。

## 📥 使用方法

### 全量版

将以下地址复制到支持 Mihomo Script / 覆写功能的客户端：

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Script/mihomoScript.js`

### 精简版

将以下地址复制到支持 Mihomo Script / 覆写功能的客户端：

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Script/Script.js`

## 🧰 维护者须知

| 事项             | 做法                                                                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **共享块** | 全量版与精简版共用的代码只在 `Script/shared/<NAME>.js` 维护：13 个数据块（地区表、DNS 列表、规则集公共选项等）和 26 个函数，合计约 1,500 行。脚本里用 `// @shared:begin NAME … // @shared:end NAME` 包住，仍是单文件。修改后运行 `node Script/tools/sync-shared.js --write`；`Test/shared-blocks.test.js` 不带参数检查漂移，任何一份被手改、漏掉标记或标记没有源文件都会报错。**切勿用 `--write` 去「修复」漂移**：它以 `shared/` 为准，会覆盖脚本里的改动。 |
| **输出快照** | `Test/golden-output.test.js` 固定 30 个场景（2 脚本 × 5 夹具 × 3 组选项）的输出哈希，用来证明重构没有改变行为。变化是有意的，先人工确认差异（哪些场景变了、为什么），再 `UPDATE_GOLDEN=1 node Test/golden-output.test.js`。 |
| **发布图标资源** | 改 `Icons/` 并提交 → 在该提交上打**新** tag（如 `assets-v2`）并推送 → `node Script/tools/bump-asset-tag.js assets-v2` 统一改写 所有引用 → 更新快照 → 合并。                                                                                                                                                     |
| **真实内核校验** | `MIHOMO_BIN=… node Test/mihomo-runtime.test.js` 让真实内核解析 3 种生成配置（含 provider 地区组的正则，无法编译会直接 panic）；`node Test/mihomo-provider-behavior.test.js` 用本地 `file` provider 让内核真正执行过滤，再经 API 读出每个组留下的节点。注意 `mihomo -t` 对规则集文件是惰性加载，不能当作规则内容的验证。 |
| **规则集金丝雀** | `MIHOMO_BIN=… node Test/rules-canary.test.js` 下载并解码官方规则集，检查数量相对基线（±25%）、标志性域名/IP 分类、`cn` 与 `geolocation-!cn` 的重叠比例。退出码 1 为规则异常告警，2 为网络/环境问题。有意的大幅变化用 `UPDATE_CANARY_BASELINE=1` 更新基线。适合配成定时任务。                                    |

## 📄 许可

本仓库以 [MIT License](LICENSE) 发布。项目衍生自 [AIsouler/MyClash](https://github.com/AIsouler/MyClash)（同为 MIT，`Copyright (c) 2026 AIsouler`，自 2026-09-24 起；本项目于 2026-09-21 fork，早于其加入许可证）。依据 MIT 的要求，`LICENSE` 中保留了上游的版权声明。

## 🙏 致谢

感谢原作者与所有上游开源项目及规则资源：

- [AIsouler/MyClash（原作者项目）](https://github.com/AIsouler/MyClash)
- [MetaCubeX/meta-rules-dat（官方规则集）](https://github.com/MetaCubeX/meta-rules-dat)
- [dahaha-365/YaNet](https://github.com/dahaha-365/YaNet)
- [YiXuanZX/rules](https://github.com/YiXuanZX/rules)
- [Koolson/Qure](https://github.com/Koolson/Qure)

## ⭐ 项目

**维护者：dukangalex**

**仓库：** https://github.com/dukangalex/HiClash

如果这个版本对你有帮助，欢迎给项目点个 Star ⭐
