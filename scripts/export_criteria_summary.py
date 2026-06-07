#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 criteria.json 生成可读摘要（勿手改，由 apply_criteria 刷新）。"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CRITERIA_PATH = ROOT / "投资系统" / "criteria.json"
CATEGORIES_PATH = ROOT / "投资系统" / "rule-categories.json"
OUT = ROOT / "投资系统" / "criteria-摘要.md"

sys.path.insert(0, str(ROOT / "scripts"))
from books_utils import load_books_index, load_meta_sources, resolve_rule_sources  # noqa: E402

TYPE_LABEL = {"hard": "硬指标", "soft": "软指标", "veto": "否决"}


def fmt_threshold(rule: dict) -> str:
    th = rule.get("threshold")
    if th is None:
        return "—"
    if isinstance(th, bool):
        return "是" if th else "否"
    if rule.get("eval") == "margin_of_safety":
        return f"≥{float(th) * 100:.0f}%"
    if rule.get("eval") == "min_avg_amount":
        hk = rule.get("threshold_hk")
        base = f"A股 ≥{float(th) / 1e8:.2f}亿"
        return f"{base} / 港股 ≥{float(hk) / 1e8:.2f}亿" if hk else base
    return str(th)


def main() -> None:
    cfg = json.loads(CRITERIA_PATH.read_text(encoding="utf-8"))
    cats_data = json.loads(CATEGORIES_PATH.read_text(encoding="utf-8"))
    cat_meta = {c["id"]: c for c in cats_data.get("categories", [])}
    index = load_books_index()
    meta = load_meta_sources()

    sc = cfg.get("scoring") or {}
    lines = [
        "# LCAI 判定标准摘要",
        "",
        "> **自动生成**，请勿手改。修改 [`criteria.json`](criteria.json) 后运行：",
        "> `python scripts/apply_criteria.py`",
        "",
        f"版本：**{cfg.get('version', '?')}** · 哲学：**{cfg.get('philosophy', '?')}**",
        "",
        "## 建仓线",
        "",
        f"- 买入总分门槛：**{sc.get('overall_buy', '?')}**",
        f"- 分层权重：L1 {sc.get('weights', {}).get('L1', '?')} · "
        f"L2 {sc.get('weights', {}).get('L2', '?')} · "
        f"L3 {sc.get('weights', {}).get('L3', '?')} · "
        f"L4 {sc.get('weights', {}).get('L4', '?')} · "
        f"L5 {sc.get('weights', {}).get('L5', '?')}",
        "",
        "## 行业 PE",
        "",
        "| 行业 | PE 上限 | 公允 PE | 关键词 |",
        "|------|---------|---------|--------|",
    ]

    pe_caps = cfg.get("sector_pe_caps") or {}
    fair_pes = cfg.get("fair_pe_by_sector") or {}
    kw = cfg.get("sector_keywords") or {}
    for sector in sorted(set(list(pe_caps.keys()) + list(kw.keys()))):
        if sector == "default":
            continue
        kws = "、".join(kw.get(sector, []))
        lines.append(
            f"| {sector} | {pe_caps.get(sector, pe_caps.get('default', '?'))} | "
            f"{fair_pes.get(sector, fair_pes.get('default', '?'))} | {kws or '—'} |"
        )
    lines.append(f"| default | {pe_caps.get('default', '?')} | {fair_pes.get('default', '?')} | 其他 |")

    by_cat: dict[str, list] = defaultdict(list)
    for rule in cfg.get("rules") or []:
        by_cat[rule.get("category") or "gate"].append(rule)

    lines.extend(["", "## 规则一览（按分类）", ""])
    sorted_cats = sorted(
        by_cat.keys(),
        key=lambda cid: cat_meta.get(cid, {}).get("order", 99),
    )
    for cat_id in sorted_cats:
        cat_name = cat_meta.get(cat_id, {}).get("name", cat_id)
        lines.extend(["", f"### {cat_name}", ""])
        lines.append("| 编号 | 层级 | 名称 | 类型 | 阈值 | 来源 |")
        lines.append("|------|------|------|------|------|------|")
        for rule in by_cat[cat_id]:
            sources = "、".join(resolve_rule_sources(rule, index, meta))[:50]
            lines.append(
                f"| {rule.get('id')} | {rule.get('layer')} | {rule.get('name')} | "
                f"{TYPE_LABEL.get(rule.get('type'), rule.get('type'))} | "
                f"{fmt_threshold(rule)} | {sources} |"
            )

    lines.extend(["", "---", "", "完整 JSON：[`criteria.json`](criteria.json)"])
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"written {OUT}")


if __name__ == "__main__":
    main()
