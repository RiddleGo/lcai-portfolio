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
        { href: "index.html", label: "🏛 首页", id: "home" },
        { href: "today/index.html", label: "☀️ 今日 Todo", id: "today" },
        { href: "goals/index.html", label: "🎯 OKR", id: "goals" },
        { href: "health/index.html", label: "🏃 健康", id: "health" },
        { href: "learning/index.html", label: "📚 阅读", id: "learning" },
        { href: "career/index.html", label: "💼 职业", id: "career" },
        { href: "journal/index.html", label: "📝 日记", id: "journal", lock: true },
        { href: "settings/index.html", label: "☁️ 同步", id: "sync" },
        { href: "guide/index.html", label: "📖 指南", id: "guide" },
        { href: "principles/life-constitution.md", label: "📜 宪法", id: "constitution" },
      ],
    },
    {
      id: "wealth",
      title: "财富",
      links: [
        { href: "finance/index.html", label: "💰 财务", id: "finance", lock: true },
        { href: "invest/workbench.html", label: "🔍 LCAI", id: "invest" },
        { href: "docs/research/index.html", label: "🧠 研究", id: "research" },
      ],
    },
  ],
};
