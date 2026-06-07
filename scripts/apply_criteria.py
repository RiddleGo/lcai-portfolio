#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""改完 criteria.json 后一键：校验 → 测试 → 导出摘要 →（可选）重生成报告。"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str]) -> int:
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, cwd=str(ROOT)).returncode


def main() -> int:
    ap = argparse.ArgumentParser(description="Apply criteria.json changes")
    ap.add_argument("--reports", action="store_true", help="Regenerate all LCAI reports")
    ap.add_argument("--symbol", help="Regenerate single symbol report")
    args = ap.parse_args()
    py = sys.executable

    steps = [
        [py, "scripts/build_books_index.py", "--no-booklist"],
        [py, "scripts/validate_criteria.py"],
        [py, "scripts/export_criteria_summary.py"],
        [py, "scripts/check_engine_parity.py"],
    ]
    for cmd in steps:
        if run(cmd) != 0:
            return 1

    if args.symbol:
        return run([py, "scripts/generate_reports.py", "--symbol", args.symbol])
    if args.reports:
        return run([py, "scripts/generate_reports.py", "--all"])

    print("\n完成。若阈值已变，建议加 --reports 重算全部报告。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
