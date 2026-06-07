#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 criteria.json 的 sources 迁移为 book_ids + meta_ids + category。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CRITERIA_PATH = ROOT / "投资系统" / "criteria.json"
sys.path.insert(0, str(ROOT / "scripts"))

from books_utils import (
    BOOKS_INDEX_PATH,
    RULE_CATEGORIES_PATH,
    dump_frontmatter,
    parse_frontmatter,
)

OVERRIDES_PATH = ROOT / "scripts" / "book_alias_overrides.json"


def load_layer_defaults() -> dict[str, str]:
    data = json.loads(RULE_CATEGORIES_PATH.read_text(encoding="utf-8"))
    return data.get("layer_default_category") or {}


def match_book(source: str, by_title: dict, by_alias: dict, overrides: dict) -> str | None:
    s = source.strip()
    if s in overrides:
        target = overrides[s]
        if target.startswith("__meta__:"):
            return None
        if target in by_title:
            return by_title[target]
        for title, bid in by_title.items():
            if target in title or title in target:
                return bid
    if s in by_title:
        return by_title[s]
    if s in by_alias:
        return by_alias[s]
    for title, bid in by_title.items():
        if s in title or title.startswith(s):
            return bid
    for alias, bid in by_alias.items():
        if s in alias or alias in s:
            return bid
    return None


def match_meta(source: str, overrides: dict, meta_names: dict[str, str]) -> str | None:
    s = source.strip()
    if s in overrides and overrides[s].startswith("__meta__:"):
        return overrides[s].split(":", 1)[1]
    for mid, name in meta_names.items():
        if s == name or s in name or name in s:
            return mid
    return None


def update_book_related_rules(index: dict, rule_id: str, book_ids: list[str]) -> None:
    by_id = index.get("by_id") or {}
    for bid in book_ids:
        rec = by_id.get(bid)
        if not rec:
            continue
        path = ROOT / rec["file"]
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(text)
        related = set(fm.get("related_rules") or [])
        related.add(rule_id)
        fm["related_rules"] = sorted(related)
        path.write_text(dump_frontmatter(fm) + "\n\n" + body.lstrip("\n"), encoding="utf-8")


def main() -> int:
    if not BOOKS_INDEX_PATH.exists():
        print("run build_books_index.py first", file=sys.stderr)
        return 1

    index = json.loads(BOOKS_INDEX_PATH.read_text(encoding="utf-8"))
    by_title = index.get("by_title") or {}
    by_alias = index.get("by_alias") or {}
    overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    meta_data = json.loads((ROOT / "投资系统" / "meta-sources.json").read_text(encoding="utf-8"))
    meta_names = {m["id"]: m["name"] for m in meta_data.get("meta_sources", [])}
    layer_cat = load_layer_defaults()

    cfg = json.loads(CRITERIA_PATH.read_text(encoding="utf-8"))
    warnings: list[str] = []

    for rule in cfg.get("rules") or []:
        layer = rule.get("layer", "")
        rule["category"] = layer_cat.get(layer, "gate")
        book_ids: list[str] = []
        meta_ids: list[str] = []
        sources = rule.get("sources") or []

        for src in sources:
            mid = match_meta(src, overrides, meta_names)
            if mid:
                if mid not in meta_ids:
                    meta_ids.append(mid)
                continue
            bid = match_book(src, by_title, by_alias, overrides)
            if bid:
                if bid not in book_ids:
                    book_ids.append(bid)
            else:
                warnings.append(f"{rule['id']}: unmatched source `{src}`")

        rule["book_ids"] = book_ids
        rule["meta_ids"] = meta_ids
        update_book_related_rules(index, rule["id"], book_ids)

    CRITERIA_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"updated {CRITERIA_PATH}")

    if warnings:
        print("warnings:", file=sys.stderr)
        for w in warnings:
            print(f"  - {w}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
