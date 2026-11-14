import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderDoc, hasFigure, hasChart } from '../src/render.js';
import { readPage } from '../src/page.js';
import { COMPONENTS } from '../src/components/index.js';
import { CHOICES, ParseError } from '../src/parse.js';
import { CONFIG_KEYS } from '../src/config.js';
import { MOTION_CSS } from '../src/assets.js';

const defaults = { theme: 'blueprint', mode: 'light', style: 'off', motion: 'subtle' };
const page = (body, overrides = {}, options = {}) => renderDoc(`---\ntitle: T\n---\n\n${body}\n`, overrides, defaults, options).html;

const FIGURE = '## Data\n```figure dataflow hub="G" sink="A"\nsource: one\nsource: two\nlane: L | S1 | S2\n```';
const CHART = '## Numbers\n```chart bar\nA | 1\nB | 2\n```';
const PROSE = '## Text\nJust words, no drawing.';

test('motion: the key exists, takes three values, and defaults to subtle', () => {
  assert.deepEqual(CHOICES.motion, ['off', 'subtle', 'expressive']);
  assert.equal(CONFIG_KEYS.motion.default, 'subtle');
  assert.match(page(PROSE), /data-motion="subtle"/);
});

test('motion: the key is written on the root tag, next to the mode', () => {
  assert.match(page(PROSE, { motion: 'expressive' }), /data-mode="light" data-style="off" data-motion="expressive"/);
  assert.match(page(PROSE, { motion: 'off' }), /data-motion="off"/);
});

test('motion: an invalid value is a ParseError that lists the choices', () => {
  assert.throws(() => page(PROSE, { motion: 'fast' }), (e) => e instanceof ParseError && /fast/.test(e.message) && /off \| subtle \| expressive/.test(e.message));
});

test('motion: a page with a drawing and motion on carries the keyframes', () => {
  const html = page(FIGURE);
  assert.match(html, /@keyframes am-fx-travel/);
  assert.match(html, /@keyframes am-fx-draw/);
  assert.match(html, /@keyframes am-fx-pulse/);
  assert.match(html, /--am-fx-phase/);
});

test('motion: off means the stylesheet is not in the page at all, and the drawing is still complete', () => {
  const html = page(FIGURE, { motion: 'off' });
  assert.doesNotMatch(html, /am-fx-travel/);
  assert.doesNotMatch(html, /@keyframes am-fx/);
  // The static look is still there: the figure reads the same, it just does not move.
  assert.match(html, /--am-fx-1: var\(--accent/);
  assert.match(html, /<figure class="am-diagram am-fx">/);
  assert.match(html, /class="am-fx-comet/);
});

test('motion: a chart moves too, without a new syntax and without touching its markup', () => {
  const html = page(CHART);
  assert.match(html, /@keyframes am-fx-in/);
  // One rule for the whole drawing: a chart's rows carry no motion hooks, so the video mode keeps driving them untouched.
  assert.match(html, /data-motion[^{]*\) \.am-chart \{/);
  assert.doesNotMatch(html, /--am-step/);
});

test('motion: a page with no drawing carries neither stylesheet', () => {
  const html = page(PROSE);
  assert.doesNotMatch(html, /--am-fx-1: var\(--accent/);
  assert.doesNotMatch(html, /am-fx-travel/);
});

test('motion: the drawing keeps its box and the reader’s text size still scales it', () => {
  const html = page(FIGURE, { motion: 'expressive' }, { scale: 1.2 });
  assert.match(html, /<svg viewBox="0 0 920 \d+" width="1104"/);
});

test('motion: print and a reader who asks for reduced motion both drop the moving parts, and video drops them too', () => {
  const css = readFileSync(new URL('../src/themes/motion.css', import.meta.url), 'utf8');
  assert.match(css, /@media print\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{/);
  assert.match(css, /html\[data-video\]/);
  // Each gate removes the light tail rather than freezing it: on paper a frozen tail is a stray mark.
  for (const gate of [/@media print\s*\{[\s\S]*?display: none !important/, /prefers-reduced-motion[\s\S]*?display: none !important/]) {
    assert.match(css, gate);
  }
});

test('motion: am patch reads the setting back from the page', () => {
  const html = page(FIGURE, { motion: 'expressive' });
  assert.equal(readPage(html).motion, 'expressive');
  assert.equal(readPage(page(FIGURE, { motion: 'off' })).motion, 'off');
});

test('figure: a drawing belongs to a page, so a video draft is told why it cannot take one', () => {
  const figure = COMPONENTS.get('figure');
  assert.equal(figure.pageOnly, true);
  assert.match(figure.syntax, /video draft reports it as an error/);
});

test('figure: the fence is listed, and the summary says what it draws', () => {
  const figure = COMPONENTS.get('figure');
  assert.equal(figure.name, 'figure');
  assert.match(figure.summary, /Dataflow/);
  assert.match(figure.syntax, /dataflow\|orbit\|radar\|stack/);
});

test('figure: detection is by class, so a page with a figure carries figure.css and a chart does not', () => {
  assert.equal(hasFigure(page(FIGURE)), true);
  assert.equal(hasFigure(page(CHART)), false);
  assert.equal(hasChart(page(CHART)), true);
  assert.match(page(FIGURE), /\.am-fx \{/);
  assert.doesNotMatch(page(CHART), /\.am-fx \{/);
});

test('motion: the two levels differ only by the phase variable, never by a second set of rules', () => {
  assert.equal((MOTION_CSS.match(/@keyframes am-fx-travel/g) ?? []).length, 1);
  assert.match(MOTION_CSS, /html\[data-motion="expressive"\] \{ --am-fx-phase: 0\.82; \}/);
});
