import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { label, FatArrow } from '../core/stage.js';
import { createTruck, createPoliceCar, rollWheels, setSiren } from '../models/vehicles.js';
import { buildStreet, skyTexture, LANE_INNER, LANE_OUTER } from '../models/street.js';

// ---- Physics -------------------------------------------------------------
// Clock τ starts when the truck passes the parked police car (both at x = 0).
const V1 = 10; // truck speed, m/s
const DELAY = 2; // reaction time, s
const A = 2.5; // police acceleration, m/s²
const VM = 20; // police speed limit, m/s
const T_ACC_END = DELAY + VM / A; // τ = 10 s
const X_ACC_END = (VM * VM) / (2 * A); // 80 m
const T_CATCH = T_ACC_END + (V1 * T_ACC_END - X_ACC_END) / (VM - V1); // τ = 12 s

const xTruck = (t) => V1 * t;
const vTruck = () => V1;
function xPolice(t) {
  if (t <= DELAY) return 0;
  if (t <= T_ACC_END) return 0.5 * A * (t - DELAY) ** 2;
  return X_ACC_END + VM * (t - T_ACC_END);
}
function vPolice(t) {
  if (t <= DELAY) return 0;
  if (t <= T_ACC_END) return A * (t - DELAY);
  return VM;
}
const fmt = (v, d = 1) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(d);

// ---- Script --------------------------------------------------------------
const statement = `
<p>一辆货车以 <b>v₁ = 10 m/s</b> 的速度匀速行驶，经过停在路边的警车时，警察发现货车超载。
经过 <b>Δt = 2 s</b> 的反应时间后，警车由静止启动，以 <b>a = 2.5 m/s²</b> 做匀加速直线运动追赶。
该路段限速，警车的最大速度为 <b>v<sub>m</sub> = 20 m/s</b>，达到后保持匀速。</p>
<div class="q">(1) 警车追上货车之前，两车间的最大距离是多少？</div>
<div class="q">(2) 警车启动后经过多长时间追上货车？</div>
<div class="q">(3) 画出两车的 v–t 图像，并用图像解释上面的结果。</div>`;

const steps = [
  {
    title: '情境与已知量',
    t0: -4, t1: 0,
    say: '同学们，我们先把题目变成一个真实的场景。路边停着一辆警车，一辆货车以每秒十米的速度匀速开过来。就在货车经过警车的这一刻，我们开始计时。',
    math: [
      { text: '把时间起点定在 <b>货车经过警车</b> 的瞬间，警车位置为坐标原点，向右为正方向。' },
      { tex: 'v_1=10\\,\\text{m/s},\\ \\Delta t=2\\,\\text{s}', text: '货车速度、反应时间' },
      { tex: 'a=2.5\\,\\text{m/s}^2,\\ v_m=20\\,\\text{m/s}', text: '警车加速度、最大速度' },
    ],
  },
  {
    title: '反应时间：货车先走 20 m',
    t0: 0, t1: DELAY,
    say: '警察需要两秒钟的反应时间。这两秒里，警车还停着，货车已经往前开了二十米。',
    math: [
      { tex: 'x_0=v_1\\,\\Delta t=10\\times2=20\\,\\text{m}', text: '警车启动时，两车已相距 20 m' },
    ],
  },
  {
    title: '共速之前：距离越拉越大',
    t0: DELAY, t1: DELAY + V1 / A,
    say: '警车启动了！注意看速度箭头：一开始警车比货车慢，所以两车的距离还在变大。什么时候距离不再变大呢？当警车的速度追到和货车一样快的时候。',
    math: [
      { text: '警车速度 < 货车速度 ⇒ 两车距离 <b>增大</b>' },
      { text: '警车速度 > 货车速度 ⇒ 两车距离 <b>减小</b>' },
      { tex: 'v_{\\text{警}}=a t_1=v_1 \\Rightarrow t_1=\\dfrac{v_1}{a}=\\dfrac{10}{2.5}=4\\,\\text{s}', text: '（t 从警车启动开始计）' },
    ],
  },
  {
    title: '第(1)问：最大距离 40 m',
    t0: DELAY + V1 / A, t1: DELAY + V1 / A,
    say: '速度相等的这一刻，两车距离最大。货车一共走了六十米，警车走了二十米，最大距离是四十米。再看右边的速度时间图，橙色阴影的面积，正好就是这四十米。',
    math: [
      { tex: 'x_{\\text{货}}=v_1(\\Delta t+t_1)=10\\times6=60\\,\\text{m}' },
      { tex: 'x_{\\text{警}}=\\tfrac12 a t_1^2=\\tfrac12\\times2.5\\times4^2=20\\,\\text{m}' },
      { tex: '\\Delta x_{\\max}=60-20=40\\,\\text{m}', cls: 'result', text: '共速时距离最大' },
      { text: '图像法：v–t 图中两线之间所夹的面积 = 位移之差。' },
    ],
  },
  {
    title: '易错点：别忘了限速',
    t0: DELAY + V1 / A, t1: DELAY + V1 / A,
    say: '很多同学接下来会直接列方程：警车的位移等于货车的位移，解出九点六六秒。但是请检查一下，这时警车的速度是每秒二十四米，超过了限速二十米！所以这个答案是错的，警车在追上之前就已经不能再加速了。',
    math: [
      { tex: '\\tfrac12 a t^2=v_1(t+\\Delta t)', text: '直接列式' },
      { tex: 't=4+4\\sqrt2\\approx9.66\\,\\text{s}' },
      { tex: 'v=at\\approx24.1\\,\\text{m/s}>v_m', cls: 'warn', text: '✗ 超过最大速度，不合理！' },
      { text: '结论：必须 <b>分段</b> 讨论——先匀加速，再匀速。' },
    ],
  },
  {
    title: '加速到最大速度',
    t0: DELAY + V1 / A, t1: T_ACC_END,
    say: '我们分段来算。警车加速到每秒二十米需要八秒，这段时间警车跑了八十米，货车跑到了一百米的位置，警车还落后二十米。',
    math: [
      { tex: 't_2=\\dfrac{v_m}{a}=\\dfrac{20}{2.5}=8\\,\\text{s}' },
      { tex: 'x_{\\text{警}}=\\dfrac{v_m^2}{2a}=\\dfrac{400}{5}=80\\,\\text{m}' },
      { tex: 'x_{\\text{货}}=v_1(t_2+\\Delta t)=10\\times10=100\\,\\text{m}' },
      { tex: '\\Delta x=100-80=20\\,\\text{m}', text: '还没追上' },
    ],
  },
  {
    title: '第(2)问：匀速追及',
    t0: T_ACC_END, t1: T_CATCH,
    say: '接下来警车以每秒二十米匀速追赶，每秒比货车多跑十米，二十米的差距只需要两秒。所以，警车启动后一共十秒追上货车，追上的位置在一百二十米处。',
    math: [
      { tex: '(v_m-v_1)\\,t_3=\\Delta x \\Rightarrow t_3=\\dfrac{20}{20-10}=2\\,\\text{s}' },
      { tex: 't=t_2+t_3=8+2=10\\,\\text{s}', cls: 'result', text: '警车启动后 10 s 追上' },
      { tex: 'x=80+20\\times2=120\\,\\text{m}', text: '追上位置' },
    ],
  },
  {
    title: '第(3)问：图像法总结',
    t0: 0, t1: T_CATCH, rate: 2.4,
    say: '最后我们用速度时间图像把整个过程串起来。图线和时间轴围成的面积就是位移。追上的时候，蓝色面积和橙色面积相等，都是一百二十米。追及问题的关键是：抓住速度相等这个临界点，并且检查有没有超出限制条件。',
    math: [
      { text: '<b>两个关键点</b>' },
      { text: '① 速度相等 ⇒ 距离取得极值（最大或最小）' },
      { text: '② 位移相等（从同一点出发）⇒ 追上' },
      { tex: 'S_{\\text{警}}=S_{\\text{货}}=120\\,\\text{m}', cls: 'result', text: 'v–t 图中面积相等' },
      { text: '③ 一定要检验：速度是否超过限制？' },
    ],
  },
];

// ---- Scene ---------------------------------------------------------------
function mount(stage, plots) {
  const { scene, renderer } = stage;
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xdce8f3, 120, 330);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xd6e8ff, 0x6a7a55, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 30, bottom: -30, near: 1, far: 200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  buildStreet(scene);

  const truck = createTruck();
  truck.position.z = LANE_INNER;
  const police = createPoliceCar();
  police.position.z = LANE_OUTER;
  scene.add(truck, police);

  const truckLbl = label('', 'truck');
  truckLbl.position.set(-4, 6.1, 0);
  truck.add(truckLbl);
  const policeLbl = label('', 'police');
  policeLbl.position.set(-2.4, 4.0, 0);
  police.add(policeLbl);

  const vTruckArrow = new FatArrow(0xff9a3c, 0.09);
  const vPoliceArrow = new FatArrow(0x4f9dff, 0.09);
  scene.add(vTruckArrow, vPoliceArrow);

  // Dimension line showing the gap between the two front bumpers.
  const gap = new THREE.Group();
  const gapMat = new THREE.MeshBasicMaterial({ color: 0xffb547 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8), gapMat);
  bar.rotation.z = Math.PI / 2;
  const capA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), gapMat);
  const capB = capA.clone();
  gap.add(bar, capA, capB);
  const dropMat = new THREE.LineDashedMaterial({ color: 0xffb547, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0.8 });
  const mkDrop = () => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]), dropMat);
    l.computeLineDistances();
    return l;
  };
  const dropA = mkDrop(), dropB = mkDrop();
  gap.add(dropA, dropB);
  const gapLbl = label('', 'gap big');
  gap.add(gapLbl);
  gap.position.set(0, 7.2, 3.5);
  scene.add(gap);

  const eventLbl = label('', 'big');
  scene.add(eventLbl);

  const catchRing = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.3, 48),
    new THREE.MeshBasicMaterial({ color: 0x38d39f, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  catchRing.rotation.x = -Math.PI / 2;
  catchRing.position.set(120, 0.05, 3.5);
  scene.add(catchRing);

  let step = 0;
  const followShot = (dist, height, lead = 0) => (t) => {
    const a = xTruck(t), b = xPolice(t);
    const mid = (Math.max(a, b) + Math.min(a, b)) / 2 - 3 + lead;
    const span = Math.abs(a - b);
    const target = new THREE.Vector3(mid, 1.5, 2.5);
    const pos = new THREE.Vector3(mid - 6, height + span * 0.28, dist + span * 0.62);
    return { pos, target };
  };
  const shots = [
    (t) => {
      const k = (t + 4) / 4;
      return { pos: new THREE.Vector3(-26 + k * 10, 9, 22 - k * 2), target: new THREE.Vector3(-6 + k * 4, 1.5, 2.5) };
    },
    followShot(17, 7),
    followShot(16, 7),
    followShot(18, 8),
    followShot(18, 8),
    followShot(16, 7),
    (t) => {
      const x = xPolice(t);
      return { pos: new THREE.Vector3(x + 9, 3.2, 14), target: new THREE.Vector3(x - 3, 1.6, 3) };
    },
    (t) => {
      const x = (xTruck(t) + xPolice(t)) / 2;
      return { pos: new THREE.Vector3(x - 14, 20, 42), target: new THREE.Vector3(x + 2, 0, 2) };
    },
  ];

  function enterStep(i) {
    step = i;
    stage.setShot(shots[i], i === 0 ? 0 : 1.6);
  }

  function update(t, dt) {
    const xt = xTruck(t), xp = xPolice(t);
    truck.position.x = xt;
    police.position.x = xp;
    rollWheels(truck, xt);
    rollWheels(police, xp);
    setSiren(police, t > DELAY - 0.6, performance.now() / 1000);

    const vt = vTruck(t), vp = vPolice(t);
    truckLbl.el.innerHTML = `货车　v = <b>${fmt(vt)}</b> m/s`;
    policeLbl.el.innerHTML = `警车　v = <b>${fmt(vp)}</b> m/s`;
    vTruckArrow.set(new THREE.Vector3(xt + 0.4, 2.6, LANE_INNER), new THREE.Vector3(vt * 0.32, 0, 0));
    vPoliceArrow.set(new THREE.Vector3(xp + 0.4, 1.2, LANE_OUTER), new THREE.Vector3(vp * 0.32, 0, 0));

    const d = xt - xp;
    gap.visible = step >= 1 && step <= 6 && d > 0.3;
    if (gap.visible) {
      bar.scale.y = d;
      bar.position.x = xp + d / 2;
      capA.position.x = xp;
      capB.position.x = xt;
      dropA.position.x = xp;
      dropA.scale.y = 7.2 - 2.1;
      dropB.position.x = xt;
      dropB.scale.y = 7.2 - 4.4;
      gapLbl.position.set(xp + d / 2, 1.3, 0);
      gapLbl.el.innerHTML = `Δx = ${fmt(d)} m`;
    }

    const sunX = (xt + xp) / 2;
    sun.position.set(sunX + 30, 60, 40);
    sun.target.position.set(sunX, 0, 0);

    eventLbl.visible = true;
    catchRing.visible = t >= T_CATCH - 1e-3;
    if (step === 3 || step === 4) {
      eventLbl.position.set(xp - 2, 9.8, 3.5);
      eventLbl.el.innerHTML = step === 3 ? '速度相等 ⇒ 距离最大 40 m' : '⚠ 直接列方程？先检查速度！';
    } else if (t >= T_CATCH - 1e-3) {
      eventLbl.position.set(120, 7.5, 3.5);
      eventLbl.el.innerHTML = '追上！ t = 10 s，x = 120 m';
      catchRing.material.opacity = 0.5 + 0.4 * Math.sin(performance.now() / 180);
    } else if (step === 5 && t >= T_ACC_END - 1e-3) {
      eventLbl.position.set(xp - 2, 9.8, 3.5);
      eventLbl.el.innerHTML = '达到最大速度 20 m/s，还差 20 m';
    } else {
      eventLbl.visible = false;
    }
  }

  // ---- Graphs ------------------------------------------------------------
  const [pv, px] = plots;
  pv.setOptions({
    title: 'v–t 图像', xLabel: 't / s', yLabel: 'v/(m·s⁻¹)',
    xMin: 0, xMax: 13, yMin: 0, yMax: 26,
    xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: [0, 10, 20],
  });
  px.setOptions({
    title: 'x–t 图像', xLabel: 't / s', yLabel: 'x / m',
    xMin: 0, xMax: 13, yMin: 0, yMax: 140,
    xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: [0, 40, 80, 120],
  });
  const ORANGE = '#ff9a3c', BLUE = '#4f9dff';

  function drawGraphs(t) {
    const tc = Math.max(0, t);
    pv.begin();
    if (step === 3 || step === 4) {
      const top = pv.sample(() => V1, 0, 6, 60);
      const bot = pv.sample(vPolice, 0, 6, 60);
      pv.fillBetween(top, bot, 'rgba(255,154,60,0.35)');
      pv.text(2.6, 7.2, '面积差 = 40 m', { color: '#ffd48a', bold: true, bg: 'rgba(0,0,0,.5)' });
      pv.vline(6).dot(6, 10, '#fff');
      pv.text(6.2, 11.5, '共速', { color: '#fff' });
    }
    if (step === 4) {
      pv.hline(VM, 'rgba(255,90,90,0.6)');
      pv.text(0.3, VM + 0.6, '限速 20 m/s', { color: '#ff8a8a' });
      const tBad = DELAY + 4 + 4 * Math.SQRT2;
      pv.polyline([[DELAY, 0], [tBad, A * (tBad - DELAY)]], { color: '#ff5b5b', width: 2, dash: [6, 5] });
      pv.cross(tBad, A * (tBad - DELAY));
      pv.text(tBad - 0.2, A * (tBad - DELAY) - 1, '24.1 m/s ✗', { color: '#ff8a8a', align: 'right', base: 'top' });
    }
    if (step === 7) {
      pv.fillBetween(pv.sample(vPolice, 0, tc, 120), [[0, 0], [tc, 0]], 'rgba(79,157,255,0.28)');
      pv.fillBetween(pv.sample(() => V1, 0, tc, 2), [[0, 0], [tc, 0]], 'rgba(255,154,60,0.22)');
      if (t >= T_CATCH - 1e-3) pv.text(6.5, 3, 'S警 = S货 = 120 m', { color: '#fff', bold: true, align: 'center', bg: 'rgba(0,0,0,.55)' });
    }
    if (t > 0) {
      pv.polyline(pv.sample(vTruck, 0, tc, 2), { color: ORANGE, width: 2.5 });
      pv.polyline(pv.sample(vPolice, 0, tc, 200), { color: BLUE, width: 2.5 });
      pv.vline(tc);
      pv.dot(tc, vTruck(tc), ORANGE).dot(tc, vPolice(tc), BLUE);
    }
    pv.end();
    pv.legend([['货车', ORANGE], ['警车', BLUE]]);

    px.begin();
    if (t > 0) {
      px.polyline(px.sample(xTruck, 0, tc, 2), { color: ORANGE, width: 2.5 });
      px.polyline(px.sample(xPolice, 0, tc, 200), { color: BLUE, width: 2.5 });
      const a = xTruck(tc), b = xPolice(tc);
      if (a - b > 0.5) {
        px.polyline([[tc, b], [tc, a]], { color: '#ffb547', width: 3 });
        px.text(tc + 0.2, (a + b) / 2, `Δx=${fmt(a - b)} m`, { color: '#ffd48a', base: 'middle', bg: 'rgba(0,0,0,.45)' });
      }
      px.dot(tc, a, ORANGE).dot(tc, b, BLUE);
      if (t >= T_CATCH - 1e-3) {
        px.dot(T_CATCH, 120, '#38d39f', 6);
        px.text(T_CATCH - 0.3, 124, '追上 (12 s, 120 m)', { color: '#38d39f', align: 'right', bold: true });
      }
    }
    px.end();
    px.legend([['货车', ORANGE], ['警车', BLUE]]);
  }

  function hud(t) {
    const tp = Math.max(0, t - DELAY);
    return `<div class="chip">计时 τ = <b>${fmt(t, 2)}</b> s</div>
      <div class="chip">警车启动后 t = <b>${fmt(tp, 2)}</b> s</div>
      <div class="chip">两车距离 Δx = <b>${fmt(Math.max(0, xTruck(t) - xPolice(t)))}</b> m</div>`;
  }

  return { enterStep, update, drawGraphs, hud };
}

export default {
  id: 'pursuit',
  tab: '追及问题 · 警车追货车',
  statement,
  steps,
  camera: { fov: 42, far: 800 },
  timeLabel: (t) => `τ = ${fmt(t, 2)} s`,
  mount,
};
