(function (global) {
  "use strict";

  function el(id) {
    return document.getElementById(id);
  }

  function renderStatus() {
    var bar = el("sync-status-bar");
    if (!bar || !global.LifeSync) return;
    var st = LifeSync.getSyncStatus();
    var dotClass = st.enabled ? "on" : "off";
    var label = st.enabled
      ? "云同步已开启 · Gist " + st.gistId.slice(0, 8) + "…"
      : "云同步未配置 · 数据仅在本机，换电脑会丢";
    bar.innerHTML =
      '<span class="sync-status-dot ' + dotClass + '"></span>' +
      "<span>" + label + "</span>" +
      (st.lastPush ? '<span style="color:var(--kb-text2)">上次上传 ' + st.lastPush.slice(0, 16).replace("T", " ") + "</span>" : "") +
      (st.localUpdated ? '<span style="color:var(--kb-text2)">本地更新 ' + st.localUpdated.slice(0, 16).replace("T", " ") + "</span>" : "");
  }

  function renderDataList() {
    var list = el("sync-data-list");
    if (!list || !global.LifeSync) return;
    var s = LifeSync.getSyncStatus();
    var health = LifeSync.getHealth();
    var goals = LifeSync.getGoalsOverrides();
    var journal = LifeSync.getJournalEntries();
    var krCount = Object.keys(goals.krProgress || {}).length;
    var healthDays = Object.keys(health.logs || {}).length;
    list.innerHTML =
      "<li>🏃 健康打卡 · " + healthDays + " 天记录 · streak " + (health.streak || 0) + "</li>" +
      "<li>🎯 OKR 进度 · " + krCount + " 条 KR 已本地更新</li>" +
      "<li>📝 决策日记 · " + journal.length + " 篇云端/本地记录</li>" +
      "<li>💰 财务待办勾选 · 随财务页操作同步</li>";
  }

  function msg(text, ok) {
    var box = el("sync-message");
    if (!box) return;
    box.textContent = text;
    box.style.color = ok === false ? "#c0392b" : "var(--kb-text2)";
  }

  function init() {
    renderStatus();
    renderDataList();

    LifeSync.onChange(function () {
      renderStatus();
      renderDataList();
    });

    var cfg = LifeSync.getSyncStatus();
    if (cfg.gistId && el("sync-gist-id")) el("sync-gist-id").value = cfg.gistId;

    el("sync-btn-connect").addEventListener("click", function () {
      var token = el("sync-token").value.trim();
      var gistId = el("sync-gist-id").value.trim();
      if (!token) {
        msg("请填写 GitHub Token", false);
        return;
      }
      if (!gistId) {
        msg("请填写 Gist ID，或点「创建新 Gist 并连接」", false);
        return;
      }
      msg("连接中…");
      LifeSync.setCloudCredentials(token, gistId)
        .then(function () {
          msg("已连接并同步 ✓", true);
          renderStatus();
        })
        .catch(function (e) {
          msg(e.message || "连接失败", false);
        });
    });

    el("sync-btn-create").addEventListener("click", function () {
      var token = el("sync-token").value.trim();
      if (!token) {
        msg("请填写 GitHub Token", false);
        return;
      }
      msg("创建 Gist 中…");
      LifeSync.createGist(token)
        .then(function (id) {
          el("sync-gist-id").value = id;
          msg("已创建 Gist " + id + " 并完成首次上传 ✓", true);
          renderStatus();
        })
        .catch(function (e) {
          msg(e.message || "创建失败", false);
        });
    });

    el("sync-btn-pull").addEventListener("click", function () {
      msg("拉取中…");
      LifeSync.pullFromCloud()
        .then(function () {
          msg("拉取完成 ✓", true);
          renderStatus();
          renderDataList();
        })
        .catch(function (e) {
          msg(e.message || "拉取失败", false);
        });
    });

    el("sync-btn-push").addEventListener("click", function () {
      msg("上传中…");
      LifeSync.pushToCloud()
        .then(function () {
          msg("上传完成 ✓", true);
          renderStatus();
        })
        .catch(function (e) {
          msg(e.message || "上传失败", false);
        });
    });

    el("sync-btn-disconnect").addEventListener("click", function () {
      if (!confirm("断开云同步？本地数据仍保留，但不再自动上传。")) return;
      LifeSync.disconnectCloud();
      el("sync-token").value = "";
      el("sync-gist-id").value = "";
      msg("已断开");
      renderStatus();
    });

    el("sync-btn-export").addEventListener("click", function () {
      var blob = new Blob([LifeSync.exportJson()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "life-state-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      msg("已导出 JSON 文件", true);
    });

    el("sync-file-import").addEventListener("change", function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          LifeSync.importJson(reader.result);
          msg("导入成功 ✓", true);
          renderDataList();
          renderStatus();
        } catch (e) {
          msg("JSON 格式无效", false);
        }
      };
      reader.readAsText(file);
      ev.target.value = "";
    });
  }

  global.SyncView = { init: init };
})(window);
