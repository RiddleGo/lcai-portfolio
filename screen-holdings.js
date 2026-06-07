/**
 * 网页加入持仓：表单 → GitHub Issue [holding] → Actions 写 holdings.json
 */
const ScreenHoldings = (() => {
  const REPO = 'RiddleGo/lcai-portfolio';
  const POLL_MS = 15000;
  const POLL_MAX = 24;

  let pollTimer = null;
  let pollCount = 0;
  let pendingCode = null;
  let pendingAccount = null;
  let lastPrice = null;

  function el(id) {
    return document.getElementById(id);
  }

  function codeKey(input) {
    const raw = String(input || '').replace(/\D/g, '');
    if (!raw) return '';
    if (raw.length <= 5) return raw.padStart(5, '0');
    return raw.slice(-6).padStart(6, '0');
  }

  function symbolCodeKey(secidOrCode) {
    const s = String(secidOrCode || '');
    if (s.includes('.')) return codeKey(s.split('.')[1]);
    return codeKey(s);
  }

  function holdingsList() {
    return (window.LCAI_HOLDINGS && window.LCAI_HOLDINGS.holdings) || [];
  }

  function findEntry(code, account) {
    const key = symbolCodeKey(code);
    const acct = String(account || '').toLowerCase();
    return holdingsList().find(h => !h.sold && h.account === acct && symbolCodeKey(h.symbol) === key);
  }

  function isInHoldings(code, account) {
    if (account) return !!findEntry(code, account);
    const key = symbolCodeKey(code);
    return holdingsList().some(h => !h.sold && symbolCodeKey(h.symbol) === key);
  }

  function setStatus(msg, type = 'info') {
    const box = el('cloud-status');
    if (!box || !msg) return;
    box.hidden = false;
    box.textContent = msg;
    box.dataset.type = type;
  }

  function issueHoldingUrl(payload) {
    const code = codeKey(payload.code);
    const title = encodeURIComponent(`[holding] ${code}`);
    const bodyObj = {
      code,
      name: payload.name || code,
      shares: Number(payload.shares),
      costPerShare: Number(payload.costPerShare),
      account: payload.account,
      fallbackPrice: Number(payload.fallbackPrice || payload.costPerShare),
    };
    const body = encodeURIComponent(
      `请更新 holdings.json（网页自动触发，请勿修改标题）。\n\n\`\`\`json\n${JSON.stringify(bodyObj, null, 2)}\n\`\`\``
    );
    return `https://github.com/${REPO}/issues/new?title=${title}&labels=holding-bot&body=${body}`;
  }

  function openModal(code, name, fallbackPrice) {
    const modal = el('holding-modal');
    if (!modal) return;
    const c = symbolCodeKey(code);
    const codeEl = el('holding-code');
    const nameEl = el('holding-name');
    if (codeEl) codeEl.value = c;
    if (nameEl) nameEl.value = name || c;
    if (el('holding-shares')) el('holding-shares').value = '';
    if (el('holding-cost')) el('holding-cost').value = fallbackPrice != null ? String(fallbackPrice) : '';
    if (el('holding-fallback')) el('holding-fallback').value = fallbackPrice != null ? String(fallbackPrice) : '';
    if (el('holding-account')) el('holding-account').value = 'hb';
    const err = el('holding-modal-error');
    if (err) { err.hidden = true; err.textContent = ''; }
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = el('holding-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  function showModalError(msg) {
    const err = el('holding-modal-error');
    if (err) {
      err.textContent = msg;
      err.hidden = false;
    } else {
      setStatus(msg, 'warn');
    }
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    pollCount = 0;
    pendingCode = null;
    pendingAccount = null;
    const btn = el('btn-add-holding');
    if (btn) btn.disabled = false;
  }

  async function fetchHoldingsJs() {
    const resp = await fetch(lcaiAsset(`holdings-data.js?t=${Date.now()}`));
    if (!resp.ok) throw new Error('holdings not ready');
    const text = await resp.text();
    const json = text.replace(/^window\.LCAI_HOLDINGS\s*=\s*/, '').replace(/;\s*$/, '');
    return JSON.parse(json);
  }

  function startPolling(code, account) {
    stopPolling();
    pendingCode = codeKey(code);
    pendingAccount = String(account).toLowerCase();
    pollCount = 0;
    const btn = el('btn-add-holding');
    if (btn) btn.disabled = true;
    setStatus('持仓提交中：请在新开的 GitHub 页点绿色 Submit，完成后本页会自动刷新（约 2–5 分钟）。', 'pending');

    pollTimer = setInterval(async () => {
      pollCount += 1;
      try {
        const data = await fetchHoldingsJs();
        window.LCAI_HOLDINGS = data;
        if (findEntry(pendingCode, pendingAccount)) {
          setStatus('好了！已加入持仓列表。刷新持仓页或重新「帮我看看」即可看到「已持仓」。', 'ok');
          updateCta(pendingCode, el('holding-name')?.value);
          stopPolling();
        }
      } catch (_) { /* wait */ }
      if (pollCount >= POLL_MAX) {
        setStatus('等得有点久了。若 GitHub 还没点 Submit，请去点一下；点过了就稍后再刷新本页。', 'warn');
        stopPolling();
      }
    }, POLL_MS);
  }

  function submitModal() {
    const code = el('holding-code')?.value?.trim();
    const name = el('holding-name')?.value?.trim();
    const shares = parseInt(el('holding-shares')?.value, 10);
    const cost = parseFloat(el('holding-cost')?.value);
    const fallback = parseFloat(el('holding-fallback')?.value) || cost;
    const account = el('holding-account')?.value || 'hb';

    if (!code || !Number.isFinite(shares) || shares <= 0) {
      showModalError('请填写有效股数');
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      showModalError('请填写有效成本价');
      return;
    }

    if (findEntry(code, account)) {
      showModalError('该账户已有此持仓');
      return;
    }

    closeModal();
    window.open(issueHoldingUrl({ code: symbolCodeKey(code), name, shares, costPerShare: cost, account, fallbackPrice: fallback }), '_blank', 'noopener');
    startPolling(symbolCodeKey(code), account);
  }

  function updateCta(code, name, fallbackPrice) {
    const btn = el('btn-add-holding');
    if (!btn) return;
    if (fallbackPrice != null) lastPrice = fallbackPrice;
    const c = symbolCodeKey(code);
    btn.hidden = false;
    if (findEntry(c, 'gt') && findEntry(c, 'hb')) {
      btn.textContent = '✅ 两账户均已持仓';
      btn.disabled = true;
      btn.onclick = null;
    } else if (isInHoldings(c)) {
      btn.textContent = '📥 加入持仓（另一账户）';
      btn.disabled = false;
      btn.onclick = () => openModal(c, name, lastPrice);
    } else {
      btn.textContent = '📥 加入持仓（网页提交）';
      btn.disabled = !!(pollTimer && pendingCode === c);
      btn.onclick = () => openModal(c, name, lastPrice);
    }
  }

  function prefillFromReport(report) {
    if (!report) return;
    lastPrice = report.price ?? report.metrics?.price ?? null;
    updateCta(report.symbol, report.name, lastPrice);
  }

  function init() {
    el('holding-modal-cancel')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
    el('holding-modal-submit')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      submitModal();
    });
    el('holding-modal')?.addEventListener('click', (e) => {
      if (e.target?.id === 'holding-modal') closeModal();
    });
    el('holding-modal')?.querySelector('.holding-modal-card')?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el('holding-modal') && !el('holding-modal').hidden) closeModal();
    });
  }

  return { init, updateCta, prefillFromReport, isInHoldings, openModal, closeModal };
})();
