(function (global) {
  "use strict";

  function el(id) {
    return document.getElementById(id);
  }

  function msg(text, ok, logged) {
    var box = logged ? el("sync-message-logged") : el("sync-message");
    if (!box) return;
    box.textContent = text;
    box.style.color = ok === false ? "#c0392b" : "var(--kb-text2)";
  }

  function renderPanels() {
    var st = LifeSync.getSyncStatus();
    var loginPanel = el("sync-panel-login");
    var loggedPanel = el("sync-panel-logged");
    var unconfigured = el("sync-panel-unconfigured");

    if (!st.configured) {
      if (unconfigured) unconfigured.hidden = false;
      if (loginPanel) loginPanel.hidden = true;
      if (loggedPanel) loggedPanel.hidden = true;
      return;
    }
    if (unconfigured) unconfigured.hidden = true;

    if (st.signedIn) {
      if (loginPanel) loginPanel.hidden = true;
      if (loggedPanel) loggedPanel.hidden = false;
      var emailEl = el("sync-user-email");
      if (emailEl) emailEl.textContent = st.email || "—";
    } else {
      if (loginPanel) loginPanel.hidden = false;
      if (loggedPanel) loggedPanel.hidden = true;
    }
  }

  function renderStatus() {
    var bar = el("sync-status-bar");
    if (!bar || !global.LifeSync) return;
    var st = LifeSync.getSyncStatus();
    var dotClass = "off";
    var label = "未登录 · 数据仅在本机";

    if (!st.configured) {
      label = "云同步未配置 · 见 supabase/README.md";
    } else if (st.signedIn) {
      dotClass = "on";
      label = "已登录 · " + (st.email || "云同步开启");
    } else {
      label = "请登录 · 登录后改完即上云";
    }

    bar.innerHTML =
      '<span class="sync-status-dot ' + dotClass + '"></span>' +
      "<span>" + label + "</span>" +
      (st.lastPush ? '<span style="color:var(--kb-text2)">上次上传 ' + st.lastPush.slice(0, 16).replace("T", " ") + "</span>" : "") +
      (st.localUpdated ? '<span style="color:var(--kb-text2)">本地 ' + st.localUpdated.slice(0, 16).replace("T", " ") + "</span>" : "");
  }

  function renderDataList() {
    var list = el("sync-data-list");
    if (!list || !global.LifeSync) return;
    var health = LifeSync.getHealth();
    var goals = LifeSync.getGoalsOverrides();
    var journal = LifeSync.getJournalEntries();
    var notes = LifeSync.getNotes ? LifeSync.getNotes() : [];
    var krCount = Object.keys(goals.krProgress || {}).length;
    var healthDays = Object.keys(health.logs || {}).length;
    list.innerHTML =
      "<li>🏃 健康打卡 · " + healthDays + " 天 · streak " + (health.streak || 0) + "</li>" +
      "<li>🎯 OKR 进度 · " + krCount + " 条 KR 已更新</li>" +
      "<li>📝 决策日记 · " + journal.length + " 篇</li>" +
      "<li>📓 反思笔记 · " + notes.length + " 篇</li>" +
      "<li>💰 财务待办勾选</li>";
  }

  function refresh() {
    renderPanels();
    renderStatus();
    renderDataList();
  }

  function init() {
    refresh();
    LifeSync.onChange(refresh);

    el("sync-btn-login").addEventListener("click", function () {
      var email = el("sync-email").value.trim();
      var password = el("sync-password").value;
      if (!email || !password) {
        msg("请填写邮箱和密码", false, false);
        return;
      }
      msg("登录中…", true, false);
      LifeSync.signIn(email, password)
        .then(function () {
          msg("登录成功，已从云端同步 ✓", true, false);
          refresh();
        })
        .catch(function (e) {
          msg(e.message || "登录失败", false, false);
        });
    });

    el("sync-btn-signup").addEventListener("click", function () {
      var email = el("sync-email").value.trim();
      var password = el("sync-password").value;
      if (!email || !password) {
        msg("请填写邮箱和密码", false, false);
        return;
      }
      if (password.length < 6) {
        msg("密码至少 6 位", false, false);
        return;
      }
      msg("注册中…", true, false);
      LifeSync.signUp(email, password)
        .then(function () {
          msg("注册并登录成功 ✓", true, false);
          refresh();
        })
        .catch(function (e) {
          msg(e.message || "注册失败", false, false);
        });
    });

    el("sync-btn-logout").addEventListener("click", function () {
      LifeSync.signOut().then(function () {
        msg("已退出", true, true);
        refresh();
      });
    });

    el("sync-btn-pull").addEventListener("click", function () {
      msg("拉取中…", true, true);
      LifeSync.pullFromCloud()
        .then(function () {
          msg("拉取完成 ✓", true, true);
          refresh();
        })
        .catch(function (e) {
          msg(e.message || "拉取失败", false, true);
        });
    });

    el("sync-btn-push").addEventListener("click", function () {
      msg("上传中…", true, true);
      LifeSync.pushToCloud()
        .then(function () {
          msg("上传完成 ✓", true, true);
          refresh();
        })
        .catch(function (e) {
          msg(e.message || "上传失败", false, true);
        });
    });

    el("sync-btn-export").addEventListener("click", function () {
      var blob = new Blob([LifeSync.exportJson()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "life-state-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      msg("已导出", true, LifeSync.isSignedIn());
    });

    el("sync-file-import").addEventListener("change", function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        LifeSync.importJson(reader.result)
          .then(function () {
            msg("导入成功 ✓", true, LifeSync.isSignedIn());
            refresh();
          })
          .catch(function () {
            msg("JSON 无效", false, LifeSync.isSignedIn());
          });
      };
      reader.readAsText(file);
      ev.target.value = "";
    });
  }

  global.SyncView = { init: init };
})(window);
