#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 GitHub Issue [holding] 解析参数，写入 holdings.json 并同步报告。"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from holdings_utils import add_or_update_holding, normalize_code, parse_issue_payload  # noqa: E402


def parse_symbol_from_title(title: str) -> str:
    m = re.search(r"\[holding\]\s*([0-9]+)", title or "", re.I)
    if not m:
        raise ValueError(f"无法从标题解析代码: {title}")
    return normalize_code(m.group(1))


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), file=sys.stderr)
    subprocess.run(cmd, cwd=str(ROOT), check=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Add holding from GitHub Issue")
    ap.add_argument("--title", default=os.environ.get("ISSUE_TITLE", ""))
    ap.add_argument("--body", default=os.environ.get("ISSUE_BODY", ""))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    symbol = parse_symbol_from_title(args.title)
    payload = parse_issue_payload(args.body)
    code = normalize_code(payload.get("code") or symbol)
    if code != symbol:
        print(f"warn: title symbol {symbol} != body code {code}", file=sys.stderr)

    name = payload.get("name") or code
    entry = add_or_update_holding(
        code=code,
        name=name,
        shares=payload["shares"],
        cost_per_share=payload["costPerShare"],
        account=str(payload["account"]).lower(),
        fallback_price=payload.get("fallbackPrice"),
    )
    print(f"holding saved: {entry['id']}", file=sys.stderr)

    if args.dry_run:
        return

    run([sys.executable, str(ROOT / "scripts" / "sync_holdings.py")])
    run([sys.executable, str(ROOT / "scripts" / "fetch_quotes.py")])
    run([sys.executable, str(ROOT / "scripts" / "watchlist_utils.py"), "add", code])
    run([sys.executable, str(ROOT / "scripts" / "generate_reports.py"), "--symbol", code])


if __name__ == "__main__":
    main()
