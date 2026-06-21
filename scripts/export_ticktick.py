#!/usr/bin/env python3
"""导出「滴答清单唯一人生系统」完整配置 Markdown。

用法:
  python scripts/export_ticktick.py
  python scripts/export_ticktick.py -o docs/ticktick-life-os.md

不依赖 Russshare 网站运行；所有思考、存档、进度均在滴答维护。
"""
from __future__ import annotations

import argparse
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TAGS = [
    ("要紧", "本季主题、高优先级"),
    ("健康", "训练、睡眠"),
    ("财务", "还款、卖股"),
    ("阅读", "精读、笔记"),
    ("工作", "职业 KR、项目"),
    ("复盘", "周/月/季回顾"),
    ("笔记", "正文写在任务备注里"),
    ("决策", "重大选择，先写再动"),
    ("很有价值", "值得长期保留"),
]

LISTS = [
    ("00-方向", "宪法、阶段、不做清单（不设日期，置顶参考）"),
    ("01-OKR", "本季 4 条 KR，进度改任务标题或子任务勾选"),
    ("02-财务", "还款、卖股、核对；完成只在滴答勾"),
    ("03-训练", "习惯 + 周训练说明"),
    ("04-阅读", "在读书、精读提醒；笔记链到 07"),
    ("05-工作", "职业交付、每周节奏"),
    ("06-备忘", "生活杂事（默认不设今天）"),
    ("07-反思笔记", "反思/学习/月总结/季复盘 **正文写备注**"),
    ("08-决策日记", "卖股、借债、换工作等重大决策"),
    ("99-以后再说", "远期想法（不设日期）"),
]

REFLECT_TEMPLATES = {
    "daily": """## 今天最重要的事

## 做对了什么

## 做错了什么

## 下一步只保留 1 件事
""",
    "learning": """## 来源
书名 / 文章 / 课程：

## 摘录

## 3 条 takeaway
1.
2.
3.

## 1 条行动（写进 OKR 或工作清单）
""",
    "monthly": """## 本月最重要 3 件事
1.
2.
3.

## 五维一句话
- 财务：
- 健康：
- 阅读：
- 职业：
- 决策：

## 做对了 / 不再重复

## 下月 1 个重点
""",
    "quarterly": """## 本季亮点

## KR 回顾
| KR | 目标 | 实际 | 结果 | 反思 |
|----|------|------|------|------|

## 重大决策回顾

## 下季调整
- 不做：
- 健康底线：
- 职业：
""",
    "decision": """## 背景（事实，不带情绪）

## 选项（至少 2 个，含「不做」）

## 选择与理由

## 复盘日期（3 个月后的某一天设提醒）
""",
}


def strip_html(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text or ""))).strip()


def md_to_plain(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    return text.strip()


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_constitution() -> str:
    path = ROOT / "principles" / "life-constitution.md"
    if not path.exists():
        return "（见本地 principles/life-constitution.md）"
    raw = path.read_text(encoding="utf-8")
    lines = []
    for line in raw.splitlines():
        if line.startswith(">") or line.startswith("|") or line.startswith("---"):
            continue
        if line.strip().startswith("详述见") or line.strip().startswith("## 与 LCAI"):
            break
        lines.append(md_to_plain(line))
    return "\n".join(x for x in lines if x.strip())


def get_todo_item(finance: dict, todo_id: str) -> dict | None:
    for group in finance.get("todoGroups", []):
        for item in group.get("items", []):
            if item.get("id") == todo_id:
                return item
    return None


def pending_finance_todos(finance: dict, limit: int = 16) -> list[dict]:
    done = finance.get("baselineTodoDone", {})
    month_map = finance.get("monthTodoMap", {})
    result: list[dict] = []
    for month in sorted(month_map.keys()):
        for tid in month_map[month]:
            entry = done.get(tid)
            if entry and (entry is True or entry.get("done")):
                continue
            item = get_todo_item(finance, tid)
            if not item:
                continue
            result.append(
                {
                    "id": tid,
                    "month": month,
                    "text": strip_html(item.get("text", tid)),
                    "urgent": bool(item.get("urgent")),
                }
            )
            if len(result) >= limit:
                return result
    return result


def infer_due_hint(text: str) -> str:
    m = re.search(r"(\d{1,2}/\d{1,2})\s*前", text)
    if m:
        return m.group(1) + " 前"
    return "见任务文案"


def section_intro() -> str:
    return """# 复利人生 · 滴答清单唯一系统

> **只用滴答。** 执行、进度、笔记、复盘、决策记录 — 全部在滴答完成。
> 左上角 **今天** = 每日汇总（凡设了日期/重复的任务 + 习惯自动进入）。

## 原则

1. **一个入口**：每天只打开「今天」+ 习惯打卡
2. **长文写备注**：反思、读书笔记、决策 → 写在任务 **备注/描述** 里，勾完保留不删（当档案）
3. **OKR 进度**：改 `01-OKR` 里 KR 任务标题，如 `KR1 还债 85%` → 完成后改 100%
4. **财务**：只在 `02-财务` 勾选；还完后任务移「已完成」当记录
5. **收集箱**：48 小时内归类到对应清单，否则删

## 清单结构（文件夹：复利人生）

| 清单 | 放什么 | 进「今天」？ |
|------|--------|-------------|
"""


def section_lists_table() -> str:
    rows = ["| 清单 | 放什么 | 进「今天」？ |", "|------|--------|-------------|"]
    for name, desc in LISTS:
        today = "否" if name.startswith(("00", "06", "07", "08", "99")) else "重复/到期日则进"
        if name == "07-反思笔记":
            today = "仅「写笔记」重复任务进"
        rows.append(f"| **{name}** | {desc} | {today} |")
    return "\n".join(rows) + "\n"


def section_direction(goals: dict, constitution: str) -> str:
    theme = goals.get("theme", "清债重建")
    phase = goals.get("phase", {})
    until = phase.get("until", "2027-04")
    objective = goals.get("objective", "")
    not_do = goals.get("not_do", [])
    nd = "\n".join(f"- {x}" for x in not_do)
    return f"""## 00-方向 — 置顶参考（全部不设日期）

创建 3 条置顶任务，**无截止日期**，优先级低：

### 任务 A：本季主题

**标题：** {theme} · {phase.get('name', '偿债期')}至 {until}  
**备注：**
{objective}

### 任务 B：本季不做

**标题：** 本季不做（四条）  
**备注：**
{nd}

### 任务 C：人生宪法（全文贴备注）

**标题：** 人生宪法 · 重大决策前必读  
**备注：**
```
{constitution}
```

**人生阶段速查（贴同一备注或子任务）：**
- 偿债期（～{until}）：月存 2 万还债；不开仓；赛力斯不卖
- 积累期（{until}～2030）：定投 + 继续输出项目
- 复利期（2030+）：能力 × 资本 × 认知
"""


def section_okr(goals: dict) -> str:
    quarter = goals.get("quarter", {})
    qname = quarter.get("name", "本季")
    lines = [
        f"## 01-OKR — {qname}",
        "",
        "每个 KR = **1 条父任务** + 子任务/检查项。进度写在标题里，如 `(85%)`。",
        "",
    ]
    for kr in quarter.get("key_results", []):
        prog = kr.get("progress", 0)
        tgt = kr.get("target", 100)
        unit = kr.get("unit", "")
        lines.append(f"### {kr.get('id', 'kr').upper()} · {kr.get('title', '')} ({prog}/{tgt}{unit})")
        lines.append("")
        if kr.get("module") == "finance":
            lines.append("- 子任务：对照 02-财务 待办逐项勾选")
        elif kr.get("module") == "learning":
            books = kr.get("books", [])
            for bid in books:
                b = next((x for x in goals.get("season_books", []) if x.get("id") == bid), {})
                title = b.get("title", bid)
                status = b.get("status", "planned")
                lines.append(f"- [ ] 《{title}》({status}) — 笔记在 07-反思笔记")
        elif kr.get("module") == "health":
            lines.append("- 子任务：本季 12 个达标周（看 03-训练 习惯 streak）")
        elif kr.get("module") == "career":
            lines.append("- 子任务：见 05-工作 里程碑")
        lines.append("")
    lines.append("**每周日重复（01-OKR 或 07）：** 更新各 KR 标题中的进度数字 `#复盘`")
    lines.append("")
    return "\n".join(lines)


def section_habits(health: dict) -> str:
    lines = [
        "## 03-训练 — 习惯",
        "",
        "在滴答 **习惯** 中创建（归属 03-训练）：",
        "",
        "| 习惯 | 重复 |",
        "|------|------|",
    ]
    for p in health.get("pillars", []):
        lines.append(f"| {p.get('name')} | {p.get('dayLabel', '')} |")
    for d in health.get("daily", []):
        lines.append(f"| {d.get('label', '').split('（')[0]} | 每天 |")
    lines += ["", "**训练说明（贴对应习惯备注）：", ""]
    for p in health.get("pillars", []):
        lines.append(f"- **{p.get('name')}：** {p.get('instruction', '')}")
    for r in health.get("rules", []):
        lines.append(f"- {r}")
    lines.append("")
    return "\n".join(lines)


def section_finance(finance: dict) -> str:
    pending = pending_finance_todos(finance, limit=12)
    lines = [
        "## 02-财务 — 待办（设到期日 + 提前 3 天提醒）",
        "",
        "完成后在滴答勾选 → 移已完成。**进度以滴答为准。**",
        "",
        "| 任务 | 月份 | 优先级 | 到期 |",
        "|------|------|--------|------|",
    ]
    for t in pending:
        pri = "高" if t["urgent"] or "7/4" in t["text"] or "6/22" in t["text"] else "中"
        lines.append(f"| {t['text']} | {t['month']} | {pri} | {infer_due_hint(t['text'])} |")
    lines += [
        "",
        "**每月 1 日重复：** 核对下月还款节点是否已建任务 `#财务`",
        "",
        "**卖股 / 大额还债前：** 先在 08-决策日记 建任务写模板，再执行 02-财务",
        "",
    ]
    return "\n".join(lines)


def section_reading(goals: dict, learning: dict) -> str:
    books = goals.get("season_books", [])
    reading = next((b for b in books if b.get("status") == "reading"), None)
    planned = next((b for b in books if b.get("status") == "planned"), None)
    title = reading["title"] if reading else "在读书"
    next_title = planned["title"] if planned else "下本"
    weekly = learning.get("weeklyTarget", "≥140 分钟/周")
    prompts = "\n".join(f"- {p}" for p in learning.get("notePrompts", []))
    return f"""## 04-阅读

**本季：** {weekly} · 在读《{title}》· 下本《{next_title}》

| 任务 | 重复 | 标签 |
|------|------|------|
| 精读《{title}》≥ 20 分钟 | 周一至周五 | `#阅读` |
| 写学习记录（见 07 模板） | 每周日 | `#阅读` `#笔记` |

**读完一本：** 在 07 建任务「《书名》读完」备注贴摘要 → 04 改下一本书名 → 01-OKR 更新进度

**笔记 prompts（写进 07 备注）：**
{prompts}
"""


def section_work(career: dict) -> str:
    rhythm = "\n".join(
        f"| {r.get('block', '')} | {r.get('action', '')} | `#工作` |"
        for r in career.get("weeklyRhythm", [])
    )
    this_month = "\n".join(f"- {x}" for x in career.get("thisMonth", []))
    ms = "\n".join(
        f"- **{m.get('title')}**（{m.get('deadline', '')}）"
        + "".join(f"\n  - {s}" for s in m.get("steps", []))
        for m in career.get("milestones", [])
    )
    avoid = "\n".join(f"- {x}" for x in career.get("avoid", []))
    return f"""## 05-工作

**北极星：** {career.get('northStar', '')}

**本月交付：**
{this_month}

**里程碑：**
{ms}

**每周重复：**

| 块 | 动作 | 标签 |
|----|------|------|
{rhythm}

**避免：**
{avoid}
"""


def section_reflect_notes() -> str:
    parts = [
        "## 07-反思笔记 — 档案库",
        "",
        "所有长文 **写在任务备注**，完成后 **不要删**（当 searchable 档案）。",
        "可用标题格式：`2026-06-21 学习·原则` / `2026-06 月度总结`",
        "",
        "### 重复提醒（会进「今天」）",
        "",
        "| 任务 | 重复 | 标签 | 备注模板 |",
        "|------|------|------|----------|",
        "| 5 分钟日常反思 | 每天（可选）或每周 | `#复盘` `#笔记` | 日常 |",
        "| 写学习记录 | 每周日 | `#阅读` `#笔记` | 学习 |",
        "| 月度总结 | 每月 1 日 | `#复盘` `#笔记` | 月度 |",
        "| 季复盘 | 季末 | `#复盘` `#笔记` | 季度 |",
        "",
        "### 备注模板（复制进任务描述）",
        "",
    ]
    labels = {
        "daily": "日常反思",
        "learning": "学习记录",
        "monthly": "月度总结",
        "quarterly": "季复盘",
    }
    for key, label in labels.items():
        parts.append(f"#### {label}")
        parts.append("")
        parts.append("```")
        parts.append(REFLECT_TEMPLATES[key].strip())
        parts.append("```")
        parts.append("")
    return "\n".join(parts)


def section_decision() -> str:
    return f"""## 08-决策日记

**触发条件（须先建任务、写备注、再行动）：**
- 换工作 / 借新债
- 单笔卖仓 >10% 市值
- 改变季度 OKR
- 任何让你睡不着的钱相关决定

**任务标题格式：** `决策·卖微盟还京东` / `决策·是否接 XX offer`

**备注模板：**

```
{REFLECT_TEMPLATES['decision'].strip()}
```

写完后设 **3 个月后** 的复盘提醒子任务。
"""


def section_review_recurring() -> str:
    return """## 复盘节奏（全在滴答）

| 任务 | 重复 | 清单 | 做什么 |
|------|------|------|--------|
| 更新 OKR 进度数字 | 每周日 | 01-OKR | 改 KR 标题 (x/y) |
| 清空收集箱 | 每周日 | 收集箱 | 归类或删除 |
| 检查下月财务到期日 | 每月 1 日 | 02-财务 | 补任务 |
| 月度总结 | 每月 1 日 | 07 | 备注贴月度模板 |
| 季复盘 | 季末 | 07 | 备注贴季度模板 |
"""


def section_tags() -> str:
    lines = ["## 标签", "", "| 标签 | 用途 |", "|------|------|"]
    for tag, desc in TAGS:
        lines.append(f"| `#{tag}` | {desc} |")
    lines += [
        "",
        "「今天」视图：按标签或优先级分组。",
        "",
        "## 控制「今天」噪音",
        "",
        "**不设日期：** 00-方向、99-以后、06-备忘远期、07/08 里已写完的归档任务",
        "",
        "目标：今天 **6–10 条**（习惯 + 重复 + 临近财务）",
        "",
    ]
    return "\n".join(lines)


def section_daily_weekly() -> str:
    return """## 每日 / 每周

### 每日（2 分钟）

1. 打开 **今天**
2. 习惯打卡
3. 按优先级勾任务
4. 若任务带 `#笔记` → 先在备注写好 → 再勾选

### 每周日（15 分钟）

1. 更新 01-OKR 进度
2. 清空收集箱
3. 扫 02-财务 下月节点
4. 在 07 写周学习记录（若未写）

## 迁移检查清单

- [ ] 文件夹「复利人生」+ 10 个清单
- [ ] 00-方向 3 条置顶（含宪法全文在备注）
- [ ] 01-OKR 4 条 KR + 子任务
- [ ] 6 个习惯
- [ ] 02-财务 近期节点 + 到期日
- [ ] 04-阅读 重复任务
- [ ] 05-工作 每周节奏
- [ ] 07 反思模板任务 + 08 决策说明置顶
- [ ] 9 个标签
- [ ] 「今天」6–10 条合理
"""


def build_markdown() -> str:
    goals = load_json(ROOT / "goals" / "goals.json")
    health = load_json(ROOT / "health" / "plan.json")
    career = load_json(ROOT / "career" / "plan.json")
    learning = load_json(ROOT / "learning" / "plan.json")
    finance = load_json(ROOT / "finance" / "finance-config.json")
    constitution = load_constitution()

    parts = [
        section_intro(),
        section_lists_table(),
        "",
        section_direction(goals, constitution),
        "",
        section_okr(goals),
        "",
        section_habits(health),
        "",
        section_finance(finance),
        "",
        section_reading(goals, learning),
        "",
        section_work(career),
        "",
        section_reflect_notes(),
        "",
        section_decision(),
        "",
        section_review_recurring(),
        "",
        section_tags(),
        "",
        section_daily_weekly(),
        "",
        f"---\n\n*生成于 {date.today().isoformat()} · `python scripts/export_ticktick.py` 可刷新财务/OKR 数字*",
        "",
    ]
    return "\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export TickTick-only life OS markdown")
    parser.add_argument(
        "-o",
        "--output",
        default=str(ROOT / "docs" / "ticktick-life-os.md"),
        help="Output path (default: docs/ticktick-life-os.md)",
    )
    parser.add_argument(
        "--legacy",
        action="store_true",
        help="Also write docs/ticktick-tasks.md as symlink-style copy",
    )
    args = parser.parse_args()
    content = build_markdown()
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8")
    print(f"Wrote {out} ({len(content)} bytes)")
    legacy = ROOT / "docs" / "ticktick-tasks.md"
    legacy.write_text(content, encoding="utf-8")
    print(f"Wrote {legacy} (same content)")


if __name__ == "__main__":
    main()
