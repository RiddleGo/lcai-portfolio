#!/usr/bin/env python3
"""拉取东方财富行情，生成 quotes-data.js 供 资产总览.html 使用。"""

import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
OUT = ROOT / "quotes-data.js"

from holdings_utils import quote_fallbacks, quote_symbols  # noqa: E402

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
SINA_HEADERS = {"User-Agent": UA, "Referer": "https://finance.sina.com.cn/"}


def secid_market(secid: str) -> str:
    return "HK" if secid.startswith("116.") else "A"


def fetch_json(url: str) -> dict:
    import time
    last_err = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            time.sleep(0.8 * (i + 1))
    raise last_err


def fetch_stock_sina(secid: str, symbols: dict[str, str]) -> dict | None:
    market = secid_market(secid)
    code = secid.split(".", 1)[1]
    prefix = "hk" if market == "HK" else ("sh" if secid.startswith("1.") else "sz")
    symbol = f"rt_{prefix}{code}" if market == "HK" else f"{prefix}{code}"
    url = f"https://hq.sinajs.cn/list={symbol}"
    req = urllib.request.Request(url, headers=SINA_HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("gbk", errors="replace")
    if '="' not in raw:
        return None
    body = raw.split('="')[1].split('";')[0]
    parts = body.split(",")
    if market == "HK":
        if len(parts) <= 6 or not parts[6]:
            return None
        price = float(parts[6])
        prev = float(parts[3]) if parts[3] else 0
        change_pct = float(parts[8]) if len(parts) > 8 and parts[8] else (
            ((price - prev) / prev * 100) if prev else 0
        )
        name = parts[1] or symbols.get(secid, secid)
    else:
        if len(parts) <= 3 or not parts[3]:
            return None
        price = float(parts[3])
        prev = float(parts[2]) if parts[2] else 0
        change_pct = ((price - prev) / prev * 100) if prev else 0
        name = parts[0] or symbols.get(secid, secid)
    return {
        "name": name,
        "price": round(price, 2),
        "changePct": round(change_pct, 2),
        "source": "sina",
    }


def fetch_stock(secid: str, symbols: dict[str, str]) -> dict | None:
    url = (
        "https://push2.eastmoney.com/api/qt/stock/get"
        f"?secid={secid}&fields=f43,f58,f169,f170"
    )
    try:
        data = fetch_json(url)
        d = data.get("data") or {}
        raw = d.get("f43")
        if raw is None:
            raise ValueError("empty quote")
        div = 1000.0 if secid.startswith("116.") else 100.0
        price = raw / div
        change_pct = (d.get("f170") or 0) / 100.0
        name = d.get("f58") or symbols.get(secid, secid)
        return {"name": name, "price": round(price, 2), "changePct": round(change_pct, 2), "source": "eastmoney"}
    except Exception as e:
        print(f"warn: {secid} eastmoney {e}")
    try:
        q = fetch_stock_sina(secid, symbols)
        if q:
            return q
    except Exception as e:
        print(f"warn: {secid} sina {e}")
    return None


def fetch_hkd_cny() -> float:
    url = "https://push2.eastmoney.com/api/qt/stock/get?secid=133.900007&fields=f43"
    try:
        data = fetch_json(url)
        raw = (data.get("data") or {}).get("f43")
        if raw:
            return round(raw / 10000.0, 4)
    except Exception:
        pass
    return 0.92


def main():
    symbols = quote_symbols()
    fallbacks = quote_fallbacks()
    if not symbols:
        print("warn: no active holdings in holdings.json", file=sys.stderr)
        return

    tz = timezone(timedelta(hours=8))
    updated_at = datetime.now(tz).strftime("%Y-%m-%dT%H:%M:%S+08:00")
    fx = fetch_hkd_cny()
    prices = {}
    for secid, label in symbols.items():
        q = fetch_stock(secid, symbols)
        if q:
            prices[secid] = q
            print(f"  {label}: {q['price']} ({q['changePct']:+.2f}%)")
        else:
            fb = fallbacks.get(secid, 0)
            prices[secid] = {"name": label, "price": fb, "changePct": 0, "fallback": True}
            print(f"  {label}: fallback {fb}")
        import time
        time.sleep(0.3)

    payload = {
        "updatedAt": updated_at,
        "fx": {"HKDCNY": fx},
        "prices": prices,
    }
    js = "window.LCAI_QUOTES = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    OUT.write_text(js, encoding="utf-8")
    print(f"written {OUT}  fx HKDCNY={fx}")


if __name__ == "__main__":
    main()
