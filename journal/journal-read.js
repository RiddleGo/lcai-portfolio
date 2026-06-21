(function (global) {
  "use strict";

  function initReader() {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    var content = document.getElementById("journal-read-content");
    var title = document.getElementById("journal-read-title");
    if (!id || !content) return;
    fetch("journal-index.json")
      .then(function (r) { return r.json(); })
      .then(function (idx) {
        var entry = (idx.entries || []).find(function (e) { return e.id === id; });
        if (!entry) throw new Error("not found");
        if (title) title.textContent = entry.title;
        return fetch(entry.file).then(function (r) {
          if (!r.ok) throw new Error("file");
          return r.text();
        });
      })
      .then(function (md) {
        content.innerHTML = "<pre style=\"white-space:pre-wrap;font-family:inherit;line-height:1.8\">" + md.replace(/</g, "&lt;") + "</pre>";
      })
      .catch(function () {
        content.textContent = "无法加载条目";
      });
  }

  global.JournalReader = { init: initReader };
})(window);
