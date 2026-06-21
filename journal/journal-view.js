(function (global) {
  "use strict";

  function renderTriggers(triggers) {
    var box = document.getElementById("journal-triggers");
    if (!box || !triggers) return;
    box.innerHTML =
      "<h2 class=\"kb-section-title\">何时必须写决策日记</h2>" +
      "<p class=\"module-page-desc\">以下情形触发后，先选模板、填四段式，再行动。详见 <a href=\"../principles/life-constitution.md\">人生宪法 §4</a>。</p>" +
      "<ul class=\"journal-entry-list\">" +
      triggers.map(function (t) {
        return (
          "<li><a href=\"read.html?template=" + encodeURIComponent(t.template) + "\">" +
          "<strong>" + t.label + "</strong><br>" +
          "<span style=\"color:var(--kb-text2);font-size:0.88rem\">" + t.threshold + " · 模板 →</span></a></li>"
        );
      }).join("") +
      "</ul>";
  }

  function renderIndex(data) {
    renderTriggers(data.triggers);
    var list = document.getElementById("journal-entry-list");
    if (!list) return;
    var entries = data.entries || [];
    var templates = data.templates || [];
    var html = "";
    if (entries.length) {
      html += "<h2 class=\"kb-section-title\">决策记录</h2><ul class=\"journal-entry-list\">" +
        entries.map(function (e) {
          return '<li><a href="read.html?id=' + encodeURIComponent(e.id) + '"><strong>' + e.title + "</strong><br><span style=\"color:var(--kb-text2);font-size:0.88rem\">" + e.date + " · " + e.summary + "</span></a></li>";
        }).join("") + "</ul>";
    }
    if (templates.length) {
      html += "<h2 class=\"kb-section-title\" style=\"margin-top:24px\">空白模板</h2><ul class=\"journal-entry-list\">" +
        templates.map(function (t) {
          return '<li><a href="read.html?template=' + encodeURIComponent(t.file) + '">' + t.title + " →</a></li>";
        }).join("") + "</ul>";
    }
    list.innerHTML = html;
  }

  function init() {
    Promise.all([
      fetch("journal-index.json").then(function (r) { return r.json(); }),
      fetch("decision-triggers.json").then(function (r) { return r.json(); }),
    ]).then(function (results) {
      var index = results[0];
      var triggers = results[1];
      renderTriggers(triggers.triggers);
      renderIndex(index);
    }).catch(function () {
      var list = document.getElementById("journal-entry-list");
      if (list) list.innerHTML = "<li>无法加载 journal 索引</li>";
    });
  }

  global.JournalView = { init: init };
})(window);
