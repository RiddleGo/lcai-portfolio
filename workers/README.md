# 云端研报触发（可选 Worker）

## 推荐方式：每周自动（无需 Issue）

持仓（`quotes-data.js`）+ 云端关注（`watchlist-data.js`）**每周一**由 Actions 自动跑 LCAI + UZI 深度，写入 `reports/*/unified.json`。

网页点 **「⭐ 收藏」** 只加入本机关注；云端列表由 Actions 维护。

---

## 可选：GitHub Issue（单票加急）

仍可用 Issue `[report] 代码` 触发单票生成（见 `report-on-issue.yml`），一般不必。

---

## 高级：Cloudflare Worker（真正一键，需 PAT）

仅当你不想多点一次 Issue 提交时才需要。

### PAT 是什么？

GitHub **Personal Access Token**：给程序用的访问令牌，相当于「自动化专用密码」。  
**只能你自己在 GitHub 创建**，任何人（包括 AI）都无法替你生成。

创建：<https://github.com/settings/tokens?type=beta>  
权限：`lcai-portfolio` 仓库 → Actions Read/Write + Contents Read/Write

### 部署 Worker

1. [Cloudflare Workers](https://workers.cloudflare.com/) 创建 Worker
2. 粘贴 [`trigger-report.mjs`](trigger-report.mjs)
3. Secrets：
   - `GITHUB_TOKEN` = 你的 PAT
   - `TRIGGER_KEY` = 自设随机字符串
4. 在选股页「高级：Worker 一键触发」填入 URL + 密钥

**切勿**把 PAT 提交到 GitHub 或发给他人。
