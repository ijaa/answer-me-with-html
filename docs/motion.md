# Page motion: moving figures

Design and implementation plan for `motion`, the layer that makes the drawings on a page move: the light that travels along an
edge, the pulse that marks the node it reached, the line that draws itself in.

Status: implemented on branch `feat/page-motion` (target 0.6.0). The two stylesheets, the primitives, the four templates, the
`motion` key and the two test files below are in this change; the P2 items in §10 are not.

---

## 1. Summary

A page today is accurate and still. Every drawing is a static svg: `flow`, `state`, `sequence`, `er`, `class`, `chart`, `limits`
and `tree`. The reader sees the shape in one glance, but nothing on the page says **in which order**, **in which direction**, or
**what feeds what**, unless the prose says it.

This plan adds two things and nothing else:

1. **Motion primitives** — a light tail that travels a path, a pulse ring, a flash, a draw-in — as a shared module
   (`src/svg/anim.js`) plus one stylesheet (`src/themes/motion.css`). They are CSS only. No javascript, no SMIL, no images.
2. **`figure`**, a new component with four templates (`dataflow`, `orbit`, `radar`, `stack`) for information shapes the existing
   components cannot draw: many sources into one hub, a center with two rings of reach, a multi-axis profile, stacked layers with
   channels between them.

Plus one key, `motion: subtle | off | expressive`, that decides whether a page moves at all.

The measured target: **3–18 KB per figure**, **0 javascript**, **0 network requests**, page size up by at most 30 KB, and a static
picture that is already correct when the animation is off, printed, or reduced.

## 2. The problem, measured

From five pages rendered with 0.5.11 (`site/presets/*.md`, `examples/*.md`):

| Page | Panels | Drawings | Tables | Words |
|---|---:|---:|---:|---:|
| tcp | 6 | 4 | 1 | 739 |
| repo | 3 | 2 | 0 | 435 |
| cache | 3 | 0 | 1 | 532 |
| decision | 4 | **0** | 0 | 581 |

`decision.zh.md` is the shape of the problem: 4 panels, no drawing at all, because the answer is a trade-off ("A or B, and why")
and the component set has no shape for a trade-off, so the model falls back to prose and a numbered list. The same happens to
"three things happened, in this order" (no timeline shape) and "this number is at 92% of its limit" (no gauge shape).

Motion is the second half of the same problem. Two of the four drawings on `tcp` are flows, and a flow that does not move is a
wiring diagram: it shows adjacency but not direction, not order, not rate.

Measured cost of the alternative — a hand-made animated svg with text as paths (the `svg-lab` sketch): **221 KB** for one figure,
because every glyph becomes a `<path>`. Inline in a page the same drawing with `<text>` is **3.3–17.8 KB**, and the page keeps the
CSP and the single-file promise.

## 3. Scope

In:

- the `motion` key (frontmatter, `--motion`, `am config`), carried as `data-motion` on `<html>`;
- `src/svg/anim.js`: `comet`, `pulse`, `flash`, `edgeDraw`, `spin`;
- `src/themes/motion.css`: keyframes and the gates (print, video, reduced motion, theme);
- `figure` with four templates and a line DSL;
- `src/themes/figure.css`: the static look of a figure, themeable through the existing tokens;
- entrance motion for `chart` (rows rise in sequence, a line draws itself, pie slices fade in) — the existing components get
  motion without a new syntax;
- tests, `docs/reference.md`, `SKILL.md`, the bundled CLI.

Out, and why:

- **Free-form svg written by the model.** It costs 2–4k tokens, produces coordinates nothing can check, and moves the product from
  "8 tokens of intent" to "a thousand tokens of geometry". The escape hatch (` ```svg `) already exists for the rare case.
- **Panel entrance animation** (cards sliding in). It delays reading, it fights `prefers-reduced-motion` on every page, and a
  reader who scrolls back sees it again. Motion belongs to drawings, not to text.
- **Scroll-driven timelines** (`animation-timeline: view()`). Baseline is 2026 in Chromium only; the fallback is the static picture,
  so the gain is small and the test surface is large. Revisit after 1.0.
- **A motion toggle in the toolbar.** The reader's system setting (`prefers-reduced-motion`) already decides; a per-page control
  needs a label in 20 languages for a setting almost nobody changes.

## 4. Hard constraints

These are not preferences; each one has a test or a product promise behind it.

| Constraint | Consequence for this feature |
|---|---|
| CSP `default-src 'none'; img-src data:; style-src 'unsafe-inline'` | animation is CSS only; no `<script>` inside a drawing, no sprite, no external font |
| One file, offline | no `<img src>`; the svg is inline in the page |
| The page must print correctly | the un-animated state is the final state; print turns animation off |
| `am export --pdf` | the exporter emulates `prefers-reduced-motion: reduce` before the shot |
| `am video` | motion is off under `html[data-video]`; a video has its own clock |
| Themes: `THEME_SELECTORS` is add-only (16 selectors) | a figure must be styled through its own classes and the existing tokens, never by asking themes to know new selectors |
| Readers who ask for less motion | `prefers-reduced-motion: reduce` removes every animation, exactly like print |
| The 1/8-token promise | the model writes data, never coordinates, never a stylesheet |
| RTL pages | a figure is mirrored like `flow` and `chart`; text is placed, not mirrored |
| No javascript in the page beyond `RUNTIME_JS` | no new runtime script; motion is not interactive |

## 5. Design

### 5.1 The key

```yaml
motion: subtle     # subtle (default) | off | expressive
```

- `off` — `motion.css` is not put in the page at all. The figure is the static picture it always was. Nothing to undo, nothing to
  test at run time.
- `subtle` — one entrance pass (a line draws in 0.4–0.6 s, bars rise in sequence 55 ms apart) and slow ambient loops (a light tail
  takes 4–6 s to cross an edge, a pulse ring 4.8 s to fade).
- `expressive` — the same rules, faster: loops at 80% of the time, entrance at 0.35 s. One variable, `--am-fx-phase`, so the two
  levels cannot drift apart.

The key is written on the root: `<html … data-motion="subtle">`, next to `data-theme` and `data-mode`. Because it is an attribute,
`am patch` keeps it, a theme cannot override it, and a host page can flip it.

Command line and config follow the existing pattern: `CHOICES.motion` in `src/parse.js`, `CONFIG_KEYS.motion` in `src/config.js`,
`--motion` in `src/cli.js`, so `am render --motion expressive` and `am config set motion off` both work.

### 5.2 Layer 1 — primitives

`src/svg/anim.js` exports five functions. Each one returns svg markup with classes and **inline custom properties**, never a
coordinate in a stylesheet and never a keyframe of its own.

```js
// A light tail that runs from the start of a path to its end: three strokes, the same head, a long dim tail behind it.
// pathLength="1" makes the dash lengths a fraction of the path, so the same rule moves a 20 px edge and a 900 px one.
export function comet(d, len, { delay = 0, speed = 620, tail = 118, series = 1, width = 2.4 } = {}) {
  const norm = tail / len;
  const time = (len + tail + 8) / speed;
  const layer = (keep, cls) => {
    const a = Math.max(0.004, norm * keep);
    return `<path class="am-fx-comet am-fx-s${series} ${cls}" d="${d}" pathLength="1"
      style="--am-fx-delay:${round(delay)}s;--am-fx-time:${round(time)}s;--am-fx-from:${a};--am-fx-to:${-(1 + norm * (1 + keep))};--am-fx-dash:${a} 2;stroke-width:${width}"/>`;
  };
  return layer(1, 'am-fx-tail') + layer(0.5, 'am-fx-mid') + layer(0.16, 'am-fx-head');
}
```

Why `pathLength="1"` matters: without it every path needs its length in a `stroke-dasharray`, which the caller has to compute and
keep in sync when the layout changes. With it, one keyframe serves every path in the page:

```css
@keyframes am-fx-travel { from { stroke-dashoffset: var(--am-fx-from) } to { stroke-dashoffset: var(--am-fx-to) } }
@keyframes am-fx-draw   { from { stroke-dashoffset: 1 } }
@keyframes am-fx-pulse  { 0% { opacity: 0; transform: scale(1) } 3% { opacity: .7 } 24% { opacity: 0; transform: scale(var(--am-fx-grow, 1.5)) } 100% { opacity: 0 } }
```

`pulse` returns a `<circle>` in a `<g>` with `transform-box: fill-box; transform-origin: center`, so `scale()` grows the ring from
its own center without a `transform-origin` in user units. `flash` is a small filled circle that blinks once per period. `spin` is a
dashed ring or a sweep sector rotating about an explicit `transform-origin`. `edgeDraw` is what an edge becomes when it should draw
itself in: `pathLength="1"` plus a class.

Two rules keep the primitives honest:

1. **No primitive is required for the picture to be right.** Remove `motion.css` and the figure still shows the edges, the nodes,
   the labels; only the light tails disappear (they carry `opacity: 0` and are turned on by the animation rule).
2. **No primitive knows a color.** The series number becomes `am-fx-s1 … am-fx-s4`; `figure.css` maps those to
   `--series-1 … --series-4` with fallbacks, so a theme that sets a diagram token changes the light too.

### 5.3 Layer 2 — the `figure` component and its DSL

`figure` is one component with a template name as its first argument:

````
```figure dataflow hub="Gateway" sink="Aggregate"
source: X / Twitter
source: YouTube captions
lane: New words | Collect | Dedup | Score
lane: Site ops | Search | Snapshot | Ledger
state: pushed.json | sites.csv
```
````

Every template reads the same line grammar: `role: field | field | field`, and takes the rest of its settings from the fence
arguments as `key="value"` pairs (`parseAttrs` in `src/attrs.js`, the same helper `chart` uses). The model writes names and numbers;
it never writes a coordinate, a width or a color.

The four templates of this version:

| Template | Information shape | Data it takes |
|---|---|---|
| `dataflow` | many sources into a hub, lanes of stages out, one aggregate, the files left behind | `source:` (1–8), `lane:` (1–4, name + 1–3 stages), `state:` (≤6 files); `hub=`, `hub-note=`, `sink=` |
| `orbit` | one center, an inner ring of what it can reach, an outer ring of the boundary | `center=`, `center-note=`, `ring1:` (2–4), `ring2:` (2–6), each `label \| note` |
| `radar` | one option against another across 3–8 axes | `axes="a, b, c"`, `series:` (1–3, name + one value per axis, 0–100) |
| `stack` | layers with channels between them | `layer:` (2–5, name + 2–6 chips) |

Each template computes its own canvas: the height follows the number of rows, the hub sits at the middle of its column of sources,
the lane spacing follows the lane count, the ring angles divide the circle evenly. Passing 5 sources instead of 8 gives a shorter
drawing with the same code — that is the difference between a template and a picture.

Text is measured with `measure()` and wrapped with `wrap()` from `src/svg/text.js`, the same functions `flow` and `chart` use, so a
CJK label is as wide on the page as this module thinks it is. A label that does not fit is shortened at render time, and a figure
that cannot be laid out inside its capacity is truncated with a **warning** (`warn({ line, message })`, the existing channel) rather
than drawn over itself.

### 5.4 Layer 3 — registry and selection

```
src/figures/index.js     registry: name → { summary, args, render }
src/figures/parse.js     the line grammar, shared
src/figures/dataflow.js  one file per template, ~120–200 lines
src/figures/orbit.js
src/figures/radar.js
src/figures/stack.js
src/components/figure.js the component: template dispatch, error messages, wrapper
```

`src/components/figure.js` is deliberately thin: it validates the template name, calls `FIGURES.get(name).render(rows, opts)`, and
returns `<figure class="am-diagram am-fx">…</figure>`. Everything that can be wrong with the data is reported by the template
with its line number, through `ComponentError`, like every other component.

Automatic selection (picking a template from the shape of the data, with no template name in the draft) is **not** in this version:
a wrong guess draws the wrong thing and the reader cannot tell it is a guess. It is the natural next step once four templates have
been used by real drafts (see §10).

### 5.5 Files

| File | Change |
|---|---|
| `src/svg/anim.js` | new — five primitives |
| `src/figures/{curve,scene}.js` | new — path length, specks, gradients, one round node |
| `src/figures/{index,parse,dataflow,orbit,radar,stack}.js` | new |
| `src/components/figure.js` | new |
| `src/components/index.js` | register `figure` |
| `src/themes/figure.css` | new — static look, tokens only |
| `src/themes/motion.css` | new — keyframes and gates |
| `src/assets.js` | `FIGURE_CSS`, `MOTION_CSS` |
| `src/themes/index.js` | `pageCss(…, { figure, motion })` |
| `src/render.js` | detect a figure / a chart, pass both flags, pass `motion` to the shell |
| `src/page.js` | `rootTag` writes `data-motion`; `readPage` reads it back for `am patch` |
| `src/parse.js` | `CHOICES.motion`, `DEFAULT_META.motion` |
| `src/config.js` | `motion` config key |
| `src/cli.js` | `--motion`, usage line, `format` doc line |
| `scripts/inline-assets.mjs` | the two stylesheets in the bundled CLI |
| `docs/reference.md`, `docs/reference.zh-CN.md` | the component, the key |
| `skills/answer-me-with-html/SKILL.md` | one line in the component list |
| `test/components-figure.test.js`, `test/motion.test.js` | new |

## 6. What the four templates look like

Sizes are the shipped templates, measured on the built `src/figures/*.js` with `measure()`-grade text metrics: a small figure and a
figure at capacity.

| Template | Small | At capacity | Light tails, small → full |
|---|---|---|---|
| `dataflow` | 2 sources, 2 lanes, 6 stages, 2 files — 920×348, **10.3 KB** | 8 sources, 4 lanes, 12 stages — 920×480, **22.4 KB** | 24 → 60 |
| `orbit` | 2 inner, 2 outer — 860×470, **5.4 KB** | 4 inner, 6 outer — 860×470, **7.5 KB** | 12 → 12 |
| `radar` | 3 axes, 2 series — 660×480, **2.4 KB** | 8 axes, 3 series — 660×480, **5.0 KB** | 0 → 0 |
| `stack` | 3 layers, 6 chips — 800×400, **6.0 KB** | 5 layers, 30 chips, a note — 800×686, **17.2 KB** | 12 → 24 |

**dataflow** — sources stack on the left; each one curves into the hub; the hub fans out to the lanes; each lane is a track with a
stop per stage, and the stop flashes as the light passes; the lanes curve into the aggregate, which flashes on arrival; the files
the run leaves sit under a hairline at the bottom, where a reader can go and open them. The hub carries a halo and a pale
aggregate gets a ring. There is no feedback arc: a back edge needs a path length the reader cannot count, and the state row says
the same thing in words a reader can check.

**orbit** — 1 center, two ellipses of satellites at even angles: light runs along each ring once per 3.2–5 s, and each satellite
carries the note that explains it. The outer ring is dashed and dimmer, which is how "beyond the boundary" reads without a legend.

**radar** — four nested polygons, one line per axis, a filled polygon per series at 12%, a sweep that turns once per 5.2 s with a
gradient edge. No light tails at all: a radar has one moving part.

**stack** — bands with chips inside; two channels between each pair of layers, light running upward; an optional footnote line for
the rule ("a call may go down only one level").

## 7. Motion budget

Animation cost is not uniform, and the page must stay smooth on a 2019 laptop.

| Primitive | Animates | Cost | Measured, a figure at capacity |
|---|---|---|---|
| light tail | `stroke-dashoffset` | paint, not composite | 60 (dataflow, 20 edges × 3 strokes) |
| pulse / flash | `transform`, `opacity` | composite | 26 (dataflow), 30 rings (stack) |
| draw-in | `stroke-dashoffset`, one pass | paint, ends | 12 edges, once |
| spin / sweep | `transform` | composite | 1 (radar) |

Three strokes per edge is what makes one light look like a comet rather than a dash: a faint long tail, a brighter middle and a
dot, all on the same path, so they cannot drift apart. A figure at capacity therefore holds about 90 animated elements, and a
typical answer page (two sources, two lanes) holds 30. That is why the templates have a capacity at all: the limit is what keeps
the paint cost of a page bounded, and it is enforced by the template, not by the model. `motion: subtle` and `expressive` do not
change the count, only the timing.

Measured on a page with four figures (85 animated elements, 48 light tails, 1280 px wide, headless Chromium): over three seconds
the frame time is 16.7 ms at the median and 16.8 ms at the 95th percentile — 60 fps, with the paint of the tails on the main
thread. No `will-change` anywhere: 85 promoted layers would cost more memory than the repaint costs time.

Rules the templates follow:

- one global period per figure (4.8 s), so pulses on different nodes stay in phase instead of turning the drawing into noise;
- the travel time of a tail follows the length of its edge (`speed` 620 units/s), so a long edge takes longer and the eye reads it
  as the same speed everywhere;
- a tail starts after the line it runs along has drawn itself in;
- no animation on a path that carries meaning only by being still (a boundary, a limit line).

## 8. Failure modes

| Situation | What happens |
|---|---|
| `motion: off` | `motion.css` is not in the page; the figure is static and complete |
| `prefers-reduced-motion: reduce` | one media query cancels every animation; tails keep `opacity: 0` |
| print / `am export --pdf` | `@media print` cancels animation and hides tails; the exporter also emulates reduced motion before the shot |
| `am video` | `html[data-video]` cancels animation; a figure is `pageOnly`, so a video draft gets an error, not a broken frame |
| a browser without `pathLength` or with animation off | the static picture: edges solid, nodes and labels where they belong |
| a theme with unusual colors | the figure reads `--series-*` and `--paper` / `--ink`; a theme that sets none gets the fallbacks |
| a right-to-left page | geometry mirrored through `mirror()`, text anchors swapped, `svgOpen(…, 'rtl')` marks the drawing |
| a figure that is too wide for the panel | the svg has `width`/`height`, so the existing box rule scales it; the drawing never overflows the card |
| a draft with 20 sources | a warning at that line, the first 8 are drawn |

## 9. Tests

**`test/components-figure.test.js`** — per template:

- the four templates render an `am-fx` figure with an `aria-label` and no javascript;
- capacity: 9 sources → warning + 8 drawn; 5 inner satellites → warning + 4; overlong chips dropped with a warning that names the
  first dropped line; one layer or an empty body → an error at its line;
- grammar: an unknown role, a missing field, a value out of 0–100, a series with the wrong number of values, a missing `hub=` or
  `center=` → `ComponentError` with the right line;
- geometry: the typographer records the ink box of every label, and the test asserts that no two boxes overlap and that every box
  stays inside the canvas — for all four templates, at their small size and at capacity;
- motion markup: every edge in `dataflow` carries three `pathLength="1"` tails; `radar` carries none; a chart keeps its
  markup untouched, so the same drawing still steps row by row in a video;
- RTL: every box is the mirror of the LTR box around the canvas centre, and every label still fits.

**`test/motion.test.js`** — page level:

- default is `subtle`, and `data-motion` is on the root tag next to `data-mode`;
- `motion: off` → the page does not contain `am-fx-travel`; `subtle` → it does;
- `--motion expressive` overrides the draft; an invalid value is a `ParseError` that lists the choices;
- a page with a figure carries `figure.css`; a page without graphics carries neither stylesheet;
- a figure is `pageOnly`, so a video draft reports it as an error instead of drawing half of it;
- `am patch` reads the setting back off the page (`readPage`);
- the reader's text size still scales the drawing (`scale: 1.2` → `width="1104"`);
- print and reduced-motion gates exist in `motion.css` (a text assertion, since css is not parsed).

**Snapshots** — `npm run snapshot` regenerates the examples; the diff must show only added `<style>` blocks and the new attribute.

## 10. Rollout

| Step | Content | Gate |
|---|---|---|
| P0 — **in this change** | primitives + `motion.css` + a chart that lifts in as one | no new syntax; existing snapshots change only in the `<style>` block and the root tag |
| P1 — **in this change** | `figure` with 4 templates + DSL + docs | a draft with a figure renders, prints and exports correctly |
| P2 — not yet | `orbit`/`radar`/`stack` polish, more figures (`timeline`, `sankey`, `matrix`, `gauge`), auto-selection | after real drafts use the four templates |
| P3 | scene spec: a small JSON of nodes/edges/groups the compiler lays out | only if P2 shows templates do not cover real drafts |

Versioning: `motion` and `figure` are additive. A page made by 0.5.x renders identically under 0.6.0 with `motion: off`; the only
change is the extra attribute and one extra stylesheet when the page has graphics.

## 11. Risks

| Risk | Mitigation |
|---|---|
| A moving page distracts from reading | motion is on drawings only, one global period, no motion on text; `motion: off` exists |
| Paint cost on weak hardware | the template capacity caps the edges (60 tails at the worst case, 24 in a typical figure), pulses and flashes are composited, one period |
| The DSL becomes a second language to learn | one grammar for four templates, one line per element, errors that name the line and the fix |
| A figure dates quickly | templates are code, not data; a redesign is a file, not a migration |
| Themes cannot reach the new drawing | every color is a token with a fallback; the selector contract is unchanged |
| Bug: an svg that animates but prints blank | print and reduced-motion tests, plus the rule that the static state is the final state |

## 12. Acceptance criteria

A page made with `motion: subtle` that contains one `figure dataflow`:

1. renders in one file, offline, with no javascript beyond the existing runtime and no new network request;
2. adds ≤ 30 KB to the page (stylesheet + drawing);
3. prints and exports to PDF with every label, edge and node visible, and no light tail;
4. shows no motion at all when the reader asks for reduced motion;
5. is mirrored and readable on a `dir="rtl"` page;
6. passes `npm test`, and its drawing has zero overlapping labels and zero marks outside the viewBox;
7. renders in the same wall time as today within 5 ms.

## 13. Open questions

- Does `subtle` belong on by default, or should the default stay `off` for one release? The proposal is on: a still page is the
  thing being fixed.
- Should `figure` accept a `title=` argument for a caption above the drawing, or is the panel heading enough? The proposal is the
  panel heading only, as with `chart`.
- Is `expressive` worth a third value, or is it a slider (`--am-fx-phase`) that no one sets? The proposal is to ship it as a name
  and keep the variable internal.
