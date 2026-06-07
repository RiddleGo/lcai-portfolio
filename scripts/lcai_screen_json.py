#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""输出 LCAI 完整研判 JSON（供 CLI / CI）。"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "投资系统" / "engine"
sys.path.insert(0, str(ENGINE))
sys.path.insert(0, str(ROOT / "scripts"))


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


def main() -> None:
    ap = argparse.ArgumentParser(description="LCAI screen JSON")
    ap.add_argument("symbol", help="Stock code")
    ap.add_argument("--in-portfolio", action="store_true", help="Treat as held position")
    ap.add_argument("--no-portfolio-detect", action="store_true", help="Skip quotes-data.js detection")
    args = ap.parse_args()

    sym = args.symbol.strip()
    in_portfolio = args.in_portfolio
    if not args.no_portfolio_detect and not in_portfolio:
        norm = sym.zfill(5) if len(re.sub(r"\D", "", sym)) == 5 else sym[-6:].zfill(6)
        in_portfolio = norm in portfolio_symbols()

    from screen_engine import screen, to_lcai_report  # noqa: WPS433
    from build_lcai_detail import build_lcai_detail  # noqa: WPS433

    try:
        result = screen(sym, in_portfolio=in_portfolio)
        report = to_lcai_report(result)
        report["in_portfolio"] = in_portfolio
        report["analysis"] = build_lcai_detail(report, in_portfolio=in_portfolio)
    except Exception as exc:
        report = {
            "source": "lcai",
            "symbol": sym,
            "error": str(exc),
            "verdict": "数据不足",
            "verdict_action": "财务或行情拉取失败，请 Run workflow 刷新",
            "rating": "—",
            "overall_score": None,
        }

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
