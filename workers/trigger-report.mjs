/**
 * Cloudflare Worker：从网页触发 GitHub Actions（绕过 CORS，真正一键）
 *
 * Secrets（Cloudflare 控制台 → Settings → Variables）：
 *   GITHUB_TOKEN  - GitHub PAT（Actions R/W + Contents R/W）
 *   TRIGGER_KEY   - 自设随机字符串（与网页 localStorage 一致）
 *   GITHUB_REPO   - 可选，默认 RiddleGo/lcai-portfolio
 */
const REPO = 'RiddleGo/lcai-portfolio';
const WORKFLOW = 'uzi-reports.yml';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405, headers: CORS });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS });
    }
    const { symbol, key, run_uzi = 'true', mode } = body || {};
    if (!key || key !== env.TRIGGER_KEY) {
      return Response.json({ error: 'Unauthorized or missing key' }, { status: 401, headers: CORS });
    }
    if (!env.GITHUB_TOKEN) {
      return Response.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500, headers: CORS });
    }

    const sym = symbol != null ? String(symbol).replace(/\D/g, '') : '';
    const weekly = mode === 'weekly' || mode === 'all' || sym === '' && mode !== 'single';
    if (!weekly && !sym) {
      return Response.json({ error: 'Missing symbol' }, { status: 400, headers: CORS });
    }

    const repo = env.GITHUB_REPO || REPO;
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`;
    const gh = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          symbol: weekly ? '' : sym,
          run_uzi: String(run_uzi),
        },
      }),
    });
    if (gh.status === 204) {
      return Response.json(
        { ok: true, message: weekly ? 'Weekly workflow dispatched' : 'Workflow dispatched', symbol: sym || 'all' },
        { headers: CORS },
      );
    }
    const text = await gh.text();
    return Response.json({ error: text || gh.statusText }, { status: gh.status, headers: CORS });
  },
};
