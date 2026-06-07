#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 holdings.json 生成 holdings-data.js，供 资产总览.html 读取。"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "holdings-data.js"
BJ = timezone(timedelta(hours=8))


def main() -> None:
    from holdings_utils import load_holdings_doc  # noqa: WPS433

    doc = load_holdings_doc()
    now = datetime.now(BJ).strftime("%Y-%m-%d")
    payload = {
        "updatedAt": doc.get("updatedAt") or now,
        "holdings": doc.get("holdings") or [],
    }
    js = "window.LCAI_HOLDINGS = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    OUT.write_text(js, encoding="utf-8")
    active = sum(1 for h in payload["holdings"] if not h.get("sold"))
    print(f"written {OUT}  ({active} active / {len(payload['holdings'])} total)")


if __name__ == "__main__":
    main()
