#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""110 候选规则 → 去重合并 → book-rules-merged.json + merge-report.md。"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from book_rules_utils import (  # noqa: E402
    KNOWN_EVALS,
    MERGE_REPORT_PATH,
    MERGED_PATH,
    eval_to_category_layer,
    load_candidates,
    load_criteria,
    load_merged,
    save_merged,
    text_similarity,
)
from books_utils import load_books_index, resolve_rule_sources  # noqa: E402

SIM_THRESHOLD = 0.52
MAX_EXECUTABLE_RULES = 50


def cluster_candidates(candidates: list[dict]) -> list[list[dict]]:
    buckets: dict[str, list[dict]] = defaultdict(list)
    for c in candidates:
        key = c.get("eval_hint") or c.get("category") or "misc"
        buckets[key].append(c)

    clusters: list[list[dict]] = []
    for _, items in buckets.items():
        used: set[str] = set()
        for i, a in enumerate(items):
            if a["id"] in used:
                continue
            group = [a]
            used.add(a["id"])
            for b in items[i + 1 :]:
                if b["id"] in used:
                    continue
                sim = text_similarity(
                    f"{a.get('name')} {a.get('principle')}",
                    f"{b.get('name')} {b.get('principle')}",
                )
                same_eval = (a.get("eval_hint") or "") == (b.get("eval_hint") or "")
                if sim >= SIM_THRESHOLD or (same_eval and a.get("eval_hint")):
                    group.append(b)
                    used.add(b["id"])
            clusters.append(group)
    return clusters


def find_existing_by_eval(cfg: dict, eval_name: str | None) -> dict | None:
    if not eval_name:
        return None
    for r in cfg.get("rules") or []:
        if r.get("eval") == eval_name:
            return r
    return None


def merge_cluster(cluster: list[dict], cfg: dict, new_counter: dict[str, int]) -> dict:
    primary = max(cluster, key=lambda c: c.get("confidence") or 0)
    eval_hint = primary.get("eval_hint")
    existing = find_existing_by_eval(cfg, eval_hint)
    book_ids = sorted({c["book_id"] for c in cluster})
    cand_ids = [c["id"] for c in cluster]
    names = [c.get("name") for c in cluster if c.get("name")]
    principles = [c.get("principle") for c in cluster if c.get("principle")]

    if existing:
        merged_books = sorted(set((existing.get("book_ids") or []) + book_ids))
        return {
            "target_id": existing["id"],
            "action": "extend",
            "book_ids": merged_books,
            "candidate_ids": cand_ids,
            "merged_name": existing.get("name"),
            "merged_principle": "；".join(dict.fromkeys(principles))[:500],
            "eval": existing.get("eval"),
            "category": existing.get("category"),
            "layer": existing.get("layer"),
            "type": existing.get("type"),
            "auto": existing.get("auto"),
            "threshold": existing.get("threshold"),
            "weight": existing.get("weight"),
        }

    layer = primary.get("layer_hint") or eval_to_category_layer(eval_hint)[1]
    cat = primary.get("category") or eval_to_category_layer(eval_hint)[0]
    new_counter[layer] = new_counter.get(layer, 0) + 1
    target_id = f"{layer}-NEW-{new_counter[layer]:02d}"
    ev = eval_hint if eval_hint in KNOWN_EVALS else "psychology_ok"
    return {
        "target_id": target_id,
        "action": "create",
        "book_ids": book_ids,
        "candidate_ids": cand_ids,
        "merged_name": names[0] if len(names) == 1 else f"{names[0]}等",
        "merged_principle": "；".join(dict.fromkeys(principles))[:500],
        "eval": ev,
        "category": cat,
        "layer": layer,
        "type": primary.get("type_hint") or "soft",
        "auto": primary.get("auto_hint") or "manual",
        "threshold": primary.get("threshold_hint"),
        "weight": primary.get("weight_hint") or 5,
    }


def render_report(merged_rules: list[dict], candidates: list[dict], cfg: dict) -> str:
    index = load_books_index()
    meta = __import__("books_utils", fromlist=["load_meta_sources"]).load_meta_sources()
    lines = [
        "# 书籍候选规则合并报告",
        "",
        "> **自动生成**。审阅后运行：`python scripts/apply_merged_rules.py --approve`",
        "",
        f"- 候选规则：**{len(candidates)}** 条",
        f"- 合并后：**{len(merged_rules)}** 条",
        "",
        "## 合并结果",
        "",
        "| 目标 ID | 动作 | 书名数 | 候选数 | 名称 | eval |",
        "|---------|------|--------|--------|------|------|",
    ]
    for m in merged_rules:
        lines.append(
            f"| {m['target_id']} | {m['action']} | {len(m.get('book_ids') or [])} | "
            f"{len(m.get('candidate_ids') or [])} | {m.get('merged_name', '')[:20]} | {m.get('eval', '—')} |"
        )

    extended = [m for m in merged_rules if m["action"] == "extend"]
    created = [m for m in merged_rules if m["action"] == "create"]
    lines.extend(["", "## 扩展现有规则", ""])
    for m in extended:
        titles = []
        for bid in m.get("book_ids") or []:
            t = index.get("by_id", {}).get(bid, {}).get("title", bid)
            titles.append(t)
        lines.append(f"### {m['target_id']} · {m.get('merged_name')}")
        lines.append("")
        lines.append(f"- 关联书籍：{'、'.join(titles[:8])}{'…' if len(titles) > 8 else ''}")
        lines.append(f"- 原则摘要：{m.get('merged_principle', '')[:200]}")
        lines.append("")

    if created:
        lines.extend(["## 新建规则（待确认）", ""])
        for m in created:
            lines.append(f"- **{m['target_id']}** {m.get('merged_name')} · `{m.get('eval')}` · {len(m.get('book_ids') or [])} 本书")

    low = [c for c in candidates if (c.get("confidence") or 1) < 0.6]
    if low:
        lines.extend(["", "## 低置信度候选（未自动合并阈值变更）", ""])
        for c in low[:20]:
            lines.append(f"- {c['book_title']} ({c['id']}) conf={c.get('confidence')}")

    lines.extend(["", "---", "", "现有 criteria 规则数：", f"- before: {len(cfg.get('rules') or [])}"])
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Print stats only")
    args = ap.parse_args()

    cdata = load_candidates()
    candidates = cdata.get("candidates") or []
    if not candidates:
        print("No candidates; run analyze_books_batch.py first", file=sys.stderr)
        return 1

    cfg = load_criteria()
    clusters = cluster_candidates(candidates)
    new_counter: dict[str, int] = {}
    merged_rules: list[dict] = []

    for cluster in clusters:
        merged_rules.append(merge_cluster(cluster, cfg, new_counter))

    # Dedupe merged_rules by target_id (combine book_ids)
    by_target: dict[str, dict] = {}
    for m in merged_rules:
        tid = m["target_id"]
        if tid not in by_target:
            by_target[tid] = m
            continue
        prev = by_target[tid]
        prev["book_ids"] = sorted(set((prev.get("book_ids") or []) + (m.get("book_ids") or [])))
        prev["candidate_ids"] = sorted(set((prev.get("candidate_ids") or []) + (m.get("candidate_ids") or [])))

    merged_rules = list(by_target.values())
    exec_count = sum(1 for m in merged_rules if m.get("eval") in KNOWN_EVALS)
    if exec_count > MAX_EXECUTABLE_RULES:
        print(f"warn: {exec_count} executable rules > {MAX_EXECUTABLE_RULES}", file=sys.stderr)

    report = render_report(merged_rules, candidates, cfg)
    if args.dry_run:
        print(f"clusters={len(clusters)} merged={len(merged_rules)} extend={sum(1 for m in merged_rules if m['action']=='extend')} create={sum(1 for m in merged_rules if m['action']=='create')}")
        return 0

    save_merged({"version": 1, "merged_rules": merged_rules, "pending_threshold": []})
    MERGE_REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"wrote {MERGED_PATH.name} ({len(merged_rules)} rules)")
    print(f"wrote {MERGE_REPORT_PATH.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
