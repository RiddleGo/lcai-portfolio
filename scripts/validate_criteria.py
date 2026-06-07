#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 criteria.json 结构与阈值合法性。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CRITERIA_PATH = ROOT / "投资系统" / "criteria.json"
RULE_CATEGORIES_PATH = ROOT / "投资系统" / "rule-categories.json"
CANDIDATES_PATH = ROOT / "投资系统" / "book-rule-candidates.json"
MERGED_PATH = ROOT / "投资系统" / "book-rules-merged.json"

sys.path.insert(0, str(ROOT / "scripts"))
from book_rules_utils import validate_candidates_file  # noqa: E402
from books_utils import load_books_index, load_meta_sources  # noqa: E402

KNOWN_EVALS = {
    "circle_of_competence",
    "not_st",
    "min_avg_amount",
    "revenue_growth",
    "fraud_suspect",
    "min_roe_avg",
    "min_profit_years",
    "gross_margin_score",
    "moat_proxy",
    "profit_yoy",
    "profit_collapse",
    "ocf_to_profit",
    "deduct_eps_ratio",
    "profit_trend",
    "ocf_veto",
    "margin_of_safety",
    "pe_reasonable",
    "pb_reasonable",
    "peg_score",
    "pe_extreme_veto",
    "trap_scan",
    "dcf_cross_check",
    "psychology_ok",
    "position_cap",
    "sector_fit",
}

VALID_TYPES = {"hard", "soft", "veto"}
VALID_LAYERS = {"L0", "L1", "L2", "L3", "L4", "L5"}


def load_category_ids() -> set[str]:
    data = json.loads(RULE_CATEGORIES_PATH.read_text(encoding="utf-8"))
    return {c["id"] for c in data.get("categories", [])}


def validate_warnings(cfg: dict, index: dict) -> list[str]:
    warnings: list[str] = []
    by_id = index.get("by_id") or {}
    rule_map = {r["id"]: r for r in cfg.get("rules") or [] if r.get("id")}

    for rule in cfg.get("rules") or []:
        rid = rule.get("id")
        if not rid:
            continue
        for bid in rule.get("book_ids") or []:
            book = by_id.get(bid)
            if book and rid not in (book.get("related_rules") or []):
                warnings.append(
                    f"{rid} → {bid}: 书籍 frontmatter 未列入 related_rules（建议同步）"
                )

    for book in index.get("books") or []:
        bid = book.get("id")
        for rr in book.get("related_rules") or []:
            rule = rule_map.get(rr)
            if rule and bid not in (rule.get("book_ids") or []):
                warnings.append(
                    f"{bid} related_rules 含 {rr}，但该规则 book_ids 未引用此书"
                )
    return warnings


def validate(cfg: dict) -> list[str]:
    errors: list[str] = []
    valid_cats = load_category_ids()
    index = load_books_index()
    by_id = index.get("by_id") or {}
    meta = load_meta_sources()

    scoring = cfg.get("scoring") or {}
    weights = scoring.get("weights") or {}
    wsum = sum(weights.values())
    if abs(wsum - 1.0) > 0.001:
        errors.append(f"scoring.weights 之和应为 1.0，当前 {wsum}")

    for key in ("L1", "L2", "L3", "L4", "L5"):
        if key not in weights:
            errors.append(f"scoring.weights 缺少 {key}")

    pe_caps = cfg.get("sector_pe_caps") or {}
    fair_pes = cfg.get("fair_pe_by_sector") or {}
    if "default" not in pe_caps:
        errors.append("sector_pe_caps 缺少 default")
    if "default" not in fair_pes:
        errors.append("fair_pe_by_sector 缺少 default")

    kw = cfg.get("sector_keywords") or {}
    for sector in kw:
        if sector not in pe_caps and sector != "default":
            errors.append(f"sector_keywords.{sector} 在 sector_pe_caps 中无对应项")
        if sector not in fair_pes and sector != "default":
            errors.append(f"sector_keywords.{sector} 在 fair_pe_by_sector 中无对应项")

    rules = cfg.get("rules") or []
    if not rules:
        errors.append("rules 为空")
        return errors

    ids = set()
    for i, rule in enumerate(rules):
        rid = rule.get("id")
        if not rid:
            errors.append(f"rules[{i}] 缺少 id")
            continue
        if rid in ids:
            errors.append(f"重复规则 id: {rid}")
        ids.add(rid)

        layer = rule.get("layer")
        if layer not in VALID_LAYERS:
            errors.append(f"{rid}: layer 无效 {layer}")

        rtype = rule.get("type")
        if rtype not in VALID_TYPES:
            errors.append(f"{rid}: type 无效 {rtype}")

        ev = rule.get("eval")
        if ev not in KNOWN_EVALS:
            errors.append(f"{rid}: 未知 eval `{ev}`（需同步改引擎代码）")

        if rtype == "soft" and not rule.get("weight"):
            errors.append(f"{rid}: soft 规则缺少 weight")

        cat = rule.get("category")
        if not cat:
            errors.append(f"{rid}: 缺少 category")
        elif cat not in valid_cats:
            errors.append(f"{rid}: category `{cat}` 不在 rule-categories.json")

        for bid in rule.get("book_ids") or []:
            if bid not in by_id:
                errors.append(f"{rid}: 未知 book_id `{bid}`")

        for mid in rule.get("meta_ids") or []:
            if mid not in meta:
                errors.append(f"{rid}: 未知 meta_id `{mid}`")

    return errors


def validate_book_rules_files(index: dict) -> list[str]:
    errors: list[str] = []
    if CANDIDATES_PATH.exists():
        data = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
        errors.extend(validate_candidates_file(data, index))
    if MERGED_PATH.exists():
        merged = json.loads(MERGED_PATH.read_text(encoding="utf-8"))
        by_id = index.get("by_id") or {}
        cfg = json.loads(CRITERIA_PATH.read_text(encoding="utf-8")) if CRITERIA_PATH.exists() else {}
        rule_ids = {r["id"] for r in cfg.get("rules") or []}
        cand_ids = {c["id"] for c in json.loads(CANDIDATES_PATH.read_text(encoding="utf-8")).get("candidates", [])} if CANDIDATES_PATH.exists() else set()
        for m in merged.get("merged_rules") or []:
            tid = m.get("target_id")
            if m.get("action") == "extend" and tid and tid not in rule_ids:
                errors.append(f"merged target_id 不存在: {tid}")
            for bid in m.get("book_ids") or []:
                if bid not in by_id:
                    errors.append(f"merged 未知 book_id {bid}")
            for cid in m.get("candidate_ids") or []:
                if cand_ids and cid not in cand_ids:
                    errors.append(f"merged 未知 candidate_id {cid}")
    return errors


def main() -> int:
    if not CRITERIA_PATH.exists():
        print(f"找不到 {CRITERIA_PATH}", file=sys.stderr)
        return 1
    cfg = json.loads(CRITERIA_PATH.read_text(encoding="utf-8"))
    index = load_books_index()
    errors = validate(cfg)
    errors.extend(validate_book_rules_files(index))
    warnings = validate_warnings(cfg, index)
    if errors:
        print("criteria.json 校验失败:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    if warnings:
        print("警告（非阻断）:", file=sys.stderr)
        for w in warnings:
            print(f"  - {w}", file=sys.stderr)
    print(f"OK: {len(cfg.get('rules', []))} 条规则, version {cfg.get('version', '?')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
