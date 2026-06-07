#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 LCAI 裁决写入 reports/{symbol}/unified.json。"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

BJ = timezone(timedelta(hours=8))

LAYER_META = {
    "L0": "门禁",
    "L1": "生意",
    "L2": "财务",
    "L3": "估值",
    "L4": "执行",
    "L5": "行业",
}


def max_weight_for_rating(rating: str | None) -> str:
    if rating == "A":
        return "25%"
    if rating == "B":
        return "10%"
    return "0%"


def lcai_layer_status(layer: str, lcai: dict) -> str:
    vetoes = lcai.get("vetoes_triggered") or []
    hard = lcai.get("hard_failures") or []
    if layer == "L0":
        if vetoes or lcai.get("is_st") or "L0-02" in hard:
            return "未通过"
        return "通过"
    layer_rules = {"L1": ["L1-01", "L1-02"], "L2": ["L2-01"], "L3": ["L3-01", "L3-02"]}
    ids = layer_rules.get(layer, [])
    if any(r in hard for r in ids):
        return "有缺口"
    return "通过"


def lcai_layer_summary(layer: str, lcai: dict) -> str:
    vetoes = lcai.get("vetoes_triggered") or []
    hard = lcai.get("hard_failures") or []
    traps = lcai.get("trap_flags") or []

    if layer == "L0":
        parts = []
        if lcai.get("is_st"):
            parts.append("ST 股票")
        if "L0-05" in vetoes:
            parts.append("造假嫌疑（OCF/利润背离）")
        if "L0-06" in vetoes or lcai.get("trap_suspect"):
            parts.append(f"异常票特征：{'、'.join(traps) if traps else 'trap_scan 触发'}")
        if not parts:
            return "门禁通过：非 ST、流动性达标、无造假/庄股否决。"
        return "；".join(parts)

    if layer == "L1":
        roe = lcai.get("roe_avg")
        py = lcai.get("profit_years")
        parts = []
        if "L1-01" in hard:
            parts.append(f"ROE 均值 {roe}% 未达 15%")
        elif roe is not None:
            parts.append(f"ROE 均值 {roe}%")
        if "L1-02" in hard:
            parts.append("5 年盈利年数不足")
        if "L1-06" in vetoes:
            parts.append("利润崩塌否决")
        return "；".join(parts) if parts else "生意质量见规则明细。"

    if layer == "L2":
        ocf = lcai.get("ocf_ratio")
        if "L2-01" in hard:
            return f"现金流质量 OCF/EPS {ocf} 未达 0.8"
        if "L2-04" in vetoes:
            return "现金流长期背离否决"
        return f"OCF/EPS 约 {ocf}" if ocf is not None else "财务健康见规则明细。"

    if layer == "L3":
        mos = lcai.get("margin_of_safety_pct")
        pe = lcai.get("pe")
        fv = lcai.get("fair_value")
        dcf = lcai.get("dcf_fair_value")
        dcf_mos = lcai.get("dcf_margin_of_safety_pct")
        parts = []
        if "L3-01" in hard:
            parts.append(f"安全边际 {mos}% 未达 25%")
        elif mos is not None:
            parts.append(f"安全边际 {mos}%")
        if "L3-02" in hard:
            parts.append(f"PE {pe} 超行业上限")
        if fv:
            parts.append(f"公允价约 {fv} 元")
        if dcf:
            parts.append(f"DCF 公允 {dcf} 元（边际 {dcf_mos}%）")
        return "；".join(parts) if parts else "估值见规则明细。"

    if layer == "L4":
        return "能力圈与心理纪律需用户在网页勾选确认。"

    if layer == "L5":
        ind = lcai.get("industry")
        return f"行业：{ind}" if ind else "行业适配见规则明细。"

    return ""


def build_valuation_narrative(lcai: dict, compare: dict) -> str:
    lines = []
    fv = lcai.get("fair_value")
    mos = lcai.get("margin_of_safety_pct")
    dcf = lcai.get("dcf_fair_value")
    dcf_mos = lcai.get("dcf_margin_of_safety_pct")
    price = lcai.get("price")

    if fv is not None:
        lines.append(f"LCAI 公允价（行业 PE × EPS）≈ {fv} 元，安全边际 {mos}%（建仓线 25%）。")
    if dcf is not None:
        lines.append(f"LCAI 简化 DCF 公允 ≈ {dcf} 元，DCF 安全边际 {dcf_mos}%。")
    if price:
        lines.append(f"现价 {price} 元。")
    if compare.get("margin_gap"):
        lines.append(compare["margin_gap"] + "。")
    return "\n".join(lines) if lines else "暂无估值数据。"


def build_executive(lcai: dict, compare: dict, detail: dict | None = None) -> str:
    from build_lcai_detail import is_data_valid  # noqa: WPS433

    detail = detail or {}
    if detail.get("executive_brief"):
        return detail["executive_brief"]
    if not is_data_valid(lcai)[0]:
        name = lcai.get("name") or lcai.get("symbol")
        return f"{name}：数据不足，无法研判。请 Run workflow 刷新缓存。"
    parts = [
        f"{lcai.get('name', lcai.get('symbol'))}：LCAI 判定「{lcai.get('verdict')}」——{lcai.get('verdict_action', '')}",
    ]
    parts.append("买卖结论以 LCAI 规则为准。")
    return " ".join(parts)


def build_strengths_weaknesses(lcai: dict) -> tuple[list[str], list[str]]:
    strengths: list[str] = []
    weaknesses: list[str] = []

    roe = lcai.get("roe_avg")
    if roe is not None and roe >= 15:
        strengths.append(f"LCAI: ROE 均值 {roe}% 达标")
    elif roe is not None and roe < 15:
        weaknesses.append(f"LCAI: ROE 均值 {roe}% 未达 15%")

    mos = lcai.get("margin_of_safety_pct")
    if mos is not None and mos >= 25:
        strengths.append(f"LCAI: 安全边际 {mos}% 达建仓线")
    elif mos is not None and mos < 25:
        weaknesses.append(f"LCAI: 安全边际 {mos}% 未达 25%")

    for v in lcai.get("vetoes_triggered") or []:
        weaknesses.append(f"LCAI: 否决 {v}")
    for h in lcai.get("hard_failures") or []:
        weaknesses.append(f"LCAI: 硬指标 Fail {h}")

    return strengths[:10], weaknesses[:10]


def build_unified_report(lcai: dict, compare: dict, symbol: str) -> dict:
    from build_lcai_detail import build_lcai_detail, is_data_valid  # noqa: WPS433

    rating = lcai.get("rating") or compare.get("lcai_rating")
    verdict = lcai.get("verdict") or compare.get("lcai_verdict")
    action = lcai.get("verdict_action") or compare.get("lcai_verdict_action")
    in_portfolio = bool(compare.get("in_portfolio"))
    detail = lcai.get("analysis") or {}
    if not detail.get("final_conclusion"):
        detail = build_lcai_detail(lcai, in_portfolio=in_portfolio)

    layers = []
    for layer, title_suffix in LAYER_META.items():
        lcai_sum = lcai_layer_summary(layer, lcai)
        layers.append({
            "layer": layer,
            "title": f"{layer} {title_suffix}",
            "lcai_status": lcai_layer_status(layer, lcai),
            "lcai_summary": lcai_sum,
            "merged_summary": lcai_sum,
        })

    strengths, weaknesses = build_strengths_weaknesses(lcai)
    valuation = {
        "lcai_fair_value": lcai.get("fair_value") or compare.get("lcai_fair_value"),
        "lcai_margin_pct": lcai.get("margin_of_safety_pct") or compare.get("lcai_margin_pct"),
        "dcf_fair_value": lcai.get("dcf_fair_value") or compare.get("dcf_fair_value"),
        "dcf_margin_pct": lcai.get("dcf_margin_of_safety_pct") or compare.get("dcf_margin_pct"),
        "narrative": build_valuation_narrative(lcai, compare),
    }

    return {
        "symbol": symbol,
        "name": lcai.get("name") or compare.get("name"),
        "verdict": {
            "value": verdict,
            "action": action,
            "rating": rating,
            "score": lcai.get("overall_score") or compare.get("lcai_score"),
            "source": "lcai",
            "max_weight": max_weight_for_rating(rating),
        },
        "executive": build_executive(lcai, compare, detail),
        "final_conclusion": detail.get("final_conclusion") or {},
        "executive_brief": detail.get("executive_brief") or "",
        "data_ok": detail.get("data_ok", is_data_valid(lcai)[0]),
        "summary_detailed": detail.get("summary_detailed") or build_executive(lcai, compare),
        "key_metrics": detail.get("key_metrics") or [],
        "decision_path": detail.get("decision_path") or [],
        "rule_highlights": detail.get("rule_highlights") or [],
        "rule_details": detail.get("rule_details") or [],
        "divergence_notes": detail.get("divergence_notes") or compare.get("divergence_notes") or [],
        "valuation": valuation,
        "layers": layers,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "divergences": detail.get("divergence_notes") or compare.get("divergence_notes") or compare.get("divergences") or [],
        "depth": {
            "lcai_ready": True,
            "ready": True,
            "schedule": "weekly_monday",
        },
        "report_url": compare.get("report_url") or f"reports/{symbol}/index.html",
        "generated_at": compare.get("generated_at")
        or datetime.now(BJ).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "disclaimer": "买卖结论以 LCAI 投资宪法为准。",
    }


def write_unified_report(symbol: str, unified: dict, out_dir: Path | None = None) -> Path:
    root = out_dir or Path(__file__).resolve().parents[1] / "reports" / symbol
    root.mkdir(parents=True, exist_ok=True)
    path = root / "unified.json"
    path.write_text(json.dumps(unified, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
