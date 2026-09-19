// Streaming front door for agent-action (2026-09-18, finish-line M2b).
//
// Netlify's gateway drops any response that stays silent for 30 seconds (a 504
// "Inactivity Timeout"), while the function itself keeps running and finishes.
// On Opus 5 the long-answer actions (muse_ig_ideas, scrappy_hook_analysis) take
// 30-50 s, so the team saw an error for work that succeeded. This wrapper runs
// the SAME handler, unchanged, and keeps the line warm: one space every few
// seconds, then the real JSON. Leading whitespace is valid JSON, so res.json()
// on the client parses it as before. Streamed functions get 60 s.
//
// The HTTP status is sent before the work finishes, so a non-200 outcome rides
// in the body as `__status` and services/apiFetch.js restores it. Rollback is
// one line: point /api/agent-action back at agent-action in netlify.toml.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handler } = require('./agent-action.js');
const { cors: makeCors } = require('./_lib/requireUser.js');

const HEARTBEAT_MS = 5000;

export default async (req) => {
  const event = {
    httpMethod: req.method,
    headers: Object.fromEntries(req.headers),
    body: req.method === 'POST' ? await req.text() : '',
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
  };

  // Preflight and wrong-method answers are instant: no stream needed.
  if (req.method !== 'POST') {
    const r = await handler(event);
    return new Response(r.body || '', { status: r.statusCode, headers: r.headers });
  }

  const encoder = new TextEncoder();
  const work = handler(event).then(
    (r) => r,
    (err) => ({ statusCode: 500, headers: {}, body: JSON.stringify({ error: String(err?.message || err) }) }),
  );
  // Fast answers (auth failures, rate limits, quick actions) keep their real
  // status: only switch to streaming once the work has outlived one heartbeat.
  const first = await Promise.race([work, new Promise((res) => setTimeout(() => res(null), HEARTBEAT_MS))]);
  if (first) return new Response(first.body || '', { status: first.statusCode, headers: first.headers });

  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(' '));
      const timer = setInterval(() => { try { controller.enqueue(encoder.encode(' ')); } catch { clearInterval(timer); } }, HEARTBEAT_MS);
      work.then((r) => {
        clearInterval(timer);
        let out = r.body || '{}';
        if (r.statusCode !== 200) {
          let parsed; try { parsed = JSON.parse(out); } catch { parsed = { error: out }; }
          out = JSON.stringify({ ...parsed, __status: r.statusCode });
        }
        controller.enqueue(encoder.encode(out));
        controller.close();
      });
    },
  });
  // CORS headers go out with the first byte, before the handler has answered,
  // so they come from the same allowlist helper the handler itself uses.
  const cors = makeCors(event);
  return new Response(body, { status: 200, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
