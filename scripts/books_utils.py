#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""书籍知识库：解析 frontmatter、生成 id、读写 index。"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BOOKS_DIR = ROOT / "书籍" / "books"
BOOKS_INDEX_PATH = ROOT / "书籍" / "books-index.json"
BOOKS_INDEX_JS_PATH = ROOT / "books-index-data.js"
BOOK_LIST_PATH = ROOT / "书籍" / "投资书单.md"
META_SOURCES_PATH = ROOT / "投资系统" / "meta-sources.json"
RULE_CATEGORIES_PATH = ROOT / "投资系统" / "rule-categories.json"

SECTION_CATEGORIES: dict[str, list[str]] = {
    "价值投资经典": ["价值投资"],
    "段永平/芒格体系": ["价值投资", "思维模型"],
    "交易与实战": ["实战", "估值", "财报"],
    "投资心理与行为": ["心理", "行为金融"],
    "宏观与周期": ["宏观", "周期"],
    "风险与财富观": ["风险", "财富观"],
    "商业与护城河": ["商业", "护城河"],
    "宏观与政策": ["宏观", "政策"],
    "心理与认知": ["心理", "认知"],
    "消费与商业洞察": ["消费", "商业"],
    "半导体/算力": ["半导体", "行业"],
    "AI产业与投研": ["AI", "行业"],
    "标杆企业与案例": ["商业", "案例"],
    "消费品牌案例（泡泡玛特）": ["消费", "案例"],
    "汽车/机器人产业": ["汽车", "机器人", "行业"],
}

TIER_MAP = {
    "Tier 1 核心投资": 1,
    "Tier 2 投资辅助": 2,
    "Tier 3 行业研究": 3,
}


@dataclass
class BookEntry:
    seq: int
    title: str
    tier: int
    section: str
    category_raw: str
    note: str


def make_book_id(seq: int, title: str) -> str:
    h = hashlib.sha256(title.encode("utf-8")).hexdigest()[:6]
    return f"b{seq:03d}-{h}"


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    fm: dict[str, Any] = {}
    for line in parts[1].strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        key = key.strip()
        val = val.strip()
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            fm[key] = [x.strip().strip('"\'') for x in inner.split(",") if x.strip()] if inner else []
        elif val.lower() in ("true", "false"):
            fm[key] = val.lower() == "true"
        elif val.isdigit():
            fm[key] = int(val)
        else:
            fm[key] = val.strip('"\'')
    return fm, parts[2].lstrip("\n")


def dump_frontmatter(fm: dict[str, Any]) -> str:
    lines = ["---"]
    for key in ("id", "title", "tier", "section", "categories", "aliases", "related_rules", "status"):
        if key not in fm:
            continue
        val = fm[key]
        if isinstance(val, list):
            items = ", ".join(str(x) for x in val)
            lines.append(f"{key}: [{items}]")
        elif isinstance(val, bool):
            lines.append(f"{key}: {'true' if val else 'false'}")
        else:
            lines.append(f"{key}: {val}")
    lines.append("---")
    return "\n".join(lines)


def stub_body(title: str) -> str:
    return f"""# {title}

## 一句话

（待补充）

## 核心观点

- （待补充）

## 与 LCAI 规则的对应

（待补充：关联规则编号，如 L3-01）

## 读书笔记

（自由编辑区）
"""


def parse_investment_booklist(md_text: str) -> list[BookEntry]:
    entries: list[BookEntry] = []
    tier = 1
    section = ""
    for line in md_text.splitlines():
        m_tier = re.match(r"^### (Tier \d+ .+?)（\d+）", line)
        if m_tier:
            tier = TIER_MAP.get(m_tier.group(1), tier)
            continue
        m_sec = re.match(r"^#### (.+)$", line)
        if m_sec:
            section = m_sec.group(1).strip()
            continue
        if not line.startswith("|") or line.startswith("| 序号") or line.startswith("|------"):
            continue
        cols = [c.strip() for c in line.strip("|").split("|")]
        if len(cols) < 2 or not cols[0].isdigit():
            continue
        seq = int(cols[0])
        title = cols[1]
        cat = cols[2] if len(cols) > 2 else ""
        note = cols[3] if len(cols) > 3 else ""
        entries.append(BookEntry(seq, title, tier, section, cat, note))
    return entries


def load_books_index() -> dict[str, Any]:
    if not BOOKS_INDEX_PATH.exists():
        return {"version": 1, "books": [], "by_id": {}, "by_title": {}, "by_alias": {}}
    return json.loads(BOOKS_INDEX_PATH.read_text(encoding="utf-8"))


def load_meta_sources() -> dict[str, str]:
    data = json.loads(META_SOURCES_PATH.read_text(encoding="utf-8"))
    return {m["id"]: m["name"] for m in data.get("meta_sources", [])}


def resolve_rule_sources(rule: dict, index: dict[str, Any], meta: dict[str, str]) -> list[str]:
    names: list[str] = []
    by_id = index.get("by_id") or {}
    for bid in rule.get("book_ids") or []:
        b = by_id.get(bid)
        if b:
            names.append(b.get("title") or bid)
    for mid in rule.get("meta_ids") or []:
        names.append(meta.get(mid, mid))
    if not names and rule.get("sources"):
        return list(rule["sources"])
    return names
