import { num, sig, sci, sciSay, lengthUnit } from '../format.js';

// Template: a charged particle enters a uniform magnetic field with its velocity at angle θ
// to B (0° < θ < 90°) and moves on a helix. Optional screen distance L along B.

export const PARTICLES = {
  proton: { name: '质子', qm: 9.58e7, sign: 1, sym: '+q' },
  electron: { name: '电子', qm: 1.76e11, sign: -1, sym: '−e' },
  alpha: { name: 'α粒子', qm: 4.82e7, sign: 1, sym: '+2e' },
  positive: { name: '带电粒子', qm: null, sign: 1, sym: '+q' },
  negative: { name: '带电粒子', qm: null, sign: -1, sym: '−q' },
};

export const SEC_PER_PERIOD = 8;

export function solveHelix(p) {
  const kind = PARTICLES[p.particle] || PARTICLES.positive;
  const B = p.B, v = p.v;
  const theta = p.theta ?? Math.PI / 2;
  let qm = p.qm ?? null;
  if (qm === null && p.q > 0 && p.m > 0) qm = p.q / p.m;
  if (qm === null) qm = kind.qm;
  const errors = [];
  if (!(B > 0)) errors.push('缺少磁感应强度 B');
  if (!(v > 0)) errors.push('缺少粒子速率 v');
  if (!(qm > 0)) errors.push('缺少比荷 q/m（或电荷量与质量）');
  const deg = (theta * 180) / Math.PI;
  if (deg <= 0.5 || deg >= 89.5) errors.push(`速度与磁场夹角为 ${num(deg, 0)}°，不是螺旋线问题（应为匀速直线或匀速圆周模板）`);
  if (errors.length) return { ok: false, errors };

  const vPerp = v * Math.sin(theta);
  const vPar = v * Math.cos(theta);
  const omega = qm * B;
  const T = (2 * Math.PI) / omega;
  const r = vPerp / omega;
  const pitch = vPar * T;
  const L = p.L ?? null;
  const nScreen = L !== null ? L / pitch : null;
  return {
    ok: true,
    params: { B, v, theta, qm, sign: p.sign ?? kind.sign, particle: p.particle || 'positive', L, qmGiven: p.qm != null || (p.q > 0 && p.m > 0) },
    derived: { vPerp, vPar, omega, T, r, pitch, nScreen, deg },
  };
}

export function helixChecks(params, d) {
  return [
    { name: '分速度平方和等于 v²', ok: Math.abs(d.vPerp ** 2 + d.vPar ** 2 - params.v ** 2) < 1e-6 * params.v ** 2 },
    { name: '螺距 = v∥·T', ok: Math.abs(d.pitch - d.vPar * d.T) < 1e-9 * d.pitch },
    { name: '半径 = v⊥/(qB/m)', ok: Math.abs(d.r * params.qm * params.B - d.vPerp) < 1e-6 * d.vPerp },
  ];
}

const cm = (x, u) => `${sig(x * u.f)}\\,\\text{${u.unit}}`;

export function helixScript(params, d) {
  const kind = PARTICLES[params.particle] || PARTICLES.positive;
  const who = kind.name;
  const { B, v, qm, L } = params;
  const { vPerp, vPar, T, r, pitch, nScreen, deg } = d;
  const ur = lengthUnit(r), up = lengthUnit(pitch);
  const th = `${num(deg, 1)}^\\circ`;
  const steps = [];
  const P = SEC_PER_PERIOD;

  steps.push({
    mark: 'intro', title: '认识实验装置', t0: 0, t1: 7,
    say: `同学们，这是一个磁场实验装置。玻璃管里抽成了真空，外面绕着螺线管，通电后在管内沿管轴产生匀强磁场。${who}从左边射入磁场，速度和磁场方向成${num(deg, 1)}度角。`,
    math: [
      { text: '建立坐标系：O 为出射点，<b>z 轴沿磁场 B 方向</b>（管轴），y 轴竖直向上。' },
      { tex: `B=${sci(B)}\\,\\text{T},\\quad v=${sci(v)}\\,\\text{m/s},\\quad \\theta=${th}` },
      { tex: `q/m=${sci(qm)}\\,\\text{C/kg}`, text: params.qmGiven ? '' : `（${who}的比荷，查表值）` },
    ],
  });

  steps.push({
    mark: 'decompose', title: '受力分析：把速度分解', t0: 0, t1: 0,
    say: `${who}的速度和磁场不垂直，我们把速度分解成两个分量：沿磁场方向的 v 平行，和垂直于磁场方向的 v 垂直。沿磁场方向的分量不受洛伦兹力，垂直分量受到洛伦兹力，这个力始终和速度垂直。`,
    math: [
      { tex: `v_{\\parallel}=v\\cos${th}\\approx${sci(vPar)}\\,\\text{m/s}` },
      { tex: `v_{\\perp}=v\\sin${th}\\approx${sci(vPerp)}\\,\\text{m/s}` },
      { tex: 'v_{\\parallel}\\parallel B\\ \\Rightarrow\\ F_{\\parallel}=0', text: '不受力' },
      { tex: 'F=qv_{\\perp}B', text: `方向由左手定则判断${params.sign < 0 ? '（负电荷，四指指向运动的反方向）' : ''}，始终垂直于 v⊥` },
    ],
  });

  steps.push({
    mark: 'perp_circle', title: '垂直于 B：匀速圆周运动', t0: 0, t1: P,
    say: `现在沿着磁场方向看过去。在垂直于磁场的平面里，洛伦兹力提供向心力，${who}做匀速圆周运动。半径约${sig(r * ur.f)}${ur.say}，周期约${sciSay(T)}秒。注意，周期和速度大小无关。`,
    math: [
      { tex: 'qv_{\\perp}B=m\\dfrac{v_{\\perp}^2}{r}' },
      { tex: `r=\\dfrac{mv_{\\perp}}{qB}=\\dfrac{${sci(vPerp)}}{${sci(qm)}\\times${sci(B)}}\\approx${cm(r, ur)}`, cls: 'result' },
      { tex: `T=\\dfrac{2\\pi m}{qB}=\\dfrac{2\\pi}{${sci(qm)}\\times${sci(B)}}\\approx${sci(T)}\\,\\text{s}`, cls: 'result' },
      { text: '周期 T 与速度大小无关！' },
    ],
  });

  steps.push({
    mark: 'par_line', title: '平行于 B：匀速直线运动', t0: 0, t1: P,
    say: `再从侧面看。沿磁场方向${who}不受力，所以做匀速直线运动。看下面尺子上的小球，它在均匀地向前移动，z 随 t 变化的图像是一条直线。`,
    math: [
      { tex: 'F_{\\parallel}=0\\ \\Rightarrow\\ z=v_{\\parallel}t', text: '匀速直线运动' },
      { text: '侧面看：上下起伏是圆周运动的“投影”，前进是匀速直线运动。' },
    ],
  });

  steps.push({
    mark: 'helix', title: '合成：等距螺旋线', t0: 0, t1: P,
    say: `把两个分运动合起来，${who}一边转圈，一边匀速前进，轨迹就是一条等距螺旋线。转一圈的时间里前进的距离叫做螺距，约${sig(pitch * up.f)}${up.say}。`,
    math: [
      { text: '圆周运动 + 匀速直线运动 ⇒ <b>等距螺旋线</b>' },
      { tex: `p=v_{\\parallel}T=${sci(vPar)}\\times${sci(T)}\\approx${cm(pitch, up)}`, cls: 'result' },
    ],
  });

  if (L !== null) {
    const n = Math.round(nScreen);
    const onAxis = n >= 1 && Math.abs(nScreen - n) < 0.02;
    steps.push({
      mark: 'screen', title: onAxis ? `打在屏上：第 ${n} 圈回到轴线` : '打在屏上：是否回到轴线？', t0: 0, t1: P * nScreen, rate: Math.max(1, nScreen),
      say: onAxis
        ? `屏到出发点的距离是${sig(L * up.f)}${up.say}，正好是螺距的${n}倍，所以${who}转完${n}圈时恰好回到 z 轴，打在屏与轴的交点上。`
        : `屏到出发点的距离是${sig(L * up.f)}${up.say}，是螺距的${num(nScreen, 2)}倍，不是整数倍，所以${who}打到屏上时不在 z 轴上。`,
      math: [
        { text: '每经过一个周期 T，粒子重新回到 z 轴上。' },
        { tex: `\\dfrac{L}{p}=\\dfrac{${cm(L, up)}}{${cm(pitch, up)}}\\approx${num(nScreen, 2)}`, cls: onAxis ? 'result' : 'warn' },
        { tex: 'L=np\\quad(n=1,2,3,\\dots)', text: '回到轴线的条件' },
      ],
    });
  } else {
    steps.push({
      mark: 'screen', title: '打在屏上：回到轴线', t0: P, t1: P,
      say: `每转完整一圈，${who}在垂直平面内就回到出发点，也就是重新回到 z 轴上。所以荧光屏到出发点的距离，必须是螺距的整数倍。`,
      math: [
        { text: '每经过一个周期 T，粒子重新回到 z 轴上。' },
        { tex: `L=np\\approx${sig(pitch * up.f)}n\\ \\text{${up.unit}}\\quad(n=1,2,3,\\dots)`, cls: 'result' },
      ],
    });
  }

  steps.push({
    mark: 'focus', title: '拓展：为什么能“聚焦”', t0: 0, t1: P,
    say: `一束${who}朝不同方向射出，但和磁场的夹角都相同。它们各自转着不同的圈，却在同一时刻、同一点汇聚到一起！因为周期和方向无关，大家同时转完一圈；沿磁场方向的速度也都相同。这就是磁聚焦。`,
    math: [
      { tex: 'T=\\dfrac{2\\pi m}{qB}', text: '与方向无关 ⇒ 同时回到轴上' },
      { tex: 'v_{\\parallel}=v\\cos\\theta', text: '都相同 ⇒ 前进距离相同' },
      { text: '⇒ 在 z = p 处 <b>汇聚于一点</b>：磁聚焦' },
    ],
  });

  steps.push({
    mark: 'summary', title: '方法总结', t0: P, t1: P,
    say: '总结一下：遇到速度和磁场斜交的问题，先分解速度。垂直分量做匀速圆周运动，平行分量做匀速直线运动，合起来就是螺旋线。',
    math: [
      { text: '<b>运动的分解与合成</b>' },
      { text: '① v⊥：洛伦兹力提供向心力 → 匀速圆周' },
      { text: '② v∥：不受力 → 匀速直线' },
      { tex: 'r=\\dfrac{mv\\sin\\theta}{qB},\\ T=\\dfrac{2\\pi m}{qB},\\ p=\\dfrac{2\\pi m v\\cos\\theta}{qB}', cls: 'result' },
    ],
  });

  return steps;
}