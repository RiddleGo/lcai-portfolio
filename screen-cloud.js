/**
 * 生成完整报告：傻瓜式引导 + 自动等待
 */
const ScreenCloud = (() => {
  const REPO = 'RiddleGo/lcai-portfolio';
  const POLL_MS = 15000;
  const POLL_MAX = 48;

  let pollTimer = null;
  let pollCount = 0;
  let currentSymbol = null;

  function el(id) {
    return document.getElementById(id);
  }

  function normalizeSymbol(input) {
    return ScreenWatchlist?.normalize?.(input) || String(input || '').replace(/\D/g, '');
  }

  function issueNewUrl(symbol) {
    const code = normalizeSymbol(symbol);
    const title = encodeURIComponent(`[report] ${code}`);
    const body = encodeURIComponent(`帮我生成 ${code} 的完整报告（网页自动触发，请勿修改标题）。`);
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

  async function fetchDualTrack(symbol) {
    const code = normalizeSymbol(symbol);
    const resp = await fetch(`reports/${code}/lcai-vs-uzi.json?t=${Date.now()}`);
    if (!resp.ok) throw new Error('not ready');
    return resp.json();
  }

  async function hasFullReport(symbol) {
    try {
      const data = await fetchDualTrack(symbol);
      return !!(data && (data.uzi_tone || data.generated_at));
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
    setStatus('正在帮你做完整报告，大约 5–10 分钟。你可以先干别的，本页会自动刷新。', 'pending');

    pollTimer = setInterval(async () => {
      pollCount += 1;
      try {
        const data = await fetchDualTrack(currentSymbol);
        const gen = data.generated_at ? new Date(data.generated_at).getTime() : 0;
        const isNew = !baselineTime || gen > baselineTime;
        if (isNew && data.lcai_verdict) {
          window.ScreenUI?.renderDualTrack?.(data);
          updateReportCta(currentSymbol, data);
        }
        if (isNew && data.uzi_tone) {
          setStatus('好了！完整报告已经出来了，往下看就行。', 'ok');
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

    const hasUzi = data && data.uzi_tone;
    const code = normalizeSymbol(symbol);
    box.hidden = false;

    if (hasUzi) {
      if (text) text.innerHTML = '<p class="cta-ok">✅ 完整报告已就绪，可直接打开查看。</p>';
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
        btnOpen.onclick = () => window.open(`reports/${code}/index.html`, '_blank');
      }
      return;
    }

    if (text) {
      text.innerHTML = `
        <p class="cta-title">📄 完整版报告还没做好</p>
        <p class="cta-steps">点下面按钮 → 新页面再点一次绿色 <strong>Submit</strong> → 回到本页等着（约 5–10 分钟）。<br>收藏后<strong>每周一自动更新</strong>，以后不用重复操作。</p>`;
    }
    if (btnGen) {
      btnGen.hidden = false;
      btnGen.textContent = '⭐ 收藏并生成完整报告';
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
      const prev = await fetchDualTrack(code);
      baselineTime = prev.generated_at ? new Date(prev.generated_at).getTime() : Date.now() - 1;
      if (prev.uzi_tone) {
        setStatus('完整报告已经有了，直接往下看。', 'ok');
        updateReportCta(code, prev);
        return;
      }
    } catch (_) { /* first time */ }

    window.open(issueNewUrl(code), '_blank', 'noopener');
    setStatus('第 1 步完成：请在新页面点绿色 Submit。第 2 步：回到本页等着，会自动出结果。', 'pending');
    startPolling(code, baselineTime);
  }

  async function checkAndShowCta(symbol, name) {
    const code = normalizeSymbol(symbol);
    try {
      const data = await fetchDualTrack(code);
      updateReportCta(code, data);
      if (!data.uzi_tone) {
        setStatus('', 'info');
      }
    } catch {
      updateReportCta(code, null);
    }
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
  };
})();
