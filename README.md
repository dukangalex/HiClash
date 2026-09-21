# HiClash

> **dukangalex/HiClash · Mihomo 全量增强版**
>
> 基于 Mihomo 的个人增强版配置与覆写脚本。当前核心版本为 **100+ 地区自动识别 + 动态节点归类 + 倍率识别 + DNS/Hosts 优化 + 安全基线**。

## 🚀 本版本的核心特色

- 🌍 **100+ 地区自动识别**：内置大量国家/地区、英文名称、常见缩写及城市关键词，自动识别节点归属。
- 🧩 **动态地区策略组**：根据实际节点匹配结果生成和整理地区组，减少无效策略组。
- 📊 **倍率自动识别**：自动识别低倍率/高倍率节点，并分别归类。
- 🧹 **智能节点过滤**：自动排除官网、客服、订阅、通知、流量、到期等非代理信息节点。
- 🛡️ **安全基线增强**：默认限制局域网访问、管理接口本地绑定，并强化 CORS、进程匹配等配置。
- 🌐 **DNS / Hosts 优化**：针对机场私有 DNS、Hosts 映射和节点域名解析问题进行统一处理。
- 🔍 **Sniffer 增强**：提供 HTTP/TLS 等流量嗅探及必要的域名覆盖配置。
- 🚫 **QUIC 控制**：支持屏蔽国外 QUIC 流量。
- 🔀 **IPv4 / IPv6 策略**：支持双栈、IPv4 优先、IPv6 优先、仅 IPv4、仅 IPv6。
- 🔗 **链式代理**：支持自定义节点作为落地节点，经订阅节点中转。
- ⚙️ **高度可配置**：通过 `ruleOptionsEnable` 可按需启用或关闭大量功能。

## ⭐ 推荐使用：全量版

当前项目重点维护：

**`Script/mihomoScript.js` — 全量版 · 100+地区自动识别 + 安全基线**

Raw 地址：

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Script/mihomoScript.js`

GitHub：

`https://github.com/dukangalex/HiClash/blob/main/Script/mihomoScript.js`

## 🌍 100+ 地区自动识别

脚本内置 100+ 地区定义，可通过国家/地区名称、英文名称、常见缩写以及部分城市名称匹配节点。例如香港、台湾、日本、韩国、新加坡、美国、英国、德国、法国、加拿大、澳大利亚、俄罗斯、印度、巴西、南非等，并覆盖更多国家和地区。

节点匹配成功后会自动进入对应地区策略组；无法匹配具体地区但属于有效节点的内容会归入「其他节点」。

## 🛡️ 安全基线

本版本在原有覆写能力基础上加入安全基线，重点包括：

- `allow-lan: false`，默认不开放局域网访问
- `bind-address: 127.0.0.1`，管理相关服务默认本机绑定
- 本地 CORS 限制
- 严格进程匹配相关配置
- DNS、Hosts、Sniffer 统一处理
- Mihomo GeoData / GeoIP / GeoSite / MMDB / ASN 数据配置
- 默认关闭 Profile 持久化存储及 NTP
- HTTP / TLS Sniffer 配置
- 针对常见 Google、YouTube、Telegram、AI 等服务的必要域名处理

> 安全基线用于提高默认配置的安全性；实际安全效果仍取决于客户端、系统、订阅内容和网络环境。

## 🌐 DNS / Hosts 优化

针对部分机场常见的私有 DNS、节点域名 Hosts 映射、DNS 覆写导致的解析异常等问题，本版本会对 DNS 与 Hosts 进行统一处理，并将必要的节点 Hosts 映射应用到节点配置。

## 📊 倍率与节点过滤

- **低倍率节点**：默认识别倍率 ≤ 0.5
- **高倍率节点**：默认识别倍率 ≥ 2
- 自动排除官网、客服、订阅、流量、到期、通知、教程、优惠等常见信息节点

## ⚙️ 主要可配置功能

脚本顶部的 `ruleOptionsEnable` 支持控制：

- 手动选择 / 自动选择 / 负载均衡
- FCM、YouTube、Google、AI、Microsoft、Apple
- Telegram、Steam、TikTok、Twitter、Meta、Line
- Netflix、Emby、PikPak、Spotify、Crypto、EHentai、AdBlock
- 极简模式
- 地区自动选择及地区手动组显示
- 高/低倍率节点组
- 分流组是否加入全部节点
- 低倍率 / 高倍率 / 非地区节点过滤
- 国外 QUIC 屏蔽
- IPv4 / IPv6 优先
- 链式代理

## 🔗 自定义节点与链式代理

可以在 `customizeProxies` 中加入自定义 Mihomo 节点。

支持：

- 自动生成「自建节点」策略组
- 与订阅节点重名时自动添加「自建-」前缀
- 自定义节点不参与订阅节点过滤
- 启用链式代理后，通过「链式中转」使用订阅节点作为中转

## 📋 主要策略组

`默认代理`、`手动选择`、`自动选择`、`负载均衡`、`FCM`、`YouTube`、`Google`、`AI`、`Microsoft`、`Apple`、`Telegram`、`Steam`、`TikTok`、`Instagram`、`Netflix`、`Twitter`、`Meta`、`Line`、`Emby`、`PikPak`、`Spotify`、`Crypto`、`EHentai`、`AdBlock`、`直连`、`漏网之鱼`、`自建节点/链式落地`、`链式中转`。

## 📥 使用方法

### 全量版

将以下地址复制到支持 Mihomo Script / 覆写功能的客户端：

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Script/mihomoScript.js`

### 精简版

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Script/Script.js`

## 📄 配置文件

全量版：

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Config/mihomoConfig.yaml`

精简版：

`https://raw.githubusercontent.com/dukangalex/HiClash/main/Config/mihomoConfigLite.yaml`

配置文件与脚本版目标一致，但无法像脚本一样根据实际节点动态生成策略组，也不具备脚本中的全部自定义选项。

## 💻 客户端

本项目针对 **Mihomo 内核**设计，不绑定任何特定客户端。

## ⚠️ 使用注意

> [!IMPORTANT]
>
> 1. 本脚本主要用于覆写机场提供的订阅配置。
> 2. DNS、TUN、Sniffer、Hosts 等行为可能受到客户端自身设置影响。
> 3. 如果出现节点解析异常，请检查客户端 DNS 覆写、Fake-IP、TUN / 严格路由等设置。
> 4. 不同机场节点命名方式不同，地区识别结果取决于节点名称中的可识别信息。

## 🙏 致谢

感谢原作者与所有上游开源项目及规则资源：

- [AIsouler/MyClash（原作者项目）](https://github.com/AIsouler/MyClash)
- [dahaha-365/YaNet](https://github.com/dahaha-365/YaNet)
- [YiXuanZX/rules](https://github.com/YiXuanZX/rules)
- [appshubcc/bett-rules](https://github.com/appshubcc/bett-rules)
- [217heidai/adblockfilters](https://github.com/217heidai/adblockfilters)
- [Koolson/Qure](https://github.com/Koolson/Qure)

## ⭐ 项目

**维护者：dukangalex**

**仓库：** https://github.com/dukangalex/HiClash

如果这个版本对你有帮助，欢迎给项目点个 Star ⭐