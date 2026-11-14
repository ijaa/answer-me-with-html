// Figure: a drawing whose shape comes from the data and whose light comes from the page's motion setting.
// The fence names a template, the body is one line per element (`role: fields`), and the fence arguments carry the few names a
// template needs (hub=, sink=). No line holds a coordinate, a size or a color: the template lays out what it was given, so the
// same draft draws 3 sources or 8, on a left-to-right or a right-to-left page.
//
// The template word is optional: the roles in the body name it, and no two templates read the same role, so a draft that writes
// `source:` and `lane:` lines is a dataflow without saying so. That is one token less per drawing and one mistake less.
import { parseAttrs } from '../attrs.js';
import { ComponentError, contentLines } from './error.js';
import { FIGURES } from '../figures/index.js';

const ALL = [...FIGURES.values()];
const BY_NAME = new Map(ALL.flatMap((f) => f.roles.map((role) => [role, f])));
const list = ALL.map((f) => f.name).join('|');

// The roles the body actually uses. A line that is not `role: fields` is left to the template, which reports it with its line
// number; here it only means "no template named itself".
function rolesIn(text) {
  const seen = new Set();
  for (const { text: body } of contentLines(text ?? '')) {
    const at = body.indexOf(':');
    if (at > 0) seen.add(body.slice(0, at).trim().toLowerCase());
  }
  return [...seen].filter((role) => BY_NAME.has(role));
}

export default {
  name: 'figure',
  summary: 'Dataflow, gauge, matrix, orbit, quadrant, radar, sankey or stack, with motion',
  syntax: `\`\`\`figure [dataflow|gauge|matrix|orbit|quadrant|radar|sankey|stack] [key="value"]
role: field | field
\`\`\`
- The first word is the template, and it can be left out: the roles name it (col/row → matrix, flow → sankey, gauge → gauge, item → quadrant, layer → stack, ring1/ring2 → orbit, series → radar, source/lane → dataflow).
- The panel heading is the figure title, so there is no title=.
- dataflow: \`source: name\` (1 to 8), \`lane: name | stage | stage\` (1 to 4 lanes, 1 to 3 stages each), \`state: file | file\` (optional, up to 6); arguments hub="Gateway" (required), hub-note="one key", sink="Aggregate" (required).
- orbit: \`ring1: name | note\` (2 to 4), \`ring2: name | note\` (2 to 6); arguments center="Model" (required), center-note="reasons".
- radar: argument axes="Speed, Cost, Durability" (3 to 8 names), then \`series: name | 0-100 | 0-100\` (1 to 3 series, one value per axis, in axis order).
- stack: \`layer: name | chip | chip\` (2 to 5 layers, 2 to 6 chips each); argument note="a rule under the drawing".
- matrix: \`col: name\` (1 to 6) then \`row: name | 0-100 | 0-100\` (1 to 10 rows, one value per column, in column order); argument note="a rule under the drawing".
- sankey: \`flow: from | to | amount\` (1 to 10 flows, 12 names, 4 columns); arguments unit="GB", note="a rule under the drawing". The columns come from the flows and a cycle is an error.
- gauge: \`gauge: name | value | max\` (1 to 4 rows, max defaults to 100); arguments unit="ms", zones="80, 150" (one threshold marks where the number turns bad, two add a warn band) and note="a rule under the drawing".
- quadrant: \`item: name | 0-100 | 0-100\` (1 to 10 items); arguments x="cheap → dear" and y="slow → fast" (both required).
- The lines set the size of the drawing: an extra source moves the hub and the lanes instead of overlapping them, and text that does not fit is shortened. A figure draws at most its capacity of lines and warns about the rest.
- The drawing is complete without motion: with motion: off, in print and for a reader who asks for reduced motion, you get the static picture. With motion: subtle or expressive, light runs along the edges.
- A figure is a page drawing; a video draft reports it as an error.`,
  example: '```figure dataflow hub="Gateway" sink="Aggregate"\nsource: X / Twitter\nsource: YouTube captions\nlane: New words | Collect | Dedup | Score\nlane: Site ops | Search | Snapshot | Ledger\nstate: pushed.json | sites.csv\n```',
  // A video runs on its own clock and has no reader: a figure there would be a still frame inside a moving picture.
  pageOnly: true,
  render(text, { args = '', dir = 'ltr', uid = () => 'am1', warn } = {}) {
    const attrs = parseAttrs(args);
    const words = Object.keys(attrs).filter((k) => attrs[k] === true);
    const [word, ...rest] = words;
    let template = word && word !== 'auto' ? word : '';
    if (!template) {
      const families = [...new Set(rolesIn(text).map((role) => BY_NAME.get(role)))];
      if (families.length === 1) template = families[0].name;
      else if (families.length > 1) {
        throw new ComponentError(`figure: the lines mix ${families.map((f) => f.name).join(' and ')} (${families.map((f) => f.roles.join('/')).join(' vs ')}); write the template: \`\`\`figure ${families[0].name}`, 0);
      } else throw new ComponentError(`figure needs a template: ${list}, or lines whose roles name one`, 0);
    }
    if (word === 'auto' && rest.length) throw new ComponentError(`figure auto takes no template word, only settings`, 0);
    const figure = FIGURES.get(template);
    if (!figure) throw new ComponentError(`figure has no "${template}" template; use ${ALL.map((f) => f.name).join(', ')}`, 0);
    if (rest.length) throw new ComponentError(`figure ${template} has no "${rest[0]}" option; its settings go as key="value"`, 0);
    const { svg } = figure.render(text, { args: attrs, dir, uid: uid(), warn });
    return `<figure class="am-diagram am-fx">${svg}</figure>`;
  },
};
