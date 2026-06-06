/**
 * 规则引擎：读取 criteria.json，输出判定与逻辑
 */
const ScreenEngine = (() => {
  let criteria = null;

  async function loadCriteria() {
    if (criteria) return criteria;
    const resp = await fetch('投资系统/criteria.json');
    criteria = await resp.json();
    window.LCAI_CRITERIA = criteria;
    return criteria;
  }

  function fmt(v, digits = 2) {
    if (v == null || !Number.isFinite(v)) return '—';
    return Number(v).toFixed(digits);
  }

  function pct(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    return `${(v * 100).toFixed(1)}%`;
  }

  const EVALUATORS = {
    circle_of_competence(m, rule, ctx) {
      const ok = ctx.competence !== false;
      return { pass: ok, actual: ok ? '已确认懂' : '未确认', threshold: '懂生意', score: ok ? 5 : 0, note: 'manual' };
    },
    not_st(m) {
      const ok = !m.isSt;
      return { pass: ok, actual: m.name, threshold: '非ST', score: ok ? 5 : 0 };
    },
    min_avg_amount(m, rule) {
      const th = m.market === 'HK' ? (rule.threshold_hk || 20000000) : rule.threshold;
      const ok = m.amount >= th;
      return { pass: ok, actual: `${(m.amount / 1e8).toFixed(2)}亿`, threshold: `≥${(th / 1e8).toFixed(2)}亿`, score: ok ? 5 : 0 };
    },
    revenue_growth(m, rule) {
      const v = m.revenueYoy;
      if (v == null) return { pass: true, actual: '—', threshold: `≥${rule.threshold}%`, score: 3, missing: true };
      const ok = v >= rule.threshold;
      return { pass: ok, actual: `${fmt(v)}%`, threshold: `≥${rule.threshold}%`, score: ok ? 5 : Math.max(1, 3 + v / 10) };
    },
    fraud_suspect(m) {
      const ok = !m.fraudSuspect;
      return { pass: ok, actual: m.fraudSuspect ? '现金流与利润严重背离' : '未发现', threshold: '无嫌疑', veto: !ok };
    },
    min_roe_avg(m, rule) {
      const v = m.roeAvg;
      if (v == null) return { pass: false, actual: '—', threshold: `≥${rule.threshold}%`, score: 0, missing: true };
      const ok = v >= rule.threshold;
      return { pass: ok, actual: `${fmt(v)}%`, threshold: `≥${rule.threshold}%`, score: ok ? 5 : Math.min(4, v / rule.threshold * 5) };
    },
    min_profit_years(m, rule) {
      const ok = m.profitYears >= rule.threshold;
      return { pass: ok, actual: `${m.profitYears}/5年`, threshold: `≥${rule.threshold}年`, score: ok ? 5 : m.profitYears };
    },
    gross_margin_score(m, rule) {
      const v = m.grossMargin;
      if (v == null) return { pass: true, actual: '—', threshold: `≥${rule.threshold}%`, score: 3, missing: true };
      const ok = v >= rule.threshold;
      return { pass: ok, actual: `${fmt(v)}%`, threshold: `≥${rule.threshold}%`, score: ok ? 5 : Math.max(1, v / rule.threshold * 5) };
    },
    moat_proxy(m, rule) {
      let score = 0;
      if (m.roeAvg >= 15) score += 35;
      if (m.grossMargin >= 30) score += 35;
      if ((m.profitYoy || 0) >= 0) score += 15;
      if ((m.ocfRatio || 0) >= 0.8) score += 15;
      const ok = score >= rule.threshold;
      return { pass: ok, actual: `${score}分`, threshold: `≥${rule.threshold}分`, score: Math.min(5, score / 20) };
    },
    profit_yoy(m, rule) {
      const v = m.profitYoy;
      if (v == null) return { pass: true, actual: '—', threshold: `≥${rule.threshold}%`, score: 3, missing: true };
      const ok = v >= rule.threshold;
      return { pass: ok, actual: `${fmt(v)}%`, threshold: `≥${rule.threshold}%`, score: ok ? 5 : Math.max(1, 3 + v / 20) };
    },
    profit_collapse(m) {
      const ok = !m.profitCollapse;
      return { pass: ok, actual: ok ? '否' : '是', threshold: '无连续大幅下滑', veto: !ok };
    },
    ocf_to_profit(m, rule) {
      const v = m.ocfRatio;
      if (v == null) return { pass: false, actual: '—', threshold: `≥${rule.threshold}`, score: 0, missing: true };
      const ok = v >= rule.threshold;
      return { pass: ok, actual: fmt(v), threshold: `≥${rule.threshold}`, score: ok ? 5 : Math.min(4, v / rule.threshold * 5) };
    },
    deduct_eps_ratio(m, rule) {
      const v = m.deductRatio;
      if (v == null) return { pass: true, actual: '—', threshold: `≥${rule.threshold}`, score: 3, missing: true };
      const ok = v >= rule.threshold;
      return { pass: ok, actual: fmt(v), threshold: `≥${rule.threshold}`, score: ok ? 5 : v / rule.threshold * 5 };
    },
    profit_trend(m, rule) {
      const v = m.profitYoy;
      if (v == null) return { pass: true, actual: '—', threshold: '≥0%', score: 3, missing: true };
      const ok = v >= rule.threshold;
      return { pass: ok, actual: `${fmt(v)}%`, threshold: `≥${rule.threshold}%`, score: ok ? 5 : Math.max(1, 3 + v / 15) };
    },
    ocf_veto(m) {
      const ok = !m.ocfVeto;
      return { pass: ok, actual: ok ? '否' : '是', threshold: 'OCF/EPS 3年不过低', veto: !ok };
    },
    margin_of_safety(m, rule) {
      const v = m.marginOfSafety;
      if (v == null) return { pass: false, actual: '—', threshold: `≥${pct(rule.threshold)}`, score: 0, missing: true };
      const ok = v >= rule.threshold;
      return {
        pass: ok,
        actual: `${pct(v)} (公允${fmt(m.fairValue)}元)`,
        threshold: `≥${pct(rule.threshold)}`,
        score: ok ? 5 : Math.max(0, v / rule.threshold * 5),
      };
    },
    pe_reasonable(m, rule) {
      const cap = m.peCap || rule.threshold;
      const v = m.pe;
      if (v == null || v <= 0) return { pass: false, actual: '—', threshold: `≤${cap}`, score: 0, missing: true };
      const ok = v <= cap;
      return { pass: ok, actual: fmt(v), threshold: `≤${cap}`, score: ok ? 5 : Math.max(1, cap / v * 5) };
    },
    pb_reasonable(m, rule) {
      const cap = m.sectorKey === '银行' || m.sectorKey === '金融' ? 2 : rule.threshold;
      const v = m.pb;
      if (v == null || v <= 0) return { pass: true, actual: '—', threshold: `≤${cap}`, score: 3, missing: true };
      const ok = v <= cap;
      return { pass: ok, actual: fmt(v), threshold: `≤${cap}`, score: ok ? 5 : Math.max(1, cap / v * 5) };
    },
    peg_score(m, rule) {
      const v = m.peg;
      if (v == null) return { pass: true, actual: '—', threshold: `≤${rule.threshold}`, score: 3, missing: true };
      const ok = v <= rule.threshold;
      return { pass: ok, actual: fmt(v), threshold: `≤${rule.threshold}`, score: ok ? 5 : Math.max(1, rule.threshold / v * 3) };
    },
    pe_extreme_veto(m) {
      const ok = !m.peExtreme;
      return { pass: ok, actual: ok ? '否' : `PE=${fmt(m.pe)}`, threshold: '非极端泡沫', veto: !ok };
    },
    psychology_ok(m, rule, ctx) {
      const ok = ctx.psychology !== false;
      return { pass: ok, actual: ok ? '通过自检' : '未通过', threshold: '无 FOMO/翻本', score: ok ? 5 : 0, note: 'manual' };
    },
    position_cap(m, rule) {
      const maxW = m.rating === 'A' ? 25 : m.rating === 'B' ? 10 : 0;
      return { pass: true, actual: `建议上限 ${maxW}%`, threshold: `≤${rule.threshold}%`, score: 5 };
    },
    sector_fit(m, rule) {
      let score = 50;
      if (m.pe != null && m.pe <= m.peCap) score += 25;
      if (m.marginOfSafety != null && m.marginOfSafety > 0) score += 25;
      const ok = score >= rule.threshold;
      return { pass: ok, actual: `${m.industry} (${score}分)`, threshold: `≥${rule.threshold}分`, score: Math.min(5, score / 20) };
    },
  };

  function layerScore(results, layer) {
    const items = results.filter(r => r.layer === layer && r.type === 'soft');
    if (!items.length) return 100;
    const totalW = items.reduce((s, r) => s + (r.weight || 5), 0);
    const got = items.reduce((s, r) => s + (r.score || 0) / 5 * (r.weight || 5), 0);
    return Math.round(got / totalW * 100);
  }

  function decide(metrics, results, ctx) {
    const cfg = criteria.scoring;
    const vetoes = results.filter(r => r.veto);
    const l0hard = results.filter(r => r.layer === 'L0' && r.type === 'hard');
    const l123hard = results.filter(r => ['L1', 'L2', 'L3'].includes(r.layer) && r.type === 'hard');

    const layerScores = {
      L0: l0hard.every(r => r.pass) ? 100 : 0,
      L1: layerScore(results, 'L1'),
      L2: layerScore(results, 'L2'),
      L3: layerScore(results, 'L3'),
      L4: layerScore(results, 'L4'),
      L5: layerScore(results, 'L5'),
    };

    const w = cfg.weights;
    const overall = Math.round(
      layerScores.L1 * w.L1 + layerScores.L2 * w.L2 + layerScores.L3 * w.L3 +
      layerScores.L4 * w.L4 + layerScores.L5 * w.L5
    );

    let rating = 'D';
    if (overall >= 80) rating = 'A';
    else if (overall >= 72) rating = 'B';
    else if (overall >= 60) rating = 'C';

    metrics.rating = rating;

    const hardFail = l123hard.filter(r => !r.pass).map(r => r.id);
    const l3mos = results.find(r => r.id === 'L3-01');
    const inPortfolio = ctx.inPortfolio;

    let verdict = '观察';
    let verdictAction = '加入观察池，等待更好价格或财报验证';

    if (vetoes.length || l0hard.some(r => !r.pass)) {
      verdict = '排除';
      verdictAction = '不建议投资；若已持仓，计划退出';
    } else if (hardFail.length) {
      verdict = '观察';
      verdictAction = `硬指标未过：${hardFail.join('、')}`;
    } else if (overall >= cfg.overall_buy && l3mos && l3mos.pass) {
      verdict = inPortfolio ? '持有' : '买入';
      verdictAction = inPortfolio ? '逻辑成立，可继续持有或小幅加仓' : '达建仓线，可分批买入';
    } else if (inPortfolio) {
      if (layerScores.L3 < 50 || metrics.peExtreme) {
        verdict = '减仓';
        verdictAction = '估值偏高或边际不足，建议减仓';
      } else if (hardFail.length > 0) {
        verdict = '卖出';
        verdictAction = '逻辑证伪，建议清仓';
      } else {
        verdict = '持有';
        verdictAction = '未达加仓线，维持持有';
      }
    }

    const summaries = [];
    if (vetoes.length) summaries.push(`触发否决：${vetoes.map(v => v.name).join('、')}`);
    if (hardFail.length) summaries.push(`未过硬指标：${hardFail.join('、')}`);
    if (l3mos && !l3mos.pass) summaries.push(`安全边际 ${l3mos.actual}，未达 25%`);
    if (layerScores.L1 >= cfg.L1_min) summaries.push('生意质量尚可');
    if (!summaries.length) summaries.push('综合指标均衡');

    const maxWeight = rating === 'A' ? '25%' : rating === 'B' ? '10%' : '0%';

    return {
      symbol: metrics.symbol,
      name: metrics.name,
      market: metrics.market,
      secid: metrics.secid,
      verdict,
      verdict_action: verdictAction,
      overall_score: overall,
      layer_scores: layerScores,
      rating,
      vetoes_triggered: vetoes.map(v => v.id),
      hard_failures: hardFail,
      logic_summary: summaries.join('；') + '。',
      rules: results,
      position_hint: {
        suggested_weight: verdict === '买入' ? maxWeight : '0%',
        max_weight: maxWeight,
        reason: verdictAction,
      },
      in_portfolio: inPortfolio,
    };
  }

  async function screen(input, ctx = {}) {
    await loadCriteria();
    const { metrics } = await ScreenData.loadStock(input);
    ctx.inPortfolio = ctx.inPortfolio ?? ScreenData.isInPortfolio(metrics.secid);

    const results = criteria.rules.map(rule => {
      const fn = EVALUATORS[rule.eval];
      if (!fn) return { ...rule, pass: true, actual: '—', threshold: '—', score: 3, result: 'skip' };
      const out = fn(metrics, rule, ctx);
      return {
        id: rule.id,
        layer: rule.layer,
        type: rule.type,
        name: rule.name,
        sources: rule.sources,
        weight: rule.weight || 5,
        pass: out.pass !== false,
        actual: out.actual,
        threshold: out.threshold || String(rule.threshold ?? ''),
        score: out.score ?? (out.pass ? 5 : 0),
        veto: !!out.veto,
        missing: !!out.missing,
        note: out.note || rule.auto,
        result: out.veto ? 'veto' : out.pass ? 'pass' : 'fail',
      };
    });

    return decide(metrics, results, ctx);
  }

  return { loadCriteria, screen };
})();
