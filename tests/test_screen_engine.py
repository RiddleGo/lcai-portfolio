#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LCAI screen_engine 单元测试（离线 fixture，无需行情 API）。"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "投资系统" / "engine"
sys.path.insert(0, str(ENGINE))

from screen_engine import (  # noqa: E402
    build_metrics,
    decide,
    evaluate_rule,
    is_loss_maker,
    load_criteria,
)


def _base_metrics(**overrides):
    m = {
        "symbol": "09880",
        "secid": "116.09880",
        "market": "HK",
        "name": "优必选",
        "price": 110.3,
        "pe": None,
        "pb": 5.2,
        "amount": 80_000_000,
        "industry": "软件服务",
        "sectorKey": "软件",
        "fairPe": 28,
        "peCap": 45,
        "roeAvg": -40.26,
        "roeList": [-40.26],
        "profitYears": 0,
        "grossMargin": 30.0,
        "ocfRatio": None,
        "ocfRatios": [],
        "deductRatio": None,
        "revenueYoy": 10.0,
        "profitYoy": -20.0,
        "profitCollapse": False,
        "fairValue": None,
        "marginOfSafety": None,
        "peg": None,
        "profitGrowth": -20.0,
        "eps": -1.5,
        "lossMaker": True,
        "isSt": False,
        "fraudSuspect": False,
        "ocfVeto": False,
        "peExtreme": False,
        "trapFlags": [],
        "trapSuspect": False,
        "dcfFairValue": None,
        "dcfMarginOfSafety": None,
        "dcfGrowth": 0.05,
        "dcfWacc": 0.09,
    }
    m.update(overrides)
    return m


class TestLossMaker(unittest.TestCase):
    def test_is_loss_maker_by_eps(self):
        self.assertTrue(is_loss_maker(-0.1, 100))

    def test_is_loss_maker_by_net_profit(self):
        self.assertTrue(is_loss_maker(0.5, -100))

    def test_pe_reasonable_skipped_for_loss_maker(self):
        cfg = load_criteria()
        rule = next(r for r in cfg["rules"] if r["id"] == "L3-02")
        row = evaluate_rule(rule, _base_metrics(), {})
        self.assertTrue(row["pass"])
        self.assertEqual(row["actual"], "亏损不适用")

    def test_build_metrics_strips_negative_pe(self):
        cfg = load_criteria()
        parsed = {"market": "HK", "display": "09880", "secid": "116.09880"}
        quote = {"name": "优必选", "price": 110.3, "pe": -71.32, "pb": 5.2, "amount": 80_000_000}
        fin_rows = [
            {
                "isAnnual": True,
                "eps": -1.5,
                "netProfit": -500_000_000,
                "industry": "软件服务",
                "roe": -40.26,
                "grossMargin": 30.0,
                "profitYoy": -20.0,
                "revenueYoy": 10.0,
            }
        ]
        m = build_metrics(parsed, quote, fin_rows, cfg)
        self.assertTrue(m["lossMaker"])
        self.assertIsNone(m["pe"])
        self.assertFalse(m["peExtreme"])


class TestPortfolioBranches(unittest.TestCase):
    def _passing_results(self, cfg):
        ctx = {"in_portfolio": True, "competence": True, "psychology": True}
        m = _base_metrics(
            lossMaker=False,
            eps=5.0,
            pe=15.0,
            fairValue=140.0,
            marginOfSafety=0.3,
            roeAvg=20.0,
            profitYears=5,
            ocfRatio=1.0,
            profitYoy=10.0,
            profitGrowth=10.0,
            peg=1.5,
        )
        return [evaluate_rule(r, m, ctx) for r in cfg["rules"]], m

    def test_in_portfolio_buy_becomes_hold(self):
        cfg = load_criteria()
        results, m = self._passing_results(cfg)
        m["rating"] = "A"
        decision = decide(m, results, {"in_portfolio": True}, cfg)
        self.assertEqual(decision["verdict"], "持有")
        self.assertIn("继续持有", decision["verdict_action"])

    def test_not_in_portfolio_buy(self):
        cfg = load_criteria()
        results, m = self._passing_results(cfg)
        m["rating"] = "A"
        decision = decide(m, results, {"in_portfolio": False}, cfg)
        self.assertEqual(decision["verdict"], "买入")

    def test_in_portfolio_trim_on_weak_l3(self):
        cfg = load_criteria()
        results, m = self._passing_results(cfg)
        m["rating"] = "B"
        m["peExtreme"] = True
        # 总分须低于建仓线，否则会先命中「持有」分支
        for r in results:
            if r["layer"] in ("L1", "L2") and r["type"] == "soft":
                r["score"] = 0
            if r["layer"] == "L3" and r["type"] == "soft":
                r["score"] = 1
        decision = decide(m, results, {"in_portfolio": True}, cfg)
        self.assertLess(decision["overall_score"], cfg["scoring"]["overall_buy"])
        self.assertEqual(decision["verdict"], "减仓")


class TestRuleParityFixtures(unittest.TestCase):
    """与 tests/fixtures/rule_cases.json 对齐，防止 JS/Python 规则漂移。"""

    def test_rule_cases(self):
        path = ROOT / "tests" / "fixtures" / "rule_cases.json"
        cases = json.loads(path.read_text(encoding="utf-8"))
        cfg = load_criteria()
        rules_by_eval = {r["eval"]: r for r in cfg["rules"]}

        for case in cases:
            rule = rules_by_eval[case["eval"]]
            row = evaluate_rule(rule, case["metrics"], case.get("ctx", {}))
            self.assertEqual(row["pass"], case["expect_pass"], msg=case["name"])
            if "expect_actual" in case:
                self.assertEqual(row["actual"], case["expect_actual"], msg=case["name"])


if __name__ == "__main__":
    unittest.main()
