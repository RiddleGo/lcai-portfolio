/** 门户首页 — 各模块摘要聚合 */
(function (global) {
  "use strict";

  function el(id) {
    return document.getElementById(id);
  }

  function loadGoalsData() {
    return fetch("goals/goals.json")
      .then(function (r) {
        if (!r.ok) throw new Error("no goals");
        return r.json();
      });
  }

  function loadGoalsSummary() {
    return loadGoalsData()
      .then(function (data) {
        var krs = (data.quarter && data.quarter.key_results) || [];
        var done = krs.filter(function (k) {
          return k.progress >= (k.target || 100);
        }).length;
        return {
          title: data.theme + " · " + (data.quarter && data.quarter.name || "本季"),
          sub: "KR " + done + " / " + krs.length + " 达标",
          href: "goals/index.html",
        };
      })
      .catch(function () {
        return { title: "目标 OKR", sub: "设置年度与季度目标", href: "goals/index.html" };
      });
  }

  function renderPriority(financeItem, goalsData) {
    var box = el("portal-priority");
    if (!box) return;
    var financeSub = financeItem && financeItem.sub ? financeItem.sub : "查看财务计划";
    var theme = goalsData && goalsData.theme ? goalsData.theme : "清债重建";
    var notDo = goalsData && goalsData.not_do && goalsData.not_do[0] ? goalsData.not_do[0] : "";
    box.innerHTML =
      '<div class="portal-priority-inner">' +
      '<div class="portal-priority-label">本月要紧事</div>' +
      '<div class="portal-priority-main"><a href="finance/index.html">' + financeSub + "</a></div>" +
      '<div class="portal-priority-meta">主题：' + theme +
      (notDo ? " · 不做：" + notDo : "") +
      ' · <a href="principles/life-constitution.md">宪法</a></div></div>';
  }

  function loadBooksSummary() {
    return loadGoalsData()
      .then(function (data) {
        var books = data.season_books || [];
        var done = books.filter(function (b) { return b.status === "done"; }).length;
        var reading = books.filter(function (b) { return b.status === "reading"; }).length;
        var current = books.find(function (b) { return b.status === "reading"; });
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

  function loadHealthSummary() {
    try {
      var raw = localStorage.getItem("life-health-v1");
      if (!raw) return { title: "健康习惯", sub: "今日尚未打卡", href: "health/index.html" };
      var data = JSON.parse(raw);
      var today = new Date().toISOString().slice(0, 10);
      var todayLog = (data.logs || {})[today] || {};
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
    if (global.FinanceCore && global.FinanceCore.getPortalSummary) {
      return Promise.resolve(global.FinanceCore.getPortalSummary());
    }
    return Promise.resolve({
      title: "财务计划",
      sub: "执行 · 还债 · 持仓",
      href: "finance/index.html",
      lock: true,
    });
  }

  function renderSummaryCard(container, item) {
    if (!container || !item) return;
    var lock = item.lock ? ' <span class="kb-nav-badge">🔒</span>' : "";
    container.innerHTML =
      '<a href="' + item.href + '" class="portal-summary-card">' +
      "<div class=\"portal-summary-title\">" + item.title + lock + "</div>" +
      '<div class="portal-summary-sub">' + item.sub + "</div>" +
      '<span class="portal-summary-arrow">→</span></a>';
  }

  function renderModuleCards() {
    var nav = global.SITE_NAV;
    var wrap = el("portal-module-cards");
    if (!wrap || !nav || !nav.modules) return;
    wrap.innerHTML = nav.modules
      .map(function (m) {
        var lock = m.lock ? ' <span class="kb-nav-badge">🔒</span>' : "";
        return (
          '<a href="' + m.href + '" class="kb-nav-card">' +
          '<span class="kb-nav-card-icon">' + m.icon + "</span>" +
          '<div class="kb-nav-card-title">' + m.title + lock + "</div>" +
          '<div class="kb-nav-card-sub">' + m.sub + "</div>" +
          '<span class="kb-nav-card-arrow">→</span></a>'
        );
      })
      .join("");
  }

  function init() {
    renderModuleCards();
    var goalsData = null;
    loadGoalsData().then(function (d) { goalsData = d; }).catch(function () {});

    Promise.all([
      loadFinanceSummary(),
      loadGoalsSummary(),
      loadBooksSummary(),
      loadHealthSummary(),
    ]).then(function (items) {
      var ids = ["portal-finance", "portal-goals", "portal-learning", "portal-health"];
      items.forEach(function (item, i) {
        renderSummaryCard(el(ids[i]), item);
      });
      if (goalsData) renderPriority(items[0], goalsData);
      else loadGoalsData().then(function (d) { renderPriority(items[0], d); });
    });

    if (!global.LCAI_BOOKS_INDEX) {
      var booksScript = document.createElement("script");
      booksScript.src = "books-index-data.js";
      booksScript.onload = function () {
        loadBooksSummary().then(function (item) {
          renderSummaryCard(el("portal-learning"), item);
        });
      };
      document.body.appendChild(booksScript);
    }
  }

  global.PortalHome = { init: init };
})(window);
