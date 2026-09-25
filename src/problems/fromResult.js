import { createPursuitProblem } from './pursuit.js';
import { createHelixProblem } from './helix.js';
import { createTextProblem } from './text.js';

// Turns a pipeline result into a playable problem for the Player.
export function problemFromResult(r) {
  const base = { id: 'live', tab: '我的题目', statement: r.statementHtml, steps: r.steps };
  if (r.route === 'template' && r.template === 'pursuit') return createPursuitProblem({ ...base, params: r.params, derived: r.derived, names: r.names });
  if (r.route === 'template' && r.template === 'magnetic_helix') return createHelixProblem({ ...base, params: r.params, derived: r.derived });
  if (r.steps?.length) return createTextProblem(base);
  return null;
}
