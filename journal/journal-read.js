(function (global) {
  "use strict";

  function initReader() {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    var template = params.get("template");
    var content = document.getElementById("journal-read-content");
    var title = document.getElementById("journal-read-title");
    if (!content) return;

    function showMd(path, titleText) {
      if (title) title.textContent = titleText || "决策记录";
      fetch(path).then(function (r) {
        if (!r.ok) throw new Error("file");
        return r.text();
      }).then(function (md) {
        content.innerHTML = "<pre style=\"white-space:pre-wrap;font-family:inherit;line-height:1.8\">" + md.replace(/</g, "&lt;") + "</pre>";
      }).catch(function () {
        content.textContent = "无法加载：" + path;
      });
    }

    if (template) {
      showMd(template, "模板 · " + template.split("/").pop());
      return;
    }

    if (!id) {
      content.textContent = "缺少 id 或 template 参数";
      return;
    }

    fetch("journal-index.json")
      .then(function (r) { return r.json(); })
      .then(function (idx) {
        var entry = (idx.entries || []).find(function (e) { return e.id === id; });
        if (!entry) throw new Error("not found");
        showMd(entry.file, entry.title);
      })
      .catch(function () {
        content.textContent = "无法加载条目";
      });
  }

  global.JournalReader = { init: initReader };
})(window);
