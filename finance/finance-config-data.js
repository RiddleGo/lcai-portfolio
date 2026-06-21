window.FINANCE_CONFIG = {
  "version": 1,
  "todoStorageKey": "lcai-exec-todos-v9",
  "overridesKey": "lcai-portfolio-overrides",
  "constants": {
    "jdPrepayAmount": 75122.86,
    "jdDebtTotal": 209352.52,
    "dyDebtTotal": 0,
    "dyClearAmount": 160000,
    "hbCashBeforeDyClear": 167202.69,
    "dyRateAnnual": 16.2,
    "dyLoanDate": "2026-06-17",
    "dyMonthly": 14532.08,
    "julJdPay": 34145.47,
    "fundTotal": 63352.29,
    "weimobJulEst": 43260,
    "tencentAugEst": 79600,
    "pinganAugSell": 8500,
    "pinganAugEst": 65700,
    "monthlySavings": 20000,
    "jdHealthShares": 800
  },
  "baselineTodoDone": {
    "jun-sell-mgt": {
      "done": true,
      "actual": 167090
    },
    "jun-sell-ubtech": {
      "done": true,
      "actual": 120000
    },
    "jun-didi-pay": {
      "done": true
    },
    "jun-dy-pay": {
      "done": true
    },
    "jun-jd-prepay": {
      "done": true,
      "actual": 75122.86
    },
    "jun-jd-swap": {
      "done": true
    },
    "jun-seres-envicool": {
      "done": true
    },
    "jun-sell-jd-dy": {
      "done": true
    },
    "jun-dy-clear160": {
      "done": true,
      "actual": 160000
    },
    "jul-sell-jd": {
      "done": true
    },
    "aug-sell-jd": {
      "done": true
    },
    "jul-dy-pay": {
      "done": true
    }
  },
  "baseline": {
    "debts": {
      "jd": 209352.52,
      "ali": 150254.22,
      "dy": 0,
      "didi": 0,
      "personal": 200000
    },
    "debtCounts": {
      "jd": 9,
      "ali": 1,
      "dy": 0,
      "didi": 0,
      "personal": 1
    },
    "funds": [
      {
        "id": "f1",
        "name": "天弘创业板指数增强 C",
        "amount": 500.58,
        "pnl": -19.42,
        "redeemed": false
      },
      {
        "id": "f2",
        "name": "国金量化多因子股票 C",
        "amount": 5115.06,
        "pnl": -184.94,
        "redeemed": false
      },
      {
        "id": "f3",
        "name": "华夏中证动漫游戏 ETF 联接 C",
        "amount": 15948,
        "pnl": -3345,
        "redeemed": true
      },
      {
        "id": "f4",
        "name": "广发中证稀有金属 ETF 联接 C",
        "amount": 14387,
        "pnl": -2034,
        "redeemed": true
      },
      {
        "id": "f5",
        "name": "广发中证军工 ETF 联接 C",
        "amount": 10448,
        "pnl": -1467,
        "redeemed": true
      },
      {
        "id": "f6",
        "name": "易方达证券保险 ETF 联接 C",
        "amount": 25893.55,
        "pnl": -152.75,
        "redeemed": false
      },
      {
        "id": "f7",
        "name": "富国医药创新股票 C",
        "amount": 31843.1,
        "pnl": -2629.2,
        "redeemed": false
      }
    ],
    "accountCash": {
      "gt": 0,
      "hb": 7202.690000000002
    },
    "accountCashReserve": {}
  },
  "todoGroups": [
    {
      "title": "6 月 · 已完成",
      "items": [
        {
          "id": "jun-sell-mgt",
          "text": "卖出麦格米特 <strong>1,100 股</strong>（华宝 · 已到账）",
          "effect": "sell_all",
          "holdingId": "megmeet",
          "defaultAmount": 167090
        },
        {
          "id": "jun-sell-ubtech",
          "text": "卖出优必选 <strong>1,150 股</strong>（国投 · 实际 <strong>12 万</strong>）",
          "effect": "sell_all",
          "holdingId": "ubtech",
          "defaultAmount": 120000
        },
        {
          "id": "jun-didi-pay",
          "text": "提前结清滴滴 <strong>103,111</strong>（已完成）",
          "effect": "debt_clear",
          "platform": "didi",
          "defaultAmount": 103111.27
        },
        {
          "id": "jun-dy-pay",
          "text": "结清抖音 <strong>162,179</strong>（已完成 · 首月免息期内）",
          "effect": "debt_clear",
          "platform": "dy",
          "defaultAmount": 162179.31
        },
        {
          "id": "jun-jd-prepay",
          "text": "额外还京东 <strong>~75,123</strong>（31.1 万→23.6 万 · 省息 · 已反映在债务余额）",
          "defaultAmount": 75122.86
        },
        {
          "id": "jun-jd-swap",
          "text": "京东健康 <strong>4,650→200 股</strong> · 换仓腾讯 <strong>200 股</strong> + 微盟 <strong>38,000 股</strong>（已完成 · 截图同步）",
          "defaultAmount": 167932
        },
        {
          "id": "jun-seres-envicool",
          "text": "赛力斯 <strong>4,200→3,000 股</strong> · 挪仓英维克 <strong>1,000 股</strong> + 清仓华宝 5 只（6/18 截图同步）",
          "defaultAmount": 74253
        },
        {
          "id": "jun-dy-clear160",
          "text": "结清抖音 <strong>160,000</strong>（6/19 · 华宝现金 <strong>−16 万</strong> · 抖音清零）",
          "effect": "debt_clear",
          "platform": "dy",
          "defaultAmount": 160000
        }
      ]
    },
    {
      "title": "6 月 · 待办",
      "items": [
        {
          "id": "jun-ali-pay",
          "text": "还支付宝 <strong>14,661</strong>（6/22 前 · <strong>用 6 月工资 2 万</strong>）",
          "effect": "debt_pay",
          "pay": {
            "ali": 14660.75
          },
          "defaultAmount": 14660.75
        }
      ]
    },
    {
      "title": "7 月",
      "items": [
        {
          "id": "jul-sell-weimob",
          "text": "卖出微盟 <strong>38,000 股</strong>（<strong>7/3 前</strong> · 约 <strong>4.5 万</strong> · 凑 7/4 京东）",
          "urgent": true,
          "effect": "sell_all",
          "holdingId": "weimob",
          "defaultAmount": 43260
        },
        {
          "id": "jul-jd-pay",
          "text": "还京东金条 <strong>34,145</strong>（7/4 前 · 卖微盟回款）",
          "urgent": true,
          "effect": "debt_pay",
          "pay": {
            "jd": 34145.47
          },
          "defaultAmount": 34145.47
        },
        {
          "id": "jul-ali-pay",
          "text": "还支付宝 <strong>14,761</strong>（7/22 前 · 微盟余款 + 7 月储蓄 2 万）",
          "effect": "debt_pay",
          "pay": {
            "ali": 14761.3
          },
          "defaultAmount": 14761.3
        }
      ]
    },
    {
      "title": "8 月",
      "items": [
        {
          "id": "aug-fund",
          "text": "赎回理财通 4 只基金（<strong>7/25 前</strong> · ~6.34 万 · T+1）",
          "effect": "fund_redeem_all",
          "defaultAmount": 63352.29
        },
        {
          "id": "aug-sell-tencent",
          "text": "卖出腾讯 <strong>200 股</strong>（<strong>7/28～8/1</strong> · 约 <strong>8.0 万</strong>）",
          "effect": "sell_all",
          "holdingId": "tencent",
          "defaultAmount": 79600
        },
        {
          "id": "aug-sell-pa",
          "text": "卖出平安好医生 <strong>~8,500 股</strong>（留 ~81% · 约 <strong>6.6 万</strong>）",
          "effect": "sell_partial",
          "holdingId": "pingan",
          "sellShares": 8500,
          "defaultAmount": 65700
        },
        {
          "id": "aug-jd-pay",
          "text": "还京东金条 <strong>~39,930</strong>（8/4 前 · 按余额估算）",
          "effect": "debt_pay",
          "pay": {
            "jd": 39930.19
          },
          "defaultAmount": 39930.19
        },
        {
          "id": "aug-friend",
          "text": "还朋友 <strong>200,000</strong>（8 月中下旬 · 卖股+赎基金到账后）",
          "effect": "debt_clear",
          "platform": "personal",
          "defaultAmount": 200000
        },
        {
          "id": "aug-ali-pay",
          "text": "还支付宝 <strong>14,815</strong>（8/22 前）",
          "effect": "debt_pay",
          "pay": {
            "ali": 14815.43
          },
          "defaultAmount": 14815.43
        }
      ]
    },
    {
      "title": "2026 下半年",
      "items": [
        {
          "id": "sep-pay",
          "text": "2026-09 还平台 <strong>60,319</strong>",
          "effect": "debt_pay",
          "pay": {
            "jd": 45424.53,
            "ali": 14894.26
          },
          "defaultAmount": 60318.79
        },
        {
          "id": "oct-pay",
          "text": "2026-10 还平台 <strong>43,426</strong>",
          "effect": "debt_pay",
          "pay": {
            "jd": 28434.81,
            "ali": 14990.5
          },
          "defaultAmount": 43425.31
        },
        {
          "id": "nov-pay",
          "text": "2026-11 还平台 <strong>43,752</strong>",
          "effect": "debt_pay",
          "pay": {
            "jd": 28695.95,
            "ali": 15055.54
          },
          "defaultAmount": 43751.49
        },
        {
          "id": "dec-pay",
          "text": "2026-12 还平台 <strong>44,218</strong>",
          "effect": "debt_pay",
          "pay": {
            "jd": 29068.96,
            "ali": 15148.8
          },
          "defaultAmount": 44217.76
        }
      ]
    },
    {
      "title": "2027 清尾",
      "items": [
        {
          "id": "y27-01",
          "text": "2027-01 还平台 <strong>~44,580</strong>",
          "effect": "debt_pay",
          "pay": {
            "jd": 29358.51,
            "ali": 15221.38
          },
          "defaultAmount": 44579.89
        },
        {
          "id": "y27-02",
          "text": "2027-02 还平台 <strong>~45,002</strong>",
          "effect": "debt_pay",
          "pay": {
            "jd": 29695.29,
            "ali": 15306.0
          },
          "defaultAmount": 45001.29
        },
        {
          "id": "y27-03",
          "text": "2027-03 还平台 <strong>~36,903</strong>",
          "effect": "debt_pay",
          "pay": {
            "jd": 21501.86,
            "ali": 15400.26
          },
          "defaultAmount": 36902.12
        },
        {
          "id": "y27-04",
          "text": "2027-04 京东末笔 <strong>~8,944</strong> → 平台债清零",
          "effect": "debt_pay",
          "pay": {
            "jd": 8943.56
          },
          "defaultAmount": 8943.56
        }
      ]
    }
  ],
  "monthTodoMap": {
    "2026-06": [
      "jun-ali-pay"
    ],
    "2026-07": [
      "jul-sell-weimob",
      "jul-jd-pay",
      "jul-ali-pay"
    ],
    "2026-08": [
      "aug-fund",
      "aug-sell-tencent",
      "aug-sell-pa",
      "aug-jd-pay",
      "aug-friend",
      "aug-ali-pay"
    ],
    "2026-09": [
      "sep-pay"
    ],
    "2026-10": [
      "oct-pay"
    ],
    "2026-11": [
      "nov-pay"
    ],
    "2026-12": [
      "dec-pay"
    ],
    "2027-01": [
      "y27-01"
    ],
    "2027-02": [
      "y27-02"
    ],
    "2027-03": [
      "y27-03"
    ],
    "2027-04": [
      "y27-04"
    ]
  },
  "months": [
    {
      "label": "2026-06",
      "jd": null,
      "didi": null,
      "dy": null,
      "ali": 14660.75,
      "personal": null,
      "peak": false
    },
    {
      "label": "2026-07",
      "jd": 34145.47,
      "didi": null,
      "dy": null,
      "ali": 14761.3,
      "personal": null,
      "peak": true
    },
    {
      "label": "2026-08",
      "jd": 39930.19,
      "didi": null,
      "dy": null,
      "ali": 14815.43,
      "personal": 200000,
      "aug": true
    },
    {
      "label": "2026-09",
      "jd": 40326.41,
      "didi": null,
      "dy": null,
      "ali": 14894.26,
      "personal": null
    },
    {
      "label": "2026-10",
      "jd": 25245.47,
      "didi": null,
      "dy": null,
      "ali": 14990.5,
      "personal": null
    },
    {
      "label": "2026-11",
      "jd": 25473.47,
      "didi": null,
      "dy": null,
      "ali": 15055.54,
      "personal": null
    },
    {
      "label": "2026-12",
      "jd": 25806.47,
      "didi": null,
      "dy": null,
      "ali": 15148.8,
      "personal": null
    },
    {
      "label": "2027-01",
      "jd": 26071.47,
      "didi": null,
      "dy": null,
      "ali": 15221.38,
      "personal": null
    },
    {
      "label": "2027-02",
      "jd": 26370.47,
      "didi": null,
      "dy": null,
      "ali": 15306.0,
      "personal": null
    },
    {
      "label": "2027-03",
      "jd": 19089.47,
      "didi": null,
      "dy": null,
      "ali": 15400.26,
      "personal": null
    },
    {
      "label": "2027-04",
      "jd": 7939.47,
      "didi": null,
      "dy": null,
      "ali": null,
      "personal": null,
      "light": true
    }
  ]
};
