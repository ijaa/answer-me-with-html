// Motion primitives: the light that runs along an edge, the pulse that marks the node it reached, the flash where it arrived.
// Each one returns markup with classes and inline custom properties; src/themes/motion.css owns the keyframes, so a page with
// motion: off never carries them, and every drawing keeps its static look when the animation is absent (a light tail is
// opacity: 0 until the stylesheet turns it on).
//
// Two rules hold for all of them:
// - no primitive knows a color: the series number becomes am-fx-s1 … am-fx-s4, and src/themes/figure.css maps those to the
//   theme's diagram tokens;
// - no primitive measures a path: an edge that moves carries pathLength="1", so dash lengths are fractions of the path and one
//   keyframe serves a 20 unit edge and a 900 unit one.

const round = (n) => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// d: the path, len: its length in drawing units (the builder knows it while it draws). delay: seconds before the run starts,
// speed: drawing units per second, so a long edge takes longer and the eye reads one speed. series: 1 to 4.
export function comet(d, len, { delay = 0, speed = 620, time, tail = 110, series = 1, width = 2.4 } = {}) {
  const length = Math.max(len, 1);
  // A tail never covers more than half of its edge: on a short edge a long tail would read as a solid segment.
  const norm = Math.min(0.5, tail / length);
  // time: the whole run, when the figure schedules its edges on one clock; otherwise the length at the given speed.
  const duration = round(time ?? (length + tail + 8) / speed);
  const layer = (keep, cls, scale) => {
    const from = round(Math.max(0.004, norm * keep));
    const to = round(-(1 + norm * (1 + keep)));
    return `<path class="am-fx-comet am-fx-s${clamp(series, 1, 4)} ${cls}" d="${d}" pathLength="1" style="--am-fx-delay:${round(delay)}s;--am-fx-time:${duration}s;--am-fx-from:${from};--am-fx-to:${to};--am-fx-dash:${from} 2;stroke-width:${round(width * scale)}"/>`;
  };
  // Tail (long, dim), middle (half as long, brighter), head (short, opaque and a little wider): three strokes with the same
  // head read as one light with a gradient tail, without a gradient per edge.
  return layer(1, 'am-fx-tail', 1) + layer(0.5, 'am-fx-mid', 0.85) + layer(0.16, 'am-fx-head', 1.35);
}

// A ring that grows out of a node and fades. The group scales about its own box (transform-box: fill-box in the stylesheet), so
// the same markup works on a node of any radius.
export function pulse(cx, cy, r, { delay = 0, period = 4.8, grow = 1.55, series = 1, width = 1.5 } = {}) {
  return `<g class="am-fx-pulse am-fx-s${clamp(series, 1, 4)}" style="--am-fx-delay:${round(delay)}s;--am-fx-period:${round(period)}s;--am-fx-grow:${round(grow)}"><circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" stroke-width="${round(width)}"/></g>`;
}

// One blink per period, where a moving light arrives at a stop.
export function flash(cx, cy, r, { delay = 0, period = 4.8, series = 1 } = {}) {
  return `<circle class="am-fx-flash am-fx-s${clamp(series, 1, 4)}" cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" style="--am-fx-delay:${round(delay)}s;--am-fx-period:${round(period)}s"/>`;
}

// An edge that draws itself in when the page opens. It keeps its static stroke from figure.css; motion.css only adds the dash.
export function edgeDraw(d, { delay = 0, cls = '' } = {}) {
  return `<path class="am-fx-edge am-fx-draw${cls ? ` ${cls}` : ''}" d="${d}" pathLength="1" style="--am-fx-delay:${round(delay)}s"/>`;
}

// A ring or a sector that turns about a point in drawing units (transform-origin is read in the viewBox for an svg element).
// cx and cy are the point after the direction has been applied by the caller.
export function spin(inner, { cx, cy, period = 26, cls = '' } = {}) {
  return `<g class="am-fx-spin${cls ? ` ${cls}` : ''}" style="--am-fx-period:${round(period)}s;transform-origin:${round(cx)}px ${round(cy)}px">${inner}</g>`;
}
