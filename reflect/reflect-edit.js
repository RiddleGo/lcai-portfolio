(function (global) {
  "use strict";

  var TEMPLATES = {
    reflection:
      "## 今天 / 本周最重要的事\n\n\n## 做对了什么\n\n\n## 做错了什么\n\n\n## 下一步只保留 1 件事\n\n",
    learning:
      "## 来源\n\n书名 / 文章 / 课程：\n\n## 摘录\n\n\n## 3 条 takeaway\n\n1. \n2. \n3. \n\n## 1 条行动（写进 OKR 或项目）\n\n",
    monthly:
      "## 本月最重要 3 件事\n\n1. \n2. \n3. \n\n## 五维一句话\n\n- 财务：\n- 健康：\n- 阅读：\n- 职业：\n- 决策：\n\n## 做对了 / 不再重复\n\n\n## 下月 1 个重点\n\n",
    summary: "## 总结\n\n\n## 待办\n\n",
  };

  var KIND_LABEL = {
    reflection: "日常反思",
    learning: "学习记录",
    monthly: "月度总结",
    summary: "自由总结",
  };

  function el(id) {
    return document.getElementById(id);
  }

  function monthKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function defaultTitle(kind) {
    if (kind === "monthly") return monthKey() + " 月度总结";
    if (kind === "learning") return "学习记录 " + new Date().toISOString().slice(0, 10);
    if (kind === "reflection") return "反思 " + new Date().toISOString().slice(0, 10);
    return "总结 " + new Date().toISOString().slice(0, 10);
  }

  function boot() {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    var kind = params.get("kind") || "reflection";
    var isNew = params.get("new") === "1" || !id;

    var entry = isNew ? null : LifeSync.getNote(id);
    if (!entry && id) {
      el("reflect-edit-body").value = "找不到记录";
      return;
    }

    if (isNew && kind === "monthly") {
      id = "monthly-" + monthKey();
      entry = LifeSync.getNote(id);
    }

    if (!entry) {
      entry = {
        id: kind === "monthly" ? "monthly-" + monthKey() : undefined,
        kind: kind,
        title: defaultTitle(kind),
        date: new Date().toISOString().slice(0, 10),
        body: TEMPLATES[kind] || TEMPLATES.reflection,
      };
    }

    el("reflect-edit-kind").value = entry.kind || kind;
    el("reflect-edit-title").value = entry.title || "";
    el("reflect-edit-date").value = entry.date || new Date().toISOString().slice(0, 10);
    el("reflect-edit-body").value = entry.body || "";

    var sub = el("reflect-edit-sub");
    if (sub) sub.textContent = KIND_LABEL[entry.kind] || "记录";

    el("reflect-edit-kind").addEventListener("change", function () {
      var k = el("reflect-edit-kind").value;
      if (sub) sub.textContent = KIND_LABEL[k] || k;
      if (!el("reflect-edit-body").value.trim() || el("reflect-edit-body").value === TEMPLATES[entry.kind]) {
        el("reflect-edit-body").value = TEMPLATES[k] || TEMPLATES.reflection;
      }
      entry.kind = k;
    });

    el("reflect-edit-save").addEventListener("click", function () {
      var saved = LifeSync.saveNote({
        id: entry.id,
        kind: el("reflect-edit-kind").value,
        title: el("reflect-edit-title").value.trim() || defaultTitle(el("reflect-edit-kind").value),
        date: el("reflect-edit-date").value,
        body: el("reflect-edit-body").value,
        bookTitle: el("reflect-edit-book") ? el("reflect-edit-book").value.trim() : "",
      });
      el("reflect-edit-status").textContent = "已保存 · " + new Date().toLocaleTimeString();
      if (isNew) {
        history.replaceState(null, "", "edit.html?id=" + encodeURIComponent(saved.id));
        entry.id = saved.id;
        isNew = false;
        el("reflect-edit-delete").hidden = false;
      }
    });

    var delBtn = el("reflect-edit-delete");
    if (delBtn) {
      delBtn.hidden = isNew;
      delBtn.addEventListener("click", function () {
        if (!confirm("确定删除？")) return;
        LifeSync.deleteNote(entry.id);
        location.href = "index.html";
      });
    }
  }

  function init() {
    if (global.LifeSync && LifeSync.init) {
      LifeSync.init().then(boot).catch(boot);
    } else {
      boot();
    }
  }

  global.ReflectEdit = { init: init };
})(window);
