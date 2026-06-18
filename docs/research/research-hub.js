(function () {
  var lib = window.LCAI_RESEARCH.library;
  var stats = window.LCAI_RESEARCH.stats;
  var groups = window.LCAI_RESEARCH.groups;
  var root = document.getElementById("hubRoot");
  var footer = document.getElementById("hubFooter");

  var hero = document.createElement("section");
  hero.className = "kb-hero";
  hero.innerHTML =
    '<p class="kb-eyebrow">' + lib.eyebrow + '</p>' +
    '<h1>' + lib.title + '<span class="kb-version">V ' + lib.version + '</span></h1>' +
    '<p class="kb-hero-lead">' + lib.subtitle + '</p>';

  var statList = document.createElement("ul");
  statList.className = "kb-stats";
  stats.forEach(function (s) {
    var li = document.createElement("li");
    li.innerHTML = '<span class="kb-stat-value">' + s.value + '</span><span class="kb-stat-label">' + s.label + '</span>';
    statList.appendChild(li);
  });
  hero.appendChild(statList);

  var layerGroup = groups.find(function (g) { return g.id === "layers"; });
  if (layerGroup) {
    var stack = document.createElement("div");
    stack.className = "kb-layer-stack";
    layerGroup.items.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "kb-layer-pill";
      a.href = "read.html?p=" + item.slug;
      a.textContent = item.title.replace("第 ", "").replace(" · ", " · ");
      stack.appendChild(a);
    });
    hero.appendChild(stack);
  }

  root.appendChild(hero);

  groups.forEach(function (group) {
    var head = document.createElement("h2");
    head.className = "kb-section-head";
    head.textContent = group.title;
    root.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "kb-card-grid";
    group.items.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "kb-card";
      a.href = "read.html?p=" + item.slug;
      a.innerHTML =
        '<span class="kb-card-icon">' + item.icon + '</span>' +
        '<span class="kb-card-body">' +
          '<p class="kb-card-title">' + item.title + '</p>' +
          '<p class="kb-card-desc">' + item.desc + '</p>' +
        '</span>' +
        '<span class="kb-card-arrow" aria-hidden="true">→</span>';
      grid.appendChild(a);
    });
    root.appendChild(grid);
  });

  footer.textContent = lib.disclaimer;

  document.getElementById("themeToggle").addEventListener("click", function () {
    var dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("lcai-theme", dark ? "dark" : "light");
  });
})();
