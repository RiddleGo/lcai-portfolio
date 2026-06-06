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

  function renderDualTrack(data) {
    const panel = el('dual-track-panel');
    const box = el('dual-track-content');
    const btn = el('btn-deep-report');
    const meta = el('dual-track-meta');
    if (!panel || !box) return;
    if (!data || !data.lcai_verdict) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    box.innerHTML = `
      <div class="dual-track-col">
        <h4>LCAI 裁决（最终）</h4>
        <div class="dt-val">${data.lcai_verdict}</div>
        <div>${data.lcai_verdict_action || '—'}</div>
        <div style="margin-top:6px;color:var(--muted)">评级 ${data.lcai_rating || '—'} · 总分 ${data.lcai_score ?? '—'}</div>
        <div style="color:var(--muted)">安全边际 ${data.lcai_margin_pct != null ? data.lcai_margin_pct + '%' : '—'}</div>
      </div>
      <div class="dual-track-col">
        <h4>UZI 价值派参考</h4>
        <div class="dt-val">${data.uzi_tone || '未生成'}</div>
        <div>共识分 ${data.uzi_value_consensus ?? '—'}</div>
        <div style="margin-top:6px;color:var(--muted)">DCF 公允 ${data.dcf_fair_value ?? '—'}</div>
        <div style="color:var(--muted)">${data.margin_gap || ''}</div>
      </div>`;
    if (data.divergences && data.divergences.length) {
      box.innerHTML += `<div style="grid-column:1/-1;font-size:0.82rem;color:var(--warn);margin-top:4px">分歧：${data.divergences.join('；')}</div>`;
    }
    if (btn) {
      if (data.report_url) {
        btn.hidden = false;
        btn.onclick = () => window.open(data.report_url, '_blank');
      } else {
        btn.hidden = true;
      }
    }
    if (meta) meta.textContent = data.generated_at ? `缓存于 ${data.generated_at}` : '';
  }

  async function loadDualTrack(symbol) {
    const sym = String(symbol || '').replace(/\D/g, '');
    const code = sym.length === 5 ? sym.padStart(5, '0') : sym.slice(-6).padStart(6, '0');
    try {
      const resp = await fetch(`reports/${code}/lcai-vs-uzi.json?t=${Date.now()}`);
      if (!resp.ok) throw new Error('no cache');
      renderDualTrack(await resp.json());
    } catch (_) {
      const panel = el('dual-track-panel');
      if (panel) panel.hidden = true;
    }
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
    loadDualTrack(report.symbol);

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
      const report = await ScreenEngine.screen(input, { competence, psychology });
      renderVerdict(report);
    } catch (e) {
      showError(e.message || String(e));
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
  ScreenUI.init();
}
