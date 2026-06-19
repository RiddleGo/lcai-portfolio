/**
 * AI 五层产业定位（对接 docs/research + criteria.json ai_five_layers）
 */
const ScreenAiLayers = (() => {
  /** @type {Record<string, object>} */
  const BY_SYMBOL = {
    '002371': { layer: 'L2', layerName: '芯片', segment: '半导体设备（刻蚀/沉积）', bottleneck: 'binding', tier: '核心', substitution: '突破中', core86: true },
    '600584': { layer: 'L2', layerName: '芯片', segment: '先进封装 CoWoS 类', bottleneck: 'binding', tier: '核心', substitution: '突破中', core86: true },
    '688041': { layer: 'L2', layerName: '芯片', segment: '国产 AI 算力', bottleneck: 'binding', tier: '核心', substitution: '突破中', core86: true },
    '688256': { layer: 'L2', layerName: '芯片', segment: '国产 AI 算力', bottleneck: 'binding', tier: '增强', substitution: '突破中', core86: true },
    '300308': { layer: 'L3', layerName: '基础设施', segment: '800G 光模块', bottleneck: 'binding', tier: '核心', substitution: '已规模化', core86: true },
    '000977': { layer: 'L3', layerName: '基础设施', segment: 'AI 服务器', bottleneck: 'structural', tier: '核心', substitution: '已规模化', core86: true },
    '300442': { layer: 'L3', layerName: '基础设施', segment: 'AIDC 智算园区', bottleneck: 'structural', tier: '核心', substitution: '已规模化', core86: true },
    '601138': { layer: 'L3', layerName: '基础设施', segment: '云端服务器 ODM', bottleneck: 'structural', tier: '增强', substitution: '已规模化', core86: true },
    '002837': { layer: 'L1', layerName: '能源', segment: '液冷/温控', bottleneck: 'binding', tier: '核心', substitution: '突破中', core86: true },
    '600406': { layer: 'L1', layerName: '能源', segment: '算电协同/调度', bottleneck: 'binding', tier: '核心', substitution: '已规模化', core86: true },
    '002028': { layer: 'L1', layerName: '能源', segment: '变压器/GIS', bottleneck: 'structural', tier: '核心', substitution: '已规模化', core86: true },
    '002230': { layer: 'L4', layerName: '模型', segment: '垂直大模型平台', bottleneck: 'structural', tier: '核心', substitution: '突破中', core86: true },
    '688111': { layer: 'L4', layerName: '模型', segment: '订阅型 AI 软件', bottleneck: 'structural', tier: '核心', substitution: '突破中', core86: true },
    '688787': { layer: 'L4', layerName: '模型', segment: '训练语料/标注', bottleneck: 'structural', tier: '核心', substitution: '突破中', core86: true },
    '00700': { layer: 'L4', layerName: '模型', segment: '闭源/开源模型+云（算力通道）', bottleneck: 'structural', tier: '延伸观察', substitution: '突破中', core86: false },
    '002920': { layer: 'L5', layerName: '应用', segment: '智驾域控', bottleneck: 'structural', tier: '核心', substitution: '突破中', core86: true },
    '002415': { layer: 'L5', layerName: '应用', segment: '安防 AI', bottleneck: 'structural', tier: '核心', substitution: '已规模化', core86: true },
    '600570': { layer: 'L5', layerName: '应用', segment: '金融 IT / Agent', bottleneck: 'structural', tier: '核心', substitution: '已规模化', core86: true },
    '601127': { layer: 'L5', layerName: '应用', segment: '新能源车/智驾（华为链）', bottleneck: 'structural', tier: '叙事关联', substitution: '突破中', core86: false },
    '02013': { layer: 'L5', layerName: '应用', segment: 'SaaS / 商户服务', bottleneck: 'narrative', tier: '延伸观察', substitution: '不适用', core86: false },
    '01833': { layer: 'L5', layerName: '应用', segment: '互联网医疗', bottleneck: 'narrative', tier: '叙事关联', substitution: '不适用', core86: false },
    '06618': { layer: 'L5', layerName: '应用', segment: '医药电商', bottleneck: 'cyclical', tier: '叙事关联', substitution: '不适用', core86: false },
  };

  const INDUSTRY_HINTS = [
    { keys: ['半导体', '芯片', '集成电路'], layer: 'L2', layerName: '芯片', substitution: '突破中' },
    { keys: ['通信设备', '光模块', '通信'], layer: 'L3', layerName: '基础设施', substitution: '已规模化' },
    { keys: ['计算机', '软件', '互联网'], layer: 'L4', layerName: '模型', substitution: '突破中' },
    { keys: ['汽车', '乘用车', '新能源车'], layer: 'L5', layerName: '应用', substitution: '突破中' },
    { keys: ['专用设备', '温控', '电气'], layer: 'L1', layerName: '能源', substitution: '突破中' },
  ];

  function normalizeSymbol(symbol) {
    const s = String(symbol || '').replace(/\D/g, '');
    if (s.length === 5) return s.padStart(5, '0');
    return s.slice(-6).padStart(6, '0');
  }

  function lookup(symbol, industry) {
    const code = normalizeSymbol(symbol);
    if (BY_SYMBOL[code]) return { ...BY_SYMBOL[code], symbol: code, source: 'map' };
    const ind = industry || '';
    for (const h of INDUSTRY_HINTS) {
      if (h.keys.some(k => ind.includes(k))) {
        return {
          symbol: code,
          layer: h.layer,
          layerName: h.layerName,
          segment: ind || '—',
          bottleneck: 'structural',
          tier: '延伸观察',
          substitution: h.substitution,
          core86: false,
          source: 'industry',
        };
      }
    }
    return {
      symbol: code,
      layer: '—',
      layerName: '未映射',
      segment: ind || '—',
      bottleneck: '—',
      tier: '—',
      substitution: '—',
      core86: false,
      source: 'none',
    };
  }

  function renderCard(info) {
    if (!info || info.layer === '—') {
      return `<div class="ai-layer-card ai-layer-empty"><p class="ai-layer-title">AI 五层定位</p><p class="ai-layer-muted">未在 AI/国产替代映射表中 — 可能非主题标的</p></div>`;
    }
    const coreTag = info.core86 ? '<span class="ai-tag core">§8.6 核心</span>' : `<span class="ai-tag ext">${info.tier}</span>`;
    const bnCls = info.bottleneck === 'binding' ? 'binding' : info.bottleneck === 'narrative' ? 'narrative' : 'structural';
    return `<div class="ai-layer-card">
      <p class="ai-layer-title">AI 五层 · ${info.layer} ${info.layerName} ${coreTag}</p>
      <div class="ai-layer-grid">
        <div><span class="ai-k">环节</span><span class="ai-v">${info.segment}</span></div>
        <div><span class="ai-k">瓶颈</span><span class="ai-v ai-bn-${bnCls}">${info.bottleneck}</span></div>
        <div><span class="ai-k">国产替代</span><span class="ai-v">${info.substitution}</span></div>
        <div><span class="ai-k">研究分层</span><span class="ai-v">${info.tier}</span></div>
      </div>
      <p class="ai-layer-foot"><a href="${window.lcaiAsset ? lcaiAsset('docs/research/10_full_chain_industry_mapping.md') : 'docs/research/10_full_chain_industry_mapping.md'}" target="_blank" rel="noopener">全链映射表</a> · 产业位置不替代 LCAI 裁决</p>
    </div>`;
  }

  return { lookup, renderCard, normalizeSymbol, BY_SYMBOL };
})();
