#!/usr/bin/env python3
"""从 Russshare 数据源导出滴答清单可复制任务清单。

用法:
  python scripts/export_ticktick.py
  python scripts/export_ticktick.py -o docs/ticktick-tasks.md

输出 Markdown，供在滴答清单中手工创建任务/习惯时复制。
"""
from __future__ import annotations

import argparse
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_BASE = "https://riddlego.github.io/lcai-portfolio"

TAGS = [
    ("要紧", "本季主题、高优先级"),
    ("健康", "训练、睡眠"),
    ("财务", "还款、卖股"),
    ("阅读", "精读、笔记"),
    ("工作", "职业 KR、项目"),
    ("复盘", "周/月/季回顾"),
    ("很有价值", "值得写进 reflect"),
    ("网站写", "勾之前须去网站写正文"),
]

FOLDER_RENAME = [
    ("WHERE AM I", "00-方向", "阶段/不做清单/链接（任务不设日期）"),
    ("BUY LESS", "02-财务", "还款、卖股、少买决策"),
    ("训练计划", "03-训练", "周训练 + 习惯"),
    ("BOOK IN", "04-阅读", "在读书、笔记提醒"),
    ("工作任务", "05-工作", "职业 KR、项目交付"),
    ("个人备忘", "06-备忘", "生活杂事（默认不进今天）"),
    ("On The Way", "99-以后再说", "远期想法（不设日期）"),
]


def strip_html(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text or ""))).strip()


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def url(path: str) -> str:
    p = path.lstrip("/")
    return f"{SITE_BASE}/{p}"


def get_todo_item(finance: dict, todo_id: str) -> dict | None:
    for group in finance.get("todoGroups", []):
        for item in group.get("items", []):
            if item.get("id") == todo_id:
                return item
    return None


def pending_finance_todos(finance: dict, limit: int = 12) -> list[dict]:
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
        return m.group(1) + " 前（见文案）"
    m = re.search(r"(\d{4}-\d{2}-\d{2})", text)
    if m:
        return m.group(1)
    return "见财务计划"


def section_folder() -> str:
    lines = [
        "## 第一步：文件夹与清单改名",
        "",
        "在滴答新建文件夹 **复利人生**，将现有清单移入并改名：",
        "",
        "| 现有清单 | 新名称 | 说明 |",
        "|---------|--------|------|",
    ]
    for old, new, desc in FOLDER_RENAME:
        lines.append(f"| {old} | **{new}** | {desc} |")
    lines += [
        "",
        "**收集箱**留在文件夹外，作 48 小时快速捕获。",
        "",
        "左上角 **今天** = 全站汇总（凡设了今天日期/重复的任务自动汇集），不必再建「01-今日」清单。",
        "",
    ]
    return "\n".join(lines)


def section_direction(goals: dict) -> str:
    theme = goals.get("theme", "清债重建")
    phase = goals.get("phase", {})
    until = phase.get("until", "2027-04")
    not_do = goals.get("not_do", [])
    nd = "\n".join(f"   - {x}" for x in not_do)
    return f"""## 第二步：00-方向 — 4 条置顶（不设日期）

在 **00-方向** 创建 4 条任务：优先级低、**无截止日期**、置顶。

### 1. 本季主题

**标题：** 本季主题：{theme} · 偿债期至 {until}  
**备注：** {url("goals/index.html")}

### 2. 本季不做

**标题：** 本季不做（四条铁律）  
**正文/备注：**
{nd}

### 3. 构建路径

**标题：** 构建路径：宪法 → OKR → 今天 → 反思 → 季复盘  
**备注：** {url("index.html")}

### 4. 人生宪法

**标题：** 人生宪法（重大决策前必读）  
**备注：** {url("principles/index.html")}

每周日扫一眼即可，不必勾选。
"""


def section_habits(health: dict) -> str:
    lines = [
        "## 第三步：习惯（清单归属 03-训练）",
        "",
        "在滴答 **习惯** 中创建：",
        "",
        "| 习惯 | 重复 | 说明 |",
        "|------|------|------|",
    ]
    for p in health.get("pillars", []):
        days = p.get("dayLabel", "")
        lines.append(f"| {p.get('name', '')} | {days} | {p.get('checkLabel', '')} |")
    for d in health.get("daily", []):
        label = d.get("label", d.get("id", ""))
        lines.append(f"| {label.split('（')[0]} | 每天 | {label} |")
    lines += [
        "",
        "习惯到期后自动进入「今天」。原「训练计划」里 7 条任务：能并入习惯的删除；其余保留在 03-训练 并设具体日期。",
        "",
    ]
    for p in health.get("pillars", []):
        lines.append(f"**{p.get('name')}：** {p.get('instruction', '')}")
        lines.append("")
    return "\n".join(lines)


def section_finance(finance: dict) -> str:
    pending = pending_finance_todos(finance, limit=8)
    lines = [
        "## 第四步 A：02-财务 — 待办（设到期日 + 提前 3 天提醒）",
        "",
        f"**备注统一贴：** {url('finance/index.html#plan')}",
        "",
        "完成后在 **网站财务页也勾掉**（勾选状态以网站为准）。",
        "",
        "| 任务 | 月份 | 优先级 | 到期提示 |",
        "|------|------|--------|----------|",
    ]
    for t in pending:
        pri = "高" if t["urgent"] or "6/22" in t["text"] or "7/4" in t["text"] else "中"
        lines.append(f"| {t['text']} | {t['month']} | {pri} | {infer_due_hint(t['text'])} |")
    lines += [
        "",
        "**每月重复（1 日）：** 核对本月财务待办是否与网站一致 `#财务`",
        "",
    ]
    return "\n".join(lines)


def section_reading(goals: dict, learning: dict) -> str:
    books = goals.get("season_books", [])
    reading = next((b for b in books if b.get("status") == "reading"), None)
    planned = next((b for b in books if b.get("status") == "planned"), None)
    title = reading["title"] if reading else "在读书"
    next_title = planned["title"] if planned else "下本计划"
    weekly = learning.get("weeklyTarget", "精读 ≥140 分钟 / 周")
    return f"""## 第四步 B：04-阅读 — 重复任务

本季目标：{weekly}  
在读书：**《{title}》** · 下本：**《{next_title}》**

| 任务 | 重复 | 标签 | 备注 |
|------|------|------|------|
| 精读《{title}》≥ 20 分钟（工作日晨间） | 周一至周五 | `#阅读` | {url("learning/index.html")} |
| 写学习记录：3 条 takeaway + 1 条行动 | 每周日 | `#阅读` `#网站写` | {url("reflect/edit.html?new=1&kind=learning")} |

读完《{title}》后在网站更新 season_books 状态，并改滴答任务书名。
"""


def section_work(goals: dict, career: dict) -> str:
    kr4 = next((k for k in goals.get("quarter", {}).get("key_results", []) if k.get("module") == "career"), None)
    kr_title = kr4["title"] if kr4 else "职业 KR"
    progress = f"{kr4.get('progress', 0)}/{kr4.get('target', 3)}" if kr4 else "—"
    milestones = career.get("milestones", [])
    ms_lines = "\n".join(
        f"- **{m.get('title')}**（deadline {m.get('deadline', '—')}）"
        for m in milestones
    )
    rhythm_rows = "\n".join(
        f"| {r.get('block', '')} | {r.get('action', '')} | `#工作` |"
        for r in career.get("weeklyRhythm", [])
    )
    this_month = "\n".join(f"- {x}" for x in career.get("thisMonth", []))
    return f"""## 第四步 C：05-工作 — KR 与子任务

**父任务（本季）：** {kr_title}（进度 {progress}）  
**备注：** {url("career/index.html")}

**子任务（一次性，设本周/本月日期）：**

{this_month}

**里程碑：**

{ms_lines}

**每周重复：**

| 块 | 动作 | 标签 |
|----|------|------|
{rhythm_rows}
"""


def section_review(goals: dict) -> str:
    reviews = goals.get("reviews", [])
    q = reviews[0] if reviews else {"id": "2026-Q2", "title": "季复盘"}
    return f"""## 第四步 D：复盘类

| 任务 | 重复 | 标签 | 备注 |
|------|------|------|------|
| 周日：扫网站五维 + 更新 OKR 进度 | 每周日 | `#复盘` | {url("goals/index.html")} |
| 月度总结：五维各 1 句 + 下月 1 重点 | 每月 1 日 | `#复盘` `#网站写` | {url("reflect/edit.html?new=1&kind=monthly")} |
| {q.get('title', '季复盘')} | 季末设提醒 | `#复盘` `#网站写` | {url('goals/review.html?p=' + q.get('id', '2026-Q2'))} |
"""


def section_tags() -> str:
    lines = [
        "## 第五步：标签",
        "",
        "| 标签 | 用途 |",
        "|------|------|",
    ]
    for tag, desc in TAGS:
        lines.append(f"| `#{tag}` | {desc} |")
    lines += [
        "",
        "在「今天」视图按优先级或标签分组。",
        "",
        "## 第六步：控制「今天」噪音",
        "",
        "**不要设今天日期：** 00-方向、99-以后再说、06-备忘 中的远期项。",
        "",
        "目标：「今天」稳定在 **6–10 条**（习惯 + 重复 + 临近财务节点）。",
        "",
    ]
    return "\n".join(lines)


def section_weekly_sync() -> str:
    return f"""## 第七步：维护节奏

### 每日（2 分钟）

1. 打开滴答 **今天**（不是逐个清单）
2. 完成习惯打卡
3. 按优先级勾选；需写长文 → 点备注 → 网站写完 → 回来勾选

### 每周日（15 分钟）

1. 更新网站 OKR：{url("goals/index.html")}
2. 对照网站 Today：{url("today/index.html")}
3. 清空收集箱
4. 检查 02-财务 下月待办是否已设到期日
5. 运行 `python scripts/export_ticktick.py` 刷新本文档（财务/OKR 变更后）

### 数据边界

| 数据 | 唯一维护处 |
|------|-----------|
| KR 进度、读书状态 | 网站 |
| 反思/学习笔记 | 网站 reflect |
| 财务勾选 | 网站 |
| 今日完成、训练 streak | 滴答 |
"""


def section_checklist() -> str:
    return """## 第八步：迁移检查清单

- [ ] 7 个清单已移入「复利人生」并改名
- [ ] 00-方向 4 条置顶、无日期
- [ ] 6 个习惯已创建
- [ ] 02-财务 近期节点已设到期日
- [ ] 04-阅读 工作日精读 + 周日笔记重复已设
- [ ] 05-工作 KR 子任务 + 每周节奏已设
- [ ] 8 个标签已建
- [ ] 06-备忘 / 99-以后 误进今天的任务已清
- [ ] 打开「今天」确认 6–10 条合理
"""


def build_markdown() -> str:
    goals = load_json(ROOT / "goals" / "goals.json")
    health = load_json(ROOT / "health" / "plan.json")
    career = load_json(ROOT / "career" / "plan.json")
    learning = load_json(ROOT / "learning" / "plan.json")
    finance = load_json(ROOT / "finance" / "finance-config.json")

    parts = [
        "# 滴答清单 × Russshare — 可复制任务清单",
        "",
        f"> 自动生成于 {date.today().isoformat()} · 数据源：goals / health / career / learning / finance",
        f"> 网站根地址：`{SITE_BASE}/`",
        "",
        "在滴答清单中按章节手工创建。左上角 **今天** 自动汇总所有设了日期/重复的任务。",
        "",
        section_folder(),
        section_direction(goals),
        section_habits(health),
        section_finance(finance),
        section_reading(goals, learning),
        section_work(goals, career),
        section_review(goals),
        section_tags(),
        section_weekly_sync(),
        section_checklist(),
    ]
    return "\n".join(parts) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Export TickTick setup markdown from Russshare data")
    parser.add_argument(
        "-o",
        "--output",
        default=str(ROOT / "docs" / "ticktick-tasks.md"),
        help="Output markdown path",
    )
    args = parser.parse_args()
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    content = build_markdown()
    out.write_text(content, encoding="utf-8")
    print(f"Wrote {out} ({len(content)} bytes)")


if __name__ == "__main__":
    main()
