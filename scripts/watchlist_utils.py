#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""读写 watchlist-data.js（供 Actions 与脚本使用）。"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WATCHLIST_PATH = ROOT / "watchlist-data.js"
BJ = timezone(timedelta(hours=8))


def normalize_symbol(raw: str) -> str:
    s = re.sub(r"[^0-9A-Za-z]", "", str(raw).upper())
    if len(s) == 5:
        return s.zfill(5)
    if len(s) >= 6:
        return s[-6:].zfill(6) if len(s[-6:]) <= 6 else s[-6:]
    return s


def parse_watchlist() -> list[str]:
    if not WATCHLIST_PATH.exists():
        return []
    text = WATCHLIST_PATH.read_text(encoding="utf-8")
    m = re.search(r'"symbols"\s*:\s*\[(.*?)\]', text, re.S)
    if not m:
        return []
    syms = re.findall(r'"(\d{5,6})"', m.group(1))
    return sorted({normalize_symbol(s) for s in syms})


def write_watchlist(symbols: list[str]) -> None:
    syms = sorted({normalize_symbol(s) for s in symbols if s})
    now = datetime.now(BJ).strftime("%Y-%m-%d")
    content = (
        "window.LCAI_WATCHLIST = {\n"
        f'  "updatedAt": "{now}",\n'
        f'  "symbols": {json.dumps(syms, ensure_ascii=False)}\n'
        "};\n"
    )
    WATCHLIST_PATH.write_text(content, encoding="utf-8")


def add_symbol(symbol: str) -> list[str]:
    syms = parse_watchlist()
    code = normalize_symbol(symbol)
    if code and code not in syms:
        syms.append(code)
    write_watchlist(syms)
    return sorted(syms)


def merge_all_symbols(holdings_fn) -> list[str]:
    syms = set(parse_watchlist())
    syms.update(holdings_fn())
    return sorted(syms)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print(json.dumps(parse_watchlist(), ensure_ascii=False))
    elif sys.argv[1] == "add" and len(sys.argv) > 2:
        print(json.dumps(add_symbol(sys.argv[2]), ensure_ascii=False))
    else:
        print(json.dumps(parse_watchlist(), ensure_ascii=False))
