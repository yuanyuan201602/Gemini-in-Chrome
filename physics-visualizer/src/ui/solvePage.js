import { runPipeline } from '../engine/pipeline.js';
import { mockGate } from '../engine/gate/mock.js';
import { SAMPLES } from '../engine/samples.js';
import { escapeHtml, num } from '../engine/format.js';

const $ = (id) => document.getElementById(id);

async function fetchJson(url, opts = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Server first (real Jev + optional LLM, keys stay on the server); if there is no server
// (e.g. the offline single-file build), the same pipeline runs in the browser with the
// local stand-in gate.
async function solve(text, serverOk) {
  if (serverOk && location.protocol.startsWith('http')) {
    try {
      return { result: await fetchJson('/api/solve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }), where: 'server' };
    } catch { /* fall through to local */ }
  }
  return { result: await runPipeline(text, { gate: async (req, pre) => mockGate(req, pre) }), where: 'browser' };
}

const ROUTE_TEXT = {
  template: ['模板动画', 'template'],
  llm: ['文字讲解（兜底）', 'llm'],
  review: ['需老师审核', 'review'],
  reject: ['无法处理', 'review'],
};

function confBar(p) {
  return `<span class="conf"><i style="width:${Math.round((p ?? 0) * 100)}%"></i></span> ${num((p ?? 0) * 100, 0)}%`;
}

function renderResult(r, where) {
  $('solve-result').hidden = false;
  const [txt, cls] = ROUTE_TEXT[r.route] || ROUTE_TEXT.review;
  const badge = $('route-badge');
  badge.textContent = txt;
  badge.className = `badge ${cls}`;
  const total = r.trace.reduce((s, t) => s + t.ms, 0);
  const engine = r.model ? (r.model.startsWith('local-mock') ? `本地模拟判断${r.model.length > 10 ? r.model.slice(10) : ''}` : r.model) : '—';
  $('result-summary').innerHTML = r.templateZh
    ? `识别为「<b>${escapeHtml(r.templateZh)}</b>」 ${confBar(r.confidence)} · 判断引擎 ${escapeHtml(engine)} · ${total} ms${where === 'browser' ? ' · 浏览器离线运行' : ''}`
    : escapeHtml((r.reasons || []).join('；'));
  $('btn-launch').hidden = !r.steps?.length;

  let html = '';
  if (r.assignments?.length) {
    html += '<table class="kv"><tbody>';
    for (const a of r.assignments) html += `<tr><td>${escapeHtml(a.raw)}</td><td>${escapeHtml(a.roleZh)} ${a.role === 'other' ? '' : confBar(a.confidence)}</td></tr>`;
    html += '</tbody></table>';
  }
  if (r.checks?.length) html += `<div class="checks">自检：${r.checks.map((c) => `${c.ok ? '✓' : '✗'} ${escapeHtml(c.name)}`).join('　')}</div>`;
  if (r.route !== 'template' && r.reasons?.length) {
    html += `<div>未走模板动画的原因：</div><ul class="reasons">${r.reasons.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
  }
  if (r.route === 'review') html += '<div class="solve-msg">这道题暂时没有对应的动画模板，也未配置大模型兜底，已记录，等待老师审核补充。</div>';
  if (r.route === 'llm') html += `<div class="solve-msg">由大模型（${escapeHtml(r.fallbackModel || '')}）生成文字讲解，未经模板校验，请老师留意。</div>`;
  $('result-body').innerHTML = html;

  const list = $('trace-list');
  list.innerHTML = '';
  for (const t of r.trace) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${escapeHtml(t.label)}</b><span class="ms">${t.ms} ms</span>${t.status === 'error' ? ' <span style="color:#ff8a8a">失败</span>' : ''}`;
    if (t.detail !== undefined) {
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(t.detail, null, 2);
      li.appendChild(pre);
    }
    if (t.key === 'gate' && r.gate) {
      for (const [name, obj] of [['发给 Jev 的请求', r.gate.request], ['Jev 的回答', r.gate.answers]]) {
        const d = document.createElement('details');
        d.innerHTML = `<summary>${name}</summary>`;
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(obj, null, 2);
        d.appendChild(pre);
        li.appendChild(d);
      }
    }
    list.appendChild(li);
  }
}

export function initSolvePage({ onLaunch }) {
  let serverOk = false;
  let last = null;
  const status = $('engine-status');
  const setStatus = (text, cls) => { status.textContent = text; status.className = `engine-status ${cls}`; };

  if (location.protocol.startsWith('http')) {
    fetchJson('/api/health', {}, 4000)
      .then((h) => {
        serverOk = true;
        if (h.jev) setStatus(`Jev 判断引擎在线 · ${h.model}${h.llm ? ' · 大模型兜底已配置' : ''}`, 'live');
        else setStatus(`服务器在线 · 未配置 Jev 密钥，使用本地模拟判断${h.llm ? ' · 大模型兜底已配置' : ''}`, 'mock');
      })
      .catch(() => setStatus('离线模式 · 浏览器内本地模拟判断', 'mock'));
  } else {
    setStatus('离线模式 · 浏览器内本地模拟判断', 'mock');
  }

  const input = $('problem-input');
  SAMPLES.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = s.title;
    b.onclick = () => { input.value = s.text; input.focus(); };
    $('sample-list').appendChild(b);
  });

  $('btn-solve').onclick = async () => {
    const text = input.value.trim();
    if (!text) { $('solve-msg').textContent = '请先输入题目'; return; }
    $('btn-solve').disabled = true;
    $('solve-msg').textContent = '正在分析题目…';
    try {
      const { result, where } = await solve(text, serverOk);
      last = result;
      $('solve-msg').textContent = '';
      renderResult(result, where);
    } catch (e) {
      $('solve-msg').textContent = `出错了：${e.message || e}`;
    } finally {
      $('btn-solve').disabled = false;
    }
  };
  $('btn-launch').onclick = () => last && onLaunch(last);
}
