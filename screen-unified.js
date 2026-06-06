/**
 * LCAI × UZI 综合研判（单页融合，裁决仍来自 LCAI）
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
      uzi_insight: null,
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
      executive: live.analysis?.executive || live.logic_summary || '',
      valuationNarrative: live.analysis?.valuation?.narrative || '',
      layers: layersFromLive(live),
      strengths: live.analysis?.strengths || [],
      weaknesses: live.analysis?.weaknesses || [],
      watch_points: live.analysis?.watch_points || [],
      divergences: [],
      uzi: { ready: false, report_url: `reports/${normalizeSymbol(live.symbol)}/index.html` },
      generated_at: null,
    };

    if (!unified) {
      base.divergences = ['尚未加载云端缓存 — 持仓/关注列表每周一自动生成深度分析'];
      return base;
    }

    base.executive = unified.executive || base.executive;
    base.valuationNarrative = unified.valuation?.narrative || base.valuationNarrative;
    base.layers = unified.layers?.length ? unified.layers : base.layers;
    base.strengths = mergeLists(base.strengths, unified.strengths);
    base.weaknesses = mergeLists(base.weaknesses, unified.weaknesses);
    base.divergences = unified.divergences || [];
    base.uzi = unified.uzi || base.uzi;
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
    const summary = el('logic-summary');
    if (summary) summary.textContent = data.executive || '';

    const valText = el('analysis-valuation-text');
    const valBlock = el('analysis-valuation');
    if (valText && valBlock) {
      valText.textContent = data.valuationNarrative || '暂无估值数据';
      valBlock.hidden = !data.valuationNarrative;
    }

    renderListBlock('analysis-strengths', '优势', data.strengths, '暂无显著优势项');
    renderListBlock('analysis-weaknesses', '风险 / 短板', data.weaknesses, '无重大否决或硬指标 Fail');
    renderListBlock('analysis-watch', '关注项', data.watch_points, '无额外关注项');

    const layersBox = el('analysis-layer-cards');
    if (layersBox && data.layers?.length) {
      layersBox.innerHTML = data.layers.map(l => {
        const st = l.lcai_status || l.status || '—';
        const stCls = statusClass(st);
        const detail = l.merged_summary || l.lcai_summary || '';
        const uziLine = l.uzi_insight
          ? `<details style="margin-top:6px;font-size:0.78rem;color:var(--muted)"><summary>UZI 价值派补充</summary><p style="margin:4px 0 0">${l.uzi_insight}</p></details>`
          : '';
        return `<div class="screen-layer-card">
          <h4><span>${l.title || l.layer}</span><span class="layer-status ${stCls}">${st}</span></h4>
          <p>${detail}</p>${uziLine}
        </div>`;
      }).join('');
    }

    const divBox = el('unified-divergences');
    if (divBox) {
      if (data.divergences?.length) {
        divBox.hidden = false;
        divBox.innerHTML = `<p style="font-size:0.82rem;color:var(--warn);margin:0">分歧 / 提示：${data.divergences.join('；')}</p>`;
      } else {
        divBox.hidden = true;
      }
    }

    const foot = el('unified-uzi-footer');
    if (foot) {
      foot.hidden = false;
      if (data.uzi?.ready) {
        const meta = data.generated_at ? `更新于 ${data.generated_at}` : '';
        foot.innerHTML = `
          <p style="font-size:0.82rem;color:var(--muted);margin:0">
            价值派深度已并入上文解读（定调：${data.uzi.tone || '—'}，共识 ${data.uzi.consensus ?? '—'}）。${meta}
          </p>`;
      } else if (data.depth?.lcai_ready || data.layers?.length) {
        foot.innerHTML = `<p style="font-size:0.82rem;color:var(--warn);margin:0">⏳ 完整深度分析生成中 — 完成后可点上方「查看 UZI 完整 HTML」。</p>`;
      } else {
        foot.innerHTML = `<p style="font-size:0.82rem;color:var(--muted);margin:0">点「⭐ 收藏」加入关注；持仓与关注中的股票每周一自动生成完整深度分析。</p>`;
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
