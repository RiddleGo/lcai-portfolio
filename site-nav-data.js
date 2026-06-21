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
        { href: "finance/index.html", label: "💰 财务", id: "finance", lock: true },
        { href: "goals/index.html", label: "🎯 OKR", id: "goals" },
        { href: "health/index.html", label: "🏃 健康", id: "health" },
        { href: "learning/index.html", label: "📚 阅读", id: "learning" },
        { href: "reflect/index.html", label: "📝 反思笔记", id: "reflect" },
        { href: "career/index.html", label: "💼 职业", id: "career" },
        { href: "journal/index.html", label: "📔 决策日记", id: "journal", lock: true },
        { href: "settings/index.html", label: "☁️ 同步", id: "sync" },
        { href: "principles/index.html", label: "📜 宪法", id: "constitution" },
        { href: "reflect/edit.html?new=1&amp;kind=monthly", label: "📅 月总结", id: "monthly" },
      ],
    },
  ],
};
