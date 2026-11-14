# 页面动效：会动的图

页面动态化（`motion`）的设计与实现方案：让边上的光流动起来、让光到达的节点亮一下、让线自己画出来。

状态：已在 `feat/page-motion` 分支实现（目标 0.6.0）。两份样式表、原语、四个模板、`motion` 键和下面两个测试文件都在这次改动里；
§10 的 P2 不在。

---

## 1. 摘要

今天的页面准确而静止。每一张图都是静态 svg：`flow`、`state`、`sequence`、`er`、`class`、`chart`、`limits`、`tree`。读者一眼能看
到形状，但页面没有任何东西告诉他**顺序**、**方向**、**谁喂给谁**——除非文字里写了。

本方案只加两样东西：

1. **动效原语**：沿路径跑的光尾、脉冲环、闪点、描边入场。一个共享模块（`src/svg/anim.js`）加一个样式表
   （`src/themes/motion.css`）。纯 CSS，没有 javascript、没有 SMIL、没有图片。
2. **`figure` 组件**：四个模板（`dataflow`、`orbit`、`radar`、`stack`），补上现有组件画不出的信息形状：多源汇入一个枢纽、
   一个中心领两圈"够得着"、一个对象在多个维度上的轮廓、分层以及层与层之间的通道。

再加一个键 `motion: subtle | off | expressive`，决定这一页动不动。

量化目标：**每张图 3–18 KB**、**0 javascript**、**0 网络请求**、整页最多大 30 KB，并且在关掉动画、打印、或读者要求减少动态
时，图依然是完整正确的那张静态图。

## 2. 问题（有数据）

用 0.5.11 渲染的五个页面（`site/presets/*.md`、`examples/*.md`）：

| 页面 | 面板 | 图 | 表 | 字数 |
|---|---:|---:|---:|---:|
| tcp | 6 | 4 | 1 | 739 |
| repo | 3 | 2 | 0 | 435 |
| cache | 3 | 0 | 1 | 532 |
| decision | 4 | **0** | 0 | 581 |

`decision.zh.md` 就是问题的形状：4 个面板、一张图都没有，因为答案是"选 A 还是 B、为什么"，而组件集里没有"取舍"的形状，模型
只能退回散文和编号列表。"三件事按这个顺序发生"（没有时间轴形状）、"这个数到了上限的 92%"（没有仪表形状）也是同一个原因。

动效是同一个问题的另一半。tcp 上的四张图里有两张是流程图，而一张不动的流程图只是接线图：它显示相邻关系，但不显示方向、顺序、
速率。

另一条路的成本是量过的：手写一张文字转路径的动效 svg（`svg-lab` 里的草图）**221 KB**，因为每个字形都变成了 `<path>`。同样的
图内联进页面、保留 `<text>`，是 **3.3–17.8 KB**，而且页面仍然守得住 CSP 和单文件。

## 3. 范围

做：

- `motion` 键（frontmatter、`--motion`、`am config`），落在 `<html>` 的 `data-motion` 上；
- `src/svg/anim.js`：`comet`、`pulse`、`flash`、`edgeDraw`、`spin`；
- `src/themes/motion.css`：关键帧与四道闸（打印、视频、减少动态、主题）；
- `figure` 的四个模板与行式 DSL；
- `src/themes/figure.css`：图的静态外观，只用现有 token，主题可改；
- `chart` 的入场动效（行依次升起、折线自己画出、饼图淡入）——现有组件不加新语法就有动效；
- 测试、`docs/reference.md`、`SKILL.md`、打包后的 CLI。

不做，以及为什么：

- **让模型自由写 svg**：2–4k token，坐标没人能检查，等于把产品从"8 个 token 的意图"改成"上千 token 的几何"。需要时现成的
  ` ```svg ` 逃生口就在。
- **面板入场动画**（卡片滑入）：它拖慢阅读，会和每一页的 `prefers-reduced-motion` 打架，读者往回滚还要再看一遍。动效属于图，
  不属于文字。
- **滚动驱动时间轴**（`animation-timeline: view()`）：基线只有 Chromium 2026 才有，降级就是静态图，收益小、测试面大。1.0 之后
  再看。
- **工具栏上的动效开关**：读者的系统设置（`prefers-reduced-motion`）已经决定了；一个每页都有的控件要 20 种语言的标签，换来的
  是几乎没人改的设置。

## 4. 硬约束

这些不是偏好，每一条背后都有测试或产品承诺。

| 约束 | 对本次改动的含义 |
|---|---|
| CSP `default-src 'none'; img-src data:; style-src 'unsafe-inline'` | 只能用 CSS 动画；图里不能有 `<script>`、不能有雪碧图、不能有外部字体 |
| 单文件、离线 | 不用 `<img src>`，svg 内联在页面里 |
| 打印必须正确 | 不做动画的状态就是终态；打印关掉动画 |
| `am export --pdf` | 导出前模拟 `prefers-reduced-motion: reduce` |
| `am video` | `html[data-video]` 下关掉动效；视频有自己的时钟 |
| 主题：`THEME_SELECTORS` 只增不改（16 个选择器） | 图只能用自己的 class 和现有 token，不能让主题去认识新选择器 |
| 读者要求减少动态 | `prefers-reduced-motion: reduce` 撤掉所有动画，效果等同打印 |
| 1/8 token 的承诺 | 模型只写数据，不写坐标、不写样式 |
| RTL 页面 | 图按 `flow`、`chart` 的办法镜像；文字只换位置，不翻字 |
| 运行时脚本之外没有 javascript | 动效不做交互 |

## 5. 设计

### 5.1 键

```yaml
motion: subtle     # subtle（默认）| off | expressive
```

- `off`：`motion.css` 根本不进页面。图就是它一直以来的静态样子，没有东西要撤销，没有运行时分支要测。
- `subtle`：一进入场（线 0.4–0.6 s 画出，柱子相隔 55 ms 依次升起）加慢速的环境循环（一道光尾穿过一条边 4–6 s，一圈脉冲 4.8 s
  淡完）。
- `expressive`：同一套规则，更快——循环取 80% 时长，入场 0.35 s。只差一个变量 `--am-fx-phase`，所以两档不会走样。

键写在根上：`<html … data-motion="subtle">`，和 `data-theme`、`data-mode` 并排。因为是属性，`am patch` 会保留它，主题覆盖不了
它，宿主页面也能改它。

命令行与配置沿用现有路子：`src/parse.js` 的 `CHOICES.motion`、`src/config.js` 的 `CONFIG_KEYS.motion`、`src/cli.js` 的
`--motion`，于是 `am render --motion expressive` 与 `am config set motion off` 都能用。

### 5.2 第一层：原语

`src/svg/anim.js` 导出五个函数。每个函数返回带 class 和内联自定义属性的 svg 片段，从不把坐标写进样式表，也从不自带关键帧。

```js
// 沿路径从头跑到尾的光尾：三条描边，同一个头，身后是一条长而淡的尾。
// pathLength="1" 让 dash 长度变成"占全长的比例"，于是同一条规则能推 20 px 的短边，也能推 900 px 的长边。
export function comet(d, len, { delay = 0, speed = 620, tail = 118, series = 1, width = 2.4 } = {}) {
  const norm = tail / len;
  const time = (len + tail + 8) / speed;
  const layer = (keep, cls) => {
    const a = Math.max(0.004, norm * keep);
    return `<path class="am-fx-comet am-fx-s${series} ${cls}" d="${d}" pathLength="1"
      style="--am-fx-delay:${round(delay)}s;--am-fx-time:${round(time)}s;--am-fx-from:${a};--am-fx-to:${-(1 + norm * (1 + keep))};--am-fx-dash:${a} 2;stroke-width:${width}"/>`;
  };
  return layer(1, 'am-fx-tail') + layer(0.5, 'am-fx-mid') + layer(0.16, 'am-fx-head');
}
```

`pathLength="1"` 为什么重要：没有它，每条路径都要把自己的长度算进 `stroke-dasharray`，调用方得跟着布局变化同步维护；有了它，
一条关键帧服务页面里所有路径：

```css
@keyframes am-fx-travel { from { stroke-dashoffset: var(--am-fx-from) } to { stroke-dashoffset: var(--am-fx-to) } }
@keyframes am-fx-draw   { from { stroke-dashoffset: 1 } }
@keyframes am-fx-pulse  { 0% { opacity: 0; transform: scale(1) } 3% { opacity: .7 } 24% { opacity: 0; transform: scale(var(--am-fx-grow, 1.5)) } 100% { opacity: 0 } }
```

`pulse` 返回 `<g>` 里的 `<circle>`，配 `transform-box: fill-box; transform-origin: center`，于是 `scale()` 从自己的圆心长开，不需要
在用户坐标系里写 `transform-origin`。`flash` 是一个每个周期闪一次的小实心圆。`spin` 是绕显式 `transform-origin` 转的虚线环或
扫描扇区。`edgeDraw` 是"这条边要自己画进去"时的样子：`pathLength="1"` 加一个 class。

两条规矩让原语保持诚实：

1. **任何原语都不是图正确的前提。** 删掉 `motion.css`，图里照样有边、有节点、有标签，只是光尾不见了（它们是 `opacity: 0`，
   由动画规则打开）。
2. **任何原语都不知道颜色。** 系列号变成 `am-fx-s1 … am-fx-s4`；`figure.css` 把它们映射到 `--series-1 … --series-4` 并带兜底，
   于是设了图表 token 的主题连光尾的颜色一起改。

### 5.3 第二层：`figure` 组件与它的 DSL

`figure` 是一个组件，第一个参数是模板名：

````
```figure dataflow hub="网关" sink="聚合"
source: X / Twitter
source: YouTube 字幕
lane: 新词监控 | 采集 | 去重 | 打分
lane: 站点运营 | 搜词 | 快照 | 台账
state: pushed.json | sites.csv
```
````

四个模板共用一套行语法：`角色: 字段 | 字段 | 字段`，其余设置从围栏参数里按 `key="value"` 取（`src/attrs.js` 的
`parseAttrs`，和 `chart` 用的是同一个）。模型写名字和数字，从不写坐标、宽度、颜色。

本版的四个模板：

| 模板 | 信息形状 | 接收的数据 |
|---|---|---|
| `dataflow` | 多源汇入枢纽、再分出去、最后汇总，以及跑完留下的文件 | `source:`（1–8）、`lane:`（1–4，名字 + 1–3 个阶段）、`hub=`、`hub-note=`、`sink=`、`state:`（≤6 个文件） |
| `orbit` | 一个中心，内圈是够得着的，外圈是边界 | `center=`、`center-note=`、`ring1:`（2–4）、`ring2:`（2–6），每行 `标签 \| 注` |
| `radar` | 一个选项对另一个选项，跨 3–8 个轴 | `axes="a, b, c"`、`series:`（1–3，名字 + 每个轴一个 0–100 的值） |
| `stack` | 分层，层与层之间有通道 | `layer:`（2–5，层名 + 2–6 个 chips） |

每个模板自己算画布：高度跟着行数走，枢纽落在它那一列来源的中间，轨道间距跟着流水线条数走，环上的角度平均分。传 5 个来源而不
是 8 个，得到一张更矮的图，代码一行没改——这就是"模板"和"一张画"的区别。

文字用 `src/svg/text.js` 的 `measure()` 与 `wrap()` 量，和 `flow`、`chart` 是同一把尺，所以 CJK 标签在页面上的宽度就是这个模块
以为的宽度。放不下的标签在渲染时缩短；超出容量、排不进画布的图会被截断并给一条**警告**（`warn({ line, message })`，现成的
通道），而不是画成一团。

### 5.4 第三层：注册表与选型

```
src/figures/index.js     注册表：name → { summary, args, render }
src/figures/parse.js     行语法，共用
src/figures/dataflow.js  一个模板一个文件，120–200 行
src/figures/orbit.js
src/figures/radar.js
src/figures/stack.js
src/components/figure.js 组件：分派模板、错误文案、外包一层
```

`src/components/figure.js` 故意很薄：校验模板名、调 `FIGURES.get(name).render(rows, opts)`、返回
`<figure class="am-diagram am-fx">…</figure>`。数据上的一切错误都由模板带着行号用 `ComponentError` 报出来，和其它组件一样。

自动选型（不给模板名，按数据形状挑一个）**不在本版**：猜错就画错，而读者看不出那是猜的。等四个模板被真实草稿用过之后再说
（见 §10）。

### 5.5 文件

| 文件 | 改动 |
|---|---|
| `src/svg/anim.js` | 新增——五个原语 |
| `src/figures/{curve,scene}.js` | 新增——路径长度、点阵、渐变、一个圆节点 |
| `src/figures/{index,parse,dataflow,orbit,radar,stack}.js` | 新增 |
| `src/components/figure.js` | 新增 |
| `src/components/index.js` | 注册 `figure` |
| `src/themes/figure.css` | 新增——静态外观，只用 token |
| `src/themes/motion.css` | 新增——关键帧与闸 |
| `src/assets.js` | `FIGURE_CSS`、`MOTION_CSS` |
| `src/themes/index.js` | `pageCss(…, { figure, motion })` |
| `src/render.js` | 检测图/图表，传两个开关，把 `motion` 传进 shell |
| `src/page.js` | `rootTag` 写 `data-motion`；`readPage` 读回来给 `am patch` |
| `src/parse.js` | `CHOICES.motion`、`DEFAULT_META.motion` |
| `src/config.js` | `motion` 配置键 |
| `src/cli.js` | `--motion`、用法行、`format` 说明行 |
| `scripts/inline-assets.mjs` | 两份样式表进打包的 CLI |
| `docs/reference.md`、`docs/reference.zh-CN.md` | 组件与键 |
| `skills/answer-me-with-html/SKILL.md` | 组件清单加一行 |
| `test/components-figure.test.js`、`test/motion.test.js` | 新增 |

## 6. 四个模板长什么样

体积来自已实现的 `src/figures/*.js`，按 `measure()` 量：一张小图和一张满容量图。

| 模板 | 小图 | 满容量 | 光尾，小 → 满 |
|---|---|---|---|
| `dataflow` | 2 来源、2 流水线、6 阶段、2 文件——920×348，**10.3 KB** | 8 来源、4 流水线、12 阶段——920×480，**22.4 KB** | 24 → 60 |
| `orbit` | 内 2、外 2——860×470，**5.4 KB** | 内 4、外 6——860×470，**7.5 KB** | 12 → 12 |
| `radar` | 3 轴、2 系列——660×480，**2.4 KB** | 8 轴、3 系列——660×480，**5.0 KB** | 0 → 0 |
| `stack` | 3 层、6 块——800×400，**6.0 KB** | 5 层、30 块、一行注——800×686，**17.2 KB** | 12 → 24 |

**dataflow**——来源在左竖排，各自弯进枢纽；枢纽扇出到流水线；每条流水线是一条轨道，每个阶段一个站点，光经过时闪一下；流水线
弯进汇总，汇总在光到达时闪一下；跑完留下的文件排在底部一条细线下，读者可以直接去看。枢纽带光晕。没有回环弧：回环需要的路径
长度读者数不出来，底部那行状态说的才是能核对的东西。

**orbit**——1 个中心，两圈椭圆上的卫星均分角度；光每 3.2–5 s 沿各自轨道跑一圈，每颗卫星带着解释它的小字。外圈虚线且更淡——
"边界之外"不需要图例就能读出来。

**radar**——四层嵌套多边形，每个轴一条线，每条序列一个填 12% 的多边形，一个带渐变边的扫描扇区每 5.2 s 转一圈。完全没有
光尾：雷达只有一个运动件。

**stack**——带块的色带；每两层之间两条通道，光向上走；可选一行规则注脚（"每次调用只允许向下一层"）。

## 7. 动效预算

动画的代价不是均匀的，页面在 2019 年的笔记本上也要顺。

| 原语 | 动什么 | 代价 | 满容量图上的实测 |
|---|---|---|---|
| 光尾 | `stroke-dashoffset` | 重绘，不是合成 | 60（dataflow，20 条边 × 3 层） |
| 脉冲 / 闪点 | `transform`、`opacity` | 合成 | 26（dataflow）、30 圈（stack） |
| 描边入场 | `stroke-dashoffset`，只跑一次 | 重绘，会结束 | 12 条边，一次 |
| 旋转 / 扫描 | `transform` | 合成 | 1（radar） |

每条边三层，一道光才像彗星而不是一段虚线：一条很淡的长尾、一段亮的中段、一个点，都在同一条路径上，不会跑散。所以满容量的图
大约有 90 个运动元素，而典型的回答页（2 个来源、2 条流水线）只有 30 个。这也是模板要有容量的原因：限制才是把一页的重绘代价
兜住的东西，而且由模板执行，不靠模型自觉。`subtle` 与 `expressive` 不改数量，只改时间。

在四张图（85 个运动元素、48 道光尾、1280 px 宽、headless Chromium）的页面上实测：三秒内帧时间中位数 16.7 ms、95 分位
16.8 ms——60 fps，光尾的重绘留在主线程。全局不用 `will-change`：85 个被提升的图层比这点重绘更吃内存。

模板遵守的规则：

- 一张图一个全局周期（4.8 s），不同节点的脉冲同相位，不会把画面变成噪音；
- 光尾的时长跟着边长走（速度 620 单位/秒），长边走得久，眼睛读到的才是同一个速度；
- 光尾在它经过的那条线画完之后才出发；
- 只靠"静止"表达含义的路径（边界、上限线）不做动画。

## 8. 失效模式

| 情况 | 结果 |
|---|---|
| `motion: off` | `motion.css` 不进页面，图是静态且完整的 |
| `prefers-reduced-motion: reduce` | 一条媒体查询撤掉所有动画，光尾保持 `opacity: 0` |
| 打印 / `am export --pdf` | `@media print` 撤掉动画并隐藏光尾；导出器还会在截图前模拟减少动态 |
| `am video` | `html[data-video]` 撤掉动画；`figure` 是 `pageOnly`，视频草稿得到一条错误，而不是一帧坏画面 |
| 不支持 `pathLength` 或动画被关掉的浏览器 | 静态图：边是实线，节点和标签都在原位 |
| 主题颜色很怪 | 图读 `--series-*`、`--paper`、`--ink`；主题一个都不设就用兜底色 |
| RTL 页面 | 几何过 `mirror()`，文字锚点对调，`svgOpen(…, 'rtl')` 标记方向 |
| 图比面板宽 | svg 带 `width`/`height`，现有的盒子规则会缩它；图不会溢出卡片 |
| 草稿写了 20 个来源 | 那一行给警告，画前 8 个 |

## 9. 测试

**`test/components-figure.test.js`**——每个模板：

- 四个模板都渲染出 `am-fx` 图，带 `aria-label` 标签，且没有 javascript；
- 容量：9 个来源 → 警告 + 画 8 个；内圈 5 颗卫星 → 警告 + 画 4 颗；放不下的块被丢掉，警告指出第一条被丢的行；只有一层或空正文 →
  在那一行报错；
- 语法：未知角色、缺字段、值超出 0–100、序列值的个数不对、缺 `hub=` 或 `center=` → `ComponentError` 且行号正确；
- 几何：排版器记下每个标签的墨迹盒，测试断言任意两个盒子不重叠、每个盒子都在画布内——四个模板、小图和满容量图都测；
- 动效标记：`dataflow` 每条边三道 `pathLength="1"` 光尾；`radar` 没有光尾；图表不改标记，视频模式下它照样一行一行地长；
- RTL：每个盒子都是 LTR 盒子关于画布中心的镜像，且仍然都在画布内。

**`test/motion.test.js`**——页面级：

- 默认 `subtle`，`data-motion` 在根标签上、紧挨 `data-mode`；
- `motion: off` → 页面里没有 `am-fx-travel`；`subtle` → 有；
- `--motion expressive` 覆盖草稿；非法值是 `ParseError` 并列出可选项；
- 有图的页面带 `figure.css`；没有图形的页面两个样式表都不带；
- `figure` 是 `pageOnly`，视频草稿拿到的是错误，而不是只画一半的图；
- `am patch` 能从页面上把设置读回来（`readPage`）；
- 读者的字号仍然会缩放整张图（`scale: 1.2` → `width="1104"`）；
- `motion.css` 里有打印与减少动态两道闸（文本断言，因为不解析 css）。

**快照**——`npm run snapshot` 重新生成示例；差异里只应出现新增的 `<style>` 块和那个新属性。

## 10. 落地

| 步骤 | 内容 | 关卡 |
|---|---|---|
| P0——**本次改动** | 原语 + `motion.css` + 图表整体浮入 | 不加新语法；现有快照只在 `<style>` 块和根标签上有差异 |
| P1——**本次改动** | `figure` 四个模板 + DSL + 文档 | 带图的草稿能渲染、能打印、能导出 |
| P2——尚未 | 四个模板打磨，补 `timeline`、`sankey`、`matrix`、`gauge`；自动选型 | 等真实草稿用上四个模板之后 |
| P3 | scene spec：一小段节点/边/组的 JSON，由编译器排版 | 只有 P2 证明模板覆盖不了真实草稿时才做 |

版本策略：`motion` 与 `figure` 都是加法。0.5.x 做的页面在 0.6.0 下用 `motion: off` 渲染结果不变，唯一的差别是多了一个属性，以及
有图的页面多带一个样式表。

## 11. 风险

| 风险 | 应对 |
|---|---|
| 会动的页面分散阅读注意力 | 动效只在图上，一个全局周期，文字不动；有 `motion: off` |
| 弱机器上的重绘代价 | 模板容量封住边的数量（最坏 60 道光尾，典型一张图 24 道），脉冲与闪点走合成，一个周期 |
| DSL 变成第二门要学的语言 | 四个模板一套语法，一行一个元素，报错说清行号和改法 |
| 图很快过时 | 模板是代码不是数据；重设计是改文件，不是迁移 |
| 主题够不到新图 | 每个颜色都是带兜底的 token；选择器契约不变 |
| Bug：会动但打印是白图 | 打印与减少动态测试，加上"静态态就是终态"的规矩 |

## 12. 验收标准

一个 `motion: subtle`、含一张 `figure dataflow` 的页面：

1. 单文件、离线渲染，除现有运行时外没有 javascript，没有新的网络请求；
2. 整页增加 ≤ 30 KB（样式表 + 图）；
3. 打印与导出 PDF 后每个标签、每条边、每个节点都在，没有光尾；
4. 读者要求减少动态时完全没有动画；
5. 在 `dir="rtl"` 页面上镜像且可读；
6. `npm test` 通过，图里零标签重叠、零标记出界；
7. 渲染耗时与今天相差 5 ms 以内。

## 13. 待定

- `subtle` 该默认开，还是先默认 `off` 放一个版本？提案是默认开：不动正是要修的那个问题。
- `figure` 要不要 `title=` 参数在图上加标题，还是面板标题就够了？提案是只用面板标题，和 `chart` 一致。
- `expressive` 值不值得单独一档，还是只是一个没人调的 `--am-fx-phase`？提案是保留这个名字，变量留在内部。
