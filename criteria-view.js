/**
 * 判定标准网页编辑器 → GitHub Issue [criteria] → Actions 写入 criteria.json
 */
const CriteriaView = (() => {
  const REPO = 'RiddleGo/lcai-portfolio';
  const DRAFT_KEY = 'lcai-criteria-draft-v1';
  const POLL_MS = 15000;
  const POLL_MAX = 24;

  const TYPE_LABEL = { hard: '硬指标', soft: '软打分', veto: '一票否决' };
  const LAYER_HINT = {
    L0: '门禁：ST、流动性、造假、异常票',
    L1: '生意：ROE、盈利稳定性、护城河',
    L2: '财务：现金流、扣非、趋势',
    L3: '估值：安全边际、PE/PB/PEG',
    L4: '执行：心理、仓位',
    L5: '行业：行业与估值匹配',
  };

  let serverCfg = null;
  let draftCfg = null;
  let categoriesMeta = null;
  let booksIndex = null;
  let pollTimer = null;
  let pollCount = 0;
  let submitFingerprint = null;

  function el(id) {
    return document.getElementById(id);
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function fingerprint(cfg) {
    return JSON.stringify({
      v: cfg.version,
      buy: cfg.scoring?.overall_buy,
      rules: (cfg.rules || []).map(r => [r.id, r.threshold, r.threshold_hk, r.weight, r.name]),
      sectors: [cfg.sector_pe_caps, cfg.fair_pe_by_sector],
    });
  }

  function setStatus(msg, type = 'info') {
    const box = el('criteria-status');
    if (!box) return;
    box.hidden = !msg;
    if (msg) {
      box.textContent = msg;
      box.dataset.type = type;
    }
  }

  function thresholdHint(rule) {
    const map = {
      min_roe_avg: '单位：%，如 15 表示 ROE≥15%',
      min_profit_years: '单位：年，近 5 年至少几年盈利',
      gross_margin_score: '单位：%，毛利率下限',
      margin_of_safety: '单位：%，如 25 表示安全边际≥25%（存 0.25）',
      min_avg_amount: 'A股日均成交额，单位：亿',
      ocf_to_profit: '经营现金流/EPS，如 0.8',
      peg_score: 'PEG 上限，如 2',
      pb_reasonable: 'PB 上限',
      pe_reasonable: 'PE 上限（行业上限优先）',
      moat_proxy: '护城河代理得分下限',
      sector_fit: '行业适配得分下限',
      revenue_growth: '营收增速下限，单位：%',
      profit_yoy: '利润增速下限，单位：%',
      profit_trend: '盈利趋势下限，单位：%',
      deduct_eps_ratio: '扣非/EPS 比下限',
      dcf_cross_check: 'DCF 安全边际下限，单位：%',
      position_cap: '单票仓位上限，单位：%',
    };
    return map[rule.eval] || '';
  }

  function readThresholdInput(rule) {
    const id = rule.id.replace(/[^a-zA-Z0-9]/g, '_');
    if (rule.eval === 'margin_of_safety' || rule.eval === 'dcf_cross_check') {
      const pct = parseFloat(el(`th-${id}`)?.value);
      return Number.isFinite(pct) ? pct / 100 : rule.threshold;
    }
    if (rule.eval === 'min_avg_amount') {
      const a = parseFloat(el(`th-${id}-a`)?.value);
      const hk = parseFloat(el(`th-${id}-hk`)?.value);
      rule.threshold = Number.isFinite(a) ? Math.round(a * 1e8) : rule.threshold;
      if (Number.isFinite(hk)) rule.threshold_hk = Math.round(hk * 1e8);
      return rule.threshold;
    }
    if (typeof rule.threshold === 'boolean') return rule.threshold;
    const v = parseFloat(el(`th-${id}`)?.value);
    return Number.isFinite(v) ? v : rule.threshold;
  }

  function renderThresholdInputs(rule) {
    const id = rule.id.replace(/[^a-zA-Z0-9]/g, '_');
    if (typeof rule.threshold === 'boolean') {
      return '<span class="criteria-readonly">系统自动（是/否）</span>';
    }
    if (rule.eval === 'margin_of_safety' || rule.eval === 'dcf_cross_check') {
      const pct = rule.threshold != null ? (rule.threshold * 100) : '';
      return `<input type="number" class="criteria-inp" id="th-${id}" value="${pct}" step="1" min="0" max="100"> <span class="criteria-unit">%</span>`;
    }
    if (rule.eval === 'min_avg_amount') {
      const a = rule.threshold != null ? (rule.threshold / 1e8).toFixed(2) : '';
      const hk = rule.threshold_hk != null ? (rule.threshold_hk / 1e8).toFixed(2) : '';
      return `A股 <input type="number" class="criteria-inp criteria-inp-sm" id="th-${id}-a" value="${a}" step="0.01" min="0"> 亿 · 港股 <input type="number" class="criteria-inp criteria-inp-sm" id="th-${id}-hk" value="${hk}" step="0.01" min="0"> 亿`;
    }
    const val = rule.threshold != null ? rule.threshold : '';
    return `<input type="number" class="criteria-inp" id="th-${id}" value="${val}" step="any">`;
  }

  function renderBookSelect(rule) {
    const sid = rule.id.replace(/[^a-zA-Z0-9]/g, '_');
    const idx = booksIndex || window.LCAI_BOOKS_INDEX || { books: [] };
    const selected = new Set(rule.book_ids || []);
    const opts = (idx.books || []).map(b =>
      `<option value="${b.id}"${selected.has(b.id) ? ' selected' : ''}>${b.title}</option>`
    ).join('');
    const metaNames = (rule.meta_ids || []).map(mid =>
      (window.LCAI_META_SOURCES || {})[mid] || mid
    );
    const metaHtml = metaNames.length
      ? `<p class="criteria-hint">非书籍来源：${metaNames.join('、')}</p>` : '';
    const links = (rule.book_ids || []).map(bid => {
      const title = idx.by_id?.[bid]?.title || bid;
      return `<button type="button" class="books-rule-chip criteria-book-link" data-book-id="${bid}">${title}</button>`;
    }).join('');
    const bookCount = (rule.book_ids || []).length;
    return `
      <label>参考书籍（${bookCount} 本，多选 Ctrl/⌘）
        <select multiple class="criteria-inp criteria-book-select" id="books-${sid}" size="4">${opts}</select>
      </label>
      ${metaHtml}
      ${links ? `<div class="criteria-book-links">${links}</div>` : ''}`;
  }

  function renderEditor(cfg) {
    const box = el('criteria-content');
    if (!box || !cfg) return;
    const sc = cfg.scoring || {};
    const w = sc.weights || {};
    const sectors = Object.keys(cfg.sector_pe_caps || {}).filter(k => k !== 'default');

    let html = `
      <div class="card criteria-toolbar">
        <p class="criteria-lead">在这里改数字即可，<strong>不用写代码</strong>。改完点「提交到云端」，去 GitHub 点绿色 Submit，约 5–10 分钟生效并刷新全部股票报告。</p>
        <div class="criteria-actions">
          <button type="button" class="screen-btn" id="btn-criteria-submit">☁️ 提交到云端</button>
          <button type="button" class="screen-btn screen-btn-ghost" id="btn-criteria-draft">💾 保存草稿（本机）</button>
          <button type="button" class="screen-btn screen-btn-ghost" id="btn-criteria-reset">↩️ 恢复线上版本</button>
        </div>
        <div id="criteria-status" class="cloud-status" hidden></div>
        <div id="criteria-fallback" class="criteria-fallback" hidden></div>
        <p class="criteria-hint" id="criteria-merge-hint" style="margin-top:8px"></p>
      </div>

      <div class="card" style="margin-bottom:16px">
        <h2 class="criteria-h2">建仓线 & 总分权重</h2>
        <div class="criteria-grid-2">
          <label class="criteria-field">买入总分门槛（≥此分且硬指标全过才「买入」）
            <input type="number" class="criteria-inp" id="crit-overall-buy" value="${sc.overall_buy ?? 72}" min="0" max="100" step="1">
          </label>
        </div>
        <div class="criteria-weights">
          ${['L1', 'L2', 'L3', 'L4', 'L5'].map(k => `
            <label>${k} 权重 (%)
              <input type="number" class="criteria-inp criteria-inp-sm" id="crit-w-${k}" value="${((w[k] || 0) * 100).toFixed(0)}" min="0" max="100" step="1">
            </label>`).join('')}
        </div>
        <p class="criteria-hint">五层权重之和应为 100%。</p>
      </div>

      <div class="card" style="margin-bottom:16px">
        <h2 class="criteria-h2">行业估值（PE 上限 / 公允 PE / 关键词）</h2>
        <div style="overflow-x:auto"><table class="criteria-table"><thead><tr>
          <th>行业</th><th>PE 上限</th><th>公允 PE</th><th>匹配关键词（逗号分隔）</th>
        </tr></thead><tbody>`;

    for (const sec of sectors) {
      const kws = (cfg.sector_keywords?.[sec] || []).join('，');
      html += `<tr>
        <td>${sec}</td>
        <td><input type="number" class="criteria-inp criteria-inp-sm" data-sec-cap="${sec}" value="${cfg.sector_pe_caps?.[sec] ?? ''}" step="1"></td>
        <td><input type="number" class="criteria-inp criteria-inp-sm" data-sec-fair="${sec}" value="${cfg.fair_pe_by_sector?.[sec] ?? ''}" step="1"></td>
        <td><input type="text" class="criteria-inp" data-sec-kw="${sec}" value="${kws}" placeholder="如 医药,生物"></td>
      </tr>`;
    }
    html += `<tr><td>default（其他）</td>
      <td><input type="number" class="criteria-inp criteria-inp-sm" data-sec-cap="default" value="${cfg.sector_pe_caps?.default ?? 40}"></td>
      <td><input type="number" class="criteria-inp criteria-inp-sm" data-sec-fair="default" value="${cfg.fair_pe_by_sector?.default ?? 20}"></td>
      <td class="criteria-muted">—</td></tr>`;
    html += '</tbody></table></div></div>';

    const catOrder = (categoriesMeta?.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const rulesByCat = {};
    for (const r of cfg.rules || []) {
      const cat = r.category || 'gate';
      (rulesByCat[cat] = rulesByCat[cat] || []).push(r);
    }

    for (const cat of catOrder) {
      const items = rulesByCat[cat.id] || [];
      if (!items.length) continue;
      html += `<div class="card criteria-layer"><h2 class="criteria-h2">${cat.name} <span class="criteria-muted">(${cat.id})</span></h2>`;
      for (const r of items) {
        const sid = r.id.replace(/[^a-zA-Z0-9]/g, '_');
        html += `<div class="criteria-rule" data-rule-id="${r.id}">
          <div class="criteria-rule-head">
            <strong>${r.id}</strong> ${r.name}
            <span class="criteria-badge">${r.layer}</span>
            <span class="criteria-badge">${TYPE_LABEL[r.type] || r.type}</span>
          </div>
          <div class="criteria-rule-body">
            <label>门槛
              ${renderThresholdInputs(r)}
            </label>
            ${r.type === 'soft' ? `<label>权重 <input type="number" class="criteria-inp criteria-inp-sm" id="wt-${sid}" value="${r.weight ?? 5}" min="1" max="20"></label>` : ''}
            ${renderBookSelect(r)}
            <p class="criteria-hint">${thresholdHint(r)}</p>
          </div>
        </div>`;
      }
      html += '</div>';
    }

    box.innerHTML = html;
    box.querySelectorAll('.criteria-book-link').forEach(btn => {
      btn.addEventListener('click', () => window.BooksView?.openBook?.(btn.dataset.bookId));
    });
    el('btn-criteria-submit')?.addEventListener('click', submitToCloud);
    el('btn-criteria-draft')?.addEventListener('click', saveDraft);
    el('btn-criteria-reset')?.addEventListener('click', () => {
      if (serverCfg) { draftCfg = deepClone(serverCfg); renderEditor(draftCfg); setStatus('已恢复为当前线上版本', 'ok'); }
    });
  }

  function collectFromForm() {
    const cfg = deepClone(draftCfg || serverCfg);
    cfg.scoring = cfg.scoring || {};
    cfg.scoring.overall_buy = parseInt(el('crit-overall-buy')?.value, 10) || cfg.scoring.overall_buy;
    cfg.scoring.weights = cfg.scoring.weights || {};
    let wsum = 0;
    for (const k of ['L1', 'L2', 'L3', 'L4', 'L5']) {
      const v = parseFloat(el(`crit-w-${k}`)?.value);
      cfg.scoring.weights[k] = Number.isFinite(v) ? v / 100 : cfg.scoring.weights[k];
      wsum += cfg.scoring.weights[k] || 0;
    }
    if (Math.abs(wsum - 1) > 0.02) {
      throw new Error(`五层权重之和应为 100%，当前约 ${(wsum * 100).toFixed(0)}%`);
    }

    document.querySelectorAll('[data-sec-cap]').forEach(inp => {
      const sec = inp.dataset.secCap;
      cfg.sector_pe_caps = cfg.sector_pe_caps || {};
      cfg.sector_pe_caps[sec] = parseFloat(inp.value) || cfg.sector_pe_caps[sec];
    });
    document.querySelectorAll('[data-sec-fair]').forEach(inp => {
      const sec = inp.dataset.secFair;
      cfg.fair_pe_by_sector = cfg.fair_pe_by_sector || {};
      cfg.fair_pe_by_sector[sec] = parseFloat(inp.value) || cfg.fair_pe_by_sector[sec];
    });
    document.querySelectorAll('[data-sec-kw]').forEach(inp => {
      const sec = inp.dataset.secKw;
      if (!sec || sec === 'default') return;
      cfg.sector_keywords = cfg.sector_keywords || {};
      cfg.sector_keywords[sec] = inp.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    });

    for (const rule of cfg.rules || []) {
      if (rule.eval !== 'min_avg_amount') {
        const th = readThresholdInput(rule);
        if (th !== undefined) rule.threshold = th;
      } else {
        readThresholdInput(rule);
      }
      const sid = rule.id.replace(/[^a-zA-Z0-9]/g, '_');
      const wt = el(`wt-${sid}`);
      if (wt) rule.weight = parseInt(wt.value, 10) || rule.weight;
      const bookSel = el(`books-${sid}`);
      if (bookSel) {
        rule.book_ids = Array.from(bookSel.selectedOptions).map(o => o.value);
        const idx = booksIndex || window.LCAI_BOOKS_INDEX || { by_id: {} };
        rule.sources = rule.book_ids.map(id => idx.by_id?.[id]?.title).filter(Boolean);
      }
    }
    return cfg;
  }

  function issueBody(cfg) {
    return `请更新 LCAI 判定标准（网页编辑器提交，请勿修改下方 JSON）。\n\n\`\`\`json\n${JSON.stringify(cfg, null, 2)}\n\`\`\``;
  }

  function issueUrl(cfg) {
    const title = encodeURIComponent('[criteria] update');
    const body = encodeURIComponent(issueBody(cfg));
    return `https://github.com/${REPO}/issues/new?title=${title}&labels=criteria-bot&body=${body}`;
  }

  function showFallback(cfg) {
    const box = el('criteria-fallback');
    if (!box) return;
    const text = issueBody(cfg);
    box.hidden = false;
    box.innerHTML = `
      <p><strong>若 GitHub 新页面正文为空或不全</strong>，请复制下面内容，粘贴到 Issue 正文后再 Submit：</p>
      <textarea class="criteria-copy-area" id="criteria-copy-text" readonly></textarea>
      <button type="button" class="screen-btn screen-btn-ghost" id="btn-criteria-copy">复制正文</button>`;
    const ta = el('criteria-copy-text');
    if (ta) ta.value = text;
    el('btn-criteria-copy')?.addEventListener('click', async () => {
      const t = el('criteria-copy-text');
      if (!t) return;
      try {
        await navigator.clipboard.writeText(t.value);
      } catch {
        t.select();
        document.execCommand('copy');
      }
      setStatus('已复制，请粘贴到 GitHub Issue 正文', 'ok');
    });
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    pollCount = 0;
    el('btn-criteria-submit') && (el('btn-criteria-submit').disabled = false);
  }

  function startPolling() {
    stopPolling();
    pollCount = 0;
    el('btn-criteria-submit').disabled = true;
    pollTimer = setInterval(async () => {
      pollCount += 1;
      try {
        const resp = await fetch(lcaiAsset(`投资系统/criteria.json?t=${Date.now()}`));
        if (!resp.ok) return;
        const remote = await resp.json();
        if (submitFingerprint && fingerprint(remote) === submitFingerprint) {
          serverCfg = remote;
          draftCfg = deepClone(remote);
          localStorage.removeItem(DRAFT_KEY);
          renderEditor(draftCfg);
          setStatus('好了！判定标准已更新，全部报告正在或已经刷新。可去「选股」重新研判。', 'ok');
          stopPolling();
        }
      } catch (_) { /* wait */ }
      if (pollCount >= POLL_MAX) {
        setStatus('等得有点久。若 GitHub 还没点 Submit，请去点一下；点过了就稍后再打开本页。', 'warn');
        stopPolling();
      }
    }, POLL_MS);
  }

  function submitToCloud() {
    try {
      const cfg = collectFromForm();
      submitFingerprint = fingerprint(cfg);
      const url = issueUrl(cfg);
      if (url.length > 7500) {
        window.open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent('[criteria] update')}&labels=criteria-bot`, '_blank', 'noopener');
        showFallback(cfg);
        setStatus('正文较长：请在新 Issue 中粘贴下方内容后 Submit', 'pending');
      } else {
        window.open(url, '_blank', 'noopener');
        showFallback(cfg);
        setStatus('第 1 步：请在新页面点绿色 Submit。第 2 步：回到本页等待（约 5–10 分钟）。', 'pending');
      }
      startPolling();
    } catch (e) {
      setStatus(e.message || '请检查填写', 'warn');
    }
  }

  function saveDraft() {
    try {
      const cfg = collectFromForm();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(cfg));
      draftCfg = cfg;
      setStatus('草稿已保存在本浏览器', 'ok');
    } catch (e) {
      setStatus(e.message, 'warn');
    }
  }

  async function loadMergeHint() {
    const box = el('criteria-merge-hint');
    if (!box) return;
    try {
      const resp = await fetch(lcaiAsset('投资系统/book-rules-merge-report.md?t=' + Date.now()));
      if (!resp.ok) { box.textContent = ''; return; }
      const md = await resp.text();
      const m = md.match(/候选规则：\*\*(\d+)\*\*.*合并后：\*\*(\d+)\*\*/s);
      if (m) {
        box.innerHTML = `书籍→规则合并：110 本候选已合并进现有规则（见 <a href="${lcaiAsset('投资系统/book-rules-merge-report.md')}" target="_blank" rel="noopener">合并报告</a>）。`;
      }
    } catch (_) { /* optional */ }
  }

  async function loadMeta() {
    try {
      const [catResp, booksResp] = await Promise.all([
        fetch(lcaiAsset('投资系统/rule-categories.json')),
        Promise.resolve(window.LCAI_BOOKS_INDEX || null),
      ]);
      if (catResp.ok) categoriesMeta = await catResp.json();
      booksIndex = booksResp || window.LCAI_BOOKS_INDEX;
    } catch (_) {
      categoriesMeta = categoriesMeta || { categories: [] };
      booksIndex = window.LCAI_BOOKS_INDEX;
    }
  }

  function highlightRule(ruleId) {
    const node = document.querySelector(`.criteria-rule[data-rule-id="${ruleId}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('criteria-rule-highlight');
    setTimeout(() => node.classList.remove('criteria-rule-highlight'), 2500);
  }

  async function load() {
    const box = el('criteria-content');
    if (!box) return;
    box.innerHTML = '<p class="screen-loading">加载判定标准…</p>';
    setStatus('');
    try {
      await loadMeta();
      await loadMergeHint();
      const resp = await fetch(lcaiAsset(`投资系统/criteria.json?t=${Date.now()}`));
      if (!resp.ok) throw new Error(String(resp.status));
      serverCfg = await resp.json();
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        try {
          draftCfg = JSON.parse(saved);
          setStatus('已加载本机草稿（未提交云端前仅本机可见）', 'warn');
        } catch {
          draftCfg = deepClone(serverCfg);
        }
      } else {
        draftCfg = deepClone(serverCfg);
      }
      renderEditor(draftCfg);
    } catch (e) {
      box.innerHTML = `<p class="screen-error">加载失败：${e.message}</p>`;
    }
  }

  function init() {
    document.querySelector('.tab-btn[data-page="criteria"]')?.addEventListener('click', load);
  }

  return { init, load, highlightRule };
})();
