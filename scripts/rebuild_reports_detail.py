#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为已有 reports 补全 analysis / unified 详细字段并重建 index.html（无需 UZI）。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_lcai_detail import build_divergence_notes, build_lcai_detail  # noqa: E402
from build_report_html import write_report_html  # noqa: E402
from build_unified_report import build_unified_report, write_unified_report  # noqa: E402


def watchlist_symbols() -> list[str]:
    wl = ROOT / "watchlist-data.js"
    if wl.exists():
        return re.findall(r'"(\d{5,6})"', wl.read_text(encoding="utf-8"))
    return []


def rebuild_symbol(symbol: str) -> None:
    out_dir = ROOT / "reports" / symbol
    lcai_path = out_dir / "lcai.json"
    if not lcai_path.exists():
        print(f"SKIP {symbol}: no lcai.json")
        return

    lcai = json.loads(lcai_path.read_text(encoding="utf-8"))
    lcai["analysis"] = build_lcai_detail(lcai)
    lcai_path.write_text(json.dumps(lcai, ensure_ascii=False, indent=2), encoding="utf-8")

    compare_path = out_dir / "lcai-vs-uzi.json"
    compare = json.loads(compare_path.read_text(encoding="utf-8")) if compare_path.exists() else {}
    uzi_tone = compare.get("uzi_tone")
    compare["divergences"] = build_divergence_notes(lcai, uzi_tone)
    compare["divergence_notes"] = compare["divergences"]
    if compare_path.exists() or compare.get("symbol"):
        compare.setdefault("symbol", symbol)
        compare.setdefault("name", lcai.get("name"))
        (out_dir / "lcai-vs-uzi.json").write_text(json.dumps(compare, ensure_ascii=False, indent=2), encoding="utf-8")
        (out_dir / "meta.json").write_text(json.dumps(compare, ensure_ascii=False, indent=2), encoding="utf-8")
    uzi_path = out_dir / "uzi.json"
    uzi = json.loads(uzi_path.read_text(encoding="utf-8")) if uzi_path.exists() else None

    unified = build_unified_report(lcai, uzi, compare, symbol)
    write_unified_report(symbol, unified, out_dir)
    write_report_html(out_dir, symbol, lcai, unified, compare)
    print(f"OK {symbol}")


def main() -> None:
    syms = sys.argv[1:] if len(sys.argv) > 1 else watchlist_symbols()
    if not syms:
        print("No symbols", file=sys.stderr)
        sys.exit(1)
    for s in syms:
        rebuild_symbol(s)


if __name__ == "__main__":
    main()
