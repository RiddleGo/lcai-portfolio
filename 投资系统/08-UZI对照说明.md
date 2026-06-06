# LCAI × UZI 融合说明

> **网页已合并为一份「综合研判」**：买卖仍只认 LCAI；UZI 价值派材料写入各层解读。详见 [AGENTS.md](../AGENTS.md)。

## 定位

| | LCAI | UZI-Skill |
|--|------|-----------|
| 角色 | 个人投资宪法 + 资产总览 | 研究助理，材料并入综合研判 |
| 规则 | 25+ 条（criteria.json） | 236 条 × 65 评委（锁 A,E） |
| 判定 | 买入/观察/持有/减仓/卖出/排除 | 定调/共识 → **不覆盖** LCAI 裁决 |
| 深度 | 浏览器秒级（缓存） | 每周一 Actions 自动 lite（持仓+关注） |

## 何时只跑 LCAI / 何时补 UZI

| 场景 | 操作 |
|------|------|
| 日常快速筛 | **帮我看看**（秒出，已有 unified 则自动 enrich） |
| 观察池反复看 | **我的关注** 点一下 |
| 建仓前 / 要 DCF+排雷厚材料 | 已在持仓/云端关注 → **每周一自动** |
| **新票第一次** | 网页 **收藏** → Issue **Submit 一次** → 入 `watchlist-data.js` + 生成报告 |
| 每周 | Actions **全量**刷新持仓 + 云端关注（`--all --run-uzi`） |

## 融合报告结构（`reports/{code}/unified.json`）

| 字段 | 来源 |
|------|------|
| `verdict` | **仅 LCAI** |
| `executive` / `valuation` / `layers` | LCAI 为主 + UZI 并入 |
| `divergences` | 两边不一致时显式列出 |
| `uzi.ready` | 是否已跑 UZI lite |

## 规则对照

| LCAI | UZI 近似 | 说明 |
|------|----------|------|
| L0-05 造假嫌疑 | trap-detector + ocf | 利润与现金流背离 |
| L0-06 异常票特征 | scan-trap | 杀猪盘/庄股特征 |
| L1-01 ROE | 基本面 + 价值派 A 组 | 资本回报 |
| L2-01 OCF/EPS | 现金流维度 | 利润含金量 |
| L3-01 安全边际 | PE×EPS 公允价 | 格雷厄姆 25% |
| L3-06 DCF 交叉 | compute_dcf | 两阶段 DCF 交叉验证 |
| L4 能力圈/心理 | manual | 两边均主观勾选 |

## 判定映射（参考，非强制等价）

| LCAI | UZI 定调（价值派锁 A,E 时） |
|------|----------------------------|
| 买入 | 值得重仓 / 可以蹲一蹲 |
| 观察 | 可以蹲一蹲 / 观望优先 |
| 持有 | 观望优先（已持仓逻辑在 LCAI） |
| 减仓/卖出 | 谨慎 / 回避 |
| 排除 | 回避 |

## 常见分歧及解读

### 1. 好公司 + 不够便宜（典型：茅台 600519）

- **LCAI**：L3-01 安全边际 Fail → **观察**
- **UZI**：fund 分高、价值派 neutral → **可以蹲一蹲**
- **解读**：生意认可，等价格；不矛盾，LCAI 不开仓直到 ≥25% 边际

### 2. LCAI 排除 vs UZI 成长派看多

- **原因**：UZI 全流派时 B 组成长派可给高分
- **处理**：对比时只用 `--school A,E`；全流派报告仅作背景

### 3. DCF 与 PE×EPS 公允价差异

- **LCAI L3-01**：行业公允 PE × 最新 EPS
- **LCAI L3-06**：简化两阶段 DCF（WACC 9%，g 2.5%）
- **UZI DCF**：完整 WACC 拆解 + 敏感性表
- **解读**：三者方向一致即可；数值差 10–20% 正常

## 综合研判输出模板

```
【最终】LCAI：观察 · Fail L3-01 · 评级 D · 上限 0%
【并入】UZI（A,E）：可以蹲一蹲 · 共识 57 · DCF 公允 XXX
分歧：LCAI 未达 25% 边际；UZI 亦偏贵 — 均建议观察
行动：观察池，触发价 = 公允 × 0.75
```

## 文件与命令

```bash
bash scripts/run_dual_analysis.sh 600519
python scripts/generate_uzi_reports.py --symbol 600519 --skip-uzi
python scripts/lcai_screen_json.py 600519
# 网页：资产总览.html#screen → 综合研判
# 缓存：reports/600519/unified.json（兼容 lcai-vs-uzi.json）
```
