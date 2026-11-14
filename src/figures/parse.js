// What the four figure templates share: the line grammar (`role: field | field`), text that fits, and a typographer that places
// text for either reading direction. The grammar is the whole authoring surface — a draft never writes a coordinate, a size or a
// color, which is why a figure costs the model a handful of tokens and cannot overlap by accident.

import { measure } from '../svg/text.js';
import { esc } from '../svg/text.js';
import { ComponentError, contentLines, fields } from '../components/error.js';

const round = (n) => Math.round(n * 10) / 10;

// rows: [{ role, fields, line }]. roles: the roles this template accepts, in the order its help text lists them.
export function readRows(text, roles, template) {
  return contentLines(text).map(({ text: body, line }) => {
    const at = body.indexOf(':');
    if (at <= 0) {
      throw new ComponentError(`${template} line must be "role: fields", not "${body}"`, line);
    }
    const role = body.slice(0, at).trim().toLowerCase();
    if (!roles.includes(role)) {
      // A name that is not a role is usually a setting written as a line ("hub: Gateway") instead of a fence argument.
      throw new ComponentError(`${template} has no "${role}:" line; its lines are ${roles.map((r) => `${r}:`).join(', ')} — settings go in the fence as key="value"`, line);
    }
    const parts = fields(body.slice(at + 1));
    if (!parts.some(Boolean)) throw new ComponentError(`${template} ${role}: is empty`, line);
    return { role, fields: parts, line };
  });
}

// Text cut to a width the layout can give it. A label the author did not measure is the one thing that can make a drawing
// overflow, so every string goes through here before it is placed.
export function fit(str, width, size, opts = {}) {
  const text = String(str ?? '');
  if (measure(text, size, opts) <= width) return text;
  const chars = [...text];
  while (chars.length > 1 && measure(`${chars.join('')}…`, size, opts) > width) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

// Placement for one reading direction. A right-to-left page mirrors x and keeps the anchor names: the svg root carries
// direction="rtl", which turns "start" into the right end of the text, exactly the mirror of the left-to-right placement.
export function typographer(width, rtl) {
  const x = (v) => (rtl ? width - v : v);
  // boxes: the ink box of every label, in drawing units. The templates hand it back and the tests use it: a label that leaves
  // the canvas or lands on another one is the one failure a drawing can have that no reader can work around.
  const boxes = [];
  const box = (cx, cy, str, size, anchor, opts) => {
    const w = measure(str, size, opts);
    // ltr0: where the text starts in a left-to-right drawing. Mirroring the whole box is what a mirrored page does to it.
    const ltr0 = anchor === 'start' ? cx : anchor === 'end' ? cx - w : cx - w / 2;
    const x0 = rtl ? width - ltr0 - w : ltr0;
    return { text: str, size, x0, x1: x0 + w, y0: cy - size * 0.86, y1: cy + size * 0.3 };
  };
  return {
    x,
    boxes,
    at(cx, cy, str, { size = 12.5, anchor = 'middle', cls = '', mono = false, bold = false } = {}) {
      const names = [cls, mono && 'am-fx-mono', bold && 'am-fx-bold'].filter(Boolean).join(' ');
      boxes.push(box(cx, cy, str, size, anchor, { mono, bold }));
      return `<text${names ? ` class="${names}"` : ''} x="${x(cx)}" y="${round(cy)}" text-anchor="${anchor}">${esc(str)}</text>`;
    },
  };
}

// One fence argument as text. A bare flag (hub without a value) is an error that names the option: a template cannot guess
// what an empty label meant, and drawing a node with no name reads as a bug rather than as a mistake in the draft.
export function arg(args, name, template) {
  const value = args?.[name];
  if (value === undefined) return '';
  if (value === true) throw new ComponentError(`${template}: ${name}= needs a value`, 0);
  return String(value).trim();
}

// A cap on how many items a drawing takes, reported where the author wrote them: the drawing stays readable and the draft
// learns that the rest were dropped instead of silently losing them.
export function take(items, max, what, warn) {
  if (items.length <= max) return items;
  // The warning points at the first dropped line, which is the one the author has to delete or move.
  warn?.({ line: items[max]?.line ?? 0, message: `a figure draws at most ${max} ${what}: the last ${items.length - max} are not shown` });
  return items.slice(0, max);
}

// One number in 0…max, or the error of the line that carried it.
export function numberIn(raw, max, role, line) {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new ComponentError(`${role} needs a number from 0 to ${max}, not "${raw}"`, line);
  }
  return n;
}
