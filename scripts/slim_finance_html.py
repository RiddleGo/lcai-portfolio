"""Rebuild finance/index.html pages section (2-tab slim layout)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "finance" / "index.html"
s = path.read_text(encoding="utf-8")

PAGES = """
<!-- ========== 执行 ========== -->
    <div id="page-plan" class="page active finance-page">
      <section class="todo-section" id="todo-section">
        <div class="todo-header">
          <h2>执行待办</h2>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="todo-progress">已完成 <strong id="todo-done">0</strong> / <strong id="todo-total">0</strong></span>
            <button type="button" class="todo-reset" id="todo-reset">重置</button>
          </div>
        </div>
        <div class="todo-progress-bar"><span id="todo-bar"></span></div>
        <div id="todo-container"></div>
      </section>
    </div>

    <!-- ========== 概况 ========== -->
    <div id="page-debt" class="page finance-page">
      <div class="quote-bar" id="quote-bar">
        <span class="quote-bar-meta">行情加载中…</span>
        <button type="button" class="edit-amount-btn" id="quote-reload">刷新</button>
      </div>

      <div class="summary-grid">
        <div class="card highlight">
          <div class="card-label">净资产</div>
          <div class="card-value" id="diag-networth">—</div>
          <div class="card-sub" id="diag-networth-sub">—</div>
        </div>
        <div class="card highlight">
          <div class="card-label">负债合计</div>
          <div class="card-value" id="debt-total">—</div>
        </div>
        <div class="card">
          <div class="card-label">证券总资产</div>
          <div class="card-value" id="sec-total">—</div>
          <div class="card-sub" id="sec-cash-sub">—</div>
        </div>
        <div class="card">
          <div class="card-label">持仓浮亏</div>
          <div class="card-value loss" id="sec-pnl">—</div>
        </div>
        <div class="card warn-card">
          <div class="card-label">负债/资产比</div>
          <div class="card-value" id="diag-debtratio">—</div>
          <div class="card-sub" id="diag-debtratio-sub">—</div>
        </div>
      </div>

      <div class="summary-grid" id="repay-summary">
        <div class="card" id="card-debt-jd">
          <div class="platform-row"><span class="dot jd"></span><span class="card-label">京东</span></div>
          <div class="card-value" id="debt-jd">—</div>
        </div>
        <div class="card" id="card-debt-ali">
          <div class="platform-row"><span class="dot ali"></span><span class="card-label">支付宝</span></div>
          <div class="card-value" id="debt-ali">—</div>
        </div>
        <div class="card" id="card-debt-dy">
          <div class="platform-row"><span class="dot dy"></span><span class="card-label">抖音</span></div>
          <div class="card-value" id="debt-dy">—</div>
        </div>
        <div class="card card-debt-cleared" id="card-debt-didi">
          <div class="platform-row"><span class="dot didi"></span><span class="card-label">滴滴</span></div>
          <div class="card-value" id="debt-didi">—</div>
        </div>
        <div class="card" id="card-debt-personal">
          <div class="platform-row"><span class="dot personal"></span><span class="card-label">个人</span></div>
          <div class="card-value" id="debt-personal">—</div>
        </div>
      </div>

      <details class="finance-fold">
        <summary>每月需准备</summary>
        <div class="card" style="padding:0;overflow-x:auto;">
          <table id="monthly-table">
            <thead>
              <tr>
                <th>月份</th><th>京东</th><th class="col-cleared">滴滴</th><th class="col-cleared">抖音</th><th>支付宝</th><th>个人</th><th>合计</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </details>

      <details class="finance-fold">
        <summary>持仓</summary>
        <div class="card" style="padding:0;overflow-x:auto;">
          <table>
            <thead>
              <tr><th>股票</th><th>账户</th><th>股数</th><th>市值</th><th>盈亏</th><th>占比</th></tr>
            </thead>
            <tbody id="holdings-tbody"></tbody>
          </table>
        </div>
      </details>

      <details class="finance-fold">
        <summary>债务明细</summary>
        <div class="card" style="padding:0;overflow:hidden;">
          <table>
            <thead><tr><th>项目</th><th>笔数</th><th>待还</th><th>还款日</th></tr></thead>
            <tbody id="debt-detail-tbody"></tbody>
          </table>
        </div>
      </details>

      <div hidden aria-hidden="true">
        <span id="acct-gt"></span><span id="acct-gt-sub"></span>
        <span id="acct-hb"></span><span id="acct-hb-sub"></span>
        <span id="sec-cost"></span>
        <span id="net-worth"></span><span id="net-worth-sub"></span>
        <span id="diag-floatloss"></span><span id="diag-floatloss-sub"></span>
        <span id="fund-total"></span><span id="fund-sub"></span>
        <tbody id="funds-tbody"></tbody>
        <span id="extra-cash-total"></span><span id="extra-cash-sub"></span>
        <span id="local-holdings-count"></span><span id="local-holdings-sub"></span>
        <div id="adjust-deposits-list"></div>
        <div id="adjust-holdings-list"></div>
        <p id="page-desc-plan"></p><p id="page-desc-debt"></p><p id="page-desc-policy"></p>
        <div id="new-holding-panel">
          <input id="local-holding-name"><input id="local-holding-code">
          <select id="local-holding-market"></select>
          <input id="local-holding-shares"><input id="local-holding-cost">
          <select id="local-holding-account"></select>
          <input id="local-holding-fallback">
        </div>
      </div>
    </div>
"""

s = re.sub(
    r"<!-- ========== 执行计划 ========== -->.*?</div>\s*\n\s*<footer",
    PAGES.strip() + "\n\n      </div>\n      <footer",
    s,
    count=1,
    flags=re.DOTALL,
)

s = s.replace(
    'const PAGE_TITLES = { stock: "持仓", plan: "执行", debt: "债务", policy: "规划" };',
    'const PAGE_TITLES = { plan: "执行", debt: "概况" };',
)
s = s.replace(
    'const initial = (location.hash || "#stock").replace("#", "") || "stock";',
    'const initial = (location.hash || "#plan").replace("#", "") || "plan";',
)
s = s.replace("Russshare 财务计划", "Russshare 财务")

path.write_text(s, encoding="utf-8")
print("rebuilt", path)
