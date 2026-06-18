/**
 * LCAI 管理员门控 — 财务计划（执行/债务/规划）需密码解锁（session 有效）
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "lcai-admin-v1";
  var PASS_HASH = "475ebc3124b955d576d1eb97154303af6dbd8f61a82c7139fe3430ce50915950";
  var ADMIN_PAGES = {
    plan: true,
    debt: true,
    policy: true,
  };

  function isUnlocked() {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  }

  function setUnlocked() {
    sessionStorage.setItem(STORAGE_KEY, "1");
  }

  function sha256Hex(text) {
    if (!global.crypto || !global.crypto.subtle) {
      return Promise.reject(new Error("crypto unavailable"));
    }
    var enc = new TextEncoder();
    return global.crypto.subtle
      .digest("SHA-256", enc.encode(text + ":lcai-admin-v1"))
      .then(function (buf) {
        return Array.from(new Uint8Array(buf))
          .map(function (b) {
            return b.toString(16).padStart(2, "0");
          })
          .join("");
      });
  }

  function verifyPassword(pw) {
    return sha256Hex(pw).then(function (hash) {
      return hash === PASS_HASH;
    });
  }

  var overlayEl = null;
  var pendingTarget = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement("div");
    overlayEl.id = "lcai-admin-overlay";
    overlayEl.className = "lcai-admin-overlay";
    overlayEl.hidden = true;
    overlayEl.innerHTML =
      '<div class="lcai-admin-modal" role="dialog" aria-modal="true" aria-labelledby="lcai-admin-title">' +
      '<h3 id="lcai-admin-title">管理员验证</h3>' +
      '<p>财务计划（执行 / 债务 / 规划）含个人还款与现金流数据，请输入管理密码继续。</p>' +
      '<label for="lcai-admin-pw">管理密码</label>' +
      '<input id="lcai-admin-pw" type="password" autocomplete="current-password" placeholder="请输入密码">' +
      '<p class="lcai-admin-error" id="lcai-admin-error" aria-live="polite"></p>' +
      '<div class="lcai-admin-actions">' +
      '<button type="button" class="lcai-admin-cancel">取消</button>' +
      '<button type="button" class="lcai-admin-submit">解锁</button>' +
      '</div></div>';
    document.body.appendChild(overlayEl);

    var pwInput = overlayEl.querySelector("#lcai-admin-pw");
    var errEl = overlayEl.querySelector("#lcai-admin-error");

    function close() {
      overlayEl.hidden = true;
      pendingTarget = null;
      errEl.textContent = "";
      pwInput.value = "";
    }

    overlayEl.querySelector(".lcai-admin-cancel").addEventListener("click", close);
    overlayEl.addEventListener("click", function (e) {
      if (e.target === overlayEl) close();
    });

    function submit() {
      var pw = pwInput.value;
      if (!pw) {
        errEl.textContent = "请输入密码";
        return;
      }
      verifyPassword(pw).then(function (ok) {
        if (!ok) {
          errEl.textContent = "密码错误";
          pwInput.focus();
          return;
        }
        setUnlocked();
        close();
        if (typeof global.__lcaiRenderAll === "function") global.__lcaiRenderAll();
        if (pendingTarget && typeof pendingTarget === "function") pendingTarget();
        pendingTarget = null;
      }).catch(function () {
        errEl.textContent = "当前环境无法验证，请换浏览器重试";
      });
    }

    overlayEl.querySelector(".lcai-admin-submit").addEventListener("click", submit);
    pwInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submit();
    });
    return overlayEl;
  }

  function promptUnlock(onSuccess) {
    ensureOverlay();
    pendingTarget = onSuccess || null;
    overlayEl.hidden = false;
    var pwInput = overlayEl.querySelector("#lcai-admin-pw");
    pwInput.focus();
  }

  function pageFromHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) return "home";
    if (h === "screen") return "screen";
    if (h === "criteria") return "criteria";
    if (h === "books" || h.indexOf("books") === 0) return "books";
    if (h === "handbook") return "handbook";
    if (h === "etf") return "etf";
    return h;
  }

  function needsAdmin(page) {
    return !!ADMIN_PAGES[page];
  }

  function guardPage(page, action) {
    if (!needsAdmin(page) || isUnlocked()) {
      action();
      return;
    }
    promptUnlock(action);
  }

  function bindPortalCards() {
    /* 门户卡片无需门控，财务计划在资产总览内受保护 */
  }

  function wrapOverviewNavigation() {
    if (!global.switchTab || global.switchTab.__lcaiGuarded) return;

    var original = global.switchTab;
    function guarded(page) {
      guardPage(page, function () {
        original(page);
      });
    }
    guarded.__lcaiGuarded = true;
    global.switchTab = guarded;

    document.querySelectorAll(".tab-btn[data-page]").forEach(function (btn) {
      var page = btn.dataset.page;
      if (!page) return;
      var clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener("click", function () {
        guarded(page);
      });
    });

    document.querySelectorAll("[data-goto]").forEach(function (btn) {
      var page = btn.dataset.goto;
      if (!needsAdmin(page)) return;
      var clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener("click", function () {
        guarded(page);
      });
    });
  }

  function initOverview() {
    wrapOverviewNavigation();

    var initial = pageFromHash();
    if (needsAdmin(initial) && !isUnlocked()) {
      promptUnlock(function () {
        if (global.switchTab) global.switchTab(initial);
      });
    }
  }

  global.LCAIAdminGate = {
    isUnlocked: isUnlocked,
    promptUnlock: promptUnlock,
    guardPage: guardPage,
    needsAdmin: needsAdmin,
    pageFromHash: pageFromHash,
    bindPortalCards: bindPortalCards,
    initOverview: initOverview,
  };
})(window);
