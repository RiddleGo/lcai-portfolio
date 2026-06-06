/**
 * 关注与深度分析：每周 Actions 自动跑 UZI，网页只负责收藏与展示
 */
const ScreenCloud = (() => {
  const REPO = 'RiddleGo/lcai-portfolio';
  const ACTIONS_URL = `https://github.com/${REPO}/actions/workflows/uzi-reports.yml`;

  let lastLiveReport = null;

  function el(id) {
    return document.getElementById(id);
  }

  function normalizeSymbol(input) {
    return ScreenWatchlist?.normalize?.(input) || String(input || '').replace(/\D/g, '');
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

  function updateReportCta(symbol, data) {
    const box = el('report-cta');
    const text = el('report-cta-text');
    const btnGen = el('btn-favorite-generate');
    const btnOpen = el('btn-open-full-report');
    if (!box) return;

    const code = normalizeSymbol(symbol);
    const unified = hasUnifiedDepth(data);
    const uzi = hasUziLayer(data);
    box.hidden = false;

    if (btnGen) {
      btnGen.hidden = false;
      btnGen.textContent = unified ? '⭐ 已收藏（每周自动更新）' : '⭐ 收藏到我的关注';
      btnGen.onclick = () => favoriteSymbol(code, data?.name);
    }

    if (unified) {
      const uziNote = uzi
        ? 'UZI 价值派材料已并入下方解读。'
        : 'LCAI 综合研判已就绪；UZI 价值派层将在<strong>每周一</strong>自动补全（无需 Issue）。';
      if (text) {
        text.innerHTML = `<p class="cta-ok">✅ 深度研判已就绪</p><p class="cta-steps">${uziNote}</p>`;
      }
    } else if (text) {
      text.innerHTML = `
        <p class="cta-title">📄 这只票还没有深度缓存</p>
        <p class="cta-steps">点「收藏」加入关注；持仓与关注列表会在<strong>每周一</strong>自动生成深度分析。若急需，可到 GitHub Actions 手动运行一次。</p>`;
    }

    if (btnOpen) {
      if (uzi || (data?.uzi?.report_url && unified)) {
        btnOpen.hidden = false;
        btnOpen.onclick = () => window.open(data.uzi.report_url || lcaiAsset(`reports/${code}/index.html`), '_blank');
      } else {
        btnOpen.hidden = true;
      }
    }
  }

  function favoriteSymbol(code, name) {
    if (!code) {
      setStatus('请先输入股票代码', 'warn');
      return;
    }
    ScreenWatchlist?.add?.(code, name);
    if (ScreenWatchlist?.isInCloud?.(code)) {
      setStatus('已在云端关注列表，每周一自动更新深度分析。', 'ok');
    } else {
      setStatus('已加入本机关注。持仓/云端关注列表中的股票每周一自动跑深度分析，无需再开 Issue。', 'ok');
    }
    fetchUnified(code)
      .then(data => updateReportCta(code, data))
      .catch(() => updateReportCta(code, null));
  }

  async function requestFullReport(symbol, name) {
    favoriteSymbol(normalizeSymbol(symbol), name);
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
      const sym = el('symbol-input')?.value?.trim();
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
  };
})();
