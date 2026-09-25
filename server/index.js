// Classroom server: hosts the built web app and the solve API.
// API keys are read from the environment and never sent to the browser.
//   TYPESAFE_API_KEY   Jev (first gate). Without it the local stand-in is used.
//   JEV_MODEL          default jev-1.13.0 (pinned so thresholds stay calibrated)
//   LLM_API_KEY, LLM_MODEL, LLM_BASE_URL   optional OpenAI-compatible fallback
//   PORT               default 8787

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../src/engine/pipeline.js';
import { makeGate, makeFallback } from './providers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const logDir = path.join(root, 'server', 'logs');
const env = process.env;
const PORT = +(env.PORT || 8787);
const MODEL = env.JEV_MODEL || 'jev-1.13.0';
const gate = makeGate(env);
const fallback = makeFallback(env);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const hits = new Map();
function rateLimited(ip, limit = +(env.RATE_PER_MIN || 30)) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > limit;
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, max = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { reject(new Error('题目太长')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function logSolve(entry) {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFile(path.join(logDir, 'solves.jsonl'), JSON.stringify(entry) + '\n', () => {});
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, jev: !!env.TYPESAFE_API_KEY, model: env.TYPESAFE_API_KEY ? MODEL : 'local-mock', llm: !!fallback });
  }
  if (url.pathname === '/api/solve' && req.method === 'POST') {
    const ip = req.socket.remoteAddress;
    if (rateLimited(ip)) return send(res, 429, { error: '请求太频繁，请稍后再试' });
    try {
      const { text } = JSON.parse(await readBody(req));
      const result = await runPipeline(text, { gate, fallback, model: MODEL });
      logSolve({ at: new Date().toISOString(), ip, text, route: result.route, template: result.template, confidence: result.confidence, model: result.model, reasons: result.reasons });
      return send(res, 200, result);
    } catch (e) {
      return send(res, 400, { error: String(e.message || e) });
    }
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  const file = path.normalize(path.join(dist, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(dist)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log(`情境化解题服务已启动：http://localhost:${PORT}`);
  console.log(`  判断引擎：${env.TYPESAFE_API_KEY ? `Jev (${MODEL})` : '本地模拟（未设置 TYPESAFE_API_KEY）'}`);
  console.log(`  大模型兜底：${fallback ? env.LLM_MODEL : '未配置'}`);
});
