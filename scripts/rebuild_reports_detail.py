#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为已有 reports 补全 analysis / unified 详细字段并重建 index.html。"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_lcai_detail import build_divergence_notes, build_lcai_detail, is_data_valid  # noqa: E402
from build_report_html import write_report_html  # noqa: E402
from build_unified_report import build_unified_report, write_unified_report  # noqa: E402


def watchlist_symbols() -> list[str]:
    wl = ROOT / "watchlist-data.js"
    if wl.exists():
        return re.findall(r'"(\d{5,6})"', wl.read_text(encoding="utf-8"))
    return []


def portfolio_symbols() -> set[str]:
    path = ROOT / "quotes-data.js"
    if not path.exists():
        return set()
    codes = set()
    for secid in re.findall(r'"(\d+\.\d+)"\s*:', path.read_text(encoding="utf-8")):
        code = secid.split(".", 1)[1]
        if len(code) == 5:
            codes.add(code.zfill(5))
        elif len(code) == 6:
            codes.add(code)
    return codes


def refresh_lcai(symbol: str) -> dict | None:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "lcai_screen_json.py"), symbol],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        return None
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None


def rebuild_symbol(symbol: str, *, refresh: bool = True) -> None:
    out_dir = ROOT / "reports" / symbol
    lcai_path = out_dir / "lcai.json"
    if not lcai_path.exists():
        print(f"SKIP {symbol}: no lcai.json")
        return

    if refresh:
        fresh = refresh_lcai(symbol)
        if fresh and not fresh.get("error"):
            lcai = fresh
        else:
            lcai = json.loads(lcai_path.read_text(encoding="utf-8"))
            if lcai.get("error") or not is_data_valid(lcai)[0]:
                lcai = {k: v for k, v in lcai.items() if k != "analysis"}
                lcai["verdict"] = "数据不足"
                lcai["verdict_action"] = "缓存损坏或财务未拉取，请 Run workflow 刷新"
                lcai["rating"] = "—"
                lcai["overall_score"] = None
    else:
        lcai = json.loads(lcai_path.read_text(encoding="utf-8"))

    in_portfolio = symbol in portfolio_symbols()
    meta_path = out_dir / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    meta["in_portfolio"] = in_portfolio
    meta.setdefault("symbol", symbol)
    meta.setdefault("name", lcai.get("name"))

    lcai["analysis"] = build_lcai_detail(lcai, in_portfolio=in_portfolio)
    lcai_path.write_text(json.dumps(lcai, ensure_ascii=False, indent=2), encoding="utf-8")

    if is_data_valid(lcai)[0]:
        meta["divergences"] = build_divergence_notes(lcai)
    else:
        meta["divergences"] = [{
            "kind": "warning",
            "title": "数据不足",
            "summary": is_data_valid(lcai)[1],
        }]
    meta["divergence_notes"] = meta["divergences"]
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    unified = build_unified_report(lcai, meta, symbol)
    write_unified_report(symbol, unified, out_dir)
    write_report_html(out_dir, symbol, lcai, unified, meta)
    status = "OK" if lcai["analysis"].get("data_ok") else "WARN(data)"
    print(f"{status} {symbol}")


def main() -> None:
    refresh = "--no-refresh" not in sys.argv
    syms = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not syms:
        syms = watchlist_symbols()
    if not syms:
        print("No symbols", file=sys.stderr)
        sys.exit(1)
    for s in syms:
        rebuild_symbol(s, refresh=refresh)


if __name__ == "__main__":
    main()
