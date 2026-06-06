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
bash scripts/run_dual_analysis.sh 600519           # LCAI + UZI 双轨（需 clone UZI）
```

## 网页触发（无需 PAT）

| 操作 | 步骤 |
|------|------|
| **LCAI 研判** | 选股 Tab → **研判**（浏览器即时） |
| **UZI 云端研报** | **云端研报** → 提交 GitHub Issue → 本页自动轮询（约 3–10 分钟） |

确保仓库 [Issues 已开启](https://github.com/RiddleGo/lcai-portfolio/settings)。可选 Worker 见 [`workers/README.md`](workers/README.md)。

## 部署

GitHub Pages 托管于 `main` 分支根目录。行情由 Actions 工作日自动更新 `quotes-data.js`；研报由 `uzi-reports.yml` 每周更新 `reports/`。
