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

  var navRoot = document.getElementById("readNav");
  var body = document.getElementById("docBody");
  var titleEl = document.getElementById("articleTitle");
  var descEl = document.getElementById("articleDesc");
  var crumbEl = document.getElementById("breadcrumb");
  document.getElementById("readFooter").textContent = lib.disclaimer;

  groups.forEach(function (group) {
    var wrap = document.createElement("div");
    wrap.className = "kb-nav-group";
    var label = document.createElement("div");
    label.className = "kb-nav-group-title";
    label.textContent = group.title;
    wrap.appendChild(label);
    group.items.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "kb-nav-link" + (item.slug === slug ? " active" : "");
      a.href = "read.html?p=" + item.slug;
      a.textContent = item.title;
      wrap.appendChild(a);
    });
    navRoot.appendChild(wrap);
  });

  function slugFromHref(href) {
    if (!href) return null;
    var m = href.match(/(?:read\.html\?p=|index\.html\?doc=)([^&"#]+)/);
    if (m) {
      var key = decodeURIComponent(m[1]);
      if (bySlug[key]) return key;
      if (byFile[key]) return byFile[key].slug;
    }
    var fileMatch = href.match(/(\d{2}[^"?#]+\.md|README\.md)/);
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
    html = html.replace(/href="(0[5-9][^"]*\.md)"/g, function (_, f) {
      if (byFile[f]) return 'href="read.html?p=' + byFile[f].slug + '"';
      return 'href="#"';
    });
    html = html.replace(/href="(10_[^"]*\.md)"/g, function (_, f) {
      if (byFile[f]) return 'href="read.html?p=' + byFile[f].slug + '"';
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
      '<a href="index.html">知识库</a> · ' +
      (item.layer ? '<span>第 ' + item.layer + ' 层</span> · ' : '') +
      '<span>' + item.title + '</span>';

    navRoot.querySelectorAll(".kb-nav-link").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("href") === "read.html?p=" + item.slug);
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
      body.innerHTML = '<p class="kb-error">' + e.message + '，请稍后重试或返回目录。</p>';
    }
  }

  document.getElementById("themeToggle").addEventListener("click", function () {
    var dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("lcai-theme", dark ? "dark" : "light");
  });

  loadDoc(bySlug[slug]);
})();
