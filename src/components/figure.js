// Figure: a drawing whose shape comes from the data and whose light comes from the page's motion setting.
// The fence names a template, the body is one line per element (`role: fields`), and the fence arguments carry the few names a
// template needs (hub=, sink=). No line holds a coordinate, a size or a color: the template lays out what it was given, so the
// same draft draws 3 sources or 8, on a left-to-right or a right-to-left page.
import { parseAttrs } from '../attrs.js';
import { FIGURES } from '../figures/index.js';
import { ComponentError } from './error.js';

export default {
  name: 'figure',
  summary: 'Dataflow, orbit, radar or stacked layers, with motion',
  syntax: `\`\`\`figure dataflow|orbit|radar|stack [key="value"]
role: field | field | field
\`\`\`
- The first word is the template. The panel heading is the figure title, so there is no title=.
- dataflow: \`source: name\` (1 to 8), \`lane: name | stage | stage\` (1 to 4 lanes, 1 to 3 stages each), \`state: file | file\` (optional, up to 6); arguments hub="Gateway" (required), hub-note="one key", sink="Aggregate" (required).
- orbit: \`ring1: name | note\` (2 to 4), \`ring2: name | note\` (2 to 6); arguments center="Model" (required), center-note="reasons".
- radar: argument axes="Speed, Cost, Durability" (3 to 8 names), then \`series: name | 0-100 | 0-100\` (1 to 3 series, one value per axis, in axis order).
- stack: \`layer: name | chip | chip\` (2 to 5 layers, 2 to 6 chips each); argument note="a rule under the drawing".
- The lines set the size of the drawing: an extra source moves the hub and the lanes instead of overlapping them, and text that does not fit is shortened. A figure draws at most its capacity of lines and warns about the rest.
- The drawing is complete without motion: with motion: off, in print and for a reader who asks for reduced motion, you get the static picture. With motion: subtle or expressive, light runs along the edges.
- A figure is a page drawing; a video draft reports it as an error.`,
  example: '```figure dataflow hub="Gateway" sink="Aggregate"\nsource: X / Twitter\nsource: YouTube captions\nlane: New words | Collect | Dedup | Score\nlane: Site ops | Search | Snapshot | Ledger\nstate: pushed.json | sites.csv\n```',
  // A video runs on its own clock and has no reader: a figure there would be a still frame inside a moving picture.
  pageOnly: true,
  render(text, { args = '', dir = 'ltr', uid = () => 'am1', warn } = {}) {
    const attrs = parseAttrs(args);
    const words = Object.keys(attrs).filter((k) => attrs[k] === true);
    const [template, ...rest] = words;
    if (!template) throw new ComponentError(`figure needs a template: write \`\`\`figure ${[...FIGURES.keys()].join('|')}`, 0);
    const figure = FIGURES.get(template);
    if (!figure) throw new ComponentError(`figure has no "${template}" template; use ${[...FIGURES.keys()].join(', ')}`, 0);
    if (rest.length) throw new ComponentError(`figure ${template} has no "${rest[0]}" option; its settings go as key="value"`, 0);
    const { svg } = figure.render(text, { args: attrs, dir, uid: uid(), warn });
    return `<figure class="am-diagram am-fx">${svg}</figure>`;
  },
};
