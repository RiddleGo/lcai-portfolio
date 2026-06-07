#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""输出 LCAI 完整研判 JSON（供 CLI / CI）。"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "投资系统" / "engine"))

from data_eastmoney import load_stock  # noqa: E402


def detect_sector(industry: str, cfg: dict) -> dict:
    pe_caps = cfg.get("sector_pe_caps", {})
    fair_pes = cfg.get("fair_pe_by_sector", {})
    rules = [
        ("白酒", ["白酒", "酒"]),
        ("银行", ["银行"]),
        ("金融", ["保险", "证券", "金融"]),
        ("半导体", ["半导体", "芯片"]),
        ("汽车", ["汽车", "汽"]),
        ("医药", ["医药", "生物", "医疗"]),
        ("消费", ["消费", "食品", "零售", "家电"]),
    ]
    for key, kws in rules:
        if any(k in industry for k in kws):
            return {
                "key": key,
                "peCap": pe_caps.get(key, pe_caps.get("default", 40)),
                "fairPe": fair_pes.get(key, fair_pes.get("default", 20)),
            }
    return {"key": "default", "peCap": pe_caps.get("default", 40), "fairPe": fair_pes.get("default", 20)}


def build_metrics(parsed, quote, fin_rows, cfg):
    annual = [r for r in fin_rows if r["isAnnual"]] or fin_rows[:5]
    latest = fin_rows[0]
    la = annual[0] if annual else latest
    roe_list = [r["roe"] for r in annual[:5] if r["roe"] is not None]
    roe_avg = sum(roe_list) / len(roe_list) if roe_list else None
    profit_years = sum(1 for r in annual[:5] if (r["netProfit"] or 0) > 0)
    ocf_ratios = []
    for r in annual[:3]:
        if r["ocfPerShare"] and r["eps"] and r["eps"] > 0:
            ocf_ratios.append(r["ocfPerShare"] / r["eps"])
    ocf_ratio = sum(ocf_ratios) / len(ocf_ratios) if ocf_ratios else None
    sector = detect_sector(la.get("industry", ""), cfg)
    eps = la.get("eps") or latest.get("eps")
    fair_value = mos = None
    if eps and eps > 0 and quote["price"] > 0:
        fair_value = eps * sector["fairPe"]
        mos = (fair_value - quote["price"]) / fair_value
    pe = quote.get("pe")
    if pe is None and eps and eps > 0 and quote["price"] > 0:
        pe = quote["price"] / eps
    pg = latest.get("profitYoy") or latest.get("revenueYoy")
    peg = pe / pg if pe and pg and pg > 0 else None
    profit_yoys = [r.get("profitYoy") for r in fin_rows[:4] if r.get("profitYoy") is not None]
    profit_collapse = len(profit_yoys) >= 3 and all(v < -15 for v in profit_yoys)
    fraud = ocf_ratio is not None and ocf_ratio < 0.3 and (latest.get("netProfit") or 0) > 0
    ocf_veto = len(ocf_ratios) >= 2 and all(v < 0.5 for v in ocf_ratios)
    pe_extreme = pe is not None and pe > 80 and (pg is None or pg < 10)
    trap_flags = []
    if pe and pe > 100 and (pg is None or pg < 5):
        trap_flags.append("极高PE+低增速")
    if quote.get("amount", 0) < 30_000_000 and pe and pe > 60:
        trap_flags.append("低流动性+高估值")
    if pe_extreme:
        trap_flags.append("极端估值")
    g = min(max((pg or 5) / 100, 0.02), 0.15) if pg else 0.05
    wacc = 0.09
    dcf_fv = None
    dcf_mos = None
    if eps and eps > 0 and quote["price"] > 0:
        dcf_fv = eps * (1 + g) / (wacc - 0.025) if wacc > 0.025 else fair_value
        dcf_mos = (dcf_fv - quote["price"]) / dcf_fv if dcf_fv else None
    return {
        "symbol": parsed["display"],
        "name": quote["name"],
        "price": quote["price"],
        "pe": pe,
        "pb": quote.get("pb"),
        "eps": eps,
        "amount": quote.get("amount"),
        "roe_avg": roe_avg,
        "profit_years": profit_years,
        "gross_margin": la.get("grossMargin"),
        "ocf_ratio": ocf_ratio,
        "margin_of_safety": mos,
        "fair_value": fair_value,
        "dcf_fair_value": dcf_fv,
        "dcf_margin_of_safety": dcf_mos,
        "industry": la.get("industry", ""),
        "sector": sector,
        "peg": peg,
        "profit_yoy": latest.get("profitYoy"),
        "revenue_yoy": latest.get("revenueYoy"),
        "profit_collapse": profit_collapse,
        "is_st": "ST" in quote["name"].upper(),
        "fraud_suspect": fraud,
        "ocf_veto": ocf_veto,
        "pe_extreme": pe_extreme,
        "trap_flags": trap_flags,
        "trap_suspect": len(trap_flags) >= 2,
    }


def decide(m, cfg):
    sc = cfg["scoring"]
    hard_fails = []
    vetoes = []
    if m["is_st"]:
        hard_fails.append("L0-02")
    if m["fraud_suspect"]:
        vetoes.append("L0-05")
    if m["trap_suspect"]:
        vetoes.append("L0-06")
    if m["ocf_veto"]:
        vetoes.append("L2-04")
    if m["pe_extreme"]:
        vetoes.append("L3-05")
    if m["profit_collapse"]:
        vetoes.append("L1-06")
    if m["roe_avg"] is not None and m["roe_avg"] < 15:
        hard_fails.append("L1-01")
    if m["profit_years"] < 4:
        hard_fails.append("L1-02")
    if m["ocf_ratio"] is not None and m["ocf_ratio"] < 0.8:
        hard_fails.append("L2-01")
    if m["margin_of_safety"] is not None and m["margin_of_safety"] < 0.25:
        hard_fails.append("L3-01")
    if m["pe"] is not None and m["pe"] > m["sector"]["peCap"]:
        hard_fails.append("L3-02")

    if vetoes or m["is_st"]:
        verdict, action = "排除", "不建议投资"
    elif hard_fails:
        verdict, action = "观察", f"硬指标未过：{'、'.join(hard_fails)}"
    elif m["margin_of_safety"] and m["margin_of_safety"] >= 0.25:
        verdict, action = "买入", "达建仓线，可分批买入"
    else:
        verdict, action = "观察", "未达建仓线"

    overall = 72 if verdict == "买入" else 58 if verdict == "观察" else 35
    rating = "A" if overall >= 80 else "B" if overall >= 72 else "C" if overall >= 60 else "D"
    return {
        "verdict": verdict,
        "verdict_action": action,
        "overall_score": overall,
        "rating": rating,
        "hard_failures": hard_fails,
        "vetoes_triggered": vetoes,
    }


def main():
    if len(sys.argv) < 2:
        print("用法: python lcai_screen_json.py 600519", file=sys.stderr)
        sys.exit(1)
    cfg = json.loads((ROOT / "投资系统" / "criteria.json").read_text(encoding="utf-8"))
    data = load_stock(sys.argv[1])
    m = build_metrics(data["parsed"], data["quote"], data["finRows"], cfg)
    d = decide(m, cfg)
    report = {
        "source": "lcai",
        "symbol": m["symbol"],
        "name": m["name"],
        "price": round(m["price"], 2),
        "pe": round(m["pe"], 2) if m["pe"] else None,
        "pb": round(m["pb"], 2) if m.get("pb") else None,
        "eps": round(m["eps"], 3) if m.get("eps") else None,
        "amount": m.get("amount"),
        "roe_avg": round(m["roe_avg"], 2) if m["roe_avg"] else None,
        "profit_years": m["profit_years"],
        "gross_margin": round(m["gross_margin"], 2) if m.get("gross_margin") else None,
        "ocf_ratio": round(m["ocf_ratio"], 2) if m["ocf_ratio"] else None,
        "profit_yoy": round(m["profit_yoy"], 2) if m.get("profit_yoy") else None,
        "revenue_yoy": round(m["revenue_yoy"], 2) if m.get("revenue_yoy") else None,
        "peg": round(m["peg"], 2) if m.get("peg") else None,
        "industry": m["industry"],
        "sector": m["sector"],
        "is_st": m["is_st"],
        "trap_suspect": m["trap_suspect"],
        "margin_of_safety_pct": round(m["margin_of_safety"] * 100, 1) if m["margin_of_safety"] is not None else None,
        "fair_value": round(m["fair_value"], 2) if m["fair_value"] else None,
        "dcf_fair_value": round(m["dcf_fair_value"], 2) if m["dcf_fair_value"] else None,
        "dcf_margin_of_safety_pct": round(m["dcf_margin_of_safety"] * 100, 1) if m["dcf_margin_of_safety"] is not None else None,
        "trap_flags": m["trap_flags"],
        **d,
    }
    sys.path.insert(0, str(ROOT / "scripts"))
    from build_lcai_detail import build_lcai_detail  # noqa: WPS433

    report["analysis"] = build_lcai_detail(report)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
