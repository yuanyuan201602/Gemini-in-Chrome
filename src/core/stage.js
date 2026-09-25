import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Shared 3D stage: renderer, label layer, orbit controls and scripted camera shots.
export class Stage {
  constructor(container, { fov = 45, near = 0.1, far = 2000 } = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.shot = null;
    this.blend = 1;
    this.blendFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    this.userControl = false;
    this.controls.addEventListener('start', () => { this.userControl = true; });

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.ro = new ResizeObserver(this.onResize);
    this.ro.observe(container);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // shot: (t) => ({ pos: Vector3, target: Vector3 }); camera eases into it.
  setShot(shot, duration = 1.4) {
    this.shot = shot;
    this.userControl = false;
    this.blendFrom.pos.copy(this.camera.position);
    this.blendFrom.target.copy(this.controls.target);
    this.blend = duration > 0 ? 0 : 1;
    this.blendDuration = duration;
    this.blendStart = performance.now();
  }

  update(t) {
    if (this.shot && !this.userControl) {
      const s = this.shot(t);
      if (this.blend < 1) {
        this.blend = Math.min(1, (performance.now() - this.blendStart) / 1000 / this.blendDuration);
        const k = this.blend * this.blend * (3 - 2 * this.blend);
        this.camera.position.lerpVectors(this.blendFrom.pos, s.pos, k);
        this.controls.target.lerpVectors(this.blendFrom.target, s.target, k);
      } else {
        this.camera.position.copy(s.pos);
        this.controls.target.copy(s.target);
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}

export function label(text, cls = '') {
  const div = document.createElement('div');
  div.className = `lbl ${cls}`;
  div.innerHTML = text;
  const obj = new CSS2DObject(div);
  obj.center.set(0.5, 1);
  obj.el = div;
  return obj;
}

export function setArrow(arrow, origin, vec, maxHead = 0.6) {
  const len = vec.length();
  arrow.visible = len > 1e-4;
  if (!arrow.visible) return;
  arrow.position.copy(origin);
  arrow.setDirection(vec.clone().normalize());
  const head = Math.min(maxHead, len * 0.35);
  arrow.setLength(len, head, head * 0.55);
}

// Thicker arrow than ArrowHelper (which draws a 1px line).
export class FatArrow extends THREE.Group {
  constructor(color, radius = 0.05) {
    super();
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 12), mat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.8, 1, 16), mat);
    this.add(this.shaft, this.head);
    this.radius = radius;
  }

  set(origin, vec, headLen = null) {
    const len = vec.length();
    this.visible = len > 1e-4;
    if (!this.visible) return;
    const h = headLen ?? Math.min(this.radius * 7, len * 0.4);
    this.position.copy(origin);
    this.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize());
    this.shaft.scale.set(1, Math.max(len - h, 1e-3), 1);
    this.shaft.position.y = (len - h) / 2;
    this.head.scale.set(1, h, 1);
    this.head.position.y = len - h / 2;
  }
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
