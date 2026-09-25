// Number formatting for narration and formulas.
export function num(x, digits = 2) {
  if (!Number.isFinite(x)) return String(x);
  const r = Number(x.toFixed(digits));
  return String(Object.is(r, -0) ? 0 : r);
}

export function sig(x, n = 3) {
  if (!Number.isFinite(x) || x === 0) return num(x);
  return String(Number(x.toPrecision(n)));
}

// Scientific notation for LaTeX, e.g. 6.28\times10^{-7}
export function sci(x, digits = 2) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e <= 3) return num(x, digits);
  const m = x / 10 ** e;
  return `${num(m, digits)}\\times10^{${e}}`;
}

// Scientific notation for plain text / speech, e.g. 6.28×10⁻⁷
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export function sciText(x, digits = 2) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e <= 3) return num(x, digits);
  return `${num(x / 10 ** e, digits)}×10${[...String(e)].map((c) => SUP[c]).join('')}`;
}

// Scientific notation for narration, e.g. 6.28乘10的负7次方
export function sciSay(x, digits = 2) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e <= 3) return num(x, digits);
  return `${num(x / 10 ** e, digits)}乘10的${e < 0 ? '负' : ''}${Math.abs(e)}次方`;
}

// Picks a readable length unit for a value in metres.
export function lengthUnit(m) {
  const a = Math.abs(m);
  if (a >= 1) return { unit: 'm', say: '米', f: 1 };
  if (a >= 0.01) return { unit: 'cm', say: '厘米', f: 100 };
  return { unit: 'mm', say: '毫米', f: 1000 };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

const supText = (e) => [...String(e)].map((c) => SUP[c]).join('');
const pretty = (s) => escapeHtml(s)
  .replace(/(\d)e(-?\d+)/g, (_, d, e) => `${d}×10${supText(e)}`)
  .replace(/\^(-?\d+)/g, (_, e) => supText(e));

export function statementHtml(pre) {
  const stem = `<p>${pretty(pre.stem)}</p>`;
  const qs = pre.questions.map((q) => `<div class="q">${pretty(q)}</div>`).join('');
  return stem + qs;
}
