// Lightweight 2D plotting on canvas, redrawn every frame in sync with the animation.
export class Plot {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = { pad: { l: 46, r: 14, t: 26, b: 30 }, ...opts };
  }

  setOptions(opts) {
    this.opts = { ...this.opts, ...opts };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    this.w = w;
    this.h = h;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.computeRange();
  }

  computeRange() {
    const { pad } = this.opts;
    let { xMin, xMax, yMin, yMax } = this.opts;
    const pw = this.w - pad.l - pad.r;
    const ph = this.h - pad.t - pad.b;
    if (this.opts.equalAspect) {
      const sx = pw / (xMax - xMin);
      const sy = ph / (yMax - yMin);
      const s = Math.min(sx, sy);
      const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
      const hw = pw / s / 2, hh = ph / s / 2;
      xMin = cx - hw; xMax = cx + hw; yMin = cy - hh; yMax = cy + hh;
    }
    this.r = { xMin, xMax, yMin, yMax, pw, ph };
  }

  X(x) { const { xMin, xMax, pw } = this.r; return this.opts.pad.l + ((x - xMin) / (xMax - xMin)) * pw; }
  Y(y) { const { yMin, yMax, ph } = this.r; return this.opts.pad.t + (1 - (y - yMin) / (yMax - yMin)) * ph; }

  begin() {
    this.resize();
    const c = this.ctx;
    const { pad, title, xLabel, yLabel, xTicks = [], yTicks = [], originAxes } = this.opts;
    c.clearRect(0, 0, this.w, this.h);
    c.fillStyle = '#121a29';
    c.fillRect(0, 0, this.w, this.h);

    c.font = '11px system-ui, sans-serif';
    c.strokeStyle = 'rgba(255,255,255,0.07)';
    c.lineWidth = 1;
    c.fillStyle = '#8190ad';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    for (const t of xTicks) {
      const x = this.X(t);
      c.beginPath(); c.moveTo(x, pad.t); c.lineTo(x, this.h - pad.b); c.stroke();
      c.fillText(String(t), x, this.h - pad.b + 4);
    }
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    for (const t of yTicks) {
      const y = this.Y(t);
      c.beginPath(); c.moveTo(pad.l, y); c.lineTo(this.w - pad.r, y); c.stroke();
      c.fillText(String(t), pad.l - 5, y);
    }

    c.strokeStyle = '#6d7a96';
    c.lineWidth = 1.4;
    c.beginPath();
    if (originAxes) {
      c.moveTo(pad.l, this.Y(0)); c.lineTo(this.w - pad.r, this.Y(0));
      c.moveTo(this.X(0), pad.t); c.lineTo(this.X(0), this.h - pad.b);
    } else {
      c.moveTo(pad.l, pad.t - 6); c.lineTo(pad.l, this.h - pad.b); c.lineTo(this.w - pad.r + 4, this.h - pad.b);
    }
    c.stroke();

    c.fillStyle = '#c8d2e6';
    c.font = 'bold 12px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    if (title) c.fillText(title, pad.l + 4, 6);
    c.font = '11px system-ui, sans-serif';
    c.fillStyle = '#8190ad';
    if (yLabel) { c.textAlign = 'left'; c.fillText(yLabel, 4, 6); }
    if (xLabel) { c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(xLabel, this.w - 4, this.h - 2); }

    c.save();
    c.beginPath();
    c.rect(pad.l, pad.t - 8, this.w - pad.l - pad.r + 8, this.h - pad.t - pad.b + 8);
    c.clip();
    this.clipped = true;
    return this;
  }

  end() {
    if (this.clipped) this.ctx.restore();
    this.clipped = false;
  }

  sample(fn, a, b, n = 160) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      pts.push([x, fn(x)]);
    }
    return pts;
  }

  polyline(pts, { color = '#fff', width = 2, dash = null, alpha = 1 } = {}) {
    if (pts.length < 2) return this;
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineJoin = 'round';
    if (dash) c.setLineDash(dash);
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))));
    c.stroke();
    c.restore();
    return this;
  }

  fillBetween(top, bottom, color) {
    if (top.length < 2) return this;
    const c = this.ctx;
    c.save();
    c.fillStyle = color;
    c.beginPath();
    top.forEach(([x, y], i) => (i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))));
    for (let i = bottom.length - 1; i >= 0; i--) c.lineTo(this.X(bottom[i][0]), this.Y(bottom[i][1]));
    c.closePath();
    c.fill();
    c.restore();
    return this;
  }

  dot(x, y, color = '#fff', r = 4.5) {
    const c = this.ctx;
    c.save();
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(this.X(x), this.Y(y), r, 0, Math.PI * 2);
    c.fill();
    c.restore();
    return this;
  }

  vline(x, color = 'rgba(255,255,255,0.35)', dash = [4, 4]) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.setLineDash(dash);
    c.beginPath();
    c.moveTo(this.X(x), this.opts.pad.t);
    c.lineTo(this.X(x), this.h - this.opts.pad.b);
    c.stroke();
    c.restore();
    return this;
  }

  hline(y, color = 'rgba(255,255,255,0.35)', dash = [4, 4]) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.setLineDash(dash);
    c.beginPath();
    c.moveTo(this.opts.pad.l, this.Y(y));
    c.lineTo(this.w - this.opts.pad.r, this.Y(y));
    c.stroke();
    c.restore();
    return this;
  }

  text(x, y, str, { color = '#fff', align = 'left', base = 'bottom', size = 12, bold = false, bg = null } = {}) {
    const c = this.ctx;
    c.save();
    c.font = `${bold ? 'bold ' : ''}${size}px system-ui, sans-serif`;
    c.textAlign = align;
    c.textBaseline = base;
    const px = this.X(x), py = this.Y(y);
    if (bg) {
      const m = c.measureText(str);
      const w = m.width + 8, h = size + 6;
      let bx = px - (align === 'center' ? w / 2 : align === 'right' ? w - 4 : 4);
      let by = py - (base === 'bottom' ? h - 2 : base === 'middle' ? h / 2 : 2);
      c.fillStyle = bg;
      c.fillRect(bx, by, w, h);
    }
    c.fillStyle = color;
    c.fillText(str, px, py);
    c.restore();
    return this;
  }

  cross(x, y, color = '#ff5b5b', s = 7) {
    const c = this.ctx;
    const px = this.X(x), py = this.Y(y);
    c.save();
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(px - s, py - s); c.lineTo(px + s, py + s);
    c.moveTo(px + s, py - s); c.lineTo(px - s, py + s);
    c.stroke();
    c.restore();
    return this;
  }

  legend(items) {
    const c = this.ctx;
    c.save();
    c.font = '11px system-ui, sans-serif';
    c.textBaseline = 'middle';
    let x = this.w - this.opts.pad.r - 4;
    const y = 13;
    for (let i = items.length - 1; i >= 0; i--) {
      const [label, color] = items[i];
      c.textAlign = 'right';
      c.fillStyle = '#c8d2e6';
      c.fillText(label, x, y);
      const tw = c.measureText(label).width;
      c.fillStyle = color;
      c.fillRect(x - tw - 18, y - 2, 13, 4);
      x -= tw + 28;
    }
    c.restore();
    return this;
  }
}
