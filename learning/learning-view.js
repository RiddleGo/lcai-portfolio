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

  function renderSeasonBooks(books, idx) {
    var box = document.getElementById("learning-season-books");
    if (!box || !books || !books.length) return;
    box.innerHTML =
      "<h2 class=\"kb-section-title\">本季精读（2026 Q2）</h2>" +
      "<div class=\"module-card-grid\">" +
      books.map(function (b) {
        var book = idx.by_id && idx.by_id[b.id];
        var title = b.title || (book && book.title) || b.id;
        var href = "../invest/workbench.html#books?book=" + encodeURIComponent(b.id);
        return (
          '<div class="module-stat-card">' +
          '<div class="module-stat-label">' + statusLabel(b.status) + "</div>" +
          '<strong><a href="' + href + '">' + title + "</a></strong>" +
          '<p class="module-page-desc" style="margin:8px 0 0">' + (b.action || "") + "</p></div>"
        );
      }).join("") +
      "</div>";
  }

  function init() {
    var filterEl = document.getElementById("books-filter-domain");
    var searchEl = document.getElementById("books-search");
    var listEl = document.getElementById("books-list");
    var statsEl = document.getElementById("learning-books-stats");
    var idx = global.LCAI_BOOKS_INDEX;
    if (!idx || !listEl) return;

    fetch("../goals/goals.json")
      .then(function (r) { return r.json(); })
      .then(function (goals) {
        renderSeasonBooks(goals.season_books, idx);
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
      if (statsEl) statsEl.textContent = "书库 " + books.length + " / " + (idx.count || idx.books.length) + " 本（下方为全库浏览）";
      if (!books.length) {
        listEl.innerHTML = "<p>无匹配书籍</p>";
        return;
      }
      listEl.innerHTML = books.slice(0, 80).map(function (b) {
        var d = domainOf(b);
        return '<a href="../invest/workbench.html#books?book=' + encodeURIComponent(b.id) + '" style="display:block;padding:10px 12px;border-bottom:1px solid var(--kb-border);text-decoration:none;color:inherit"><strong>' + b.title + '</strong> <span class="skill-level">' + d + "</span></a>";
      }).join("");
      if (books.length > 80) listEl.innerHTML += '<p class="module-page-desc">还有 ' + (books.length - 80) + " 本，请搜索或去 LCAI 书库</p>";
    }

    if (filterEl) filterEl.addEventListener("change", render);
    if (searchEl) searchEl.addEventListener("input", render);
    render();
  }

  global.LearningView = { init: init, domainOf: domainOf };
})(window);
