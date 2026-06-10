#!/usr/bin/env python3
"""Fetch themed ETF quotes from East Money."""
import json
import ssl
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

ETFS = [
    ("1.588000", "宽基", "科创50ETF华夏"),
    ("1.510300", "宽基", "沪深300ETF华泰柏瑞"),
    ("0.159995", "半导体", "芯片ETF华夏"),
    ("1.588200", "半导体", "科创芯片ETF嘉实"),
    ("1.588170", "半导体", "科创半导体ETF华夏"),
    ("0.159558", "半导体", "半导体设备ETF易方达"),
    ("0.159516", "半导体", "半导体设备ETF国泰"),
    ("1.512480", "半导体", "半导体ETF"),
    ("0.159819", "AI", "人工智能ETF易方达"),
    ("0.159140", "AI", "科创创业人工智能ETF"),
    ("1.562500", "机器人", "机器人ETF华夏"),
    ("0.159770", "机器人", "机器人ETF天弘"),
    ("0.159530", "机器人", "机器人ETF易方达"),
]


def main():
    secids = ",".join(x[0] for x in ETFS)
    url = (
        "https://push2.eastmoney.com/api/qt/ulist.np/get"
        f"?fltt=2&secids={secids}&fields=f12,f14,f2,f3,f6,f8,f168"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15, context=CTX) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    rows = data.get("data", {}).get("diff") or []
    meta = {x[0].split(".")[1]: (x[1], x[2]) for x in ETFS}
    print(f"{'代码':<8} {'分类':<6} {'名称':<22} {'现价':>7} {'涨跌%':>7} {'成交额亿':>9} {'换手%':>7}")
    print("-" * 78)
    for row in sorted(rows, key=lambda x: x.get("f6") or 0, reverse=True):
        code = row.get("f12", "")
        cat, name = meta.get(code, ("", row.get("f14", "")))
        amt = round((row.get("f6") or 0) / 1e8, 2)
        print(
            f"{code:<8} {cat:<6} {name[:20]:<22} "
            f"{row.get('f2', '-'):>7} {row.get('f3', '-'):>7} {amt:>9} {row.get('f8', '-'):>7}"
        )


if __name__ == "__main__":
    main()
