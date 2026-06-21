# 滴答清单 × Russshare 人生系统

Russshare 负责 **想清楚、存下来**；滴答清单负责 **提醒、勾选、习惯 streak**。

- **网站**：OKR 进度、反思笔记、财务计划、宪法
- **滴答**：左上角 **今天** = 全站汇总（凡设了今天日期/重复的任务自动汇集）
- **不要**再建单独的「01-今日」清单

网站根地址：`https://riddlego.github.io/lcai-portfolio/`

---

## 快速开始

1. 按 [ticktick-tasks.md](./ticktick-tasks.md) 在滴答手工建清单、习惯、任务（该文件由脚本从仓库数据自动生成）
2. 每日只打开滴答 **今天** + 习惯打卡
3. 每周日花 15 分钟对照 [Today 页](https://riddlego.github.io/lcai-portfolio/today/index.html) 与 [OKR](https://riddlego.github.io/lcai-portfolio/goals/index.html)

刷新任务清单（财务/OKR 变更后）：

```bash
python scripts/export_ticktick.py
```

---

## 清单结构

新建文件夹 **复利人生**：

| 现有清单 | 新名称 | 角色 |
|---------|--------|------|
| WHERE AM I | 00-方向 | 阶段/不做/链接（**不设日期**） |
| BUY LESS | 02-财务 | 还款、卖股 |
| 训练计划 | 03-训练 | 习惯 + 周计划 |
| BOOK IN | 04-阅读 | 精读、笔记提醒 |
| 工作任务 | 05-工作 | 职业 KR |
| 个人备忘 | 06-备忘 | 杂事（默认不进今天） |
| On The Way | 99-以后再说 | 远期（**不设日期**） |

收集箱留在文件夹外。

---

## 数据边界

| 数据 | 维护处 |
|------|--------|
| KR 进度、读书状态 | 网站 |
| 反思/学习笔记正文 | 网站 [reflect](https://riddlego.github.io/lcai-portfolio/reflect/index.html) |
| 财务勾选 | 网站 [finance](https://riddlego.github.io/lcai-portfolio/finance/index.html) |
| 今日是否完成 | 滴答 |
| 训练 streak | 滴答习惯 |

---

## 相关页面

- [网站使用指南](../guide/index.html)
- [滴答配置详情（网页）](../guide/ticktick.html)
- [自动生成任务清单](./ticktick-tasks.md)
