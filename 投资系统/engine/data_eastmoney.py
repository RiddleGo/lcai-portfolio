# -*- coding: utf-8 -*-
"""东方财富数据拉取（Python 版，与 screen-data.js 对齐）"""
import json
import re
import urllib.request
from typing import Any

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
HEADERS = {"User-Agent": UA, "Referer": "https://data.eastmoney.com/"}


def fetch_json(url: str) -> dict:
    import time
    last_err = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            last_err = e
            time.sleep(0.8 * (i + 1))
    raise last_err


def parse_symbol(raw: str) -> dict:
    s = raw.strip().upper().replace(" ", "")
    s = re.sub(r"^(SH|SZ|HK|HKEX)", "", s)
    if re.match(r"^\d{5}$", s):
        return {"market": "HK", "code": s, "secid": f"116.{s}", "display": s.zfill(5)}
    if re.match(r"^\d{6}$", s):
        prefix = "1" if s[0] in "65" else "0"
        return {"market": "A", "code": s, "secid": f"{prefix}.{s}", "display": s}
    raise ValueError("代码格式无效")


def num(v) -> float | None:
    if v is None or v == "" or v == "-":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fetch_quote(secid: str, market: str) -> dict:
    fields = "f43,f58,f162,f167,f48,f170"
    url = f"https://push2.eastmoney.com/api/qt/stock/get?secid={secid}&fields={fields}"
    try:
        d = fetch_json(url).get("data") or {}
        if d.get("f43") is not None:
            div = 1000.0 if market == "HK" else 100.0
            return {
                "name": d.get("f58") or secid,
                "price": d["f43"] / div,
                "pe": d["f162"] / 100 if d.get("f162") and d["f162"] > 0 else None,
                "pb": d["f167"] / 100 if d.get("f167") and d["f167"] > 0 else None,
                "amount": d.get("f48") or 0,
            }
    except Exception:
        pass
    return fetch_quote_sina(secid, market)


def fetch_quote_sina(secid: str, market: str) -> dict:
    """push2 不可用时的备用行情源"""
    code = secid.split(".", 1)[1]
    prefix = "hk" if market == "HK" else ("sh" if secid.startswith("1.") else "sz")
    symbol = f"{prefix}{code}" if market != "HK" else f"rt_{prefix}{code}"
    url = f"https://hq.sinajs.cn/list={symbol}"
    headers = {**HEADERS, "Referer": "https://finance.sina.com.cn/"}
    import time
    time.sleep(0.3)
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("gbk", errors="replace")
    # var hq_str_sh600519="茅台,..."
    if '="' not in raw:
        raise ValueError("备用行情源失败")
    body = raw.split('="')[1].split('";')[0]
    parts = body.split(",")
    if market == "HK":
        name = parts[1] if len(parts) > 1 else code
        price = float(parts[6]) if len(parts) > 6 and parts[6] else 0
        amount = float(parts[12]) if len(parts) > 12 and parts[12] else 0
    else:
        name = parts[0] or code
        price = float(parts[3]) if parts[3] else 0
        amount = float(parts[9]) if len(parts) > 9 and parts[9] else 0
    return {"name": name, "price": price, "pe": None, "pb": None, "amount": amount}


def fetch_financials(code: str) -> list[dict]:
    cols = "SECURITY_CODE,REPORTDATE,WEIGHTAVG_ROE,XSMLL,PARENT_NETPROFIT,TOTAL_OPERATE_INCOME,BASIC_EPS,DEDUCT_BASIC_EPS,MGJYXJJE,YSTZ,SJLTZ,PUBLISHNAME"
    url = (
        "https://datacenter-web.eastmoney.com/api/data/v1/get"
        f"?reportName=RPT_LICO_FN_CPD&columns={cols}"
        f"&filter=(SECURITY_CODE%3D%22{code}%22)&pageNumber=1&pageSize=20"
        "&sortTypes=-1&sortColumns=REPORTDATE"
    )
    rows = (fetch_json(url).get("result") or {}).get("data") or []
    if not rows:
        raise ValueError("未获取财务数据")
    out = []
    for r in rows:
        out.append({
            "date": r.get("REPORTDATE"),
            "roe": num(r.get("WEIGHTAVG_ROE")),
            "grossMargin": num(r.get("XSMLL")),
            "netProfit": num(r.get("PARENT_NETPROFIT")),
            "eps": num(r.get("BASIC_EPS")),
            "deductEps": num(r.get("DEDUCT_BASIC_EPS")),
            "ocfPerShare": num(r.get("MGJYXJJE")),
            "revenueYoy": num(r.get("YSTZ")),
            "profitYoy": num(r.get("SJLTZ")),
            "industry": r.get("PUBLISHNAME") or "",
            "isAnnual": "12-31" in str(r.get("REPORTDATE", "")),
        })
    return out


def load_stock(raw: str) -> dict:
    parsed = parse_symbol(raw)
    quote = fetch_quote(parsed["secid"], parsed["market"])
    fin = fetch_financials(parsed["code"])
    return {"parsed": parsed, "quote": quote, "finRows": fin}
