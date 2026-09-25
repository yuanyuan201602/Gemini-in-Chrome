import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { label, FatArrow } from '../core/stage.js';
import { niceStep, niceTicks } from '../core/plot.js';
import { createTruck, createPoliceCar, createCar, createCyclist, createMotorbike, createPerson, rollWheels, setSiren } from '../models/vehicles.js';
import { buildStreet, skyTexture, LANE_INNER, LANE_OUTER } from '../models/street.js';
import { solvePursuit, pursuitScript } from '../engine/solvers/pursuit.js';
import { num } from '../engine/format.js';

const LEAD_MODELS = {
  truck: () => createTruck(),
  car: () => createCar({ color: 0xc8302e }),
  bike: () => createCyclist(),
  person: () => createPerson(0xe0474c),
};
const CHASER_MODELS = {
  police: () => createPoliceCar(),
  car: () => createCar({ color: 0x2f6fd6 }),
  motorbike: () => createMotorbike(),
  person: () => createPerson(0x3a7bff),
};
const HEIGHT = { truck: 4.4, car: 1.9, police: 2.0, bike: 1.95, motorbike: 1.95, person: 1.95 };
const fmt = (v, d = 1) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(d);

// Builds a playable problem from a pursuit solution: { params, derived, steps, names }.
export function createPursuitProblem({ id = 'pursuit-gen', tab = '追及问题', statement, params, derived, steps, names = {} }) {
  const { v1, a: A, delay: DELAY, vmax: VM } = params;
  const { t1, gapMax, capped, t2, gap2, tNaive, vNaive, tCatch, xCatch } = derived;
  const LEAD = names.lead || '货车', CHASER = names.chaser || '警车';
  const leadKind = LEAD_MODELS[names.leadKind] ? names.leadKind : 'truck';
  const chaserKind = CHASER_MODELS[names.chaserKind] ? names.chaserKind : 'police';
  const T_EQ = DELAY + t1;
  const T_CAP = capped ? DELAY + t2 : Infinity;
  const X_CAP = capped ? (VM * VM) / (2 * A) : 0;
  const T_CATCH = DELAY + tCatch;
  const TOTAL = T_CATCH;

  const xLead = (t) => v1 * t;
  const vLead = () => v1;
  const xChaser = (t) => (t <= DELAY ? 0 : t <= T_CAP ? 0.5 * A * (t - DELAY) ** 2 : X_CAP + VM * (t - T_CAP));
  const vChaser = (t) => (t <= DELAY ? 0 : t <= T_CAP ? A * (t - DELAY) : VM);

  function mount(stage, plots) {
    const { scene, renderer } = stage;
    scene.background = skyTexture();
    const far = Math.max(330, xCatch * 1.6);
    scene.fog = new THREE.Fog(0xdce8f3, far * 0.36, far);
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

    const signStep = niceStep(xCatch * 1.25, 8);
    buildStreet(scene, { x0: -120, x1: Math.max(300, xCatch * 1.3 + 150), signStep, signMax: Math.ceil((xCatch * 1.25) / signStep) * signStep });

    const lead = LEAD_MODELS[leadKind]();
    lead.position.z = LANE_INNER;
    const chaser = CHASER_MODELS[chaserKind]();
    chaser.position.z = LANE_OUTER;
    scene.add(lead, chaser);
    const hL = HEIGHT[leadKind], hC = HEIGHT[chaserKind];

    const CHASER_LBL_Y = hC + 2.0;
    const LEAD_LBL_Y = Math.max(hL + 1.7, CHASER_LBL_Y + 1.3);
    const leadLbl = label('', 'truck');
    leadLbl.position.set(-lead.userData.length / 2, LEAD_LBL_Y, 0);
    lead.add(leadLbl);
    const chaserLbl = label('', 'police');
    chaserLbl.position.set(-chaser.userData.length / 2, CHASER_LBL_Y, 0);
    chaser.add(chaserLbl);

    const vLeadArrow = new FatArrow(0xff9a3c, 0.09);
    const vChaserArrow = new FatArrow(0x4f9dff, 0.09);
    scene.add(vLeadArrow, vChaserArrow);

    const GAP_Y = LEAD_LBL_Y + 1.1;
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
    gap.position.set(0, GAP_Y, 3.5);
    scene.add(gap);

    const eventLbl = label('', 'big');
    scene.add(eventLbl);

    const catchRing = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.3, 48),
      new THREE.MeshBasicMaterial({ color: 0x38d39f, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    catchRing.rotation.x = -Math.PI / 2;
    catchRing.position.set(xCatch, 0.05, 3.5);
    scene.add(catchRing);

    let mark = 'intro';
    const followShot = (dist, height) => (t) => {
      const a = xLead(t), b = xChaser(t);
      const mid = (a + b) / 2 - 3;
      const span = Math.abs(a - b);
      return { pos: new THREE.Vector3(mid - 6, height + span * 0.28, dist + span * 0.62), target: new THREE.Vector3(mid, 1.5, 2.5) };
    };
    const introStart = Math.min(-26, -v1 * 4 - 6);
    const SHOTS = {
      intro: (t) => {
        const k = (t + 4) / 4;
        return { pos: new THREE.Vector3(introStart + k * 10, 9, 22 - k * 2), target: new THREE.Vector3(introStart * 0.25 + k * 4, 1.5, 2.5) };
      },
      delay: followShot(17, 7),
      before_equal: followShot(16, 7),
      max_gap: followShot(18, 8),
      trap: followShot(18, 8),
      accel_to_vmax: followShot(16, 7),
      chase: (t) => {
        const x = xChaser(t);
        return { pos: new THREE.Vector3(x + 9, 3.2, 14), target: new THREE.Vector3(x - 3, 1.6, 3) };
      },
      summary: (t) => {
        const x = (xLead(t) + xChaser(t)) / 2;
        const w = 16 + xCatch * 0.22;
        return { pos: new THREE.Vector3(x - 14, w * 0.48, w), target: new THREE.Vector3(x + 2, 0, 2) };
      },
    };
    const shotFor = (m) => SHOTS[m] || (m === 'cruise_catch' || m === 'catch_accel' || m === 'check_ok' ? SHOTS.chase : SHOTS.summary);
    const GAP_MARKS = new Set(['delay', 'before_equal', 'max_gap', 'trap', 'accel_to_vmax', 'cruise_catch', 'catch_accel']);

    function enterStep(i, step) {
      mark = step.mark;
      stage.setShot(shotFor(mark), i === 0 ? 0 : 1.6);
    }

    function update(t) {
      const xl = xLead(t), xc = xChaser(t);
      lead.position.x = xl;
      chaser.position.x = xc;
      rollWheels(lead, xl);
      rollWheels(chaser, xc);
      setSiren(chaser, t > DELAY - 0.6, performance.now() / 1000);

      const vl = vLead(t), vc = vChaser(t);
      leadLbl.el.innerHTML = `${LEAD}　v = <b>${fmt(vl)}</b> m/s`;
      chaserLbl.el.innerHTML = `${CHASER}　v = <b>${fmt(vc)}</b> m/s`;
      vLeadArrow.set(new THREE.Vector3(xl + 0.4, Math.min(2.6, hL * 0.6), LANE_INNER), new THREE.Vector3(vl * 0.32, 0, 0));
      vChaserArrow.set(new THREE.Vector3(xc + 0.4, Math.min(1.2, hC * 0.6), LANE_OUTER), new THREE.Vector3(vc * 0.32, 0, 0));

      const d = xl - xc;
      gap.visible = GAP_MARKS.has(mark) && d > 0.3;
      if (gap.visible) {
        bar.scale.y = d;
        bar.position.x = xc + d / 2;
        capA.position.x = xc;
        capB.position.x = xl;
        dropA.position.x = xc;
        dropA.scale.y = GAP_Y - hC - 0.1;
        dropB.position.x = xl;
        dropB.scale.y = GAP_Y - hL;
        gapLbl.position.set(xc + d / 2, 1.3, 0);
        gapLbl.el.innerHTML = `Δx = ${fmt(d)} m`;
      }

      const sunX = (xl + xc) / 2;
      sun.position.set(sunX + 30, 60, 40);
      sun.target.position.set(sunX, 0, 0);

      const caught = t >= T_CATCH - 1e-3;
      eventLbl.visible = true;
      catchRing.visible = caught;
      if (mark === 'max_gap' || mark === 'trap') {
        eventLbl.position.set(xc + Math.min(d / 2, 8), GAP_Y + 2.6, 3.5);
        eventLbl.el.innerHTML = mark === 'max_gap' ? `速度相等 ⇒ 距离最大 ${num(gapMax)} m` : '⚠ 直接列方程？先检查速度！';
      } else if (caught) {
        if (mark === 'summary') eventLbl.position.set(xCatch, GAP_Y + 0.3, 3.5);
        else eventLbl.position.set(xCatch + 1.5, 0.4, 5.8);
        eventLbl.el.innerHTML = `追上！ t = ${num(tCatch)} s，x = ${num(xCatch)} m`;
        catchRing.material.opacity = 0.5 + 0.4 * Math.sin(performance.now() / 180);
      } else if (mark === 'accel_to_vmax' && t >= T_CAP - 1e-3) {
        eventLbl.position.set(xc - 2, GAP_Y + 2.6, 3.5);
        eventLbl.el.innerHTML = `达到最大速度 ${num(VM)} m/s，还差 ${num(gap2)} m`;
      } else {
        eventLbl.visible = false;
      }
    }

    // ---- Graphs ----------------------------------------------------------
    const [pv, px] = plots;
    const tMax = TOTAL * 1.08;
    const vTop = Math.max(v1, VM ?? A * tCatch, capped ? vNaive : 0) * 1.15;
    const xTop = xCatch * 1.17;
    pv.setOptions({
      title: 'v–t 图像', xLabel: 't / s', yLabel: 'v/(m·s⁻¹)',
      xMin: 0, xMax: tMax, yMin: 0, yMax: vTop, xTicks: niceTicks(0, tMax, 7), yTicks: niceTicks(0, vTop, 4),
    });
    px.setOptions({
      title: 'x–t 图像', xLabel: 't / s', yLabel: 'x / m',
      xMin: 0, xMax: tMax, yMin: 0, yMax: xTop, xTicks: niceTicks(0, tMax, 7), yTicks: niceTicks(0, xTop, 4),
    });
    const ORANGE = '#ff9a3c', BLUE = '#4f9dff';

    function drawGraphs(t) {
      const tc = Math.max(0, t);
      pv.begin();
      if (mark === 'max_gap' || mark === 'trap') {
        pv.fillBetween(pv.sample(vLead, 0, T_EQ, 60), pv.sample(vChaser, 0, T_EQ, 60), 'rgba(255,154,60,0.35)');
        pv.text(T_EQ * 0.42, v1 * 0.72, `面积差 = ${num(gapMax)} m`, { color: '#ffd48a', bold: true, bg: 'rgba(0,0,0,.5)' });
        pv.vline(T_EQ).dot(T_EQ, v1, '#fff');
        pv.text(T_EQ + tMax * 0.015, v1 * 1.12, '共速', { color: '#fff' });
      }
      if (mark === 'trap') {
        pv.hline(VM, 'rgba(255,90,90,0.6)');
        pv.text(tMax * 0.02, VM + vTop * 0.025, `最大速度 ${num(VM)} m/s`, { color: '#ff8a8a' });
        const tBad = DELAY + tNaive;
        pv.polyline([[DELAY, 0], [tBad, vNaive]], { color: '#ff5b5b', width: 2, dash: [6, 5] });
        pv.cross(tBad, vNaive);
        pv.text(tBad - tMax * 0.015, vNaive - vTop * 0.04, `${num(vNaive, 1)} m/s ✗`, { color: '#ff8a8a', align: 'right', base: 'top' });
      }
      if (mark === 'summary') {
        pv.fillBetween(pv.sample(vChaser, 0, tc, 120), [[0, 0], [tc, 0]], 'rgba(79,157,255,0.28)');
        pv.fillBetween(pv.sample(vLead, 0, tc, 2), [[0, 0], [tc, 0]], 'rgba(255,154,60,0.22)');
        if (t >= T_CATCH - 1e-3) pv.text(TOTAL / 2, vTop * 0.12, `S${CHASER} = S${LEAD} = ${num(xCatch)} m`, { color: '#fff', bold: true, align: 'center', bg: 'rgba(0,0,0,.55)' });
      }
      if (t > 0) {
        pv.polyline(pv.sample(vLead, 0, tc, 2), { color: ORANGE, width: 2.5 });
        pv.polyline(pv.sample(vChaser, 0, tc, 200), { color: BLUE, width: 2.5 });
        pv.vline(tc);
        pv.dot(tc, vLead(tc), ORANGE).dot(tc, vChaser(tc), BLUE);
      }
      pv.end();
      pv.legend([[LEAD, ORANGE], [CHASER, BLUE]]);

      px.begin();
      if (t > 0) {
        px.polyline(px.sample(xLead, 0, tc, 2), { color: ORANGE, width: 2.5 });
        px.polyline(px.sample(xChaser, 0, tc, 200), { color: BLUE, width: 2.5 });
        const a = xLead(tc), b = xChaser(tc);
        if (a - b > xTop * 0.004) {
          px.polyline([[tc, b], [tc, a]], { color: '#ffb547', width: 3 });
          px.text(tc + tMax * 0.015, (a + b) / 2, `Δx=${fmt(a - b)} m`, { color: '#ffd48a', base: 'middle', bg: 'rgba(0,0,0,.45)' });
        }
        px.dot(tc, a, ORANGE).dot(tc, b, BLUE);
        if (t >= T_CATCH - 1e-3) {
          px.dot(T_CATCH, xCatch, '#38d39f', 6);
          px.text(T_CATCH - tMax * 0.02, xCatch * 1.03, `追上 (${num(T_CATCH)} s, ${num(xCatch)} m)`, { color: '#38d39f', align: 'right', bold: true });
        }
      }
      px.end();
      px.legend([[LEAD, ORANGE], [CHASER, BLUE]]);
    }

    function hud(t) {
      const tp = Math.max(0, t - DELAY);
      return `<div class="chip">计时 τ = <b>${fmt(t, 2)}</b> s</div>
        ${DELAY > 0 ? `<div class="chip">${CHASER}启动后 t = <b>${fmt(tp, 2)}</b> s</div>` : ''}
        <div class="chip">距离 Δx = <b>${fmt(Math.max(0, xLead(t) - xChaser(t)))}</b> m</div>`;
    }

    return { enterStep, update, drawGraphs, hud };
  }

  return { id, tab, statement, steps, camera: { fov: 42, far: Math.max(800, xCatch * 3) }, timeLabel: (t) => `τ = ${fmt(t, 2)} s`, mount };
}

// ---- Problem bank entry: the solver's output for the classic police-truck problem ----
const bankStatement = `
<p>一辆货车以 <b>v₁ = 10 m/s</b> 的速度匀速行驶，经过停在路边的警车时，警察发现货车超载。
经过 <b>Δt = 2 s</b> 的反应时间后，警车由静止启动，以 <b>a = 2.5 m/s²</b> 做匀加速直线运动追赶。
该路段限速，警车的最大速度为 <b>v<sub>m</sub> = 20 m/s</b>，达到后保持匀速。</p>
<div class="q">(1) 警车追上货车之前，两车间的最大距离是多少？</div>
<div class="q">(2) 警车启动后经过多长时间追上货车？</div>
<div class="q">(3) 画出两车的 v–t 图像，并用图像解释上面的结果。</div>`;

const bank = solvePursuit({ v1: 10, a: 2.5, delay: 2, vmax: 20 });
const names = { lead: '货车', chaser: '警车', leadKind: 'truck', chaserKind: 'police' };

export default createPursuitProblem({
  id: 'pursuit',
  tab: '追及问题 · 警车追货车',
  statement: bankStatement,
  params: bank.params,
  derived: bank.derived,
  steps: pursuitScript(bank.params, bank.derived, names),
  names,
});
