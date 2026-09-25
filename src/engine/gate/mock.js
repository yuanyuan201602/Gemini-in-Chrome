// Offline stand-in for Jev: keyword heuristics that answer the same gate request with the
// same response shape. Used when no TYPESAFE_API_KEY is configured, and by the browser when
// the server is unreachable. Every response is marked model: 'local-mock'.

const TEMPLATE_KEYS = {
  pursuit: [/追(赶|上|及|击)|追到/, /匀加速|加速度|由静止|启动/],
  pursuit_decel: [/刹车|减速|相遇|迎面/],
  magnetic_helix: [/磁场|磁感应/, /螺旋|螺距|夹角|成\s*(θ\s*=\s*)?\d+(\.\d+)?\s*(°|度)|斜射|聚焦/],
  projectile: [/平抛|斜抛|水平抛出|抛出/],
  incline_friction: [/斜面|摩擦/],
  connected_bodies: [/连接体|木板|滑块|传送带|滑轮/],
  vertical_circle: [/竖直.*圆|圆周|卫星|轨道|万有引力/],
  spring_energy: [/弹簧|机械能|动能定理|功率/],
  collision_momentum: [/动量|碰撞|反冲/],
  efield_deflection: [/电场|极板|偏转电压|加速电压/],
  bfield_circle_boundary: [/垂直(射入|进入)?磁场|有界磁场|磁场边界/],
  composite_field: [/速度选择器|质谱|回旋加速器|复合场/],
  em_induction_rod: [/导体棒|切割|线框|感应电动势|导轨/],
  ac_transformer: [/变压器|交流|输电/],
};

function choice(scores, fallback = 'other') {
  const entries = Object.entries(scores);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return { type: 'choice', choice: fallback, confidence: 0.4, probabilities: { [fallback]: 0.4 } };
  const probabilities = Object.fromEntries(entries.map(([k, v]) => [k, v / total]));
  const [best, p] = entries.sort((a, b) => b[1] - a[1])[0];
  return { type: 'choice', choice: best, confidence: probabilities[best], probabilities };
}

const noul = (p) => ({ type: 'noul', noul: p });

function templateScores(text) {
  const s = {};
  for (const [id, res] of Object.entries(TEMPLATE_KEYS)) {
    const hits = res.filter((re) => re.test(text)).length;
    s[id] = hits === res.length ? hits * 3 : hits * 0.6;
  }
  if (s.pursuit_decel > 0 && s.pursuit > 0) s.pursuit_decel += 2;
  if (s.magnetic_helix >= 6) s.bfield_circle_boundary = 0;
  s.other = 0.3;
  return s;
}

function guessRole(q, options, tpl, text) {
  const c = q.context;
  const pick = (r) => (options.includes(r) ? r : 'other');
  switch (q.dim) {
    case 'velocity':
      if (tpl === 'magnetic_helix') return pick('particle_speed');
      if (/最大|限速|最高|不超过|最多/.test(c)) return pick('chaser_vmax');
      return pick('lead_speed');
    case 'acceleration': return pick('chaser_accel');
    case 'time': return /反应|后[，,]?.*(启动|出发|追)|延迟|才/.test(text.slice(q.index, q.index + 20) + c) ? pick('reaction_delay') : 'other';
    case 'magnetic_field': return pick('field_B');
    case 'angle': return pick('angle_v_B');
    case 'charge_mass': return pick('charge_mass_ratio');
    case 'charge': return pick('particle_charge');
    case 'mass': return pick('particle_mass');
    case 'length': return /屏/.test(c) ? pick('screen_distance') : 'other';
    default: return 'other';
  }
}

function objectGuess(oid, text) {
  const rules = {
    lead: [['truck', /货车|卡车/], ['bike', /自行车|单车/], ['person', /行人|人以|某人|同学/], ['car', /汽车|轿车|客车|小车/]],
    chaser: [['police', /警车/], ['motorbike', /摩托/], ['person', /人.*追/], ['car', /汽车|轿车|小车/]],
    particle: [['electron', /电子/], ['proton', /质子/], ['alpha', /α|阿尔法/], ['negative', /负电|带负/], ['positive', /./]],
  }[oid] || [];
  const s = {};
  for (const [k, re] of rules) if (re.test(text) && !(k in s)) s[k] = Object.keys(s).length ? 0.3 : 1;
  if (oid === 'chaser' && s.car && s.truck) delete s.car;
  return choice(s, 'other');
}

export function mockGate(request, pre) {
  const text = pre.text;
  const answers = {};
  const tplAns = choice(templateScores(text));
  answers.template = tplAns;
  const tpl = tplAns.choice;

  for (const q of pre.quantities) {
    const key = `role_${q.id}`;
    const qn = request.questions[key];
    if (!qn) continue;
    const options = Object.keys(qn.criteria);
    const r = guessRole(q, options, tpl, text);
    answers[key] = { type: 'choice', choice: r, confidence: 0.8, probabilities: { [r]: 0.8 } };
  }

  // Two unmarked speeds in a pursuit: the one with a limit word wins chaser_vmax already;
  // if both look like lead_speed, the larger one is taken as the limit.
  const speeds = pre.quantities.filter((q) => answers[`role_${q.id}`]?.choice === 'lead_speed');
  if (tpl === 'pursuit' && speeds.length > 1) {
    const max = speeds.reduce((a, b) => (b.si > a.si ? b : a));
    answers[`role_${max.id}`] = { type: 'choice', choice: 'chaser_vmax', confidence: 0.55, probabilities: { chaser_vmax: 0.55, lead_speed: 0.45 } };
  }

  for (const key of Object.keys(request.questions)) {
    if (answers[key]) continue;
    if (key === 'cond_start_same_point') answers[key] = noul(/经过|驶过|从.*旁|同时.*同地|同一(地点|位置)|并排/.test(text) ? 0.85 : 0.35);
    else if (key === 'cond_oblique_velocity') answers[key] = noul(/夹角|成\s*(θ\s*=\s*)?\d|斜/.test(text) && !/垂直(射入|进入)/.test(text) ? 0.9 : 0.2);
    else if (key.startsWith('obj_')) answers[key] = objectGuess(key.slice(4), text);
    else if (key === 'flag_needs_figure') answers[key] = noul(pre.refersToFigure && pre.quantities.length < 3 ? 0.7 : pre.refersToFigure ? 0.4 : 0.05);
    else if (key === 'flag_extra_stage') answers[key] = noul(/然后.*(刹车|减速)|离开磁场|再进入|第二辆/.test(text) ? 0.8 : 0.1);
    else if (key === 'flag_is_physics_problem') answers[key] = noul(pre.quantities.length >= 2 ? 0.95 : 0.3);
  }

  return { model: 'local-mock', answers, usage: { input_tokens: 0, output_tokens: 0 } };
}
