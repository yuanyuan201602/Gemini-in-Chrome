// CLI: run the solve pipeline on sample problems or on text given as an argument.
//   node scripts/solve.mjs            → all samples, one summary line each
//   node scripts/solve.mjs "题目…"     → full trace for one problem
//   node scripts/solve.mjs --json 2    → full JSON result for sample #2
// Uses real Jev when TYPESAFE_API_KEY is set, otherwise the local stand-in.

import { runPipeline } from '../src/engine/pipeline.js';
import { SAMPLES } from '../src/engine/samples.js';
import { makeGate, makeFallback } from '../server/providers.js';

const gate = makeGate(process.env);
const fallback = makeFallback(process.env);
const args = process.argv.slice(2);
const json = args[0] === '--json';
if (json) args.shift();

if (args.length && !/^\d+$/.test(args[0])) {
  const r = await runPipeline(args.join(' '), { gate, fallback });
  console.log(JSON.stringify(json ? r : { route: r.route, template: r.template, confidence: r.confidence, reasons: r.reasons, trace: r.trace, steps: r.steps?.map((s) => s.title) }, null, 2));
} else {
  const list = args.length ? [SAMPLES[+args[0]]] : SAMPLES;
  for (const s of list) {
    const r = await runPipeline(s.text, { gate, fallback });
    if (json) { console.log(JSON.stringify(r, null, 2)); continue; }
    const ms = r.trace.map((t) => `${t.key}:${t.ms}ms`).join(' ');
    console.log(`\n■ ${s.title}\n  route=${r.route} template=${r.template} conf=${(r.confidence ?? 0).toFixed(2)} model=${r.model}  [${ms}]`);
    for (const a of r.assignments || []) console.log(`    ${a.raw.padEnd(16)} → ${a.roleZh}`);
    if (r.reasons?.length) console.log('  reasons:', r.reasons.join(' | '));
    if (r.checks) console.log('  checks:', r.checks.map((c) => `${c.ok ? '✓' : '✗'}${c.name}`).join(' '));
    if (r.steps) console.log('  steps:', r.steps.map((x) => x.title).join(' → '));
  }
}
