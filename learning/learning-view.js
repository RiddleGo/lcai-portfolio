(function (global) {
  "use strict";

  function domainOf(book) {
    if (book.domain) return book.domain;
    var cats = (book.categories || []).join(" ");
    if (/技术|编程|AI|软件/.test(cats) || /技术|编程/.test(book.section || "")) return "tech";
    if (/职业|管理|沟通/.test(cats)) return "career";
    if (/通识|心理|传记/.test(cats)) return "general";
    return "invest";
  }

  function statusLabel(s) {
    var map = { done: "已读完", reading: "在读", planned: "计划" };
    return map[s] || s;
  }

  function renderPlan(plan) {
    var box = document.getElementById("learning-plan-block");
    if (!box || !plan) return;
    var schedule = (plan.schedule || [])
      .map(function (s) {
        return "<li><strong>" + s.label + "</strong>（" + s.when + "）— " + s.task + "</li>";
      })
      .join("");
    var rules = (plan.rules || []).map(function (r) { return "<li>" + r + "</li>"; }).join("");
    var prompts = (plan.notePrompts || []).map(function (p) { return "<li>" + p + "</li>"; }).join("");
    box.innerHTML =
      '<p class="module-page-desc"><strong>' +
      (plan.season || "") +
      "</strong> · 目标 " +
      (plan.weeklyTarget || "") +
      "</p>" +
      "<h3 class=\"kb-section-title\" style=\"font-size:0.95rem;margin-top:16px\">阅读节奏</h3><ol class=\"module-page-desc\">" +
      schedule +
      "</ol>" +
      "<h3 class=\"kb-section-title\" style=\"font-size:0.95rem;margin-top:16px\">笔记 prompts</h3><ul class=\"module-page-desc\">" +
      prompts +
      "</ul>" +
      "<h3 class=\"kb-section-title\" style=\"font-size:0.95rem;margin-top:16px\">规则</h3><ul class=\"module-page-desc\">" +
      rules +
      "</ul>";
  }

  function renderSeasonBooks(books, idx, planBooks) {
    var box = document.getElementById("learning-season-books");
    if (!box || !books || !books.length) return;
    var planMap = {};
    (planBooks || []).forEach(function (b) { planMap[b.id] = b; });
    box.innerHTML =
      '<h2 class="kb-section-title">本季书单</h2><div class="module-card-grid">' +
      books
        .map(function (b) {
          var book = idx.by_id && idx.by_id[b.id];
          var title = b.title || (book && book.title) || b.id;
          var mins = planMap[b.id] && planMap[b.id].minutesPerWeek ? planMap[b.id].minutesPerWeek + " 分钟/周" : "";
          return (
            '<div class="module-stat-card">' +
            '<div class="module-stat-label">' + statusLabel(b.status) + (mins ? " · " + mins : "") + "</div>" +
            "<strong>" + title + "</strong>" +
            '<p class="module-page-desc" style="margin:8px 0 0">' + (b.action || "") + "</p></div>"
          );
        })
        .join("") +
      "</div>";
  }

  function init() {
    var filterEl = document.getElementById("books-filter-domain");
    var searchEl = document.getElementById("books-search");
    var listEl = document.getElementById("books-list");
    var statsEl = document.getElementById("learning-books-stats");
    var idx = global.LCAI_BOOKS_INDEX;
    if (!idx || !listEl) return;

    var planPromise = fetch("plan.json")
      .then(function (r) { return r.json(); })
      .then(function (plan) {
        renderPlan(plan);
        return plan;
      })
      .catch(function () { return null; });

    fetch("../goals/goals.json")
      .then(function (r) { return r.json(); })
      .then(function (goals) {
        planPromise.then(function (plan) {
          renderSeasonBooks(goals.season_books, idx, plan && plan.books);
        });
      })
      .catch(function () {});

    function render() {
      var domain = filterEl ? filterEl.value : "";
      var q = searchEl ? searchEl.value.trim().toLowerCase() : "";
      var books = idx.books || [];
      if (domain) books = books.filter(function (b) { return domainOf(b) === domain; });
      if (q) {
        books = books.filter(function (b) {
          return (b.title || "").toLowerCase().includes(q) || (b.id || "").toLowerCase().includes(q);
        });
      }
      if (statsEl) statsEl.textContent = "书库 " + books.length + " 本";
      if (!books.length) {
        listEl.innerHTML = "<p>无匹配</p>";
        return;
      }
      listEl.innerHTML = books.slice(0, 80).map(function (b) {
        var d = domainOf(b);
        return '<div style="padding:10px 12px;border-bottom:1px solid var(--kb-border)"><strong>' + b.title + '</strong> <span class="skill-level">' + d + "</span></div>";
      }).join("");
    }

    if (filterEl) filterEl.addEventListener("change", render);
    if (searchEl) searchEl.addEventListener("input", render);
    render();
  }

  global.LearningView = { init: init, domainOf: domainOf };
})(window);
