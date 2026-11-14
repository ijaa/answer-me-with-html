// matrix: rows against columns, one number in each cell. A table with color: the cells carry their number, so the drawing is
// readable in print and to a reader who cannot tell one shade from another, and the wash only says where the weight is.
//
// Reading order is the order of the lines: rows top to bottom, columns left to right.

import { svgOpen } from '../svg/shapes.js';
import { measure } from '../svg/text.js';
import { readRows, fit, typographer, take, arg, numberIn } from './parse.js';
import { ComponentError } from '../components/error.js';

const W = 820;
const X0 = 32;
const TOP = 42;
const CELL_H = 40;
const CELL_GAP = 8;
const MIN_CELL_W = 58;

const round = (n) => Math.round(n * 10) / 10;

export default {
  name: 'matrix',
  summary: 'Rows and columns of numbers, washed by value',
  roles: ['col', 'row'],

  render(text, { args = {}, dir = 'ltr', warn } = {}) {
    const rows = readRows(text, ['col', 'row'], 'matrix');
    const cols = take(rows.filter((r) => r.role === 'col'), 6, 'columns', warn).map((r) => {
      const name = r.fields.join(' ').trim();
      if (!name) throw new ComponentError('a col: line needs a name', r.line);
      return { name, line: r.line };
    });
    const lines = take(rows.filter((r) => r.role === 'row'), 10, 'rows', warn);
    if (!cols.length) throw new ComponentError('matrix needs at least one "col:" line', 0);
    if (!lines.length) throw new ComponentError('matrix needs at least one "row:" line', 0);
    const foot = arg(args, 'note', 'matrix');

    // The label column takes what the longest name needs, so a short name does not push the grid off the right edge.
    const labelW = Math.min(200, Math.max(120, Math.max(...lines.map((r) => measure(r.fields[0] ?? '', 13))) + 32));
    const gridX = X0 + labelW;
    const gridW = W - gridX - X0;
    const cellW = (gridW - CELL_GAP * (cols.length - 1)) / cols.length;
    if (cellW < MIN_CELL_W) throw new ComponentError(`matrix: ${cols.length} columns leave ${Math.round(cellW)} units each; use at most 6`, 0);

    const t = typographer(W, dir === 'rtl');
    const [edge, label] = [[], []];

    cols.forEach((col, c) => {
      const cx = gridX + c * (cellW + CELL_GAP) + cellW / 2;
      label.push(t.at(cx, 24, fit(col.name, cellW - 6, 11.5), { size: 11.5, cls: 'am-fx-axis-name' }));
    });

    lines.forEach((row, r) => {
      const name = row.fields[0] ?? '';
      if (!name) throw new ComponentError('a row: line needs a name before its values', row.line);
      const values = row.fields.slice(1).filter((f) => f !== '');
      if (values.length !== cols.length) {
        const cap = values.length > 6 ? ' (a matrix draws at most 6 columns)' : '';
        throw new ComponentError(`row "${name}" has ${values.length} values for ${cols.length} columns: write one per column${cap}`, row.line);
      }
      const y = TOP + r * (CELL_H + CELL_GAP);
      label.push(t.at(X0, y + CELL_H / 2 + 4.5, fit(name, labelW - 16, 13, { bold: true }), { size: 13, anchor: 'start', cls: 'am-fx-row', bold: true }));

      values.forEach((raw, c) => {
        const value = numberIn(raw, 100, `cell "${name} · ${cols[c].name}"`, row.line);
        const x = gridX + c * (cellW + CELL_GAP);
        // The wash is the value, so it is an attribute of this cell and not a token: a theme sets the color, the data sets the
        // amount. Cells fade in along the diagonal, which reads as "top left first" without a legend.
        edge.push(`<rect class="am-fx-cell" x="${round(x)}" y="${round(y)}" width="${round(cellW)}" height="${CELL_H}" rx="6" fill-opacity="${round(0.05 + (value / 100) * 0.8)}" style="--am-fx-delay:${round((r + c) * 0.06)}s"/>`);
        label.push(t.at(x + cellW / 2, y + CELL_H / 2 + 4.5, String(value), { size: 12, cls: value > 55 ? 'am-fx-cell-on' : 'am-fx-cell-off', mono: true }));
      });
    });

    const height = TOP + lines.length * (CELL_H + CELL_GAP) - CELL_GAP + (foot ? 26 : 8);
    if (foot) label.push(t.at(X0, height - 8, fit(foot, W - 2 * X0, 10.5), { size: 10.5, anchor: 'start', cls: 'am-fx-sub', mono: true }));

    const svg = `${svgOpen(W, height, `${cols.map((c) => c.name).join(', ')}; ${lines.length} rows`, dir)}<g class="am-fx-layer-edge">${edge.join('')}</g><g class="am-fx-layer-label">${label.join('')}</g></svg>`;
    return { svg, W, H: height, boxes: t.boxes };
  },
};
