/**
 * 成长型二次裁决（criteria.json modes.growth）
 */
const ScreenGrowthMode = (() => {
  const NON_OVERRIDE = new Set(['L0-05', 'L0-06', 'L1-06', 'L2-04', 'L3-05']);

  function pct(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    return `${(v * 100).toFixed(1)}%`;
  }

  function growthSignals(m) {
    const out = [];
    if (m.revenueYoy != null && m.revenueYoy >= 15) out.push({ id: 'G1', ok: true, text: `营收 YoY ${m.revenueYoy.toFixed(1)}%` });
    else out.push({ id: 'G1', ok: false, text: '营收高增未达标' });

    const profitOk = (m.profitYears >= 2) && (m.profitYoy != null && m.profitYoy >= 0);
    const profitStrong = m.profitYoy != null && m.profitYoy >= 10;
    if (profitStrong || (m.profitYears >= 4 && m.profitYoy >= 0)) {
      out.push({ id: 'G2', ok: true, text: `盈利 ${m.profitYears}/5 年 · 利润 YoY ${m.profitYoy != null ? m.profitYoy.toFixed(1) : '—'}%` });
    } else {
      out.push({ id: 'G2', ok: false, text: `盈利稳定性不足（${m.profitYears}/5 年）` });
    }

    const g3 = (m.roeAvg != null && m.roeAvg < 15) && (m.grossMargin >= 25);
    out.push({ id: 'G3', ok: g3, text: g3 ? `投入期：毛利率 ${m.grossMargin?.toFixed(1)}%` : '投入期优质未达标' });

    const g4 = (m.ocfRatio >= 0.6) || (m.ocfRatio > 0 && m.profitYoy > 0);
    out.push({ id: 'G4', ok: g4, text: g4 ? `OCF/EPS ${m.ocfRatio?.toFixed(2)}` : '现金流改善未达标' });

    const count = out.filter(x => x.ok).length;
    return { items: out, count, pass: count >= 2 };
  }

  function checkGrowthHard(m, valueReport) {
    const fails = [];
    const vetoes = (valueReport.vetoes_triggered || []).filter(id => NON_OVERRIDE.has(id));

    if (vetoes.length) {
      return { fails, vetoes, blocked: true, blockReason: `否决项不可豁免：${vetoes.join('、')}` };
    }

    const roePass = m.roeAvg >= 10 || m.roeAvg >= 15;
    if (!roePass && m.roeAvg != null) fails.push('L1-01');

    const pyMin = 2;
    if (m.profitYears < pyMin) fails.push('L1-02');

    if (m.ocfRatio != null && m.ocfRatio < 0.6 && !(m.ocfRatio > 0 && m.profitYoy > 0)) fails.push('L2-01');

    const mosTh = 0.15;
    if (m.marginOfSafety == null || m.marginOfSafety < mosTh) fails.push('L3-01');

    if (m.pe != null && m.peCap != null && m.pe > m.peCap) fails.push('L3-02');

    return { fails, vetoes: [], blocked: false, blockReason: null };
  }

  function decideGrowth(valueReport) {
    const cfg = window.LCAI_CRITERIA?.modes?.growth;
    if (!cfg) return null;

    const m = { ...valueReport.metrics, peCap: valueReport.metrics?.peCap, grossMargin: valueReport.metrics?.grossMargin };
    const signals = growthSignals(m);
    const hard = checkGrowthHard(m, valueReport);

    let verdict = '观察';
    let action = '成长型：硬指标或信号未达标';
    const caps = cfg.position_cap || { A: 0.15, B: 0.08 };

    if (hard.blocked) {
      verdict = '排除';
      action = hard.blockReason;
    } else if (!signals.pass) {
      verdict = '观察';
      action = `成长信号 ${signals.count}/4（需≥2）`;
    } else if (hard.fails.length) {
      verdict = '观察';
      action = `成长型硬指标未过：${hard.fails.join('、')}`;
    } else if (valueReport.overall_score >= 72) {
      verdict = valueReport.in_portfolio ? '持有' : '买入';
      action = valueReport.in_portfolio ? '成长 thesis 成立，可持有' : '成长型达建仓线';
    }

    const rating = valueReport.rating;
    const maxW = rating === 'A' ? `${(caps.A * 100).toFixed(0)}%` : rating === 'B' ? `${(caps.B * 100).toFixed(0)}%` : '0%';

    return {
      mode: 'growth',
      verdict,
      verdict_action: action,
      signals,
      hard_failures: hard.fails,
      vetoes: hard.vetoes,
      max_weight: maxW,
      margin_threshold: '15%（Forward/回溯）',
    };
  }

  function renderCard(growth) {
    if (!growth) return '';
    const sigHtml = growth.signals.items.map(s =>
      `<li class="${s.ok ? 'ok' : 'fail'}">${s.id} ${s.text}</li>`
    ).join('');
    const vCls = growth.verdict === '买入' || growth.verdict === '持有' ? 'ok' : growth.verdict === '排除' ? 'danger' : 'warn';
    return `<div class="growth-mode-card">
      <p class="growth-mode-title">成长型二次裁决 <span class="growth-verdict ${vCls}">${growth.verdict}</span></p>
      <p class="growth-mode-action">${growth.verdict_action}</p>
      <p class="growth-mode-sub">成长信号（≥2）：${growth.signals.count}/4 · 单票上限 ${growth.max_weight} · 安全边际 ${growth.margin_threshold}</p>
      <ul class="growth-signals">${sigHtml}</ul>
    </div>`;
  }

  function apply(valueReport) {
    const growth = decideGrowth(valueReport);
    if (growth) valueReport.growth_mode = growth;
    return valueReport;
  }

  return { apply, decideGrowth, renderCard, growthSignals };
})();
