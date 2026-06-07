#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""读取/写入 holdings.json，供 fetch_quotes / sync_holdings / Issue 流程使用。"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOLDINGS_PATH = ROOT / "holdings.json"
BJ = timezone(timedelta(hours=8))


def normalize_code(raw: str) -> str:
    s = re.sub(r"[^0-9A-Za-z]", "", str(raw).upper())
    if len(s) == 5:
        return s.zfill(5)
    if len(s) >= 6:
        return s[-6:].zfill(6)
    return s


def code_to_secid(code: str) -> str:
    c = normalize_code(code)
    if len(c) == 5:
        return f"116.{c}"
    if len(c) == 6:
        prefix = "1" if c[0] in "65" else "0"
        return f"{prefix}.{c}"
    raise ValueError(f"代码格式无效: {code}")


def holding_id(code: str, account: str) -> str:
    return f"{normalize_code(code)}_{account.strip().lower()}"


def load_holdings_doc() -> dict:
    if not HOLDINGS_PATH.exists():
        return {"holdings": []}
    return json.loads(HOLDINGS_PATH.read_text(encoding="utf-8"))


def load_holdings() -> list[dict]:
    return load_holdings_doc().get("holdings") or []


def write_holdings_doc(doc: dict) -> None:
    doc["updatedAt"] = datetime.now(BJ).strftime("%Y-%m-%d")
    HOLDINGS_PATH.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def active_holdings() -> list[dict]:
    return [h for h in load_holdings() if not h.get("sold")]


def quote_symbols() -> dict[str, str]:
    """Unique secid → name for live quote fetch (active holdings only)."""
    out: dict[str, str] = {}
    for h in active_holdings():
        secid = h.get("symbol")
        if secid:
            out[secid] = h.get("name") or secid
    return out


def quote_fallbacks() -> dict[str, float]:
    """secid → fallbackPrice for active holdings."""
    out: dict[str, float] = {}
    for h in active_holdings():
        secid = h.get("symbol")
        fb = h.get("fallbackPrice")
        if secid and fb is not None:
            out[secid] = float(fb)
    return out


def find_holding(code: str, account: str | None = None) -> dict | None:
    secid = code_to_secid(code)
    acct = account.strip().lower() if account else None
    for h in load_holdings():
        if h.get("symbol") != secid:
            continue
        if acct and h.get("account", "").lower() != acct:
            continue
        return h
    return None


def is_in_holdings(code: str) -> bool:
    secid = code_to_secid(code)
    return any(not h.get("sold") and h.get("symbol") == secid for h in load_holdings())


def add_or_update_holding(
    *,
    code: str,
    name: str,
    shares: int | float,
    cost_per_share: float,
    account: str,
    fallback_price: float | None = None,
) -> dict:
    if account not in ("gt", "hb"):
        raise ValueError("account 须为 gt 或 hb")
    secid = code_to_secid(code)
    hk = secid.startswith("116.")
    entry = {
        "id": holding_id(code, account),
        "name": name.strip() or normalize_code(code),
        "account": account,
        "symbol": secid,
        "shares": int(shares),
        "costPerShare": round(float(cost_per_share), 4),
        "currency": "HKD" if hk else "CNY",
        "hk": hk,
        "fallbackPrice": round(float(fallback_price or cost_per_share), 4),
        "sold": False,
    }

    doc = load_holdings_doc()
    items = doc.get("holdings") or []
    replaced = False
    for i, h in enumerate(items):
        if h.get("id") == entry["id"]:
            items[i] = entry
            replaced = True
            break
    if not replaced:
        items.append(entry)
    doc["holdings"] = items
    write_holdings_doc(doc)
    return entry


def parse_issue_payload(body: str) -> dict:
    text = body or ""
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else text.strip()
    if not raw.startswith("{"):
        raise ValueError("Issue 正文缺少 JSON 块")
    data = json.loads(raw)
    required = ("code", "shares", "costPerShare", "account")
    missing = [k for k in required if data.get(k) in (None, "")]
    if missing:
        raise ValueError(f"缺少字段: {', '.join(missing)}")
    return data
