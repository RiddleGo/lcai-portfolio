#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""审阅通过后：book-rules-merged.json → criteria.json + 回写书籍 frontmatter。"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from book_rules_utils import load_criteria, load_merged  # noqa: E402
from books_utils import (  # noqa: E402
    BOOKS_DIR,
    dump_frontmatter,
    load_books_index,
    load_meta_sources,
    parse_frontmatter,
    resolve_rule_sources,
)

CRITERIA_PATH = ROOT / "投资系统" / "criteria.json"


def sync_book(book_id: str, rule_ids: list[str], candidate_rule_id: str | None) -> None:
    index = load_books_index()
    rec = index.get("by_id", {}).get(book_id)
    if not rec:
        return
    path = ROOT / rec["file"]
    if not path.exists():
        path = BOOKS_DIR / f"{book_id}.md"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    fm["related_rules"] = sorted(set((fm.get("related_rules") or []) + rule_ids))
    if candidate_rule_id:
        fm["candidate_rule_id"] = candidate_rule_id
    fm["status"] = "reviewed"
    path.write_text(dump_frontmatter(fm) + "\n\n" + body.lstrip("\n"), encoding="utf-8")


def apply_merged(approve: bool) -> int:
    if not approve:
        print("Refusing to write without --approve", file=sys.stderr)
        return 1

    merged = load_merged()
    rules_merged = merged.get("merged_rules") or []
    if not rules_merged:
        print("merged_rules empty; run merge_book_rules.py first", file=sys.stderr)
        return 1

    cfg = load_criteria()
    index = load_books_index()
    meta = load_meta_sources()
    existing = {r["id"]: r for r in cfg.get("rules") or []}

    book_to_rules: dict[str, list[str]] = {}
    book_to_cand: dict[str, str] = {}
    cdata = json.loads((ROOT / "投资系统" / "book-rule-candidates.json").read_text(encoding="utf-8"))
    cand_by_id = {c["id"]: c for c in cdata.get("candidates") or []}

    for m in rules_merged:
        tid = m["target_id"]
        if m["action"] == "extend" and tid in existing:
            rule = existing[tid]
            rule["book_ids"] = sorted(set((rule.get("book_ids") or []) + (m.get("book_ids") or [])))
            rule["sources"] = resolve_rule_sources(rule, index, meta)
        elif m["action"] == "create":
            new_rule = {
                "id": tid,
                "layer": m.get("layer") or "L1",
                "type": m.get("type") or "soft",
                "auto": m.get("auto") or "manual",
                "name": m.get("merged_name") or tid,
                "eval": m.get("eval"),
                "category": m.get("category") or "business",
                "book_ids": sorted(set(m.get("book_ids") or [])),
                "meta_ids": [],
                "sources": [],
            }
            if new_rule["type"] == "soft":
                new_rule["weight"] = m.get("weight") or 5
            if m.get("threshold") is not None:
                new_rule["threshold"] = m["threshold"]
            new_rule["sources"] = resolve_rule_sources(new_rule, index, meta)
            cfg.setdefault("rules", []).append(new_rule)
            existing[tid] = new_rule

        for bid in m.get("book_ids") or []:
            book_to_rules.setdefault(bid, []).append(tid)
        for cid in m.get("candidate_ids") or []:
            c = cand_by_id.get(cid)
            if c:
                book_to_cand[c["book_id"]] = cid

    cfg["rules"] = list({r["id"]: r for r in cfg.get("rules", [])}.values())
    cfg["rules"].sort(key=lambda r: r["id"])

    CRITERIA_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"written {CRITERIA_PATH} ({len(cfg['rules'])} rules)")

    for bid, rids in book_to_rules.items():
        sync_book(bid, rids, book_to_cand.get(bid))

    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_books_index.py")], cwd=str(ROOT), check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "apply_criteria.py")], cwd=str(ROOT), check=True)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--approve", action="store_true", help="Confirm writing criteria.json")
    args = ap.parse_args()
    return apply_merged(args.approve)


if __name__ == "__main__":
    sys.exit(main())
