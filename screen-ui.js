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
    '数据不足': 'warn',
  };

  function renderFinalConclusion(fc) {
    const box = el('final-conclusion');
    if (!box) return;
    if (!fc) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const ok = fc.data_ok !== false;
    box.className = `final-conclusion ${ok ? '' : 'data-bad'}`;
    const reasons = (fc.reasons || []).map((r, i) => `<li>${r}</li>`).join('');
    const actions = (fc.actions || []).map(a => `<li>${a}</li>`).join('');
    box.innerHTML = `
      <h3>最终结论</h3>
      <p class="fc-headline">${fc.headline || `${fc.verdict} — ${fc.action || ''}`}</p>
      ${reasons ? `<p class="fc-label">核心理由</p><ul class="fc-list">${reasons}</ul>` : ''}
      ${actions ? `<p class="fc-label">你可以怎么做</p><ul class="fc-list fc-actions">${actions}</ul>` : ''}`;
  }

  function renderRulesTable(rules) {
    const tbody = el('rules-body');
    const passBody = el('rules-body-pass');
    const passWrap = el('rules-pass-wrap');
    const failCountEl = el('rules-fail-count');
    if (!tbody) return;

    const failRules = (rules || []).filter(r => r.result === 'veto' || r.result === 'fail' || !r.pass);
    const passRules = (rules || []).filter(r => r.pass && r.result === 'pass');

    const rowHtml = r => {
      const rc = r.result === 'pass' ? 'pass' : r.result === 'veto' ? 'veto' : 'fail';
      return `<tr>
        <td>${r.id}</td>
        <td>${r.name}${r.missing ? ' <span class="rule-missing">数据缺失</span>' : ''}${r.note === 'manual' ? ' <span class="rule-manual">主观</span>' : ''}</td>
        <td>${r.actual}</td>
        <td>${r.threshold}</td>
        <td class="rule-${rc}">${r.result === 'veto' ? '否决' : r.pass ? 'Pass' : 'Fail'}</td>
        <td class="rule-reason">${r.reason || '—'}</td>
        <td style="color:var(--muted);font-size:0.78rem">${renderSources(r)}</td>
      </tr>`;
    };

    tbody.innerHTML = failRules.length
      ? failRules.map(rowHtml).join('')
      : '<tr><td colspan="7" style="color:var(--muted)">无否决或硬指标 Fail — 详见下方 Pass 规则</td></tr>';

    if (passBody && passWrap) {
      passBody.innerHTML = passRules.map(rowHtml).join('');
      passWrap.hidden = !passRules.length;
    }
    if (failCountEl) {
      failCountEl.textContent = failRules.length
        ? `展示 ${failRules.length} 条未通过 / 否决（Pass ${passRules.length} 条已折叠）`
        : `全部 ${passRules.length} 条规则 Pass（无 Fail/Veto）`;
    }
    bindSourceLinks(tbody);
    if (passBody) bindSourceLinks(passBody);
  }

  function el(id) {
    return document.getElementById(id);
  }

  function renderSources(r) {
    const idx = window.LCAI_BOOKS_INDEX;
    const meta = window.LCAI_META_SOURCES || {};
    const parts = [];
    for (const bid of r.book_ids || []) {
      const title = idx?.by_id?.[bid]?.title || bid;
      parts.push(`<a href="#books" class="book-source-link" data-book-id="${bid}">${title}</a>`);
    }
    for (const mid of r.meta_ids || []) {
      parts.push(meta[mid] || mid);
    }
    if (!parts.length) return (r.sources || []).join('、');
    return parts.join('、');
  }

  function bindSourceLinks(root) {
    (root || document).querySelectorAll('.book-source-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        window.BooksView?.openBook?.(a.dataset.bookId);
      });
    });
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
    renderFinalConclusion(a.final_conclusion);
    const brief = a.executive_brief || a.executive || report.logic_summary || '';
    const detailed = a.detailed_summary || '';
    el('logic-summary').textContent = brief;

    const detailBlock = el('analysis-detailed-wrap');
    const detailText = el('analysis-detailed-text');
    if (detailBlock && detailText) {
      if (detailed) {
        detailText.textContent = detailed;
        detailBlock.hidden = false;
      } else {
        detailText.textContent = '';
        detailBlock.hidden = true;
      }
    }

    const metricsBox = el('analysis-metrics');
    if (metricsBox) {
      metricsBox.innerHTML = (a.key_metrics || []).map(m => {
        const st = m.status === 'ok' ? 'metric-ok' : m.status === 'fail' ? 'metric-fail' : '';
        const th = m.threshold && m.threshold !== '—' ? `<div class="m-th">阈值 ${m.threshold}</div>` : '';
        const note = m.note ? `<div class="m-note">${m.note}</div>` : '';
        return `<div class="screen-metric-item ${st}">
          <div class="m-val">${m.value}</div>
          <div class="m-lbl">${m.label}</div>${th}${note}
        </div>`;
      }).join('');
    }

    const valText = el('analysis-valuation-text');
    const valBlock = el('analysis-valuation');
    if (valText && valBlock) {
      valText.textContent = a.valuation?.narrative || '暂无估值数据';
      valBlock.hidden = !a.valuation?.narrative;
    }

    renderListBlock('analysis-strengths', '优势', a.strengths, '暂无显著优势项');
    renderListBlock('analysis-weaknesses', '风险 / 短板', a.weaknesses, '无重大否决或硬指标 Fail');
    const watchBox = el('analysis-watch');
    if (watchBox) watchBox.hidden = true;

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
      `价值型 · 建议仓位：${report.position_hint.suggested_weight}（上限 ${report.position_hint.max_weight}）· ${report.position_hint.reason}`;

    const aiWrap = el('ai-layer-wrap');
    if (aiWrap && window.ScreenAiLayers) {
      aiWrap.innerHTML = ScreenAiLayers.renderCard(
        ScreenAiLayers.lookup(report.symbol, report.metrics?.industry)
      );
    }

    const gWrap = el('growth-mode-wrap');
    if (gWrap) {
      if (report.growth_mode) {
        gWrap.innerHTML = ScreenGrowthMode.renderCard(report.growth_mode);
        gWrap.hidden = false;
      } else {
        gWrap.innerHTML = '';
        gWrap.hidden = true;
      }
    }

    renderAnalysis(report);
    ScreenUnified?.attach?.(report);
    ScreenCloud?.checkAndShowCta?.(report.symbol, report.name);
    ScreenHoldings?.prefillFromReport?.(report);
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

    renderRulesTable(report.rules);

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
      let report = await resolveReport(input, { competence, psychology });
      if (el('chk-growth-mode')?.checked && window.ScreenGrowthMode) {
        report = ScreenGrowthMode.apply(report);
      }
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

  return { init, renderVerdict, run, renderFinalConclusion };
})();

if (document.getElementById('btn-screen')) {
  ScreenWatchlist?.init?.();
  ScreenHoldings?.init?.();
  ScreenUI.init();
  ScreenCloud?.init?.();
}
