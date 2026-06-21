(function (global) {
  "use strict";

  var plan = null;
  var DAILY_HABITS = [
    { id: "workout", label: "今日训练（力量 / 空腹有氧 / 恢复）", maps: "exercise" },
    { id: "sleep", label: "23:30 前睡觉" },
    { id: "protein", label: "三餐有蛋白" },
    { id: "routine", label: "晨间例行" },
  ];

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function load() {
    if (global.LifeSync) return LifeSync.getHealth();
    try {
      return JSON.parse(localStorage.getItem("life-health-v1") || "{}");
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    if (global.LifeSync) {
      LifeSync.setHealth(data);
      return;
    }
    localStorage.setItem("life-health-v1", JSON.stringify(data));
  }

  function todayPillar(p) {
    if (!p || !p.pillars) return null;
    var dow = new Date().getDay();
    for (var i = 0; i < p.pillars.length; i++) {
      var pillar = p.pillars[i];
      if ((pillar.days || []).indexOf(dow) >= 0) return pillar;
    }
    return null;
  }

  function renderPlan(p) {
    var box = document.getElementById("health-plan-today");
    if (!box || !p) return;
    var pillar = todayPillar(p);
    if (!pillar) {
      box.innerHTML = '<p class="module-page-desc">今日无固定训练类型 · 按 daily 打卡即可</p>';
      return;
    }
    box.innerHTML =
      '<div class="module-stat-card" style="margin-bottom:16px">' +
      '<div class="module-stat-label">今日 · ' + pillar.name + " · " + pillar.dayLabel + "</div>" +
      '<div style="font-weight:600;margin:6px 0">' + pillar.duration + "</div>" +
      '<p class="module-page-desc" style="margin:0">' + pillar.instruction + "</p></div>";

    var grid = document.getElementById("health-pillars-grid");
    if (grid) {
      grid.innerHTML = p.pillars
        .map(function (pl) {
          return (
            '<div class="module-stat-card"><div class="module-stat-label">' +
            pl.name +
            "</div><div style=\"font-size:0.82rem;color:var(--kb-text2);margin-bottom:6px\">" +
            pl.dayLabel +
            "</div><p class=\"module-page-desc\" style=\"margin:0;font-size:0.85rem\">" +
            pl.instruction.slice(0, 80) +
            "…</p></div>"
          );
        })
        .join("");
    }

    var rules = document.getElementById("health-plan-rules");
    if (rules && p.rules) {
      rules.innerHTML = "<ul>" + p.rules.map(function (r) { return "<li>" + r + "</li>"; }).join("") + "</ul>";
    }
  }

  function computeStreak(logs) {
    var streak = 0;
    var d = new Date();
    for (var i = 0; i < 365; i++) {
      var key = d.toISOString().slice(0, 10);
      var day = logs[key];
      if (!day) break;
      var ok = day.exercise && day.sleep && day.routine;
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
    grid.innerHTML = DAILY_HABITS.map(function (h) {
      var key = h.maps || h.id;
      var checked = data.logs[t][key] ? " checked" : "";
      return (
        '<label class="health-check-item"><input type="checkbox" data-habit="' +
        key +
        '"' +
        checked +
        "><span>" +
        h.label +
        "</span></label>"
      );
    }).join("");

    grid.querySelectorAll("input").forEach(function (cb) {
      cb.addEventListener("change", function () {
        data.logs[t][cb.dataset.habit] = cb.checked;
        data.streak = computeStreak(data.logs);
        save(data);
        updateStats(data);
        renderWeek(data);
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
    var core = ["exercise", "sleep", "routine"].filter(function (k) { return day[k]; }).length;
    if (streakEl) streakEl.textContent = String(data.streak || 0);
    if (todayEl) todayEl.textContent = core + " / 3";
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
      var count = ["exercise", "sleep", "routine"].filter(function (k) { return day[k]; }).length;
      var pct = Math.round((count / 3) * 100);
      html +=
        '<div class="module-stat-card"><div class="module-stat-label">' +
        key.slice(5) +
        '</div><div class="module-stat-value">' +
        count +
        "/3</div><div class=\"module-progress-bar\"><span style=\"width:" +
        pct +
        '%"></span></div></div>';
    }
    wrap.innerHTML = html;
  }

  function init() {
    var run = function () {
      fetch("plan.json")
        .then(function (r) { return r.json(); })
        .then(function (p) {
          plan = p;
          renderPlan(p);
          var sub = document.getElementById("health-hero-sub");
          if (sub && p.subtitle) sub.textContent = p.subtitle;
        })
        .catch(function () {});
      render();
      if (global.LifeSync) {
        LifeSync.onChange(function () { render(); });
      }
    };
    if (global.LifeSync && LifeSync.init) {
      LifeSync.init().then(run);
    } else {
      run();
    }
  }

  global.HealthView = { init: init, STORAGE_KEY: "life-health-v1" };
})(window);
