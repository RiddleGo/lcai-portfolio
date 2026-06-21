(function (global) {
  "use strict";

  var STORAGE_KEY = "life-health-v1";
  var HABITS = [
    { id: "exercise", label: "运动 ≥30 分钟" },
    { id: "sleep", label: "23:30 前睡觉" },
    { id: "routine", label: "晨间例行（计划/阅读）" },
  ];

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function computeStreak(logs) {
    var streak = 0;
    var d = new Date();
    for (var i = 0; i < 365; i++) {
      var key = d.toISOString().slice(0, 10);
      var day = logs[key];
      if (!day) break;
      var ok = HABITS.every(function (h) { return day[h.id]; });
      if (!ok) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function render() {
    var data = load();
    if (!data.logs) data.logs = {};
    var t = today();
    if (!data.logs[t]) data.logs[t] = {};

    var grid = document.getElementById("health-check-grid");
    if (!grid) return;
    grid.innerHTML = HABITS.map(function (h) {
      var checked = data.logs[t][h.id] ? " checked" : "";
      return '<label class="health-check-item"><input type="checkbox" data-habit="' + h.id + '"' + checked + "><span>" + h.label + "</span></label>";
    }).join("");

    grid.querySelectorAll("input").forEach(function (cb) {
      cb.addEventListener("change", function () {
        data.logs[t][cb.dataset.habit] = cb.checked;
        data.streak = computeStreak(data.logs);
        save(data);
        updateStats(data);
      });
    });

    data.streak = computeStreak(data.logs);
    save(data);
    updateStats(data);
    renderWeek(data);
  }

  function updateStats(data) {
    var streakEl = document.getElementById("health-streak");
    var todayEl = document.getElementById("health-today-count");
    var t = today();
    var day = data.logs[t] || {};
    var count = HABITS.filter(function (h) { return day[h.id]; }).length;
    if (streakEl) streakEl.textContent = String(data.streak || 0);
    if (todayEl) todayEl.textContent = count + " / " + HABITS.length;
  }

  function renderWeek(data) {
    var wrap = document.getElementById("health-week-grid");
    if (!wrap) return;
    var html = "";
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = d.toISOString().slice(0, 10);
      var day = data.logs[key] || {};
      var count = HABITS.filter(function (h) { return day[h.id]; }).length;
      var pct = Math.round((count / HABITS.length) * 100);
      html += '<div class="module-stat-card"><div class="module-stat-label">' + key.slice(5) + '</div><div class="module-stat-value">' + count + "/" + HABITS.length + '</div><div class="module-progress-bar"><span style="width:' + pct + '%"></span></div></div>';
    }
    wrap.innerHTML = html;
  }

  global.HealthView = { init: render, STORAGE_KEY: STORAGE_KEY };
})(window);
