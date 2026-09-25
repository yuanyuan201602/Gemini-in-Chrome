import * as THREE from 'three';
import { canvasTexture } from '../core/stage.js';

// Fallback scene for problems without an animation template: a chalkboard that shows the
// current step, while the side panel carries the narration and formulas.
export function createTextProblem({ id = 'text-gen', tab = '文字讲解', statement, steps, note = '本题型暂无动画模板，以下为文字讲解' }) {
  function mount(stage, plots) {
    const { scene } = stage;
    scene.background = new THREE.Color(0x10151f);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x202020, 1.2));
    const spot = new THREE.SpotLight(0xfff4e0, 120, 40, Math.PI / 5, 0.6, 1.2);
    spot.position.set(0, 8, 9);
    scene.add(spot, spot.target);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(12.6, 6.6, 0.3), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.8 }));
    frame.position.set(0, 2.6, -0.2);
    scene.add(frame);
    let tex = null;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
    board.position.set(0, 2.6, 0);
    scene.add(board);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.15, 0.5), new THREE.MeshStandardMaterial({ color: 0x6b4a2f }));
    tray.position.set(0, -0.8, 0.2);
    scene.add(tray);

    function paint(i) {
      tex?.dispose();
      const step = steps[i];
      tex = canvasTexture(1600, 800, (c, w, h) => {
        c.fillStyle = '#1f3a2c';
        c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(255,255,255,0.06)';
        for (let k = 0; k < 400; k++) c.fillRect(Math.random() * w, Math.random() * h, 3, 1);
        c.fillStyle = '#f4f1e6';
        c.font = 'bold 72px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
        c.fillText(`第 ${i + 1} 步`, 80, 140);
        c.font = 'bold 84px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
        const title = step.title;
        const lines = [];
        for (let k = 0; k < title.length; k += 16) lines.push(title.slice(k, k + 16));
        lines.slice(0, 3).forEach((l, k) => c.fillText(l, 80, 300 + k * 110));
        c.font = '40px "PingFang SC","Microsoft YaHei",sans-serif';
        c.fillStyle = '#b9d7c4';
        c.fillText(note, 80, h - 70);
      });
      board.material.map = tex;
      board.material.needsUpdate = true;
    }

    const shot = () => ({ pos: new THREE.Vector3(0, 2.8, 11), target: new THREE.Vector3(0, 2.4, 0) });
    function enterStep(i) {
      paint(i);
      stage.setShot(shot, i === 0 ? 0 : 1);
    }
    const [pa, pb] = plots;
    const blank = (p, title) => {
      p.setOptions({ title, xLabel: '', yLabel: '', xMin: 0, xMax: 1, yMin: 0, yMax: 1, xTicks: [], yTicks: [] });
      p.begin();
      p.text(0.5, 0.5, '本题型暂无图像', { color: '#8190ad', align: 'center', base: 'middle' });
      p.end();
    };
    return {
      enterStep,
      update() {},
      drawGraphs() { blank(pa, '图像'); blank(pb, '图像'); },
      hud: () => `<div class="chip">${note}</div>`,
      dispose() { tex?.dispose(); },
    };
  }
  return { id, tab, statement, steps, camera: { fov: 40, far: 200 }, timeLabel: () => '', mount };
}
