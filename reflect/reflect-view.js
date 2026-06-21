(function (global) {
  "use strict";

  var KIND_LABEL = {
    reflection: "日常反思",
    learning: "学习记录",
    monthly: "月度总结",
    summary: "自由总结",
  };

  var currentKind = "all";

  function el(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function snippet(body) {
    return String(body || "")
      .replace(/^#+\s+/gm, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function renderList() {
    var list = el("reflect-list");
    if (!list || !global.LifeSync) return;

    var notes = LifeSync.getNotes(currentKind === "all" ? null : currentKind);
    if (!notes.length) {
      list.innerHTML = '<div class="reflect-empty">还没有记录 · 点上方按钮写一篇</div>';
      return;
    }

    list.innerHTML =
      '<ul class="reflect-list">' +
      notes
        .map(function (n) {
          return (
            '<li class="reflect-item"><a href="edit.html?id=' +
            encodeURIComponent(n.id) +
            '"><span class="reflect-item-meta"><span class="reflect-kind-tag">' +
            esc(KIND_LABEL[n.kind] || n.kind) +
            "</span>" +
            esc(n.date) +
            "</span><div class=\"reflect-item-title\">" +
            esc(n.title || "无标题") +
            '</div><div class="reflect-item-snippet">' +
            esc(snippet(n.body)) +
            "</div></a></li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function setTab(kind) {
    currentKind = kind;
    document.querySelectorAll(".reflect-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.kind === kind);
    });
    renderList();
  }

  function renderSyncHint() {
    var box = el("reflect-sync-hint");
    if (!box || !global.LifeSync) return;
    var st = LifeSync.getSyncStatus();
    if (st.signedIn) {
      box.textContent = "已登录 · 保存后自动上云";
    } else if (st.configured) {
      box.innerHTML = '未登录 · 数据在本机 · <a href="../settings/index.html">登录同步</a>';
    } else {
      box.textContent = "数据保存在本机浏览器";
    }
  }

  function init() {
    document.querySelectorAll(".reflect-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTab(btn.dataset.kind);
      });
    });

    var params = new URLSearchParams(location.search);
    if (params.get("kind")) {
      currentKind = params.get("kind");
      document.querySelectorAll(".reflect-tab").forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.kind === currentKind);
      });
    }

    renderSyncHint();
    renderList();

    if (global.LifeSync) {
      LifeSync.onChange(function () {
        renderSyncHint();
        renderList();
      });
    }
  }

  global.ReflectView = { init: init, KIND_LABEL: KIND_LABEL };
})(window);
