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
        return '<div class="module-stat-card"><div class="module-stat-label">' + p.period + "</div><strong>" + p.title + "</strong><p class=\"module-page-desc\">" + p.summary + "</p><p>" + tags + ' · <a href="' + href + '">详情</a></p></div>';
      }).join("");
    }
  }

  function renderPlan(plan) {
    var north = document.getElementById("career-north-star");
    if (north) north.textContent = plan.northStar || "";

    var phase = document.getElementById("career-phase");
    if (phase) phase.textContent = plan.phase || "";

    var rhythm = document.getElementById("career-weekly-rhythm");
    if (rhythm) {
      rhythm.innerHTML = (plan.weeklyRhythm || [])
        .map(function (r) {
          return "<li><strong>" + r.block + "</strong> — " + r.action + "</li>";
        })
        .join("");
    }

    var month = document.getElementById("career-this-month");
    if (month) {
      month.innerHTML = (plan.thisMonth || []).map(function (x) { return "<li>" + x + "</li>"; }).join("");
    }

    var ms = document.getElementById("career-milestones");
    if (ms) {
      ms.innerHTML = (plan.milestones || [])
        .map(function (m) {
          var steps = (m.steps || []).map(function (s) { return "<li>" + s + "</li>"; }).join("");
          return (
            '<div class="module-stat-card"><div class="module-stat-label">' +
            m.deadline +
            "</div><strong>" +
            m.title +
            '</strong><ul class="module-page-desc" style="margin:8px 0 0;padding-left:18px">' +
            steps +
            "</ul></div>"
          );
        })
        .join("");
    }

    var avoid = document.getElementById("career-avoid");
    if (avoid) {
      avoid.innerHTML = (plan.avoid || []).map(function (x) { return "<li>" + x + "</li>"; }).join("");
    }
  }

  function init() {
    Promise.all([
      fetch("profile.json").then(function (r) { return r.json(); }),
      fetch("plan.json").then(function (r) { return r.json(); }),
    ])
      .then(function (results) {
        renderProfile(results[0]);
        renderPlan(results[1]);
      })
      .catch(function () {
        var role = document.getElementById("career-target-role");
        if (role) role.textContent = "无法加载";
      });
  }

  global.CareerView = { init: init };
})(window);
