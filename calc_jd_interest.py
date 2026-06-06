def loan_detail(P, apr, n=12, current_period=1):
    mr = apr / 12
    pmt = P * mr * (1 + mr) ** n / ((1 + mr) ** n - 1)
    bal = P
    paid_int = 0
    for _ in range(current_period - 1):
        intr = bal * mr
        prin = pmt - intr
        paid_int += intr
        bal -= prin
    total_int = pmt * n - P
    rem_int = total_int - paid_int
    rem_pmt = pmt * (n - current_period + 1)
    return {
        "pmt": round(pmt, 2),
        "total_int": round(total_int, 2),
        "paid_int": round(paid_int, 2),
        "rem_int": round(rem_int, 2),
        "rem_pmt": round(rem_pmt, 2),
        "rem_prin": round(bal, 2),
    }


loans = [
    ("1", "2025-08-26", 129000, 10, 0.09, 33626.91),
    ("2", "2025-08-28", 10000, 10, 0.09, 2605.66),
    ("3", "2025-09-01", 59900, 10, 0.09, 15539.44),
    ("4", "2026-02-05", 33000, 5, 0.135, 2445.97),
    ("5", "2026-02-10", 92100, 5, 0.135, 62787.14),
    ("6", "2026-03-02", 30000, 4, 0.135, 22970.74),
    ("7", "2026-03-04", 25000, 4, 0.135, 19128.29),
    ("8", "2026-03-05", 50000, 4, 0.135, 38231.99),
    ("9", "2026-03-06", 174900, 4, 0.135, 28451.98),
    ("10", "2026-03-30", 10000, 3, 0.135, 8465.64),
    ("11", "2026-03-31", 30000, 3, 0.135, 25387.61),
    ("12", "2026-04-03", 50700, 3, 0.135, 42858.02),
    ("13", "2026-04-06", 10000, 3, 0.135, 8443.99),
]

print("逐笔利息明细（按9%/13.5%，12期还清不提前还）")
print("-" * 88)
header = f"{'#':>2} {'本金':>8} {'期':>5} {'利率':>5} {'全期利息':>10} {'已付利息':>10} {'待付利息':>10} {'图待还':>10}"
print(header)
print("-" * 88)

tP = tI = tPaid = tRem = 0
rows = []
for no, d, P, k, apr, img in loans:
    s = loan_detail(P, apr, 12, k)
    tP += P
    tI += s["total_int"]
    tPaid += s["paid_int"]
    tRem += s["rem_int"]
    rows.append((no, P, k, apr, s, img))
    print(
        f"{no:>2} {P:>8} {k:>2}/12 {apr*100:>4.1f}% "
        f"{s['total_int']:>10.2f} {s['paid_int']:>10.2f} {s['rem_int']:>10.2f} {img:>10.2f}"
    )

print("-" * 88)
print(f"合计  本金 {tP:,}  全期总利息 {tI:,.2f}  已付 {tPaid:,.2f}  待付 {tRem:,.2f}")
print(f"利息/本金 = {tI/tP*100:.2f}%")
print()
print(f"图里剩余还款总额 310,943.38，其中利息约占 {tRem:,.2f}，本金约占 {310943.38-tRem:,.2f}")

# 174900 若按图里待还28452（大量提前还本）
s9 = loan_detail(174900, 0.135, 12, 4)
rem_int_from_img = 28451.98 - s9["rem_prin"]
print()
print("=== 174,900 那笔特殊 ===")
print(f"公式待还本金(还3期后): {s9['rem_prin']:,.2f}")
print(f"图里待还总额: 28,451.98 -> 说明已大量提前还本")
print(f"按图估算该笔剩余利息约: {max(0, rem_int_from_img):,.2f} 元（公式全期利息 {s9['total_int']:,.2f}）")
adj = tI - s9["rem_int"] + max(0, rem_int_from_img)
print(f"扣除该笔多算部分后，京东总利息约: {adj:,.2f} 元")

# 33000 若只剩2446
s4 = loan_detail(33000, 0.135, 12, 5)
print()
print("=== 33,000 那笔 ===")
print(f"公式待还(5/12): {s4['rem_pmt']:,.2f}，图里仅 2,445.97 -> 接近还完")
rem4 = max(0, 2445.97 - s4["rem_prin"] * (2445.97 / s4["rem_pmt"]))
print(f"该笔剩余利息约: {max(0, 2445.97 - (2445.97/s4['rem_pmt'])*s4['rem_prin']):,.2f}")
