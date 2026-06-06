/**
 * 网页触发云端研报：
 * 1. 默认：打开 GitHub Issue（提交即可触发 Actions，无需 PAT）
 * 2. 可选：Cloudflare Worker 一键触发
 */
const ScreenCloud = (() => {
  const STORAGE_KEY = 'lcai-cloud-config';
  const REPO = 'RiddleGo/lcai-portfolio';
  const POLL_MS = 15000;
  const POLL_MAX = 40;

  let pollTimer = null;
  let pollCount = 0;

  function el(id) {
    return document.getElementById(id);
  }

  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function normalizeSymbol(input) {
    const sym = String(input || '').replace(/\D/g, '');
    if (sym.length === 5) return sym.padStart(5, '0');
    if (sym.length >= 6) return sym.slice(-6).padStart(6, '0');
    return sym;
  }

  function issueNewUrl(symbol) {
    const code = normalizeSymbol(symbol);
    const title = encodeURIComponent(`[report] ${code}`);
    const body = encodeURIComponent(
      `由资产总览网页触发。\n\nsymbol: ${code}\nrun_uzi: true\n\n提交后 Actions 会自动生成 reports/${code}/ 并关闭本 Issue。`
    );
    return `https://github.com/${REPO}/issues/new?title=${title}&body=${body}`;
  }

  function setCloudStatus(msg, type = 'info') {
    const box = el('cloud-status');
    if (!box) return;
    box.hidden = false;
    box.textContent = msg;
    box.dataset.type = type;
  }

  async function fetchDualTrack(symbol) {
    const code = normalizeSymbol(symbol);
    const resp = await fetch(`reports/${code}/lcai-vs-uzi.json?t=${Date.now()}`);
    if (!resp.ok) throw new Error('not ready');
    return resp.json();
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    pollCount = 0;
    const btn = el('btn-cloud-report');
    if (btn) btn.disabled = false;
  }

  function startPolling(symbol, baselineTime) {
    stopPolling();
    const btn = el('btn-cloud-report');
    if (btn) btn.disabled = true;
    pollCount = 0;
    setCloudStatus(`等待云端生成… 每 ${POLL_MS / 1000}s 自动刷新（约 3–10 分钟）`, 'pending');

    pollTimer = setInterval(async () => {
      pollCount += 1;
      try {
        const data = await fetchDualTrack(symbol);
        const gen = data.generated_at ? new Date(data.generated_at).getTime() : 0;
        const isNew = !baselineTime || gen > baselineTime;
        if (isNew && data.lcai_verdict) {
          window.ScreenUI?.renderDualTrack?.(data);
        }
        if (isNew && (data.uzi_tone || (data.report_url && gen > baselineTime + 60000))) {
          setCloudStatus(`研报已更新（${data.generated_at || ''}）`, 'ok');
          stopPolling();
          return;
        }
        if (isNew && data.lcai_verdict && !data.uzi_tone) {
          setCloudStatus('LCAI 已更新，UZI 深度报告仍在生成…', 'pending');
        }
      } catch (_) { /* keep polling */ }

      if (pollCount >= POLL_MAX) {
        setCloudStatus('轮询超时。请确认 GitHub Issue 已提交，或在 Actions 页查看进度。', 'warn');
        stopPolling();
      }
    }, POLL_MS);
  }

  async function triggerViaWorker(symbol, cfg) {
    const resp = await fetch(cfg.triggerUrl.replace(/\/$/, ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: normalizeSymbol(symbol), key: cfg.triggerKey, run_uzi: 'true' }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || resp.statusText || 'Worker 触发失败');
    return data;
  }

  async function triggerCloudReport(symbol) {
    const input = symbol || el('symbol-input')?.value?.trim();
    if (!input) {
      setCloudStatus('请先输入股票代码', 'warn');
      return;
    }
    const code = normalizeSymbol(input);
    const cfg = loadConfig();
    let baselineTime = 0;
    try {
      const prev = await fetchDualTrack(code);
      baselineTime = prev.generated_at ? new Date(prev.generated_at).getTime() : Date.now();
    } catch {
      baselineTime = Date.now() - 1;
    }

    if (cfg.triggerUrl && cfg.triggerKey) {
      setCloudStatus('正在通过 Worker 触发…', 'pending');
      try {
        await triggerViaWorker(code, cfg);
        setCloudStatus('已触发 Actions，等待研报…', 'pending');
        startPolling(code, baselineTime);
        return;
      } catch (e) {
        setCloudStatus(`Worker 失败：${e.message}，改用 Issue 方式。`, 'warn');
      }
    }

    window.open(issueNewUrl(code), '_blank', 'noopener');
    setCloudStatus(
      `已打开 GitHub Issue（标题 [report] ${code}）。登录 GitHub 后点绿色「Submit new issue」，本页将自动轮询更新。无需 PAT。`,
      'pending'
    );
    startPolling(code, baselineTime);
  }

  function initSettings() {
    const cfg = loadConfig();
    const urlInput = el('cloud-trigger-url');
    const keyInput = el('cloud-trigger-key');
    if (urlInput) urlInput.value = cfg.triggerUrl || '';
    if (keyInput) keyInput.value = cfg.triggerKey || '';

    el('btn-save-cloud-config')?.addEventListener('click', () => {
      saveConfig({
        triggerUrl: urlInput?.value?.trim() || '',
        triggerKey: keyInput?.value?.trim() || '',
      });
      setCloudStatus('高级设置已保存（仅本浏览器）', 'ok');
    });
  }

  function init() {
    el('btn-cloud-report')?.addEventListener('click', () => triggerCloudReport());
    initSettings();
  }

  return { init, triggerCloudReport, stopPolling, normalizeSymbol, issueNewUrl };
})();
