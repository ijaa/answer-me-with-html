---
title: Four shapes that words cannot draw
subtitle: A dataflow, a set of satellites, a profile and a stack, each from a few lines
theme: blueprint
---

Each block writes words and numbers. The template draws the rest, and the drawing moves on its own.

## What feeds the gateway

```figure dataflow hub="Gateway" sink="Every site"
source: X / Twitter
source: YouTube captions
lane: New words | Collect | Dedup | Score
lane: Site ops | Search | Snapshot | Ledger
state: pushed.json | sites.csv
```

Two sources, two lanes, two files. Add a source and the column grows; the hub moves with it instead of overlapping it.

## What sits around the model

```figure orbit center="Model"
ring1: Tools | one call
ring1: Memory | this chat
ring2: Network | http · dns
ring2: Files | read · write
```

The inner ring is what the model holds in hand. The outer ring is what it can reach. The dashed outer path says so without a legend.

## Two caches, three axes

```figure radar axes="Speed, Cost, Durability"
series: Redis | 88 | 52 | 92
series: Memcached | 95 | 90 | 12
```

Redis is slower and dearer, and keeps its data. The shape says that in one glance and in no sentences.

## Where a call may go

```figure stack note="a call may go down one level only"
layer: Access | API | Auth
layer: Service | Orders | Users
layer: Data | MySQL | Redis
```

Every block is a name the reader can find in the code, not a box drawn to fill space.

## Turning the movement off

`motion: off` in the frontmatter keeps every drawing above and removes the light, the pulses and the draw-in. A printed page shows the same still picture, and so does a reader who asks the system for less motion.
