# ETF 分批计划 · 使用说明

10 万科技 ETF（宽基 + 半导体 + AI + 机器人）的**每日检测与加仓提醒**。

## 计划文件

| 文件 | 作用 |
|------|------|
| `投资系统/etf-plan.json` | 目标仓位、三批次、回调规则（可改） |
| `etf-plan-state.json` | 已买入记录、已完成批次 |
| `etf-plan-data.js` | 每日检测结果（网页读取） |

## 每日自动检测

**GitHub Actions**（已配置）：工作日北京时间约 **15:35** 收盘后运行，更新 `etf-plan-data.js` 并推送。

**本地手动**：

```bash
python scripts/check_etf_plan.py
```

或双击 `scripts/run_etf_plan_check.bat`

## 网页查看

打开 [资产总览.html#etf](资产总览.html#etf) → **ETF** 页：

- 绿色横幅 = 今日建议加仓
- 显示现价、20 日高点、回落幅度、触发价
- 可开浏览器通知（首次需允许）

## 买入后登记

```bash
# 记录买入 588000 共 10000 元
python scripts/check_etf_plan.py --done 588000 10000

# 第一笔全部买完
python scripts/check_etf_plan.py --complete-batch batch1
```

## 触发规则（摘要）

| 批次 | 规则 |
|------|------|
| batch1 | 立即：588000 1万 + 562500/159819 各 0.5万 |
| batch2 | 较近 20 日高点回落 ≥5%，或截止 2026-06-30 |
| batch3 | 截止 2026-08-09 配满剩余 |

## Windows 定时提醒（可选）

任务计划程序 → 创建任务 → 每天 15:40 → 运行：

```
d:\LCAI\scripts\run_etf_plan_check.bat
```

## 注意

- 6～8 月有还款压力，现金不足时暂停 batch，勿借贷加仓（见 `etf-plan.json` → `rules.cashFlowNote`）
- 研究辅助，非投资建议
