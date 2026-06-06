#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为持仓/指定代码生成 reports/{symbol}/lcai-vs-uzi.json 与 meta.json。
CI 或 run_dual_analysis 后调用。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BJ = timezone(timedelta(hours=8))


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
    sys.path.insert(0, str(ROOT / "scripts"))
    from watchlist_utils import merge_all_symbols  # noqa: WPS433

    return merge_all_symbols(parse_holdings_from_quotes)


def run_lcai(symbol: str) -> dict:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "lcai_screen_json.py"), symbol],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        return {"source": "lcai", "symbol": symbol, "error": proc.stderr or proc.stdout}
    return json.loads(proc.stdout)


def find_uzi_synthesis(uzi_path: Path, symbol: str) -> dict | None:
    scripts = uzi_path / "skills" / "deep-analysis" / "scripts"
    cache = scripts / ".cache"
    if not cache.exists():
        return None
    sym = symbol.lower()
    candidates = list(cache.glob(f"*{sym}*/synthesis.json"))
    candidates += list(cache.glob(f"*/synthesis.json"))
    for p in sorted(candidates, key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if sym in p.parent.name.lower() or data.get("ticker", "").endswith(sym):
                return data
        except (json.JSONDecodeError, OSError):
            continue
    panel_dirs = sorted(cache.glob("*"), key=lambda x: x.stat().st_mtime if x.is_dir() else 0, reverse=True)
    for d in panel_dirs[:5]:
        panel = d / "panel.json"
        if not panel.exists():
            continue
        try:
            panel_data = json.loads(panel.read_text(encoding="utf-8"))
            consensus = panel_data.get("consensus") or panel_data.get("summary") or {}
            return {
                "ticker": d.name,
                "overall_score": consensus.get("overall") or consensus.get("score"),
                "tone": consensus.get("tone") or consensus.get("verdict"),
                "consensus_formula": panel_data.get("consensus_formula"),
            }
        except (json.JSONDecodeError, OSError):
            continue
    return None


def find_uzi_html(uzi_path: Path, symbol: str) -> Path | None:
    reports = uzi_path / "skills" / "deep-analysis" / "scripts" / "reports"
    if not reports.exists():
        return None
    htmls = sorted(reports.rglob("*.html"), key=lambda p: p.stat().st_mtime, reverse=True)
    sym = symbol.lower()
    for h in htmls:
        if sym in h.name.lower() or sym in str(h.parent).lower():
            return h
    return htmls[0] if htmls else None


def build_compare(lcai: dict, uzi: dict | None, symbol: str) -> dict:
    lcai_mos = lcai.get("margin_of_safety_pct")
    dcf_fv = lcai.get("dcf_fair_value")
    uzi_tone = None
    uzi_score = None
    if uzi:
        uzi_tone = uzi.get("tone") or uzi.get("verdict") or uzi.get("core_conclusion")
        uzi_score = uzi.get("overall_score") or uzi.get("fund_score")
    margin_gap = None
    if lcai_mos is not None and dcf_fv:
        dcf_mos = lcai.get("dcf_margin_of_safety_pct")
        margin_gap = f"LCAI PE×EPS {lcai_mos}% vs DCF {dcf_mos}%"
    divergences = []
    if lcai.get("verdict") == "观察" and uzi_tone and "蹲" in str(uzi_tone):
        divergences.append("LCAI 观察 vs UZI 可蹲：生意尚可但价格/边际未达 LCAI 建仓线")
    if lcai.get("vetoes_triggered"):
        divergences.append(f"LCAI 否决：{'、'.join(lcai['vetoes_triggered'])}")
    return {
        "symbol": symbol,
        "name": lcai.get("name"),
        "lcai_verdict": lcai.get("verdict"),
        "lcai_verdict_action": lcai.get("verdict_action"),
        "lcai_rating": lcai.get("rating"),
        "lcai_score": lcai.get("overall_score"),
        "lcai_margin_pct": lcai_mos,
        "lcai_fair_value": lcai.get("fair_value"),
        "uzi_tone": uzi_tone,
        "uzi_value_consensus": uzi_score,
        "dcf_fair_value": dcf_fv,
        "dcf_margin_pct": lcai.get("dcf_margin_of_safety_pct"),
        "margin_gap": margin_gap,
        "divergences": divergences,
        "trap_flags": lcai.get("trap_flags", []),
        "report_url": f"reports/{symbol}/index.html",
        "generated_at": datetime.now(BJ).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "disclaimer": "LCAI 宪法为最终裁决；UZI 为价值派研究参考",
    }


def write_report(symbol: str, lcai: dict, compare: dict, html_src: Path | None) -> Path:
    out_dir = ROOT / "reports" / symbol
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "lcai.json").write_text(json.dumps(lcai, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "lcai-vs-uzi.json").write_text(json.dumps(compare, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "meta.json").write_text(json.dumps(compare, ensure_ascii=False, indent=2), encoding="utf-8")
    if html_src and html_src.exists():
        (out_dir / "index.html").write_bytes(html_src.read_bytes())
    elif not (out_dir / "index.html").exists():
        stub = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>{symbol} 研报</title></head>
<body><h1>{compare.get('name', symbol)}</h1>
<p>LCAI 判定：{compare.get('lcai_verdict')} — {compare.get('lcai_verdict_action')}</p>
<p>UZI 参考：{compare.get('uzi_tone') or '未生成'}</p>
<p>完整 UZI HTML 请本地运行 <code>bash scripts/run_dual_analysis.sh {symbol}</code></p></body></html>"""
        (out_dir / "index.html").write_text(stub, encoding="utf-8")
    return out_dir


def process_symbol(symbol: str, uzi_path: Path | None, run_uzi: bool) -> dict:
    sym = normalize_symbol(symbol)
    lcai = run_lcai(sym)
    uzi_data = None
    html_src = None
    if uzi_path and uzi_path.exists() and run_uzi:
        try:
            subprocess.run(
                [sys.executable, str(uzi_path / "run.py"), sym, "--depth", "lite", "--no-browser", "--school", "A,E"],
                cwd=str(uzi_path),
                timeout=600,
                check=False,
            )
        except (subprocess.TimeoutExpired, OSError) as e:
            lcai["uzi_error"] = str(e)
        uzi_data = find_uzi_synthesis(uzi_path, sym)
        html_src = find_uzi_html(uzi_path, sym)
    elif uzi_path and uzi_path.exists():
        uzi_data = find_uzi_synthesis(uzi_path, sym)
        html_src = find_uzi_html(uzi_path, sym)
    compare = build_compare(lcai, uzi_data, sym)
    write_report(sym, lcai, compare, html_src)
    return compare


def main():
    ap = argparse.ArgumentParser(description="Generate LCAI vs UZI report bundles")
    ap.add_argument("--symbol", help="Single symbol")
    ap.add_argument("--holdings", action="store_true", help="All symbols from quotes-data.js")
    ap.add_argument("--all", action="store_true", help="Holdings + watchlist-data.js (weekly auto)")
    ap.add_argument("--uzi-path", default=str(ROOT / ".vendor" / "UZI-Skill"))
    ap.add_argument("--run-uzi", action="store_true", help="Execute UZI run.py (slow)")
    ap.add_argument("--skip-uzi", action="store_true", help="LCAI only")
    args = ap.parse_args()
    uzi_path = Path(args.uzi_path) if not args.skip_uzi else None
    symbols = [args.symbol] if args.symbol else []
    if args.all:
        symbols = parse_all_auto_symbols()
    elif args.holdings or not symbols:
        symbols = parse_holdings_from_quotes()
    if not symbols:
        print("No symbols", file=sys.stderr)
        sys.exit(1)
    results = []
    for s in symbols:
        print(f"Processing {s}...", file=sys.stderr)
        results.append(process_symbol(s, uzi_path, args.run_uzi))
    out = json.dumps(results, ensure_ascii=False, indent=2)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(out)


if __name__ == "__main__":
    main()
