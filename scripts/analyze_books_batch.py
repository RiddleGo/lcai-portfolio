#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI+网络资料 → 书籍 Markdown + book-rule-candidates.json。"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from book_rules_utils import (  # noqa: E402
    build_analysis_markdown,
    build_candidate,
    candidate_id_for_book,
    heuristic_analyze_book,
    llm_analyze_book,
    load_candidates,
    save_candidates,
    search_web_refs,
    validate_candidate,
)
from books_utils import BOOKS_DIR, dump_frontmatter, load_books_index, parse_frontmatter, tier_categories  # noqa: E402


def books_linked_to_criteria(index: dict) -> list[str]:
    from book_rules_utils import load_criteria

    cfg = load_criteria()
    ids: set[str] = set()
    for r in cfg.get("rules") or []:
        ids.update(r.get("book_ids") or [])
    return sorted(ids)


def select_books(index: dict, args: argparse.Namespace) -> list[dict]:
    books = index.get("books") or []
    if args.book_id:
        b = index.get("by_id", {}).get(args.book_id)
        return [b] if b else []
    if args.linked:
        ids = set(books_linked_to_criteria(index))
        books = [b for b in books if b["id"] in ids]
    if args.tier:
        books = [b for b in books if int(b.get("tier", 0)) == args.tier]
    if args.missing:
        cdata = load_candidates()
        done = {c["book_id"] for c in cdata.get("candidates") or []}
        books = [b for b in books if b["id"] not in done]
    if args.resume:
        books = [b for b in books if b.get("status") in (None, "stub", "")]
        for b in books:
            path = BOOKS_DIR / f"{b['id']}.md"
            if path.exists():
                fm, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
                if fm.get("status") in ("analyzed", "reviewed", "needs_review"):
                    continue
                b["_skip"] = False
            else:
                b["_skip"] = False
        books = [b for b in books if not b.get("_skip")]
    return books


def write_book(book: dict, analysis: dict, candidate: dict) -> None:
    path = BOOKS_DIR / f"{book['id']}.md"
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    fm, _ = parse_frontmatter(text) if text else ({}, "")
    fm.update({
        "id": book["id"],
        "title": book["title"],
        "tier": book.get("tier", fm.get("tier", 1)),
        "section": book.get("section", fm.get("section", "")),
        "categories": tier_categories(int(book.get("tier", fm.get("tier", 1)))),
        "aliases": fm.get("aliases") or [],
        "related_rules": fm.get("related_rules") or [],
        "candidate_rule_id": candidate["id"],
        "status": "needs_review" if candidate.get("confidence", 1) < 0.6 else "analyzed",
    })
    body = build_analysis_markdown(book, analysis)
    path.write_text(dump_frontmatter(fm) + "\n\n" + body.rstrip() + "\n", encoding="utf-8")


def upsert_candidate(candidate: dict) -> None:
    data = load_candidates()
    items = [c for c in data.get("candidates") or [] if c.get("book_id") != candidate["book_id"]]
    items.append(candidate)
    items.sort(key=lambda c: (c.get("tier", 1), c.get("book_title", "")))
    data["candidates"] = items
    save_candidates(data)


def analyze_one(book: dict, dry_run: bool = False, skip_web: bool = False) -> bool:
    refs, snippet = search_web_refs(book["title"], skip_web=skip_web)
    analysis = llm_analyze_book(book, snippet, refs) or heuristic_analyze_book(book, snippet, refs)
    candidate = build_candidate(book, analysis)
    index = load_books_index()
    errs = validate_candidate(candidate, index.get("by_id") or {})
    if errs:
        print(f"  skip {book['id']}: {errs}", file=sys.stderr)
        return False
    if dry_run:
        print(f"  OK(dry) {book['title']} -> {candidate['name']} [{candidate.get('eval_hint')}]")
        return True
    write_book(book, analysis, candidate)
    upsert_candidate(candidate)
    print(f"  OK {book['title']} -> {candidate['id']} conf={candidate['confidence']}", flush=True)
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="Analyze books → md + candidates")
    ap.add_argument("--book-id", help="Single book id")
    ap.add_argument("--tier", type=int, help="Filter by tier 1/2/3")
    ap.add_argument("--linked", action="store_true", help="Only books already in criteria book_ids (P0)")
    ap.add_argument("--all", action="store_true", help="All books in index")
    ap.add_argument("--missing", action="store_true", help="Skip books already in candidates")
    ap.add_argument("--resume", action="store_true", help="Skip analyzed/reviewed books")
    ap.add_argument("--no-web", action="store_true", help="Skip web search (faster batch)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--sleep", type=float, default=0.3, help="Seconds between web requests")
    args = ap.parse_args()

    index = load_books_index()
    if args.all:
        books = index.get("books") or []
    else:
        books = select_books(index, args)
    if args.limit:
        books = books[: args.limit]

    if not books:
        print("No books to analyze", file=sys.stderr)
        return 1

    ok = 0
    for book in books:
        if analyze_one(book, dry_run=args.dry_run, skip_web=args.no_web):
            ok += 1
        if not args.no_web:
            time.sleep(args.sleep)

    if not args.dry_run and ok:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build_books_index.py")], cwd=str(ROOT), check=False)

    print(f"Done: {ok}/{len(books)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
