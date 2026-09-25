import { num } from '../format.js';

// Template: an object at rest starts (after an optional delay) with constant acceleration,
// possibly capped at a maximum speed, to chase an object moving at constant speed that
// passed it at τ = 0.  Scene clock τ starts when the lead object passes the chaser.
export function solvePursuit(p) {
  const { v1, a } = p;
  const d = p.delay ?? 0;
  const vm = p.vmax ?? null;
  const errors = [];
  if (!(v1 > 0)) errors.push('缺少被追者的速度');
  if (!(a > 0)) errors.push('缺少追赶者的加速度');
  if (d < 0) errors.push('反应时间不能为负');
  if (vm !== null && vm <= v1) errors.push(`最大速度 ${num(vm)} m/s 不大于前车速度 ${num(v1)} m/s，永远追不上`);
  if (errors.length) return { ok: false, errors };

  const t1 = v1 / a;
  const gapMax = v1 * (d + t1) - 0.5 * a * t1 * t1;
  const tNaive = (v1 + Math.sqrt(v1 * v1 + 2 * a * v1 * d)) / a;
  const vNaive = a * tNaive;
  const capped = vm !== null && vNaive > vm;
  let tc, xc, t2 = null, x2 = null, gap2 = null, t3 = null;
  if (capped) {
    t2 = vm / a;
    x2 = (vm * vm) / (2 * a);
    gap2 = v1 * (t2 + d) - x2;
    t3 = gap2 / (vm - v1);
    tc = t2 + t3;
    xc = x2 + vm * t3;
  } else {
    tc = tNaive;
    xc = 0.5 * a * tc * tc;
  }

  const derived = { t1, gapMax, tNaive, vNaive, capped, t2, x2, gap2, t3, tCatch: tc, xCatch: xc, tauCatch: d + tc };
  return { ok: true, params: { v1, a, delay: d, vmax: vm }, derived };
}

export function pursuitChecks(params, derived) {
  const checks = [];
  const { v1, a, delay: d, vmax: vm } = params;
  const xLead = v1 * (d + derived.tCatch);
  checks.push({ name: '追上时两车位移相等', ok: Math.abs(xLead - derived.xCatch) < 1e-6 * Math.max(1, xLead) });
  if (vm !== null) {
    const vEnd = Math.min(a * derived.tCatch, vm);
    checks.push({ name: '全程速度不超过最大速度', ok: vEnd <= vm + 1e-9 });
  }
  checks.push({ name: '最大距离出现在共速时刻', ok: derived.t1 <= derived.tCatch });
  return checks;
}

const T = (s) => `\\text{${s}}`;

export function pursuitScript(params, derived, names = {}) {
  const lead = names.lead || '货车';
  const chaser = names.chaser || '警车';
  const { v1, a, delay: d, vmax: vm } = params;
  const { t1, gapMax, tNaive, vNaive, capped, t2, x2, gap2, t3, tCatch, xCatch } = derived;
  const L = T(lead), C = T(chaser);
  const steps = [];

  steps.push({
    mark: 'intro', title: '情境与已知量', t0: -4, t1: 0,
    say: `同学们，我们先把题目变成一个真实的场景。${chaser}停在路边，${lead}以每秒${num(v1)}米的速度匀速开过来。就在${lead}经过${chaser}的这一刻，我们开始计时。`,
    math: [
      { text: `把时间起点定在 <b>${lead}经过${chaser}</b> 的瞬间，${chaser}位置为坐标原点，向右为正方向。` },
      { tex: `v_1=${num(v1)}\\,\\text{m/s}${d > 0 ? `,\\ \\Delta t=${num(d)}\\,\\text{s}` : ''}`, text: `${lead}速度${d > 0 ? '、反应时间' : ''}` },
      { tex: `a=${num(a)}\\,\\text{m/s}^2${vm !== null ? `,\\ v_m=${num(vm)}\\,\\text{m/s}` : ''}`, text: `${chaser}加速度${vm !== null ? '、最大速度' : ''}` },
    ],
  });

  if (d > 0) {
    steps.push({
      mark: 'delay', title: `反应时间：${lead}先走 ${num(v1 * d)} m`, t0: 0, t1: d,
      say: `${chaser}需要${num(d)}秒钟的反应时间。这段时间里，${chaser}还停着，${lead}已经往前开了${num(v1 * d)}米。`,
      math: [{ tex: `x_0=v_1\\,\\Delta t=${num(v1)}\\times${num(d)}=${num(v1 * d)}\\,\\text{m}`, text: `${chaser}启动时，两者已相距 ${num(v1 * d)} m` }],
    });
  }

  steps.push({
    mark: 'before_equal', title: '共速之前：距离越拉越大', t0: d, t1: d + t1,
    say: `${chaser}启动了！注意看速度箭头：一开始${chaser}比${lead}慢，所以两者的距离还在变大。什么时候距离不再变大呢？当${chaser}的速度追到和${lead}一样快的时候。`,
    math: [
      { text: `${chaser}速度 < ${lead}速度 ⇒ 距离 <b>增大</b>` },
      { text: `${chaser}速度 > ${lead}速度 ⇒ 距离 <b>减小</b>` },
      { tex: `v_{${C}}=a t_1=v_1 \\Rightarrow t_1=\\dfrac{v_1}{a}=\\dfrac{${num(v1)}}{${num(a)}}=${num(t1)}\\,\\text{s}`, text: `（t 从${chaser}启动开始计）` },
    ],
  });

  const xl = v1 * (d + t1), xp = 0.5 * a * t1 * t1;
  steps.push({
    mark: 'max_gap', title: `最大距离 ${num(gapMax)} m`, t0: d + t1, t1: d + t1,
    say: `速度相等的这一刻，两者距离最大。${lead}一共走了${num(xl)}米，${chaser}走了${num(xp)}米，最大距离是${num(gapMax)}米。再看速度时间图，橙色阴影的面积，正好就是这${num(gapMax)}米。`,
    math: [
      { tex: `x_{${L}}=v_1(${d > 0 ? '\\Delta t+' : ''}t_1)=${num(v1)}\\times${num(d + t1)}=${num(xl)}\\,\\text{m}` },
      { tex: `x_{${C}}=\\tfrac12 a t_1^2=\\tfrac12\\times${num(a)}\\times${num(t1)}^2=${num(xp)}\\,\\text{m}` },
      { tex: `\\Delta x_{\\max}=${num(xl)}-${num(xp)}=${num(gapMax)}\\,\\text{m}`, cls: 'result', text: '共速时距离最大' },
      { text: '图像法：v–t 图中两线之间所夹的面积 = 位移之差。' },
    ],
  });

  const eq = d > 0 ? `\\tfrac12 a t^2=v_1(t+\\Delta t)` : `\\tfrac12 a t^2=v_1 t`;
  if (capped) {
    steps.push({
      mark: 'trap', title: '易错点：别忘了最大速度', t0: d + t1, t1: d + t1,
      say: `很多同学接下来会直接列方程：${chaser}的位移等于${lead}的位移，解出${num(tNaive)}秒。但是请检查一下，这时${chaser}的速度是每秒${num(vNaive, 1)}米，超过了最大速度每秒${num(vm)}米！所以这个答案是错的，${chaser}在追上之前就已经不能再加速了。`,
      math: [
        { tex: eq, text: '直接列式' },
        { tex: `t\\approx${num(tNaive)}\\,\\text{s}` },
        { tex: `v=at\\approx${num(vNaive, 1)}\\,\\text{m/s}>v_m`, cls: 'warn', text: '✗ 超过最大速度，不合理！' },
        { text: '结论：必须 <b>分段</b> 讨论——先匀加速，再匀速。' },
      ],
    });
    steps.push({
      mark: 'accel_to_vmax', title: '加速到最大速度', t0: d + t1, t1: d + t2,
      say: `我们分段来算。${chaser}加速到每秒${num(vm)}米需要${num(t2)}秒，这段时间${chaser}跑了${num(x2)}米，${lead}跑到了${num(v1 * (t2 + d))}米的位置，${chaser}还落后${num(gap2)}米。`,
      math: [
        { tex: `t_2=\\dfrac{v_m}{a}=\\dfrac{${num(vm)}}{${num(a)}}=${num(t2)}\\,\\text{s}` },
        { tex: `x_{${C}}=\\dfrac{v_m^2}{2a}=${num(x2)}\\,\\text{m}` },
        { tex: `x_{${L}}=v_1(t_2${d > 0 ? '+\\Delta t' : ''})=${num(v1 * (t2 + d))}\\,\\text{m}` },
        { tex: `\\Delta x=${num(v1 * (t2 + d))}-${num(x2)}=${num(gap2)}\\,\\text{m}`, text: '还没追上' },
      ],
    });
    steps.push({
      mark: 'cruise_catch', title: '匀速追及：追上', t0: d + t2, t1: d + tCatch,
      say: `接下来${chaser}以每秒${num(vm)}米匀速追赶，每秒比${lead}多跑${num(vm - v1)}米，${num(gap2)}米的差距需要${num(t3)}秒。所以，${chaser}启动后一共${num(tCatch)}秒追上${lead}，追上的位置在${num(xCatch)}米处。`,
      math: [
        { tex: `(v_m-v_1)\\,t_3=\\Delta x \\Rightarrow t_3=\\dfrac{${num(gap2)}}{${num(vm)}-${num(v1)}}=${num(t3)}\\,\\text{s}` },
        { tex: `t=t_2+t_3=${num(t2)}+${num(t3)}=${num(tCatch)}\\,\\text{s}`, cls: 'result', text: `${chaser}启动后 ${num(tCatch)} s 追上` },
        { tex: `x=${num(x2)}+${num(vm)}\\times${num(t3)}=${num(xCatch)}\\,\\text{m}`, text: '追上位置' },
      ],
    });
  } else {
    const disc = v1 * v1 + 2 * a * v1 * d;
    steps.push({
      mark: 'catch_accel', title: '列方程：追上', t0: d + t1, t1: d + tCatch,
      say: `${chaser}继续加速，速度越来越快，距离开始缩小。追上的时候，两者的位移相等。列出方程解得，${chaser}启动后${num(tCatch)}秒追上${lead}，追上的位置在${num(xCatch)}米处。`,
      math: [
        { tex: eq, text: '位移相等 ⇒ 追上' },
        d > 0
          ? { tex: `t=\\dfrac{v_1+\\sqrt{v_1^2+2av_1\\Delta t}}{a}=\\dfrac{${num(v1)}+\\sqrt{${num(disc)}}}{${num(a)}}\\approx${num(tCatch)}\\,\\text{s}`, cls: 'result' }
          : { tex: `t=\\dfrac{2v_1}{a}=\\dfrac{2\\times${num(v1)}}{${num(a)}}=${num(tCatch)}\\,\\text{s}`, cls: 'result' },
        { tex: `x=\\tfrac12 a t^2\\approx${num(xCatch)}\\,\\text{m}`, text: '追上位置' },
      ],
    });
    if (vm !== null) {
      steps.push({
        mark: 'check_ok', title: '检验：没有超过最大速度', t0: d + tCatch, t1: d + tCatch,
        say: `别忘了检验！追上时${chaser}的速度是每秒${num(a * tCatch, 1)}米，没有超过最大速度每秒${num(vm)}米，所以这个答案是合理的。`,
        math: [{ tex: `v=at\\approx${num(a * tCatch, 1)}\\,\\text{m/s}\\le v_m=${num(vm)}\\,\\text{m/s}`, cls: 'result', text: '✓ 合理' }],
      });
    }
  }

  const total = d + tCatch;
  steps.push({
    mark: 'summary', title: '图像法总结', t0: 0, t1: total, rate: total / 5,
    say: `最后我们用速度时间图像把整个过程串起来。图线和时间轴围成的面积就是位移。追上的时候，蓝色面积和橙色面积相等，都是${num(xCatch)}米。追及问题的关键是：抓住速度相等这个临界点，并且检查有没有超出限制条件。`,
    math: [
      { text: '<b>关键点</b>' },
      { text: '① 速度相等 ⇒ 距离取得极值（最大或最小）' },
      { text: '② 位移相等（从同一点出发）⇒ 追上' },
      { tex: `S_{${C}}=S_{${L}}=${num(xCatch)}\\,\\text{m}`, cls: 'result', text: 'v–t 图中面积相等' },
      { text: '③ 一定要检验：速度是否超过限制？' },
    ],
  });

  return steps;
}
