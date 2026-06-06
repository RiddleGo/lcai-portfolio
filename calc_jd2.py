def amort(P, apr, n=12):
    mr = apr / 12
    pmt = P * mr * (1 + mr) ** n / ((1 + mr) ** n - 1)
    return pmt, pmt * n - P, pmt * n


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

all_loans = [(d, P, k, rem, 0.09) for d, P, k, rem in loans_9]
all_loans += [(d, P, k, rem, 0.135) for d, P, k, rem in loans_135]

print("=== Test: remaining = pmt * (12 - period + 1) i.e. current+future ===")
total_img = 0
total_calc = 0
total_int = 0
for i, (d, P, k, rem_img, apr) in enumerate(all_loans, 1):
    pmt, ti, _ = amort(P, apr)
    left = 12 - k + 1  # on period k, this many payments incl current
    calc = pmt * left
    diff = rem_img - calc
    total_img += rem_img
    total_calc += calc
    total_int += ti
    ok = abs(diff) < 200
    print(
        f"{i:2d} {d} P={P:>6} {k:2d}/12 {apr*100:4.1f}% "
        f"pmt={pmt:>8.2f} x{left}={calc:>10.2f} img={rem_img:>10.2f} diff={diff:>7.2f} {'OK' if ok else 'X'}"
    )

print(f"\nSum img={total_img:.2f} calc={total_calc:.2f}")
print(f"Total principal={sum(P for _,P,_,_,_ in all_loans)}")
print(f"Total interest (12mo amort)={total_int:.2f}")

print("\n=== Test: remaining = pmt * (12 - k) completed periods ===")
for i, (d, P, k, rem_img, apr) in enumerate(all_loans, 1):
    pmt, ti, _ = amort(P, apr)
    left = 12 - k
    calc = pmt * left
    diff = rem_img - calc
    ok = abs(diff) < 200
    if ok or i <= 3:
        print(f"{i:2d} k={k} left={left} calc={calc:.2f} img={rem_img:.2f} diff={diff:.2f} {'OK' if ok else 'X'}")

# 174900 special - try if remaining is correct with different principal
print("\n=== 174900 loan reverse ===")
for P in [174900, 25000, 28452]:
    pmt, ti, tot = amort(P, 0.135)
    for left in [1, 2, 3, 4, 5, 8, 9]:
        if abs(pmt * left - 28451.98) < 500:
            print(f"P={P} pmt={pmt:.2f} x{left}={pmt*left:.2f}")
