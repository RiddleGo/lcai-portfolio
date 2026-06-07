/**
 * 判定标准只读查看（数据源：投资系统/criteria.json）
 */
const CriteriaView = (() => {
  const TYPE_LABEL = { hard: '硬指标', soft: '软指标', veto: '否决' };

  function el(id) {
    return document.getElementById(id);
  }

  function fmtThreshold(rule) {
    const th = rule.threshold;
    if (th == null) return '—';
    if (typeof th === 'boolean') return th ? '是' : '否';
    if (rule.eval === 'margin_of_safety') return `≥${(th * 100).toFixed(0)}%`;
    if (rule.eval === 'min_avg_amount') {
      const hk = rule.threshold_hk;
      const a = `A股 ≥${(rule.threshold / 1e8).toFixed(2)}亿`;
      return hk ? `${a} / 港 ≥${(hk / 1e8).toFixed(2)}亿` : a;
    }
    return String(th);
  }

  function render(cfg) {
    const box = el('criteria-content');
    if (!box || !cfg) return;
    const sc = cfg.scoring || {};
    const w = sc.weights || {};
    let html = `
      <div class="card" style="margin-bottom:16px">
        <h2 style="font-size:1rem;margin:0 0 8px">建仓线</h2>
        <p style="margin:0;color:var(--muted);font-size:0.88rem">
          买入总分 ≥ <strong>${sc.overall_buy ?? '?'}</strong> ·
          权重 L1 ${(w.L1 * 100 || 0).toFixed(0)}% / L2 ${(w.L2 * 100 || 0).toFixed(0)}% /
          L3 ${(w.L3 * 100 || 0).toFixed(0)}% / L4 ${(w.L4 * 100 || 0).toFixed(0)}% / L5 ${(w.L5 * 100 || 0).toFixed(0)}%
        </p>
        <p style="margin:10px 0 0;font-size:0.82rem;color:var(--muted)">
          改阈值：编辑 <a href="https://github.com/RiddleGo/lcai-portfolio/edit/main/投资系统/criteria.json" target="_blank" rel="noopener">criteria.json</a>
          → 本地运行 <code>python scripts/apply_criteria.py --reports</code>
        </p>
      </div>`;

    const layers = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
    for (const layer of layers) {
      const items = (cfg.rules || []).filter(r => r.layer === layer);
      if (!items.length) continue;
      html += `<div class="card" style="margin-bottom:12px"><h3 style="font-size:0.95rem;margin:0 0 10px">${layer}</h3><div style="overflow-x:auto"><table><thead><tr>
        <th>编号</th><th>名称</th><th>类型</th><th>阈值</th><th>来源</th></tr></thead><tbody>`;
      for (const r of items) {
        html += `<tr><td>${r.id}</td><td>${r.name}</td><td>${TYPE_LABEL[r.type] || r.type}</td>
          <td>${fmtThreshold(r)}</td><td style="font-size:0.8rem;color:var(--muted)">${(r.sources || []).join('、')}</td></tr>`;
      }
      html += '</tbody></table></div></div>';
    }
    box.innerHTML = html;
  }

  async function load() {
    const box = el('criteria-content');
    if (!box) return;
    box.innerHTML = '<p class="screen-loading">加载规则…</p>';
    try {
      const resp = await fetch(lcaiAsset(`投资系统/criteria.json?t=${Date.now()}`));
      if (!resp.ok) throw new Error(String(resp.status));
      render(await resp.json());
    } catch (e) {
      box.innerHTML = `<p class="screen-error">规则加载失败：${e.message}</p>`;
    }
  }

  function init() {
    document.querySelector('.tab-btn[data-page="criteria"]')?.addEventListener('click', load);
  }

  return { init, load };
})();
