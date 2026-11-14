// Figure registry: template name → builder. Each builder exports { name, summary, render(text, opts) } and returns the svg
// alone; src/components/figure.js owns the fence, the errors and the wrapper.
import dataflow from './dataflow.js';
import orbit from './orbit.js';
import radar from './radar.js';
import stack from './stack.js';

const ALL = [dataflow, orbit, radar, stack];

export const FIGURES = new Map(ALL.map((f) => [f.name, f]));
