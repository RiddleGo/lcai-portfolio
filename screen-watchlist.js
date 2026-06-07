/**
 * 观察池：本机收藏 + 云端每周自动更新列表
 */
const ScreenWatchlist = (() => {
  const STORAGE_KEY = 'lcai-favorites-v1';

  function el(id) {
    return document.getElementById(id);
  }

  function normalize(input) {
    const sym = String(input || '').replace(/\D/g, '');
    if (sym.length === 5) return sym.padStart(5, '0');
    if (sym.length >= 6) return sym.slice(-6).padStart(6, '0');
    return sym;
  }

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveLocal(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function cloudSymbols() {
    return (window.LCAI_WATCHLIST && window.LCAI_WATCHLIST.symbols) || [];
  }

  function getAll() {
    const map = new Map();
    for (const s of cloudSymbols()) {
      map.set(normalize(s), { symbol: normalize(s), name: s, cloud: true });
    }
    for (const item of loadLocal()) {
      const code = normalize(item.symbol);
      map.set(code, { symbol: code, name: item.name || code, cloud: map.has(code) });
    }
    return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  function add(symbol, name) {
    const code = normalize(symbol);
    if (!code) return;
    const list = loadLocal().filter(x => normalize(x.symbol) !== code);
    list.unshift({ symbol: code, name: name || code });
    saveLocal(list.slice(0, 30));
    render();
    return code;
  }

  function remove(symbol) {
    const code = normalize(symbol);
    saveLocal(loadLocal().filter(x => normalize(x.symbol) !== code));
    render();
  }

  function chipsHtml(items) {
    if (!items.length) {
      return '<span class="watchlist-empty">还没有关注。研判后点「⭐ 收藏」加入云端队列。</span>';
    }
    return items.map(it =>
      `<button type="button" class="watchlist-chip" data-symbol="${it.symbol}" title="点我再看一次">
        ${it.name !== it.symbol ? it.name : it.symbol}${it.cloud ? ' ☁️' : ''}
      </button>`
    ).join('');
  }

  function wireChips(box, onPick) {
    if (!box) return;
    box.querySelectorAll('.watchlist-chip').forEach(btn => {
      btn.addEventListener('click', () => onPick(btn.dataset.symbol));
    });
  }

  function runOnScreen(symbol) {
    if (typeof window.switchTab === 'function') window.switchTab('screen');
    const input = el('symbol-input');
    if (input) input.value = symbol;
    window.ScreenUI?.init?.();
    el('btn-screen')?.click();
  }

  function renderBox(boxId, onPick) {
    const box = el(boxId);
    if (!box) return;
    box.innerHTML = chipsHtml(getAll());
    wireChips(box, onPick);
  }

  function render() {
    renderBox('watchlist-chips', runOnScreen);
    renderBox('home-watchlist-chips', (sym) => {
      const homeInput = el('home-symbol-input');
      if (homeInput) homeInput.value = sym;
      runOnScreen(sym);
    });
  }

  function isInCloud(symbol) {
    return cloudSymbols().map(normalize).includes(normalize(symbol));
  }

  function init() {
    render();
  }

  return { init, add, remove, render, getAll, isInCloud, normalize };
})();
