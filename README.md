# lcai-portfolio

Personal investment portfolio dashboard with value-investing stock screener.

**在线访问：** https://riddlego.github.io/lcai-portfolio/

## 功能

| 栏目 | 说明 |
|------|------|
| 执行 / 还款 / 现金流 | 还债与资金计划 |
| 投资规划 / 诊断 / 持仓 | 组合管理与评价 |
| **选股** | 输入代码 → 量化研判 → 买入/观察/持有/减仓/卖出 |

## 本地使用

直接用浏览器打开 `资产总览.html`，选股 tab：`资产总览.html#screen`

## 选股 CLI

```bash
python 投资系统/engine/screen_stock.py 600519
python scripts/lcai_screen_json.py 600519          # 完整 JSON
bash scripts/run_dual_analysis.sh 600519           # 本地 CLI 融合（需 clone UZI）
```

## 怎么用（给完全不懂技术的人）

1. 打开 [资产总览 → 选股](https://riddlego.github.io/lcai-portfolio/资产总览.html#screen)
2. 输入代码，点 **「帮我看看」** → 几秒出 **综合研判**（买卖结论以 LCAI 为准）
3. 需要更厚的价值派深度 → 点 **「⭐ 收藏并补全深度分析」** → 新页面点绿色 Submit → 回来等着
4. 以后在 **「我的关注」** 里点一下；**每周一** 自动更新 LCAI 部分

## 网页触发（无需 PAT）

| 你想干什么 | 点哪个 |
|------------|--------|
| 看能不能买 | **帮我看看** |
| 补 UZI 深度材料 | **⭐ 收藏并补全深度分析**（每只票 Issue 一次） |
| 以后再来看 | **我的关注** |

## 部署

GitHub Pages 托管于 `main` 分支根目录。行情工作日更新；`reports/*/unified.json` 每周由 Actions 刷新。
