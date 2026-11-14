// sankey: flows whose width is the amount. A flow diagram says who talks to whom; a sankey says how much, so "most of the
// traffic goes to one site" is a shape instead of a sentence.
//
// The draft writes only `flow: from | to | amount`. The columns come from the graph: a node sits one column right of its farthest
// source, so A→B, B→C, A→C draws as three columns without anyone writing a stage. A cycle is an error: there is no left-to-right
// order for it, and guessing one would draw a lie.

import { svgOpen } from '../svg/shapes.js';
import { comet } from '../svg/anim.js';
import { cubic } from './curve.js';
import { readRows, fit, typographer, take, arg, numberIn } from './parse.js';
import { ComponentError } from '../components/error.js';

const W = 900;
const X0 = 132;
const X1 = W - 132;
const TOP = 56;
const PLOT_H = 300;
const BAR_W = 14;
const NODE_GAP = 30;

const round = (n) => Math.round(n * 10) / 10;

// Longest path from a source: depth(n) = 1 + max(depth of the nodes that flow into n). A node with no source is a source, so every
// edge runs from a smaller depth to a larger one — which is what makes the columns drawable. A cycle leaves a node undecided.
function layers(nodes, flows) {
  const preds = new Map(nodes.map((n) => [n, []]));
  for (const f of flows) preds.get(f.to).push(f.from);
  const depth = new Map();
  const visit = (n, path) => {
    const known = depth.get(n);
    if (known !== undefined) return known;
    if (path.has(n)) throw new ComponentError(`sankey: ${[...path, n].join(' → ')} is a cycle; a flow has one direction`, 0);
    path.add(n);
    const list = preds.get(n);
    const d = list.length ? Math.max(...list.map((p) => visit(p, path))) + 1 : 0;
    path.delete(n);
    depth.set(n, d);
    return d;
  };
  for (const n of nodes) visit(n, new Set());
  const width = Math.max(...depth.values()) + 1;
  if (width > 4) throw new ComponentError(`sankey: ${width} columns; keep the flows to 4 stages`, 0);
  return { depth, width };
}

export default {
  name: 'sankey',
  summary: 'Flows whose width is the amount',
  roles: ['flow'],

  render(text, { args = {}, dir = 'ltr', warn } = {}) {
    const rtl = dir === 'rtl';
    const rows = readRows(text, ['flow'], 'sankey');
    const lines = take(rows, 10, 'flows', warn);
    if (!lines.length) throw new ComponentError('sankey needs at least one "flow:" line', 0);
    const unit = arg(args, 'unit', 'sankey');
    const foot = arg(args, 'note', 'sankey');

    const flows = lines.map((row) => {
      const [from, to, raw] = row.fields;
      if (!from || !to || raw === undefined) throw new ComponentError('a flow: line is `flow: from | to | amount`', row.line);
      if (from === to) throw new ComponentError(`sankey: "${from}" flows into itself`, row.line);
      const value = numberIn(raw, Number.MAX_SAFE_INTEGER, `flow ${from} → ${to}`, row.line);
      if (value <= 0) throw new ComponentError(`flow ${from} → ${to} needs an amount above 0`, row.line);
      return { from, to, value, line: row.line };
    });

    const nodes = [];
    for (const f of flows) for (const n of [f.from, f.to]) if (!nodes.includes(n)) nodes.push(n);
    if (nodes.length > 12) throw new ComponentError(`sankey: ${nodes.length} names; keep the drawing to 12`, 0);
    const { depth, width } = layers(nodes, flows);

    // One scale for the whole drawing: a link that carries twice the amount is twice as thick in every column, which is the only
    // reason to draw a band instead of a line. The gap between two bars is paid for out of the same height.
    const out = new Map(nodes.map((n) => [n, 0]));
    const into = new Map(nodes.map((n) => [n, 0]));
    for (const f of flows) {
      out.set(f.from, out.get(f.from) + f.value);
      into.set(f.to, into.get(f.to) + f.value);
    }
    const size = new Map(nodes.map((n) => [n, Math.max(out.get(n), into.get(n))]));
    const perColumn = (d) => nodes.filter((n) => depth.get(n) === d);
    const maxGaps = NODE_GAP * Math.max(...Array.from({ length: width }, (_, d) => perColumn(d).length - 1));
    const maxSum = Math.max(...Array.from({ length: width }, (_, d) => perColumn(d).reduce((a, n) => a + size.get(n), 0)));
    const scale = (PLOT_H - maxGaps) / maxSum;

    const cx = (d) => (width === 1 ? (X0 + X1) / 2 : X0 + ((X1 - X0) * d) / (width - 1));
    // A point is mirrored on a right-to-left page, so the same construction draws the same picture backwards.
    const mx = (v) => (rtl ? W - v : v);

    const t = typographer(W, dir === 'rtl');
    const [edge, anim, label] = [[], [], []];
    const placed = new Map();
    for (let d = 0; d < width; d++) {
      const column = perColumn(d);
      const used = column.reduce((a, n) => a + size.get(n) * scale, 0) + NODE_GAP * (column.length - 1);
      let y = TOP + (PLOT_H - used) / 2;
      for (const n of column) {
        const h = Math.max(6, size.get(n) * scale);
        placed.set(n, { x: cx(d), y, h, d });
        y += h + NODE_GAP;
      }
    }

    // Links: a band between two bars, filled, and a light along its middle so the direction is visible where two bands cross. Both
    // edges of a band are the same curve offset by its thickness, so the band cannot twist.
    const cursorOut = new Map(nodes.map((n) => [n, placed.get(n).y]));
    const cursorIn = new Map(nodes.map((n) => [n, placed.get(n).y]));
    flows.forEach((f, i) => {
      const a = placed.get(f.from);
      const b = placed.get(f.to);
      const h = f.value * scale;
      const y0 = cursorOut.get(f.from);
      cursorOut.set(f.from, y0 + h);
      const y1 = cursorIn.get(f.to);
      cursorIn.set(f.to, y1 + h);
      const ax = mx(a.x + BAR_W / 2);
      const bx = mx(b.x - BAR_W / 2);
      const bend = (bx - ax) * 0.5;
      const series = (i % 4) + 1;
      edge.push(`<path class="am-fx-band-link am-fx-s${series}" d="M${round(ax)},${round(y0)} C${round(ax + bend)},${round(y0)} ${round(bx - bend)},${round(y1)} ${round(bx)},${round(y1)} L${round(bx)},${round(y1 + h)} C${round(bx - bend)},${round(y1 + h)} ${round(ax + bend)},${round(y0 + h)} ${round(ax)},${round(y0 + h)} Z"/>`);
      const centre = cubic([ax, y0 + h / 2], [ax + bend, y0 + h / 2], [bx - bend, y1 + h / 2], [bx, y1 + h / 2]);
      anim.push(comet(centre.d, centre.len, { delay: round(0.2 + i * 0.12), time: 3.4, tail: 80, series, width: 2 }));
    });

    nodes.forEach((n) => {
      const p = placed.get(n);
      edge.push(`<rect class="am-fx-bar" x="${round(mx(p.x) - BAR_W / 2)}" y="${round(p.y)}" width="${BAR_W}" height="${round(p.h)}" rx="3"/>`);
      // The names of the first column sit to their left and the last column's to their right, where there is room for a long one;
      // a middle column has no room on either side, so its names go above the bars.
      if (p.d === 0) {
        label.push(t.at(p.x - BAR_W / 2 - 10, p.y + p.h / 2 + 4, fit(n, X0 - 30, 12.5), { size: 12.5, anchor: 'end', cls: 'am-fx-row' }));
      } else if (p.d === width - 1) {
        label.push(t.at(p.x + BAR_W / 2 + 10, p.y + p.h / 2 + 4, fit(n, W - X1 - 30, 12.5), { size: 12.5, anchor: 'start', cls: 'am-fx-row' }));
      } else {
        label.push(t.at(p.x, p.y - 6, fit(n, 130, 11.5), { size: 11.5, cls: 'am-fx-axis-name' }));
      }
    });

    const height = TOP + PLOT_H + (foot ? 34 : 12);
    if (foot) label.push(t.at(X0, height - 10, fit(foot, X1 - X0, 10.5), { size: 10.5, anchor: 'start', cls: 'am-fx-sub', mono: true }));

    const svg = `${svgOpen(W, height, flows.map((f) => `${f.from} → ${f.to}: ${round(f.value)}${unit}`).join(', '), dir)}<g class="am-fx-layer-edge">${edge.join('')}</g><g class="am-fx-layer-anim">${anim.join('')}</g><g class="am-fx-layer-label">${label.join('')}</g></svg>`;
    return { svg, W, H: height, boxes: t.boxes };
  },
};
