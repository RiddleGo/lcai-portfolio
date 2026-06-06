def amort(P, apr, n=12, paid=0):
    mr = apr / 12
    pmt = P * mr * (1 + mr) ** n / ((1 + mr) ** n - 1)
    bal = P
    total_int = 0
    for _ in range(paid):
        intr = bal * mr
        prin = pmt - intr
        total_int += intr
        bal -= prin
    rem_pmt = 0
    b = bal
    for _ in range(n - paid):
        intr = b * mr
        prin = pmt - intr
        rem_pmt += pmt
        b -= prin
    return {
        "pmt": pmt,
        "total": pmt * n,
        "total_int": pmt * n - P,
        "bal": bal,
        "rem_pmt": rem_pmt,
        "paid_int": total_int,
        "rem_int": pmt * n - P - total_int,
    }


loans_9 = [
    ("2025-08-26", 129000, 10, 33626.91),
    ("2025-08-28", 10000, 10, 2605.66),
    ("2025-09-01", 59900, 10, 15539.44),
]
loans_135 = [
    ("2026-02-05", 33000, 5, 2445.97),
    ("2026-02-10", 92100, 5, 62787.14),
    ("2026-03-02", 30000, 4, 22970.74),
    ("2026-03-04", 25000, 4, 19128.29),
    ("2026-03-05", 50000, 4, 38231.99),
    ("2026-03-06", 174900, 4, 28451.98),
    ("2026-03-30", 10000, 3, 8465.64),
    ("2026-03-31", 30000, 3, 25387.61),
    ("2026-04-03", 50700, 3, 42858.02),
    ("2026-04-06", 10000, 3, 8443.99),
]

all_loans = [(d, P, paid, rem, 0.09) for d, P, paid, rem in loans_9]
all_loans += [(d, P, paid, rem, 0.135) for d, P, paid, rem in loans_135]

print("=== 13 loans remaining check ===")
sum_rem_img = 0
sum_rem_calc = 0
sum_total_int = 0
sum_paid_int = 0
sum_rem_int = 0
for i, (d, P, paid, rem_img, apr) in enumerate(all_loans, 1):
    s = amort(P, apr, 12, paid)
    diff = rem_img - s["rem_pmt"]
    sum_rem_img += rem_img
    sum_rem_calc += s["rem_pmt"]
    sum_total_int += s["total_int"]
    sum_paid_int += s["paid_int"]
    sum_rem_int += s["rem_int"]
    flag = "OK" if abs(diff) < 50 else "DIFF"
    print(
        f"{i:2d} {d} P={P:>6} {paid:2d}/12 {apr*100:4.1f}% "
        f"img={rem_img:>10.2f} calc={s['rem_pmt']:>10.2f} diff={diff:>8.2f} [{flag}]"
    )

print(f"\nScreenshot remaining sum: {sum_rem_img:.2f} (expect 310943.38)")
print(f"Formula remaining sum:    {sum_rem_calc:.2f}")
print(f"Total principal:          {sum(P for _, P, _, _, _ in all_loans)}")
print(f"Total lifecycle interest: {sum_total_int:.2f}")
print(f"  Paid interest so far:   {sum_paid_int:.2f}")
print(f"  Remaining interest:     {sum_rem_int:.2f}")

# Try if 33000 remaining is 24459.7 misread
print("\n=== If loan4 remaining is 24459.7 instead of 2445.97 ===")
alt = loans_135.copy()
alt[0] = ("2026-02-05", 33000, 5, 24459.7)
all2 = [(d, P, paid, rem, 0.09) for d, P, paid, rem in loans_9]
all2 += [(d, P, paid, rem, 0.135) for d, P, paid, rem in alt]
print(f"New sum: {sum(r for _,_,_,r,_ in all2):.2f}")

# missing loan 10000 2026-03-08?
print("\n=== Try adding missing 10000 2026-03-08 loan ===")
# img4 shows partial 10000 03-08 3/12 - if we swap one duplicate
