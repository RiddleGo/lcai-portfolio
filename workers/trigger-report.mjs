/**
 * Cloudflare Worker：从网页触发 GitHub Actions 生成研报（绕过浏览器 CORS）
 *
 * 部署后设置环境变量：
 *   GITHUB_TOKEN  - fine-grained PAT，权限：Actions R/W + Contents R/W
 *   TRIGGER_KEY   - 自定义密钥，与网页 localStorage 中一致
 *   GITHUB_REPO   - 默认 RiddleGo/lcai-portfolio
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
    const { symbol, key, run_uzi = 'true' } = body || {};
    if (!symbol || !key || key !== env.TRIGGER_KEY) {
      return Response.json({ error: 'Unauthorized or missing symbol' }, { status: 401, headers: CORS });
    }
    if (!env.GITHUB_TOKEN) {
      return Response.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500, headers: CORS });
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
        inputs: { symbol: String(symbol).replace(/\D/g, ''), run_uzi: String(run_uzi) },
      }),
    });
    if (gh.status === 204) {
      return Response.json({ ok: true, message: 'Workflow dispatched' }, { headers: CORS });
    }
    const text = await gh.text();
    return Response.json({ error: text || gh.statusText }, { status: gh.status, headers: CORS });
  },
};
