/**
 * 人生中枢 · 统一状态存储 + 可选 GitHub Gist 云同步
 * 健康打卡、OKR 进度、决策日记、财务待办勾选 → 一处保存，换机可恢复
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "life-state-v1";
  var CONFIG_KEY = "life-sync-config-v1";
  var GIST_FILE = "life-state.json";
  var HEALTH_LEGACY = "life-health-v1";

  var state = null;
  var config = null;
  var syncTimer = null;
  var syncing = false;
  var listeners = [];

  function defaultState() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      health: { logs: {}, streak: 0 },
      goals: { krProgress: {}, seasonBooks: {} },
      journal: { entries: [] },
      finance: { todoDone: null, overrides: null },
      meta: { todoStorageKey: null, overridesKey: null },
    };
  }

  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveConfig(c) {
    config = c || {};
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  function migrateLegacyInto(s) {
    if (!s.health || !Object.keys(s.health.logs || {}).length) {
      try {
        var h = JSON.parse(localStorage.getItem(HEALTH_LEGACY) || "{}");
        if (h.logs && Object.keys(h.logs).length) s.health = h;
      } catch (e) {}
    }
    var todoKey = s.meta && s.meta.todoStorageKey;
    var ovKey = s.meta && s.meta.overridesKey;
    if (global.FINANCE_CONFIG) {
      todoKey = todoKey || global.FINANCE_CONFIG.todoStorageKey;
      ovKey = ovKey || global.FINANCE_CONFIG.overridesKey;
    }
    if (!s.finance) s.finance = { todoDone: null, overrides: null };
    if (!s.finance.todoDone && todoKey) {
      try {
        var raw = localStorage.getItem(todoKey);
        if (raw) s.finance.todoDone = JSON.parse(raw);
      } catch (e) {}
    }
    if (!s.finance.overrides && ovKey) {
      try {
        var oRaw = localStorage.getItem(ovKey);
        if (oRaw) s.finance.overrides = JSON.parse(oRaw);
      } catch (e) {}
    }
    if (todoKey) s.meta.todoStorageKey = todoKey;
    if (ovKey) s.meta.overridesKey = ovKey;
    return s;
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrateLegacyInto(JSON.parse(raw));
    } catch (e) {}
    return migrateLegacyInto(defaultState());
  }

  function getState() {
    if (!state) state = loadLocal();
    return state;
  }

  function notify(status) {
    listeners.forEach(function (fn) {
      try {
        fn(status || {});
      } catch (e) {}
    });
  }

  function applyToLegacyStores() {
    var s = getState();
    if (s.health) {
      localStorage.setItem(HEALTH_LEGACY, JSON.stringify(s.health));
    }
    if (s.finance && s.finance.todoDone && s.meta.todoStorageKey) {
      localStorage.setItem(s.meta.todoStorageKey, JSON.stringify(s.finance.todoDone));
    }
    if (s.finance && s.finance.overrides && s.meta.overridesKey) {
      localStorage.setItem(s.meta.overridesKey, JSON.stringify(s.finance.overrides));
    }
  }

  function collectFromLegacyStores() {
    var s = getState();
    try {
      var h = JSON.parse(localStorage.getItem(HEALTH_LEGACY) || "{}");
      if (h.logs) s.health = h;
    } catch (e) {}
    var todoKey = s.meta.todoStorageKey;
    var ovKey = s.meta.overridesKey;
    if (global.FINANCE_CONFIG) {
      if (!todoKey) todoKey = global.FINANCE_CONFIG.todoStorageKey;
      if (!ovKey) ovKey = global.FINANCE_CONFIG.overridesKey;
      s.meta.todoStorageKey = todoKey;
      s.meta.overridesKey = ovKey;
    }
    if (todoKey) {
      try {
        var t = localStorage.getItem(todoKey);
        if (t) s.finance.todoDone = JSON.parse(t);
      } catch (e) {}
    }
    if (ovKey) {
      try {
        var o = localStorage.getItem(ovKey);
        if (o) s.finance.overrides = JSON.parse(o);
      } catch (e) {}
    }
  }

  function persistLocal() {
    collectFromLegacyStores();
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    applyToLegacyStores();
    notify({ type: "local", at: state.updatedAt });
    scheduleCloudSync();
  }

  function mergeRemote(remote) {
    if (!remote || typeof remote !== "object") return;
    var local = getState();
    var localAt = local.updatedAt || "";
    var remoteAt = remote.updatedAt || "";
    if (remoteAt > localAt) {
      state = migrateLegacyInto(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      applyToLegacyStores();
      notify({ type: "pull", at: remoteAt });
    }
  }

  function authHeaders() {
    return {
      Authorization: "Bearer " + config.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function pullFromCloud() {
    if (!config.gistId || !config.token) return Promise.resolve(false);
    return fetch("https://api.github.com/gists/" + config.gistId, { headers: authHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error("拉取失败 " + r.status);
        return r.json();
      })
      .then(function (gist) {
        var file = gist.files && gist.files[GIST_FILE];
        if (!file || !file.content) return false;
        mergeRemote(JSON.parse(file.content));
        config.lastPull = new Date().toISOString();
        saveConfig(config);
        return true;
      });
  }

  function pushToCloud() {
    if (!config.gistId || !config.token || syncing) return Promise.resolve(false);
    syncing = true;
    collectFromLegacyStores();
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    var body = {
      files: {},
    };
    body.files[GIST_FILE] = { content: JSON.stringify(state, null, 2) };
    return fetch("https://api.github.com/gists/" + config.gistId, {
      method: "PATCH",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(body),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("上传失败 " + r.status);
        config.lastPush = new Date().toISOString();
        saveConfig(config);
        notify({ type: "push", at: config.lastPush });
        return true;
      })
      .finally(function () {
        syncing = false;
      });
  }

  function scheduleCloudSync() {
    if (!config || !config.gistId || !config.token) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      pushToCloud().catch(function (e) {
        notify({ type: "error", message: e.message });
      });
    }, 1500);
  }

  function init() {
    config = loadConfig();
    state = loadLocal();
    applyToLegacyStores();
    if (!config.gistId || !config.token) {
      return Promise.resolve(getState());
    }
    return pullFromCloud()
      .catch(function (e) {
        notify({ type: "error", message: e.message });
        return false;
      })
      .then(function () {
        return getState();
      });
  }

  function isCloudEnabled() {
    config = config || loadConfig();
    return !!(config.gistId && config.token);
  }

  function getSyncStatus() {
    config = config || loadConfig();
    return {
      enabled: isCloudEnabled(),
      gistId: config.gistId || "",
      lastPull: config.lastPull || "",
      lastPush: config.lastPush || "",
      localUpdated: getState().updatedAt || "",
    };
  }

  function setCloudCredentials(token, gistId) {
    saveConfig({ token: token || "", gistId: gistId || "", lastPull: "", lastPush: "" });
    return pullFromCloud().then(function () {
      return pushToCloud();
    });
  }

  function createGist(token) {
    if (!token) return Promise.reject(new Error("需要 GitHub Token"));
    collectFromLegacyStores();
    state.updatedAt = new Date().toISOString();
    var initialContent = JSON.stringify(state, null, 2);
    var payload = {
      description: "Russshare 人生中枢 · 私密同步",
      public: false,
      files: {},
    };
    payload.files[GIST_FILE] = { content: initialContent };
    return fetch("https://api.github.com/gists", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }),
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("创建 Gist 失败 " + r.status);
        return r.json();
      })
      .then(function (gist) {
        saveConfig({ token: token, gistId: gist.id, lastPull: "", lastPush: "" });
        return pushToCloud().then(function () {
          return gist.id;
        });
      });
  }

  function disconnectCloud() {
    saveConfig({});
    config = {};
  }

  function exportJson() {
    collectFromLegacyStores();
    state.updatedAt = new Date().toISOString();
    return JSON.stringify(state, null, 2);
  }

  function importJson(text) {
    var parsed = JSON.parse(text);
    state = migrateLegacyInto(parsed);
    persistLocal();
    return getState();
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  /* ── 模块 API ── */

  function getHealth() {
    return getState().health || { logs: {}, streak: 0 };
  }

  function setHealth(data) {
    getState().health = data;
    persistLocal();
  }

  function getGoalsOverrides() {
    return getState().goals || { krProgress: {}, seasonBooks: {} };
  }

  function setKrProgress(krId, progress) {
    var g = getGoalsOverrides();
    g.krProgress[krId] = Number(progress);
    getState().goals = g;
    persistLocal();
  }

  function getJournalEntries() {
    return (getState().journal && getState().journal.entries) || [];
  }

  function saveJournalEntry(entry) {
    var s = getState();
    if (!s.journal) s.journal = { entries: [] };
    var list = s.journal.entries;
    var idx = list.findIndex(function (e) {
      return e.id === entry.id;
    });
    entry.updatedAt = new Date().toISOString();
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    persistLocal();
    return entry;
  }

  function getJournalEntry(id) {
    return getJournalEntries().find(function (e) {
      return e.id === id;
    });
  }

  function deleteJournalEntry(id) {
    var s = getState();
    if (!s.journal) return;
    s.journal.entries = s.journal.entries.filter(function (e) {
      return e.id !== id;
    });
    persistLocal();
  }

  function syncFinanceTodo(todoState) {
    var s = getState();
    if (!s.finance) s.finance = {};
    s.finance.todoDone = todoState;
    if (global.FINANCE_CONFIG) {
      s.meta.todoStorageKey = global.FINANCE_CONFIG.todoStorageKey;
      s.meta.overridesKey = global.FINANCE_CONFIG.overridesKey;
    }
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify({ type: "local", at: state.updatedAt });
    scheduleCloudSync();
  }

  function syncFinanceOverrides(overrides) {
    var s = getState();
    if (!s.finance) s.finance = {};
    s.finance.overrides = overrides;
    if (global.FINANCE_CONFIG) {
      s.meta.todoStorageKey = global.FINANCE_CONFIG.todoStorageKey;
      s.meta.overridesKey = global.FINANCE_CONFIG.overridesKey;
    }
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify({ type: "local", at: state.updatedAt });
    scheduleCloudSync();
  }

  function applyFinanceToLocalStorage() {
    var s = getState();
    if (s.finance && s.finance.todoDone && s.meta.todoStorageKey) {
      localStorage.setItem(s.meta.todoStorageKey, JSON.stringify(s.finance.todoDone));
    }
    if (s.finance && s.finance.overrides && s.meta.overridesKey) {
      localStorage.setItem(s.meta.overridesKey, JSON.stringify(s.finance.overrides));
    }
  }

  global.LifeSync = {
    init: init,
    isCloudEnabled: isCloudEnabled,
    getSyncStatus: getSyncStatus,
    setCloudCredentials: setCloudCredentials,
    createGist: createGist,
    disconnectCloud: disconnectCloud,
    pullFromCloud: pullFromCloud,
    pushToCloud: pushToCloud,
    exportJson: exportJson,
    importJson: importJson,
    onChange: onChange,
    getHealth: getHealth,
    setHealth: setHealth,
    getGoalsOverrides: getGoalsOverrides,
    setKrProgress: setKrProgress,
    getJournalEntries: getJournalEntries,
    getJournalEntry: getJournalEntry,
    saveJournalEntry: saveJournalEntry,
    deleteJournalEntry: deleteJournalEntry,
    syncFinanceTodo: syncFinanceTodo,
    syncFinanceOverrides: syncFinanceOverrides,
    applyFinanceToLocalStorage: applyFinanceToLocalStorage,
    STORAGE_KEY: STORAGE_KEY,
  };
})(window);
