#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 lcai.json 字段生成详细总结、指标参数、判定逻辑链（供 unified / 网页缓存）。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

LAYER_META = {
    "L0": ("门禁", "ST/流动性/造假/异常票"),
    "L1": ("生意", "ROE/盈利稳定性/护城河"),
    "L2": ("财务", "现金流质量/扣非/趋势"),
    "L3": ("估值", "安全边际/PE/PB/PEG/DCF"),
    "L4": ("执行", "能力圈/心理/仓位"),
    "L5": ("行业", "行业适配与周期"),
}

RULE_NAMES = {
    "L0-01": "能力圈", "L0-02": "非ST", "L0-03": "流动性", "L0-04": "营收增长",
    "L0-05": "财务造假嫌疑", "L0-06": "异常票特征",
    "L1-01": "ROE均值", "L1-02": "盈利稳定性", "L1-03": "毛利率", "L1-04": "护城河代理",
    "L1-05": "利润增长", "L1-06": "利润崩塌",
    "L2-01": "现金流质量", "L2-02": "扣非质量", "L2-03": "盈利趋势", "L2-04": "现金流长期背离",
    "L3-01": "安全边际", "L3-02": "PE合理", "L3-03": "PB合理", "L3-04": "PEG",
    "L3-05": "极端高估值", "L3-06": "DCF交叉验证",
    "L4-01": "心理纪律", "L4-02": "仓位建议", "L5-01": "行业适配",
}


def _fmt(v, digits=2):
    if v is None:
        return "—"
    try:
        return f"{float(v):.{digits}f}"
    except (TypeError, ValueError):
        return str(v)


def _pct(v):
    if v is None:
        return "—"
    return f"{float(v):.1f}%"


def _status(pass_ok: bool | None) -> str:
    if pass_ok is True:
        return "ok"
    if pass_ok is False:
        return "fail"
    return "neutral"


def build_key_metrics(lcai: dict) -> list[dict]:
    sector = lcai.get("sector") or {}
    pe_cap = sector.get("peCap", 40)
    fair_pe = sector.get("fairPe", 20)
    pe = lcai.get("pe")
    roe = lcai.get("roe_avg")
    ocf = lcai.get("ocf_ratio")
    mos = lcai.get("margin_of_safety_pct")
    peg = lcai.get("peg")
    pb = lcai.get("pb")
    gm = lcai.get("gross_margin")
    py = lcai.get("profit_yoy")

    return [
        {"label": "现价", "value": f"{_fmt(lcai.get('price'))} 元", "threshold": "—", "status": "neutral", "note": "行情或缓存价"},
        {"label": "PE", "value": _fmt(pe), "threshold": f"≤{pe_cap}", "status": _status(pe is not None and pe <= pe_cap), "note": f"行业上限 {pe_cap}"},
        {"label": "PB", "value": _fmt(pb), "threshold": "≤8", "status": _status(pb is None or pb <= 8), "note": "资产定价"},
        {"label": "PEG", "value": _fmt(peg), "threshold": "≤2", "status": _status(peg is None or peg <= 2), "note": "彼得·林奇"},
        {"label": "ROE 均值", "value": f"{_fmt(roe)}%", "threshold": "≥15%", "status": _status(roe is not None and roe >= 15), "note": "5年加权"},
        {"label": "盈利年数", "value": str(lcai.get("profit_years") or "—"), "threshold": "≥4年", "status": _status((lcai.get("profit_years") or 0) >= 4), "note": "近5年"},
        {"label": "毛利率", "value": f"{_fmt(gm)}%", "threshold": "≥20%", "status": _status(gm is None or gm >= 20), "note": "最新年报"},
        {"label": "利润 YoY", "value": f"{_fmt(py)}%", "threshold": "≥0%", "status": _status(py is None or py >= 0), "note": "最新期"},
        {"label": "OCF/EPS", "value": _fmt(ocf), "threshold": "≥0.8", "status": _status(ocf is not None and ocf >= 0.8), "note": "现金流质量"},
        {"label": "公允 PE", "value": str(fair_pe), "threshold": "—", "status": "neutral", "note": sector.get("key", "default")},
        {"label": "公允价", "value": f"{_fmt(lcai.get('fair_value'))} 元", "threshold": "—", "status": "neutral", "note": f"EPS×{fair_pe}"},
        {"label": "安全边际", "value": _pct(mos), "threshold": "≥25%", "status": _status(mos is not None and mos >= 25), "note": "=(公允−现价)/公允"},
        {"label": "DCF 公允", "value": f"{_fmt(lcai.get('dcf_fair_value'))} 元", "threshold": "—", "status": "neutral", "note": "简化两阶段"},
        {"label": "DCF 边际", "value": _pct(lcai.get("dcf_margin_of_safety_pct")), "threshold": "≥25%", "status": _status((lcai.get("dcf_margin_of_safety_pct") or -999) >= 25), "note": "与 L3-01 交叉"},
        {"label": "EPS", "value": _fmt(lcai.get("eps"), 3), "threshold": ">0", "status": _status((lcai.get("eps") or 0) > 0), "note": "估值基础"},
        {"label": "成交额", "value": f"{_fmt((lcai.get('amount') or 0) / 1e8)} 亿", "threshold": "A股≥0.5亿", "status": "neutral", "note": "流动性 L0-03"},
    ]


def build_decision_path(lcai: dict) -> list[dict]:
    vetoes = lcai.get("vetoes_triggered") or []
    hard = lcai.get("hard_failures") or []
    verdict = lcai.get("verdict") or "—"
    action = lcai.get("verdict_action") or ""
    score = lcai.get("overall_score")
    rating = lcai.get("rating")
    mos = lcai.get("margin_of_safety_pct")

    v_ok = verdict not in ("排除", "卖出")
    return [
        {
            "step": 1,
            "title": "L0 门禁",
            "ok": not vetoes and "L0-02" not in hard,
            "detail": f"否决：{'、'.join(vetoes) or '无'}；ST/流动性等见规则表。",
        },
        {
            "step": 2,
            "title": "L1–L3 硬指标",
            "ok": not hard,
            "detail": hard and f"未过：{'、'.join(hard)}" or "ROE、盈利年数、OCF、安全边际、PE 等硬门槛全部 Pass。",
        },
        {
            "step": 3,
            "title": "综合评分",
            "ok": (score or 0) >= 72,
            "detail": f"总分 {score}，评级 {rating}（A≥80 / B≥72 / C≥60 / D<60）。建仓线 72。",
        },
        {
            "step": 4,
            "title": "安全边际",
            "ok": mos is not None and mos >= 25,
            "detail": f"安全边际 {_pct(mos)}，建仓要求 ≥25%。",
        },
        {
            "step": 5,
            "title": "仓位上限",
            "ok": v_ok,
            "detail": f"按评级 {rating}：A→25% / B→10% / 其他→0%。",
        },
        {
            "step": 6,
            "title": "最终判定",
            "ok": v_ok,
            "detail": f"{verdict}：{action}",
        },
    ]


def build_summary_detailed(lcai: dict) -> str:
    name = lcai.get("name") or lcai.get("symbol") or "—"
    symbol = lcai.get("symbol") or "—"
    industry = lcai.get("industry") or "未知行业"
    sector = lcai.get("sector") or {}
    verdict = lcai.get("verdict") or "—"
    action = lcai.get("verdict_action") or ""
    score = lcai.get("overall_score")
    rating = lcai.get("rating")
    vetoes = lcai.get("vetoes_triggered") or []
    hard = lcai.get("hard_failures") or []
    traps = lcai.get("trap_flags") or []
    mos = lcai.get("margin_of_safety_pct")
    fv = lcai.get("fair_value")
    price = lcai.get("price")
    pe = lcai.get("pe")
    roe = lcai.get("roe_avg")
    ocf = lcai.get("ocf_ratio")
    dcf = lcai.get("dcf_fair_value")
    dcf_mos = lcai.get("dcf_margin_of_safety_pct")

    lines = [
        f"【一句话结论】{name}（{symbol}）— LCAI 判定「{verdict}」：{action}。评级 {rating}，总分 {score}。",
        "",
        "【公司与行业】",
        f"所属行业：{industry}；估值归类：{sector.get('key', 'default')}（公允 PE {sector.get('fairPe', 20)}，PE 上限 {sector.get('peCap', 40)}）。",
        f"现价 {_fmt(price)} 元；PE {_fmt(pe)}；ROE 五年均值 {_fmt(roe)}%；经营现金流/每股收益 OCF/EPS {_fmt(ocf)}。",
        "",
        "【估值测算】",
    ]
    if fv is not None:
        lines.append(
            f"格雷厄姆式公允价 ≈ {_fmt(fv)} 元（EPS×公允 PE），安全边际 {_pct(mos)}（=(公允−现价)/公允，建仓线 25%）。"
        )
    else:
        lines.append("缺少 EPS 或行情，无法完成公允价/安全边际测算。")
    if dcf is not None:
        lines.append(f"简化 DCF 公允 ≈ {_fmt(dcf)} 元，DCF 安全边际 {_pct(dcf_mos)}，与 PE×EPS 方向交叉验证。")

    lines.extend(["", "【规则结论】"])
    if vetoes:
        veto_names = "、".join(RULE_NAMES.get(v, v) for v in vetoes)
        lines.append(f"触发否决 {len(vetoes)} 项：{veto_names}。原则上不应新建仓。")
    if hard:
        hard_names = "、".join(f"{h} {RULE_NAMES.get(h, h)}" for h in hard)
        lines.append(f"硬指标 Fail {len(hard)} 项：{hard_names}。")
    if traps:
        lines.append(f"异常票特征：{'、'.join(traps)}。")
    if not vetoes and not hard:
        lines.append("无否决；L1–L3 硬指标全部通过。")

    lines.extend(["", "【分层要点】"])
    for layer, (title, desc) in LAYER_META.items():
        st = "通过"
        if layer == "L0" and (vetoes or lcai.get("is_st")):
            st = "未通过"
        elif any(h.startswith(layer) for h in hard):
            st = "有缺口"
        lines.append(f"{layer} {title}（{desc}）：{st}。")

    lines.extend(["", "【操作建议】", f"买卖结论以 LCAI 宪法为准：{verdict} — {action}。"])
    max_w = "25%" if rating == "A" else "10%" if rating == "B" else "0%"
    lines.append(f"单票建议上限 {max_w}；未达建仓线时不追涨，等待更好价格或下一季财报验证。")

    return "\n".join(lines)


def build_rule_notes(lcai: dict) -> list[dict]:
    vetoes = set(lcai.get("vetoes_triggered") or [])
    fails = set(lcai.get("hard_failures") or [])
    sector = lcai.get("sector") or {}
    notes = []
    checks = [
        ("L1-01", "ROE均值", f"{_fmt(lcai.get('roe_avg'))}%", "≥15%", (lcai.get("roe_avg") or 0) >= 15),
        ("L2-01", "现金流质量", _fmt(lcai.get("ocf_ratio")), "≥0.8", (lcai.get("ocf_ratio") or 0) >= 0.8),
        ("L3-01", "安全边际", _pct(lcai.get("margin_of_safety_pct")), "≥25%", (lcai.get("margin_of_safety_pct") or -999) >= 25),
        ("L3-02", "PE合理", _fmt(lcai.get("pe")), f"≤{sector.get('peCap', 40)}", (lcai.get("pe") or 999) <= sector.get("peCap", 40)),
    ]
    for rid, name, actual, threshold, ok in checks:
        if rid in vetoes:
            result, pass_ok = "veto", False
        elif rid in fails or not ok:
            result, pass_ok = "fail", False
        else:
            result, pass_ok = "pass", True
        notes.append({
            "id": rid,
            "name": name,
            "actual": actual,
            "threshold": threshold,
            "result": result,
            "pass": pass_ok,
            "reason": f"{'达标' if pass_ok else '未达标'}：实际 {actual}，要求 {threshold}",
        })
    return notes


def build_lcai_detail(lcai: dict) -> dict[str, Any]:
    return {
        "summary_detailed": build_summary_detailed(lcai),
        "key_metrics": build_key_metrics(lcai),
        "decision_path": build_decision_path(lcai),
        "rule_highlights": build_rule_notes(lcai),
    }


def load_criteria() -> dict:
    path = ROOT / "投资系统" / "criteria.json"
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    import sys

    sym = sys.argv[1] if len(sys.argv) > 1 else "002851"
    lcai_path = ROOT / "reports" / sym / "lcai.json"
    data = json.loads(lcai_path.read_text(encoding="utf-8"))
    print(json.dumps(build_lcai_detail(data), ensure_ascii=False, indent=2))
