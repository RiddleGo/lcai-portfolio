# AI 产业五层梳理与关键要素分析

**撰写时间**: 2026-06-18（v2 网络权威来源扩充版）  
**分析性质**: 产业研究框架（瓶颈 / 核心技术 / 代表环节），不含个股映射  
**主框架**: NVIDIA 黄仁勋「五层蛋糕」— 能源 → 芯片 → 基础设施 → 模型 → 应用

---

## 研究方法

本报告以 **NVIDIA 官方五层架构** 为主轴，综合以下 **官方与高质量来源**（不仅限于本地资料）：

| 来源层级 | 机构 | 用途 |
|----------|------|------|
| **框架定义** | NVIDIA 官方博客 / Newsroom / 达沃斯 WEF | 五层定义、传导逻辑、产业判断 |
| **能源层** | 国际能源署 IEA | 数据中心用电量、AI 工厂、电力瓶颈 |
| **芯片层** | Gartner 官方新闻稿、美国商务部 BIS | 半导体规模、HBM 短缺、出口管制 |
| **基础设施层** | Gartner、IEA、四大 Hyperscaler 财报（经 Statista 汇总） | Capex、数据中心支出 |
| **模型层** | Gartner GenAI 支出、中国国务院 / 数字中国官网 | 模型生态、政策目标 |
| **应用层** | IEA、NVIDIA、国务院「人工智能+」 | Agent、商业化、落地节奏 |
| **补充参考** | 恒生银行、平安证券、国信证券、OFweek（本地存档） | 投资视角、A 股市场语境 |

---

## 摘要

AI 产业可分解为自下而上的五层价值链：

**能源 → 芯片 → 基础设施 → 模型 → 应用**

与传统软件不同，AI 的智能是**实时生成**的——每一层都必须为「按需制造智能」而设计（[NVIDIA 官方](https://blogs.nvidia.com/blog/ai-5-layer-cake/)）。成功的应用会**向下拉动**模型训练、算力扩建、芯片采购和电力消耗。

**关键官方数据（2025–2026）：**

- **能源**：全球数据中心用电 2025 年约 **485 TWh**，2030 年或达 **950 TWh**（约全球 3%）；AI 专用数据中心用电 2025 年增速 **50%**（[IEA](https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary)）
- **芯片**：2026 年全球半导体收入或超 **1.3 万亿美元**（+64%）；AI 芯片占半导体收入约 **30%**（[Gartner](https://www.gartner.com/en/newsroom/press-releases/2026-04-08-gartner-forecasts-worldwide-semiconductor-revenue-to-exceed-us-dollars-one-point-3-trillion-in-2026)）
- **基础设施**：2026 年全球数据中心系统支出或超 **7880 亿美元**（+55.8%）；四大 Hyperscaler 2026 年 Capex 合计最高 **7250 亿美元**（[Gartner](https://www.gartner.com/en/newsroom/press-releases/2025-10-22-gartner-forecasts-worldwide-it-spending-to-grow-9-point-8-percent-in-2026-exceeding-6-trillion-dollars-for-the-first-time) / [Statista](https://www.statista.com/chart/35046/capital-expenditure-of-meta-alphabet-amazon-and-microsoft/)）
- **模型**：2025 年全球 GenAI 支出 **6440 亿美元**（+76.4%）；中国已发布 **1509 个大模型**（[Gartner](https://www.gartner.com/en/newsroom/press-releases/2025-03-31-gartner-forecasts-worldwide-genai-spending-to-reach-644-billion-in-2025) / [数字中国官网](https://www.digitalchina.gov.cn/2025/xwzx/qwfb/202509/t20250923_5081840.htm)）
- **应用**：国务院目标 2027 年智能终端/智能体普及率 **超 70%**（[中国政府网](https://www.gov.cn/zhengce/zhengceku/202508/content_7037862.htm)）

当前产业仍处于早期——NVIDIA 称「仅投入数千亿美元，仍有数万亿美元基础设施待建」；IEA 则指出电力、电网、HBM、资本等多环节瓶颈已同时出现。

---

## 第一步：五层架构总览

### 1.1 架构图

五层自下而上堆叠（底层支撑上层）：

```
┌─────────────────────────────────────┐
│  第5层  应用    经济价值在此兑现      │
├─────────────────────────────────────┤
│  第4层  模型    算力 → 智能能力       │
├─────────────────────────────────────┤
│  第3层  基础设施  AI 工厂 / 算力编排   │
├─────────────────────────────────────┤
│  第2层  芯片    能源 → 计算能力       │
├─────────────────────────────────────┤
│  第1层  能源    电力 / 散热 / 能效    │  ← 硬约束，之下无抽象层
└─────────────────────────────────────┘
```

**官方定义**（NVIDIA，2026-03）：  
> Energy → chips → infrastructure → models → applications.  
> Every successful application pulls on every layer beneath it, all the way down to the power plant that keeps it alive.

黄仁勋在 [达沃斯 WEF 2026](https://blogs.nvidia.com/blog/davos-wef-blackrock-ceo-larry-fink-jensen-huang/) 将与 BlackRock CEO Larry Fink 对谈中，将 AI 定义为「人类历史上最大规模的基础设施建设」，五层均需独立融资、运营和劳动力。

### 1.2 传导逻辑

```
应用爆发 ──→ 模型需求上升 ──→ AI工厂扩建 ──→ 芯片采购增加 ──→ 电力消耗上升
   ↑                                                              │
   └──────────────────── 正向循环（持续强化） ──────────────────────┘
```

**三层核心逻辑**：

1. **实时智能**（NVIDIA）：软件不再检索预制指令，而是按需推理生成 → 整个计算栈必须重设计
2. **应用拉动效应**（NVIDIA + IEA）：上层成功向下传导；IEA 卫星追踪显示 AI 工厂（专用 AI 数据中心）容量 **18 个月内增长 3 倍以上**
3. **正向循环**（恒生 + IEA + Gartner）：算力 → 模型 → 应用 → 更高算力需求；2025 年五大科技公司 Capex 已超 **4000 亿美元**，2026 年预计再增 **75%**，规模已超过全球油气生产投资（IEA）

### 1.3 框架对照：全球五层 vs 中国三层 vs 早期框架

| NVIDIA 五层（2026） | 平安证券三层（2019，本地） | 中国官方框架（2025） | 恒生 2026 投资主题 |
|---------------------|---------------------------|---------------------|-------------------|
| **能源** | 未单独列出 | 算力中心配套能源（新型基础设施） | 电力基建、绿色能源 |
| **芯片** | 基础层 — AI 芯片 | 基础层 — AI 芯片 / 智能传感器 | 高端半导体 |
| **基础设施** | 基础层 — 算力 + 大数据 | 基础层 — 云计算 / 算力中心 | 云端与算力基建 |
| **模型** | 技术层 — 算法/框架 | 技术层 — 大模型 / 算法 | 智能代理底层 |
| **应用** | 应用层 | 应用层 — 「人工智能+」6 大重点行动 | Agent、机器人、自动驾驶 |

> **中国政策锚点**：国务院 [《关于深入实施「人工智能+」行动的意见》](https://www.gov.cn/zhengce/zhengceku/202508/content_7037862.htm)（2025-08）设定 2027 / 2030 / 2035 三阶段目标；工信部等数据：2024 年 AI 产业规模 **7000+ 亿元**，企业 **5100+ 家**，大模型 **1509 个**（全球首位）。

---

### 1.4 逐层定义（含官方数据锚点）

#### 第 1 层：能源

| 维度 | 内容 |
|------|------|
| **定义与功能** | 为 AI 实时生成智能提供物理电力；每个 token = 电子流动 + 散热 + 能量→计算（NVIDIA） |
| **价值链位置** | 最底层硬约束；NVIDIA：「Energy is the first principle… binding constraint」 |
| **官方数据** | 2025 年全球数据中心用电 **485 TWh**（+17%）；AI 专用数据中心 **+50%**；2030 年或 **950 TWh**（全球约 3%）（IEA） |
| **产业阶段** | **瓶颈期** — IEA：电力、电网接入、变压器、社区接受度均为约束；2027 年单 AI 机柜峰值功耗 ≈ **65 户家庭** |

#### 第 2 层：芯片

| 维度 | 内容 |
|------|------|
| **定义与功能** | 将能源高效转化为计算；需大规模并行、HBM、高速互连（NVIDIA） |
| **官方数据** | 2026 年半导体收入 **1.32 万亿美元**（+64%）；AI 芯片占 **30%**；HBM/DRAM 2026 年价格或 +125%（Gartner）；HBM 短缺或持续至 **2027 年底**（IEA） |
| **地缘约束** | 美国 BIS 2026-05 确认：对华关联实体（D:5/Macao 总部）出口先进计算芯片（ECCN 3A090/4A090）**仍需许可证**（[BIS 官方 PDF](https://www.bis.gov/media/documents/bis-guidance-may-31-2026.pdf)） |
| **产业阶段** | **爆发期** — Gartner 称半导体处于 **20 年来最高增速** |

#### 第 3 层：基础设施（AI 工厂）

| 维度 | 内容 |
|------|------|
| **定义与功能** | 编排万级处理器为「制造智能」的系统；NVIDIA 称 **AI factories**，非存储型数据中心 |
| **官方数据** | 2026 年全球数据中心系统支出 **7880 亿美元**（+55.8%）；Hyperscaler Capex **7250 亿美元**（Amazon ~2000 亿、Microsoft ~1900 亿、Alphabet 1750–1900 亿、Meta 1250–1450 亿）（Gartner / Statista） |
| **关键转变** | IEA：AI 工厂 18 个月内容量 **3 倍增长**；美国约 1/5 项目采用 ** onsite 天然气发电** 应对并网延迟 |
| **产业阶段** | **建设高峰期** — IEA：五家科技公司 2025 Capex 已超全球油气生产投资 |

#### 第 4 层：模型

| 维度 | 内容 |
|------|------|
| **定义与功能** | 算力→智能；涵盖 LLM、蛋白质 AI、化学 AI、物理仿真、机器人等（NVIDIA） |
| **官方数据** | 2025 年全球 GenAI 支出 **6440 亿美元**（+76.4%），其中 **80% 流向硬件**（Gartner）；中国 **1509 个大模型**、**538 款** GenAI 服务完成备案（数字中国官网） |
| **生态趋势** | 开源模型达前沿水平时激活全栈需求（NVIDIA 以 DeepSeek-R1 为例）；Gartner 指出 POC 失败率高与模型持续巨额投入并存 |
| **产业阶段** | **门槛跨越期** — NVIDIA：推理增强、幻觉下降、可规模部署 |

#### 第 5 层：应用

| 维度 | 内容 |
|------|------|
| **定义与功能** | 经济价值兑现层；NVIDIA 三分法：知识应用 / 机器应用 / 具身应用 |
| **官方数据** | 国务院：2027 年智能终端与智能体普及率 **>70%**，2030 年 **>90%**；IEA：视频生成、推理、Agent 任务能耗可达简单文本的 **数百至数千倍** |
| **商业化** | NVIDIA：药物研发、物流、客服、软件开发等已现 PMF；Microsoft AI 业务年化收入 **370 亿美元**（+123% YoY，Statista 引 Q1 2026 财报） |
| **产业阶段** | **商业化初期** — 最大经济收益将来自应用层（NVIDIA 达沃斯） |

**应用层三分法**（NVIDIA 官方）：

- **知识应用**：药物研发、法律助手、客服、软件开发
- **机器应用**：自动驾驶
- **具身应用**：人形机器人、工业机器人

---

## 第二步：逐层关键要素

> 每层：**最关键瓶颈** / **最关键技术** / **代表环节** / **权威来源**

---

### 第 1 层：能源

#### 最关键瓶颈

| 瓶颈 | 说明 | 权威来源 |
|------|------|----------|
| **电力硬约束** | 能源之下无抽象层；决定智能产出上限 | NVIDIA 官方博客 |
| **需求加速** | AI 专用数据中心 2025 年用电 +50%；2030 年或 tripling | IEA 2026 |
| **电网与设备** | 并网延迟、变压器/电力电子供应、社区反对 | IEA 2026 |
| **能耗结构变化** | Agent/视频/推理任务能耗远高于简单文本 | IEA 2026 |
| **美中差异** | 美国未来 5 年新增用电约 **420 TWh**，数据中心占增长约 **50%** | IEA Electricity 2026 |

#### 最关键技术/环节

- **电网并网与大容量供电** — IEA 首要瓶颈
- **数据中心 onsite 发电**（天然气等）— 美国约 15–27 GW by 2030
- **储能与调峰** — 2030 年数据中心全球电池储能或 20–25 GW
- **液冷 / 高热密度散热** — 单机柜热负荷 ≈ 30 台燃气锅炉（IEA）
- **核电 / 可再生能源 / 燃气轮机** — 燃气轮机制造商估值与 AI 关联度上升（IEA 金融市场分析）
- **PUE 与能效优化** — 单任务能效每年改善一个数量级，但被新应用场景抵消（IEA）

#### 代表环节

- 公用事业与电网运营商
- 电力设备（变压器、电力电子、UPS）
- 燃气轮机 / 核电 / 可再生能源
- 数据中心能效与冷却系统
- 储能（含长时储能）

---

### 第 2 层：芯片

#### 最关键瓶颈

| 瓶颈 | 说明 | 权威来源 |
|------|------|----------|
| **HBM 短缺** | 高带宽内存为 AI 芯片核心；短缺或持续至 2027 年底 | IEA 2026 |
| **Memflation** | 2026 年 DRAM 价格或 +125%，NAND +234% | Gartner 2026-04 |
| **算力效率** | 决定 AI 扩展速度与智能 affordability | NVIDIA |
| **出口管制** | BIS 对华关联实体全球范围先进芯片许可要求仍有效 | BIS 2026-05-31 |
| **供应链集中度** | 先进制程、关键材料高度集中 | IEA + Gartner |

#### 最关键技术/环节

- **GPU / AI 加速器** — 2026 年 AI 芯片占半导体收入 30%（Gartner）
- **HBM 高带宽内存** — 与 GPU 配套，Gartner 称 memory 收入 2026 年或 **3 倍增长**
- **Custom ASIC / XPU** — Hyperscaler 自研非 GPU 加速器（Gartner）
- **高速互连** — NVLink、InfiniBand、数据中心网络芯片
- **先进制程 + Chiplet / CoWoS 封装**
- **边缘推理芯片** — 平安 2019 已预见；适用于端侧 Agent 与机器人

#### 代表环节

- AI 训练芯片（GPU、TPU、训练 ASIC）
- AI 推理芯片（云端 + 边缘）
- 存储器（HBM、DRAM、NAND）
- 半导体设备与材料（EUV 光刻、刻蚀、封装）
- 芯片 IP 与 EDA

---

### 第 3 层：基础设施（AI 工厂）

#### 最关键瓶颈

| 瓶颈 | 说明 | 权威来源 |
|------|------|----------|
| **系统级编排** | 土地 + 电 + 冷 + 网 + 资本，非单纯买服务器 | NVIDIA + IEA |
| **Capex 超级周期** | 四大 Hyperscaler 2026 Capex 最高 7250 亿美元 | Statista / 各公司财报 |
| **融资依赖** | 数据中心投资过大，需资本市场支持；对 ROI 预期敏感 | IEA 2026 |
| **产能约束** | Microsoft 警告 2026 年前算力产能持续紧张 | 财报电话会（Statista 引述） |
| **过剩风险** | Capex 过快或拖累回报率（恒生本地报告补充） | 恒生 2026 |

#### 最关键技术/环节

- **AI 工厂 / 超大规模数据中心** — IEA 卫星追踪 18 个月 3 倍扩容
- **AI 优化服务器机柜** — Gartner：2026 年数据中心系统支出 7880 亿美元
- **云计算与 IaaS 算力调度** — AWS / Azure / Google Cloud
- **高速网络** — 光模块、交换机、DCI 互联
- **液冷系统** — 应对 2027 年机柜功率密度再增 4 倍（IEA）
- **Neocloud / 算力租赁** — CoreWeave 等专业化 AI 云（Futurum 等行业研究）

#### 代表环节

- Hyperscaler 云厂商（Amazon、Microsoft、Google、Meta）
- Neocloud / AI 专用云
- IDC 与算力租赁
- 网络设备与光通信
- 服务器 OEM（Dell、HPE、Supermicro 等）
- 数据中心 EPC 与机电集成

---

### 第 4 层：模型

#### 最关键瓶颈

| 瓶颈 | 说明 | 权威来源 |
|------|------|----------|
| **训练 vs 推理成本** | GenAI 支出 80% 流向硬件；推理持续消耗算力 | Gartner 2025-03 |
| **POC 失败率** | 企业 GenAI 概念验证失败率高，与模型巨额投入并存 | Gartner |
| **信号落地难** | 纯模型难以对接业务闭环，需 Agent 决策层 | 国信证券（本地） |
| **开源生态** | 开放模型达前沿水平激活全栈需求 | NVIDIA（DeepSeek-R1） |
| **合规与幻觉** | 受监管行业需可解释性与审计 | 国信证券（本地） |

#### 最关键技术/环节

- **Transformer 架构** — 自注意力、长序列建模（国信 + 产业共识）
- **LLM + 多模态** — 文本、图像、视频、代码
- **推理模型** — DeepSeek-R1 类 Chain-of-Thought 推理
- **垂直模型** — 蛋白质 AI、化学 AI、物理仿真、机器人（NVIDIA）
- **训练框架** — PyTorch 生态；中国：飞桨、MindSpore（平安 2019 / 前瞻产业）
- **MaaS 推理服务** — 模型即服务
- **数据与语料** — 训练「燃料」；中国 AI 专利申请量全球 **60%**（数字中国官网）

#### 代表环节

- 闭源基础模型（OpenAI、Anthropic、Google DeepMind 等）
- 开源模型（DeepSeek、Meta Llama、Mistral 等）
- 中国大模型（通义、文心、DeepSeek 等，1509 个已发布）
- 模型训练 / 微调 / 推理平台
- 数据标注与高质量语料

**模型层子类型**：

| 子类型 | 典型方向 | 官方/权威参考 |
|--------|----------|---------------|
| 语言模型 | LLM、对话、代码 | Gartner GenAI 支出 |
| 科学 AI | 蛋白质、化学、物理 | NVIDIA 官方 |
| 具身智能 | 机器人控制 | NVIDIA GTC 2026 |
| 行业专用 | 金融、医疗、法律 | 国务院「人工智能+」 |

---

### 第 5 层：应用

#### 最关键瓶颈

| 瓶颈 | 说明 | 权威来源 |
|------|------|----------|
| **商业化节奏** | 落地不及预期 → 估值回调 | 恒生 2026 |
| **能耗跃升** | Agent / 视频 / 推理任务推高能源层需求 | IEA 2026 |
| **马太效应** | 算力、数据、模型向头部集中 | OFweek 2026 |
| **SaaS 颠覆** | Agent 渗透开发维护，传统 SaaS 议价受压 | 恒生 2026 |
| **同质化风险** | 纯界面、无数据/模型壁垒的应用 | 恒生 2026 |

#### 最关键技术/环节

- **智能 Agent** — IEA 列为高能耗新应用场景；NVIDIA GTC 2026 核心主题
- **企业端 AI（B 端）** — 2026 年投资分层：硬件兑现 + 应用落地（OFweek）
- **具身应用** — 人形/工业机器人（NVIDIA CES 2026：Rubin 平台 + 自动驾驶蓝图）
- **机器应用** — 自动驾驶
- **知识应用** — 药物研发、法律、客服、软件开发（NVIDIA：已现 PMF）
- **工作流自动化** — Cursor 类 AI 编程、企业流程 Agent

#### 代表环节

- Agent 平台与工作流自动化
- 垂直行业解决方案（制造、医疗、金融、政务）
- 自动驾驶与机器人整机
- 具备「专属数据 + 模型 + 深度嵌入运营」的平台型企业

---

## 层间关系与风险

### 3.1 正向循环（机遇）

```
更强算力 → 更先进模型 → 更多应用 → 更高 Capex / 电力 / 芯片需求
                ↑                                    |
                └──────────── 正向循环 ──────────────┘
```

**官方佐证：**

- IEA：主要模型提供商活跃用户 **3 倍**、收入 **5 倍**（过去一年）
- Gartner：Hyperscaler AI 基础设施投资 2026 年或 **+50% 以上**
- NVIDIA：DeepSeek-R1 开源 → 应用层加速 → 训练/基础设施/芯片/能源需求同步上升
- Microsoft：AI 业务 ARR **370 亿美元**，+123% YoY（2026 Q1，Statista）

### 3.2 关键风险

| 风险 | 影响层级 | 说明 | 权威来源 |
|------|----------|------|----------|
| **电力/电网瓶颈** | 能源 → 全栈 | 2030 年 950 TWh 为基准情景；上行取决于瓶颈缓解 | IEA |
| **HBM / 芯片短缺** | 芯片 → 基础设施 | 短缺或持续至 2027 年底 | IEA + Gartner |
| **出口管制** | 芯片 | 对华关联实体全球许可要求 | BIS 2026-05 |
| **Capex ROI** | 基础设施 | 投资过大、回报不及预期 | IEA |
| **商业化不及预期** | 应用 | 估值回调 | 恒生 |
| **GenAI POC 失败** | 应用 / 模型 | 企业落地困难 | Gartner |
| **监管滞后** | 应用 / 模型 | 算法交易、数据合规 | OFweek |

### 3.3 产业阶段判断

| 层级 | 阶段 | 一句话（综合官方判断） |
|------|------|------------------------|
| 能源 | **瓶颈期** | IEA：已从「硅短缺」转向「能源与冷却约束」为首要瓶颈 |
| 芯片 | **爆发期** | Gartner：20 年来最高增速；AI 芯片占 30% |
| 基础设施 | **建设高峰** | IEA：Capex 超油气投资；AI 工厂 18 个月 3 倍 |
| 模型 | **门槛跨越** | NVIDIA：可规模有用；Gartner：支出高增但 POC 挑战仍存 |
| 应用 | **商业化初期** | 国务院 2027 目标 70% 普及率；NVIDIA：部分赛道已 PMF |

---

## 权威来源索引

### 国际官方 / 权威机构

| 来源 | 链接 | 引用要点 |
|------|------|----------|
| **NVIDIA 五层蛋糕** | https://blogs.nvidia.com/blog/ai-5-layer-cake/ | 五层定义、实时智能、应用三分法 |
| **NVIDIA 达沃斯 WEF** | https://blogs.nvidia.com/blog/davos-wef-blackrock-ceo-larry-fink-jensen-huang/ | 最大基础设施建设、国家级基础设施 |
| **NVIDIA GTC 2026** | https://nvidianews.nvidia.com/news/nvidia-ceo-jensen-huang-and-global-technology-leaders-to-showcase-age-of-ai-at-gtc-2026 | 五层全栈展示、AI 工业时代 |
| **IEA Energy & AI 更新** | https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary | 485→950 TWh、AI 工厂 3 倍、HBM 短缺 |
| **IEA 数据中心需求** | https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai | Base Case / Lift-Off Case |
| **IEA Electricity 2026** | https://www.iea.org/reports/electricity-2026/demand | 美国数据中心占用电增长 50% |
| **Gartner 半导体 2026** | https://www.gartner.com/en/newsroom/press-releases/2026-04-08-gartner-forecasts-worldwide-semiconductor-revenue-to-exceed-us-dollars-one-point-3-trillion-in-2026 | 1.32 万亿美元、AI 芯片 30% |
| **Gartner IT 支出 2026** | https://www.gartner.com/en/newsroom/press-releases/2025-10-22-gartner-forecasts-worldwide-it-spending-to-grow-9-point-8-percent-in-2026-exceeding-6-trillion-dollars-for-the-first-time | 数据中心系统 7880 亿美元 |
| **Gartner GenAI 2025** | https://www.gartner.com/en/newsroom/press-releases/2025-03-31-gartner-forecasts-worldwide-genai-spending-to-reach-644-billion-in-2025 | 6440 亿美元 GenAI 支出 |
| **BIS 芯片出口管制** | https://www.bis.gov/media/documents/bis-guidance-may-31-2026.pdf | D:5/Macao 实体全球许可要求 |
| **Statista Hyperscaler Capex** | https://www.statista.com/chart/35046/capital-expenditure-of-meta-alphabet-amazon-and-microsoft/ | 7250 亿美元（引四大财报） |

### 中国官方

| 来源 | 链接 | 引用要点 |
|------|------|----------|
| **国务院「人工智能+」** | https://www.gov.cn/zhengce/zhengceku/202508/content_7037862.htm | 2027/2030/2035 三阶段目标 |
| **数字中国官网** | https://www.digitalchina.gov.cn/2025/xwzx/qwfb/202509/t20250923_5081840.htm | 7000 亿产业规模、1509 大模型、5100 企业 |

### 本地存档（补充投资视角）

| 本地文件 | 来源 | 补充用途 |
|----------|------|----------|
| [01_nvidia_ai_5_layer_cake.md](../资料文档/01_nvidia_ai_5_layer_cake.md) | NVIDIA 中文博客 | 中文原文对照 |
| [hangseng_sectorsc.pdf](../资料文档/hangseng_sectorsc.pdf) | 恒生银行 2026-05 | 电力瓶颈时间窗口、SaaS 颠覆 |
| [dfcfw_report.pdf](../资料文档/dfcfw_report.pdf) | 平安证券 2019-07 | 早期三层框架、产业链细分 |
| [02_ofweek_ai_investment_logic.md](../资料文档/02_ofweek_ai_investment_logic.md) | OFweek 2026-06 | A 股语境、马太效应、量化 Agent |
| [03_guosen_ai_asset_allocation_21.md](../资料文档/03_guosen_ai_asset_allocation_21.md) | 国信证券 2025-11 | Transformer + Agent 投研框架 |

---

## 可扩展方向

- 各层 A 股 / 港股 / 美股标的映射
- IEA 950 TWh 情景下的电力投资测算
- Capex 7250 亿 → 芯片出货量 → 能源需求传导模型

*本报告仅供产业研究参考，不构成任何投资建议。数据以各机构最新公开发布为准。*
