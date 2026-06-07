/**
 * LCAI 综合研判（浏览器实时 + 云端缓存）
 */
const ScreenUnified = (() => {
  function el(id) {
    return document.getElementById(id);
  }

  function normalizeSymbol(symbol) {
    if (ScreenCloud?.normalizeSymbol) return ScreenCloud.normalizeSymbol(symbol);
    const sym = String(symbol || '').replace(/\D/g, '');
    if (sym.length === 5) return sym.padStart(5, '0');
    return sym.slice(-6).padStart(6, '0');
  }

  function maxWeight(rating) {
    if (rating === 'A') return '25%';
    if (rating === 'B') return '10%';
    return '0%';
  }

  function mergeLists(a, b) {
    const out = [...(a || []), ...(b || [])];
    return [...new Set(out)].slice(0, 12);
  }

  function layersFromLive(live) {
    return (live.analysis?.layers || []).map(l => ({
      layer: l.layer,
      title: l.title,
      lcai_status: l.status,
      merged_summary: l.summary,
      lcai_summary: l.summary,
    }));
  }

  function mergeLiveWithCache(live, unified) {
    const base = {
      symbol: live.symbol,
      name: live.name,
      verdict: {
        value: live.verdict,
        action: live.verdict_action,
        rating: live.rating,
        score: live.overall_score,
        source: 'lcai',
        max_weight: maxWeight(live.rating),
      },
      executive: live.analysis?.executive_brief || live.analysis?.executive || live.logic_summary || '',
      finalConclusion: live.analysis?.final_conclusion || null,
      summaryDetailed: live.analysis?.detailed_summary || '',
      keyMetrics: live.analysis?.key_metrics || [],
      decisionPath: live.analysis?.decision_path || [],
      valuationNarrative: live.analysis?.valuation?.narrative || '',
      layers: layersFromLive(live),
      strengths: live.analysis?.strengths || [],
      weaknesses: live.analysis?.weaknesses || [],
      watch_points: live.analysis?.watch_points || [],
      divergences: [],
      report_url: `reports/${normalizeSymbol(live.symbol)}/index.html`,
      generated_at: null,
    };

    if (!unified) {
      base.divergences = ['尚未加载云端缓存 — 持仓/关注列表每周一自动刷新'];
      return base;
    }

    base.executive = unified.executive_brief || unified.executive || base.executive;
    base.finalConclusion = unified.final_conclusion || null;
    base.summaryDetailed = unified.summary_detailed || base.summaryDetailed;
    base.keyMetrics = unified.key_metrics?.length ? unified.key_metrics : base.keyMetrics;
    base.decisionPath = unified.decision_path?.length ? unified.decision_path : base.decisionPath;
    base.valuationNarrative = unified.valuation?.narrative || base.valuationNarrative;
    base.layers = unified.layers?.length ? unified.layers : base.layers;
    base.strengths = mergeLists(base.strengths, unified.strengths);
    base.weaknesses = mergeLists(base.weaknesses, unified.weaknesses);
    base.divergences = unified.divergences || [];
    base.report_url = unified.report_url || base.report_url;
    base.generated_at = unified.generated_at;
    base.verdict.max_weight = unified.verdict?.max_weight || base.verdict.max_weight;
    return base;
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

  function statusClass(status) {
    if (status === '通过') return 'ok';
    if (status === '未通过') return 'danger';
    return 'warn';
  }

  function applyMerged(data) {
    ScreenUI?.renderFinalConclusion?.(data.finalConclusion);

    const summary = el('logic-summary');
    if (summary) summary.textContent = data.executive || '';

    const detailBlock = el('analysis-detailed-wrap');
    const detailText = el('analysis-detailed-text');
    const detailed = data.summaryDetailed || '';
    if (detailBlock && detailText) {
      if (detailed) {
        detailText.textContent = detailed;
        detailBlock.hidden = false;
      } else {
        detailBlock.hidden = true;
      }
    }

    const metricsBox = el('analysis-metrics');
    if (metricsBox && data.keyMetrics?.length) {
      metricsBox.innerHTML = data.keyMetrics.map(m => {
        const st = m.status === 'ok' ? 'metric-ok' : m.status === 'fail' ? 'metric-fail' : '';
        const th = m.threshold && m.threshold !== '—' ? `<div class="m-th">阈值 ${m.threshold}</div>` : '';
        return `<div class="screen-metric-item ${st}"><div class="m-val">${m.value}</div><div class="m-lbl">${m.label}</div>${th}</div>`;
      }).join('');
    }

    const stepsBox = el('analysis-decision-steps');
    if (stepsBox && data.decisionPath?.length) {
      stepsBox.innerHTML = data.decisionPath.map(s => {
        const cls = s.ok ? 'pass' : 'fail';
        return `<div class="screen-decision-step ${cls}">
          <div class="step-num">${s.step}</div>
          <div class="step-body">
            <div class="step-title">${s.title}</div>
            <div class="step-detail">${s.detail}</div>
          </div>
        </div>`;
      }).join('');
    }

    const valText = el('analysis-valuation-text');
    const valBlock = el('analysis-valuation');
    if (valText && valBlock) {
      valText.textContent = data.valuationNarrative || '暂无估值数据';
      valBlock.hidden = !data.valuationNarrative;
    }

    renderListBlock('analysis-strengths', '优势', data.strengths, '暂无显著优势项');
    renderListBlock('analysis-weaknesses', '风险 / 短板', data.weaknesses, '无重大否决或硬指标 Fail');
    const watchBox = el('analysis-watch');
    if (watchBox) watchBox.hidden = true;

    const layersBox = el('analysis-layer-cards');
    if (layersBox && data.layers?.length) {
      layersBox.innerHTML = data.layers.map(l => {
        const st = l.lcai_status || l.status || '—';
        const stCls = statusClass(st);
        const detail = l.merged_summary || l.lcai_summary || '';
        return `<div class="screen-layer-card">
          <h4><span>${l.title || l.layer}</span><span class="layer-status ${stCls}">${st}</span></h4>
          <p>${detail}</p>
        </div>`;
      }).join('');
    }

    const divBox = el('unified-divergences');
    if (divBox) {
      const items = data.divergence_notes?.length ? data.divergence_notes : data.divergences;
      if (items?.length) {
        divBox.hidden = false;
        divBox.innerHTML = `<h3 style="margin:0 0 10px;font-size:0.9rem">风险与提示</h3>` + items.map(d => {
          if (typeof d === 'string') {
            return `<div class="divergence-item warning"><p style="margin:0;font-size:0.82rem;color:var(--warn)">${d}</p></div>`;
          }
          const kind = d.kind || 'warning';
          const metrics = (d.actual && d.threshold && d.threshold !== '—')
            ? `<div class="div-metrics">实际值 ${d.actual} · 阈值 ${d.threshold}</div>` : '';
          return `<div class="divergence-item ${kind}">
            <div class="div-title">${d.title || d.rule_id || '提示'}</div>
            <p class="div-summary">${d.summary || ''}</p>${metrics}
          </div>`;
        }).join('');
      } else {
        divBox.hidden = true;
      }
    }

    const foot = el('unified-cache-footer');
    if (foot) {
      if (data.generated_at) {
        foot.hidden = false;
        foot.innerHTML = `<p style="font-size:0.82rem;color:var(--muted);margin:0">云端缓存更新于 ${data.generated_at}。<a href="${lcaiAsset(data.report_url || '')}" target="_blank" rel="noopener">查看完整报告</a></p>`;
      } else if (data.layers?.length) {
        foot.hidden = false;
        foot.innerHTML = `<p style="font-size:0.82rem;color:var(--muted);margin:0">点「⭐ 收藏」加入关注；持仓与关注中的股票每周一自动刷新缓存。</p>`;
      } else {
        foot.hidden = true;
      }
    }

    const hint = el('unified-disclaimer');
    if (hint) hint.hidden = false;
  }

  async function fetchUnified(symbol) {
    const code = normalizeSymbol(symbol);
    try {
      const resp = await fetch(lcaiAsset(`reports/${code}/unified.json?t=${Date.now()}`));
      if (!resp.ok) return null;
      return resp.json();
    } catch {
      return null;
    }
  }

  async function attach(liveReport) {
    if (!liveReport) return null;
    ScreenCloud?.setLiveReport?.(liveReport);
    applyMerged(mergeLiveWithCache(liveReport, null));
    const unified = await fetchUnified(liveReport.symbol);
    if (unified) {
      applyMerged(mergeLiveWithCache(liveReport, unified));
    }
    return unified;
  }

  return { attach, mergeLiveWithCache, applyMerged, fetchUnified };
})();
