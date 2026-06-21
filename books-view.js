/**
 * 书籍知识库：筛选、阅读、关联规则跳转、Issue 提交
 */
const BooksView = (() => {
  const REPO = 'RiddleGo/lcai-portfolio';
  const DRAFT_PREFIX = 'lcai-book-draft-';

  let index = null;
  let selectedId = null;
  let filterTier = '';
  let filterDomain = '';
  let searchQuery = '';

  function bookDomain(b) {
    if (b.domain) return b.domain;
    const cats = (b.categories || []).join(' ');
    const section = b.section || '';
    if (/技术|编程|AI|软件|计算机/.test(cats + section)) return 'tech';
    if (/职业|管理|沟通|领导力/.test(cats + section)) return 'career';
    if (/通识|心理|传记|历史/.test(cats + section)) return 'general';
    return 'invest';
  }

  const DOMAIN_LABELS = { invest: '投资', tech: '技术', general: '通识', career: '职业' };

  function el(id) {
    return document.getElementById(id);
  }

  function getIndex() {
    return index || window.LCAI_BOOKS_INDEX || { books: [], by_id: {} };
  }

  const TIER_LABELS = { 1: '核心投资', 2: '投资辅助', 3: '行业研究' };

  function tierLabel(tier) {
    return TIER_LABELS[tier] || `Tier ${tier}`;
  }

  function filteredBooks() {
    const idx = getIndex();
    let list = idx.books || [];
    if (filterTier) list = list.filter(b => String(b.tier) === filterTier);
    if (filterDomain) list = list.filter(b => bookDomain(b) === filterDomain);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function renderList() {
    const listEl = el('books-list');
    if (!listEl) return;
    const books = filteredBooks();
    if (!books.length) {
      listEl.innerHTML = '<p class="books-empty">无匹配书籍</p>';
      return;
    }
    listEl.innerHTML = books.map(b => {
      const active = b.id === selectedId ? ' books-item-active' : '';
      const stub = statusBadge(b.status || 'stub');
      return `<button type="button" class="books-item${active}" data-book-id="${b.id}">
        <span class="books-item-title">${b.title} ${stub}</span>
        <span class="books-item-meta">${tierLabel(b.tier)} · ${DOMAIN_LABELS[bookDomain(b)] || bookDomain(b)}</span>
      </button>`;
    }).join('');
    listEl.querySelectorAll('.books-item').forEach(btn => {
      btn.addEventListener('click', () => selectBook(btn.dataset.bookId));
    });
  }

  function bindFilterEvents() {
    el('books-filter-tier')?.addEventListener('change', e => {
      filterTier = e.target.value;
      renderList();
    });
    el('books-filter-domain')?.addEventListener('change', e => {
      filterDomain = e.target.value;
      renderList();
    });
    el('books-search')?.addEventListener('input', e => {
      searchQuery = e.target.value.trim();
      renderList();
    });
  }

  function statusBadge(status) {
    const map = {
      stub: '<span class="books-stub">待完善</span>',
      analyzed: '<span class="books-stub" style="background:hsl(200 80% 45% / 0.12);color:hsl(200 70% 40%)">已分析</span>',
      needs_review: '<span class="books-stub">待审阅</span>',
      reviewed: '<span class="books-stub" style="background:hsl(140 60% 40% / 0.12);color:hsl(140 50% 35%)">已合并</span>',
    };
    return map[status] || map.stub;
  }

  function getCandidate(bookId) {
    const data = window.LCAI_BOOK_RULE_CANDIDATES || { candidates: [] };
    return (data.candidates || []).find(c => c.book_id === bookId);
  }

  function renderCandidateCard(bookId) {
    const c = getCandidate(bookId);
    if (!c) return '';
    return `<div class="books-candidate card" style="margin:12px 0;padding:12px">
      <strong>候选规则</strong> · ${c.id}
      <p class="books-meta">${c.name} · ${c.category} · eval: ${c.eval_hint || '—'} · 置信度 ${c.confidence ?? '—'}</p>
      <p style="font-size:0.82rem;margin:8px 0 0">${(c.principle || '').slice(0, 280)}${(c.principle || '').length > 280 ? '…' : ''}</p>
    </div>`;
  }

  function renderRuleChips(book) {
    const rules = book.related_rules || [];
    if (!rules.length) return '<p class="books-muted">暂无关联规则</p>';
    return rules.map(rid =>
      `<button type="button" class="books-rule-chip" data-rule-id="${rid}">${rid}</button>`
    ).join('');
  }

  function bookFileUrls(file) {
    const q = `t=${Date.now()}`;
    const local = lcaiAsset(`${file}?${q}`);
    const raw = `https://raw.githubusercontent.com/${REPO}/main/${encodeURI(file)}?${q}`;
    return { local, raw };
  }

  async function fetchBookMarkdown(file) {
    const { local, raw } = bookFileUrls(file);
    let resp = await fetch(local);
    // GitHub Pages + Jekyll 会把带 frontmatter 的 .md 编译成 .html，原 .md 返回 404
    if (!resp.ok) resp = await fetch(raw);
    return resp;
  }

  async function renderBookDetail(bookId) {
    const pane = el('books-detail');
    if (!pane) return;
    const book = getIndex().by_id?.[bookId];
    if (!book) {
      pane.innerHTML = '<p class="books-empty">未找到书籍</p>';
      return;
    }
    pane.innerHTML = '<p class="screen-loading">加载正文…</p>';
    try {
      const resp = await fetchBookMarkdown(book.file);
      if (!resp.ok) throw new Error(String(resp.status));
      const md = await resp.text();
      const htmlFn = window.HandbookView?.mdToHtml;
      const bodyHtml = htmlFn ? htmlFn(md) : `<pre>${md}</pre>`;
      const stubBadge = statusBadge(book.status || 'stub');
      pane.innerHTML = `
        <div class="books-detail-head">
          <h2>${book.title} ${stubBadge}</h2>
          <p class="books-meta">大类：${tierLabel(book.tier)} · <code>${book.id}</code> · ${book.status || 'stub'}</p>
          ${renderCandidateCard(bookId)}
          <div class="books-related">
            <span class="books-related-label">关联规则</span>
            ${renderRuleChips(book)}
          </div>
          <div class="books-actions">
            <button type="button" class="screen-btn" id="btn-book-submit">☁️ 提交到云端</button>
            <button type="button" class="screen-btn screen-btn-ghost" id="btn-book-draft">💾 保存草稿（本机）</button>
          </div>
          <div id="books-status" class="cloud-status" hidden></div>
          <div id="books-fallback" class="criteria-fallback" hidden></div>
        </div>
        <article class="handbook-article books-article">${bodyHtml}</article>`;
      pane.querySelectorAll('.books-rule-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          if (typeof switchTab === 'function') switchTab('criteria');
          setTimeout(() => window.CriteriaView?.highlightRule?.(chip.dataset.ruleId), 200);
        });
      });
      el('btn-book-submit')?.addEventListener('click', () => submitBook(bookId, md));
      el('btn-book-draft')?.addEventListener('click', () => saveDraft(bookId, md));
    } catch (e) {
      pane.innerHTML = `<p class="screen-error">加载失败：${e.message}</p>`;
    }
  }

  function selectBook(bookId) {
    selectedId = bookId;
    history.replaceState(null, '', `#books?book=${encodeURIComponent(bookId)}`);
    renderList();
    renderBookDetail(bookId);
  }

  function issuePayload(bookId, md) {
    const fmMatch = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const bodyMd = fmMatch ? fmMatch[2].trim() : md;
    return {
      book_id: bookId,
      frontmatter_patch: {},
      body_md: bodyMd,
    };
  }

  function issueBody(payload) {
    return `请更新 LCAI 书籍笔记（网页提交，请勿修改下方 JSON）。\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
  }

  function setStatus(msg, type = 'info') {
    const box = el('books-status');
    if (!box) return;
    box.hidden = !msg;
    if (msg) {
      box.textContent = msg;
      box.dataset.type = type;
    }
  }

  function showFallback(payload) {
    const box = el('books-fallback');
    if (!box) return;
    const text = issueBody(payload);
    box.hidden = false;
    box.innerHTML = `
      <p><strong>若 GitHub 新页面正文为空</strong>，请复制下面内容粘贴到 Issue 正文后再 Submit：</p>
      <textarea class="criteria-copy-area" id="books-copy-text" readonly></textarea>
      <button type="button" class="screen-btn screen-btn-ghost" id="btn-books-copy">复制正文</button>`;
    const ta = el('books-copy-text');
    if (ta) ta.value = text;
    el('btn-books-copy')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); } catch { ta?.select(); document.execCommand('copy'); }
      setStatus('已复制，请粘贴到 GitHub Issue 正文', 'ok');
    });
  }

  function submitBook(bookId, md) {
    const payload = issuePayload(bookId, md);
    const title = encodeURIComponent(`[book] ${bookId}`);
    const body = encodeURIComponent(issueBody(payload));
    const url = `https://github.com/${REPO}/issues/new?title=${title}&labels=book-bot&body=${body}`;
    if (url.length > 7500) {
      window.open(`https://github.com/${REPO}/issues/new?title=${title}&labels=book-bot`, '_blank', 'noopener');
    } else {
      window.open(url, '_blank', 'noopener');
    }
    showFallback(payload);
    setStatus('请在新开的 GitHub Issue 页点绿色 Submit（约 2–5 分钟生效）', 'pending');
  }

  function saveDraft(bookId, md) {
    localStorage.setItem(DRAFT_PREFIX + bookId, md);
    setStatus('草稿已保存在本浏览器（未提交前仅本机可见）', 'ok');
  }

  function renderShell() {
    const box = el('books-content');
    if (!box) return;
    box.innerHTML = `
      <div class="books-layout">
        <aside class="books-sidebar card">
          <p class="books-lead">本地改 <code>书籍/books/*.md</code> 或网页「提交到云端」。索引由脚本自动生成。</p>
          <label class="books-filter-label">领域
            <select id="books-filter-domain" class="criteria-inp">
              <option value="">全部</option>
              <option value="invest">投资</option>
              <option value="tech">技术</option>
              <option value="general">通识</option>
              <option value="career">职业</option>
            </select>
          </label>
          <label class="books-filter-label">大类
            <select id="books-filter-tier" class="criteria-inp">
              <option value="">全部</option>
              <option value="1">核心投资</option>
              <option value="2">投资辅助</option>
              <option value="3">行业研究</option>
            </select>
          </label>
          <label class="books-filter-label">搜索
            <input type="text" id="books-search" class="criteria-inp" placeholder="书名或 id">
          </label>
          <div id="books-list" class="books-list"></div>
        </aside>
        <div id="books-detail" class="books-detail card">
          <p class="books-empty">← 选择一本书阅读</p>
        </div>
      </div>`;
    bindFilterEvents();
    renderList();
  }

  function parseHashBookId() {
    const hash = location.hash || '';
    const m = hash.match(/[#&?]book=([^&]+)/) || hash.match(/^#books\/(.+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function load() {
    index = window.LCAI_BOOKS_INDEX;
    if (!index?.books?.length) {
      const box = el('books-content');
      if (box) box.innerHTML = '<p class="screen-error">书籍索引未加载（缺少 books-index-data.js）</p>';
      return;
    }
    renderShell();
    const fromHash = parseHashBookId();
    const first = fromHash && index.by_id?.[fromHash] ? fromHash : (index.books[0]?.id || null);
    if (first) selectBook(first);
  }

  function openBook(bookId) {
    if (typeof switchTab === 'function') switchTab('books');
    setTimeout(() => selectBook(bookId), 100);
  }

  function init() {
    document.querySelector('.tab-btn[data-page="books"]')?.addEventListener('click', load);
  }

  return { init, load, openBook };
})();
