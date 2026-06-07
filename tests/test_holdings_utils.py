#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import holdings_utils as hu  # noqa: E402
from add_holding_from_issue import parse_symbol_from_title  # noqa: E402


class TestHoldingsUtils(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._orig = hu.HOLDINGS_PATH
        hu.HOLDINGS_PATH = Path(self._tmpdir.name) / "holdings.json"
        hu.write_holdings_doc({"holdings": []})

    def tearDown(self):
        hu.HOLDINGS_PATH = self._orig
        self._tmpdir.cleanup()

    def test_code_to_secid(self):
        self.assertEqual(hu.code_to_secid("601127"), "1.601127")
        self.assertEqual(hu.code_to_secid("09880"), "116.09880")

    def test_add_or_update_holding(self):
        entry = hu.add_or_update_holding(
            code="600519",
            name="贵州茅台",
            shares=100,
            cost_per_share=1500,
            account="hb",
            fallback_price=1500,
        )
        self.assertEqual(entry["symbol"], "1.600519")
        self.assertEqual(entry["id"], "600519_hb")
        self.assertTrue(hu.is_in_holdings("600519"))

    def test_parse_issue_payload(self):
        body = """请更新 holdings.json

```json
{"code":"600519","name":"茅台","shares":100,"costPerShare":1500,"account":"hb"}
```"""
        data = hu.parse_issue_payload(body)
        self.assertEqual(data["code"], "600519")
        self.assertEqual(parse_symbol_from_title("[holding] 600519"), "600519")


if __name__ == "__main__":
    unittest.main()
