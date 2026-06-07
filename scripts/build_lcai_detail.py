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


def load_criteria() -> dict:
    path = ROOT / "投资系统" / "criteria.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _sector(lcai: dict) -> dict:
    return lcai.get("sector") or {}


def _is_hk(lcai: dict) -> bool:
    sym = str(lcai.get("symbol") or "")
    return len(sym) == 5


def _infer_flags(lcai: dict) -> dict:
    vetoes = set(lcai.get("vetoes_triggered") or [])
    return {
        "fraud_suspect": lcai.get("fraud_suspect", "L0-05" in vetoes),
        "ocf_veto": lcai.get("ocf_veto", "L2-04" in vetoes),
        "pe_extreme": lcai.get("pe_extreme", "L3-05" in vetoes),
        "profit_collapse": lcai.get("profit_collapse", "L1-06" in vetoes),
        "trap_suspect": lcai.get("trap_suspect", "L0-06" in vetoes),
    }


def _moat_score(lcai: dict) -> int:
    score = 0
    if (lcai.get("roe_avg") or 0) >= 15:
        score += 35
    if (lcai.get("gross_margin") or 0) >= 30:
        score += 35
    if (lcai.get("profit_yoy") or 0) >= 0:
        score += 15
    if (lcai.get("ocf_ratio") or 0) >= 0.8:
        score += 15
    return score


def _sector_fit_score(lcai: dict) -> int:
    sector = _sector(lcai)
    pe_cap = sector.get("peCap", 40)
    score = 50
    pe = lcai.get("pe")
    mos = lcai.get("margin_of_safety_pct")
    if pe is not None and pe <= pe_cap:
        score += 25
    if mos is not None and mos > 0:
        score += 25
    return score


def _evaluate_rule(rule: dict, lcai: dict) -> dict[str, Any]:
    flags = _infer_flags(lcai)
    sector = _sector(lcai)
    sector_key = sector.get("key", "default")
    pe_cap = sector.get("peCap", 40)
    fair_pe = sector.get("fairPe", 20)
    rid = rule["id"]
    ev = rule.get("eval")
    th = rule.get("threshold")

    out: dict[str, Any] = {"pass": True, "actual": "—", "threshold": str(th if th is not None else "—"), "missing": False, "veto": False}

    def _set(ok: bool, **kw: Any) -> None:
        out["pass"] = ok
        out.update(kw)

    if ev == "circle_of_competence":
        _set(True, actual="网页勾选确认", threshold="懂生意", note="manual")
    elif ev == "not_st":
        ok = not lcai.get("is_st")
        _set(ok, actual=lcai.get("name") or "—", threshold="非ST")
    elif ev == "min_avg_amount":
        amount = lcai.get("amount") or 0
        th_amt = rule.get("threshold_hk", 20_000_000) if _is_hk(lcai) else (th or 50_000_000)
        ok = amount >= th_amt
        _set(ok, actual=f"{amount / 1e8:.2f}亿", threshold=f"≥{th_amt / 1e8:.2f}亿")
    elif ev == "revenue_growth":
        v = lcai.get("revenue_yoy")
        if v is None:
            _set(True, missing=True, threshold=f"≥{th}%")
        else:
            ok = v >= (th or 0)
            _set(ok, actual=f"{_fmt(v)}%", threshold=f"≥{th}%")
    elif ev == "fraud_suspect":
        ok = not flags["fraud_suspect"]
        _set(ok, actual="现金流与利润严重背离" if flags["fraud_suspect"] else "未发现", threshold="无嫌疑", veto=not ok)
    elif ev == "trap_scan":
        flags_list = lcai.get("trap_flags") or []
        ok = not flags["trap_suspect"]
        _set(ok, actual="、".join(flags_list) if flags_list else "无", threshold="异常特征≤1", veto=not ok)
    elif ev == "min_roe_avg":
        v = lcai.get("roe_avg")
        if v is None:
            _set(False, missing=True, threshold=f"≥{th}%")
        else:
            ok = v >= (th or 15)
            _set(ok, actual=f"{_fmt(v)}%", threshold=f"≥{th}%")
    elif ev == "min_profit_years":
        py = lcai.get("profit_years") or 0
        ok = py >= (th or 4)
        _set(ok, actual=f"{py}/5年", threshold=f"≥{th}年")
    elif ev == "gross_margin_score":
        v = lcai.get("gross_margin")
        if v is None:
            _set(True, missing=True, threshold=f"≥{th}%")
        else:
            ok = v >= (th or 20)
            _set(ok, actual=f"{_fmt(v)}%", threshold=f"≥{th}%")
    elif ev == "moat_proxy":
        score = _moat_score(lcai)
        ok = score >= (th or 60)
        _set(ok, actual=f"{score}分", threshold=f"≥{th}分")
    elif ev == "profit_yoy":
        v = lcai.get("profit_yoy")
        if v is None:
            _set(True, missing=True, threshold=f"≥{th}%")
        else:
            ok = v >= (th or 0)
            _set(ok, actual=f"{_fmt(v)}%", threshold=f"≥{th}%")
    elif ev == "profit_collapse":
        ok = not flags["profit_collapse"]
        _set(ok, actual="是" if flags["profit_collapse"] else "否", threshold="无连续大幅下滑", veto=not ok)
    elif ev == "ocf_to_profit":
        v = lcai.get("ocf_ratio")
        if v is None:
            _set(False, missing=True, threshold=f"≥{th}")
        else:
            ok = v >= (th or 0.8)
            _set(ok, actual=_fmt(v), threshold=f"≥{th}")
    elif ev == "deduct_eps_ratio":
        _set(True, missing=True, threshold=f"≥{th}", note="proxy")
    elif ev == "profit_trend":
        v = lcai.get("profit_yoy")
        if v is None:
            _set(True, missing=True, threshold="≥0%")
        else:
            ok = v >= 0
            _set(ok, actual=f"{_fmt(v)}%", threshold="≥0%")
    elif ev == "ocf_veto":
        ok = not flags["ocf_veto"]
        _set(ok, actual="是" if flags["ocf_veto"] else "否", threshold="OCF/EPS 3年不过低", veto=not ok)
    elif ev == "margin_of_safety":
        mos = lcai.get("margin_of_safety_pct")
        fv = lcai.get("fair_value")
        if mos is None:
            _set(False, missing=True, threshold="≥25%")
        else:
            ok = mos >= 25
            _set(ok, actual=f"{_pct(mos)} (公允{_fmt(fv)}元)", threshold="≥25%")
    elif ev == "pe_reasonable":
        pe = lcai.get("pe")
        if pe is None or pe <= 0:
            _set(False, missing=True, threshold=f"≤{pe_cap}")
        else:
            ok = pe <= pe_cap
            _set(ok, actual=_fmt(pe), threshold=f"≤{pe_cap}（{sector_key}）")
    elif ev == "pb_reasonable":
        pb = lcai.get("pb")
        cap = 2 if sector_key in ("银行", "金融") else (th or 8)
        if pb is None or pb <= 0:
            _set(True, missing=True, threshold=f"≤{cap}")
        else:
            ok = pb <= cap
            _set(ok, actual=_fmt(pb), threshold=f"≤{cap}")
    elif ev == "peg_score":
        peg = lcai.get("peg")
        if peg is None:
            _set(True, missing=True, threshold=f"≤{th}")
        else:
            ok = peg <= (th or 2)
            _set(ok, actual=_fmt(peg), threshold=f"≤{th}")
    elif ev == "pe_extreme_veto":
        ok = not flags["pe_extreme"]
        pe = lcai.get("pe")
        _set(ok, actual=f"PE={_fmt(pe)}" if flags["pe_extreme"] else "否", threshold="非极端泡沫", veto=not ok)
    elif ev == "dcf_cross_check":
        dcf_mos = lcai.get("dcf_margin_of_safety_pct")
        dcf_fv = lcai.get("dcf_fair_value")
        if dcf_mos is None:
            _set(True, missing=True, threshold="DCF 未高估")
        else:
            ok = dcf_mos >= 0
            _set(ok, actual=f"{_pct(dcf_mos)} (DCF {_fmt(dcf_fv)}元)", threshold="DCF 安全边际≥0%")
    elif ev == "psychology_ok":
        out.update(actual="网页自检", threshold="无 FOMO/翻本", note="manual")
    elif ev == "position_cap":
        rating = lcai.get("rating") or "D"
        max_w = 25 if rating == "A" else 10 if rating == "B" else 0
        out.update(actual=f"建议上限 {max_w}%", threshold=f"≤{th}%")
    elif ev == "sector_fit":
        score = _sector_fit_score(lcai)
        ok = score >= (th or 60)
        _set(ok, actual=f"{lcai.get('industry') or '未知'} ({score}分)", threshold=f"≥{th}分")

    vetoes = set(lcai.get("vetoes_triggered") or [])
    fails = set(lcai.get("hard_failures") or [])
    if rid in vetoes:
        out["pass"] = False
        out["veto"] = True
    elif rid in fails:
        out["pass"] = False

    return out


def _explain_rule(rule: dict, out: dict, lcai: dict) -> str:
    ev = rule.get("eval")
    name = rule.get("name") or rule.get("id")
    passed = out.get("pass", True)
    actual = out.get("actual", "—")
    threshold = out.get("threshold", "—")
    sector = _sector(lcai)
    sector_key = sector.get("key", "default")
    fair_pe = sector.get("fairPe", 20)
    flags = _infer_flags(lcai)

    if ev == "fraud_suspect":
        return (
            "经营现金流与净利润匹配度正常，未发现典型「纸面利润」特征。"
            if passed
            else f"经营现金流/每股收益 OCF/EPS {_fmt(lcai.get('ocf_ratio'))} 长期偏低且仍报盈利——存在利润质量疑点，触发否决（{name}）。"
        )
    if ev == "ocf_veto":
        return (
            "近 3 年经营现金流与每股收益未长期严重背离。"
            if passed
            else f"近 3 年经营现金流持续远低于每股收益（OCF/EPS {_fmt(lcai.get('ocf_ratio'))}），利润兑现能力存疑，触发否决（{name}）。"
        )
    if ev == "pe_extreme_veto":
        py = lcai.get("profit_yoy")
        return (
            "未出现 PE>80 且低增长的极端泡沫组合。"
            if passed
            else f"PE {_fmt(lcai.get('pe'))} 极高"
            + (f"且利润增速 {_fmt(py)}% 不足" if py is not None else "且增速不足")
            + f"，估值泡沫风险大，触发否决（{name}）。"
        )
    if ev == "trap_scan":
        traps = lcai.get("trap_flags") or []
        return (
            "未发现多项异常票特征（trap_scan 启发式）。"
            if passed
            else f"命中异常特征：{'、'.join(traps) or '多项'}——杀猪盘/庄股风险，触发否决（{name}）。"
        )
    if ev == "min_roe_avg":
        return (
            f"近 5 年 ROE 均值 {actual}，资本回报优秀，符合巴菲特式好生意标准。"
            if passed
            else f"近 5 年 ROE 均值 {actual}，低于 15% 门槛。长期 ROE 是商业模式的试金石，当前回报不足。"
        )
    if ev == "ocf_to_profit":
        return (
            f"经营现金流/每股收益均值 {actual}，利润「含金量」高。"
            if passed
            else f"经营现金流/每股收益 {actual} 低于 0.8，利润兑现能力偏弱，需警惕应收与资本开支。"
        )
    if ev == "margin_of_safety":
        price = lcai.get("price")
        fv = lcai.get("fair_value")
        eps = lcai.get("eps")
        mos = lcai.get("margin_of_safety_pct")
        if out.get("missing"):
            return "无法测算安全边际（缺 EPS 或行情），硬指标 Fail。"
        return (
            f"现价 {_fmt(price)} 元 vs 公允 {_fmt(fv)} 元，安全边际 {_pct(mos)}，价格足够便宜。"
            if passed
            else f"现价 {_fmt(price)} 元，公允价值 {_fmt(fv)} 元（{sector_key} 行业公允 PE {fair_pe} × EPS {_fmt(eps, 3)}），"
            f"安全边际 {_pct(mos)}，未达 25%。好公司也需要好价格。"
        )
    if ev == "pe_reasonable":
        return (
            f"PE {actual} 处于 {sector_key} 行业上限 {threshold} 以内，估值可接受。"
            if passed
            else f"PE {actual} 超过 {sector_key} 行业上限 {threshold}，估值偏贵。"
        )
    if ev == "not_st":
        return f"「{lcai.get('name')}」非 ST，通过基础资格筛选。" if passed else "ST 标的波动大、退市风险高，系统直接排除。"
    if ev == "min_avg_amount":
        return (
            f"日均成交额 {actual}，流动性充足，可正常建仓与退出。"
            if passed
            else f"日均成交额 {actual} 低于门槛 {threshold}，买卖冲击大，不适合重仓。"
        )
    if ev == "min_profit_years":
        return (
            f"近 5 年 {actual} 盈利，业绩稳定性好。"
            if passed
            else f"近 5 年仅 {actual} 盈利，波动过大，不符合「稳定复利机器」画像。"
        )
    if ev == "profit_collapse":
        return (
            "未出现连续大幅利润下滑，经营未显「创新者窘境」式崩塌。"
            if passed
            else "连续多期利润大幅下滑，经营逻辑可能已破坏，触发否决。"
        )
    if ev == "circle_of_competence":
        return "能力圈需在网页勾选确认——不懂不碰（段永平 / 穷查理宝典）。"
    if ev == "psychology_ok":
        return "心理纪律需在网页自检——情绪化交易是最大敌人（金钱心理学）。"
    if ev == "position_cap":
        return f"按 {lcai.get('rating') or '—'} 评级，单票建议上限 {actual}。"
    if out.get("veto"):
        return f"触发否决「{name}」：实际 {actual}，要求 {threshold}。"
    if passed:
        return f"{name}达标（{actual} / {threshold}）。"
    if out.get("missing"):
        return f"{name}：缺少数据，暂无法评估（阈值 {threshold}）。"
    return f"{name}未达标：实际 {actual}，要求 {threshold}。"


def build_rule_details(lcai: dict, criteria: dict | None = None) -> list[dict]:
    criteria = criteria or load_criteria()
    rows = []
    for rule in criteria.get("rules", []):
        out = _evaluate_rule(rule, lcai)
        passed = out.get("pass", True)
        result = "veto" if out.get("veto") else ("pass" if passed else "fail")
        rows.append({
            "id": rule["id"],
            "layer": rule.get("layer"),
            "type": rule.get("type"),
            "name": rule.get("name"),
            "sources": rule.get("sources") or [],
            "weight": rule.get("weight") or 5,
            "pass": passed,
            "actual": out.get("actual", "—"),
            "threshold": out.get("threshold", "—"),
            "score": 5 if passed else 0,
            "veto": bool(out.get("veto")),
            "missing": bool(out.get("missing")),
            "note": out.get("note") or rule.get("auto"),
            "result": result,
            "reason": _explain_rule(rule, out, lcai),
        })
    return rows


def build_divergence_notes(lcai: dict) -> list[dict]:
    notes: list[dict] = []
    details = {r["id"]: r for r in build_rule_details(lcai)}

    for rid in lcai.get("vetoes_triggered") or []:
        row = details.get(rid, {})
        notes.append({
            "kind": "veto",
            "rule_id": rid,
            "title": f"{rid} {RULE_NAMES.get(rid, row.get('name', rid))}（否决）",
            "summary": row.get("reason") or f"触发 LCAI 否决项 {rid}。",
            "actual": row.get("actual"),
            "threshold": row.get("threshold"),
        })

    for rid in lcai.get("hard_failures") or []:
        if rid in (lcai.get("vetoes_triggered") or []):
            continue
        row = details.get(rid, {})
        notes.append({
            "kind": "hard_fail",
            "rule_id": rid,
            "title": f"{rid} {RULE_NAMES.get(rid, row.get('name', rid))}（硬指标 Fail）",
            "summary": row.get("reason") or f"硬指标 {rid} 未达标。",
            "actual": row.get("actual"),
            "threshold": row.get("threshold"),
        })

    traps = lcai.get("trap_flags") or []
    if traps and "L0-06" not in (lcai.get("vetoes_triggered") or []):
        notes.append({
            "kind": "warning",
            "rule_id": "L0-06",
            "title": "异常票特征提示",
            "summary": f"命中特征：{'、'.join(traps)}。若叠加其他否决项，风险更高。",
            "actual": "、".join(traps),
            "threshold": "异常特征≤1",
        })

    return notes


def _rule_label(rule_id: str) -> str:
    return f"{rule_id} {RULE_NAMES.get(rule_id, rule_id)}"


def build_decision_path(lcai: dict) -> list[dict]:
    vetoes = lcai.get("vetoes_triggered") or []
    hard = lcai.get("hard_failures") or []
    verdict = lcai.get("verdict") or "—"
    action = lcai.get("verdict_action") or ""
    score = lcai.get("overall_score")
    rating = lcai.get("rating")
    mos = lcai.get("margin_of_safety_pct")

    v_ok = verdict not in ("排除", "卖出")
    veto_names = "、".join(_rule_label(v) for v in vetoes) or "无"
    hard_names = "、".join(_rule_label(h) for h in hard) or "无"
    return [
        {
            "step": 1,
            "title": "L0 门禁",
            "ok": not vetoes and "L0-02" not in hard,
            "detail": f"否决项：{veto_names}。" if vetoes else "非 ST、流动性达标、无造假嫌疑，可进入生意/财务/估值分析。",
        },
        {
            "step": 2,
            "title": "L1–L3 硬指标",
            "ok": not hard,
            "detail": f"未过硬指标：{hard_names}。" if hard else "ROE、盈利年数、OCF、安全边际、PE 等硬门槛全部 Pass。",
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


def is_data_valid(lcai: dict) -> tuple[bool, str]:
    if lcai.get("error"):
        err = str(lcai["error"])
        if "未获取" in err or "财务" in err:
            return False, "财务数据拉取失败，请 Run workflow 刷新缓存"
        return False, f"数据拉取失败：{err}"
    verdict = lcai.get("verdict")
    if not verdict or verdict in ("—", "None", None):
        return False, "缺少 LCAI 裁决（verdict）"
    if lcai.get("price") is None and lcai.get("roe_avg") is None:
        return False, "缺少行情与财务核心字段"
    return True, ""


def build_final_conclusion(lcai: dict, *, in_portfolio: bool = False) -> dict[str, Any]:
    ok, fail_reason = is_data_valid(lcai)
    if not ok:
        return {
            "verdict": "数据不足",
            "action": fail_reason,
            "headline": f"暂无法给出买卖结论 — {fail_reason}",
            "reasons": [fail_reason],
            "actions": [
                "点上方「立即更新全部报告」→ GitHub Actions Run workflow",
                "港股若持续失败，需检查 East Money 财务接口",
            ],
            "data_ok": False,
            "in_portfolio": in_portfolio,
        }

    verdict = lcai.get("verdict") or "—"
    action = lcai.get("verdict_action") or ""
    notes = build_divergence_notes(lcai)
    reasons: list[str] = []
    for n in notes:
        if n.get("kind") in ("veto", "hard_fail", "warning", "divergence"):
            text = (n.get("summary") or "").strip()
            if text and text not in reasons:
                reasons.append(text)
        if len(reasons) >= 3:
            break

    if not reasons:
        if verdict == "买入":
            reasons.append("生意、财务、估值硬指标均过，总分与安全边际达 LCAI 建仓线（25%）。")
        elif verdict == "观察":
            mos = lcai.get("margin_of_safety_pct")
            if mos is not None and mos < 25:
                reasons.append(f"价格未够便宜：安全边际 {_pct(mos)}，未达 25% 建仓线。")
            else:
                reasons.append(action or "部分硬指标未达标，宜继续观察。")
        elif verdict in ("排除", "卖出"):
            reasons.append(action or "触发 LCAI 否决或硬门槛，不符合价值建仓标准。")
        else:
            reasons.append(action or "请结合下方规则明细。")

    actions: list[str] = []
    if in_portfolio:
        if verdict in ("排除", "卖出"):
            actions.append("已持仓：逻辑证伪或触发否决，建议制定退出计划，不因熟悉公司而豁免规则。")
        elif verdict == "减仓":
            actions.append("已持仓：估值偏高或边际转弱，建议降低敞口，暂不追加。")
        elif verdict == "持有":
            actions.append("已持仓：逻辑未破，可继续持有；未达加仓线则不追加。")
        elif verdict == "观察":
            actions.append("已持仓：未达加仓线，维持观察；可等更好价格或下一季财报验证。")
        elif verdict == "买入":
            actions.append("已持仓：达建仓线，可继续持有或小幅加仓，严守单票上限。")
    else:
        if verdict in ("排除", "卖出"):
            actions.append("未持仓：不新建仓，不必因「听说过」而破例。")
        elif verdict == "买入":
            actions.append("未持仓：达 LCAI 建仓线，可分批买入，严守单票上限。")
        elif verdict == "观察":
            actions.append("未持仓：可放入观察池，等安全边际≥25% 或硬指标改善后再评估。")
        else:
            actions.append(f"未持仓：{action or '按 LCAI 规则执行'}")

    port = "已持仓" if in_portfolio else "未持仓"
    headline = f"【{port}】{verdict} — {action}"

    return {
        "verdict": verdict,
        "action": action,
        "headline": headline,
        "reasons": reasons[:3],
        "actions": actions,
        "data_ok": True,
        "in_portfolio": in_portfolio,
    }


def build_executive_brief(lcai: dict, final: dict[str, Any]) -> str:
    name = lcai.get("name") or lcai.get("symbol") or "—"
    if not final.get("data_ok"):
        return f"{name}：{final.get('headline', '数据不足，无法研判。')}"
    reasons = final.get("reasons") or []
    core = reasons[0] if reasons else (final.get("action") or "")
    if len(reasons) > 1:
        core = f"{reasons[0]}；{reasons[1]}"
    return f"{name}：{final.get('headline')} 核心：{core}"


def build_summary_detailed(lcai: dict) -> str:
    ok, fail_reason = is_data_valid(lcai)
    name = lcai.get("name") or lcai.get("symbol") or "—"
    symbol = lcai.get("symbol") or "—"
    if not ok:
        return "\n".join([
            f"【一句话结论】{name}（{symbol}）— 数据不足，无法给出 LCAI 买卖结论。",
            "",
            f"【原因】{fail_reason}",
            "",
            "【你可以怎么做】",
            "· 在 GitHub Actions 运行 lcai-reports 刷新缓存",
            "· 港股需确认 East Money 能返回财务数据",
            "· 刷新后重新点「帮我看看」",
        ])
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
        veto_names = "、".join(_rule_label(v) for v in vetoes)
        lines.append(f"触发否决 {len(vetoes)} 项：{veto_names}。原则上不应新建仓。")
    if hard:
        hard_names = "、".join(_rule_label(h) for h in hard)
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
    details = {r["id"]: r for r in build_rule_details(lcai)}
    for rid, name, actual, threshold, ok in checks:
        if rid in vetoes:
            result, pass_ok = "veto", False
        elif rid in fails or not ok:
            result, pass_ok = "fail", False
        else:
            result, pass_ok = "pass", True
        reason = details.get(rid, {}).get("reason") or f"{'达标' if pass_ok else '未达标'}：实际 {actual}，要求 {threshold}"
        notes.append({
            "id": rid,
            "name": name,
            "actual": actual,
            "threshold": threshold,
            "result": result,
            "pass": pass_ok,
            "reason": reason,
        })
    return notes


def build_lcai_detail(lcai: dict, *, in_portfolio: bool = False) -> dict[str, Any]:
    final = build_final_conclusion(lcai, in_portfolio=in_portfolio)
    rule_details = build_rule_details(lcai) if final.get("data_ok") else []
    return {
        "final_conclusion": final,
        "executive_brief": build_executive_brief(lcai, final),
        "summary_detailed": build_summary_detailed(lcai),
        "key_metrics": build_key_metrics(lcai),
        "decision_path": build_decision_path(lcai) if final.get("data_ok") else [],
        "rule_highlights": build_rule_notes(lcai) if final.get("data_ok") else [],
        "rule_details": rule_details,
        "divergence_notes": build_divergence_notes(lcai) if final.get("data_ok") else [],
        "data_ok": final.get("data_ok", False),
    }


if __name__ == "__main__":
    import sys

    sym = sys.argv[1] if len(sys.argv) > 1 else "002851"
    lcai_path = ROOT / "reports" / sym / "lcai.json"
    data = json.loads(lcai_path.read_text(encoding="utf-8"))
    print(json.dumps(build_lcai_detail(data), ensure_ascii=False, indent=2))
