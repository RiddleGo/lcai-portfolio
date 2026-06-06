/**
 * 选股研判 UI 渲染
 */
const ScreenUI = (() => {
  const VERDICT_STYLE = {
    '买入': 'ok',
    '观察': 'warn',
    '持有': 'ok',
    '减仓': 'warn',
    '卖出': 'danger',
    '排除': 'danger',
  };

  function el(id) {
    return document.getElementById(id);
  }

  function renderListBlock(containerId, title, items, emptyText) {
    const box = el(containerId);
    if (!box) return;
    if (!items || !items.length) {
      box.innerHTML = `<h4>${title}</h4><p style="font-size:0.82rem;color:var(--muted);margin:0">${emptyText}</p>`;
      return;
    }
    box.innerHTML = `<h4>${title}</h4><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  }

  function renderAnalysis(report) {
    const a = report.analysis || {};
    el('logic-summary').textContent = a.executive || report.logic_summary || '';

    const metricsBox = el('analysis-metrics');
    if (metricsBox) {
      metricsBox.innerHTML = (a.key_metrics || []).map(m =>
        `<div class="screen-metric-item"><div class="m-val">${m.value}</div><div class="m-lbl">${m.label}</div></div>`
      ).join('');
    }

    const valText = el('analysis-valuation-text');
    const valBlock = el('analysis-valuation');
    if (valText && valBlock) {
      valText.textContent = a.valuation?.narrative || '暂无估值数据';
      valBlock.hidden = !a.valuation?.narrative;
    }

    renderListBlock('analysis-strengths', '优势', a.strengths, '暂无显著优势项');
    renderListBlock('analysis-weaknesses', '风险 / 短板', a.weaknesses, '无重大否决或硬指标 Fail');
    renderListBlock('analysis-watch', '关注项', a.watch_points, '无额外关注项');

    const stepsBox = el('analysis-decision-steps');
    if (stepsBox) {
      stepsBox.innerHTML = (a.decision_path || []).map(s => {
        const cls = s.ok ? 'pass' : (s.step === 6 && ['排除', '卖出'].includes(report.verdict) ? 'danger' : 'fail');
        return `<div class="screen-decision-step ${cls}">
          <div class="step-num">${s.step}</div>
          <div class="step-body">
            <div class="step-title">${s.title}</div>
            <div class="step-detail">${s.detail}</div>
          </div>
        </div>`;
      }).join('');
    }

    const layersBox = el('analysis-layer-cards');
    if (layersBox) {
      layersBox.innerHTML = (a.layers || []).map(l => {
        const stCls = l.status === '通过' ? 'ok' : l.status === '未通过' ? 'danger' : 'warn';
        const scoreTxt = l.layer === 'L0' ? '' : ` · 得分 ${l.score}`;
        return `<div class="screen-layer-card">
          <h4><span>${l.title}${scoreTxt}</span><span class="layer-status ${stCls}">${l.status}</span></h4>
          <p>${l.summary}</p>
        </div>`;
      }).join('');
    }
  }

  function renderVerdict(report) {
    const badge = el('verdict-badge');
    const cls = VERDICT_STYLE[report.verdict] || 'warn';
    badge.className = `verdict-badge ${cls}`;
    badge.textContent = report.verdict;
    el('verdict-action').textContent = report.verdict_action;
    el('stock-title').textContent = `${report.name} (${report.symbol})`;
    el('overall-score').textContent = report.overall_score;
    el('rating').textContent = report.rating;
    el('portfolio-tag').textContent = report.in_portfolio ? '已持仓' : '未持仓';
    el('portfolio-tag').className = `screen-tag ${report.in_portfolio ? 'in-port' : ''}`;
    el('position-hint').textContent =
      `建议仓位：${report.position_hint.suggested_weight}（上限 ${report.position_hint.max_weight}）· ${report.position_hint.reason}`;

    renderAnalysis(report);
    ScreenUnified?.attach?.(report);
    ScreenCloud?.checkAndShowCta?.(report.symbol, report.name);
    ScreenWatchlist?.add?.(report.symbol, report.name);

    const layers = el('layer-scores');
    layers.innerHTML = '';
    const labels = { L0: '门禁', L1: '生意', L2: '财务', L3: '估值', L4: '执行', L5: '行业' };
    for (const [k, v] of Object.entries(report.layer_scores)) {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.innerHTML = `
        <span class="layer-label">${k} ${labels[k] || ''}</span>
        <div class="bar-wrap"><div class="bar" style="width:${v}%"></div></div>
        <span class="layer-val">${v}</span>`;
      layers.appendChild(row);
    }

    const tbody = el('rules-body');
    tbody.innerHTML = '';
    for (const r of report.rules) {
      const tr = document.createElement('tr');
      const rc = r.result === 'pass' ? 'pass' : r.result === 'veto' ? 'veto' : 'fail';
        tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.name}${r.missing ? ' <span class="rule-missing">数据缺失</span>' : ''}${r.note === 'manual' ? ' <span class="rule-manual">主观</span>' : ''}</td>
        <td>${r.actual}</td>
        <td>${r.threshold}</td>
        <td class="rule-${rc}">${r.result === 'veto' ? '否决' : r.pass ? 'Pass' : 'Fail'}</td>
        <td class="rule-reason">${r.reason || '—'}</td>
        <td style="color:var(--muted);font-size:0.78rem">${(r.sources || []).join('、')}</td>`;
      tbody.appendChild(tr);
    }

    el('report-json').textContent = JSON.stringify(report, null, 2);
    el('report-panel').hidden = false;
  }

  function setLoading(on) {
    const btn = el('btn-screen');
    const loading = el('screen-loading');
    if (btn) btn.disabled = on;
    if (loading) loading.hidden = !on;
  }

  function showError(msg) {
    const box = el('screen-error');
    if (box) {
      box.textContent = msg;
      box.hidden = false;
    } else {
      alert(msg);
    }
  }

  function clearError() {
    const box = el('screen-error');
    if (box) box.hidden = true;
  }

  function isStaticHost() {
    return /\.github\.io$/i.test(location.hostname);
  }

  function isInputError(err) {
    const msg = String(err?.message || err || '');
    return msg.includes('请输入') || msg.includes('代码格式');
  }

  function friendlyError(err) {
    const msg = String(err?.message || err || '');
    if (msg === 'NO_CACHE') {
      return '这只票还没有云端缓存。请点「⭐ 收藏并加入云端队列」，在新页面点一次 Submit（仅首次）；之后每周一自动更新。';
    }
    if (/failed to fetch|networkerror|load failed|network/i.test(msg)) {
      return '数据加载失败。请按 Ctrl+F5 强制刷新后再试。';
    }
    return msg || '未知错误';
  }

  async function tryCacheReport(input, ctx) {
    const report = await ScreenEngine.screenFromCache(input, ctx);
    ScreenCloud?.setStatus?.(
      report.cacheDate
        ? `显示每周缓存研判（更新于 ${report.cacheDate}，非实时）。`
        : '显示每周缓存研判（非实时）。',
      'warn'
    );
    return report;
  }

  async function resolveReport(input, ctx) {
    if (isStaticHost()) {
      try {
        return await tryCacheReport(input, ctx);
      } catch (e) {
        if (e.message !== 'NO_CACHE') throw e;
        try {
          return await ScreenEngine.screen(input, ctx);
        } catch (_) { /* live blocked on Pages */ }
        throw e;
      }
    }
    try {
      return await ScreenEngine.screen(input, ctx);
    } catch (liveErr) {
      if (isInputError(liveErr)) throw liveErr;
      try {
        return await tryCacheReport(input, ctx);
      } catch (cacheErr) {
        if (cacheErr.message === 'NO_CACHE') throw cacheErr;
        throw liveErr;
      }
    }
  }

  async function run() {
    clearError();
    const input = el('symbol-input').value.trim();
    if (!input) {
      showError('请输入股票代码');
      return;
    }
    setLoading(true);
    try {
      const competence = el('chk-competence').checked;
      const psychology = el('chk-psychology').checked;
      const report = await resolveReport(input, { competence, psychology });
      renderVerdict(report);
    } catch (e) {
      showError(friendlyError(e));
      const panel = el('report-panel');
      if (panel) panel.hidden = true;
    } finally {
      setLoading(false);
    }
  }

  function init() {
    if (window._screenInited) return;
    const btn = el('btn-screen');
    if (!btn) return;
    btn.addEventListener('click', run);
    el('symbol-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') run();
    });
    el('btn-export')?.addEventListener('click', () => {
      const text = el('report-json')?.textContent;
      if (!text) return;
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `screen-${Date.now()}.json`;
      a.click();
    });
    window._screenInited = true;
  }

  return { init, renderVerdict, run };
})();

if (document.getElementById('btn-screen')) {
  ScreenWatchlist?.init?.();
  ScreenUI.init();
  ScreenCloud?.init?.();
}
