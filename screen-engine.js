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

  const LAYER_META = {
    L0: { name: '门禁', weight: null, min: null, desc: '排除 ST、流动性不足、造假嫌疑等不可投资标的' },
    L1: { name: '生意质量', weight: 0.30, min: 70, desc: 'ROE、盈利稳定性、毛利率与护城河代理指标' },
    L2: { name: '财务健康', weight: 0.25, min: 75, desc: '经营现金流、扣非质量与盈利趋势' },
    L3: { name: '估值', weight: 0.25, min: 65, desc: '安全边际、PE/PB/PEG 与极端估值否决' },
    L4: { name: '执行纪律', weight: 0.10, min: null, desc: '能力圈确认、心理纪律与仓位上限' },
    L5: { name: '行业适配', weight: 0.10, min: null, desc: '行业 PE 上限与估值匹配度' },
  };

  function explainRule(rule, out, m, ctx) {
    const pass = out.pass !== false;
    const lines = {
      circle_of_competence: () => pass
        ? '已确认处于能力圈内，符合「只投看得懂」原则（段永平 / 穷查理宝典）。'
        : '未确认能力圈——不懂不碰。建议先搞清商业模式、竞争格局与现金流来源后再研判。',
      not_st: () => pass
        ? `「${m.name}」非 ST，通过基础资格筛选。`
        : 'ST 标的波动大、退市风险高，系统直接排除。',
      min_avg_amount: () => pass
        ? `日均成交额 ${out.actual}，流动性充足，可正常建仓与退出。`
        : `日均成交额 ${out.actual} 低于门槛 ${out.threshold}，买卖冲击大，不适合重仓。`,
      revenue_growth: () => out.missing
        ? '缺少营收增速数据，暂按中性处理，需查阅最新财报核实。'
        : pass
          ? `营收同比 ${out.actual}，生意仍在扩张或至少未明显萎缩。`
          : `营收同比 ${out.actual} 低于 ${out.threshold}，需警惕需求下滑或行业周期拐点。`,
      fraud_suspect: () => pass
        ? '经营现金流与净利润匹配度正常，未发现典型「纸面利润」特征。'
        : '经营现金流/每股收益长期偏低且仍报盈利——存在利润质量疑点，触发否决。',
      min_roe_avg: () => out.missing
        ? '缺少 ROE 历史数据，无法评估资本回报，硬指标 Fail。'
        : pass
          ? `近 5 年 ROE 均值 ${out.actual}，资本回报优秀，符合巴菲特式好生意标准。`
          : `近 5 年 ROE 均值 ${out.actual}，低于 15% 门槛。长期 ROE 是商业模式的试金石，当前回报不足。`,
      min_profit_years: () => pass
        ? `近 5 年 ${out.actual} 盈利，业绩稳定性好。`
        : `近 5 年仅 ${out.actual} 盈利，波动过大，不符合「稳定复利机器」画像。`,
      gross_margin_score: () => out.missing
        ? '缺少毛利率数据，暂中性计分。'
        : pass
          ? `毛利率 ${out.actual}，定价权或成本控制能力较好。`
          : `毛利率 ${out.actual} 低于 20%，可能处于同质化竞争或薄利行业。`,
      moat_proxy: () => pass
        ? `护城河代理得分 ${out.actual}（ROE+毛利率+利润增速+现金流综合），竞争优势有数据支撑。`
        : `护城河代理得分 ${out.actual} 偏低，尚未形成明显的综合竞争壁垒。`,
      profit_yoy: () => out.missing
        ? '缺少利润增速，暂中性。'
        : pass
          ? `净利润同比 ${out.actual}，盈利仍在改善。`
          : `净利润同比 ${out.actual} 为负或偏低，短期盈利承压。`,
      profit_collapse: () => pass
        ? '未出现连续大幅利润下滑，经营未显「创新者窘境」式崩塌。'
        : '连续多期利润大幅下滑，经营逻辑可能已破坏，触发否决。',
      ocf_to_profit: () => out.missing
        ? '缺少现金流/EPS 数据，硬指标 Fail。'
        : pass
          ? `经营现金流/每股收益均值 ${out.actual}，利润「含金量」高。`
          : `经营现金流/每股收益 ${out.actual} 低于 0.8，利润兑现能力偏弱，需警惕应收与资本开支。`,
      deduct_eps_ratio: () => out.missing
        ? '缺少扣非数据，暂中性。'
        : pass
          ? `扣非/基本 EPS 比 ${out.actual}，主业盈利占比高，少依赖非经常性损益。`
          : `扣非/EPS ${out.actual} 偏低，利润可能含较多一次性项目。`,
      profit_trend: () => out.missing
        ? '缺少盈利趋势数据。'
        : pass
          ? `最新盈利趋势 ${out.actual}，方向尚可。`
          : `盈利趋势 ${out.actual} 转弱，需跟踪下一季财报是否修复。`,
      ocf_veto: () => pass
        ? '近 3 年经营现金流与每股收益未长期严重背离。'
        : '近 3 年经营现金流持续远低于每股收益，触发财务质量否决。',
      margin_of_safety: () => out.missing
        ? '无法测算安全边际（缺 EPS 或行情），硬指标 Fail。'
        : pass
          ? `现价 ${fmt(m.price)} 元 vs 公允 ${fmt(m.fairValue)} 元，安全边际 ${pct(m.marginOfSafety)}，价格足够便宜。`
          : `现价 ${fmt(m.price)} 元，公允价值 ${fmt(m.fairValue)} 元（${m.sectorKey} 行业公允 PE ${m.fairPe} × EPS ${fmt(m.eps)}），安全边际 ${pct(m.marginOfSafety)}，未达 25%。好公司也需要好价格。`,
      pe_reasonable: () => out.missing
        ? '缺少 PE 数据，硬指标 Fail。'
        : pass
          ? `PE ${out.actual} 处于 ${m.sectorKey} 行业上限 ${out.threshold} 以内，估值可接受。`
          : `PE ${out.actual} 超过 ${m.sectorKey} 行业上限 ${out.threshold}，估值偏贵。`,
      pb_reasonable: () => out.missing
        ? '缺少 PB，软指标中性。'
        : pass
          ? `PB ${out.actual} 在合理区间（上限 ${out.threshold}）。`
          : `PB ${out.actual} 偏高，资产定价不便宜。`,
      peg_score: () => out.missing
        ? '无法计算 PEG（缺 PE 或增速）。'
        : pass
          ? `PEG ${out.actual} ≤ 2，成长与估值匹配（彼得·林奇框架）。`
          : `PEG ${out.actual} 偏高，为成长支付了过多溢价。`,
      pe_extreme_veto: () => pass
        ? '未出现 PE>80 且低增长的极端泡沫组合。'
        : `PE ${fmt(m.pe)} 极高且增速不足，估值泡沫风险大，触发否决。`,
      psychology_ok: () => pass
        ? '已通过「非 FOMO / 非翻本」心理自检，符合金钱心理学中的纪律要求。'
        : '未通过心理纪律自检——情绪化交易是最大敌人，暂缓操作。',
      position_cap: () => `按 ${m.rating || '—'} 评级，单票建议上限 ${out.actual.split(' ')[1] || out.actual}。`,
      sector_fit: () => pass
        ? `${m.industry || '未知行业'} 与当前估值体系匹配（${out.actual}）。`
        : `${m.industry || '未知行业'} 与估值/安全边际综合得分偏低，行业阶段需谨慎。`,
    };
    if (lines[rule.eval]) return lines[rule.eval]();
    if (out.veto) return `触发否决「${rule.name}」：${out.actual}。`;
    if (pass) return `${rule.name}达标（${out.actual} / ${out.threshold}）。`;
    return `${rule.name}未达标：实际 ${out.actual}，要求 ${out.threshold}。`;
  }

  function metricsSnapshot(m) {
    return {
      price: m.price,
      pe: m.pe,
      pb: m.pb,
      eps: m.eps,
      industry: m.industry,
      sectorKey: m.sectorKey,
      fairPe: m.fairPe,
      peCap: m.peCap,
      roeAvg: m.roeAvg,
      roeList: m.roeList,
      profitYears: m.profitYears,
      grossMargin: m.grossMargin,
      ocfRatio: m.ocfRatio,
      deductRatio: m.deductRatio,
      revenueYoy: m.revenueYoy,
      profitYoy: m.profitYoy,
      profitGrowth: m.profitGrowth,
      fairValue: m.fairValue,
      marginOfSafety: m.marginOfSafety,
      peg: m.peg,
      amount: m.amount,
    };
  }

  function buildAnalysis(metrics, results, ctx, decision) {
    const cfg = criteria.scoring;
    const snap = metricsSnapshot(metrics);
    const vetoes = results.filter(r => r.veto && !r.pass);
    const l0fail = results.filter(r => r.layer === 'L0' && r.type === 'hard' && !r.pass);
    const hardFail = decision.hard_failures || [];
    const layers = decision.layer_scores;
    const overall = decision.overall_score;
    const rating = decision.rating;
    const verdict = decision.verdict;

    const strengths = [];
    const weaknesses = [];
    const watchPoints = [];

    for (const r of results) {
      if (r.veto && !r.pass) weaknesses.push(`【否决】${r.name}：${r.reason}`);
      else if (r.type === 'hard' && !r.pass) weaknesses.push(`【硬指标】${r.id} ${r.name}：${r.reason}`);
      else if (r.pass && r.type === 'hard') strengths.push(`${r.name}：${r.reason}`);
      else if (!r.pass && r.type === 'soft') watchPoints.push(`${r.name}：${r.reason}`);
      else if (r.pass && r.type === 'soft' && (r.score || 0) >= 4) strengths.push(`${r.name}：${r.reason}`);
    }

    const valuation = {
      method: `${metrics.sectorKey} 行业公允 PE ${metrics.fairPe} × 最新 EPS ${fmt(metrics.eps)}`,
      fairValue: metrics.fairValue,
      price: metrics.price,
      marginOfSafety: metrics.marginOfSafety,
      peCap: metrics.peCap,
      narrative: metrics.fairValue != null
        ? [
            `行业分类：${metrics.industry || '未知'}（${metrics.sectorKey}），PE 上限 ${metrics.peCap}，公允 PE ${metrics.fairPe}。`,
            `公允价值 = EPS ${fmt(metrics.eps)} × 公允 PE ${metrics.fairPe} = ${fmt(metrics.fairValue)} 元。`,
            `现价 ${fmt(metrics.price)} 元 → 安全边际 ${pct(metrics.marginOfSafety)}（=(公允−现价)/公允，建仓线 25%）。`,
            metrics.pe != null ? `当前 PE ${fmt(metrics.pe)}，PEG ${metrics.peg != null ? fmt(metrics.peg) : '—'}。` : '',
          ].filter(Boolean).join('\n')
        : '缺少 EPS 或行情，无法完成格雷厄姆式安全边际测算。',
    };

    const layerCards = Object.keys(LAYER_META).map(k => {
      const meta = LAYER_META[k];
      const items = results.filter(r => r.layer === k);
      const fails = items.filter(r => !r.pass && (r.type === 'hard' || r.veto));
      const score = layers[k];
      let status = '通过';
      if (k === 'L0' && (vetoes.length || l0fail.length)) status = '未通过';
      else if (fails.length) status = '有缺口';
      else if (meta.min != null && score < meta.min) status = '偏弱';
      const detail = fails.length
        ? fails.map(r => `${r.id} ${r.name}（${r.actual}）`).join('；')
        : items.filter(r => r.pass && r.type === 'hard').map(r => r.name).join('、') || '无硬性检查项';
      return {
        layer: k,
        title: `${k} ${meta.name}`,
        score: k === 'L0' ? (status === '通过' ? 100 : 0) : score,
        status,
        weight: meta.weight,
        min: meta.min,
        desc: meta.desc,
        summary: `${meta.desc}。${status === '通过' ? '本层检查通过。' : status === '未通过' ? '本层存在否决或硬指标 Fail：' + detail : status === '有缺口' ? '硬指标未全过：' + detail : `软分 ${score}，参考线 ${meta.min}。`}`,
      };
    });

    const decisionPath = [];
    decisionPath.push({
      step: 1,
      title: 'L0 门禁',
      ok: !vetoes.length && !l0fail.length,
      detail: vetoes.length
        ? `触发否决：${vetoes.map(v => v.name).join('、')}`
        : l0fail.length
          ? `硬指标 Fail：${l0fail.map(r => r.name).join('、')}`
          : '非 ST、流动性达标、无造假嫌疑，可进入生意/财务/估值分析。',
    });
    decisionPath.push({
      step: 2,
      title: 'L1–L3 硬指标',
      ok: !hardFail.length,
      detail: hardFail.length
        ? `未过硬指标：${hardFail.join('、')}——见规则明细与分层解读。`
        : 'ROE、盈利年数、现金流质量、安全边际、PE 等硬门槛全部 Pass。',
    });
    decisionPath.push({
      step: 3,
      title: '综合评分',
      ok: overall >= cfg.overall_buy,
      detail: `加权总分 ${overall}（L1 ${layers.L1}×30% + L2 ${layers.L2}×25% + L3 ${layers.L3}×25% + L4 ${layers.L4}×10% + L5 ${layers.L5}×10%），评级 ${rating}（A≥80 / B≥72 / C≥60）。${overall >= cfg.overall_buy ? '达建仓分数线 72。' : '未达建仓线 72。'}`,
    });
    const l3mos = results.find(r => r.id === 'L3-01');
    decisionPath.push({
      step: 4,
      title: '安全边际',
      ok: l3mos && l3mos.pass,
      detail: l3mos
        ? (l3mos.pass
          ? `安全边际 ${l3mos.actual}，满足 25% 折价要求。`
          : `安全边际 ${l3mos.actual}，未达 25%——典型「好公司 + 不够便宜」情形。`)
        : '无法评估安全边际。',
    });
    decisionPath.push({
      step: 5,
      title: ctx.inPortfolio ? '持仓分支' : '新建仓分支',
      ok: ['买入', '持有'].includes(verdict),
      detail: ctx.inPortfolio
        ? `已持仓 → 按持有/减仓/卖出树：${decision.verdict_action}`
        : `未持仓 → 无否决 + 硬指标全过 + 总分≥72 + 安全边际≥25% 才「买入」，否则「观察」。当前：${verdict}。`,
    });
    decisionPath.push({
      step: 6,
      title: '最终判定',
      ok: !['排除', '卖出'].includes(verdict),
      detail: `${verdict}：${decision.verdict_action}`,
    });

    const execParts = [
      `${metrics.name}（${metrics.symbol}）${ctx.inPortfolio ? '【已持仓】' : '【未持仓】'}，${metrics.industry || '未知行业'}，现价 ${fmt(metrics.price)} 元。`,
      `综合判定「${verdict}」——${decision.verdict_action}`,
    ];
    if (vetoes.length) execParts.push(`首先，触发 ${vetoes.length} 项否决（${vetoes.map(v => v.name).join('、')}），原则上不应投资。`);
    else if (hardFail.length) execParts.push(`门禁通过，但 L1–L3 硬指标 ${hardFail.length} 项未达标（${hardFail.join('、')}），宜放入观察池等待改善或更好价格。`);
    else if (verdict === '买入') execParts.push('生意、财务、估值三层硬指标均过，总分与安全边际达建仓线，可分批买入。');
    else if (verdict === '观察' && l3mos && !l3mos.pass) execParts.push(`核心矛盾在估值：生意与财务尚可，但安全边际 ${pct(metrics.marginOfSafety)} 不足 25%，需耐心等待更好价格。`);
    else if (verdict === '持有') execParts.push('持仓逻辑未破，维持持有，未达加仓线则不追加。');
    else if (verdict === '减仓') execParts.push('估值偏高或边际转弱，建议降低敞口。');
    execParts.push(`评级 ${rating}（总分 ${overall}），单票上限 ${decision.position_hint.max_weight}。`);

    const logicDetailed = execParts.join('\n\n');

    return {
      executive: logicDetailed,
      valuation,
      strengths: strengths.slice(0, 8),
      weaknesses: weaknesses.slice(0, 8),
      watch_points: watchPoints.slice(0, 6),
      decision_path: decisionPath,
      layers: layerCards,
      key_metrics: [
        { label: '现价', value: `${fmt(metrics.price)} 元` },
        { label: 'PE', value: metrics.pe != null ? fmt(metrics.pe) : '—' },
        { label: 'PB', value: metrics.pb != null ? fmt(metrics.pb) : '—' },
        { label: 'ROE 均值', value: metrics.roeAvg != null ? `${fmt(metrics.roeAvg)}%` : '—' },
        { label: '毛利率', value: metrics.grossMargin != null ? `${fmt(metrics.grossMargin)}%` : '—' },
        { label: '利润 YoY', value: metrics.profitYoy != null ? `${fmt(metrics.profitYoy)}%` : '—' },
        { label: 'OCF/EPS', value: metrics.ocfRatio != null ? fmt(metrics.ocfRatio) : '—' },
        { label: '安全边际', value: metrics.marginOfSafety != null ? pct(metrics.marginOfSafety) : '—' },
        { label: '公允价', value: metrics.fairValue != null ? `${fmt(metrics.fairValue)} 元` : '—' },
        { label: 'PEG', value: metrics.peg != null ? fmt(metrics.peg) : '—' },
      ],
    };
  }

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

    const maxWeight = rating === 'A' ? '25%' : rating === 'B' ? '10%' : '0%';

    const base = {
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
      rules: results,
      position_hint: {
        suggested_weight: verdict === '买入' ? maxWeight : '0%',
        max_weight: maxWeight,
        reason: verdictAction,
      },
      in_portfolio: inPortfolio,
      metrics: metricsSnapshot(metrics),
    };

    base.analysis = buildAnalysis(metrics, results, ctx, base);
    base.logic_summary = base.analysis.executive;

    return base;
  }

  async function screen(input, ctx = {}) {
    await loadCriteria();
    const { metrics } = await ScreenData.loadStock(input);
    ctx.inPortfolio = ctx.inPortfolio ?? ScreenData.isInPortfolio(metrics.secid);

    const results = criteria.rules.map(rule => {
      const fn = EVALUATORS[rule.eval];
      if (!fn) return { ...rule, pass: true, actual: '—', threshold: '—', score: 3, result: 'skip', reason: '暂无评估器' };
      const out = fn(metrics, rule, ctx);
      const row = {
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
      row.reason = explainRule(rule, out, metrics, ctx);
      return row;
    });

    return decide(metrics, results, ctx);
  }

  return { loadCriteria, screen };
})();
