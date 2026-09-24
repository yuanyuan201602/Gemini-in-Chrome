import * as THREE from 'three';
import { canvasTexture } from '../core/stage.js';

// A straight urban road along +x. Lanes for eastbound traffic are at z = 1.75 and z = 5.25.
export const LANE_INNER = 1.75;
export const LANE_OUTER = 5.25;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function asphaltTexture() {
  const tex = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#3b3e44';
    c.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 9000; i++) {
      const v = 45 + r() * 40;
      c.fillStyle = `rgba(${v},${v},${v + 4},${0.35 + r() * 0.4})`;
      c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function facadeTexture(base, windowLit, seed) {
  const tex = canvasTexture(256, 512, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    const r = rng(seed);
    const cols = 4, rows = 10;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = 18 + i * ((w - 36) / cols);
        const y = 20 + j * ((h - 40) / rows);
        const lit = r() < 0.18;
        c.fillStyle = lit ? windowLit : `rgba(40,60,85,${0.75 + r() * 0.2})`;
        c.fillRect(x + 6, y + 6, (w - 36) / cols - 14, (h - 40) / rows - 16);
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.fillRect(x + 6, y + 6, (w - 36) / cols - 14, 3);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function roadMarking(scene, x0, x1, z, width, dashed, color = 0xf2f2f2) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const add = (a, b) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, width), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((a + b) / 2, 0.012, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  if (!dashed) return add(x0, x1);
  for (let x = x0; x < x1; x += 10) add(x, Math.min(x + 4, x1));
}

function tree(r) {
  const g = new THREE.Group();
  const h = 2.2 + r() * 1.2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, h, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.26 + r() * 0.06, 0.45, 0.28 + r() * 0.08), roughness: 0.85, flatShading: true });
  for (let k = 0; k < 3; k++) {
    const s = 1.1 + r() * 0.7;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leafMat);
    leaf.position.set((r() - 0.5) * 1.0, h + 0.4 + k * 0.55, (r() - 0.5) * 1.0);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

function streetLamp() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.7, roughness: 0.35 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7, 10), mat);
  pole.position.y = 3.5;
  pole.castShadow = true;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.8), mat);
  arm.position.set(0, 6.9, -0.9);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.7), mat);
  head.position.set(0, 6.85, -1.7);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.6), new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xfff0c0, emissiveIntensity: 0.6 }));
  bulb.position.set(0, 6.77, -1.7);
  g.add(pole, arm, head, bulb);
  return g;
}

function distanceSign(meters) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.5 }));
  post.position.y = 0.9;
  post.castShadow = true;
  const tex = canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#1d6b3c';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#fff';
    c.lineWidth = 8;
    c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#fff';
    c.font = 'bold 64px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${meters} m`, w / 2, h / 2 + 3);
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.05), [
    new THREE.MeshStandardMaterial({ color: 0x1d6b3c }),
    new THREE.MeshStandardMaterial({ color: 0x1d6b3c }),
    new THREE.MeshStandardMaterial({ color: 0x1d6b3c }),
    new THREE.MeshStandardMaterial({ color: 0x1d6b3c }),
    new THREE.MeshStandardMaterial({ map: tex }),
    new THREE.MeshStandardMaterial({ map: tex }),
  ]);
  board.position.y = 2.05;
  board.castShadow = true;
  g.add(post, board);
  return g;
}

export function buildStreet(scene, { x0 = -120, x1 = 300 } = {}) {
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(len + 400, 400), new THREE.MeshStandardMaterial({ color: 0x6f9a4f, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, -0.02, 0);
  grass.receiveShadow = true;
  scene.add(grass);

  const asphalt = asphaltTexture();
  asphalt.repeat.set(len / 8, 14 / 8);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(len, 14), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(cx, 0, 0);
  road.receiveShadow = true;
  scene.add(road);

  const crossTex = asphalt.clone();
  crossTex.repeat.set(12 / 8, 60 / 8);
  crossTex.needsUpdate = true;
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(12, 60), new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.92 }));
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(-16, 0.004, 0);
  cross.receiveShadow = true;
  scene.add(cross);

  roadMarking(scene, x0, -22, 0.12, 0.15, false, 0xf2c230);
  roadMarking(scene, x0, -22, -0.12, 0.15, false, 0xf2c230);
  roadMarking(scene, -10, x1, 0.12, 0.15, false, 0xf2c230);
  roadMarking(scene, -10, x1, -0.12, 0.15, false, 0xf2c230);
  for (const z of [3.5, -3.5]) {
    roadMarking(scene, x0, -22, z, 0.15, true);
    roadMarking(scene, -10, x1, z, 0.15, true);
  }
  for (const z of [6.85, -6.85]) {
    roadMarking(scene, x0, -22, z, 0.15, false);
    roadMarking(scene, -10, x1, z, 0.15, false);
  }
  const zebraMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
  for (const xc of [-24, -8]) {
    for (let z = -6.3; z <= 6.3; z += 1.2) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.6), zebraMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(xc, 0.013, z);
      scene.add(s);
    }
  }

  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.9 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.8 });
  for (const side of [1, -1]) {
    for (const [a, b] of [[x0, -22], [-10, x1]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.2, 3.6), walkMat);
      w.position.set((a + b) / 2, 0.1, side * 8.9);
      w.receiveShadow = true;
      scene.add(w);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.24, 0.2), curbMat);
      curb.position.set((a + b) / 2, 0.12, side * 7.1);
      scene.add(curb);
    }
  }

  const r = rng(42);
  const palettes = [
    ['#c9c1b3', '#ffe7a8'], ['#9fb2c4', '#fff1c4'], ['#d7cfc4', '#ffe0a0'],
    ['#8d98a8', '#ffe9b0'], ['#e3d7c3', '#fff3cf'], ['#b7a28e', '#ffdd99'],
  ];
  const facades = palettes.map(([b, l], i) => facadeTexture(b, l, i * 13 + 5));
  // Buildings only on the far side of the road so the camera (on the +z side) stays unobstructed.
  for (const side of [-1]) {
    let x = x0;
    while (x < x1) {
      const w = 9 + r() * 9;
      if (x + w > -30 && x < -2) { x = -2; continue; }
      const d = 9 + r() * 6;
      const h = 8 + r() * 26;
      const tex = facades[Math.floor(r() * facades.length)].clone();
      tex.repeat.set(w / 12, h / 22);
      tex.needsUpdate = true;
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
      const roof = new THREE.MeshStandardMaterial({ color: 0x70757d, roughness: 0.9 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w - 1.2, h, d), [face, face, roof, roof, face, face]);
      b.position.set(x + w / 2, h / 2, side * (11.5 + d / 2 + r() * 2));
      b.castShadow = b.receiveShadow = true;
      scene.add(b);
      x += w;
    }
  }

  for (let x = x0 + 6; x < x1; x += 12) {
    if (x > -30 && x < -2) continue;
    for (const side of [-1]) {
      const t = tree(r);
      t.position.set(x + (r() - 0.5) * 2, 0.2, side * 9.8);
      scene.add(t);
    }
  }
  for (let x = x0 + 10; x < x1; x += 30) {
    if (x > -30 && x < -2) continue;
    const l = streetLamp();
    l.position.set(x, 0.2, 7.6);
    scene.add(l);
    const l2 = streetLamp();
    l2.rotation.y = Math.PI;
    l2.position.set(x + 15, 0.2, -7.6);
    scene.add(l2);
  }

  for (let m = 0; m <= 160; m += 20) {
    const s = distanceSign(m);
    s.position.set(m, 0.2, 7.5);
    scene.add(s);
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    tick.rotation.x = -Math.PI / 2;
    tick.position.set(m, 0.014, 3.5);
    scene.add(tick);
  }

  // Traffic light at the intersection.
  const tl = new THREE.Group();
  const pmat = new THREE.MeshStandardMaterial({ color: 0x3c4148, metalness: 0.6, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 6, 10), pmat);
  pole.position.y = 3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 5), pmat);
  arm.position.set(0, 5.8, -2.5);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.45), new THREE.MeshStandardMaterial({ color: 0x1a1c1f }));
  box.position.set(0.1, 5.3, -3.5);
  const green = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshStandardMaterial({ color: 0x30ff70, emissive: 0x20ff60, emissiveIntensity: 2 }));
  green.position.set(-0.13, 4.95, -3.5);
  tl.add(pole, arm, box, green);
  tl.position.set(-9.5, 0.2, 7.6);
  tl.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(tl);
}

export function skyTexture() {
  return canvasTexture(16, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5f97d8');
    g.addColorStop(0.55, '#a9ccef');
    g.addColorStop(1, '#e4eef6');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}
