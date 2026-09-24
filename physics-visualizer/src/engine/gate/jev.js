// Real Jev client (TypeSafe AI System One API). Server-side only: the API key never
// reaches the browser.

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';

export async function callJev(request, { apiKey, url = JEV_URL, timeoutMs = 8000 } = {}) {
  if (!apiKey) throw new Error('TYPESAFE_API_KEY 未配置');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Jev HTTP ${res.status}: ${body.slice(0, 300)}`);
    const data = JSON.parse(body);
    if (!data.answers) throw new Error('Jev 返回缺少 answers');
    return data;
  } finally {
    clearTimeout(timer);
  }
}
