(function (global) {
  "use strict";

  var goalsCache = null;
  var currentDay = null;

  function el(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cbId(itemId) {
    return "today-cb-" + itemId.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function showError(msg) {
    var sub = el("today-subtitle");
    if (sub) sub.textContent = "加载失败，请刷新重试";
    var wrap = el("today-sections");
    if (wrap) {
      wrap.innerHTML =
        '<p class="today-error" style="color:#c44;padding:1rem;background:#fff5f5;border-radius:8px">' +
        esc(msg) +
        "</p>";
    }
  }

  function loadGoals() {
    return fetch("../goals/goals.json")
      .then(function (r) {
        if (!r.ok) throw new Error("无法读取 goals.json（" + r.status + "）");
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

  function updateProgressUI(day, goalsData) {
    if (!day) return;
    var prog = DailyTodo.countProgress(day);
    var pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

    var sub = el("today-subtitle");
    if (sub) {
      var d = new Date(day.date + "T08:00:00");
      var w = "日一二三四五六"[d.getDay()];
      sub.textContent =
        day.date + " 周" + w + " · " + ((goalsData && goalsData.theme) || day.theme || "") + " · 共 " + prog.total + " 项";
    }

    if (el("today-progress-text")) el("today-progress-text").textContent = prog.done + " / " + prog.total;
    if (el("today-progress-bar")) el("today-progress-bar").style.width = pct + "%";

    var health = global.LifeSync ? LifeSync.getHealth() : {};
    if (el("today-streak")) el("today-streak").textContent = String(health.streak || 0);
  }

  function updateRowUI(itemId, checked) {
    var cb = document.querySelector('#today-sections input[data-id="' + itemId + '"]');
    if (!cb) return;
    var row = cb.closest(".today-item");
    if (!row) return;
    row.classList.toggle("done", !!checked);
    cb.checked = !!checked;
  }

  function onItemToggle(day, item, checked) {
    if (!day.completed) day.completed = {};
    day.completed[item.id] = checked;

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

    if (global.LifeSync) {
      LifeSync.saveDailyTodoDay(day.date, day);
    }

    currentDay = day;
    updateRowUI(item.id, checked);
    updateProgressUI(day, goalsCache);

    var preview = el("today-digest-preview");
    if (preview && !preview.hidden) {
      preview.textContent = DailyTodo.formatDigest(day, goalsCache);
    }
  }

  function render(day, goalsData) {
    if (!day) return;
    currentDay = day;
    updateProgressUI(day, goalsData);

    if (el("today-generated")) {
      el("today-generated").textContent = (day.generatedAt || "").slice(11, 16) || "—";
    }

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
            var id = cbId(item.id);
            var linkHtml = item.href
              ? '<a class="today-item-link" href="' +
                esc(item.href) +
                '">' +
                esc(item.linkLabel || DailyTodo.linkLabel(item.category)) +
                "</a>"
              : "";
            return (
              '<div class="today-item' +
              (done ? " done" : "") +
              '" data-id="' +
              esc(item.id) +
              '">' +
              '<input type="checkbox" id="' +
              id +
              '" data-id="' +
              esc(item.id) +
              '"' +
              (done ? " checked" : "") +
              ">" +
              '<div class="today-item-body">' +
              '<label class="today-item-text" for="' +
              id +
              '">' +
              esc(item.text) +
              opt +
              "</label>" +
              linkHtml +
              "</div></div>"
            );
          })
          .join("");
        return '<section class="today-section"><div class="today-section-title">' + label + "</div>" + itemsHtml + "</section>";
      })
      .join("");
  }

  function showDay(forceRegen) {
    if (!global.DailyTodo) {
      return Promise.reject(new Error("DailyTodo 未加载，请检查脚本引用"));
    }
    return loadGoals().then(function (goals) {
      var day = forceRegen ? DailyTodo.regenerateToday(goals) : DailyTodo.ensureToday(goals);
      render(day, goals);
      return day;
    });
  }

  function bindInteractions() {
    var wrap = el("today-sections");
    if (!wrap || wrap.dataset.bound) return;
    wrap.dataset.bound = "1";

    wrap.addEventListener("change", function (e) {
      var cb = e.target;
      if (!cb || cb.type !== "checkbox" || !cb.dataset.id || !currentDay) return;
      var item = currentDay.items.find(function (x) {
        return x.id === cb.dataset.id;
      });
      if (item) onItemToggle(currentDay, item, cb.checked);
    });
  }

  function bindActionButtons() {
    var copyBtn = el("today-copy-digest");
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = "1";
      copyBtn.addEventListener("click", function () {
        if (!currentDay) {
          alert("清单尚未加载");
          return;
        }
        var text = DailyTodo.formatDigest(currentDay, goalsCache);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            alert("已复制今日摘要，可粘贴到微信 / 公众号草稿");
          });
        } else {
          prompt("复制以下内容：", text);
        }
      });
    }

    var toggleBtn = el("today-toggle-digest");
    if (toggleBtn && !toggleBtn.dataset.bound) {
      toggleBtn.dataset.bound = "1";
      toggleBtn.addEventListener("click", function () {
        var box = el("today-digest-preview");
        if (!box || !currentDay) return;
        box.hidden = !box.hidden;
        if (!box.hidden) box.textContent = DailyTodo.formatDigest(currentDay, goalsCache);
      });
    }

    var regenBtn = el("today-regenerate");
    if (regenBtn && !regenBtn.dataset.bound) {
      regenBtn.dataset.bound = "1";
      regenBtn.addEventListener("click", function () {
        if (!confirm("重新生成今日清单？已勾选状态会重置。")) return;
        showDay(true).catch(function (e) {
          showError(e.message || String(e));
        });
      });
    }
  }

  function init() {
    bindInteractions();
    bindActionButtons();

    showDay(false).catch(function (e) {
      showError(e.message || String(e));
    });

    if (global.LifeSync) {
      LifeSync.onChange(function (status) {
        if (status && status.type === "pull") {
          showDay(false).catch(function (e) {
            showError(e.message || String(e));
          });
        }
      });
    }
  }

  function refresh(forceRegen) {
    return showDay(!!forceRegen);
  }

  global.TodayView = { init: init, refresh: refresh };
})(window);
