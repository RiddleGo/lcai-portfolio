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

## UZI-Skill 结合

- Agent 指令：[`AGENTS.md`](AGENTS.md)
- 对照说明：[`投资系统/08-UZI对照说明.md`](投资系统/08-UZI对照说明.md)
- 缓存研报：[`reports/`](reports/)（CI 每周为持仓生成 `lcai-vs-uzi.json`）
- UZI 安装：`git clone https://github.com/wbh604/UZI-Skill.git .vendor/UZI-Skill`

**原则**：LCAI `criteria.json` 为最终裁决；UZI 价值派（school A,E）为第二意见。

## 部署

GitHub Pages 托管于 `main` 分支根目录。行情由 Actions 工作日自动更新 `quotes-data.js`；研报由 `uzi-reports.yml` 每周更新 `reports/`。
