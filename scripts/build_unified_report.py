#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 LCAI 裁决与 UZI 价值派材料融合为 reports/{symbol}/unified.json。"""
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


def parse_uzi_enrichment(uzi: dict | None) -> dict[str, Any]:
    if not uzi:
        return {"ready": False}

    tone = uzi.get("tone") or uzi.get("verdict") or uzi.get("core_conclusion")
    consensus = uzi.get("overall_score") or uzi.get("fund_score") or uzi.get("value_consensus")

    dcf_block = uzi.get("dcf") if isinstance(uzi.get("dcf"), dict) else {}
    uzi_dcf_fv = (
        uzi.get("dcf_fair_value")
        or uzi.get("intrinsic_value")
        or dcf_block.get("fair_value")
        or dcf_block.get("intrinsic_value")
    )
    uzi_dcf_mos = uzi.get("dcf_margin_pct") or dcf_block.get("margin_of_safety_pct")

    risks = uzi.get("risk_flags") or uzi.get("risks") or uzi.get("key_risks") or []
    if isinstance(risks, dict):
        risks = list(risks.values())
    traps = uzi.get("trap_flags") or uzi.get("trap_notes") or []
    if isinstance(traps, str):
        traps = [traps]

    strengths_raw = uzi.get("strengths") or uzi.get("bull_points") or []
    weaknesses_raw = uzi.get("weaknesses") or uzi.get("bear_points") or []

    fund_score = uzi.get("fund_score")
    cash_score = uzi.get("cash_score") or uzi.get("cashflow_score")

    ready = bool(tone or consensus or uzi_dcf_fv or risks or fund_score)

    return {
        "ready": ready,
        "tone": tone,
        "consensus": consensus,
        "fund_score": fund_score,
        "cash_score": cash_score,
        "dcf_fair_value": uzi_dcf_fv,
        "dcf_margin_pct": uzi_dcf_mos,
        "risk_flags": [str(x) for x in risks][:6],
        "trap_flags": [str(x) for x in traps][:6],
        "strengths": [str(x) for x in strengths_raw][:6],
        "weaknesses": [str(x) for x in weaknesses_raw][:6],
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


def uzi_layer_insight(layer: str, uzi_e: dict) -> str | None:
    if not uzi_e.get("ready"):
        return None
    tone = uzi_e.get("tone")
    parts = []

    if layer == "L0" and uzi_e.get("trap_flags"):
        parts.append(f"排雷：{'；'.join(uzi_e['trap_flags'][:3])}")
    if layer == "L1" and uzi_e.get("fund_score") is not None:
        parts.append(f"基本面分 {uzi_e['fund_score']}")
    if layer == "L2" and uzi_e.get("cash_score") is not None:
        parts.append(f"现金流分 {uzi_e['cash_score']}")
    if layer == "L3":
        if tone:
            parts.append(f"价值派定调：{tone}")
        if uzi_e.get("dcf_fair_value") is not None:
            mos = uzi_e.get("dcf_margin_pct")
            mos_txt = f"，边际 {mos}%" if mos is not None else ""
            parts.append(f"UZI DCF 公允 {uzi_e['dcf_fair_value']}{mos_txt}")
    if layer == "L4":
        return None
    if layer == "L5" and tone:
        parts.append(f"定调：{tone}")

    return "；".join(parts) if parts else (f"价值派：{tone}" if tone and layer in ("L1", "L2", "L3") else None)


def merge_layer_summary(lcai_sum: str, uzi_ins: str | None) -> str:
    if not uzi_ins:
        return lcai_sum
    return f"{lcai_sum} 【UZI】{uzi_ins}"


def build_valuation_narrative(lcai: dict, uzi_e: dict, compare: dict) -> str:
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
    if uzi_e.get("ready") and uzi_e.get("dcf_fair_value") is not None:
        uzi_mos = uzi_e.get("dcf_margin_pct")
        uzi_mos_txt = f"，边际 {uzi_mos}%" if uzi_mos is not None else ""
        lines.append(
            f"UZI 价值派 DCF 公允 ≈ {uzi_e['dcf_fair_value']} 元{uzi_mos_txt}（参考，不改变 LCAI 裁决）。"
        )
    elif uzi_e.get("ready") and uzi_e.get("tone"):
        lines.append(f"UZI 价值派定调：{uzi_e['tone']}（不改变 LCAI 裁决）。")
    return "\n".join(lines) if lines else "暂无估值数据。"


def build_executive(lcai: dict, uzi_e: dict, compare: dict) -> str:
    parts = [
        f"{lcai.get('name', lcai.get('symbol'))}：LCAI 判定「{lcai.get('verdict')}」——{lcai.get('verdict_action', '')}",
    ]
    if lcai.get("hard_failures"):
        parts.append(f"硬指标 Fail：{'、'.join(lcai['hard_failures'])}。")
    if lcai.get("vetoes_triggered"):
        parts.append(f"否决项：{'、'.join(lcai['vetoes_triggered'])}。")
    if uzi_e.get("ready") and uzi_e.get("tone"):
        parts.append(f"UZI 价值派（A,E）参考：{uzi_e['tone']}（共识 {uzi_e.get('consensus', '—')}）。")
    if compare.get("divergences"):
        parts.append("分歧：" + "；".join(compare["divergences"]) + "。")
    parts.append("买卖结论以 LCAI 规则为准。")
    return " ".join(parts)


def build_strengths_weaknesses(lcai: dict, uzi_e: dict) -> tuple[list[str], list[str]]:
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

    for s in uzi_e.get("strengths") or []:
        strengths.append(f"UZI: {s}")
    for w in uzi_e.get("weaknesses") or []:
        weaknesses.append(f"UZI: {w}")
    for r in uzi_e.get("risk_flags") or []:
        weaknesses.append(f"UZI: 风险 {r}")

    return strengths[:10], weaknesses[:10]


def build_unified_report(
    lcai: dict,
    uzi_raw: dict | None,
    compare: dict,
    symbol: str,
) -> dict:
    from build_lcai_detail import build_lcai_detail  # noqa: WPS433

    uzi_e = parse_uzi_enrichment(uzi_raw)
    rating = lcai.get("rating") or compare.get("lcai_rating")
    verdict = lcai.get("verdict") or compare.get("lcai_verdict")
    action = lcai.get("verdict_action") or compare.get("lcai_verdict_action")
    detail = lcai.get("analysis") or build_lcai_detail(lcai)

    layers = []
    for layer, title_suffix in LAYER_META.items():
        lcai_sum = lcai_layer_summary(layer, lcai)
        uzi_ins = uzi_layer_insight(layer, uzi_e)
        layers.append({
            "layer": layer,
            "title": f"{layer} {title_suffix}",
            "lcai_status": lcai_layer_status(layer, lcai),
            "lcai_summary": lcai_sum,
            "uzi_insight": uzi_ins,
            "merged_summary": merge_layer_summary(lcai_sum, uzi_ins),
        })

    strengths, weaknesses = build_strengths_weaknesses(lcai, uzi_e)
    valuation = {
        "lcai_fair_value": lcai.get("fair_value") or compare.get("lcai_fair_value"),
        "lcai_margin_pct": lcai.get("margin_of_safety_pct") or compare.get("lcai_margin_pct"),
        "dcf_fair_value": lcai.get("dcf_fair_value") or compare.get("dcf_fair_value"),
        "dcf_margin_pct": lcai.get("dcf_margin_of_safety_pct") or compare.get("dcf_margin_pct"),
        "uzi_dcf_fair_value": uzi_e.get("dcf_fair_value"),
        "uzi_dcf_margin_pct": uzi_e.get("dcf_margin_pct"),
        "narrative": build_valuation_narrative(lcai, uzi_e, compare),
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
        "executive": build_executive(lcai, uzi_e, compare),
        "summary_detailed": detail.get("summary_detailed") or build_executive(lcai, uzi_e, compare),
        "key_metrics": detail.get("key_metrics") or [],
        "decision_path": detail.get("decision_path") or [],
        "rule_highlights": detail.get("rule_highlights") or [],
        "valuation": valuation,
        "layers": layers,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "divergences": compare.get("divergences") or [],
        "depth": {
            "lcai_ready": True,
            "uzi_ready": uzi_e.get("ready", False),
            "full_ready": bool(uzi_e.get("ready")),
            "ready": True,
            "schedule": "weekly_monday",
        },
        "uzi": {
            "tone": uzi_e.get("tone"),
            "consensus": uzi_e.get("consensus"),
            "report_url": compare.get("report_url") or f"reports/{symbol}/index.html",
            "ready": uzi_e.get("ready", False),
        },
        "generated_at": compare.get("generated_at")
        or datetime.now(BJ).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "disclaimer": "买卖结论以 LCAI 规则为准；UZI 价值派材料已并入解读，不覆盖裁决。",
    }


def write_unified_report(symbol: str, unified: dict, out_dir: Path | None = None) -> Path:
    root = out_dir or Path(__file__).resolve().parents[1] / "reports" / symbol
    root.mkdir(parents=True, exist_ok=True)
    path = root / "unified.json"
    path.write_text(json.dumps(unified, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
