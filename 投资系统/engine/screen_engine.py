# -*- coding: utf-8 -*-
"""LCAI 规则引擎（与 screen-engine.js / screen-data.js 对齐）。"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CRITERIA_PATH = ROOT / "criteria.json"


def load_criteria() -> dict:
    return json.loads(CRITERIA_PATH.read_text(encoding="utf-8"))


def detect_sector(industry: str, cfg: dict) -> dict[str, Any]:
    pe_caps = cfg.get("sector_pe_caps", {})
    fair_pes = cfg.get("fair_pe_by_sector", {})
    rules = [
        ("白酒", ["白酒", "酒"]),
        ("银行", ["银行"]),
        ("金融", ["保险", "证券", "金融"]),
        ("半导体", ["半导体", "芯片", "集成电路"]),
        ("软件", ["软件", "互联网", "计算机"]),
        ("汽车", ["汽车", "新能源车", "汽"]),
        ("医药", ["医药", "生物", "医疗", "保健"]),
        ("消费", ["消费", "食品", "零售", "家电"]),
    ]
    for key, kws in rules:
        if any(k in industry for k in kws):
            return {
                "key": key,
                "peCap": pe_caps.get(key, pe_caps.get("default", 40)),
                "fairPe": fair_pes.get(key, fair_pes.get("default", 20)),
            }
    return {
        "key": "default",
        "peCap": pe_caps.get("default", 40),
        "fairPe": fair_pes.get("default", 20),
    }


def annual_rows(fin_rows: list[dict]) -> list[dict]:
    annual = [r for r in fin_rows if r.get("isAnnual")]
    return annual if annual else fin_rows[:5]


def build_metrics(parsed: dict, quote: dict, fin_rows: list[dict], cfg: dict) -> dict[str, Any]:
    annual = annual_rows(fin_rows)
    latest = fin_rows[0] if fin_rows else {}
    la = annual[0] if annual else latest

    roe_list = [r["roe"] for r in annual[:5] if r.get("roe") is not None]
    roe_avg = sum(roe_list) / len(roe_list) if roe_list else None
    profit_years = sum(1 for r in annual[:5] if (r.get("netProfit") or 0) > 0)

    ocf_ratios = []
    for r in annual[:3]:
        if r.get("ocfPerShare") is not None and r.get("eps") is not None and r["eps"] > 0:
            ocf_ratios.append(r["ocfPerShare"] / r["eps"])
    ocf_ratio = sum(ocf_ratios) / len(ocf_ratios) if ocf_ratios else None

    deduct_ratio = None
    if la.get("deductEps") is not None and la.get("eps") is not None and la["eps"] > 0:
        deduct_ratio = la["deductEps"] / la["eps"]
    elif la.get("deductEps") is None and (la.get("eps") or 0) > 0:
        deduct_ratio = 1.0

    industry = latest.get("industry") or la.get("industry") or ""
    sector = detect_sector(industry, cfg)
    eps = la.get("eps") or latest.get("eps")
    price = quote.get("price") or 0

    fair_value = mos = None
    if eps is not None and eps > 0 and price > 0:
        fair_value = eps * sector["fairPe"]
        mos = (fair_value - price) / fair_value

    profit_yoys = [r.get("profitYoy") for r in fin_rows[:4] if r.get("profitYoy") is not None]
    profit_collapse = len(profit_yoys) >= 3 and all(v < -15 for v in profit_yoys)

    pe = quote.get("pe")
    profit_growth = latest.get("profitYoy") if latest.get("profitYoy") is not None else latest.get("revenueYoy")
    pe_computed = pe if pe is not None else (price / eps if eps and eps > 0 and price > 0 else None)
    peg = pe_computed / profit_growth if pe_computed and profit_growth and profit_growth > 0 else None
    pe_extreme = pe_computed is not None and pe_computed > 80 and (profit_growth is None or profit_growth < 10)

    trap_flags = []
    if pe_computed and pe_computed > 100 and (profit_growth is None or profit_growth < 5):
        trap_flags.append("极高PE+低增速")
    if quote.get("amount", 0) < 30_000_000 and pe_computed and pe_computed > 60:
        trap_flags.append("低流动性+高估值")
    if pe_extreme:
        trap_flags.append("极端估值")

    g = min(max((profit_growth or 5) / 100, 0.02), 0.15)
    wacc = 0.09
    dcf_fv = dcf_mos = None
    if eps and eps > 0 and price > 0 and wacc > 0.025:
        dcf_fv = eps * (1 + g) / (wacc - 0.025)
        dcf_mos = (dcf_fv - price) / dcf_fv

    return {
        "symbol": parsed["display"],
        "secid": parsed["secid"],
        "market": parsed["market"],
        "name": quote.get("name") or parsed["display"],
        "price": price,
        "pe": pe_computed if pe_computed is not None else pe,
        "pb": quote.get("pb"),
        "amount": quote.get("amount") or 0,
        "industry": industry,
        "sectorKey": sector["key"],
        "fairPe": sector["fairPe"],
        "peCap": sector["peCap"],
        "sector": sector,
        "roeAvg": roe_avg,
        "roeList": roe_list,
        "profitYears": profit_years,
        "grossMargin": la.get("grossMargin"),
        "ocfRatio": ocf_ratio,
        "ocfRatios": ocf_ratios,
        "deductRatio": deduct_ratio,
        "revenueYoy": latest.get("revenueYoy"),
        "profitYoy": latest.get("profitYoy"),
        "profitCollapse": profit_collapse,
        "fairValue": fair_value,
        "marginOfSafety": mos,
        "peg": peg,
        "profitGrowth": profit_growth,
        "eps": eps,
        "isSt": "ST" in str(quote.get("name", "")).upper(),
        "fraudSuspect": ocf_ratio is not None and ocf_ratio < 0.3 and (latest.get("netProfit") or 0) > 0,
        "ocfVeto": len(ocf_ratios) >= 2 and all(v < 0.5 for v in ocf_ratios),
        "peExtreme": pe_extreme,
        "trapFlags": trap_flags,
        "trapSuspect": len(trap_flags) >= 2,
        "dcfFairValue": dcf_fv,
        "dcfMarginOfSafety": dcf_mos,
        "dcfGrowth": g,
        "dcfWacc": wacc,
    }


def _pct(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{v * 100:.1f}%"


def _fmt(v: float | None, digits: int = 2) -> str:
    if v is None:
        return "—"
    return f"{v:.{digits}f}"


def evaluate_rule(rule: dict, m: dict, ctx: dict) -> dict[str, Any]:
    ev = rule.get("eval")
    th = rule.get("threshold")
    out: dict[str, Any] = {"pass": True, "actual": "—", "threshold": str(th if th is not None else "—"), "score": 3}

    if ev == "circle_of_competence":
        ok = ctx.get("competence", True) is not False
        out = {"pass": ok, "actual": "已确认懂" if ok else "未确认", "threshold": "懂生意", "score": 5 if ok else 0, "note": "manual"}
    elif ev == "not_st":
        ok = not m["isSt"]
        out = {"pass": ok, "actual": m["name"], "threshold": "非ST", "score": 5 if ok else 0}
    elif ev == "min_avg_amount":
        lim = rule.get("threshold_hk", 20_000_000) if m["market"] == "HK" else rule.get("threshold", 50_000_000)
        ok = m["amount"] >= lim
        out = {"pass": ok, "actual": f"{m['amount'] / 1e8:.2f}亿", "threshold": f"≥{lim / 1e8:.2f}亿", "score": 5 if ok else 0}
    elif ev == "revenue_growth":
        v = m.get("revenueYoy")
        if v is None:
            out = {"pass": True, "actual": "—", "threshold": f"≥{th}%", "score": 3, "missing": True}
        else:
            ok = v >= th
            out = {"pass": ok, "actual": f"{v:.2f}%", "threshold": f"≥{th}%", "score": 5 if ok else max(1, 3 + v / 10)}
    elif ev == "fraud_suspect":
        ok = not m["fraudSuspect"]
        out = {"pass": ok, "actual": "现金流与利润严重背离" if not ok else "未发现", "threshold": "无嫌疑", "veto": not ok}
    elif ev == "min_roe_avg":
        v = m.get("roeAvg")
        if v is None:
            out = {"pass": False, "actual": "—", "threshold": f"≥{th}%", "score": 0, "missing": True}
        else:
            ok = v >= th
            out = {"pass": ok, "actual": f"{v:.2f}%", "threshold": f"≥{th}%", "score": 5 if ok else min(4, v / th * 5)}
    elif ev == "min_profit_years":
        ok = m["profitYears"] >= th
        out = {"pass": ok, "actual": f"{m['profitYears']}/5年", "threshold": f"≥{th}年", "score": 5 if ok else m["profitYears"]}
    elif ev == "gross_margin_score":
        v = m.get("grossMargin")
        if v is None:
            out = {"pass": True, "actual": "—", "threshold": f"≥{th}%", "score": 3, "missing": True}
        else:
            ok = v >= th
            out = {"pass": ok, "actual": f"{v:.2f}%", "threshold": f"≥{th}%", "score": 5 if ok else max(1, v / th * 5)}
    elif ev == "moat_proxy":
        score = 0
        if (m.get("roeAvg") or 0) >= 15:
            score += 35
        if (m.get("grossMargin") or 0) >= 30:
            score += 35
        if (m.get("profitYoy") or 0) >= 0:
            score += 15
        if (m.get("ocfRatio") or 0) >= 0.8:
            score += 15
        ok = score >= th
        out = {"pass": ok, "actual": f"{score}分", "threshold": f"≥{th}分", "score": min(5, score / 20)}
    elif ev == "profit_yoy":
        v = m.get("profitYoy")
        if v is None:
            out = {"pass": True, "actual": "—", "threshold": f"≥{th}%", "score": 3, "missing": True}
        else:
            ok = v >= th
            out = {"pass": ok, "actual": f"{v:.2f}%", "threshold": f"≥{th}%", "score": 5 if ok else max(1, 3 + v / 20)}
    elif ev == "profit_collapse":
        ok = not m["profitCollapse"]
        out = {"pass": ok, "actual": "是" if not ok else "否", "threshold": "无连续大幅下滑", "veto": not ok}
    elif ev == "ocf_to_profit":
        v = m.get("ocfRatio")
        if v is None:
            out = {"pass": False, "actual": "—", "threshold": f"≥{th}", "score": 0, "missing": True}
        else:
            ok = v >= th
            out = {"pass": ok, "actual": f"{v:.2f}", "threshold": f"≥{th}", "score": 5 if ok else min(4, v / th * 5)}
    elif ev == "deduct_eps_ratio":
        v = m.get("deductRatio")
        if v is None:
            out = {"pass": True, "actual": "—", "threshold": f"≥{th}", "score": 3, "missing": True}
        else:
            ok = v >= th
            out = {"pass": ok, "actual": f"{v:.2f}", "threshold": f"≥{th}", "score": 5 if ok else v / th * 5}
    elif ev == "profit_trend":
        v = m.get("profitYoy")
        if v is None:
            out = {"pass": True, "actual": "—", "threshold": "≥0%", "score": 3, "missing": True}
        else:
            ok = v >= th
            out = {"pass": ok, "actual": f"{v:.2f}%", "threshold": f"≥{th}%", "score": 5 if ok else max(1, 3 + v / 15)}
    elif ev == "ocf_veto":
        ok = not m["ocfVeto"]
        out = {"pass": ok, "actual": "是" if not ok else "否", "threshold": "OCF/EPS 3年不过低", "veto": not ok}
    elif ev == "margin_of_safety":
        v = m.get("marginOfSafety")
        if v is None:
            out = {"pass": False, "actual": "—", "threshold": f"≥{_pct(th)}", "score": 0, "missing": True}
        else:
            ok = v >= th
            out = {
                "pass": ok,
                "actual": f"{_pct(v)} (公允{_fmt(m.get('fairValue'))}元)",
                "threshold": f"≥{_pct(th)}",
                "score": 5 if ok else max(0, v / th * 5),
            }
    elif ev == "pe_reasonable":
        cap = m.get("peCap") or th
        v = m.get("pe")
        if v is None or v <= 0:
            out = {"pass": False, "actual": "—", "threshold": f"≤{cap}", "score": 0, "missing": True}
        else:
            ok = v <= cap
            out = {"pass": ok, "actual": _fmt(v), "threshold": f"≤{cap}", "score": 5 if ok else max(1, cap / v * 5)}
    elif ev == "pb_reasonable":
        cap = 2 if m.get("sectorKey") in ("银行", "金融") else th
        v = m.get("pb")
        if v is None or v <= 0:
            out = {"pass": True, "actual": "—", "threshold": f"≤{cap}", "score": 3, "missing": True}
        else:
            ok = v <= cap
            out = {"pass": ok, "actual": _fmt(v), "threshold": f"≤{cap}", "score": 5 if ok else max(1, cap / v * 5)}
    elif ev == "peg_score":
        v = m.get("peg")
        if v is None:
            out = {"pass": True, "actual": "—", "threshold": f"≤{th}", "score": 3, "missing": True}
        else:
            ok = v <= th
            out = {"pass": ok, "actual": _fmt(v), "threshold": f"≤{th}", "score": 5 if ok else max(1, th / v * 3)}
    elif ev == "pe_extreme_veto":
        ok = not m["peExtreme"]
        out = {"pass": ok, "actual": f"PE={_fmt(m.get('pe'))}" if not ok else "否", "threshold": "非极端泡沫", "veto": not ok}
    elif ev == "trap_scan":
        flags = m.get("trapFlags") or []
        ok = not m["trapSuspect"]
        out = {"pass": ok, "actual": "、".join(flags) if flags else "无", "threshold": "异常特征≤1", "veto": not ok}
    elif ev == "dcf_cross_check":
        v = m.get("dcfMarginOfSafety")
        if v is None:
            out = {"pass": True, "actual": "—", "threshold": "DCF 未高估", "score": 3, "missing": True}
        else:
            ok = v >= th
            out = {
                "pass": ok,
                "actual": f"{_pct(v)} (DCF {_fmt(m.get('dcfFairValue'))}元)",
                "threshold": "DCF 安全边际≥0%",
                "score": 5 if ok else max(1, 3 + v * 10),
            }
    elif ev == "psychology_ok":
        ok = ctx.get("psychology", True) is not False
        out = {"pass": ok, "actual": "通过自检" if ok else "未通过", "threshold": "无 FOMO/翻本", "score": 5 if ok else 0, "note": "manual"}
    elif ev == "position_cap":
        out = {"pass": True, "actual": "见评级", "threshold": f"≤{th}%", "score": 5}
    elif ev == "sector_fit":
        score = 50
        if m.get("pe") is not None and m["pe"] <= m.get("peCap", 40):
            score += 25
        if m.get("marginOfSafety") is not None and m["marginOfSafety"] > 0:
            score += 25
        ok = score >= th
        out = {"pass": ok, "actual": f"{m.get('industry') or '未知'} ({score}分)", "threshold": f"≥{th}分", "score": min(5, score / 20)}

    row = {
        "id": rule["id"],
        "layer": rule["layer"],
        "type": rule["type"],
        "name": rule["name"],
        "sources": rule.get("sources") or [],
        "weight": rule.get("weight") or 5,
        "pass": out.get("pass", True) is not False,
        "actual": out.get("actual", "—"),
        "threshold": out.get("threshold", str(th if th is not None else "—")),
        "score": out.get("score", 5 if out.get("pass", True) else 0),
        "veto": bool(out.get("veto")),
        "missing": bool(out.get("missing")),
        "note": out.get("note") or rule.get("auto"),
        "result": "veto" if out.get("veto") else ("pass" if out.get("pass", True) else "fail"),
    }
    return row


def layer_score(results: list[dict], layer: str) -> int:
    items = [r for r in results if r["layer"] == layer and r["type"] == "soft"]
    if not items:
        return 100
    total_w = sum(r.get("weight") or 5 for r in items)
    got = sum((r.get("score") or 0) / 5 * (r.get("weight") or 5) for r in items)
    return round(got / total_w * 100)


def decide(metrics: dict, results: list[dict], ctx: dict, cfg: dict) -> dict[str, Any]:
    sc = cfg["scoring"]
    vetoes = [r for r in results if r.get("veto")]
    l0hard = [r for r in results if r["layer"] == "L0" and r["type"] == "hard"]
    l123hard = [r for r in results if r["layer"] in ("L1", "L2", "L3") and r["type"] == "hard"]

    layer_scores = {
        "L0": 100 if all(r["pass"] for r in l0hard) else 0,
        "L1": layer_score(results, "L1"),
        "L2": layer_score(results, "L2"),
        "L3": layer_score(results, "L3"),
        "L4": layer_score(results, "L4"),
        "L5": layer_score(results, "L5"),
    }
    w = sc["weights"]
    overall = round(
        layer_scores["L1"] * w["L1"]
        + layer_scores["L2"] * w["L2"]
        + layer_scores["L3"] * w["L3"]
        + layer_scores["L4"] * w["L4"]
        + layer_scores["L5"] * w["L5"]
    )

    rating = "D"
    if overall >= 80:
        rating = "A"
    elif overall >= 72:
        rating = "B"
    elif overall >= 60:
        rating = "C"
    metrics["rating"] = rating

    hard_fail = [r["id"] for r in l123hard if not r["pass"]]
    l3mos = next((r for r in results if r["id"] == "L3-01"), None)
    in_portfolio = bool(ctx.get("in_portfolio"))

    verdict = "观察"
    verdict_action = "加入观察池，等待更好价格或财报验证"

    if vetoes or any(not r["pass"] for r in l0hard):
        verdict = "排除"
        verdict_action = "不建议投资；若已持仓，计划退出"
    elif hard_fail:
        verdict = "观察"
        verdict_action = f"硬指标未过：{'、'.join(hard_fail)}"
    elif overall >= sc["overall_buy"] and l3mos and l3mos["pass"]:
        if in_portfolio:
            verdict = "持有"
            verdict_action = "逻辑成立，可继续持有或小幅加仓"
        else:
            verdict = "买入"
            verdict_action = "达建仓线，可分批买入"
    elif in_portfolio:
        if layer_scores["L3"] < 50 or metrics.get("peExtreme"):
            verdict = "减仓"
            verdict_action = "估值偏高或边际不足，建议减仓"
        elif hard_fail:
            verdict = "卖出"
            verdict_action = "逻辑证伪，建议清仓"
        else:
            verdict = "持有"
            verdict_action = "未达加仓线，维持持有"

    max_weight = "25%" if rating == "A" else "10%" if rating == "B" else "0%"
    return {
        "verdict": verdict,
        "verdict_action": verdict_action,
        "overall_score": overall,
        "layer_scores": layer_scores,
        "rating": rating,
        "vetoes_triggered": [v["id"] for v in vetoes],
        "hard_failures": hard_fail,
        "position_hint": {
            "suggested_weight": max_weight if verdict == "买入" else "0%",
            "max_weight": max_weight,
            "reason": verdict_action,
        },
    }


def screen(
    raw: str,
    *,
    in_portfolio: bool = False,
    competence: bool = True,
    psychology: bool = True,
) -> dict[str, Any]:
    from data_eastmoney import load_stock  # noqa: WPS433

    cfg = load_criteria()
    data = load_stock(raw)
    metrics = build_metrics(data["parsed"], data["quote"], data["finRows"], cfg)
    ctx = {"in_portfolio": in_portfolio, "competence": competence, "psychology": psychology}
    results = [evaluate_rule(rule, metrics, ctx) for rule in cfg["rules"]]
    decision = decide(metrics, results, ctx, cfg)
    return {"metrics": metrics, "results": results, "decision": decision, "parsed": data["parsed"]}


def to_lcai_report(screen_result: dict) -> dict[str, Any]:
    m = screen_result["metrics"]
    d = screen_result["decision"]
    mos = m.get("marginOfSafety")
    dcf_mos = m.get("dcfMarginOfSafety")
    return {
        "source": "lcai",
        "symbol": m["symbol"],
        "name": m["name"],
        "price": round(m["price"], 2),
        "pe": round(m["pe"], 2) if m.get("pe") else None,
        "pb": round(m["pb"], 2) if m.get("pb") else None,
        "eps": round(m["eps"], 3) if m.get("eps") else None,
        "amount": m.get("amount"),
        "roe_avg": round(m["roeAvg"], 2) if m.get("roeAvg") is not None else None,
        "profit_years": m["profitYears"],
        "gross_margin": round(m["grossMargin"], 2) if m.get("grossMargin") is not None else None,
        "ocf_ratio": round(m["ocfRatio"], 2) if m.get("ocfRatio") is not None else None,
        "profit_yoy": round(m["profitYoy"], 2) if m.get("profitYoy") is not None else None,
        "revenue_yoy": round(m["revenueYoy"], 2) if m.get("revenueYoy") is not None else None,
        "peg": round(m["peg"], 2) if m.get("peg") is not None else None,
        "industry": m.get("industry") or "",
        "sector": m.get("sector") or {},
        "is_st": m["isSt"],
        "trap_suspect": m["trapSuspect"],
        "margin_of_safety_pct": round(mos * 100, 1) if mos is not None else None,
        "fair_value": round(m["fairValue"], 2) if m.get("fairValue") else None,
        "dcf_fair_value": round(m["dcfFairValue"], 2) if m.get("dcfFairValue") else None,
        "dcf_margin_of_safety_pct": round(dcf_mos * 100, 1) if dcf_mos is not None else None,
        "trap_flags": m.get("trapFlags") or [],
        "layer_scores": d.get("layer_scores"),
        "position_hint": d.get("position_hint"),
        "in_portfolio": screen_result.get("in_portfolio"),
        **{k: d[k] for k in ("verdict", "verdict_action", "overall_score", "rating", "vetoes_triggered", "hard_failures")},
    }
