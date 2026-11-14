// quadrant: where things sit on two axes. A decision page argues between options, and the argument is usually positional — cheap
// but slow, dear but solid. The drawing puts the options on the page, so the trade-off is a place instead of a paragraph.
//
// Items are placed by their numbers (`item: name | 0-100 | 0-100`), never by a coordinate. A label takes the first side that is
// inside the canvas and clear of every label already placed, because a scatter is the one shape whose labels the data can collide.

import { svgOpen } from '../svg/shapes.js';
import { edgeDraw, pulse } from '../svg/anim.js';
import { measure } from '../svg/text.js';
import { readRows, fit, typographer, take, numberIn } from './parse.js';
import { ComponentError } from '../components/error.js';

const W = 760;
const LEFT = 200;
const RIGHT = 600;
const BOTTOM = 462;
const TOP = 58;
const R = 5.5;
const SIZE = 12;
const GAP = 4;

const round = (n) => Math.round(n * 10) / 10;

// "cheap → dear" is one fence argument that names both ends; an arrow is the only thing a model writes for an axis range.
function ends(value) {
  const text = value === undefined || value === true ? '' : String(value).trim();
  if (!text) return null;
  const parts = text.split(/→|->/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? { low: parts[0], high: parts[1] ?? '' } : null;
}

export default {
  name: 'quadrant',
  summary: 'Options placed on two axes',
  roles: ['item'],

  render(text, { args = {}, dir = 'ltr', warn } = {}) {
    const rows = readRows(text, ['item'], 'quadrant');
    const items = take(rows, 10, 'items', warn);
    if (!items.length) throw new ComponentError('quadrant needs at least one "item:" line', 0);
    const xs = ends(args?.x);
    const ys = ends(args?.y);
    if (!xs || !ys) throw new ComponentError('quadrant needs both x="low → high" and y="low → high"', 0);

    const parsed = items.map((row) => {
      const [name, rawX, rawY] = row.fields;
      if (!name || rawX === undefined || rawY === undefined) {
        throw new ComponentError('an item: line is `item: name | x | y`, both from 0 to 100', row.line);
      }
      return {
        name,
        x: numberIn(rawX, 100, `item "${name}" x`, row.line),
        y: numberIn(rawY, 100, `item "${name}" y`, row.line),
        line: row.line,
      };
    });

    const rtl = dir === 'rtl';
    const mx = (v) => (rtl ? W - v : v);
    const px = (v) => LEFT + ((RIGHT - LEFT) * v) / 100;
    const py = (v) => BOTTOM - ((BOTTOM - TOP) * v) / 100;
    const t = typographer(W, dir === 'rtl');
    const [edge, anim, label] = [[], [], []];

    // The ink box of a label, in drawing units, before it is written: the same arithmetic the typographer does, kept here so a label
    // can be moved before it is placed. A mirrored page reflects every box, and a reflection keeps the answers to both questions the
    // loop below asks (inside the canvas, clear of the others).
    const boxAt = (cx, cy, str, size, anchor) => {
      const w = measure(str, size);
      const x0 = anchor === 'start' ? cx : anchor === 'end' ? cx - w : cx - w / 2;
      return { x0, x1: x0 + w, y0: cy - size * 0.86, y1: cy + size * 0.3 };
    };
    const taken = [];
    const write = (cx, cy, str, size, anchor, cls) => {
      taken.push(boxAt(cx, cy, str, size, anchor));
      label.push(t.at(cx, cy, str, { size, anchor, cls }));
    };

    // ── the two axes, light running out of the crossing ──
    const mid = mx(px(50));
    edge.push(edgeDraw(`M${mx(LEFT)},${py(50)} L${mx(RIGHT)},${py(50)}`, { delay: 0 }));
    edge.push(edgeDraw(`M${mid},${BOTTOM} L${mid},${TOP}`, { delay: 0.15 }));
    edge.push(`<path class="am-fx-arrow" d="M${mx(RIGHT - 9)},${py(50) - 4.5} L${mx(RIGHT)},${py(50)} L${mx(RIGHT - 9)},${py(50) + 4.5}"/>`);
    edge.push(`<path class="am-fx-arrow" d="M${mid - 4.5},${TOP + 9} L${mid},${TOP} L${mid + 4.5},${TOP + 9}"/>`);

    // Each axis is named at its two ends: "cheap → dear" reads left to right, "slow → fast" bottom to top. A name written without an
    // arrow is one end — the low end, where the axis starts.
    const along = py(50) + 24;
    write(LEFT + 8, along, fit(xs.low, 140, SIZE), SIZE, 'start', 'am-fx-sub');
    write(RIGHT - 8, along, fit(xs.high || xs.low, 140, SIZE), SIZE, 'end', 'am-fx-axis-name');
    write(LEFT - 16, BOTTOM, fit(ys.low, 150, SIZE), SIZE, 'end', 'am-fx-sub');
    if (ys.high) write(LEFT - 16, TOP + 4, fit(ys.high, 150, SIZE), SIZE, 'end', 'am-fx-axis-name');

    // ── the options ──
    parsed.forEach(({ name, x, y }, i) => {
      const cx = px(x);
      const cy = py(y);
      edge.push(`<circle class="am-fx-pt am-fx-s${(i % 4) + 1}" cx="${mx(cx)}" cy="${round(cy)}" r="${R}"/>`);
      anim.push(pulse(mx(cx), cy, R, { delay: round(0.4 + i * 0.12), period: 5.5, grow: 1.9, series: (i % 4) + 1, width: 1.2 }));

      const room = Math.min(200, Math.max(60, Math.min(W - cx - 16, cx - 16)));
      const str = fit(name, room, SIZE);
      const sides = [
        { dx: R + 8, dy: -2, anchor: 'start' },
        { dx: -R - 8, dy: -2, anchor: 'end' },
        { dx: 0, dy: -R - 10, anchor: 'middle' },
        { dx: 0, dy: R + 17, anchor: 'middle' },
        { dx: R + 8, dy: 15, anchor: 'start' },
        { dx: -R - 8, dy: 15, anchor: 'end' },
      ];
      const clear = (box) => box.x0 >= 6 && box.x1 <= W - 6
        && !taken.some((o) => box.x0 < o.x1 + GAP && box.x1 > o.x0 - GAP && box.y0 < o.y1 + 2 && box.y1 > o.y0 - 2);
      const side = sides.find((s) => clear(boxAt(cx + s.dx, cy + s.dy, str, SIZE, s.anchor))) ?? sides[0];
      write(cx + side.dx, cy + side.dy, str, SIZE, side.anchor, 'am-fx-name');
    });

    const height = BOTTOM + 44;
    const summary = `${xs.low} → ${xs.high}; ${ys.low} → ${ys.high}: ${parsed.map((p) => `${p.name} (${p.x}, ${p.y})`).join(', ')}`;
    const svg = `${svgOpen(W, height, summary, dir)}<g class="am-fx-layer-edge">${edge.join('')}</g><g class="am-fx-layer-anim">${anim.join('')}</g><g class="am-fx-layer-label">${label.join('')}</g></svg>`;
    return { svg, W, H: height, boxes: t.boxes };
  },
};
