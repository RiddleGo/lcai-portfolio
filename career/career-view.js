(function (global) {
  "use strict";

  function renderProfile(data) {
    var role = document.getElementById("career-target-role");
    var path = document.getElementById("career-learning-path");
    var tbody = document.querySelector("#career-skills-table tbody");
    var projects = document.getElementById("career-projects");
    if (role) role.textContent = data.targetRole || "—";
    if (path) {
      path.innerHTML = (data.learningPath || []).map(function (p) {
        return "<li>" + p + "</li>";
      }).join("");
    }
    if (tbody) {
      tbody.innerHTML = (data.skills || []).map(function (s) {
        return "<tr><td>" + s.name + '</td><td><span class="skill-level">' + s.level + "</span></td><td>" + (s.score || "—") + "/5</td></tr>";
      }).join("");
    }
    if (projects) {
      projects.innerHTML = (data.projects || []).map(function (p) {
        var tags = (p.tags || []).map(function (t) {
          return '<span class="skill-level">' + t + "</span>";
        }).join(" ");
        var href = p.file || "#";
        return '<div class="module-stat-card"><div class="module-stat-label">' + p.period + "</div><strong>" + p.title + "</strong><p class=\"module-page-desc\">" + p.summary + "</p><p>" + tags + ' · <a href="' + href + '" target="_blank" rel="noopener">详情</a></p></div>';
      }).join("");
    }
  }

  function init() {
    fetch("profile.json")
      .then(function (r) { return r.json(); })
      .then(renderProfile)
      .catch(function () {
        var role = document.getElementById("career-target-role");
        if (role) role.textContent = "无法加载 profile.json";
      });
  }

  global.CareerView = { init: init };
})(window);
