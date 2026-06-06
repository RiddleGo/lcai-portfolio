/**
 * 网页触发云端研报：Worker 一键 / GitHub Actions 手动 + 轮询
 */
const ScreenCloud = (() => {
  const STORAGE_KEY = 'lcai-cloud-config';
  const REPO = 'RiddleGo/lcai-portfolio';
  const WORKFLOW = 'uzi-reports.yml';
  const ACTIONS_URL = `https://github.com/${REPO}/actions/workflows/${WORKFLOW}`;
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

  function setCloudStatus(msg, type = 'info') {
    const box = el('cloud-status');
    if (!box) return;
    box.hidden = false;
    box.textContent = msg;
    box.dataset.type = type;
  }

  function clearCloudStatus() {
    const box = el('cloud-status');
    if (box) box.hidden = true;
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
    setCloudStatus(`云端生成中… 每 ${POLL_MS / 1000}s 检查一次（约 3–10 分钟）`, 'pending');

    pollTimer = setInterval(async () => {
      pollCount += 1;
      try {
        const data = await fetchDualTrack(symbol);
        const gen = data.generated_at ? new Date(data.generated_at).getTime() : 0;
        const isNew = !baselineTime || gen > baselineTime;
        if (isNew && data.lcai_verdict) {
          window.ScreenUI?.renderDualTrack?.(data);
        }
        if (isNew && data.uzi_tone) {
          setCloudStatus(`研报已更新（${data.generated_at || ''}）`, 'ok');
          stopPolling();
          return;
        }
        if (isNew && data.lcai_verdict) {
          setCloudStatus('LCAI 缓存已更新，UZI 深度报告生成中…', 'pending');
        }
      } catch (_) { /* keep polling */ }

      if (pollCount >= POLL_MAX) {
        setCloudStatus('轮询超时。请到 GitHub Actions 查看是否失败，或稍后刷新页面。', 'warn');
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

  async function copyWorkflowHint(symbol) {
    const code = normalizeSymbol(symbol);
    const text = `symbol: ${code}\nrun_uzi: true`;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
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
      setCloudStatus('正在请求云端 Worker 触发 Actions…', 'pending');
      try {
        await triggerViaWorker(code, cfg);
        setCloudStatus('已触发 GitHub Actions，等待研报…', 'pending');
        startPolling(code, baselineTime);
        return;
      } catch (e) {
        setCloudStatus(`Worker 失败：${e.message}。将改为打开 GitHub Actions。`, 'warn');
      }
    }

    const copied = await copyWorkflowHint(code);
    window.open(ACTIONS_URL, '_blank', 'noopener');
    setCloudStatus(
      copied
        ? `已打开 GitHub Actions，参数已复制到剪贴板（symbol=${code}，run_uzi=true）。点 Run workflow 粘贴后确认，本页将自动轮询。`
        : `已打开 GitHub Actions。Run workflow 时填入 symbol=${code}、run_uzi=true，本页将自动轮询。`,
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
      setCloudStatus('云端设置已保存（仅本浏览器）', 'ok');
    });
  }

  function init() {
    el('btn-cloud-report')?.addEventListener('click', () => triggerCloudReport());
    initSettings();
  }

  return { init, triggerCloudReport, stopPolling, normalizeSymbol };
})();
