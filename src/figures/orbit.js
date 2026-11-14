// orbit: one center, an inner ring of what it can reach, an outer ring of where the boundary is.
// The two rings are ellipses, and the satellites sit at even angles on them: the order in the draft sets the angle, the radius
// sets the ring, and adding a satellite moves the others instead of overlapping one.

import { svgOpen } from '../svg/shapes.js';
import { comet, pulse } from '../svg/anim.js';
import { ellipse } from './curve.js';
import { readRows, fit, typographer, take, arg } from './parse.js';
import { defs, dots, roundNode } from './scene.js';
import { ComponentError } from '../components/error.js';

const W = 860;
const CX = 430;
const CY = 232;
const RING = [{ rx: 214, ry: 118, r: 27 }, { rx: 308, ry: 172, r: 24 }];

export default {
  name: 'orbit',
  summary: 'One center with an inner and an outer ring',

  render(text, { args = {}, uid = 'fx', dir = 'ltr', warn } = {}) {
    const rows = readRows(text, ['ring1', 'ring2'], 'orbit');
    const inner = take(rows.filter((r) => r.role === 'ring1'), 4, 'inner satellites', warn, 1);
    const outer = take(rows.filter((r) => r.role === 'ring2'), 6, 'outer satellites', warn, 1);
    if (!inner.length) throw new ComponentError('orbit needs at least one "ring1:" line', 0);
    const center = arg(args, 'center', 'orbit');
    if (!center) throw new ComponentError('orbit needs the center: write ```figure orbit center="Model"', 0);
    const note = arg(args, 'center-note', 'orbit');

    const t = typographer(W, dir === 'rtl');
    const [edge, anim, node, label] = [[], [], [], []];
    const longest = Math.max(...RING.map((g) => ellipse(CX, CY, g.rx, g.ry).len));

    node.push(`<circle class="am-fx-halo" cx="${CX}" cy="${CY}" r="210" fill="url(#${uid}-halo)"/>`);

    // ── the two rings, each with two lights running round it ──
    RING.forEach((ring, k) => {
      const e = ellipse(CX, CY, ring.rx, ring.ry);
      edge.push(`<path class="am-fx-ring${k ? ' am-fx-ring--dim' : ''}" d="${e.d}"/>`);
      const time = Math.round((3.2 + 1.8 * (e.len / longest)) * 10) / 10;
      for (let i = 0; i < 2; i++) {
        anim.push(comet(e.d, e.len, { delay: 0.3 + k * 0.4 + i * (time / 2), time, series: (k + i) % 2 ? 2 : 1, width: 2, tail: 90 }));
      }
    });

    // ── the satellites, at even angles, with their names outside the rings ──
    [inner, outer].forEach((items, k) => {
      const ring = RING[k];
      items.forEach((item, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
        const cos = Math.cos(angle);
        const x = CX + ring.rx * cos;
        const y = CY + ring.ry * Math.sin(angle);
        const series = (i % 3) + 1;
        node.push(roundNode(t, x, y, ring.r, { fill: i % 2 ? 'paper' : 'bg' }));
        anim.push(pulse(x, y, ring.r, { delay: 0.8 + k * 0.3 + i * 0.35, period: 5.2, grow: 1.45, series, width: 1.2 }));

        const name = item.fields[0] ?? '';
        const sub = item.fields[1] ?? '';
        if (!name) throw new ComponentError(`${item.role}: needs a name`, item.line);
        const gap = ring.r + 12;
        if (Math.abs(cos) < 0.35) {
          // Top or bottom of the ring: the name goes above or below the satellite, where there is room for a wide one.
          const below = Math.sin(angle) > 0;
          const ly = y + (below ? gap + 5 : -gap + 3);
          label.push(t.at(x, ly, fit(name, 130, 12.5), { size: 12.5, cls: 'am-fx-name' }));
          if (sub) label.push(t.at(x, ly + (below ? 14 : -14), fit(sub, 130, 10.5), { size: 10.5, cls: 'am-fx-sub', mono: true }));
          return;
        }
        const lx = x + cos * gap;
        const anchor = cos > 0 ? 'start' : 'end';
        const room = (cos > 0 ? W - lx : lx) - 6;
        label.push(t.at(lx, y + 4, fit(name, room, 12.5), { size: 12.5, anchor, cls: 'am-fx-name' }));
        if (sub) label.push(t.at(lx, y + 18, fit(sub, room, 10.5), { size: 10.5, anchor, cls: 'am-fx-sub', mono: true }));
      });
    });

    // ── the center ──
    node.push(roundNode(t, CX, CY, 52, { label: center, sub: note, size: 16, subSize: 10.5 }));
    anim.push(pulse(CX, CY, 52, { delay: 0.4, period: 4.6, grow: 1.65, series: 1, width: 1.6 }));

    const svg = `${svgOpen(W, 470, `${center}: ${[...inner, ...outer].map((s) => s.fields[0]).join(', ')}`, dir)}${defs(uid)}${dots(uid, W, 470)}<g class="am-fx-layer-edge">${edge.join('')}</g><g class="am-fx-layer-anim">${anim.join('')}</g><g class="am-fx-layer-node">${node.join('')}</g><g class="am-fx-layer-label">${label.join('')}</g></svg>`;
    return { svg, W, H: 470, boxes: t.boxes };
  },
};
