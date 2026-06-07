#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描 书籍/books/*.md → books-index.json + books-index-data.js + 投资书单目录段。"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from book_rules_utils import CANDIDATES_PATH  # noqa: E402
from books_utils import (
    BOOKS_DIR,
    BOOKS_INDEX_JS_PATH,
    BOOKS_INDEX_PATH,
    BOOK_LIST_PATH,
    CANDIDATES_JS_PATH,
    META_SOURCES_PATH,
    TIER_LABELS,
    dump_frontmatter,
    load_meta_sources,
    parse_frontmatter,
    tier_categories,
)


def build_index() -> dict:
    books = []
    by_id: dict = {}
    by_title: dict = {}
    by_alias: dict = {}

    for path in sorted(BOOKS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        fm, _ = parse_frontmatter(text)
        if not fm.get("id"):
            fm["id"] = path.stem
        rec = {
            "id": fm["id"],
            "title": fm.get("title") or fm["id"],
            "tier": fm.get("tier", 1),
            "section": fm.get("section", ""),
            "categories": tier_categories(int(fm.get("tier", 1))),
            "candidate_rule_id": fm.get("candidate_rule_id", ""),
            "aliases": fm.get("aliases") or [],
            "related_rules": fm.get("related_rules") or [],
            "status": fm.get("status", "stub"),
            "file": f"书籍/books/{path.name}",
        }
        books.append(rec)
        by_id[rec["id"]] = rec
        by_title[rec["title"]] = rec["id"]
        for alias in rec["aliases"]:
            by_alias[alias] = rec["id"]

    books.sort(key=lambda b: (b["tier"], b.get("section", ""), b["title"]))
    return {
        "version": 1,
        "updated": date.today().isoformat(),
        "count": len(books),
        "books": books,
        "by_id": by_id,
        "by_title": by_title,
        "by_alias": by_alias,
    }


def render_booklist_md(index: dict) -> str:
    lines = [
        "# 投资相关书单",
        "",
        "> **自动生成**，请勿手改目录表格。编辑 [`书籍/books/`](books/) 下各书 Markdown。",
        f"> 合计 **{index['count']} 本** · 更新日期：{index['updated']}",
        "",
        "---",
        "",
        "## 书目目录（按分层）",
        "",
    ]
    current_tier = None
    tier_labels = {k: f"Tier {k} {v}" for k, v in TIER_LABELS.items()}
    tier_counts: dict[int, int] = {}
    for b in index["books"]:
        tier_counts[b["tier"]] = tier_counts.get(b["tier"], 0) + 1

    for b in index["books"]:
        if b["tier"] != current_tier:
            current_tier = b["tier"]
            n = tier_counts.get(current_tier, 0)
            lines.append(f"### {tier_labels.get(current_tier, f'Tier {current_tier}')}（{n}）")
            lines.append("")
            lines.append("| 书名 | 状态 | 文件 |")
            lines.append("|------|------|------|")
        status = "待完善" if b.get("status") == "stub" else "已维护"
        fname = Path(b["file"]).name
        link = f"[{b['title']}](books/{fname})"
        lines.append(f"| {link} | {status} | `{b['id']}` |")
        lines.append("")

    lines.extend([
        "---",
        "",
        "## 阅读路径建议",
        "",
        "1. **价值投资入门**：聪明的投资者 → 穷查理宝典 → 巴菲特致股东的信",
        "2. **财报与估值**：一本书看透财报 → 估值 → 穿透估值",
        "3. **中国市场**：置身事内 → 一本书看透A股 → 文明、现代化、价值投资与中国",
        "4. **周期与配置**：时势 → 人生财富靠康波 → 资产配置攻略",
        "5. **行业投研**：Chip War → 大模型浪潮 → 医疗行业估值",
        "",
    ])
    return "\n".join(lines)


def normalize_all_books() -> int:
    n = 0
    for path in sorted(BOOKS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(text)
        tier = int(fm.get("tier", 1))
        cats = tier_categories(tier)
        if fm.get("categories") == cats:
            continue
        fm["categories"] = cats
        path.write_text(dump_frontmatter(fm) + "\n\n" + body.rstrip() + "\n", encoding="utf-8")
        n += 1
    return n


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--no-booklist", action="store_true", help="Skip regenerating 投资书单.md")
    ap.add_argument("--check", action="store_true", help="Verify index matches books/*.md without writing")
    ap.add_argument("--normalize", action="store_true", help="Rewrite book categories to 3 tier labels")
    args = ap.parse_args()

    if not BOOKS_DIR.exists():
        print(f"error: {BOOKS_DIR} not found; run migrate_books_from_list.py first", file=sys.stderr)
        return 1

    if args.normalize:
        changed = normalize_all_books()
        print(f"normalized categories on {changed} book files")
    index = build_index()

    if args.check:
        if not BOOKS_INDEX_PATH.exists():
            print(f"error: missing {BOOKS_INDEX_PATH}", file=sys.stderr)
            return 1
        existing = json.loads(BOOKS_INDEX_PATH.read_text(encoding="utf-8"))
        existing_cmp = {k: v for k, v in existing.items() if k != "updated"}
        index_cmp = {k: v for k, v in index.items() if k != "updated"}
        if existing_cmp != index_cmp:
            print("books-index.json out of sync; run python scripts/build_books_index.py", file=sys.stderr)
            return 1
        print(f"OK: books index in sync ({index['count']} books)")
        return 0

    BOOKS_INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    meta = load_meta_sources()
    js = (
        "window.LCAI_BOOKS_INDEX = " + json.dumps(index, ensure_ascii=False, indent=2) + ";\n"
        + "window.LCAI_META_SOURCES = " + json.dumps(meta, ensure_ascii=False, indent=2) + ";\n"
    )
    BOOKS_INDEX_JS_PATH.write_text(js, encoding="utf-8")
    print(f"wrote {BOOKS_INDEX_PATH} ({index['count']} books)")
    print(f"wrote {BOOKS_INDEX_JS_PATH}")

    if CANDIDATES_PATH.exists():
        cand = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
        cjs = "window.LCAI_BOOK_RULE_CANDIDATES = " + json.dumps(cand, ensure_ascii=False, indent=2) + ";\n"
        CANDIDATES_JS_PATH.write_text(cjs, encoding="utf-8")
        print(f"wrote {CANDIDATES_JS_PATH}")

    if not args.no_booklist:
        BOOK_LIST_PATH.write_text(render_booklist_md(index), encoding="utf-8")
        print(f"wrote {BOOK_LIST_PATH}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
