/**
 * 补全深度分析：Issue 触发 + 自动等待 unified.json
 */
const ScreenCloud = (() => {
  const REPO = 'RiddleGo/lcai-portfolio';
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
    const body = encodeURIComponent(`帮我补全 ${code} 的深度分析（网页自动触发，请勿修改标题）。`);
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

  async function fetchUnified(symbol) {
    const code = normalizeSymbol(symbol);
    const resp = await fetch(lcaiAsset(`reports/${code}/unified.json?t=${Date.now()}`));
    if (!resp.ok) throw new Error('not ready');
    return resp.json();
  }

  async function hasFullReport(symbol) {
    try {
      const data = await fetchUnified(symbol);
      return !!(data && data.uzi && data.uzi.ready);
    } catch {
      return false;
    }
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    pollCount = 0;
    ['btn-favorite-generate', 'btn-open-full-report'].forEach(id => {
      const b = el(id);
      if (b) b.disabled = false;
    });
  }

  function startPolling(symbol, baselineTime) {
    stopPolling();
    currentSymbol = normalizeSymbol(symbol);
    pollCount = 0;
    setStatus('正在补全深度分析，大约 5–10 分钟。你可以先干别的，本页会自动刷新。', 'pending');

    pollTimer = setInterval(async () => {
      pollCount += 1;
      try {
        const data = await fetchUnified(currentSymbol);
        const gen = data.generated_at ? new Date(data.generated_at).getTime() : 0;
        const isNew = !baselineTime || gen > baselineTime;
        if (isNew && data.verdict?.value) {
          updateReportCta(currentSymbol, data);
          if (lastLiveReport && ScreenUnified?.applyMerged) {
            ScreenUnified.applyMerged(ScreenUnified.mergeLiveWithCache(lastLiveReport, data));
          }
        }
        if (isNew && data.uzi?.ready) {
          setStatus('好了！深度分析已并入下方综合研判。', 'ok');
          stopPolling();
        }
      } catch (_) { /* wait */ }

      if (pollCount >= POLL_MAX) {
        setStatus('等得有点久了。若 GitHub 新页面还没点绿色按钮，请去点一下；点过了就稍后再打开本页。', 'warn');
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

    const hasUzi = data && data.uzi && data.uzi.ready;
    const code = normalizeSymbol(symbol);
    box.hidden = false;

    if (hasUzi) {
      if (text) text.innerHTML = '<p class="cta-ok">✅ 深度分析已就绪，已并入下方综合研判。</p>';
      if (btnGen) {
        btnGen.hidden = false;
        btnGen.textContent = '⭐ 已收藏（每周自动更新）';
        btnGen.onclick = () => {
          ScreenWatchlist?.add?.(code, data.name);
          setStatus('已加入「我的关注」，每周一会自动更新。', 'ok');
        };
      }
      if (btnOpen) {
        btnOpen.hidden = false;
        btnOpen.onclick = () => window.open(data.uzi.report_url || `reports/${code}/index.html`, '_blank');
      }
      return;
    }

    if (text) {
      text.innerHTML = `
        <p class="cta-title">📄 深度分析还没做好</p>
        <p class="cta-steps">点下面按钮 → 新页面再点一次绿色 <strong>Submit</strong> → 回到本页等着（约 5–10 分钟）。<br>收藏后<strong>每周一自动更新</strong> LCAI 研判；完整 UZI 深度需此步骤一次。</p>`;
    }
    if (btnGen) {
      btnGen.hidden = false;
      btnGen.textContent = '⭐ 收藏并补全深度分析';
      btnGen.onclick = () => requestFullReport(symbol, data?.name);
    }
    if (btnOpen) btnOpen.hidden = true;
  }

  async function requestFullReport(symbol, name) {
    const code = normalizeSymbol(symbol);
    if (!code) {
      setStatus('请先输入股票代码', 'warn');
      return;
    }

    ScreenWatchlist?.add?.(code, name);

    let baselineTime = Date.now() - 1;
    try {
      const prev = await fetchUnified(code);
      baselineTime = prev.generated_at ? new Date(prev.generated_at).getTime() : Date.now() - 1;
      if (prev.uzi?.ready) {
        setStatus('深度分析已经有了，直接往下看。', 'ok');
        updateReportCta(code, prev);
        if (lastLiveReport && ScreenUnified?.applyMerged) {
          ScreenUnified.applyMerged(ScreenUnified.mergeLiveWithCache(lastLiveReport, prev));
        }
        return;
      }
    } catch (_) { /* first time */ }

    window.open(issueNewUrl(code), '_blank', 'noopener');
    setStatus('第 1 步完成：请在新页面点绿色 Submit。第 2 步：回到本页等着，会自动补全。', 'pending');
    startPolling(code, baselineTime);
  }

  async function checkAndShowCta(symbol, name) {
    const code = normalizeSymbol(symbol);
    try {
      const data = await fetchUnified(code);
      updateReportCta(code, data);
      if (!data.uzi?.ready) {
        setStatus('', 'info');
      }
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
    stopPolling,
    normalizeSymbol,
    setLiveReport,
    fetchUnified,
  };
})();
