#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 书籍/投资书单.md 生成 110 本独立 Markdown 文件。"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from books_utils import (
    BOOKS_DIR,
    BOOK_LIST_PATH,
    SECTION_CATEGORIES,
    BookEntry,
    dump_frontmatter,
    make_book_id,
    parse_investment_booklist,
    stub_body,
)


def write_book(entry: BookEntry, force: bool = False) -> Path:
    BOOKS_DIR.mkdir(parents=True, exist_ok=True)
    book_id = make_book_id(entry.seq, entry.title)
    path = BOOKS_DIR / f"{book_id}.md"
    if path.exists() and not force:
        return path
    categories = tier_categories(entry.tier)
    fm = {
        "id": book_id,
        "title": entry.title,
        "tier": entry.tier,
        "section": entry.section,
        "categories": categories,
        "aliases": [],
        "related_rules": [],
        "status": "stub",
    }
    content = dump_frontmatter(fm) + "\n\n" + stub_body(entry.title)
    if entry.note:
        content += f"\n\n> 备注：{entry.note}\n"
    path.write_text(content, encoding="utf-8")
    return path


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="Overwrite existing book files")
    args = ap.parse_args()

    text = BOOK_LIST_PATH.read_text(encoding="utf-8")
    entries = parse_investment_booklist(text)
    if len(entries) != 110:
        print(f"warn: expected 110 books, parsed {len(entries)}", file=sys.stderr)

    created = 0
    for entry in entries:
        existed = (BOOKS_DIR / f"{make_book_id(entry.seq, entry.title)}.md").exists()
        write_book(entry, force=args.force)
        if not existed or args.force:
            created += 1

    print(f"books: {len(entries)} entries, {created} written to {BOOKS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
