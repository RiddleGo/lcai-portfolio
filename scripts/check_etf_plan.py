#!/usr/bin/env python3
"""ETF 分批计划：拉行情、算回调、输出加仓提醒，生成 etf-plan-data.js。"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN_PATH = ROOT / "投资系统" / "etf-plan.json"
STATE_PATH = ROOT / "etf-plan-state.json"
OUT_JS = ROOT / "etf-plan-data.js"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
TZ = timezone(timedelta(hours=8))


def fetch_json(url: str, retries: int = 3) -> dict:
    last_err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            time.sleep(0.6 * (i + 1))
    raise last_err  # type: ignore[misc]


def code_to_secid(code: str, market: str) -> str:
    if code == "CASH":
        return ""
    prefix = "1" if market == "sh" else "0"
    return f"{prefix}.{code}"


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    data["updatedAt"] = datetime.now(TZ).strftime("%Y-%m-%dT%H:%M:%S+08:00")
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def invested_by_code(state: dict) -> dict[str, float]:
    totals: dict[str, float] = {}
    for row in state.get("executed") or []:
        code = row.get("code")
        if not code or code == "CASH":
            continue
        totals[code] = totals.get(code, 0.0) + float(row.get("amount") or 0)
    return totals


def batch_done(state: dict, batch_id: str) -> bool:
    if batch_id in (state.get("skippedBatches") or []):
        return True
    return batch_id in (state.get("completedBatches") or [])


def mark_batch_done(state: dict, batch_id: str) -> None:
    done = list(state.get("completedBatches") or [])
    if batch_id not in done:
        done.append(batch_id)
    state["completedBatches"] = done


def fetch_quote(secid: str) -> dict | None:
    if not secid:
        return None
    url = (
        "https://push2.eastmoney.com/api/qt/ulist.np/get"
        f"?fltt=2&secids={secid}&fields=f12,f14,f2,f3"
    )
    try:
        data = fetch_json(url)
        rows = (data.get("data") or {}).get("diff") or []
        if not rows:
            return None
        row = rows[0]
        price = row.get("f2")
        if price in (None, "-"):
            return None
        return {
            "price": round(float(price), 3),
            "changePct": round(float(row.get("f3") or 0), 2),
            "name": row.get("f14") or secid,
        }
    except Exception as e:
        print(f"warn: quote {secid} {e}", file=sys.stderr)
        return None


def fetch_high_n_days(secid: str, days: int = 20) -> float | None:
    url = (
        "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        f"?secid={secid}&fields1=f1&fields2=f51,f52,f53,f54,f55"
        f"&klt=101&fqt=1&end=20500101&lmt={days + 10}"
    )
    try:
        data = fetch_json(url)
        lines = (data.get("data") or {}).get("klines") or []
        highs = []
        for line in lines[-days:]:
            parts = line.split(",")
            if len(parts) >= 4:
                highs.append(float(parts[3]))
        return round(max(highs), 3) if highs else None
    except Exception as e:
        print(f"warn: kline {secid} {e}", file=sys.stderr)
        return None


def parse_date(s: str | None) -> date | None:
    if not s:
        return None
    return date.fromisoformat(s)


def is_trading_day_check() -> bool:
    wd = datetime.now(TZ).weekday()
    return wd < 5


def remaining_amount(code: str, target: float, invested: dict[str, float]) -> float:
    return max(0.0, target - invested.get(code, 0.0))


def eval_order_signal(
    order: dict,
    meta: dict,
    quote: dict | None,
    high: float | None,
    invested: dict[str, float],
    batch: dict,
    today: date,
) -> dict:
    code = order["code"]
    target_info = meta.get(code, {})
    target_amt = float(target_info.get("targetAmount") or 0)
    planned = float(order.get("amount") or 0)
    if order.get("fillToTarget"):
        planned = remaining_amount(code, target_amt, invested)
    planned = min(planned, remaining_amount(code, target_amt, invested))

    signal = "wait"
    reasons: list[str] = []
    pullback_pct = float(order.get("pullbackPct") or batch.get("pullbackPct") or 0)
    drawdown = None
    trigger_price = None

    price = (quote or {}).get("price")
    if price and high:
        drawdown = round((high - price) / high * 100, 2)
        trigger_price = round(high * (1 - pullback_pct / 100), 3)

    trigger = batch.get("trigger")
    deadline = parse_date(batch.get("deadline"))

    if planned <= 0:
        signal = "done"
        reasons.append("已达目标仓位")
    elif trigger == "immediate":
        signal = "buy"
        reasons.append("第一笔：计划允许立即建仓")
    elif trigger == "pullback_or_deadline":
        if drawdown is not None and drawdown >= pullback_pct:
            signal = "buy"
            reasons.append(
                f"较近{batch.get('lookbackDays', 20)}日高点回落 {drawdown}% ≥ {pullback_pct}%"
            )
        elif deadline and today >= deadline:
            signal = "buy"
            reasons.append(f"已到达批次截止日期 {deadline}")
        else:
            if drawdown is not None:
                reasons.append(
                    f"回落 {drawdown}%，需 ≥ {pullback_pct}%（触发价约 {trigger_price}）"
                )
            if deadline:
                days_left = (deadline - today).days
                reasons.append(f"截止日期 {deadline}，还剩 {days_left} 天")
    elif trigger == "deadline":
        if deadline and today >= deadline:
            signal = "buy"
            reasons.append(f"已到达批次截止日期 {deadline}")
        elif deadline:
            days_left = (deadline - today).days
            reasons.append(f"等待截止日期 {deadline}（还剩 {days_left} 天）")
    else:
        reasons.append("未知触发类型")

    return {
        "code": code,
        "name": target_info.get("name") or (quote or {}).get("name") or code,
        "category": target_info.get("category", ""),
        "plannedAmount": round(planned, 2),
        "targetAmount": target_amt,
        "investedAmount": round(invested.get(code, 0.0), 2),
        "remainingTarget": round(remaining_amount(code, target_amt, invested), 2),
        "price": price,
        "changePct": (quote or {}).get("changePct"),
        "highNDays": high,
        "drawdownPct": drawdown,
        "triggerPrice": trigger_price,
        "pullbackNeedPct": pullback_pct,
        "signal": signal,
        "reasons": reasons,
    }


def build_report(plan: dict, state: dict) -> dict:
    today = datetime.now(TZ).date()
    invested = invested_by_code(state)
    meta = {t["code"]: t for t in plan.get("targets") or []}
    lookback = 20
    for b in plan.get("batches") or []:
        if b.get("lookbackDays"):
            lookback = int(b["lookbackDays"])
            break

    quotes: dict[str, dict] = {}
    highs: dict[str, float | None] = {}
    for t in plan.get("targets") or []:
        code = t["code"]
        if code == "CASH":
            continue
        secid = code_to_secid(code, t.get("market", "sh"))
        quotes[code] = fetch_quote(secid) or {}
        highs[code] = fetch_high_n_days(secid, lookback)

    targets_view = []
    for t in plan.get("targets") or []:
        code = t["code"]
        if code == "CASH":
            cash_target = float(t.get("targetAmount") or 0)
            cash_invested = sum(
                float(x.get("amount") or 0)
                for x in (state.get("executed") or [])
                if x.get("code") == "CASH"
            )
            targets_view.append({
                **t,
                "investedAmount": round(cash_invested, 2),
                "remainingTarget": round(max(0, cash_target - cash_invested), 2),
                "progressPct": round(min(100, cash_invested / cash_target * 100), 1)
                if cash_target
                else 100,
            })
            continue
        tgt = float(t.get("targetAmount") or 0)
        inv = invested.get(code, 0.0)
        q = quotes.get(code) or {}
        h = highs.get(code)
        price = q.get("price")
        dd = round((h - price) / h * 100, 2) if h and price else None
        targets_view.append({
            **t,
            "investedAmount": round(inv, 2),
            "remainingTarget": round(remaining_amount(code, tgt, invested), 2),
            "progressPct": round(min(100, inv / tgt * 100), 1) if tgt else 100,
            "price": price,
            "changePct": q.get("changePct"),
            "high20d": h,
            "drawdownPct": dd,
        })

    batches_view = []
    active_batch_id = None
    buy_today: list[dict] = []

    for batch in plan.get("batches") or []:
        bid = batch["id"]
        if batch_done(state, bid):
            batches_view.append({
                "id": bid,
                "name": batch.get("name"),
                "status": "completed",
                "orders": [],
            })
            continue
        if active_batch_id is None:
            active_batch_id = bid

        orders_view = []
        for order in batch.get("orders") or []:
            code = order["code"]
            tmeta = meta.get(code, {})
            ov = eval_order_signal(
                order,
                meta,
                quotes.get(code),
                highs.get(code),
                invested,
                batch,
                today,
            )
            orders_view.append(ov)
            if ov["signal"] == "buy" and ov["plannedAmount"] > 0:
                buy_today.append({
                    "batchId": bid,
                    "batchName": batch.get("name"),
                    **ov,
                })

        batches_view.append({
            "id": bid,
            "name": batch.get("name"),
            "trigger": batch.get("trigger"),
            "deadline": batch.get("deadline"),
            "note": batch.get("note"),
            "status": "active" if bid == active_batch_id else "pending",
            "orders": orders_view,
        })

        if bid == active_batch_id:
            break

    alert_level = "none"
    summary = "暂无加仓信号，继续观察。"
    if buy_today:
        alert_level = "buy"
        names = "、".join(f"{x['code']} {x['plannedAmount']:.0f}元" for x in buy_today)
        summary = f"今日符合计划：建议加仓 {names}"
    elif active_batch_id == "batch1":
        alert_level = "info"
        summary = "第一笔待执行：宽基 + 机器人/AI 小仓可建仓。"

    return {
        "planName": plan.get("name"),
        "totalBudget": plan.get("totalBudget"),
        "startDate": plan.get("startDate"),
        "updatedAt": datetime.now(TZ).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "checkedDate": today.isoformat(),
        "isTradingDay": is_trading_day_check(),
        "alertLevel": alert_level,
        "summary": summary,
        "buySignals": buy_today,
        "targets": targets_view,
        "batches": batches_view,
        "activeBatchId": active_batch_id,
        "cashFlowNote": (plan.get("rules") or {}).get("cashFlowNote"),
        "stateUpdatedAt": state.get("updatedAt"),
    }


def write_js(report: dict) -> None:
    payload = json.dumps(report, ensure_ascii=False, indent=2)
    OUT_JS.write_text("window.ETF_PLAN = " + payload + ";\n", encoding="utf-8")


def print_cli(report: dict) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"\n=== ETF 计划检测 · {report['checkedDate']} ===")
    print(report["summary"])
    if report.get("cashFlowNote"):
        print(f"⚠ {report['cashFlowNote']}")
    print()

    if report.get("buySignals"):
        print("【今日建议加仓】")
        for s in report["buySignals"]:
            print(f"  • {s['code']} {s['name']}  计划 {s['plannedAmount']:.0f} 元")
            print(f"    现价 {s.get('price')}  20日高 {s.get('highNDays')}  回落 {s.get('drawdownPct')}%")
            for r in s.get("reasons") or []:
                print(f"    → {r}")
        print()

    print("【目标进度】")
    for t in report.get("targets") or []:
        if t["code"] == "CASH":
            continue
        print(
            f"  {t['code']} {str(t['name'])[:12]:<12} "
            f"{t.get('investedAmount', 0):>7.0f}/{t.get('targetAmount', 0):<7.0f} "
            f"({t.get('progressPct', 0):>5.1f}%)  "
            f"价{t.get('price')}  回落{t.get('drawdownPct')}%"
        )

    batch = next((b for b in report.get("batches") or [] if b.get("status") == "active"), None)
    if batch:
        print(f"\n【当前批次】{batch.get('name')}（{batch.get('id')}）")
        for o in batch.get("orders") or []:
            flag = {"buy": "✅", "wait": "⏳", "done": "✓"}.get(o.get("signal"), "?")
            print(f"  {flag} {o['code']} 计划{o['plannedAmount']:.0f}元  {'; '.join(o.get('reasons') or [])}")


def cmd_done(state: dict, code: str, amount: float) -> None:
    state.setdefault("executed", []).append({
        "code": code,
        "amount": amount,
        "date": datetime.now(TZ).date().isoformat(),
    })
    save_json(STATE_PATH, state)
    print(f"已记录买入：{code} {amount:.0f} 元")


def cmd_complete_batch(state: dict, batch_id: str) -> None:
    mark_batch_done(state, batch_id)
    save_json(STATE_PATH, state)
    print(f"已标记批次完成：{batch_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description="ETF 分批计划检测")
    parser.add_argument("--done", nargs=2, metavar=("CODE", "AMOUNT"), help="记录已买入")
    parser.add_argument("--complete-batch", metavar="BATCH_ID", help="标记批次已完成")
    parser.add_argument("--no-js", action="store_true", help="不写入 etf-plan-data.js")
    args = parser.parse_args()

    plan = load_json(PLAN_PATH)
    state = load_json(STATE_PATH)

    if args.done:
        cmd_done(state, args.done[0], float(args.done[1]))
    if args.complete_batch:
        cmd_complete_batch(state, args.complete_batch)

    report = build_report(plan, state)
    if not args.no_js:
        write_js(report)
        print(f"written {OUT_JS}", file=sys.stderr)
    print_cli(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
