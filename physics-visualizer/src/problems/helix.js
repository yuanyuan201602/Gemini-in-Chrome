import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { label, FatArrow, canvasTexture } from '../core/stage.js';
import { buildLab, glowSprite, TUBE_R, PSU_POS } from '../models/lab.js';

// ---- Physics (SI) ----------------------------------------------------------
const QM = 1.0e8; // q/m, C/kg (proton ≈ 0.96e8)
const B = 0.1; // T, along +z
const V = 2.0e6; // m/s
const THETA = Math.PI / 6; // angle between v and B
const V_PERP = V * Math.sin(THETA); // 1.0e6
const V_PAR = V * Math.cos(THETA); // 1.732e6
const OMEGA = QM * B; // 1e7 rad/s
const T = (2 * Math.PI) / OMEGA; // 6.28e-7 s
const R = V_PERP / OMEGA; // 0.1 m
const P = V_PAR * T; // 1.088 m

// ---- Display scale -----------------------------------------------------------
const U = 10; // world units per metre (1 unit = 10 cm)
const R_W = R * U;
const P_W = P * U;
const SEC_PER_PERIOD = 8; // animation seconds per cyclotron period
const VEC_SCALE = 1.5e-6; // world units per (m/s) for velocity arrows

// Position (world units) after animation time s, for a particle whose initial
// perpendicular velocity points along azimuth phi.
function pos(s, phi = 0, out = new THREE.Vector3()) {
  const ph = (2 * Math.PI * s) / SEC_PER_PERIOD;
  const ux = Math.cos(phi), uy = Math.sin(phi);
  const nx = uy, ny = -ux; // direction of the initial Lorentz force (v⊥ × B)
  const a = Math.sin(ph), b = 1 - Math.cos(ph);
  return out.set(R_W * (a * ux + b * nx), R_W * (a * uy + b * ny), (P_W * ph) / (2 * Math.PI));
}
function vel(s, phi = 0) {
  const ph = (2 * Math.PI * s) / SEC_PER_PERIOD;
  const ux = Math.cos(phi), uy = Math.sin(phi);
  const nx = uy, ny = -ux;
  const c = Math.cos(ph), d = Math.sin(ph);
  return {
    perp: new THREE.Vector3(c * ux + d * nx, c * uy + d * ny, 0).multiplyScalar(V_PERP),
    par: new THREE.Vector3(0, 0, V_PAR),
    force: new THREE.Vector3(-d * ux + c * nx, -d * uy + c * ny, 0),
  };
}
const physTime = (s) => (s / SEC_PER_PERIOD) * T;
const fmt = (v, d = 2) => v.toFixed(d);

// ---- Script ------------------------------------------------------------------
const statement = `
<p>“磁聚焦”实验装置：抽成真空的玻璃管外绕有螺线管，管内产生沿管轴方向（z 轴）的匀强磁场 <b>B = 0.10 T</b>。
质子源在 O 点以速率 <b>v = 2.0×10⁶ m/s</b> 射出质子，速度方向与磁场方向成 <b>θ = 30°</b>。
质子比荷 <b>q/m = 1.0×10⁸ C/kg</b>，不计重力。</p>
<div class="q">(1) 质子做什么运动？求它在垂直于磁场的平面内做圆周运动的半径 r 和周期 T；</div>
<div class="q">(2) 求螺旋线的螺距 p；</div>
<div class="q">(3) 荧光屏垂直于 z 轴放置，要使质子打在屏与 z 轴的交点上，屏到 O 点的距离 L 应满足什么条件？</div>
<div class="q">(4)【拓展】与 B 夹角都为 θ、但方向各不相同的一束质子，为什么会“聚焦”到同一点？</div>`;

const steps = [
  {
    title: '认识实验装置',
    t0: 0, t1: 7,
    say: '同学们，这是一个磁聚焦实验装置。玻璃管里抽成了真空，外面绕着铜线圈，也就是螺线管，通电后在管内沿着管轴产生匀强磁场。质子从左边的质子源射出，右边是荧光屏，质子打到屏上就会发光。',
    math: [
      { text: '建立坐标系：O 为出射点，<b>z 轴沿磁场 B 方向</b>（管轴），y 轴竖直向上。' },
      { tex: 'B=0.10\\,\\text{T},\\quad v=2.0\\times10^6\\,\\text{m/s},\\quad \\theta=30^\\circ' },
      { tex: 'q/m=1.0\\times10^8\\,\\text{C/kg}' },
    ],
  },
  {
    title: '受力分析：把速度分解',
    t0: 0, t1: 0,
    say: '质子的速度和磁场不垂直，怎么办？我们把速度分解成两个分量：沿着磁场方向的 v 平行，和垂直于磁场方向的 v 垂直。沿磁场方向的分量不受洛伦兹力，垂直分量受到洛伦兹力，而且这个力始终和速度垂直。',
    math: [
      { tex: 'v_{\\parallel}=v\\cos30^\\circ=\\sqrt3\\times10^6\\approx1.73\\times10^6\\,\\text{m/s}' },
      { tex: 'v_{\\perp}=v\\sin30^\\circ=1.0\\times10^6\\,\\text{m/s}' },
      { tex: 'v_{\\parallel}\\parallel B\\ \\Rightarrow\\ F_{\\parallel}=0', text: '不受力' },
      { tex: 'F=qv_{\\perp}B', text: '方向由左手定则判断，始终垂直于 v⊥' },
    ],
  },
  {
    title: '垂直于 B：匀速圆周运动',
    t0: 0, t1: SEC_PER_PERIOD,
    say: '现在我们沿着磁场方向看过去。在垂直于磁场的平面里，洛伦兹力提供向心力，质子做匀速圆周运动。半径是十厘米，周期约零点六三微秒。注意，周期和速度大小无关，这一点后面非常关键。',
    math: [
      { tex: 'qv_{\\perp}B=m\\dfrac{v_{\\perp}^2}{r}' },
      { tex: 'r=\\dfrac{mv_{\\perp}}{qB}=\\dfrac{1.0\\times10^6}{10^8\\times0.10}=0.10\\,\\text{m}', cls: 'result' },
      { tex: 'T=\\dfrac{2\\pi m}{qB}=\\dfrac{2\\pi}{10^8\\times0.10}\\approx6.28\\times10^{-7}\\,\\text{s}', cls: 'result' },
      { text: '周期 T 与速度大小无关！' },
    ],
  },
  {
    title: '平行于 B：匀速直线运动',
    t0: 0, t1: SEC_PER_PERIOD,
    say: '再从侧面看。沿磁场方向质子不受力，所以做匀速直线运动。看下面这把尺子上的小球，它在均匀地向前移动，右下角的 z 随 t 变化的图像是一条直线。',
    math: [
      { tex: 'F_{\\parallel}=0\\ \\Rightarrow\\ z=v_{\\parallel}t', text: '匀速直线运动' },
      { text: '侧面看：上下起伏是圆周运动的“投影”，前进是匀速直线运动。' },
    ],
  },
  {
    title: '合成：等距螺旋线',
    t0: 0, t1: SEC_PER_PERIOD,
    say: '把两个分运动合起来，质子一边转圈，一边匀速前进，轨迹就是一条等距螺旋线。转一圈的时间里前进的距离，叫做螺距，约一点零九米。',
    math: [
      { text: '圆周运动 + 匀速直线运动 ⇒ <b>等距螺旋线</b>' },
      { tex: 'p=v_{\\parallel}T=1.73\\times10^6\\times6.28\\times10^{-7}\\approx1.09\\,\\text{m}', cls: 'result' },
    ],
  },
  {
    title: '打在屏上：回到轴线',
    t0: SEC_PER_PERIOD, t1: SEC_PER_PERIOD,
    say: '每转完整一圈，质子在垂直平面内就回到出发点，也就是重新回到 z 轴上。所以荧光屏到 O 点的距离，必须是螺距的整数倍。这个装置里，屏放在一倍螺距处。',
    math: [
      { text: '每经过一个周期 T，质子重新回到 z 轴上。' },
      { tex: 'L=np=n\\,v_{\\parallel}T\\approx1.09n\\ \\text{m}\\quad(n=1,2,3,\\dots)', cls: 'result' },
    ],
  },
  {
    title: '拓展：为什么能“聚焦”',
    t0: 0, t1: SEC_PER_PERIOD,
    say: '最后看一个有趣的现象：一束质子朝不同方向射出，但和磁场的夹角都是三十度。它们各自转着不同的圈，却在同一时刻、同一点汇聚到一起！原因有两个：第一，周期和速度方向无关，大家同时转完一圈；第二，沿磁场方向的速度都相同，同一时间前进的距离也相同。这就是磁聚焦。',
    math: [
      { tex: 'T=\\dfrac{2\\pi m}{qB}', text: '与方向无关 ⇒ 同时回到轴上' },
      { tex: 'v_{\\parallel}=v\\cos\\theta', text: '都相同 ⇒ 前进距离相同' },
      { text: '⇒ 各质子在 z = p 处 <b>汇聚于一点</b>：磁聚焦（电子显微镜、显像管的原理）' },
    ],
  },
  {
    title: '方法总结',
    t0: SEC_PER_PERIOD, t1: SEC_PER_PERIOD,
    say: '总结一下：遇到速度和磁场斜交的问题，先分解速度。垂直分量做匀速圆周运动，平行分量做匀速直线运动，合起来就是螺旋线。复杂的三维运动，就这样拆成了我们熟悉的两个简单运动。',
    math: [
      { text: '<b>运动的分解与合成</b>' },
      { text: '① v⊥：洛伦兹力提供向心力 → 匀速圆周' },
      { text: '② v∥：不受力 → 匀速直线' },
      { tex: 'r=\\dfrac{mv\\sin\\theta}{qB},\\ T=\\dfrac{2\\pi m}{qB},\\ p=\\dfrac{2\\pi m v\\cos\\theta}{qB}', cls: 'result' },
    ],
  },
];

const BEAM_COLORS = [0xff6b6b, 0xffb347, 0xffe156, 0x7be07b, 0x4fd1ff, 0x6c8cff, 0xc77dff, 0xff7ac8];

// ---- Scene ---------------------------------------------------------------------
function mount(stage, plots) {
  const { scene, renderer } = stage;
  scene.background = canvasTexture(16, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b2233');
    g.addColorStop(1, '#0b0e15');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x30281f, 0.8));
  const key = new THREE.SpotLight(0xfff2de, 400, 80, Math.PI / 5, 0.5, 1.5);
  key.position.set(12, 22, 14);
  key.target.position.set(0, -2, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.8);
  rim.position.set(-10, 8, -12);
  scene.add(rim);

  const lab = buildLab(scene);
  lab.screen.position.z = P_W;

  // Uniform field lines along +z
  const fieldGroup = new THREE.Group();
  const fieldMat = new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.35, depthWrite: false });
  const fieldPts = [[0, 1.6], [0, -2.0], [1.7, -0.4], [-1.7, -0.4], [1.2, 1.2], [-1.2, 1.2], [1.3, -1.7], [-1.3, -1.7]];
  for (const [x, y] of fieldPts) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 13, 6), fieldMat);
    line.rotation.x = Math.PI / 2;
    line.position.set(x, y, 5.3);
    fieldGroup.add(line);
    for (let z = 0.5; z < 12; z += 3) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 10), fieldMat);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(x, y, z);
      fieldGroup.add(cone);
    }
  }
  const bLbl = label('B（匀强磁场，沿 +z）', 'vec');
  bLbl.el.style.color = '#9cc4ff';
  bLbl.position.set(0, 1.8, 12.3);
  fieldGroup.add(bLbl);
  scene.add(fieldGroup);

  // Coordinate axes at O
  const axes = new THREE.Group();
  const axisDefs = [
    ['x', new THREE.Vector3(1, 0, 0), 0xff5a5a],
    ['y', new THREE.Vector3(0, 1, 0), 0x5aff8a],
    ['z', new THREE.Vector3(0, 0, 1), 0x5a9bff],
  ];
  for (const [name, dir, color] of axisDefs) {
    const a = new FatArrow(color, 0.025);
    a.set(new THREE.Vector3(), dir.clone().multiplyScalar(1.6), 0.22);
    axes.add(a);
    const l = label(name, 'axis');
    l.el.style.color = `#${color.toString(16).padStart(6, '0')}`;
    l.center.set(0.5, 0.5);
    l.position.copy(dir.clone().multiplyScalar(1.85));
    axes.add(l);
  }
  const oLbl = label('O', 'axis');
  oLbl.center.set(1.2, -0.1);
  axes.add(oLbl);
  scene.add(axes);

  // Device labels (intro only)
  const deviceLabels = [
    ['螺线管（产生磁场）', new THREE.Vector3(0, TUBE_R + 0.5, 2)],
    ['真空玻璃管', new THREE.Vector3(TUBE_R + 0.3, -1.2, 7)],
    ['荧光屏', new THREE.Vector3(0, TUBE_R + 0.6, P_W + 0.3)],
    ['质子源', new THREE.Vector3(0, 1.1, -1.4)],
    ['直流电源', PSU_POS.clone().add(new THREE.Vector3(0, 1.6, 0))],
  ].map(([text, p]) => {
    const l = label(text, 'big');
    l.position.copy(p);
    scene.add(l);
    return l;
  });

  // Particles: index 0 is the main proton; the rest are only used for the beam step.
  const PATH_SEG = 400;
  const particles = BEAM_COLORS.map((color, k) => {
    const phi = (k * Math.PI * 2) / BEAM_COLORS.length;
    const pts = [];
    for (let i = 0; i <= PATH_SEG; i++) pts.push(pos((i / PATH_SEG) * SEC_PER_PERIOD, phi));
    const curve = new THREE.CatmullRomCurve3(pts);
    const trailMat = new THREE.MeshStandardMaterial({ color: k === 0 ? 0xffd166 : color, emissive: k === 0 ? 0xffb020 : color, emissiveIntensity: 1.1, roughness: 0.4 });
    const trail = new THREE.Mesh(new THREE.TubeGeometry(curve, PATH_SEG, k === 0 ? 0.045 : 0.03, 8, false), trailMat);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(k === 0 ? 0.13 : 0.09, 20, 16), new THREE.MeshBasicMaterial({ color: k === 0 ? 0xfff3c4 : color }));
    const halo = glowSprite(k === 0 ? '#ffcf6a' : `#${color.toString(16).padStart(6, '0')}`);
    halo.scale.setScalar(k === 0 ? 0.9 : 0.6);
    ball.add(halo);
    scene.add(trail, ball);
    return { phi, trail, ball };
  });
  const main = particles[0];
  const pLbl = label('质子 +q', 'vec');
  pLbl.center.set(-0.15, 1.2);
  main.ball.add(pLbl);

  // Velocity decomposition and force arrows on the main proton
  const arrV = new FatArrow(0xffe066, 0.035);
  const arrPar = new FatArrow(0x4fd1ff, 0.035);
  const arrPerp = new FatArrow(0xff8c42, 0.035);
  const arrF = new FatArrow(0xff4fd8, 0.035);
  scene.add(arrV, arrPar, arrPerp, arrF);
  const lV = label('v', 'vec'), lPar = label('v∥', 'vec'), lPerp = label('v⊥', 'vec'), lF = label('F 洛伦兹力', 'vec');
  lV.el.style.color = '#ffe066'; lPar.el.style.color = '#4fd1ff'; lPerp.el.style.color = '#ff8c42'; lF.el.style.color = '#ff7fe6';
  [lV, lPar, lPerp, lF].forEach((l) => { l.center.set(0.5, 0.5); scene.add(l); });
  const guideMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.1, gapSize: 0.08, transparent: true, opacity: 0.5 });
  const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), guideMat);
  scene.add(guide);

  // Projection onto the plane z = 0 (the circle) and onto the z-axis ruler
  const circlePts = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    circlePts.push(new THREE.Vector3(R_W * Math.sin(a), -R_W * (1 - Math.cos(a)), 0));
  }
  const projCircle = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts), new THREE.LineDashedMaterial({ color: 0xff8c42, dashSize: 0.12, gapSize: 0.08 }));
  projCircle.computeLineDistances();
  scene.add(projCircle);
  const projPlane = new THREE.Mesh(new THREE.CircleGeometry(TUBE_R - 0.1, 64), new THREE.MeshBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(projPlane);
  const radius = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -R_W, 0), new THREE.Vector3(0, 0, 0)]), new THREE.LineBasicMaterial({ color: 0xffffff }));
  scene.add(radius);
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  center.position.set(0, -R_W, 0);
  scene.add(center);
  const rLbl = label('r = 10 cm', 'vec');
  rLbl.center.set(0.5, 0.5);
  scene.add(rLbl);
  const ghostCircle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff8c42 }));
  scene.add(ghostCircle);

  const RULER_Y = -TUBE_R - 1.0, RULER_X = -(TUBE_R + 1.2);
  const ruler = new THREE.Group();
  const rulerTex = canvasTexture(2048, 64, (c, w, h) => {
    c.fillStyle = '#f1e7c6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#222';
    c.font = 'bold 22px sans-serif';
    for (let cm = 0; cm <= 120; cm++) {
      const x = (cm / 120) * w;
      const tall = cm % 10 === 0 ? 34 : cm % 5 === 0 ? 22 : 12;
      c.fillRect(x, 0, 2, tall);
      if (cm % 10 === 0 && cm < 120) c.fillText(`${cm}`, x + 4, 58);
    }
  });
  const plain = new THREE.MeshStandardMaterial({ color: 0xe8ddb8 });
  // Scale is printed on the −x face, which reads left→right as +z when viewed from −x.
  const rulerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 12), [
    plain, new THREE.MeshStandardMaterial({ map: rulerTex }), plain, plain, plain, plain,
  ]);
  rulerMesh.position.set(RULER_X, RULER_Y, 6);
  ruler.add(rulerMesh);
  const ghostZ = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0x4fd1ff }));
  ruler.add(ghostZ);
  const zLbl = label('', 'vec');
  zLbl.center.set(0.5, -0.4);
  ghostZ.add(zLbl);
  scene.add(ruler);

  // Pitch dimension
  const pitch = new THREE.Group();
  const pMat = new THREE.MeshBasicMaterial({ color: 0x38d39f });
  const pBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, P_W, 8), pMat);
  pBar.rotation.x = Math.PI / 2;
  pBar.position.z = P_W / 2;
  const pc0 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), pMat);
  const pc1 = pc0.clone();
  pc1.position.z = P_W;
  const pLbl2 = label('螺距 p ≈ 1.09 m', 'gap big');
  pLbl2.position.set(0, -0.2, P_W / 2);
  pitch.add(pBar, pc0, pc1, pLbl2);
  pitch.position.set(0, -TUBE_R - 0.5, 0);
  scene.add(pitch);

  const axisLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.3), new THREE.Vector3(0, 0, P_W + 0.3)]), new THREE.LineDashedMaterial({ color: 0x9cc4ff, dashSize: 0.2, gapSize: 0.12 }));
  axisLine.computeLineDistances();
  scene.add(axisLine);

  const hit = glowSprite('#7dffb0');
  hit.position.set(0, 0, P_W + 0.02);
  scene.add(hit);
  const hitLbl = label('', 'big');
  hitLbl.el.style.borderColor = '#38d39f';
  hitLbl.center.set(0, 1.2);
  hit.add(hitLbl);

  let step = 0;
  const target = new THREE.Vector3(0, -0.6, 5.4);
  const orbit = (radius, height, a0, speed) => (t) => {
    const a = a0 + t * speed;
    return { pos: new THREE.Vector3(target.x + radius * Math.sin(a), target.y + height, target.z + radius * Math.cos(a)), target };
  };
  const fixed = (p, tg) => () => ({ pos: new THREE.Vector3(...p), target: new THREE.Vector3(...tg) });
  const shots = [
    // Cameras stay on the −x side so +z (the direction of travel) points to the right of the screen.
    orbit(26, 8, -0.7, -0.09),
    fixed([-4.8, 2.6, -3.6], [0, -0.5, 0.9]),
    fixed([0, -1, 23], [0, -1, 0]),
    fixed([-21, -0.8, 5.4], [0, -1.4, 5.4]),
    orbit(19, 6, -1.0, -0.06),
    fixed([-7, 2.8, 17.5], [0, -0.2, P_W - 0.5]),
    orbit(17, 7, -0.6, -0.08),
    fixed([-17, 8, 18], [0, -1, 5.4]),
  ];

  function enterStep(i) {
    step = i;
    stage.setShot(shots[i], i === 0 ? 0 : 1.8);
  }

  const setOpacity = (m, v) => { m.opacity = v; m.transparent = true; m.depthWrite = v >= 1; };

  function update(t) {
    const showMain = step >= 1;
    const beam = step === 6;
    const s = Math.min(Math.max(t, 0), SEC_PER_PERIOD);

    deviceLabels.forEach((l) => (l.visible = step === 0));
    setOpacity(lab.copper, step === 0 || step === 7 ? 1 : step === 3 ? 0.1 : 0.22);
    setOpacity(lab.flange, step === 0 || step === 7 ? 1 : 0.5);
    lab.screenMat.opacity = step === 2 ? 0.12 : 0.75;
    fieldGroup.visible = step >= 1 && step !== 6;
    axes.visible = step >= 1;

    particles.forEach((p, k) => {
      const on = k === 0 ? showMain : beam;
      p.trail.visible = on;
      p.ball.visible = on;
      if (!on) return;
      pos(s, p.phi, p.ball.position);
      const n = Math.round((s / SEC_PER_PERIOD) * PATH_SEG) * 8 * 6;
      p.trail.geometry.setDrawRange(0, n);
    });
    pLbl.visible = showMain && !beam;

    const v = vel(s, main.phi);
    const o = main.ball.position;
    const showVec = step >= 1 && step <= 4;
    const vPerpW = v.perp.clone().multiplyScalar(VEC_SCALE);
    const vParW = v.par.clone().multiplyScalar(VEC_SCALE);
    const vW = vPerpW.clone().add(vParW);
    arrV.visible = arrPar.visible = arrPerp.visible = arrF.visible = showVec;
    [lV, lPar, lPerp, lF].forEach((l) => (l.visible = showVec));
    guide.visible = step === 1;
    if (showVec) {
      arrV.set(o, vW);
      arrPerp.set(o, vPerpW);
      arrPar.set(o, vParW);
      arrF.set(o, v.force.clone().multiplyScalar(0.9));
      arrV.visible = step !== 2 && step !== 3;
      arrPar.visible = step !== 2;
      arrPerp.visible = step !== 3;
      arrF.visible = step !== 3;
      lV.visible = arrV.visible; lPar.visible = arrPar.visible; lPerp.visible = arrPerp.visible; lF.visible = arrF.visible;
      lV.position.copy(o).add(vW.clone().multiplyScalar(1.1));
      lPar.position.copy(o).add(vParW.clone().multiplyScalar(1.12));
      lPerp.position.copy(o).add(vPerpW.clone().multiplyScalar(1.3));
      lF.position.copy(o).add(v.force.clone().multiplyScalar(1.25));
      const g = guide.geometry.attributes.position;
      g.setXYZ(0, o.x + vPerpW.x, o.y + vPerpW.y, o.z + vPerpW.z);
      g.setXYZ(1, o.x + vW.x, o.y + vW.y, o.z + vW.z);
      g.setXYZ(2, o.x + vParW.x, o.y + vParW.y, o.z + vParW.z);
      g.needsUpdate = true;
      guide.computeLineDistances();
    }

    const showCircle = step === 2 || step === 4 || step === 7;
    projCircle.visible = projPlane.visible = showCircle;
    radius.visible = center.visible = rLbl.visible = step === 2;
    ghostCircle.visible = step === 2 || step === 4;
    ghostCircle.position.set(o.x, o.y, 0);
    rLbl.position.set(0.15, -R_W / 2, 0);

    ruler.visible = step === 3 || step === 4;
    ghostZ.position.set(RULER_X, RULER_Y + 0.45, o.z);
    zLbl.el.textContent = `z = ${fmt((o.z / U) * 100, 1)} cm`;

    pitch.visible = step >= 4 && step !== 6;
    axisLine.visible = step >= 5;

    const arrived = s >= SEC_PER_PERIOD - 1e-3 && (step >= 4);
    hit.visible = arrived;
    hit.scale.setScalar(arrived ? (beam ? 1.6 : 1.1) * (1 + 0.12 * Math.sin(performance.now() / 150)) : 0);
    hitLbl.visible = arrived && step >= 5;
    hitLbl.el.textContent = beam ? '所有质子汇聚于同一点！' : '打在屏与 z 轴的交点 L = p';
  }

  // ---- Graphs --------------------------------------------------------------
  const [pa, pb] = plots;
  pa.setOptions({
    title: '沿 B 方向看：xy 平面投影', xLabel: 'x / cm', yLabel: 'y / cm',
    xMin: -22, xMax: 22, yMin: -22, yMax: 22, equalAspect: true, originAxes: true,
    xTicks: [-20, -10, 10, 20], yTicks: [-20, -10, 10, 20],
  });
  pb.setOptions({
    title: 'z–t 图像（沿 B 方向匀速）', xLabel: 't / 10⁻⁷ s', yLabel: 'z / cm',
    xMin: 0, xMax: 7, yMin: 0, yMax: 125,
    xTicks: [0, 1, 2, 3, 4, 5, 6], yTicks: [0, 25, 50, 75, 100],
  });
  const toCm = (w) => (w / U) * 100;
  const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

  function drawGraphs(t) {
    const s = Math.min(Math.max(t, 0), SEC_PER_PERIOD);
    const beam = step === 6;
    pa.begin();
    const list = beam ? particles : step >= 1 ? [main] : [];
    list.forEach((p, k) => {
      const color = beam ? hex(BEAM_COLORS[k]) : '#ffd166';
      pa.polyline(pa.sample((u) => u, 0, 8, 96).map(([u]) => {
        const q = pos(u, p.phi);
        return [toCm(q.x), toCm(q.y)];
      }), { color, width: 1, dash: [3, 4], alpha: 0.45 });
      const pts = pa.sample((u) => u, 0, s, Math.max(2, Math.round(s * 20))).map(([u]) => {
        const q = pos(u, p.phi);
        return [toCm(q.x), toCm(q.y)];
      });
      pa.polyline(pts, { color, width: 2.2 });
      const q = pos(s, p.phi);
      pa.dot(toCm(q.x), toCm(q.y), color);
    });
    if (step === 2 || step === 3 || step === 4) {
      pa.dot(0, -10, '#ffffff', 3);
      pa.polyline([[0, -10], [0, 0]], { color: '#fff', width: 1 });
      pa.text(1, -5, 'r = 10 cm', { color: '#fff', base: 'middle' });
    }
    if (beam) pa.text(0, 2, 'O：所有圆都经过出发点', { color: '#fff', align: 'center', bold: true, bg: 'rgba(0,0,0,.5)' });
    pa.end();

    pb.begin();
    const tPhys = physTime(s) * 1e7;
    if (step >= 1) {
      pb.polyline([[0, 0], [T * 1e7, toCm(P_W)]], { color: '#4fd1ff', width: 1, dash: [3, 4], alpha: 0.5 });
      pb.polyline([[0, 0], [tPhys, toCm(pos(s).z)]], { color: '#4fd1ff', width: 2.5 });
      pb.dot(tPhys, toCm(pos(s).z), '#4fd1ff');
      if (step >= 4) {
        pb.vline(T * 1e7, 'rgba(56,211,159,.6)');
        pb.hline(toCm(P_W), 'rgba(56,211,159,.6)');
        pb.text(T * 1e7 - 0.1, 8, 'T ≈ 6.28', { color: '#38d39f', align: 'right' });
        pb.text(0.2, toCm(P_W) + 2, 'p ≈ 109 cm', { color: '#38d39f' });
      }
    }
    pb.end();
  }

  function hud(t) {
    if (step === 0) return '<div class="chip">磁聚焦实验装置</div>';
    const s = Math.min(Math.max(t, 0), SEC_PER_PERIOD);
    const o = pos(s, main.phi);
    const turn = (s / SEC_PER_PERIOD) * 360;
    return `<div class="chip">t = <b>${fmt(physTime(s) * 1e7, 2)}</b> ×10⁻⁷ s</div>
      <div class="chip">已转过 <b>${turn.toFixed(0)}°</b>（${fmt(s / SEC_PER_PERIOD, 2)} 圈）</div>
      <div class="chip">z = <b>${fmt(toCm(o.z), 1)}</b> cm</div>`;
  }

  return { enterStep, update, drawGraphs, hud };
}

export default {
  id: 'helix',
  tab: '3D 电磁场 · 磁聚焦螺旋线',
  statement,
  steps,
  camera: { fov: 40, far: 500 },
  timeLabel: (t) => `t = ${fmt(physTime(Math.min(Math.max(t, 0), SEC_PER_PERIOD)) * 1e7, 2)}×10⁻⁷ s`,
  mount,
};
