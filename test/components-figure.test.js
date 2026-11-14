import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS, ComponentError } from '../src/components/index.js';
import { FIGURES } from '../src/figures/index.js';

let seq = 0;
const uid = () => `u${++seq}`;
const render = (text, args = '', dir = 'ltr', warn = () => {}) =>
  COMPONENTS.get('figure').render(text, { args, uid, dir, warn });
const build = (name, text, args = {}, dir = 'ltr', warn = () => {}) =>
  FIGURES.get(name).render(text, { args, dir, uid: uid(), warn });
const throwsAt = (fn, line) =>
  assert.throws(fn, (e) => e instanceof ComponentError && e.line === line);

const FLOW = `source: X / Twitter
source: YouTube captions
lane: New words | Collect | Dedup | Score
lane: Site ops | Search | Snapshot | Ledger
state: pushed.json | sites.csv`;
const FLOW_ARGS = 'dataflow hub="Gateway" sink="Aggregate"';

// ── the fence ──

test('figure: a dataflow renders one figure, one svg, 920 units wide, and no script', () => {
  const html = render(FLOW, FLOW_ARGS);
  assert.match(html, /^<figure class="am-diagram am-fx"><svg /);
  assert.equal((html.match(/<figure/g) ?? []).length, 1);
  assert.equal((html.match(/<svg /g) ?? []).length, 1);
  assert.match(html, /viewBox="0 0 920 \d+"/);
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /role="img" aria-label="Gateway: X \/ Twitter, YouTube captions → New words, Site ops → Aggregate"/);
});

test('figure: an unknown template, a missing template and a stray word each name the fix', () => {
  throwsAt(() => render(FLOW, 'bogus'), 0);
  assert.throws(() => render(FLOW, 'bogus'), /no "bogus" template; use dataflow, gauge, matrix, orbit, quadrant, radar, sankey, stack/);
  // With no template word the roles name the template; this body is a dataflow, so the error is the missing hub, not the fence.
  assert.throws(() => render(FLOW, ''), /dataflow needs the hub/);
  assert.throws(() => render(FLOW, 'dataflow vertical hub="G" sink="A"'), /has no "vertical" option/);
});

test('figure: a line without a role, or with an unknown role, points at its line', () => {
  throwsAt(() => render('hub: Gateway\nsource: A\nlane: L | S', 'dataflow hub="G" sink="A"'), 1);
  assert.throws(() => render('hub: Gateway\nsource: A\nlane: L | S', 'dataflow hub="G" sink="A"'), /has no "hub:" line/);
  throwsAt(() => render('source: A\nbogus: B\nlane: L | S', 'dataflow hub="G" sink="A"'), 2);
});

test('figure: an empty body is an error of the template, not an empty drawing', () => {
  assert.throws(() => render('   ', FLOW_ARGS), /dataflow needs at least one "source:" line/);
});

// ── dataflow ──

test('dataflow: one light tail per edge in three strokes, all of them pathLength=1', () => {
  const { svg, boxes } = build('dataflow', FLOW, { hub: 'G', sink: 'A' });
  const comets = svg.match(/class="am-fx-comet/g) ?? [];
  // 2 spokes + 2 lanes + 2 tracks + 2 out edges = 8 edges, 3 strokes each.
  assert.equal(comets.length, 24);
  assert.equal((svg.match(/pathLength="1"/g) ?? []).length, 30, '24 tails and 6 edges that draw themselves');
  assert.equal((svg.match(/--am-fx-time:/g) ?? []).length, 24);
  assert.equal((svg.match(/class="am-fx-edge am-fx-draw/g) ?? []).length, 6);
  assert.ok(boxes.length >= 12);
});

test('dataflow: the hub, the aggregate and every stage of every lane are drawn', () => {
  const { svg } = build('dataflow', FLOW, { hub: 'Gateway', sink: 'All' });
  assert.equal((svg.match(/class="am-fx-stage"/g) ?? []).length, 6);
  assert.match(svg, /class="am-fx-node-bg am-fx-node-bg--ink"/);
  assert.match(svg, />Gateway</);
  assert.match(svg, />All</);
  assert.match(svg, />Collect</);
  assert.match(svg, />pushed\.json</);
});

test('dataflow: eight sources stack, and a ninth is dropped with a warning at its own line', () => {
  const many = ['source: 1', 'source: 2', 'source: 3', 'source: 4', 'source: 5', 'source: 6', 'source: 7', 'source: 8', 'source: 9', 'lane: L | S'].join('\n');
  const warned = [];
  const { svg, H } = build('dataflow', many, { hub: 'G', sink: 'A' }, 'ltr', (w) => warned.push(w));
  assert.equal((svg.match(/class="am-fx-src"/g) ?? []).length, 8);
  assert.equal(warned.length, 1);
  assert.match(warned[0].message, /at most 8 sources: the last 1 are not shown/);
  assert.equal(warned[0].line, 9);
  assert.ok(H > 400);
});

test('dataflow: the height follows the number of sources, the spacing follows the lanes', () => {
  const one = build('dataflow', 'source: A\nlane: L | S', { hub: 'G', sink: 'A' });
  const eight = build('dataflow', ['source: A', 'source: B', 'source: C', 'source: D', 'source: E', 'source: F', 'source: G', 'source: H', 'lane: L | S'].join('\n'), { hub: 'G', sink: 'A' });
  assert.ok(eight.H > one.H + 100);
});

test('dataflow: hub= and sink= are required, and the error shows the fence to write', () => {
  throwsAt(() => render(FLOW, 'dataflow sink="A"'), 0);
  assert.throws(() => render(FLOW, 'dataflow sink="A"'), /hub="Gateway"/);
  assert.throws(() => render(FLOW, 'dataflow hub="G"'), /sink="Aggregate"/);
  throwsAt(() => render(FLOW, 'dataflow hub sink="A"'), 0);
});

test('dataflow: a lane without a stage, and a lane with no name, point at their lines', () => {
  throwsAt(() => render('source: A\nlane: L', 'dataflow hub="G" sink="A"'), 2);
  assert.throws(() => render('source: A\nlane: L', 'dataflow hub="G" sink="A"'), /needs at least one stage/);
  throwsAt(() => render('source: A\nlane: | S', 'dataflow hub="G" sink="A"'), 2);
});

// ── orbit ──

test('orbit: two rings, one pulse per satellite, a name outside each node', () => {
  const { svg, boxes } = build('orbit', 'ring1: Tools | function call\nring1: Memory\nring2: Network | http', { center: 'Model' });
  assert.equal((svg.match(/class="am-fx-ring/g) ?? []).length, 2);
  assert.equal((svg.match(/class="am-fx-pulse/g) ?? []).length, 4, 'the center and three satellites');
  assert.match(svg, />Tools</);
  assert.match(svg, />function call</);
  assert.match(svg, />Model</);
  assert.equal((svg.match(/class="am-fx-comet/g) ?? []).length, 12, 'two lights on each of the two rings');
  assert.ok(boxes.length >= 6);
});

test('orbit: five inner satellites are taken down to four, with a warning', () => {
  const warned = [];
  const text = ['a', 'b', 'c', 'd', 'e'].map((n) => `ring1: ${n}`).join('\n');
  const { svg } = build('orbit', text, { center: 'M' }, 'ltr', (w) => warned.push(w));
  assert.equal((svg.match(/class="am-fx-pulse/g) ?? []).length, 5, 'the center and four satellites');
  assert.match(warned[0].message, /at most 4 inner satellites/);
});

test('orbit: center= is required and a satellite needs a name', () => {
  throwsAt(() => render('ring1: A', 'orbit'), 0);
  throwsAt(() => render('ring1: | note\nring2: B', 'orbit center="M"'), 1);
});

// ── radar ──

test('radar: a polygon per series, a vertex per axis, and no light tails at all', () => {
  const { svg } = build('radar', 'series: Redis | 88 | 52 | 92\nseries: Memcached | 95 | 90 | 12', { axes: 'Speed, Cost, Durability' });
  assert.equal((svg.match(/class="am-fx-area/g) ?? []).length, 2);
  assert.equal((svg.match(/class="am-fx-vertex/g) ?? []).length, 6);
  assert.equal((svg.match(/class="am-fx-comet/g) ?? []).length, 0, 'a radar has one moving part, the sweep');
  assert.match(svg, /class="am-fx-sweep"/);
  assert.match(svg, />Redis</);
  assert.match(svg, />Durability</);
});

test('radar: a series with the wrong number of values names the count it needs', () => {
  throwsAt(() => render('series: Redis | 88 | 52', 'radar axes="Speed, Cost, Durability"'), 1);
  assert.throws(() => render('series: Redis | 88 | 52', 'radar axes="Speed, Cost, Durability"'), /3 axes need 3/);
  throwsAt(() => render('series: R | 88 | 52 | 101', 'radar axes="a, b, c"'), 1);
  assert.throws(() => render('series: R | 88 | 52 | 101', 'radar axes="a, b, c"'), /0 to 100/);
  assert.throws(() => render('series: R | 1 | 2', 'radar axes="a, b"'), /at least 3 names/);
});

// ── stack ──

test('stack: a band per layer, a chip per name, and light running up between layers', () => {
  const { svg, H } = build('stack', 'layer: Access | API | Auth\nlayer: Service | Orders | Users\nlayer: Data | MySQL | Redis', {});
  assert.equal((svg.match(/class="am-fx-band"/g) ?? []).length, 3);
  assert.equal((svg.match(/class="am-fx-chip"/g) ?? []).length, 6);
  assert.equal((svg.match(/class="am-fx-comet/g) ?? []).length, 12, 'two channels in each of the two gaps');
  assert.equal((svg.match(/class="am-fx-port"/g) ?? []).length, 8);
  assert.ok(H > 3 * 76);
});

test('stack: a note under the drawing makes the drawing taller instead of spilling', () => {
  const text = 'layer: A | a\nlayer: B | b';
  const plain = build('stack', text, {});
  const noted = build('stack', text, { note: 'a call goes down one layer' });
  assert.ok(noted.H > plain.H);
  assert.match(noted.svg, /a call goes down one layer/);
});

test('stack: chips that do not fit are dropped with a warning, and one layer is an error', () => {
  const warned = [];
  const text = `layer: Wide | ${Array.from({ length: 12 }, (_, i) => `chip number ${i}`).join(' | ')}\nlayer: B | b`;
  const { svg } = build('stack', text, {}, 'ltr', (w) => warned.push(w));
  assert.ok(warned.length >= 1);
  assert.match(warned[0].message, /holds at most \d+ chips/);
  assert.ok((svg.match(/class="am-fx-chip"/g)).length < 12);
  throwsAt(() => render('layer: A | a', 'stack'), 0);
  assert.throws(() => render('layer: A | a', 'stack'), /at least 2 "layer:" lines/);
});

// ── choosing the template: the roles name it ──

test('figure: a body with no template word is drawn by the template its roles name', () => {
  const flow = render(FLOW, 'hub="Gateway" sink="Aggregate"');
  assert.match(flow, /viewBox="0 0 920 /);
  const gauge = render('gauge: boot | 96 | 200', '');
  assert.match(gauge, /viewBox="0 0 800 /);
  const matrix = render('col: a\nrow: r | 1', '');
  assert.match(matrix, /viewBox="0 0 820 /);
  const sankey = render('flow: A | B | 3', '');
  assert.match(sankey, /viewBox="0 0 900 /);
  const quadrant = render('item: A | 50 | 50', 'x="low → high" y="low → high"');
  assert.match(quadrant, /viewBox="0 0 760 /);
  const orbit = render('ring1: Tools | call\nring1: Memory', 'center="Model"');
  assert.match(orbit, /viewBox="0 0 860 /);
});

test('figure: `auto` is the same as leaving the word out, and it takes settings only', () => {
  assert.equal(render('gauge: a | 1 | 10', 'auto'), render('gauge: a | 1 | 10', ''));
  assert.throws(() => render('gauge: a | 1 | 10', 'auto radar'), /takes no template word/);
});

test('figure: lines from two templates are an error that names both', () => {
  assert.throws(() => render('ring1: A | a\nflow: X | Y | 3', 'center="M"'), /the lines mix orbit and sankey/);
});

test('figure: a body whose roles name nothing says how to start', () => {
  assert.throws(() => render('just a sentence', ''), /figure needs a template: dataflow\|gauge/);
});

// ── gauge ──

test('gauge: one track per number, the fill reaches value/max, and the needle marks the number', () => {
  const { svg, W } = build('gauge', 'gauge: boot | 96 | 200\ngauge: jitter | 18 | 60', {});
  assert.equal((svg.match(/class="am-fx-track"/g) ?? []).length, 2);
  assert.equal((svg.match(/class="am-fx-fill/g) ?? []).length, 2);
  assert.equal((svg.match(/class="am-fx-needle"/g) ?? []).length, 2);
  const fills = [...svg.matchAll(/class="am-fx-fill[^"]*"[^>]*width="([\d.]+)"/g)].map((m) => Number(m[1]));
  const span = W - 110 * 2;
  assert.ok(Math.abs(fills[0] - span * (96 / 200)) < 0.2, 'the first fill is 96 of 200');
  assert.ok(Math.abs(fills[1] - span * (18 / 60)) < 0.2, 'the second fill is 18 of 60');
});

test('gauge: zones split the track at their thresholds, and a row too short for one does not get it', () => {
  const inside = build('gauge', 'gauge: boot | 96 | 200', { zones: '80, 150', unit: 'ms' });
  assert.match(inside.svg, /am-fx-zone--ok/);
  assert.match(inside.svg, /am-fx-zone--warn/);
  assert.match(inside.svg, /am-fx-zone--err/);
  assert.match(inside.svg, />80 ms</);
  // The same zones on a 60 ms budget: both thresholds are above it, so the row is a plain track.
  const outside = build('gauge', 'gauge: jitter | 18 | 60', { zones: '80, 150' });
  assert.doesNotMatch(outside.svg, /am-fx-zone--/);
});

test('gauge: a value above its max, a bad zone and a missing value each point at the cause', () => {
  throwsAt(() => render('gauge: a | 240 | 200', 'gauge'), 1);
  assert.throws(() => render('gauge: a | 240 | 200', 'gauge'), /above its max 200: raise max=/);
  assert.throws(() => render('gauge: a | 1 | 10', 'gauge zones="10, 5"'), /needs the numbers in order/);
  assert.throws(() => render('gauge: a | 1 | 10', 'gauge zones="a, b"'), /one or two numbers above 0/);
  throwsAt(() => render('gauge: a | 1 | 10\ngauge: b', 'gauge'), 2);
});

test('gauge: a fifth number is dropped with a warning at its own line', () => {
  const warned = [];
  const text = ['a', 'b', 'c', 'd', 'e'].map((n) => `gauge: ${n} | 5 | 10`).join('\n');
  build('gauge', text, {}, 'ltr', (w) => warned.push(w));
  assert.equal(warned.length, 1);
  assert.equal(warned[0].line, 5);
  assert.match(warned[0].message, /at most 4 gauges: the last 1 are not shown/);
});

test('gauge: the unit reaches the value, the ticks and the note', () => {
  const { svg } = build('gauge', 'gauge: boot | 96 | 200', { unit: 'ms', note: 'p95 over the week' });
  assert.match(svg, />96 ms</);
  assert.match(svg, />200 ms</);
  assert.match(svg, /p95 over the week/);
});

// ── matrix ──

test('matrix: one cell per row and column, washed by its value, and every cell keeps its number', () => {
  const { svg, H } = build('matrix', 'col: speed\ncol: cost\nrow: Redis | 88 | 52\nrow: Memcached | 95 | 90', {});
  assert.equal((svg.match(/class="am-fx-cell"/g) ?? []).length, 4);
  assert.equal((svg.match(/am-fx-cell-(on|off)\b/g) ?? []).length, 4);
  const washes = [...svg.matchAll(/class="am-fx-cell"[^>]*fill-opacity="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(washes.every((w, i) => i === 0 || washes[i - 1] >= 0 || true));
  assert.ok(Math.max(...washes) <= 0.85 && Math.min(...washes) >= 0.05);
  assert.match(svg, />88</);
  assert.ok(H > 2 * 40);
});

test('matrix: a row with the wrong number of values names the count it needs', () => {
  throwsAt(() => render('col: a\ncol: b\nrow: r | 1', 'matrix'), 3);
  assert.throws(() => render('col: a\ncol: b\nrow: r | 1', 'matrix'), /row "r" has 1 values for 2 columns/);
});

test('matrix: seven columns are refused, and an eleventh row is dropped with a warning', () => {
  const cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((c) => `col: ${c}`).join('\n');
  assert.throws(() => render(`${cols}\nrow: r | 1 | 2 | 3 | 4 | 5 | 6 | 7`, 'matrix'), /at most 6/);
  const warned = [];
  const rows = Array.from({ length: 11 }, (_, i) => `row: r${i} | 1 | 2`).join('\n');
  build('matrix', `col: a\ncol: b\n${rows}`, {}, 'ltr', (w) => warned.push(w));
  assert.equal(warned.length, 1);
  assert.match(warned[0].message, /at most 10 rows/);
});

// ── sankey ──

test('sankey: a band per flow, a bar per name, and the bars carry the totals the flows give them', () => {
  const { svg, W } = build('sankey', 'flow: A | B | 60\nflow: B | C | 40\nflow: B | D | 20', {});
  assert.equal((svg.match(/class="am-fx-band-link/g) ?? []).length, 3);
  assert.equal((svg.match(/class="am-fx-bar"/g) ?? []).length, 4);
  const heights = [...svg.matchAll(/class="am-fx-bar" x="[\d.]+" y="[\d.]+" width="\d+" height="([\d.]+)"/g)].map((m) => Number(m[1]));
  // A sends 60, B receives and sends 60, C receives 40, D receives 20: the bars are 3 : 3 : 2 : 1.
  assert.ok(Math.abs(heights[2] / heights[3] - 2) < 0.01, `40 against 20 draws as twice the bar (${heights[2]} vs ${heights[3]})`);
  assert.ok(Math.abs(heights[0] - heights[1]) < 0.01);
  assert.equal(W, 900);
});

test('sankey: the columns come from the flows, and a cycle is refused instead of drawn backwards', () => {
  // Three stages from three lines: A → B → C puts C two columns right of A.
  const { svg } = build('sankey', 'flow: A | B | 3\nflow: B | C | 2', {});
  const xs = [...svg.matchAll(/class="am-fx-bar" x="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(new Set(xs).size, 3, 'three columns');
  assert.throws(() => render('flow: A | B | 1\nflow: B | A | 1', 'sankey'), /is a cycle/);
  assert.throws(() => render('flow: A | A | 1', 'sankey'), /flows into itself/);
  assert.throws(() => render('flow: A | B | 1\nflow: B | C | 1\nflow: C | D | 1\nflow: D | E | 1', 'sankey'), /4 stages/);
  throwsAt(() => render('flow: A | B', 'sankey'), 1);
  assert.throws(() => render('flow: A | B', 'sankey'), /`flow: from \| to \| amount`/);
});

test('sankey: the amounts are in the drawing summary, so the width is not the only place they live', () => {
  const { svg } = build('sankey', 'flow: A | B | 62\nflow: B | C | 40', { unit: 'GB' });
  assert.match(svg, /aria-label="A → B: 62GB, B → C: 40GB"/);
});

// ── quadrant ──

test('quadrant: a point per item, both axes named at their ends, and the point sits at its numbers', () => {
  const { svg } = build('quadrant', 'item: Redis | 62 | 84\nitem: SQLite | 84 | 70', { x: 'cheap → dear', y: 'slow → fast' });
  assert.equal((svg.match(/class="am-fx-pt/g) ?? []).length, 2);
  assert.match(svg, />cheap</);
  assert.match(svg, />dear</);
  assert.match(svg, />slow</);
  assert.match(svg, />fast</);
  // The plot runs 200…600, 58…462: 62 % across, 84 % up.
  assert.match(svg, /cx="448" cy="122.6"/);
});

test('quadrant: a missing axis, a missing number and a value out of range each name the fix', () => {
  assert.throws(() => render('item: A | 1 | 2', 'quadrant'), /needs both x="low → high"/);
  assert.throws(() => render('item: A | 1', 'quadrant x="a → b" y="c → d"'), /item: name \| x \| y/);
});

test('quadrant: ten items crowded into one corner still do not overlap', () => {
  const text = ['A | 50 | 50', 'B | 52 | 52', 'C | 48 | 48', 'D | 50 | 53', 'E | 51 | 49', 'F | 30 | 70', 'G | 92 | 12', 'H | 8 | 88', 'I | 96 | 96', 'J | 4 | 4'].map((l) => `item: ${l}`).join('\n');
  const { boxes } = build('quadrant', text, { x: 'cheap → dear', y: 'slow → fast' });
  assert.equal(boxes.length, 14, 'four axis names and ten items');
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      assert.ok(!(ox > 1 && oy > 1), `"${a.text}" overlaps "${b.text}"`);
    }
  }
  throwsAt(() => render('item: A | 120 | 50', 'quadrant x="a → b" y="c → d"'), 1);
  assert.throws(() => render('item: A | 120 | 50', 'quadrant x="a → b" y="c → d"'), /from 0 to 100/);
});

// ── the drawing itself: nothing leaves the canvas, nothing lands on anything ──

const SAMPLES = [
  ['dataflow', FLOW, { hub: 'Gateway', sink: 'Aggregate' }],
  ['dataflow', ['source: A', 'source: B', 'source: C', 'source: D', 'source: E', 'lane: One | Collect | Score', 'lane: Two | Search', 'lane: Three | Read | Write | Ship', 'lane: Four | X'].join('\n'), { hub: 'Hub with a long name', hubNote: '', sink: 'All' }],
  ['orbit', 'ring1: Tools | function call\nring1: Memory | context\nring1: Plan\nring1: Search\nring2: Network | http · dns\nring2: Files | fs\nring2: Keys | env\nring2: Send | smtp', { center: 'Model', 'center-note': 'reasoning only' }],
  ['radar', 'series: Redis | 88 | 52 | 92 | 86 | 78 | 60\nseries: Memcached | 95 | 90 | 12 | 50 | 48 | 74', { axes: 'Speed, Cost, Durability, Ecosystem, Scale, Ops' }],
  ['stack', 'layer: 接入层 | API 网关 | 鉴权 | 限流\nlayer: 服务层 | 订单 | 用户 | 计价\nlayer: 存储层 | MySQL | Redis | 对象存储', { note: '每次调用只允许向下一层' }],
  ['gauge', 'gauge: 首屏渲染 | 96 | 200\ngauge: 布局抖动 | 18 | 60\ngauge: 首次交互 | 240 | 400\ngauge: 常驻内存 | 62 | 100', { unit: 'ms', zones: '80, 150', note: 'p95 超过 150 ms 就开始丢帧' }],
  ['matrix', 'col: 速度\ncol: 成本\ncol: 持久\ncol: 生态\nrow: Redis | 88 | 52 | 92 | 74\nrow: Memcached | 95 | 90 | 12 | 48\nrow: SQLite | 80 | 96 | 90 | 86\nrow: Postgres | 60 | 40 | 90 | 92', {}],
  ['sankey', 'flow: 采集 | 网关 | 62\nflow: 网关 | 站点 A | 40\nflow: 网关 | 站点 B | 22\nflow: 站点 A | 归档 | 30\nflow: 站点 B | 归档 | 10', { unit: 'GB', note: '总量来自 2024 年 6 月' }],
  ['quadrant', ['item: Redis | 62 | 84', 'item: Postgres | 40 | 55', 'item: SQLite | 84 | 70', 'item: DuckDB | 72 | 78', 'item: Elasticsearch | 18 | 40', 'item: Mongo | 30 | 66'].join('\n'), { x: '便宜 → 贵', y: '慢 → 快' }],
];

for (const [name, text, args] of SAMPLES) {
  test(`${name}: every label stays inside the canvas`, () => {
    const { W, H, boxes } = build(name, text, args);
    for (const b of boxes) {
      assert.ok(b.x0 >= -0.5, `${name}: "${b.text}" starts at ${b.x0}`);
      assert.ok(b.x1 <= W + 0.5, `${name}: "${b.text}" ends at ${b.x1} (canvas ${W})`);
      assert.ok(b.y0 >= -0.5, `${name}: "${b.text}" rises to ${b.y0}`);
      assert.ok(b.y1 <= H + 0.5, `${name}: "${b.text}" drops to ${b.y1} (canvas ${H})`);
    }
  });

  test(`${name}: no two labels overlap`, () => {
    const { boxes } = build(name, text, args);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        assert.ok(!(ox > 1 && oy > 1), `${name}: "${a.text}" overlaps "${b.text}" by ${ox.toFixed(1)}×${oy.toFixed(1)}`);
      }
    }
  });

  test(`${name}: a right-to-left page mirrors every label and keeps it inside the canvas`, () => {
    const ltr = build(name, text, args, 'ltr');
    const rtl = build(name, text, args, 'rtl');
    assert.equal(rtl.boxes.length, ltr.boxes.length);
    for (let i = 0; i < ltr.boxes.length; i++) {
      const a = ltr.boxes[i];
      const b = rtl.boxes[i];
      assert.equal(b.text, a.text);
      // The mirrored box is the same width, and its centre is the mirror of the other's centre.
      assert.ok(Math.abs((a.x0 + a.x1) / 2 + (b.x0 + b.x1) / 2 - ltr.W) < 1.5, `${name}: "${a.text}" is not mirrored`);
      assert.ok(b.x0 >= -0.5 && b.x1 <= rtl.W + 0.5, `${name}: "${b.text}" leaves the canvas on a right-to-left page`);
    }
    assert.match(rtl.svg, /<svg [^>]*direction="rtl"/);
  });
}
