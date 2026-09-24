import 'katex/dist/katex.min.css';
import './style.css';
import { Narrator } from './core/narrator.js';
import { Player } from './core/player.js';
import pursuit from './problems/pursuit.js';
import helix from './problems/helix.js';

const problems = [pursuit, helix];
const player = new Player(new Narrator(document.getElementById('subtitle')));

const tabs = document.getElementById('problem-tabs');
function select(p) {
  [...tabs.children].forEach((b) => b.classList.toggle('active', b.dataset.id === p.id));
  player.load(p);
  history.replaceState(null, '', `#${p.id}`);
}
for (const p of problems) {
  const b = document.createElement('button');
  b.textContent = p.tab;
  b.dataset.id = p.id;
  b.onclick = () => select(p);
  tabs.appendChild(b);
}
select(problems.find((p) => `#${p.id}` === location.hash) || problems[0]);
