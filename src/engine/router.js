import { TEMPLATES, ROLES } from './templates.js';
import { num } from './format.js';

// Stage 3: turn Jev's typed answers into a decision. Nothing here guesses physics; it only
// applies thresholds and consistency checks (dimensions, duplicates, required roles).

export const THRESHOLDS = { template: 0.6, role: 0.5, condition: 0.5, flag: 0.5 };

const LEAD_NAMES = { truck: '货车', car: '汽车', bike: '自行车', person: '行人' };
const CHASER_NAMES = { police: '警车', car: '汽车', motorbike: '摩托车', person: '追赶者' };

export function objectNames(answers) {
  const lead = answers.obj_lead?.choice, chaser = answers.obj_chaser?.choice;
  let a = LEAD_NAMES[lead] || '前车', b = CHASER_NAMES[chaser] || '后车';
  if (a === b) { a += '甲'; b += '乙'; }
  return { lead: a, chaser: b, leadKind: LEAD_NAMES[lead] ? lead : 'car', chaserKind: CHASER_NAMES[chaser] ? chaser : 'car' };
}

export function route(pre, answers, th = THRESHOLDS) {
  const reasons = [], warnings = [];
  const tplAns = answers.template || { choice: 'other', confidence: 0 };
  const id = tplAns.choice;
  const tpl = TEMPLATES[id];
  const out = { template: id, templateZh: tpl?.zh || id, confidence: tplAns.confidence, reasons, warnings, roles: {}, assignments: [] };

  if ((answers.flag_is_physics_problem?.noul ?? 1) < th.flag) reasons.push('看起来不是一道完整的物理题');
  if (!tpl || tplAns.confidence < th.template) reasons.push(`题型判断置信度不足（${id}，${num(tplAns.confidence * 100, 0)}% < ${th.template * 100}%）`);
  else if (!tpl.ready) reasons.push(`识别为「${tpl.zh}」，该模板尚未实现`);
  if ((answers.flag_needs_figure?.noul ?? 0) >= th.flag) reasons.push('关键信息在图中，文字不足以求解');
  if ((answers.flag_extra_stage?.noul ?? 0) >= th.flag) reasons.push('题目含有模板之外的附加过程');
  if (reasons.length || !tpl?.ready) return { ...out, decision: 'fallback' };

  for (const [cid, text] of Object.entries(tpl.conditions || {})) {
    const p = answers[`cond_${cid}`]?.noul ?? 0;
    if (p < th.condition) reasons.push(`模板前提不满足：${text}（${num(p * 100, 0)}%）`);
  }

  const used = new Map();
  for (const q of pre.quantities) {
    const ans = answers[`role_${q.id}`];
    let role = ans?.choice || 'other';
    const conf = ans?.confidence ?? 1;
    if (role !== 'other' && !tpl.roles.includes(role)) {
      warnings.push(`${q.raw}：角色 ${role} 不属于该模板，按“其他”处理`);
      role = 'other';
    }
    if (role !== 'other' && ROLES[role].dim !== q.dim) {
      reasons.push(`${q.raw}：量纲 ${q.dim} 与角色 ${ROLES[role].zh} 不符`);
      continue;
    }
    out.assignments.push({ id: q.id, raw: q.raw, si: q.si, role, roleZh: ROLES[role].zh, confidence: conf });
    if (role === 'other') continue;
    if (conf < th.role) reasons.push(`${q.raw} 的含义不确定（${ROLES[role].zh}，${num(conf * 100, 0)}%）`);
    const prev = used.get(role);
    if (prev && Math.abs(prev.si - q.si) > 1e-9 * Math.max(1, Math.abs(q.si))) reasons.push(`${prev.raw} 与 ${q.raw} 都被判为「${ROLES[role].zh}」`);
    used.set(role, q);
    out.roles[role] = q.si;
  }
  for (const r of tpl.required) if (!(r in out.roles)) reasons.push(`缺少必要条件：${ROLES[r].zh}`);

  const obj = Object.fromEntries(Object.keys(tpl.objects || {}).map((k) => [k, answers[`obj_${k}`]?.choice]));
  out.objects = obj;
  out.names = objectNames(answers);
  return { ...out, decision: reasons.length ? 'fallback' : 'template' };
}
