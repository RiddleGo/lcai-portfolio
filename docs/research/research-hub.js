(function () {
  var lib = window.LCAI_RESEARCH.library;
  var stats = window.LCAI_RESEARCH.stats;
  var groups = window.LCAI_RESEARCH.groups;
  var allItems = window.LCAI_RESEARCH.allItems;

  document.getElementById("hubSubtitle").innerHTML =
    lib.subtitle.replace(/(\d+)/g, "<b>$1</b>").replace(/能源/g, "<b>能源</b>");
  document.getElementById("hubVersion").textContent = "V " + lib.version;
  document.getElementById("hubDisclaimer").textContent = lib.disclaimer;

  var statsEl = document.getElementById("hubStats");
  stats.forEach(function (s) {
    var a = document.createElement("a");
    a.className = "kb-stat-item";
    a.href = s.href || "index.html";
    a.innerHTML = '<div class="kb-stat-num">' + s.value + '</div><div class="kb-stat-label">' + s.label + '</div>';
    statsEl.appendChild(a);
  });

  var sidebar = document.getElementById("researchSidebarNav");
  var home = document.createElement("a");
  home.href = "../../index.html";
  home.className = "kb-nav-link";
  home.textContent = "🏛 返回总入口";
  sidebar.appendChild(home);
  var catalog = document.createElement("a");
  catalog.href = "index.html";
  catalog.className = "kb-nav-link kb-nav-home active";
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
      link.className = "kb-nav-link";
      link.textContent = item.icon + " " + item.title;
      sidebar.appendChild(link);
    });
  });

  var root = document.getElementById("hubGroups");
  groups.forEach(function (group) {
    var section = document.createElement("div");
    section.className = "kb-section";
    section.innerHTML =
      '<div class="kb-section-header">' +
        '<h2 class="kb-section-title">' + group.title + '</h2>' +
        '<div class="kb-section-line"></div>' +
        '<span class="kb-section-count">' + group.items.length + ' 篇</span>' +
      '</div>';
    var grid = document.createElement("div");
    grid.className = "kb-nav-cards" + (group.id === "layers" ? " cols-5" : " cols-4");
    group.items.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "kb-nav-card";
      a.href = "read.html?p=" + item.slug;
      a.innerHTML =
        '<span class="kb-nav-card-icon">' + item.icon + '</span>' +
        '<div class="kb-nav-card-title">' + item.title + '</div>' +
        '<div class="kb-nav-card-sub">' + item.desc + '</div>' +
        '<span class="kb-nav-card-arrow">→</span>';
      grid.appendChild(a);
    });
    section.appendChild(grid);
    root.appendChild(section);
  });

  if (window.KBShell) KBShell.initSidebar();
})();
