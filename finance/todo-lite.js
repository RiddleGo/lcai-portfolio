/** 财务待办摘要（无 DOM 依赖，供今日 Todo 等页面使用） */
(function (global) {
  "use strict";

  function cfg() {
    return global.FINANCE_CONFIG || {};
  }

  function stripHtml(s) {
    return String(s || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTodoItemById(id) {
    var groups = cfg().todoGroups || [];
    for (var i = 0; i < groups.length; i++) {
      var items = groups[i].items || [];
      for (var j = 0; j < items.length; j++) {
        if (items[j].id === id) return items[j];
      }
    }
    return null;
  }

  function isTodoDone(state, id) {
    var v = state && state[id];
    if (!v) return false;
    if (typeof v === "boolean") return v;
    return !!v.done;
  }

  function getPendingTodos(limit) {
    var state = {};
    try {
      if (global.LifeSync && LifeSync.getState) {
        var s = LifeSync.getState();
        if (s.finance && s.finance.todoDone) state = s.finance.todoDone;
      }
      if (!Object.keys(state).length && global.FinanceCore && FinanceCore.loadTodoState) {
        state = FinanceCore.loadTodoState();
      }
      if (!Object.keys(state).length) {
        var key = cfg().todoStorageKey || "lcai-exec-todos-v9";
        var raw = localStorage.getItem(key);
        if (raw) state = JSON.parse(raw);
      }
    } catch (e) {}

    var map = cfg().monthTodoMap || {};
    var result = [];
    var max = limit == null ? 10 : limit;
    var months = Object.keys(map);

    for (var mi = 0; mi < months.length; mi++) {
      var ids = map[months[mi]] || [];
      for (var ii = 0; ii < ids.length; ii++) {
        var tid = ids[ii];
        if (isTodoDone(state, tid)) continue;
        var item = getTodoItemById(tid);
        if (!item) continue;
        result.push({
          id: tid,
          month: months[mi],
          text: stripHtml(item.text),
          href: "../finance/index.html#plan",
        });
        if (result.length >= max) return result;
      }
    }
    return result;
  }

  global.TodoLite = { getPendingTodos: getPendingTodos };
})(window);
