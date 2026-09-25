import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from '../core/stage.js';

// Magnetic-focusing apparatus. The tube axis is the z-axis (y = 0), 1 unit = 10 cm.
export const TUBE_R = 2.4;
export const TUBE_Z0 = -2.9;
export const TUBE_Z1 = 13.4;
export const TABLE_Y = -4.3;
export const PSU_POS = new THREE.Vector3(5.2, TABLE_Y + 1.25, -5.2);

class HelixCurve extends THREE.Curve {
  constructor(radius, z0, z1, turns) {
    super();
    Object.assign(this, { radius, z0, z1, turns });
  }
  getPoint(u, target = new THREE.Vector3()) {
    const a = u * this.turns * Math.PI * 2;
    return target.set(this.radius * Math.cos(a), this.radius * Math.sin(a), this.z0 + (this.z1 - this.z0) * u);
  }
}

function woodTexture() {
  const tex = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#6b4a32';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      c.strokeStyle = `rgba(${40 + Math.random() * 40},${25 + Math.random() * 20},15,${0.25 + Math.random() * 0.3})`;
      c.lineWidth = 1 + Math.random() * 3;
      c.beginPath();
      const y = Math.random() * h;
      c.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x / 60 + i) * 6);
      c.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildLab(scene) {
  const parts = {};

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -11;
  floor.receiveShadow = true;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({ color: 0x323946, roughness: 0.95 }));
  wall.position.set(0, 18, -40);
  scene.add(wall);

  // Lab bench
  const wood = woodTexture();
  wood.repeat.set(3, 1);
  const top = new THREE.Mesh(new RoundedBoxGeometry(14, 0.5, 26, 3, 0.1), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6 }));
  top.position.set(1.5, TABLE_Y - 0.25, 5.2);
  top.receiveShadow = top.castShadow = true;
  scene.add(top);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3b3f46, metalness: 0.6, roughness: 0.4 });
  for (const x of [-5, 8]) for (const z of [-7, 17.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.5, 0.5), legMat);
    leg.position.set(x, TABLE_Y - 3.75, z);
    leg.castShadow = true;
    scene.add(leg);
  }

  // Glass vacuum tube
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8ecff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 1.2,
  });
  const len = TUBE_Z1 - TUBE_Z0;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R, TUBE_R, len, 72, 1, true), glassMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.z = (TUBE_Z0 + TUBE_Z1) / 2;
  tube.renderOrder = 2;
  scene.add(tube);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(TUBE_R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  dome.rotation.x = Math.PI / 2;
  dome.scale.y = 0.35;
  dome.position.z = TUBE_Z1;
  dome.renderOrder = 2;
  scene.add(dome);
  parts.glass = glassMat;

  const metal = new THREE.MeshStandardMaterial({ color: 0xaab2bd, metalness: 0.9, roughness: 0.28 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.7, roughness: 0.4 });

  // Rear base of the tube (holds the proton source)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R + 0.15, TUBE_R + 0.15, 1.2, 48), darkMetal);
  base.rotation.x = Math.PI / 2;
  base.position.z = TUBE_Z0 - 0.5;
  base.castShadow = true;
  scene.add(base);
  for (let k = 0; k < 6; k++) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), metal);
    const a = (k / 6) * Math.PI * 2;
    pin.rotation.x = Math.PI / 2;
    pin.position.set(Math.cos(a) * 1.2, Math.sin(a) * 1.2, TUBE_Z0 - 1.4);
    scene.add(pin);
  }

  // Proton source: a small gun with an exit aperture at O.
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 2.3, 32), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -1.45;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 32), darkMetal);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = -2.3;
  const aperture = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.42, 32), new THREE.MeshStandardMaterial({ color: 0x777d86, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  aperture.position.z = -0.3;
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), new THREE.MeshBasicMaterial({ color: 0xff6a4a }));
  glow.position.z = -0.29;
  gun.add(barrel, collar, aperture, glow);
  gun.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(gun);

  // Solenoid (copper winding on a former), producing a uniform B along +z.
  const copper = new THREE.MeshStandardMaterial({ color: 0xc8733a, metalness: 1, roughness: 0.32, transparent: true, opacity: 1 });
  const coilZ0 = -1.2, coilZ1 = 12.6;
  const coil = new THREE.Mesh(new THREE.TubeGeometry(new HelixCurve(TUBE_R + 0.32, coilZ0, coilZ1, 34), 34 * 40, 0.055, 8, false), copper);
  coil.castShadow = true;
  scene.add(coil);
  parts.copper = copper;
  const flangeMat = new THREE.MeshStandardMaterial({ color: 0x252a31, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 1 });
  for (const z of [coilZ0 - 0.2, coilZ1 + 0.2]) {
    const f = new THREE.Mesh(new THREE.TorusGeometry(TUBE_R + 0.35, 0.2, 12, 64), flangeMat);
    f.position.z = z;
    f.castShadow = true;
    scene.add(f);
  }
  parts.flange = flangeMat;

  // Supports
  for (const z of [0.4, 10.2]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, TABLE_Y * -1 - TUBE_R - 0.4, 0.8), darkMetal);
    s.position.set(0, (TABLE_Y + (-TUBE_R - 0.4)) / 2, z);
    s.castShadow = true;
    scene.add(s);
    const saddle = new THREE.Mesh(new THREE.TorusGeometry(TUBE_R + 0.4, 0.14, 8, 32, Math.PI), darkMetal);
    saddle.rotation.z = Math.PI;
    saddle.position.z = z;
    scene.add(saddle);
  }

  // Fluorescent screen
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x173a28, emissive: 0x0b4a24, emissiveIntensity: 0.5, roughness: 0.6,
    transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false,
  });
  const screen = new THREE.Mesh(new THREE.CircleGeometry(TUBE_R - 0.05, 64), screenMat);
  screen.renderOrder = 1;
  const frame = new THREE.Mesh(new THREE.TorusGeometry(TUBE_R - 0.05, 0.07, 8, 64), metal);
  parts.screen = new THREE.Group();
  parts.screen.add(screen, frame);
  parts.screenMat = screenMat;
  scene.add(parts.screen);

  // DC power supply
  const psu = new THREE.Group();
  const face = canvasTexture(512, 320, (c, w, h) => {
    c.fillStyle = '#d9dde3';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#10151c';
    c.fillRect(30, 40, 250, 110);
    c.fillStyle = '#ff5140';
    c.font = 'bold 84px monospace';
    c.fillText('12.0', 50, 128);
    c.fillStyle = '#2a3240';
    c.font = 'bold 36px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
    c.fillText('直流稳压电源', 30, 230);
    c.font = '26px sans-serif';
    c.fillText('DC POWER SUPPLY', 30, 280);
    for (const [x, col] of [[340, '#d33'], [430, '#222']]) {
      c.fillStyle = col;
      c.beginPath(); c.arc(x, 250, 26, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#555';
    c.beginPath(); c.arc(390, 95, 44, 0, Math.PI * 2); c.fill();
  });
  const psuBody = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.5, metalness: 0.2 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(4, 2.5, 3, 3, 0.12), [psuBody, psuBody, psuBody, psuBody, psuBody, psuBody]);
  box.castShadow = true;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.3), new THREE.MeshStandardMaterial({ map: face, roughness: 0.5 }));
  panel.position.z = 1.51;
  psu.add(box, panel);
  psu.position.copy(PSU_POS);
  psu.rotation.y = -0.9;
  scene.add(psu);

  const wireMat = [new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 })];
  const ends = [new THREE.Vector3(TUBE_R + 0.35, 0, coilZ0), new THREE.Vector3(TUBE_R + 0.35, 0, coilZ1)];
  ends.forEach((end, i) => {
    const start = new THREE.Vector3(PSU_POS.x - 1.2 + i * 0.5, TABLE_Y + 0.5, PSU_POS.z + 1.0 + i * 0.4);
    const curve = new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3(start.x - 0.6, TABLE_Y + 0.1, start.z + 1.2),
      new THREE.Vector3(4.2 + i * 0.3, TABLE_Y + 0.1, (start.z + end.z) / 2),
      new THREE.Vector3(end.x + 0.8, -1.5, end.z),
      end,
    ]);
    const w = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.07, 8, false), wireMat[i]);
    w.castShadow = true;
    scene.add(w);
  });

  return parts;
}

export function glowSprite(color = '#7dffb0') {
  const tex = canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
}
