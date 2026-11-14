// dataflow: many sources into one hub, the hub out along a few lanes, the lanes into one aggregate.
// The light is the point: it leaves a source, reaches the hub, fans out along a lane, stops at each stage, and gathers at the
// aggregate. Geometry comes from the data (the number of sources sets the height, the number of lanes the spacing), so the same
// file draws 4 sources and 8.

import { svgOpen } from '../svg/shapes.js';
import { measure } from '../svg/text.js';
import { comet, pulse, flash, edgeDraw, spin } from '../svg/anim.js';
import { cubic, line } from './curve.js';
import { readRows, fit, typographer, take, arg } from './parse.js';
import { defs, dots, roundNode } from './scene.js';
import { ComponentError } from '../components/error.js';

const W = 920;
const HUB_X = 300;
const HUB_R = 44;
const TRACK_X0 = 398;
const TRACK_X1 = 706;
const AGG_X = 840;
const AGG_R = 44;
const ROW = 44; // the vertical distance between two sources
const LANE_GAP = 104;

const NODE_SIZE = 15;
const SUB_SIZE = 10.5;
const ROW_SIZE = 13.5;
const STAGE_SIZE = 11.5;

export default {
  name: 'dataflow',
  summary: 'Sources into a hub, out along lanes, into one aggregate',
  roles: ['source', 'lane', 'state'],

  render(text, { args = {}, uid = 'fx', dir = 'ltr', warn } = {}) {
    const rows = readRows(text, ['source', 'lane', 'state'], 'dataflow');
    const sources = take(rows.filter((r) => r.role === 'source'), 8, 'sources', warn);
    const lanes = take(rows.filter((r) => r.role === 'lane'), 4, 'lanes', warn);
    if (!sources.length) throw new ComponentError('dataflow needs at least one "source:" line', 0);
    if (!lanes.length) throw new ComponentError('dataflow needs at least one "lane:" line', 0);
    const hub = arg(args, 'hub', 'dataflow');
    const sink = arg(args, 'sink', 'dataflow');
    if (!hub) throw new ComponentError('dataflow needs the hub: write ```figure dataflow hub="Gateway"', 0);
    if (!sink) throw new ComponentError('dataflow needs the aggregate: add sink="Aggregate" to the fence', 0);
    const hubNote = arg(args, 'hub-note', 'dataflow');
    const states = take(rows.filter((r) => r.role === 'state').flatMap((r) => r.fields.filter(Boolean).map((name) => ({ name, line: r.line }))), 6, 'files', warn);
    for (const lane of lanes) {
      if (!lane.fields[0]) throw new ComponentError('a lane: line needs a name before its stages', lane.line);
      if (lane.fields.length < 2) throw new ComponentError(`lane "${lane.fields[0]}" needs at least one stage after the name`, lane.line);
    }

    const y0 = 74;
    // The hub sits at the middle of the column of sources, but never so high that the top lane (and the name above it) climbs
    // past the edge of the canvas: four lanes need more room above the hub than two sources do.
    const laneSpan = ((lanes.length - 1) / 2) * LANE_GAP;
    const cy = Math.max(y0 + ((sources.length - 1) * ROW) / 2, laneSpan + 46);
    // Below the hub: the lane span, the stage names under the lowest track, then the row of files.
    const H = Math.round(cy + Math.max(250, laneSpan + 96));
    const t = typographer(W, dir === 'rtl');
    const [edge, anim, node, label] = [[], [], [], []];

    // The longest edge sets the clock: a light spends 2.2 to 4.6 seconds on its edge, longer the farther it goes, so the eye
    // reads one speed and every lane has time to be seen.
    const fan = lanes.map((lane, i) => {
      const y = cy + (i - (lanes.length - 1) / 2) * LANE_GAP;
      return { lane, y, curve: cubic([HUB_X + HUB_R + 2, cy], [HUB_X + 62, cy], [HUB_X + 92, y], [TRACK_X0, y]) };
    });
    const spokes = sources.map((s, i) => ({
      s,
      y: y0 + i * ROW,
      curve: cubic([184, y0 + i * ROW], [236, y0 + i * ROW], [232, cy], [HUB_X - HUB_R - 2, cy]),
    }));
    const outs = fan.map(({ y }) => cubic([TRACK_X1, y], [TRACK_X1 + 44, y], [AGG_X - 52, cy], [AGG_X - AGG_R - 2, cy]));
    const longest = Math.max(...[...spokes.map((s) => s.curve), ...fan.map((f) => f.curve), ...outs].map((c) => c.len));
    const time = (len) => Math.round((2.2 + 2.4 * (len / longest)) * 10) / 10;
    const mod = (v, m) => Math.round((v % m) * 100) / 100;

    // ── sources into the hub ──
    spokes.forEach(({ s, y, curve }, i) => {
      const start = 0.2 + i * 0.1;
      const dur = time(curve.len);
      edge.push(edgeDraw(curve.d, { delay: start, cls: 'am-fx-edge--dim' }));
      anim.push(comet(curve.d, curve.len, { delay: start, time: dur, series: 1, width: 2.2 }));
      edge.push(`<circle class="am-fx-src" cx="176" cy="${y}" r="3"/>`);
      label.push(t.at(166, y + 4, fit(s.fields[0], 96, 12.5), { size: 12.5, anchor: 'end', cls: 'am-fx-name' }));
      spokes[i].arrive = start + dur;
    });
    const hubAt = Math.max(...spokes.map((s) => s.arrive));

    // ── the hub ──
    node.push(`<circle class="am-fx-halo" cx="${HUB_X}" cy="${cy}" r="150" fill="url(#${uid}-halo)"/>`);
    anim.push(pulse(HUB_X, cy, HUB_R, { delay: mod(hubAt, 3.2), period: 4.8, grow: 1.55, width: 1.6 }));
    node.push(roundNode(t, HUB_X, cy, HUB_R, {
      label: hub,
      sub: hubNote,
      ring: spin(`<circle class="am-fx-node-in" cx="${HUB_X}" cy="${cy}" r="${HUB_R - 9}"/>`, { cx: HUB_X, cy, period: 34 }),
    }));

    // ── lanes: a track with stages, fed from the hub, gathered into the aggregate ──
    fan.forEach(({ lane, y, curve }, i) => {
      const series = (i % 4) + 1;
      const start = hubAt + 0.05 + i * 0.12;
      const dur = time(curve.len);
      edge.push(edgeDraw(curve.d, { delay: start, cls: 'am-fx-edge--dim' }));
      anim.push(comet(curve.d, curve.len, { delay: start, time: dur, series }));
      label.push(t.at(TRACK_X0, y - 24, fit(lane.fields[0], 148, ROW_SIZE, { bold: true }), { size: ROW_SIZE, anchor: 'start', cls: 'am-fx-row', bold: true }));

      const track = line([TRACK_X0, y], [TRACK_X1, y]);
      edge.push(`<rect class="am-fx-track" x="${TRACK_X0}" y="${y - 0.75}" width="${TRACK_X1 - TRACK_X0}" height="1.5" rx="0.75"/>`);
      const trackAt = start + dur;
      const trackDur = time(track.len);
      anim.push(comet(track.d, track.len, { delay: trackAt, time: trackDur, series, width: 2.6 }));

      const stages = lane.fields.slice(1).filter(Boolean);
      const step = stages.length > 1 ? (TRACK_X1 - TRACK_X0 - 48) / (stages.length - 1) : 0;
      stages.forEach((stage, k) => {
        const x = stages.length > 1 ? TRACK_X0 + 24 + k * step : (TRACK_X0 + TRACK_X1) / 2;
        const at = trackAt + (trackDur * (x - TRACK_X0)) / track.len;
        edge.push(`<circle class="am-fx-stage" cx="${x}" cy="${y}" r="6"/>`);
        anim.push(flash(x, y, 3.6, { delay: mod(at, trackDur), period: trackDur, series }));
        anim.push(pulse(x, y, 6, { delay: mod(at, trackDur), period: trackDur, grow: 2.6, series, width: 1.2 }));
        const room = stages.length > 1 ? step - 6 : 96;
        label.push(t.at(x, y + 30, fit(stage, room, STAGE_SIZE), { size: STAGE_SIZE, cls: 'am-fx-sub' }));
      });

      const out = outs[i];
      const outAt = trackAt + trackDur;
      const outDur = time(out.len);
      edge.push(edgeDraw(out.d, { delay: outAt, cls: 'am-fx-edge--dim' }));
      anim.push(comet(out.d, out.len, { delay: outAt, time: outDur, series }));
      fan[i].arrive = outAt + outDur;
    });
    const aggAt = Math.max(...fan.map((f) => f.arrive));

    // ── the aggregate ──
    node.push(roundNode(t, AGG_X, cy, AGG_R, { label: sink, fill: 'ink' }));
    anim.push(pulse(AGG_X, cy, AGG_R, { delay: mod(aggAt, 4.2), period: 4.2, grow: 1.5, series: 1, width: 1.6 }));

    // ── the files the run leaves behind: a hairline and a row of names, the one part of the drawing a reader can go and open ──
    if (states.length) {
      edge.push(`<rect class="am-fx-track" x="96" y="${H - 54}" width="${W - 192}" height="1"/>`);
      let x = 96;
      for (const { name } of states) {
        const name2 = fit(name, 130, 10.5, { mono: true });
        if (x + measure(name2, 10.5, { mono: true }) > W - 96) break;
        label.push(t.at(x, H - 30, name2, { size: 10.5, anchor: 'start', cls: 'am-fx-sub', mono: true }));
        x += measure(name2, 10.5, { mono: true }) + 30;
      }
    }

    const svg = `${svgOpen(W, H, `${hub}: ${sources.map((s) => s.fields[0]).join(', ')} → ${lanes.map((l) => l.fields[0]).join(', ')} → ${sink}`, dir)}${defs(uid)}${dots(uid, W, H)}<g class="am-fx-layer-edge">${edge.join('')}</g><g class="am-fx-layer-anim">${anim.join('')}</g><g class="am-fx-layer-node">${node.join('')}</g><g class="am-fx-layer-label">${label.join('')}</g></svg>`;
    return { svg, H, W, boxes: t.boxes };
  },
};
