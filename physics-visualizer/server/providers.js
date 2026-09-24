import { callJev } from '../src/engine/gate/jev.js';
import { mockGate } from '../src/engine/gate/mock.js';

// Gate: real Jev when TYPESAFE_API_KEY is set. If the call fails (network, quota), the
// local stand-in answers instead so a lesson is never blocked; the trace shows which ran.
export function makeGate(env) {
  const apiKey = env.TYPESAFE_API_KEY;
  if (!apiKey) return async (req, pre) => mockGate(req, pre);
  return async (req, pre) => {
    try {
      return await callJev(req, { apiKey, url: env.TYPESAFE_API_URL || undefined, timeoutMs: +(env.JEV_TIMEOUT_MS || 8000) });
    } catch (e) {
      const r = mockGate(req, pre);
      r.model = `local-mock（Jev 调用失败：${String(e.message || e).slice(0, 120)}）`;
      return r;
    }
  };
}

const SYSTEM = `你是高中物理老师。把题目讲解成 4~8 个步骤，面向学生，语言口语化。
只输出 JSON：{"steps":[{"title":"步骤标题","say":"旁白（2~4 句）","math":[{"tex":"LaTeX 公式（可省略）","text":"说明（可省略）","cls":"result 表示最终答案（可省略）"}]}]}
公式里的中文放进 \\text{}。每个数值结果都要写出代入过程。最后一步是方法总结。`;

// Fallback: any OpenAI-compatible chat endpoint (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL).
export function makeFallback(env) {
  const key = env.LLM_API_KEY, model = env.LLM_MODEL;
  if (!key || !model) return null;
  const base = (env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  return async ({ text, decision }) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), +(env.LLM_TIMEOUT_MS || 60000));
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `题型初判：${decision.templateZh}\n题目：${text}` },
          ],
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      const steps = (parsed.steps || []).map((s, i) => ({
        mark: 'text', title: String(s.title || `第 ${i + 1} 步`), say: String(s.say || ''),
        math: (s.math || []).map((m) => ({ tex: m.tex, text: m.text, cls: m.cls })), t0: 0, t1: 0,
      }));
      return { model, steps };
    } finally {
      clearTimeout(timer);
    }
  };
}
