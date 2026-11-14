// Paths for the figure templates, each with its length in drawing units: a moving light needs to know how far it travels, and
// the length is what keeps one speed across edges of very different size. Lengths are sampled, not looked up: an arc's exact
// length needs elliptic integrals, and 40 samples are within a thousandth of the curve.

const round = (n) => Math.round(n * 10) / 10;

// A cubic Bézier from p0 to p3 with two control points. Returns the path data and its length.
export function cubic([x0, y0], [x1, y1], [x2, y2], [x3, y3]) {
  const d = `M${round(x0)},${round(y0)} C${round(x1)},${round(y1)} ${round(x2)},${round(y2)} ${round(x3)},${round(y3)}`;
  const at = (t) => {
    const u = 1 - t;
    return [
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ];
  };
  return { d, len: sampled(at) };
}

export function line([x0, y0], [x1, y1]) {
  const d = `M${round(x0)},${round(y0)} L${round(x1)},${round(y1)}`;
  return { d, len: round(Math.hypot(x1 - x0, y1 - y0)) };
}

// An upright ellipse through the same path twice: the light runs around it in one direction.
export function ellipse(cx, cy, rx, ry) {
  const d = `M${round(cx - rx)},${round(cy)} A${round(rx)},${round(ry)} 0 1 0 ${round(cx + rx)},${round(cy)} A${round(rx)},${round(ry)} 0 1 0 ${round(cx - rx)},${round(cy)} Z`;
  // Ramanujan's second approximation, accurate to a few parts in ten thousand for the shapes here.
  const h = ((rx - ry) ** 2) / ((rx + ry) ** 2);
  return { d, len: round(Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))) };
}

// A pie slice from angle a0 to a1 (radians, 0 at 3 o'clock, growing clockwise on the page).
export function sector(cx, cy, r, a0, a1) {
  const p = (a) => [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return { d: `M${round(cx)},${round(cy)} L${x0},${y0} A${round(r)},${round(r)} 0 ${large} 1 ${x1},${y1} Z`, len: round(r * Math.abs(a1 - a0)) };
}

// The length of a curve given as a function of t in 0…1, by 40 chords.
export function sampled(at, steps = 40) {
  let total = 0;
  let [px, py] = at(0);
  for (let i = 1; i <= steps; i++) {
    const [x, y] = at(i / steps);
    total += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return round(total);
}
