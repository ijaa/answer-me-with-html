// radar: one option against another across a handful of axes. The shape of the two polygons says more than a table of the same
// numbers: one option is a circle, the other has a dent.
// A radar has one moving part — the sweep — so it carries no light tails. That is a decision, not an omission: two things moving
// on a small drawing is noise.

import { svgOpen } from '../svg/shapes.js';
import { spin } from '../svg/anim.js';
import { sector } from './curve.js';
import { readRows, fit, typographer, take, arg, numberIn } from './parse.js';
import { defs } from './scene.js';
import { ComponentError } from '../components/error.js';

const W = 660;
const CX = 330;
const CY = 236;
const R = 148;
const AXIS_SIZE = 12;
const LEGEND_Y = 448;

export default {
  name: 'radar',
  summary: 'Two or three options across 3 to 8 axes',

  render(text, { args = {}, uid = 'fx', dir = 'ltr', warn } = {}) {
    const rows = readRows(text, ['series'], 'radar');
    const series = take(rows, 3, 'series', warn, 1);
    if (!series.length) throw new ComponentError('radar needs at least one "series:" line', 0);
    const axes = arg(args, 'axes', 'radar').split(',').map((s) => s.trim()).filter(Boolean);
    if (axes.length < 3) throw new ComponentError('radar needs axes="a, b, c" with at least 3 names', 0);
    if (axes.length > 8) throw new ComponentError(`radar takes at most 8 axes, not ${axes.length}`, 0);
    for (const s of series) {
      const values = s.fields.slice(1).filter(Boolean);
      if (values.length !== axes.length) {
        throw new ComponentError(`radar series "${s.fields[0]}" has ${values.length} values; ${axes.length} axes need ${axes.length}`, s.line);
      }
      values.forEach((v) => numberIn(v, 100, `series "${s.fields[0]}"`, s.line));
    }

    const t = typographer(W, dir === 'rtl');
    const [edge, anim, node, label] = [[], [], [], []];
    const k = axes.length;
    const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / k;
    const point = (i, v) => [CX + R * v * Math.cos(angle(i)), CY + R * v * Math.sin(angle(i))];

    // ── the grid: four nested rings and one line per axis ──
    for (const v of [0.25, 0.5, 0.75, 1]) {
      const points = axes.map((_, i) => point(i, v).map((n) => Math.round(n * 10) / 10).join(',')).join(' ');
      edge.push(`<polygon class="am-fx-ring" points="${points}"/>`);
    }
    axes.forEach((name, i) => {
      const [x, y] = point(i, 1);
      edge.push(`<line class="am-fx-axis" x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`);
      const cos = Math.cos(angle(i));
      const [lx, ly] = point(i, 1.18);
      const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
      const room = anchor === 'middle' ? 150 : anchor === 'start' ? W - lx - 6 : lx - 6;
      label.push(t.at(lx, ly + 4, fit(name, room, AXIS_SIZE), { size: AXIS_SIZE, anchor, cls: 'am-fx-axis-name' }));
    });

    // ── the polygons ──
    series.forEach((s, si) => {
      const values = s.fields.slice(1).filter(Boolean).map((v) => Number(v) / 100);
      const points = values.map((v, i) => point(i, v).map((n) => Math.round(n * 10) / 10).join(',')).join(' ');
      node.push(`<polygon class="am-fx-area am-fx-s${si + 2}" points="${points}"/>`);
      values.forEach((v, i) => {
        const [x, y] = point(i, v);
        node.push(`<circle class="am-fx-vertex am-fx-s${si + 2}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`);
      });
      // The legend: a swatch and the name, left to right, under the drawing.
      const lx = 118 + si * 178;
      node.push(`<rect class="am-fx-swatch am-fx-s${si + 2}" x="${lx}" y="${LEGEND_Y - 9}" width="9" height="9" rx="2"/>`);
      label.push(t.at(lx + 16, LEGEND_Y, fit(s.fields[0] ?? '', 148, 11.5), { size: 11.5, anchor: 'start', cls: 'am-fx-legend' }));
    });

    // ── the sweep ──
    const sweep = spin(
      `<path class="am-fx-sweep" d="${sector(CX, CY, R - 3, -0.42, 0).d}" fill="url(#${uid}-sweep)"/><line class="am-fx-sweep-line" x1="${CX}" y1="${CY}" x2="${CX + R - 3}" y2="${CY}"/>`,
      { cx: CX, cy: CY, period: 5.2 },
    );
    anim.push(sweep);
    anim.push(`<circle class="am-fx-hub" cx="${CX}" cy="${CY}" r="3.2"/>`);

    const svg = `${svgOpen(W, 480, `${axes.join(', ')}: ${series.map((s) => s.fields[0]).join(' vs ')}`, dir)}${defs(uid, { halo: false, sweep: true })}<g class="am-fx-layer-edge">${edge.join('')}</g><g class="am-fx-layer-anim">${anim.join('')}</g><g class="am-fx-layer-node">${node.join('')}</g><g class="am-fx-layer-label">${label.join('')}</g></svg>`;
    return { svg, W, H: 480, boxes: t.boxes };
  },
};
