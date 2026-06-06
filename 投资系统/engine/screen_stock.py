#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CLI: python screen_stock.py 600519"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from data_eastmoney import load_stock, num  # noqa: E402


def detect_sector(industry: str, cfg: dict) -> dict:
    pe_caps = cfg.get("sector_pe_caps", {})
    fair_pes = cfg.get("fair_pe_by_sector", {})
    rules = [
        ("白酒", ["白酒", "酒"]),
        ("银行", ["银行"]),
        ("半导体", ["半导体", "芯片"]),
        ("汽车", ["汽车", "汽"]),
        ("医药", ["医药", "生物", "医疗"]),
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
    la = annual[0]
    roe_list = [r["roe"] for r in annual[:5] if r["roe"] is not None]
    roe_avg = sum(roe_list) / len(roe_list) if roe_list else None
    profit_years = sum(1 for r in annual[:5] if (r["netProfit"] or 0) > 0)
    ocf_ratios = []
    for r in annual[:3]:
        if r["ocfPerShare"] and r["eps"] and r["eps"] > 0:
            ocf_ratios.append(r["ocfPerShare"] / r["eps"])
    ocf_ratio = sum(ocf_ratios) / len(ocf_ratios) if ocf_ratios else None
    sector = detect_sector(la["industry"], cfg)
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
    return {
        "name": quote["name"],
        "symbol": parsed["display"],
        "price": quote["price"],
        "pe": pe,
        "pb": quote.get("pb"),
        "roe_avg": roe_avg,
        "profit_years": profit_years,
        "gross_margin": la.get("grossMargin"),
        "ocf_ratio": ocf_ratio,
        "margin_of_safety": mos,
        "fair_value": fair_value,
        "industry": la["industry"],
        "sector": sector,
        "peg": peg,
        "profit_yoy": latest.get("profitYoy"),
        "is_st": "ST" in quote["name"].upper(),
    }


def simple_verdict(m, cfg):
    sc = cfg["scoring"]
    hard_fails = []
    if m["is_st"]:
        hard_fails.append("ST")
    if m["roe_avg"] is not None and m["roe_avg"] < 15:
        hard_fails.append("ROE<15%")
    if m["profit_years"] < 4:
        hard_fails.append("盈利年数不足")
    if m["ocf_ratio"] is not None and m["ocf_ratio"] < 0.8:
        hard_fails.append("现金流质量")
    if m["margin_of_safety"] is not None and m["margin_of_safety"] < sc.get("L3_min", 65) / 100 * 0.25:
        hard_fails.append("安全边际不足")
    elif m["margin_of_safety"] is not None and m["margin_of_safety"] < 0.25:
        hard_fails.append("安全边际<25%")

    if hard_fails:
        return "观察", hard_fails
    if m["margin_of_safety"] and m["margin_of_safety"] >= 0.25:
        return "买入", []
    return "观察", hard_fails or ["综合未达建仓线"]


def main():
    if len(sys.argv) < 2:
        print("用法: python screen_stock.py 600519")
        sys.exit(1)
    cfg = json.loads((ROOT / "投资系统" / "criteria.json").read_text(encoding="utf-8"))
    data = load_stock(sys.argv[1])
    m = build_metrics(data["parsed"], data["quote"], data["finRows"], cfg)
    verdict, reasons = simple_verdict(m, cfg)
    report = {
        "verdict": verdict,
        "name": m["name"],
        "symbol": m["symbol"],
        "price": round(m["price"], 2),
        "pe": m["pe"],
        "roe_avg": round(m["roe_avg"], 2) if m["roe_avg"] else None,
        "margin_of_safety": round(m["margin_of_safety"] * 100, 1) if m["margin_of_safety"] else None,
        "fair_value": round(m["fair_value"], 2) if m["fair_value"] else None,
        "industry": m["industry"],
        "hard_failures": reasons,
        "logic_summary": f"{m['name']}：{verdict}。{('；'.join(reasons)) if reasons else '达主要指标'}",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
