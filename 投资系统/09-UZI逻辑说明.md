# UZI 逻辑说明

> 读完本文可理解：UZI 怎么打分、和 LCAI 什么关系、网页上的「综合研判」到底是什么。

## 一句话

- **LCAI**：你的投资宪法 → 给出 **买卖裁决**（买入/观察/持有/减仓/卖出/排除）。
- **UZI-Skill**：外部深度研报引擎 → 给出 **研究材料**（定调、共识分、DCF、HTML 研报），**不覆盖** LCAI 裁决。

网页上是 **一份综合研判** = LCAI 最终结论 + 可选深度附录，不是两个并列的买卖结论。

---

## UZI 是什么

[UZI-Skill](https://github.com/wbh604/UZI-Skill) 是独立开源项目。本仓库在 GitHub Actions 里临时 clone 到 `.vendor/UZI-Skill`（不提交到 git）。

输入股票代码后，UZI 会：

1. 采集 **22 维** 免费数据（East Money、雪球、cninfo 等）
2. 跑 **17 种** 机构方法（DCF、Comps、排雷、龙虎榜等）
3. 用 **65 位评委 × 236 条规则** 做规则引擎骨架分
4. **Agent 介入**（role-play 评委，可 override 机械分，需给理由）
5. 合成 **synthesis.json**（定调 tone、overall 分）并生成 HTML 研报
6. **self_review 自查**（数据覆盖率过低、行业分类错等 → 不出 HTML）

---

## UZI 评分逻辑（和 LCAI 不同）

### 1. 基本面分 `fund_score`

22 个维度汇总的基本面质量分（约 0–100）。

### 2. 评委共识 `consensus`

- 65 位评委分 A–I 组（价值/成长/宏观/技术/中国价投/游资/量化等）
- 每人命中规则后给出 bullish / neutral / bearish
- 混合公式（v2.11）：`consensus = (bullish + 0.6×neutral) / active`

### 3. 综合分 `overall`

```
overall = fund_score × 0.6 + consensus × 0.4
```

映射为 **定调 tone**（不是 LCAI 六档 verdict）：

| overall | UZI 定调（示例） |
|---------|------------------|
| ≥80 | 值得重仓 |
| ≥65 | 可以蹲一蹲 |
| ≥50 | 观望优先 |
| ≥35 | 谨慎 |
| <35 | 回避 |

### 4. LCAI 里怎么跑 UZI

Actions 默认（见 `scripts/generate_uzi_reports.py`）：

```bash
python run.py 600519 --depth lite --no-browser --school A,E
```

- **lite**：约 1–3 分钟（持仓+关注列表批量用）
- **school A,E**：只锁价值派 + 中国价投，避免成长/游资派与宪法冲突

---

## LCAI 怎么用 UZI 的结果

```
每周 Actions
  → lcai_screen_json.py        → lcai.json（裁决）
  → UZI run.py                 → .cache/.../synthesis.json
  → build_unified_report.py    → unified.json（融合）
  → GitHub Pages「帮我看看」读缓存
```

LCAI **会读取**（`parse_uzi_enrichment`）：

- `tone`（定调文案）
- `consensus` / `fund_score`
- `dcf_fair_value` / `dcf_margin_pct`
- `risk_flags` / `strengths` / `weaknesses`

LCAI **不会**：

- 用 UZI 的 overall 分改写 `verdict`
- 用 UZI 定调覆盖 25% 安全边际建仓线

`unified.json` 里：

- `verdict` → **仅 LCAI**
- `layers[].uzi_insight` → UZI 补充解读
- `uzi.ready` → 是否已跑完 UZI（完整 HTML 按钮是否可用）

---

## LCAI vs UZI 对照

| 维度 | LCAI | UZI |
|------|------|-----|
| 规则 | ~25 条 `criteria.json` | 236 条 × 65 评委 |
| 性质 | 固定阈值、可复盘 | 多维打分 + Agent 可 override |
| 输出 | 六档 verdict + 最终结论 | tone + HTML 研报 |
| 速度 | 秒级（缓存） | 分钟级（CI） |
| 持仓 | 有（已持仓分支） | 无 |

已有规则映射见 [08-UZI对照说明.md](08-UZI对照说明.md)（如 L0-06 ↔ scan-trap，L3-06 ↔ DCF）。

---

## 为什么不把 UZI 236 条全写进 LCAI

1. 体量过大，且流派间会冲突
2. 你的 [00-投资宪法.md](00-投资宪法.md) 要求单一可执行标准（25% 边际、单票上限）
3. UZI 含 Agent 润色，同一票两次跑可能略有差异；LCAI 需稳定可复盘
4. 价值派核心已部分进 LCAI（ROE、OCF、安全边际、trap、DCF）

---

## 本仓库采用策略

**保持 LCAI 裁决 + UZI 作可选深度附录（方案 C + 文案单轨 D）**

- 架构不变：每周 Actions 仍跑 UZI lite（A,E） enrich
- 文案统一：页面称「LCAI 结论 + 深度附录」，不再强调「双轨」
- 买卖只看 **最终结论** 卡片与 LCAI `verdict`

---

## 相关文件

| 文件 | 作用 |
|------|------|
| [08-UZI对照说明.md](08-UZI对照说明.md) | 规则对照、分歧解读 |
| [AGENTS.md](../AGENTS.md) | Cursor 研判 SOP |
| `scripts/generate_uzi_reports.py` | 调 UZI + 写 unified |
| `scripts/build_unified_report.py` | 融合 enrich |
| `.github/workflows/uzi-reports.yml` | 每周自动 |
