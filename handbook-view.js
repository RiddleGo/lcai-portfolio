/**
 * 维护手册：加载 投资系统/08-日常维护手册.md 并渲染为 HTML
 */
const HandbookView = (() => {
  const MD_PATH = '投资系统/08-日常维护手册.md';

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function rewriteLink(href) {
    if (!href) return '#';
    if (/^https?:\/\//i.test(href)) return href;
    if (href.includes('资产总览.html#screen') || href === '#screen') return '#screen';
    if (href.includes('资产总览.html#criteria') || href === '#criteria') return '#criteria';
    if (href.includes('资产总览.html#handbook') || href === '#handbook') return '#handbook';
    if (href.includes('资产总览.html#books') || href === '#books') return '#books';
    if (href.endsWith('criteria.json') || href === 'criteria.json') {
      return lcaiAsset('投资系统/criteria.json');
    }
    if (href.includes('holdings.json')) return lcaiAsset('holdings.json');
    return lcaiAsset(href.replace(/^\.\.\//, ''));
  }

  function inlineFormat(text) {
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const href = rewriteLink(url.trim());
      const cls = href.startsWith('#') ? ' class="handbook-jump"' : '';
      return `<a href="${href}"${cls} target="${href.startsWith('#') ? '_self' : '_blank'}" rel="noopener">${label}</a>`;
    });
    return s;
  }

  function parseTable(lines, start) {
    const rows = [];
    let i = start;
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      rows.push(lines[i].trim());
      i += 1;
    }
    if (rows.length < 2) return { html: '', next: start };
    const parseRow = row => row.split('|').slice(1, -1).map(c => c.trim());
    const header = parseRow(rows[0]);
    let bodyRows = rows.slice(2);
    let html = '<table class="handbook-table"><thead><tr>';
    html += header.map(c => `<th>${inlineFormat(c)}</th>`).join('');
    html += '</tr></thead><tbody>';
    for (const row of bodyRows) {
      html += '<tr>' + parseRow(row).map(c => `<td>${inlineFormat(c)}</td>`).join('') + '</tr>';
    }
    html += '</tbody></table>';
    return { html, next: i };
  }

  function mdToHtml(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trim = line.trim();

      if (!trim) { i += 1; continue; }

      if (trim === '---') {
        out.push('<hr>');
        i += 1;
        continue;
      }

      if (trim.startsWith('```')) {
        const lang = trim.slice(3).trim();
        i += 1;
        const codeLines = [];
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i += 1;
        }
        i += 1;
        out.push(`<pre class="handbook-pre"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        continue;
      }

      if (trim.startsWith('|')) {
        const t = parseTable(lines, i);
        out.push(t.html);
        i = t.next;
        continue;
      }

      if (trim.startsWith('### ')) {
        out.push(`<h3>${inlineFormat(trim.slice(4))}</h3>`);
        i += 1;
        continue;
      }
      if (trim.startsWith('## ')) {
        out.push(`<h2>${inlineFormat(trim.slice(3))}</h2>`);
        i += 1;
        continue;
      }
      if (trim.startsWith('# ')) {
        out.push(`<h1>${inlineFormat(trim.slice(2))}</h1>`);
        i += 1;
        continue;
      }

      if (trim.startsWith('> ')) {
        out.push(`<blockquote>${inlineFormat(trim.slice(2))}</blockquote>`);
        i += 1;
        continue;
      }

      if (/^[-*] /.test(trim)) {
        out.push('<ul>');
        while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
          out.push(`<li>${inlineFormat(lines[i].trim().slice(2))}</li>`);
          i += 1;
        }
        out.push('</ul>');
        continue;
      }

      if (/^\d+\. /.test(trim)) {
        out.push('<ol>');
        while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
          out.push(`<li>${inlineFormat(lines[i].trim().replace(/^\d+\.\s*/, ''))}</li>`);
          i += 1;
        }
        out.push('</ol>');
        continue;
      }

      out.push(`<p>${inlineFormat(trim)}</p>`);
      i += 1;
    }
    return out.join('\n');
  }

  function bindJumpLinks() {
    document.querySelectorAll('#handbook-content a.handbook-jump').forEach(a => {
      a.addEventListener('click', (e) => {
        const h = a.getAttribute('href');
        if (!h || !h.startsWith('#')) return;
        e.preventDefault();
        const page = h.slice(1);
        if (typeof switchTab === 'function') switchTab(page);
        else { location.hash = h; }
      });
    });
  }

  async function load() {
    const box = el('handbook-content');
    if (!box) return;
    box.innerHTML = '<p class="screen-loading">加载维护手册…</p>';
    try {
      const resp = await fetch(lcaiAsset(`${MD_PATH}?t=${Date.now()}`));
      if (!resp.ok) throw new Error(String(resp.status));
      const md = await resp.text();
      box.innerHTML = `<article class="handbook-article">${mdToHtml(md)}</article>`;
      bindJumpLinks();
    } catch (e) {
      box.innerHTML = `<p class="screen-error">手册加载失败：${e.message}</p>`;
    }
  }

  function init() {
    document.querySelector('.tab-btn[data-page="handbook"]')?.addEventListener('click', load);
  }

  return { init, load, mdToHtml };
})();
