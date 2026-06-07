# lcai-portfolio

Personal investment portfolio dashboard with value-investing stock screener.

**在线访问：** https://riddlego.github.io/lcai-portfolio/

## 功能

| 栏目 | 说明 |
|------|------|
| 执行 / 还款 / 现金流 | 还债与资金计划 |
| 投资规划 / 诊断 / 持仓 | 组合管理与评价 |
| **选股** | 输入代码 → LCAI 研判 → 买入/观察/持有/减仓/卖出 |

## 本地使用

直接用浏览器打开 `资产总览.html`，选股 tab：`资产总览.html#screen`

## 选股 CLI

```bash
python 投资系统/engine/screen_stock.py 600519
python scripts/lcai_screen_json.py 600519          # 完整 JSON
bash scripts/run_lcai_analysis.sh 600519           # 写入 reports/
```

## 怎么用（给完全不懂技术的人）

1. 打开 [资产总览 → 选股](https://riddlego.github.io/lcai-portfolio/资产总览.html#screen)
2. 输入代码，点 **「帮我看看」** → 出 **综合研判**（买卖结论以 LCAI 为准）
3. 点 **「⭐ 收藏」** 加入「我的关注」，方便下次再看
4. **已在持仓/云端关注**的票 → **每周一自动**刷新报告，无需 Issue
5. **新票第一次** → 收藏后在新页面点一次绿色 **Submit** 入队，约 2–5 分钟生成；之后也每周自动

## 网页操作

| 你想干什么 | 怎么做 |
|------------|--------|
| 看能不能买 | **帮我看看**（已有缓存秒出） |
| 常看的票 | **⭐ 收藏** → **我的关注** |
| 持仓 / 云端关注 | **每周一自动**刷新 |
| **新票第一次** | 收藏 → GitHub **Submit 一次** → 等 2–5 分钟 |
| **买入加入持仓** | 研判后点 **「加入持仓」** → 填表 → GitHub **Submit** |
| **立刻更新全部** | 选股页 **🔄 立即更新全部报告** → GitHub **Run workflow** → 约 5–15 分钟 |

## 部署

GitHub Pages 托管于 `main` 分支根目录。行情工作日更新；`reports/*/unified.json` **每周一**由 Actions 全量刷新。

## 维护与新增股票

完整操作说明见 **[投资系统/08-日常维护手册.md](投资系统/08-日常维护手册.md)**。

**新增持仓（摘要）：**

1. **网页：** 选股 → 帮我看看 → **加入持仓** → GitHub Submit  
2. **或编辑** [`holdings.json`](holdings.json) → `python scripts/sync_holdings.py` → `python scripts/fetch_quotes.py`
