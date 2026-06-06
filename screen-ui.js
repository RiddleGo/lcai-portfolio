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

  function renderVerdict(report) {
    const badge = el('verdict-badge');
    const cls = VERDICT_STYLE[report.verdict] || 'warn';
    badge.className = `verdict-badge ${cls}`;
    badge.textContent = report.verdict;
    el('verdict-action').textContent = report.verdict_action;
    el('logic-summary').textContent = report.logic_summary;
    el('stock-title').textContent = `${report.name} (${report.symbol})`;
    el('overall-score').textContent = report.overall_score;
    el('rating').textContent = report.rating;
    el('portfolio-tag').textContent = report.in_portfolio ? '已持仓' : '未持仓';
    el('portfolio-tag').className = `screen-tag ${report.in_portfolio ? 'in-port' : ''}`;
    el('position-hint').textContent =
      `建议仓位：${report.position_hint.suggested_weight}（上限 ${report.position_hint.max_weight}）`;

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
        <td style="color:var(--muted);font-size:0.78rem">${(r.sources || []).join('、')}</td>`;
      tbody.appendChild(tr);
    }

    el('report-json').textContent = JSON.stringify(report, null, 2);
    el('report-panel').hidden = false;
  }

  function setLoading(on) {
    el('btn-screen').disabled = on;
    el('loading').hidden = !on;
  }

  function showError(msg) {
    el('error').textContent = msg;
    el('error').hidden = false;
  }

  function clearError() {
    el('error').hidden = true;
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
      el('report-panel').hidden = true;
    } finally {
      setLoading(false);
    }
  }

  function init() {
    el('btn-screen').addEventListener('click', run);
    el('symbol-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') run();
    });
    el('btn-export').addEventListener('click', () => {
      const text = el('report-json').textContent;
      if (!text) return;
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `screen-${Date.now()}.json`;
      a.click();
    });
  }

  return { init, renderVerdict, run };
})();
