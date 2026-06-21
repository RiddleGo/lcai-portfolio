# LCAI 规则引擎

## 背景

个人价值投资需要可复现、可回测的买卖裁决，不能依赖临场感觉。

## 做法

- 25+ 条规则单源 [`criteria.json`](../../投资系统/criteria.json)
- 浏览器 [`screen-engine.js`](../../screen-engine.js) 与 Python [`screen_engine.py`](../../投资系统/engine/screen_engine.py) 双引擎 parity
- CI 每周生成 `reports/*/unified.json`

## 结果

- 同一输入 → 同一裁决（买入/观察/持有/减仓/卖出）
- 书籍笔记可 merge 为候选规则（book-rules 流水线）

## 沉淀技能

Python 数据管道 · 规则引擎设计 · GitHub Actions

---

[← 职业](../index.html)
