import { preprocess } from './preprocess.js';
import { statementHtml } from './format.js';
import { TEMPLATES } from './templates.js';
import { buildGateRequest } from './gate/questions.js';
import { route, THRESHOLDS } from './router.js';

// The whole solve flow, shared by the Node server and the browser:
//   1 preprocess → 2 Jev gate → 3 router → 4 template solver + checks → 5 solution script
// If the router rejects the template path, an optional LLM fallback writes a text-only
// script; without one, the problem is queued for teacher review.
//
// gate(request, pre) → Jev-shaped response; fallback({ text, pre, decision }) → { steps }.

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export async function runPipeline(rawText, { gate, fallback = null, thresholds = THRESHOLDS, model = 'jev-1.13.0' } = {}) {
  const trace = [];
  const stage = async (key, label, fn) => {
    const t0 = now();
    try {
      const r = await fn();
      trace.push({ key, label, ms: Math.round(now() - t0), status: 'ok', detail: r?.detail });
      return r;
    } catch (e) {
      trace.push({ key, label, ms: Math.round(now() - t0), status: 'error', detail: String(e.message || e) });
      throw e;
    }
  };
  const result = { ok: false, trace };

  const text = String(rawText || '').trim();
  if (text.length < 8) return { ...result, route: 'reject', reasons: ['题目太短'] };

  const pre = await stage('preprocess', '① 预处理：抽取物理量、单位换算', () => {
    const p = preprocess(text);
    return Object.assign(p, { detail: p.quantities.map((q) => `${q.id}: ${q.raw} → ${q.dim} = ${q.si}`) });
  });
  result.statementHtml = statementHtml(pre);
  result.quantities = pre.quantities;

  const request = buildGateRequest(pre, model);
  let gateRes;
  try {
    gateRes = await stage('gate', '② Jev 第一道关卡：题型 / 物理量角色 / 前提条件', async () => {
      const r = await gate(request, pre);
      return Object.assign(r, { detail: { model: r.model, questions: Object.keys(request.questions).length, usage: r.usage } });
    });
  } catch {
    return { ...result, route: 'review', reasons: ['判断引擎不可用'] };
  }
  result.model = gateRes.model;
  result.gate = { request, answers: gateRes.answers };

  const decision = await stage('route', '③ 路由：置信度门槛 + 量纲一致性', () => {
    const d = route(pre, gateRes.answers, thresholds);
    return Object.assign(d, { detail: { decision: d.decision, template: d.template, confidence: d.confidence, reasons: d.reasons, warnings: d.warnings } });
  });
  Object.assign(result, {
    template: decision.template, templateZh: decision.templateZh, confidence: decision.confidence,
    assignments: decision.assignments, reasons: decision.reasons, warnings: decision.warnings, names: decision.names,
  });

  if (decision.decision === 'template') {
    const tpl = TEMPLATES[decision.template];
    const solved = await stage('solve', '④ 模板求解 + 自检', () => {
      const s = tpl.solve(tpl.build(decision.roles, decision.objects || {}));
      if (s.ok) s.checks = tpl.checks(s.params, s.derived);
      return Object.assign(s, { detail: s.ok ? { params: s.params, checks: s.checks } : { errors: s.errors } });
    });
    if (solved.ok && solved.checks.every((c) => c.ok)) {
      const steps = await stage('script', '⑤ 生成讲解脚本（旁白 + 公式 + 动画标记）', () => {
        const st = tpl.script(solved.params, solved.derived, decision.names);
        return Object.assign(st, { detail: st.map((s) => s.mark) });
      });
      return { ...result, ok: true, route: 'template', params: solved.params, derived: solved.derived, checks: solved.checks, steps: [...steps] };
    }
    result.reasons = solved.ok ? ['自检未通过：' + solved.checks.filter((c) => !c.ok).map((c) => c.name).join('、')] : solved.errors;
  }

  if (fallback) {
    try {
      const fb = await stage('fallback', '④′ 兜底：大模型生成文字讲解（无模板动画）', async () => {
        const r = await fallback({ text, pre, decision });
        return Object.assign(r, { detail: { model: r.model, steps: r.steps?.length } });
      });
      if (fb.steps?.length) return { ...result, ok: true, route: 'llm', steps: fb.steps, fallbackModel: fb.model };
    } catch { /* recorded in trace */ }
  }
  return { ...result, route: 'review' };
}
