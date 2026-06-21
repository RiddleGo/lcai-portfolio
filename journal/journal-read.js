(function (global) {
  "use strict";

  function el(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showMd(path, titleText) {
    var content = el("journal-read-content");
    var title = el("journal-read-title");
    if (title) title.textContent = titleText || "决策记录";
    fetch(path)
      .then(function (r) {
        if (!r.ok) throw new Error("file");
        return r.text();
      })
      .then(function (md) {
        content.innerHTML =
          '<pre style="white-space:pre-wrap;font-family:inherit;line-height:1.8">' + esc(md) + "</pre>";
      })
      .catch(function () {
        content.textContent = "无法加载：" + path;
      });
  }

  function renderEditor(entry) {
    var content = el("journal-read-content");
    var titleEl = el("journal-read-title");
    if (titleEl) titleEl.textContent = entry.id ? "编辑决策记录" : "新建决策记录";

    var today = new Date().toISOString().slice(0, 10);
    entry = entry || {
      id: "user-" + Date.now(),
      title: "",
      date: today,
      body: "## 背景\n\n## 选项\n\n## 选择\n\n## 预期与复盘日期\n\n",
    };

    content.innerHTML =
      '<div class="journal-editor-meta">' +
      '<input type="text" id="journal-edit-title" placeholder="标题" value="' +
      esc(entry.title) +
      '">' +
      '<input type="date" id="journal-edit-date" value="' +
      esc(entry.date || today) +
      '">' +
      "</div>" +
      '<div class="journal-editor-wrap"><textarea id="journal-edit-body">' +
      esc(entry.body) +
      "</textarea></div>" +
      '<div class="sync-btn-row">' +
      '<button type="button" class="sync-btn sync-btn-primary" id="journal-edit-save">保存</button>' +
      (entry.id && entry.id.indexOf("user-") === 0
        ? '<button type="button" class="sync-btn" id="journal-edit-delete">删除</button>'
        : "") +
      '<a href="index.html" class="sync-btn" style="text-decoration:none;line-height:1.4">返回列表</a>' +
      "</div>" +
      '<p class="module-page-desc">保存后自动同步（若已配置 <a href="../settings/index.html">数据同步</a>）</p>';

    el("journal-edit-save").addEventListener("click", function () {
      var saved = {
        id: entry.id,
        title: el("journal-edit-title").value.trim() || "未命名决策",
        date: el("journal-edit-date").value || today,
        body: el("journal-edit-body").value,
      };
      LifeSync.saveJournalEntry(saved);
      location.href = "read.html?user=" + encodeURIComponent(saved.id);
    });

    var delBtn = el("journal-edit-delete");
    if (delBtn) {
      delBtn.addEventListener("click", function () {
        if (!confirm("确定删除这篇记录？")) return;
        LifeSync.deleteJournalEntry(entry.id);
        location.href = "index.html";
      });
    }
  }

  function showUserEntry(id) {
    var entry = LifeSync.getJournalEntry(id);
    var content = el("journal-read-content");
    var titleEl = el("journal-read-title");
    if (!entry) {
      if (content) content.textContent = "找不到记录";
      return;
    }
    if (titleEl) titleEl.textContent = entry.title;

    content.innerHTML =
      '<p class="module-page-desc">' +
      entry.date +
      ' · <a href="read.html?edit=' +
      encodeURIComponent(id) +
      '">编辑</a></p>' +
      '<pre style="white-space:pre-wrap;font-family:inherit;line-height:1.8">' +
      esc(entry.body) +
      "</pre>" +
      '<p><a href="read.html?edit=' +
      encodeURIComponent(id) +
      '">编辑此记录 →</a></p>';
  }

  function initReader() {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    var template = params.get("template");
    var userId = params.get("user");
    var editId = params.get("edit");
    var content = el("journal-read-content");
    if (!content) return;

    if (editId === "new") {
      renderEditor(null);
      return;
    }

    if (editId) {
      var existing = LifeSync.getJournalEntry(editId);
      renderEditor(existing || { id: editId, title: "", date: "", body: "" });
      return;
    }

    if (userId) {
      showUserEntry(userId);
      return;
    }

    if (template) {
      fetch(template)
        .then(function (r) {
          return r.text();
        })
        .then(function (md) {
          renderEditor({
            id: "user-" + Date.now(),
            title: "决策 · " + template.split("/").pop().replace(".md", ""),
            date: new Date().toISOString().slice(0, 10),
            body: md,
          });
        })
        .catch(function () {
          showMd(template, "模板 · " + template.split("/").pop());
        });
      return;
    }

    if (!id) {
      content.textContent = "缺少参数";
      return;
    }

    fetch("journal-index.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (idx) {
        var entry = (idx.entries || []).find(function (e) {
          return e.id === id;
        });
        if (!entry) throw new Error("not found");
        showMd(entry.file, entry.title);
      })
      .catch(function () {
        content.textContent = "无法加载条目";
      });
  }

  function init() {
    if (global.LifeSync && LifeSync.init) {
      LifeSync.init().then(initReader);
    } else {
      initReader();
    }
  }

  global.JournalReader = { init: init };
})(window);
