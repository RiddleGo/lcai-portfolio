#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""读取 holdings.json，供 fetch_quotes / sync_holdings 使用。"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOLDINGS_PATH = ROOT / "holdings.json"


def load_holdings_doc() -> dict:
    if not HOLDINGS_PATH.exists():
        return {"holdings": []}
    return json.loads(HOLDINGS_PATH.read_text(encoding="utf-8"))


def load_holdings() -> list[dict]:
    return load_holdings_doc().get("holdings") or []


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
