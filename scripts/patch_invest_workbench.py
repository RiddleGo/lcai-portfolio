#!/usr/bin/env python3
"""修复 invest/workbench.html — 移除 inline 财务脚本，改用 FinanceCore"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INVEST = ROOT / "invest" / "workbench.html"

SLIM = r'''
  <script src="../finance/finance-config-data.js"></script>
  <script src="../finance/finance-core.js"></script>
  <script src="../site-admin-gate.js"></script>
  <script>
    function renderHomeFinanceSummary() {
      if (!window.FinanceCore || !window.FINANCE_CONFIG) {
        ["home-sec-total","home-sec-pnl","home-holdings-count","home-urgent-amount"].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.textContent = "—";
        });
        var sub = document.getElementById("home-urgent-sub");
        if (sub) sub.textContent = "前往财务计划查看";
        var netSub = document.getElementById("home-net-worth-sub");
        if (netSub) netSub.textContent = "finance/index.html";
        return;
      }
      var todoState = FinanceCore.loadTodoState();
      var state = FinanceCore.computeState(todoState);
      var active = state.holdings.filter(function(h) { return !h.sold; });
      var fmtInt = function(n) { return Math.round(n).toLocaleString("zh-CN"); };
      var secTotal = document.getElementById("home-sec-total");
      var secPnl = document.getElementById("home-sec-pnl");
      var holdCount = document.getElementById("home-holdings-count");
      var netSub = document.getElementById("home-net-worth-sub");
      if (secTotal) secTotal.textContent = fmtInt(state.securitiesTotal);
      if (secPnl) {
        secPnl.textContent = (state.stockPnl >= 0 ? "+" : "") + fmtInt(state.stockPnl);
        secPnl.className = "val " + (state.stockPnl >= 0 ? "gain" : "loss");
      }
      if (holdCount) holdCount.textContent = String(active.length);
      if (netSub) netSub.textContent = "净资产 " + fmtInt(state.netWorth) + " · 负债 " + fmtInt(state.liabilitiesTotal);
      var summary = FinanceCore.getPortalSummary();
      var urgentAmt = document.getElementById("home-urgent-amount");
      var urgentSub = document.getElementById("home-urgent-sub");
      if (urgentAmt) urgentAmt.textContent = "→";
      if (urgentSub && summary.sub) urgentSub.textContent = summary.sub;
      var todoTotal = (window.FINANCE_CONFIG.todoGroups || []).reduce(function(a, g) { return a + g.items.length; }, 0);
      var done = 0;
      try {
        var raw = localStorage.getItem(window.FINANCE_CONFIG.todoStorageKey);
        var st = raw ? JSON.parse(raw) : {};
        Object.keys(st).forEach(function(k) {
          var v = st[k];
          if (v && (v.done || v === true)) done++;
        });
      } catch (_) {}
      var homeDone = document.getElementById("home-todo-done");
      var homeTotal = document.getElementById("home-todo-total");
      var homeBar = document.getElementById("home-todo-bar");
      if (homeDone) homeDone.textContent = done;
      if (homeTotal) homeTotal.textContent = todoTotal;
      if (homeBar) homeBar.style.width = todoTotal ? (done / todoTotal * 100) + "%" : "0%";
    }

    function closeShellDrawer() {
      document.getElementById("shell-sidebar")?.classList.remove("open");
      var ov = document.getElementById("shell-overlay");
      if (ov) ov.hidden = true;
    }

    var PAGE_TITLES = {
      home: "首页", etf: "ETF", screen: "选股", criteria: "规则", books: "书籍", handbook: "手册",
    };

    function switchTab(page) {
      window.ScreenHoldings?.closeModal?.();
      closeShellDrawer();
      document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
      document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("active"); });
      var btn = document.querySelector('.tab-btn[data-page="' + page + '"]');
      if (btn) {
        btn.classList.add("active");
        btn.closest(".nav-group")?.setAttribute("open", "");
      }
      var el = document.getElementById("page-" + page);
      if (el) el.classList.add("active");
      var titleEl = document.getElementById("shell-page-title");
      if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;
      if (page === "screen") {
        history.replaceState(null, "", "#screen");
        window.ScreenUI?.init?.();
      } else if (page === "home") {
        if (location.hash) history.replaceState(null, "", location.pathname);
        renderHomeFinanceSummary();
      } else if (page === "criteria") {
        history.replaceState(null, "", "#criteria");
        window.CriteriaView?.load?.();
      } else if (page === "books") {
        history.replaceState(null, "", "#books");
        window.BooksView?.load?.();
      } else if (page === "handbook") {
        history.replaceState(null, "", "#handbook");
        window.HandbookView?.load?.();
      } else if (page === "etf") {
        history.replaceState(null, "", "#etf");
        window.EtfPlanView?.render?.();
      }
    }
    window.switchTab = switchTab;

    function runHomeScreen() {
      var sym = document.getElementById("home-symbol-input")?.value?.trim();
      switchTab("screen");
      if (sym) {
        var input = document.getElementById("symbol-input");
        if (input) input.value = sym;
        window.ScreenUI?.init?.();
        document.getElementById("btn-screen")?.click();
      }
    }

    document.getElementById("btn-home-screen")?.addEventListener("click", runHomeScreen);
    document.getElementById("home-symbol-input")?.addEventListener("keydown", function(e) {
      if (e.key === "Enter") runHomeScreen();
    });
    document.querySelectorAll(".tab-btn[data-page]").forEach(function(btn) {
      btn.addEventListener("click", function() { switchTab(btn.dataset.page); });
    });
    document.querySelectorAll("[data-goto]").forEach(function(btn) {
      var page = btn.dataset.goto;
      if (page === "plan" || page === "stock" || page === "debt") {
        btn.addEventListener("click", function(e) {
          e.preventDefault();
          location.href = "../finance/index.html#" + page;
        });
        return;
      }
      btn.addEventListener("click", function() { switchTab(page); });
    });

    if (location.hash === "#screen") switchTab("screen");
    if (location.hash === "#criteria") switchTab("criteria");
    if (location.hash === "#books" || location.hash.startsWith("#books")) switchTab("books");
    if (location.hash === "#handbook") switchTab("handbook");
    if (location.hash === "#etf") switchTab("etf");

    document.getElementById("shell-menu-btn")?.addEventListener("click", function() {
      document.getElementById("shell-sidebar")?.classList.add("open");
      document.getElementById("shell-overlay").hidden = false;
    });
    document.getElementById("shell-overlay")?.addEventListener("click", closeShellDrawer);

    renderHomeFinanceSummary();
    window.LCAIAdminGate?.initOverview?.("finance");
  </script>
'''


def main():
    html = INVEST.read_text(encoding="utf-8")

    # Fix script paths without ../
    for name in [
        "screen-data.js", "screen-engine.js", "screen-ai-layers.js", "screen-growth-mode.js",
        "screen-watchlist.js", "screen-cloud.js", "screen-holdings.js", "screen-unified.js",
        "criteria-view.js", "books-view.js", "handbook-view.js", "screen-ui.js",
    ]:
        html = re.sub(rf'src="{name}', f'src="../{name}', html)

    # Remove inline script between etf-plan-view and screen-data
    html = re.sub(
        r'(<script src="\.\./etf-plan-view\.js"></script>)\s*<script>[\s\S]*?</script>\s*(<script src="\.\./screen-data)',
        r"\1\n" + SLIM + r"\n  \2",
        html,
        count=1,
    )

    # Remove duplicate site-admin-gate if any
    html = html.replace("../site-admin-gate.js\"></script>\n  <script src=\"../site-admin-gate.js\"", "../site-admin-gate.js")

    INVEST.write_text(html, encoding="utf-8")
    print("invest workbench patched")


if __name__ == "__main__":
    main()
