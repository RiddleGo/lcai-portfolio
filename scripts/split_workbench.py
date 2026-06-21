#!/usr/bin/env python3
"""拆分 资产总览.html → finance/index.html + invest/workbench.html"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "资产总览.html"
FINANCE_HTML = ROOT / "finance" / "index.html"
INVEST_HTML = ROOT / "invest" / "workbench.html"
REDIRECT_HTML = SOURCE


def extract_between(html: str, start_marker: str, end_marker: str) -> str:
    s = html.find(start_marker)
    if s < 0:
        return ""
    e = html.find(end_marker, s)
    if e < 0:
        return ""
    return html[s:e]


def rel_paths(content: str, prefix: str) -> str:
    """Adjust asset paths for subdirectory."""
    reps = [
        ('href="lcai-', f'href="{prefix}lcai-'),
        ('href="kb-', f'href="{prefix}kb-'),
        ('src="holdings', f'src="{prefix}holdings'),
        ('src="quotes', f'src="{prefix}quotes'),
        ('src="lcai-', f'src="{prefix}lcai-'),
        ('src="site-', f'src="{prefix}site-'),
        ('src="etf-', f'src="{prefix}etf-'),
        ('src="finance/', f'src="{prefix}finance/'),
        ('src="screen-', f'src="{prefix}screen-'),
        ('src="criteria-', f'src="{prefix}criteria-'),
        ('src="books-', f'src="{prefix}books-'),
        ('src="handbook-', f'src="{prefix}handbook-'),
        ('href="index.html"', f'href="{prefix}index.html"'),
        ('href="reports/', f'href="{prefix}reports/'),
        ('href="assets/', f'href="{prefix}assets/'),
        ('src="assets/', f'src="{prefix}assets/'),
    ]
    for old, new in reps:
        content = content.replace(old, new)
    return content


def build_finance_html(source: str) -> str:
    head_end = source.find("</head>")
    head = source[: head_end + 7]
    head = head.replace("<title>资产总览</title>", "<title>财务计划 · Russshare</title>")
    head = rel_paths(head, "../")

    style_end = source.find("</style>") + len("</style>")
    styles = source[source.find("<style>") : style_end]

    finance_pages = extract_between(source, "<!-- ========== 执行计划 ========== -->", "<!-- ========== 页7：选股研判 ========== -->")

    modals = extract_between(source, '<div id="finance-deposit-modal"', '<!-- ========== 执行计划 ========== -->')
    if modals:
        modals = modals[: modals.rfind("</div>") + 6]

    effect_toast = extract_between(source, '<div id="effect-toast"', "<!-- ========== 执行计划 ========== -->")
    if effect_toast:
        effect_toast = effect_toast[: effect_toast.find("</div>") + 6]

    shell = f"""{head}
<body>
  <div class="app-shell">
    <aside class="shell-sidebar" id="shell-sidebar">
      <a href="../index.html" class="shell-brand" style="text-decoration:none;color:inherit;">
        <img src="../assets/lcai-kb-logo.svg" class="shell-brand-logo" alt="">
        <div>
          <div class="shell-brand-title">Russshare</div>
          <div class="shell-brand-sub">财务计划</div>
        </div>
      </a>
      <nav class="shell-nav tabs" aria-label="财务导航">
        <button class="tab-btn active" data-page="stock">持仓</button>
        <button class="tab-btn" data-page="plan">执行</button>
        <button class="tab-btn" data-page="debt">债务</button>
        <button class="tab-btn" data-page="policy">规划</button>
      </nav>
      <div class="shell-sidebar-foot">
        <a href="../index.html" class="wb-home-link">← 返回人生中枢</a>
      </div>
    </aside>
    <div class="shell-overlay" id="shell-overlay" hidden></div>
    <div class="shell-main">
      <header class="shell-header">
        <button type="button" class="shell-menu-btn" id="shell-menu-btn" aria-label="打开菜单">☰</button>
        <h1 class="shell-page-title" id="shell-page-title">持仓</h1>
      </header>
      <div class="wrap shell-content">
        <div id="finance-setup-banner" class="finance-setup-banner" hidden>
          未检测到 <code>finance-config-data.js</code>。请复制
          <code>finance-config.example.json</code> → <code>finance-config.json</code>，运行
          <code>python scripts/build_finance_module.py</code> 生成本地配置。
        </div>
        <div id="page-stock" class="page active finance-page">
          <!-- stock extracted below -->
        </div>
{finance_pages}
      </div>
      <footer class="site-footer" id="site-footer">Russshare 财务计划</footer>
    </div>
  </div>
  {effect_toast}
  {modals}

  <script src="../holdings-data.js"></script>
  <script src="../quotes-data.js"></script>
  <script src="../site-admin-gate.js"></script>
  <script src="finance-config-data.js"></script>
  <script src="finance-core.js"></script>
  <script>
    const PAGE_TITLES = {{ stock: "持仓", plan: "执行", debt: "债务", policy: "规划" }};

    function closeShellDrawer() {{
      document.getElementById("shell-sidebar")?.classList.remove("open");
      const ov = document.getElementById("shell-overlay");
      if (ov) ov.hidden = true;
    }}

    function switchTab(page) {{
      closeShellDrawer();
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      const btn = document.querySelector(`.tab-btn[data-page="${{page}}"]`);
      if (btn) btn.classList.add("active");
      const el = document.getElementById("page-" + page);
      if (el) el.classList.add("active");
      const titleEl = document.getElementById("shell-page-title");
      if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;
      if (location.hash !== "#" + page) history.replaceState(null, "", "#" + page);
    }}
    window.switchTab = switchTab;

    document.querySelectorAll(".tab-btn[data-page]").forEach(btn => {{
      btn.addEventListener("click", () => switchTab(btn.dataset.page));
    }});
    document.getElementById("shell-menu-btn")?.addEventListener("click", () => {{
      document.getElementById("shell-sidebar")?.classList.add("open");
      document.getElementById("shell-overlay").hidden = false;
    }});
    document.getElementById("shell-overlay")?.addEventListener("click", closeShellDrawer);

    if (!window.FINANCE_CONFIG) {{
      document.getElementById("finance-setup-banner").hidden = false;
    }} else {{
      FinanceCore.init({{ switchTab }});
    }}

    const initial = (location.hash || "#stock").replace("#", "") || "stock";
    if (PAGE_TITLES[initial]) switchTab(initial);
  </script>
</body>
</html>
"""
    # Insert stock page content from source
    stock_page = extract_between(source, '<div id="page-stock" class="page">', "<!-- ========== 页7：选股研判 ========== -->")
    shell = shell.replace(
        '<div id="page-stock" class="page active finance-page">\n          <!-- stock extracted below -->\n        </div>',
        stock_page.replace('class="page"', 'class="page active finance-page"', 1),
    )
    # Remove duplicate stock from finance_pages - finance_pages starts with plan not stock
    return rel_paths(shell, "../")


def build_invest_html(source: str) -> str:
    html = source
    html = html.replace("<title>资产总览</title>", "<title>LCAI 投资工作台 · Russshare</title>")
    html = rel_paths(html, "../")

    html = html.replace("← 返回投资中枢", "← 返回人生中枢")
    html = html.replace('href="index.html"', 'href="../index.html"')
    html = html.replace(
        '<div class="shell-brand-title">LCAI</div>\n          <div class="shell-brand-sub">资产总览</div>',
        '<div class="shell-brand-title">LCAI</div>\n          <div class="shell-brand-sub">投资工作台</div>',
    )

    # Update nav - remove finance group, add link to finance module
    html = re.sub(
        r'<details class="nav-group" open data-nav-group="finance">[\s\S]*?</details>',
        '<a href="../finance/index.html" class="tab-btn" style="text-decoration:none;display:block;margin-top:8px;">💰 财务计划 →</a>',
        html,
    )

    # Remove finance pages
    for marker in [
        "<!-- ========== 执行计划 ========== -->",
        "<!-- ========== 债务总览 ========== -->",
        "<!-- ========== 规划 ========== -->",
    ]:
        pass

    html = re.sub(
        r"<!-- ========== 执行计划 ========== -->[\s\S]*?<!-- ========== 页7：选股研判 ========== -->",
        "<!-- ========== 页7：选股研判 ========== -->",
        html,
    )

    # Remove page-stock
    html = re.sub(
        r"<!-- ========== 页6：证券持仓 ========== -->[\s\S]*?<!-- ========== 页7：选股研判 ========== -->",
        "<!-- ========== 页7：选股研判 ========== -->",
        html,
    )

    # Replace inline finance script with finance-core for home summary
    html = re.sub(
        r'<script src="etf-plan-view\.js"></script>\s*<script>[\s\S]*?</script>\s*(?=<script src="screen-data)',
        '<script src="etf-plan-view.js"></script>\n  <script src="../finance/finance-config-data.js"></script>\n  <script src="../finance/finance-core.js"></script>\n  <script src="../site-admin-gate.js"></script>\n  <script>\n',
        html,
        count=1,
    )

    # Fix home page finance links to point to finance module
    html = html.replace('data-goto="plan"', 'onclick="location.href=\'../finance/index.html#plan\'" data-goto="plan"')
    html = html.replace('data-goto="stock"', 'onclick="location.href=\'../finance/index.html#stock\'" data-goto="stock"')
    html = html.replace('data-goto="debt"', 'onclick="location.href=\'../finance/index.html#debt\'" data-goto="debt"')

    # Add init that uses FinanceCore for home summary only
    init_patch = """
    // 首页财务摘要（FinanceCore）
    if (window.FinanceCore) {
      const _origRenderHome = renderHome;
      renderHome = function(state, todoState) {
        if (!window.FINANCE_CONFIG) {
          const secTotal = document.getElementById("home-sec-total");
          if (secTotal) secTotal.textContent = "—";
          document.getElementById("home-urgent-sub") && (document.getElementById("home-urgent-sub").textContent = "前往财务计划模块");
          return;
        }
        _origRenderHome(state, todoState);
      };
      FinanceCore.init({ switchTab: function() {} });
      window.__lcaiRenderAll = FinanceCore.renderAll;
    }
"""
    # Actually invest workbench shouldn't run full FinanceCore init - too complex.
    # Simpler: replace home finance cards with links only

    # Replace lcai-admin-gate with site-admin-gate
    html = html.replace('src="lcai-admin-gate.js"', 'src="../site-admin-gate.js"')

    # Remove duplicate site-admin-gate if added twice
    html = html.replace("../site-admin-gate.js\"></script>\n  <script src=\"../site-admin-gate.js\"", "../site-admin-gate.js")

    # Strip old inline script body - keep only workbench shell + screen init
    # The regex above only replaced opening - need to remove the huge inline block

    return html


def build_redirect() -> str:
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=invest/workbench.html">
  <script>location.replace("invest/workbench.html" + (location.hash || ""));</script>
  <title>跳转中…</title>
</head>
<body><p>正在跳转到 <a href="invest/workbench.html">LCAI 投资工作台</a>…</p></body>
</html>
"""


def main():
    source = SOURCE.read_text(encoding="utf-8")
    FINANCE_HTML.parent.mkdir(parents=True, exist_ok=True)
    INVEST_HTML.parent.mkdir(parents=True, exist_ok=True)

    FINANCE_HTML.write_text(build_finance_html(source), encoding="utf-8")

    # Invest: copy source and apply transforms via simpler approach - read and write manually
    invest = source
    invest = invest.replace("<title>资产总览</title>", "<title>LCAI 投资工作台 · Russshare</title>")
    for name in [
        "holdings-data.js", "quotes-data.js", "lcai-admin-gate.js", "etf-plan-data.js", "etf-plan-view.js",
        "screen-data.js", "screen-engine.js", "screen-ai-layers.js", "screen-growth-mode.js",
        "screen-watchlist.js", "screen-cloud.js", "screen-holdings.js", "screen-unified.js",
        "criteria-view.js", "books-view.js", "handbook-view.js", "screen-ui.js",
        "lcai-theme.css", "lcai-workbench-skin.css", "lcai-admin-gate.css", "books-index-data.js",
    ]:
        invest = invest.replace(f'"{name}"', f'"../{name}"')
    invest = invest.replace('href="index.html"', 'href="../index.html"')
    invest = invest.replace('href="reports/', 'href="../reports/')
    invest = invest.replace('src="assets/', 'src="../assets/')
    invest = invest.replace("← 返回投资中枢", "← 返回人生中枢")
    invest = invest.replace('shell-brand-sub">资产总览', 'shell-brand-sub">投资工作台')
    invest = re.sub(
        r'<details class="nav-group" open data-nav-group="finance">[\s\S]*?</details>',
        '<a href="../finance/index.html" class="tab-btn" style="text-decoration:none;display:block;">💰 财务计划 →</a>',
        invest,
    )
    invest = re.sub(
        r"<!-- ========== 执行计划 ========== -->[\s\S]*?<!-- ========== 页7：选股研判 ========== -->",
        "",
        invest,
    )
    invest = re.sub(
        r"<!-- ========== 页6：证券持仓 ========== -->[\s\S]*?<!-- ========== 页7：选股研判 ========== -->",
        "<!-- ========== 页7：选股研判 ========== -->",
        invest,
    )
    invest = invest.replace('src="../lcai-admin-gate.js"', 'src="../site-admin-gate.js"')

    # Replace inline finance script with slim home helper
    slim_script = """
    function renderHomeFinanceSummary() {
      if (!window.FinanceCore || !window.FINANCE_CONFIG) {
        ["home-sec-total","home-sec-pnl","home-holdings-count","home-urgent-amount"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = "—";
        });
        const sub = document.getElementById("home-urgent-sub");
        if (sub) sub.textContent = "前往财务计划查看";
        const netSub = document.getElementById("home-net-worth-sub");
        if (netSub) netSub.textContent = "finance/index.html";
        return;
      }
      const todoState = FinanceCore.loadTodoState();
      const state = FinanceCore.computeState(todoState);
      const active = state.holdings.filter(h => !h.sold);
      const fmtInt = n => Math.round(n).toLocaleString("zh-CN");
      const secTotal = document.getElementById("home-sec-total");
      const secPnl = document.getElementById("home-sec-pnl");
      const holdCount = document.getElementById("home-holdings-count");
      const netSub = document.getElementById("home-net-worth-sub");
      if (secTotal) secTotal.textContent = fmtInt(state.securitiesTotal);
      if (secPnl) {
        secPnl.textContent = (state.stockPnl >= 0 ? "+" : "") + fmtInt(state.stockPnl);
        secPnl.className = "val " + (state.stockPnl >= 0 ? "gain" : "loss");
      }
      if (holdCount) holdCount.textContent = String(active.length);
      if (netSub) netSub.textContent = `净资产 ${fmtInt(state.netWorth)} · 负债 ${fmtInt(state.liabilitiesTotal)}`;
      const summary = FinanceCore.getPortalSummary();
      const urgentAmt = document.getElementById("home-urgent-amount");
      const urgentSub = document.getElementById("home-urgent-sub");
      if (urgentAmt && summary.sub) urgentAmt.textContent = "→";
      if (urgentSub && summary.sub) urgentSub.textContent = summary.sub;
      const todoTotal = (window.FINANCE_CONFIG.todoGroups || []).reduce((a,g) => a + g.items.length, 0);
      let done = 0;
      try {
        const raw = localStorage.getItem(window.FINANCE_CONFIG.todoStorageKey);
        const st = raw ? JSON.parse(raw) : {};
        Object.values(st).forEach(v => { if (v && (v.done || v === true)) done++; });
      } catch (_) {}
      const homeDone = document.getElementById("home-todo-done");
      const homeTotal = document.getElementById("home-todo-total");
      const homeBar = document.getElementById("home-todo-bar");
      if (homeDone) homeDone.textContent = done;
      if (homeTotal) homeTotal.textContent = todoTotal;
      if (homeBar) homeBar.style.width = todoTotal ? (done / todoTotal * 100) + "%" : "0%";
    }
    document.querySelectorAll('[data-goto="plan"],[data-goto="stock"],[data-goto="debt"]').forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        location.href = "../finance/index.html#" + btn.dataset.goto;
      });
    });
    renderHomeFinanceSummary();
    window.LCAIAdminGate?.initOverview?.("finance");
    """
    invest = re.sub(
        r'<script src="../etf-plan-view\.js"></script>\s*<script>[\s\S]*?</script>\s*(?=<script src="../screen-data)',
        '<script src="../etf-plan-view.js"></script>\n  <script src="../finance/finance-config-data.js"></script>\n  <script src="../finance/finance-core.js"></script>\n  <script>' + slim_script + '\n  </script>\n  ',
        invest,
        count=1,
    )

    # Remove finance page refs from PAGE_TITLES and switchTab hash for finance pages
    invest = invest.replace(
        'home: "首页", plan: "执行", debt: "债务", policy: "规划", stock: "持仓", etf:',
        'home: "首页", etf:',
    )

    INVEST_HTML.write_text(invest, encoding="utf-8")
    REDIRECT_HTML.write_text(build_redirect(), encoding="utf-8")
    print("split workbench OK")


if __name__ == "__main__":
    main()
