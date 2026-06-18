/** AI 五层研究目录 — 用户只见标题与 slug，不暴露文件名 */
window.LCAI_RESEARCH = {
  library: {
    eyebrow: "NVIDIA · AI Industry Research",
    title: "AI 五层产业研究知识库",
    subtitle: "能源 → 芯片 → 基础设施 → 模型 → 应用。全球产业链、中国映射、A 股筛选框架，层层可读、互相链接。",
    version: "2026.06",
    disclaimer: "产业研究仅供参考，不构成任何投资建议。"
  },
  stats: [
    { value: "5", label: "产业层级", href: "read.html?p=overview" },
    { value: "9", label: "深度文档", href: "index.html" },
    { value: "1", label: "全链映射", href: "read.html?p=chain" },
    { value: "15", label: "核心标的", href: "read.html?p=catalog" }
  ],
  groups: [
    {
      id: "framework",
      title: "框架与导航",
      items: [
        {
          slug: "guide",
          title: "阅读指南",
          desc: "系列说明、推荐阅读路径与文档结构",
          icon: "📋",
          file: "README.md"
        },
        {
          slug: "overview",
          title: "五层框架总览",
          desc: "NVIDIA 五层蛋糕 · 官方数据 · 传导逻辑",
          icon: "📐",
          file: "04_ai_five_layers_analysis.md"
        },
        {
          slug: "catalog",
          title: "深度系列目录",
          desc: "05–09 分层索引 · §8.6 标的汇总",
          icon: "🗂️",
          file: "05-09_layers_index.md"
        },
        {
          slug: "chain",
          title: "全链条产业映射",
          desc: "PCB · 铜箔 · 电容等延伸环节 · 双叙事分层",
          icon: "🔗",
          file: "10_full_chain_industry_mapping.md"
        }
      ]
    },
    {
      id: "layers",
      title: "逐层深读",
      items: [
        {
          slug: "energy",
          title: "第 1 层 · 能源",
          desc: "算电协同 · 液冷 · 电网扩容",
          icon: "⚡",
          file: "05_layer1_energy.md",
          layer: 1
        },
        {
          slug: "chips",
          title: "第 2 层 · 芯片",
          desc: "设备 · 封装 · 材料子链 · 国产算力",
          icon: "🔬",
          file: "06_layer2_chips.md",
          layer: 2
        },
        {
          slug: "infra",
          title: "第 3 层 · 基础设施",
          desc: "800G 光模块 · AI 服务器 · AIDC",
          icon: "🏭",
          file: "07_layer3_infrastructure.md",
          layer: 3
        },
        {
          slug: "models",
          title: "第 4 层 · 模型",
          desc: "语料 · 平台 · 订阅变现",
          icon: "🧠",
          file: "08_layer4_models.md",
          layer: 4
        },
        {
          slug: "apps",
          title: "第 5 层 · 应用",
          desc: "智驾 · 安防 · 金融 IT · PMF",
          icon: "🚀",
          file: "09_layer5_applications.md",
          layer: 5
        }
      ]
    }
  ]
};

window.LCAI_RESEARCH.bySlug = {};
window.LCAI_RESEARCH.byFile = {};
window.LCAI_RESEARCH.groups.forEach(function (g) {
  g.items.forEach(function (item) {
    window.LCAI_RESEARCH.bySlug[item.slug] = item;
    window.LCAI_RESEARCH.byFile[item.file] = item;
  });
});

window.LCAI_RESEARCH.allItems = window.LCAI_RESEARCH.groups.reduce(function (a, g) {
  return a.concat(g.items);
}, []);
