#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为持仓/指定代码生成 reports/{symbol}/lcai.json、unified.json、index.html。"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BJ = timezone(timedelta(hours=8))
ENGINE = ROOT / "投资系统" / "engine"
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ENGINE))


def normalize_symbol(raw: str) -> str:
    s = re.sub(r"[^0-9A-Za-z]", "", raw.upper())
    if len(s) == 5:
        return s.zfill(5)
    if len(s) == 6:
        return s
    return s


def parse_holdings_from_quotes() -> list[str]:
    path = ROOT / "quotes-data.js"
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8")
    codes = set()
    for secid in re.findall(r'"(\d+\.\d+)"\s*:', text):
        code = secid.split(".", 1)[1]
        codes.add(normalize_symbol(code))
    return sorted(codes)


def parse_all_auto_symbols() -> list[str]:
    from watchlist_utils import merge_all_symbols  # noqa: WPS433

    return merge_all_symbols(parse_holdings_from_quotes)


def build_context(lcai: dict, symbol: str, *, in_portfolio: bool = False) -> dict:
    from build_lcai_detail import build_divergence_notes  # noqa: WPS433

    lcai_mos = lcai.get("margin_of_safety_pct")
    dcf_fv = lcai.get("dcf_fair_value")
    margin_gap = None
    if lcai_mos is not None and dcf_fv:
        dcf_mos = lcai.get("dcf_margin_of_safety_pct")
        margin_gap = f"LCAI PE×EPS {lcai_mos}% vs DCF {dcf_mos}%"
    divergences = build_divergence_notes(lcai)
    return {
        "symbol": symbol,
        "name": lcai.get("name"),
        "in_portfolio": in_portfolio,
        "lcai_verdict": lcai.get("verdict"),
        "lcai_verdict_action": lcai.get("verdict_action"),
        "lcai_rating": lcai.get("rating"),
        "lcai_score": lcai.get("overall_score"),
        "lcai_margin_pct": lcai_mos,
        "lcai_fair_value": lcai.get("fair_value"),
        "dcf_fair_value": dcf_fv,
        "dcf_margin_pct": lcai.get("dcf_margin_of_safety_pct"),
        "margin_gap": margin_gap,
        "divergences": divergences,
        "divergence_notes": divergences,
        "trap_flags": lcai.get("trap_flags", []),
        "report_url": f"reports/{symbol}/index.html",
        "generated_at": datetime.now(BJ).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "disclaimer": "买卖结论以 LCAI 投资宪法为准",
    }


def run_lcai(symbol: str, *, in_portfolio: bool = False) -> dict:
    from build_lcai_detail import build_lcai_detail, is_data_valid  # noqa: WPS433
    from screen_engine import screen, to_lcai_report  # noqa: WPS433

    try:
        result = screen(symbol, in_portfolio=in_portfolio)
        lcai = to_lcai_report(result)
        lcai["in_portfolio"] = in_portfolio
        if is_data_valid(lcai)[0]:
            lcai["analysis"] = build_lcai_detail(lcai, in_portfolio=in_portfolio)
        else:
            lcai["verdict"] = "数据不足"
            lcai["verdict_action"] = is_data_valid(lcai)[1]
            lcai["analysis"] = build_lcai_detail(lcai, in_portfolio=in_portfolio)
        return lcai
    except Exception as exc:
        return {
            "source": "lcai",
            "symbol": symbol,
            "error": str(exc),
            "verdict": "数据不足",
            "verdict_action": str(exc),
            "rating": "—",
            "overall_score": None,
        }


def write_report(symbol: str, lcai: dict, ctx: dict) -> Path:
    from build_report_html import write_report_html  # noqa: WPS433
    from build_unified_report import build_unified_report, write_unified_report  # noqa: WPS433

    out_dir = ROOT / "reports" / symbol
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "lcai.json").write_text(json.dumps(lcai, ensure_ascii=False, indent=2), encoding="utf-8")
    unified = build_unified_report(lcai, ctx, symbol)
    write_unified_report(symbol, unified, out_dir)
    write_report_html(out_dir, symbol, lcai, unified)
    meta_legacy = out_dir / "meta.json"
    if meta_legacy.exists():
        meta_legacy.unlink()
    return out_dir


def process_symbol(symbol: str, *, in_portfolio: bool = False) -> dict:
    sym = normalize_symbol(symbol)
    lcai = run_lcai(sym, in_portfolio=in_portfolio)
    ctx = build_context(lcai, sym, in_portfolio=in_portfolio)
    write_report(sym, lcai, ctx)
    return ctx


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate LCAI reports for holdings/watchlist")
    ap.add_argument("--symbol", help="Single symbol")
    ap.add_argument("--holdings", action="store_true", help="All symbols from quotes-data.js")
    ap.add_argument("--all", action="store_true", help="Holdings + watchlist-data.js (weekly auto)")
    ap.add_argument("--rebuild", action="store_true", help="Alias for default refresh (compat)")
    ap.add_argument("--no-refresh", action="store_true", help="Rebuild unified/html from existing lcai.json only")
    args = ap.parse_args()

    symbols = [args.symbol] if args.symbol else []
    if args.all:
        symbols = parse_all_auto_symbols()
    elif args.holdings or not symbols:
        symbols = parse_holdings_from_quotes()
    if not symbols:
        print("No symbols", file=sys.stderr)
        sys.exit(1)

    portfolio = set(parse_holdings_from_quotes())
    results = []
    for s in symbols:
        print(f"Processing {s}...", file=sys.stderr)
        sym = normalize_symbol(s)
        in_pf = sym in portfolio
        if args.no_refresh:
            lcai_path = ROOT / "reports" / sym / "lcai.json"
            if not lcai_path.exists():
                print(f"SKIP {sym}: no lcai.json", file=sys.stderr)
                continue
            lcai = json.loads(lcai_path.read_text(encoding="utf-8"))
            from build_lcai_detail import build_lcai_detail  # noqa: WPS433

            lcai["analysis"] = build_lcai_detail(lcai, in_portfolio=in_pf)
            ctx = build_context(lcai, sym, in_portfolio=in_pf)
            write_report(sym, lcai, ctx)
            results.append(ctx)
        else:
            results.append(process_symbol(s, in_portfolio=in_pf))

    out = json.dumps(results, ensure_ascii=False, indent=2)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(out)


if __name__ == "__main__":
    main()
