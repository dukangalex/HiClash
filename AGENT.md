# AGENT.md

面向在本仓库工作的 AI 助手与维护者，记录**图标统一化处理流程**及其配套约定（含踩过的坑）。
改动 `Icons/`、`Script/`、`Config/` 里的图标相关内容前请先读本文。

---

## 0. 快速索引

| 项                               | 位置 / 规则                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 原始位图参考                     | `Icons/png/<Name>.png`                                                                                                |
| 统一化矢量（对外提供的就是这套） | `Icons/svg/<Name>.svg`                                                                                                |
| 命名                             | PascalCase、无下划线/连字符；png 与 svg **同名一一对应**（当前 36 对）                                                |
| 引用格式                         | `https://fastly.jsdelivr.net/gh/dukangalex/MeClash@main/Icons/svg/<Name>.svg`                                           |
| 引用位置                         | `Script/mihomoScript.js`、`Script/Script.js`、`Config/mihomoConfig.yaml`、`Config/mihomoConfigLite.yaml`（共 116 处） |
| 回归测试                         | `node Test/run-tests.js`（改过脚本必跑，当前 192 项）                                                                 |

---

## 1. 图标统一化规范（`Icons/svg/`）

### 1.1 输出规范

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(tx ty) scale(s)">
    ...原始内容（坐标保持原样）...
  </g>
</svg>
```

- `s  = 1024 / max(bw, bh)`
- `tx = (1024 - bw*s) / 2 - bx*s`，`ty = (1024 - bh*s) / 2 - by*s`
- `(bx, by, bw, bh)` = **可见内容包围盒**（见 §1.2）。效果：内容最长边正好 1024，另一方向等比居中留白（**已确认的语义**，非 1:1 图标不要拉伸铺满）。
- `transform` 只有 `tx/ty` 全为 0 且 `s == 1` 时才省略（如 Ehentai）。
- 文件风格：LF 换行、2 空格缩进、一个标签一行、属性不折行；不加 `<?xml?>` 声明。
- 渐变坐标**不用改**：`userSpaceOnUse` 的坐标随外层 `scale` 一起缩放；`objectBoundingBox` 本来就与坐标无关。

### 1.2 内容包围盒怎么量（关键，别用 getBBox）

- **不要用 `getBBox()`**：它不含裁剪结果，也不算滤镜/阴影产出，America / Google / Netflix 这类会明显算错。
- 正确做法：把 SVG 光栅化到 ~2048px，取 **alpha 通道**的边缘：
  - 阈值 `128` → 真实边缘（用这个定包围盒）；
  - 阈值 `3` → 连"溢出/阴影"一起算，用来判断有没有超出 viewBox。
- 用浏览器测，脚本骨架：

```js
// 载入 SVG 文本 → <img> → canvas（画布尺寸 = 按比例放大到 2048）
// 注意：cc.drawImage(img, 0, 0, W, H) 一步缩放即可，
// 带源矩形(sx,sy,sw,sh)+缩放的写法会把 SVG 画错，别用。
const upp = viewBoxW / W; // 每个像素多少用户单位
// 扫描 alpha>128 的像素，得到 x0,y0,x1,y1
const box = [vbX + x0 * upp, vbY + y0 * upp, (x1 - x0 + 1) * upp, (y1 - y0 + 1) * upp];
```

- ⚠️ 若原文件内容**超出 viewBox**（原本靠 viewport 裁掉），新文件必须补一个显式 `<clipPath>`（裁到原 viewBox 映射后的矩形），否则 Flutter 侧会把本该裁掉的部分画出来。当前 `Google.svg`、`Netflix.svg` 就是这么处理的。

### 1.3 简化规则（做，但别越界）

- **坐标统一 2 位小数**（vtracer 描摹输出默认 7 位，是体积大头）。
  - ⚠️ 必须按 SVG 路径 token 重新拼装：`.996` 取整后会变成 `1`，若直接接在后面的 `.38` 前会粘成 `1.38`（形状直接错）。规则：仅当上一个数字含 `.` 且下一个以 `.` 开头时才可省略分隔符，否则补空格。数值一律不写前导 0（`.94` 而不是 `0.94`）。
- 可以删：`<?xml?>` / `<style>` / `<title>` / `<desc>`、未被引用的 `id`、无操作 `transform`、等于默认值或继承值的属性（`fill-opacity="1"`、`stop-opacity="1"`、`offset="0%"`、`fill-rule="nonzero"`…）、没有 stroke 时的 `stroke-*`、空的 `<defs>`/`<g>`。
- 可以合并：多个 `<defs>` 合成一个；无属性的 `<g>` 摊平；只有一个子元素且属性可继承（fill/stroke/fill-rule…）的 `<g>` 下移给子元素；连续同色 `<rect>` 可合成一条多子路径的 `<path>`。
- **不能**做：把 `mix-blend-mode` 从 `style` 改写成普通属性（见 §2）；把 `<style>` 的 class 内联后又留着 `<style>`；为了"简化"改动路径几何/渐变端点。

### 1.4 逐文件特殊处理（历史包袱，勿回退）

| 文件                                       | 原写法                                                     | 处理方式与原因                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `TikTok.svg`                               | `<style>` 里 `.cls-2/.cls-3` 上色                          | 内联为 `fill`。Flutter 忽略 `<style>` → 否则 4 条路径**完全不上色**                                                            |
| `Netflix.svg`                              | 死代码 `<style>`、`style="fill:..."`、内容超 viewBox       | 内联/清理 + 显式 `clipPath`                                                                                                    |
| `Bitcoin.svg`                              | `filter` 阴影 + `mix-blend-mode` 高光                      | 删 `filter` 与两个黑色阴影 `use`（Flutter 会把阴影画成实心黑块；参考 PNG 本身也没阴影）；`mix-blend-mode` **必须留在 `style`** |
| `Line.svg`                                 | `<mask>` 做"挖空填白"                                      | 改成「气泡(渐变) + 字母(直接填白)」。Flutter 的 mask 只按形状裁剪，没有亮度语义                                                |
| `Google.svg`                               | 9 条 path 挂 `feGaussianBlur` 磨接缝                       | 删 filter + 补 `clipPath`；1024px 平均色差仅 0.5/255                                                                           |
| `Ehentai.svg`                              | 8 个 `<rect>` + 冗余 `<g>`                                 | 合成 1 条 path                                                                                                                 |
| `WorldMap.svg`                             | 只有位图，无矢量                                           | 见 §3.2（剪影描摹 + 实测线性渐变）                                                                                             |
| `ChatGPT.svg` / `Auto.svg` / `Bitcoin.svg` | 用户在统一化之后手工改过（更短的路径 / 4 空格 + 属性折行） | **不要**再按流程重跑覆盖                                                                                                       |

---

## 2. Flutter 兼容红线（flutter_svg → vector_graphics_compiler）

**支持的元素**：`svg, g, defs, use, symbol, mask, pattern, clipPath, linearGradient, radialGradient, stop, image, text, tspan, circle, path, rect, polygon, polyline, ellipse, line`

**会被忽略 / 语义不同**：

| 写法                                                                 | Flutter 行为                                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `<style>`（CSS class）                                               | 打印 `unhandled element <style/>` 并忽略 → 相关元素失去样式                                        |
| `filter` + `fe*`                                                     | 忽略 → 阴影会变成**实心色块**                                                                      |
| `<mask>`                                                             | 当作 symbol（按形状裁剪），**没有亮度蒙版语义**                                                    |
| `<title>` / `<desc>`                                                 | 静默忽略（无害）                                                                                   |
| `preserveAspectRatio` / `overflow` / `version` / `class` / `p-id` 等 | 无效，可删                                                                                         |
| `mix-blend-mode` 写成**普通属性**                                    | 浏览器忽略（Flutter 认）→ 必须写在 `style="mix-blend-mode:..."`                                    |
| `xlink:href`                                                         | 统一改写成 `href`（两边都认）                                                                      |
| 根 `viewBox` 之外的溢出                                              | 两边都会裁（`flutter_svg` 的 `clipViewbox` 默认 `true`），但重要内容别依赖它，显式 `clipPath` 更稳 |

**提交前检查清单**（写个脚本跑一遍）：

1. 根节点必须是 `width="1024" height="1024" viewBox="0 0 1024 1024"`；
2. 元素都在白名单内，且没有 `<style>` / `<filter>` / `fe*` / `<mask>` / `xlink:` / `class=`；
3. 所有 `url(#id)` 与 `href="#id"` 都能解析到定义（悬空引用 = 画面直接缺块）；
4. `clipPath` 的子元素只能是形状或 `use`。

### 2.1 渲染器健壮性：别依赖 `fill` 继承（真机踩坑）

有些 App 内嵌的 SVG 渲染器**没有正确实现 `<svg>`/`<g>` 上的 `fill` 继承**（把根级 `fill` 当成覆盖子元素的默认值）。实测症状与改法：

| 症状                                                  | 原因                                                 | 改法                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `Line.svg` 中间白色 `LINE` 字样整块变绿（本该是白字） | 根 `<svg fill="url(#a)">`，气泡 path 自己没有 `fill` | 根上**不写** `fill`；气泡 path 补 `fill="url(#a)"`，文字 `#FFF`→`#FFFFFF` |
| `WorldMap.svg` 同类风险                               | `<g fill="url(#worldmap)">` 包住 5 条 path           | 把 `fill` 下放到每条 `path` 上                                            |
| `Steam.svg` 同类风险                                  | 根 `<svg fill="#fff">` + `<symbol>` 内 path 靠继承   | 根不写 `fill`；`<symbol>` 内无 `fill` 的 path 补 `fill="#FFFFFF"`         |

**规则：`fill` 只写在真正需要上色的元素上**（`path`/`use`/形状本身），不要放在根或 `<g>` 上。

> 已验证：把 `fill` 从根/组下移到元素本身后，浏览器渲染**逐像素零差异**（Line / Steam / WorldMap 差异像素 = 0）→ 属纯加固，不改观感。

**红色基准 = 美国国旗**：`America.svg` 的红色渐变（亮端 `#F92F32`、暗端 `#C00405`，整体均值 ≈ (221,24,26)）是这套图标红色的参照。

- 渐变类：**暗端统一 `#C00405`**，亮端保留原值 → 整体略微提亮
  （YouTube `#FF4040`、China `#FF3C3B`、HongKong `#FF3F3E`、Taiwan `#FF403F`、Japan `#F73A38`、Singapore `#FC3838`）；
- **纯色 → 竖直渐变**（“和 YouTube 一样的效果”）：换掉纯色 `fill`，在同一个 `<g>` 内加
  `<defs><linearGradient gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="<内容盒高度>">`，**亮端在上、暗端在下**（与 YouTube 同向）：
  - `Ehentai.svg`：`#FF4040` → `#C00405`（与 YouTube 完全同款，内容盒 y 0~480）；
  - `Fcm.svg`（**分层多色**图标）：**千万不能**把多层压成一条整体渐变，否则花色层次全丢。正确做法是**保留原有每条 path 与各自基色**，每层各做一条**同几何范围**（同一个父 `<g>`、`y 0~1640` = 内容盒全高）的竖直渐变：**顶端 = 基色原样，底端 = 基色 × 0.88**：
    `#FECA45→#E0B23D`、`#FEA610→#E0920E`、`#FD830E→#DF730C`。
    同几何范围保证各层“变暗比例”一致 → 层次与配色关系照旧，只多了一层上亮下暗的 shading（实测整体均值 (254,185,50)→(237,173,46)，逐行色阶跳变数与原来一致）。
    **别删冗余 path**：压成 1 条剪影会差 1433 像素（外轮廓里有小缺口/小岛），且会丢掉分层。
- 量法：渲染到 1024，对满足 `R-max(G,B) > 40` 的像素求均值，看是否向 (221,24,26) 收敛；渐变类再取 y=100/300/500/700/900 的逐行均值，确认“上亮下暗”。

### 2.2 描摹轮廓外溢：用 `clipPath` 兜底

同色区域是**各自独立描摹**的轮廓，彼此会有 0.5–1px 的重叠/外溢。典型症状：`Singapore.svg` 下半白色区域的**底边与左右边缘露出红线**（白块轮廓比红块略小 → 红块从边缘探头）。

- 量法：渲染到 1024，统计"应在白区内（y ≥ 白块上边缘）却仍是红色"的像素数（修复前 205，修复后 0）；
- 修法：给外溢那组元素加 `clip-path`，裁到它该在的范围：

```xml
<defs>
    <clipPath id="redTop"><rect x="0" y="0" width="1024" height="514" /></clipPath>
</defs>
<path clip-path="url(#redTop)" fill="url(#gradient_0)" d="..." />
```

**坐标空间注意**：`clipPath` 被 `<g transform>` 内的元素引用时，默认按**它自身的用户坐标系**（已缩放的内容坐标）解析；若引用方在根级则按 1024 画布坐标。取一个"两种解释都落在白块上边缘附近"的值（如 514）最稳 —— 既不留透明缝，也不露红边。

- 验收：白区内红色像素 = 0，且分界行呈 红 → 1px 混色 → 白 的过渡（不能有整列透明）。

---

## 3. 新增/替换图标的标准流程

```
1) 取源图（png/jpg/svg）→ Icons/png/<Name>.png（命名见 §4）
2) 若只有位图 → 用 vtracer 描摹或"剪影+渐变"降级（见 3.1 / 3.2）
3) 量可见内容盒（§1.2）→ 生成 1024 版本（§1.1）+ 简化（§1.3）
4) 像素校验（§5）→ 兼容性检查（§2）
5) 同步引用：脚本/配置里的 icon 链接改成 Icons/svg/<Name>.svg（§4）
6) git add + 跑 node Test/run-tests.js（改了脚本才需要）
7) 清理所有临时文件
```

### 3.1 vtracer 描摹（位图 → 矢量）

工具不在仓库里：`%LOCALAPPDATA%\MeClash\tools\vtracer.exe`（Rust CLI，**不要**用 Python 绑定，cp314 wheel 会崩）。

```powershell
# 彩色图标（默认这套参数：色聚类 + 马赛克 + 样条 + 保留抗锯齿碎片 + 2 位小数）
vtracer.exe -i in.png -o out.svg --clustering color-cluster --hierarchical cutout `
  -m spline -f 0 -p 8 -g 2 --optimize 2 --path-precision 2
```

- `-f`（filter-speckle）：源图 ≤256px 用 `0`（保碎片、MAE 更低），更大用 `2`（否则体积暴涨）。
- 输出没有 `viewBox`，坐标在**源图像素空间**；统一化时用外层 `<g transform="scale(...)">` 映射到 1024（不要烘焙进路径）。
- CLI 输出是合法的 `<?xml version="1.0"?>`，但会带生成器注释，统一化时删掉声明与注释。
- 保真度参考：144px 源图 avg MAE(144) ≈ 6；`--upscale` 放大后再描摹**更差**，别试。

### 3.2 纯色/渐变图标：剪影 + 线性渐变（体积最小，首选）

`WorldMap.svg` 就是这么来的：

1. 用 alpha 通道做二值 mask（`alpha > 127`）→ 存成 **反相**（目标形状为黑、背景为白，因为 vtracer 黑白模式把"暗"像素当前景）；
2. `vtracer.exe -i mask.png -o bw.svg --clustering bw -m spline -f 0 --optimize 2 --path-precision 2`
   → 得到 1~5 条纯色 path（带孔洞由子路径绕向表达，别乱加 `fill-rule`）；
3. 用 PIL 对**不透明像素做逐行均值并线性拟合**，确认颜色场是（近）线性的
   （WorldMap：`rms 0.11/0.13`，几乎完美 → 两个 stop 就够）；
4. 组装：`<defs><linearGradient gradientUnits="userSpaceOnUse" .../></defs>` + `<g fill="url(#...)"` 包住 path；
5. 校验：把新 SVG 与参考 PNG 都渲染到 1024，按内容盒**逐行取不透明像素均值**比色（WorldMap 每行 Δ ≤ 1/255）。

---

## 4. 命名与引用

- 命名 **PascalCase、无下划线/连字符**；`Icons/png` 与 `Icons/svg` 必须一一对应。
- 与上游/历史名不一致的映射（改名前请对照）：

| 上游名              | 本仓库名                  |
| ------------------- | ------------------------- |
| Advertising         | `AdBlock`                 |
| United_States       | `America`                 |
| Available_1         | `Available`               |
| Google_Search       | `Google`                  |
| exhentai            | `Ehentai`                 |
| Hong_Kong           | `HongKong`                |
| Round_Robin         | `RoundRobin`              |
| TikTok              | `TikTok`                  |
| fcm / meta / pikpak | `Fcm` / `Meta` / `Pikpak` |
| World_Map           | `WorldMap`                |

- 引用格式（**CDN 前缀固定不变**）：

```
https://fastly.jsdelivr.net/gh/dukangalex/MeClash@main/Icons/svg/<Name>.svg
```

- 改完必须审计：4 个文件里所有 `fastly.jsdelivr.net/gh/dukangalex/MeClash@main/Icons/(svg|png)/...` 的目标文件都存在，且没有残留的第三方图标 CDN（Koolson / MiToverG422 / lige47）。
- jsDelivr 走 `@main` 分支，**commit + push 之后**链接才生效。
- ⚠️ Windows 下仅大小写不同的改名（`fcm.png` → `Fcm.png`）git 可能不记录 → 必要时 `git rm --cached <旧名>` 再 `git add <新名>`，保证 index 里的文件名与 URL 逐字符一致。

---

## 5. 校验方法（必做）

```powershell
# 本地静态服务（后台跑，别占终端；用完关掉）
Start-Process -FilePath "<python.exe>" -ArgumentList '-m','http.server','8765','--directory','<repo>' -WindowStyle Hidden
```

- 光栅化对比基准：把**旧文件套上同一个 `transform`** 生成"同变换旧版"，再和新文件逐像素比 1024 / 64 / 24px。
  - `drawImage(img, 0, 0, W, H)` 一步缩放；**不要**用源矩形+缩放的写法（会把 SVG 画错）。
  - 判定：除**故意**改动（去 filter 阴影、去羽化）外，**1024px 平均色差 ≤ 1/255** 才算"显示效果未变"。
- 与参考图比：`Icons/png/<Name>.png` 同尺寸渲染后逐像素/逐行比色。
- 铺满复核：新文件渲染后测可见盒，**最长边应正好 100%（1024）**，另一方向按比例、居中。
- 改过脚本/配置：`node Test/run-tests.js` 必须全绿。
- 收尾：删掉所有临时脚本/校验页/中间产物（用户明确要求过），`Test/` 只应保留 `lib/ node_modules/ suites/ package.json package-lock.json README.md run-tests.js`。

---

## 6. 环境与踩坑（Windows / PowerShell 5.1）

- ❌ 不要在 PowerShell 里写多行 `python -c "..."`：转义规则不同会让会话卡在 `>>` 续行，之后 sync 命令全被吞（要用 `.py` 文件或新开 async 终端）。
- ❌ 批量改文件禁止 `open(f,'wb').write(open(f,'rb').read()...)`：写模式会**先截断**，参数里的读取拿到空文件（曾把 32 个图标清成 0 字节；靠 git index 才恢复）。
- ✅ Python 一律用绝对路径：`C:\Users\dukangalex\AppData\Local\Python\pythoncore-3.14-64\python.exe`（脚本内用 `os.environ["TEMP"]`，别写字面 `%TEMP%`）。
- ✅ PowerShell 里 `foreach (...) {...} | ...` 会报错，用 `$arr | ForEach-Object {...}`。
- 仓库 `core.autocrlf=true`：提交时行尾会被规范化（SVG 内容不受影响），别为此改动文件。
- `Icons/svg` 里 **不要**放进位图；需要位图时放 `Icons/png`。

---

## 7. 当前图标清单（36）

`AdBlock, Airport, America, Apple, Auto, Available, Bitcoin, Bypass, ChatGPT, China, Ehentai, Emby, Fcm, Global, Google, HongKong, Japan, Line, Meta, Microsoft, Netflix, Pikpak, Proxy, RoundRobin, Server, Singapore, Spotify, Stack, Static, Steam, Taiwan, Telegram, TikTok, Twitter, WorldMap, YouTube`

每个文件里都已烘焙好 `translate(tx ty) scale(s)`，需要复现规则时直接读该文件的 `transform` 即可。
