/** 门户首页 — 复利人生五维框架 + 各模块摘要 */
(function (global) {
  "use strict";

  var DIMENSIONS = [
    {
      id: "cash",
      icon: "💰",
      name: "现金资本",
      short: "钱",
      question: "今天的行为让 2027 后资产更稳吗？",
      logic: "纪律还债 → 2027 清零 → 月存复投 → LCAI 规则避免情绪化",
      modules: [{ href: "finance/index.html", title: "财务", lock: true }],
      summaryKey: "finance",
    },
    {
      id: "cognition",
      icon: "🧠",
      name: "认知资本",
      short: "脑",
      question: "这条认知变成规则或行动了吗？",
      logic: "读书 → 笔记 → 原则/规则 → 决策与代码 → 再验证",
      modules: [{ href: "learning/index.html", title: "阅读" }],
      summaryKey: "learning",
    },
    {
      id: "capability",
      icon: "🛠",
      name: "能力资本",
      short: "手",
      question: "又多了什么可展示的能力资产？",
      logic: "技能练习 → 可展示项目 → 职业选项增加 → 反哺学习与收入",
      modules: [
        { href: "career/index.html", title: "职业成长" },
      ],
      summaryKey: "career",
    },
    {
      id: "constitution",
      icon: "📜",
      name: "决策资本",
      short: "心",
      question: "这次重大选择写清楚、能复盘吗？",
      logic: "重大决策记录 → 3/6 月复盘 → 提取模式 → 写入宪法",
      modules: [
        { href: "principles/life-constitution.md", title: "人生宪法" },
        { href: "journal/index.html", title: "决策日记", lock: true },
      ],
      summaryKey: "journal",
    },
    {
      id: "capacity",
      icon: "🏃",
      name: "体能资本",
      short: "体",
      question: "今天精力够支撑上面四件事吗？",
      logic: "睡眠 + 运动 → 精力 → 执行财务 / 学习 / 不情绪化交易",
      modules: [
        { href: "health/index.html", title: "健康习惯" },
      ],
      summaryKey: "health",
    },
  ];

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

  function loadGoalsData() {
    return fetch("goals/goals.json").then(function (r) {
      if (!r.ok) throw new Error("no goals");
      return r.json();
    });
  }

  function renderPriority(financeItem, goalsData) {
    var box = el("portal-priority");
    if (!box) return;
    var financeSub = financeItem && financeItem.sub ? financeItem.sub : "打开今日清单";
    var notDo = goalsData && goalsData.not_do && goalsData.not_do[0] ? goalsData.not_do[0] : "";
    box.innerHTML =
      '<a href="today/index.html" class="portal-priority-inner portal-priority-link">' +
      '<div class="portal-priority-label">今日 Todo</div>' +
      '<div class="portal-priority-main">' + esc(financeSub) + "</div>" +
      (notDo ? '<div class="portal-priority-meta">不做 · ' + esc(notDo) + "</div>" : "") +
      "</a>";
  }

  function loadBooksSummary() {
    return loadGoalsData()
      .then(function (data) {
        var books = data.season_books || [];
        var done = books.filter(function (b) {
          return b.status === "done";
        }).length;
        var current = books.find(function (b) {
          return b.status === "reading";
        });
        var sub = "本季精读 " + done + "/" + books.length;
        if (current) sub += " · 在读《" + current.title + "》";
        return { title: "阅读笔记", sub: sub, href: "learning/index.html" };
      })
      .catch(function () {
        var idx = global.LCAI_BOOKS_INDEX;
        if (!idx || !idx.books) {
          return { title: "阅读笔记", sub: "加载书库…", href: "learning/index.html" };
        }
        var reviewed = idx.books.filter(function (b) {
          return b.status === "reviewed" || b.status === "analyzed";
        }).length;
        return {
          title: "阅读笔记",
          sub: "已分析 " + reviewed + " / " + (idx.count || idx.books.length),
          href: "learning/index.html",
        };
      });
  }

  function loadCareerSummary() {
    return fetch("career/profile.json")
      .then(function (r) {
        if (!r.ok) throw new Error("no career");
        return r.json();
      })
      .then(function (data) {
        var projects = data.projects || [];
        return {
          title: "职业成长",
          sub: (data.targetRole || "全栈") + " · " + projects.length + " 个项目",
          href: "career/index.html",
        };
      })
      .catch(function () {
        return { title: "职业成长", sub: "技能矩阵 · 项目复盘", href: "career/index.html" };
      });
  }

  function loadJournalSummary() {
    var userCount = global.LifeSync ? LifeSync.getJournalEntries().length : 0;
    return fetch("journal/journal-index.json")
      .then(function (r) {
        if (!r.ok) throw new Error("no journal");
        return r.json();
      })
      .then(function (data) {
        var entries = (data.entries || []).length + userCount;
        var templates = (data.templates || []).length;
        return {
          title: "决策日记",
          sub: entries + " 篇记录 · " + templates + " 个决策模板",
          href: "journal/index.html",
          lock: true,
        };
      })
      .catch(function () {
        return {
          title: "决策日记",
          sub: userCount + " 篇我的记录",
          href: "journal/index.html",
          lock: true,
        };
      });
  }

  function loadHealthSummary() {
    try {
      var data = global.LifeSync ? LifeSync.getHealth() : JSON.parse(localStorage.getItem("life-health-v1") || "{}");
      if (!data.logs) return { title: "健康习惯", sub: "今日尚未打卡", href: "health/index.html" };
      var today = new Date().toISOString().slice(0, 10);
      var todayLog = data.logs[today] || {};
      var checked = ["exercise", "sleep", "routine"].filter(function (k) {
        return todayLog[k];
      }).length;
      return {
        title: "健康习惯",
        sub: "今日 " + checked + " / 3 · streak " + (data.streak || 0) + " 天",
        href: "health/index.html",
      };
    } catch (e) {
      return { title: "健康习惯", sub: "开始记录习惯", href: "health/index.html" };
    }
  }

  function loadFinanceSummary() {
    var pending = global.TodoLite && TodoLite.getPendingTodos ? TodoLite.getPendingTodos(1) : [];
    if (pending.length) {
      return Promise.resolve({
        title: "财务",
        sub: pending[0].text.slice(0, 48),
        href: "finance/index.html#plan",
        lock: true,
      });
    }
    return Promise.resolve({
      title: "财务",
      sub: "执行 · 还债",
      href: "finance/index.html",
      lock: true,
    });
  }

  function renderDimensionCard(dim, summary) {
    var modLinks = dim.modules
      .map(function (m) {
        var lock = m.lock ? " 🔒" : "";
        return '<a href="' + m.href + '" class="portal-dim-module">' + esc(m.title) + lock + "</a>";
      })
      .join("");

    var lockBadge = summary && summary.lock ? ' <span class="kb-nav-badge">🔒</span>' : "";
    var summaryHtml = summary
      ? '<a href="' + summary.href + '" class="portal-dim-summary">' +
        '<span class="portal-dim-summary-label">实时</span>' +
        '<span class="portal-dim-summary-text">' + esc(summary.sub) + lockBadge + "</span>" +
        '<span class="portal-dim-summary-arrow">→</span></a>'
      : "";

    return (
      '<article class="portal-dim-card" id="portal-dim-' + dim.id + '">' +
      '<header class="portal-dim-head">' +
      '<span class="portal-dim-icon">' + dim.icon + "</span>" +
      '<div class="portal-dim-head-text">' +
      '<div class="portal-dim-name">' + esc(dim.name) + "</div>" +
      "</div></header>" +
      '<div class="portal-dim-modules">' + modLinks + "</div>" +
      summaryHtml +
      "</article>"
    );
  }

  function renderDimensions(summaries) {
    var wrap = el("portal-dimensions");
    if (!wrap) return;
    wrap.innerHTML = DIMENSIONS.map(function (dim) {
      return renderDimensionCard(dim, summaries[dim.summaryKey]);
    }).join("");
  }

  function renderHub(goalsSummary, goalsData) {
    var wrap = el("portal-hub");
    if (!wrap) return;
    var notDoList =
      goalsData && goalsData.not_do
        ? goalsData.not_do
            .slice(0, 3)
            .map(function (item) {
              return "<li>" + esc(item) + "</li>";
            })
            .join("")
        : "";
    var progress = goalsSummary.progress || 0;

    wrap.innerHTML =
      '<a href="goals/index.html" class="portal-hub-card portal-hub-card--primary">' +
      '<div class="portal-hub-label">OKR</div>' +
      '<div class="portal-hub-title">' + esc(goalsSummary.title) + "</div>" +
      '<div class="portal-hub-sub">' + esc(goalsSummary.sub) + "</div>" +
      '<div class="module-progress-bar"><span style="width:' + progress + '%"></span></div>' +
      "</a>" +
      (notDoList
        ? '<div class="portal-hub-card portal-hub-card--static">' +
          '<div class="portal-hub-label">不做</div>' +
          '<ul class="portal-not-do-list">' +
          notDoList +
          "</ul></div>"
        : "");
  }

  function loadGoalsSummary() {
    return loadGoalsData()
      .then(function (data) {
        var ov = global.LifeSync ? LifeSync.getGoalsOverrides().krProgress || {} : {};
        var krs = (data.quarter && data.quarter.key_results) || [];
        krs.forEach(function (k) {
          if (ov[k.id] != null) k.progress = ov[k.id];
        });
        var done = krs.filter(function (k) {
          return k.progress >= (k.target || 100);
        }).length;
        var avg =
          krs.length > 0
            ? Math.round(
                krs.reduce(function (s, k) {
                  return s + Math.min(100, (k.progress / (k.target || 1)) * 100);
                }, 0) / krs.length
              )
            : 0;
        return {
          title: data.theme + " · " + ((data.quarter && data.quarter.name) || "本季"),
          sub: "KR " + done + "/" + krs.length + " 达标 · 均进度 " + avg + "%",
          href: "goals/index.html",
          progress: avg,
        };
      })
      .catch(function () {
        return { title: "目标 OKR", sub: "设置年度与季度目标", href: "goals/index.html", progress: 0 };
      });
  }

  function renderSyncBanner() {
    var box = el("portal-sync-banner");
    if (!box || !global.LifeSync) return;
    if (LifeSync.isCloudEnabled()) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    if (!LifeSync.isConfigured()) {
      box.innerHTML = '☁️ 云同步待配置 · <a href="settings/index.html">设置</a>';
      return;
    }
    box.innerHTML = '☁️ <a href="settings/index.html">登录同步</a> · 换设备不丢';
  }

  function startPortal() {
    renderSyncBanner();
    var goalsData = null;
    loadGoalsData()
      .then(function (d) {
        goalsData = d;
      })
      .catch(function () {});

    Promise.all([
      loadFinanceSummary(),
      loadBooksSummary(),
      loadCareerSummary(),
      loadJournalSummary(),
      loadHealthSummary(),
      loadGoalsSummary(),
    ]).then(function (results) {
      var summaries = {
        finance: results[0],
        learning: results[1],
        career: results[2],
        journal: results[3],
        health: results[4],
      };
      var goalsSummary = results[5];

      renderDimensions(summaries);
      if (goalsData) {
        renderPriority(results[0], goalsData);
        renderHub(goalsSummary, goalsData);
        var heroSub = el("portal-hero-sub");
        if (heroSub && goalsData.phase) {
          heroSub.textContent =
            (goalsData.theme || "清债重建") + " · " + goalsData.phase.name + " · " + goalsData.phase.until;
        }
      } else {
        loadGoalsData().then(function (d) {
          renderPriority(results[0], d);
          renderHub(goalsSummary, d);
        });
      }
    });

    if (!global.LCAI_BOOKS_INDEX) {
      var booksScript = document.createElement("script");
      booksScript.src = "books-index-data.js";
      booksScript.onload = function () {
        loadBooksSummary().then(function (item) {
          var card = el("portal-dim-cognition");
          if (!card) return;
          var summaryEl = card.querySelector(".portal-dim-summary");
          if (summaryEl) {
            summaryEl.querySelector(".portal-dim-summary-text").textContent = item.sub;
            summaryEl.href = item.href;
          }
        });
      };
      document.body.appendChild(booksScript);
    }
  }

  function init() {
    if (global.LifeSync && LifeSync.init) {
      LifeSync.init().then(startPortal);
    } else {
      startPortal();
    }
  }

  global.PortalHome = { init: init, DIMENSIONS: DIMENSIONS };
})(window);
