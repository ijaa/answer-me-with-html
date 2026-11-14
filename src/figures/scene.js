// Chrome the four templates share: the dot grid, the halo behind a hub, and a node with a label inside it.
// Everything here is a class name and a token; no template writes a color, so a theme changes a figure without knowing it exists.

import { fit } from './parse.js';

// Two gradients and one pattern for the whole drawing: a hundred dots cost one tag, and the halo fades with a token's opacity.
export function defs(uid, { halo = true, sweep = false } = {}) {
  const parts = [];
  if (halo) {
    parts.push(`<radialGradient id="${uid}-halo"><stop class="am-fx-halo-a" offset="0"/><stop class="am-fx-halo-b" offset="1"/></radialGradient>`);
  }
  if (sweep) {
    parts.push(`<linearGradient id="${uid}-sweep" x1="0" x2="1"><stop class="am-fx-sweep-a" offset="0"/><stop class="am-fx-sweep-b" offset="1"/></linearGradient>`);
  }
  parts.push(`<pattern id="${uid}-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle class="am-fx-dot" cx="1" cy="1" r="1"/></pattern>`);
  return `<defs>${parts.join('')}</defs>`;
}

export function dots(uid, width, height) {
  return `<rect class="am-fx-dots" x="0" y="0" width="${width}" height="${height}" fill="url(#${uid}-dots)"/>`;
}

// A round node with its label inside, an optional second line under it, and an optional ring that turns.
// t: the typographer (it places text for the page direction). fill: 'paper' (default), 'bg' or 'ink'.
export function roundNode(t, cx, cy, r, { label = '', sub = '', fill = 'paper', ring = null, size = 15, subSize = 10.5 } = {}) {
  const out = [];
  if (ring) out.push(ring);
  const cls = fill === 'ink' ? 'am-fx-node-bg am-fx-node-bg--ink' : `am-fx-node-bg${fill === 'bg' ? ' am-fx-node-bg--bg' : ''}`;
  out.push(`<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}"/>`);
  if (label) {
    const room = r * 2 - Math.max(12, r * 0.36);
    out.push(t.at(cx, cy + (sub ? -1 : size * 0.35), fit(label, room, size, { bold: true }), {
      size, cls: fill === 'ink' ? 'am-fx-node-inv' : 'am-fx-node', bold: true,
    }));
  }
  if (sub) {
    out.push(t.at(cx, cy + size * 0.72 + subSize * 0.7, fit(sub, r * 2 - 12, subSize), { size: subSize, cls: 'am-fx-sub', mono: true }));
  }
  return out.join('');
}
