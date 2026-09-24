import katex from 'katex';
import { Stage } from './stage.js';
import { Plot } from './plot.js';

const $ = (id) => document.getElementById(id);

function renderRow(row) {
  const div = document.createElement('div');
  div.className = `row ${row.cls || ''}`;
  if (row.tex) {
    div.innerHTML = katex.renderToString(row.tex, { throwOnError: false, displayMode: false });
  }
  if (row.text) {
    const span = document.createElement('span');
    span.className = row.tex ? 'note' : '';
    span.innerHTML = row.tex ? `　${row.text}` : row.text;
    div.appendChild(span);
  }
  return div;
}

// Drives one problem: step navigation, timeline, narration, math and graphs.
export class Player {
  constructor(narrator) {
    this.narrator = narrator;
    this.speed = 1;
    this.auto = false;
    this.bindControls();
    this.last = performance.now();
    requestAnimationFrame((n) => this.loop(n));
  }

  load(problem) {
    if (this.inst) {
      this.inst.dispose?.();
      this.stage.dispose();
    }
    this.narrator.stop();
    this.problem = problem;
    this.stage = new Stage($('viewport'), problem.camera || {});
    this.plots = [new Plot($('graph-a'), {}), new Plot($('graph-b'), {})];
    this.inst = problem.mount(this.stage, this.plots);

    $('statement').innerHTML = problem.statement;
    const list = $('step-list');
    list.innerHTML = '';
    problem.steps.forEach((s, i) => {
      const li = document.createElement('li');
      li.textContent = s.title;
      li.onclick = () => this.goto(i, true);
      list.appendChild(li);
    });
    this.goto(0, false);
  }

  goto(i, autoplay = true) {
    const steps = this.problem.steps;
    i = Math.max(0, Math.min(steps.length - 1, i));
    clearTimeout(this.autoTimer);
    this.index = i;
    const step = steps[i];
    this.t = step.t0;
    this.animDone = step.t1 <= step.t0;
    this.speechDone = false;
    this.playing = autoplay && !this.animDone;

    [...$('step-list').children].forEach((li, k) => {
      li.classList.toggle('active', k === i);
      li.classList.toggle('done', k < i);
    });

    $('math-title').textContent = `第 ${i + 1} 步 · ${step.title}`;
    const math = $('math');
    math.innerHTML = '';
    const rows = (step.math || []).map(renderRow);
    rows.forEach((r) => math.appendChild(r));
    this.rowTimers?.forEach(clearTimeout);
    this.rowTimers = rows.map((r, k) => setTimeout(() => r.classList.add('in'), 250 + k * (autoplay ? 900 : 60)));

    this.inst.enterStep(i, step);

    if (autoplay) {
      this.narrator.rate = this.speed >= 1.5 ? 1.25 : 1;
      this.narrator.say(step.say).then((current) => {
        if (!current) return;
        this.speechDone = true;
        this.maybeAdvance();
      });
    } else {
      this.narrator.stop();
      $('subtitle').textContent = step.say;
      $('subtitle').classList.add('show');
      this.speechDone = true;
    }
    this.updateButtons();
  }

  maybeAdvance() {
    if (!this.auto || !this.animDone || !this.speechDone) return;
    if (this.index >= this.problem.steps.length - 1) return;
    clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => this.goto(this.index + 1, true), 1200);
  }

  togglePlay() {
    const step = this.problem.steps[this.index];
    if (this.playing) {
      this.playing = false;
      this.narrator.pause();
    } else {
      if (this.t >= step.t1 - 1e-6) {
        this.goto(this.index, true);
        return;
      }
      this.playing = true;
      this.narrator.resume();
    }
    this.updateButtons();
  }

  updateButtons() {
    $('btn-play').textContent = this.playing ? '❚❚ 暂停' : '▶ 播放';
    $('btn-prev').disabled = this.index === 0;
    $('btn-next').disabled = this.index === this.problem.steps.length - 1;
  }

  bindControls() {
    $('btn-prev').onclick = () => this.goto(this.index - 1, true);
    $('btn-next').onclick = () => this.goto(this.index + 1, true);
    $('btn-replay').onclick = () => this.goto(this.index, true);
    $('btn-play').onclick = () => this.togglePlay();
    $('speed').onchange = (e) => { this.speed = parseFloat(e.target.value); };
    $('voice-toggle').onchange = (e) => {
      this.narrator.enabled = e.target.checked;
      if (!e.target.checked) this.narrator.stop();
    };
    $('auto-toggle').onchange = (e) => { this.auto = e.target.checked; this.maybeAdvance(); };
    const scrub = $('scrub');
    scrub.oninput = () => {
      const step = this.problem.steps[this.index];
      this.t = step.t0 + (step.t1 - step.t0) * (scrub.value / 1000);
      this.playing = false;
      this.animDone = this.t >= step.t1;
      this.updateButtons();
    };
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || !this.problem || this.suspended) return;
      if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
      if (e.code === 'ArrowRight') this.goto(this.index + 1, true);
      if (e.code === 'ArrowLeft') this.goto(this.index - 1, true);
      if (e.code === 'KeyR') this.goto(this.index, true);
    });
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.problem && !this.suspended) {
      const step = this.problem.steps[this.index];
      if (this.playing) {
        this.t += dt * this.speed * (step.rate || 1);
        if (this.t >= step.t1) {
          this.t = step.t1;
          this.playing = false;
          this.animDone = true;
          this.updateButtons();
          this.maybeAdvance();
        }
      }
      this.inst.update(this.t, dt, this.index);
      this.stage.update(this.t);
      this.inst.drawGraphs(this.t, this.index);
      $('hud').innerHTML = this.inst.hud(this.t, this.index);
      const span = step.t1 - step.t0;
      if (document.activeElement !== $('scrub')) {
        $('scrub').value = span > 0 ? ((this.t - step.t0) / span) * 1000 : 1000;
      }
      $('time-label').textContent = this.problem.timeLabel(this.t);
    }
    requestAnimationFrame((n) => this.loop(n));
  }
}
