// gauge: one number against a scale, with the zones that give it meaning. `limits` says "13 of 20"; a gauge says "118 of 200,
// and 150 is where it turns bad". The fill grows in when the page opens, and stops at the value, so the reader sees the distance
// to the threshold before reading anything.
//
// The scale is a drawing, not a chart: there is no axis arithmetic, one row per number, and the value never leaves 0..max.

import { svgOpen } from '../svg/shapes.js';
import { flash } from '../svg/anim.js';
import { readRows, fit, typographer, take, arg, numberIn } from './parse.js';
import { ComponentError } from '../components/error.js';

const W = 800;
const TOP = 30;
const ROW = 96;
const X0 = 110;
const X1 = W - 110;
const TRACK_Y = 34;
const TRACK_H = 12;

const round = (n) => Math.round(n * 10) / 10;

// zones="80, 150": thresholds on the same scale as the values, so a zone reads as "after 80 of 200". One threshold marks where the
// number turns bad; two add a warn band between them. A threshold above a row's max does not apply to that row: the row is short
// enough that it never gets there.
function readZones(raw, template) {
  if (!raw) return [];
  const parts = String(raw).split(',').map((s) => Number(s.trim()));
  if (!parts.length || parts.length > 2 || parts.some((n) => !Number.isFinite(n) || n <= 0)) {
    throw new ComponentError(`${template}: zones= takes one or two numbers above 0, as zones="80, 150"`, 0);
  }
  if (parts.length === 2 && !(parts[0] < parts[1])) {
    throw new ComponentError(`${template}: zones= needs the numbers in order, as zones="80, 150"`, 0);
  }
  return parts;
}

export default {
  name: 'gauge',
  summary: 'Numbers against a scale, with a threshold zone',
  roles: ['gauge'],

  render(text, { args = {}, dir = 'ltr', warn } = {}) {
    const rows = readRows(text, ['gauge'], 'gauge');
    const gauges = take(rows, 4, 'gauges', warn);
    if (!gauges.length) throw new ComponentError('gauge needs at least one "gauge:" line', 0);
    const unit = arg(args, 'unit', 'gauge');
    const foot = arg(args, 'note', 'gauge');
    const t = typographer(W, dir === 'rtl');
    const [edge, anim, label] = [[], [], []];
    const span = X1 - X0;

    // max comes from the longest line, so zones can be validated once for the whole drawing; a page may gauge a 200 ms budget
    // and a 5 % error rate on one row each.
    const parsed = gauges.map((row) => {
      const name = row.fields[0] ?? '';
      if (!name) throw new ComponentError('a gauge: line needs a name before its value', row.line);
      if (row.fields.length < 2) throw new ComponentError(`gauge "${name}" needs a value after the name`, row.line);
      const value = numberIn(row.fields[1], Number.MAX_SAFE_INTEGER, `gauge "${name}"`, row.line);
      const max = row.fields[2] === undefined ? 100 : numberIn(row.fields[2], Number.MAX_SAFE_INTEGER, `gauge "${name}" max`, row.line);
      if (max <= 0) throw new ComponentError(`gauge "${name}" max must be above 0`, row.line);
      if (value > max) throw new ComponentError(`gauge "${name}" is ${value}, above its max ${max}: raise max=`, row.line);
      return { name, value, max, line: row.line };
    });
    const zones = readZones(arg(args, 'zones', 'gauge'), 'gauge');
    const unitLabel = (n) => `${round(n)}${unit ? ` ${unit}` : ''}`;

    parsed.forEach(({ name, value, max }, i) => {
      const y = TOP + i * ROW;
      const at = (v) => X0 + (span * v) / max;
      const end = at(value);
      label.push(t.at(X0, y + 6, fit(name, span, 13.5, { bold: true }), { size: 13.5, anchor: 'start', cls: 'am-fx-row', bold: true }));
      label.push(t.at(X1, y + 6, unitLabel(value), { size: 15, anchor: 'end', cls: 'am-fx-row', bold: true, mono: true }));

      edge.push(`<rect class="am-fx-track" x="${X0}" y="${y + TRACK_Y}" width="${span}" height="${TRACK_H}" rx="${TRACK_H / 2}"/>`);
      // The zones are drawn before the fill, so the fill covers them where the value already passed: the reader sees how far the
      // number went into the bad end instead of a color that says nothing about the distance.
      const inside = zones.filter((z) => z < max);
      const bands = [];
      if (inside.length === 1) bands.push([0, inside[0], 'ok'], [inside[0], max, 'err']);
      if (inside.length === 2) bands.push([0, inside[0], 'ok'], [inside[0], inside[1], 'warn'], [inside[1], max, 'err']);
      for (const [from, to, kind] of bands) {
        edge.push(`<rect class="am-fx-zone am-fx-zone--${kind}" x="${round(at(from))}" y="${y + TRACK_Y}" width="${round(((to - from) / max) * span)}" height="${TRACK_H}" rx="${TRACK_H / 2}"/>`);
      }

      // The fill is the full width of the value at rest, and the stylesheet grows it from nothing: a still page shows the bar,
      // a moving one shows it arrive, and neither writes a length into a keyframe.
      const width = round(end - X0);
      if (width > 0) {
        edge.push(`<rect class="am-fx-fill am-fx-s1${dir === 'rtl' ? ' am-fx-fill--rev' : ''}" x="${X0}" y="${y + TRACK_Y}" width="${width}" height="${TRACK_H}" rx="${TRACK_H / 2}" style="--am-fx-delay:${round(i * 0.18)}s"/>`);
      }
      // The needle marks the exact number; the flash says the fill has arrived.
      edge.push(`<line class="am-fx-needle" x1="${round(end)}" y1="${y + TRACK_Y - 7}" x2="${round(end)}" y2="${y + TRACK_Y + TRACK_H + 7}"/>`);
      anim.push(flash(end, y + TRACK_Y + TRACK_H / 2, 3.4, { delay: round(0.8 + i * 0.18), period: 9, series: 1 }));

      label.push(t.at(X0, y + TRACK_Y + TRACK_H + 22, unitLabel(0), { size: 10.5, anchor: 'start', cls: 'am-fx-sub', mono: true }));
      label.push(t.at(X1, y + TRACK_Y + TRACK_H + 22, unitLabel(max), { size: 10.5, anchor: 'end', cls: 'am-fx-sub', mono: true }));
      for (const threshold of inside) {
        label.push(t.at(at(threshold), y + TRACK_Y + TRACK_H + 22, unitLabel(threshold), { size: 10.5, cls: 'am-fx-sub', mono: true }));
      }
    });

    const height = TOP + parsed.length * ROW + (foot ? 22 : 0);
    if (foot) label.push(t.at(X0, height - 6, fit(foot, span, 10.5), { size: 10.5, anchor: 'start', cls: 'am-fx-sub', mono: true }));

    const svg = `${svgOpen(W, height, parsed.map((g) => `${g.name} ${unitLabel(g.value)}/${unitLabel(g.max)}`).join('; '), dir)}<g class="am-fx-layer-edge">${edge.join('')}</g><g class="am-fx-layer-anim">${anim.join('')}</g><g class="am-fx-layer-label">${label.join('')}</g></svg>`;
    return { svg, W, H: height, boxes: t.boxes };
  },
};
