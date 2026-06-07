#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""运行引擎单元测试；可选 --live 对比缓存报告与实时研判。"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "投资系统" / "engine"
sys.path.insert(0, str(ENGINE))
sys.path.insert(0, str(ROOT / "scripts"))


def run_unit_tests() -> int:
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


def check_live(symbols: list[str]) -> int:
    from screen_engine import screen  # noqa: WPS433

    failures = 0
    for sym in symbols:
        cached_path = ROOT / "reports" / sym / "lcai.json"
        if not cached_path.exists():
            print(f"[skip] {sym}: no cached report")
            continue
        cached = json.loads(cached_path.read_text(encoding="utf-8"))
        in_pf = bool(cached.get("in_portfolio"))
        try:
            live = screen(sym, in_portfolio=in_pf)
        except Exception as exc:
            print(f"[fail] {sym}: live screen error: {exc}")
            failures += 1
            continue

        d_live = live["decision"]
        keys = ("verdict", "rating")
        for key in keys:
            if cached.get(key) != d_live.get(key):
                print(f"[warn] {sym}: {key} cached={cached.get(key)!r} live={d_live.get(key)!r}")

        score_cached = cached.get("overall_score")
        score_live = d_live.get("overall_score")
        if score_cached is not None and score_live is not None:
            delta = abs(score_cached - score_live)
            if delta > 5:
                print(f"[warn] {sym}: overall_score delta {delta} (cached {score_cached}, live {score_live})")

        pe_cached = cached.get("pe")
        pe_live = live["metrics"].get("pe")
        if cached.get("loss_maker") and pe_live is not None and pe_live < 0:
            print(f"[fail] {sym}: loss_maker should not expose negative PE")
            failures += 1

        print(f"[ok] {sym}: verdict={d_live['verdict']} score={score_live} in_portfolio={in_pf}")

    return failures


def main() -> None:
    ap = argparse.ArgumentParser(description="LCAI engine parity check")
    ap.add_argument("--live", action="store_true", help="Compare live screen vs cached reports")
    ap.add_argument("--symbols", nargs="*", default=["601127", "600362", "01833", "09880"])
    args = ap.parse_args()

    code = run_unit_tests()
    if code != 0:
        sys.exit(code)

    if args.live:
        code = check_live(args.symbols)
        sys.exit(code)

    print("All offline tests passed.")


if __name__ == "__main__":
    main()
