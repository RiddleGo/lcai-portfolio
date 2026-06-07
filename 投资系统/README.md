# 投资筛选系统

基于 [投资书单](../书籍/投资书单.md) 110 本书原则，构建可量化价值投资筛选引擎。

## 使用方式

### 网页（推荐）

打开 [资产总览 → 选股](../资产总览.html#screen)，输入 A 股/港股代码，点击「帮我看看」。

- A 股：`600519`、`601127`、`sh600519`
- 港股：`00700`、`09880`（财务走 `RPT_HKF10_FN_MAININDICATOR`）

### 命令行

```bash
python 投资系统/engine/screen_stock.py 600519
python 投资系统/engine/screen_stock.py 09880
bash scripts/run_lcai_analysis.sh 600519
```

## 目录

| 文件 | 说明 |
|------|------|
| `criteria.json` | 规则引擎唯一数据源 |
| `00-投资宪法.md` | 10 条不可违背原则 |
| `01-选股筛选标准.md` | 五层漏斗标准全文 |
| `06-评分与评级说明.md` | 打分与 A/B/C/D 评级 |
| `08-日常维护手册.md` | **使用与维护 SOP**（网页 [手册 Tab](../资产总览.html#handbook)） |
| `engine/` | Python 引擎 |
| [`../AGENTS.md`](../AGENTS.md) | Cursor 研判 SOP |
| [`../scripts/run_lcai_analysis.sh`](../scripts/run_lcai_analysis.sh) | 本地一键写入 reports |

## 判定说明

| 判定 | 含义 |
|------|------|
| 买入 | L1-L3 硬指标全过 + 安全边际≥25% |
| 观察 | 生意尚可，价格或财务未达标 |
| 持有 | 已持仓且逻辑未破 |
| 减仓 | 已持仓且估值偏高 |
| 卖出 | 已持仓且 thesis 证伪 |
| 排除 | 触发否决项 |

**免责声明**：输出为研究辅助，不构成投资建议。
