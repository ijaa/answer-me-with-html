---
title: 文字画不出来的四种形状
subtitle: 一张流向图、一圈卫星、一份画像、一摞分层，每种只写几行
theme: blueprint
---

每块只写词和数，模板负责画，画自己会动。

## 谁把内容送进网关

```figure dataflow hub="网关" sink="每个站点"
source: X / Twitter
source: YouTube 字幕
lane: 新词 | 采集 | 去重 | 打分
lane: 站点运维 | 搜索 | 快照 | 账本
state: pushed.json | sites.csv
```

两个来源、两条流水线、两个文件。再加一个来源，左边那列就变高，枢纽跟着走，不会压上去。

## 模型周围有什么

```figure orbit center="模型"
ring1: 工具 | 一次调用
ring1: 记忆 | 这段对话
ring2: 网络 | http · dns
ring2: 文件 | 读 · 写
```

内圈是模型手上有的东西，外圈是它能到的范围。外圈那条虚线不用图例就说明了这一点。

## 两个缓存，三个轴

```figure radar axes="速度, 成本, 持久"
series: Redis | 88 | 52 | 92
series: Memcached | 95 | 90 | 12
```

Redis 更慢、更贵，但数据留得住。这张形状一眼说明，不用写一段话。

## 一次调用能走到哪一层

```figure stack note="每次调用只允许向下一层"
layer: 接入层 | API 网关 | 鉴权
layer: 服务层 | 订单 | 用户
layer: 数据层 | MySQL | Redis
```

每一块都是在代码里能找到的名字，不是为了填满画面画的方块。

## 关掉这些动

frontmatter 里写 `motion: off`，上面每张图都还在，只是光、脉冲和描边入场都没有了。打印出来的页面也是同一张静止的图，系统要求减少动态效果时同样如此。

## 三个缓存放在一起

```figure
col: 速度
col: 成本
col: 持久
row: Redis | 88 | 52 | 92
row: Memcached | 95 | 90 | 12
row: SQLite | 80 | 96 | 90
```

格子里的数就是答案，深浅只是让人先看见重点。一行写错个数，渲染会停下来指出那一行。

## 一次备份走了多少

```figure unit="GB"
flow: 采集 | 网关 | 62
flow: 网关 | 站点 A | 40
flow: 网关 | 站点 B | 22
flow: 站点 A | 归档 | 30
```

带宽就是数量，所以"大部分流量去了一个站点"是一个形状。列由流自己推出来，没人写阶段。

## 首屏还烧多少预算

```figure unit="ms" zones="80, 150" note="p95 超过 150 ms，玩家能感觉到"
gauge: 首屏渲染 | 96 | 200
gauge: 布局抖动 | 18 | 60
gauge: 首次交互 | 240 | 400
```

填充停在数值上，指针标出准确的那个数。够不到的分区不画，所以第二行只有一条干净的轨道。

## 两个缓存选哪个

```figure x="便宜 → 贵" y="慢 → 快"
item: Redis | 62 | 84
item: Memcached | 40 | 92
item: SQLite | 84 | 70
```

一条决定该用哪个，画出来是一块可以看的平面。标签自己找位置，密的时候也不会压在一起。
