import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { label, FatArrow, canvasTexture } from '../core/stage.js';
import { niceStep, niceTicks } from '../core/plot.js';
import { buildLab, glowSprite, TUBE_R, PSU_POS } from '../models/lab.js';
import { solveHelix, helixScript, PARTICLES, SEC_PER_PERIOD } from '../engine/solvers/helix.js';
import { num, sig, lengthUnit } from '../engine/format.js';

const BEAM_COLORS = [0xff6b6b, 0xffb347, 0xffe156, 0x7be07b, 0x4fd1ff, 0x6c8cff, 0xc77dff, 0xff7ac8];
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (e) => [...String(e)].map((c) => SUP[c]).join('');
const fmt = (v, d = 2) => v.toFixed(d);

// Builds a playable problem from a helix solution: { params, derived, steps }.
export function createHelixProblem({ id = 'helix-gen', tab = '磁场 · 螺旋线', statement, params, derived, steps }) {
  const kind = PARTICLES[params.particle] || PARTICLES.positive;
  const WHO = kind.name;
  const SIGN = params.sign < 0 ? -1 : 1;
  const { vPerp: V_PERP, vPar: V_PAR, T, r: R, pitch: P } = derived;
  const nS = params.L !== null ? derived.nScreen : 1;
  const SP = SEC_PER_PERIOD;

  // Display: the circle radius is 1 world unit; the pitch is drawn between 1.2 and 11 units
  // (and short enough that the screen fits in the tube), so z may be scaled relative to xy.
  const U = 1 / R;
  const R_W = 1;
  let P_W = Math.min(11, Math.max(3, P / R));
  if (params.L !== null) P_W = Math.max(1.2, Math.min(P_W, 12.6 / Math.max(nS, 1e-6)));
  const zU = P_W / P;
  const zScale = zU / U;
  const SCREEN_W = P_W * nS;
  const S_MAX = SP * Math.min(Math.max(1, nS), 13 / P_W);
  const VEC_SCALE = 3 / params.v;
  const ur = lengthUnit(R), up = lengthUnit(params.L !== null ? Math.max(P, params.L) : P);
  const ZC = Math.max(SCREEN_W, P_W) / 2;
  const tEnd = T * (S_MAX / SP);
  const e = Math.floor(Math.log10(tEnd));
  const tf = 10 ** -e;

  function pos(s, phi = 0, out = new THREE.Vector3()) {
    const ph = (2 * Math.PI * s) / SP;
    const ux = Math.cos(phi), uy = Math.sin(phi);
    const nx = SIGN * uy, ny = -SIGN * ux;
    const a = Math.sin(ph), b = 1 - Math.cos(ph);
    return out.set(R_W * (a * ux + b * nx), R_W * (a * uy + b * ny), (P_W * ph) / (2 * Math.PI));
  }
  function vel(s, phi = 0) {
    const ph = (2 * Math.PI * s) / SP;
    const ux = Math.cos(phi), uy = Math.sin(phi);
    const nx = SIGN * uy, ny = -SIGN * ux;
    const c = Math.cos(ph), d = Math.sin(ph);
    return {
      perp: new THREE.Vector3(c * ux + d * nx, c * uy + d * ny, 0).multiplyScalar(V_PERP),
      par: new THREE.Vector3(0, 0, V_PAR),
      force: new THREE.Vector3(-d * ux + c * nx, -d * uy + c * ny, 0),
    };
  }
  const physTime = (s) => (s / SP) * T;
  const clampS = (t) => Math.min(Math.max(t, 0), S_MAX);

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
    lab.screen.position.z = SCREEN_W;

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

    const deviceLabels = [
      ['螺线管（产生磁场）', new THREE.Vector3(0, TUBE_R + 0.5, 2)],
      ['真空玻璃管', new THREE.Vector3(TUBE_R + 0.3, -1.2, 7)],
      ['荧光屏', new THREE.Vector3(0, TUBE_R + 0.6, SCREEN_W + 0.3)],
      [`${WHO}源`, new THREE.Vector3(0, 1.1, -1.4)],
      ['直流电源', PSU_POS.clone().add(new THREE.Vector3(0, 1.6, 0))],
    ].map(([text, p]) => {
      const l = label(text, 'big');
      l.position.copy(p);
      scene.add(l);
      return l;
    });

    const PATH_SEG = 400 * Math.ceil(S_MAX / SP);
    const particles = BEAM_COLORS.map((color, k) => {
      const phi = (k * Math.PI * 2) / BEAM_COLORS.length;
      const pts = [];
      for (let i = 0; i <= PATH_SEG; i++) pts.push(pos((i / PATH_SEG) * S_MAX, phi));
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
    const pLbl = label(`${WHO} ${kind.sym}`, 'vec');
    pLbl.center.set(-0.15, 1.2);
    main.ball.add(pLbl);

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

    const CY = -SIGN * R_W;
    const circlePts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      circlePts.push(new THREE.Vector3(R_W * Math.sin(a), CY * (1 - Math.cos(a)), 0));
    }
    const projCircle = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts), new THREE.LineDashedMaterial({ color: 0xff8c42, dashSize: 0.12, gapSize: 0.08 }));
    projCircle.computeLineDistances();
    scene.add(projCircle);
    const projPlane = new THREE.Mesh(new THREE.CircleGeometry(TUBE_R - 0.1, 64), new THREE.MeshBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(projPlane);
    const radius = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, CY, 0), new THREE.Vector3(0, 0, 0)]), new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(radius);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    center.position.set(0, CY, 0);
    scene.add(center);
    const rText = `r ≈ ${sig(R * ur.f)} ${ur.unit}`;
    const rLbl = label(rText, 'vec');
    rLbl.center.set(0.5, 0.5);
    scene.add(rLbl);
    const ghostCircle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff8c42 }));
    scene.add(ghostCircle);

    // Ruler along z, printed in real units (respecting the z display scale).
    const RULER_Y = -TUBE_R - 1.0, RULER_X = -(TUBE_R + 1.2), RULER_LEN = 12;
    const realLen = (RULER_LEN / zU) * up.f;
    const major = niceStep(realLen, 10);
    const minor = major / 5;
    const ruler = new THREE.Group();
    const rulerTex = canvasTexture(2048, 64, (c, w, h) => {
      c.fillStyle = '#f1e7c6';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#222';
      c.font = 'bold 22px sans-serif';
      for (let k = 0; k * minor <= realLen + 1e-9; k++) {
        const x = ((k * minor) / realLen) * w;
        const isMajor = k % 5 === 0;
        c.fillRect(x, 0, 2, isMajor ? 34 : 14);
        if (isMajor && x < w - 60) c.fillText(`${Number((k * minor).toPrecision(6))}`, x + 4, 58);
      }
      c.fillText(up.unit, w - 40, 58);
    });
    const plain = new THREE.MeshStandardMaterial({ color: 0xe8ddb8 });
    const rulerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, RULER_LEN), [
      plain, new THREE.MeshStandardMaterial({ map: rulerTex }), plain, plain, plain, plain,
    ]);
    rulerMesh.position.set(RULER_X, RULER_Y, RULER_LEN / 2);
    ruler.add(rulerMesh);
    const ghostZ = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0x4fd1ff }));
    ruler.add(ghostZ);
    const zLbl = label('', 'vec');
    zLbl.center.set(0.5, -0.4);
    ghostZ.add(zLbl);
    scene.add(ruler);

    const pitch = new THREE.Group();
    const pMat = new THREE.MeshBasicMaterial({ color: 0x38d39f });
    const pBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, P_W, 8), pMat);
    pBar.rotation.x = Math.PI / 2;
    pBar.position.z = P_W / 2;
    const pc0 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), pMat);
    const pc1 = pc0.clone();
    pc1.position.z = P_W;
    const pText = `螺距 p ≈ ${sig(P * up.f)} ${up.unit}`;
    const pLbl2 = label(pText, 'gap big');
    pLbl2.position.set(0, -0.2, P_W / 2);
    pitch.add(pBar, pc0, pc1, pLbl2);
    pitch.position.set(0, -TUBE_R - 0.5, 0);
    scene.add(pitch);

    const axisLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.3), new THREE.Vector3(0, 0, Math.max(P_W, SCREEN_W) + 0.3)]), new THREE.LineDashedMaterial({ color: 0x9cc4ff, dashSize: 0.2, gapSize: 0.12 }));
    axisLine.computeLineDistances();
    scene.add(axisLine);

    const hit = glowSprite('#7dffb0');
    scene.add(hit);
    const hitLbl = label('', 'big');
    hitLbl.el.style.borderColor = '#38d39f';
    hitLbl.center.set(0, 1.2);
    hit.add(hitLbl);

    let mark = 'intro';
    const target = new THREE.Vector3(0, -0.6, ZC);
    const orbit = (rad, height, a0, speed) => (t) => {
      const a = a0 + t * speed;
      return { pos: new THREE.Vector3(target.x + rad * Math.sin(a), target.y + height, target.z + rad * Math.cos(a)), target };
    };
    const fixed = (p, tg) => () => ({ pos: new THREE.Vector3(...p), target: new THREE.Vector3(...tg) });
    // Cameras stay on the −x side so +z (the direction of travel) points to the right of the screen.
    const SHOTS = {
      intro: orbit(26, 8, -0.7, -0.09),
      decompose: fixed([-4.8, 2.6, -3.6], [0, -0.5, 0.9]),
      perp_circle: fixed([0, -1, 23], [0, -1, 0]),
      par_line: fixed([-21, -0.8, ZC], [0, -1.4, ZC]),
      helix: orbit(19, 6, -1.0, -0.06),
      screen: fixed([-7, 2.8, SCREEN_W + 6.6], [0, -0.2, SCREEN_W - 0.5]),
      focus: orbit(17, 7, -0.6, -0.08),
      summary: fixed([-17, 8, 18], [0, -1, ZC]),
    };

    function enterStep(i, step) {
      mark = step.mark;
      stage.setShot(SHOTS[mark] || SHOTS.summary, i === 0 ? 0 : 1.8);
    }

    const setOpacity = (m, v) => { m.opacity = v; m.transparent = true; m.depthWrite = v >= 1; };

    function update(t) {
      const showMain = mark !== 'intro';
      const beam = mark === 'focus';
      const s = clampS(t);
      const onScreenStep = mark === 'screen' || mark === 'intro';
      lab.screen.position.z = onScreenStep ? SCREEN_W : P_W;

      deviceLabels.forEach((l) => (l.visible = mark === 'intro'));
      setOpacity(lab.copper, mark === 'intro' || mark === 'summary' ? 1 : mark === 'par_line' ? 0.1 : 0.22);
      setOpacity(lab.flange, mark === 'intro' || mark === 'summary' ? 1 : 0.5);
      lab.screenMat.opacity = mark === 'perp_circle' ? 0.12 : 0.75;
      fieldGroup.visible = showMain && !beam;
      axes.visible = showMain;

      particles.forEach((p, k) => {
        const on = k === 0 ? showMain : beam;
        p.trail.visible = on;
        p.ball.visible = on;
        if (!on) return;
        pos(s, p.phi, p.ball.position);
        const n = Math.round((s / S_MAX) * PATH_SEG) * 8 * 6;
        p.trail.geometry.setDrawRange(0, n);
      });
      pLbl.visible = showMain && !beam;

      const v = vel(s, main.phi);
      const o = main.ball.position;
      const showVec = ['decompose', 'perp_circle', 'par_line', 'helix'].includes(mark);
      const vPerpW = v.perp.clone().multiplyScalar(VEC_SCALE);
      const vParW = v.par.clone().multiplyScalar(VEC_SCALE);
      const vW = vPerpW.clone().add(vParW);
      arrV.visible = arrPar.visible = arrPerp.visible = arrF.visible = showVec;
      [lV, lPar, lPerp, lF].forEach((l) => (l.visible = showVec));
      guide.visible = mark === 'decompose';
      if (showVec) {
        arrV.set(o, vW);
        arrPerp.set(o, vPerpW);
        arrPar.set(o, vParW);
        arrF.set(o, v.force.clone().multiplyScalar(0.9));
        arrV.visible = mark !== 'perp_circle' && mark !== 'par_line';
        arrPar.visible = mark !== 'perp_circle';
        arrPerp.visible = mark !== 'par_line';
        arrF.visible = mark !== 'par_line';
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

      const showCircle = mark === 'perp_circle' || mark === 'helix' || mark === 'summary';
      projCircle.visible = projPlane.visible = showCircle;
      radius.visible = center.visible = rLbl.visible = mark === 'perp_circle';
      ghostCircle.visible = mark === 'perp_circle' || mark === 'helix';
      ghostCircle.position.set(o.x, o.y, 0);
      rLbl.position.set(0.15, CY / 2, 0);

      ruler.visible = mark === 'par_line' || mark === 'helix';
      ghostZ.position.set(RULER_X, RULER_Y + 0.45, o.z);
      zLbl.el.textContent = `z = ${sig((o.z / zU) * up.f)} ${up.unit}`;

      pitch.visible = !['intro', 'decompose', 'perp_circle', 'par_line', 'focus'].includes(mark);
      axisLine.visible = ['screen', 'focus', 'summary'].includes(mark);

      let arrived, hitAt, text;
      if (mark === 'screen') {
        arrived = t >= SP * nS - 1e-3;
        hitAt = pos(SP * nS, main.phi);
        const n = Math.round(nS);
        const onAxis = n >= 1 && Math.abs(nS - n) < 0.02;
        text = params.L === null ? '打在屏与 z 轴的交点 L = p' : onAxis ? `转 ${n} 圈，恰好回到轴线` : '打在屏上，但不在轴线上';
      } else {
        arrived = s >= SP - 1e-3 && ['helix', 'focus', 'summary'].includes(mark);
        hitAt = new THREE.Vector3(0, 0, P_W);
        text = beam ? `所有${WHO}汇聚于同一点！` : '回到 z 轴：z = p';
      }
      hit.visible = arrived;
      hit.position.copy(hitAt).setZ(hitAt.z + 0.02);
      hit.scale.setScalar(arrived ? (beam ? 1.6 : 1.1) * (1 + 0.12 * Math.sin(performance.now() / 150)) : 0);
      hitLbl.visible = arrived && mark !== 'helix';
      hitLbl.el.textContent = text;
    }

    // ---- Graphs ------------------------------------------------------------
    const [pa, pb] = plots;
    const Ru = R * ur.f;
    const lim = 2.2 * Ru;
    pa.setOptions({
      title: '沿 B 方向看：xy 平面投影', xLabel: `x / ${ur.unit}`, yLabel: `y / ${ur.unit}`,
      xMin: -lim, xMax: lim, yMin: -lim, yMax: lim, equalAspect: true, originAxes: true,
      xTicks: niceTicks(-lim, lim, 4).filter((v) => v !== 0), yTicks: niceTicks(-lim, lim, 4).filter((v) => v !== 0),
    });
    const zTop = Math.max(P, params.L ?? 0) * 1.15 * up.f;
    pb.setOptions({
      title: 'z–t 图像（沿 B 方向匀速）', xLabel: `t / 10${sup(e)} s`, yLabel: `z / ${up.unit}`,
      xMin: 0, xMax: tEnd * 1.12 * tf, yMin: 0, yMax: zTop,
      xTicks: niceTicks(0, tEnd * 1.12 * tf, 6), yTicks: niceTicks(0, zTop, 4),
    });
    const toU = (w) => w * (1 / U) * ur.f;
    const zReal = (w) => (w / zU) * up.f;
    const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

    function drawGraphs(t) {
      const s = clampS(t);
      const beam = mark === 'focus';
      pa.begin();
      const list = beam ? particles : mark !== 'intro' ? [main] : [];
      list.forEach((p, k) => {
        const color = beam ? hex(BEAM_COLORS[k]) : '#ffd166';
        pa.polyline(pa.sample((u) => u, 0, SP, 96).map(([u]) => {
          const q = pos(u, p.phi);
          return [toU(q.x), toU(q.y)];
        }), { color, width: 1, dash: [3, 4], alpha: 0.45 });
        const pts = pa.sample((u) => u, 0, Math.min(s, SP), Math.max(2, Math.round(Math.min(s, SP) * 20))).map(([u]) => {
          const q = pos(u, p.phi);
          return [toU(q.x), toU(q.y)];
        });
        pa.polyline(pts, { color, width: 2.2 });
        const q = pos(s, p.phi);
        pa.dot(toU(q.x), toU(q.y), color);
      });
      if (['perp_circle', 'par_line', 'helix'].includes(mark)) {
        pa.dot(0, -SIGN * Ru, '#ffffff', 3);
        pa.polyline([[0, -SIGN * Ru], [0, 0]], { color: '#fff', width: 1 });
        pa.text(Ru * 0.1, -SIGN * Ru / 2, rText, { color: '#fff', base: 'middle' });
      }
      if (beam) pa.text(0, lim * 0.1, 'O：所有圆都经过出发点', { color: '#fff', align: 'center', bold: true, bg: 'rgba(0,0,0,.5)' });
      pa.end();

      pb.begin();
      const tPhys = physTime(s) * tf;
      if (mark !== 'intro') {
        pb.polyline([[0, 0], [tEnd * tf, zReal(P_W * (S_MAX / SP))]], { color: '#4fd1ff', width: 1, dash: [3, 4], alpha: 0.5 });
        pb.polyline([[0, 0], [tPhys, zReal(pos(s).z)]], { color: '#4fd1ff', width: 2.5 });
        pb.dot(tPhys, zReal(pos(s).z), '#4fd1ff');
        if (!['decompose', 'perp_circle', 'par_line'].includes(mark)) {
          pb.vline(T * tf, 'rgba(56,211,159,.6)');
          pb.hline(P * up.f, 'rgba(56,211,159,.6)');
          pb.text(T * tf, zTop * 0.06, ` T ≈ ${sig(T * tf)}`, { color: '#38d39f' });
          pb.text(tEnd * tf * 0.03, P * up.f + zTop * 0.02, `p ≈ ${sig(P * up.f)} ${up.unit}`, { color: '#38d39f' });
        }
        if (mark === 'screen' && params.L !== null) {
          pb.hline(params.L * up.f, 'rgba(255,209,102,.7)');
          pb.text(tEnd * tf * 0.03, params.L * up.f + zTop * 0.02, `屏 L = ${sig(params.L * up.f)} ${up.unit}`, { color: '#ffd166' });
        }
      }
      pb.end();
    }

    function hud(t) {
      if (mark === 'intro') return `<div class="chip">磁场实验装置 · ${WHO}</div>`;
      const s = clampS(t);
      const o = pos(s, main.phi);
      const turn = (s / SP) * 360;
      const scaleNote = Math.abs(zScale - 1) > 0.05 ? `<div class="chip">示意图：沿 B 方向按 ${num(zScale, 2)} : 1 缩放</div>` : '';
      return `<div class="chip">t = <b>${fmt(physTime(s) * tf, 3)}</b> ×10${sup(e)} s</div>
        <div class="chip">已转过 <b>${turn.toFixed(0)}°</b>（${fmt(s / SP, 2)} 圈）</div>
        <div class="chip">z = <b>${num(zReal(o.z), 3)}</b> ${up.unit}</div>${scaleNote}`;
    }

    return { enterStep, update, drawGraphs, hud };
  }

  return {
    id, tab, statement, steps, camera: { fov: 40, far: 500 },
    timeLabel: (t) => `t = ${fmt(physTime(clampS(t)) * tf, 3)}×10${sup(e)} s`,
    mount,
  };
}

// ---- Problem bank entry: the solver's output for the magnetic-focusing problem ----
const bankStatement = `
<p>“磁聚焦”实验装置：抽成真空的玻璃管外绕有螺线管，管内产生沿管轴方向（z 轴）的匀强磁场 <b>B = 0.10 T</b>。
质子源在 O 点以速率 <b>v = 2.0×10⁶ m/s</b> 射出质子，速度方向与磁场方向成 <b>θ = 30°</b>。
质子比荷 <b>q/m = 1.0×10⁸ C/kg</b>，不计重力。</p>
<div class="q">(1) 质子做什么运动？求它在垂直于磁场的平面内做圆周运动的半径 r 和周期 T；</div>
<div class="q">(2) 求螺旋线的螺距 p；</div>
<div class="q">(3) 荧光屏垂直于 z 轴放置，要使质子打在屏与 z 轴的交点上，屏到 O 点的距离 L 应满足什么条件？</div>
<div class="q">(4)【拓展】与 B 夹角都为 θ、但方向各不相同的一束质子，为什么会“聚焦”到同一点？</div>`;

const bank = solveHelix({ B: 0.1, v: 2e6, theta: Math.PI / 6, qm: 1e8, particle: 'proton' });

export default createHelixProblem({
  id: 'helix',
  tab: '3D 电磁场 · 磁聚焦螺旋线',
  statement: bankStatement,
  params: bank.params,
  derived: bank.derived,
  steps: helixScript(bank.params, bank.derived),
});
