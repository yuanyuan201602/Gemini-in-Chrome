import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from '../core/stage.js';

// All vehicles face +x and have their origin at the front bumper, on the ground.
// That makes "front bumpers aligned" (= caught up) simply equal x positions.

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra });
const glass = () => new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.5 });

function mesh(geo, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

function rbox(l, h, w, r = 0.12, seg = 3) {
  return new RoundedBoxGeometry(l, h, w, seg, Math.min(r, l / 2 - 0.01, h / 2 - 0.01, w / 2 - 0.01));
}

function makeWheel(radius, width, { dual = false } = {}) {
  const pivot = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 28),
    std(0x151515, { roughness: 0.9 })
  );
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  pivot.add(tire);
  const tread = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.97, width * 0.12, 6, 28), std(0x222222, { roughness: 1 }));
  pivot.add(tread);

  const hubMat = std(0xc9ccd1, { metalness: 0.85, roughness: 0.3 });
  for (const side of [1, -1]) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, 0.02, 20), hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = side * (width / 2 + 0.005);
    pivot.add(hub);
    // Spokes make the rolling visible.
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.9, radius * 0.12, 0.03), std(0x8a8f96, { metalness: 0.8 }));
      spoke.rotation.z = (k * Math.PI * 2) / 5;
      spoke.position.z = side * (width / 2 + 0.02);
      pivot.add(spoke);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 0.05, 12), std(0x555a60, { metalness: 0.9 }));
    cap.rotation.x = Math.PI / 2;
    cap.position.z = side * (width / 2 + 0.035);
    pivot.add(cap);
  }
  if (dual) pivot.scale.z = 1.6;
  pivot.userData.radius = radius;
  return pivot;
}

function addWheels(group, radius, width, xs, halfTrack, opts) {
  const wheels = [];
  for (const x of xs) {
    for (const z of [halfTrack, -halfTrack]) {
      const w = makeWheel(radius, width, opts);
      w.position.set(x, radius, z);
      group.add(w);
      wheels.push(w);
    }
  }
  return wheels;
}

function lightPair(group, x, y, halfW, color, size = [0.05, 0.22, 0.4], intensity = 2) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });
  for (const z of [halfW, -halfW]) group.add(mesh(new THREE.BoxGeometry(...size), mat, x, y, z, false));
}

export function createTruck() {
  const g = new THREE.Group();
  const orange = std(0xf07f1d, { metalness: 0.25, roughness: 0.4 });
  const dark = std(0x2b2e33, { roughness: 0.8 });

  g.add(mesh(new THREE.BoxGeometry(8.0, 0.35, 1.9), dark, -4.1, 0.95, 0));
  const cab = mesh(rbox(2.3, 2.5, 2.45, 0.28), orange, -1.25, 2.2, 0);
  g.add(cab);
  g.add(mesh(new THREE.BoxGeometry(0.06, 1.05, 2.15), glass(), -0.08, 2.75, 0, false));
  for (const z of [1.23, -1.23]) g.add(mesh(new THREE.BoxGeometry(1.1, 0.8, 0.04), glass(), -0.9, 2.8, z, false));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.45, 2.5), std(0x3a3d42, { metalness: 0.6, roughness: 0.3 }), -0.1, 1.05, 0));
  g.add(mesh(new THREE.BoxGeometry(0.04, 0.6, 1.4), std(0x222428, { metalness: 0.7 }), 0.0, 1.7, 0, false));
  lightPair(g, 0.02, 1.55, 0.95, 0xfff4d6, [0.05, 0.25, 0.42], 2.5);
  for (const z of [1.38, -1.38]) {
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.35, 0.05), dark, -0.25, 2.9, z));
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.3, 0.12), std(0x1b1d20, { metalness: 0.8 }), -0.2, 2.9, z + Math.sign(z) * 0.08));
  }

  const logo = canvasTexture(1024, 512, (c, w, h) => {
    c.fillStyle = '#f4f6f8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f07f1d';
    c.fillRect(0, h * 0.72, w, h * 0.09);
    c.fillStyle = '#1e5aa8';
    c.fillRect(0, h * 0.83, w, h * 0.05);
    c.fillStyle = '#1e3558';
    c.font = 'bold 150px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('顺达物流', w / 2, h * 0.38);
    c.font = '48px sans-serif';
    c.fillStyle = '#5b6b82';
    c.fillText('SHUNDA LOGISTICS', w / 2, h * 0.6);
  });
  const boxWhite = std(0xf1f3f5, { roughness: 0.6 });
  const sideMat = new THREE.MeshStandardMaterial({ map: logo, roughness: 0.6 });
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(5.7, 3.0, 2.5), [boxWhite, boxWhite, boxWhite, boxWhite, sideMat, sideMat]);
  cargo.position.set(-5.35, 2.7, 0);
  cargo.castShadow = cargo.receiveShadow = true;
  g.add(cargo);
  g.add(mesh(new THREE.BoxGeometry(5.72, 0.12, 2.52), std(0xc3c8ce, { metalness: 0.6 }), -5.35, 4.2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.05, 2.8, 2.3), std(0xdadde2, { metalness: 0.4 }), -8.22, 2.7, 0));
  lightPair(g, -8.25, 1.2, 1.0, 0xff2a2a, [0.05, 0.2, 0.3], 1.8);
  for (const z of [1.15, -1.15]) {
    g.add(mesh(new THREE.BoxGeometry(1.5, 0.6, 0.06), dark, -2.9, 1.25, z));
  }

  const wheels = [
    ...addWheels(g, 0.55, 0.38, [-1.35], 1.0),
    ...addWheels(g, 0.55, 0.38, [-5.9, -7.1], 1.0, { dual: true }),
  ];
  g.userData.wheels = wheels;
  g.userData.length = 8.25;
  return g;
}

export function createPoliceCar() {
  return createCar({ police: true });
}

export function createCar({ police = false, color = 0xc8302e } = {}) {
  const g = new THREE.Group();
  const white = police ? std(0xf5f7fa, { metalness: 0.35, roughness: 0.3 }) : std(color, { metalness: 0.45, roughness: 0.3 });
  const blue = police ? std(0x1c47c9, { metalness: 0.3, roughness: 0.35 }) : std(0x2a2d33, { metalness: 0.5, roughness: 0.4 });
  const dark = std(0x1d2024, { roughness: 0.7 });

  g.add(mesh(rbox(4.8, 0.72, 1.9, 0.26), white, -2.4, 0.72, 0));
  g.add(mesh(rbox(1.2, 0.3, 1.86, 0.14), white, -0.75, 1.1, 0));
  g.add(mesh(rbox(1.0, 0.3, 1.86, 0.14), white, -4.25, 1.1, 0));
  g.add(mesh(rbox(2.5, 0.64, 1.72, 0.2), glass(), -2.55, 1.4, 0, false));
  g.add(mesh(rbox(2.2, 0.1, 1.74, 0.05), white, -2.65, 1.74, 0));
  for (const x of [-1.5, -3.6]) g.add(mesh(new THREE.BoxGeometry(0.1, 0.62, 1.74), white, x, 1.4, 0));
  g.add(mesh(new THREE.BoxGeometry(4.82, 0.2, 1.93), blue, -2.4, 0.78, 0, false));
  g.add(mesh(rbox(0.3, 0.3, 1.94, 0.1), dark, -0.05, 0.5, 0));
  g.add(mesh(rbox(0.3, 0.3, 1.94, 0.1), dark, -4.75, 0.5, 0));
  g.add(mesh(new THREE.BoxGeometry(0.04, 0.16, 0.9), std(0x111111), 0.12, 0.85, 0, false));
  lightPair(g, 0.02, 0.9, 0.68, 0xfff6e0, [0.06, 0.14, 0.34], 3);
  lightPair(g, -4.82, 0.9, 0.72, 0xff2020, [0.05, 0.12, 0.3], 1.6);
  for (const z of [0.98, -0.98]) g.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.14), white, -1.35, 1.2, z));
  g.userData.wheels = addWheels(g, 0.36, 0.26, [-0.95, -3.85], 0.8);
  g.userData.length = 4.8;
  if (!police) return g;

  const decal = canvasTexture(512, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#1c47c9';
    c.font = 'bold 72px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
    c.textBaseline = 'middle';
    c.fillText('公安', 20, h / 2);
    c.font = 'bold 60px sans-serif';
    c.fillText('POLICE', 200, h / 2 + 2);
  });
  const decalMat = new THREE.MeshStandardMaterial({ map: decal, transparent: true, roughness: 0.4 });
  const dl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), decalMat);
  dl.position.set(-2.5, 1.05, 0.962);
  g.add(dl);
  const dr = dl.clone();
  dr.rotation.y = Math.PI;
  dr.position.z = -0.962;
  g.add(dr);

  g.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 1.3), dark, -2.35, 1.84, 0));
  const red = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 0.3, transparent: true, opacity: 0.95 });
  const blu = new THREE.MeshStandardMaterial({ color: 0x2060ff, emissive: 0x1040ff, emissiveIntensity: 0.3, transparent: true, opacity: 0.95 });
  g.add(mesh(rbox(0.3, 0.14, 0.6, 0.05), red, -2.35, 1.95, 0.33, false));
  g.add(mesh(rbox(0.3, 0.14, 0.6, 0.05), blu, -2.35, 1.95, -0.33, false));
  const redLight = new THREE.PointLight(0xff2030, 0, 14, 1.6);
  redLight.position.set(-2.35, 2.3, 0.6);
  const bluLight = new THREE.PointLight(0x2060ff, 0, 14, 1.6);
  bluLight.position.set(-2.35, 2.3, -0.6);
  g.add(redLight, bluLight);
  g.userData.siren = { red, blu, redLight, bluLight };
  return g;
}

function thinWheel(radius, tube, spokes) {
  const pivot = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 36), std(0x141414, { roughness: 0.9 }));
  tire.castShadow = true;
  pivot.add(tire);
  const spokeMat = std(0xb8bcc2, { metalness: 0.8, roughness: 0.3 });
  for (let k = 0; k < spokes; k++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(radius * 2, 0.015, 0.015), spokeMat);
    s.rotation.z = (k * Math.PI) / spokes;
    pivot.add(s);
  }
  pivot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10).rotateX(Math.PI / 2), spokeMat));
  pivot.userData.radius = radius;
  return pivot;
}

const rod = (a, b, r, mat) => {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  m.castShadow = true;
  return m;
};

// A seated or standing figure; legs are pivots so they can swing.
function rider(shirt, { seated = true, helmet = null } = {}) {
  const g = new THREE.Group();
  const skin = std(0xf0c7a0, { roughness: 0.8 });
  const pants = std(0x2d3a55, { roughness: 0.8 });
  const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 10), std(shirt, { roughness: 0.7 }), 0, 0.45, 0);
  if (seated) torso.rotation.z = -0.35;
  g.add(torso);
  const head = mesh(new THREE.SphereGeometry(0.15, 16, 12), skin, seated ? 0.14 : 0, 0.92, 0);
  g.add(head);
  if (helmet !== null) g.add(mesh(new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), std(helmet, { metalness: 0.3, roughness: 0.3 }), seated ? 0.14 : 0, 0.95, 0));
  const legs = [];
  for (const z of [0.1, -0.1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.12, z);
    hip.add(mesh(new THREE.CapsuleGeometry(0.075, 0.6, 4, 8), pants, 0, -0.35, 0));
    g.add(hip);
    legs.push(hip);
  }
  for (const z of [0.24, -0.24]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.06, 0.45, 4, 8), std(shirt, { roughness: 0.7 }), seated ? 0.25 : 0, 0.5, z);
    arm.rotation.z = seated ? -1.0 : 0;
    g.add(arm);
  }
  g.userData.legs = legs;
  return g;
}

export function createCyclist() {
  const g = new THREE.Group();
  const frameMat = std(0x1fa37a, { metalness: 0.5, roughness: 0.35 });
  const R = 0.34;
  const front = thinWheel(R, 0.03, 8), back = thinWheel(R, 0.03, 8);
  front.position.set(-0.4, R, 0);
  back.position.set(-1.45, R, 0);
  g.add(front, back);
  g.add(rod([-1.45, R, 0], [-0.95, R, 0], 0.025, frameMat));
  g.add(rod([-0.95, R, 0], [-1.1, 0.95, 0], 0.03, frameMat));
  g.add(rod([-1.1, 0.95, 0], [-0.55, 0.95, 0], 0.03, frameMat));
  g.add(rod([-0.55, 0.95, 0], [-0.95, R, 0], 0.03, frameMat));
  g.add(rod([-1.45, R, 0], [-1.1, 0.95, 0], 0.02, frameMat));
  g.add(rod([-0.4, R, 0], [-0.52, 1.12, 0], 0.025, frameMat));
  g.add(rod([-0.52, 1.12, 0.25], [-0.52, 1.12, -0.25], 0.02, std(0x222222)));
  g.add(mesh(new THREE.BoxGeometry(0.28, 0.06, 0.14), std(0x222222), -1.12, 1.0, 0));
  const man = rider(0xffc933, { seated: true, helmet: 0xff5a36 });
  man.position.set(-1.05, 1.0, 0);
  g.add(man);
  g.userData.wheels = [front, back];
  g.userData.legs = man.userData.legs;
  g.userData.length = 1.8;
  return g;
}

export function createMotorbike() {
  const g = new THREE.Group();
  const body = std(0x2255cc, { metalness: 0.5, roughness: 0.3 });
  const dark = std(0x1d2024, { roughness: 0.6 });
  const R = 0.33;
  const front = thinWheel(R, 0.09, 6), back = thinWheel(R, 0.1, 6);
  front.position.set(-0.4, R, 0);
  back.position.set(-1.75, R, 0);
  g.add(front, back);
  g.add(mesh(rbox(0.9, 0.35, 0.4, 0.12), body, -1.0, 0.85, 0));
  g.add(mesh(rbox(0.7, 0.14, 0.32, 0.06), dark, -1.5, 0.92, 0));
  g.add(mesh(rbox(0.6, 0.3, 0.3, 0.1), std(0x9aa0a8, { metalness: 0.8, roughness: 0.3 }), -1.05, 0.55, 0));
  g.add(rod([-0.4, R, 0], [-0.62, 1.1, 0], 0.035, dark));
  g.add(rod([-0.62, 1.12, 0.32], [-0.62, 1.12, -0.32], 0.025, dark));
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.14, 0.2), new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff4d6, emissiveIntensity: 2 }), -0.52, 1.0, 0, false));
  g.add(rod([-1.75, R, 0.12], [-1.2, 0.5, 0.18], 0.04, std(0x8a8f96, { metalness: 0.9 })));
  const man = rider(0x333a44, { seated: true, helmet: 0xf2f2f2 });
  man.position.set(-1.35, 1.0, 0);
  g.add(man);
  g.userData.wheels = [front, back];
  g.userData.length = 2.1;
  return g;
}

export function createPerson(shirt = 0xe0474c) {
  const g = new THREE.Group();
  const man = rider(shirt, { seated: false });
  man.position.set(-0.2, 0.84, 0);
  g.add(man);
  g.userData.wheels = [];
  g.userData.legs = man.userData.legs;
  g.userData.stride = 1.4;
  g.userData.length = 0.4;
  return g;
}

export function rollWheels(vehicle, distance) {
  for (const w of vehicle.userData.wheels) w.rotation.z = -distance / w.userData.radius;
  const legs = vehicle.userData.legs;
  if (legs) {
    const k = vehicle.userData.stride ? (distance / vehicle.userData.stride) * Math.PI : distance / 0.34;
    const swing = vehicle.userData.stride ? 0.5 * Math.sin(k) : 0;
    legs.forEach((leg, i) => {
      leg.rotation.z = vehicle.userData.stride ? (i ? swing : -swing) : -0.9 + 0.45 * Math.sin(k + i * Math.PI);
    });
  }
}

export function setSiren(car, on, time) {
  const s = car.userData.siren;
  if (!s) return;
  const phase = Math.floor(time * 6) % 2;
  const r = on && phase === 0 ? 1 : 0;
  const b = on && phase === 1 ? 1 : 0;
  s.red.emissiveIntensity = 0.3 + r * 3;
  s.blu.emissiveIntensity = 0.3 + b * 3;
  s.redLight.intensity = r * 30;
  s.bluLight.intensity = b * 30;
}
