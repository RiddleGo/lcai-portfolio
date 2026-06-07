#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""书籍候选规则 / 合并规则：读写、校验、检索、LLM 辅助。"""
from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES_PATH = ROOT / "投资系统" / "book-rule-candidates.json"
MERGED_PATH = ROOT / "投资系统" / "book-rules-merged.json"
MERGE_REPORT_PATH = ROOT / "投资系统" / "book-rules-merge-report.md"
CRITERIA_PATH = ROOT / "投资系统" / "criteria.json"
RULE_CATEGORIES_PATH = ROOT / "投资系统" / "rule-categories.json"

VALID_STATUSES = {"stub", "analyzed", "needs_review", "reviewed"}
VALID_CATEGORIES = {"gate", "business", "financial", "valuation", "execution", "sector"}

SECTION_EVAL_HINTS: list[tuple[list[str], str, str, str]] = [
    (["财报", "财务", "会计"], "financial", "L2", "ocf_to_profit"),
    (["估值", "价值", "安全边际", "DCF"], "valuation", "L3", "margin_of_safety"),
    (["心理", "行为", "纪律", "焦虑"], "execution", "L4", "psychology_ok"),
    (["宏观", "周期", "康波", "时势"], "gate", "L0", "revenue_growth"),
    (["交易", "量价", "期货", "技术"], "execution", "L4", "psychology_ok"),
    (["护城河", "竞争", "商业", "消费"], "business", "L1", "moat_proxy"),
    (["半导体", "芯片", "AI", "算力", "机器人", "汽车", "医药", "行业"], "sector", "L5", "sector_fit"),
    (["港股", "A股", "ST"], "gate", "L0", "not_st"),
]

TITLE_EVAL_HINTS: list[tuple[list[str], str, str, str]] = [
    (["财报"], "financial", "L2", "ocf_to_profit"),
    (["估值", "安全边际", "聪明", "DCF"], "valuation", "L3", "margin_of_safety"),
    (["心理", "焦虑", "纪律", "财富"], "execution", "L4", "psychology_ok"),
    (["护城河", "ROE", "竞争优势", "成长股"], "business", "L1", "min_roe_avg"),
    (["周期", "宏观", "康波"], "gate", "L0", "revenue_growth"),
    (["交易", "期货", "量价"], "execution", "L4", "psychology_ok"),
    (["Chip", "半导体", "大模型", "AI", "医疗", "泡泡玛特"], "sector", "L5", "sector_fit"),
    (["A股", "港股", "ST"], "gate", "L0", "not_st"),
    (["芒格", "段永平", "能力圈", "常识"], "gate", "L0", "circle_of_competence"),
    (["集中", "仓位", "配置"], "execution", "L4", "position_cap"),
]

KNOWN_EVALS = {
    "circle_of_competence", "not_st", "min_avg_amount", "revenue_growth", "fraud_suspect",
    "min_roe_avg", "min_profit_years", "gross_margin_score", "moat_proxy", "profit_yoy",
    "profit_collapse", "ocf_to_profit", "deduct_eps_ratio", "profit_trend", "ocf_veto",
    "margin_of_safety", "pe_reasonable", "pb_reasonable", "peg_score", "pe_extreme_veto",
    "trap_scan", "dcf_cross_check", "psychology_ok", "position_cap", "sector_fit",
}


def candidate_id_for_book(book_id: str) -> str:
    short = book_id.split("-")[0] if "-" in book_id else book_id
    return f"BR-{short}"


def load_candidates() -> dict[str, Any]:
    if not CANDIDATES_PATH.exists():
        return {"version": 1, "updated": "", "candidates": []}
    return json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))


def save_candidates(data: dict[str, Any]) -> None:
    from datetime import date

    data["version"] = data.get("version", 1)
    data["updated"] = date.today().isoformat()
    CANDIDATES_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_merged() -> dict[str, Any]:
    if not MERGED_PATH.exists():
        return {"version": 1, "merged_rules": [], "pending_threshold": []}
    return json.loads(MERGED_PATH.read_text(encoding="utf-8"))


def save_merged(data: dict[str, Any]) -> None:
    from datetime import date

    data["version"] = data.get("version", 1)
    data["updated"] = date.today().isoformat()
    MERGED_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_criteria() -> dict[str, Any]:
    return json.loads(CRITERIA_PATH.read_text(encoding="utf-8"))


def infer_rule_hints(book: dict[str, Any], existing_rule_id: str | None = None) -> dict[str, Any]:
    """从书名/section/tier 推断 category、layer、eval。"""
    if existing_rule_id:
        cfg = load_criteria()
        for r in cfg.get("rules") or []:
            if r["id"] == existing_rule_id:
                return {
                    "category": r.get("category", "gate"),
                    "layer_hint": r.get("layer", "L0"),
                    "eval_hint": r.get("eval"),
                    "type_hint": r.get("type", "soft"),
                    "auto_hint": r.get("auto", "manual"),
                    "weight_hint": r.get("weight", 5),
                    "threshold_hint": r.get("threshold"),
                    "executable": r.get("eval") in KNOWN_EVALS and r.get("auto") != "manual",
                    "related_rule_id": existing_rule_id,
                }

    title = book.get("title") or ""
    section = book.get("section") or ""
    text = f"{title} {section}"
    for keywords, cat, layer, ev in TITLE_EVAL_HINTS + SECTION_EVAL_HINTS:
        if any(k in text for k in keywords):
            return {
                "category": cat,
                "layer_hint": layer,
                "eval_hint": ev,
                "type_hint": "soft",
                "auto_hint": "manual" if ev in ("circle_of_competence", "psychology_ok") else "full",
                "weight_hint": 5,
                "threshold_hint": None,
                "executable": ev not in ("circle_of_competence", "psychology_ok"),
                "related_rule_id": None,
            }
    tier = int(book.get("tier", 1))
    if tier == 3:
        return {
            "category": "sector", "layer_hint": "L5", "eval_hint": "sector_fit",
            "type_hint": "soft", "auto_hint": "full", "weight_hint": 8,
            "threshold_hint": 60, "executable": True, "related_rule_id": None,
        }
    if tier == 2:
        return {
            "category": "gate", "layer_hint": "L0", "eval_hint": "revenue_growth",
            "type_hint": "soft", "auto_hint": "full", "weight_hint": 5,
            "threshold_hint": 0, "executable": True, "related_rule_id": None,
        }
    return {
        "category": "business", "layer_hint": "L1", "eval_hint": "min_roe_avg",
        "type_hint": "hard", "auto_hint": "full", "weight_hint": 5,
        "threshold_hint": 15, "executable": True, "related_rule_id": None,
    }


def existing_rule_for_book(book_id: str) -> str | None:
    cfg = load_criteria()
    for r in cfg.get("rules") or []:
        if book_id in (r.get("book_ids") or []):
            return r["id"]
    return None


def search_web_refs(title: str, limit: int = 3, *, skip_web: bool = False) -> tuple[list[str], str]:
    """检索公开资料摘要与 URL 列表。"""
    if skip_web:
        return [f"https://www.google.com/search?q={urllib.parse.quote(title + ' 书评')}"], (
            f"《{title}》为 LCAI 投资参考书目，请结合原书与公开书评验证。"
        )
    refs: list[str] = []
    snippets: list[str] = []
    q = urllib.parse.quote(f"{title} 投资 书籍")
    url = f"https://api.duckduckgo.com/?q={q}&format=json&no_html=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LCAI-book-analyzer/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        abstract = (data.get("AbstractText") or "").strip()
        src = data.get("AbstractURL") or data.get("AbstractSource") or ""
        if abstract:
            snippets.append(abstract)
        if src and src.startswith("http"):
            refs.append(src)
        for topic in (data.get("RelatedTopics") or [])[:limit]:
            if isinstance(topic, dict) and topic.get("FirstURL"):
                refs.append(topic["FirstURL"])
                if topic.get("Text"):
                    snippets.append(str(topic["Text"])[:200])
    except Exception:
        pass

    wiki_q = urllib.parse.quote(title)
    wiki_url = f"https://zh.wikipedia.org/w/api.php?action=opensearch&search={wiki_q}&limit=1&format=json"
    try:
        req = urllib.request.Request(wiki_url, headers={"User-Agent": "LCAI-book-analyzer/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            wiki = json.loads(resp.read().decode("utf-8"))
        if len(wiki) >= 4 and wiki[3]:
            refs.append(wiki[3][0])
            snippets.append(f"维基百科条目：{wiki[1][0] if wiki[1] else title}")
    except Exception:
        pass

    if not refs:
        refs.append(f"https://www.google.com/search?q={urllib.parse.quote(title + ' 书评')}")
    snippet = " ".join(snippets)[:800] if snippets else f"《{title}》是 LCAI 投资参考书目之一，核心观点需结合全书阅读验证。"
    return refs[:5], snippet


def llm_analyze_book(book: dict[str, Any], web_snippet: str, refs: list[str]) -> dict[str, Any] | None:
    """可选 OpenAI 结构化分析；无 key 时返回 None。"""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    hints = infer_rule_hints(book, existing_rule_for_book(book["id"]))
    prompt = f"""分析投资书籍《{book['title']}》（tier={book.get('tier')}，section={book.get('section')}）。
公开资料摘要：{web_snippet}
输出严格 JSON：
{{"one_liner":"","overview":"","points":["…"],"principle":"","rule_name":"","principle_detail":"","confidence":0.0-1.0,
"category":"{hints['category']}","layer_hint":"{hints['layer_hint']}","eval_hint":"{hints.get('eval_hint') or ''}"}}"""
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            out = json.loads(resp.read().decode("utf-8"))
        content = out["choices"][0]["message"]["content"]
        data = json.loads(content)
        data["refs"] = refs
        return data
    except Exception:
        return None


def heuristic_analyze_book(book: dict[str, Any], web_snippet: str, refs: list[str]) -> dict[str, Any]:
    """无 LLM 时的结构化初稿。"""
    title = book["title"]
    hints = infer_rule_hints(book, existing_rule_for_book(book["id"]))
    tier = int(book.get("tier", 1))
    tier_label = {1: "核心投资", 2: "投资辅助", 3: "行业研究"}.get(tier, "核心投资")
    rule_name = hints.get("related_rule_id") and load_criteria()
    if hints.get("related_rule_id"):
        for r in load_criteria().get("rules") or []:
            if r["id"] == hints["related_rule_id"]:
                rule_name = r["name"]
                break
    else:
        rule_name = f"{title}核心原则"

    points = [
        f"本书归入 LCAI {tier_label} 书目，与 {book.get('section') or '通用投研'} 主题相关。",
        web_snippet[:180] if web_snippet else f"建议结合《{title}》原书验证以下要点。",
        "投资需先建立能力圈，再谈估值与仓位。",
        "重视财报质量与现金流，避免叙事驱动。",
        "长期复利来自好生意 + 合理价格 + 纪律执行。",
    ]
    principle = (
        f"借鉴《{title}》：在能力圈内选择商业模式清晰、财务可验证的标的，"
        f"以 {hints['eval_hint']} 所代表的标准做纪律化筛选，避免情绪化交易。"
    )
    return {
        "one_liner": f"《{title}》强调{rule_name if isinstance(rule_name, str) else '价值投资'}与纪律化决策。",
        "overview": (
            f"《{title}》是 LCAI 参考书库中的{tier_label}书目。"
            f"{web_snippet[:300]}"
        ),
        "points": points[:6],
        "principle": principle,
        "rule_name": rule_name if isinstance(rule_name, str) else f"{title}原则",
        "principle_detail": principle,
        "confidence": 0.55 if web_snippet else 0.45,
        "category": hints["category"],
        "layer_hint": hints["layer_hint"],
        "eval_hint": hints.get("eval_hint") or "",
        "type_hint": hints.get("type_hint", "soft"),
        "auto_hint": hints.get("auto_hint", "manual"),
        "weight_hint": hints.get("weight_hint", 5),
        "threshold_hint": hints.get("threshold_hint"),
        "executable": hints.get("executable", False),
        "refs": refs,
        "related_rule_id": hints.get("related_rule_id"),
    }


def build_analysis_markdown(book: dict[str, Any], analysis: dict[str, Any]) -> str:
    title = book["title"]
    points_md = "\n".join(f"- {p}" for p in analysis.get("points") or ["（待补充）"])
    refs_md = "\n".join(f"- [{u}]({u})" for u in analysis.get("refs") or [])
    related = analysis.get("related_rule_id") or "（合并后回填）"
    return f"""# {title}

## 一句话

{analysis.get('one_liner') or '（待补充）'}

## 全书脉络

{analysis.get('overview') or '（待补充）'}

## 核心观点

{points_md}

## 可执行原则

{analysis.get('principle') or analysis.get('principle_detail') or '（待补充）'}

## 与 LCAI 的对应

候选规则：**{analysis.get('rule_name', '—')}** · eval_hint: `{analysis.get('eval_hint') or '—'}` · 现有规则: {related}

## 参考资料

{refs_md or '- （待补充）'}

## 读书笔记

（自由编辑区）
"""


def build_candidate(book: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    cid = candidate_id_for_book(book["id"])
    conf = float(analysis.get("confidence") or 0.5)
    ev = (analysis.get("eval_hint") or "").strip()
    if ev and ev not in KNOWN_EVALS:
        ev = ""
    return {
        "id": cid,
        "book_id": book["id"],
        "book_title": book["title"],
        "tier": book.get("tier", 1),
        "category": analysis.get("category") or "business",
        "layer_hint": analysis.get("layer_hint") or "L1",
        "name": analysis.get("rule_name") or f"{book['title']}原则",
        "principle": analysis.get("principle_detail") or analysis.get("principle") or "",
        "eval_hint": ev or None,
        "threshold_hint": analysis.get("threshold_hint"),
        "executable": bool(analysis.get("executable")) and bool(ev),
        "auto_hint": analysis.get("auto_hint") or "manual",
        "type_hint": analysis.get("type_hint") or "soft",
        "weight_hint": analysis.get("weight_hint") or 5,
        "confidence": round(conf, 2),
        "refs": analysis.get("refs") or [],
        "related_rule_id": analysis.get("related_rule_id"),
    }


def validate_candidate(c: dict[str, Any], by_id: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if not c.get("id"):
        errs.append("缺少 id")
    if not c.get("book_id") or c["book_id"] not in by_id:
        errs.append(f"无效 book_id {c.get('book_id')}")
    if c.get("category") not in VALID_CATEGORIES:
        errs.append(f"无效 category {c.get('category')}")
    if c.get("eval_hint") and c["eval_hint"] not in KNOWN_EVALS:
        errs.append(f"无效 eval_hint {c.get('eval_hint')}")
    if not (c.get("name") or "").strip():
        errs.append("缺少 name")
    if not (c.get("principle") or "").strip():
        errs.append("缺少 principle")
    return errs


def validate_candidates_file(data: dict[str, Any], index: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    by_id = index.get("by_id") or {}
    seen_books: set[str] = set()
    for c in data.get("candidates") or []:
        for e in validate_candidate(c, by_id):
            errs.append(f"{c.get('id')}: {e}")
        bid = c.get("book_id")
        if bid in seen_books:
            errs.append(f"重复 book_id {bid}")
        seen_books.add(bid)
    return errs


def text_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a or "", b or "").ratio()


def eval_to_category_layer(eval_name: str | None) -> tuple[str, str]:
    mapping = {
        "circle_of_competence": ("gate", "L0"),
        "not_st": ("gate", "L0"),
        "min_avg_amount": ("gate", "L0"),
        "revenue_growth": ("gate", "L0"),
        "fraud_suspect": ("gate", "L0"),
        "trap_scan": ("gate", "L0"),
        "min_roe_avg": ("business", "L1"),
        "min_profit_years": ("business", "L1"),
        "gross_margin_score": ("business", "L1"),
        "moat_proxy": ("business", "L1"),
        "profit_yoy": ("business", "L1"),
        "profit_collapse": ("business", "L1"),
        "ocf_to_profit": ("financial", "L2"),
        "deduct_eps_ratio": ("financial", "L2"),
        "profit_trend": ("financial", "L2"),
        "ocf_veto": ("financial", "L2"),
        "margin_of_safety": ("valuation", "L3"),
        "pe_reasonable": ("valuation", "L3"),
        "pb_reasonable": ("valuation", "L3"),
        "peg_score": ("valuation", "L3"),
        "pe_extreme_veto": ("valuation", "L3"),
        "dcf_cross_check": ("valuation", "L3"),
        "psychology_ok": ("execution", "L4"),
        "position_cap": ("execution", "L4"),
        "sector_fit": ("sector", "L5"),
    }
    return mapping.get(eval_name or "", ("business", "L1"))
