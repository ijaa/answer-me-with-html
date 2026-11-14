// Figure registry: template name → builder. Each builder exports { name, summary, render(text, opts) } and returns the svg
// alone; src/components/figure.js owns the fence, the errors and the wrapper.
import dataflow from './dataflow.js';
import gauge from './gauge.js';
import matrix from './matrix.js';
import orbit from './orbit.js';
import quadrant from './quadrant.js';
import radar from './radar.js';
import sankey from './sankey.js';
import stack from './stack.js';

const ALL = [dataflow, gauge, matrix, orbit, quadrant, radar, sankey, stack];

export const FIGURES = new Map(ALL.map((f) => [f.name, f]));
