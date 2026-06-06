/**
 * 东方财富数据拉取 + 指标计算
 */
const ScreenData = (() => {
  const UA_HEADERS = { Referer: 'https://quote.eastmoney.com/' };

  function parseSymbol(input) {
    const raw = String(input || '').trim().toUpperCase().replace(/\s/g, '');
    if (!raw) throw new Error('请输入股票代码');

    let code = raw.replace(/^SH|^SZ|^HK|^HKEX/gi, '');
    if (raw.startsWith('HK') || raw.startsWith('HKEX')) code = code.replace(/^HK/i, '');

    if (/^\d{5}$/.test(code)) {
      return { market: 'HK', code, secid: `116.${code}`, display: code.padStart(5, '0') };
    }
    if (/^\d{6}$/.test(code)) {
      const prefix = code.startsWith('6') || code.startsWith('5') ? '1' : '0';
      return { market: 'A', code, secid: `${prefix}.${code}`, display: code };
    }
    throw new Error('代码格式无效，请输入 6 位 A 股或 5 位港股代码');
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { headers: UA_HEADERS });
    if (!resp.ok) throw new Error(`请求失败 ${resp.status}`);
    return resp.json();
  }

  async function fetchQuote(secid, market) {
    const fields = 'f43,f58,f162,f167,f116,f117,f48,f170,f171';
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}`;
    try {
      const data = await fetchJson(url);
      const d = data.data;
      if (d && d.f43 != null) {
        const priceDiv = market === 'HK' ? 1000 : 100;
        const price = d.f43 / priceDiv;
        const pe = d.f162 > 0 ? d.f162 / 100 : null;
        const pb = d.f167 > 0 ? d.f167 / 100 : null;
        return { name: d.f58 || secid, price, pe, pb, amount: d.f48 || 0, changePct: (d.f170 || 0) / 100, marketCap: d.f116 };
      }
    } catch (_) { /* fallback */ }
    return fetchQuoteSina(secid, market);
  }

  async function fetchQuoteSina(secid, market) {
    const code = secid.split('.')[1];
    const prefix = market === 'HK' ? `rt_hk${code}` : (secid.startsWith('1.') ? `sh${code}` : `sz${code}`);
    const url = `https://hq.sinajs.cn/list=${prefix}`;
    const resp = await fetch(url);
    const raw = await resp.text();
    const body = raw.split('="')[1]?.split('";')[0] || '';
    const parts = body.split(',');
    if (market === 'HK') {
      return { name: parts[1] || code, price: parseFloat(parts[6]) || 0, pe: null, pb: null, amount: parseFloat(parts[12]) || 0, changePct: 0 };
    }
    const price = parseFloat(parts[3]) || 0;
    const epsHint = null;
    return { name: parts[0] || code, price, pe: null, pb: null, amount: parseFloat(parts[9]) || 0, changePct: 0 };
  }

  async function fetchFinancials(code) {
    const cols = [
      'SECURITY_CODE', 'REPORTDATE', 'WEIGHTAVG_ROE', 'XSMLL', 'PARENT_NETPROFIT',
      'TOTAL_OPERATE_INCOME', 'BASIC_EPS', 'DEDUCT_BASIC_EPS', 'MGJYXJJE', 'YSTZ', 'SJLTZ', 'PUBLISHNAME'
    ].join(',');
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_CPD&columns=${cols}&filter=(SECURITY_CODE%3D%22${code}%22)&pageNumber=1&pageSize=20&sortTypes=-1&sortColumns=REPORTDATE`;
    const data = await fetchJson(url);
    const rows = (data.result && data.result.data) || [];
    if (!rows.length) throw new Error('未获取到财务数据');
    return rows.map(r => ({
      date: r.REPORTDATE,
      roe: num(r.WEIGHTAVG_ROE),
      grossMargin: num(r.XSMLL),
      netProfit: num(r.PARENT_NETPROFIT),
      revenue: num(r.TOTAL_OPERATE_INCOME),
      eps: num(r.BASIC_EPS),
      deductEps: num(r.DEDUCT_BASIC_EPS),
      ocfPerShare: num(r.MGJYXJJE),
      revenueYoy: num(r.YSTZ),
      profitYoy: num(r.SJLTZ),
      industry: r.PUBLISHNAME || '',
      isAnnual: String(r.REPORTDATE || '').includes('12-31'),
    }));
  }

  function num(v) {
    if (v == null || v === '' || v === '-') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function annualRows(rows) {
    const annual = rows.filter(r => r.isAnnual);
    return annual.length ? annual : rows.slice(0, 5);
  }

  function buildMetrics(parsed, quote, finRows) {
    const annual = annualRows(finRows);
    const latest = finRows[0];
    const latestAnnual = annual[0] || latest;

    const roeList = annual.slice(0, 5).map(r => r.roe).filter(v => v != null);
    const roeAvg = roeList.length ? roeList.reduce((a, b) => a + b, 0) / roeList.length : null;

    const profitYears = annual.slice(0, 5).filter(r => (r.netProfit || 0) > 0).length;
    const grossMargin = latestAnnual.grossMargin;

    const ocfRatios = annual.slice(0, 3).map(r => {
      if (r.ocfPerShare == null || r.eps == null || r.eps <= 0) return null;
      return r.ocfPerShare / r.eps;
    }).filter(v => v != null);
    const ocfRatio = ocfRatios.length ? ocfRatios.reduce((a, b) => a + b, 0) / ocfRatios.length : null;

    let deductRatio = null;
    if (latestAnnual.deductEps != null && latestAnnual.eps != null && latestAnnual.eps > 0) {
      deductRatio = latestAnnual.deductEps / latestAnnual.eps;
    } else if (latestAnnual.deductEps == null && latestAnnual.eps > 0) {
      deductRatio = 1;
    }

    const industry = latest.industry || '';
    const sectorKey = detectSector(industry);
    const fairPe = sectorKey.fairPe;
    const peCap = sectorKey.peCap;
    const eps = latestAnnual.eps || latest.eps;
    let fairValue = null;
    let marginOfSafety = null;
    if (eps != null && eps > 0 && quote.price > 0) {
      fairValue = eps * fairPe;
      marginOfSafety = (fairValue - quote.price) / fairValue;
    }

    const profitYoys = finRows.slice(0, 4).map(r => r.profitYoy).filter(v => v != null);
    const profitCollapse = profitYoys.length >= 3 && profitYoys.every(v => v < -15);

    const pe = quote.pe;
    const profitGrowth = latest.profitYoy != null ? latest.profitYoy : latest.revenueYoy;
    const peComputed = pe != null ? pe : (eps != null && eps > 0 && quote.price > 0 ? quote.price / eps : null);
    const peg = peComputed != null && profitGrowth != null && profitGrowth > 0 ? peComputed / profitGrowth : null;
    const peExtreme = peComputed != null && peComputed > 80 && (profitGrowth == null || profitGrowth < 10);

    const trapFlags = [];
    if (peComputed != null && peComputed > 100 && (profitGrowth == null || profitGrowth < 5)) {
      trapFlags.push('极高PE+低增速');
    }
    if (quote.amount < 30000000 && peComputed != null && peComputed > 60) {
      trapFlags.push('低流动性+高估值');
    }
    if (peExtreme) trapFlags.push('极端估值');

    const g = Math.min(Math.max((profitGrowth || 5) / 100, 0.02), 0.15);
    const wacc = 0.09;
    let dcfFairValue = null;
    let dcfMarginOfSafety = null;
    if (eps != null && eps > 0 && quote.price > 0 && wacc > 0.025) {
      dcfFairValue = eps * (1 + g) / (wacc - 0.025);
      dcfMarginOfSafety = (dcfFairValue - quote.price) / dcfFairValue;
    }

    return {
      symbol: parsed.display,
      secid: parsed.secid,
      market: parsed.market,
      name: quote.name,
      price: quote.price,
      pe: peComputed ?? pe,
      pb: quote.pb,
      amount: quote.amount,
      industry,
      sectorKey: sectorKey.key,
      fairPe,
      peCap,
      roeAvg,
      roeList,
      profitYears,
      grossMargin,
      ocfRatio,
      ocfRatios,
      deductRatio,
      revenueYoy: latest.revenueYoy,
      profitYoy: latest.profitYoy,
      profitCollapse,
      fairValue,
      marginOfSafety,
      peg,
      profitGrowth,
      eps,
      isSt: /ST/i.test(quote.name),
      fraudSuspect: ocfRatio != null && ocfRatio < 0.3 && (latest.netProfit || 0) > 0,
      ocfVeto: ocfRatios.length >= 2 && ocfRatios.every(v => v < 0.5),
      peExtreme,
      trapFlags,
      trapSuspect: trapFlags.length >= 2,
      dcfFairValue,
      dcfMarginOfSafety,
      dcfGrowth: g,
      dcfWacc: wacc,
    };
  }

  function detectSector(industry) {
    const cfg = window.LCAI_CRITERIA || {};
    const peCaps = cfg.sector_pe_caps || {};
    const fairPes = cfg.fair_pe_by_sector || {};
    const rules = [
      ['白酒', ['白酒', '酒']],
      ['银行', ['银行']],
      ['金融', ['保险', '证券', '金融']],
      ['半导体', ['半导体', '芯片', '集成电路']],
      ['软件', ['软件', '互联网', '计算机']],
      ['汽车', ['汽车', '新能源车', '汽']],
      ['医药', ['医药', '生物', '医疗']],
      ['消费', ['消费', '食品', '零售', '家电']],
    ];
    for (const [key, kws] of rules) {
      if (kws.some(k => industry.includes(k))) {
        return { key, peCap: peCaps[key] || peCaps.default || 40, fairPe: fairPes[key] || fairPes.default || 20 };
      }
    }
    return { key: 'default', peCap: peCaps.default || 40, fairPe: fairPes.default || 20 };
  }

  async function loadStock(input) {
    const parsed = parseSymbol(input);
    const [quote, finRows] = await Promise.all([
      fetchQuote(parsed.secid, parsed.market),
      fetchFinancials(parsed.code),
    ]);
    const metrics = buildMetrics(parsed, quote, finRows);
    return { parsed, quote, finRows, metrics };
  }

  function isInPortfolio(secid) {
    const prices = (window.LCAI_QUOTES && window.LCAI_QUOTES.prices) || {};
    return Object.prototype.hasOwnProperty.call(prices, secid);
  }

  return { parseSymbol, loadStock, isInPortfolio, detectSector };
})();
