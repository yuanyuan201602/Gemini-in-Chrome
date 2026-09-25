import { TEMPLATES, ROLES } from '../templates.js';

// Builds the single Jev request that forms the first gate. Code proposes the candidates
// (templates, dimension-compatible roles, object types); Jev only picks among them.

export const GATE_FLAGS = {
  needs_figure: 'Essential information (numbers, directions or geometry) is only in a figure that is not included in the text.',
  extra_stage: 'Beyond the single model, the problem adds another stage or twist the model does not cover (for example the chaser brakes later, the particle leaves the field, gravity or friction matters, two chasers).',
  is_physics_problem: 'The text is a complete physics problem that a high-school student is asked to solve.',
};

export function rolesFor(q) {
  return Object.keys(ROLES).filter((r) => r === 'other' || ROLES[r].dim === q.dim);
}

export function buildGateRequest(pre, model = 'jev-1.13.0') {
  const state = {
    problem: pre.text,
    given_quantities: pre.quantities.map((q) => ({ id: q.id, value: q.raw, dimension: q.dim, context: q.context })),
    note: 'The problem is written in Chinese (high-school physics). Quantities were extracted by code and are listed by id.',
  };
  const questions = {};

  questions.template = {
    type: 'choice',
    instructions: 'Which physical model (solution template) does this problem belong to? Choose the single best match for the main question.',
    criteria: Object.fromEntries(Object.entries(TEMPLATES).map(([id, t]) => [id, t.en])),
  };

  for (const q of pre.quantities) {
    const options = rolesFor(q);
    if (options.length < 2) continue;
    questions[`role_${q.id}`] = {
      type: 'choice',
      instructions: `What does the given quantity ${q.id} ("${q.raw}", appearing in: "${q.context}") represent in this problem?`,
      criteria: Object.fromEntries(options.map((r) => [r, ROLES[r].en])),
    };
  }

  for (const [id, t] of Object.entries(TEMPLATES)) {
    if (!t.ready) continue;
    for (const [cid, text] of Object.entries(t.conditions || {})) {
      questions[`cond_${cid}`] = { type: 'noul', instructions: text };
    }
    for (const [oid, opts] of Object.entries(t.objects || {})) {
      questions[`obj_${oid}`] = {
        type: 'choice',
        instructions: `If this problem is of type "${id}", which kind of object is the ${oid}?`,
        criteria: opts,
      };
    }
  }

  for (const [fid, text] of Object.entries(GATE_FLAGS)) questions[`flag_${fid}`] = { type: 'noul', instructions: text };

  return { model, state, questions };
}
