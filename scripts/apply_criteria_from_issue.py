#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 GitHub Issue [criteria] 正文解析 JSON 并写入 criteria.json。"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CRITERIA_PATH = ROOT / "投资系统" / "criteria.json"
sys.path.insert(0, str(ROOT / "scripts"))

from validate_criteria import validate  # noqa: E402


def parse_issue_body(body: str) -> dict:
    text = body or ""
    m = re.search(r"```json\s*(\{.*\})\s*```", text, re.S)
    if not m:
        raise ValueError("Issue 正文缺少 ```json ... ``` 代码块")
    return json.loads(m.group(1))


def main() -> None:
    title = os.environ.get("ISSUE_TITLE", "")
    body = os.environ.get("ISSUE_BODY", "")
    if not body and len(sys.argv) > 1:
        body = Path(sys.argv[1]).read_text(encoding="utf-8")

    if "[criteria]" not in title.lower() and not body.strip().startswith("{"):
        print("skip: not a criteria issue", file=sys.stderr)
        return

    cfg = parse_issue_body(body)
    errors = validate(cfg)
    if errors:
        print("validation failed:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    CRITERIA_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"written {CRITERIA_PATH}", file=sys.stderr)

    subprocess.run([sys.executable, str(ROOT / "scripts" / "apply_criteria.py"), "--reports"], cwd=str(ROOT), check=True)


if __name__ == "__main__":
    main()
