/** 门户首页 — 各模块摘要聚合 */
(function (global) {
  "use strict";

  function el(id) {
    return document.getElementById(id);
  }

  function loadGoalsSummary() {
    return fetch("goals/goals.json")
      .then(function (r) {
        if (!r.ok) throw new Error("no goals");
        return r.json();
      })
      .then(function (data) {
        var krs = (data.quarter && data.quarter.key_results) || [];
        var done = krs.filter(function (k) {
          return k.progress >= (k.target || 100);
        }).length;
        return {
          title: data.year + " · " + (data.quarter && data.quarter.name || "本季"),
          sub: "KR 完成 " + done + " / " + krs.length,
          href: "goals/index.html",
        };
      })
      .catch(function () {
        return { title: "目标 OKR", sub: "设置年度与季度目标", href: "goals/index.html" };
      });
  }

  function loadBooksSummary() {
    var idx = global.LCAI_BOOKS_INDEX;
    if (!idx || !idx.books) {
      return Promise.resolve({ title: "阅读笔记", sub: "加载书库索引…", href: "learning/index.html" });
    }
    var total = idx.count || idx.books.length;
    var reviewed = idx.books.filter(function (b) {
      return b.status === "reviewed" || b.status === "analyzed";
    }).length;
    return Promise.resolve({
      title: "阅读笔记",
      sub: "已读/分析 " + reviewed + " / " + total + " 本",
      href: "learning/index.html",
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
        sub: "今日 " + checked + " / 3 项 · streak " + (data.streak || 0) + " 天",
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
      sub: "执行 · 还债 · 持仓（需解锁）",
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
    Promise.all([
      loadGoalsSummary(),
      loadBooksSummary(),
      loadHealthSummary(),
      loadFinanceSummary(),
    ]).then(function (items) {
      var ids = ["portal-goals", "portal-learning", "portal-health", "portal-finance"];
      items.forEach(function (item, i) {
        renderSummaryCard(el(ids[i]), item);
      });
    });

    var booksScript = document.createElement("script");
    booksScript.src = "books-index-data.js";
    booksScript.onload = function () {
      loadBooksSummary().then(function (item) {
        renderSummaryCard(el("portal-learning"), item);
      });
    };
    document.body.appendChild(booksScript);
  }

  global.PortalHome = { init: init };
})(window);
