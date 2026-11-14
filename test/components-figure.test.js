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
  assert.throws(() => render(FLOW, 'bogus'), /no "bogus" template; use dataflow, orbit, radar, stack/);
  assert.throws(() => render(FLOW, ''), /needs a template/);
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

// ── the drawing itself: nothing leaves the canvas, nothing lands on anything ──

const SAMPLES = [
  ['dataflow', FLOW, { hub: 'Gateway', sink: 'Aggregate' }],
  ['dataflow', ['source: A', 'source: B', 'source: C', 'source: D', 'source: E', 'lane: One | Collect | Score', 'lane: Two | Search', 'lane: Three | Read | Write | Ship', 'lane: Four | X'].join('\n'), { hub: 'Hub with a long name', hubNote: '', sink: 'All' }],
  ['orbit', 'ring1: Tools | function call\nring1: Memory | context\nring1: Plan\nring1: Search\nring2: Network | http · dns\nring2: Files | fs\nring2: Keys | env\nring2: Send | smtp', { center: 'Model', 'center-note': 'reasoning only' }],
  ['radar', 'series: Redis | 88 | 52 | 92 | 86 | 78 | 60\nseries: Memcached | 95 | 90 | 12 | 50 | 48 | 74', { axes: 'Speed, Cost, Durability, Ecosystem, Scale, Ops' }],
  ['stack', 'layer: 接入层 | API 网关 | 鉴权 | 限流\nlayer: 服务层 | 订单 | 用户 | 计价\nlayer: 存储层 | MySQL | Redis | 对象存储', { note: '每次调用只允许向下一层' }],
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
