// stack: layers with channels between them. The light runs upward through the channels, so the drawing says "a call goes down,
// the answer comes back up" without a word, and two channels per gap keep the motion from looking like a single arrow.

import { svgOpen } from '../svg/shapes.js';
import { comet, pulse, edgeDraw } from '../svg/anim.js';
import { line } from './curve.js';
import { measure } from '../svg/text.js';
import { readRows, fit, typographer, take, arg } from './parse.js';
import { defs, dots } from './scene.js';
import { ComponentError } from '../components/error.js';

const W = 800;
const X0 = 176;
const BAND_W = 500;
const BAND_H = 76;
const GAP = 58;
const TOP = 44;
const CHIP_H = 28;
const CHIP_PAD = 26;
const CHIP_GAP = 10;
const NAME_ROOM = 150;

export default {
  name: 'stack',
  summary: 'Stacked layers with channels between them',

  render(text, { args = {}, uid = 'fx', dir = 'ltr', warn } = {}) {
    const rows = readRows(text, ['layer'], 'stack');
    const layers = take(rows, 5, 'layers', warn, 1);
    if (layers.length < 2) throw new ComponentError('stack needs at least 2 "layer:" lines', 0);
    const H = TOP + layers.length * (BAND_H + GAP) - GAP + 12;
    const t = typographer(W, dir === 'rtl');
    const [edge, anim, node, label] = [[], [], [], []];
    const bandY = (i) => TOP + i * (BAND_H + GAP);

    layers.forEach((layer, i) => {
      const y = bandY(i);
      const name = layer.fields[0] ?? '';
      if (!name) throw new ComponentError('a layer: line needs a name before its chips', layer.line);
      const chips = layer.fields.slice(1).filter(Boolean);
      if (!chips.length) throw new ComponentError(`layer "${name}" needs at least one chip after the name`, layer.line);

      edge.push(`<rect class="am-fx-band" x="${X0}" y="${y}" width="${BAND_W}" height="${BAND_H}" rx="10"/>`);
      label.push(t.at(X0 - 18, y + BAND_H / 2 + 4, fit(name, NAME_ROOM, 13.5, { bold: true }), { size: 13.5, anchor: 'end', cls: 'am-fx-row', bold: true }));

      // Chips run left to right; the ones that do not fit are dropped with a warning instead of running out of the band.
      let x = X0 + 22;
      const drawn = [];
      for (const chip of chips) {
        const text = fit(chip, 132, 11.5);
        const width = measure(text, 11.5) + CHIP_PAD;
        if (x + width > X0 + BAND_W - 22) break;
        drawn.push({ chip, text, width, x });
        x += width + CHIP_GAP;
      }
      if (drawn.length < chips.length) {
        warn?.({ line: layer.line, message: `layer "${name}" holds at most ${drawn.length} chips: the last ${chips.length - drawn.length} are not shown` });
      }
      drawn.forEach(({ text, width, x: cx0 }, k) => {
        edge.push(`<rect class="am-fx-chip" x="${cx0}" y="${y + (BAND_H - CHIP_H) / 2}" width="${width}" height="${CHIP_H}" rx="6"/>`);
        label.push(t.at(cx0 + width / 2, y + BAND_H / 2 + 4, text, { size: 11.5, cls: 'am-fx-chip-name' }));
        anim.push(pulse(cx0 + width / 2, y + BAND_H / 2, 15, { delay: 0.5 + i * 0.45 + k * 0.25, period: 6, grow: 0.6, series: (i % 3) + 1, width: 1 }));
      });
    });

    // ── the channels between two layers, light running up ──
    for (let i = 0; i < layers.length - 1; i++) {
      const top = bandY(i) + BAND_H;
      const bottom = bandY(i + 1);
      [0.3, 0.64].forEach((fraction, k) => {
        const x = X0 + BAND_W * fraction;
        const up = line([x, bottom], [x, top]);
        edge.push(edgeDraw(up.d, { delay: 0.1 + i * 0.08, cls: 'am-fx-edge--dim' }));
        anim.push(comet(up.d, up.len, { delay: 0.3 + i * 0.4 + k * 0.25, time: 2.6, series: ((i + k) % 3) + 1, width: 2, tail: 34 }));
        edge.push(`<circle class="am-fx-port" cx="${x}" cy="${top - 3}" r="2.6"/>`);
        edge.push(`<circle class="am-fx-port" cx="${x}" cy="${bottom + 3}" r="2.6"/>`);
      });
    }

    const foot = arg(args, 'note', 'stack');
    if (foot) label.push(t.at(X0, H - 10, fit(foot, BAND_W + NAME_ROOM + 18, 10.5), { size: 10.5, anchor: 'start', cls: 'am-fx-sub', mono: true }));
    // A footnote reserves its own line, so the drawing grows instead of the text spilling below it.
    const height = foot ? H + 18 : H;

    const svg = `${svgOpen(W, height, layers.map((l) => l.fields[0]).join(' / '), dir)}${defs(uid, { halo: false })}${dots(uid, W, height)}<g class="am-fx-layer-edge">${edge.join('')}</g><g class="am-fx-layer-anim">${anim.join('')}</g><g class="am-fx-layer-node">${node.join('')}</g><g class="am-fx-layer-label">${label.join('')}</g></svg>`;
    return { svg, W, H: height, boxes: t.boxes };
  },
};
