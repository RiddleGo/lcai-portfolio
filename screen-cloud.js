/**
 * 关注与深度分析：云端关注每周自动跑；新票首次收藏需一次 Issue 入队
 */
const ScreenCloud = (() => {
  const REPO = 'RiddleGo/lcai-portfolio';
  const ACTIONS_URL = `https://github.com/${REPO}/actions/workflows/uzi-reports.yml`;
  const POLL_MS = 15000;
  const POLL_MAX = 48;

  let pollTimer = null;
  let pollCount = 0;
  let currentSymbol = null;
  let lastLiveReport = null;

  function el(id) {
    return document.getElementById(id);
  }

  function normalizeSymbol(input) {
    return ScreenWatchlist?.normalize?.(input) || String(input || '').replace(/\D/g, '');
  }

  function issueNewUrl(symbol) {
    const code = normalizeSymbol(symbol);
    const title = encodeURIComponent(`[report] ${code}`);
    const body = encodeURIComponent(
      `请为 ${code} 生成深度分析并加入云端关注（网页自动触发，请勿修改标题）。`
    );
    return `https://github.com/${REPO}/issues/new?title=${title}&body=${body}`;
  }

  function setStatus(msg, type = 'info') {
    const box = el('cloud-status');
    if (!box) return;
    box.hidden = !msg;
    if (msg) {
      box.textContent = msg;
      box.dataset.type = type;
    }
  }

  function hasUnifiedDepth(data) {
    return !!(data && data.verdict?.value && Array.isArray(data.layers) && data.layers.length >= 4);
  }

  function hasUziLayer(data) {
    return !!(data && data.uzi && data.uzi.ready);
  }

  function needsCloudEnqueue(code, data) {
    return !ScreenWatchlist?.isInCloud?.(code) && !hasUnifiedDepth(data);
  }

  async function fetchUnified(symbol) {
    const code = normalizeSymbol(symbol);
    const resp = await fetch(lcaiAsset(`reports/${code}/unified.json?t=${Date.now()}`));
    if (!resp.ok) throw new Error('not ready');
    return resp.json();
  }

  async function hasFullReport(symbol) {
    try {
      const data = await fetchUnified(symbol);
      return hasUnifiedDepth(data);
    } catch {
      return false;
    }
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    pollCount = 0;
    const btn = el('btn-favorite-generate');
    if (btn) btn.disabled = false;
  }

  function startPolling(symbol, baselineTime) {
    stopPolling();
    currentSymbol = normalizeSymbol(symbol);
    pollCount = 0;
    setStatus('正在生成深度分析，大约 5–10 分钟。你可以先干别的，本页会自动刷新。', 'pending');

    pollTimer = setInterval(async () => {
      pollCount += 1;
      try {
        const data = await fetchUnified(currentSymbol);
        const gen = data.generated_at ? new Date(data.generated_at).getTime() : 0;
        const isNew = !baselineTime || gen > baselineTime;
        if (isNew && hasUnifiedDepth(data)) {
          updateReportCta(currentSymbol, data);
          if (lastLiveReport && ScreenUnified?.applyMerged) {
            ScreenUnified.applyMerged(ScreenUnified.mergeLiveWithCache(lastLiveReport, data));
          }
          setStatus('好了！深度分析已就绪，以后每周一自动更新。', 'ok');
          stopPolling();
        }
      } catch (_) { /* wait */ }

      if (pollCount >= POLL_MAX) {
        setStatus('等得有点久了。若 GitHub 新页面还没点绿色 Submit，请去点一下；点过了就稍后再打开本页。', 'warn');
        stopPolling();
      }
    }, POLL_MS);
  }

  function updateReportCta(symbol, data) {
    const box = el('report-cta');
    const text = el('report-cta-text');
    const btnGen = el('btn-favorite-generate');
    const btnOpen = el('btn-open-full-report');
    if (!box) return;

    const code = normalizeSymbol(symbol);
    const unified = hasUnifiedDepth(data);
    const uzi = hasUziLayer(data);
    const inCloud = ScreenWatchlist?.isInCloud?.(code);
    box.hidden = false;

    if (btnGen) {
      btnGen.hidden = false;
      btnGen.disabled = false;
      if (inCloud || unified) {
        btnGen.textContent = '⭐ 已收藏（每周自动更新）';
      } else {
        btnGen.textContent = '⭐ 收藏并加入云端队列';
      }
      btnGen.onclick = () => favoriteSymbol(code, data?.name);
    }

    if (unified) {
      const uziNote = uzi
        ? 'UZI 价值派材料已并入下方解读。'
        : 'LCAI 综合研判已就绪；UZI 价值派层将在<strong>每周一</strong>自动补全。';
      if (text) {
        text.innerHTML = `<p class="cta-ok">✅ 深度研判已就绪</p><p class="cta-steps">${uziNote}</p>`;
      }
    } else if (text) {
      text.innerHTML = `
        <p class="cta-title">📄 新票还没有云端缓存</p>
        <p class="cta-steps">点「收藏并加入云端队列」→ 新页面点绿色 <strong>Submit</strong>（<strong>仅首次</strong>）→ 回到本页等着（约 5–10 分钟）。<br>之后每周一自动更新，不用再开 Issue。</p>`;
    }

    if (btnOpen) {
      if (unified) {
        btnOpen.hidden = false;
        btnOpen.textContent = uzi ? '查看 UZI 完整 HTML' : '查看完整研报';
        btnOpen.onclick = () => window.open(lcaiAsset(`reports/${code}/index.html`), '_blank');
      } else {
        btnOpen.hidden = true;
      }
    }
  }

  async function favoriteSymbol(code, name) {
    const sym = normalizeSymbol(code);
    if (!sym) {
      setStatus('请先输入股票代码', 'warn');
      return;
    }

    ScreenWatchlist?.add?.(sym, name);

    let data = null;
    let baselineTime = Date.now() - 1;
    try {
      data = await fetchUnified(sym);
      baselineTime = data.generated_at ? new Date(data.generated_at).getTime() : Date.now() - 1;
    } catch (_) { /* no cache yet */ }

    if (ScreenWatchlist?.isInCloud?.(sym) || hasUnifiedDepth(data)) {
      setStatus('已在云端关注列表，每周一自动更新深度分析。', 'ok');
      updateReportCta(sym, data);
      return;
    }

    window.open(issueNewUrl(sym), '_blank', 'noopener');
    setStatus('第 1 步：请在新页面点绿色 Submit。第 2 步：回到本页等着，会自动补全。', 'pending');
    startPolling(sym, baselineTime);
  }

  async function requestFullReport(symbol, name) {
    await favoriteSymbol(normalizeSymbol(symbol), name);
  }

  async function checkAndShowCta(symbol, name) {
    const code = normalizeSymbol(symbol);
    try {
      const data = await fetchUnified(code);
      updateReportCta(code, data);
    } catch {
      updateReportCta(code, null);
    }
  }

  function setLiveReport(report) {
    lastLiveReport = report;
  }

  function init() {
    el('btn-favorite-generate')?.addEventListener('click', () => {
      const sym = el('symbol-input')?.value?.trim() || currentSymbol;
      const name = el('stock-title')?.textContent?.split('(')[0]?.trim();
      requestFullReport(sym, name);
    });
  }

  return {
    init,
    requestFullReport,
    checkAndShowCta,
    hasFullReport,
    normalizeSymbol,
    setLiveReport,
    fetchUnified,
    actionsUrl: ACTIONS_URL,
    needsCloudEnqueue,
  };
})();
