/**
 * 每日 Todo 生成器 — 聚合健康 / 财务 / OKR / 阅读
 */
(function (global) {
  "use strict";

  var HEALTH_ITEMS = [
    { habitId: "exercise", text: "运动 ≥30 分钟", href: "../health/index.html" },
    { habitId: "sleep", text: "23:30 前睡觉", href: "../health/index.html" },
    { habitId: "routine", text: "晨间例行（计划 / 阅读）", href: "../health/index.html" },
  ];

  var CAT_LABEL = {
    meta: "要紧事",
    health: "健康",
    finance: "财务",
    learning: "阅读",
    goals: "OKR",
    review: "复盘",
  };

  /** 下方链接文案 */
  var CAT_LINK = {
    meta: "OKR →",
    health: "打卡 →",
    finance: "财务 →",
    learning: "阅读 →",
    goals: "OKR →",
    review: "首页 →",
  };

  function linkLabel(category) {
    return CAT_LINK[category] || "查看详情 →";
  }

  function stampItem(item) {
    item.linkLabel = item.linkLabel || linkLabel(item.category);
    return item;
  }

  function todayKey(d) {
    d = d || new Date();
    return d.toISOString().slice(0, 10);
  }

  function weekdayCN(d) {
    return "日一二三四五六"[d.getDay()];
  }

  function applyGoalsOverrides(data) {
    if (!global.LifeSync) return data;
    var ov = LifeSync.getGoalsOverrides();
    var krs = (data.quarter && data.quarter.key_results) || [];
    krs.forEach(function (kr) {
      if (ov.krProgress && ov.krProgress[kr.id] != null) kr.progress = ov.krProgress[kr.id];
    });
    if (data.season_books && ov.seasonBooks) {
      data.season_books.forEach(function (b) {
        if (ov.seasonBooks[b.id]) b.status = ov.seasonBooks[b.id];
      });
    }
    return data;
  }

  function buildItems(goalsData) {
    goalsData = goalsData || {};
    var items = [];
    var dateKey = todayKey();

    items.push({
      id: dateKey + "-meta-theme",
      category: "meta",
      text: "本季主题：" + (goalsData.theme || "清债重建") + " · 只做最重要的事",
      href: "../goals/index.html",
      optional: false,
    });

    if (goalsData.not_do && goalsData.not_do[0]) {
      items.push({
        id: dateKey + "-meta-notdo",
        category: "meta",
        text: "今日不做：" + goalsData.not_do[0],
        href: "../goals/index.html",
        optional: true,
      });
    }

    HEALTH_ITEMS.forEach(function (h) {
      items.push({
        id: dateKey + "-health-" + h.habitId,
        category: "health",
        text: h.text,
        href: h.href,
        habitId: h.habitId,
        optional: false,
      });
    });

    if (global.TodoLite && TodoLite.getPendingTodos) {
      var pending = TodoLite.getPendingTodos(2);
    } else if (global.FinanceCore && FinanceCore.getPendingTodos) {
      var pending = FinanceCore.getPendingTodos(2);
    } else {
      var pending = [];
    }
    if (pending.length) {
      pending.forEach(function (t, i) {
        items.push({
          id: dateKey + "-finance-" + t.id,
          category: "finance",
          text: (i === 0 ? "【财务重点】 " : "【财务预备】 ") + t.text,
          href: "../finance/index.html#plan",
          financeTodoId: t.id,
          optional: i > 0,
        });
      });
    } else {
      items.push({
        id: dateKey + "-finance-check",
        category: "finance",
        text: "查看财务执行待办（下一笔还款 / 卖股）",
        href: "../finance/index.html#plan",
        optional: false,
      });
    }

    var books = goalsData.season_books || [];
    var reading = books.find(function (b) {
      return b.status === "reading";
    });
    if (reading) {
      items.push({
        id: dateKey + "-learning-read",
        category: "learning",
        text: "精读《" + reading.title + "》≥ 20 分钟",
        href: "../learning/index.html",
        optional: false,
      });
    } else {
      var planned = books.find(function (b) {
        return b.status === "planned";
      });
      if (planned) {
        items.push({
          id: dateKey + "-learning-plan",
          category: "learning",
          text: "挑一章《" + planned.title + "》开始本季精读",
          href: "../learning/index.html",
          optional: true,
        });
      }
    }

    var krs = (goalsData.quarter && goalsData.quarter.key_results) || [];
    if (krs.length) {
      var sorted = krs.slice().sort(function (a, b) {
        var pa = a.target ? a.progress / a.target : 0;
        var pb = b.target ? b.progress / b.target : 0;
        return pa - pb;
      });
      var lag = sorted[0];
      if (lag) {
        items.push({
          id: dateKey + "-goals-kr",
          category: "goals",
          text: "推进 OKR：" + lag.title + "（" + lag.progress + "/" + lag.target + "）",
          href: lag.link || "../goals/index.html",
          optional: false,
        });
      }
    }

    var d = new Date();
    if (d.getDay() === 0) {
      items.push({
        id: dateKey + "-review-week",
        category: "review",
        text: "周日：扫一眼门户五维摘要 + 更新 OKR 进度",
        href: "../index.html",
        optional: true,
      });
    }

    return items.map(stampItem);
  }

  function getFinanceTodoState() {
    if (global.LifeSync && LifeSync.getState) {
      var s = LifeSync.getState();
      if (s.finance && s.finance.todoDone) return s.finance.todoDone;
    }
    if (global.FinanceCore && FinanceCore.loadTodoState) return FinanceCore.loadTodoState();
    try {
      var key = (global.FINANCE_CONFIG && FINANCE_CONFIG.todoStorageKey) || "lcai-exec-todos-v9";
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (e) {
      return {};
    }
  }

  function syncCompletionFromModules(dateKey, day) {
    if (!day || !day.items) return day;
    if (!day.completed) day.completed = {};

    var health = global.LifeSync ? LifeSync.getHealth() : null;
    var logs = (health && health.logs && health.logs[dateKey]) || {};

    day.items.forEach(function (item) {
      if (item.habitId && logs[item.habitId]) {
        day.completed[item.id] = true;
      }
      if (item.financeTodoId) {
        var st = getFinanceTodoState();
        var entry = st[item.financeTodoId];
        var done = entry && (entry.done === true || entry === true);
        if (done) day.completed[item.id] = true;
      }
    });

    return day;
  }

  function ensureToday(goalsData) {
    var dateKey = todayKey();
    var existing = global.LifeSync ? LifeSync.getDailyTodoDay(dateKey) : null;

    if (existing && existing.generatedAt && existing.items && existing.items.length) {
      existing = syncCompletionFromModules(dateKey, existing);
      if (global.LifeSync) LifeSync.saveDailyTodoDay(dateKey, existing);
      return existing;
    }

    var items = buildItems(goalsData);
    var day = {
      date: dateKey,
      generatedAt: new Date().toISOString(),
      theme: goalsData.theme || "",
      items: items,
      completed: existing && existing.completed ? existing.completed : {},
    };
    day = syncCompletionFromModules(dateKey, day);
    if (global.LifeSync) LifeSync.saveDailyTodoDay(dateKey, day);
    return day;
  }

  function regenerateToday(goalsData) {
    var dateKey = todayKey();
    var day = {
      date: dateKey,
      generatedAt: new Date().toISOString(),
      theme: (goalsData && goalsData.theme) || "",
      items: buildItems(goalsData),
      completed: {},
    };
    day = syncCompletionFromModules(dateKey, day);
    if (global.LifeSync) LifeSync.saveDailyTodoDay(dateKey, day);
    return day;
  }

  function formatDigest(day, goalsData) {
    goalsData = goalsData || {};
    var d = new Date(day.date + "T12:00:00");
    var lines = [
      "【Russshare · 今日助手】" + day.date + " 周" + weekdayCN(d),
      "",
      "■ 主题：" + (goalsData.theme || day.theme || "—"),
    ];
    var lastCat = "";
    (day.items || []).forEach(function (item) {
      if (item.category !== lastCat) {
        lastCat = item.category;
        lines.push("");
        lines.push("■ " + (CAT_LABEL[item.category] || item.category));
      }
      var mark = day.completed && day.completed[item.id] ? "✓" : "□";
      lines.push("  " + mark + " " + item.text);
    });
    lines.push("");
    lines.push("→ 打开 today/index.html 勾选");
    return lines.join("\n");
  }

  function countProgress(day) {
    var total = (day.items || []).length;
    var done = 0;
    (day.items || []).forEach(function (item) {
      if (day.completed && day.completed[item.id]) done++;
    });
    return { done: done, total: total };
  }

  global.DailyTodo = {
    todayKey: todayKey,
    buildItems: buildItems,
    ensureToday: ensureToday,
    regenerateToday: regenerateToday,
    formatDigest: formatDigest,
    countProgress: countProgress,
    applyGoalsOverrides: applyGoalsOverrides,
    CAT_LABEL: CAT_LABEL,
    CAT_LINK: CAT_LINK,
    linkLabel: linkLabel,
  };
})(window);
