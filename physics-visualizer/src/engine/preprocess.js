// Stage 1 of the pipeline: deterministic text preprocessing.
// Finds every "number + unit" in the problem, converts it to SI, and splits sub-questions.
// Jev later decides what each quantity *means*; code never guesses semantics here.

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };

export function normalize(text) {
  let s = String(text)
    .replace(/[\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff0b\uff0d\uff0e\uff0f\uff1d]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .replace(/[“”]/g, '"');
  // 10⁶ → 10^6, m/s² → m/s^2
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (m) => '^' + [...m].map((c) => SUP[c]).join(''));
  s = s.replace(/\s*[×xX*]\s*10\s*\^\s*\(?(-?\d+)\)?/g, 'e$1');
  return s.replace(/[ \t]+/g, ' ').trim();
}

// Unit table: pattern → [dimension, factor to SI]. Longest patterns first.
const UNITS = [
  [/^(?:m\/s\^2|m\/s2|m·s\^-2|m\/秒\^2|米每二次方秒|米\/秒\^2)/, 'acceleration', 1],
  [/^(?:km\/h|千米每小时|千米\/时|公里每小时|公里\/小时)/, 'velocity', 1 / 3.6],
  [/^(?:m\/s|m·s\^-1|米每秒|米\/秒)/, 'velocity', 1],
  [/^(?:C\/kg|库\/千克)/, 'charge_mass', 1],
  [/^(?:mT)/, 'magnetic_field', 1e-3],
  [/^(?:T|特斯拉|特)(?![a-zA-Z])/, 'magnetic_field', 1],
  [/^(?:kV)/, 'voltage', 1e3],
  [/^(?:V|伏特|伏)(?![a-zA-Z])/, 'voltage', 1],
  [/^(?:N\/C|V\/m)/, 'electric_field', 1],
  [/^(?:kg|千克|公斤)/, 'mass', 1],
  [/^(?:g|克)(?![a-zA-Z])/, 'mass', 1e-3],
  [/^(?:km|千米|公里)/, 'length', 1e3],
  [/^(?:cm|厘米)/, 'length', 1e-2],
  [/^(?:mm|毫米)/, 'length', 1e-3],
  [/^(?:m|米)(?![a-zA-Z/])/, 'length', 1],
  [/^(?:min|分钟)/, 'time', 60],
  [/^(?:ms|毫秒)/, 'time', 1e-3],
  [/^(?:μs|us|微秒)/, 'time', 1e-6],
  [/^(?:s|秒)(?![a-zA-Z])/, 'time', 1],
  [/^(?:h|小时)(?![a-zA-Z])/, 'time', 3600],
  [/^(?:°|度)/, 'angle', Math.PI / 180],
  [/^(?:N|牛顿|牛)(?![a-zA-Z\/])/, 'force', 1],
  [/^(?:J|焦耳|焦)(?![a-zA-Z])/, 'energy', 1],
  [/^(?:C|库仑|库)(?![a-zA-Z\/])/, 'charge', 1],
];

const NUM = /(\d+(?:\.\d+)?)(?:e(-?\d+))?/y;

export function extractQuantities(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const prev = text[i - 1];
    if (/\d/.test(text[i]) && !(prev && /[\w.^_]/.test(prev) && !/[=＝]/.test(prev))) {
      NUM.lastIndex = i;
      const m = NUM.exec(text);
      if (m) {
        let j = NUM.lastIndex;
        while (text[j] === ' ') j++;
        const rest = text.slice(j);
        const unit = UNITS.find(([re]) => re.test(rest));
        if (unit) {
          const [re, dim, factor] = unit;
          const u = rest.match(re)[0];
          const value = parseFloat(m[1]) * 10 ** (m[2] ? parseInt(m[2], 10) : 0);
          const before = text.slice(Math.max(0, i - 18), i);
          const sym = before.match(/([a-zA-Zα-ωΔθ][a-zA-Z0-9_₀-₉]*)\s*=\s*$/);
          out.push({
            id: `q${out.length}`,
            raw: text.slice(i, j) + u,
            value,
            unit: u,
            dim,
            si: value * factor,
            symbol: sym ? sym[1] : null,
            index: i,
            context: text.slice(Math.max(0, i - 22), Math.min(text.length, j + u.length + 12)),
          });
          i = j + u.length;
          continue;
        }
        i = NUM.lastIndex;
        continue;
      }
    }
    i++;
  }
  return out;
}

export function splitQuestions(text) {
  const parts = text.split(/(?=[(（]\s*\d+\s*[)）]|[①②③④⑤])/);
  const stem = parts[0].trim();
  const questions = parts.slice(1).map((p) => p.trim()).filter(Boolean);
  return { stem, questions };
}

export function preprocess(rawText) {
  const text = normalize(rawText);
  const { stem, questions } = splitQuestions(text);
  return {
    text,
    stem,
    questions,
    quantities: extractQuantities(text),
    refersToFigure: /如图|图中|图示|见图/.test(text),
  };
}
