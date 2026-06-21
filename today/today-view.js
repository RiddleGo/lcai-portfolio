(function (global) {
  "use strict";

  var goalsCache = null;
  var currentDay = null;

  function el(id) {
    return document.getElementById(id);
  }

  function loadGoals() {
    return fetch("../goals/goals.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        goalsCache = global.DailyTodo ? DailyTodo.applyGoalsOverrides(data) : data;
        return goalsCache;
      });
  }

  function groupByCategory(items) {
    var groups = [];
    var map = {};
    items.forEach(function (item) {
      if (!map[item.category]) {
        map[item.category] = { category: item.category, items: [] };
        groups.push(map[item.category]);
      }
      map[item.category].items.push(item);
    });
    return groups;
  }

  function onItemToggle(day, item, checked) {
    if (global.LifeSync) LifeSync.setDailyItemDone(day.date, item.id, checked);

    if (item.habitId && global.LifeSync) {
      var health = LifeSync.getHealth();
      if (!health.logs) health.logs = {};
      if (!health.logs[day.date]) health.logs[day.date] = {};
      health.logs[day.date][item.habitId] = checked;
      var habits = ["exercise", "sleep", "routine"];
      var streak = 0;
      var d = new Date();
      for (var i = 0; i < 365; i++) {
        var key = d.toISOString().slice(0, 10);
        var log = health.logs[key];
        if (!log || !habits.every(function (h) { return log[h]; })) break;
        streak++;
        d.setDate(d.getDate() - 1);
      }
      health.streak = streak;
      LifeSync.setHealth(health);
    }

    if (!day.completed) day.completed = {};
    day.completed[item.id] = checked;
    currentDay = day;
    render(day, goalsCache);
  }

  function render(day, goalsData) {
    if (!day) return;
    currentDay = day;
    var prog = DailyTodo.countProgress(day);
    var pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

    var sub = el("today-subtitle");
    if (sub) {
      var d = new Date(day.date + "T08:00:00");
      var w = "日一二三四五六"[d.getDay()];
      sub.textContent =
        day.date + " 周" + w + " · " + (goalsData.theme || day.theme || "") + " · 共 " + prog.total + " 项";
    }

    el("today-progress-text").textContent = prog.done + " / " + prog.total;
    el("today-progress-bar").style.width = pct + "%";
    el("today-generated").textContent = (day.generatedAt || "").slice(11, 16) || "—";

    var health = global.LifeSync ? LifeSync.getHealth() : {};
    el("today-streak").textContent = String(health.streak || 0);

    var wrap = el("today-sections");
    if (!wrap) return;

    var groups = groupByCategory(day.items || []);
    wrap.innerHTML = groups
      .map(function (g) {
        var label = DailyTodo.CAT_LABEL[g.category] || g.category;
        var itemsHtml = g.items
          .map(function (item) {
            var done = day.completed && day.completed[item.id];
            var opt = item.optional ? '<span class="today-item-tag">可选</span>' : "";
            return (
              '<label class="today-item' + (done ? " done" : "") + '">' +
              '<input type="checkbox" data-id="' + item.id + '"' + (done ? " checked" : "") + ">" +
              '<div class="today-item-body">' +
              '<div class="today-item-text">' + item.text + opt + "</div>" +
              (item.href ? '<a class="today-item-link" href="' + item.href + '">去模块 →</a>' : "") +
              "</div></label>"
            );
          })
          .join("");
        return '<section class="today-section"><div class="today-section-title">' + label + "</div>" + itemsHtml + "</section>";
      })
      .join("");

    wrap.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.dataset.id;
        var item = day.items.find(function (x) {
          return x.id === id;
        });
        if (item) onItemToggle(day, item, cb.checked);
      });
    });

    var preview = el("today-digest-preview");
    if (preview && !preview.hidden) {
      preview.textContent = DailyTodo.formatDigest(day, goalsData);
    }
  }

  function showDay(forceRegen) {
    return loadGoals().then(function (goals) {
      var day = forceRegen ? DailyTodo.regenerateToday(goals) : DailyTodo.ensureToday(goals);
      render(day, goals);
      return day;
    });
  }

  function init() {
    showDay(false).then(function (day) {
      el("today-copy-digest").addEventListener("click", function () {
        var text = DailyTodo.formatDigest(currentDay || day, goalsCache);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            alert("已复制今日摘要，可粘贴到微信 / 公众号草稿");
          });
        } else {
          prompt("复制以下内容：", text);
        }
      });

      el("today-toggle-digest").addEventListener("click", function () {
        var box = el("today-digest-preview");
        if (!box) return;
        box.hidden = !box.hidden;
        if (!box.hidden) box.textContent = DailyTodo.formatDigest(currentDay || day, goalsCache);
      });

      el("today-regenerate").addEventListener("click", function () {
        if (!confirm("重新生成今日清单？已勾选状态会重置。")) return;
        showDay(true);
      });
    });

    if (global.LifeSync) {
      LifeSync.onChange(function () {
        showDay(false);
      });
    }
  }

  global.TodayView = { init: init };
})(window);
