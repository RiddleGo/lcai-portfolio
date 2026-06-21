/** Russshare 人生中枢 — 全站导航配置 */
window.SITE_NAV = {
  brand: {
    title: "Russshare",
    subtitle: "人生中枢",
    home: "index.html",
    logo: "assets/lcai-kb-logo.svg",
  },
  groups: [
    {
      id: "life",
      title: "人生",
      links: [
        { href: "index.html", label: "🏛 总入口", id: "home" },
        { href: "today/index.html", label: "☀️ 今日 Todo", id: "today" },
        { href: "guide/index.html", label: "📖 使用指南", id: "guide" },
        { href: "settings/index.html", label: "☁️ 数据同步", id: "sync" },
        { href: "principles/life-constitution.md", label: "📜 人生宪法", id: "constitution" },
        { href: "goals/index.html", label: "🎯 目标 OKR", id: "goals" },
        { href: "career/index.html", label: "💼 职业成长", id: "career" },
        { href: "learning/index.html", label: "📚 阅读笔记", id: "learning" },
        { href: "health/index.html", label: "🏃 健康习惯", id: "health" },
        { href: "journal/index.html", label: "📝 决策日记", id: "journal", lock: true },
      ],
    },
    {
      id: "wealth",
      title: "财富",
      links: [
        { href: "finance/index.html", label: "💰 财务计划", id: "finance", lock: true },
        { href: "invest/workbench.html", label: "🔍 LCAI 投资", id: "invest" },
        { href: "docs/research/index.html", label: "🧠 产业研究", id: "research" },
      ],
    },
  ],
  modules: [
    { href: "today/index.html", icon: "☀️", title: "今日 Todo", sub: "每日自动生成 · 健康 / 财务 / OKR" },
    { href: "finance/index.html", icon: "💰", title: "财务计划", sub: "还债 · 执行 · 持仓 · 一页纸规划", lock: true },
    { href: "invest/workbench.html", icon: "🔍", title: "LCAI 投资", sub: "选股研判 · 规则 · ETF · 书籍" },
    { href: "goals/index.html", icon: "🎯", title: "目标 OKR", sub: "年度目标 · 季度 KR · 复盘" },
    { href: "learning/index.html", icon: "📚", title: "阅读笔记", sub: "投资 · 技术 · 通识 · 职业" },
    { href: "career/index.html", icon: "💼", title: "职业成长", sub: "技能矩阵 · 项目 · 学习路径" },
    { href: "health/index.html", icon: "🏃", title: "健康习惯", sub: "运动 · 作息 · 7 日 streak" },
    { href: "journal/index.html", icon: "📝", title: "决策日记", sub: "重大决策 · 反思记录", lock: true },
    { href: "docs/research/index.html", icon: "🧠", title: "产业研究", sub: "AI 五层 · 产业链映射" },
  ],
};
