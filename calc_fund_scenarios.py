#!/usr/bin/env python3
"""基金赎回方案对比 · 8月凑钱 & 9-12月缺口"""

FUNDS = [
    ("天弘创业板指数增强 C", 412, -8),
    ("国金量化多因子股票 C", 4881, -119),
    ("华夏中证动漫游戏 ETF 联接 C", 15948, -3345),
    ("广发中证稀有金属 ETF 联接 C", 14387, -2034),
    ("广发中证军工 ETF 联接 C", 10448, -1467),
    ("易方达证券保险 ETF 联接 C", 11114, -973),
    ("富国医药创新股票 C", 17434, -3290),
]

AUG_NEED = 259_791
JD_AUG = 106_951
SALARY_JUL_AUG = 40_000
PINGAN_TOTAL = 308_375
PINGAN_SHARES = 40_700
PINGAN_PX = PINGAN_TOTAL / PINGAN_SHARES

MONTHLY = [
    ("2026-09", 60_319),
    ("2026-10", 43_426),
    ("2026-11", 43_752),
    ("2026-12", 44_218),
]
SALARY_MONTH = 20_000


def pingan_shares(amount: float) -> int:
    return round(amount / PINGAN_PX)


def aug_plan(fund_amount: float) -> dict:
    base = JD_AUG + fund_amount + SALARY_JUL_AUG
    gap = max(0, AUG_NEED - base)
    shares = pingan_shares(gap) if gap else 0
    return {
        "fund": fund_amount,
        "base": base,
        "gap": gap,
        "pingan_shares": shares,
        "pingan_amount": shares * PINGAN_PX,
        "pingan_left": PINGAN_SHARES - shares,
        "total": base + shares * PINGAN_PX,
    }


def sep_dec_gap(fund_sep_dec: float) -> dict:
    need = sum(m for _, m in MONTHLY)
    salary = SALARY_MONTH * len(MONTHLY)
    surplus = salary + fund_sep_dec - need
    return {
        "need": need,
        "salary": salary,
        "after_salary": need - salary,
        "fund_sep_dec": fund_sep_dec,
        "surplus": surplus,
    }


def main():
    total_fund = sum(v for _, v, _ in FUNDS)
    total_loss = sum(l for _, _, l in FUNDS)
    fuguo = next(v for n, v, _ in FUNDS if "富国" in n)

    scenarios = {
        "A_8月7只全赎": aug_plan(total_fund),
        "B_8月留富国赎6只": aug_plan(total_fund - fuguo),
        "C_等反弹10%后8月全赎": aug_plan(total_fund * 1.10),
    }

    sep_dec = {
        "A_基金已在8月用尽": sep_dec_gap(0),
        "B_原方案9-12月赎基金": sep_dec_gap(total_fund),
    }

    print("=== 基金持仓 ===")
    print(f"合计: {total_fund:,}  浮亏: {total_loss:,}")
    print(f"平安单价(估): {PINGAN_PX:.2f} 元/股")
    print()

    print("=== 8月凑 259,791 ===")
    for name, r in scenarios.items():
        pct = 100 * r["pingan_left"] / PINGAN_SHARES
        print(f"{name}:")
        print(f"  基金: {r['fund']:,.0f}  基础合计: {r['base']:,.0f}  缺口: {r['gap']:,.0f}")
        print(f"  平安卖出: ~{r['pingan_shares']:,} 股 (~{r['pingan_amount']:,.0f})  保留 ~{r['pingan_left']:,} 股 ({pct:.0f}%)")
        print()

    print("=== 9-12月 ===")
    for name, r in sep_dec.items():
        label = "缺口" if r["surplus"] < 0 else "余量"
        print(f"{name}:")
        print(f"  总需 {r['need']:,}  工资 {r['salary']:,}  基金 {r['fund_sep_dec']:,}")
        print(f"  扣工资后需 {r['after_salary']:,}  → {label} {abs(r['surplus']):,.0f}")
    print()

    rebound_save = total_fund * 0.10
    extra_pingan = pingan_shares(rebound_save)
    print(f"等反弹10%可多收回 ~{rebound_save:,.0f} 元，但8月需多卖平安 ~{extra_pingan} 股才等价")


if __name__ == "__main__":
    main()
