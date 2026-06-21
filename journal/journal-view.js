(function (global) {
  "use strict";

  function renderIndex(data) {
    var list = document.getElementById("journal-entry-list");
    if (!list) return;
    var entries = data.entries || [];
    list.innerHTML = entries.map(function (e) {
      return '<li><a href="read.html?id=' + encodeURIComponent(e.id) + '"><strong>' + e.title + "</strong><br><span style=\"color:var(--kb-text2);font-size:0.88rem\">" + e.date + " · " + e.summary + "</span></a></li>";
    }).join("");
  }

  function init() {
    fetch("journal-index.json")
      .then(function (r) { return r.json(); })
      .then(renderIndex)
      .catch(function () {
        var list = document.getElementById("journal-entry-list");
        if (list) list.innerHTML = "<li>无法加载 journal-index.json</li>";
      });
  }

  global.JournalView = { init: init };
})(window);
