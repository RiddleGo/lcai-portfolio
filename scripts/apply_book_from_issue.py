#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 GitHub Issue [book] 正文解析 JSON 并写入对应书籍 Markdown。"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from books_utils import BOOKS_DIR, dump_frontmatter, parse_frontmatter  # noqa: E402


def parse_issue_body(body: str) -> dict:
    text = body or ""
    m = re.search(r"```json\s*(\{.*\})\s*```", text, re.S)
    if not m:
        raise ValueError("Issue 正文缺少 ```json ... ``` 代码块")
    return json.loads(m.group(1))


def main() -> int:
    title = os.environ.get("ISSUE_TITLE", "")
    body = os.environ.get("ISSUE_BODY", "")
    if not body and len(sys.argv) > 1:
        body = Path(sys.argv[1]).read_text(encoding="utf-8")

    if "[book]" not in title.lower():
        print("skip: not a book issue", file=sys.stderr)
        return 0

    payload = parse_issue_body(body)
    book_id = payload.get("book_id")
    if not book_id:
        print("error: missing book_id", file=sys.stderr)
        return 1

    path = BOOKS_DIR / f"{book_id}.md"
    if not path.exists():
        matches = list(BOOKS_DIR.glob("*.md"))
        for p in matches:
            fm, _ = parse_frontmatter(p.read_text(encoding="utf-8"))
            if fm.get("id") == book_id:
                path = p
                break
    if not path.exists():
        print(f"error: book file not found for {book_id}", file=sys.stderr)
        return 1

    text = path.read_text(encoding="utf-8")
    fm, body_md = parse_frontmatter(text)
    patch = payload.get("frontmatter_patch") or {}
    for key, val in patch.items():
        fm[key] = val
    if payload.get("body_md") is not None:
        body_md = payload["body_md"].lstrip("\n")
    if payload.get("status"):
        fm["status"] = payload["status"]

    out = dump_frontmatter(fm) + "\n\n" + body_md.rstrip() + "\n"
    path.write_text(out, encoding="utf-8")
    print(f"written {path}", file=sys.stderr)

    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build_books_index.py")],
        cwd=str(ROOT),
        check=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
