#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 criteria.json 结构与阈值合法性。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CRITERIA_PATH = ROOT / "投资系统" / "criteria.json"

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


def validate(cfg: dict) -> list[str]:
    errors: list[str] = []

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

    return errors


def main() -> int:
    if not CRITERIA_PATH.exists():
        print(f"找不到 {CRITERIA_PATH}", file=sys.stderr)
        return 1
    cfg = json.loads(CRITERIA_PATH.read_text(encoding="utf-8"))
    errors = validate(cfg)
    if errors:
        print("criteria.json 校验失败:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print(f"OK: {len(cfg.get('rules', []))} 条规则, version {cfg.get('version', '?')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
