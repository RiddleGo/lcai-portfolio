# JD Finance - exact interest from bill detail screenshots (豆包 7-19)

loans = [
    # (file, date, principal, rem_total, rem_prin, rem_int, paid_installments[], future_installments[])
    (7, "2025-08-26", 129000, 33626.91, 33587.67, 39.24, None, [11358.99, 11364.06]),
    (8, "2025-08-28", 10000, 2605.66, 2602.46, 3.20, None, [881.18, 881.18]),
    (9, "2025-09-01", 59900, 15539.44, 15520.35, 19.09, None, [5255.11, 5255.11]),
    (10, "2026-02-05", 33000, 2445.97, 2441.45, 4.52, None, [321.26, 321.26]),
    (11, "2026-02-10", 92100, 62787.14, 62671.20, 115.94, None, [8246.70, 8246.70]),
    (12, "2026-03-02", 30000, 22970.74, 22928.33, 42.41, [2678.50, 2659.87, 2665.46], []),
    (13, "2026-03-04", 25000, 19128.29, 19092.97, 35.32, [2230.45, 2214.94, 2219.59], []),
    (14, "2026-03-05", 50000, 38231.99, 38171.97, 60.02, [4378.79, 4356.66, 4365.07], []),
    (15, "2026-03-06", 174900, 28451.98, 28399.44, 52.54, [15010.35, 130284.30, 3301.48], []),
    (16, "2026-03-30", 10000, 8465.64, 8450.01, 15.63, [886.22, 888.06], []),
    (17, "2026-03-31", 30000, 25387.61, 25340.73, 46.88, [2657.70, 2663.23], []),
    (18, "2026-04-03", 50700, 42858.02, 42778.88, 79.14, [4486.54, 4495.92], []),
    (19, "2026-04-06", 10000, 8443.99, 8428.40, 15.59, [883.93, 885.79], []),
]

print("京东13笔 - 从账单详情精确计算")
print("公式: 总利息 = 已还总额 + 图里待还 - 本金")
print("=" * 95)

total_p = 0
total_i_exact = 0
total_i_est = 0
total_rem = 0
need_more = []

for f, d, P, rem, rp, ri, paid, future in loans:
    total_p += P
    total_rem += rem

    if paid is not None:
        paid_sum = sum(paid)
        interest = paid_sum + rem - P
        method = "精确"
        total_i_exact += interest
    else:
        # 从可见未来期数 + rem 反推最后一期，再估算已还
        fut_sum = sum(future)
        last = round(rem - fut_sum, 2)
        all_future = future + ([last] if abs(last) > 0.01 else [])
        # 用后期月供均值估已还9期/4期
        avg = sum(all_future) / len(all_future) if all_future else 0
        paid_periods = {129000: 9, 10000: 9, 59900: 9, 33000: 4, 92100: 4}[P]
        paid_sum_est = round(avg * paid_periods, 2)  # rough
        interest = paid_sum_est + rem - P
        method = f"估算(缺已还明细,估{paid_periods}期)"
        total_i_est += interest
        need_more.append((f, d, P))

    paid_display = sum(paid) if paid else "缺"
    print(
        f"({f:2d}) {d} 本金{P:>7}  已还{str(paid_display):>12}  待还{rem:>10.2f}  "
        f"待还利息{ri:>6.2f}  总利息{interest:>10.2f}  [{method}]"
    )

print("=" * 95)
print(f"本金合计: {total_p:,}")
print(f"待还合计: {total_rem:,.2f} (应=310,943.38)  待还利息合计: {sum(x[5] for x in loans):.2f}")
print()
print(f"精确计算(8笔): {total_i_exact:,.2f} 元")
print(f"估算(5笔):     {total_i_est:,.2f} 元")
print(f"合计约:        {total_i_exact + total_i_est:,.2f} 元")

# 8笔精确明细
print("\n--- 8笔可精确计算的利息 ---")
exact_loans = [x for x in loans if x[6] is not None]
for f, d, P, rem, rp, ri, paid, _ in exact_loans:
    print(f"  {d} {P}: {sum(paid)+rem-P:.2f}")

print("\n--- 5笔还缺「已还明细」或「查看往期」---")
for f, d, P in need_more:
    print(f"  豆包({f}).png  {d} 借{P:,}元  -> 请点「已还明细」或「查看往期」截图")

# rem_interest only - floor estimate
rem_int_sum = sum(x[5] for x in loans)
print(f"\n13笔剩余待付利息(图里直接读到): {rem_int_sum:.2f} 元")
print(f"=> 总利息至少 {rem_int_sum:.2f} 元，已付利息约 {total_i_exact + total_i_est - rem_int_sum:.2f} 元(含估算)")
