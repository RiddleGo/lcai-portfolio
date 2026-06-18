(function () {
  var groups = window.LCAI_RESEARCH.groups;
  var bySlug = window.LCAI_RESEARCH.bySlug;
  var byFile = window.LCAI_RESEARCH.byFile;
  var lib = window.LCAI_RESEARCH.library;

  var params = new URLSearchParams(location.search);
  var legacyDoc = params.get("doc");
  if (legacyDoc && byFile[legacyDoc]) {
    location.replace("read.html?p=" + byFile[legacyDoc].slug);
    return;
  }
  var slug = params.get("p") || "guide";
  if (!bySlug[slug]) slug = "guide";

  var sidebar = document.getElementById("readSidebarNav");
  var home = document.createElement("a");
  home.href = "../../index.html";
  home.className = "kb-nav-link";
  home.textContent = "🏛 返回总入口";
  sidebar.appendChild(home);
  var catalog = document.createElement("a");
  catalog.href = "index.html";
  catalog.className = "kb-nav-link";
  catalog.textContent = "📚 研究目录";
  sidebar.appendChild(catalog);

  groups.forEach(function (group) {
    var gt = document.createElement("div");
    gt.className = "kb-nav-group-title";
    gt.textContent = group.title;
    sidebar.appendChild(gt);
    group.items.forEach(function (item) {
      var link = document.createElement("a");
      link.href = "read.html?p=" + item.slug;
      link.className = "kb-nav-link" + (item.slug === slug ? " active" : "");
      link.textContent = item.icon + " " + item.title;
      sidebar.appendChild(link);
    });
  });

  var body = document.getElementById("docBody");
  var titleEl = document.getElementById("articleTitle");
  var descEl = document.getElementById("articleDesc");
  var crumbEl = document.getElementById("breadcrumb");
  document.getElementById("readFooter").textContent = lib.disclaimer;

  function slugFromHref(href) {
    if (!href) return null;
    var m = href.match(/(?:read\.html\?p=|index\.html\?doc=)([^&"#]+)/);
    if (m) {
      var key = decodeURIComponent(m[1]);
      if (bySlug[key]) return key;
      if (byFile[key]) return byFile[key].slug;
    }
    var fileMatch = href.match(/([\w\-]+\.md)/);
    if (fileMatch && byFile[fileMatch[1]]) return byFile[fileMatch[1]].slug;
    return null;
  }

  function fixLinks(html) {
    html = html.replace(/href="\.\.\/资料文档\/[^"]*"/g, 'href="#" onclick="return false" title="原始资料仅本地存档"');
    html = html.replace(/href="([^"]+\.md)"/g, function (_, href) {
      var s = slugFromHref(href) || slugFromHref(href.split("/").pop());
      if (s) return 'href="read.html?p=' + s + '"';
      return 'href="#"';
    });
    return html;
  }

  function renderPage(item) {
    slug = item.slug;
    document.title = item.title + " · AI 五层产业研究 · LCAI";
    titleEl.textContent = item.title;
    descEl.textContent = item.desc;
    crumbEl.innerHTML =
      '<a href="index.html">研究目录</a> · ' +
      (item.layer ? "第 " + item.layer + " 层 · " : "") +
      item.title;

    sidebar.querySelectorAll(".kb-nav-link").forEach(function (el) {
      var href = el.getAttribute("href") || "";
      el.classList.toggle("active", href === "read.html?p=" + item.slug);
    });

    if (params.get("p") !== item.slug) {
      history.replaceState(null, "", "read.html?p=" + item.slug);
    }
  }

  async function loadDoc(item) {
    renderPage(item);
    body.innerHTML = '<p class="kb-loading">正在加载正文…</p>';
    try {
      var res = await fetch(item.file);
      if (!res.ok) throw new Error("内容暂时无法读取");
      var md = await res.text();
      body.innerHTML = fixLinks(marked.parse(md));
    } catch (e) {
      body.innerHTML = '<p class="kb-error">' + e.message + '，请返回目录重试。</p>';
    }
  }

  if (window.KBShell) KBShell.initSidebar();
  loadDoc(bySlug[slug]);
})();
