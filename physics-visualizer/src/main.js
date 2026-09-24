import 'katex/dist/katex.min.css';
import './style.css';
import { Narrator } from './core/narrator.js';
import { Player } from './core/player.js';
import pursuit from './problems/pursuit.js';
import helix from './problems/helix.js';
import { problemFromResult } from './problems/fromResult.js';
import { initSolvePage } from './ui/solvePage.js';

const bank = [pursuit, helix];
const player = new Player(new Narrator(document.getElementById('subtitle')));
const tabs = document.getElementById('problem-tabs');
const solvePage = document.getElementById('solve-page');
let live = null;

function mark(id) {
  [...tabs.children].forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  history.replaceState(null, '', `#${id}`);
}

function showSolve() {
  player.narrator.stop();
  player.playing = false;
  player.suspended = true;
  solvePage.hidden = false;
  mark('solve');
}

function select(p) {
  solvePage.hidden = true;
  player.suspended = false;
  mark(p.id);
  player.load(p);
}

function addTab(id, text, onclick, cls = '') {
  let b = tabs.querySelector(`[data-id="${id}"]`);
  if (!b) {
    b = document.createElement('button');
    b.dataset.id = id;
    b.className = cls;
    tabs.appendChild(b);
  }
  b.textContent = text;
  b.onclick = onclick;
}

addTab('solve', '✎ 输入题目', showSolve, 'solve-tab');
for (const p of bank) addTab(p.id, p.tab, () => select(p));

initSolvePage({
  onLaunch(result) {
    live = problemFromResult(result);
    if (!live) return;
    addTab('live', `我的题目 · ${result.templateZh?.split(/[：（]/)[0] || '讲解'}`, () => select(live));
    select(live);
  },
});

const start = bank.find((p) => `#${p.id}` === location.hash);
if (start) select(start);
else showSolve();
