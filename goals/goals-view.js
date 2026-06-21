(function (global) {
  "use strict";

  function el(id) { return document.getElementById(id); }

  function renderGoals(data) {
    var obj = el("goals-objective");
    var quarter = el("goals-quarter");
    var list = el("goals-kr-list");
    if (obj) obj.textContent = data.objective || "—";
    if (quarter) quarter.textContent = (data.year || "") + " · " + ((data.quarter && data.quarter.name) || "");
    if (!list || !data.quarter) return;
    var krs = data.quarter.key_results || [];
    list.innerHTML = krs.map(function (kr) {
      var pct = kr.target ? Math.min(100, Math.round((kr.progress / kr.target) * 100)) : kr.progress;
      var link = kr.link ? ' <a href="' + kr.link + '" style="font-size:0.82rem">关联 →</a>' : "";
      return '<li class="goals-kr-item"><div class="goals-kr-head"><strong>' + kr.title + "</strong><span>" + kr.progress + " / " + kr.target + "</span></div><div class=\"module-progress-bar\"><span style=\"width:" + pct + '%"></span></div>' + link + "</li>";
    }).join("");
    var reviews = el("goals-reviews");
    if (reviews && data.reviews) {
      reviews.innerHTML = data.reviews.map(function (r) {
        return '<li><a href="reviews/' + r.id + '.md" target="_blank" rel="noopener">' + r.title + "</a>（Markdown）</li>";
      }).join("");
    }
  }

  function init() {
    fetch("goals.json")
      .then(function (r) { return r.json(); })
      .then(renderGoals)
      .catch(function () {
        if (el("goals-objective")) el("goals-objective").textContent = "无法加载 goals.json";
      });
  }

  global.GoalsView = { init: init };
})(window);
