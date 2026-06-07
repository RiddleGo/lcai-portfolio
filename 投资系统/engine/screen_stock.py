#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CLI 兼容入口 → 请优先使用 scripts/lcai_screen_json.py"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: python 投资系统/engine/screen_stock.py 600519", file=sys.stderr)
        sys.exit(1)
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "lcai_screen_json.py"), sys.argv[1]],
        cwd=str(ROOT),
    )
    sys.exit(proc.returncode)


if __name__ == "__main__":
    main()
