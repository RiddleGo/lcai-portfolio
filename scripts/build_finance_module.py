#!/usr/bin/env python3
"""从 资产总览.html 抽取财务配置与 finance-core.js（纯 Python）"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "资产总览.html"
FINANCE_DIR = ROOT / "finance"


def extract_script(html: str) -> str:
    m = re.search(
        r'<script src="etf-plan-view\.js"></script>\s*<script>([\s\S]*?)</script>\s*\n\s*<script src="screen-data',
        html,
    )
    if not m:
        m = re.search(
            r'<script src="etf-plan-view\.js"></script>\s*<script>([\s\S]*?)</script>',
            html,
        )
    if not m:
        raise SystemExit("inline finance script not found")
    return m.group(1)


def extract_const_block(script: str, name: str) -> str:
    marker = f"const {name} = "
    start = script.find(marker)
    if start < 0:
        raise ValueError(f"{name} not found")
    i = start + len(marker)
    if script[i] == "{":
        open_c, close_c = "{", "}"
    elif script[i] == "[":
        open_c, close_c = "[", "]"
    else:
        end = script.find(";", i)
        return script[i:end].strip()
    depth = 0
    j = i
    while j < len(script):
        c = script[j]
        if c == open_c:
            depth += 1
        elif c == close_c:
            depth -= 1
            if depth == 0:
                return script[i : j + 1]
        j += 1
    raise ValueError(f"unclosed block for {name}")


def js_scalar(val: str):
    val = val.strip().rstrip(";")
    if val.startswith('"') and val.endswith('"'):
        return val[1:-1]
    if val.startswith("'") and val.endswith("'"):
        return val[1:-1]
    if val == "true":
        return True
    if val == "false":
        return False
    if val == "null":
        return None
    if "." in val:
        return float(val)
    return int(val)


def extract_simple_consts(script: str) -> dict:
    names = [
        "TODO_STORAGE_KEY",
        "OVERRIDES_KEY",
        "JD_PREPAY_AMOUNT",
        "JD_DEBT_TOTAL",
        "DY_DEBT_TOTAL",
        "DY_CLEAR_AMOUNT",
        "HB_CASH_BEFORE_DY_CLEAR",
        "DY_RATE_ANNUAL",
        "DY_LOAN_DATE",
        "DY_MONTHLY",
        "JUL_JD_PAY",
        "FUND_TOTAL",
        "WEIMOB_JUL_EST",
        "TENCENT_AUG_EST",
        "PINGAN_AUG_SELL",
        "PINGAN_AUG_EST",
        "MONTHLY_SAVINGS",
        "JD_HEALTH_SHARES",
    ]
    out = {}
    for name in names:
        m = re.search(rf"const {name} = ([^;\n]+);", script)
        if m:
            out[name] = js_scalar(m.group(1))
    return out


def js_to_json(js: str) -> str:
    """Best-effort JS object/array → JSON."""
    s = js
    s = re.sub(r"//[^\n]*", "", s)
    s = re.sub(r"/\*[\s\S]*?\*/", "", s)
    s = re.sub(
        r"\(window\.LCAI_HOLDINGS && window\.LCAI_HOLDINGS\.holdings\) \|\| \[\]",
        "[]",
        s,
    )
    s = re.sub(r'"text"\s*:\s*"([^"\\]|\\.|(?:<[^>]*>))*"', lambda m: m.group(0), s)
    s = re.sub(r':\s*"([^"]*)<([^"]*)"', lambda m: ': "' + m.group(1) + "<" + m.group(2).replace('"', '\\"') + '"', s)
    s = re.sub(r"(\w+)\s*:", r'"\1":', s)
    s = s.replace("'", '"')
    s = re.sub(r",(\s*[}\]])", r"\1", s)
    s = re.sub(r"\bundefined\b", "null", s)
    return s


def parse_js_object(js: str):
    return json.loads(js_to_json(js))


def substitute_consts(js: str, consts: dict) -> str:
    js = re.sub(
        r"HB_CASH_BEFORE_DY_CLEAR - DY_CLEAR_AMOUNT",
        str(consts["HB_CASH_BEFORE_DY_CLEAR"] - consts["DY_CLEAR_AMOUNT"]),
        js,
    )
    for name, val in sorted(consts.items(), key=lambda x: -len(x[0])):
        if isinstance(val, str):
            js = js.replace(name, json.dumps(val))
        else:
            js = js.replace(name, str(val))
    return js


def build_config(script: str) -> dict:
    consts = extract_simple_consts(script)
    baseline = parse_js_object(substitute_consts(extract_const_block(script, "BASELINE"), consts))
    baseline.pop("holdings", None)
    return {
        "version": 1,
        "todoStorageKey": consts["TODO_STORAGE_KEY"],
        "overridesKey": consts["OVERRIDES_KEY"],
        "constants": {
            "jdPrepayAmount": consts["JD_PREPAY_AMOUNT"],
            "jdDebtTotal": consts["JD_DEBT_TOTAL"],
            "dyDebtTotal": consts["DY_DEBT_TOTAL"],
            "dyClearAmount": consts["DY_CLEAR_AMOUNT"],
            "hbCashBeforeDyClear": consts["HB_CASH_BEFORE_DY_CLEAR"],
            "dyRateAnnual": consts["DY_RATE_ANNUAL"],
            "dyLoanDate": consts["DY_LOAN_DATE"],
            "dyMonthly": consts["DY_MONTHLY"],
            "julJdPay": consts["JUL_JD_PAY"],
            "fundTotal": consts["FUND_TOTAL"],
            "weimobJulEst": consts["WEIMOB_JUL_EST"],
            "tencentAugEst": consts["TENCENT_AUG_EST"],
            "pinganAugSell": consts["PINGAN_AUG_SELL"],
            "pinganAugEst": consts["PINGAN_AUG_EST"],
            "monthlySavings": consts["MONTHLY_SAVINGS"],
            "jdHealthShares": consts["JD_HEALTH_SHARES"],
        },
        "baselineTodoDone": parse_js_object(
            substitute_consts(extract_const_block(script, "BASELINE_TODO_DONE"), consts)
        ),
        "baseline": baseline,
        "todoGroups": parse_js_object(
            substitute_consts(extract_const_block(script, "TODO_GROUPS"), consts)
        ),
        "monthTodoMap": parse_js_object(extract_const_block(script, "MONTH_TODO_MAP")),
        "months": parse_js_object(
            substitute_consts(extract_const_block(script, "months"), consts)
        ),
    }


def build_core_js(script: str) -> str:
    header = """/**
 * 财务计划核心 — 还债/执行/持仓/规划
 * 配置：finance-config-data.js → window.FINANCE_CONFIG
 */
(function (global) {
  "use strict";

  function cfg() { return global.FINANCE_CONFIG || {}; }
  function C(k) { return (cfg().constants || {})[k]; }

"""
    body = script
    replacements = [
        (r'const TODO_STORAGE_KEY = "[^"]+";', 'const TODO_STORAGE_KEY = cfg().todoStorageKey || "lcai-exec-todos-v9";'),
        (r'const TODO_STORAGE_KEY_V\d = "[^"]+";\n', ""),
        (r'const OVERRIDES_KEY = "[^"]+";', 'const OVERRIDES_KEY = cfg().overridesKey || "lcai-portfolio-overrides";'),
        (r"const JD_PREPAY_AMOUNT = [\d.]+;", 'const JD_PREPAY_AMOUNT = C("jdPrepayAmount");'),
        (r"const JD_DEBT_TOTAL = [\d.]+;", 'const JD_DEBT_TOTAL = C("jdDebtTotal");'),
        (r"const DY_DEBT_TOTAL = [\d.]+;", 'const DY_DEBT_TOTAL = C("dyDebtTotal");'),
        (r"const DY_CLEAR_AMOUNT = [\d.]+;", 'const DY_CLEAR_AMOUNT = C("dyClearAmount");'),
        (r"const HB_CASH_BEFORE_DY_CLEAR = [\d.]+;", 'const HB_CASH_BEFORE_DY_CLEAR = C("hbCashBeforeDyClear");'),
        (r"const DY_RATE_ANNUAL = [\d.]+;", 'const DY_RATE_ANNUAL = C("dyRateAnnual");'),
        (r'const DY_LOAN_DATE = "[^"]+";', 'const DY_LOAN_DATE = C("dyLoanDate");'),
        (r"const DY_MONTHLY = [\d.]+;", 'const DY_MONTHLY = C("dyMonthly");'),
        (r"const JUL_JD_PAY = [\d.]+;", 'const JUL_JD_PAY = C("julJdPay");'),
        (r"const FUND_TOTAL = [\d.]+;", 'const FUND_TOTAL = C("fundTotal");'),
        (r"const WEIMOB_JUL_EST = [\d.]+;", 'const WEIMOB_JUL_EST = C("weimobJulEst");'),
        (r"const TENCENT_AUG_EST = [\d.]+;", 'const TENCENT_AUG_EST = C("tencentAugEst");'),
        (r"const PINGAN_AUG_SELL = [\d.]+;", 'const PINGAN_AUG_SELL = C("pinganAugSell");'),
        (r"const PINGAN_AUG_EST = [\d.]+;", 'const PINGAN_AUG_EST = C("pinganAugEst");'),
        (r"const MONTHLY_SAVINGS = [\d.]+;", 'const MONTHLY_SAVINGS = C("monthlySavings");'),
        (r"const JD_HEALTH_SHARES = [\d.]+;", 'const JD_HEALTH_SHARES = C("jdHealthShares");'),
        (
            r"const BASELINE_TODO_DONE = \{[\s\S]*?\n    \};",
            "const BASELINE_TODO_DONE = cfg().baselineTodoDone || {};",
        ),
        (
            r"const BASELINE = \{[\s\S]*?\n    \};",
            """const BASELINE = (function () {
      const b = cfg().baseline || {};
      return {
        debts: b.debts || {},
        debtCounts: b.debtCounts || {},
        holdings: (global.LCAI_HOLDINGS && global.LCAI_HOLDINGS.holdings) || [],
        funds: b.funds || [],
        accountCash: b.accountCash || { gt: 0, hb: 0 },
        accountCashReserve: b.accountCashReserve || {},
      };
    })();""",
        ),
        (r"const TODO_GROUPS = \[[\s\S]*?\n    \];", "const TODO_GROUPS = cfg().todoGroups || [];"),
        (r"const MONTH_TODO_MAP = \{[\s\S]*?\n    \};", "const MONTH_TODO_MAP = cfg().monthTodoMap || {};"),
        (r"const months = \[[\s\S]*?\n    \];", "const months = cfg().months || [];"),
    ]
    for pat, repl in replacements:
        body = re.sub(pat, repl, body, count=1)

    body = re.sub(
        r"\n    renderTodos\(\);\n    window\.__lcaiRenderAll = renderAll;\n    renderAll\(\);\n    window\.LCAIAdminGate\?\.initOverview\?\.\(\);[\s\S]*$",
        "",
        body,
    )

    footer = """
  function getPortalSummary() {
    try {
      const todoState = loadTodoState();
      const state = computeState(todoState);
      const next = getNextUrgentTodo(todoState);
      let sub = "净资产 " + fmtInt(state.netWorth) + " · 负债 " + fmtInt(state.liabilitiesTotal);
      if (next && next.item) sub = next.item.text.replace(/<[^>]+>/g, "").slice(0, 48);
      return { title: "财务计划", sub: sub, href: "finance/index.html", lock: true };
    } catch (e) {
      return { title: "财务计划", sub: "请配置 finance-config", href: "finance/index.html", lock: true };
    }
  }

  function initFinanceWorkbench(opts) {
    opts = opts || {};
    if (typeof opts.switchTab === "function") {
      global.switchTab = opts.switchTab;
      FinanceCore.switchTab = opts.switchTab;
    }
    renderTodos();
    global.__lcaiRenderAll = renderAll;
    renderAll();
    global.LCAIAdminGate?.initOverview?.("finance");
  }

  global.FinanceCore = {
    init: initFinanceWorkbench,
    renderAll: renderAll,
    computeState: computeState,
    loadTodoState: loadTodoState,
    getPortalSummary: getPortalSummary,
    switchTab: null,
  };
})(window);
"""
    return header + body + footer


def main():
    FINANCE_DIR.mkdir(parents=True, exist_ok=True)
    html = SOURCE.read_text(encoding="utf-8")
    script = extract_script(html)
    config = build_config(script)

    (FINANCE_DIR / "finance-config.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (FINANCE_DIR / "finance-config-data.js").write_text(
        "window.FINANCE_CONFIG = " + json.dumps(config, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )

    example = json.loads(json.dumps(config))
    example["baseline"]["debts"] = {k: 0 for k in example["baseline"]["debts"]}
    example["baseline"]["funds"] = []
    example["todoGroups"] = []
    example["baselineTodoDone"] = {}
    (FINANCE_DIR / "finance-config.example.json").write_text(
        json.dumps(example, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    (FINANCE_DIR / "finance-core.js").write_text(build_core_js(script), encoding="utf-8")
    print("finance module built OK")


if __name__ == "__main__":
    main()
