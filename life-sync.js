/**
 * 人生中枢 · 统一状态存储 + Supabase 云同步
 * 登录后：健康 / OKR / 日记 / 财务勾选 改完即上云
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "life-state-v1";
  var META_KEY = "life-sync-meta-v2";
  var HEALTH_LEGACY = "life-health-v1";
  var SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  var state = null;
  var meta = null;
  var client = null;
  var syncTimer = null;
  var syncing = false;
  var listeners = [];
  var sessionUser = null;

  function defaultState() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      health: { logs: {}, streak: 0 },
      goals: { krProgress: {}, seasonBooks: {} },
      journal: { entries: [] },
      finance: { todoDone: null, overrides: null },
      dailyTodo: { days: {} },
      meta: { todoStorageKey: null, overridesKey: null },
    };
  }

  function loadMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveMeta(m) {
    meta = m || {};
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function isConfigured() {
    var cfg = global.SUPABASE_CONFIG;
    return !!(cfg && cfg.url && cfg.anonKey);
  }

  function loadSupabaseScript() {
    if (global.supabase && global.supabase.createClient) return Promise.resolve();
    if (!isConfigured()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-life-supabase="1"]')) {
        var t = setInterval(function () {
          if (global.supabase) {
            clearInterval(t);
            resolve();
          }
        }, 50);
        setTimeout(function () {
          clearInterval(t);
          resolve();
        }, 5000);
        return;
      }
      var s = document.createElement("script");
      s.src = SUPABASE_CDN;
      s.dataset.lifeSupabase = "1";
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("无法加载 Supabase SDK"));
      };
      document.head.appendChild(s);
    });
  }

  function initClient() {
    if (client) return client;
    if (!isConfigured() || !global.supabase) return null;
    client = global.supabase.createClient(global.SUPABASE_CONFIG.url, global.SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorage,
      },
    });
    client.auth.onAuthStateChange(function (event, session) {
      sessionUser = session && session.user ? session.user : null;
      if (event === "SIGNED_IN") {
        pullFromCloud().catch(function () {});
      }
      if (event === "SIGNED_OUT") {
        sessionUser = null;
      }
      notify({ type: "auth", event: event });
    });
    return client;
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
    if (s.health) localStorage.setItem(HEALTH_LEGACY, JSON.stringify(s.health));
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

  function mergeRemote(remote) {
    if (!remote || typeof remote !== "object") return;
    var local = getState();
    var localAt = local.updatedAt || "";
    var remoteAt = remote.updatedAt || "";
    if (remoteAt >= localAt) {
      state = migrateLegacyInto(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      applyToLegacyStores();
      notify({ type: "pull", at: remoteAt });
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

  function getSession() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      sessionUser = session && session.user ? session.user : null;
      return session;
    });
  }

  function pullFromCloud() {
    if (!client) return Promise.resolve(false);
    return getSession().then(function (session) {
      if (!session) return false;
      return client
        .from("life_state")
        .select("data, updated_at")
        .eq("user_id", session.user.id)
        .maybeSingle();
    }).then(function (res) {
      if (res && res.error) throw new Error(res.error.message);
      if (!res || !res.data) {
        return pushToCloud();
      }
      mergeRemote(res.data.data);
      meta = loadMeta();
      meta.lastPull = new Date().toISOString();
      saveMeta(meta);
      return true;
    });
  }

  function pushToCloud() {
    if (!client || syncing) return Promise.resolve(false);
    return getSession().then(function (session) {
      if (!session) return false;
      syncing = true;
      collectFromLegacyStores();
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return client
        .from("life_state")
        .upsert({ user_id: session.user.id, data: state }, { onConflict: "user_id" })
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);
          meta = loadMeta();
          meta.lastPush = new Date().toISOString();
          saveMeta(meta);
          notify({ type: "push", at: meta.lastPush });
          return true;
        })
        .finally(function () {
          syncing = false;
        });
    });
  }

  function scheduleCloudSync() {
    if (!client || !sessionUser) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      pushToCloud().catch(function (e) {
        notify({ type: "error", message: e.message });
      });
    }, 800);
  }

  function init() {
    meta = loadMeta();
    state = loadLocal();
    applyToLegacyStores();
    if (!isConfigured()) return Promise.resolve(getState());

    return loadSupabaseScript()
      .then(function () {
        initClient();
        if (!client) return getState();
        return client.auth.getSession().then(function (res) {
          sessionUser = res.data.session && res.data.session.user ? res.data.session.user : null;
          if (sessionUser) {
            return pullFromCloud()
              .catch(function (e) {
                notify({ type: "error", message: e.message });
              })
              .then(function () {
                return getState();
              });
          }
          return getState();
        });
      })
      .catch(function () {
        return getState();
      });
  }

  function isSignedIn() {
    return !!sessionUser;
  }

  function isCloudEnabled() {
    return isConfigured() && isSignedIn();
  }

  function getSyncStatus() {
    meta = meta || loadMeta();
    return {
      configured: isConfigured(),
      enabled: isCloudEnabled(),
      signedIn: isSignedIn(),
      email: sessionUser ? sessionUser.email : "",
      lastPull: meta.lastPull || "",
      lastPush: meta.lastPush || "",
      localUpdated: getState().updatedAt || "",
    };
  }

  function signIn(email, password) {
    if (!client) return Promise.reject(new Error("Supabase 未配置，见 supabase/README.md"));
    return client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      sessionUser = res.data.user;
      return pullFromCloud().then(function () {
        return pushToCloud();
      }).then(function () {
        return res.data.user;
      });
    });
  }

  function signUp(email, password) {
    if (!client) return Promise.reject(new Error("Supabase 未配置，见 supabase/README.md"));
    return client.auth.signUp({ email: email, password: password }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      if (res.data.session) {
        sessionUser = res.data.user;
        return pushToCloud().then(function () {
          return res.data.user;
        });
      }
      return signIn(email, password);
    });
  }

  function signOut() {
    if (!client) return Promise.resolve();
    return client.auth.signOut().then(function () {
      sessionUser = null;
      notify({ type: "auth", event: "SIGNED_OUT" });
    });
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
    if (isCloudEnabled()) {
      return pushToCloud().then(function () {
        return getState();
      });
    }
    return Promise.resolve(getState());
  }

  function onChange(fn) {
    listeners.push(fn);
  }

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

  function getDailyTodoDay(dateKey) {
    var s = getState();
    if (!s.dailyTodo) s.dailyTodo = { days: {} };
    return s.dailyTodo.days[dateKey] || null;
  }

  function saveDailyTodoDay(dateKey, dayData) {
    var s = getState();
    if (!s.dailyTodo) s.dailyTodo = { days: {} };
    if (dayData == null) delete s.dailyTodo.days[dateKey];
    else s.dailyTodo.days[dateKey] = dayData;
    persistLocal();
  }

  function setDailyItemDone(dateKey, itemId, done) {
    var day = getDailyTodoDay(dateKey);
    if (!day) return;
    if (!day.completed) day.completed = {};
    day.completed[itemId] = !!done;
    saveDailyTodoDay(dateKey, day);
  }

  global.LifeSync = {
    init: init,
    isConfigured: isConfigured,
    isSignedIn: isSignedIn,
    isCloudEnabled: isCloudEnabled,
    getSyncStatus: getSyncStatus,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
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
    getDailyTodoDay: getDailyTodoDay,
    saveDailyTodoDay: saveDailyTodoDay,
    setDailyItemDone: setDailyItemDone,
    STORAGE_KEY: STORAGE_KEY,
  };
})(window);
